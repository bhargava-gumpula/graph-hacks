import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import GlitchText from "@/components/kokonutui/glitch-text";
import { CONFLICT_PATH, FOLDERS, curve, layout } from "./graphLayout";
import { pulse } from "./AsciiField";

const W = 640;
const H = 520;
const EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * The hero, as one causal chain (motion-doctrine): the graph draws in, A takes
 * crypto.ts, B reaches for LoginForm.tsx, B's claim travels the real import path
 * as a packet, hits A's claim, the field shakes, a beat of stillness, then the refusal.
 * Steps: 0 draw · 1 A claims · 2 B arrives · 3 packet travelling · 4 impact · 5 verdict
 */
const BEATS = [0, 1200, 2100, 2800, 4050, 4600];

export function HeroGraph() {
  const reduce = useReducedMotion();
  const { nodes, edges, colX } = useMemo(() => layout(W, H), []);
  const [step, setStep] = useState(reduce ? 5 : 0);
  const [run, setRun] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const px = useMotionValue(-50);
  const py = useMotionValue(-50);
  const travelled = useMotionValue(reduce ? 1 : 0);

  const pathNodes = CONFLICT_PATH.map((id) => nodes.get(id)!);
  const pathEdgeIds = new Set(pathNodes.slice(1).map((n, i) => `${pathNodes[i].id}>${n.id}`));
  const route = pathNodes
    .slice(1)
    .map((n, i) => curve(pathNodes[i], n))
    .map((d, i) => (i === 0 ? d : d.replace(/^M [^C]+/, "")))
    .join(" ");
  const a = nodes.get("lib/crypto.ts")!;
  const b = nodes.get("ui/LoginForm.tsx")!;
  const focus = { x: (a.x + b.x) / 2, y: (a.y + nodes.get("auth/session.ts")!.y) / 2 };

  useEffect(() => {
    if (reduce) {
      travelled.set(1);
      return setStep(5);
    }
    setStep(0);
    travelled.set(0);
    const timers = BEATS.slice(1).map((t, i) => setTimeout(() => setStep(i + 1), t));
    return () => timers.forEach(clearTimeout);
  }, [run, reduce, travelled]);

  // Step 3: B's claim travels the import path as a packet (motion values, no re-renders).
  useEffect(() => {
    if (step !== 3 || !routeRef.current) return;
    const el = routeRef.current;
    const len = el.getTotalLength();
    const c = animate(0, 1, {
      duration: 1.2,
      ease: [0.45, 0, 0.2, 1],
      onUpdate: (v) => {
        const p = el.getPointAtLength(v * len);
        px.set(p.x);
        py.set(p.y);
        travelled.set(v);
      },
    });
    return () => c.stop();
  }, [step, px, py, travelled]);

  // Step 4: impact. Send the shockwave into the ASCII field at crypto.ts.
  useEffect(() => {
    if (step !== 4 || !svgRef.current) return;
    travelled.set(1);
    const r = svgRef.current.getBoundingClientRect();
    pulse(r.left + (a.x / W) * r.width, r.top + (a.y / H) * r.height);
  }, [step, a.x, a.y, travelled]);

  const camera = step >= 3 && step < 5 && !reduce;

  return (
    <figure className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-labelledby="hero-graph-title"
      >
        <title id="hero-graph-title">
          The demo repository as a graph. Agent B wants LoginForm.tsx, which reaches crypto.ts through three imports
          while agent A is editing it, so Switchboard refuses the edit.
        </title>

        <motion.g
          style={{ transformOrigin: `${focus.x}px ${focus.y}px` }}
          animate={{ scale: camera ? 1.07 : 1 }}
          transition={{ duration: 1.4, ease: EXPO }}
        >
          {FOLDERS.map((f, i) => (
            <motion.text
              key={f}
              x={colX(i)}
              textAnchor="middle"
              className="fill-[var(--muted)] font-mono text-[11px]"
              initial={reduce ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 26 }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: EXPO }}
            >
              {f}/
            </motion.text>
          ))}

          {edges.map((e) => {
            const lit = pathEdgeIds.has(e.id);
            const col = FOLDERS.indexOf(e.source.folder as (typeof FOLDERS)[number]);
            return (
              <motion.path
                key={e.id}
                d={curve(e.source, e.target)}
                fill="none"
                stroke="var(--fg)"
                strokeWidth={1}
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: step >= 3 ? (lit ? 0 : e.hub ? 0.04 : 0.09) : e.hub ? 0.08 : 0.2,
                }}
                transition={{ duration: 0.9, delay: reduce || step > 0 ? 0 : 0.1 + col * 0.12, ease: EXPO }}
              />
            );
          })}

          {/* The route B's claim travels, drawn behind the packet as it goes. */}
          <path ref={routeRef} d={route} fill="none" stroke="none" />
          <motion.path
            d={route}
            fill="none"
            stroke="var(--color-signal)"
            strokeWidth={2.5}
            strokeLinecap="round"
            style={{ pathLength: travelled }}
            animate={{ opacity: step >= 3 ? 1 : 0 }}
          />

          {[...nodes.values()].map((n, i) => {
            const onPath = CONFLICT_PATH.includes(n.id);
            const lit = onPath && step >= 3;
            const showLabel = (onPath && step >= 2) || hover === n.id;
            return (
              <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
                <circle cx={n.x} cy={n.y} r={14} fill="transparent" />
                <motion.circle
                  cx={n.x}
                  cy={n.y}
                  initial={reduce ? false : { r: 0 }}
                  animate={{ r: lit ? 6 : n.hub ? 4.5 : 3.25 }}
                  transition={{ duration: 0.5, delay: step === 0 && !reduce ? 0.3 + (i % 9) * 0.04 : 0, ease: EXPO }}
                  fill={lit ? "var(--color-signal)" : "var(--fg)"}
                  fillOpacity={lit ? 1 : n.hub ? 0.6 : 0.45}
                />
                {showLabel && (
                  <motion.text
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    x={n.x + (n.folder === "lib" ? -11 : 11)}
                    y={n.y + 4}
                    textAnchor={n.folder === "lib" ? "end" : "start"}
                    className={`font-mono text-[11px] ${lit ? "fill-[var(--fg)]" : "fill-[var(--muted)]"}`}
                  >
                    {n.name}
                  </motion.text>
                )}
              </g>
            );
          })}

          {/* A's claim: a ring that lands on crypto.ts and stays. */}
          <motion.circle
            cx={a.x}
            cy={a.y}
            fill="none"
            stroke="var(--color-signal)"
            strokeWidth={1.5}
            initial={false}
            animate={step >= 1 ? { r: 13, opacity: 1 } : { r: 30, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.55, ease: EXPO }}
          />

          {/* Impact burst where B's claim meets A's. */}
          <AnimatePresence>
            {step === 4 && (
              <motion.circle
                cx={a.x}
                cy={a.y}
                fill="none"
                stroke="var(--color-signal)"
                strokeWidth={2}
                initial={{ r: 8, opacity: 1 }}
                animate={{ r: 70, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: [0.2, 0.7, 0.3, 1] }}
              />
            )}
          </AnimatePresence>

          {/* The packet: B's claim in flight. */}
          {step === 3 && <motion.circle cx={px} cy={py} r={14} fill="var(--color-signal)" fillOpacity={0.18} />}
          {step === 3 && <motion.circle cx={px} cy={py} r={6} fill="var(--color-signal)" />}
        </motion.g>

        <AgentChip x={a.x} y={a.y - 54} anchor="end" show={step >= 1} label="Agent A" detail="editing crypto.ts" from={40} reduce={!!reduce} />
        <AgentChip
          x={b.x}
          y={b.y + 24}
          anchor="start"
          show={step >= 2}
          label="Agent B"
          detail={step >= 5 ? "edit refused" : "wants LoginForm.tsx"}
          alert={step >= 4}
          shake={step === 4}
          from={-40}
          reduce={!!reduce}
        />
      </svg>

      <AnimatePresence>
        {step >= 5 && (
          <motion.figcaption
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EXPO }}
            className="relative mt-3 flex items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-[var(--color-signal)]/40 bg-[var(--surface)]/90 px-4 py-3 backdrop-blur-sm sm:absolute sm:bottom-2 sm:left-6 sm:right-auto sm:mt-0"
          >
            <span className="text-sm leading-snug">
              <GlitchText
                as="span"
                text="Edit refused."
                trigger="idle"
                intensity="strong"
                accent="var(--color-signal)"
                className="font-medium text-[var(--color-signal)] dark:text-[var(--color-signal)]"
              />{" "}
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

function AgentChip(props: {
  x: number;
  y: number;
  anchor: "start" | "end";
  show: boolean;
  label: string;
  detail: string;
  from: number;
  reduce: boolean;
  alert?: boolean;
  shake?: boolean;
}) {
  const w = 176;
  const x = props.anchor === "start" ? props.x - 14 : props.x - w + 14;
  return (
    <motion.g
      initial={false}
      animate={
        props.shake && !props.reduce
          ? { opacity: 1, x: [0, -9, 7, -4, 2, 0] }
          : { opacity: props.show ? 1 : 0, x: props.show ? 0 : props.from }
      }
      transition={props.shake ? { duration: 0.45 } : { duration: props.reduce ? 0 : 0.6, ease: EXPO }}
    >
      <rect
        x={x}
        y={props.y}
        width={w}
        height={34}
        rx={17}
        fill="var(--surface)"
        stroke={props.alert ? "var(--color-signal)" : "var(--border)"}
      />
      <text x={x + 16} y={props.y + 21} className="fill-[var(--fg)] font-sans text-[12px] font-medium">
        {props.label}
        <tspan className={props.alert ? "fill-[var(--color-signal)]" : "fill-[var(--muted)]"} fontWeight={400}>
          {" "}
          {props.detail}
        </tspan>
      </text>
    </motion.g>
  );
}
