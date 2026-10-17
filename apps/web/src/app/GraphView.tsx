import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowsOut, Minus, Plus } from "@phosphor-icons/react";
import type { Claim, Snapshot } from "./api";
import type { Hit } from "./useLive";
import { curve, layoutGraph } from "./layoutGraph";
import { pulse } from "../landing/AsciiField";

const EXPO = [0.16, 1, 0.3, 1] as const;
/** Camera moves on screen: strong ease-in-out, under 300ms. */
const CAM = { duration: 0.22, ease: [0.77, 0, 0.175, 1] as const };
/** Touch screens get a bigger hit circle per node. Springs below use damping = 1.7 * sqrt(stiffness) (ratio about 0.85). */
const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** The multi-hop (UPSTREAM) part of the conflict query, which is the one that drew this route. */
function upstreamPart(q: string) {
  const lines = q.trim().split("\n");
  const start = Math.max(0, lines.findIndex((l) => l.includes("IMPORTS*")) - 1);
  const end = lines.findIndex((l, i) => i > start && l.startsWith("UNION"));
  return lines.slice(start, end < 0 ? start + 6 : end).join("\n");
}

export interface GraphViewProps {
  graph: Snapshot;
  claims: Claim[];
  hit: Hit | null;
  selected: string | null;
  /** Dependents of the selected file by hop (from /api/blast). */
  blast: Map<string, number>;
  /** File -> batch index, when batches mode is on. */
  batchOf: Map<string, number> | null;
  /** The file an agent was just refused, drawn as a dashed ghost claim. */
  ghost: { file: string; agent: string } | null;
  /** Agent whose claims and blast radius to light (hovering its card). */
  focusAgent?: string | null;
  /** For the route card: the graph check time and the conflict query. */
  checkMs?: number | null;
  conflictCypher?: string;
  onSelect: (id: string | null) => void;
  /** Called on the impact frame of a conflict (at once for a restored or reduced-motion one). */
  onLanded?: (id: number) => void;
}

/**
 * The live code graph. Files sit in folder columns, imports are curves, claims are
 * rings with the agent's letter. A conflict animates as a packet travelling the
 * real dependency path to the claim it hit, then an impact that ripples the field.
 */
export function GraphView(props: GraphViewProps) {
  const { graph, claims, hit, selected, blast, batchOf, ghost, focusAgent, checkMs, conflictCypher, onSelect, onLanded } = props;
  const reduce = useReducedMotion();
  // Phone-width canvases get tighter folder columns, so labels stay readable after fit.
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const L = useMemo(() => layoutGraph(graph, narrow ? 110 : 210), [graph, narrow]);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  // Route card position as motion values: pointermove never re-renders the graph.
  const [onRoute, setOnRoute] = useState(false);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);

  // Camera: pan and zoom as motion values (no React re-render per frame).
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const k = useMotionValue(1);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; live: boolean } | null>(null);
  const stopCam = () => {
    tx.stop();
    ty.stop();
    k.stop();
  };
  /** Glide the camera, or jump under reduced motion. */
  const moveCam = (nk: number, ntx: number, nty: number, duration = CAM.duration) => {
    stopCam();
    if (reduce) {
      k.set(nk);
      tx.set(ntx);
      ty.set(nty);
      return;
    }
    const t = { ...CAM, duration };
    animate(k, nk, t);
    animate(tx, ntx, t);
    animate(ty, nty, t);
  };
  const fit = () => {
    const el = wrap.current;
    if (!el) return;
    const s = Math.min(el.clientWidth / L.width, el.clientHeight / L.height) * 0.94;
    moveCam(s, (el.clientWidth - L.width * s) / 2, (el.clientHeight - L.height * s) / 2, 0.3);
  };
  useEffect(() => {
    fit();
    const ro = new ResizeObserver(() => {
      setNarrow((wrap.current?.clientWidth ?? 1024) < 640);
      fit();
    });
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L.width, L.height]);

  /** Wheel zoom follows the gesture directly; the +/- buttons glide (tween). */
  const zoomBy = (f: number, cx?: number, cy?: number, tween = false) => {
    stopCam();
    const el = wrap.current!;
    const px = cx ?? el.clientWidth / 2;
    const py = cy ?? el.clientHeight / 2;
    const nk = Math.min(4, Math.max(0.25, k.get() * f));
    const r = nk / k.get();
    const ntx = px - (px - tx.get()) * r;
    const nty = py - (py - ty.get()) * r;
    if (tween) return moveCam(nk, ntx, nty);
    tx.set(ntx);
    ty.set(nty);
    k.set(nk);
  };

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Claims by file, for rings and labels.
  const claimsByFile = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of claims) m.set(c.path, [...(m.get(c.path) ?? []), c.agent]);
    return m;
  }, [claims]);

  // The conflict animation: packet along the path, then impact.
  const [shot, setShot] = useState<{ id: number; d: string; end: { x: number; y: number }; ids: Set<string>; quiet: boolean } | null>(null);
  const [impact, setImpact] = useState<{ id: number; x: number; y: number } | null>(null);
  const packetX = useMotionValue(-99);
  const packetY = useMotionValue(-99);
  const routeRef = useRef<SVGPathElement>(null);
  const routeLen = useMotionValue(0);
  useEffect(() => {
    if (!hit) {
      setShot(null);
      setImpact(null);
      return;
    }
    const pts = hit.conflict.path.map((p) => L.nodes.get(p)).filter(Boolean) as { x: number; y: number }[];
    if (pts.length < 1) {
      onLanded?.(hit.id);
      return;
    }
    const d =
      pts.length === 1
        ? `M ${pts[0].x} ${pts[0].y} L ${pts[0].x} ${pts[0].y}`
        : pts.slice(1).map((p, i) => curve(pts[i], p)).map((s, i) => (i === 0 ? s : s.replace(/^M [^C]+/, ""))).join(" ");
    setShot({ id: hit.id, d, end: pts[pts.length - 1], ids: new Set(hit.conflict.path), quiet: !!hit.quiet });
  }, [hit, L.nodes]);

  useEffect(() => {
    if (!shot || !routeRef.current) return;
    const el = routeRef.current;
    const len = el.getTotalLength();
    routeLen.set(0);
    // A restored conflict (page load) shows the path without the impact.
    if (shot.quiet) {
      routeLen.set(1);
      return;
    }
    const done = () => {
      setImpact({ id: shot.id, ...shot.end });
      onLanded?.(shot.id);
      const r = svg.current?.getBoundingClientRect();
      if (r) {
        const sx = r.left + tx.get() + shot.end.x * k.get();
        const sy = r.top + ty.get() + shot.end.y * k.get();
        pulse(sx, sy);
      }
    };
    if (reduce) {
      routeLen.set(1);
      done();
      return;
    }
    const c = animate(0, 1, {
      duration: Math.min(1.6, 0.45 * Math.max(1, hit?.conflict.hops ?? 1)),
      // power3.in: the packet accelerates into the claim and is cut at peak velocity on impact.
      ease: [0.32, 0, 0.67, 0],
      onUpdate: (v) => {
        const p = el.getPointAtLength(v * len);
        packetX.set(p.x);
        packetY.set(p.y);
        routeLen.set(v);
      },
      onComplete: done,
    });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot?.id]);

  // Hovering an agent card lights its claims and everything that imports them within 3 hops.
  const focus = useMemo(() => {
    if (!focusAgent) return null;
    const m = new Map<string, number>();
    let frontier = claims.filter((c) => c.agent === focusAgent).map((c) => c.path);
    if (!frontier.length) return null; // holds nothing: nothing to light, so dim nothing
    frontier.forEach((p) => m.set(p, 0));
    for (let h = 1; h <= 3 && frontier.length; h++) {
      const next: string[] = [];
      for (const e of L.edges) {
        if (!e.hub && frontier.includes(e.t.id) && !m.has(e.s.id)) {
          m.set(e.s.id, h);
          next.push(e.s.id);
        }
      }
      frontier = next;
    }
    return m;
  }, [focusAgent, claims, L.edges]);

  const hovered = hover ? L.nodes.get(hover) : null;
  const hoveredClaims = hover ? claimsByFile.get(hover) ?? [] : [];
  const importers = hover ? L.edges.filter((e) => e.t.id === hover).length : 0;
  const imports = hover ? L.edges.filter((e) => e.s.id === hover).length : 0;
  // The hover card sits beside its node, clamped inside the canvas.
  const cardAt = (x: number, y: number, w: number, h: number) => {
    const el = wrap.current;
    const W = el?.clientWidth ?? 0;
    const H = el?.clientHeight ?? 0;
    return {
      left: Math.max(8, Math.min(W - w - 8, tx.get() + x * k.get() + 16)),
      top: Math.max(8, Math.min(H - h - 8, ty.get() + y * k.get() - 10)),
    };
  };
  // First paint: columns arrive left to right, imports draw after their source.
  const colOf = useMemo(() => new Map(L.folders.map((f, i) => [f, i])), [L.folders]);
  const enter = (n: { folder: string; y: number }) => 0.1 + (colOf.get(n.folder) ?? 0) * 0.08 + (n.y / L.height) * 0.2;
  const halo = { paintOrder: "stroke", stroke: "var(--bg)", strokeWidth: 3, strokeLinejoin: "round" } as const;

  return (
    <div
      ref={wrap}
      className="relative h-full w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing"
      onPointerDown={(e) => {
        if ((e.target as Element).closest("[data-node], button")) return;
        stopCam();
        drag.current = { x: e.clientX, y: e.clientY, tx: tx.get(), ty: ty.get(), live: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.live) {
          // Capture only once a drag has started, so clicks still reach their targets.
          if (Math.hypot(dx, dy) < 4) return;
          d.live = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
        tx.set(d.tx + dx);
        ty.set(d.ty + dy);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (d && !d.live) onSelect(null);
      }}
      onPointerCancel={() => (drag.current = null)}
    >
      <svg ref={svg} className="absolute inset-0 h-full w-full" role="group" aria-label="Live code graph">
        <motion.g style={{ x: tx, y: ty, scale: k, originX: 0, originY: 0 }}>
          {L.folders.map((f, i) => (
            <motion.text
              key={f}
              x={L.colX(i)}
              y={28}
              textAnchor="middle"
              className="fill-[var(--muted)] font-mono text-[11px]"
              style={halo}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.05 + i * 0.08 }}
            >
              {f}/
            </motion.text>
          ))}

          {L.edges.map((e) => {
            const onShot = shot && shot.ids.has(e.s.id) && shot.ids.has(e.t.id);
            const inBlast = selected && (e.t.id === selected || blast.has(e.t.id)) && blast.has(e.s.id);
            const inFocus = focus && focus.has(e.s.id) && focus.has(e.t.id);
            const touch = hover && (e.s.id === hover || e.t.id === hover);
            return (
              <motion.path
                key={e.id}
                d={curve(e.s, e.t)}
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: EXPO, delay: enter(e.s) }}
                fill="none"
                stroke="var(--fg)"
                strokeOpacity={onShot ? 0 : inBlast || inFocus ? 0.55 : touch ? 0.45 : e.hub ? 0.05 : focus || selected ? 0.06 : 0.14}
                strokeWidth={inBlast || inFocus || touch ? 1.4 : 1}
                style={{ transition: "stroke-opacity .35s, stroke-width .35s" }}
              />
            );
          })}

          {shot && (
            <>
              <path ref={routeRef} d={shot.d} fill="none" stroke="none" />
              <motion.path key={shot.id} d={shot.d} fill="none" stroke="var(--color-signal)" strokeWidth={2.5} strokeLinecap="round" style={{ pathLength: routeLen }} />
              {/* A wide invisible stroke so the thin route is easy to hover. */}
              <path
                d={shot.d}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                data-node
                className="cursor-help"
                onPointerEnter={() => setOnRoute(true)}
                onPointerMove={(e) => {
                  const el = wrap.current;
                  if (!el) return;
                  const r = el.getBoundingClientRect();
                  rx.set(Math.max(8, Math.min(el.clientWidth - 296, e.clientX - r.left + 16)));
                  ry.set(Math.max(8, Math.min(el.clientHeight - (conflictCypher ? 200 : 80), e.clientY - r.top + 14)));
                }}
                onPointerLeave={() => setOnRoute(false)}
              />
            </>
          )}

          {[...L.nodes.values()].map((n) => {
            const claimers = claimsByFile.get(n.id) ?? [];
            const onShot = shot?.ids.has(n.id);
            const hop = blast.get(n.id);
            const isSel = selected === n.id;
            const isHover = hover === n.id;
            const batch = batchOf?.get(n.id);
            const fh = focus?.get(n.id);
            const dimmed = (selected && !isSel && hop === undefined && !onShot) || (focus && fh === undefined && !onShot);
            const isGhost = ghost?.file === n.id;
            const showLabel = isSel || isHover || onShot || claimers.length > 0 || hop !== undefined || fh !== undefined || batch !== undefined;
            return (
              <g
                key={n.id}
                data-node
                tabIndex={0}
                role="button"
                aria-label={`${n.id}${claimers.length ? `, claimed by Agent ${claimers.join(", ")}` : ""}`}
                aria-pressed={isSel}
                // Focus reuses the hover visual (bigger node, label, card) as its indicator.
                className="cursor-pointer focus-visible:outline-none"
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(n.id)}
                onBlur={() => setHover(null)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  onSelect(isSel ? null : n.id);
                }}
                onClick={() => onSelect(isSel ? null : n.id)}
                style={{ opacity: dimmed ? 0.22 : 1, transition: "opacity .35s" }}
              >
                <motion.g
                  initial={reduce ? false : { opacity: 0, scale: 0.3 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 30, delay: enter(n) }}
                  style={{ originX: `${n.x}px`, originY: `${n.y}px` }}
                >
                <circle cx={n.x} cy={n.y} r={coarse ? 15 : 12} fill="transparent" />
                <AnimatePresence>
                {batch !== undefined && (
                  <motion.g key="batch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
                    <circle cx={n.x} cy={n.y} r={10} fill="var(--fg)" fillOpacity={0.36 - (batch % 4) * 0.08} />
                    <rect x={n.x - 40} y={n.y - 7} width={24} height={14} rx={7} fill="var(--surface)" stroke="var(--fg)" strokeOpacity={0.35 - (batch % 4) * 0.06} />
                    <text x={n.x - 28} y={n.y + 3} textAnchor="middle" className="fill-[var(--fg)] font-mono text-[9px] font-semibold">
                      G{batch + 1}
                    </text>
                  </motion.g>
                )}
                </AnimatePresence>
                <motion.circle
                  cx={n.x}
                  cy={n.y}
                  initial={false}
                  animate={{ r: onShot ? 6 : isSel ? 5.5 : isHover ? 5 : n.hub ? 4.5 : 3.25 }}
                  transition={{ type: "spring", stiffness: 420, damping: 35 }}
                  fill={onShot ? "var(--color-signal)" : "var(--fg)"}
                  fillOpacity={onShot || isSel || isHover ? 1 : hop ? 1 - hop * 0.2 : fh !== undefined ? 1 - fh * 0.2 : n.hub ? 0.6 : 0.45}
                />
                <AnimatePresence>
                  {claimers.length > 0 && (
                    <motion.g
                      initial={{ opacity: 0, scale: 1.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      style={{ originX: `${n.x}px`, originY: `${n.y}px` }}
                      transition={{ type: "spring", stiffness: 380, damping: 33 }}
                    >
                      <circle cx={n.x} cy={n.y} r={11} fill="none" stroke={onShot ? "var(--color-signal)" : "var(--fg)"} strokeWidth={1.5} />
                      <rect x={n.x - 22} y={n.y - 26} width={20} height={14} rx={7} fill="var(--fg)" />
                      <text x={n.x - 12} y={n.y - 16} textAnchor="middle" className="fill-[var(--bg)] font-mono text-[9px] font-semibold">
                        {claimers[0].slice(0, 2)}
                      </text>
                    </motion.g>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {isGhost && ghost && (
                    <motion.g
                      key={`ghost-${ghost.agent}`}
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.4 }}
                      style={{ originX: `${n.x}px`, originY: `${n.y}px` }}
                      transition={{ type: "spring", stiffness: 300, damping: 29, delay: reduce ? 0 : 0.2 }}
                    >
                      <circle cx={n.x} cy={n.y} r={15} fill="none" stroke="var(--color-signal)" strokeWidth={1.5} strokeDasharray="3 3" />
                      <rect x={n.x - 24} y={n.y - 30} width={20} height={14} rx={7} fill="var(--bg)" stroke="var(--color-signal)" strokeWidth={1.2} />
                      <text x={n.x - 14} y={n.y - 20} textAnchor="middle" className="fill-[var(--color-signal)] font-mono text-[9px] font-semibold">
                        {ghost.agent.slice(0, 2)}
                      </text>
                    </motion.g>
                  )}
                </AnimatePresence>
                {showLabel && (
                  <text
                    x={n.x + (onShot ? 10 : 12)}
                    y={onShot ? n.y - 12 : n.y + 4}
                    className={`font-mono text-[11px] ${onShot || isSel || isHover ? "fill-[var(--fg)]" : "fill-[var(--muted)]"}`}
                    style={halo}
                  >
                    {n.name}
                    {hop ? <tspan className="fill-[var(--muted)]"> · {hop} hop{hop > 1 ? "s" : ""}</tspan> : null}
                  </text>
                )}
                </motion.g>
              </g>
            );
          })}

          {shot && !reduce && !shot.quiet && <motion.circle key={`p${shot.id}`} cx={packetX} cy={packetY} r={6} fill="var(--color-signal)" style={{ pointerEvents: "none" }} />}
          <AnimatePresence>
            {impact && (
              <motion.circle
                key={impact.id}
                cx={impact.x}
                cy={impact.y}
                r={80}
                fill="none"
                stroke="var(--color-signal)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                initial={{ scale: 0.1, opacity: 1 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{ duration: 0.8, ease: [0.2, 0.7, 0.3, 1] }}
                onAnimationComplete={() => setImpact(null)}
                style={{ pointerEvents: "none" }}
              />
            )}
          </AnimatePresence>
        </motion.g>
      </svg>

      {/* Hover card: what this file is, who holds it, how connected it is. Anchored to its node. */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key="node-card"
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.18, ease: EXPO }}
            className="pointer-events-none absolute z-10 w-60 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]/95 p-3 text-xs shadow-xl shadow-black/30 backdrop-blur"
            style={{ ...cardAt(hovered.x, hovered.y, 240, 86), transformOrigin: "left top" }}
          >
            <p className="truncate font-mono text-[12px] text-[var(--fg)]">{hovered.id}</p>
            <p className="mt-2 text-[var(--muted)]">
              imports {imports} · imported by {importers}
            </p>
            {hovered.hub && <p className="mt-1 text-[var(--muted)]">hub: conflict checks skip it</p>}
            <p className="mt-1 text-[var(--muted)]">
              {ghost?.file === hovered.id ? `refused to Agent ${ghost.agent}` : hoveredClaims.length ? `claimed by ${hoveredClaims.map((a) => `Agent ${a}`).join(", ")}` : "not claimed"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Route card: the conflict query behind the orange path. */}
      <AnimatePresence>
        {onRoute && shot && hit && !hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EXPO }}
            className="pointer-events-none absolute z-10 w-72 rounded-[var(--radius-panel)] border border-[var(--color-signal)]/40 bg-[var(--surface)]/95 p-3 text-xs shadow-xl shadow-black/30 backdrop-blur"
            style={{ left: 0, top: 0, x: rx, y: ry }}
          >
            <p className="font-mono text-[12px] text-[var(--fg)]">
              {hit.conflict.file} → {hit.conflict.claimed}
            </p>
            <p className="mt-1.5 text-[var(--muted)]">
              {hit.conflict.hops} hop{hit.conflict.hops === 1 ? "" : "s"} to Agent {hit.conflict.agent}'s claim
              {checkMs != null ? `, found in ${checkMs} ms` : ""}
            </p>
            {conflictCypher && (
              <pre className="mt-2 max-h-32 overflow-hidden whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--bg)] p-2 font-mono text-[9.5px] leading-[1.5] text-[var(--muted)]">
                {upstreamPart(conflictCypher)}
              </pre>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-4 right-4 z-10 flex gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)]/90 p-1 backdrop-blur">
        {[
          { label: "Zoom in", icon: <Plus size={14} />, on: () => zoomBy(1.25, undefined, undefined, true) },
          { label: "Zoom out", icon: <Minus size={14} />, on: () => zoomBy(0.8, undefined, undefined, true) },
          { label: "Fit graph", icon: <ArrowsOut size={14} />, on: fit },
        ].map((b) => (
          <button key={b.label} type="button" aria-label={b.label} onClick={b.on} className="touch-manipulation rounded-full p-2 text-[var(--muted)] transition-[color,background-color,transform] hover:bg-[var(--fg)]/[0.06] hover:text-[var(--fg)] active:scale-95 pointer-coarse:p-3">
            {b.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
