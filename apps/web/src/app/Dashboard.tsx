import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowClockwise, HandGrabbing, MagnifyingGlass, Play, Rows, X } from "@phosphor-icons/react";
import { StatusIsland, type IslandTask } from "@/components/kokonutui/status-island";
import { ChartStatFlow } from "@/components/charts/chart-stat-flow";
import { AsciiField } from "../landing/AsciiField";
import { api, type Batch, type Blast, type Conflict, type DemoReply, type Health } from "./api";
import { GraphView } from "./GraphView";
import { AgentsPanel, Brief, CypherDisclosure, Feed, Inspect, Memory, PathChips, blockedBy, conflictParams, hops, splitRuns, useCypher } from "./Panels";
import { useLive, type LiveStatus } from "./useLive";

type Tab = "feed" | "inspect" | "memory" | "brief";
const TABS: { id: Tab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "inspect", label: "Inspect" },
  { id: "memory", label: "Memory" },
  { id: "brief", label: "Brief" },
];
const EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const STATUS_LABEL: Record<LiveStatus, string> = { loading: "connecting", live: "live", reconnecting: "reconnecting", replay: "replay", offline: "offline" };
const COACH = "Two scripted agents, one repo. Press Play: watch the graph refuse an edit a file lock would allow.";

/** The server has sent batches as Batch[] and as string[][]; accept both. */
const toBatches = (b: unknown): Batch[] =>
  Array.isArray(b) ? b.map((x, i) => (Array.isArray(x) ? { componentId: i, tasks: x.map(String) } : (x as Batch))) : [];

const when = (s: string | null) => {
  if (!s) return "earlier";
  const d = new Date(/^\d+$/.test(s) ? Number(s) : s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export function Dashboard() {
  const [batchMode, setBatchMode] = useState(false);
  const live = useLive({ withBatches: batchMode });
  const cypher = useCypher(live.status);
  const [tab, setTab] = useState<Tab>("feed");
  const [selected, setSelected] = useState<string | null>(null);
  const [blast, setBlast] = useState<Blast | null>(null);
  const [tasks, setTasks] = useState<IslandTask[]>([]);
  const [tryOpen, setTryOpen] = useState(false);
  const [demo, setDemo] = useState<DemoReply | null>(null);
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  const [health, setHealth] = useState<Health | null>(null);
  const [hoverAgent, setHoverAgent] = useState<string | null>(null);
  // Play clears the previous run's path, so the new refusal draws on a clean graph. A new run from
  // any viewer (a newer parse event) clears it too.
  const [staleHit, setStaleHit] = useState<number | null>(null);
  const lastParse = useMemo(() => live.events.reduce((m, e) => (e.kind === "parse" && e.seq > m ? e.seq : m), -1), [live.events]);
  const hit = live.hit && live.hit.id !== staleHit && live.hit.id > lastParse ? live.hit : null;
  // The refusal's results land on the impact frame, not when the packet leaves.
  const [landed, setLanded] = useState<number | null>(null);
  const shown = hit && (hit.quiet || landed === hit.id) ? hit : null;
  const armed = useRef(false); // a demo run is waiting for its refusal
  const [waiting, setWaiting] = useState(false); // the same, for rendering
  const [demoHit, setDemoHit] = useState<number | null>(null);
  const story = demo && shown && demoHit === shown.id ? demo : null;
  const tryBtn = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const agents = useMemo(() => (live.graph?.nodes ?? []).filter((n) => n.kind === "agent"), [live.graph]);
  const files = useMemo(() => (live.graph?.nodes ?? []).filter((n) => n.kind === "file").map((n) => n.id).sort(), [live.graph]);
  const imports = useMemo(() => (live.graph?.edges ?? []).filter((e) => e.kind === "IMPORTS").length, [live.graph]);
  const conflicts = useMemo(() => splitRuns(live.events).latest.filter((e) => e.kind === "conflict").length, [live.events]);
  // The counter ticks with the impact, not with the feed row.
  const collisions = Math.max(0, conflicts - (hit && !hit.quiet && landed !== hit.id ? 1 : 0));
  const blocked = useMemo(() => blockedBy(shown, live.events), [shown, live.events]);
  // Rings follow the paced feed: a fresh run shows only the claims its beats have reached so far.
  const shownClaims = useMemo(() => {
    const { latest } = splitRuns(live.events);
    const run = latest.find((e) => e.kind === "parse")?.seq ?? 0;
    if (run <= live.seqAtLoad) return live.claims;
    return live.claims.filter((c) =>
      latest.some((e) => e.kind === "claim" && e.agentId === c.agent && ((e.payload as { paths?: string[] } | null)?.paths ?? []).includes(c.path)),
    );
  }, [live.events, live.claims, live.seqAtLoad]);

  // WCC groups, biggest first so G1 is the one that must queue the most.
  const groups = useMemo(() => {
    const b = live.batches.length ? live.batches : toBatches(demo?.batches);
    return [...b].sort((x, y) => y.tasks.length - x.tasks.length || x.componentId - y.componentId);
  }, [live.batches, demo]);
  const briefTasks = useMemo(() => {
    const t = new Set<string>(["T1"]);
    live.claims.forEach((c) => c.taskId && t.add(c.taskId));
    groups.forEach((g) => g.tasks.forEach((x) => t.add(x)));
    return [...t];
  }, [live.claims, groups]);

  useEffect(() => {
    setBlast(null);
    if (selected) {
      setTab("inspect");
      api.blast(selected).then(setBlast).catch(() => undefined);
    }
  }, [selected]);
  const blastMap = useMemo(() => new Map((blast?.dependents ?? []).map((d) => [d.path, d.hops])), [blast]);

  // Batches mode: tint each group's files (Batch.paths), falling back to its tasks' claims.
  const batchOf = useMemo(() => {
    if (!batchMode) return null;
    const m = new Map<string, number>();
    groups.forEach((b, i) => {
      const paths = b.paths ?? live.claims.filter((c) => c.taskId && b.tasks.includes(c.taskId)).map((c) => c.path);
      paths.forEach((p) => m.set(p, i));
    });
    return m;
  }, [batchMode, groups, live.claims]);
  useEffect(() => {
    if (batchMode) void live.refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchMode]);

  // Database round trip for the island's resting line.
  useEffect(() => {
    let on = true;
    const load = () =>
      api
        .health()
        .then((h) => on && setHealth(h))
        .catch(() => on && setHealth(null));
    void load();
    const t = setInterval(load, 15000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, []);

  // The island narrates a fresh refusal, replacing the running demo entry. It reads the filtered
  // hit, so the demo reply never narrates the previous run's refusal with the new run's time.
  useEffect(() => {
    const h = shown;
    if (!h || h.quiet) return;
    let mine = demoHit === h.id;
    if (armed.current) {
      armed.current = false;
      mine = true;
      setDemoHit(h.id);
      setWaiting(false);
    }
    const c = h.conflict;
    const ms = mine ? demo?.checkMs : undefined;
    const id = `hit-${h.id}`;
    const entry: IslandTask = {
      id,
      label: `Refused ${c.file}`,
      detail: `${hops(c.hops)} to ${c.claimed} (${c.agent})${ms != null ? ` · ${ms} ms` : ""}`,
      status: "error",
    };
    setTasks((t) => [...t.filter((x) => x.id !== id && !(x.id.startsWith("demo-") && x.status === "running")).slice(-3), entry]);
    later(() => setTasks((t) => t.filter((x) => x.id !== id)), 9000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.id, demo?.checkMs]);

  const playDemo = async () => {
    if (playing) return;
    setPlaying(true);
    setSelected(null);
    setStaleHit(live.hit?.id ?? null);
    armed.current = true;
    setWaiting(true);
    const id = `demo-${Date.now()}`;
    setTasks((t) => [...t.slice(-3), { id, label: "Running the demo", detail: "two agents, one hidden dependency", status: "running" }]);
    try {
      const r = await api.demo();
      setDemo(r);
      setRun((n) => n + 1);
    } catch (e) {
      armed.current = false;
      setWaiting(false);
      setStaleHit(null);
      setTasks((t) => t.map((x) => (x.id === id ? { ...x, status: "error", label: "Demo failed", detail: (e as Error).message } : x)));
    } finally {
      setPlaying(false);
    }
  };

  // /app?play=1 plays once, as soon as the first data is on screen, then drops the param.
  const autoPlayed = useRef(false);
  useEffect(() => {
    if (autoPlayed.current || !live.graph || (live.status !== "live" && live.status !== "replay")) return;
    autoPlayed.current = true;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("play")) return;
    void playDemo();
    url.searchParams.delete("play");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.graph, live.status]);

  const rest =
    live.status === "replay"
      ? `Replay · recorded ${when(live.replayAt)}`
      : live.status === "live" && health?.dbMs != null
        ? `Live · FalkorDB ${Math.round(health.dbMs * 10) / 10} ms`
        : undefined;

  const onPath = (p: string[]) => setSelected(p[p.length - 1] ?? null);
  const tiles = live.graph ? { collisions, checkMs: story?.checkMs ?? null, groups: groups.length || null, files: files.length, imports } : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="grain relative flex h-[100dvh] flex-col overflow-hidden">
        <AsciiField />

        <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 whitespace-nowrap border-b border-[var(--border)] bg-[var(--bg)]/80 px-4 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            <a href="/" className="flex items-center gap-2 font-medium tracking-tight">
              <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden="true">
                <circle cx="5" cy="16" r="3" fill="var(--fg)" />
                <circle cx="17" cy="6" r="3" fill="var(--color-signal)" />
                <path d="M7.5 14 L14.5 8" stroke="var(--fg)" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Switchboard
            </a>
            <span className="hidden font-mono text-xs text-[var(--muted)] md:inline">{live.graphName}</span>
            <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]" title={`Stream: ${STATUS_LABEL[live.status]}`}>
              <span
                className={`size-1.5 rounded-full transition-colors ${
                  live.status === "live" ? "bg-[var(--fg)]" : live.status === "offline" ? "bg-[var(--color-signal)]" : "bg-[var(--muted)]"
                }`}
              />
              <span className="hidden sm:inline">{STATUS_LABEL[live.status]}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBatchMode((b) => !b)}
              aria-pressed={batchMode}
              aria-label="Parallel batches"
              className={`relative touch-manipulation before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition active:scale-95 md:px-3 ${
                batchMode ? "border-[var(--fg)] text-[var(--fg)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              <Rows size={14} /> <span className="hidden md:inline">Parallel batches</span>
            </button>
            <button
              ref={tryBtn}
              type="button"
              onClick={() => setTryOpen((o) => !o)}
              aria-expanded={tryOpen}
              aria-haspopup="dialog"
              aria-label="Try a claim"
              className="relative touch-manipulation before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1.5 text-xs transition hover:border-[var(--muted)] active:scale-95 sm:px-3"
            >
              <HandGrabbing size={14} /> <span className="hidden sm:inline">Try a claim</span>
            </button>
            <button
              type="button"
              onClick={playDemo}
              disabled={playing}
              className="relative touch-manipulation before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] inline-flex items-center gap-1.5 rounded-full bg-[var(--color-signal)] px-3.5 py-1.5 text-xs font-medium text-[#1a0d08] shadow-[0_0_24px_-6px_var(--color-signal)] transition hover:brightness-110 active:scale-95 disabled:opacity-70"
            >
              <Play size={14} weight="fill" />
              <span>
                Play<span className="hidden sm:inline"> the demo</span>
              </span>
            </button>
          </div>
        </header>


        <AnimatePresence>
          {tryOpen && (
            <TryClaim
              files={files}
              trigger={tryBtn}
              onClose={() => setTryOpen(false)}
              onSelect={(f) => {
                setSelected(f);
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {(live.status === "replay" || live.status === "offline") && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: EXPO }}
              className="relative z-20 overflow-hidden border-b border-[var(--color-signal)]/30 bg-[var(--color-signal-soft)]"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-2 text-[13px] leading-snug">
                <p>
                  {live.status === "replay"
                    ? `Live server offline. This is a recorded run: every path and number below came from FalkorDB at ${when(live.replayAt)}.`
                    : "Can't reach the Switchboard server, and no recorded run could load."}
                </p>
                <button
                  type="button"
                  onClick={() => live.retry()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--fg)]/25 px-3 py-1 text-xs transition hover:border-[var(--fg)]/60 active:scale-95"
                >
                  <ArrowClockwise size={13} /> Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {tiles && (
          <div className="relative z-10 border-b border-[var(--border)] bg-[var(--bg)]/80 px-4 py-2.5 backdrop-blur-sm lg:hidden">
            <Tiles {...tiles} compact />
          </div>
        )}

        <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1.2fr)_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)_380px] lg:grid-rows-1">
          <aside className="hidden min-h-0 flex-col border-r border-[var(--border)] bg-[var(--bg)]/70 backdrop-blur-sm lg:flex">
            {(tiles || live.status === "loading") && (
              <div className="border-b border-[var(--border)] p-4">
                {tiles ? (
                  <Tiles {...tiles} />
                ) : (
                  <div aria-busy="true" aria-label="Loading numbers" className="grid grid-cols-2 gap-2 motion-safe:animate-pulse">
                    <div className="col-span-2 h-[88px] rounded-[var(--radius-panel)] bg-[var(--fg)]/[0.04]" />
                    <div className="h-[66px] rounded-[var(--radius-panel)] bg-[var(--fg)]/[0.04]" />
                    <div className="h-[66px] rounded-[var(--radius-panel)] bg-[var(--fg)]/[0.04]" />
                  </div>
                )}
              </div>
            )}
            <p className="px-4 pt-4 text-xs font-medium text-[var(--muted)]">Agents</p>
            <div className="min-h-0 flex-1 overflow-y-auto" onPointerLeave={() => setHoverAgent(null)}>
              <div
                onPointerOver={(e) => {
                  const li = (e.target as Element).closest("li[data-agent]");
                  setHoverAgent(li?.getAttribute("data-agent") ?? null);
                }}
              >
                <AgentsPanel agents={agents} claims={shownClaims} events={live.events} status={live.status} hit={shown} onPick={setSelected} onPath={onPath} />
              </div>
            </div>
          </aside>

          <main className="relative min-h-0 overflow-hidden" aria-busy={!live.graph && live.status === "loading"}>
            {/* Keep the field dark behind the nodes; it still shows at the edges. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(ellipse 70% 65% at 50% 50%, var(--bg) 40%, color-mix(in oklab, var(--bg) 70%, transparent) 70%, transparent 100%)" }}
            />
            {live.graph ? (
              <GraphView
                graph={live.graph}
                claims={shownClaims}
                hit={hit}
                selected={selected}
                blast={blastMap}
                batchOf={batchOf}
                ghost={blocked ? { file: blocked.conflict.file, agent: blocked.agent } : null}
                focusAgent={hoverAgent}
                checkMs={story?.checkMs ?? null}
                conflictCypher={cypher?.conflict}
                onSelect={setSelected}
                onLanded={setLanded}
              />
            ) : (
              <div className="relative grid h-full place-items-center">
                {live.status === "offline" ? (
                  <p className="max-w-xs text-center text-sm text-[var(--muted)]">The graph will appear here when the server is reachable.</p>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 750 330" className="h-2/3 w-2/3 motion-safe:animate-pulse">
                    {[0, 1, 2, 3].map((c) =>
                      Array.from({ length: 10 }, (_, r) => <circle key={`${c}-${r}`} cx={60 + c * 210} cy={30 + r * 30} r={3.25} fill="var(--fg)" fillOpacity={0.16} />),
                    )}
                  </svg>
                )}
              </div>
            )}

            <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
              <div className="pointer-events-auto">
                <StatusIsland tasks={tasks} rest={rest} onDismiss={(id) => setTasks((t) => t.filter((x) => x.id !== id))} dismissAfter={5000} />
              </div>
            </div>

            <AnimatePresence>
              {batchMode && (
                <BatchLegend groups={groups} cypher={cypher?.batches} />
              )}
            </AnimatePresence>

            {live.graph && (
              <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden w-[min(440px,calc(100%-10rem))] sm:block">
                <StoryCaption demo={story} hold={waiting} run={run} cypher={cypher?.conflict} />
              </div>
            )}
          </main>

          <aside className="flex min-h-0 flex-col border-t border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-sm lg:border-l lg:border-t-0">
            {live.graph && (
              <div className="shrink-0 border-b border-[var(--border)] p-3 sm:hidden">
                <StoryCaption demo={story} hold={waiting} run={run} cypher={cypher?.conflict} />
              </div>
            )}
            <div
              role="tablist"
              aria-label="Panels"
              className="flex shrink-0 gap-1 border-b border-[var(--border)] p-2"
              onKeyDown={(e) => {
                const i = TABS.findIndex((t) => t.id === tab);
                const next =
                  e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
                if (next < 0) return;
                e.preventDefault();
                setTab(TABS[next].id);
                document.getElementById(`tab-${TABS[next].id}`)?.focus();
              }}
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  aria-controls="panel"
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  className="relative flex-1 touch-manipulation rounded-full px-2 py-1.5 text-xs transition-colors pointer-coarse:py-2.5"
                >
                  {tab === t.id && <motion.span layoutId="tab" className="absolute inset-0 rounded-full bg-[var(--fg)]/10" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                  <span className={`relative transition-colors ${tab === t.id ? "text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}>{t.label}</span>
                </button>
              ))}
            </div>
            <div id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto">
              <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12, ease: EASE_OUT }}>
                  {tab === "feed" && <Feed events={live.events} status={live.status} cypher={cypher} onPath={onPath} />}
                  {tab === "inspect" && <Inspect path={selected} claims={live.claims} blast={blast} cypher={cypher} />}
                  {tab === "memory" && <Memory decisions={live.decisions} events={live.events} tasks={briefTasks} />}
                  {tab === "brief" && <Brief tasks={briefTasks} claims={live.claims} />}
              </motion.div>
            </div>
          </aside>
        </div>
      </div>
    </MotionConfig>
  );
}

/* --------------------------------- Story --------------------------------- */

function StoryCaption({ demo, hold = false, run, cypher }: { demo: DemoReply | null; hold?: boolean; run: number; cypher?: string }) {
  const want = demo?.path[0];
  // The last sentence is the point: a lock on the file itself would have said yes.
  const cut = demo ? demo.sentence.lastIndexOf("A file lock") : -1;
  const lead = demo ? (cut > 0 ? demo.sentence.slice(0, cut) : demo.sentence) : "";
  const punch = demo && cut > 0 ? demo.sentence.slice(cut) : "";
  return (
    <div className="pointer-events-none">
      <AnimatePresence mode="wait">
        {demo ? (
          <motion.section
            key={`story-${run}`}
            aria-live="polite"
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: EXPO, delay: 0.25 }}
            className="pointer-events-auto relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]/90 p-4 shadow-2xl shadow-black/40 backdrop-blur-md"
          >
            <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full bg-[var(--color-signal)]/10 blur-3xl" />
            <p className="relative line-clamp-2 text-[13px] leading-relaxed text-[var(--fg)]/80 sm:line-clamp-none">{lead}</p>
            {punch && <p className="relative mt-1 text-[13px] font-medium leading-relaxed text-[var(--fg)]">{punch}</p>}
            {demo.path.length > 0 && (
              <div className="relative mt-3">
                <PathChips path={demo.path} />
              </div>
            )}
            <p className="relative mt-3 text-xs text-[var(--muted)]">
              caught in <span className="font-mono text-[var(--fg)]">{demo.checkMs} ms</span> by one Cypher path query
            </p>
            {want && (
              <div className="relative mt-2">
                <CypherDisclosure
                  query={cypher}
                  params={conflictParams({ file: want } as Conflict, "B")}
                />
              </div>
            )}
          </motion.section>
        ) : hold ? null : (
          <motion.section
            key="coach"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            transition={{ duration: 0.45, ease: EXPO, delay: 0.3 }}
            className="pointer-events-auto flex items-start gap-3 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]/85 p-3.5 backdrop-blur-md"
          >
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[var(--color-signal-soft)] text-[var(--color-signal)]">
              <Play size={11} weight="fill" />
            </span>
            <p className="text-[13px] leading-relaxed text-[var(--fg)]/85">{COACH}</p>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------------- Tiles --------------------------------- */

function Tile({ children, className = "", accent = false }: { children: ReactNode; className?: string; accent?: boolean }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EXPO } } }}
      className={`relative overflow-hidden rounded-[var(--radius-panel)] border p-3 ${
        accent ? "border-[var(--color-signal)]/35" : "border-[var(--border)]"
      } bg-[var(--surface)]/70 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function Pending({ label }: { label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-[var(--muted)]">Press Play</span>
      <span className="mt-0.5 text-[11px] text-[color:var(--muted)]">{label}</span>
    </div>
  );
}

/** Numbers for the latest run only: refusals since the newest parse, the timed check, and the WCC group count. */
function Tiles({
  collisions,
  checkMs,
  groups,
  files,
  imports,
  compact = false,
}: {
  collisions: number;
  checkMs: number | null;
  groups: number | null;
  files: number;
  imports: number;
  compact?: boolean;
}) {
  const value = compact ? "text-lg font-semibold" : "text-2xl font-semibold tracking-tight";
  const label = "text-[11px] text-[color:var(--muted)]";
  return (
    <div>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
        className={compact ? "grid grid-cols-[1.3fr_1fr_1fr] gap-2" : "grid grid-cols-2 gap-2"}
      >
        <Tile accent className={compact ? "" : "col-span-2"}>
          {/* Backlight: flares each time the count changes. */}
          <motion.div
            key={collisions}
            aria-hidden
            initial={{ opacity: 1 }}
            animate={{ opacity: 0.6 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(90% 120% at 12% 100%, color-mix(in oklab, var(--color-signal) 26%, transparent), transparent 62%), linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-signal) 55%, transparent), transparent) top / 100% 1px no-repeat",
            }}
          />
          <div className="relative flex flex-col">
            <ChartStatFlow
              value={collisions}
              label="Collisions prevented"
              valueClassName={`${compact ? "text-lg font-semibold" : "text-4xl font-semibold tracking-tight"} text-[color:var(--color-signal)]`}
              labelClassName={label}
            />
          </div>
        </Tile>
        <Tile>
          {checkMs == null ? (
            <Pending label="Graph check" />
          ) : (
            <div className="flex flex-col">
              <ChartStatFlow value={checkMs} suffix=" ms" formatOptions={{ maximumFractionDigits: 1 }} label="Graph check" valueClassName={`${value} text-[color:var(--fg)]`} labelClassName={label} />
            </div>
          )}
        </Tile>
        <Tile>
          {groups == null ? (
            <Pending label={compact ? "Groups (WCC)" : "Parallel groups (WCC)"} />
          ) : (
            <div className="flex flex-col">
              <ChartStatFlow value={groups} label={compact ? "Groups (WCC)" : "Parallel groups (WCC)"} valueClassName={`${value} text-[color:var(--fg)]`} labelClassName={label} />
            </div>
          )}
        </Tile>
      </motion.div>
      {!compact && (
        <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">
          {files} files · {imports} imports parsed
        </p>
      )}
    </div>
  );
}

/* -------------------------------- Batches -------------------------------- */

function BatchLegend({ groups, cypher }: { groups: Batch[]; cypher?: string }) {
  const n = groups.length;
  // Tasks in one WCC group interfere, so all but one of them wait.
  const queued = groups.flatMap((g) => g.tasks.slice(1));
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: EXPO }}
      className="absolute left-3 right-3 top-16 z-10 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]/90 p-3 backdrop-blur-md sm:right-auto sm:max-w-[420px]"
    >
      {n === 0 ? (
        <p className="text-[13px] text-[var(--muted)]">Computing parallel groups with WCC…</p>
      ) : (
        <>
          <p className="text-[13px] leading-snug">
            <span className="font-medium">
              {n} group{n === 1 ? "" : "s"} → {n} agent{n === 1 ? "" : "s"} can work at once
            </span>
            <span className="text-[var(--muted)]">
              {" · "}
              {queued.length ? (
                <>
                  {queued.map((t, i) => (
                    <span key={t} className="whitespace-nowrap">
                      {t}
                      {i < queued.length - 1 ? ", " : ""}
                    </span>
                  ))}{" "}
                  must queue
                </>
              ) : (
                "nothing has to queue"
              )}
            </span>
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {groups.map((g, i) => (
              <motion.li
                key={g.componentId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.3, ease: EXPO }}
                className="flex items-center gap-1.5 rounded-full border border-[var(--border)] py-0.5 pl-1 pr-2 font-mono text-[11px]"
              >
                <span className="grid h-4 place-items-center rounded-full px-1.5 text-[9px] font-semibold" style={{ background: `color-mix(in oklab, var(--fg) ${36 - (i % 4) * 8}%, transparent)` }}>
                  G{i + 1}
                </span>
                {g.tasks.join(", ")}
              </motion.li>
            ))}
          </ul>
          <div className="mt-2">
            <CypherDisclosure query={cypher} />
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ------------------------------- Try a claim ------------------------------- */

const AGENTS = ["A", "B", "C", "D"];

function TryClaim({
  files,
  trigger,
  onClose,
  onSelect,
}: {
  files: string[];
  trigger: React.RefObject<HTMLButtonElement>;
  onClose: () => void;
  onSelect: (file: string) => void;
}) {
  const [agent, setAgent] = useState("B");
  const panel = useRef<HTMLDivElement>(null);
  // Popover behaviour: focus moves in, Escape or an outside press closes, focus returns to the trigger.
  useEffect(() => {
    panel.current?.querySelector<HTMLInputElement>("input[name=try-agent]:checked")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    const btn = trigger.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      btn?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = () => (files.includes("ui/LoginForm.tsx") ? "ui/LoginForm.tsx" : (files[0] ?? ""));
  const [file, setFile] = useState(pick);
  useEffect(() => {
    if (!file && files.length) setFile(pick());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);
  const [result, setResult] = useState<{ ok: boolean; agent: string; file: string; conflict?: Conflict; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const folders = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const f of files) {
      const dir = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : ".";
      m.set(dir, [...(m.get(dir) ?? []), f]);
    }
    return [...m.entries()];
  }, [files]);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.claim(agent, [file]);
      const c = r.conflicts?.[0];
      setResult({ ok: r.ok, agent, file, conflict: c });
      if (r.ok) onSelect(file);
    } catch (e) {
      setResult({ ok: false, agent, file, error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      ref={panel}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.18, ease: EASE_OUT } }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: EASE_OUT } }}
      className="absolute inset-x-4 top-16 z-40 origin-top-right rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl shadow-black/50 sm:left-auto sm:w-[360px]"
      role="dialog"
      aria-label="Try a claim"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Try a claim</p>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 text-[var(--muted)] transition-colors hover:text-[var(--fg)]">
          <X size={14} />
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">Claim a file as any agent. Switchboard checks it against everyone else's claims through the import graph.</p>
      <div className="mt-4 grid gap-3">
        <div className="grid gap-1.5 text-xs">
          <span id="try-agent">Agent</span>
          {/* Native radios: one tab stop, arrow keys move the choice. */}
          <div role="radiogroup" aria-labelledby="try-agent" className="grid grid-cols-4 gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] p-1">
            {AGENTS.map((a) => (
              <label
                key={a}
                className="relative cursor-pointer touch-manipulation rounded-full py-1 text-center font-mono text-sm transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[var(--fg)]/40 pointer-coarse:py-2"
              >
                <input type="radio" name="try-agent" value={a} checked={agent === a} onChange={() => setAgent(a)} className="sr-only" />
                {agent === a && <motion.span layoutId="try-agent-pill" className="absolute inset-0 rounded-full bg-[var(--fg)]" transition={{ type: "spring", stiffness: 450, damping: 34 }} />}
                <span className={`relative ${agent === a ? "text-[var(--bg)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}>{a}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="grid gap-1.5 text-xs">
          File
          <select
            value={file}
            onChange={(e) => setFile(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 font-mono text-sm outline-none transition-colors focus:border-[var(--muted)]"
          >
            {folders.map(([dir, fs]) => (
              <optgroup key={dir} label={`${dir}/`}>
                {fs.map((f) => (
                  <option key={f} value={f}>
                    {f.split("/").pop()}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !file}
          onClick={run}
          className="rounded-full bg-[var(--color-signal)] px-4 py-2 text-sm font-medium text-[#1a0d08] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Checking the graph…" : "Claim it"}
        </button>
        {/* A permanent live region, so the result is announced when it lands inside it. */}
        <div aria-live="polite">
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={`${result.agent}-${result.file}-${result.ok}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className={`grid gap-2.5 rounded-md border p-3 text-sm ${result.conflict ? "border-[var(--color-signal)]/40 bg-[var(--color-signal-soft)]" : "border-[var(--border)]"}`}
            >
              <p className="leading-relaxed">
                {result.error
                  ? `Not checked: ${result.error}`
                  : result.ok
                    ? `Granted. Agent ${result.agent} now holds ${result.file}.`
                    : result.conflict
                      ? `Refused. It reaches Agent ${result.conflict.agent}'s claim in ${hops(result.conflict.hops)}.`
                      : "Not granted."}
              </p>
              {result.conflict && <PathChips path={result.conflict.path} />}
              {!result.error && (
                <button
                  type="button"
                  onClick={() => onSelect(result.file)}
                  className="inline-flex items-center gap-1.5 justify-self-start rounded-full border border-[var(--fg)]/20 px-2.5 py-1 text-xs transition hover:border-[var(--fg)]/50 active:scale-95"
                >
                  <MagnifyingGlass size={12} /> Inspect
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
