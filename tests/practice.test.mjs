import test from "node:test";
import assert from "node:assert/strict";
import {
  newPractice,
  replayPractice,
  practiceRounds,
} from "../src/practice.ts";

test("practice uses 24 actual recorded source rounds and two clearly named helpers", () => {
  assert.equal(practiceRounds.length, 24);
  assert.equal(practiceRounds[0].id, 335);
  assert.equal(practiceRounds[23].id, 358);
  assert.equal(
    practiceRounds.reduce((n, r) => n + r.work, 0),
    7231,
  );
  assert.equal(
    practiceRounds.reduce((n, r) => n + r.distanceMm, 0),
    7231 * 878,
  );
  assert.deepEqual(
    replayPractice(newPractice()).players.map((p) => p.name),
    ["You", "Clover", "Pip"],
  );
});
test("browser storage contains decisions; injected resources cannot change the replayed result", () => {
  const log = {
    ...newPractice(),
    name: "Hazel",
    joined: true,
    actions: ["forage", "fortify"],
  };
  const altered = {
    ...log,
    resources: { food: 999999, shelter: 999999 },
    contribution: 999999,
  };
  assert.deepEqual(replayPractice(log), replayPractice(altered));
  assert.throws(() => replayPractice({ ...log, actions: ["mint"] }), /Invalid/);
});
test("neglecting the pantry loses even with helpers; allocating effort can survive all 24 rounds", () => {
  let neglect = newPractice();
  for (let i = 0; i < 24 && replayPractice(neglect).status === "surviving"; i++)
    neglect.actions.push("rest");
  assert.equal(replayPractice(neglect).status, "lost");
  let balanced = newPractice();
  while (
    balanced.actions.length < 24 &&
    replayPractice(balanced).status === "surviving"
  ) {
    const state = replayPractice(balanced),
      p = state.players[0],
      r = state.resources;
    balanced.actions.push(
      p.stamina < 28
        ? "rest"
        : r.food < 45
          ? "forage"
          : r.shelter < 65
            ? "fortify"
            : r.timber < 14
              ? "explore"
              : "forage",
    );
  }
  assert.equal(replayPractice(balanced).status, "won");
});
