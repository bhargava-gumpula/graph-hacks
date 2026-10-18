import type { SbGraph } from "../graph.js";
import { normPath } from "../paths.js";
import { DEFAULT_STALE_MS, releaseStaleAgents } from "./agents.js";
import { type Conflict, conflictGuard, findConflicts } from "./conflict.js";
import { ALLOCATE_EVENT, readSeq, recordEvent } from "./events.js";
import { dropWaits, freeFiles, waitedOn } from "./waits.js";

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

/**
 * `unknown`: requested paths outside the parsed graph (a README, package.json, a .py or .css file, a file
 * not written yet). They are still claimed, as `(:File {path, unparsed: true})`, but only another claim on the
 * very same file conflicts with them: they have no imports to follow. Callers say so.
 */
export type ClaimResult =
  | { ok: true; until: number; seq: number; unknown?: string[] }
  | { ok: false; conflicts: Conflict[]; seq: number; unknown?: string[]; safe?: string[] };

/** A denied claim suggests at most this many open-task files that are free right now. */
const SAFE_LIMIT = 5;

/** Files that unfinished tasks plan to touch: the candidates for "Safe now". */
export const OPEN_TASK_FILES = `
MATCH (t:Task)-[:TOUCHES]->(f:File)
WHERE coalesce(t.status, 'open') <> 'done'
RETURN DISTINCT f.path AS path
ORDER BY path
`;

/** Open-task files this agent could claim right now (Q1 finds nothing), minus the ones it asked for. */
async function safeNow(g: SbGraph, agent: string, asked: string[], now: number, k: number): Promise<string[]> {
  const candidates = (await g.roQuery(OPEN_TASK_FILES)).map((row) => String(row.path)).filter((p) => !asked.includes(p));
  if (candidates.length === 0) return [];
  const blocked = new Set((await findConflicts(g, { agent, paths: candidates, now, k })).map((c) => c.file));
  return candidates.filter((p) => !blocked.has(p)).slice(0, SAFE_LIMIT);
}

/** Which of `$paths` are File nodes of the code graph (not a node a claim made for an unparsed file). */
export const KNOWN_FILES = `
MATCH (f:File)
WHERE f.path IN $paths AND NOT coalesce(f.unparsed, false)
RETURN f.path AS path
`;

/** The requested paths (normalised) that are not in the parsed graph: a claim checks them for the same file only. */
export async function unknownPaths(g: SbGraph, paths: string[]): Promise<string[]> {
  const want = [...new Set(paths.map(normPath))];
  const known = new Set((await g.roQuery(KNOWN_FILES, { paths: want })).map((row) => String(row.path)));
  return want.filter((p) => !known.has(p));
}

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
ON CREATE SET f.hub = false, f.rank = 0.0, f.unparsed = true
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
 * carries the paths. Paths are normalised first (see paths.ts). Paths outside the
 * parsed graph are claimed too, with the same-file check only, and listed in
 * `unknown`. A denial also lists `safe`: open-task files the agent could claim
 * instead right now.
 */
export async function claim(g: SbGraph, input: ClaimInput): Promise<ClaimResult> {
  const requested = [...new Set(input.paths.map(normPath))];
  if (requested.length === 0) throw new Error("claim needs at least one path");
  const now = input.now ?? Date.now();
  const k = input.k ?? 3;
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS;
  const until = now + ttl;
  const unknown = await unknownPaths(g, requested);
  const paths = requested;
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
    if (rows.length > 0) return { ok: true, until, seq: readSeq(rows, "claim"), unknown };

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
      await g.query(LINK_VIA, { seq, paths: [...new Set(conflicts.flatMap((c) => c.path))] });
      return { ok: false, conflicts, seq, unknown, safe: await safeNow(g, input.agent, paths, now, k) };
    }
  }
}

/** A conflict event links every file on the refused import path, so the history is queryable. */
export const LINK_VIA = `
MATCH (e:Event {seq: $seq})
UNWIND $paths AS path
MATCH (f:File {path: path})
MERGE (e)-[:VIA]->(f)
`;

/**
 * Release an agent's claims on `paths`, or all of its claims. A released file someone waits on gets a
 * `free` event. Releasing everything (the session ended) also ends this agent's own waits.
 */
export async function release(
  g: SbGraph,
  input: { agent: string; paths?: string[]; now?: number },
): Promise<{ released: number; seq: number }> {
  const paths = input.paths ? input.paths.map(normPath) : null;
  const now = input.now ?? Date.now();
  const waited = await waitedOn(g, input.agent, paths);
  const rows = await g.query(RELEASE_CLAIMS, {
    kind: "release",
    at: now,
    payload: JSON.stringify({ paths }),
    agent: input.agent,
    paths,
  });
  await freeFiles(g, waited, now);
  if (paths === null) await dropWaits(g, input.agent);
  return { released: Number(rows[0]?.released ?? 0), seq: readSeq(rows, "release") };
}

/** Of `$paths`, the files another agent holds an active claim on, or edited at or after `$since`. */
export const OTHERS_ON = `
UNWIND $paths AS path
MATCH (o:Agent)-[r:CLAIMS|EDITED]->(f:File {path: path})
WHERE o.id <> $agent AND ((type(r) = 'CLAIMS' AND r.until > $now) OR (type(r) = 'EDITED' AND r.at >= $since))
RETURN DISTINCT f.path AS path
`;

/**
 * Which of these files are another agent's right now: it claims them, or edited them since `since`.
 * A shell command's PostToolUse sees every change in the checkout while it ran, including another
 * editor's; those are left out, so they are not recorded as this agent's edits (or collisions).
 */
export async function othersOn(
  g: SbGraph,
  input: { agent: string; paths: string[]; since: number; now?: number },
): Promise<string[]> {
  if (input.paths.length === 0) return [];
  const norm = input.paths.map(normPath);
  const rows = await g.roQuery(OTHERS_ON, { agent: input.agent, paths: norm, since: input.since, now: input.now ?? Date.now() });
  const theirs = new Set(rows.map((r) => r.path as string));
  return input.paths.filter((_, i) => theirs.has(norm[i]!));
}

/**
 * One session takes an agent id (`claude@main`) unless another live session holds it. The write is atomic, so
 * two sessions starting at once cannot both win. Free: nobody holds it, this session already does, or the
 * holder went quiet (`lastSeen` before `$stale`) or ended (END_SESSION).
 */
export const TAKE_AGENT_ID = `
MERGE (a:Agent {id: $id})
ON CREATE SET a.startedAt = $now, a.status = 'active', a.lastSeen = $now
WITH a, (a.session IS NULL OR a.session = $session OR coalesce(a.lastSeen, 0) < $stale) AS free
SET a.session = CASE WHEN free THEN $session ELSE a.session END
RETURN free
`;

/** The session let go of its id: the next session on this branch may take it. */
export const END_SESSION = `
MATCH (a:Agent {id: $id})
WHERE a.session = $session
SET a.session = null
`;

/** True when `session` may use `id` (and now holds it); false when another live session does. */
export async function takeAgentId(g: SbGraph, input: { id: string; session: string; now?: number }): Promise<boolean> {
  const now = input.now ?? Date.now();
  const [row] = await g.query(TAKE_AGENT_ID, { id: input.id, session: input.session, now, stale: now - DEFAULT_STALE_MS });
  return row?.free === true;
}

export async function endSession(g: SbGraph, input: { id: string; session: string }): Promise<void> {
  await g.query(END_SESSION, input);
}
