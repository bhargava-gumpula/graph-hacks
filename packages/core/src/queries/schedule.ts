import type { SbGraph } from "../graph.js";

const MAX_K = 4;

export const SET_TASK_STATUS = `
MATCH (t:Task {id: $id})
SET t.status = $status
`;

/** Give an open task one file in its footprint. */
export const TOUCH_FILE = `
MERGE (t:Task {id: $id})
SET t.status = 'open', t.title = $title
WITH t
MATCH (f:File {path: $path})
MERGE (t)-[:TOUCHES]->(f)
`;

/** Drop the previous interference edges so the next pass rebuilds them. */
export const CLEAR_INTERFERES = `
MATCH ()-[r:INTERFERES]-()
DELETE r
`;

/**
 * Q3 step 1. Two open tasks interfere when a file one touches can reach a file
 * the other touches within k import hops, hubs excluded. Same file is hop 0.
 * `k` is inlined. One edge per pair; `via` is one of the files that connects them.
 */
export function interfereQuery(k: number): string {
  if (!Number.isInteger(k) || k < 1 || k > MAX_K) throw new Error(`k must be an integer 1..${MAX_K}`);
  return `
MATCH (t1:Task {status: 'open'})-[:TOUCHES]->(f1:File),
      (t2:Task {status: 'open'})-[:TOUCHES]->(f2:File)
WHERE t1.id < t2.id AND NOT coalesce(f1.hub, false) AND NOT coalesce(f2.hub, false)
OPTIONAL MATCH p = (f1)-[:IMPORTS*1..${k}]-(f2)
WHERE f1 <> f2 AND none(n IN nodes(p) WHERE coalesce(n.hub, false))
WITH t1, t2, f1, f2, p
WHERE f1 = f2 OR p IS NOT NULL
MERGE (t1)-[r:INTERFERES]->(t2)
SET r.via = f1.path
`;
}

/** Q3 step 2. Each component must run serially. Different components can run together. */
export const WCC_BATCHES = `
CALL algo.WCC({nodeLabels: ['Task'], relationshipTypes: ['INTERFERES']}) YIELD node, componentId
WHERE node.status = 'open'
RETURN componentId, collect(node.id) AS tasks
ORDER BY componentId
`;

export interface Batch {
  componentId: number;
  tasks: string[];
}

/** Open a task and attach the files it plans to touch. */
export async function planTask(
  g: SbGraph,
  input: { id: string; title?: string; paths: string[] },
): Promise<void> {
  for (const path of input.paths) {
    await g.query(TOUCH_FILE, { id: input.id, title: input.title ?? input.id, path });
  }
}

/** Rebuild INTERFERES from the code graph, then split open tasks with WCC. */
export async function parallelBatches(g: SbGraph, k = 3): Promise<Batch[]> {
  await g.query(CLEAR_INTERFERES);
  await g.query(interfereQuery(k));
  const rows = await g.roQuery(WCC_BATCHES);
  return rows.map((row) => ({
    componentId: Number(row.componentId),
    tasks: Array.isArray(row.tasks) ? row.tasks.filter((id): id is string => typeof id === "string").sort() : [],
  }));
}
