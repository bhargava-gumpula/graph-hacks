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

/** One write: touch `lastSeen` and record a `heartbeat` event. */
export const HEARTBEAT_AGENT = `${ALLOCATE_EVENT}
MERGE (a:Agent {id: $id})
SET a.lastSeen = $at
CREATE (e)-[:BY]->(a)
RETURN m.value AS seq
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
): Promise<{ seq: number }> {
  const rows = await g.query(HEARTBEAT_AGENT, {
    kind: "heartbeat",
    at: input.now ?? Date.now(),
    payload: JSON.stringify({ id: input.id }),
    id: input.id,
  });
  return { seq: readSeq(rows, "heartbeat") };
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
