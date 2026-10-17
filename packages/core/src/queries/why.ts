import { randomUUID } from "node:crypto";
import type { SbGraph } from "../graph.js";
import { recordEvent } from "./events.js";

/**
 * Write a decision in one query: who made it, the files it affects, the task it
 * caused (optional) and the older decisions it replaces (optional).
 * FOREACH over a 0/1-element list is the optional part, as in RECORD_EVENT.
 * Paths that are not File nodes are skipped; `affected` counts the ones linked.
 */
export const RECORD_DECISION = `
MERGE (a:Agent {id: $agent})
ON CREATE SET a.status = 'active', a.startedAt = $at
MERGE (d:Decision {id: $id})
ON CREATE SET d.status = 'active'
SET d.text = $text, d.why = $why, d.at = $at
MERGE (a)-[:MADE]->(d)
FOREACH (_ IN CASE WHEN $taskId IS NULL THEN [] ELSE [1] END |
  MERGE (t:Task {id: $taskId})
  ON CREATE SET t.status = 'open', t.createdAt = $at
  MERGE (t)-[:CAUSED_BY]->(d)
)
WITH d
OPTIONAL MATCH (old:Decision)
WHERE old.id IN $supersedes AND old <> d
FOREACH (o IN CASE WHEN old IS NULL THEN [] ELSE [old] END |
  SET o.status = 'superseded'
  MERGE (d)-[s:SUPERSEDES]->(o)
  ON CREATE SET s.at = $at
)
WITH DISTINCT d
OPTIONAL MATCH (f:File)
WHERE f.path IN $paths
FOREACH (x IN CASE WHEN f IS NULL THEN [] ELSE [f] END |
  MERGE (d)-[:AFFECTS]->(x)
)
RETURN d.id AS id, count(f) AS affected
`;

/**
 * Q5. Why does this file look like this? Each edit of the file, newest first, with
 * the agent who made it, the task it was under, the decision that caused the task
 * and who made that decision. `latest` is the active decision that replaced it,
 * following SUPERSEDES up to 5 steps. Edits with no task still show who edited.
 */
export const WHY_TRACE = `
MATCH (f:File {path: $path})<-[:ON]-(e:Event {kind: 'edit'})
OPTIONAL MATCH (e)-[:BY]->(a:Agent)
OPTIONAL MATCH (e)-[:UNDER]->(t:Task)
OPTIONAL MATCH (t)-[:CAUSED_BY]->(d:Decision)
OPTIONAL MATCH (da:Agent)-[:MADE]->(d)
OPTIONAL MATCH (d)<-[:SUPERSEDES*1..5]-(newer:Decision {status: 'active'})
RETURN e.seq AS seq, a.id AS agent, t.id AS task,
       d.id AS decisionId, d.text AS decision, d.why AS why, da.id AS decidedBy,
       newer.id AS latestId, newer.text AS latestText
ORDER BY seq DESC, decisionId
LIMIT $limit
`;

export const LIST_DECISIONS = `
MATCH (d:Decision)
OPTIONAL MATCH (a:Agent)-[:MADE]->(d)
RETURN d.id AS id, d.text AS text, d.why AS why, d.status AS status, a.id AS agent
ORDER BY d.at DESC, id
`;

export interface DecisionRow {
  id: string;
  text: string;
  why: string | null;
  status: string | null;
  agent: string | null;
}

export interface WhyHit {
  seq: number;
  agent: string;
  task: string;
  decisionId: string | null;
  decision: string | null;
  why: string | null;
  decidedBy: string | null;
  latestId: string | null;
  latestText: string | null;
  /** File, editing agent, task, decision. The chain a judge can read. */
  path: string[];
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Record a decision. `taskId` marks that task as caused by it (the why-trace link);
 * `supersedes` lists decision ids it replaces, which become `superseded`.
 * Returns the decision id.
 */
export async function recordDecision(
  g: SbGraph,
  input: {
    agent: string;
    text: string;
    why: string;
    paths: string[];
    taskId?: string;
    supersedes?: string[];
    id?: string;
    now?: number;
  },
): Promise<string> {
  const id = input.id ?? `d-${randomUUID()}`;
  const at = input.now ?? Date.now();
  const supersedes = input.supersedes ?? [];
  await g.query(RECORD_DECISION, {
    agent: input.agent,
    id,
    text: input.text,
    why: input.why,
    at,
    paths: input.paths,
    taskId: input.taskId ?? null,
    supersedes,
  });
  await recordEvent(g, {
    kind: "decision",
    agentId: input.agent,
    taskId: input.taskId,
    onPath: input.paths[0],
    payload: { id, text: input.text, why: input.why, paths: input.paths, supersedes },
    now: at,
  });
  return id;
}

/** Every decision, newest first, superseded ones included (see `status`). */
export async function listDecisions(g: SbGraph): Promise<DecisionRow[]> {
  const rows = await g.roQuery(LIST_DECISIONS);
  return rows.map((row) => ({
    id: String(row.id),
    text: String(row.text),
    why: str(row.why),
    status: str(row.status),
    agent: str(row.agent),
  }));
}

/** Why does this file look like this? Newest edits first; empty when no edit is recorded. */
export async function whyTrace(g: SbGraph, path: string, limit = 5): Promise<WhyHit[]> {
  const rows = await g.roQuery(WHY_TRACE, { path, limit });
  return rows.map((row) => {
    const agent = str(row.agent) ?? "(unknown agent)";
    const task = str(row.task) ?? "(no task)";
    const decision = str(row.decision);
    return {
      seq: Number(row.seq),
      agent,
      task,
      decisionId: str(row.decisionId),
      decision,
      why: str(row.why),
      decidedBy: str(row.decidedBy),
      latestId: str(row.latestId),
      latestText: str(row.latestText),
      path: [path, agent, task, decision ?? "(no decision)"],
    };
  });
}
