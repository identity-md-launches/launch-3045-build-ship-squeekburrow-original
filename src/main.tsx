import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ACTIONS,
  SEASON_ROUNDS,
  actionCost,
  type Action,
  type Colony,
  type Resolution,
} from "../shared/game";
import { fetchLive, OFFICIAL_API, type LiveSnapshot } from "../shared/live";
import {
  newPractice,
  replayPractice,
  practiceRounds,
  helperAssignments,
  recordingInfo,
  type PracticeLog,
} from "./practice";
import { Avatar, Burrow } from "./Burrow";
import { Icon, type IconName } from "./icons";
import "./styles.css";

type Mode = "practice" | "live";
type Page = "burrow" | "journal" | "colony";
type Modal = "guide" | "join" | "settings" | "restart" | null;
type ServiceView = {
  colony: Colony | null;
  playerId: string | null;
  live: LiveSnapshot | null;
  available: boolean;
  error: string;
  assignment: { action: Action; roundId: number } | null;
  assignments: Record<Action, number>;
  serverTime: number;
};
const actionInfo: Record<
  Action,
  {
    name: string;
    icon: IconName;
    description: string;
    outcome: string;
    button: string;
  }
> = {
  forage: {
    name: "Forage",
    icon: "leaf",
    description: "Gather food",
    outcome: "Gather 9–31 food. More wheel travel means a bigger harvest.",
    button: "Forage for the colony",
  },
  fortify: {
    name: "Fortify",
    icon: "shield",
    description: "Protect shelter",
    outcome:
      "Use up to 5 timber to repair shelter and soften storms or collapses.",
    button: "Fortify the burrow",
  },
  explore: {
    name: "Explore",
    icon: "compass",
    description: "Find supplies",
    outcome:
      "Bring back timber and discover supplies. Risk losing extra stamina.",
    button: "Explore the tunnels",
  },
  rest: {
    name: "Rest",
    icon: "moon",
    description: "Restore stamina",
    outcome:
      "Recover up to 38 stamina and add 2 morale. Supper still uses food.",
    button: "Rest in the nest",
  },
};
const resourceInfo: {
  key: keyof Colony["resources"];
  label: string;
  unit: string;
  icon: IconName;
  max?: number;
}[] = [
  { key: "food", label: "Food", unit: "in the pantry", icon: "seed" },
  { key: "timber", label: "Timber", unit: "ready to build", icon: "wood" },
  {
    key: "shelter",
    label: "Shelter",
    unit: "integrity",
    icon: "shield",
    max: 100,
  },
  {
    key: "morale",
    label: "Morale",
    unit: "colony spirits",
    icon: "heart",
    max: 100,
  },
];
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function initialPractice(): PracticeLog {
  try {
    const raw = readStorage("squeekburrow.practice.v1");
    if (raw) {
      const log = JSON.parse(raw);
      replayPractice(log);
      return log;
    }
  } catch {
    /* invalid saves cannot set resource totals */
  }
  return newPractice();
}
function getPage(): Page {
  const hash = location.hash.slice(1);
  return hash === "journal" || hash === "colony" ? hash : "burrow";
}
function serviceAddress(raw: string): string {
  if (!raw.trim()) return "";
  const url = new URL(raw.trim());
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error(
      "Enter an HTTPS service origin, such as https://your-colony.example.",
    );
  return url.origin;
}
function ModalDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    el.showModal();
    return () => {
      if (el.open) el.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Guide() {
  return (
    <div className="guide">
      <div className="guide-welcome">
        <Avatar size={72} />
        <p>
          A shared home. Four assignments. One winter to get through together.
        </p>
      </div>
      <ol>
        <li>
          <strong>Choose one assignment.</strong> Balance the colony’s supplies
          against your stamina.
        </li>
        <li>
          <strong>Lock in before nightfall.</strong> Live choices close 15
          seconds before each ten-minute Squeekchain round ends. A committed
          choice is final.
        </li>
        <li>
          <strong>Weather the outcome together.</strong> Confirmed wheel work
          determines travel, supplies, and hazards. Survive 24 rounds to win.
        </li>
      </ol>
      <div className="guide-actions">
        {ACTIONS.map((a) => (
          <div key={a}>
            <span className={`action-icon ${a}`}>
              <Icon name={actionInfo[a].icon} />
            </span>
            <p>
              <strong>{actionInfo[a].name}</strong>
              <br />
              {actionInfo[a].outcome}
            </p>
          </div>
        ))}
      </div>
      <p className="note">
        Food, shelter, or morale reaching zero ends the season. Storms damage
        shelter, cold nights consume food, and tunnel collapses cost timber.
        Found supplies are used automatically.
      </p>
      <p className="note">
        Practice replays real historical rounds with two computer helpers, saved
        on this device. Live play shares a server-owned colony. If live data is
        unavailable, assignments and settlement stop; missed rounds use reserves
        when data returns.
      </p>
      <a
        className="text-link"
        href="https://docs.squeekchain.com/developers/core/"
        target="_blank"
        rel="noreferrer"
      >
        How Squeekchain rounds work <Icon name="external" size={16} />
      </a>
    </div>
  );
}
function Resources({ colony }: { colony: Colony }) {
  return (
    <section className="resources" aria-label="Colony supplies">
      {resourceInfo.map(({ key, label, unit, icon, max }) => {
        const value = colony.resources[key],
          low =
            key === "food"
              ? value < 20
              : key === "timber"
                ? value < 5
                : value < 30;
        return (
          <div
            className={`resource resource-${key} ${low ? "resource-low" : ""}`}
            key={key}
          >
            <span className="resource-label">
              <Icon name={icon} size={19} />
              {label}
            </span>
            <div className="resource-value">
              {value}
              {max && <span>%</span>}
              {low && <span className="low-label">Low</span>}
            </div>
            {max ? (
              <progress
                max={max}
                value={value}
                aria-label={`${label}: ${value} percent`}
              />
            ) : (
              <span className="resource-caption">{unit}</span>
            )}
          </div>
        );
      })}
    </section>
  );
}
function Change({ label, value }: { label: string; value: number }) {
  return (
    <span
      className={`change ${value > 0 ? "positive" : value < 0 ? "negative" : ""}`}
    >
      {value > 0 ? "+" : ""}
      {value} {label.toLowerCase()}
    </span>
  );
}
function ResolutionView({
  entry,
  compact = false,
}: {
  entry: Resolution;
  compact?: boolean;
}) {
  const icon: IconName =
    entry.hazard === "Storm"
      ? "cloud"
      : entry.hazard === "Cold night"
        ? "moon"
        : entry.hazard === "Tunnel collapse"
          ? "wood"
          : "sun";
  return (
    <article className={`resolution ${compact ? "resolution-compact" : ""}`}>
      <div className="resolution-symbol">
        <Icon name={icon} size={24} />
      </div>
      <div className="resolution-body">
        <div className="row between wrap">
          <h3>{entry.hazard}</h3>
          <span className="muted small">
            Round {entry.day} · source #{entry.round.id}
          </span>
        </div>
        <p>{entry.text}</p>
        <div className="change-list">
          {resourceInfo.map((r) => (
            <Change key={r.key} label={r.label} value={entry.changes[r.key]} />
          ))}
        </div>
        <details>
          <summary>
            What happened <Icon name="arrow" size={16} />
          </summary>
          <ul>
            {entry.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
          <p className="source-note">
            Certified work: {entry.round.work} passages · Estimated wheel
            travel: {(entry.round.distanceMm / 1000).toFixed(3)} m<br />
            Ended {new Date(entry.round.endAt).toUTCString()}
            <br />
            <span className="source-string">{entry.round.source}</span>
          </p>
        </details>
      </div>
    </article>
  );
}
function Leaderboard({
  colony,
  playerId,
  practice,
  full = false,
}: {
  colony: Colony;
  playerId: string | null;
  practice: boolean;
  full?: boolean;
}) {
  const players = [...colony.players].sort(
    (a, b) => b.contribution - a.contribution || a.name.localeCompare(b.name),
  );
  return (
    <div className="leaderboard">
      {players.length === 0 ? (
        <p className="empty-copy">
          The first burrowmate is yet to arrive. Join and lend a paw.
        </p>
      ) : (
        <ol>
          {players.slice(0, full ? 64 : 5).map((p, i) => (
            <li key={p.id} className={p.id === playerId ? "is-you" : ""}>
              <span className="rank">{i + 1}</span>
              <Avatar kind={p.id === playerId ? 0 : i + 1} size={40} />
              <div className="leader-name">
                <strong>{p.name}</strong>
                <span className="small muted">
                  {p.id === playerId
                    ? "You"
                    : practice
                      ? "Practice helper"
                      : `${p.rounds} rounds contributed`}
                  {full && ` · ${p.stamina} stamina`}
                </span>
              </div>
              <strong className="points">
                {p.contribution}
                <span>points</span>
              </strong>
            </li>
          ))}
        </ol>
      )}
      <p className="board-note">
        {practice
          ? "A local practice colony with computer controlled helpers."
          : "Shared colony contributions for this season."}
      </p>
    </div>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>(() =>
    readStorage("squeekburrow.mode") === "live" ? "live" : "practice",
  );
  const [page, setPage] = useState<Page>(getPage);
  const [log, setLog] = useState<PracticeLog>(initialPractice);
  const [selected, setSelected] = useState<Action>(log.pending ?? "forage");
  const [modal, setModal] = useState<Modal>(null);
  const [nickname, setNickname] = useState(log.joined ? log.name : "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveFeed, setLiveFeed] = useState<LiveSnapshot | null>(null);
  const [feedError, setFeedError] = useState("");
  const [serviceUrl, setServiceUrl] = useState(
    () => readStorage("squeekburrow.service") ?? "",
  );
  const [serviceConfigured, setServiceConfigured] = useState(
    () => readStorage("squeekburrow.service") !== null,
  );
  const [serviceDraft, setServiceDraft] = useState(serviceUrl);
  const [service, setService] = useState<ServiceView | null>(null);
  const [serviceError, setServiceError] = useState(
    "Connecting to the shared colony…",
  );
  const [serviceAttempted, setServiceAttempted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const nameInput = useRef<HTMLInputElement>(null);
  const practice = useMemo(() => replayPractice(log), [log]);
  const tokenKey = `squeekburrow.session:${serviceUrl || "same-origin"}`;
  const serviceBase = serviceUrl || location.origin;
  const currentRequest = useRef(0);

  useEffect(() => {
    const handler = () => setPage(getPage());
    addEventListener("hashchange", handler);
    return () => removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!writeStorage("squeekburrow.practice.v1", JSON.stringify(log)))
      setNotice(
        "Practice is playable, but this browser could not save progress. Keep this tab open.",
      );
  }, [log]);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchLive();
        if (active) {
          setLiveFeed(data);
          setFeedError("");
        }
      } catch {
        if (active) setFeedError("Wheel feed unavailable");
      }
    }
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (readStorage("squeekburrow.service") !== null) return;
    fetch(new URL("./config.json", document.baseURI))
      .then((r) => (r.ok ? r.json() : null))
      .then((config) => {
        if (typeof config?.serviceUrl === "string") {
          const address = serviceAddress(config.serviceUrl);
          setServiceUrl(address);
          setServiceDraft(address);
          setServiceConfigured(true);
        } else {
          setServiceAttempted(true);
          setServiceError(
            "Shared live play requires a connected colony service.",
          );
        }
      })
      .catch(() => {});
  }, []);

  async function request(
    path: string,
    body?: Record<string, unknown>,
    explicitToken?: string,
  ) {
    const token = explicitToken ?? readStorage(tokenKey);
    const response = await fetch(serviceBase + "/api/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("A shared colony service is not connected to this site.");
    }
    if (!response.ok)
      throw new Error(
        result.error || result.message || "The shared colony is unavailable.",
      );
    return result;
  }
  async function refreshService(explicitToken?: string) {
    if (!serviceConfigured) {
      setServiceAttempted(true);
      setServiceError("Shared live play requires a connected colony service.");
      return;
    }
    const id = ++currentRequest.current;
    try {
      const value = await request("state", undefined, explicitToken);
      if (
        typeof value.available !== "boolean" ||
        !Number.isFinite(value.serverTime) ||
        !("colony" in value)
      )
        throw new Error(
          "A shared colony service is not connected to this site.",
        );
      if (id !== currentRequest.current) return;
      setService(value);
      setServiceError("");
      setServerOffset(value.serverTime - Date.now());
      if (readStorage("squeekburrow.mode") === null) setMode("live");
    } catch (e) {
      if (id !== currentRequest.current) return;
      setServiceError(
        e instanceof Error
          ? e.message
          : "The shared colony could not be reached.",
      );
      setService((previous) =>
        previous ? { ...previous, available: false } : null,
      );
    } finally {
      if (id === currentRequest.current) setServiceAttempted(true);
    }
  }
  useEffect(() => {
    if (!serviceConfigured) return;
    setService(null);
    setServiceAttempted(false);
    void refreshService();
    const timer = setInterval(() => {
      if (!document.hidden) void refreshService();
    }, 15000);
    return () => {
      clearInterval(timer);
      currentRequest.current++;
    };
  }, [serviceUrl, serviceConfigured]);

  const isPractice = mode === "practice";
  const colony = isPractice ? practice : (service?.colony ?? null);
  const playerId = isPractice ? "you" : (service?.playerId ?? null);
  const player = colony?.players.find((p) => p.id === playerId);
  const currentRound = isPractice
    ? practiceRounds[log.actions.length]?.id
    : service?.live?.currentRound;
  const committed = isPractice
    ? log.pending
    : (service?.assignment?.action ?? null);
  const finished = colony && colony.status !== "surviving";
  const serviceFresh = service?.live
    ? now - service.live.fetchedAt + serverOffset < 45000
    : false;
  const available =
    isPractice || !!(service?.available && !serviceError && serviceFresh);
  const cutoff =
    !isPractice &&
    !!service?.live &&
    now + serverOffset >= service.live.cutoffAt;
  const outsideSeason =
    !isPractice &&
    colony &&
    currentRound &&
    (currentRound < colony.startRound ||
      currentRound >= colony.startRound + SEASON_ROUNDS);
  const displayedFeed = isPractice ? liveFeed : service?.live;
  const feedFresh =
    displayedFeed &&
    (isPractice
      ? !feedError && now - displayedFeed.fetchedAt < 65000
      : available);
  const tooTired = !!player && player.stamina < actionCost(selected);
  const choiceLocked =
    !!committed || !!finished || cutoff || !!outsideSeason || !available;
  const counts = isPractice
    ? Object.fromEntries(
        ACTIONS.map((a) => [
          a,
          helperAssignments(practice, currentRound ?? 0).filter(
            (h) => h.action === a,
          ).length + (committed === a ? 1 : 0),
        ]),
      )
    : (service?.assignments ?? {});
  const last = colony?.history[0];
  const countdown = service?.live
    ? Math.max(
        0,
        Math.ceil((service.live.cutoffAt - now - serverOffset) / 1000),
      )
    : 0;
  const timerLabel = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`;

  function changeMode(next: Mode) {
    setMode(next);
    writeStorage("squeekburrow.mode", next);
    setError("");
    setNotice("");
    if (page !== "burrow") location.hash = "burrow";
  }
  function closeModal() {
    setModal(null);
    setError("");
  }
  function updateLog(next: PracticeLog) {
    setLog(next);
    setError("");
  }
  async function commitAssignment() {
    setError("");
    if ((isPractice && !log.joined) || (!isPractice && !player)) {
      setModal("join");
      return;
    }
    if (choiceLocked || tooTired || currentRound === undefined) return;
    setBusy(true);
    try {
      if (isPractice) updateLog({ ...log, pending: selected });
      else {
        await request("assignment", {
          action: selected,
          roundId: currentRound,
        });
        await refreshService();
      }
      setNotice(
        `${actionInfo[selected].name} locked in. ${isPractice ? "Resolve the practice round when you’re ready." : "Your colony will settle when the round is confirmed."}`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to lock in your assignment.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function join(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^[\p{L}\p{N} _-]{2,20}$/u.test(nickname.trim())) {
      setError("Use 2–20 letters, numbers, spaces, hyphens or underscores.");
      nameInput.current?.focus();
      return;
    }
    setBusy(true);
    try {
      if (isPractice)
        updateLog({
          ...log,
          joined: true,
          name: nickname.trim(),
          pending: selected,
        });
      else {
        const result = await request("join", { name: nickname.trim() });
        if (!writeStorage(tokenKey, result.token))
          throw new Error(
            "This browser cannot save your colony session. Enable site storage and try again.",
          );
        await refreshService(result.token);
      }
      closeModal();
      setNotice(
        isPractice
          ? `${actionInfo[selected].name} locked in. Welcome home, ${nickname.trim()}.`
          : `Welcome home, ${nickname.trim()}. Choose an assignment for this round.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to join the colony.");
    } finally {
      setBusy(false);
    }
  }
  function resolvePractice() {
    if (!log.pending || practice.status !== "surviving") return;
    const next = {
      ...log,
      actions: [...log.actions, log.pending],
      pending: null,
    };
    try {
      const result = replayPractice(next);
      updateLog(next);
      setSelected("forage");
      setNotice(
        `Round ${result.completed} settled. ${result.history[0].hazard}. Food ${result.resources.food}, shelter ${result.resources.shelter}, morale ${result.resources.morale}.`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Practice could not resolve this round.",
      );
    }
  }
  function restartPractice() {
    updateLog({ ...newPractice(), name: log.name, joined: log.joined });
    setSelected("forage");
    closeModal();
    setNotice("A fresh practice season is ready.");
  }
  async function nextSeason() {
    if (isPractice) {
      restartPractice();
      return;
    }
    setBusy(true);
    try {
      await request("season", {});
      await refreshService();
      setNotice("A new shared season is ready. Join to lend a paw.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function downloadRecap() {
    if (!colony) return;
    const data = {
      product: "SqueekBurrow",
      mode,
      exportedAt: new Date().toISOString(),
      colony,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `squeekburrow-${mode}-season-${colony.season}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const heading =
    page === "journal"
      ? "Every round tells a story."
      : page === "colony"
        ? "Many paws make a home."
        : "A home worth huddling for.";
  const modeLabel = isPractice ? "Practice burrow" : "Live colony";

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to game
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#burrow" aria-label="SqueekBurrow home">
            <img src="./favicon.svg" alt="" width="40" height="40" />
            <span>
              Squeek<span className="brand-light">Burrow</span>
            </span>
          </a>
          <nav className="primary-nav" aria-label="Game sections">
            {(
              [
                { id: "burrow", label: "The burrow", icon: "home" },
                { id: "journal", label: "Field journal", icon: "book" },
                { id: "colony", label: "Burrowmates", icon: "people" },
              ] as const
            ).map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                aria-current={page === n.id ? "page" : undefined}
              >
                <Icon name={n.icon} />
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
          <div className="header-tools">
            <button
              type="button"
              className="icon-button"
              aria-label="How to play"
              onClick={() => {
                setError("");
                setModal("guide");
              }}
            >
              <Icon name="help" size={22} />
            </button>
            <button
              type="button"
              className="profile-button"
              onClick={() => {
                setError("");
                setModal("settings");
              }}
              aria-label="Burrow settings"
            >
              <Avatar size={38} />
              <span>{player?.name ?? "Burrow settings"}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <h1>{heading}</h1>
            <p>
              {page === "burrow"
                ? "A cooperative hamster survival game, one round at a time."
                : page === "journal"
                  ? "The harvests, close calls, and little wins that built our burrow."
                  : "Every meal gathered and tunnel mended counts."}
            </p>
          </div>
          <div className="mode-switch" role="group" aria-label="Game mode">
            <button
              type="button"
              className={isPractice ? "active" : ""}
              aria-pressed={isPractice}
              onClick={() => changeMode("practice")}
            >
              Practice
            </button>
            <button
              type="button"
              className={!isPractice ? "active" : ""}
              aria-pressed={!isPractice}
              onClick={() => changeMode("live")}
            >
              <span
                className={`status-dot ${service?.available && !serviceError ? "online" : ""}`}
              />
              Live colony
            </button>
          </div>
        </div>

        {!isPractice && (!service || !colony) && (
          <section className="service-empty">
            <div className="service-scene">
              <Burrow selected="rest" shelter={86} />
            </div>
            <div className="service-message">
              <Avatar size={76} />
              <h2>
                {service && available
                  ? "There’s room for your paws."
                  : serviceAttempted
                    ? "The shared burrow is resting."
                    : "Finding the shared burrow…"}
              </h2>
              <p>
                {service && available
                  ? "Be the first to join Bramblewood. One shared colony will survive 24 live Squeekchain rounds together."
                  : "A colony service keeps everyone’s assignments and supplies in sync. This static demo includes a full practice season."}
              </p>
              {!service && serviceAttempted && (
                <p className="connection-error" role="status">
                  {serviceError}
                </p>
              )}
              {service?.error && (
                <p className="connection-error" role="status">
                  {service.error}
                </p>
              )}
              <div className="row wrap">
                {service && available ? (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => {
                      setError("");
                      setModal("join");
                    }}
                  >
                    Join the colony <Icon name="arrow" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => changeMode("practice")}
                  >
                    Play a practice season <Icon name="arrow" />
                  </button>
                )}
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setError("");
                    setModal("settings");
                  }}
                >
                  Connect colony service
                </button>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setServiceAttempted(false);
                  void refreshService();
                }}
              >
                <Icon name="refresh" size={16} />
                Retry connection
              </button>
            </div>
          </section>
        )}

        {colony && (
          <>
            <div className="season-strip">
              <div className="season-identity">
                <span className="tiny-house">
                  <Icon name="home" size={18} />
                </span>
                <strong>Bramblewood colony</strong>
                <span className="season-number">Season {colony.season}</span>
              </div>
              <div className="season-progress">
                <span>
                  Round{" "}
                  <strong>
                    {Math.min(
                      colony.completed + (finished ? 0 : 1),
                      SEASON_ROUNDS,
                    )}
                  </strong>{" "}
                  of {SEASON_ROUNDS}
                </span>
                <div className="season-dots" aria-hidden="true">
                  {Array.from({ length: SEASON_ROUNDS }, (_, i) => (
                    <span
                      key={i}
                      className={
                        i < colony.completed
                          ? "done"
                          : i === colony.completed && !finished
                            ? "current"
                            : ""
                      }
                    />
                  ))}
                </div>
              </div>
              <span className="mode-caption">
                {isPractice
                  ? "Recorded rounds · your pace"
                  : "Squeekchain · Sepolia"}
              </span>
            </div>

            {!isPractice && !available && (
              <div className="live-error" role="alert">
                <Icon name="cloud" />
                <div>
                  <strong>Live play is paused</strong>
                  <p>
                    {serviceError ||
                      service?.error ||
                      "The last live reading is too old. No assignments or results will be guessed."}
                  </p>
                </div>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void refreshService()}
                >
                  Retry
                </button>
              </div>
            )}

            {page === "burrow" && (
              <>
                <div className="game-grid">
                  <section className="colony-stage" aria-label="Your burrow">
                    <div className="scene">
                      <div className="scene-top">
                        <span className="scene-location">
                          <span className="status-dot online" />
                          {finished
                            ? colony.status === "won"
                              ? "A season to remember"
                              : "Time to start again"
                            : "A little life beneath the oak"}
                        </span>
                        <span className="scene-weather">
                          <Icon name="sun" size={16} />
                          {isPractice ? "Practice" : "Live"}
                        </span>
                      </div>
                      <Burrow
                        selected={committed ?? selected}
                        shelter={colony.resources.shelter}
                        night={last?.hazard === "Cold night"}
                      />
                      <div className="scene-bottom">
                        <div className="avatar-stack">
                          <Avatar size={29} />
                          <Avatar kind={1} size={29} />
                          <Avatar kind={2} size={29} />
                        </div>
                        <span>
                          {colony.players.length}{" "}
                          {colony.players.length === 1
                            ? "burrowmate"
                            : "burrowmates"}
                          {isPractice
                            ? " · 2 practice helpers"
                            : " · one shared home"}
                        </span>
                        <span className="scene-leaf">
                          <Icon name="leaf" size={18} />
                        </span>
                      </div>
                    </div>
                    <Resources colony={colony} />
                  </section>

                  <section
                    className="assignment-panel"
                    aria-labelledby="assignment-heading"
                  >
                    {finished ? (
                      <div className={`season-result ${colony.status}`}>
                        <span className="result-icon">
                          <Icon
                            name={colony.status === "won" ? "trophy" : "leaf"}
                            size={40}
                          />
                        </span>
                        <h2 id="assignment-heading">
                          {colony.status === "won"
                            ? "We made it through."
                            : "Every burrow has a story."}
                        </h2>
                        <p>{colony.reason}</p>
                        <div className="result-numbers">
                          <div>
                            <strong>{colony.completed}</strong>
                            <span>rounds survived</span>
                          </div>
                          <div>
                            <strong>{player?.contribution ?? 0}</strong>
                            <span>your contribution</span>
                          </div>
                        </div>
                        <p className="small muted">
                          {isPractice
                            ? "Practice season complete. Your choices shaped this little home."
                            : "Season complete. The colony’s history is saved in the field journal."}
                        </p>
                        <button
                          type="button"
                          className="button primary"
                          disabled={
                            busy || (!isPractice && (!available || !playerId))
                          }
                          onClick={() => void nextSeason()}
                        >
                          Start a new season <Icon name="arrow" />
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={downloadRecap}
                        >
                          Save season recap
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="assignment-heading">
                          <h2 id="assignment-heading">Lend a little paw</h2>
                          <span className="assignment-status">
                            <Icon
                              name={committed || cutoff ? "lock" : "sun"}
                              size={15}
                            />
                            {committed
                              ? "Locked in"
                              : isPractice
                                ? "Your pace"
                                : cutoff
                                  ? "Cutoff passed"
                                  : `${timerLabel} to choose`}
                          </span>
                        </div>
                        <p className="assignment-intro">
                          One assignment. A whole colony counting on you.
                        </p>
                        <fieldset
                          className="assignment-options"
                          aria-describedby="assignment-guidance"
                          disabled={choiceLocked || busy}
                        >
                          <legend className="sr-only">
                            Choose one assignment for this round
                          </legend>
                          {ACTIONS.map((a) => (
                            <label
                              key={a}
                              className={`assignment-option ${a} ${(committed ?? selected) === a ? "selected" : ""}`}
                            >
                              <input
                                type="radio"
                                name="assignment"
                                value={a}
                                checked={(committed ?? selected) === a}
                                onChange={() => {
                                  setSelected(a);
                                  setError("");
                                }}
                                disabled={
                                  !!player && player.stamina < actionCost(a)
                                }
                              />
                              <span className="option-top">
                                <span className={`action-icon ${a}`}>
                                  <Icon name={actionInfo[a].icon} size={22} />
                                </span>
                                <span className="radio-mark">
                                  <Icon name="check" size={12} />
                                </span>
                              </span>
                              <strong>{actionInfo[a].name}</strong>
                              <span className="option-description">
                                {actionInfo[a].description}
                              </span>
                              <span className="option-cost">
                                <Icon name="bolt" size={13} />
                                {a === "rest"
                                  ? "+38 stamina"
                                  : `−${actionCost(a)} stamina`}
                                {!!counts[a] && (
                                  <span className="option-count">
                                    <Icon name="people" size={13} />
                                    {counts[a]}
                                  </span>
                                )}
                              </span>
                            </label>
                          ))}
                        </fieldset>
                        <div className="assignment-explainer">
                          <Icon
                            name={actionInfo[committed ?? selected].icon}
                            size={18}
                          />
                          <p>{actionInfo[committed ?? selected].outcome}</p>
                        </div>
                        {isPractice && committed ? (
                          <button
                            type="button"
                            className="button primary assignment-commit"
                            onClick={resolvePractice}
                          >
                            Resolve practice round <Icon name="arrow" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button primary assignment-commit"
                            disabled={busy || choiceLocked || tooTired}
                            onClick={() => void commitAssignment()}
                          >
                            {busy
                              ? "Saving assignment…"
                              : committed
                                ? `${actionInfo[committed].name} locked in`
                                : !available
                                  ? "Waiting for live data"
                                  : cutoff
                                    ? "Round assignments closed"
                                    : outsideSeason
                                      ? "Waiting for the next season"
                                      : !isPractice && !player
                                        ? "Join the colony"
                                        : actionInfo[selected].button}
                            <Icon
                              name={committed || cutoff ? "lock" : "arrow"}
                            />
                          </button>
                        )}
                        <p className="commit-note" id="assignment-guidance">
                          {committed
                            ? isPractice
                              ? "Replay the recorded outcome when you’re ready."
                              : "Your final choice is waiting for a confirmed round."
                            : tooTired
                              ? "Stamina is too low. Choose Rest this round."
                              : isPractice
                                ? "Recorded Squeekchain rounds, saved on this device."
                                : "Locks on commit, 15 seconds before round end."}
                        </p>
                      </>
                    )}
                    {error && modal === null && (
                      <p className="inline-error" role="alert">
                        {error}
                      </p>
                    )}
                  </section>
                </div>

                <div className="under-grid">
                  <div className="burrow-updates">
                    <section className="section-block">
                      <div className="section-heading">
                        <h2>The last little adventure</h2>
                        <a className="text-link" href="#journal">
                          Field journal <Icon name="arrow" size={16} />
                        </a>
                      </div>
                      {last ? (
                        <ResolutionView entry={last} compact />
                      ) : (
                        <div className="first-round">
                          <span className="first-round-icon">
                            <Icon name="book" size={25} />
                          </span>
                          <div>
                            <h3>A new chapter starts here.</h3>
                            <p>
                              Choose your first assignment. The harvest and
                              weather will appear here after the round.
                            </p>
                          </div>
                        </div>
                      )}
                    </section>
                    <section className="preparedness">
                      <div className="preparedness-heading">
                        <span className="pack-icon">
                          <Icon name="compass" size={22} />
                        </span>
                        <h2>A little preparation goes a long way.</h2>
                      </div>
                      <p>
                        {colony.resources.food < 20
                          ? "The pantry is running low. Send more paws to Forage before the next supper."
                          : colony.resources.shelter < 40
                            ? "The shelter needs care. Fortify now to soften the next storm or tunnel collapse."
                            : "Keep food stocked and shelter strong. An extra blanket can turn a cold night into a cozy one."}
                      </p>
                      <div className="supplies">
                        <span>
                          <Icon name="moon" size={17} />
                          {colony.inventory.blankets} blankets
                        </span>
                        <span>
                          <Icon name="shield" size={17} />
                          {colony.inventory.braces} tunnel braces
                        </span>
                        <span>
                          <Icon name="leaf" size={17} />
                          {colony.inventory.herbs} calming herbs
                        </span>
                      </div>
                    </section>
                  </div>
                  <aside className="personal-column">
                    <section className="your-paws">
                      <Avatar size={54} />
                      <div>
                        <h2>
                          {player
                            ? `${player.name}’s little legacy`
                            : "A place for your paws"}
                        </h2>
                        <span className="small muted">
                          {player?.contribution ?? 0} contribution ·{" "}
                          {player?.rounds ?? 0} rounds
                        </span>
                      </div>
                      <div className="stamina-row">
                        <span>
                          <Icon name="bolt" size={16} />
                          Stamina
                        </span>
                        <strong>
                          {player?.stamina ?? 100}
                          <span> / 100</span>
                        </strong>
                      </div>
                      <progress
                        value={player?.stamina ?? 100}
                        max="100"
                        aria-label={`Personal stamina: ${player?.stamina ?? 100} out of 100`}
                      />
                      {last?.personal[playerId ?? ""] && (
                        <p className="personal-result">
                          {last.personal[playerId!].text}
                        </p>
                      )}
                    </section>
                    <section className="section-block contributor-preview">
                      <div className="section-heading">
                        <h2>Good company</h2>
                        <a
                          className="text-link"
                          href="#colony"
                          aria-label="View all burrowmates"
                        >
                          <Icon name="arrow" size={18} />
                        </a>
                      </div>
                      <Leaderboard
                        colony={colony}
                        playerId={playerId}
                        practice={isPractice}
                      />
                    </section>
                  </aside>
                </div>
              </>
            )}

            {page === "journal" && (
              <div className="journal-layout">
                <section className="journal-main">
                  <div className="section-heading">
                    <h2>The colony chronicle</h2>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={downloadRecap}
                    >
                      Save recap <Icon name="book" size={17} />
                    </button>
                  </div>
                  <p className="muted">
                    {isPractice
                      ? "Practice outcomes from recorded, certified Squeekchain rounds."
                      : "Settled outcomes from the shared live colony. Each source round is processed once."}
                  </p>
                  {colony.history.length ? (
                    colony.history.map((entry) => (
                      <ResolutionView entry={entry} key={entry.round.id} />
                    ))
                  ) : (
                    <div className="journal-empty">
                      <Icon name="book" size={42} />
                      <h3>Our story is still unwritten.</h3>
                      <p>
                        Finish a round to see its harvest, hazard, and every
                        paw’s contribution.
                      </p>
                      <a className="button primary" href="#burrow">
                        Choose an assignment <Icon name="arrow" />
                      </a>
                    </div>
                  )}
                </section>
                <aside className="journal-sidebar">
                  <h2>Season at a glance</h2>
                  <dl>
                    <div>
                      <dt>Rounds survived</dt>
                      <dd>{colony.completed} / 24</dd>
                    </div>
                    <div>
                      <dt>Wheel travel</dt>
                      <dd>{(colony.totalDistanceMm / 1000).toFixed(1)} m</dd>
                    </div>
                    <div>
                      <dt>Last source round</dt>
                      <dd>
                        {colony.completed
                          ? `#${colony.lastProcessedRound}`
                          : "Not settled yet"}
                      </dd>
                    </div>
                    <div>
                      <dt>Season outcome</dt>
                      <dd>
                        {colony.status === "surviving"
                          ? "Still huddling"
                          : colony.status === "won"
                            ? "Survived"
                            : "Burrow lost"}
                      </dd>
                    </div>
                  </dl>
                  <p className="note">
                    {isPractice
                      ? recordingInfo.label
                      : "Authoritative state lives in the colony service, shared by every visitor."}
                  </p>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setModal("guide")}
                  >
                    Read the field guide <Icon name="arrow" size={16} />
                  </button>
                </aside>
              </div>
            )}

            {page === "colony" && (
              <div className="colony-layout">
                <section className="colony-board">
                  <div className="section-heading">
                    <h2>Colony contributors</h2>
                    <Icon name="trophy" size={25} />
                  </div>
                  <p className="muted">
                    Useful work earns contribution. Keeping everyone alive is
                    the real win.
                  </p>
                  <Leaderboard
                    colony={colony}
                    playerId={playerId}
                    practice={isPractice}
                    full
                  />
                </section>
                <aside className="colony-note">
                  <Avatar size={100} />
                  <h2>There’s no small contribution.</h2>
                  <p>
                    Forage fills bellies. Fortify keeps the rain out. Explore
                    brings home possibilities. Even a rested hamster is a
                    stronger teammate tomorrow.
                  </p>
                  <a className="button primary" href="#burrow">
                    Back to the burrow <Icon name="arrow" />
                  </a>
                  <p className="note">
                    {modeLabel} ·{" "}
                    {isPractice
                      ? "on this device"
                      : "shared with every burrowmate"}
                  </p>
                </aside>
              </div>
            )}
          </>
        )}

        <div className="connection-strip">
          <span className={`wheel-status ${feedFresh ? "connected" : ""}`}>
            <span className={`status-dot ${feedFresh ? "online" : ""}`} />
            {feedFresh
              ? "Squeekchain wheel connected"
              : isPractice
                ? feedError || "Connecting to Squeekchain…"
                : "Wheel feed unavailable"}
          </span>
          <span className="wheel-reading">
            {feedFresh
              ? `${displayedFeed.activity === "ACTIVE" ? "Turning" : "No new passages"} · ${displayedFeed.rpm.toFixed(1)} rpm · ${(displayedFeed.distanceMm / 1000000).toFixed(2)} km reported`
              : "Live wheel readings are unavailable"}
          </span>
          <a
            href={`${OFFICIAL_API}/v1/status`}
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            View source <Icon name="external" size={14} />
          </a>
        </div>
        <footer>
          <span className="footer-brand">
            <Icon name="leaf" size={17} />
            Small paws. Shared survival.
          </span>
          <div>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError("");
                setModal("guide");
              }}
            >
              How to play
            </button>
            <span className="footer-divider" />
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError("");
                setModal("settings");
              }}
            >
              Burrow settings
            </button>
            <span>{modeLabel}</span>
          </div>
        </footer>
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {notice}
        </div>
        {notice && (
          <p className="visible-notice">
            <Icon name="check" size={16} />
            {notice}
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss update"
              onClick={() => setNotice("")}
            >
              <Icon name="close" size={16} />
            </button>
          </p>
        )}
      </main>

      {modal === "guide" && (
        <ModalDialog title="The little field guide" onClose={closeModal}>
          <Guide />
        </ModalDialog>
      )}
      {modal === "join" && (
        <ModalDialog title="Make yourself at home." onClose={closeModal}>
          <form onSubmit={(e) => void join(e)} className="join-form">
            <div className="join-welcome">
              <Avatar size={80} />
              <p>
                {isPractice
                  ? "Clover and Pip have saved you a spot. They’re practice helpers; you bring the plan."
                  : "One shared colony. Every paw counts. Your name will appear to the other burrowmates."}
              </p>
            </div>
            <label htmlFor="nickname">Your burrowmate name</label>
            <input
              ref={nameInput}
              autoFocus
              id="nickname"
              name="nickname"
              autoComplete="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="e.g. Hazel"
              aria-invalid={!!error}
              aria-describedby="name-hint join-error"
            />
            <p id="name-hint" className="small muted">
              2–20 letters, numbers, spaces, hyphens or underscores.
            </p>
            <p id="join-error" className="inline-error" role="alert">
              {error}
            </p>
            <button type="submit" className="button primary" disabled={busy}>
              {busy
                ? "Making room…"
                : isPractice
                  ? `Join & ${actionInfo[selected].name.toLowerCase()}`
                  : "Join the shared colony"}
              <Icon name="arrow" />
            </button>
            <p className="note">
              {isPractice
                ? "Practice progress stays in this browser. No account needed."
                : "A private session stays in this browser. Save access by keeping site storage; there is no account recovery."}
            </p>
          </form>
        </ModalDialog>
      )}
      {modal === "settings" && (
        <ModalDialog title="Burrow settings" onClose={closeModal}>
          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const address = serviceAddress(serviceDraft);
                writeStorage("squeekburrow.service", address);
                setServiceUrl(address);
                setServiceConfigured(true);
                setServiceError("");
                setService(null);
                closeModal();
                changeMode("live");
                setNotice("Connecting to the shared colony service.");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <h3>Shared colony service</h3>
            <p>
              Connect to a hosted SqueekBurrow service to play with other
              burrowmates. Leave blank to use this site’s service.
            </p>
            <label htmlFor="service-url">Service URL</label>
            <input
              id="service-url"
              name="service-url"
              type="url"
              autoComplete="url"
              value={serviceDraft}
              onChange={(e) => setServiceDraft(e.target.value)}
              placeholder="https://your-colony.example"
              aria-describedby="service-help service-error"
              aria-invalid={!!error}
            />
            <p id="service-help" className="small muted">
              Use an origin you trust. Sessions are separate for each service.
            </p>
            <p id="service-error" role="alert" className="inline-error">
              {error}
            </p>
            <button type="submit" className="button primary">
              Connect colony service <Icon name="arrow" />
            </button>
          </form>
          <div className="practice-settings">
            <h3>Practice burrow</h3>
            <p>
              Replay the same 24 recorded rounds with a fresh colony. This
              clears your practice history on this device.
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setError("");
                setModal("restart");
              }}
            >
              Start practice over
            </button>
          </div>
        </ModalDialog>
      )}
      {modal === "restart" && (
        <ModalDialog
          title="Give the burrow a fresh start?"
          onClose={closeModal}
        >
          <p>
            Your practice assignments, contributions, and field journal will be
            cleared on this device.
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              onClick={closeModal}
            >
              Keep this burrow
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => {
                restartPractice();
                changeMode("practice");
              }}
            >
              Start practice over
            </button>
          </div>
        </ModalDialog>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
