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

export { agentId } from "./agent-id.js";

export { heartbeat, registerAgent, status } from "./queries/agents.js";
export type { AgentKind, AgentView, StatusClaim, StatusResult } from "./queries/agents.js";

export { markHubs, HUB_INDEGREE } from "./queries/hubs.js";
export type { HubScore } from "./queries/hubs.js";

export { blastRadius } from "./queries/blast.js";
export type { BlastRadius, Dependent } from "./queries/blast.js";

export { parallelBatches, planTask } from "./queries/schedule.js";
export type { Batch } from "./queries/schedule.js";

export { recordDecision, whyTrace } from "./queries/why.js";
export type { WhyHit } from "./queries/why.js";

export { brief, formatBrief, handoff, recordLesson } from "./queries/brief.js";
export type { Brief } from "./queries/brief.js";
