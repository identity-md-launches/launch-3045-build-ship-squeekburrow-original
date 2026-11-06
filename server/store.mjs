import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { settleRound, createColony } from "../shared/game.ts";

export class Store {
  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS colony (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (tokenHash TEXT PRIMARY KEY, playerId TEXT UNIQUE NOT NULL, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assignments (season INTEGER, roundId INTEGER, playerId TEXT, action TEXT NOT NULL, committedAt INTEGER NOT NULL, PRIMARY KEY(season,roundId,playerId));
      CREATE TABLE IF NOT EXISTS settled (season INTEGER, roundId INTEGER, source TEXT NOT NULL, PRIMARY KEY(season,roundId));`);
  }
  close() {
    this.db.close();
  }
  state() {
    const row = this.db.prepare("SELECT state FROM colony WHERE id=1").get();
    return row ? JSON.parse(row.state) : null;
  }
  save(state) {
    this.db
      .prepare(
        "INSERT INTO colony (id,state) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state",
      )
      .run(JSON.stringify(state));
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  session(token) {
    return this.db
      .prepare("SELECT playerId,name FROM sessions WHERE tokenHash=?")
      .get(this.hash(token));
  }
  hash(token) {
    return createHash("sha256").update(token).digest("hex");
  }
  register(token, player) {
    this.db
      .prepare("INSERT INTO sessions VALUES (?,?,?)")
      .run(this.hash(token), player.id, player.name);
  }
  assignments(season, roundId) {
    return this.db
      .prepare(
        "SELECT playerId,action,roundId FROM assignments WHERE season=? AND roundId=?",
      )
      .all(season, roundId);
  }
  pendingForPlayer(season, playerId, after, before) {
    return this.db
      .prepare(
        "SELECT roundId,action FROM assignments WHERE season=? AND playerId=? AND roundId>? AND roundId<? ORDER BY roundId",
      )
      .all(season, playerId, after, before);
  }
  commit(season, roundId, playerId, action, now) {
    this.db
      .prepare("INSERT INTO assignments VALUES (?,?,?,?,?)")
      .run(season, roundId, playerId, action, now);
  }
  settle(round) {
    return this.transaction(() => {
      const current = this.state();
      if (
        !current ||
        current.status !== "surviving" ||
        round.id <= current.lastProcessedRound
      )
        return false;
      if (
        this.db
          .prepare("SELECT 1 FROM settled WHERE season=? AND roundId=?")
          .get(current.season, round.id)
      )
        return false;
      const next = settleRound(
        current,
        round,
        this.assignments(current.season, round.id),
      );
      this.db
        .prepare("INSERT INTO settled VALUES (?,?,?)")
        .run(current.season, round.id, JSON.stringify(round));
      this.save(next);
      return true;
    });
  }
  nextSeason(startRound) {
    const previous = this.state();
    if (previous?.status === "surviving")
      throw new Error("The current season is still running.");
    const next = createColony(startRound, (previous?.season ?? 0) + 1);
    this.save(next);
    return next;
  }
}
