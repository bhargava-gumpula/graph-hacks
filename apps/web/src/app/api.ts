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

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/** API origin; empty means same origin (the server serves the built site). */
export const apiUrl = (path: string) => `${import.meta.env.VITE_API_URL ?? ""}${path}`;
const get = <T,>(path: string) => fetch(apiUrl(path)).then((r) => json<T>(r));

export const api = {
  health: () => get<Health>("/api/health"),
  feed: (last: number) => get<FeedItem[]>(`/api/feed?last=${last}`),
  graph: () => get<Snapshot>("/api/graph"),
  claims: () => get<Claim[]>("/api/claims"),
  decisions: () => get<Decision[]>("/api/decisions"),
  batches: () => get<Batch[]>("/api/batches"),
  blast: (path: string) => get<Blast>(`/api/blast?path=${encodeURIComponent(path)}`),
  why: (path: string) => get<unknown[]>(`/api/why?path=${encodeURIComponent(path)}`),
  cypher: () => get<Record<string, string>>("/api/cypher"),
  brief: (task?: string, prefix?: string) => {
    const q = new URLSearchParams();
    if (task) q.set("task", task);
    if (prefix !== undefined) q.set("prefix", prefix);
    const qs = q.toString();
    return get<{ text: string; summary?: string | null } & Record<string, unknown>>(`/api/brief${qs ? `?${qs}` : ""}`);
  },
  demo: () => fetch(apiUrl("/api/demo"), { method: "POST" }).then((r) => json<DemoReply>(r)),
  claim: (agent: string, paths: string[], task?: string) =>
    fetch(apiUrl("/api/claims"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent, paths, task }),
    }).then((r) => json<ClaimResult>(r)),
};
