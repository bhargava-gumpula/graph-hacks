import type { SbGraph } from "../graph.js";
import type { ParseResult } from "../parser.js";
import { recordEvent } from "./events.js";
import { markHubs } from "./hubs.js";

const BATCH = 500;

/**
 * Upsert File nodes. `hub` and `rank` start as false/0 so queries can filter on
 * `NOT f.hub` (a missing property would be null, and `NOT null` filters the row out).
 * The PageRank job (Q6) sets the real values later.
 */
export const UPSERT_FILES = `
UNWIND $rows AS row
MERGE (f:File {path: row.path})
ON CREATE SET f.hub = false, f.rank = 0.0
SET f.lang = row.lang, f.loc = row.loc, f.hash = row.hash
`;

/** Drop the outgoing imports of re-parsed files, so a removed import disappears. */
export const CLEAR_IMPORTS = `
UNWIND $paths AS p
MATCH (:File {path: p})-[r:IMPORTS]->()
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
 * Load a parse into the graph. Idempotent: loading the same parse twice leaves the
 * same nodes and edges. Runs files first, then clears and re-adds imports, then
 * records one `parse` event. The passes are separate queries, so a reader can
 * briefly see a file with no imports while a re-parse runs.
 */
export async function loadParse(g: SbGraph, parsed: ParseResult): Promise<{ files: number; imports: number }> {
  for (const rows of batches(parsed.files)) await g.query(UPSERT_FILES, { rows });
  for (const rows of batches(parsed.files)) await g.query(CLEAR_IMPORTS, { paths: rows.map((f) => f.path) });
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
