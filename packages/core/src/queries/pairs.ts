import type { SbGraph } from "../graph.js";

/** The census looks as far as the conflict check does by default. */
export const CENSUS_HOPS = 3;

/**
 * Q-pairs. Every pair of files joined by IMPORTS within 3 hops, in either direction,
 * with its fewest hops, counted per hop. A pair is unordered ({a, b} once, however
 * many paths join them, whichever file imports the other), because a conflict does
 * not care who imports whom. Hubs are skipped only as interior nodes
 * (`nodes(p)[1..-1]`): a hub may be an end of the pair, a path may not run through one.
 */
export const PAIRS_BY_HOP = `
MATCH p = (a:File)-[:IMPORTS*1..${CENSUS_HOPS}]->(b:File)
WHERE a <> b AND none(n IN nodes(p)[1..-1] WHERE coalesce(n.hub, false))
WITH CASE WHEN a.path < b.path THEN a.path ELSE b.path END AS lo,
     CASE WHEN a.path < b.path THEN b.path ELSE a.path END AS hi,
     min(length(p)) AS hops
RETURN hops, count(*) AS pairs
ORDER BY hops
`;

export const COUNT_FILES = `
MATCH (f:File)
RETURN count(f) AS n
`;

export interface PairCensus {
  files: number;
  /** All unordered pairs of distinct files: files * (files - 1) / 2. */
  pairs: number;
  /**
   * Pairs a file lock can see. A lock collides only on the same path, and a pair is two
   * different files, so this is 0 by definition, not a measurement.
   */
  lock: number;
  /** Pairs where one file imports the other directly. */
  oneHop: number;
  /** Pairs joined by imports within 3 hops: the ones the graph can see. */
  graph: number;
  /** graph - oneHop: pairs 2 or 3 hops apart, which a one-hop check misses. */
  hidden: number;
  byHop: { hops: number; pairs: number }[];
}

/** How many file pairs a lock, a one-hop check and the import graph can each see. */
export async function pairCensus(g: SbGraph): Promise<PairCensus> {
  const [count] = await g.roQuery(COUNT_FILES);
  const files = Number(count?.n ?? 0);
  const byHop = (await g.roQuery(PAIRS_BY_HOP)).map((row) => ({ hops: Number(row.hops), pairs: Number(row.pairs) }));
  const graph = byHop.reduce((sum, row) => sum + row.pairs, 0);
  const oneHop = byHop.find((row) => row.hops === 1)?.pairs ?? 0;
  return { files, pairs: (files * Math.max(files - 1, 0)) / 2, lock: 0, oneHop, graph, hidden: graph - oneHop, byHop };
}
