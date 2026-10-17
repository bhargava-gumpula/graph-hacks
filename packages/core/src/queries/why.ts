import { randomUUID } from "node:crypto";
import type { SbGraph } from "../graph.js";
import { normPath } from "../paths.js";
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
 * Q5. Why does this file look like this? One row per chain (editing agent, task,
 * decision): its newest edit seq and how many edits it covers, the decision that
 * caused the task, who made it, and `latest`, the active decision that replaced
 * it (following SUPERSEDES up to 5 steps). Edits with no task still show who edited.
 * `nodes` are the chain's real graph nodes in order: File, Agent, Task, Decision.
 * The second arm answers for a file an active decision governs but no tracked
 * edit touched (the caller drops it when an edit chain already names that decision).
 * Each arm is ordered and limited on its own; the caller merges them.
 * All matches come before the aggregation: in FalkorDB an OPTIONAL MATCH with a
 * property filter right after it found nothing (falkordb:latest, Oct 2026).
 */
export const WHY_TRACE = `
MATCH (f:File {path: $path})<-[:ON]-(e:Event {kind: 'edit'})
OPTIONAL MATCH (e)-[:BY]->(a:Agent)
OPTIONAL MATCH (e)-[:UNDER]->(t:Task)
OPTIONAL MATCH (t)-[:CAUSED_BY]->(d:Decision)
OPTIONAL MATCH (da:Agent)-[:MADE]->(d)
OPTIONAL MATCH (d)<-[:SUPERSEDES*1..5]-(newer:Decision {status: 'active'})
WITH f, a, t, d, da, collect(DISTINCT newer)[0] AS newer, max(e.seq) AS seq, count(DISTINCT e) AS edits
RETURN seq, edits, a.id AS agent, t.id AS task,
       d.id AS decisionId, d.text AS decision, d.why AS why, da.id AS decidedBy,
       newer.id AS latestId, newer.text AS latestText,
       [x IN [f, a, t, d] WHERE x IS NOT NULL | {label: labels(x)[0], id: coalesce(x.path, x.id)}] AS nodes
ORDER BY seq DESC, decisionId
LIMIT $limit
UNION ALL
MATCH (d:Decision {status: 'active'})-[:AFFECTS]->(f:File {path: $path})
OPTIONAL MATCH (da:Agent)-[:MADE]->(d)
OPTIONAL MATCH (t:Task)-[:CAUSED_BY]->(d)
WITH f, d, da, collect(t)[0] AS t
RETURN 0 AS seq, 0 AS edits, null AS agent, t.id AS task,
       d.id AS decisionId, d.text AS decision, d.why AS why, da.id AS decidedBy,
       null AS latestId, null AS latestText,
       [x IN [f, t, d] WHERE x IS NOT NULL | {label: labels(x)[0], id: coalesce(x.path, x.id)}] AS nodes
ORDER BY d.at DESC, decisionId
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
  /** Newest edit in this chain; 0 for a decision with no tracked edit. */
  seq: number;
  /** How many edits this chain covers. */
  edits: number;
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
  /** The same chain as real graph nodes (missing links left out). */
  nodes: { label: string; id: string }[];
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

/**
 * Why does this file look like this? Edit chains newest first, then active
 * decisions on the file that no edit chain reached. Empty when neither exists.
 */
export async function whyTrace(g: SbGraph, file: string, limit = 5): Promise<WhyHit[]> {
  const path = normPath(file);
  const rows = await g.roQuery(WHY_TRACE, { path, limit });
  const hits = rows.map((row): WhyHit => {
    const edited = Number(row.edits) > 0;
    const agent = str(row.agent) ?? (edited ? "(unknown agent)" : "(no tracked edit)");
    const task = str(row.task) ?? "(no task)";
    const decision = str(row.decision);
    return {
      seq: Number(row.seq),
      edits: Number(row.edits),
      agent,
      task,
      decisionId: str(row.decisionId),
      decision,
      why: str(row.why),
      decidedBy: str(row.decidedBy),
      latestId: str(row.latestId),
      latestText: str(row.latestText),
      path: [path, agent, task, decision ?? "(no decision)"],
      nodes: (row.nodes as { label: unknown; id: unknown }[]).map((n) => ({ label: String(n.label), id: String(n.id) })),
    };
  });
  const traced = new Set(hits.filter((h) => h.edits > 0).map((h) => h.decisionId));
  return hits.filter((h) => h.edits > 0 || !traced.has(h.decisionId)).slice(0, limit);
}
