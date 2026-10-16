import type { SbGraph } from "../graph.js";
import { recordEvent } from "./events.js";

export interface BriefClaim {
  agent: string;
  path: string;
  hops: number;
  taskId: string | null;
  until: number;
}

export interface BriefNote {
  id: string;
  text: string;
  path: string;
  hops: number;
}

export interface Brief {
  files: string[];
  claims: BriefClaim[];
  decisions: BriefNote[];
  lessons: BriefNote[];
  events: { seq: number; kind: string; path: string; agentId: string | null }[];
  tasks: { id: string; title: string | null }[];
  handoff: { note: string; from: string; to: string } | null;
}

/** Files a briefing is about: a task's footprint, or every file under a directory prefix. */
export const AREA_FILES = `
MATCH (f:File)
WHERE ($taskId IS NOT NULL AND (:Task {id: $taskId})-[:TOUCHES]->(f))
   OR ($prefix IS NOT NULL AND f.path STARTS WITH $prefix)
RETURN DISTINCT f.path AS path
ORDER BY path
`;

/** Active claims on those files or within 2 import hops, hubs skipped on the hops. */
export const NEAR_CLAIMS = `
UNWIND $paths AS path
MATCH (f:File {path: path})
OPTIONAL MATCH p = (f)-[:IMPORTS*0..2]-(g:File)
WHERE none(n IN nodes(p) WHERE n.hub AND n <> f AND n <> g)
WITH g, min(length(p)) AS hops
MATCH (a:Agent)-[c:CLAIMS]->(g)
WHERE c.until > $now
RETURN DISTINCT a.id AS agent, g.path AS path, hops, c.taskId AS taskId, c.until AS until
ORDER BY hops, path
`;

/** Active decisions that affect the area or a file within 2 hops. */
export const NEAR_DECISIONS = `
UNWIND $paths AS path
MATCH (f:File {path: path})
MATCH (d:Decision {status: 'active'})-[:AFFECTS]->(x:File)
WHERE x = f OR (NOT x.hub AND (f)-[:IMPORTS*1..2]-(x))
RETURN DISTINCT d.id AS id, d.text AS text, x.path AS path, CASE WHEN x = f THEN 0 ELSE 1 END AS hops
ORDER BY hops, id
`;

/** Lessons about the area, same hop rule as decisions. */
export const NEAR_LESSONS = `
UNWIND $paths AS path
MATCH (f:File {path: path})
MATCH (l:Lesson)-[:ABOUT]->(x:File)
WHERE x = f OR (NOT x.hub AND (f)-[:IMPORTS*1..2]-(x))
RETURN DISTINCT l.id AS id, l.text AS text, x.path AS path, CASE WHEN x = f THEN 0 ELSE 1 END AS hops
ORDER BY hops, id
`;

/** Newest events on the files themselves (not the neighbourhood). */
export const AREA_EVENTS = `
UNWIND $paths AS path
MATCH (e:Event)-[:ON]->(f:File {path: path})
OPTIONAL MATCH (e)-[:BY]->(a:Agent)
RETURN e.seq AS seq, e.kind AS kind, f.path AS path, a.id AS agentId
ORDER BY seq DESC
LIMIT 20
`;

export const AREA_TASKS = `
UNWIND $paths AS path
MATCH (t:Task {status: 'open'})-[:TOUCHES]->(:File {path: path})
RETURN DISTINCT t.id AS id, t.title AS title
ORDER BY id
`;

export const LATEST_HANDOFF = `
MATCH (src:Agent)-[h:HANDED_OFF]->(dst:Agent)
WHERE h.taskId = $taskId
RETURN h.note AS note, src.id AS fromId, dst.id AS toId
ORDER BY h.at DESC
LIMIT 1
`;

/** A lesson node. The record_lesson tool will call this later. */
export const LINK_LESSON = `
MERGE (l:Lesson {id: $id})
SET l.text = $text, l.at = $at
WITH l
UNWIND $paths AS path
MATCH (f:File {path: path})
MERGE (l)-[:ABOUT]->(f)
`;

export const LINK_HANDOFF = `
MATCH (src:Agent {id: $from}), (dst:Agent {id: $to})
CREATE (src)-[:HANDED_OFF {taskId: $taskId, note: $note, at: $at}]->(dst)
`;

function notes(rows: Record<string, unknown>[]): BriefNote[] {
  return rows.map((row) => ({
    id: String(row.id),
    text: String(row.text),
    path: String(row.path),
    hops: Number(row.hops),
  }));
}

/**
 * Q4. What a fresh agent needs about an area: claims, decisions, lessons,
 * recent events, open tasks, and the latest handoff note. Ranked by hop distance.
 */
export async function brief(
  g: SbGraph,
  input: { taskId?: string; prefix?: string; now?: number },
): Promise<Brief> {
  const now = input.now ?? Date.now();
  const fileRows = await g.roQuery(AREA_FILES, {
    taskId: input.taskId ?? null,
    prefix: input.prefix ?? null,
  });
  const files = fileRows.map((row) => String(row.path));
  if (files.length === 0) {
    return { files, claims: [], decisions: [], lessons: [], events: [], tasks: [], handoff: null };
  }

  const [claimRows, decisionRows, lessonRows, eventRows, taskRows] = await Promise.all([
    g.roQuery(NEAR_CLAIMS, { paths: files, now }),
    g.roQuery(NEAR_DECISIONS, { paths: files }),
    g.roQuery(NEAR_LESSONS, { paths: files }),
    g.roQuery(AREA_EVENTS, { paths: files }),
    g.roQuery(AREA_TASKS, { paths: files }),
  ]);

  let handoff: Brief["handoff"] = null;
  if (input.taskId) {
    const [row] = await g.roQuery(LATEST_HANDOFF, { taskId: input.taskId });
    if (row) handoff = { note: String(row.note), from: String(row.fromId), to: String(row.toId) };
  }

  return {
    files,
    claims: claimRows.map((row) => ({
      agent: String(row.agent),
      path: String(row.path),
      hops: Number(row.hops),
      taskId: typeof row.taskId === "string" ? row.taskId : null,
      until: Number(row.until),
    })),
    decisions: notes(decisionRows),
    lessons: notes(lessonRows),
    events: eventRows.map((row) => ({
      seq: Number(row.seq),
      kind: String(row.kind),
      path: String(row.path),
      agentId: typeof row.agentId === "string" ? row.agentId : null,
    })),
    tasks: taskRows.map((row) => ({
      id: String(row.id),
      title: typeof row.title === "string" ? row.title : null,
    })),
    handoff,
  };
}

/** Record a lesson about one or more files. */
export async function recordLesson(
  g: SbGraph,
  input: { text: string; paths: string[]; id?: string; now?: number; agent?: string },
): Promise<string> {
  const id = input.id ?? `l-${Date.now()}`;
  const at = input.now ?? Date.now();
  await g.query(LINK_LESSON, { id, text: input.text, at, paths: input.paths });
  await recordEvent(g, {
    kind: "lesson",
    agentId: input.agent,
    onPath: input.paths[0],
    payload: { id, text: input.text, paths: input.paths },
    now: at,
  });
  return id;
}

/** One agent hands a task to another, with a note the next briefing will show. */
export async function handoff(
  g: SbGraph,
  input: { from: string; to: string; taskId: string; note: string; now?: number },
): Promise<void> {
  const at = input.now ?? Date.now();
  await g.query(LINK_HANDOFF, { from: input.from, to: input.to, taskId: input.taskId, note: input.note, at });
  await recordEvent(g, {
    kind: "handoff",
    agentId: input.from,
    taskId: input.taskId,
    payload: { to: input.to, note: input.note },
    now: at,
  });
}

/** Plain text for a session-start hook. The graph rows stay the evidence. */
export function formatBrief(b: Brief): string {
  const lines = [`Files: ${b.files.join(", ") || "(none)"}`];
  for (const c of b.claims) lines.push(`Claim: ${c.agent} holds ${c.path} (${c.hops} hops)`);
  for (const d of b.decisions) lines.push(`Decision: ${d.text} (${d.path})`);
  for (const l of b.lessons) lines.push(`Lesson: ${l.text} (${l.path})`);
  for (const t of b.tasks) lines.push(`Open task: ${t.id}${t.title ? " " + t.title : ""}`);
  if (b.handoff) lines.push(`Handoff ${b.handoff.from} → ${b.handoff.to}: ${b.handoff.note}`);
  return lines.join("\n");
}
