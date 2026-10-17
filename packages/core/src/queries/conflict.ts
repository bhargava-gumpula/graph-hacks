import type { SbGraph } from "../graph.js";
import { normPath } from "../paths.js";

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
  /** Epoch ms when the blocking claim expires (the hook says "free in N min"). */
  until?: number;
  /** True when the requested or the claimed file is a hub; absent otherwise. */
  hub?: boolean;
}

export interface ConflictInput {
  agent: string;
  paths: string[];
  /** Epoch ms. Claims with `until <= now` are expired and ignored. */
  now?: number;
  /** Max import hops, 1..5. Default 3; SB_HOPS overrides it (see `hops`). */
  k?: number;
}

/** Longest import chain any check follows. */
export const MAX_HOPS = 5;

/**
 * The import-hop limit for the conflict check, the blast radius and interference.
 * SB_HOPS, when set, is the operator's choice and wins over `k` for every check, so
 * the claim guard, the hook and the "show the query" panels all follow it.
 * Otherwise `k`, default 3. Valid 1..5; anything else throws.
 */
export function hops(k = 3): number {
  const env = process.env.SB_HOPS?.trim();
  const n = env ? Number(env) : k;
  if (!Number.isInteger(n) || n < 1 || n > MAX_HOPS) {
    throw new Error(`${env ? "SB_HOPS" : "k"} must be an integer 1..${MAX_HOPS}, got ${env || k}`);
  }
  return n;
}

/**
 * The filter every multi-hop import path goes through, for path variable `p`:
 *  - no hub strictly inside it. The ends may be hubs: claiming lib/utils.ts conflicts
 *    with its importers, but two files that only share utils.ts never conflict
 *    through it. `[1..-1]` drops the first and last node;
 *  - no type-only edge (`import type`), unless SB_TYPE_IMPORTS=1. A type-only import
 *    is erased at runtime and usually names a stable interface, so counting it mostly
 *    adds false blocks. Edges without the property (hand-made fixtures) count.
 */
export function pathFilter(p: string): string {
  const hub = `none(n IN nodes(${p})[1..-1] WHERE coalesce(n.hub, false))`;
  if (process.env.SB_TYPE_IMPORTS === "1") return hub;
  return `${hub} AND none(r IN relationships(${p}) WHERE coalesce(r.typeOnly, false))`;
}

/** Another agent's claim that has not expired. `c` is the CLAIMS edge, `o` its agent. */
const ACTIVE_OTHER = `o.id <> $agent AND c.until > $now`;
/** Either end is a hub. */
const HUB_END = `coalesce(f.hub, false) OR coalesce(g.hub, false) AS hub`;

/** `want` is the requested path; `g` the claimed file; `p` the import chain, importer first. */
const SAME = `(f:File {path: want})<-[c:CLAIMS]-(o:Agent)`;
const upstream = (k: number) => `p = (f:File {path: want})-[:IMPORTS*1..${k}]->(g:File), (g)<-[c:CLAIMS]-(o:Agent)`;
const downstream = (k: number) => `p = (g:File)-[:IMPORTS*1..${k}]->(f:File {path: want}), (g)<-[c:CLAIMS]-(o:Agent)`;

/**
 * Q1 dependency conflict, the hero query. Three parts, one per conflict type:
 *  - SAME: another agent claims the very file I asked for (hop 0, hubs included).
 *  - UPSTREAM: my file imports, within k hops, a file another agent claims.
 *  - DOWNSTREAM: a file another agent claims imports my file within k hops.
 * Paths that pass THROUGH a hub (e.g. lib/utils.ts, imported by everything) are
 * skipped, or every claim would conflict with every other; a hub at either end counts.
 *
 * Why not shortestPath(): FalkorDB only allows it in WITH/RETURN and it can't carry
 * the hub filter. With k <= 5 on a code graph, enumerating the paths is cheap; the
 * TS caller keeps the shortest one per (file, agent).
 * `k` is inlined because Cypher can't take a parameter as a variable-length bound;
 * `hops(k)` validates it (1..5) and applies SB_HOPS.
 */
export function conflictQuery(k: number): string {
  k = hops(k);
  const PATH_OK = pathFilter("p");
  return `
UNWIND $paths AS want
MATCH ${SAME}
WHERE ${ACTIVE_OTHER}
RETURN want AS file, 'SAME' AS type, f.path AS claimed, [f.path] AS path, 0 AS hops,
       o.id AS agent, c.taskId AS taskId, c.intent AS intent, c.until AS until, coalesce(f.hub, false) AS hub
UNION ALL
UNWIND $paths AS want
MATCH ${upstream(k)}
WHERE ${ACTIVE_OTHER} AND ${PATH_OK}
RETURN want AS file, 'UPSTREAM' AS type, g.path AS claimed, [n IN nodes(p) | n.path] AS path, length(p) AS hops,
       o.id AS agent, c.taskId AS taskId, c.intent AS intent, c.until AS until, ${HUB_END}
UNION ALL
UNWIND $paths AS want
MATCH ${downstream(k)}
WHERE ${ACTIVE_OTHER} AND ${PATH_OK}
RETURN want AS file, 'DOWNSTREAM' AS type, g.path AS claimed, [n IN nodes(p) | n.path] AS path, length(p) AS hops,
       o.id AS agent, c.taskId AS taskId, c.intent AS intent, c.until AS until, ${HUB_END}
`;
}

/**
 * The same three checks as `conflictQuery`, as a prefix for a write query: it
 * yields one row when nothing conflicts and no rows otherwise, so whatever
 * follows it only runs when the claim is free. Used by `claim()` to check and
 * write in one query (see claims.ts). Needs a non-empty `$paths`: on an empty
 * list the sum is 0 and the guard passes.
 *
 * Each count gets its own WITH, and the filter too: in FalkorDB `same + count(c)`
 * in one projection came back null, which let every claim through.
 */
export function conflictGuard(k: number): string {
  k = hops(k);
  const PATH_OK = pathFilter("p");
  return `
UNWIND $paths AS want
OPTIONAL MATCH ${SAME}
WHERE ${ACTIVE_OTHER}
WITH want, count(c) AS same
OPTIONAL MATCH ${upstream(k)}
WHERE ${ACTIVE_OTHER} AND ${PATH_OK}
WITH want, same, count(c) AS up
OPTIONAL MATCH ${downstream(k)}
WHERE ${ACTIVE_OTHER} AND ${PATH_OK}
WITH want, same, up, count(c) AS down
WITH sum(same + up + down) AS blocked
WITH blocked WHERE blocked = 0
`;
}

/** Conflicts for a claim request; empty means the claim is safe. Shortest path per (file, agent). */
export async function findConflicts(g: SbGraph, input: ConflictInput): Promise<Conflict[]> {
  const rows = (await g.roQuery(conflictQuery(hops(input.k)), {
    agent: input.agent,
    paths: [...new Set(input.paths.map(normPath))],
    now: input.now ?? Date.now(),
  })) as unknown as Conflict[];

  const best = new Map<string, Conflict>();
  for (const { hub, ...rest } of rows) {
    const row: Conflict = hub ? { ...rest, hub: true } : rest;
    const key = `${row.file}\0${row.agent}`;
    const prev = best.get(key);
    if (!prev || row.hops < prev.hops) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => a.hops - b.hops || a.file.localeCompare(b.file));
}
