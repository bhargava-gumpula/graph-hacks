import { useRef } from "react";
import NumberFlow from "@number-flow/react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Check, X } from "@phosphor-icons/react";
import bench from "../../../../bench/results.json";
import pairs from "../../../../bench/pairs.json";

const SIGNAL = "text-[var(--signal-text,var(--color-signal))]";
const EASE = [0.16, 1, 0.3, 1] as const;
const STAGGER = 0.06;
const TILE = "bg-[var(--bg)] p-8 md:p-10";

/** A counter that rolls up from 0 when it scrolls into view. */
function Flow({ value, digits = 0 }: { value: number; digits?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  return (
    <span ref={ref} className="inline-block tabular-nums">
      <NumberFlow value={inView || reduce ? value : 0} format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }} />
    </span>
  );
}

/** One cell per benchmark run, fading in one after another. */
function useCell(i: number) {
  const reduce = useReducedMotion();
  return {
    initial: reduce ? false : { opacity: 0, scale: 0.95 },
    whileInView: { opacity: 1, scale: 1 },
    viewport: { once: true, amount: 0.8 },
    transition: { duration: 0.5, delay: i * STAGGER, ease: EASE },
  } as const;
}

const CELLS: Record<string, { text: string; cls: string }> = {
  "tsc-fail": { text: "tsc", cls: "bg-[var(--fg)] text-[var(--bg)]" },
  refused: { text: "refused", cls: "bg-[var(--color-signal)] text-[#1a0d08]" },
  ok: { text: "tsc", cls: "border border-[var(--border)] text-[var(--muted)]" },
  landed: { text: "landed", cls: "border border-[var(--border)] text-[var(--muted)]" },
};

function Cell({ run, i }: { run: string; i: number }) {
  const cell = CELLS[run] ?? CELLS.landed!;
  const anim = useCell(i);
  return (
    <motion.li {...anim} className={`flex h-7 items-center justify-center gap-0.5 rounded-[4px] font-mono text-[11px] ${cell.cls}`}>
      {cell.text}
      {run === "tsc-fail" && <X size={10} weight="bold" aria-hidden />}
      {run === "ok" && <Check size={10} weight="bold" aria-hidden />}
    </motion.li>
  );
}

/** The outcome of each run, read from bench/results.json. */
function Strip({ runs, label }: { runs: string[]; label: string }) {
  return (
    <ul aria-label={label} className="mt-8 grid max-w-sm grid-cols-5 gap-1.5">
      {runs.map((run, i) => (
        <Cell key={i} run={run} i={i} />
      ))}
    </ul>
  );
}

/** Check time of each run, as bars scaled to the slowest run. */
function Bars({ samples }: { samples: number[] }) {
  const reduce = useReducedMotion();
  const max = Math.max(...samples);
  return (
    <ul aria-label={`Check time per run in ms: ${samples.join(", ")}`} className="mt-8 flex h-12 max-w-xs items-end gap-1.5">
      {samples.map((ms, i) => (
        <motion.li
          key={i}
          title={`${ms} ms`}
          initial={reduce ? false : { scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 0.5, delay: i * STAGGER, ease: EASE }}
          style={{ height: `${Math.max((ms / max) * 100, 6)}%`, transformOrigin: "bottom" }}
          className="flex-1 rounded-[2px] bg-[var(--fg)]/70"
        />
      ))}
    </ul>
  );
}

const File = ({ children }: { children: string }) => <span className="font-mono text-[0.9em] text-[var(--fg)]">{children}</span>;

const fmt = (n: number) => n.toLocaleString("en-US");

/** The benchmark and the pair census, read straight from bench/results.json and bench/pairs.json. */
export function Proof() {
  const n = bench.n;
  const demo = pairs.demo;
  const real = pairs.real;
  const hops = bench.conflict?.hops;
  const census = [
    { value: demo.pairs, label: "file pairs in the demo repo" },
    { value: demo.lock, label: "seen by a file lock" },
    { value: demo.oneHop, label: "seen by a one-hop check" },
    { value: demo.graph, label: "seen by the import graph, up to 3 hops", signal: true },
  ];

  return (
    <section id="proof" className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
      <h2 className="max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight md:text-5xl">Same edit, {n} runs each way.</h2>
      <p className="mt-5 max-w-[60ch] text-pretty text-lg leading-relaxed text-[var(--muted)]">
        Agent {bench.claim.agent} holds <File>{bench.claim.file}</File>; Agent {bench.edit.agent} edits <File>{bench.edit.file}</File>
        {hops ? `, ${hops} import hops away` : ""}. Each edit passes on its own. We merge both and run the real TypeScript compiler.
      </p>

      <div className="mt-16 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--border)] md:grid-cols-[1.2fr_1.2fr_0.8fr]">
        <div className={TILE}>
          <p className="text-[var(--muted)]">Without Switchboard</p>
          <p className="mt-4 text-6xl font-semibold tracking-tighter md:text-7xl">
            <Flow value={bench.without.brokenBuilds} />
            <span className="text-[var(--muted)]">/{n}</span>
          </p>
          <p className="mt-3 text-[var(--muted)]">builds broke. A file lock let both edits in.</p>
          <Strip runs={bench.runs.without} label={`Without Switchboard, ${n} runs`} />
        </div>
        <div className={`${TILE} shadow-[inset_0_0_90px_-20px_color-mix(in_oklab,var(--color-signal)_30%,transparent)]`}>
          <p className="text-[var(--muted)]">With Switchboard</p>
          <p className={`mt-4 text-6xl font-semibold tracking-tighter md:text-7xl ${SIGNAL}`}>
            <Flow value={bench.with.brokenBuilds} />
            <span className="text-[var(--muted)]">/{n}</span>
          </p>
          <p className="mt-3 text-[var(--muted)]">
            builds broke. All {bench.with.blocked} colliding edits were refused before they landed.
          </p>
          <Strip runs={bench.runs.with} label={`With Switchboard, ${n} runs`} />
        </div>
        <div className={TILE}>
          <p className="text-[var(--muted)]">Median check</p>
          <p className="mt-4 text-6xl font-semibold tracking-tighter md:text-7xl">
            <Flow value={bench.checkMsMedian} digits={2} />
            <span className="text-3xl text-[var(--muted)]"> ms</span>
          </p>
          <p className="mt-3 text-[var(--muted)]">
            range {bench.checkMsMin} to {bench.checkMsMax} ms over {n} runs
          </p>
          <Bars samples={bench.checkMsSamples} />
        </div>
      </div>

      <div className="mt-20 border-t border-[var(--border)] pt-12">
        <h3 className="max-w-2xl text-balance text-2xl font-semibold leading-tight tracking-tight md:text-3xl">Which collisions can each check see?</h3>
        <p className="mt-4 max-w-[60ch] leading-relaxed text-[var(--muted)]">
          Every pair of the demo repo&apos;s {demo.files} files, counted from the graph.
        </p>
        <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {census.map((c) => (
            <li key={c.label}>
              <p className={`text-5xl font-semibold tracking-tighter md:text-6xl ${c.signal ? SIGNAL : ""}`}>
                <Flow value={c.value} />
              </p>
              <p className="mt-3 max-w-[22ch] text-[var(--muted)]">{c.label}</p>
            </li>
          ))}
        </ul>
        <p className="mt-12 max-w-[60ch] text-lg leading-relaxed">
          <span className={`font-semibold ${SIGNAL}`}>
            <Flow value={demo.hidden} />
          </span>{" "}
          of {demo.graph} dependent pairs are 2 or 3 hops apart: a one-hop checker misses them, and a file lock misses every one.
        </p>
        <p className="mt-4 max-w-[60ch] leading-relaxed text-[var(--muted)]">
          The same census on this project&apos;s own web app ({real.files} files): {real.hidden} of {real.graph} dependent pairs are 2 or 3 hops apart,
          and a file lock sees none of the {fmt(real.pairs)} pairs.
        </p>
      </div>

      <p className="mt-12 max-w-[72ch] font-mono text-xs leading-relaxed text-[var(--muted)]">
        Scripted agents, real {bench.tsc.replace("Version ", "tsc ")}, real FalkorDB. The run is deterministic: {n} runs show repeatability, not a statistic.
        Pairs are unordered, and paths through a hub file are skipped. Reproduce it: npm run bench, npx tsx scripts/pairs.ts
      </p>
    </section>
  );
}
