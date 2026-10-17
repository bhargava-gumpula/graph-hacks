/** Typed client for the Switchboard HTTP API (docs/api.md). */

export interface GNode {
  id: string;
  label: string;
  kind: "file" | "agent";
  hub?: boolean;
  status?: string;
  claimedBy?: string[];
}
export interface GEdge {
  source: string;
  target: string;
  kind: "IMPORTS" | "CLAIMS";
}
export interface Snapshot {
  nodes: GNode[];
  edges: GEdge[];
}
export interface Claim {
  agent: string;
  path: string;
  until: number;
  taskId: string | null;
  intent?: string | null;
}
export interface Conflict {
  file: string;
  type: "SAME" | "UPSTREAM" | "DOWNSTREAM" | string;
  claimed: string;
  path: string[];
  hops: number;
  agent: string;
  taskId?: string | null;
  intent?: string | null;
  hub?: boolean;
}
export interface FeedItem {
  seq: number;
  kind: string;
  at: number;
  payload: unknown;
  agentId: string | null;
  onLabel: string | null;
  onKey: string | null;
}
export interface Decision {
  id: string;
  text: string;
  why?: string | null;
  status: string | null;
  agent: string | null;
}
export interface Batch {
  componentId: number;
  tasks: string[];
  paths?: string[];
}
export interface Health {
  ok: boolean;
  graph: string;
  seq?: number;
  files?: number;
  dbMs?: number;
  uptimeS?: number;
  lastResetAt?: number | null;
}
export interface DemoReply {
  sentence: string;
  checkMs: number;
  path: string[];
  batches?: Batch[];
  why?: unknown;
}
export interface Blast {
  path: string;
  dependents: { path: string; hops: number; agents: string[] }[];
  byHop: { hops: number; count: number }[];
}
export interface ClaimResult {
  ok: boolean;
  conflicts?: Conflict[];
  [k: string]: unknown;
}

export interface BriefReply {
  text: string;
  summary?: string | null;
  [k: string]: unknown;
}

/** One real FalkorDB run of the demo, recorded by scripts/snapshot-replay.ts into public/replay.json. */
export interface Replay {
  capturedAt: string;
  graph: Snapshot;
  claims: Claim[];
  decisions: Decision[];
  batches: Batch[];
  demo: DemoReply;
  events: FeedItem[];
  blast: Record<string, Blast>;
  why: Record<string, unknown[]>;
  /** findConflicts for agent B on each file. */
  check: Record<string, Conflict[]>;
  brief: Record<string, BriefReply>;
  cypher: Record<string, string>;
}

/**
 * While `data` is set (useLive sets it when the API is down), every api.* call except health answers
 * from the recording. `emit` is useLive's event handler, so a replayed demo animates like a live one.
 */
export const replay: { data: Replay | null; emit: (item: FeedItem) => void } = { data: null, emit: () => undefined };

/** From the web origin, not the API base: the API is the thing that is down. */
export const loadReplay = () => fetch("/replay.json").then((r) => json<Replay>(r));

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** API origin; empty means same origin (the server serves the built site). */
export const apiUrl = (path: string) => `${import.meta.env.VITE_API_URL ?? ""}${path}`;
const get = <T,>(path: string) => fetch(apiUrl(path)).then((r) => json<T>(r));

/** Live GET, or the recorded answer in replay mode. */
function read<T>(path: string, recorded: (r: Replay) => T | undefined): Promise<T> {
  const r = replay.data;
  if (!r) return get<T>(path);
  const value = recorded(r);
  return value === undefined ? Promise.reject(new Error("Not in the recorded run")) : Promise.resolve(value);
}

/** Re-emit the recorded demo events with their original spacing, stamped now. */
function replayDemo(r: Replay): Promise<DemoReply> {
  const t0 = r.events[0]?.at ?? 0;
  for (const e of r.events) setTimeout(() => replay.emit({ ...e, at: Date.now() }), e.at - t0);
  return Promise.resolve(r.demo);
}

export const api = {
  health: () => get<Health>("/api/health"),
  feed: (last: number) => read<FeedItem[]>(`/api/feed?last=${last}`, () => []),
  graph: () => read<Snapshot>("/api/graph", (r) => r.graph),
  claims: () => read<Claim[]>("/api/claims", (r) => r.claims),
  decisions: () => read<Decision[]>("/api/decisions", (r) => r.decisions),
  batches: () => read<Batch[]>("/api/batches", (r) => r.batches),
  blast: (path: string) => read<Blast>(`/api/blast?path=${encodeURIComponent(path)}`, (r) => r.blast[path]),
  why: (path: string) => read<unknown[]>(`/api/why?path=${encodeURIComponent(path)}`, (r) => r.why[path] ?? []),
  cypher: () => read<Record<string, string>>("/api/cypher", (r) => r.cypher),
  brief: (task?: string, prefix?: string) => {
    const q = new URLSearchParams();
    if (task) q.set("task", task);
    if (prefix !== undefined) q.set("prefix", prefix);
    const qs = q.toString();
    return read<BriefReply>(`/api/brief${qs ? `?${qs}` : ""}`, (r) => r.brief[task ?? Object.keys(r.brief)[0] ?? ""]);
  },
  demo: () =>
    replay.data ? replayDemo(replay.data) : fetch(apiUrl("/api/demo"), { method: "POST" }).then((r) => json<DemoReply>(r)),
  claim: (agent: string, paths: string[], task?: string): Promise<ClaimResult> => {
    const r = replay.data;
    if (r) {
      const conflicts = paths.flatMap((p) => r.check[p] ?? []).filter((c) => c.agent !== agent);
      return Promise.resolve({ ok: conflicts.length === 0, conflicts });
    }
    return fetch(apiUrl("/api/claims"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent, paths, task }),
    }).then((res) => json<ClaimResult>(res));
  },
};
