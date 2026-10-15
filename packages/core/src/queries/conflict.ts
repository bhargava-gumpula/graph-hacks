import type { SbGraph } from "../graph.js";

export type ConflictType = "SAME" | "UPSTREAM" | "DOWNSTREAM";

export interface Conflict {
  /** The file the requesting agent asked for. */
  file: string;
  /** SAME: they claimed this file. UPSTREAM: my file imports theirs. DOWNSTREAM: their file imports mine. */
  type: ConflictType;
  /** The other agent's claimed file. */
  claimed: string;
  /** File paths along the import chain, in import direction (importer first). */
  path: string[];
  hops: number;
  agent: string;
  taskId: string | null;
  intent: string | null;
}

export interface ConflictInput {
  agent: string;
  paths: string[];
  /** Epoch ms. Claims with `until <= now` are expired and ignored. */
  now?: number;
  /** Max import hops, 1..4. Default 3. */
  k?: number;
}

const MAX_K = 4;

/**
 * Q1 dependency conflict, the hero query. Three parts, one per conflict type:
 *  - SAME: another agent claims the very file I asked for (hop 0, hubs included).
 *  - UPSTREAM: my file imports, within k hops, a file another agent claims.
 *  - DOWNSTREAM: a file another agent claims imports my file within k hops.
 * Multi-hop paths that touch a hub (e.g. lib/utils.ts, imported by everything) are
 * skipped, or every claim would conflict with every other.
 *
 * Why not shortestPath(): FalkorDB only allows it in WITH/RETURN and it can't carry
 * the hub filter. With k <= 4 on a code graph, enumerating the paths is cheap; the
 * TS caller keeps the shortest one per (file, agent).
 * `k` is inlined because Cypher can't take a parameter as a variable-length bound;
 * it is validated to be an integer 1..4 first.
 */
export function conflictQuery(k: number): string {
  if (!Number.isInteger(k) || k < 1 || k > MAX_K) throw new Error(`k must be an integer 1..${MAX_K}, got ${k}`);
  return `
UNWIND $paths AS want
MATCH (f:File {path: want})<-[c:CLAIMS]-(o:Agent)
WHERE o.id <> $agent AND c.until > $now
RETURN want AS file, 'SAME' AS type, f.path AS claimed, [f.path] AS path, 0 AS hops,
       o.id AS agent, c.taskId AS taskId, c.intent AS intent
UNION ALL
UNWIND $paths AS want
MATCH p = (f:File {path: want})-[:IMPORTS*1..${k}]->(g:File), (g)<-[c:CLAIMS]-(o:Agent)
WHERE o.id <> $agent AND c.until > $now AND none(n IN nodes(p) WHERE n.hub)
RETURN want AS file, 'UPSTREAM' AS type, g.path AS claimed, [n IN nodes(p) | n.path] AS path, length(p) AS hops,
       o.id AS agent, c.taskId AS taskId, c.intent AS intent
UNION ALL
UNWIND $paths AS want
MATCH p = (g:File)-[:IMPORTS*1..${k}]->(f:File {path: want}), (g)<-[c:CLAIMS]-(o:Agent)
WHERE o.id <> $agent AND c.until > $now AND none(n IN nodes(p) WHERE n.hub)
RETURN want AS file, 'DOWNSTREAM' AS type, g.path AS claimed, [n IN nodes(p) | n.path] AS path, length(p) AS hops,
       o.id AS agent, c.taskId AS taskId, c.intent AS intent
`;
}

/** Conflicts for a claim request; empty means the claim is safe. Shortest path per (file, agent). */
export async function findConflicts(g: SbGraph, input: ConflictInput): Promise<Conflict[]> {
  const rows = (await g.roQuery(conflictQuery(input.k ?? 3), {
    agent: input.agent,
    paths: input.paths,
    now: input.now ?? Date.now(),
  })) as unknown as Conflict[];

  const best = new Map<string, Conflict>();
  for (const row of rows) {
    const key = `${row.file}\0${row.agent}`;
    const prev = best.get(key);
    if (!prev || row.hops < prev.hops) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => a.hops - b.hops || a.file.localeCompare(b.file));
}
