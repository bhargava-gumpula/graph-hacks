import { useEffect, useRef, useState } from "react";
import type { GraphNode, GraphSnapshot } from "./types.js";

const DIR_COLOR: Record<string, string> = {
  ui: "#9ec1ff",
  api: "#d7c4ff",
  auth: "#f5c451",
  lib: "#8fd0c6",
};

type Dot = {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  color: string;
  size: number;
};

/** Even spread on a unit sphere, so the repo reads as one globe. */
function placeSphere(nodes: GraphNode[]): Dot[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const n = Math.max(nodes.length, 1);
  return nodes.map((node, i) => {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const dir = node.id.includes("/") ? node.id.slice(0, node.id.indexOf("/")) : "";
    const claimed = (node.claimedBy?.length ?? 0) > 0;
    return {
      id: node.id,
      label: node.label,
      x: Math.cos(theta) * ring,
      y,
      z: Math.sin(theta) * ring,
      color: node.hub ? "#f5c451" : claimed ? "#7dcea0" : node.kind === "agent" ? "#f0a39a" : (DIR_COLOR[dir] ?? "#9ec1ff"),
      size: node.kind === "agent" ? 5 : node.hub ? 4.5 : 3,
    };
  });
}

function short(id: string): string {
  const slash = id.lastIndexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

export function GraphCanvas({
  data,
  hotPath,
  onSelect,
  quiet = false,
}: {
  data: GraphSnapshot | null;
  hotPath: string[];
  onSelect?: (id: string) => void;
  quiet?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hot = useRef(hotPath);
  const pick = useRef(onSelect);
  const hover = useRef<string | null>(null);
  const [word, setWord] = useState("drag the globe");
  hot.current = hotPath;
  pick.current = onSelect;

  useEffect(() => {
    const el = canvas.current;
    if (!el || !data) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const files = data.nodes.filter((n) => n.kind === "file");
    const agents = data.nodes.filter((n) => n.kind === "agent");
    const dots = placeSphere([...files, ...agents]);
    const byId = new Map(dots.map((d) => [d.id, d]));
    const near = new Map<string, Set<string>>();
    for (const edge of data.edges) {
      if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
      if (edge.kind !== "IMPORTS") continue;
      const left = near.get(edge.source) ?? new Set<string>();
      const right = near.get(edge.target) ?? new Set<string>();
      left.add(edge.target);
      right.add(edge.source);
      near.set(edge.source, left);
      near.set(edge.target, right);
    }

    let yaw = 0.4;
    let pitch = 0.15;
    let dragging = false;
    let dragged = false;
    let lastX = 0;
    let lastY = 0;
    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const rect = el.parentElement?.getBoundingClientRect();
      const w = rect?.width ?? 600;
      const h = rect?.height ?? 600;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.floor(w * dpr);
      el.height = Math.floor(h * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (el.parentElement) observer.observe(el.parentElement);

    const project = (dot: Dot, w: number, h: number) => {
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const x1 = dot.x * cy - dot.z * sy;
      const z1 = dot.x * sy + dot.z * cy;
      const y2 = dot.y * cp - z1 * sp;
      const z2 = dot.y * sp + z1 * cp;
      const depth = 2.6 / (2.6 + z2);
      const radius = Math.min(w, h) * 0.36;
      return {
        sx: w / 2 + x1 * depth * radius,
        sy: h * 0.44 + y2 * depth * radius,
        depth,
        z: z2,
      };
    };

    const draw = (now: number) => {
      if (!dragging && !reduce) yaw += 0.0045;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = el.width / dpr;
      const h = el.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(232,234,237,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.44, Math.min(w, h) * 0.36, 0, Math.PI * 2);
      ctx.stroke();
      const focus = hover.current;
      const path = hot.current;
      const around = new Set<string>(focus ? [focus, ...(near.get(focus) ?? [])] : []);
      const shown = dots
        .map((dot) => ({ dot, at: project(dot, w, h) }))
        .sort((a, b) => b.at.z - a.at.z);

      const line = (a: string, b: string, color: string, width: number, travel: boolean) => {
        const da = byId.get(a);
        const db = byId.get(b);
        if (!da || !db) return;
        const pa = project(da, w, h);
        const pb = project(db, w, h);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
        if (!travel) return;
        const u = (now / 700) % 1;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(pa.sx + (pb.sx - pa.sx) * u, pa.sy + (pb.sy - pa.sy) * u, 2.4, 0, Math.PI * 2);
        ctx.fill();
      };

      if (path.length >= 2) {
        for (let i = 0; i < path.length - 1; i++) line(path[i]!, path[i + 1]!, "#ff5a4f", 1.6, true);
      }
      if (focus) {
        for (const other of near.get(focus) ?? []) line(focus, other, "#f4e7a1", 1.1, true);
      }

      for (const { dot, at } of shown) {
        const onPath = path.includes(dot.id);
        const lit = !focus || around.has(dot.id) || onPath;
        const back = at.z < -0.15 && !lit;
        ctx.globalAlpha = back ? 0.18 : lit ? 1 : 0.28;
        ctx.fillStyle = onPath ? "#ff5a4f" : dot.color;
        const pulse = onPath ? 1 + 0.25 * Math.sin(now / 180) : 1;
        const r = (onPath ? 11 : dot.size + 5) * (0.65 + 0.45 * at.depth) * pulse * (focus === dot.id ? 1.7 : 1);
        ctx.beginPath();
        ctx.arc(at.sx, at.sy, Math.max(1.2, r), 0, Math.PI * 2);
        ctx.fill();
        if ((lit && at.z > 0) || onPath || focus === dot.id) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = "#e8eaed";
          ctx.font = "12px Avenir Next, sans-serif";
          ctx.fillText(dot.label, at.sx + r + 4, at.sy + 4);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const hit = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let best: { id: string; d: number } | null = null;
      for (const dot of dots) {
        const at = project(dot, rect.width, rect.height);
        if (at.z > 0.05) continue;
        const d = Math.hypot(at.sx - x, at.sy - y);
        if (d < 22 && (!best || d < best.d)) best = { id: dot.id, d };
      }
      return best?.id ?? null;
    };

    const onMove = (event: PointerEvent) => {
      if (dragging) {
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        if (Math.hypot(dx, dy) > 3) dragged = true;
        yaw += dx * 0.008;
        pitch = Math.max(-1, Math.min(1, pitch + dy * 0.008));
        lastX = event.clientX;
        lastY = event.clientY;
        return;
      }
      const id = hit(event.clientX, event.clientY);
      if (id === hover.current) return;
      hover.current = id;
      setWord(id ? short(id) : "drag the globe");
      const box = el.parentElement?.querySelector(".hovercard") as HTMLDivElement | null;
      if (!box) return;
      if (!id) {
        box.style.display = "none";
        return;
      }
      const row = near.get(id) ?? new Set<string>();
      const lines = [short(id)];
      const outs = data.edges.filter((e) => e.kind === "IMPORTS" && e.source === id).map((e) => short(e.target));
      const inns = data.edges.filter((e) => e.kind === "IMPORTS" && e.target === id).map((e) => short(e.source));
      if (outs.length) lines.push("imports " + outs.join(", "));
      if (inns.length) lines.push("imported by " + inns.join(", "));
      if (!outs.length && !inns.length) lines.push(row.size ? "linked" : "no import links");
      box.textContent = lines.join("\n");
      box.style.display = "block";
      const rect = el.getBoundingClientRect();
      box.style.left = `${event.clientX - rect.left + 12}px`;
      box.style.top = `${event.clientY - rect.top + 12}px`;
    };
    const onDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      el.setPointerCapture(event.pointerId);
    };
    const onUp = () => {
      dragging = false;
    };
    const onClick = (event: MouseEvent) => {
      if (dragged) {
        dragged = false;
        return;
      }
      const id = hit(event.clientX, event.clientY);
      if (id && !id.startsWith("agent:")) pick.current?.(id);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("click", onClick);
    };
  }, [data]);

  return (
    <div className="canvas-wrap">
      <canvas ref={canvas} className="canvas" />
      {quiet ? null : <p className="globe-word">{word}</p>}
      <div className="hovercard" />
    </div>
  );
}
