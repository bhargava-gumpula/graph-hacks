import type { SbGraph } from "../graph.js";
import { releaseStaleAgents } from "./agents.js";
import { type Conflict, conflictGuard, findConflicts } from "./conflict.js";
import { ALLOCATE_EVENT, readSeq, recordEvent } from "./events.js";

/** Default claim lifetime. An agent that dies stops blocking others after this. */
export const DEFAULT_TTL_MS = 30 * 60 * 1000;

/** A denied claim is re-tried this many times if its conflict vanished before we could read it. */
const MAX_ATTEMPTS = 3;

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
 * Write the claims and their `claim` event (one seq).
 * Re-claiming a file you already hold just extends it. `ttl` is kept on the edge
 * so a heartbeat can extend the claim by the same amount. FOREACH is the
 * optional task link, as in RECORD_EVENT.
 */
export const WRITE_CLAIMS = `${ALLOCATE_EVENT}
MERGE (a:Agent {id: $agent})
ON CREATE SET a.status = 'active', a.startedAt = $at
SET a.lastSeen = $at, a.status = 'active'
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
SET c.since = $at, c.until = $until, c.ttl = $ttl, c.taskId = $taskId, c.intent = $intent
CREATE (e)-[:ON]->(f)
RETURN DISTINCT m.value AS seq
`;

/**
 * Check-and-claim as ONE write query: the Q1 guard, then WRITE_CLAIMS.
 * FalkorDB runs the write queries of a graph one at a time, so no other claim
 * can land between the check and the write. Returns one row (the seq) when
 * granted and no rows when something conflicts.
 */
export function claimQuery(k: number): string {
  return conflictGuard(k) + WRITE_CLAIMS;
}

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
 * Claim files for an agent. Granted only if Q1 finds no other agent's active
 * claim on, or linked through the import graph to, any of these files; the
 * check and the write are one query, so two racing claims on linked files
 * cannot both win. A denied claim writes nothing but a `conflict` event that
 * carries the paths.
 */
export async function claim(g: SbGraph, input: ClaimInput): Promise<ClaimResult> {
  const paths = [...new Set(input.paths)];
  if (paths.length === 0) throw new Error("claim needs at least one path");
  const now = input.now ?? Date.now();
  const k = input.k ?? 3;
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS;
  const until = now + ttl;
  // A crashed agent with a long TTL must not block this claim.
  await releaseStaleAgents(g, { now });

  for (let attempt = 1; ; attempt++) {
    const rows = await g.query(claimQuery(k), {
      kind: "claim",
      at: now,
      now,
      payload: JSON.stringify({ paths, until, intent: input.intent ?? null }),
      agent: input.agent,
      paths,
      until,
      ttl,
      taskId: input.taskId ?? null,
      intent: input.intent ?? null,
    });
    if (rows.length > 0) return { ok: true, until, seq: readSeq(rows, "claim") };

    // Denied. Read the paths for the caller. If the blocking claim was released
    // in between, the list is empty and the claim is simply tried again.
    const conflicts = await findConflicts(g, { agent: input.agent, paths, now, k });
    if (conflicts.length > 0 || attempt >= MAX_ATTEMPTS) {
      const seq = await recordEvent(g, {
        kind: "conflict",
        agentId: input.agent,
        onPath: conflicts[0]?.file ?? paths[0],
        taskId: input.taskId,
        payload: { requested: paths, conflicts },
        now,
      });
      return { ok: false, conflicts, seq };
    }
  }
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
