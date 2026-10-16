import type { SbGraph } from "../graph.js";

const MAX_K = 4;

export interface Dependent {
  path: string;
  hops: number;
  agents: string[];
}

export interface BlastRadius {
  path: string;
  dependents: Dependent[];
  /** How many dependents sit at each hop. */
  byHop: { hops: number; count: number }[];
}

/** Q2. Files that import `$path`, hop by hop. Hubs are not dependents. `k` is inlined. */
export function blastQuery(k: number): string {
  if (!Number.isInteger(k) || k < 1 || k > MAX_K) throw new Error(`k must be an integer 1..${MAX_K}`);
  return `
MATCH (f:File {path: $path})
MATCH p = (d:File)-[:IMPORTS*1..${k}]->(f)
WHERE NOT d.hub AND none(n IN nodes(p) WHERE n.hub AND n <> f)
WITH d, min(length(p)) AS hops
OPTIONAL MATCH (a:Agent)-[c:CLAIMS]->(d)
WHERE c.until > $now
RETURN d.path AS path, hops, collect(DISTINCT a.id) AS agents
ORDER BY hops, path
`;
}

/** Who would break if `$path` changed. Empty means provably nothing depends on it. */
export async function blastRadius(g: SbGraph, path: string, k = 3, now = Date.now()): Promise<BlastRadius> {
  const rows = await g.roQuery(blastQuery(k), { path, now });
  const dependents = rows.map((row) => ({
    path: String(row.path),
    hops: Number(row.hops),
    agents: Array.isArray(row.agents) ? row.agents.filter((id): id is string => typeof id === "string") : [],
  }));
  const counts = new Map<number, number>();
  for (const dep of dependents) counts.set(dep.hops, (counts.get(dep.hops) ?? 0) + 1);
  const byHop = [...counts.entries()]
    .map(([hops, count]) => ({ hops, count }))
    .sort((a, b) => a.hops - b.hops);
  return { path, dependents, byHop };
}
