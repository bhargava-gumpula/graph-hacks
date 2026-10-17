import type { SbGraph } from "../graph.js";
import type { ParseResult } from "../parser.js";
import { recordEvent } from "./events.js";
import { markHubs } from "./hubs.js";

const BATCH = 500;

/**
 * Upsert File nodes. `hub` and `rank` default to false/0 so queries can filter on
 * `NOT f.hub` (a missing property would be null, and `NOT null` filters the row out).
 * coalesce, not ON CREATE: a claim or an edit may have created the node first.
 * The PageRank job (Q6) sets the real values right after the load.
 */
export const UPSERT_FILES = `
UNWIND $rows AS row
MERGE (f:File {path: row.path})
SET f.lang = row.lang, f.loc = row.loc, f.hash = row.hash,
    f.hub = coalesce(f.hub, false), f.rank = coalesce(f.rank, 0.0)
`;

/**
 * Remove files a previous parse loaded (they have a hash) that this parse no longer has.
 * Files created only by a claim or an edit have no hash and stay: an agent may claim
 * a file before it exists.
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
 * Load a full parse of the repo into the graph, replacing the previous one.
 * Idempotent: loading the same parse twice leaves the same nodes and edges.
 * Order: upsert files, delete files that are gone, delete imports that are gone,
 * upsert imports, recompute hubs, record one `parse` event. Each step is its own
 * query (batches of 500), so the whole load is not one transaction.
 */
export async function loadParse(g: SbGraph, parsed: ParseResult): Promise<{ files: number; imports: number }> {
  const targets = new Map<string, string[]>(parsed.files.map((f) => [f.path, []]));
  for (const i of parsed.imports) targets.get(i.from)?.push(i.to);

  for (const rows of batches(parsed.files)) await g.query(UPSERT_FILES, { rows });
  await g.query(DELETE_STALE_FILES, { paths: [...targets.keys()] });
  const importRows = [...targets].map(([path, to]) => ({ path, targets: to }));
  for (const rows of batches(importRows)) await g.query(DELETE_STALE_IMPORTS, { rows });
  for (const rows of batches(parsed.imports)) await g.query(UPSERT_IMPORTS, { rows });
  await markHubs(g);

  const counts = { files: parsed.files.length, imports: parsed.imports.length };
  await recordEvent(g, { kind: "parse", payload: counts });
  return counts;
}

/** Drop files and agents that are not part of the demo repo. Hook edits of this checkout must not appear on the demo canvas. */
export const RESET_DEMO_EXTRAS = `
MATCH (f:File)
WHERE NOT (f.path STARTS WITH 'ui/' OR f.path STARTS WITH 'api/' OR f.path STARTS WITH 'auth/' OR f.path STARTS WITH 'lib/')
DETACH DELETE f
WITH 1 AS _
MATCH (a:Agent)
WHERE NOT a.id IN ['A', 'B']
DETACH DELETE a
`;

/** Count File nodes and IMPORTS edges currently in the graph. */
export async function codeGraphCounts(g: SbGraph): Promise<{ files: number; imports: number }> {
  const [row] = await g.roQuery(CODE_GRAPH_COUNTS);
  return { files: Number(row?.files ?? 0), imports: Number(row?.imports ?? 0) };
}
