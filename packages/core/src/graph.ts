import { FalkorDB, type Graph } from "falkordb";

const DEFAULT_URL = "redis://localhost:6379";
const DEFAULT_GRAPH = "sb_demo";
/** FalkorDB's own default is 1000 ms. Switchboard allows 2000. */
const DEFAULT_TIMEOUT_MS = 2000;

export interface ConnectOptions {
  /**
   * Redis URL. Defaults to `FALKORDB_URL` or `redis://localhost:6379`. FalkorDB Cloud gives
   * `rediss://user:password@host:port` (rediss = TLS). Credentials can come from the URL or from
   * `FALKORDB_USERNAME` / `FALKORDB_PASSWORD`; the URL wins.
   */
  url?: string;
  /** Graph key. Defaults to `SB_GRAPH` or `sb_demo`. */
  graph?: string;
}

export interface QueryOptions {
  /** Server-side query timeout in milliseconds. Default 2000. */
  timeout?: number;
}

type ClientQueryOptions = NonNullable<Parameters<Graph["query"]>[1]>;

/**
 * One FalkorDB graph. `query` writes, `roQuery` is GRAPH.RO_QUERY.
 * Neither method contains Cypher; every statement lives in `queries/`.
 */
export interface SbGraph {
  name: string;
  /** Where the graph lives, with no credentials: safe to log and to show in /api/health. */
  location: DbLocation;
  query(
    cypher: string,
    params?: Record<string, unknown>,
    opts?: QueryOptions,
  ): Promise<Record<string, unknown>[]>;
  roQuery(
    cypher: string,
    params?: Record<string, unknown>,
    opts?: QueryOptions,
  ): Promise<Record<string, unknown>[]>;
  /**
   * GRAPH.DELETE this graph. Tests use it to reset their own `sb_test_*`
   * graph. It is a Redis command, not Cypher, which is why it lives here.
   */
  drop(): Promise<void>;
  close(): Promise<void>;
}

export interface DbLocation {
  host: string;
  port: number;
  tls: boolean;
  /** `local`: this machine. `cloud`: FalkorDB Cloud or any TLS endpoint. `remote`: another plain host. */
  where: "local" | "cloud" | "remote";
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Host, port and TLS of a redis(s):// or falkor(s):// URL, without the credentials. Throws on a bad URL, naming no part of it. */
export function locate(url: string): DbLocation {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("FALKORDB_URL is not a valid URL (expected redis://host:port or rediss://user:password@host:port)");
  }
  if (!["redis:", "rediss:", "falkor:", "falkors:"].includes(u.protocol)) {
    throw new Error(`FALKORDB_URL must start with redis:// or rediss:// (got ${u.protocol}//)`);
  }
  const tls = u.protocol === "rediss:" || u.protocol === "falkors:";
  const host = u.hostname;
  const where = LOOPBACK.has(host) ? "local" : tls || host.endsWith(".falkordb.cloud") ? "cloud" : "remote";
  return { host, port: Number(u.port || 6379), tls, where };
}

/** The URL with its password replaced by `***`, for messages. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString().replace(/\/$/, "");
  } catch {
    return "(invalid URL)";
  }
}

/**
 * Client options for a URL plus the env: FALKORDB_USERNAME / FALKORDB_PASSWORD fill in what the URL
 * leaves out (node-redis lets the URL's own credentials win anyway).
 */
export function clientOptions(url: string, env: NodeJS.ProcessEnv = process.env): { url: string; username?: string; password?: string } {
  const u = new URL(url);
  const username = u.username ? undefined : env.FALKORDB_USERNAME || undefined;
  const password = u.password ? undefined : env.FALKORDB_PASSWORD || undefined;
  return { url, ...(username ? { username } : {}), ...(password ? { password } : {}) };
}

export async function connect(opts?: ConnectOptions): Promise<SbGraph> {
  const url = opts?.url ?? process.env.FALKORDB_URL ?? DEFAULT_URL;
  const name = opts?.graph ?? process.env.SB_GRAPH ?? DEFAULT_GRAPH;
  const location = locate(url);
  const options = clientOptions(url);
  // Every secret that could reach a message: the URL's password (raw and decoded) and the env one.
  const raw = new URL(url).password;
  const secrets = [raw, decodeSafe(raw), options.password ?? ""].filter((x) => x.length > 0);
  const scrub = (text: string) => secrets.reduce((t, s) => t.split(s).join("***"), text);

  let db: FalkorDB;
  try {
    db = await FalkorDB.connect(options);
  } catch (err) {
    const hint = location.where === "local" ? "Is it running? Try `npm run db:up`" : "Check the host, the port and the credentials (docs/CLOUD.md)";
    // eslint-disable-next-line preserve-caught-error -- no cause: the client's error can carry the URL and its password.
    throw new Error(scrub(`Cannot connect to FalkorDB at ${redactUrl(url)}. ${hint} (${describe(err)})`));
  }

  // The client rejects the failing command and also emits 'error'.
  // Node crashes the process if that event has no listener.
  db.on("error", () => undefined);

  const graph = db.selectGraph(name);
  return {
    name,
    location,
    query: (cypher, params, queryOpts) => run(graph, "query", cypher, params, queryOpts),
    roQuery: (cypher, params, queryOpts) => run(graph, "roQuery", cypher, params, queryOpts),
    drop: () => graph.delete(),
    close: () => db.close(),
  };
}

async function run(
  graph: Graph,
  mode: "query" | "roQuery",
  cypher: string,
  params: Record<string, unknown> | undefined,
  opts: QueryOptions | undefined,
): Promise<Record<string, unknown>[]> {
  // The client's timeout field is named TIMEOUT. It is the GRAPH.QUERY
  // timeout argument, in milliseconds. That type is not re-exported.
  const options = {
    TIMEOUT: opts?.timeout ?? DEFAULT_TIMEOUT_MS,
    ...(params !== undefined ? { params } : {}),
  } as ClientQueryOptions;

  try {
    const reply = await graph[mode]<Record<string, unknown>>(cypher, options);
    return reply.data ?? [];
  } catch (err) {
    // Keep the server's message first (callers match on it, e.g. "already indexed"),
    // then say which statement failed.
    const first = cypher.trim().split("\n")[0]!.slice(0, 80);
    throw new Error(`${describe(err)} [${mode}: ${first}]`, { cause: err });
  }
}

function decodeSafe(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** A readable message, including for the AggregateError a refused connection gives (its message is ""). */
function describe(err: unknown): string {
  if (err instanceof AggregateError && err.errors.length > 0) {
    return err.errors.map((e) => (e instanceof Error ? e.message : String(e))).join("; ");
  }
  if (err instanceof Error) return err.message || err.name;
  return String(err);
}
