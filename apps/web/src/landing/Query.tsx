import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/** What each clause does. Repeated clauses share a note and light up together. */
const NOTES = {
  up: "UPSTREAM: follow imports out of my file, up to three hops, to a file another agent claims. A lock table can't do this. A graph does it in one step.",
  hub: "PageRank flags files that many others import as hubs (lib/utils.ts here). A path may not pass through a hub, so a shared helper that imports other code cannot chain all its callers into one conflict. Editing a hub itself still conflicts with everything that imports it.",
  active: "Ignore your own claims and claims that have expired.",
  same: "SAME: another agent already claims this exact file.",
  down: "DOWNSTREAM: a file another agent claims imports mine, within three hops. My change can break their code.",
  ret: "Return the chain of files itself. It becomes the reason the edit was refused.",
  unwind: "Run every check once per file the agent asked to edit.",
  union: "Three checks, one round trip: the same file, upstream and downstream.",
};
type Key = keyof typeof NOTES;
type Part = { k: Key; code: string };

const WANT: Part = { k: "unwind", code: "UNWIND $paths AS want" };
const ACTIVE: Part = { k: "active", code: "WHERE o.id <> $agent AND c.until > $now" };
const NO_HUB: Part = { k: "hub", code: "  AND none(n IN nodes(p)[1..-1] WHERE coalesce(n.hub, false))" };
const UNION: Part = { k: "union", code: "UNION ALL" };
const ret = (type: string, claimed: string, path: string, hops: string, hub: string): Part => ({
  k: "ret",
  code: `RETURN want AS file, '${type}' AS type, ${claimed} AS claimed,\n       ${path} AS path, ${hops} AS hops,\n       o.id AS agent, c.taskId AS taskId, c.intent AS intent,\n       c.until AS until, ${hub} AS hub`,
});
const BOTH_HUB = "coalesce(f.hub, false) OR coalesce(g.hub, false)";

/**
 * The real conflictQuery(3) from packages/core/src/queries/conflict.ts, hubs skipped
 * only as interior nodes, re-wrapped at existing spaces to fit the column. Only
 * whitespace may differ from the core query.
 */
const PARTS: Part[] = [
  WANT,
  { k: "same", code: "MATCH (f:File {path: want})<-[c:CLAIMS]-(o:Agent)" },
  ACTIVE,
  ret("SAME", "f.path", "[f.path]", "0", "coalesce(f.hub, false)"),
  UNION,
  WANT,
  { k: "up", code: "MATCH p = (f:File {path: want})-[:IMPORTS*1..3]->(g:File),\n      (g)<-[c:CLAIMS]-(o:Agent)" },
  ACTIVE,
  NO_HUB,
  ret("UPSTREAM", "g.path", "[n IN nodes(p) | n.path]", "length(p)", BOTH_HUB),
  UNION,
  WANT,
  { k: "down", code: "MATCH p = (g:File)-[:IMPORTS*1..3]->(f:File {path: want}),\n      (g)<-[c:CLAIMS]-(o:Agent)" },
  ACTIVE,
  NO_HUB,
  ret("DOWNSTREAM", "g.path", "[n IN nodes(p) | n.path]", "length(p)", BOTH_HUB),
];

export const CYPHER = PARTS.map((p) => p.code).join("\n");

/** Hover-based reveal: each clause of the real conflict query explains itself. */
export function Query() {
  const [active, setActive] = useState<Key>("up");
  const reduce = useReducedMotion();
  const seen = new Set<Key>();
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
      {/* One column (the hero, story and breakdown are already splits): the note stays pinned right above the code it explains. */}
      <div className="max-w-4xl">
        <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-5xl">One query decides.</h2>
        <p className="mt-5 max-w-[52ch] text-pretty text-lg leading-relaxed text-[var(--muted)]">
          The check is one Cypher query in FalkorDB: three path matches joined by UNION ALL. Point at a line to see what it does.
        </p>
        <div className="sticky top-16 z-10 -mx-5 mt-8 bg-[var(--bg)]/90 px-5 py-4 backdrop-blur-sm after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-[var(--bg)]/90 after:to-transparent md:-mx-8 md:px-8">
          {/* Fixed height (the longest note), so swapping notes never moves the code under the pointer. */}
          <div className="relative min-h-[9rem] md:min-h-[7.5rem] lg:min-h-[6rem]" aria-live="polite">
            {/* popLayout: the new note enters while the old one leaves, so it is readable in about 150 ms. */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={active}
                initial={reduce ? false : { opacity: 0, transform: "translateY(4px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                className="text-base font-medium leading-snug tracking-tight md:text-xl"
              >
                {NOTES[active]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <pre className="mt-2 min-w-0 overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 font-mono text-[12px] leading-6 md:p-5 md:text-[13px]">
          {PARTS.map((p, i) => {
            const first = !seen.has(p.k);
            seen.add(p.k);
            return (
              <span
                key={i}
                tabIndex={first ? 0 : -1}
                onMouseEnter={() => setActive(p.k)}
                onFocus={() => setActive(p.k)}
                className={`block w-max min-w-full cursor-default rounded px-2 transition-colors ${
                  active === p.k ? "bg-[var(--color-signal-soft)] text-[var(--fg)]" : "text-[var(--muted)]"
                }`}
              >
                {p.code}
              </span>
            );
          })}
        </pre>
      </div>
    </section>
  );
}
