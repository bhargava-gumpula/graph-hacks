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
