import type { SbGraph } from "../graph.js";
import { ALLOCATE_EVENT, readSeq } from "./events.js";

export interface EditInput {
  agentId: string;
  path: string;
  taskId?: string;
  /** Epoch milliseconds. Defaults to `Date.now()`. */
  now?: number;
}

/**
 * Q7 write half. One query, so the EDITED edge and the edit Event share a seq.
 * The counter bump and the Event node come from ALLOCATE_EVENT in events.ts;
 * this query only adds the agent, the file, and the three links.
 * Collision detection is not here: it needs the Q1 conflict query.
 */
export const RECORD_EDIT = `${ALLOCATE_EVENT}
MERGE (a:Agent {id: $agentId})
MERGE (f:File {path: $path})
CREATE (e)-[:BY]->(a)
CREATE (e)-[:ON]->(f)
MERGE (a)-[:EDITED {at: $at, seq: m.value}]->(f)
FOREACH (_ IN CASE WHEN $taskId IS NULL THEN [] ELSE [1] END |
  MERGE (t:Task {id: $taskId})
  CREATE (e)-[:UNDER]->(t)
)
RETURN m.value AS seq
`;

/** Record that an agent edited a file. Returns the shared seq. */
export async function recordEdit(g: SbGraph, edit: EditInput): Promise<number> {
  const rows = await g.query(RECORD_EDIT, {
    kind: "edit",
    at: edit.now ?? Date.now(),
    payload: JSON.stringify({ path: edit.path }),
    agentId: edit.agentId,
    path: edit.path,
    taskId: edit.taskId ?? null,
  });
  return readSeq(rows, "recordEdit");
}
