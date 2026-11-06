import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir, rm } from "node:fs/promises";
import { Store } from "../server/store.mjs";
import { Service } from "../server/service.mjs";
import { createColony, createPlayer } from "../shared/game.ts";

const rounds = JSON.parse(
  await readFile(new URL("../src/practice-rounds.json", import.meta.url)),
).rounds;
async function setup() {
  const store = new Store();
  let now = Date.parse(rounds[0].endAt) - 120000;
  const snapshot = () => ({
    fetchedAt: now,
    currentRound: rounds[0].id,
    cutoffAt: now + 60000,
    endAt: now + 75000,
    settledThrough: rounds[0].id - 1,
  });
  const service = new Service(store, {
    clock: () => now,
    loadLive: async () => snapshot(),
    loadRounds: async () => rounds.slice(0, 1),
  });
  await service.refresh();
  return {
    store,
    service,
    advance: (n) => {
      now += n;
    },
    now: () => now,
    snapshot,
  };
}
test("two independent sessions join exactly the same colony, with private server-issued authentication", async () => {
  const { store, service } = await setup();
  try {
    const a = service.join("Hazel"),
      b = service.join("Bramble");
    assert.notEqual(a.token, b.token);
    assert.match(a.token, /^[a-f0-9]{64}$/);
    assert.deepEqual(
      service.view(a.token).colony,
      service.view(b.token).colony,
    );
    assert.equal(service.view(a.token).colony.players.length, 2);
    assert.equal(service.view(b.token).playerId, b.playerId);
    assert.notEqual(
      store.db.prepare("SELECT tokenHash FROM sessions LIMIT 1").get()
        .tokenHash,
      a.token,
    );
    assert.throws(
      () =>
        service.assign("forged", { action: "forage", roundId: rounds[0].id }),
      /Join/,
    );
  } finally {
    store.close();
  }
});
test("duplicate commitments, wrong rounds, low stamina and injected resource fields are rejected", async () => {
  const { store, service } = await setup();
  try {
    const p = service.join("Hazel"),
      roundId = rounds[0].id;
    assert.throws(
      () => service.assign(p.token, { action: "forage", roundId, food: 9999 }),
      /valid assignment/,
    );
    assert.throws(
      () => service.assign(p.token, { action: "forage", roundId: roundId + 1 }),
      /locked/,
    );
    service.assign(p.token, { action: "forage", roundId });
    assert.throws(
      () => service.assign(p.token, { action: "rest", roundId }),
      /already locked/,
    );
    assert.equal(service.view(p.token).assignment.action, "forage");
    assert.equal(store.state().resources.food, 72);
  } finally {
    store.close();
  }
});
test("a client timestamp cannot bypass the exact server cutoff", async () => {
  const { store, service, advance } = await setup();
  try {
    const p = service.join("Hazel");
    advance(60000);
    // Keep freshness separate from the cutoff test.
    service.live.fetchedAt += 60000;
    assert.throws(
      () =>
        service.assign(p.token, { action: "forage", roundId: rounds[0].id }),
      /Assignments are locked/,
    );
    assert.equal(store.assignments(1, rounds[0].id).length, 0);
  } finally {
    store.close();
  }
});
test("unavailable live data rejects assignments and preserves every saved colony value", async () => {
  const { store, service } = await setup();
  try {
    const p = service.join("Hazel"),
      before = store.state();
    service.loadLive = async () => {
      throw new Error("Squeekchain offline");
    };
    await service.refresh();
    assert.equal(service.view(p.token).available, false);
    assert.match(service.view(p.token).error, /offline/);
    assert.throws(
      () =>
        service.assign(p.token, { action: "forage", roundId: rounds[0].id }),
      /offline/,
    );
    assert.deepEqual(store.state(), before);
  } finally {
    store.close();
  }
});
test("stale service snapshots fail closed even when the previous network request succeeded", async () => {
  const { store, service, advance } = await setup();
  try {
    const p = service.join("Hazel");
    advance(45001);
    assert.equal(service.available(), false);
    assert.throws(
      () => service.assign(p.token, { action: "rest", roundId: rounds[0].id }),
      /stale/,
    );
  } finally {
    store.close();
  }
});
test("earlier unconfirmed assignments reserve stamina and cannot deadlock later settlement", async () => {
  const { store, service, snapshot } = await setup();
  try {
    const p = service.join("Hazel");
    for (let offset = 0; offset < 3; offset++) {
      service.live = { ...snapshot(), currentRound: rounds[0].id + offset };
      if (offset < 2)
        service.assign(p.token, {
          action: "explore",
          roundId: service.live.currentRound,
        });
      else {
        // Two risky expeditions reserve up to 72 of the 100 stamina.
        const state = store.state();
        state.players[0].stamina = 90;
        store.save(state);
        assert.throws(
          () =>
            service.assign(p.token, {
              action: "explore",
              roundId: service.live.currentRound,
            }),
          /Earlier assignments/,
        );
        service.assign(p.token, {
          action: "rest",
          roundId: service.live.currentRound,
        });
      }
    }
    assert.equal(store.assignments(1, rounds[0].id + 2)[0].action, "rest");
  } finally {
    store.close();
  }
});
test("shared settlement processes committed choices once and failed archive reads change nothing", async () => {
  const { store, service, snapshot } = await setup();
  try {
    const p = service.join("Hazel");
    service.assign(p.token, { action: "forage", roundId: rounds[0].id });
    service.loadLive = async () => ({
      ...snapshot(),
      settledThrough: rounds[0].id,
    });
    service.loadRounds = async () => {
      throw new Error("Archive unavailable");
    };
    const before = store.state();
    await service.refresh();
    assert.deepEqual(store.state(), before);
    assert.equal(service.available(), false);
    service.loadRounds = async () => rounds.slice(0, 1);
    await service.refresh();
    const settled = store.state();
    assert.equal(settled.completed, 1);
    assert.ok(settled.players[0].contribution > 0);
    await service.refresh();
    assert.deepEqual(store.state(), settled);
    assert.equal(
      store.db.prepare("SELECT count(*) AS n FROM settled").get().n,
      1,
    );
  } finally {
    store.close();
  }
});
test("SQLite settlement survives a process restart; duplicate replay cannot alter persisted resources", async () => {
  await mkdir("test/scratch", { recursive: true });
  const path = `test/scratch/durable-${process.pid}.sqlite`;
  let store = new Store(path);
  try {
    const state = createColony(rounds[0].id);
    state.players = [createPlayer("durable", "Hazel", rounds[0].id)];
    store.save(state);
    store.commit(1, rounds[0].id, "durable", "forage", 1);
    assert.equal(store.settle(rounds[0]), true);
    const settled = store.state();
    store.close();
    store = new Store(path);
    assert.deepEqual(store.state(), settled);
    assert.equal(store.settle(rounds[0]), false);
    assert.deepEqual(store.state(), settled);
    assert.throws(() => store.settle(rounds[2]), /missing/);
    assert.deepEqual(store.state(), settled);
  } finally {
    store.close();
    for (const suffix of ["", "-wal", "-shm"])
      await rm(path + suffix, { force: true });
  }
});
test("registration validation and season transitions cannot reset an active colony", async () => {
  const { store, service } = await setup();
  try {
    for (const name of ["", "<script>", "x", "a".repeat(21)])
      assert.throws(() => service.join(name));
    service.join("Hazel");
    assert.throws(() => service.join("hazel"), /already/);
    assert.throws(() => store.nextSeason(rounds[1].id), /still running/);
    assert.equal(store.state().season, 1);
  } finally {
    store.close();
  }
});
