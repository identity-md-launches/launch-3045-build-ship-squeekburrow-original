import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import assert from "node:assert/strict";
import { readRounds } from "../server/chain.mjs";
import { OFFICIAL_API, CHAIN_RPC, PIN } from "../shared/live.ts";

const output = "test/scratch/live-smoke";
await mkdir(output, { recursive: true });
for (const suffix of ["", "-wal", "-shm"])
  await rm(`${output}/colony.sqlite${suffix}`, { force: true });
const socket = createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const child = spawn(process.execPath, ["server/index.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    SQUEEKBURROW_DATA: resolve(output),
    NODE_USE_ENV_PROXY: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
const report = {
  performedAt: new Date().toISOString(),
  api: OFFICIAL_API,
  rpc: CHAIN_RPC,
  chainId: PIN.chainId,
  core: PIN.core,
  checks: [],
  limitations: [],
};
const check = (name, extra = {}) => {
  report.checks.push({ name, passed: true, ...extra });
  console.log("PASS", name);
};
try {
  await new Promise((done, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "Production server did not become ready within 35 seconds.",
          ),
        ),
      35000,
    );
    child.stdout.on("data", (chunk) => {
      logs += chunk;
      if (logs.includes("SqueekBurrow listening")) {
        clearTimeout(timer);
        done();
      }
    });
    child.stderr.on("data", (chunk) => {
      logs += chunk;
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Production service exited ${code}.`));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  async function call(path, body, token) {
    const res = await fetch(base + "/api/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: await res.json() };
  }
  const initial = await call("state");
  assert.equal(initial.status, 200);
  assert.equal(initial.body.available, true, initial.body.error);
  check(
    "Production service reads fresh hardware data from the actual official API",
    {
      currentRound: initial.body.live.currentRound,
      settledThrough: initial.body.live.settledThrough,
      safeBlock: initial.body.live.safeBlock,
    },
  );
  const config = await (await fetch(base + "/config.json")).json();
  assert.equal(config.serviceUrl, "");
  const site = await fetch(base + "/");
  assert.equal(site.status, 200);
  assert.match(await site.text(), /SqueekBurrow/);
  check(
    "The production service serves the static export and enables same-origin service discovery",
  );
  const a = await call("join", { name: "Smoke Hazel" }),
    b = await call("join", { name: "Smoke Bramble" });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  const one = await call("state", undefined, a.body.token),
    two = await call("state", undefined, b.body.token);
  assert.deepEqual(one.body.colony, two.body.colony);
  assert.equal(one.body.colony.players.length, 2);
  check("Two independent HTTP sessions share one durable colony");
  const tampered = await call(
    "assignment",
    { action: "forage", roundId: one.body.live.currentRound, food: 999999 },
    a.body.token,
  );
  assert.equal(tampered.status, 400);
  const forged = await call(
    "assignment",
    { action: "forage", roundId: one.body.live.currentRound },
    "forged-session",
  );
  assert.equal(forged.status, 401);
  check(
    "The HTTP boundary rejects resource injection and forged authentication",
  );
  if (
    Date.now() < one.body.live.cutoffAt &&
    one.body.live.currentRound >= one.body.colony.startRound
  ) {
    const assignment = await call(
      "assignment",
      { action: "forage", roundId: one.body.live.currentRound },
      a.body.token,
    );
    assert.equal(assignment.status, 200, JSON.stringify(assignment.body));
    const duplicate = await call(
      "assignment",
      { action: "rest", roundId: one.body.live.currentRound },
      a.body.token,
    );
    assert.equal(duplicate.status, 409);
    const updated = await call("state", undefined, b.body.token);
    assert.equal(updated.body.assignments.forage, 1);
    assert.equal(updated.body.colony.resources.food, 72);
    check(
      "A real current-round assignment is visible across sessions, immutable, and does not settle early",
    );
  } else
    report.checks.push({
      name: "Current-round assignment",
      skipped: true,
      reason:
        "The real round cutoff has passed; the smoke check does not wait for the next round.",
    });
  const live = initial.body.live;
  const archived = await readRounds(
    live,
    live.settledThrough - 3,
    live.settledThrough,
  );
  assert.equal(archived.length, 3);
  assert.equal(archived.at(-1).id, live.settledThrough);
  check(
    "The actual confirmed contract archive decodes three consecutive source rounds",
    {
      rounds: archived.map((r) => ({
        id: r.id,
        work: r.work,
        distanceMm: r.distanceMm,
      })),
    },
  );
  if (process.argv.includes("--browser")) {
    const { validateLiveBrowsers } = await import("./live-browser.mjs");
    await validateLiveBrowsers(base, output, check, report);
  }
  report.limitations.push(
    "This bounded smoke check does not wait ten minutes for the chosen live round to resolve. Settlement and recovery are tested with official historical rounds in the automated suite.",
    "The service ran locally for validation; this does not establish a publicly hosted shared backend.",
  );
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  child.kill("SIGTERM");
  await new Promise((r) => {
    if (child.exitCode !== null) r();
    else {
      child.once("exit", r);
      setTimeout(() => {
        child.kill("SIGKILL");
        r();
      }, 2000).unref();
    }
  });
}
