import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { Robot, HandGrabbing, Brain, TreeStructure } from "@phosphor-icons/react";

/**
 * Plate-space coordinates (each plate is a 320x190 SVG). Every plate shares one
 * transform, so a point drawn at the same (x, y) on two plates sits on one vertical
 * screen line: A's claim ring is exactly above A's file dot.
 */
const A = { x: 262, y: 96 };
const B = { x: 58, y: 66 };
const HUB = { x: 150, y: 128 };
const F2 = { x: 120, y: 38 };
const F3 = { x: 198, y: 54 };
const FILES = [B, F2, F3, A, HUB, { x: 52, y: 150 }, { x: 238, y: 160 }, { x: 292, y: 36 }];

const TILT = "rotateX(58deg) rotateZ(-38deg)";
/** The exact inverse of TILT: a child with this transform faces the screen again. */
const UNTILT = "rotateZ(38deg) rotateX(-58deg)";
const PLATE_W = 320;
const PLATE_H = 190;
const GAP_FROM = 14;
const GAP_TO = 80;
const LIFT = -14;
/** Plates the A/B guides join: Claims (1) down to Code graph (3). */
const GUIDE_FROM = 1;
const GUIDE_TO = 3;
const GUIDE_MAX = (GUIDE_TO - GUIDE_FROM) * GAP_TO;
const LIFT_SPRING = { stiffness: 320, damping: 26 };
/** A plate's scroll-driven offset: packed at the start of the scroll, spread at the end. */
const plateY = (index: number, p: number, reduce: boolean) => index * (reduce ? GAP_TO : GAP_FROM + (GAP_TO - GAP_FROM) * p);

const curve = (p: { x: number; y: number }, q: { x: number; y: number }, bend = 18) => {
  const mx = (p.x + q.x) / 2;
  const my = (p.y + q.y) / 2 - bend;
  return `M${p.x} ${p.y} Q${mx} ${my} ${q.x} ${q.y}`;
};

const mono = { fontFamily: "var(--font-mono)" };
const soft = "color-mix(in oklab, var(--fg) 34%, transparent)";

function AgentsArt() {
  const task = { x: 160, y: 146 };
  return (
    <>
      <path d={curve(B, task, -20)} stroke={soft} strokeWidth="1.2" fill="none" />
      <path d={curve(A, task, 20)} stroke={soft} strokeWidth="1.2" fill="none" />
      <text x="160" y="112" textAnchor="middle" fontSize="9" fill="var(--muted)" style={mono}>
        WORKS_ON
      </text>
      {[
        { p: A, l: "A" },
        { p: B, l: "B" },
      ].map(({ p, l }) => (
        <g key={l}>
          <circle cx={p.x} cy={p.y} r="12" fill="var(--surface)" stroke="var(--fg)" strokeWidth="1.2" />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fill="var(--fg)" style={mono}>
            {l}
          </text>
        </g>
      ))}
      <rect x={task.x - 30} y={task.y - 13} width="60" height="26" rx="13" fill="var(--surface)" stroke="var(--fg)" strokeWidth="1.2" />
      <text x={task.x} y={task.y + 4} textAnchor="middle" fontSize="10" fill="var(--fg)" style={mono}>
        Task
      </text>
    </>
  );
}

function ClaimsArt() {
  return (
    <>
      {[
        { p: A, l: "A" },
        { p: B, l: "B" },
      ].map(({ p, l }) => (
        <g key={l}>
          <circle cx={p.x} cy={p.y} r="15" fill="none" stroke="var(--color-signal)" strokeWidth="2" />
          <circle cx={p.x} cy={p.y} r="22" fill="none" stroke="var(--color-signal)" strokeOpacity="0.35" strokeWidth="1" />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fill="var(--signal-text)" style={mono}>
            {l}
          </text>
        </g>
      ))}
      <text x={A.x - 30} y={A.y + 4} textAnchor="end" fontSize="9.5" fill="var(--signal-text)" style={mono}>
        :CLAIMS {"{until}"}
      </text>
    </>
  );
}

function Chip(props: { x: number; y: number; name: string; tag: string; ghost?: boolean }) {
  return (
    <g opacity={props.ghost ? 0.45 : 1}>
      <rect
        x={props.x}
        y={props.y}
        width="92"
        height="36"
        rx="8"
        fill="var(--surface)"
        stroke="var(--fg)"
        strokeOpacity="0.55"
        strokeDasharray={props.ghost ? "3 3" : undefined}
      />
      <text x={props.x + 10} y={props.y + 15} fontSize="10.5" fill="var(--fg)" style={mono}>
        {props.name}
      </text>
      <text x={props.x + 10} y={props.y + 28} fontSize="8.5" fill="var(--muted)" style={mono}>
        {props.tag}
      </text>
    </g>
  );
}

function MemoryArt() {
  return (
    <>
      <Chip x={18} y={18} name="Decision" tag="semantic" />
      <defs>
        <marker id="sb-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill={soft} />
        </marker>
      </defs>
      <Chip x={204} y={18} name="Decision" tag="superseded" ghost />
      <path d="M112 36 L198 36" stroke={soft} strokeWidth="1.2" markerEnd="url(#sb-arrow)" />
      <text x="155" y="30" textAnchor="middle" fontSize="8.5" fill="var(--muted)" style={mono}>
        SUPERSEDES
      </text>
      <Chip x={18} y={128} name="Lesson" tag="procedural" />
      <Chip x={196} y={132} name="Event" tag="episodic" />
    </>
  );
}

function CodeArt() {
  const rest = FILES.slice(5);
  const imports = [
    [B, HUB],
    [F2, HUB],
    [rest[0], HUB],
    [rest[1], HUB],
    [A, HUB],
    [F3, rest[2]],
    [rest[0], rest[1]],
  ];
  return (
    <>
      {imports.map(([p, q], i) => (
        <path key={i} d={curve(p, q, 10)} stroke={soft} strokeWidth="1" fill="none" />
      ))}
      <text x="70" y="112" fontSize="8.5" fill="var(--muted)" style={mono}>
        IMPORTS
      </text>
      {/* The conflict: B's file reaches A's file in three imports, never through the hub. */}
      <path d={`${curve(B, F2)} ${curve(F2, F3).replace("M", "L")} ${curve(F3, A).replace("M", "L")}`} stroke="var(--color-signal)" strokeWidth="2" fill="none" />
      {FILES.map((p, i) =>
        p === HUB ? null : (
          <circle key={i} cx={p.x} cy={p.y} r="4.5" fill={p === A || p === B || p === F2 || p === F3 ? "var(--color-signal)" : "var(--fg)"} />
        ),
      )}
      <circle cx={HUB.x} cy={HUB.y} r="8" fill="var(--fg)" />
      <circle cx={HUB.x} cy={HUB.y} r="15" fill="none" stroke="var(--fg)" strokeOpacity="0.5" strokeDasharray="3 3" />
      <text x={HUB.x} y={HUB.y + 30} textAnchor="middle" fontSize="10" fill="var(--fg)" style={mono}>
        PageRank hub
      </text>
    </>
  );
}

const LAYERS: { name: string; body: string; can: string; Icon: typeof Robot; Art: () => ReactNode }[] = [
  {
    name: "Agents",
    body: "Claude Code and Cursor sessions check in through MCP and editor hooks.",
    can: "WCC over INTERFERES → safe parallel batches",
    Icon: Robot,
    Art: AgentsArt,
  },
  {
    name: "Claims",
    body: "What each agent is about to touch, with a time limit so a crashed agent lets go.",
    can: "brief_me ranks by graph distance",
    Icon: HandGrabbing,
    Art: ClaimsArt,
  },
  {
    name: "Memory",
    body: "Decisions, lessons and every edit, kept so a replacement agent gets a briefing.",
    can: "why(path) traces File → Event → Task → Decision → Agent",
    Icon: Brain,
    Art: MemoryArt,
  },
  {
    name: "Code graph",
    body: "Every file and import, parsed from your repo with ts-morph.",
    can: "PageRank → paths never pass through hubs",
    Icon: TreeStructure,
    Art: CodeArt,
  },
];

/** Object breakdown: the four layers of one FalkorDB graph separate as you scroll. Hover a plate or a row. */
export function Breakdown() {
  const ref = useRef<HTMLElement>(null);
  const reduce = !!useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  // One lift spring per plate (fixed count), shared by the plate and the guides that end on it.
  const lifts = [useSpring(0, LIFT_SPRING), useSpring(0, LIFT_SPRING), useSpring(0, LIFT_SPRING), useSpring(0, LIFT_SPRING)];
  useEffect(() => {
    lifts.forEach((s, i) => (reduce ? s.jump(i === active ? LIFT : 0) : s.set(i === active ? LIFT : 0)));
  }, [active, reduce]); // the springs are stable across renders
  const top = lifts[GUIDE_FROM];
  const bottom = lifts[GUIDE_TO];
  const guideY = useTransform([scrollYProgress, top], ([p, l]: number[]) => plateY(GUIDE_FROM, p, reduce) + l);
  const guideScale = useTransform(
    [scrollYProgress, top, bottom],
    ([p, lt, lb]: number[]) => (plateY(GUIDE_TO, p, reduce) + lb - plateY(GUIDE_FROM, p, reduce) - lt) / GUIDE_MAX,
  );

  return (
    <section id="how" ref={ref} className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
      <div className="max-w-2xl">
        <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-5xl">One graph, four layers.</h2>
        <p className="mt-5 max-w-[56ch] text-pretty text-lg leading-relaxed text-[var(--muted)]">
          Claims live next to the code they touch, so a collision is just a path between two of them.
        </p>
      </div>

      <div className="mt-16 grid items-center gap-12 lg:grid-cols-2">
        <div
          className="relative mx-auto h-[440px] w-full max-w-[460px] origin-center scale-[0.82] [perspective:1400px] sm:scale-100 xl:scale-110"
          aria-hidden="true"
          onPointerLeave={() => setActive(null)}
        >
          {LAYERS.map((l, i) => (
            <Plate key={l.name} index={i} progress={scrollYProgress} lift={lifts[i]} reduce={reduce} label={l.name} active={active === i} onHover={setActive}>
              <l.Art />
            </Plate>
          ))}
          {/* Dashed guides from each claim ring straight down to the file it claims. */}
          <motion.div
            style={{ y: guideY, zIndex: 20 }}
            className="pointer-events-none absolute inset-x-0 top-10 mx-auto h-[190px] w-[320px] [transform-style:preserve-3d]"
          >
            <div className="relative h-full w-full [transform-style:preserve-3d]" style={{ transform: TILT }}>
              {[A, B].map((p) => (
                <div
                  key={p === A ? "a" : "b"}
                  className="absolute left-0 top-0 [transform-style:preserve-3d]"
                  style={{ transform: `translate(${p.x}px, ${p.y}px) ${UNTILT}`, transformOrigin: "0 0" }}
                >
                  <motion.div
                    style={{ scaleY: guideScale, height: GUIDE_MAX }}
                    className={`origin-top border-l border-dashed ${p === A ? "border-[var(--color-signal)]" : "border-[var(--muted)]/70"}`}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
        <ol className="grid gap-8">
          {LAYERS.map((l, i) => (
            <li
              key={l.name}
              tabIndex={0}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="flex cursor-default gap-4 rounded-[var(--radius-panel)] outline-offset-4"
            >
              <l.Icon size={22} weight="duotone" className="mt-1 shrink-0 text-[var(--signal-text)]" />
              <div className="min-w-0">
                <h3 className={`text-lg font-medium transition-colors ${active === i ? "text-[var(--signal-text)]" : ""}`}>{l.name}</h3>
                <div className="relative mt-1 min-h-[3.25rem] max-w-[48ch]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.p
                      key={active === i ? "can" : "body"}
                      initial={reduce ? false : { opacity: 0, transform: "translateY(4px)" }}
                      animate={{ opacity: 1, transform: "translateY(0px)" }}
                      exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                      className={active === i ? "font-mono text-[15px] leading-relaxed text-[var(--fg)]" : "leading-relaxed text-[var(--muted)]"}
                    >
                      {active === i ? l.can : l.body}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Plate(props: {
  index: number;
  progress: MotionValue<number>;
  lift: MotionValue<number>;
  reduce: boolean;
  label: string;
  active: boolean;
  onHover: (i: number) => void;
  children: ReactNode;
}) {
  const y = useTransform([props.progress, props.lift], ([p, l]: number[]) => plateY(props.index, p, props.reduce) + l);
  return (
    <motion.div
      style={{ y, zIndex: 10 - props.index }}
      className="absolute inset-x-0 top-10 mx-auto h-[190px] w-[320px] [transform-style:preserve-3d]"
    >
      <div
        onPointerEnter={() => props.onHover(props.index)}
        className={`h-full w-full rounded-[var(--radius-panel)] border transition-colors duration-200 ${
          props.active ? "border-[var(--color-signal)] bg-[var(--surface)]/75" : "border-[var(--border)] bg-[var(--surface)]/40"
        }`}
        style={{
          transform: TILT,
          backgroundImage: "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--fg) 12%, transparent) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      >
        <svg viewBox={`0 0 ${PLATE_W} ${PLATE_H}`} className="h-full w-full overflow-visible">
          {props.children}
        </svg>
      </div>
      <span
        className={`absolute -right-4 top-1/2 hidden translate-x-full font-mono text-[11px] transition-colors sm:block ${
          props.active ? "text-[var(--signal-text)]" : "text-[var(--muted)]"
        }`}
      >
        {props.label}
      </span>
    </motion.div>
  );
}
