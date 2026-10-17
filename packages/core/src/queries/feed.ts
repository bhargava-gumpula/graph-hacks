import type { SbGraph } from "../graph.js";
import type { EventKind } from "./events.js";

export interface FeedItem {
  seq: number;
  kind: EventKind;
  at: number;
  /** Parsed from the JSON string stored on the Event. */
  payload: unknown;
  agentId: string | null;
  onLabel: string | null;
  onKey: string | null;
}

/**
 * Q8 event feed (read-only).
 * The MATCH is the plan's query. Aliases are explicit because the client
 * returns one object per row, keyed by the RETURN alias.
 */
export const FEED_SINCE = `
MATCH (e:Event)
WHERE e.seq > $last
OPTIONAL MATCH (e)-[:BY]->(a)
OPTIONAL MATCH (e)-[:ON]->(x)
RETURN e.seq AS seq,
       e.kind AS kind,
       e.at AS at,
       e.payload AS payload,
       a.id AS agentId,
       labels(x)[0] AS onLabel,
       coalesce(x.path, x.id) AS onKey
ORDER BY e.seq
LIMIT $limit
`;

/** Current counter. This is the last seq any writer has handed out. */
export const LATEST_SEQ = `
MATCH (m:Meta {key:'seq'})
RETURN m.value AS seq
`;

export const DEFAULT_FEED_LIMIT = 200;
const MAX_FEED_LIMIT = 1000;

/**
 * Events with `seq > last`, oldest first, at most `limit` (1..1000) per page.
 * Page by passing the last returned seq back in. Each seq is allocated and
 * written in one atomic query, so a lower seq can never show up after a
 * higher one was read: paging by seq never skips an event.
 */
export async function feedSince(
  g: SbGraph,
  last: number,
  limit = DEFAULT_FEED_LIMIT,
): Promise<FeedItem[]> {
  if (!Number.isFinite(last)) throw new RangeError(`last must be a number, got ${last}`);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_FEED_LIMIT) {
    throw new RangeError(`limit must be an integer 1..${MAX_FEED_LIMIT}, got ${limit}`);
  }
  const rows = await g.roQuery(FEED_SINCE, { last, limit });
  return rows.map(toFeedItem);
}

export async function latestSeq(g: SbGraph): Promise<number> {
  const rows = await g.roQuery(LATEST_SEQ);
  const seq = rows[0]?.seq;
  return typeof seq === "number" ? seq : 0;
}

function toFeedItem(row: Record<string, unknown>): FeedItem {
  return {
    seq: row.seq as number,
    kind: row.kind as EventKind,
    at: row.at as number,
    payload: parsePayload(row.payload),
    agentId: asString(row.agentId),
    onLabel: asString(row.onLabel),
    onKey: asString(row.onKey),
  };
}

/** A payload that isn't valid JSON comes back as the raw string, never throws. */
function parsePayload(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
