import { FalkorDB, type Graph } from "falkordb";

const DEFAULT_URL = "redis://localhost:6379";
const DEFAULT_GRAPH = "sb_demo";
/** FalkorDB's own default is 1000 ms. Switchboard allows 2000. */
const DEFAULT_TIMEOUT_MS = 2000;

export interface ConnectOptions {
  /** Redis URL. Defaults to `FALKORDB_URL` or `redis://localhost:6379`. */
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

export async function connect(opts?: ConnectOptions): Promise<SbGraph> {
  const url = opts?.url ?? process.env.FALKORDB_URL ?? DEFAULT_URL;
  const name = opts?.graph ?? process.env.SB_GRAPH ?? DEFAULT_GRAPH;

  let db: FalkorDB;
  try {
    db = await FalkorDB.connect({ url });
  } catch (err) {
    throw new Error(
      `Cannot connect to FalkorDB at ${url}. Is it running? Try \`npm run db:up\` (${describe(err)})`,
      { cause: err },
    );
  }

  // The client rejects the failing command and also emits 'error'.
  // Node crashes the process if that event has no listener.
  db.on("error", () => undefined);

  const graph = db.selectGraph(name);
  return {
    name,
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

/** A readable message, including for the AggregateError a refused connection gives (its message is ""). */
function describe(err: unknown): string {
  if (err instanceof AggregateError && err.errors.length > 0) {
    return err.errors.map((e) => (e instanceof Error ? e.message : String(e))).join("; ");
  }
  if (err instanceof Error) return err.message || err.name;
  return String(err);
}
