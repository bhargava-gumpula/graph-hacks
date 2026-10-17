import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { CONFLICT_PATH, FOLDERS, curve, layout } from "./graphLayout";

const W = 640;
const H = 520;
const EASE = [0.16, 1, 0.3, 1] as const;

/** Story beats, in ms from start. Discrete steps, so React state is fine here. */
const BEATS = [0, 1300, 2400, 3300, 4900];

/**
 * The hero: the real demo-repo graph, drawn in code. Agent A is editing crypto.ts,
 * agent B reaches for LoginForm.tsx, and the dependency path between them lights up
 * hop by hop until the edit is refused.
 */
export function HeroGraph() {
  const reduce = useReducedMotion();
  const { nodes, edges, colX } = useMemo(() => layout(W, H), []);
  const [step, setStep] = useState(reduce ? 4 : 0);
  const [run, setRun] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    if (reduce) return setStep(4);
    setStep(0);
    const timers = BEATS.slice(1).map((t, i) => setTimeout(() => setStep(i + 1), t));
    return () => timers.forEach(clearTimeout);
  }, [run, reduce]);

  const pathNodes = CONFLICT_PATH.map((id) => nodes.get(id)!);
  const pathEdgeIds = new Set(pathNodes.slice(1).map((n, i) => `${pathNodes[i].id}>${n.id}`));
  const a = nodes.get("lib/crypto.ts")!;
  const b = nodes.get("ui/LoginForm.tsx")!;

  return (
    <figure className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="hero-graph-title">
        <title id="hero-graph-title">
          The demo repository as a graph. Agent B wants LoginForm.tsx, which reaches crypto.ts through three imports
          while agent A is editing it, so Switchboard refuses the edit.
        </title>

        {FOLDERS.map((f, i) => (
          <text key={f} x={colX(i)} y={26} textAnchor="middle" className="fill-[var(--muted)] font-mono text-[11px]">
            {f}/
          </text>
        ))}

        {edges.map((e, i) => {
          const lit = pathEdgeIds.has(e.id);
          return (
            <motion.path
              key={e.id}
              d={curve(e.source, e.target)}
              fill="none"
              stroke="currentColor"
              className="text-[var(--fg)]"
              strokeWidth={1}
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: lit && step >= 3 ? 0 : e.hub ? 0.06 : 0.16 }}
              transition={{ duration: 1.1, delay: reduce ? 0 : 0.15 + (i % 12) * 0.03, ease: EASE }}
            />
          );
        })}

        {/* The conflict path, drawn hop by hop over the faint graph. */}
        {pathNodes.slice(1).map((n, i) => (
          <motion.path
            key={`hot-${n.id}`}
            d={curve(pathNodes[i], n)}
            fill="none"
            stroke="var(--color-signal)"
            strokeWidth={2.25}
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength: step >= 3 ? 1 : 0, opacity: step >= 3 ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.45, delay: reduce ? 0 : i * 0.38, ease: EASE }}
          />
        ))}

        {[...nodes.values()].map((n) => {
          const onPath = CONFLICT_PATH.includes(n.id);
          const lit = onPath && step >= 3;
          const showLabel = onPath || hover === n.id;
          return (
            <g
              key={n.id}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              className="cursor-default"
            >
              <circle cx={n.x} cy={n.y} r={14} fill="transparent" />
              <motion.circle
                cx={n.x}
                cy={n.y}
                initial={reduce ? false : { r: 0 }}
                animate={{ r: lit ? 5.5 : n.hub ? 4.5 : 3.25 }}
                transition={{ duration: 0.5, ease: EASE }}
                fill={lit ? "var(--color-signal)" : "var(--fg)"}
                fillOpacity={lit ? 1 : n.hub ? 0.55 : 0.4}
              />
              {showLabel && (
                <text
                  x={n.x + (n.folder === "lib" ? -10 : 10)}
                  y={n.y + 4}
                  textAnchor={n.folder === "lib" ? "end" : "start"}
                  className={`font-mono text-[11px] ${lit ? "fill-[var(--fg)]" : "fill-[var(--muted)]"}`}
                >
                  {n.name}
                </text>
              )}
            </g>
          );
        })}

        <AgentChip x={a.x} y={a.y} align="end" show={step >= 1} label="Agent A" detail="editing crypto.ts" reduce={!!reduce} />
        <AgentChip x={b.x} y={b.y} align="start" show={step >= 2} label="Agent B" detail="wants LoginForm.tsx" reduce={!!reduce} below />
      </svg>

      <AnimatePresence>
        {step >= 4 && (
          <motion.figcaption
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="relative mt-3 flex items-center sm:absolute sm:bottom-2 sm:left-6 sm:mt-0 justify-between gap-4 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]/90 px-4 py-3 backdrop-blur-sm sm:right-auto"
          >
            <span className="text-sm leading-snug">
              <span className="font-medium text-[var(--color-signal)]">Edit refused.</span>{" "}
              <span className="text-[var(--muted)]">LoginForm.tsx reaches crypto.ts in 3 imports. Checked in under 1 ms.</span>
            </span>
            {!reduce && (
              <button
                type="button"
                onClick={() => setRun((r) => r + 1)}
                className="shrink-0 rounded-full p-1.5 text-[var(--muted)] transition hover:text-[var(--fg)] active:scale-95"
                aria-label="Replay the animation"
              >
                <ArrowCounterClockwise size={16} weight="bold" />
              </button>
            )}
          </motion.figcaption>
        )}
      </AnimatePresence>
    </figure>
  );
}

function AgentChip(props: { x: number; y: number; align: "start" | "end"; show: boolean; label: string; detail: string; reduce: boolean; below?: boolean }) {
  const w = 168;
  const x = props.align === "start" ? props.x - 12 : props.x - w + 12;
  const y = props.below ? props.y + 24 : props.y - 52;
  return (
    <motion.g
      initial={false}
      animate={{ opacity: props.show ? 1 : 0, y: props.show ? 0 : 8 }}
      transition={{ duration: props.reduce ? 0 : 0.45, ease: EASE }}
    >
      <rect x={x} y={y} width={w} height={34} rx={17} className="fill-[var(--surface)] stroke-[var(--border)]" />
      <circle cx={x + 17} cy={y + 17} r={4} fill="var(--color-signal)" />
      <text x={x + 30} y={y + 21} className="fill-[var(--fg)] font-sans text-[12px] font-medium">
        {props.label}
        <tspan className="fill-[var(--muted)] font-normal"> {props.detail}</tspan>
      </text>
      <line x1={props.x} y1={props.below ? y : y + 34} x2={props.x} y2={props.below ? props.y + 7 : props.y - 7} className="stroke-[var(--border)]" strokeDasharray="2 3" />
    </motion.g>
  );
}
