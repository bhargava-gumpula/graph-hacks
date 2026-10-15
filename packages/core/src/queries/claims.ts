import type { SbGraph } from "../graph.js";
import { type Conflict, findConflicts } from "./conflict.js";
import { ALLOCATE_EVENT, readSeq, recordEvent } from "./events.js";

/** Default claim lifetime. An agent that dies stops blocking others after this. */
export const DEFAULT_TTL_MS = 30 * 60 * 1000;

export interface ClaimInput {
  agent: string;
  paths: string[];
  taskId?: string;
  intent?: string;
  ttlMs?: number;
  k?: number;
  now?: number;
}

export type ClaimResult =
  | { ok: true; until: number; seq: number }
  | { ok: false; conflicts: Conflict[]; seq: number };

/**
 * Write the claims and their `claim` event in one query (one seq).
 * Re-claiming a file you already hold just extends it. FOREACH is the optional
 * task link, as in RECORD_EVENT.
 */
export const WRITE_CLAIMS = `${ALLOCATE_EVENT}
MERGE (a:Agent {id: $agent})
ON CREATE SET a.status = 'active', a.startedAt = $at
SET a.lastSeen = $at
CREATE (e)-[:BY]->(a)
FOREACH (_ IN CASE WHEN $taskId IS NULL THEN [] ELSE [1] END |
  MERGE (t:Task {id: $taskId})
  ON CREATE SET t.status = 'active', t.createdAt = $at
  MERGE (a)-[w:WORKS_ON]->(t)
  ON CREATE SET w.since = $at
  CREATE (e)-[:UNDER]->(t)
)
WITH e, m, a
UNWIND $paths AS path
MERGE (f:File {path: path})
ON CREATE SET f.hub = false, f.rank = 0.0
MERGE (a)-[c:CLAIMS]->(f)
SET c.since = $at, c.until = $until, c.taskId = $taskId, c.intent = $intent
CREATE (e)-[:ON]->(f)
RETURN DISTINCT m.value AS seq
`;

/**
 * Drop an agent's claims (all of them when `$paths` is null) and record a
 * `release` event, in one query.
 */
export const RELEASE_CLAIMS = `${ALLOCATE_EVENT}
MERGE (a:Agent {id: $agent})
SET a.lastSeen = $at
CREATE (e)-[:BY]->(a)
WITH e, m, a
OPTIONAL MATCH (a)-[c:CLAIMS]->(f:File)
WHERE $paths IS NULL OR f.path IN $paths
WITH m, collect(c) AS claims
FOREACH (c IN claims | DELETE c)
RETURN m.value AS seq, size(claims) AS released
`;

/**
 * Claim files for an agent. Runs Q1 first. If any other agent's active claim is
 * linked to these files through the import graph, nothing is claimed and a
 * `conflict` event carries the paths. Otherwise the claims are written.
 * The check and the write are two queries, so two agents claiming linked files
 * within the same few milliseconds could both get through; the edit hooks
 * (collision events) are the backstop for that window.
 */
export async function claim(g: SbGraph, input: ClaimInput): Promise<ClaimResult> {
  const now = input.now ?? Date.now();
  const conflicts = await findConflicts(g, { agent: input.agent, paths: input.paths, now, k: input.k });

  if (conflicts.length > 0) {
    const seq = await recordEvent(g, {
      kind: "conflict",
      agentId: input.agent,
      onPath: conflicts[0]!.file,
      taskId: input.taskId,
      payload: { requested: input.paths, conflicts },
      now,
    });
    return { ok: false, conflicts, seq };
  }

  const until = now + (input.ttlMs ?? DEFAULT_TTL_MS);
  const rows = await g.query(WRITE_CLAIMS, {
    kind: "claim",
    at: now,
    payload: JSON.stringify({ paths: input.paths, until, intent: input.intent ?? null }),
    agent: input.agent,
    paths: input.paths,
    until,
    taskId: input.taskId ?? null,
    intent: input.intent ?? null,
  });
  return { ok: true, until, seq: readSeq(rows, "claim") };
}

/** Release an agent's claims on `paths`, or all of its claims. */
export async function release(
  g: SbGraph,
  input: { agent: string; paths?: string[]; now?: number },
): Promise<{ released: number; seq: number }> {
  const rows = await g.query(RELEASE_CLAIMS, {
    kind: "release",
    at: input.now ?? Date.now(),
    payload: JSON.stringify({ paths: input.paths ?? null }),
    agent: input.agent,
    paths: input.paths ?? null,
  });
  return { released: Number(rows[0]?.released ?? 0), seq: readSeq(rows, "release") };
}
