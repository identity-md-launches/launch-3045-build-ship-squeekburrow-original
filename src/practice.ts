import recording from "./practice-rounds.json" with { type: "json" };
import {
  ACTIONS,
  actionCost,
  createColony,
  createPlayer,
  settleRound,
  type Action,
  type Assignment,
  type Colony,
  type Round,
} from "../shared/game.ts";

export type PracticeLog = {
  version: 1;
  name: string;
  joined: boolean;
  actions: Action[];
  pending: Action | null;
};
export const newPractice = (): PracticeLog => ({
  version: 1,
  name: "You",
  joined: false,
  actions: [],
  pending: null,
});
export const practiceRounds: Round[] = recording.rounds;

export function helperAssignments(
  state: Colony,
  roundId: number,
): Assignment[] {
  return state.players
    .filter((p) => p.id !== "you")
    .map((p) => {
      let action: Action =
        p.id === "clover"
          ? "forage"
          : state.resources.shelter < 76
            ? "fortify"
            : "explore";
      if (p.stamina < actionCost(action)) action = "rest";
      return { playerId: p.id, action, roundId };
    });
}
export function replayPractice(log: PracticeLog): Colony {
  if (
    log.version !== 1 ||
    typeof log.name !== "string" ||
    log.name.length > 20 ||
    !Array.isArray(log.actions) ||
    log.actions.length > 24 ||
    log.actions.some((a) => !ACTIONS.includes(a)) ||
    (log.pending !== null && !ACTIONS.includes(log.pending))
  )
    throw new Error("Invalid practice history.");
  let state = createColony(practiceRounds[0].id);
  state.players = [
    createPlayer("you", log.name, state.startRound),
    createPlayer("clover", "Clover", state.startRound),
    createPlayer("pip", "Pip", state.startRound),
  ];
  for (let i = 0; i < log.actions.length; i++) {
    const round = practiceRounds[i];
    state = settleRound(state, round, [
      ...helperAssignments(state, round.id),
      { playerId: "you", action: log.actions[i], roundId: round.id },
    ]);
  }
  if (
    log.pending &&
    (state.status !== "surviving" ||
      state.players[0].stamina < actionCost(log.pending))
  )
    throw new Error("Invalid pending practice assignment.");
  return state;
}
export const recordingInfo = {
  label: recording.label,
  capturedAt: recording.capturedAt,
  safeBlock: recording.safeBlock,
};
