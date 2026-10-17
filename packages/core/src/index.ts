export const SWITCHBOARD_VERSION = "0.0.0";

export { clientOptions, connect, locate, redactUrl } from "./graph.js";
export type { ConnectOptions, DbLocation, QueryOptions, SbGraph } from "./graph.js";

export { normPath } from "./paths.js";

export { ensureSchema } from "./queries/schema.js";

export { recordEvent, viaPaths } from "./queries/events.js";
export type { EventInput, EventKind } from "./queries/events.js";

export { DEFAULT_FEED_LIMIT, feedSince, latestSeq } from "./queries/feed.js";
export type { FeedItem } from "./queries/feed.js";

export { recordEdit, recordEditAndCheck } from "./queries/edits.js";
export type { EditInput, EditResult } from "./queries/edits.js";

export { isSourcePath, parseFile, parseRepo } from "./parser.js";
export type { ParsedFile, ParsedImport, ParseResult } from "./parser.js";

export { codeGraphCounts, hubMarker, isRepoOf, loadParse, missingFiles, recordLiveEdit, resetDemo, updateFile, watchRepo } from "./queries/loader.js";
export type { FileUpdate } from "./queries/loader.js";

export { findConflicts, conflictQuery, conflictGuard } from "./queries/conflict.js";
export type { Conflict, ConflictInput, ConflictType } from "./queries/conflict.js";

export { claim, claimQuery, release, unknownPaths, DEFAULT_TTL_MS } from "./queries/claims.js";
export type { ClaimInput, ClaimResult } from "./queries/claims.js";

export { graphSnapshot, listClaims } from "./queries/snapshot.js";
export type { ActiveClaim, GraphEdge, GraphNode, GraphSnapshot } from "./queries/snapshot.js";

export { agentId } from "./agent-id.js";

export { heartbeat, registerAgent, status } from "./queries/agents.js";
export type { AgentKind, AgentView, StatusClaim, StatusResult } from "./queries/agents.js";

export { markHubs, HUB_INDEGREE, MARK_HUBS } from "./queries/hubs.js";
export type { HubScore } from "./queries/hubs.js";

export { blastRadius, blastQuery } from "./queries/blast.js";
export type { BlastRadius, Dependent } from "./queries/blast.js";

export { interfereQuery, parallelBatches, planTask, WCC_BATCHES } from "./queries/schedule.js";
export type { Batch } from "./queries/schedule.js";

export { listDecisions, recordDecision, whyTrace, WHY_TRACE } from "./queries/why.js";
export type { DecisionRow, WhyHit } from "./queries/why.js";

export { runMvpScenario } from "./demo.js";
export type { MvpScenarioResult } from "./demo.js";

export { summarizeBrief } from "./summarize.js";

export { brief, formatBrief, handoff, NEAR_FILES, recordLesson } from "./queries/brief.js";
export type { Brief } from "./queries/brief.js";

export { fulltextQuery, searchMemory, SEARCH_DECISIONS, SEARCH_LESSONS } from "./queries/search.js";
export type { MemoryHit } from "./queries/search.js";

export { hotspots, HOTSPOTS } from "./queries/history.js";
export type { Hotspot } from "./queries/history.js";
