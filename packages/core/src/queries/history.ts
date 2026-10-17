import type { SbGraph } from "../graph.js";

export interface Hotspot {
  path: string;
  /** Refusals in the window whose import path ran through this file. */
  refusals: number;
  /** Epoch ms of the newest one. */
  lastAt: number;
}

/**
 * Q8. Refusal hotspots: the files that sit on the most refused import paths since
 * `$since`. Each conflict event links every file on its path with VIA, so a file
 * that keeps turning up in the middle of refusals (not just the one asked for) shows here.
 */
export const HOTSPOTS = `
MATCH (e:Event)-[:VIA]->(f:File)
WHERE e.kind = 'conflict' AND e.at >= $since
RETURN f.path AS path, count(DISTINCT e) AS refusals, max(e.at) AS lastAt
ORDER BY refusals DESC, lastAt DESC, path
LIMIT $limit
`;

const DAY_MS = 86_400_000;

/** Files on the most refused paths in the last `days` days, most refused first. */
export async function hotspots(
  g: SbGraph,
  input: { days?: number; limit?: number; now?: number } = {},
): Promise<Hotspot[]> {
  const days = input.days ?? 7;
  const limit = input.limit ?? 10;
  if (!(days > 0)) throw new Error(`days must be positive, got ${days}`);
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`limit must be a positive integer, got ${limit}`);
  const since = (input.now ?? Date.now()) - days * DAY_MS;
  const rows = await g.roQuery(HOTSPOTS, { since, limit });
  return rows.map((row) => ({ path: String(row.path), refusals: Number(row.refusals), lastAt: Number(row.lastAt) }));
}
