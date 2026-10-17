import type { SbGraph } from "../graph.js";
import { ALLOCATE_EVENT, readSeq } from "./events.js";

export type AgentKind = "cursor" | "claude" | "human";

export interface AgentView {
  id: string;
  kind: string | null;
  status: string | null;
  lastSeen: number | null;
  /** Paths this agent currently claims (`until > now`). */
  claims: string[];
}

export interface StatusClaim {
  agent: string;
  path: string;
  until: number;
  taskId: string | null;
}

export interface StatusResult {
  agents: AgentView[];
  claims: StatusClaim[];
}

/**
 * One write: the agent exists, is active, and a `register` event points at them.
 * `startedAt` is set only on create, so a second register does not rewind it.
 * `kind` is left alone when the caller omits it.
 */
export const REGISTER_AGENT = `${ALLOCATE_EVENT}
MERGE (a:Agent {id: $id})
ON CREATE SET a.startedAt = $at
SET a.status = 'active', a.lastSeen = $at, a.kind = coalesce($agentKind, a.kind)
CREATE (e)-[:BY]->(a)
RETURN m.value AS seq
`;

/**
 * One write: the agent is alive. Touch `lastSeen`, mark it active again, push
 * every unexpired claim forward by its own TTL, and record a `heartbeat` event.
 */
export const HEARTBEAT_AGENT = `${ALLOCATE_EVENT}
MERGE (a:Agent {id: $id})
ON CREATE SET a.startedAt = $at
SET a.lastSeen = $at, a.status = 'active'
CREATE (e)-[:BY]->(a)
WITH m, a
OPTIONAL MATCH (a)-[c:CLAIMS]->(:File)
WHERE c.until > $at
WITH m, collect(c) AS live
FOREACH (c IN live | SET c.until = $at + coalesce(c.ttl, c.until - c.since))
RETURN m.value AS seq, size(live) AS extended
`;

/** An agent silent this long (no register, heartbeat, claim or release) is stale. */
export const DEFAULT_STALE_MS = 30 * 60 * 1000;

/** Active agents not seen since `$cutoff`, with what they hold. Read-only. */
export const STALE_AGENTS = `
MATCH (a:Agent)
WHERE a.status = 'active' AND a.lastSeen < $cutoff
OPTIONAL MATCH (a)-[:CLAIMS]->(f:File)
RETURN a.id AS id, collect(f.path) AS paths
ORDER BY id
`;

/**
 * One write per stale agent: mark it `stale`, drop all its claims and record a
 * `release` event. The WHERE is re-checked here, so an agent that heartbeat
 * after STALE_AGENTS ran is left alone.
 */
export const RELEASE_STALE_AGENT = `
MATCH (a:Agent {id: $id})
WHERE a.status = 'active' AND a.lastSeen < $cutoff
SET a.status = 'stale'
WITH a
OPTIONAL MATCH (a)-[c:CLAIMS]->(f:File)
WITH a, collect(c) AS claims
MATCH (m:Meta {key: 'seq'})
SET m.value = m.value + 1
CREATE (e:Event {seq: m.value, kind: 'release', at: $at, payload: $payload})-[:BY]->(a)
FOREACH (c IN claims | DELETE c)
RETURN m.value AS seq, size(claims) AS released
`;

/**
 * Every agent, with the paths they still hold.
 * `c IS NULL` keeps agents who have no active claim (an expired edge fails the
 * `until` test, so OPTIONAL MATCH yields null and the agent stays in the list).
 */
export const AGENT_STATUS = `
MATCH (a:Agent)
OPTIONAL MATCH (a)-[c:CLAIMS]->(f:File)
WHERE c IS NULL OR c.until > $now
RETURN a.id AS id, a.kind AS kind, a.status AS status, a.lastSeen AS lastSeen,
       collect(f.path) AS claims
ORDER BY id
`;

/** Claims that have not expired. Read-only. */
export const ACTIVE_CLAIMS = `
MATCH (a:Agent)-[c:CLAIMS]->(f:File)
WHERE c.until > $now
RETURN a.id AS agent, f.path AS path, c.until AS until, c.taskId AS taskId
ORDER BY agent, path
`;

export async function registerAgent(
  g: SbGraph,
  input: { id: string; kind?: AgentKind; now?: number },
): Promise<{ seq: number }> {
  const rows = await g.query(REGISTER_AGENT, {
    kind: "register",
    at: input.now ?? Date.now(),
    payload: JSON.stringify({ id: input.id, kind: input.kind ?? null }),
    id: input.id,
    agentKind: input.kind ?? null,
  });
  return { seq: readSeq(rows, "registerAgent") };
}

export async function heartbeat(
  g: SbGraph,
  input: { id: string; now?: number },
): Promise<{ seq: number; extended: number }> {
  const rows = await g.query(HEARTBEAT_AGENT, {
    kind: "heartbeat",
    at: input.now ?? Date.now(),
    payload: JSON.stringify({ id: input.id }),
    id: input.id,
  });
  return { seq: readSeq(rows, "heartbeat"), extended: Number(rows[0]?.extended ?? 0) };
}

/**
 * Agents silent for `staleMs` (no register, heartbeat, claim or release) are
 * marked `stale` and lose their claims, so a crashed agent with a long TTL stops
 * blocking others. Returns the ids released.
 */
export async function releaseStaleAgents(
  g: SbGraph,
  input: { staleMs?: number; now?: number } = {},
): Promise<string[]> {
  const now = input.now ?? Date.now();
  const cutoff = now - (input.staleMs ?? DEFAULT_STALE_MS);
  const stale = await g.roQuery(STALE_AGENTS, { cutoff });
  const released: string[] = [];
  for (const row of stale) {
    const id = String(row.id);
    const payload = JSON.stringify({ reason: "stale", paths: pathsOf(row.paths) });
    const rows = await g.query(RELEASE_STALE_AGENT, { id, cutoff, at: now, payload });
    if (rows.length > 0) released.push(id);
  }
  return released;
}

/** Agents and their active claims. Read-only. `now` defaults to the current time. */
export async function status(g: SbGraph, now = Date.now()): Promise<StatusResult> {
  const [agentRows, claimRows] = await Promise.all([
    g.roQuery(AGENT_STATUS, { now }),
    g.roQuery(ACTIVE_CLAIMS, { now }),
  ]);

  return {
    agents: agentRows.map((row) => ({
      id: String(row.id),
      kind: typeof row.kind === "string" ? row.kind : null,
      status: typeof row.status === "string" ? row.status : null,
      lastSeen: typeof row.lastSeen === "number" ? row.lastSeen : null,
      claims: pathsOf(row.claims),
    })),
    claims: claimRows.map((row) => ({
      agent: String(row.agent),
      path: String(row.path),
      until: Number(row.until),
      taskId: typeof row.taskId === "string" ? row.taskId : null,
    })),
  };
}

function pathsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is string => typeof p === "string").sort();
}
