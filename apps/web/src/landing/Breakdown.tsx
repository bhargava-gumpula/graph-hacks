import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Robot, HandGrabbing, Brain, TreeStructure } from "@phosphor-icons/react";

const LAYERS = [
  { name: "Agents", body: "Claude Code and Cursor sessions check in through MCP and editor hooks.", Icon: Robot },
  { name: "Claims", body: "What each agent is about to touch, with a time limit so a crashed agent lets go.", Icon: HandGrabbing },
  { name: "Memory", body: "Decisions, lessons and every edit, kept so a replacement agent gets a briefing.", Icon: Brain },
  { name: "Code graph", body: "Every file and import, parsed from your repo with ts-morph.", Icon: TreeStructure },
];

/** Object breakdown: the four layers of one FalkorDB graph separate as you scroll. */
export function Breakdown() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });

  return (
    <section id="how" ref={ref} className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">One graph, four layers.</h2>
        <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-[var(--muted)]">
          Claims live next to the code they touch, so a collision is just a path between two of them.
        </p>
      </div>

      <div className="mt-16 grid items-center gap-12 lg:grid-cols-2">
        <div className="relative mx-auto h-[420px] w-full max-w-[460px] [perspective:1400px]" aria-hidden="true">
          {LAYERS.map((l, i) => (
            <Plate key={l.name} index={i} progress={scrollYProgress} reduce={!!reduce} label={l.name} />
          ))}
        </div>
        <ol className="grid gap-8">
          {LAYERS.map((l) => (
            <li key={l.name} className="flex gap-4">
              <l.Icon size={22} weight="duotone" className="mt-1 shrink-0 text-[var(--color-signal)]" />
              <div>
                <h3 className="text-lg font-medium">{l.name}</h3>
                <p className="mt-1 max-w-[48ch] leading-relaxed text-[var(--muted)]">{l.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Plate(props: { index: number; progress: MotionValue<number>; reduce: boolean; label: string }) {
  const spread = props.index * 74;
  const y = useTransform(props.progress, [0, 1], props.reduce ? [spread, spread] : [props.index * 14, spread]);
  const isGraph = props.index === 3;
  return (
    <motion.div
      style={{ y, zIndex: 10 - props.index }}
      className="absolute inset-x-0 top-10 mx-auto h-[190px] w-[320px] [transform-style:preserve-3d]"
    >
      <div
        className={`h-full w-full rounded-[var(--radius-panel)] border [transform:rotateX(58deg)_rotateZ(-38deg)] ${
          isGraph ? "border-[var(--color-signal)]/60 bg-[var(--color-signal-soft)]" : "border-[var(--border)] bg-[var(--surface)]/85"
        }`}
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--fg) 22%, transparent) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      />
      <span className="absolute -right-4 top-1/2 translate-x-full font-mono text-[11px] text-[var(--muted)]">{props.label}</span>
    </motion.div>
  );
}
