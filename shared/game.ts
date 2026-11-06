export const SEASON_ROUNDS = 24;
export const ACTIONS = ["forage", "fortify", "explore", "rest"] as const;
export type Action = (typeof ACTIONS)[number];
export type Resources = {
  food: number;
  timber: number;
  shelter: number;
  morale: number;
};
export type Player = {
  id: string;
  name: string;
  stamina: number;
  contribution: number;
  rounds: number;
  lastActive: number;
  items: string[];
};
export type Round = {
  id: number;
  work: number;
  distanceMm: number;
  dataHash: string;
  endAt: string;
  source: string;
};
export type Assignment = { playerId: string; action: Action; roundId: number };
export type Resolution = {
  round: Round;
  day: number;
  hazard: string;
  severity: number;
  text: string;
  details: string[];
  changes: Resources;
  personal: Record<
    string,
    { action: Action; contribution: number; text: string }
  >;
};
export type Colony = {
  version: 1;
  season: number;
  startRound: number;
  lastProcessedRound: number;
  completed: number;
  status: "surviving" | "won" | "lost";
  reason: string;
  resources: Resources;
  players: Player[];
  history: Resolution[];
  inventory: { blankets: number; braces: number; herbs: number };
  totalDistanceMm: number;
};

export function createColony(startRound: number, season = 1): Colony {
  return {
    version: 1,
    season,
    startRound,
    lastProcessedRound: startRound - 1,
    completed: 0,
    status: "surviving",
    reason: "",
    resources: { food: 72, timber: 28, shelter: 86, morale: 80 },
    players: [],
    history: [],
    inventory: { blankets: 0, braces: 0, herbs: 0 },
    totalDistanceMm: 0,
  };
}
export function createPlayer(id: string, name: string, round: number): Player {
  return {
    id,
    name,
    stamina: 100,
    contribution: 0,
    rounds: 0,
    lastActive: round,
    items: [],
  };
}

/** Stable FNV-1a. Its inputs are certified round facts, never a browser random seed. */
export function roundSeed(round: Round, salt = ""): number {
  const value = `${round.id}|${round.work}|${round.distanceMm}|${round.dataHash}|${salt}`;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++)
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
  return hash;
}
export function hazardFor(round: Round): { name: string; severity: number } {
  const n = roundSeed(round, "weather");
  const name = ["Quiet evening", "Storm", "Cold night", "Tunnel collapse"][
    n % 4
  ];
  return { name, severity: 4 + ((n >>> 4) % 6) + (round.work === 0 ? 3 : 0) };
}
export function actionCost(action: Action): number {
  return { forage: 22, fortify: 18, explore: 28, rest: 0 }[action];
}
const clamp = (n: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Math.round(n)));

/** Pure reducer. Throws on duplicate, gaps, bad data, invalid assignments, and ended seasons. */
export function settleRound(
  input: Colony,
  round: Round,
  assignments: Assignment[],
): Colony {
  if (input.status !== "surviving") throw new Error("This season has ended.");
  if (round.id <= input.lastProcessedRound)
    throw new Error("Round already settled.");
  if (round.id !== input.lastProcessedRound + 1)
    throw new Error("A round is missing. Settlement paused.");
  if (
    !Number.isSafeInteger(round.id) ||
    !Number.isSafeInteger(round.work) ||
    round.work < 0 ||
    !Number.isSafeInteger(round.distanceMm) ||
    round.distanceMm < 0 ||
    !round.dataHash ||
    !Number.isFinite(Date.parse(round.endAt))
  ) {
    throw new Error("Invalid authoritative round.");
  }
  const s = structuredClone(input);
  const before = { ...s.resources },
    r = s.resources;
  const selected = new Map<string, Action>();
  for (const a of assignments) {
    if (
      a.roundId !== round.id ||
      !ACTIONS.includes(a.action) ||
      selected.has(a.playerId) ||
      !s.players.some((p) => p.id === a.playerId)
    )
      throw new Error("Invalid or duplicate assignment.");
    const p = s.players.find((p) => p.id === a.playerId)!;
    if (p.stamina < actionCost(a.action))
      throw new Error("Not enough stamina.");
    selected.set(a.playerId, a.action);
  }
  const personal: Resolution["personal"] = {},
    details: string[] = [];
  let protection = 0;
  // Stable ordering makes scarce timber allocation independent of request ordering.
  for (const p of [...s.players].sort((a, b) => a.id.localeCompare(b.id))) {
    const a = selected.get(p.id);
    if (!a) {
      p.stamina = clamp(p.stamina + 8);
      continue;
    }
    p.lastActive = round.id;
    p.rounds++;
    const luck = roundSeed(round, p.id);
    let points = 0,
      text = "";
    p.stamina -= actionCost(a);
    if (a === "forage") {
      const food =
        9 + Math.min(16, Math.floor(round.distanceMm / 22000)) + (luck % 7);
      r.food += food;
      points = food;
      text = `Gathered ${food} food.`;
    } else if (a === "fortify") {
      const timber = Math.min(5, r.timber);
      r.timber -= timber;
      const repaired = 4 + timber * 2;
      const old = r.shelter;
      r.shelter = clamp(r.shelter + repaired);
      protection += 5 + timber;
      points = 6 + r.shelter - old + timber;
      text = `Used ${timber} timber; repaired ${r.shelter - old} shelter and added ${5 + timber} protection.`;
    } else if (a === "explore") {
      const timber =
        6 + (luck % 7) + Math.min(4, Math.floor(round.distanceMm / 70000));
      r.timber += timber;
      points = timber;
      text = `Brought home ${timber} timber.`;
      if (luck % 5 === 0) {
        p.stamina = clamp(p.stamina - 8);
        r.morale -= 3;
        text += " A thorny passage cost 8 extra stamina and 3 morale.";
      } else if (luck % 3 === 0) {
        const key = (["blankets", "braces", "herbs"] as const)[
          (luck >>> 8) % 3
        ];
        s.inventory[key]++;
        p.items.push(key);
        points += 8;
        text += ` Discovered ${key}.`;
      }
    } else {
      const old = p.stamina;
      p.stamina = clamp(p.stamina + 38);
      r.morale += 2;
      points = 1;
      text = `Recovered ${p.stamina - old} stamina and lifted morale by 2.`;
    }
    p.contribution += points;
    personal[p.id] = { action: a, contribution: points, text };
    details.push(`${p.name}: ${text}`);
  }
  const weather = hazardFor(round);
  let severity = weather.severity;
  if (weather.name === "Storm") {
    const damage = Math.max(0, severity + 4 - protection);
    r.shelter -= damage;
    r.morale -= damage > 0 ? 2 : 0;
    details.push(
      `Storm: ${damage} shelter damage after ${protection} protection.`,
    );
  } else if (weather.name === "Cold night") {
    let cold = Math.max(1, severity - Math.floor(r.shelter / 25));
    if (s.inventory.blankets > 0) {
      cold = Math.max(0, cold - 6);
      s.inventory.blankets--;
      details.push("A blanket kept the sleeping chamber warm.");
    }
    r.food -= cold;
    r.morale -= Math.ceil(cold / 2);
    details.push(`Cold night: used ${cold} extra food.`);
  } else if (weather.name === "Tunnel collapse") {
    let damage = Math.max(0, severity - protection);
    if (s.inventory.braces > 0) {
      damage = 0;
      s.inventory.braces--;
      details.push("A tunnel brace stopped the collapse.");
    }
    r.shelter -= damage;
    r.timber -= Math.min(r.timber, Math.ceil(damage / 2));
    details.push(`Tunnel collapse: ${damage} shelter damage.`);
  } else {
    r.morale += 2;
    details.push("A quiet evening brought 2 morale.");
  }
  // Absent players become dormant after three rounds. A colony always needs a baseline meal.
  const mouths = Math.max(
    1,
    s.players.filter((p) => p.lastActive >= round.id - 2).length,
  );
  const upkeep = 8 + mouths * 3;
  r.food -= upkeep;
  r.shelter -= 2;
  details.push(
    `Supper: ${upkeep} food for ${mouths} active ${mouths === 1 ? "hamster" : "hamsters"}. Shelter weathered by 2.`,
  );
  if (r.food < 15) {
    r.morale -= 6;
    details.push("Food shortage: morale fell by 6.");
  }
  if (r.shelter < 25) {
    r.morale -= 4;
    details.push("Exposed chambers: morale fell by 4.");
  }
  if (s.inventory.herbs > 0 && r.morale < 55) {
    r.morale += 10;
    s.inventory.herbs--;
    details.push("Shared calming herbs restored 10 morale.");
  }
  r.food = clamp(r.food, 0, 9999);
  r.timber = clamp(r.timber, 0, 9999);
  r.shelter = clamp(r.shelter);
  r.morale = clamp(r.morale);
  s.completed++;
  s.lastProcessedRound = round.id;
  s.totalDistanceMm += round.distanceMm;
  // Survival is checked before a final-round victory.
  if (r.food === 0 || r.shelter === 0 || r.morale === 0) {
    s.status = "lost";
    s.reason =
      r.food === 0
        ? "The pantry ran out of food."
        : r.shelter === 0
          ? "The shelter could no longer keep the colony safe."
          : "The colony lost its last spark of morale.";
  } else if (s.completed >= SEASON_ROUNDS) {
    s.status = "won";
    s.reason = "Every paw made it through the season.";
  }
  const changes = {
    food: r.food - before.food,
    timber: r.timber - before.timber,
    shelter: r.shelter - before.shelter,
    morale: r.morale - before.morale,
  };
  s.history.unshift({
    round,
    day: s.completed,
    hazard: weather.name,
    severity,
    text: `${weather.name}. ${round.work > 0 ? `${(round.distanceMm / 1000).toFixed(1)} m of wheel travel fueled the colony.` : "No accepted wheel passages; the colony relied on its stores."}`,
    details,
    changes,
    personal,
  });
  return s;
}
