import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import GlitchText from "@/components/kokonutui/glitch-text";
import bench from "../../../../bench/results.json";
import { CONFLICT_PATH, FOLDERS, HELD, WANTED, curve, layout, route, travel, type LaidNode } from "./graphLayout";
import { pulse } from "./AsciiField";

const W = 640;
const H = 520;
const EXPO = [0.16, 1, 0.3, 1] as const;
/** power4.out: the hit's own deceleration (cut-the-curve §3, the entry half after the cut). */
const IMPACT_OUT = [0.25, 1, 0.5, 1] as const;
const SIGNAL_TEXT = "var(--signal-text, var(--color-signal))";
const HOPS = CONFLICT_PATH.length - 1;
/** How long the verdict holds before the story plays again (once), while the hero stays in view. */
const REPLAY_MS = 14000;
/** The packet's flight. The camera pushes in over exactly this time, so it stops dead with the hit. */
const TRAVEL_S = 1;
/** Impact to verdict: the core flash, then stillness before the result (motion-doctrine: 0.3-0.75s comma). */
const VERDICT_AFTER_MS = 850;

/**
 * The hero, as one causal chain (motion-doctrine): the graph draws in, A takes
 * session.ts, B reaches for LoginForm.tsx, B's claim travels the real import path
 * as a packet, hits A's claim, the field shakes, a beat of stillness, then the refusal.
 * Steps: -1 waiting to be seen · 0 draw · 1 A claims · 2 B arrives · 3 packet travelling · 4 impact · 5 verdict.
 * Steps 0-3 are timed; the impact fires when the packet lands, and the verdict follows the impact.
 */
const BEATS = [0, 1200, 2100, 2800];

export function HeroGraph() {
  const reduce = useReducedMotion();
  const { nodes, edges, colX } = useMemo(() => layout(W, H), []);
  const [step, setStep] = useState(reduce ? 5 : -1);
  const [run, setRun] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  /** How many hops of the conflict path the packet has reached; hops light as it gets there. */
  const [reached, setReached] = useState(0);
  const lastCardClose = useRef(-Infinity);
  const figRef = useRef<HTMLDivElement>(null);
  // In view = most of the graph is above the bottom fifth of the screen, so on a phone (where the
  // hero text pushes the graph to the fold) the story waits until the reader scrolls to it.
  const inView = useInView(figRef, { amount: 0.45, margin: "0px 0px -20% 0px" });
  const svgRef = useRef<SVGSVGElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const px = useMotionValue(-50);
  const py = useMotionValue(-50);
  const travelled = useMotionValue(reduce ? 1 : 0);

  const pathNodes = CONFLICT_PATH.map((id) => nodes.get(id)!);
  const pathEdgeIds = new Set(pathNodes.slice(1).map((n, i) => `${pathNodes[i].id}>${n.id}`));
  const routeD = route(pathNodes);
  const a = nodes.get(HELD)!;
  const b = nodes.get(WANTED)!;
  const drawn = step >= 0;

  // The story plays only while the figure is on screen: it starts when half of it is visible
  // and replays on re-entry. The route is not reset here, so on a replay it fades out at full length.
  useEffect(() => {
    if (reduce) {
      travelled.set(1);
      return setStep(5);
    }
    if (!inView) return;
    setStep(0);
    setReached(0);
    const timers = BEATS.slice(1).map((t, i) => setTimeout(() => setStep(i + 1), t));
    return () => timers.forEach(clearTimeout);
  }, [run, reduce, travelled, inView]);

  // Step 3: B's claim travels the import path as a packet (motion values, no re-renders).
  // Each hop lights as the packet reaches it, and the impact fires on the frame it lands.
  useEffect(() => {
    if (step !== 3 || !routeRef.current) return;
    const el = routeRef.current;
    const hopAt = hopFractions(el, pathNodes);
    let live = true;
    travelled.set(0);
    const c = travel(
      el,
      (x, y, v) => {
        px.set(x);
        py.set(y);
        travelled.set(v);
        const k = hopAt.filter((f) => v >= f).length - 1;
        setReached((r) => (k > r ? k : r));
      },
      TRAVEL_S,
    );
    c.then(() => live && setStep(4));
    return () => {
      live = false;
      c.stop();
    };
  }, [step, px, py, travelled]);

  // Step 4: impact. Send the shockwave into the ASCII field at session.ts, then hold still before the verdict.
  useEffect(() => {
    if (step !== 4 || !svgRef.current) return;
    travelled.set(1);
    setReached(HOPS);
    const r = svgRef.current.getBoundingClientRect();
    pulse(r.left + (a.x / W) * r.width, r.top + (a.y / H) * r.height);
    const t = setTimeout(() => setStep(5), VERDICT_AFTER_MS);
    return () => clearTimeout(t);
  }, [step, a.x, a.y, travelled]);

  // Play the story once more REPLAY_MS after the verdict, then rest on the verdict frame (the replay button stays).
  useEffect(() => {
    if (step !== 5 || reduce || !inView || run >= 1) return;
    const t = setTimeout(() => setRun((r) => r + 1), REPLAY_MS);
    return () => clearTimeout(t);
  }, [step, reduce, inView, run]);

  // The camera pushes in on session.ts while the packet flies (linear, so it is still moving on the impact
  // frame and stops dead with the hit), holds through the comma, and pulls back as the verdict arrives.
  const camera = (step === 3 || step === 4) && !reduce;
  const hovered = hover ? nodes.get(hover) : undefined;

  return (
    <figure className="relative w-full">
      <div ref={figRef} className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full overflow-visible"
          role="group"
          aria-labelledby="hero-graph-title"
        >
          <title id="hero-graph-title">
            The demo repository as a graph. Agent B wants LoginForm.tsx, which reaches session.ts through two imports
            while agent A is editing it, so Switchboard refuses the edit.
          </title>

          <motion.g
            style={{ originX: a.x / W, originY: a.y / H, transformBox: "view-box" }}
            animate={{ scale: camera ? 1.08 : 1 }}
            transition={camera ? { duration: TRAVEL_S, ease: "linear" } : { duration: 0.6, ease: EXPO }}
          >
            {FOLDERS.map((f, i) => (
              <motion.text
                key={f}
                x={colX(i)}
                y={H - 8}
                textAnchor="middle"
                className="fill-[var(--muted)] font-mono text-[18px] sm:text-[13px] lg:text-[11px]"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: drawn ? 1 : 0, y: drawn ? 0 : 14 }}
                transition={{ duration: 0.7, delay: reduce ? 0 : i * 0.08, ease: EXPO }}
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
                    pathLength: drawn ? 1 : 0,
                    opacity: !drawn ? 0 : step >= 3 ? (lit ? 0 : e.hub ? 0.04 : 0.09) : e.hub ? 0.08 : 0.2,
                  }}
                  transition={{ duration: 0.9, delay: reduce || step > 0 ? 0 : 0.1 + col * 0.12, ease: EXPO }}
                />
              );
            })}

            {/* The route B's claim travels, drawn behind the packet as it goes. */}
            <path ref={routeRef} d={routeD} fill="none" stroke="none" />
            <motion.path
              d={routeD}
              fill="none"
              stroke="var(--color-signal)"
              strokeWidth={2.5}
              strokeLinecap="round"
              style={{ pathLength: travelled }}
              animate={{ opacity: step >= 3 ? 1 : 0 }}
            />

            {[...nodes.values()].map((n, i) => {
              const hop = CONFLICT_PATH.indexOf(n.id);
              const onPath = hop >= 0;
              const lit = onPath && (step >= 4 || (step === 3 && hop <= reached));
              const showLabel = (onPath && step >= 2) || hover === n.id;
              return (
                <g
                  key={n.id}
                  data-node={n.id}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => {
                    lastCardClose.current = performance.now();
                    setHover(null);
                  }}
                  onFocus={() => setHover(n.id)}
                  onBlur={() => {
                    lastCardClose.current = performance.now();
                    setHover(null);
                  }}
                  tabIndex={onPath ? 0 : undefined}
                  aria-label={onPath ? describe(n, nodes, edges).join(". ") : undefined}
                  className="outline-none focus-visible:outline-none"
                >
                  <circle cx={n.x} cy={n.y} r={14} fill="transparent" />
                  {hover === n.id && (
                    <circle cx={n.x} cy={n.y} r={n.id === HELD ? 19 : 10} fill="none" stroke="var(--fg)" strokeOpacity={0.7} />
                  )}
                  <motion.circle
                    cx={n.x}
                    cy={n.y}
                    initial={reduce ? false : { r: 0 }}
                    animate={{ r: !drawn ? 0 : lit ? 6 : n.hub ? 4.5 : 3.25 }}
                    transition={{ duration: 0.5, delay: step === 0 && !reduce ? 0.3 + (i % 9) * 0.04 : 0, ease: EXPO }}
                    fill={lit ? "var(--color-signal)" : "var(--fg)"}
                    fillOpacity={lit ? 1 : n.hub ? 0.6 : 0.45}
                  />
                  {showLabel && <NodeLabel n={n} lit={lit} reduce={!!reduce} />}
                </g>
              );
            })}

            {/* A's claim: a ring that lands on session.ts and stays. */}
            <motion.circle
              cx={a.x}
              cy={a.y}
              fill="none"
              stroke="var(--color-signal)"
              strokeWidth={1.5}
              initial={false}
              animate={
                step === 4 && !reduce ? { r: [13, 18, 13], opacity: 1 } : step >= 1 ? { r: 13, opacity: 1 } : { r: 30, opacity: 0 }
              }
              transition={
                step === 4 ? { duration: 0.4, times: [0, 0.2, 1], ease: IMPACT_OUT } : { duration: reduce ? 0 : 0.55, ease: EXPO }
              }
            />

            {/* Impact: a core flash where B's claim meets A's. The ASCII field carries the shockwave itself. */}
            <AnimatePresence>
              {step === 4 && (
                <motion.circle
                  cx={a.x}
                  cy={a.y}
                  fill="var(--color-signal)"
                  initial={{ r: 8, opacity: 1 }}
                  animate={{ r: 24, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: IMPACT_OUT }}
                />
              )}
            </AnimatePresence>

            {/* The packet: B's claim in flight. */}
            {step === 3 && <motion.circle cx={px} cy={py} r={14} fill="var(--color-signal)" fillOpacity={0.18} />}
            {step === 3 && <motion.circle cx={px} cy={py} r={6} fill="var(--color-signal)" />}
          </motion.g>

          <AgentChip x={a.x - 24} y={a.y - 56} anchor="start" show={step >= 1} label="Agent A" detail="editing session.ts" from={-40} reduce={!!reduce} />
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

        {/* Hover or focus a node: what the graph knows about it. */}
        <AnimatePresence>
          {hovered && (
            <NodeCard
              key={hovered.id}
              n={hovered}
              lines={describe(hovered, nodes, edges)}
              instant={!!reduce || performance.now() - lastCardClose.current < 300}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 min-h-[5.25rem] sm:mt-0 sm:min-h-0">
        <AnimatePresence>
          {step >= 5 && (
            <motion.figcaption
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: EXPO }}
              className="relative flex items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-[var(--color-signal)]/40 bg-[var(--surface)]/90 px-4 py-3 backdrop-blur-sm sm:absolute sm:left-6 sm:right-auto sm:top-full sm:mt-1"
            >
              <span className="text-sm leading-snug">
                <GlitchText
                  as="span"
                  text="Edit refused."
                  trigger="mount"
                  intensity="subtle"
                  accent="var(--color-signal)"
                  className="font-medium text-[var(--signal-text,var(--color-signal))] dark:text-[var(--signal-text,var(--color-signal))]"
                />{" "}
                <span className="text-[var(--muted)]">
                  LoginForm.tsx reaches session.ts in 2 imports. Checked in {bench.checkMsMedian.toFixed(2)}&nbsp;ms.
                </span>
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
      </div>
    </figure>
  );
}

/**
 * Labels sit clear of the lines: ui/ labels above and left of the node (the route leaves up and to the right),
 * the middle hop above its node (the route passes through it sideways), the claimed file's label outside its ring.
 */
function NodeLabel({ n, lit, reduce }: { n: LaidNode; lit: boolean; reduce: boolean }) {
  const lib = n.folder === "lib";
  const hop = CONFLICT_PATH.indexOf(n.id);
  const [x, y, anchor]: [number, number, "start" | "end"] =
    n.folder === "ui"
      ? [n.x - 14, n.y - 13, "start"]
      : hop > 0 && n.id !== HELD
        ? [n.x - 6, n.y - 10, "start"]
        : [n.x + (lib ? -11 : n.id === HELD ? 22 : 11), n.y + 4, lib ? "end" : "start"];
  return (
    <motion.text
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      x={x}
      y={y}
      textAnchor={anchor}
      className={`font-mono text-[20px] sm:text-[14px] lg:text-[11px] ${lit ? "fill-[var(--fg)]" : "fill-[var(--muted)]"}`}
    >
      {n.name}
    </motion.text>
  );
}

/** Where each node of the path sits along the route, as a share of its length (nearest of 200 samples). */
function hopFractions(el: SVGPathElement, path: { x: number; y: number }[]) {
  const len = el.getTotalLength();
  const samples = Array.from({ length: 201 }, (_, i) => el.getPointAtLength((i / 200) * len));
  return path.map((n) => {
    let best = 0;
    samples.forEach((p, i) => {
      if (Math.hypot(p.x - n.x, p.y - n.y) < Math.hypot(samples[best].x - n.x, samples[best].y - n.y)) best = i;
    });
    return best / 200;
  });
}

/** What the hover card says about a node, from the same graph the check runs on. */
function describe(n: LaidNode, nodes: Map<string, LaidNode>, edges: { source: LaidNode; target: LaidNode }[]) {
  if (n.id === HELD) return [n.name, "Claimed by Agent A", "until +30 min", "intent: rewrite the session label"];
  const hop = CONFLICT_PATH.indexOf(n.id);
  if (hop >= 0) {
    const by = hop === 0 ? "Agent B wants this file" : `imported by ${nodes.get(CONFLICT_PATH[hop - 1])!.name}`;
    return [n.name, `hop ${hop} of ${HOPS}`, by, "-[:IMPORTS*1..3]->"];
  }
  if (n.hub) return [n.name, "hub (PageRank)", "paths don't pass through it"];
  const k = edges.filter((e) => e.target.id === n.id).length;
  return [n.name, k === 0 ? "nothing imports it" : `imported by ${k} file${k === 1 ? "" : "s"}`];
}

/** An HTML card over the SVG, placed by converting the node's SVG coordinates to percentages of the figure. */
function NodeCard({ n, lines, instant }: { n: LaidNode; lines: string[]; instant: boolean }) {
  const [title, ...rest] = lines;
  const col = FOLDERS.indexOf(n.folder as (typeof FOLDERS)[number]);
  const tx = col === 0 ? "-14px" : col === FOLDERS.length - 1 ? "calc(-100% + 14px)" : "-50%";
  const below = n.y < H * 0.3;
  const ty = below ? "18px" : "calc(-100% - 28px)";
  const held = n.id === HELD;
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ left: `${(n.x / W) * 100}%`, top: `${(n.y / H) * 100}%`, transform: `translate(${tx}, ${ty})` }}
    >
      <motion.div
        role="status"
        style={{
          transformOrigin: `${col === 0 ? "14px" : col === FOLDERS.length - 1 ? "calc(100% - 14px)" : "50%"} ${below ? "0%" : "100%"}`,
        }}
        initial={instant ? false : { opacity: 0, y: below ? -6 : 6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
        transition={{ duration: 0.16, ease: EXPO }}
        className={`w-max max-w-[14rem] rounded-[var(--radius-panel)] border bg-[var(--surface)]/95 px-3.5 py-2.5 font-mono text-[11px] leading-relaxed shadow-lg shadow-black/20 backdrop-blur-sm sm:max-w-[16rem] ${
          held ? "border-[var(--color-signal)]/50" : "border-[var(--border)]"
        }`}
      >
        <p className="font-medium text-[var(--fg)]">{title}</p>
        {rest.map((l) => (
          <p
            key={l}
            style={l.startsWith("-[") || (held && l.startsWith("Claimed")) ? { color: SIGNAL_TEXT } : undefined}
            className="text-[var(--muted)]"
          >
            {l}
          </p>
        ))}
      </motion.div>
    </div>
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
  const w = 184;
  const x = props.anchor === "start" ? props.x - 14 : props.x - w + 14;
  return (
    <motion.g
      className="max-sm:hidden"
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
        <tspan style={props.alert ? { fill: SIGNAL_TEXT } : undefined} className={props.alert ? "" : "fill-[var(--muted)]"} fontWeight={400}>
          {" "}
          {props.detail}
        </tspan>
      </text>
    </motion.g>
  );
}
