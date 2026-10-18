import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, watch } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { SbGraph } from "../graph.js";
import { isSourcePath, parseFile, parseRepo, type ParsedImport, type ParseResult } from "../parser.js";
import { normPath } from "../paths.js";
import { recordEdit, type EditInput } from "./edits.js";
import { recordEvent } from "./events.js";
import { markHubs } from "./hubs.js";

const BATCH = 500;

/**
 * Upsert File nodes. `hub` and `rank` default to false/0 so queries can filter on
 * `NOT f.hub` (a missing property would be null, and `NOT null` filters the row out).
 * coalesce, not ON CREATE: a claim or an edit may have created the node first
 * (a claim's node for a file not parsed yet loses its `unparsed` flag here).
 * The PageRank job (Q6) sets the real values right after the load.
 */
export const UPSERT_FILES = `
UNWIND $rows AS row
MERGE (f:File {path: row.path})
SET f.lang = row.lang, f.loc = row.loc, f.hash = row.hash, f.unparsed = null,
    f.hub = coalesce(f.hub, false), f.rank = coalesce(f.rank, 0.0)
`;

/**
 * Remove files a previous parse loaded (they have a hash) that this parse no longer has.
 * Files created only by a claim or an edit have no hash and stay: an agent may claim
 * a file before it exists, and a claimed README or package.json (`unparsed`) is never parsed.
 * Only an explicit `switchboard parse` runs this: every worktree of a repo shares one graph, so a
 * file missing here may be another worktree's new file. Hooks only add and update (updateRepo).
 */
export const DELETE_STALE_FILES = `
MATCH (f:File)
WHERE f.hash IS NOT NULL AND NOT f.path IN $paths
DETACH DELETE f
`;

/**
 * Drop the imports a re-parsed file no longer has. Edges that are still there are
 * kept (and updated by UPSERT_IMPORTS), so a reader never sees a file lose all its imports.
 */
export const DELETE_STALE_IMPORTS = `
UNWIND $rows AS row
MATCH (:File {path: row.path})-[r:IMPORTS]->(t:File)
WHERE NOT t.path IN row.targets
DELETE r
`;

/** Upsert file→file import edges. Both ends exist after UPSERT_FILES. */
export const UPSERT_IMPORTS = `
UNWIND $rows AS row
MATCH (a:File {path: row.from}), (b:File {path: row.to})
MERGE (a)-[r:IMPORTS]->(b)
SET r.specifiers = row.specifiers, r.typeOnly = row.typeOnly
`;

/** Size of the code graph. */
export const CODE_GRAPH_COUNTS = `
MATCH (f:File)
WITH count(f) AS files
OPTIONAL MATCH (:File)-[r:IMPORTS]->(:File)
RETURN files, count(r) AS imports
`;

function batches<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) out.push(rows.slice(i, i + BATCH));
  return out;
}

/**
 * Load a full parse of the repo into the graph, replacing the previous one (`deleteStale: false` only adds
 * and updates, for a first load from a hook).
 * Idempotent: loading the same parse twice leaves the same nodes and edges.
 * Order: upsert files, delete files that are gone, delete imports that are gone,
 * upsert imports, recompute hubs, record one `parse` event. Each step is its own
 * query (batches of 500), so the whole load is not one transaction.
 */
export async function loadParse(
  g: SbGraph,
  parsed: ParseResult,
  opts: { deleteStale?: boolean } = {},
): Promise<{ files: number; imports: number }> {
  const targets = new Map<string, string[]>(parsed.files.map((f) => [f.path, []]));
  for (const i of parsed.imports) targets.get(i.from)?.push(i.to);

  for (const rows of batches(parsed.files)) await g.query(UPSERT_FILES, { rows });
  if (opts.deleteStale ?? true) await g.query(DELETE_STALE_FILES, { paths: [...targets.keys()] });
  const importRows = [...targets].map(([path, to]) => ({ path, targets: to }));
  for (const rows of batches(importRows)) await g.query(DELETE_STALE_IMPORTS, { rows });
  for (const rows of batches(parsed.imports)) await g.query(UPSERT_IMPORTS, { rows });
  await markHubs(g);

  const counts = { files: parsed.files.length, imports: parsed.imports.length };
  await recordEvent(g, { kind: "parse", payload: counts });
  return counts;
}

/**
 * Put the demo graph back to its starting state before the scenario replays, one
 * query per step: a chained `... WITH 1 AS _ MATCH ...` stops as soon as one step
 * matches nothing, which is how stray agents used to survive a reset.
 * Kept: the demo repo's File nodes and IMPORTS edges, agents A and B, and the
 * Meta seq counter, so seq never goes backwards for a live feed.
 * Dropped: files outside the demo repo (hook edits of this checkout), every claim,
 * every other agent, and the memory the scenario writes again (edits, events,
 * decisions, lessons, tasks).
 */
export const RESET_DEMO = [
  `MATCH (f:File)
   WHERE NOT (f.path STARTS WITH 'ui/' OR f.path STARTS WITH 'api/' OR f.path STARTS WITH 'auth/' OR f.path STARTS WITH 'lib/')
   DETACH DELETE f`,
  "MATCH ()-[c:CLAIMS]->() DELETE c",
  "MATCH (a:Agent) WHERE NOT a.id IN ['A', 'B'] DETACH DELETE a",
  "MATCH ()-[r:EDITED]->() DELETE r",
  "MATCH (e:Event) DETACH DELETE e",
  "MATCH (d:Decision) DETACH DELETE d",
  "MATCH (l:Lesson) DETACH DELETE l",
  "MATCH (t:Task) DETACH DELETE t",
];

export async function resetDemo(g: SbGraph): Promise<void> {
  for (const query of RESET_DEMO) await g.query(query);
}

/**
 * A fresh take on a live repo: every agent (with its claims, waits and edits), event, decision, lesson and task
 * goes; the code graph (File, IMPORTS) and the seq counter stay, so a dashboard's feed keeps counting up.
 */
export const CLEAR_ACTIVITY = ["MATCH (a:Agent) DETACH DELETE a", "MATCH (n) WHERE n:Event OR n:Decision OR n:Lesson OR n:Task DETACH DELETE n"];

export async function clearActivity(g: SbGraph): Promise<void> {
  for (const query of CLEAR_ACTIVITY) await g.query(query);
}

/** Which of these paths are File nodes already. */
export const FOUND_FILES = `
MATCH (f:File)
WHERE f.path IN $paths
RETURN collect(f.path) AS paths
`;

/** The paths that are not in the code graph, in input order. */
export async function missingFiles(g: SbGraph, paths: string[]): Promise<string[]> {
  const [row] = await g.roQuery(FOUND_FILES, { paths });
  const found = new Set((row?.paths as string[] | undefined) ?? []);
  return paths.filter((p) => !found.has(p));
}

/** Count File nodes and IMPORTS edges currently in the graph. */
export async function codeGraphCounts(g: SbGraph): Promise<{ files: number; imports: number }> {
  const [row] = await g.roQuery(CODE_GRAPH_COUNTS);
  return { files: Number(row?.files ?? 0), imports: Number(row?.imports ?? 0) };
}

/** One file's stored hash and outgoing imports, to tell whether a re-parse changed anything. */
export const FILE_IMPORTS = `
MATCH (f:File {path: $path})
RETURN f.hash AS hash,
       [(f)-[r:IMPORTS]->(t:File) | {to: t.path, specifiers: r.specifiers, typeOnly: r.typeOnly}] AS imports
`;

/**
 * Re-load one parsed file in one query, so a reader sees its old imports or its new ones, never half.
 * Same rules as a full load: upsert the File, drop the imports it no longer has, upsert the rest.
 * A target the graph has not seen yet (a file created a moment ago) is added without a hash, like a
 * claimed file; its own update fills it in.
 */
export const UPDATE_FILE = `
MERGE (f:File {path: $path})
SET f.lang = $lang, f.loc = $loc, f.hash = $hash, f.unparsed = null,
    f.hub = coalesce(f.hub, false), f.rank = coalesce(f.rank, 0.0)
WITH f
OPTIONAL MATCH (f)-[old:IMPORTS]->(t:File)
WHERE NOT t.path IN $targets
DELETE old
WITH DISTINCT f
UNWIND $imports AS row
MERGE (b:File {path: row.to})
ON CREATE SET b.hub = false, b.rank = 0.0
MERGE (f)-[r:IMPORTS]->(b)
SET r.specifiers = row.specifiers, r.typeOnly = row.typeOnly
`;

/** A file deleted from disk. Only a parsed file (it has a hash) goes; a claim-only node stays, as in a full load. */
export const DELETE_FILE = `
MATCH (f:File {path: $path})
WHERE f.hash IS NOT NULL
DETACH DELETE f
`;

export interface FileUpdate {
  /** Repo-relative path. */
  path: string;
  /** `skipped`: not a source file the parser loads (a README, a file under node_modules). */
  status: "created" | "updated" | "deleted" | "unchanged" | "skipped";
  /** Import targets gained and lost. */
  added: string[];
  removed: string[];
  /** Seq of the `graph` event, set when the import graph changed. */
  seq: number | null;
  ms: number;
}

type Edge = Pick<ParsedImport, "to" | "specifiers" | "typeOnly">;
const edgeKey = (e: Edge) => JSON.stringify([e.to, [...e.specifiers].sort(), e.typeOnly]);

/** Updates per file run one after another, so a slow older read never overwrites a newer one. */
const running = new Map<string, Promise<unknown>>();

/**
 * Re-parse one file of the repo at `root` and bring its File node and IMPORTS edges up to date:
 * new file → node + edges, changed imports → edges added and removed, deleted file → node removed.
 * When the import graph changed it records a `graph` event (not `parse`, which the dashboard reads as
 * the start of a demo run), so a live view refetches. Hubs are not re-marked here: callers batch that
 * with `hubMarker`. About 2 ms of parsing plus two queries.
 * ponytail: a file created after the file that imports it is linked on the importer's next save or the
 * next full parse; the import was unresolved when the importer was parsed.
 */
export async function updateFile(g: SbGraph, root: string, path: string, opts: { agentId?: string } = {}): Promise<FileUpdate> {
  const absRoot = resolve(root);
  const rel = relative(absRoot, resolve(absRoot, path)).split(sep).join("/");
  const key = `${g.name}\0${absRoot}\0${rel}`;
  const prev = running.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(() => applyFile(g, absRoot, rel, opts.agentId));
  running.set(key, next);
  try {
    return await next;
  } finally {
    if (running.get(key) === next) running.delete(key);
  }
}

async function applyFile(g: SbGraph, root: string, path: string, agentId: string | undefined): Promise<FileUpdate> {
  const started = performance.now();
  const done = (status: FileUpdate["status"], added: string[] = [], removed: string[] = [], seq: number | null = null): FileUpdate => ({
    path,
    status,
    added,
    removed,
    seq,
    ms: Math.round((performance.now() - started) * 10) / 10,
  });
  if (!isSourcePath(path)) return done("skipped");

  const parsed = parseFile(root, path);
  const [row] = await g.roQuery(FILE_IMPORTS, { path });
  const stored = row?.hash === undefined || row.hash === null ? null : String(row.hash);
  const before = ((row?.imports as Edge[] | undefined) ?? []).filter((e) => e.to !== null);

  const event = (status: FileUpdate["status"], added: string[], removed: string[], onPath?: string) =>
    recordEvent(g, { kind: "graph", payload: { path, status, added, removed }, agentId, onPath });

  if (!parsed) {
    if (!row || stored === null) return done("unchanged");
    await g.query(DELETE_FILE, { path });
    const removed = before.map((e) => e.to).sort();
    // No onPath: the event's ON link would MERGE the deleted File back.
    return done("deleted", [], removed, await event("deleted", [], removed));
  }

  const after = parsed.imports;
  const was = new Set(before.map(edgeKey));
  const edgesSame = after.length === before.length && after.every((e) => was.has(edgeKey(e)));
  if (stored === parsed.file.hash && edgesSame) return done("unchanged");

  await g.query(UPDATE_FILE, { ...parsed.file, targets: after.map((e) => e.to), imports: after });
  const status = stored === null ? "created" : "updated";
  const oldTargets = new Set(before.map((e) => e.to));
  const newTargets = new Set(after.map((e) => e.to));
  const added = [...newTargets].filter((t) => !oldTargets.has(t));
  const removed = [...oldTargets].filter((t) => !newTargets.has(t)).sort();
  if (status === "updated" && edgesSame) return done(status);
  return done(status, added, removed, await event(status, added, removed, path));
}

/** Every file this graph got from a parse (they have a hash). */
export const PARSED_PATHS = `
MATCH (f:File)
WHERE f.hash IS NOT NULL
RETURN f.path AS path
`;

/** Every parsed file's hash, to find the files on disk that differ. */
export const PARSED_HASHES = `
MATCH (f:File)
WHERE f.hash IS NOT NULL
RETURN f.path AS path, f.hash AS hash
`;

/** Files someone claims right now. */
export const CLAIMED_FILES = `
MATCH (:Agent)-[c:CLAIMS]->(f:File)
WHERE c.until > $now
RETURN DISTINCT f.path AS path
`;

/**
 * The cheap check a session start runs: source files of the git checkout at `root` that are new or whose text
 * differs from the graph's hash. No parser, one query. Null when the graph has no parsed file yet.
 * A file someone claims is left out: the agent editing it may be in another worktree, whose newer version
 * the graph holds. Throws outside a git checkout.
 */
export async function staleFiles(g: SbGraph, root: string, now = Date.now()): Promise<string[] | null> {
  const stored = new Map((await g.roQuery(PARSED_HASHES)).map((r) => [String(r.path), String(r.hash)]));
  if (stored.size === 0) return null;
  const claimed = new Set((await g.roQuery(CLAIMED_FILES, { now })).map((r) => String(r.path)));
  const listed = execFileSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  });
  const out: string[] = [];
  for (const path of listed.split("\0")) {
    if (!path || !isSourcePath(path) || claimed.has(path)) continue;
    let text: string;
    try {
      text = readFileSync(join(root, path), "utf8");
    } catch {
      continue; // listed by git but deleted on disk: hooks never delete another worktree's file
    }
    if (stored.get(path) !== createHash("sha1").update(text).digest("hex")) out.push(path);
  }
  return out;
}

/**
 * Bring the graph up to date with the checkout at `root` without deleting anything another worktree may
 * still have: `updateFile` for each of `paths` (a path gone from disk is a file this agent deleted, so its
 * node goes), or, with no paths, for every stale file (staleFiles), or a first full load when the graph
 * has no parsed file. Hubs are re-marked when an import changed. What the hooks run, in the background.
 */
export async function updateRepo(g: SbGraph, root: string, paths?: string[]): Promise<{ loaded: boolean; updates: FileUpdate[] }> {
  const abs = resolve(root);
  const todo = paths ?? (await staleFiles(g, abs));
  if (todo === null) {
    await loadParse(g, parseRepo(abs), { deleteStale: false });
    return { loaded: true, updates: [] };
  }
  const updates: FileUpdate[] = [];
  for (const p of todo) updates.push(await updateFile(g, abs, p));
  if (updates.some((u) => u.seq !== null)) await markHubs(g);
  return { loaded: false, updates };
}

/**
 * Is `root` the repo this graph was parsed from? True for a graph with no parsed files, or when at least
 * `share` of them are on disk under `root`. Default 0.9: a few files deleted while nothing watched still
 * pass, one shared path (lib/utils.ts is in most apps) does not. Check before per-file updates: against
 * the wrong directory every edited file would read as deleted and lose its node. Pass 1 before anything
 * that replaces the graph.
 */
export async function isRepoOf(g: SbGraph, root: string, share = 0.9): Promise<boolean> {
  const rows = await g.roQuery(PARSED_PATHS);
  const abs = resolve(root);
  return rows.filter((r) => existsSync(join(abs, String(r.path)))).length >= share * rows.length;
}

/**
 * An agent's edit, for the hook and the CLI: re-parse the file against `root` (the graph's repo, or null
 * to skip), then record the edit. A deleted file gets no EDITED edge: its MERGE would bring the File back
 * as a node with no hash. The `graph` event updateFile records (agent, path, deleted) is the edit's record.
 */
export async function recordLiveEdit(g: SbGraph, root: string | null, edit: EditInput): Promise<{ seq: number; graph: FileUpdate | null }> {
  const path = normPath(edit.path);
  const graph = root
    ? await updateFile(g, root, path, { agentId: edit.agentId }).catch((err: unknown) => {
        console.error(`re-parse ${path} failed:`, err instanceof Error ? err.message : err);
        return null;
      })
    : null;
  if (graph?.status === "deleted" && graph.seq !== null) return { seq: graph.seq, graph };
  return { seq: await recordEdit(g, { ...edit, path }), graph };
}

/**
 * markHubs at most once per `ms`, for a burst of per-file updates. PageRank runs over the whole graph,
 * so one run after the burst settles is enough; it reads the graph when it fires, so no change is missed.
 */
export function hubMarker(g: SbGraph, ms = 300): () => void {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      markHubs(g).catch((err: unknown) => console.error("markHubs failed:", err instanceof Error ? err.message : err));
    }, ms).unref();
  };
}

/**
 * Watch a repo and keep the graph live for every save, by agents or people: each changed source file
 * is re-parsed alone (`updateFile`) after `debounceMs` of quiet, and hubs are re-marked after a burst.
 * node_modules, dist, .git and other dot directories are ignored. Uses fs.watch's recursive mode
 * (macOS, Windows, Linux on Node 20+).
 */
export function watchRepo(
  g: SbGraph,
  root: string,
  opts: { debounceMs?: number; onUpdate?: (u: FileUpdate) => void; onError?: (err: unknown) => void } = {},
): { close(): void } {
  const absRoot = resolve(root);
  const hubs = hubMarker(g);
  const timers = new Map<string, NodeJS.Timeout>();
  const watcher = watch(absRoot, { recursive: true }, (_type, name) => {
    if (!name) return;
    const path = name.split(sep).join("/");
    if (!isSourcePath(path)) return;
    clearTimeout(timers.get(path));
    timers.set(
      path,
      setTimeout(() => {
        timers.delete(path);
        // Re-checked per save: another repo parsed into this graph later must not lose its nodes here.
        isRepoOf(g, absRoot)
          .then((mine) => (mine ? updateFile(g, absRoot, path) : null))
          .then((u) => {
            if (!u || u.status === "unchanged") return;
            if (u.seq !== null) hubs();
            opts.onUpdate?.(u);
          })
          .catch(opts.onError ?? ((err: unknown) => console.error(`update ${path} failed:`, err instanceof Error ? err.message : err)));
      }, opts.debounceMs ?? 150),
    );
  });
  return {
    close() {
      watcher.close();
      for (const t of timers.values()) clearTimeout(t);
    },
  };
}
