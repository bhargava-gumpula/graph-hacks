import raw from "../data/graph.json";

export interface LaidNode {
  id: string;
  name: string;
  folder: string;
  x: number;
  y: number;
  hub: boolean;
}
export interface LaidEdge {
  id: string;
  source: LaidNode;
  target: LaidNode;
  hub: boolean;
}

export const FOLDERS = ["ui", "api", "auth", "lib"] as const;
/** The real conflict from the demo repo: B wants LoginForm.tsx while A is editing crypto.ts. */
export const CONFLICT_PATH = ["ui/LoginForm.tsx", "api/login.ts", "auth/session.ts", "lib/crypto.ts"];

/** Lay the demo repo out in folder columns so an import chain reads left to right. */
export function layout(width: number, height: number, padX = 70, padY = 56) {
  const files = (raw.nodes as { id: string; hub?: boolean }[]).filter((n) => n.id.includes("/"));
  const colX = (i: number) => padX + (i * (width - padX * 2)) / (FOLDERS.length - 1);
  const nodes = new Map<string, LaidNode>();
  FOLDERS.forEach((folder, ci) => {
    const inCol = files.filter((f) => f.id.startsWith(folder + "/")).sort((a, b) => a.id.localeCompare(b.id));
    inCol.forEach((f, ri) => {
      const y = padY + ((ri + 0.5) * (height - padY * 2)) / inCol.length;
      nodes.set(f.id, { id: f.id, name: f.id.split("/")[1], folder, x: colX(ci), y, hub: !!f.hub });
    });
  });
  const edges: LaidEdge[] = [];
  for (const e of raw.edges as { source: string; target: string }[]) {
    const s = nodes.get(e.source);
    const t = nodes.get(e.target);
    if (s && t) edges.push({ id: `${s.id}>${t.id}`, source: s, target: t, hub: s.hub || t.hub });
  }
  return { nodes, edges, colX };
}

/** A soft horizontal S-curve between two nodes. */
export function curve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = Math.max(40, (b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}
