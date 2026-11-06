import { randomBytes, randomUUID } from "node:crypto";
import {
  createColony,
  createPlayer,
  actionCost,
  ACTIONS,
  SEASON_ROUNDS,
} from "../shared/game.ts";
import { fetchLive } from "../shared/live.ts";
import { readRounds } from "./chain.mjs";

export class Service {
  constructor(store, options = {}) {
    this.store = store;
    this.clock = options.clock ?? Date.now;
    this.loadLive = options.loadLive ?? (() => fetchLive(fetch, this.clock()));
    this.loadRounds = options.loadRounds ?? readRounds;
    this.live = null;
    this.error = "Connecting to live Squeekchain…";
    this.lastAttempt = 0;
    this.pending = null;
  }
  async refresh() {
    if (this.pending) return this.pending;
    this.pending = this.sync().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  async sync() {
    this.lastAttempt = this.clock();
    try {
      const snapshot = await this.loadLive();
      const state = this.store.state();
      if (state?.status === "surviving") {
        const through = Math.min(
          snapshot.settledThrough,
          state.startRound + SEASON_ROUNDS - 1,
        );
        if (through > state.lastProcessedRound) {
          const rounds = await this.loadRounds(
            snapshot,
            state.lastProcessedRound,
            through,
          );
          for (const round of rounds) {
            if (this.store.state().status !== "surviving") break;
            this.store.settle(round);
          }
        }
      }
      this.live = snapshot;
      this.error = "";
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : "Live data is unavailable.";
    }
  }
  available() {
    return (
      !!this.live && !this.error && this.clock() - this.live.fetchedAt < 45000
    );
  }
  requireLive() {
    if (!this.available())
      throw Object.assign(
        new Error(this.error || "Live data is stale. Please retry."),
        { status: 503 },
      );
  }
  auth(token) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw Object.assign(
        new Error("Join the colony before choosing an assignment."),
        { status: 401 },
      );
    const session = this.store.session(token);
    if (!session)
      throw Object.assign(
        new Error("This colony session is no longer available. Join again."),
        { status: 401 },
      );
    return session;
  }
  join(name, existingToken) {
    this.requireLive();
    if (
      typeof name !== "string" ||
      !/^[\p{L}\p{N} _-]{2,20}$/u.test(name.trim())
    )
      throw Object.assign(
        new Error("Use 2–20 letters, numbers, spaces, hyphens or underscores."),
        { status: 400 },
      );
    const token =
      existingToken &&
      /^[a-f0-9]{64}$/.test(existingToken) &&
      this.store.session(existingToken)
        ? existingToken
        : randomBytes(32).toString("hex");
    return this.store.transaction(() => {
      let state = this.store.state();
      if (!state)
        state = createColony(
          this.live.currentRound + (this.clock() >= this.live.cutoffAt ? 1 : 0),
        );
      if (state.status !== "surviving")
        throw Object.assign(
          new Error("This season has ended. Begin a new season first."),
          { status: 409 },
        );
      const previous = this.store.session(token);
      if (state.players.some((p) => p.id === previous?.playerId))
        return { token, playerId: previous.playerId };
      if (state.players.length >= 64)
        throw Object.assign(new Error("This colony is full for the season."), {
          status: 409,
        });
      if (
        state.players.some(
          (p) => p.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
        )
      )
        throw Object.assign(
          new Error("That name is already in the burrow. Choose another."),
          { status: 409 },
        );
      const player = createPlayer(
        previous?.playerId ?? randomUUID(),
        previous?.name ?? name.trim(),
        this.live.currentRound,
      );
      state.players.push(player);
      if (!previous) this.store.register(token, player);
      this.store.save(state);
      return { token, playerId: player.id };
    });
  }
  assign(token, body) {
    this.requireLive();
    const { playerId } = this.auth(token),
      now = this.clock();
    if (
      Object.keys(body).sort().join(",") !== "action,roundId" ||
      !ACTIONS.includes(body.action) ||
      !Number.isSafeInteger(body.roundId)
    )
      throw Object.assign(new Error("Choose one valid assignment and round."), {
        status: 400,
      });
    if (body.roundId !== this.live.currentRound || now >= this.live.cutoffAt)
      throw Object.assign(
        new Error(
          "Assignments are locked for this round. Wait for the next one.",
        ),
        { status: 409 },
      );
    return this.store.transaction(() => {
      const state = this.store.state(),
        player = state?.players.find((p) => p.id === playerId);
      if (
        !player ||
        state.status !== "surviving" ||
        body.roundId < state.startRound ||
        body.roundId >= state.startRound + SEASON_ROUNDS
      )
        throw Object.assign(
          new Error("This season is not accepting assignments."),
          { status: 409 },
        );
      if (
        body.roundId <= state.lastProcessedRound ||
        this.store
          .assignments(state.season, body.roundId)
          .some((a) => a.playerId === playerId)
      )
        throw Object.assign(
          new Error("Your assignment is already locked in."),
          { status: 409 },
        );
      if (player.stamina < actionCost(body.action))
        throw Object.assign(
          new Error("Not enough stamina. Choose Rest this round."),
          { status: 409 },
        );
      // Chain confirmation may lag several rounds. Reserve earlier commitments rather
      // than accepting actions that will become impossible once those rounds settle.
      const pending = new Map(
        this.store
          .pendingForPlayer(
            state.season,
            playerId,
            state.lastProcessedRound,
            body.roundId,
          )
          .map((a) => [a.roundId, a.action]),
      );
      let minimumStamina = player.stamina;
      for (
        let round = state.lastProcessedRound + 1;
        round < body.roundId;
        round++
      ) {
        const action = pending.get(round);
        minimumStamina = Math.max(
          0,
          Math.min(
            100,
            minimumStamina +
              (!action
                ? 8
                : action === "rest"
                  ? 38
                  : -actionCost(action) - (action === "explore" ? 8 : 0)),
          ),
        );
      }
      if (minimumStamina < actionCost(body.action))
        throw Object.assign(
          new Error(
            "Earlier assignments use your remaining stamina. Choose Rest while they settle.",
          ),
          { status: 409 },
        );
      this.store.commit(state.season, body.roundId, playerId, body.action, now);
      return { ok: true, roundId: body.roundId, action: body.action };
    });
  }
  view(token) {
    const session =
      token && /^[a-f0-9]{64}$/.test(token) ? this.store.session(token) : null;
    const colony = this.store.state(),
      round = this.live?.currentRound;
    const assignments =
      colony && round ? this.store.assignments(colony.season, round) : [];
    return {
      colony,
      playerId: session?.playerId ?? null,
      live: this.live,
      available: this.available(),
      error: this.available()
        ? ""
        : this.error || "Live data is stale. Progress is paused.",
      assignment:
        assignments.find((a) => a.playerId === session?.playerId) ?? null,
      assignments: Object.fromEntries(
        ACTIONS.map((action) => [
          action,
          assignments.filter((a) => a.action === action).length,
        ]),
      ),
      serverTime: this.clock(),
    };
  }
}
