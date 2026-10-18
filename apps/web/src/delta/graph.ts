import traced from "./traced.json";

/** The demo repo's real import graph, traced onto the river channels of delta.jpg by scripts/trace-delta.mjs. Units are photo pixels. */
export const PW = traced.w;
export const PH = traced.h;
export type Pt = [number, number];
export type FileNode = { id: string; label: string; hub: boolean; x: number; y: number };
export type Edge = { s: string; t: string; pts: Pt[] };

export const nodes: FileNode[] = traced.nodes;
export const edges: Edge[] = traced.edges as Edge[];
export const byId = new Map(nodes.map((n) => [n.id, n]));

export const CLAIMED = "auth/session.ts"; // Agent A's claim (bench/results.json)
export const ROUTE = ["ui/LoginForm.tsx", "api/login.ts", "auth/session.ts"];
export const edgeOf = (s: string, t: string) => edges.find((e) => e.s === s && e.t === t)!;
export const onRoute = (e: Edge) => ROUTE.indexOf(e.t) === ROUTE.indexOf(e.s) + 1 && ROUTE.includes(e.s);

const out = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
for (const e of edges) out.get(e.s)!.push(e.t);
const hub = new Set(nodes.filter((n) => n.hub).map((n) => n.id));
const MAX_HOPS = 3;

/** Switchboard's rule on this graph: an import path of at most 3 hops, either direction, not through a hub. */
export function conflictPath(file: string, claimed = CLAIMED): string[] | null {
  if (file === claimed) return [file];
  const search = (start: string, goal: string) => {
    let frontier: string[][] = [[start]];
    for (let h = 0; h < MAX_HOPS; h++) {
      const next: string[][] = [];
      for (const p of frontier) {
        const last = p[p.length - 1]!;
        if (p.length > 1 && hub.has(last)) continue;
        for (const t of out.get(last)!) {
          if (p.includes(t)) continue;
          if (t === goal) return [...p, t];
          next.push([...p, t]);
        }
      }
      frontier = next;
    }
    return null;
  };
  return search(file, claimed) ?? search(claimed, file);
}

/** A point and heading along a polyline, t in [0, 1]. */
export function along(pts: Pt[], t: number): [number, number, number] {
  const f = Math.min(Math.max(t, 0), 1) * (pts.length - 1);
  const i = Math.min(Math.floor(f), pts.length - 2);
  const a = pts[i]!;
  const b = pts[i + 1]!;
  const k = f - i;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[1] - a[1], b[0] - a[0])];
}

export const pathD = (pts: Pt[]) => "M" + pts.map(([x, y]) => `${x},${y}`).join("L");
