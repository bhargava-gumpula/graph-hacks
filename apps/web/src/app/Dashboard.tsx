import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HandGrabbing, Play, Rows, X } from "@phosphor-icons/react";
import { curveNatural } from "@visx/curve";
import { StatusIsland, type IslandTask } from "@/components/kokonutui/status-island";
import { LiveLine, LiveLineChart, LiveXAxis, LiveYAxis, Ring, RingCenter, RingChart } from "@/components/charts";
import { AsciiField } from "../landing/AsciiField";
import { api, type Blast } from "./api";
import { GraphView } from "./GraphView";
import { AgentsPanel, Brief, Decisions, Feed, Inspect } from "./Panels";
import { useLive } from "./useLive";

type Tab = "feed" | "inspect" | "decisions" | "brief";

export function Dashboard() {
  const live = useLive();
  const [tab, setTab] = useState<Tab>("feed");
  const [selected, setSelected] = useState<string | null>(null);
  const [blast, setBlast] = useState<Blast | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [tasks, setTasks] = useState<IslandTask[]>([]);
  const [tryOpen, setTryOpen] = useState(false);

  const agents = useMemo(() => (live.graph?.nodes ?? []).filter((n) => n.kind === "agent"), [live.graph]);
  const files = useMemo(() => (live.graph?.nodes ?? []).filter((n) => n.kind === "file").map((n) => n.id).sort(), [live.graph]);
  const refusals = live.events.filter((e) => e.kind === "conflict").length;
  const granted = live.events.filter((e) => e.kind === "claim").length;

  useEffect(() => {
    setBlast(null);
    if (selected) {
      setTab("inspect");
      api.blast(selected).then(setBlast).catch(() => undefined);
    }
  }, [selected]);

  const blastMap = useMemo(() => new Map((blast?.dependents ?? []).map((d) => [d.path, d.hops])), [blast]);

  // Batches mode: tint each task's claimed files by its parallel batch.
  const batchOf = useMemo(() => {
    if (!batchMode) return null;
    const m = new Map<string, number>();
    live.batches.forEach((b, i) => b.tasks.forEach((t) => live.claims.filter((c) => c.taskId === t).forEach((c) => m.set(c.path, i))));
    return m;
  }, [batchMode, live.batches, live.claims]);

  // The island narrates the newest conflict.
  useEffect(() => {
    if (!live.hit) return;
    const c = live.hit.conflict;
    setTasks((t) => [
      ...t.slice(-3),
      { id: `hit-${live.hit!.id}`, label: `Refused ${c.file}`, detail: `${c.hops} hop${c.hops === 1 ? "" : "s"} to ${c.claimed} (Agent ${c.agent})`, status: "error" },
    ]);
  }, [live.hit]);

  const playDemo = async () => {
    const id = `demo-${Date.now()}`;
    setTasks((t) => [...t.slice(-3), { id, label: "Running the demo", detail: "two agents, one hidden dependency", status: "running" }]);
    try {
      const r = await api.demo();
      setTasks((t) => t.map((x) => (x.id === id ? { ...x, status: "done", label: "Demo finished", detail: `checked in ${r.checkMs} ms` } : x)));
    } catch {
      setTasks((t) => t.map((x) => (x.id === id ? { ...x, status: "error", label: "Demo failed", detail: "is the server running?" } : x)));
    }
  };

  return (
    <div className="grain relative flex h-[100dvh] flex-col overflow-hidden">
      <AsciiField />

      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg)]/80 px-4 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/" className="flex items-center gap-2 font-medium tracking-tight">
            <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden="true">
              <circle cx="5" cy="16" r="3" fill="var(--fg)" />
              <circle cx="17" cy="6" r="3" fill="var(--color-signal)" />
              <path d="M7.5 14 L14.5 8" stroke="var(--fg)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Switchboard
          </a>
          <span className="hidden font-mono text-xs text-[var(--muted)] sm:inline">{live.graphName}</span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span className={`size-1.5 rounded-full ${live.status === "live" ? "bg-[var(--fg)]" : "bg-[var(--color-signal)]"}`} />
            {live.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBatchMode((b) => !b)}
            aria-pressed={batchMode}
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition active:scale-95 md:inline-flex ${batchMode ? "border-[var(--fg)] text-[var(--fg)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]"}`}
          >
            <Rows size={14} /> Parallel batches
          </button>
          <button
            type="button"
            onClick={() => setTryOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs transition hover:border-[var(--muted)] active:scale-95"
          >
            <HandGrabbing size={14} /> Try a claim
          </button>
          <button
            type="button"
            onClick={playDemo}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-signal)] px-3.5 py-1.5 text-xs font-medium text-[#1a0d08] transition active:scale-95"
          >
            <Play size={14} weight="fill" /> Play the demo
          </button>
        </div>
      </header>

      <div className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2">
        <div className="pointer-events-auto">
          <StatusIsland tasks={tasks} onDismiss={(id) => setTasks((t) => t.filter((x) => x.id !== id))} dismissAfter={5000} />
        </div>
      </div>

      <AnimatePresence>
        {tryOpen && <TryClaim files={files} onClose={() => setTryOpen(false)} />}
      </AnimatePresence>

      {live.status === "offline" && (
        <div className="relative z-20 border-b border-[var(--color-signal)]/40 bg-[var(--color-signal-soft)] px-4 py-2 text-sm">
          Can't reach the Switchboard server. Start it with <code className="font-mono">npm run server</code>, then reload.
        </div>
      )}

      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_380px]">
        <aside className="hidden min-h-0 flex-col border-r border-[var(--border)] bg-[var(--bg)]/70 backdrop-blur-sm lg:flex">
          <Metrics active={live.claims.length} granted={granted} refused={refusals} rate={live.rate} />
          <p className="px-4 pt-4 text-xs font-medium text-[var(--muted)]">Agents</p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AgentsPanel agents={agents} claims={live.claims} onPick={setSelected} />
          </div>
        </aside>

        <main className="relative min-h-[50vh]">
          {live.graph ? (
            <GraphView
              graph={live.graph}
              claims={live.claims}
              hit={live.hit}
              selected={selected}
              blast={blastMap}
              batchOf={batchOf}
              onSelect={setSelected}
            />
          ) : (
            <div className="grid h-full place-items-center">
              <div className="h-2/3 w-2/3 animate-pulse rounded-[var(--radius-panel)] bg-[var(--fg)]/5" />
            </div>
          )}
        </main>

        <aside className="flex min-h-0 flex-col border-l border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-sm">
          <nav className="flex shrink-0 gap-1 border-b border-[var(--border)] p-2" aria-label="Panels">
            {(["feed", "inspect", "decisions", "brief"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="relative flex-1 rounded-full px-2 py-1.5 text-xs capitalize transition"
                aria-current={tab === t}
              >
                {tab === t && <motion.span layoutId="tab" className="absolute inset-0 rounded-full bg-[var(--fg)]/10" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                <span className={`relative ${tab === t ? "text-[var(--fg)]" : "text-[var(--muted)]"}`}>{t}</span>
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "feed" && <Feed events={live.events} onPath={(p) => setSelected(p[p.length - 1] ?? null)} />}
            {tab === "inspect" && <Inspect path={selected} claims={live.claims} blast={blast} />}
            {tab === "decisions" && <Decisions decisions={live.decisions} />}
            {tab === "brief" && <Brief />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metrics({ active, granted, refused, rate }: { active: number; granted: number; refused: number; rate: { time: number; value: number }[] }) {
  const total = Math.max(1, granted + refused);
  const ring = [
    { label: "Granted", value: granted, maxValue: total, color: "var(--fg)" },
    { label: "Refused", value: refused, maxValue: total, color: "var(--color-signal)" },
  ];
  // The chart wants unix seconds.
  const series = rate.map((r) => ({ time: r.time / 1000, value: r.value }));
  const latest = series.at(-1)?.value ?? 0;
  return (
    <div className="grid gap-3 border-b border-[var(--border)] p-4">
      <div className="flex items-center gap-4">
        <RingChart data={ring} size={92} strokeWidth={7}>
          <Ring index={0} />
          <Ring index={1} />
          <RingCenter defaultLabel="claims" />
        </RingChart>
        <div className="grid gap-1 text-xs">
          <p><span className="text-lg font-semibold tabular-nums">{active}</span> <span className="text-[var(--muted)]">held now</span></p>
          <p className="text-[var(--muted)]">{granted} granted</p>
          <p className="text-[var(--color-signal)]">{refused} refused</p>
        </div>
      </div>
      <div className="relative h-24 w-full overflow-hidden">
        <LiveLineChart data={series} value={latest} window={120}>
          <LiveLine dataKey="value" curve={curveNatural} stroke="var(--color-signal)" />
          <LiveXAxis />
          <LiveYAxis />
        </LiveLineChart>
      </div>
      <p className="-mt-1 text-[11px] text-[var(--muted)]">events per 5 s</p>
    </div>
  );
}

function TryClaim({ files, onClose }: { files: string[]; onClose: () => void }) {
  const [agent, setAgent] = useState("B");
  const [file, setFile] = useState("ui/LoginForm.tsx");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.claim(agent, [file]);
      const c = r.conflicts?.[0];
      setResult(r.ok || !c ? `Granted. Agent ${agent} now holds ${file}.` : `Refused. ${c.path.join(" → ")} reaches Agent ${c.agent}'s claim.`);
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="absolute right-4 top-16 z-40 w-[340px] rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl shadow-black/40"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Try a claim</p>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 text-[var(--muted)] hover:text-[var(--fg)]">
          <X size={14} />
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">Claim a file as any agent. Switchboard checks it against everyone else's claims through the import graph.</p>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-xs">
          Agent
          <input value={agent} onChange={(e) => setAgent(e.target.value.trim() || "B")} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 font-mono text-sm outline-none focus:border-[var(--muted)]" />
        </label>
        <label className="grid gap-1.5 text-xs">
          File
          <select value={file} onChange={(e) => setFile(e.target.value)} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 font-mono text-sm outline-none focus:border-[var(--muted)]">
            {files.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy} onClick={run} className="rounded-full bg-[var(--color-signal)] px-4 py-2 text-sm font-medium text-[#1a0d08] transition active:scale-[0.98] disabled:opacity-60">
          {busy ? "Checking…" : "Claim it"}
        </button>
        {result && <p className="text-sm leading-relaxed" aria-live="polite">{result}</p>}
      </div>
    </motion.div>
  );
}
