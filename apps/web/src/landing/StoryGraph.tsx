import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CONFLICT_PATH, FOLDERS, curve, layout } from "./graphLayout";

const W = 640;
const H = 480;
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The storyline graph. Stages:
 * 0 two agents, each in its own worktree, nothing looks wrong
 * 1 the hidden dependency between their files
 * 2 without a check, both edits land and the build breaks at LoginForm.tsx
 * 3 with Switchboard, B's claim is checked against the graph and refused
 */
export function StoryGraph({ stage }: { stage: number }) {
  const reduce = useReducedMotion();
  const { nodes, edges, colX } = useMemo(() => layout(W, H, 60, 50), []);
  const path = CONFLICT_PATH.map((id) => nodes.get(id)!);
  const onPath = new Set(CONFLICT_PATH);
  const a = nodes.get("lib/crypto.ts")!;
  const b = nodes.get("ui/LoginForm.tsx")!;
  const hot = stage >= 1;
  const broken = stage === 2;
  const t = (d = 0.6) => ({ duration: reduce ? 0 : d, ease: EASE });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
      {FOLDERS.map((f, i) => (
        <text key={f} x={colX(i)} y={22} textAnchor="middle" className="fill-[var(--muted)] font-mono text-[11px]">
          {f}/
        </text>
      ))}
      {edges.map((e) => (
        <path
          key={e.id}
          d={curve(e.source, e.target)}
          fill="none"
          stroke="var(--fg)"
          strokeOpacity={e.hub ? 0.05 : 0.12}
          strokeWidth={1}
        />
      ))}
      {path.slice(1).map((n, i) => (
        <motion.path
          key={n.id}
          d={curve(path[i], n)}
          fill="none"
          stroke={broken ? "var(--fg)" : "var(--color-signal)"}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeDasharray={stage === 1 ? "4 6" : "0 0"}
          initial={false}
          animate={{ pathLength: hot ? 1 : 0, opacity: hot ? 1 : 0 }}
          transition={{ ...t(0.5), delay: reduce ? 0 : i * 0.18 }}
        />
      ))}
      {[...nodes.values()].map((n) => {
        const lit = hot && onPath.has(n.id);
        return (
          <g key={n.id}>
            <motion.circle
              cx={n.x}
              cy={n.y}
              initial={false}
              animate={{ r: lit ? 5.5 : 3.25 }}
              transition={t(0.4)}
              fill={lit ? (broken && n.id === b.id ? "var(--fg)" : "var(--color-signal)") : "var(--fg)"}
              fillOpacity={lit ? 1 : 0.35}
            />
            {(onPath.has(n.id) && hot) || n.id === a.id || n.id === b.id ? (
              <text
                x={n.x + (n.folder === "lib" ? -10 : 10)}
                y={n.y + 4}
                textAnchor={n.folder === "lib" ? "end" : "start"}
                className="fill-[var(--fg)] font-mono text-[11px]"
              >
                {n.name}
              </text>
            ) : null}
          </g>
        );
      })}

      <Chip x={a.x - 176} y={a.y - 48} text="Agent A" detail="rewrites crypto.ts" />
      <Chip
        x={b.x - 10}
        y={b.y + 22}
        text="Agent B"
        detail={stage === 3 ? "edit refused" : stage === 2 ? "edit landed" : "edits LoginForm.tsx"}
        alert={stage === 3}
      />

      <motion.g initial={false} animate={{ opacity: broken ? 1 : 0 }} transition={t(0.4)}>
        <rect x={b.x - 10} y={b.y - 58} width={150} height={30} rx={15} fill="var(--fg)" />
        <text x={b.x + 4} y={b.y - 38} className="fill-[var(--bg)] font-sans text-[12px] font-medium">
          tsc: build broken
        </text>
      </motion.g>
    </svg>
  );
}

function Chip(props: { x: number; y: number; text: string; detail: string; alert?: boolean }) {
  return (
    <g>
      <rect
        x={props.x}
        y={props.y}
        width={176}
        height={32}
        rx={16}
        fill="var(--surface)"
        stroke={props.alert ? "var(--color-signal)" : "var(--border)"}
      />
      <text x={props.x + 14} y={props.y + 20} className="fill-[var(--fg)] font-sans text-[12px] font-medium">
        {props.text}
        <tspan className={props.alert ? "fill-[var(--color-signal)]" : "fill-[var(--muted)]"} fontWeight={400}>
          {" "}
          {props.detail}
        </tspan>
      </text>
    </g>
  );
}
