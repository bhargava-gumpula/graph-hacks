import type { SbGraph } from "../graph.js";
import { findConflicts, type Conflict } from "./conflict.js";
import { ALLOCATE_EVENT, readSeq, recordEvent } from "./events.js";

export interface EditInput {
  agentId: string;
  path: string;
  taskId?: string;
  /** Epoch milliseconds. Defaults to `Date.now()`. */
  now?: number;
}

export interface EditResult {
  /** Seq of the `edit` event (also stored on the EDITED edge). */
  seq: number;
  /** Set when the edit landed in another agent's active claim footprint. */
  collision: { seq: number; conflicts: Conflict[] } | null;
}

/**
 * Q7 write half. One query, so the EDITED edge and the edit Event share a seq.
 * The counter bump and the Event node come from ALLOCATE_EVENT in events.ts.
 * CREATE, not MERGE, for EDITED: every edit is its own edge, so the history stays.
 */
export const RECORD_EDIT = `${ALLOCATE_EVENT}
MERGE (a:Agent {id: $agentId})
ON CREATE SET a.status = 'active', a.startedAt = $at
SET a.lastSeen = $at
MERGE (f:File {path: $path})
ON CREATE SET f.hub = false, f.rank = 0.0
CREATE (e)-[:BY]->(a)
CREATE (e)-[:ON]->(f)
CREATE (a)-[:EDITED {at: $at, seq: m.value}]->(f)
FOREACH (_ IN CASE WHEN $taskId IS NULL THEN [] ELSE [1] END |
  MERGE (t:Task {id: $taskId})
  CREATE (e)-[:UNDER]->(t)
)
RETURN m.value AS seq
`;

/** Does the agent hold an active claim on this file? */
export const HOLDS_CLAIM = `
MATCH (:Agent {id: $agentId})-[c:CLAIMS]->(:File {path: $path})
WHERE c.until > $now
RETURN count(c) > 0 AS holds
`;

/**
 * Record an edit, then Q7's late check: if the editor holds no claim on the
 * file and it sits in another agent's active claim footprint (Q1: same file or
 * within k import hops, hubs skipped), also record a `collision` event.
 * The collision payload has the same shape as a `conflict` payload.
 */
export async function recordEditAndCheck(g: SbGraph, edit: EditInput): Promise<EditResult> {
  const now = edit.now ?? Date.now();
  const rows = await g.query(RECORD_EDIT, {
    kind: "edit",
    at: now,
    payload: JSON.stringify({ path: edit.path }),
    agentId: edit.agentId,
    path: edit.path,
    taskId: edit.taskId ?? null,
  });
  const seq = readSeq(rows, "recordEdit");

  const own = await g.roQuery(HOLDS_CLAIM, { agentId: edit.agentId, path: edit.path, now });
  if (own[0]?.holds === true) return { seq, collision: null };

  const conflicts = await findConflicts(g, { agent: edit.agentId, paths: [edit.path], now });
  if (conflicts.length === 0) return { seq, collision: null };

  const collisionSeq = await recordEvent(g, {
    kind: "collision",
    agentId: edit.agentId,
    onPath: edit.path,
    taskId: edit.taskId,
    payload: { requested: [edit.path], conflicts },
    now,
  });
  return { seq, collision: { seq: collisionSeq, conflicts } };
}

/** Record that an agent edited a file. Returns the edit's seq. */
export async function recordEdit(g: SbGraph, edit: EditInput): Promise<number> {
  return (await recordEditAndCheck(g, edit)).seq;
}
