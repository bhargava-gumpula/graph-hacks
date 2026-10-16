import type { SbGraph } from "../graph.js";

/**
 * A file imported this many times is a hub (lib/utils.ts is imported by 20).
 * Hubs stay in the graph, but multi-hop conflict and blast paths skip them,
 * or every file would look connected.
 */
export const HUB_INDEGREE = 10;

/**
 * Q6. PageRank scores the import graph (rank flows toward files others import).
 * `hub` is the simple rule on top: in-degree >= HUB_INDEGREE.
 */
export const MARK_HUBS = `
CALL algo.pageRank('File', 'IMPORTS') YIELD node, score
SET node.rank = score
WITH node, score
OPTIONAL MATCH (d:File)-[:IMPORTS]->(node)
WITH node, count(d) AS indegree
SET node.hub = indegree >= $minDegree
RETURN node.path AS path, node.rank AS rank, indegree, node.hub AS hub
ORDER BY rank DESC
`;

export interface HubScore {
  path: string;
  rank: number;
  indegree: number;
  hub: boolean;
}

export const MARK_FILE_HUB = `
MATCH (f:File {path: $path})
SET f.hub = true
`;

/** Recompute rank and hub flags. Call after every parse. */
export async function markHubs(g: SbGraph): Promise<HubScore[]> {
  const rows = await g.query(MARK_HUBS, { minDegree: HUB_INDEGREE });
  return rows.map((row) => ({
    path: String(row.path),
    rank: Number(row.rank),
    indegree: Number(row.indegree),
    hub: Boolean(row.hub),
  }));
}
