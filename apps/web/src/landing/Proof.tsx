import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import bench from "../../../../bench/results.json";

function Count({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, to, { duration: 1.2, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, reduce, to]);
  return (
    <span ref={ref} className="tabular-nums">
      {v}
      {suffix}
    </span>
  );
}

/** The with/without benchmark, read straight from bench/results.json. */
export function Proof() {
  const n = bench.n;
  return (
    <section id="proof" className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
      <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
        Same edit, {n} runs each way.
      </h2>
      <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-[var(--muted)]">
        Two scripted agents make the colliding edit on the demo repo. We run the real TypeScript compiler after every merge.
      </p>

      <div className="mt-16 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--border)] md:grid-cols-[1.2fr_1.2fr_0.8fr]">
        <div className="bg-[var(--bg)] p-8 md:p-10">
          <p className="text-[var(--muted)]">Without Switchboard</p>
          <p className="mt-4 text-6xl font-semibold tracking-tighter md:text-7xl">
            <Count to={bench.without.brokenBuilds} />
            <span className="text-[var(--muted)]">/{n}</span>
          </p>
          <p className="mt-3 text-[var(--muted)]">builds broke</p>
        </div>
        <div className="bg-[var(--bg)] p-8 md:p-10">
          <p className="text-[var(--muted)]">With Switchboard</p>
          <p className="mt-4 text-6xl font-semibold tracking-tighter text-[var(--color-signal)] md:text-7xl">
            <Count to={bench.with.brokenBuilds} />
            <span className="text-[var(--muted)]">/{n}</span>
          </p>
          <p className="mt-3 text-[var(--muted)]">builds broke, {bench.with.blocked} edits refused first</p>
        </div>
        <div className="bg-[var(--bg)] p-8 md:p-10">
          <p className="text-[var(--muted)]">Median check</p>
          <p className="mt-4 text-6xl font-semibold tracking-tighter md:text-7xl">
            <Count to={bench.checkMsMedian} />
            <span className="text-3xl text-[var(--muted)]"> ms</span>
          </p>
          <p className="mt-3 text-[var(--muted)]">per claim, on FalkorDB</p>
        </div>
      </div>
      <p className="mt-5 font-mono text-xs text-[var(--muted)]">Reproduce it: npm run bench</p>
    </section>
  );
}
