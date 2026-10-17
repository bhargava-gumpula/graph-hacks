import { motion, useReducedMotion } from "motion/react";
import { GitBranch, Lock, Notebook, Graph } from "@phosphor-icons/react";

const OTHERS = [
  { Icon: GitBranch, name: "Separate worktrees", gap: "Keep files apart. The conflict two imports away still lands at merge time." },
  { Icon: Lock, name: "File locks", gap: "Stop two agents on the same file. They can't see that LoginForm.tsx depends on session.ts." },
  { Icon: Notebook, name: "Shared memory notes", gap: "Help agents remember. Nothing checks an edit against the code before it happens." },
];

export function Compare() {
  const reduce = useReducedMotion();
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-5xl">Why not just…</h2>
          <div className="mt-10 rounded-[var(--radius-panel)] border border-[var(--color-signal)]/50 bg-[var(--color-signal-soft)] p-7">
            <Graph size={26} weight="duotone" className="text-[var(--color-signal)]" />
            <p className="mt-4 text-lg font-medium">Switchboard</p>
            <p className="mt-2 leading-relaxed text-[var(--muted)]">
              Checks every claim against the parsed dependency graph, and keeps decisions and history in that same graph.
            </p>
          </div>
        </div>
        <ul className="grid gap-4 self-end">
          {OTHERS.map((o, i) => (
            <motion.li
              key={o.name}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-5 rounded-[var(--radius-panel)] border border-[var(--border)] p-6"
            >
              <o.Icon size={22} className="mt-0.5 shrink-0 text-[var(--muted)]" />
              <div>
                <p className="font-medium">{o.name}</p>
                <p className="mt-1 leading-relaxed text-[var(--muted)]">{o.gap}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
