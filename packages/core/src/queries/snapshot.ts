import type { SbGraph } from "../graph.js";

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

export interface ActiveClaim {
  agent: string;
  path: string;
  until: number;
  taskId: string | null;
  intent: string | null;
}

/** Every file, its hub flag, and the agents with an active claim on it (one row per file). */
export const SNAPSHOT_FILES = `
MATCH (f:File)
OPTIONAL MATCH (a:Agent)-[c:CLAIMS]->(f)
WHERE c.until > $now
RETURN f.path AS path, f.hub AS hub, collect(DISTINCT a.id) AS claimedBy
ORDER BY f.path
`;

export const SNAPSHOT_IMPORTS = `
MATCH (a:File)-[:IMPORTS]->(b:File)
RETURN DISTINCT a.path AS source, b.path AS target
`;

export const SNAPSHOT_AGENTS = `
MATCH (a:Agent)
RETURN a.id AS id, a.status AS status
ORDER BY a.id
`;

export const ACTIVE_CLAIMS = `
MATCH (a:Agent)-[c:CLAIMS]->(f:File)
WHERE c.until > $now
RETURN a.id AS agent, f.path AS path, c.until AS until, c.taskId AS taskId, c.intent AS intent
ORDER BY a.id, f.path
`;

function fileLabel(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

/**
 * Code graph + agents + active claims, the `GET /api/graph` body (docs/api.md).
 * Three whole-graph queries in parallel, no per-node lookups.
 */
export async function graphSnapshot(g: SbGraph, now = Date.now()): Promise<GraphSnapshot> {
  const [files, imports, agents] = await Promise.all([
    g.roQuery(SNAPSHOT_FILES, { now }),
    g.roQuery(SNAPSHOT_IMPORTS),
    g.roQuery(SNAPSHOT_AGENTS),
  ]);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const row of files) {
    const path = String(row.path);
    const claimedBy = (row.claimedBy as string[]).filter(Boolean);
    nodes.push({ id: path, label: fileLabel(path), kind: "file", hub: Boolean(row.hub), claimedBy });
    for (const agent of claimedBy) edges.push({ source: `agent:${agent}`, target: path, kind: "CLAIMS" });
  }
  for (const row of imports) {
    edges.push({ source: String(row.source), target: String(row.target), kind: "IMPORTS" });
  }
  for (const row of agents) {
    const id = String(row.id);
    nodes.push({ id: `agent:${id}`, label: id, kind: "agent", status: String(row.status ?? "active") });
  }

  return { nodes, edges };
}

export async function listClaims(g: SbGraph, now = Date.now()): Promise<ActiveClaim[]> {
  const rows = await g.roQuery(ACTIVE_CLAIMS, { now });
  return rows.map((row) => ({
    agent: String(row.agent),
    path: String(row.path),
    until: Number(row.until),
    taskId: typeof row.taskId === "string" ? row.taskId : null,
    intent: typeof row.intent === "string" ? row.intent : null,
  }));
}
