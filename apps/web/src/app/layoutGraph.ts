import type { Snapshot } from "./api";

export interface PNode {
  id: string;
  name: string;
  folder: string;
  x: number;
  y: number;
  hub: boolean;
}
export interface PEdge {
  id: string;
  s: PNode;
  t: PNode;
  hub: boolean;
}

/**
 * Lay any repo out as folder columns, ordered so imports flow left to right.
 * A file's height is its longest import chain; folders with taller files sit further left.
 */
export function layoutGraph(snap: Snapshot, colGap = 210, rowGap = 26, pad = 60) {
  const files = snap.nodes.filter((n) => n.kind === "file");
  const imports = snap.edges.filter((e) => e.kind === "IMPORTS");
  const out = new Map<string, string[]>();
  for (const e of imports) out.set(e.source, [...(out.get(e.source) ?? []), e.target]);

  const height = new Map<string, number>();
  const visiting = new Set<string>();
  const h = (id: string): number => {
    if (height.has(id)) return height.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const v = Math.max(-1, ...(out.get(id) ?? []).map(h)) + 1;
    visiting.delete(id);
    height.set(id, v);
    return v;
  };
  files.forEach((f) => h(f.id));

  const folderOf = (id: string) => (id.includes("/") ? id.split("/").slice(0, -1).join("/") : ".");
  const byFolder = new Map<string, typeof files>();
  for (const f of files) byFolder.set(folderOf(f.id), [...(byFolder.get(folderOf(f.id)) ?? []), f]);
  const score = (fs: typeof files) => fs.reduce((s, f) => s + (height.get(f.id) ?? 0), 0) / fs.length;
  const folders = [...byFolder.keys()].sort((a, b) => score(byFolder.get(b)!) - score(byFolder.get(a)!) || a.localeCompare(b));

  const tallest = Math.max(1, ...[...byFolder.values()].map((fs) => fs.length));
  const width = pad * 2 + (folders.length - 1) * colGap;
  const totalH = pad * 2 + tallest * rowGap;
  const nodes = new Map<string, PNode>();
  folders.forEach((folder, ci) => {
    const fs = byFolder.get(folder)!.sort((a, b) => a.id.localeCompare(b.id));
    const offset = ((tallest - fs.length) * rowGap) / 2;
    fs.forEach((f, ri) => {
      nodes.set(f.id, {
        id: f.id,
        name: f.id.split("/").pop()!,
        folder,
        x: pad + ci * colGap,
        y: pad + offset + (ri + 0.5) * rowGap,
        hub: !!f.hub,
      });
    });
  });
  const edges: PEdge[] = [];
  for (const e of imports) {
    const s = nodes.get(e.source);
    const t = nodes.get(e.target);
    if (s && t) edges.push({ id: `${s.id}>${t.id}`, s, t, hub: s.hub || t.hub });
  }
  return { nodes, edges, folders, width, height: totalH, colX: (i: number) => pad + i * colGap };
}

export function curve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5) * Math.sign(b.x - a.x || 1);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}
