import { writeFile } from "node:fs/promises";
import { fetchLive, PIN } from "../shared/live.ts";
import { readRounds } from "../server/chain.mjs";

const snapshot = await fetchLive();
// This fixture deliberately includes an active historical period. It is never served as live.
const rounds = await readRounds(snapshot, 334, 358);
await writeFile(
  new URL("../src/practice-rounds.json", import.meta.url),
  JSON.stringify(
    {
      label: "Recorded Squeekchain rounds, 6 November 2026. Practice only.",
      capturedAt: new Date().toISOString(),
      installation: PIN.installation,
      safeBlock: snapshot.safeBlock,
      rounds,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Captured ${rounds.length} certified historical rounds; total work ${rounds.reduce((n, r) => n + r.work, 0)}.`,
);
