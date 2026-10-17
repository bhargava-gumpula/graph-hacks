import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowBendDownRight,
  Brain,
  Graph,
  HandGrabbing,
  Lightning,
  NotePencil,
  Prohibit,
  Robot,
  SignOut,
} from "@phosphor-icons/react";
import { api, type Blast, type Claim, type Conflict, type Decision, type FeedItem, type GNode } from "./api";
import { QUERIES } from "./queries";

const ago = (t: number) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`;
};
const left = (until: number) => {
  const s = Math.max(0, Math.round((until - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/* ---------------------------------- Agents ---------------------------------- */

export function AgentsPanel({ agents, claims, onPick }: { agents: GNode[]; claims: Claim[]; onPick: (path: string) => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!agents.length) {
    return (
      <div className="p-5 text-sm leading-relaxed text-[var(--muted)]">
        No agents yet. Press <span className="text-[var(--fg)]">Play the demo</span>, or connect Claude Code or Cursor through the MCP server.
      </div>
    );
  }
  return (
    <ul className="grid gap-3 p-4">
      <AnimatePresence initial={false}>
        {agents.map((a) => {
          const id = a.id.replace(/^agent:/, "");
          const mine = claims.filter((c) => c.agent === id);
          return (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]/80 p-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-full bg-[var(--fg)] font-mono text-[11px] font-semibold text-[var(--bg)]">
                  {id.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">Agent {id}</p>
                  <p className="text-xs text-[var(--muted)]">{a.status ?? "active"}</p>
                </div>
              </div>
              {mine.length > 0 && (
                <ul className="mt-3 grid gap-1.5">
                  {mine.map((c) => (
                    <li key={c.path}>
                      <button
                        type="button"
                        onClick={() => onPick(c.path)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left font-mono text-[11px] transition hover:bg-[var(--fg)]/5"
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
};

function describe(e: FeedItem): string {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const who = e.agentId ? `Agent ${e.agentId}` : "Someone";
  const on = e.onKey ?? e.onLabel;
  switch (e.kind) {
    case "claim":
      return `${who} claimed ${(p.paths as string[] | undefined)?.join(", ") ?? on ?? "a file"}`;
    case "conflict": {
      const c = (p.conflicts as Conflict[] | undefined)?.[0];
      return c ? `${who} refused: ${c.file} reaches ${c.claimed} (${c.agent}) in ${c.hops} hop${c.hops === 1 ? "" : "s"}` : `${who} refused`;
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
    case "register":
      return `${who} checked in`;
    default:
      return e.kind === "parse" ? `Parsed the repo into the graph` : `${who}: ${e.kind}`;
  }
}

export function Feed({ events, onPath }: { events: FeedItem[]; onPath: (path: string[]) => void }) {
  if (!events.length) return <p className="p-5 text-sm text-[var(--muted)]">Waiting for events. The live stream is connected.</p>;
  return (
    <ul className="grid gap-1 p-3">
      <AnimatePresence initial={false}>
        {events.map((e) => {
          const bad = e.kind === "conflict" || e.kind === "collision";
          const c = (e.payload as { conflicts?: Conflict[] } | null)?.conflicts?.[0];
          return (
            <motion.li
              key={e.seq}
              layout
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                disabled={!c}
                onClick={() => c && onPath(c.path)}
                className={`flex w-full gap-3 rounded-md px-2.5 py-2 text-left text-[13px] leading-snug transition ${
                  bad ? "bg-[var(--color-signal-soft)] text-[var(--fg)] hover:bg-[var(--color-signal)]/25" : "text-[var(--muted)] hover:bg-[var(--fg)]/5"
                }`}
              >
                <span className={`mt-0.5 shrink-0 ${bad ? "text-[var(--color-signal)]" : ""}`}>{ICON[e.kind] ?? <Graph size={15} />}</span>
                <span className="min-w-0 flex-1">{describe(e)}</span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums opacity-60">#{e.seq}</span>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

/* --------------------------------- Inspect --------------------------------- */

export function Inspect({ path, claims, blast }: { path: string | null; claims: Claim[]; blast: Blast | null }) {
  const [why, setWhy] = useState<unknown[] | null>(null);
  const [showCypher, setShowCypher] = useState(false);
  useEffect(() => {
    setWhy(null);
    if (path) api.why(path).then(setWhy).catch(() => setWhy([]));
  }, [path]);

  if (!path) return <p className="p-5 text-sm leading-relaxed text-[var(--muted)]">Click any file on the graph to see who depends on it, who holds it, and why it changed.</p>;
  const holders = claims.filter((c) => c.path === path);
  return (
    <div className="grid gap-6 p-5">
      <div>
        <p className="font-mono text-sm">{path}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{holders.length ? `Claimed by ${holders.map((h) => h.agent).join(", ")}` : "Not claimed"}</p>
      </div>
      <section>
        <h3 className="text-sm font-medium">Blast radius</h3>
        {!blast ? (
          <div className="mt-3 h-16 animate-pulse rounded-md bg-[var(--fg)]/5" />
        ) : blast.dependents.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Nothing depends on this file. Editing it can't break another agent's work.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {blast.dependents.length} file{blast.dependents.length > 1 ? "s" : ""} depend on it within 3 imports.
            </p>
            <div className="mt-3 flex gap-2">
              {blast.byHop.map((h) => (
                <div key={h.hops} className="flex-1 rounded-md border border-[var(--border)] p-2 text-center">
                  <p className="text-xl font-semibold tabular-nums">{h.count}</p>
                  <p className="text-[11px] text-[var(--muted)]">{h.hops} hop{h.hops > 1 ? "s" : ""}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      <section>
        <h3 className="text-sm font-medium">Why it looks like this</h3>
        {why === null ? (
          <div className="mt-3 h-10 animate-pulse rounded-md bg-[var(--fg)]/5" />
        ) : why.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No recorded decision touches this file yet.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {why.slice(0, 5).map((w, i) => {
              const r = w as Record<string, unknown>;
              return (
                <li key={i} className="rounded-md border border-[var(--border)] p-2.5 text-[13px]">
                  <p>{String(r.decision ?? r.text ?? "Decision")}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {[r.agent && `Agent ${r.agent}`, r.task && `task ${r.task}`, r.why].filter(Boolean).join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <button type="button" onClick={() => setShowCypher((s) => !s)} className="text-xs text-[var(--muted)] underline-offset-4 hover:text-[var(--fg)] hover:underline">
          {showCypher ? "Hide" : "Show"} the Cypher behind this
        </button>
        <AnimatePresence>
          {showCypher && (
            <motion.pre
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[11px] leading-5 text-[var(--muted)]"
            >
              {QUERIES.blast}
            </motion.pre>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

/* -------------------------------- Decisions -------------------------------- */

export function Decisions({ decisions }: { decisions: Decision[] }) {
  if (!decisions.length) return <p className="p-5 text-sm text-[var(--muted)]">No decisions recorded yet. Agents add them with record_decision.</p>;
  return (
    <ul className="grid gap-2 p-4">
      {decisions.map((d) => (
        <li key={d.id} className="rounded-[var(--radius-panel)] border border-[var(--border)] p-3">
          <p className="text-sm">{d.text}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {[d.agent && `Agent ${d.agent}`, d.why, d.status].filter(Boolean).join(" · ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------- Brief ---------------------------------- */

export function Brief() {
  const [data, setData] = useState<{ text: string; summary?: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.brief().then(setData).catch(() => setData({ text: "Could not load the briefing." })).finally(() => setLoading(false));
  };
  useEffect(load, []);
  return (
    <div className="grid gap-4 p-5">
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        What a fresh agent receives when it starts, or when it replaces one that died: claims, decisions, lessons and recent edits, ranked by graph distance.
      </p>
      {data?.summary && (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-signal)]/40 bg-[var(--color-signal-soft)] p-3 text-sm leading-relaxed">{data.summary}</div>
      )}
      {loading && !data ? (
        <div className="h-32 animate-pulse rounded-md bg-[var(--fg)]/5" />
      ) : (
        <pre className="whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[11px] leading-5 text-[var(--muted)]">{data?.text}</pre>
      )}
      <button type="button" onClick={load} className="justify-self-start rounded-full border border-[var(--border)] px-3 py-1.5 text-xs transition hover:border-[var(--muted)] active:scale-95">
        Refresh briefing
      </button>
    </div>
  );
}
