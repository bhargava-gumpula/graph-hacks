import type { SbGraph } from "../graph.js";

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

/** Arrange a decision for a test or, later, the record_decision tool. */
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
