import {
  CHAIN_RPC,
  PIN,
  encodeRoundPage,
  decodeRoundPage,
} from "../shared/live.ts";

export async function readRounds(snapshot, after, through, fetcher = fetch) {
  if (through <= after) return [];
  const block = "0x" + BigInt(snapshot.safeBlock).toString(16);
  const rpc = async (method, params) => {
    const res = await fetcher(CHAIN_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok)
      throw new Error(
        "The confirmed round archive is unavailable. Settlement is paused.",
      );
    const body = await res.json();
    if (body.error || body.result == null)
      throw new Error(
        "Unable to verify confirmed round history. Settlement is paused.",
      );
    return body.result;
  };
  if (BigInt(await rpc("eth_chainId", [])) !== BigInt(PIN.chainId))
    throw new Error("Round archive is on the wrong chain.");
  const header = await rpc("eth_getBlockByNumber", [block, false]);
  // Generate hex mechanically above, then verify the returned decimal block number.
  if (BigInt(header.number) !== BigInt(snapshot.safeBlock))
    throw new Error("Round archive returned the wrong block.");
  const results = [];
  let cursor = after;
  for (let pageIndex = 0; cursor < through && pageIndex < 4; pageIndex++) {
    const raw = await rpc("eth_call", [
      { to: PIN.core, data: encodeRoundPage(cursor, through) },
      block,
    ]);
    const page = decodeRoundPage(raw);
    if (page.through <= cursor || page.through > through)
      throw new Error("Round archive did not advance.");
    const records = new Map(page.records.map((r) => [r.id, r]));
    if (
      records.size !== page.records.length ||
      page.records.some((r) => r.id <= cursor || r.id > page.through)
    )
      throw new Error("Invalid certified round ordering.");
    let work = page.startWork;
    for (let id = cursor + 1; id <= page.through; id++) {
      const record = records.get(id),
        delta = record ? record.cumulativeWork - work : 0n;
      if (delta < 0n || delta > 10000n || (record && delta === 0n))
        throw new Error("Invalid certified wheel work.");
      if (record) work = record.cumulativeWork;
      const distance = delta * BigInt(snapshot.circumferenceMm);
      results.push({
        id,
        work: Number(delta),
        distanceMm: Number(distance),
        dataHash: record?.dataHash ?? `${PIN.stream}:certified-zero:${id}`,
        endAt: new Date(
          snapshot.genesis + id * snapshot.duration,
        ).toISOString(),
        source: `${CHAIN_RPC} · ${PIN.core} · block ${snapshot.safeBlock}`,
      });
    }
    if (work !== page.endWork)
      throw new Error("Round archive work totals disagree.");
    cursor = page.through;
  }
  if (cursor !== through)
    throw new Error("Incomplete certified round archive.");
  const finalHeader = await rpc("eth_getBlockByNumber", [block, false]);
  if (
    finalHeader.hash !== header.hash ||
    BigInt(finalHeader.number) !== BigInt(snapshot.safeBlock)
  )
    throw new Error("The source block changed. Retry settlement.");
  return results;
}
