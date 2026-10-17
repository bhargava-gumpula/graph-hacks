import type { SbGraph } from "../graph.js";

const MAX_K = 4;

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

/** Drop the previous interference edges so each pass starts clean. */
export const CLEAR_INTERFERES = `
MATCH (:Task)-[r:INTERFERES]->(:Task)
DELETE r
`;

/**
 * Q3 step 1. Two tasks interfere when a file of one is the same file as, or within
 * k import hops of, a file of the other. Same rule as the Q1 claim check, so two
 * tasks in different batches can never get a CONFLICT from each other:
 *  - same file: always, even a hub (hop 0);
 *  - otherwise a directed IMPORTS path either way that does not pass through a hub
 *    (a hub at either end counts).
 * Returns one row per interfering pair: the closest connecting file and its hops.
 * `k` is inlined because Cypher can't take a parameter as a variable-length bound.
 */
export function interfereQuery(k: number): string {
  if (!Number.isInteger(k) || k < 1 || k > MAX_K) throw new Error(`k must be an integer 1..${MAX_K}, got ${k}`);
  return `
UNWIND $tasks AS a
UNWIND $tasks AS b
WITH a, b WHERE a.id < b.id
UNWIND a.paths AS p1
UNWIND b.paths AS p2
MATCH (f1:File {path: p1}), (f2:File {path: p2})
OPTIONAL MATCH up = (f1)-[:IMPORTS*1..${k}]->(f2)
WHERE none(n IN nodes(up)[1..-1] WHERE coalesce(n.hub, false))
OPTIONAL MATCH down = (f2)-[:IMPORTS*1..${k}]->(f1)
WHERE none(n IN nodes(down)[1..-1] WHERE coalesce(n.hub, false))
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
 * Q3 step 1, write half. Kept apart from the read because FalkorDB returns no rows
 * when this two-node MATCH follows the aggregation above (falkordb:latest, Oct 2026).
 */
export const WRITE_INTERFERES = `
UNWIND $edges AS e
MATCH (t1:Task {id: e.a}), (t2:Task {id: e.b})
CREATE (t1)-[:INTERFERES {via: e.via, hops: e.hops}]->(t2)
`;

/**
 * Q3 step 2. Weakly connected components over INTERFERES. Tasks in one component
 * must run one after another (or go to one agent); different components can run
 * at the same time. A task with no INTERFERES edge is its own component.
 */
export const WCC_BATCHES = `
CALL algo.WCC({nodeLabels: ['Task'], relationshipTypes: ['INTERFERES']}) YIELD node, componentId
WITH node, componentId WHERE node.id IN $ids
RETURN componentId, collect(node.id) AS tasks
ORDER BY componentId
`;

export interface Batch {
  componentId: number;
  tasks: string[];
  /** The batch's files: the union of its tasks' footprints (planned and claimed), sorted. */
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
 * Rebuild INTERFERES from the code graph, then split unfinished tasks into batches
 * with WCC. Batches are ordered by their smallest task id; tasks inside are sorted.
 * The clear and rebuild are separate writes, so two schedulers running at once can
 * briefly see each other's half-built edges; each call ends with a full rebuild.
 */
export async function parallelBatches(g: SbGraph, k = 3, now = Date.now()): Promise<Batch[]> {
  const interfere = interfereQuery(k);
  const tasks = (await g.roQuery(TASK_FOOTPRINTS, { now })).map((row) => ({
    id: String(row.id),
    paths: (row.paths as unknown[]).map(String),
  }));
  await g.query(CLEAR_INTERFERES);
  if (tasks.length === 0) return [];
  const edges = await g.roQuery(interfere, { tasks });
  if (edges.length > 0) await g.query(WRITE_INTERFERES, { edges });

  const rows = await g.roQuery(WCC_BATCHES, { ids: tasks.map((t) => t.id) });
  const footprint = new Map(tasks.map((t) => [t.id, t.paths]));
  return rows
    .map((row) => {
      const ids = (row.tasks as unknown[]).map(String).sort();
      const paths = [...new Set(ids.flatMap((id) => footprint.get(id) ?? []))].sort();
      return { componentId: Number(row.componentId), tasks: ids, paths };
    })
    .sort((x, y) => x.tasks[0]!.localeCompare(y.tasks[0]!));
}
