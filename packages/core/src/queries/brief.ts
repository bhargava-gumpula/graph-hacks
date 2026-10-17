import { randomUUID } from "node:crypto";
import type { SbGraph } from "../graph.js";
import { recordEvent } from "./events.js";

/** How far (undirected import hops) a briefing looks around its files. */
const NEAR_HOPS = 2;
const EVENT_LIMIT = 20;

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
  /** The closest file this note is attached to. */
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

export interface BriefInput {
  /** A task: its planned files, files claimed under it, and files edited under it. */
  taskId?: string;
  /** Every file whose path starts with this (a directory). */
  prefix?: string;
  /** Explicit files. */
  paths?: string[];
  now?: number;
}

/** Resolve the area (task, prefix, paths; any mix) to the File paths it covers. */
export const AREA_FILES = `
MATCH (f:File)
WHERE ($prefix IS NOT NULL AND f.path STARTS WITH $prefix)
   OR f.path IN $paths
   OR ($taskId IS NOT NULL AND (
        (:Task {id: $taskId})-[:TOUCHES]->(f)
        OR (:Task {id: $taskId})<-[:UNDER]-(:Event)-[:ON]->(f)
        OR size([(:Agent)-[c:CLAIMS]->(f) WHERE c.taskId = $taskId | c]) > 0))
RETURN f.path AS path
ORDER BY path
`;

/**
 * The neighbourhood: every file within NEAR_HOPS import hops of the area, either
 * direction, with its distance (0 = in the area). As in Q1, multi-hop paths never
 * touch a hub, so lib/utils.ts does not pull the whole repo into every briefing.
 */
export const NEAR_FILES = `
UNWIND $paths AS path
MATCH (f:File {path: path})
MATCH p = (f)-[:IMPORTS*0..${NEAR_HOPS}]-(g:File)
WHERE length(p) = 0 OR none(n IN nodes(p) WHERE coalesce(n.hub, false))
RETURN g.path AS path, min(length(p)) AS hops
`;

/** Active claims on the neighbourhood, nearest first. */
export const NEAR_CLAIMS = `
UNWIND $near AS n
MATCH (a:Agent)-[c:CLAIMS]->(:File {path: n.path})
WHERE c.until > $now
RETURN a.id AS agent, n.path AS path, n.hops AS hops, c.taskId AS taskId, c.until AS until
ORDER BY hops, path, agent
`;

/** Active decisions on the neighbourhood, one row each at its closest file; newest first within a hop. */
export const NEAR_DECISIONS = `
UNWIND $near AS n
MATCH (d:Decision {status: 'active'})-[:AFFECTS]->(:File {path: n.path})
WITH d, n ORDER BY n.hops, n.path
WITH d, collect(n)[0] AS best
RETURN d.id AS id, d.text AS text, best.path AS path, best.hops AS hops
ORDER BY hops, d.at DESC, id
`;

/** Lessons on the neighbourhood, same ranking as decisions. */
export const NEAR_LESSONS = `
UNWIND $near AS n
MATCH (l:Lesson)-[:ABOUT]->(:File {path: n.path})
WITH l, n ORDER BY n.hops, n.path
WITH l, collect(n)[0] AS best
RETURN l.id AS id, l.text AS text, best.path AS path, best.hops AS hops
ORDER BY hops, l.at DESC, id
`;

/** Newest events on the area's own files, including a dead agent's edits. */
export const AREA_EVENTS = `
UNWIND $paths AS path
MATCH (e:Event)-[:ON]->(:File {path: path})
OPTIONAL MATCH (e)-[:BY]->(a:Agent)
RETURN e.seq AS seq, e.kind AS kind, path, a.id AS agentId
ORDER BY seq DESC
LIMIT ${EVENT_LIMIT}
`;

/** Unfinished tasks that plan to touch the area. */
export const AREA_TASKS = `
UNWIND $paths AS path
MATCH (t:Task)-[:TOUCHES]->(:File {path: path})
WHERE coalesce(t.status, 'open') <> 'done'
RETURN DISTINCT t.id AS id, t.title AS title
ORDER BY id
`;

/** The latest handoff note for any of these tasks. */
export const LATEST_HANDOFF = `
MATCH (src:Agent)-[h:HANDED_OFF]->(dst:Agent)
WHERE h.taskId IN $taskIds
RETURN h.note AS note, src.id AS fromId, dst.id AS toId
ORDER BY h.at DESC
LIMIT 1
`;

/** A lesson node and the files it is about. Unknown paths are skipped. */
export const LINK_LESSON = `
MERGE (l:Lesson {id: $id})
SET l.text = $text, l.at = $at
WITH l
UNWIND $paths AS path
MATCH (f:File {path: path})
MERGE (l)-[:ABOUT]->(f)
`;

/** Either agent may not have registered yet (a replacement often hasn't), so MERGE both. */
export const LINK_HANDOFF = `
MERGE (src:Agent {id: $from})
MERGE (dst:Agent {id: $to})
CREATE (src)-[:HANDED_OFF {taskId: $taskId, note: $note, at: $at}]->(dst)
`;

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function notes(rows: Record<string, unknown>[]): BriefNote[] {
  return rows.map((row) => ({
    id: String(row.id),
    text: String(row.text),
    path: String(row.path),
    hops: Number(row.hops),
  }));
}

const EMPTY: Omit<Brief, "files"> = { claims: [], decisions: [], lessons: [], events: [], tasks: [], handoff: null };

/**
 * Q4. What a fresh or replacement agent needs about an area: claims, decisions,
 * lessons, recent events, open tasks and the latest handoff note. Claims, decisions
 * and lessons are ranked by import-hop distance from the area, then by recency.
 */
export async function brief(g: SbGraph, input: BriefInput): Promise<Brief> {
  const now = input.now ?? Date.now();
  const fileRows = await g.roQuery(AREA_FILES, {
    taskId: input.taskId || null,
    prefix: input.prefix || null,
    paths: input.paths ?? [],
  });
  const files = fileRows.map((row) => String(row.path));
  if (files.length === 0) {
    // A task with no files can still have a handoff note.
    const handoff = input.taskId ? await latestHandoff(g, [input.taskId]) : null;
    return { files, ...EMPTY, handoff };
  }

  const near = (await g.roQuery(NEAR_FILES, { paths: files })).map((row) => ({
    path: String(row.path),
    hops: Number(row.hops),
  }));
  const [claimRows, decisionRows, lessonRows, eventRows, taskRows] = await Promise.all([
    g.roQuery(NEAR_CLAIMS, { near, now }),
    g.roQuery(NEAR_DECISIONS, { near }),
    g.roQuery(NEAR_LESSONS, { near }),
    g.roQuery(AREA_EVENTS, { paths: files }),
    g.roQuery(AREA_TASKS, { paths: files }),
  ]);

  const tasks = taskRows.map((row) => ({ id: String(row.id), title: str(row.title) }));
  const taskIds = [...new Set([...(input.taskId ? [input.taskId] : []), ...tasks.map((t) => t.id)])];

  return {
    files,
    claims: claimRows.map((row) => ({
      agent: String(row.agent),
      path: String(row.path),
      hops: Number(row.hops),
      taskId: str(row.taskId),
      until: Number(row.until),
    })),
    decisions: notes(decisionRows),
    lessons: notes(lessonRows),
    events: eventRows.map((row) => ({
      seq: Number(row.seq),
      kind: String(row.kind),
      path: String(row.path),
      agentId: str(row.agentId),
    })),
    tasks,
    handoff: await latestHandoff(g, taskIds),
  };
}

async function latestHandoff(g: SbGraph, taskIds: string[]): Promise<Brief["handoff"]> {
  if (taskIds.length === 0) return null;
  const [row] = await g.roQuery(LATEST_HANDOFF, { taskIds });
  return row ? { note: String(row.note), from: String(row.fromId), to: String(row.toId) } : null;
}

/** Record a lesson about one or more files. Returns its id. */
export async function recordLesson(
  g: SbGraph,
  input: { text: string; paths: string[]; id?: string; now?: number; agent?: string },
): Promise<string> {
  const id = input.id ?? `l-${randomUUID()}`;
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

const hopLabel = (hops: number) => (hops === 0 ? "here" : `${hops} hop${hops === 1 ? "" : "s"} away`);

/** Plain text for a session-start hook or an MCP reply. The graph rows stay the evidence. */
export function formatBrief(b: Brief): string {
  const lines = [`Files: ${b.files.join(", ") || "(none)"}`];
  if (b.handoff) lines.push(`Handoff ${b.handoff.from} → ${b.handoff.to}: ${b.handoff.note}`);
  for (const c of b.claims) {
    lines.push(`Claim: ${c.agent} holds ${c.path} (${hopLabel(c.hops)}${c.taskId ? `, task ${c.taskId}` : ""})`);
  }
  for (const d of b.decisions) lines.push(`Decision: ${d.text} (${d.path}, ${hopLabel(d.hops)})`);
  for (const l of b.lessons) lines.push(`Lesson: ${l.text} (${l.path}, ${hopLabel(l.hops)})`);
  for (const t of b.tasks) lines.push(`Open task: ${t.id}${t.title && t.title !== t.id ? ` ${t.title}` : ""}`);
  for (const e of b.events.filter((e) => e.kind === "edit").slice(0, 5)) {
    lines.push(`Recent edit: ${e.path} by ${e.agentId ?? "unknown"} (#${e.seq})`);
  }
  return lines.join("\n");
}
