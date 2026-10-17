import type { SbGraph } from "../graph.js";

export interface MemoryHit {
  kind: "decision" | "lesson";
  id: string;
  text: string;
  /** A decision's reason; null for a lesson. */
  why: string | null;
  /** A decision's status ('active' or 'superseded'); null for a lesson. */
  status: string | null;
  /** Files the decision affects or the lesson is about. */
  paths: string[];
  /** The full-text score: higher is a better match. */
  score: number;
}

/**
 * Q7. Full-text search over decisions, through the FULLTEXT index on
 * Decision(text, why) that ensureSchema creates. Matching words in the reason
 * count as much as words in the decision itself. `$activeOnly` drops superseded ones.
 */
export const SEARCH_DECISIONS = `
CALL db.idx.fulltext.queryNodes('Decision', $q) YIELD node, score
WITH node, score WHERE NOT ($activeOnly AND node.status = 'superseded')
OPTIONAL MATCH (node)-[:AFFECTS]->(f:File)
WITH node, score, collect(f.path) AS paths
RETURN 'decision' AS kind, node.id AS id, node.text AS text, node.why AS why, node.status AS status, paths, score
ORDER BY score DESC, id
LIMIT $limit
`;

/** Q7 for lessons, through the FULLTEXT index on Lesson(text). */
export const SEARCH_LESSONS = `
CALL db.idx.fulltext.queryNodes('Lesson', $q) YIELD node, score
OPTIONAL MATCH (node)-[:ABOUT]->(f:File)
WITH node, score, collect(f.path) AS paths
RETURN 'lesson' AS kind, node.id AS id, node.text AS text, null AS why, null AS status, paths, score
ORDER BY score DESC, id
LIMIT $limit
`;

/** Words too common to say anything about a task. */
const STOP = new Set(
  "the and for with from this that into onto over under are was were has have had not but you your our its can will use when what then than all any".split(
    " ",
  ),
);

/**
 * Free text to the index's query syntax: plain words of 3+ letters or digits,
 * OR-ed so any one can match (the score ranks docs that match more, and rarer,
 * words higher). Punctuation never reaches the query, so user text cannot inject
 * operators. Null when nothing is left to search for.
 */
export function fulltextQuery(text: string): string | null {
  const words = [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])].filter((w) => !STOP.has(w));
  return words.length > 0 ? words.slice(0, 20).join("|") : null;
}

/**
 * Decisions and lessons that mention any of these words, best match first.
 * Superseded decisions are included (marked by `status`) unless `activeOnly`.
 */
export async function searchMemory(g: SbGraph, text: string, limit = 5, activeOnly = false): Promise<MemoryHit[]> {
  const q = fulltextQuery(text);
  if (!q) return [];
  const params = { q, limit, activeOnly };
  const rows = (await Promise.all([g.roQuery(SEARCH_DECISIONS, params), g.roQuery(SEARCH_LESSONS, params)])).flat();
  return rows
    .map((row) => ({
      kind: row.kind === "lesson" ? ("lesson" as const) : ("decision" as const),
      id: String(row.id),
      text: String(row.text),
      why: typeof row.why === "string" ? row.why : null,
      status: typeof row.status === "string" ? row.status : null,
      paths: (Array.isArray(row.paths) ? row.paths.map(String) : []).sort(),
      score: Number(row.score),
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** One line per hit for the CLI and MCP replies. A superseded decision says so. */
export function formatHit(h: MemoryHit): string {
  const mark = h.status === "superseded" ? " (superseded)" : "";
  const why = h.why ? `. Why: ${h.why}` : "";
  return `${h.kind} ${h.id}${mark}: ${h.text}${why}${h.paths.length ? ` (${h.paths.join(", ")})` : ""}`;
}
