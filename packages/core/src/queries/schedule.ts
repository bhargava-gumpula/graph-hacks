import type { SbGraph } from "../graph.js";
import { hops, pathFilter } from "./conflict.js";

export const SET_TASK_STATUS = `
MATCH (t:Task {id: $id})
SET t.status = $status
`;

/** Open a task (or keep its status) and add files to its planned footprint. Unknown paths are skipped. */
export const TOUCH_FILES = `
MERGE (t:Task {id: $id})
ON CREATE SET t.status = 'open', t.createdAt = $at
SET t.title = coalesce($title, t.title, $id)
WITH t
UNWIND $paths AS path
MATCH (f:File {path: path})
MERGE (t)-[:TOUCHES]->(f)
`;

/**
 * Every unfinished task's footprint: files it plans to touch (TOUCHES) plus files
 * an agent holds an active claim on under that task. Tasks with no files are left out.
 */
export const TASK_FOOTPRINTS = `
MATCH (t:Task)
WHERE coalesce(t.status, 'open') <> 'done'
WITH t,
     [(t)-[:TOUCHES]->(f:File) | f.path] +
     [(:Agent)-[c:CLAIMS]->(f:File) WHERE c.taskId = t.id AND c.until > $now | f.path] AS paths
WHERE size(paths) > 0
UNWIND paths AS path
WITH t, path ORDER BY path
RETURN t.id AS id, collect(DISTINCT path) AS paths
ORDER BY id
`;

/**
 * Q3 step 1. Two tasks interfere when a file of one is the same file as, or within
 * k import hops of, a file of the other. Same rule as the Q1 claim check, so two
 * tasks in one round can never get a CONFLICT from each other:
 *  - same file: always, even a hub (hop 0);
 *  - otherwise a directed IMPORTS path either way that passes Q1's `pathFilter`:
 *    no hub inside it (a hub at either end counts), no type-only edge by default.
 * Returns one row per interfering pair: the closest connecting file and its hops.
 * `k` is inlined because Cypher can't take a parameter as a variable-length bound;
 * `hops(k)` validates it (1..5) and applies SB_HOPS.
 */
export function interfereQuery(k: number): string {
  k = hops(k);
  return `
UNWIND $tasks AS a
UNWIND $tasks AS b
WITH a, b WHERE a.id < b.id
UNWIND a.paths AS p1
UNWIND b.paths AS p2
MATCH (f1:File {path: p1}), (f2:File {path: p2})
OPTIONAL MATCH up = (f1)-[:IMPORTS*1..${k}]->(f2)
WHERE ${pathFilter("up")}
OPTIONAL MATCH down = (f2)-[:IMPORTS*1..${k}]->(f1)
WHERE ${pathFilter("down")}
WITH a, b, f1, f2, min(length(up)) AS u, min(length(down)) AS d
WITH a, b, f1.path AS via,
     CASE WHEN f1 = f2 THEN 0 WHEN u IS NULL THEN d WHEN d IS NULL THEN u WHEN u < d THEN u ELSE d END AS hops
WHERE hops IS NOT NULL
WITH a, b, hops, via ORDER BY hops, via
WITH a.id AS a, b.id AS b, collect({hops: hops, via: via})[0] AS best
RETURN a, b, best.via AS via, best.hops AS hops
ORDER BY a, b
`;
}

/**
 * Kept for the server's "show the query" panel, which imports this name: the rounds
 * path runs TASK_FOOTPRINTS, then `interfereQuery`, and colours the result.
 * algo.WCC is gone from this path: it needs stored INTERFERES edges, and reading
 * the schedule must not write.
 * @deprecated use TASK_FOOTPRINTS and interfereQuery.
 */
export const WCC_BATCHES = TASK_FOOTPRINTS;

export interface Batch {
  /** The round: 0 runs first. Tasks in one round can run at the same time. */
  componentId: number;
  tasks: string[];
  /** The round's files: the union of its tasks' footprints (planned and claimed), sorted. */
  paths: string[];
}

/** Open a task and attach the files it plans to touch, in one query. */
export async function planTask(
  g: SbGraph,
  input: { id: string; title?: string; paths: string[]; now?: number },
): Promise<void> {
  await g.query(TOUCH_FILES, {
    id: input.id,
    title: input.title ?? null,
    paths: input.paths,
    at: input.now ?? Date.now(),
  });
}

/**
 * Greedy graph colouring. Tasks go highest degree first (ties by id); each takes the
 * lowest round that none of its interfering tasks holds. Colouring the whole graph
 * gives the same rounds as colouring each connected component on its own, so no
 * separate component split is needed. On the chain A-B-C, B goes first and A and C
 * share the next round, where one component per batch would run all three in turn.
 * ponytail: greedy, not optimal; exact colouring is NP-hard and task counts are small.
 */
export function colourRounds(ids: string[], edges: { a: string; b: string }[]): string[][] {
  const near = new Map(ids.map((id) => [id, new Set<string>()]));
  for (const { a, b } of edges) {
    near.get(a)?.add(b);
    near.get(b)?.add(a);
  }
  // Ties by plain code-unit order, the same order `.sort()` gives inside a round, so no locale can change a schedule.
  const order = [...ids].sort((x, y) => near.get(y)!.size - near.get(x)!.size || (x < y ? -1 : x > y ? 1 : 0));
  const round = new Map<string, number>();
  for (const id of order) {
    const taken = new Set([...near.get(id)!].map((n) => round.get(n)));
    let r = 0;
    while (taken.has(r)) r++;
    round.set(id, r);
  }
  const rounds: string[][] = [];
  for (const id of order) (rounds[round.get(id)!] ??= []).push(id);
  return rounds.map((tasks) => tasks.sort());
}

/**
 * Q3. Split unfinished tasks into rounds: tasks in one round touch unrelated code
 * and can run at the same time; round 0 first. Read-only: interference is computed
 * by a read query each time (fresh claims and expiry included), never stored.
 */
export async function parallelBatches(g: SbGraph, k?: number, now = Date.now()): Promise<Batch[]> {
  const tasks = (await g.roQuery(TASK_FOOTPRINTS, { now })).map((row) => ({
    id: String(row.id),
    paths: (row.paths as unknown[]).map(String),
  }));
  if (tasks.length === 0) return [];
  const edges = (await g.roQuery(interfereQuery(hops(k)), { tasks })).map((row) => ({ a: String(row.a), b: String(row.b) }));
  const footprint = new Map(tasks.map((t) => [t.id, t.paths]));
  return colourRounds(
    tasks.map((t) => t.id),
    edges,
  ).map((ids, i) => ({
    componentId: i,
    tasks: ids,
    paths: [...new Set(ids.flatMap((id) => footprint.get(id) ?? []))].sort(),
  }));
}
