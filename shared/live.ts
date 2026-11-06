export const OFFICIAL_API = "https://api.squeekchain.com";
export const CHAIN_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
export const PIN = {
  installation: "sepolia-core-sepolia-20261103",
  chainId: "11155111",
  core: "0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4",
  implementation: "0x6869d6102696243fd17013ab955d99cd0c522ad3",
  stream: "0xa78faebd5aad38b4f90c7f61b9c5c10e8d9b9afe74ebfc2e82ca98b7e57ed562",
};
type Dict = Record<string, any>;
export type LiveSnapshot = {
  installation: string;
  currentRound: number;
  endAt: number;
  cutoffAt: number;
  fetchedAt: number;
  generatedAt: string;
  safeBlock: string;
  settledThrough: number;
  genesis: number;
  duration: number;
  distanceMm: number;
  rpm: number;
  work: number;
  activity: string;
  circumferenceMm: number;
};
function uint(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value))
    throw new Error("Invalid decimal value from Squeekchain.");
  return BigInt(value);
}
function safe(value: unknown): number {
  const n = uint(value);
  if (n > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Squeekchain value is too large.");
  return Number(n);
}
export function validateLive(
  status: Dict,
  core: Dict,
  stats: Dict,
  now = Date.now(),
): LiveSnapshot {
  if (
    status.schemaVersion !== 1 ||
    core.schemaVersion !== 1 ||
    stats.schemaVersion !== 1 ||
    core.status !== "available" ||
    core.core?.paused !== false ||
    status.installationId !== PIN.installation ||
    core.installationId !== PIN.installation ||
    stats.installationId !== PIN.installation ||
    core.chain?.chainId !== PIN.chainId ||
    core.identities?.core !== PIN.core ||
    core.implementation?.codeAddress !== PIN.implementation ||
    core.configuration?.streamId !== PIN.stream
  )
    throw new Error(
      "Live Squeekchain is unavailable or its deployment has changed. Colony progress is paused.",
    );
  const m = status.measurement;
  const age = now - Date.parse(status.generatedAt),
    measuredAge = now - Date.parse(m?.receivedAt);
  if (
    !m ||
    m.freshness !== "online" ||
    m.provenance !== "hardware" ||
    !["ACTIVE", "IDLE"].includes(m.coreStatus) ||
    status.oracle?.state !== "accepted" ||
    !Number.isFinite(age) ||
    age < -30000 ||
    age > 120000 ||
    !Number.isFinite(measuredAge) ||
    measuredAge < -30000 ||
    measuredAge > 120000
  )
    throw new Error(
      "Live wheel data is stale or unavailable. Assignments and settlement are paused.",
    );
  for (const field of ["distanceMm", "rpmMilli"])
    if (!Number.isSafeInteger(m[field]) || m[field] < 0)
      throw new Error("Invalid wheel measurement.");
  const accepted = uint(stats.lifetime?.acceptedWorkUnits),
    distance = uint(stats.lifetime?.observedDistanceMm);
  if (accepted === 0n || distance % accepted !== 0n)
    throw new Error("Wheel distance calibration is unavailable.");
  const circumferenceMm = Number(distance / accepted);
  if (circumferenceMm < 100 || circumferenceMm > 3000)
    throw new Error("Invalid wheel distance calibration.");
  const genesis = safe(core.configuration.genesisTimestamp) * 1000,
    duration = safe(core.configuration.roundDuration) * 1000;
  if (duration !== 600000 || genesis > now)
    throw new Error("Unsupported Squeekchain round schedule.");
  const currentRound = Math.floor((now - genesis) / duration) + 1,
    endAt = genesis + currentRound * duration;
  return {
    installation: PIN.installation,
    currentRound,
    endAt,
    cutoffAt: endAt - 15000,
    fetchedAt: now,
    generatedAt: status.generatedAt,
    safeBlock: String(uint(core.chain.safeThroughBlock)),
    settledThrough: safe(core.core.settledThroughRound),
    genesis,
    duration,
    distanceMm: m.distanceMm,
    rpm: m.rpmMilli / 1000,
    work: safe(status.builder?.queued?.openRoundWorkUnits),
    activity: m.coreStatus,
    circumferenceMm,
  };
}
export async function fetchLive(
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<LiveSnapshot> {
  async function get(path: string) {
    const response = await fetcher(OFFICIAL_API + path, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        `Squeekchain responded ${response.status}. Live play is paused.`,
      );
    return response.json();
  }
  const [status, core, stats] = await Promise.all([
    get("/v1/status"),
    get("/v1/core"),
    get("/v1/measurement/stats?range=7d"),
  ]);
  return validateLive(status, core, stats, now);
}

export function encodeRoundPage(after: number, through: number): string {
  if (
    ![after, through].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    through < after
  )
    throw new Error("Invalid page bounds.");
  // Selector generated with cast sig 'roundPage(uint64,uint64,uint256)'. ABI is pinned in README.
  return (
    "0xc8b9e08f" +
    [after, through, 16]
      .map((n) => BigInt(n).toString(16).padStart(64, "0"))
      .join("")
  );
}
export function decodeRoundPage(hex: string): {
  through: number;
  startWork: bigint;
  endWork: bigint;
  records: { id: number; cumulativeWork: bigint; dataHash: string }[];
} {
  if (!/^0x[0-9a-f]+$/i.test(hex) || (hex.length - 2) % 64 !== 0)
    throw new Error("Malformed roundPage response.");
  const bytes = (hex.length - 2) / 2;
  function word(offset: number): bigint {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset + 32 > bytes)
      throw new Error("Truncated roundPage response.");
    return BigInt("0x" + hex.slice(2 + offset * 2, 2 + (offset + 32) * 2));
  }
  const base = Number(word(0)),
    array = base + Number(word(base + 7 * 32));
  const count = Number(word(array));
  if (count > 16) throw new Error("Too many round records.");
  const records = [];
  for (let i = 0; i < count; i++) {
    const offset = array + 32 + i * 160;
    records.push({
      id: Number(word(offset)),
      cumulativeWork: word(offset + 32),
      dataHash:
        "0x" +
        word(offset + 128)
          .toString(16)
          .padStart(64, "0"),
    });
  }
  return {
    through: Number(word(base)),
    startWork: word(base + 32),
    endWork: word(base + 128),
    records,
  };
}
