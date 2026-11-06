import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createColony,
  createPlayer,
  settleRound,
  hazardFor,
  roundSeed,
  SEASON_ROUNDS,
} from "../shared/game.ts";

const recording = JSON.parse(
  await readFile(new URL("../src/practice-rounds.json", import.meta.url)),
);
const rounds = recording.rounds;
const stateFor = (round = rounds[0]) => {
  const state = createColony(round.id);
  state.players = [createPlayer("test-player", "Hazel", round.id)];
  return state;
};
const assignment = (round, action, id = "test-player") => [
  { playerId: id, roundId: round.id, action },
];

test("settlement is deterministic, does not mutate input, and never calls Math.random", () => {
  const state = stateFor(),
    before = structuredClone(state),
    random = Math.random;
  Math.random = () => {
    throw new Error("Client randomness must not decide a round");
  };
  try {
    const one = settleRound(state, rounds[0], assignment(rounds[0], "forage"));
    assert.deepEqual(
      one,
      settleRound(state, rounds[0], assignment(rounds[0], "forage")),
    );
    assert.deepEqual(state, before);
    assert.equal(one.completed, 1);
    assert.equal(one.lastProcessedRound, rounds[0].id);
    assert.deepEqual(one.history[0].round, rounds[0]);
  } finally {
    Math.random = random;
  }
});
test("duplicate, old and skipped rounds cannot settle", () => {
  const first = settleRound(stateFor(), rounds[0], []);
  assert.throws(() => settleRound(first, rounds[0], []), /already settled/);
  assert.throws(() => settleRound(first, rounds[2], []), /missing/);
  assert.throws(
    () => settleRound(first, { ...rounds[0], id: rounds[0].id - 1 }, []),
    /already settled/,
  );
});
test("exactly one valid assignment is accepted per known player and source round", () => {
  const a = assignment(rounds[0], "forage")[0],
    state = stateFor();
  for (const actions of [
    [a, a],
    [{ ...a, roundId: a.roundId + 1 }],
    [{ ...a, playerId: "unknown" }],
    [{ ...a, action: "mint" }],
  ])
    assert.throws(
      () => settleRound(state, rounds[0], actions),
      /Invalid or duplicate/,
    );
});
test("foraging earns food and real wheel distance changes its yield", () => {
  const low = { ...rounds[2], distanceMm: 0 },
    high = { ...rounds[2], distanceMm: 800000 };
  const a = settleRound(stateFor(low), low, assignment(low, "forage"));
  const b = settleRound(stateFor(high), high, assignment(high, "forage"));
  assert.ok(b.players[0].contribution >= a.players[0].contribution + 10);
  assert.equal(a.players[0].stamina, 78);
  assert.ok(a.players[0].contribution >= 9);
});
test("fortifying consumes timber, repairs shelter and reduces storm/collapse damage", () => {
  const round = rounds.find((r) =>
    ["Storm", "Tunnel collapse"].includes(hazardFor(r).name),
  );
  const state = stateFor(round);
  state.resources.shelter = 50;
  const fortified = settleRound(state, round, assignment(round, "fortify"));
  const absent = settleRound(state, round, []);
  assert.ok(fortified.resources.shelter > absent.resources.shelter);
  assert.ok(fortified.resources.timber <= state.resources.timber - 5);
  assert.equal(fortified.players[0].stamina, 82);
});
test("fortifying with no timber still supplies effort but cannot make negative timber", () => {
  const state = stateFor();
  state.resources.timber = 0;
  state.resources.shelter = 45;
  const result = settleRound(
    state,
    rounds[0],
    assignment(rounds[0], "fortify"),
  );
  assert.equal(result.resources.timber, 0);
  assert.ok(
    result.history[0].personal["test-player"].text.includes("Used 0 timber"),
  );
});
test("exploring brings useful timber and deterministically produces both discoveries and risks", () => {
  let risk = false,
    discovery = false;
  for (const round of rounds) {
    const state = stateFor(round),
      result = settleRound(state, round, assignment(round, "explore"));
    assert.ok(result.players[0].contribution >= 6);
    const text = result.history[0].personal["test-player"].text;
    if (text.includes("thorny")) {
      risk = true;
      assert.equal(result.players[0].stamina, 64);
    }
    if (text.includes("Discovered")) {
      discovery = true;
      assert.equal(result.players[0].items.length, 1);
    }
  }
  assert.equal(risk, true);
  assert.equal(discovery, true);
});
test("rest restores capped stamina and makes little contribution", () => {
  const state = stateFor();
  state.players[0].stamina = 40;
  const rested = settleRound(state, rounds[0], assignment(rounds[0], "rest"));
  assert.equal(rested.players[0].stamina, 78);
  assert.equal(rested.players[0].contribution, 1);
  const full = settleRound(
    stateFor(),
    rounds[0],
    assignment(rounds[0], "rest"),
  );
  assert.equal(full.players[0].stamina, 100);
});
test("insufficient stamina is rejected; absent players recover but gain no contribution", () => {
  const state = stateFor();
  state.players[0].stamina = 5;
  assert.throws(
    () => settleRound(state, rounds[0], assignment(rounds[0], "explore")),
    /Not enough stamina/,
  );
  const absent = settleRound(state, rounds[0], []);
  assert.equal(absent.players[0].stamina, 13);
  assert.equal(absent.players[0].contribution, 0);
});
test("historical rounds exercise all four recurring weather outcomes deterministically", () => {
  const names = new Set(rounds.map((r) => hazardFor(r).name));
  assert.deepEqual(
    names,
    new Set(["Quiet evening", "Storm", "Cold night", "Tunnel collapse"]),
  );
  assert.equal(roundSeed(rounds[5]), roundSeed(structuredClone(rounds[5])));
  assert.notEqual(
    roundSeed(rounds[5]),
    roundSeed({ ...rounds[5], dataHash: rounds[6].dataHash }),
  );
});
test("food shortage lowers morale and zero food, shelter or morale loses a season", () => {
  for (const key of ["food", "shelter", "morale"]) {
    const state = stateFor();
    state.resources[key] = 0;
    if (key === "morale") {
      state.resources.food = 8;
      state.resources.shelter = 10;
    }
    const result = settleRound(state, rounds[0], []);
    assert.equal(result.status, "lost");
    assert.ok(result.reason.length > 0);
    assert.throws(() => settleRound(result, rounds[1], []), /season has ended/);
  }
});
test("surviving the documented 24th round wins, but a lethal final round loses first", () => {
  const state = stateFor();
  state.completed = SEASON_ROUNDS - 1;
  const won = settleRound(state, rounds[0], assignment(rounds[0], "rest"));
  assert.equal(won.status, "won");
  assert.equal(won.completed, 24);
  const fatal = structuredClone(state);
  fatal.resources.food = 1;
  assert.equal(settleRound(fatal, rounds[0], []).status, "lost");
});
test("scarce resource allocation does not depend on client assignment array order", () => {
  const state = stateFor();
  state.players.push(createPlayer("another-player", "Clover", rounds[0].id));
  state.resources.timber = 6;
  const actions = [
    ...assignment(rounds[0], "fortify"),
    ...assignment(rounds[0], "fortify", "another-player"),
  ];
  assert.deepEqual(
    settleRound(state, rounds[0], actions),
    settleRound(state, rounds[0], [...actions].reverse()),
  );
});
test("invalid authoritative values are rejected instead of becoming zero or fabricated rounds", () => {
  for (const fields of [
    { work: -1 },
    { distanceMm: NaN },
    { endAt: "unknown" },
    { dataHash: "" },
    { work: 2.5 },
  ])
    assert.throws(
      () => settleRound(stateFor(), { ...rounds[0], ...fields }, []),
      /Invalid authoritative/,
    );
});
