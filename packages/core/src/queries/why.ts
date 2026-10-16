import type { SbGraph } from "../graph.js";
import { recordEvent } from "./events.js";

/**
 * Q5. An edit of a file, the task it was under, and the decision that caused the task.
 * The path is that chain. `latest` is a decision that superseded it, when one exists.
 */
export const WHY_TRACE = `
MATCH (f:File {path: $path})<-[:ON]-(e:Event {kind: 'edit'})-[:BY]->(a:Agent),
      (e)-[:UNDER]->(t:Task)
OPTIONAL MATCH (t)-[:CAUSED_BY]->(d:Decision)<-[:MADE]-(da:Agent)
OPTIONAL MATCH (d)<-[:SUPERSEDES]-(newer:Decision)
RETURN e.seq AS seq, a.id AS agent, t.id AS task,
       d.id AS decisionId, d.text AS decision, d.why AS why, da.id AS decidedBy,
       newer.id AS latestId, newer.text AS latestText
ORDER BY seq DESC
LIMIT 5
`;

/** Write the decision node, who made it, and the files it affects. */
export const RECORD_DECISION = `
MERGE (a:Agent {id: $agent})
ON CREATE SET a.status = 'active'
MERGE (d:Decision {id: $id})
SET d.text = $text, d.why = $why, d.status = 'active', d.at = $at
MERGE (a)-[:MADE]->(d)
WITH d
UNWIND $paths AS path
MATCH (f:File {path: path})
MERGE (d)-[:AFFECTS]->(f)
`;

/** A new decision replaces any other active decision on the same file. */
export const SUPERSEDE_OLDER = `
MATCH (d:Decision {id: $id})-[:AFFECTS]->(f)<-[:AFFECTS]-(old:Decision {status: 'active'})
WHERE old.id <> d.id
SET old.status = 'superseded'
MERGE (d)-[s:SUPERSEDES]->(old)
SET s.at = $at
`;

/** Attach an existing decision as the cause of a task. */
export const CAUSE_TASK = `
MERGE (t:Task {id: $taskId})
ON CREATE SET t.status = 'open'
WITH t
MATCH (d:Decision {id: $id})
MERGE (t)-[:CAUSED_BY]->(d)
`;

/** Arrange a decision for a test or the record_decision tool. */
export const LINK_DECISION = `
MATCH (t:Task {id: $taskId}), (a:Agent {id: $agent})
MERGE (d:Decision {id: $decisionId})
SET d.text = $text, d.why = $why, d.status = 'active', d.at = $at
MERGE (a)-[:MADE]->(d)
MERGE (t)-[:CAUSED_BY]->(d)
WITH d
UNWIND $paths AS path
MATCH (f:File {path: path})
MERGE (d)-[:AFFECTS]->(f)
`;

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

/** Record a decision and, when a task id is given, mark that task as caused by it. */
export async function recordDecision(
  g: SbGraph,
  input: { agent: string; text: string; why: string; paths: string[]; taskId?: string; id?: string; now?: number },
): Promise<string> {
  const id = input.id ?? `d-${Date.now()}`;
  const at = input.now ?? Date.now();
  await g.query(RECORD_DECISION, {
    agent: input.agent,
    id,
    text: input.text,
    why: input.why,
    at,
    paths: input.paths,
  });
  await g.query(SUPERSEDE_OLDER, { id, at });
  if (input.taskId) await g.query(CAUSE_TASK, { taskId: input.taskId, id });
  await recordEvent(g, {
    kind: "decision",
    agentId: input.agent,
    taskId: input.taskId,
    onPath: input.paths[0],
    payload: { id, text: input.text, why: input.why, paths: input.paths },
    now: at,
  });
  return id;
}

/** Why does this file look like this? Newest edits first. */
export async function whyTrace(g: SbGraph, path: string): Promise<WhyHit[]> {
  const rows = await g.roQuery(WHY_TRACE, { path });
  return rows.map((row) => {
    const decision = typeof row.decision === "string" ? row.decision : null;
    const agent = String(row.agent);
    const task = String(row.task);
    return {
      seq: Number(row.seq),
      agent,
      task,
      decisionId: typeof row.decisionId === "string" ? row.decisionId : null,
      decision,
      why: typeof row.why === "string" ? row.why : null,
      decidedBy: typeof row.decidedBy === "string" ? row.decidedBy : null,
      latestId: typeof row.latestId === "string" ? row.latestId : null,
      latestText: typeof row.latestText === "string" ? row.latestText : null,
      path: [path, agent, task, decision ?? "(no decision)"],
    };
  });
}
