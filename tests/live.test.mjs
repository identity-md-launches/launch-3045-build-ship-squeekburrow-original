import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateLive,
  fetchLive,
  encodeRoundPage,
  decodeRoundPage,
} from "../shared/live.ts";
import { readRounds } from "../server/chain.mjs";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/official.json", import.meta.url)),
);
const fixtureNow = Date.parse(fixture.status.generatedAt);
const valid = () =>
  validateLive(fixture.status, fixture.core, fixture.stats, fixtureNow);

test("the actual official API fixture validates with decimal-safe round scheduling and distance calibration", () => {
  const s = valid();
  assert.equal(s.circumferenceMm, 878);
  assert.equal(s.duration, 600000);
  assert.equal(s.cutoffAt, s.endAt - 15000);
  assert.ok(s.currentRound > s.settledThrough);
});
test("unavailable, stale, simulated, faulted or changed live data fails closed", () => {
  for (const mutate of [
    (f) => {
      f.core.status = "unavailable";
    },
    (f) => {
      f.status.measurement.freshness = "stale";
    },
    (f) => {
      f.status.measurement.provenance = "simulated";
    },
    (f) => {
      f.status.measurement.coreStatus = "COUNTER_FAULT";
    },
    (f) => {
      f.status.measurement = null;
    },
    (f) => {
      f.status.oracle.state = "blocked";
    },
    (f) => {
      f.core.identities.core = "unexpected-deployment";
    },
    (f) => {
      f.core.implementation.codeAddress = "upgraded";
    },
    (f) => {
      f.core.chain.chainId = "1";
    },
    (f) => {
      f.stats.lifetime.observedDistanceMm = "1";
    },
    (f) => {
      f.core.core.paused = true;
    },
    (f) => {
      f.status.generatedAt = "invalid";
    },
  ]) {
    const f = structuredClone(fixture);
    mutate(f);
    assert.throws(() => validateLive(f.status, f.core, f.stats, fixtureNow));
  }
  assert.throws(
    () =>
      validateLive(
        fixture.status,
        fixture.core,
        fixture.stats,
        fixtureNow + 130000,
      ),
    /stale/,
  );
});
test("network errors, non-200 and HTTP-200 unavailable bodies do not produce a live snapshot", async () => {
  await assert.rejects(
    () =>
      fetchLive(async () => {
        throw new Error("offline");
      }, fixtureNow),
    /offline/,
  );
  await assert.rejects(
    () =>
      fetchLive(async () => new Response("{}", { status: 503 }), fixtureNow),
    /503/,
  );
  await assert.rejects(
    () =>
      fetchLive(
        async () => new Response(JSON.stringify({ status: "unavailable" })),
        fixtureNow,
      ),
    /unavailable/,
  );
});
test("roundPage ABI parameters are generated rather than hand-converted", () => {
  const encoded = encodeRoundPage(334, 358);
  assert.equal(encoded.slice(0, 10), "0xc8b9e08f");
  assert.equal(BigInt("0x" + encoded.slice(10, 74)), 334n);
  assert.equal(BigInt("0x" + encoded.slice(74, 138)), 358n);
  assert.equal(BigInt("0x" + encoded.slice(138)), 16n);
  assert.throws(() => encodeRoundPage(20, 19));
  assert.throws(() => decodeRoundPage("0x01"));
});
test("a wrong returned RPC block number stops settlement, even if the RPC claims the right chain", async () => {
  const s = valid();
  const methods = [];
  const fake = async (_url, options) => {
    const request = JSON.parse(options.body);
    methods.push(request.method);
    return new Response(
      JSON.stringify({
        result:
          request.method === "eth_chainId"
            ? "0xaa36a7"
            : { number: "0x1", hash: "wrong" },
      }),
    );
  };
  await assert.rejects(() => readRounds(s, 334, 335, fake), /wrong block/);
  assert.deepEqual(methods, ["eth_chainId", "eth_getBlockByNumber"]);
});
