// Per-visitor demo graphs for the public link: each visitor plays with a GRAPH.COPY of the template graph,
// so one judge's Play never resets another's tour. Also the CORS allowlist both modes use.
import type { DbLocation, SbGraph } from "@switchboard/core";
import { createHash, randomBytes } from "node:crypto";
// falkordb is @switchboard/core's client; GRAPH.COPY and GRAPH.LIST are Redis commands core does not wrap.
import type { FalkorDB, Graph } from "falkordb";

type ClientQueryOptions = NonNullable<Parameters<Graph["query"]>[1]>;

export const VISITOR_COOKIE = "sbv";
/** The cookie value: 16 hex characters from randomBytes. */
export const VISITOR_ID = /^[0-9a-f]{16}$/;
export const newVisitorId = () => randomBytes(8).toString("hex");

/** Only names of this shape are ever deleted by the sweeper. */
export const VISIT_GRAPH = /^sb_visit_[0-9a-f]+$/;

export interface VisitorOptions {
  /** One client for every visitor graph: a handle is just a name, so no pool or LRU is needed. */
  db: FalkorDB;
  template: SbGraph;
  location: DbLocation;
  /** Delete a visitor graph after this long without a request. */
  idleMs: number;
  /** Past this many visitor graphs, new visitors share the template. */
  max: number;
  /** New graphs per client IP per 10 minutes (no IP: a local caller, never limited). */
  perIp: number;
}

export type Visitors = ReturnType<typeof visitorGraphs>;

export function visitorGraphs(o: VisitorOptions) {
  // Graph names carry a tag of the template, so two servers on one FalkorDB never sweep each other's visitors.
  const prefix = `sb_visit_${createHash("sha256").update(o.template.name).digest("hex").slice(0, 4)}`;
  const own = new RegExp(`^${prefix}[0-9a-f]{16}$`);
  const lastSeen = new Map<string, number>();
  const handles = new Map<string, SbGraph>();
  const creating = new Map<string, Promise<SbGraph>>();
  const created = new Map<string, { windowStart: number; count: number }>();

  const handle = (name: string): SbGraph => {
    let h = handles.get(name);
    if (!h) {
      const graph = o.db.selectGraph(name);
      const run = (mode: "query" | "roQuery") => async (cypher: string, params?: Record<string, unknown>, opts?: { timeout?: number }) =>
        ((await graph[mode]<Record<string, unknown>>(cypher, { TIMEOUT: opts?.timeout ?? 2000, ...(params ? { params } : {}) } as ClientQueryOptions)).data ?? []);
      h = {
        name,
        location: o.location,
        query: run("query"),
        roQuery: run("roQuery"),
        drop: async () => {
          await graph.delete();
        },
        close: async () => undefined,
      };
      handles.set(name, h);
    }
    return h;
  };

  /** A new graph for this IP, unless it made `perIp` in the last 10 minutes. */
  const allowNew = (ip: string | undefined, now: number) => {
    if (!ip) return true;
    if (created.size > 5000) created.clear();
    const e = created.get(ip);
    if (!e || now - e.windowStart >= 10 * 60_000) return created.set(ip, { windowStart: now, count: 1 }), true;
    return ++e.count <= o.perIp;
  };

  async function copy(name: string): Promise<SbGraph> {
    try {
      await o.db.selectGraph(o.template.name).copy(name);
    } catch (err) {
      // A returning visitor after a restart: their graph is still there, so adopt it.
      if (!(err instanceof Error && err.message.includes("already exists"))) throw err;
    }
    return handle(name);
  }

  return {
    prefix,
    /** The visitor's own graph, made on first use; null means share the template (cap or IP limit reached). */
    async graphFor(id: string, ip?: string, now = Date.now()): Promise<SbGraph | null> {
      const name = prefix + id;
      if (lastSeen.has(name)) {
        lastSeen.set(name, now);
        return creating.get(name) ?? handle(name);
      }
      if (lastSeen.size >= o.max || !allowNew(ip, now)) return null;
      lastSeen.set(name, now);
      const p = copy(name).finally(() => creating.delete(name));
      creating.set(name, p);
      return p.catch((err) => {
        lastSeen.delete(name);
        throw err;
      });
    },
    /** Keep a graph alive while its visitor holds a stream open. */
    touch(name: string, now = Date.now()) {
      if (lastSeen.has(name)) lastSeen.set(name, now);
    },
    /**
     * GRAPH.DELETE every own visitor graph idle past idleMs. Graphs with this server's prefix that it does not know
     * (left by a restart) are adopted first and swept once they too sit idle. Returns the names deleted.
     */
    async sweep(now = Date.now()): Promise<string[]> {
      for (const name of await o.db.list()) if (own.test(name) && !lastSeen.has(name)) lastSeen.set(name, now);
      const gone: string[] = [];
      for (const [name, seen] of lastSeen) {
        if (now - seen < o.idleMs || creating.has(name) || !VISIT_GRAPH.test(name)) continue;
        lastSeen.delete(name);
        handles.delete(name);
        await o.db
          .selectGraph(name)
          .delete()
          .catch(() => undefined); // already gone
        gone.push(name);
      }
      return gone;
    },
    get size() {
      return lastSeen.size;
    },
  };
}

const SITE = ["https://switchboard-agents.xyz", "https://www.switchboard-agents.xyz"];
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * May a page on `origin` read this API? The site itself, local dev pages, the request's own host, and
 * SB_CORS_ORIGINS (comma separated). Anything else gets no Access-Control-Allow-Origin header.
 */
export function allowedOrigin(origin: string, host: string | undefined, extra: string[] = []): boolean {
  if (SITE.includes(origin) || LOCAL.test(origin) || extra.includes(origin)) return true;
  try {
    return host !== undefined && new URL(origin).host === host;
  } catch {
    return false;
  }
}
