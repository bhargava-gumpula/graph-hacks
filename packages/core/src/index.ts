export const SWITCHBOARD_VERSION = "0.0.0";

export { connect } from "./graph.js";
export type { ConnectOptions, QueryOptions, SbGraph } from "./graph.js";

export { ensureSchema } from "./queries/schema.js";

export { recordEvent } from "./queries/events.js";
export type { EventInput, EventKind } from "./queries/events.js";

export { feedSince, latestSeq } from "./queries/feed.js";
export type { FeedItem } from "./queries/feed.js";

export { recordEdit } from "./queries/edits.js";
export type { EditInput } from "./queries/edits.js";

export { parseRepo } from "./parser.js";
export type { ParsedFile, ParsedImport, ParseResult } from "./parser.js";

export { codeGraphCounts, loadParse } from "./queries/loader.js";

export { findConflicts, conflictQuery } from "./queries/conflict.js";
export type { Conflict, ConflictInput, ConflictType } from "./queries/conflict.js";

export { claim, release, DEFAULT_TTL_MS } from "./queries/claims.js";
export type { ClaimInput, ClaimResult } from "./queries/claims.js";

export { graphSnapshot, listClaims } from "./queries/snapshot.js";
export type { ActiveClaim, GraphEdge, GraphNode, GraphSnapshot } from "./queries/snapshot.js";
