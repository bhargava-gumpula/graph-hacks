import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/** Hover-based reveal: each part of the real conflict query explains itself. */
const PARTS = [
  { code: "MATCH p = (f:File {path: $want})", note: "Start at the file the agent wants to edit." },
  { code: "-[:IMPORTS*1..3]->(g:File)", note: "Follow imports up to three hops. A lock table can't do this; a graph does it in one step." },
  { code: ", (g)<-[c:CLAIMS]-(o:Agent)", note: "Stop wherever another agent holds a claim." },
  { code: "WHERE o.id <> $agent AND c.until > $now", note: "Ignore your own claims and claims that have expired." },
  { code: "AND none(n IN nodes(p) WHERE n.hub)", note: "Skip hub files like utils.ts, found by PageRank, so shared helpers don't block everyone." },
  { code: "RETURN [n IN nodes(p) | n.path] AS path", note: "Return the chain itself. It becomes the reason the edit was refused." },
];

export function Query() {
  const [active, setActive] = useState(1);
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <div className="min-w-0">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">One query decides.</h2>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-[var(--muted)]">
            The check is a single Cypher path match in FalkorDB. Point at a line to see what it does.
          </p>
          <pre className="mt-10 overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-5 font-mono text-[13px] leading-7 md:text-sm">
            {PARTS.map((p, i) => (
              <span
                key={p.code}
                tabIndex={0}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={`block cursor-default rounded px-2 transition-colors ${
                  active === i ? "bg-[var(--color-signal-soft)] text-[var(--fg)]" : "text-[var(--muted)]"
                }`}
              >
                {p.code}
              </span>
            ))}
          </pre>
        </div>
        <div className="min-h-[120px] lg:pb-6" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.p
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-2xl font-medium leading-snug tracking-tight md:text-3xl"
            >
              {PARTS[active].note}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
