import type { SbGraph } from "../graph.js";

/** `Event.kind` values from PLAN §3. */
export type EventKind =
  | "register"
  | "claim"
  | "conflict"
  | "release"
  | "edit"
  | "collision"
  | "decision"
  | "lesson"
  | "handoff"
  | "heartbeat"
  | "parse";

export interface EventInput {
  kind: EventKind;
  agentId?: string;
  onPath?: string;
  taskId?: string;
  payload?: unknown;
  /** Epoch milliseconds. Defaults to `Date.now()`. */
  now?: number;
}

/**
 * Bump the counter and create the Event. Shared with edits.ts so every
 * writer allocates `seq` the same way.
 *
 * FalkorDB runs writes to a graph one at a time. Keeping the bump and the
 * CREATE in one query is what makes `seq` gap-free under concurrency.
 * After this fragment, `e` (the new Event) and `m` (the counter) are in scope.
 */
export const ALLOCATE_EVENT = `
MATCH (m:Meta {key:'seq'})
SET m.value = m.value + 1
WITH m
CREATE (e:Event {seq: m.value, kind: $kind, at: $at, payload: $payload})
WITH e, m
`;

/**
 * Record one event and its optional BY / ON / UNDER links.
 * FOREACH over a one-element list is the optional link: a null id skips it.
 * Still one query, so the links share the Event's seq.
 */
export const RECORD_EVENT = `${ALLOCATE_EVENT}
FOREACH (_ IN CASE WHEN $agentId IS NULL THEN [] ELSE [1] END |
  MERGE (a:Agent {id: $agentId})
  CREATE (e)-[:BY]->(a)
)
FOREACH (_ IN CASE WHEN $onPath IS NULL THEN [] ELSE [1] END |
  MERGE (f:File {path: $onPath})
  CREATE (e)-[:ON]->(f)
)
FOREACH (_ IN CASE WHEN $taskId IS NULL THEN [] ELSE [1] END |
  MERGE (t:Task {id: $taskId})
  CREATE (e)-[:UNDER]->(t)
)
RETURN m.value AS seq
`;

/** Write an Event and return its seq. */
export async function recordEvent(g: SbGraph, event: EventInput): Promise<number> {
  const rows = await g.query(RECORD_EVENT, {
    kind: event.kind,
    at: event.now ?? Date.now(),
    payload: JSON.stringify(event.payload ?? null),
    agentId: event.agentId ?? null,
    onPath: event.onPath ?? null,
    taskId: event.taskId ?? null,
  });
  return readSeq(rows, "recordEvent");
}

export function readSeq(rows: Record<string, unknown>[], what: string): number {
  const seq = rows[0]?.seq;
  if (typeof seq !== "number") {
    throw new Error(`${what} did not return a seq`);
  }
  return seq;
}
