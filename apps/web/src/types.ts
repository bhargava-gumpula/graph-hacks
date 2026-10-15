export interface GraphNode {
  id: string;
  label: string;
  kind: "file" | "agent";
  hub?: boolean;
  status?: string;
  claimedBy?: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "IMPORTS" | "CLAIMS";
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
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

export interface Conflict {
  file: string;
  type: string;
  claimed: string;
  path: string[];
  hops: number;
  agent: string;
}
