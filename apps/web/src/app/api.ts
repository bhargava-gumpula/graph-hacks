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

export const api = {
  health: () => fetch("/api/health").then((r) => json<{ ok: boolean; graph: string }>(r)),
  graph: () => fetch("/api/graph").then((r) => json<Snapshot>(r)),
  claims: () => fetch("/api/claims").then((r) => json<Claim[]>(r)),
  decisions: () => fetch("/api/decisions").then((r) => json<Decision[]>(r)),
  batches: () => fetch("/api/batches").then((r) => json<Batch[]>(r)),
  blast: (path: string) => fetch(`/api/blast?path=${encodeURIComponent(path)}`).then((r) => json<Blast>(r)),
  why: (path: string) => fetch(`/api/why?path=${encodeURIComponent(path)}`).then((r) => json<unknown[]>(r)),
  brief: (task?: string) =>
    fetch(`/api/brief${task ? `?task=${encodeURIComponent(task)}` : ""}`).then((r) =>
      json<{ text: string; summary?: string | null } & Record<string, unknown>>(r),
    ),
  demo: () => fetch("/api/demo", { method: "POST" }).then((r) => json<{ sentence: string; checkMs: number; path: string[] }>(r)),
  claim: (agent: string, paths: string[], task?: string) =>
    fetch("/api/claims", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent, paths, task }),
    }).then((r) => json<ClaimResult>(r)),
};
