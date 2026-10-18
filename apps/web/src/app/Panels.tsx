import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowBendDownRight,
  ArrowRight,
  Brain,
  CaretRight,
  Graph,
  HandGrabbing,
  HourglassMedium,
  Lightning,
  LockSimpleOpen,
  NotePencil,
  Prohibit,
  Robot,
  SignOut,
  TreeStructure,
} from "@phosphor-icons/react";
import { api, type Blast, type Claim, type Conflict, type Decision, type FeedItem, type GNode } from "./api";
import type { Hit, LiveStatus } from "./useLive";
import { agentBadge, agentList, agentName, isScripted, namesEditor } from "./agents";

const EXPO = [0.16, 1, 0.3, 1] as const;

const ago = (t: number) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`;
};
const left = (until: number) => {
  const s = Math.max(0, Math.round((until - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const base = (p: string) => p.split("/").pop() ?? p;
export const hops = (n: number) => `${n} hop${n === 1 ? "" : "s"}`;

/* --------------------------------- Shared --------------------------------- */

/** Events newest first, cut at the newest `parse` (each demo run starts by parsing the repo). */
export function splitRuns(events: FeedItem[]) {
  const sorted = [...events].sort((a, b) => b.seq - a.seq);
  const i = sorted.findIndex((e) => e.kind === "parse");
  return i < 0 ? { latest: sorted, older: [] as FeedItem[] } : { latest: sorted.slice(0, i + 1), older: sorted.slice(i + 1) };
}

export const conflictOf = (e: FeedItem) => (e.payload as { conflicts?: Conflict[] } | null)?.conflicts?.[0];

/** Who was refused, for the live hit: the agent on the conflict event (the holder is conflict.agent). */
export function blockedBy(hit: Hit | null, events: FeedItem[]) {
  if (!hit) return null;
  const c = hit.conflict;
  const ev =
    events.find((e) => e.seq === hit.id && e.kind === "conflict") ??
    events.find((e) => e.kind === "conflict" && conflictOf(e)?.file === c.file);
  return ev?.agentId ? { agent: ev.agentId, conflict: c } : null;
}

/** The params the conflict query ran with, in words a judge can check against the Cypher. */
export const conflictParams = (c: Conflict, agent: string | null | undefined) =>
  `want = '${c.file}', $agent = '${agent ?? "?"}', IMPORTS*1..3, hubs not traversed`;

const TOOL: Record<string, string> = { cursor: "Cursor", claude: "Claude Code" };
/** The coding tool behind an agent: the snapshot's kind when it carries one, else its register event. */
export function agentTool(a: GNode, events: FeedItem[]) {
  const id = a.id.replace(/^agent:/, "");
  const fromNode = [a.kind, (a as unknown as Record<string, unknown>).agentKind].find((k) => typeof k === "string" && TOOL[k as string]);
  if (fromNode) return TOOL[fromNode as string];
  const reg = events.find((e) => e.kind === "register" && e.agentId === id);
  const k = (reg?.payload as { kind?: string } | null)?.kind;
  return k ? (TOOL[k] ?? k) : null;
}

export type WaitState = { kind: "waiting"; path: string; holder: string } | { kind: "free"; path: string };

/**
 * Who is waiting for a file and who may go now, from the newest events: a `wait` (refused, waiting for its
 * holder) until a `free` naming the agent, which lasts until that agent claims, is refused again or releases.
 * A claim or release after the refusal maps the agent to null: it moved on, so it is neither waiting nor
 * blocked (a freed waiter whose session ends must not show its old refusal again).
 */
export function waitStates(events: FeedItem[]): Map<string, WaitState | null> {
  const out = new Map<string, WaitState | null>();
  const settled = new Set<string>();
  const set = (agent: string, w: WaitState | null) => {
    if (!settled.has(agent)) out.set(agent, w);
    settled.add(agent);
  };
  for (const e of [...events].sort((a, b) => b.seq - a.seq)) {
    const p = (e.payload ?? {}) as { agent?: string; path?: string; holder?: string; waiters?: string[] };
    if (e.kind === "wait") {
      const agent = p.agent ?? e.agentId;
      if (agent && p.path) set(agent, { kind: "waiting", path: p.path, holder: p.holder ?? "" });
    } else if (e.kind === "free" && p.path) {
      for (const agent of p.waiters ?? []) set(agent, { kind: "free", path: p.path });
    } else if ((e.kind === "claim" || e.kind === "release") && e.agentId) set(e.agentId, null);
    else if (e.kind === "conflict" && e.agentId) settled.add(e.agentId);
  }
  return out;
}

/**
 * The named Cypher the server runs (GET /api/cypher, or the recorded set in replay). Null while loading
 * or when the route is missing. Fetched once health has picked a mode; a failure retries on the next status.
 */
export function useCypher(status: LiveStatus) {
  const [q, setQ] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (q || (status !== "live" && status !== "replay")) return;
    let on = true;
    api.cypher().then(
      (r) => on && setQ(r),
      () => undefined,
    );
    return () => {
      on = false;
    };
  }, [status, q]);
  return q;
}

export function CypherDisclosure({ query, params, label = "Cypher" }: { query?: string; params?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!query) return null;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="-my-1 inline-flex items-center gap-1 rounded-full py-1 font-mono text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
      >
        <CaretRight size={10} weight="bold" className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        {label}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EXPO }}
            className="overflow-hidden"
          >
            <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-[var(--border)] bg-[var(--bg)]/90 p-3 font-mono text-[10.5px] leading-[1.6] text-[var(--muted)]">
              {query.trim()}
            </pre>
            {params && <p className="mt-1.5 font-mono text-[10.5px] leading-relaxed text-[var(--muted)]">{params}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A dependency path as chips; the last one is the claim it ran into. */
export function PathChips({ path }: { path: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label={`Import path: ${path.join(" to ")}`}>
      {path.map((p, i) => (
        <motion.li
          key={`${p}-${i}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.08, duration: 0.35, ease: EXPO }}
          className="flex items-center gap-1.5"
        >
          {i > 0 && <ArrowRight size={11} className="text-[var(--color-signal)]" aria-hidden />}
          <span
            title={p}
            className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
              i === path.length - 1
                ? "border-[var(--color-signal)]/60 bg-[var(--color-signal-soft)] text-[var(--fg)]"
                : "border-[var(--color-signal)]/30 text-[var(--fg)]/90"
            }`}
          >
            {base(p)}
          </span>
        </motion.li>
      ))}
    </ol>
  );
}

const Skel = ({ className }: { className: string }) => <div className={`animate-pulse rounded-md bg-[var(--fg)]/[0.06] ${className}`} />;

function Section({ title, kind, children }: { title: string; kind: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="font-mono text-[10.5px] text-[var(--muted)]">{kind}</span>
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/* ---------------------------------- Agents ---------------------------------- */

export function AgentsPanel({
  agents,
  claims,
  events,
  status,
  hit,
  repo = null,
  onPick,
  onPath,
}: {
  agents: GNode[];
  claims: Claim[];
  events: FeedItem[];
  status: LiveStatus;
  /** A live graph's repo: real editors, so no Play to point at. */
  repo?: string | null;
  hit: Hit | null;
  onPick: (path: string) => void;
  onPath: (path: string[]) => void;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const blocked = useMemo(() => blockedBy(hit, events), [hit, events]);
  const waits = useMemo(() => waitStates(events), [events]);

  if (!agents.length) {
    if (status === "loading") {
      return (
        <div className="grid gap-3 p-4" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-[var(--radius-panel)] border border-[var(--border)] p-3">
              <div className="flex items-center gap-2.5">
                <Skel className="size-7 rounded-full" />
                <div className="grid flex-1 gap-1.5">
                  <Skel className="h-3 w-20" />
                  <Skel className="h-2.5 w-14" />
                </div>
              </div>
              <Skel className="mt-3 h-5 w-full" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <p className="p-5 text-sm leading-relaxed text-[var(--muted)]">
        {status === "offline" ? (
          "No agents to show while the server is unreachable."
        ) : repo ? (
          <>
            No agents yet. Start Claude Code or Cursor in <span className="font-mono text-[var(--fg)]">{repo}</span>: each one shows up here with its claims.
          </>
        ) : (
          <>
            No agents yet. Press <span className="text-[var(--fg)]">Play the demo</span>, or connect Claude Code or Cursor through the MCP server.
          </>
        )}
      </p>
    );
  }
  return (
    <ul className="grid gap-3 p-4">
      <AnimatePresence initial={false}>
        {agents.map((a, i) => {
          const id = a.id.replace(/^agent:/, "");
          const mine = claims.filter((c) => c.agent === id);
          const scripted = isScripted(id);
          // A scripted agent registers as a Cursor or Claude Code kind; it is neither, so it shows no tool.
          const tool = scripted || namesEditor(id) ? null : agentTool(a, events);
          const w = waits.get(id);
          // A wait (or the free after it) is newer than the refusal it follows, so it replaces the blocked row.
          const b = !waits.has(id) && blocked?.agent === id ? blocked.conflict : null;
          return (
            <motion.li
              key={a.id}
              data-agent={id}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.4, ease: EXPO, delay: i * 0.05 }}
              className={`rounded-[var(--radius-panel)] border bg-[var(--surface)]/80 p-3 transition-colors duration-300 ${
                b ? "border-[var(--color-signal)]/40" : "border-[var(--border)] hover:border-[var(--fg)]/20"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold transition-colors duration-300 ${
                    b ? "bg-[var(--color-signal)] text-[#1a0d08]" : "bg-[var(--fg)] text-[var(--bg)]"
                  }`}
                >
                  {agentBadge(id)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{agentName(id)}</span>
                    {scripted && (
                      <span className="shrink-0 rounded-full border border-[var(--border)] px-1.5 font-mono text-[10px] font-normal leading-4 text-[var(--muted)]">scripted</span>
                    )}
                  </p>
                  {tool && <p className="truncate text-xs text-[var(--muted)]">{tool}</p>}
                </div>
                <span className="shrink-0 text-[11px] text-[var(--muted)]">
                  {w?.kind === "waiting" ? "waiting" : w?.kind === "free" ? "can go" : b ? "blocked" : (a.status ?? "active")}
                </span>
              </div>
              <AnimatePresence initial={false}>
                {b && (
                  // The clipped wrapper animates, so padding and borders collapse with it (no end snap).
                  <motion.div
                    key={`${b.file}>${b.claimed}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={() => onPath(b.path)}
                        title="Show this path on the graph"
                        className="flex w-full items-start gap-2 rounded-md border border-[var(--color-signal)]/40 bg-[var(--color-signal-soft)] px-2 py-1.5 text-left font-mono text-[11px] leading-snug transition-colors hover:bg-[var(--color-signal)]/25"
                      >
                        <Prohibit size={13} className="mt-px shrink-0 text-[var(--color-signal)]" aria-hidden />
                        <span>
                          blocked: {b.file} → held by {agentName(b.agent)} · {hops(b.hops)}
                        </span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
              {w && (
                // Same clipped height-and-fade as the blocked row; keyed by state so waiting to free crossfades.
                <motion.div
                  key={`${w.kind}:${w.path}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                  className="overflow-hidden"
                >
                <p
                  className={`mt-3 flex items-start gap-2 rounded-md border px-2 py-1.5 font-mono text-[11px] leading-snug ${
                    w.kind === "free" ? "border-[var(--fg)]/25 text-[var(--fg)]" : "border-dashed border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {w.kind === "waiting" ? (
                    <HourglassMedium size={13} className="mt-px shrink-0" aria-hidden />
                  ) : (
                    <LockSimpleOpen size={13} className="mt-px shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 break-words">
                    {w.kind === "waiting"
                      ? `waiting for ${w.path}${w.holder ? `, held by ${agentName(w.holder)}` : ""}`
                      : `${w.path} is free: go`}
                  </span>
                </p>
                </motion.div>
              )}
              </AnimatePresence>
              {mine.length > 0 && (
                <ul className="mt-3 grid gap-1">
                  {mine.map((c) => (
                    <li key={c.path}>
                      <button
                        type="button"
                        onClick={() => onPick(c.path)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left font-mono text-[11px] transition-colors hover:bg-[var(--fg)]/[0.06]"
                      >
                        <span className="truncate">{c.path}</span>
                        <span className="shrink-0 tabular-nums text-[var(--muted)]">{left(c.until)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

/* ----------------------------------- Feed ----------------------------------- */

const ICON: Record<string, JSX.Element> = {
  claim: <HandGrabbing size={15} />,
  release: <SignOut size={15} />,
  conflict: <Prohibit size={15} />,
  collision: <Prohibit size={15} />,
  decision: <NotePencil size={15} />,
  lesson: <Brain size={15} />,
  edit: <ArrowBendDownRight size={15} />,
  register: <Robot size={15} />,
  handoff: <Lightning size={15} />,
  graph: <TreeStructure size={15} />,
  wait: <HourglassMedium size={15} />,
  free: <LockSimpleOpen size={15} />,
};

function describe(e: FeedItem): string {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const who = e.agentId ? agentName(e.agentId) : "Someone";
  const on = e.onKey ?? e.onLabel;
  switch (e.kind) {
    case "claim":
      return `${who} claimed ${(p.paths as string[] | undefined)?.join(", ") ?? on ?? "a file"}`;
    case "conflict": {
      const c = conflictOf(e);
      return c ? `${who} refused: ${c.file} reaches ${c.claimed} (${agentName(c.agent)}) in ${hops(c.hops)}` : `${who} refused`;
    }
    case "collision":
      return `${who} edited a file inside another agent's claim`;
    case "release":
      return `${who} released ${on ?? "its claims"}`;
    case "decision":
      return `${who} decided: ${String(p.text ?? "")}`;
    case "lesson":
      return `${who} learned: ${String(p.text ?? "")}`;
    case "edit":
      return `${who} edited ${on ?? "a file"}`;
    case "register": {
      if (isScripted(e.agentId)) return `${who} checked in (scripted)`;
      if (e.agentId && namesEditor(e.agentId)) return `${who} checked in`;
      const tool = TOOL[String(p.kind ?? "")];
      return `${who} checked in${tool ? ` from ${tool}` : ""}`;
    }
    case "graph": {
      const u = p as { path?: string; status?: string; added?: string[]; removed?: string[] };
      const file = u.path ?? on ?? "A file";
      const names = (xs: string[]) => (xs.length > 3 ? `${xs.slice(0, 2).join(", ")} and ${xs.length - 2} more` : xs.join(", "));
      if (u.status === "deleted") return `${file} was deleted`;
      const adds = u.added?.length ? `imports ${names(u.added)}` : "";
      if (u.status === "created") return `New file ${file}${adds ? ` ${adds}` : ""}`;
      const parts = [adds && `now ${adds}`, u.removed?.length ? `no longer imports ${names(u.removed)}` : ""].filter(Boolean);
      return parts.length ? `${file} ${parts.join(" and ")}` : `${file} changed`;
    }
    case "wait": {
      const w = p as { agent?: string; path?: string; holder?: string };
      const holder = w.holder ? `, held by ${agentName(w.holder)}` : "";
      return `${agentName(w.agent ?? e.agentId ?? "Someone")} is waiting for ${w.path ?? on ?? "a file"}${holder}`;
    }
    case "free": {
      const f = p as { path?: string; waiters?: string[] };
      const file = f.path ?? on ?? "A file";
      return f.waiters?.length ? `${file} is free: ${agentList(f.waiters)} can go` : `${file} is free`;
    }
    case "parse": {
      const n = p as { files?: number; imports?: number };
      return n.files ? `Parsed the repo: ${n.files} files, ${n.imports ?? 0} imports` : "Parsed the repo into the graph";
    }
    default:
      return `${who}: ${e.kind}`;
  }
}

const FEED_EMPTY: Record<LiveStatus, string> = {
  loading: "Connecting to the graph…",
  live: "Waiting for events. The live stream is connected.",
  reconnecting: "Reconnecting to the live stream. New events appear when it is back.",
  replay: "This is a recorded run. Press Play the demo to replay it.",
  offline: "The server is unreachable, so there are no events to show.",
};

function FeedRow({ e, cypher, onPath }: { e: FeedItem; cypher: Record<string, string> | null; onPath: (path: string[]) => void }) {
  const bad = e.kind === "conflict" || e.kind === "collision";
  const dim = e.kind === "register" || e.kind === "release";
  const c = conflictOf(e);
  const via = e.kind === "wait" ? (e.payload as { via?: string[] } | null)?.via : undefined;
  const path = c?.path ?? (via && via.length > 1 ? via : undefined);
  // Quiet rows (check-ins, releases) use the muted text colour, not opacity, so they keep 4.5:1 contrast.
  const row = `flex w-full gap-3 rounded-md px-2.5 py-2 text-left text-[13px] leading-snug ${bad ? "text-[var(--fg)]" : dim ? "text-[var(--muted)]" : "text-[var(--fg)]/80"}`;
  const inner = (
    <>
      <span className={`mt-0.5 shrink-0 ${bad ? "text-[var(--color-signal)]" : "text-[var(--muted)]"}`}>{ICON[e.kind] ?? <Graph size={15} />}</span>
      <span className="min-w-0 flex-1">{describe(e)}</span>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--muted)]">#{e.seq}</span>
    </>
  );
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EXPO }}
      className={`rounded-md ${bad ? "bg-[var(--color-signal-soft)] ring-1 ring-inset ring-[var(--color-signal)]/30" : ""}`}
    >
      {/* Only a conflict or wait row is an action (show its path); the rest are plain log entries. */}
      {path ? (
        <button type="button" onClick={() => onPath(path)} className={`${row} transition-colors ${bad ? "hover:bg-[var(--color-signal)]/15" : "hover:bg-[var(--fg)]/[0.06]"}`}>
          {inner}
        </button>
      ) : (
        <div className={row}>{inner}</div>
      )}
      {c && cypher?.conflict && (
        <div className="px-2.5 pb-2 pl-[38px]">
          <CypherDisclosure query={cypher.conflict} params={conflictParams(c, e.agentId)} />
        </div>
      )}
    </motion.li>
  );
}

export function Feed({
  events,
  status,
  cypher,
  onPath,
}: {
  events: FeedItem[];
  status: LiveStatus;
  cypher: Record<string, string> | null;
  onPath: (path: string[]) => void;
}) {
  const { latest, older } = useMemo(() => splitRuns(events), [events]);
  const [showOlder, setShowOlder] = useState(false);
  if (!events.length) {
    if (status === "loading") {
      return (
        <div className="grid gap-2 p-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-2.5 py-2">
              <Skel className="size-4 rounded-full" />
              <Skel className={`h-3 ${["w-3/4", "w-2/3", "w-4/5", "w-1/2", "w-3/5", "w-2/3"][i]}`} />
            </div>
          ))}
        </div>
      );
    }
    return <p className="p-5 text-sm leading-relaxed text-[var(--muted)]">{FEED_EMPTY[status]}</p>;
  }
  return (
    <div className="p-3">
      <ul className="grid gap-1">
        <AnimatePresence initial={false}>
          {latest.map((e) => (
            <FeedRow key={e.seq} e={e} cypher={cypher} onPath={onPath} />
          ))}
        </AnimatePresence>
      </ul>
      {older.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showOlder}
            onClick={() => setShowOlder((s) => !s)}
            className="mt-2 flex w-full items-center justify-between rounded-md border border-dashed border-[var(--border)] px-2.5 py-2 text-xs text-[var(--muted)] transition-colors hover:border-[var(--fg)]/25 hover:text-[var(--fg)]"
          >
            <span>Earlier runs · {older.length} events</span>
            <CaretRight size={11} weight="bold" className={`transition-transform duration-200 ${showOlder ? "rotate-90" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {showOlder && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: EXPO }}
                className="mt-1 grid gap-1 overflow-hidden"
              >
                {older.map((e) => (
                  <FeedRow key={e.seq} e={e} cypher={cypher} onPath={onPath} />
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

/* --------------------------------- Inspect --------------------------------- */

const WHY_STEPS = [
  { label: "File", edge: "edited by" },
  { label: "Agent", edge: "under" },
  { label: "Task", edge: "caused by" },
  { label: "Decision", edge: "" },
];

/** File → Agent → Task → Decision, joined by a line that draws itself. */
function WhyTrace({ row }: { row: Record<string, unknown> }) {
  const steps = (Array.isArray(row.path) ? row.path : [row.path, row.agent, row.task, row.decision]).map((v) => (v == null ? null : String(v)));
  const shown = steps.map((v, i) => ({ v, ...WHY_STEPS[i] })).filter((s) => s.v && s.label);
  const rowH = 44;
  return (
    <div className="relative rounded-md border border-[var(--border)] p-3">
      <svg className="pointer-events-none absolute left-[19px] top-[22px]" width="2" height={(shown.length - 1) * rowH} aria-hidden>
        <motion.line
          x1="1"
          y1="0"
          x2="1"
          y2={(shown.length - 1) * rowH}
          stroke="var(--fg)"
          strokeOpacity={0.3}
          strokeWidth={1.5}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.08 * shown.length + 0.3, ease: "easeOut" }}
        />
      </svg>
      <ol className="grid">
        {shown.map((s, i) => (
          <motion.li
            key={s.label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3, ease: EXPO }}
            className="relative flex items-center gap-3"
            style={{ height: rowH }}
          >
            <span className="relative z-10 size-2.5 shrink-0 rounded-full border border-[var(--fg)]/50 bg-[var(--bg)]" />
            <div className="min-w-0">
              <span className="block font-mono text-[10px] text-[var(--muted)]">
                {s.label}
                {i > 0 && <span className="opacity-70"> · {shown[i - 1].edge}</span>}
              </span>
              <span className={`block truncate text-[13px] ${s.label === "File" ? "font-mono text-[12px]" : ""}`}>{s.label === "Agent" ? agentName(String(s.v)) : s.v}</span>
            </div>
          </motion.li>
        ))}
      </ol>
      {row.why ? <p className="mt-1 pl-[22px] text-xs text-[var(--muted)]">why: {String(row.why)}</p> : null}
    </div>
  );
}

export function Inspect({ path, claims, blast, cypher }: { path: string | null; claims: Claim[]; blast: Blast | null; cypher: Record<string, string> | null }) {
  const [why, setWhy] = useState<unknown[] | null>(null);
  useEffect(() => {
    setWhy(null);
    if (path) api.why(path).then(setWhy).catch(() => setWhy([]));
  }, [path]);
  // The same decision reaches a file through every edit made under it; show it once.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return (why ?? []).filter((w) => {
      const r = w as Record<string, unknown>;
      const key = String(r.decisionId ?? r.decision ?? JSON.stringify(r.path));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }) as Record<string, unknown>[];
  }, [why]);

  if (!path) return <p className="p-5 text-sm leading-relaxed text-[var(--muted)]">Click any file on the graph to see who depends on it, who holds it, and why it changed.</p>;
  const holders = claims.filter((c) => c.path === path);
  return (
    <div className="grid gap-6 p-5">
      <div>
        <p className="font-mono text-sm">{path}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{holders.length ? `Claimed by ${agentList(holders.map((h) => h.agent))}` : "Not claimed"}</p>
      </div>
      <Section title="Blast radius" kind="IMPORTS*1..3">
        {!blast ? (
          <Skel className="h-16" />
        ) : blast.dependents.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing depends on this file. Editing it can't break another agent's work.</p>
        ) : (
          <>
            <p className="text-xs text-[var(--muted)]">
              {blast.dependents.length} file{blast.dependents.length > 1 ? "s" : ""} depend on it within 3 imports.
            </p>
            <div className="mt-3 flex gap-2">
              {blast.byHop.map((h, i) => (
                <motion.div
                  key={h.hops}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35, ease: EXPO }}
                  className="flex-1 rounded-md border border-[var(--border)] p-2 text-center"
                  style={{ background: `color-mix(in oklab, var(--fg) ${Math.max(2, 12 - h.hops * 4)}%, transparent)` }}
                >
                  <p className="text-xl font-semibold tabular-nums">{h.count}</p>
                  <p className="text-[11px] text-[var(--muted)]">{hops(h.hops)}</p>
                </motion.div>
              ))}
            </div>
          </>
        )}
        <div className="mt-3">
          <CypherDisclosure query={cypher?.blast} params={`$path = '${path}'`} />
        </div>
      </Section>
      <Section title="Why it looks like this" kind="edit → task → decision">
        {why === null ? (
          <Skel className="h-24" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No recorded decision touches this file yet.</p>
        ) : (
          <ul className="grid gap-2">
            {rows.slice(0, 5).map((r, i) => (
              <li key={String(r.decisionId ?? i)}>
                <WhyTrace row={r} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <CypherDisclosure query={cypher?.why} params={`$path = '${path}'`} />
        </div>
      </Section>
    </div>
  );
}

/* ---------------------------------- Memory ---------------------------------- */

const EPISODIC = new Set(["edit", "claim", "conflict", "collision", "decision", "lesson", "handoff"]);

export function Memory({ decisions, events, tasks }: { decisions: Decision[]; events: FeedItem[]; tasks: string[] }) {
  const [briefLessons, setBriefLessons] = useState<{ text: string; path?: string }[]>([]);
  const task = tasks[0];
  useEffect(() => {
    if (!task) return;
    api
      .brief(task)
      .then((b) => setBriefLessons(((b.lessons as { text: string; path?: string }[] | undefined) ?? []).filter((l) => l?.text)))
      .catch(() => setBriefLessons([]));
  }, [task]);
  const lessons = useMemo(() => {
    const fromFeed = events
      .filter((e) => e.kind === "lesson")
      .map((e) => ({ text: String((e.payload as { text?: string } | null)?.text ?? ""), path: e.onKey ?? undefined }));
    const seen = new Set<string>();
    return [...fromFeed, ...briefLessons].filter((l) => l.text && !seen.has(l.text) && seen.add(l.text));
  }, [events, briefLessons]);
  const episodes = useMemo(() => splitRuns(events).latest.filter((e) => EPISODIC.has(e.kind)), [events]);

  return (
    <div className="grid gap-7 p-5">
      <Section title="Decisions" kind="semantic">
        {decisions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No decisions recorded yet. Agents add them with record_decision.</p>
        ) : (
          <ul className="grid gap-2">
            {decisions.map((d, i) => (
              <motion.li
                key={d.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: EXPO }}
                className="rounded-[var(--radius-panel)] border border-[var(--border)] p-3"
              >
                <p className={`text-sm ${d.status === "superseded" ? "text-[var(--muted)] line-through decoration-[var(--muted)]" : ""}`}>{d.text}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{[d.agent && agentName(d.agent), d.why && `why: ${d.why}`, d.status].filter(Boolean).join(", ")}</p>
              </motion.li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Lessons" kind="procedural">
        {lessons.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No lessons yet. An agent records one with record_lesson when something bites, and the next agent near those files is told.</p>
        ) : (
          <ul className="grid gap-2">
            {lessons.map((l) => (
              <li key={l.text} className="flex gap-2.5 rounded-[var(--radius-panel)] border border-[var(--border)] p-3 text-sm">
                <Brain size={15} className="mt-0.5 shrink-0 text-[var(--muted)]" aria-hidden />
                <span>
                  {l.text}
                  {l.path && <span className="block font-mono text-[11px] text-[var(--muted)]">{l.path}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Edits and events" kind="episodic">
        {episodes.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing has happened in this run yet.</p>
        ) : (
          <ol className="relative grid gap-3 border-l border-[var(--border)] pl-4">
            {episodes.map((e) => (
              <li key={e.seq} className="relative text-[13px] leading-snug">
                <span
                  className={`absolute -left-[21px] top-1.5 size-2 rounded-full ${e.kind === "conflict" ? "bg-[var(--color-signal)]" : "bg-[var(--fg)]/50"}`}
                  aria-hidden
                />
                <span className={e.kind === "conflict" ? "text-[var(--fg)]" : "text-[var(--fg)]/80"}>{describe(e)}</span>
                <span className="ml-2 font-mono text-[10px] text-[var(--muted)]">{ago(e.at)} ago</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

/* ---------------------------------- Brief ---------------------------------- */

type BriefData = { text: string; summary?: string | null };

export function Brief({ tasks, claims }: { tasks: string[]; claims: Claim[] }) {
  const options = tasks.length ? tasks : ["T1"];
  const [task, setTask] = useState(options.includes("T1") ? "T1" : options[0]);
  const [data, setData] = useState<BriefData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = (t: string) => {
    setLoading(true);
    setError(null);
    api
      .brief(t)
      .then((d) => setData(d))
      .catch((e: Error) => {
        setData(null);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => load(task), [task]);
  const holder = claims.find((c) => c.taskId === task)?.agent;
  const lines = (data?.text ?? "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(": ");
      return i > 0 ? { k: l.slice(0, i), v: l.slice(i + 2) } : { k: "", v: l };
    });

  return (
    <div className="grid gap-4 p-5">
      <div>
        <h3 className="text-sm font-medium">{holder ? `What ${agentName(holder)}'s replacement is told` : `What an agent picking up ${task} is told`}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          If the agent on this task dies, the next one starts from this: claims, decisions, lessons and recent edits, ranked by graph distance.
        </p>
      </div>
      {/* Native radios: one tab stop, arrow keys move the choice. */}
      <div role="radiogroup" aria-label="Task" className="flex flex-wrap gap-1 rounded-[var(--radius-panel)] border border-[var(--border)] p-1">
        {options.map((t) => (
          <label
            key={t}
            className="relative cursor-pointer touch-manipulation rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[var(--fg)]/40 pointer-coarse:py-2"
          >
            <input type="radio" name="brief-task" value={t} checked={task === t} onChange={() => setTask(t)} className="sr-only" />
            {task === t && <motion.span layoutId="brief-task" className="absolute inset-0 rounded-full bg-[var(--fg)]/10" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className={`relative ${task === t ? "text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}>{t}</span>
          </label>
        ))}
      </div>
      {data?.summary && (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-signal)]/40 bg-[var(--color-signal-soft)] p-3 text-sm leading-relaxed">{data.summary}</div>
      )}
      {loading && !data ? (
        <Skel className="h-32" />
      ) : error ? (
        <p className="rounded-md border border-[var(--border)] p-3 text-sm text-[var(--muted)]">The briefing for {task} did not load: {error}</p>
      ) : (
        <ul key={task} className={`grid gap-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {lines.map((l, i) => (
            <motion.li
              key={`${i}-${l.v}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3, ease: EXPO }}
              className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 rounded-md border border-[var(--border)] px-3 py-2"
            >
              <span className="font-mono text-[10.5px] leading-5 text-[var(--muted)]">{l.k}</span>
              <span className="text-[13px] leading-5">{l.v}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
