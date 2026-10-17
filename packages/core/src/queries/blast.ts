import type { SbGraph } from "../graph.js";

const MAX_K = 4;

export interface Dependent {
  path: string;
  /** Fewest import hops from this file to the changed one. */
  hops: number;
  /** Agents holding an active claim on this dependent. */
  agents: string[];
}

export interface BlastRadius {
  path: string;
  /** False when the file is not in the graph, so "no dependents" is not claimed for it. */
  found: boolean;
  dependents: Dependent[];
  /** How many dependents sit at each hop. */
  byHop: { hops: number; count: number }[];
}

/** Is the file in the graph at all. */
export const FILE_EXISTS = `
MATCH (f:File {path: $path})
RETURN count(f) AS n
`;

/**
 * Q2. Files that import `$path` within k hops (reverse IMPORTS), nearest hop per file.
 * Paths through a hub are skipped and hubs are not listed as dependents; the changed
 * file itself may be a hub (its direct importers are still its blast radius).
 * `$now` is re-bound with WITH: FalkorDB drops a parameter used inside a pattern
 * comprehension that follows an aggregation (verified on falkordb:latest, Oct 2026).
 * `k` is inlined because Cypher can't take a parameter as a variable-length bound.
 */
export function blastQuery(k: number): string {
  if (!Number.isInteger(k) || k < 1 || k > MAX_K) throw new Error(`k must be an integer 1..${MAX_K}, got ${k}`);
  return `
MATCH p = (d:File)-[:IMPORTS*1..${k}]->(f:File {path: $path})
WHERE d <> f AND none(n IN nodes(p) WHERE coalesce(n.hub, false) AND n <> f)
WITH d, min(length(p)) AS hops, $now AS now
RETURN d.path AS path, hops, [(a:Agent)-[c:CLAIMS]->(d) WHERE c.until > now | a.id] AS agents
ORDER BY hops, path
`;
}

/**
 * Who would break if `path` changed. With `found: true`, an empty `dependents` is
 * the proof that nothing imports it within k hops: safe to change alone.
 */
export async function blastRadius(g: SbGraph, path: string, k = 3, now = Date.now()): Promise<BlastRadius> {
  const query = blastQuery(k);
  const [exists] = await g.roQuery(FILE_EXISTS, { path });
  if (Number(exists?.n ?? 0) === 0) return { path, found: false, dependents: [], byHop: [] };

  const rows = await g.roQuery(query, { path, now });
  const dependents = rows.map((row) => ({
    path: String(row.path),
    hops: Number(row.hops),
    agents: Array.isArray(row.agents) ? row.agents.filter((id): id is string => typeof id === "string").sort() : [],
  }));
  const counts = new Map<number, number>();
  for (const dep of dependents) counts.set(dep.hops, (counts.get(dep.hops) ?? 0) + 1);
  const byHop = [...counts].map(([hops, count]) => ({ hops, count })).sort((a, b) => a.hops - b.hops);
  return { path, found: true, dependents, byHop };
}
