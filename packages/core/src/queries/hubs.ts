import type { SbGraph } from "../graph.js";

/**
 * Hub thresholds. A hub is a file so widely imported that a path through it says
 * nothing (every file reaches every other through lib/utils.ts). Hubs stay in the
 * graph, but multi-hop conflict, blast and schedule paths skip them; hop 0 (the
 * same file) still counts.
 *
 * A file is a hub when either rule holds:
 *  - PageRank: its score is at least HUB_RANK_FACTOR times the average file's.
 *    Scores sum to about 1, so the average is about 1/N and the rule scales with
 *    repo size. HUB_MIN_INDEGREE stops a tiny repo from calling a file with two
 *    importers a hub.
 *  - In-degree: HUB_INDEGREE or more files import it. The absolute backstop a
 *    person can check by hand ("imported by 10+ files").
 * On the demo repo lib/utils.ts scores 8.5x the average (20 importers); the next
 * file scores 1.6x (2 importers). Both rules pick utils alone.
 */
export const HUB_INDEGREE = 10;
export const HUB_RANK_FACTOR = 4;
export const HUB_MIN_INDEGREE = 3;

/**
 * Q6. `algo.pageRank(label, relType)` scores every File over IMPORTS (rank flows
 * toward what others import). Store the score, then flag hubs by the rules above.
 */
export const MARK_HUBS = `
CALL algo.pageRank('File', 'IMPORTS') YIELD node, score
SET node.rank = score
WITH collect(node) AS files, avg(score) AS mean
UNWIND files AS f
OPTIONAL MATCH (d:File)-[:IMPORTS]->(f)
WITH f, mean, count(d) AS indegree
SET f.hub = indegree >= $minDegree OR (indegree >= $floor AND f.rank >= $factor * mean)
RETURN f.path AS path, f.rank AS rank, indegree, f.hub AS hub
ORDER BY rank DESC, path
`;

export interface HubScore {
  path: string;
  rank: number;
  indegree: number;
  hub: boolean;
}

export const COUNT_FILES = `
MATCH (f:File)
RETURN count(f) AS n
`;

/** Recompute rank and hub flags for every file. `loadParse` calls this after each parse. */
export async function markHubs(g: SbGraph): Promise<HubScore[]> {
  // algo.pageRank errors on a graph with no File nodes.
  const [count] = await g.roQuery(COUNT_FILES);
  if (Number(count?.n ?? 0) === 0) return [];
  const rows = await g.query(MARK_HUBS, {
    minDegree: HUB_INDEGREE,
    floor: HUB_MIN_INDEGREE,
    factor: HUB_RANK_FACTOR,
  });
  return rows.map((row) => ({
    path: String(row.path),
    rank: Number(row.rank),
    indegree: Number(row.indegree),
    hub: Boolean(row.hub),
  }));
}
