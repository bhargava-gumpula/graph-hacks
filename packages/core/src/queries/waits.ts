// A refusal becomes coordination: the refused agent waits for the file that blocked it, the holder is
// told someone waits, and the waiter is told when the file is free.
//   (:Agent)-[:WAITS_FOR {since, path, holder, via, told, freedAt}]->(:File)
// The edge points at the file the holder claims; its `path` is the file the waiter wanted (to retry).
// Events: `wait` {agent, path, holder, via} and `free` {path, waiters}, where `path` is the held file.
import type { SbGraph } from "../graph.js";
import type { Conflict } from "./conflict.js";
import { readSeq, RECORD_EVENT } from "./events.js";

/** Start (or keep) waiting. `fresh` is true only the first time, so a re-refusal adds no event. */
export const WAIT_FOR = `
MERGE (a:Agent {id: $agent})
ON CREATE SET a.status = 'active', a.startedAt = $at
MERGE (f:File {path: $held})
ON CREATE SET f.hub = false, f.rank = 0.0
MERGE (a)-[w:WAITS_FOR]->(f)
ON CREATE SET w.since = $at
SET w.path = $wanted, w.holder = $holder, w.via = $via, w.freedAt = null
RETURN w.since = $at AS fresh
`;

/** Waits on files this agent holds that it has not been told about. Marks them told. */
export const TELL_HOLDER = `
MATCH (me:Agent {id: $agent})-[c:CLAIMS]->(f:File)<-[w:WAITS_FOR]-(o:Agent)
WHERE c.until > $now AND o.id <> $agent AND w.told IS NULL
SET w.told = $now
RETURN o.id AS waiter, f.path AS held, w.path AS wanted, w.via AS via
`;

/** This agent's waits on files nobody else holds now (released, or the claim expired). */
export const FREE_FOR = `
MATCH (me:Agent {id: $agent})-[w:WAITS_FOR]->(f:File)
OPTIONAL MATCH (o:Agent)-[c:CLAIMS]->(f)
WHERE o.id <> $agent AND c.until > $now
WITH w, f, count(c) AS holders
WHERE holders = 0
RETURN f.path AS held, w.path AS wanted, w.freedAt AS freedAt
`;

/** Mark every open wait on a file freed; returns who was waiting. */
export const MARK_FREED = `
MATCH (o:Agent)-[w:WAITS_FOR]->(f:File {path: $path})
WHERE w.freedAt IS NULL
SET w.freedAt = $now
RETURN collect(o.id) AS waiters
`;

/** Files an agent holds (all, or `$paths`) that someone waits on: they become free on release. */
export const WAITED_ON = `
MATCH (a:Agent {id: $agent})-[:CLAIMS]->(f:File)<-[w:WAITS_FOR]-(o:Agent)
WHERE ($paths IS NULL OR f.path IN $paths) AND w.freedAt IS NULL AND o.id <> $agent
RETURN DISTINCT f.path AS path
`;

const DROP_WAITS = `
MATCH (a:Agent {id: $agent})-[w:WAITS_FOR]->(f:File)
WHERE $paths IS NULL OR f.path IN $paths
DELETE w
`;

export interface Waiting {
  waiter: string;
  held: string;
  wanted: string;
  via: string[];
}

export interface Notices {
  /** Others now waiting on files this agent holds (each told once). */
  waiting: Waiting[];
  /** Files this agent waited on that are free now; the waits are gone. */
  freed: { held: string; wanted: string }[];
}

async function event(g: SbGraph, kind: "wait" | "free", payload: unknown, agentId: string | null, onPath: string, now: number) {
  const rows = await g.query(RECORD_EVENT, { kind, at: now, payload: JSON.stringify(payload), agentId, onPath, taskId: null, via: [] });
  return readSeq(rows, kind);
}

/** A refused agent waits on each claimed file that blocked it. Records a `wait` event per new wait. */
export async function recordWaits(g: SbGraph, input: { agent: string; conflicts: Conflict[]; now?: number }): Promise<number> {
  const now = input.now ?? Date.now();
  let started = 0;
  const seen = new Set<string>();
  for (const c of input.conflicts) {
    if (c.agent === input.agent || seen.has(c.claimed)) continue;
    seen.add(c.claimed);
    const rows = await g.query(WAIT_FOR, { agent: input.agent, held: c.claimed, wanted: c.file, holder: c.agent, via: c.path, at: now });
    if (rows[0]?.fresh !== true) continue;
    started++;
    await event(g, "wait", { agent: input.agent, path: c.claimed, holder: c.agent, via: c.path }, input.agent, c.claimed, now);
  }
  return started;
}

/** Record one `free` event for a file people wait on, unless a release already did. */
async function markFreed(g: SbGraph, path: string, now: number): Promise<void> {
  const waiters = ((await g.query(MARK_FREED, { path, now }))[0]?.waiters ?? []) as string[];
  if (waiters.length > 0) await event(g, "free", { path, waiters }, null, path, now);
}

/** Before a release: the files about to be released that someone waits on. */
export async function waitedOn(g: SbGraph, agent: string, paths: string[] | null): Promise<string[]> {
  return (await g.roQuery(WAITED_ON, { agent, paths })).map((r) => String(r.path));
}

/** After a release: a `free` event for each released file someone waited on. */
export async function freeFiles(g: SbGraph, paths: string[], now = Date.now()): Promise<void> {
  for (const p of paths) await markFreed(g, p, now);
}

/** Stop waiting (on `paths`, or on everything: the session ended). */
export async function dropWaits(g: SbGraph, agent: string, paths: string[] | null = null): Promise<void> {
  await g.query(DROP_WAITS, { agent, paths });
}

/**
 * What an agent should hear on its next hook call: who waits on its files (once per wait), and which
 * files it waited on are free now. A freed wait is removed; a claim that simply expired gets its
 * `free` event here, when it is first noticed.
 */
export async function waitNotices(g: SbGraph, agent: string, now = Date.now()): Promise<Notices> {
  const waiting = (await g.query(TELL_HOLDER, { agent, now })).map((r) => ({
    waiter: String(r.waiter),
    held: String(r.held),
    wanted: String(r.wanted),
    via: (r.via ?? []) as string[],
  }));
  const rows = await g.roQuery(FREE_FOR, { agent, now });
  for (const r of rows) if (r.freedAt == null) await markFreed(g, String(r.held), now);
  const freed = rows.map((r) => ({ held: String(r.held), wanted: String(r.wanted) }));
  if (freed.length > 0) await dropWaits(g, agent, freed.map((f) => f.held));
  return { waiting, freed };
}

/** The notices as plain sentences for the agent's context. `me` is the agent being told. */
export function formatNotices(n: Notices, me: string): string {
  const lines: string[] = [];
  for (const w of n.waiting) {
    if (w.wanted === w.held) {
      lines.push(`${w.waiter} is waiting on ${w.held}, which you hold. Release it when you're done: switchboard release ${w.held} --agent ${me}`);
      continue;
    }
    const hops = Math.max(w.via.length - 1, 1);
    lines.push(
      `${w.waiter} is waiting on ${w.held}: it wants ${w.wanted}, ${hops} import${hops === 1 ? "" : "s"} from your claim. ` +
        `Release it when you're done: switchboard release ${w.held} --agent ${me}`,
    );
  }
  for (const f of n.freed) {
    lines.push(f.wanted === f.held ? `${f.held} is free now; you can retry.` : `${f.held} is free now; you can retry ${f.wanted}.`);
  }
  return lines.join("\n");
}
