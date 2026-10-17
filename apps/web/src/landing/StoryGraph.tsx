import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import bench from "../../../../bench/results.json";
import { CONFLICT_PATH, FOLDERS, HELD, WANTED, curve, layout, route, travel, type LaidEdge, type LaidNode } from "./graphLayout";
import { pulse } from "./AsciiField";

const W = 640;
const H = 480;
const EASE = [0.16, 1, 0.3, 1] as const;
const SPLIT = 36;
const MID = W / 2;
const SIGNAL_TEXT = "var(--signal-text, var(--color-signal))";
const HOPS = CONFLICT_PATH.length - 1;
const RESULT = `CONFLICT · UPSTREAM · ${HOPS} hops · held by A · ${bench.checkMsMedian.toFixed(2)} ms`;

/** ui/ and api/ are B's worktree, auth/ and lib/ are A's. */
const leftSide = (n: LaidNode) => FOLDERS.indexOf(n.folder as (typeof FOLDERS)[number]) < 2;

/**
 * The storyline graph, driven by the scroll stage:
 * 0 two worktrees: the halves sit apart with fog between them, so nothing crosses the gap
 * 1 the halves spring together and the hidden chain draws in
 * 2 without a check, both edits land and the build breaks at LoginForm.tsx
 * 3 with Switchboard: A's claim lands, B's claim travels LoginForm.tsx to session.ts, hits it,
 *   a beat of stillness, then the result of the check
 */
export function StoryGraph({ stage }: { stage: number }) {
  const reduce = useReducedMotion();
  const { nodes, edges, colX } = useMemo(() => layout(W, H, 60, 50), []);
  const path = CONFLICT_PATH.map((id) => nodes.get(id)!);
  const pathEdgeIds = new Set(path.slice(1).map((n, i) => `${path[i].id}>${n.id}`));
  const routeD = route(path);
  const a = nodes.get(HELD)!;
  const b = nodes.get(WANTED)!;
  const split = stage === 0;
  const hot = stage >= 1;
  const broken = stage === 2;
  const checking = stage === 3;
  const t = (d = 0.6, delay = 0) => ({ duration: reduce ? 0 : d, delay: reduce ? 0 : delay, ease: EASE });

  // The two halves share one spring, so every side element moves together.
  const target = useMotionValue(SPLIT);
  const gap = useSpring(target, { stiffness: 210, damping: 19 });
  const leftX = useTransform(gap, (v) => -v);
  useEffect(() => {
    target.set(split ? SPLIT : 0);
    if (reduce) gap.jump(split ? SPLIT : 0);
  }, [split, reduce, target, gap]);

  // Stage 3 beats: 0 A's claim lands · 1 B's claim travelling · 2 impact · 3 result.
  const [beat, setBeat] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const px = useMotionValue(b.x);
  const py = useMotionValue(b.y);
  const travelled = useMotionValue(0);

  const pulseAt = (n: LaidNode) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (r) pulse(r.left + (n.x / W) * r.width, r.top + (n.y / H) * r.height);
  };

  useEffect(() => {
    if (!checking) {
      setBeat(0);
      travelled.set(0);
      return;
    }
    if (reduce) {
      travelled.set(1);
      return setBeat(3);
    }
    let packet: ReturnType<typeof travel> | undefined;
    let live = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Wait for the halves to meet and A's ring to land, then B's claim sets off.
    timers.push(
      setTimeout(() => {
        if (!routeRef.current) return;
        setBeat(1);
        packet = travel(
          routeRef.current,
          (x, y, v) => {
            px.set(x);
            py.set(y);
            travelled.set(v);
          },
          1.1,
        );
        packet.then(() => {
          if (!live) return;
          setBeat(2);
          pulseAt(a);
          // Stillness before the verdict (motion-doctrine): half a second, then the result.
          timers.push(setTimeout(() => setBeat(3), 550));
        });
      }, 650),
    );
    return () => {
      live = false;
      packet?.stop();
      timers.forEach(clearTimeout);
    };
  }, [checking, reduce]);

  // The build breaking sends its own shockwave from LoginForm.tsx.
  useEffect(() => {
    if (broken && !reduce) pulseAt(b);
  }, [broken, reduce]);

  const sideEdges = (left: boolean) => edges.filter((e) => leftSide(e.source) === left && leftSide(e.target) === left);
  const crossEdges = edges.filter((e) => leftSide(e.source) !== leftSide(e.target));
  const edgePath = (e: LaidEdge) => (
    <motion.path
      key={e.id}
      d={curve(e.source, e.target)}
      fill="none"
      stroke="var(--fg)"
      strokeWidth={1}
      initial={false}
      animate={{ strokeOpacity: pathEdgeIds.has(e.id) && hot ? 0 : e.hub ? 0.05 : 0.13 }}
      transition={t(0.4)}
    />
  );

  const nodeMark = (n: LaidNode) => {
    const lit = hot && CONFLICT_PATH.includes(n.id);
    const fill = !lit ? "var(--fg)" : broken && n.id === b.id ? "var(--fg)" : "var(--color-signal)";
    const named = n.id === a.id || n.id === b.id || lit;
    return (
      <g key={n.id}>
        <motion.circle
          cx={n.x}
          cy={n.y}
          initial={false}
          animate={{ r: lit ? 5.5 : n.id === a.id || n.id === b.id ? 4.5 : 3.25 }}
          transition={t(0.4)}
          fill={fill}
          fillOpacity={lit || n.id === a.id || n.id === b.id ? 1 : 0.35}
        />
        {named && (
          // B's file is labelled below (the chain rises from it), the middle hop above (the chain runs through it sideways),
          // and A's file to the right, outside the claim ring.
          <text
            x={n.id === a.id ? n.x + 22 : n.x - 6}
            y={n.y}
            dy={n.id === b.id ? "1.6em" : n.id === a.id ? "0.35em" : "-0.75em"}
            textAnchor="start"
            className="fill-[var(--fg)] font-mono text-[22px] sm:text-[14px] lg:text-[11px]"
          >
            {n.name}
          </text>
        )}
      </g>
    );
  };

  const half = (left: boolean) => {
    const cols = left ? [0, 1] : [2, 3];
    const x0 = colX(cols[0]) - 24;
    const x1 = colX(cols[1]) + 24;
    return (
      <motion.g style={{ x: left ? leftX : gap }}>
        {/* The worktree wall: only there while the halves are apart. */}
        <motion.g initial={false} animate={{ opacity: split ? 1 : 0 }} transition={t(0.35)}>
          <rect
            x={x0}
            y={36}
            width={x1 - x0}
            height={H - 76}
            rx={14}
            fill="none"
            stroke="var(--fg)"
            strokeOpacity={0.22}
            strokeDasharray="3 6"
          />
          <text x={(x0 + x1) / 2} y={H - 14} textAnchor="middle" className="fill-[var(--muted)] font-mono text-[22px] sm:text-[14px] lg:text-[11px]">
            {left ? "B's view" : "A's view"}
          </text>
        </motion.g>
        {cols.map((ci) => (
          <text key={ci} x={colX(ci)} y={22} textAnchor="middle" className="fill-[var(--muted)] font-mono text-[18px] sm:text-[13px] lg:text-[11px]">
            {FOLDERS[ci]}/
          </text>
        ))}
        {sideEdges(left).map(edgePath)}
        {[...nodes.values()].filter((n) => leftSide(n) === left).map(nodeMark)}
        {left ? (
          <Chip
            x={b.x - 10}
            y={b.y + 28}
            text="Agent B"
            detail={stage === 2 ? "edit landed" : checking ? (beat >= 2 ? "edit refused" : "claims LoginForm.tsx") : "edits LoginForm.tsx"}
            alert={checking && beat >= 2}
            shake={checking && beat === 2 && !reduce}
          />
        ) : (
          <Chip x={a.x - 14} y={a.y + 22} text="Agent A" detail={checking ? "holds session.ts" : "rewrites session.ts"} />
        )}
      </motion.g>
    );
  };

  return (
    <div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="story-fog" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: "var(--bg)", stopOpacity: 0 }} />
            <stop offset="0.5" style={{ stopColor: "var(--bg)", stopOpacity: 0.95 }} />
            <stop offset="1" style={{ stopColor: "var(--bg)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        {/* Edges that cross between the worktrees: invisible from either side until the halves meet. */}
        <motion.g initial={false} animate={{ opacity: split ? 0 : 1 }} transition={t(0.5, split ? 0 : 0.25)}>
          {crossEdges.map(edgePath)}
        </motion.g>

        {half(true)}
        {half(false)}

        {/* The fog between the two worktrees. */}
        <motion.rect
          x={MID - 80}
          y={0}
          width={160}
          height={H}
          fill="url(#story-fog)"
          initial={false}
          animate={{ opacity: split ? 1 : 0 }}
          transition={t(0.45)}
        />

        {/* The hidden chain: dashed when found, solid and dark when it breaks the build, faint once the claim travels it. */}
        {path.slice(1).map((n, i) => (
          <motion.path
            key={n.id}
            d={curve(path[i], n)}
            fill="none"
            stroke={broken ? "var(--fg)" : "var(--color-signal)"}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeDasharray={stage === 2 ? "0 0" : "4 6"}
            initial={false}
            animate={{ pathLength: hot ? 1 : 0, opacity: !hot ? 0 : checking ? 0.35 : 1 }}
            transition={t(0.55, stage === 1 ? 0.3 + i * 0.22 : 0)}
          />
        ))}

        {/* B's claim travels the chain, drawing it solid behind the packet. */}
        <path ref={routeRef} d={routeD} fill="none" stroke="none" />
        <motion.path
          d={routeD}
          fill="none"
          stroke="var(--color-signal)"
          strokeWidth={2.75}
          strokeLinecap="round"
          style={{ pathLength: travelled }}
          animate={{ opacity: checking ? 1 : 0 }}
          transition={t(0.2)}
        />
        {checking && beat === 1 && (
          <>
            <motion.circle cx={px} cy={py} r={15} fill="var(--color-signal)" fillOpacity={0.18} />
            <motion.circle cx={px} cy={py} r={6.5} fill="var(--color-signal)" />
          </>
        )}

        {/* A's claim: the ring lands on session.ts first, then everything else follows from it. */}
        <motion.circle
          cx={a.x}
          cy={a.y}
          fill="none"
          stroke="var(--color-signal)"
          strokeWidth={1.75}
          initial={false}
          animate={checking ? { r: 13, opacity: 1 } : { r: 30, opacity: 0 }}
          transition={t(0.5, checking ? 0.25 : 0)}
        />
        <AnimatePresence>
          {checking && beat === 2 && (
            <motion.circle
              cx={a.x}
              cy={a.y}
              fill="none"
              stroke="var(--color-signal)"
              strokeWidth={2}
              initial={{ r: 8, opacity: 1 }}
              animate={{ r: 80, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.2, 0.7, 0.3, 1] }}
            />
          )}
        </AnimatePresence>
      </svg>

      <Readout stage={stage} beat={beat} reduce={!!reduce} />
    </div>
  );
}

/** One mono line under the graph that says what the graph shows; at the end it is the check's answer. */
function Readout({ stage, beat, reduce }: { stage: number; beat: number; reduce: boolean }) {
  const result = stage === 3 && beat >= 3;
  const line =
    stage === 0
      ? "A: auth/session.ts\u2003B: ui/LoginForm.tsx"
      : stage === 1
        ? CONFLICT_PATH.join(" -> ")
        : stage === 2
          ? "tsc: build broken in ui/LoginForm.tsx"
          : result
            ? RESULT
            : "claim ui/LoginForm.tsx …";
  return (
    <div className="relative mt-3 h-12" aria-hidden="true">
      <AnimatePresence initial={false} mode="wait">
        <motion.p
          key={line}
          initial={reduce ? false : { opacity: 0, y: result ? 10 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.15 } }}
          transition={{ duration: reduce ? 0 : result ? 0.5 : 0.3, ease: EASE }}
          style={result ? { color: SIGNAL_TEXT } : undefined}
          className={`absolute inset-0 flex items-center rounded-[var(--radius-panel)] border px-3 font-mono text-[11px] leading-snug sm:text-xs ${
            result
              ? "border-[var(--color-signal)]/50 bg-[var(--color-signal-soft)] font-medium"
              : stage === 2
                ? "border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]"
                : "border-transparent text-[var(--muted)]"
          }`}
        >
          {line}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function Chip(props: { x: number; y: number; text: string; detail: string; alert?: boolean; shake?: boolean }) {
  return (
    <motion.g
      className="max-sm:hidden"
      initial={false}
      animate={{ x: props.shake ? [0, -9, 7, -4, 2, 0] : 0 }}
      transition={{ duration: props.shake ? 0.45 : 0 }}
    >
      <rect
        x={props.x}
        y={props.y}
        width={184}
        height={32}
        rx={16}
        fill="var(--surface)"
        stroke={props.alert ? "var(--color-signal)" : "var(--border)"}
      />
      <text x={props.x + 14} y={props.y + 20} className="fill-[var(--fg)] font-sans text-[12px] font-medium">
        {props.text}
        <tspan style={props.alert ? { fill: SIGNAL_TEXT } : undefined} className={props.alert ? "" : "fill-[var(--muted)]"} fontWeight={400}>
          {" "}
          {props.detail}
        </tspan>
      </text>
    </motion.g>
  );
}
