// Switchboard HTTP server: read routes for the web UI, a few demo/hook writes, and the SSE feed.
// Contract: docs/api.md. FalkorDB is the only store; the server keeps no state beyond a rate-limit window.
// SB_PUBLIC=1 locks the write routes down for a public link (see the claims and edits routes).
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  blastQuery,
  blastRadius,
  brief,
  claim,
  claimQuery,
  codeGraphCounts,
  conflictGuard,
  conflictQuery,
  connect,
  ensureSchema,
  feedSince,
  findConflicts,
  formatBrief,
  graphSnapshot,
  interfereQuery,
  latestSeq,
  listClaims,
  listDecisions,
  MARK_HUBS,
  missingFiles,
  NEAR_FILES,
  parallelBatches,
  recordEdit,
  resetDemo,
  runMvpScenario,
  WCC_BATCHES,
  WHY_TRACE,
  whyTrace,
  type SbGraph,
} from "@switchboard/core";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";

const PORT = Number(process.env.SERVER_PORT ?? 8787);
const HOST = process.env.SB_HOST ?? "127.0.0.1";
const PUBLIC = process.env.SB_PUBLIC === "1";
const PUBLIC_AGENTS = ["A", "B", "C", "D"];
const PUBLIC_TTL_MS = 5 * 60_000;
const POLL_MS = 500;
const PING_MS = 20_000; // Cloudflare drops a stream that is idle for 125 s
const REPLAY = 100; // a new feed client gets the last 100 events, not the whole history
const RESEED_EVERY_MS = 20 * 60_000;
const IDLE_MS = 10 * 60_000; // claims live 30 min, so an idle demo graph is replayed before it empties
const webDist = join(import.meta.dirname, "../../web/dist");
const demoRepo = join(import.meta.dirname, "../../../demo-repo");
const startedAt = Date.now();
let lastWrite = 0;
let lastResetAt: number | null = null;

const g: SbGraph = await connect();
await ensureSchema(g);

interface DemoReply {
  sentence: string;
  checkMs: number;
  path: string[];
  batches: string[][];
  why: string[];
}

/**
 * Reset the demo graph and replay the story. Single flight: Plays that arrive while
 * one runs share its result, so concurrent clicks never race each other's writes.
 * A claim that slips in mid-run can break the story; one fresh reset fixes that.
 */
let demoRun: Promise<DemoReply> | null = null;
function runDemo(): Promise<DemoReply> {
  return (demoRun ??= (async () => {
    const play = async () => {
      await resetDemo(g);
      return runMvpScenario(g, demoRepo);
    };
    const r = await play().catch(play);
    lastResetAt = Date.now();
    return { sentence: r.sentence, checkMs: r.checkMs, path: r.b.conflicts[0]?.path ?? [], batches: r.batches, why: r.why };
  })().finally(() => {
    demoRun = null;
  }));
}

// A fresh graph (first start, or FalkorDB lost its data) gets the demo right away.
if ((await codeGraphCounts(g)).files === 0) await runDemo();
setInterval(() => {
  if (Date.now() - lastWrite > IDLE_MS) runDemo().catch(console.error);
}, RESEED_EVERY_MS);

const app = new Hono();
app.use("/api/*", cors());

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err instanceof Error ? err.message : "internal error" }, 500);
});

// ponytail: in-memory fixed window per client and route, wiped past 5000 keys; move to a shared store if the server ever runs as several processes.
const hits = new Map<string, { windowStart: number; count: number }>();

/**
 * At most `perMinute` requests per client per route. The client is Cloudflare's
 * cf-connecting-ip, which the tunnel always sets and a visitor cannot forge.
 * X-Forwarded-For is not trusted. No cf-connecting-ip means a local caller (the
 * server binds 127.0.0.1), such as an agent's hook, and that is never limited.
 */
function limit(perMinute: number): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header("cf-connecting-ip");
    if (!ip) return next();
    if (hits.size > 5000) hits.clear();
    const key = `${c.req.method} ${c.req.path} ${ip}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.windowStart >= 60_000) hits.set(key, { windowStart: now, count: 1 });
    else if (++entry.count > perMinute) {
      c.header("Retry-After", String(Math.ceil((entry.windowStart + 60_000 - now) / 1000)));
      return c.json({ error: "rate limit exceeded" }, 429);
    }
    await next();
  };
}

const pathString = z.string().min(1).max(512);
const pathQuery = z.object({ path: pathString });

/** Parse with zod; on failure return a 400 the caller can read. */
function parse<T>(schema: z.ZodType<T>, value: unknown, c: Context): T | Response {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  return c.json({ error: "invalid input", issues: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
}

async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

app.get("/api/health", async (c) => {
  const started = performance.now();
  const { files } = await codeGraphCounts(g);
  const dbMs = Math.round((performance.now() - started) * 10) / 10;
  const uptimeS = Math.round((Date.now() - startedAt) / 1000);
  return c.json({ ok: true, graph: g.name, seq: await latestSeq(g), files, dbMs, uptimeS, lastResetAt });
});

/** The Cypher behind each feature, exactly as the server runs it (k = 3), for the "show the query" panels. */
const CYPHER = {
  conflict: conflictQuery(3),
  guard: conflictGuard(3),
  claim: claimQuery(3),
  blast: blastQuery(3),
  interferes: interfereQuery(3),
  batches: WCC_BATCHES,
  hubs: MARK_HUBS,
  why: WHY_TRACE,
  brief: NEAR_FILES,
};
app.get("/api/cypher", (c) => c.json(CYPHER));

app.get("/api/graph", async (c) => c.json(await graphSnapshot(g)));

app.get("/api/claims", async (c) => c.json(await listClaims(g)));

app.get("/api/brief", limit(30), async (c) => {
  const q = parse(z.object({ task: z.string().min(1).optional(), prefix: z.string().optional() }), c.req.query(), c);
  if (q instanceof Response) return q;
  if (q.task === undefined && q.prefix === undefined) return c.json({ error: "give task or prefix" }, 400);
  const result = await brief(g, { taskId: q.task, prefix: q.prefix });
  return c.json({ ...result, text: formatBrief(result) });
});

app.get("/api/why", async (c) => {
  const q = parse(pathQuery, c.req.query(), c);
  if (q instanceof Response) return q;
  return c.json(await whyTrace(g, q.path));
});

app.get("/api/blast", async (c) => {
  const q = parse(pathQuery, c.req.query(), c);
  if (q instanceof Response) return q;
  return c.json(await blastRadius(g, q.path));
});

/** Read-only conflict check for the editor hook: `{ conflicts }`, empty when the edit is safe. */
app.get("/api/check", async (c) => {
  const q = parse(z.object({ path: pathString, agent: z.string().min(1).max(128) }), c.req.query(), c);
  if (q instanceof Response) return q;
  return c.json({ conflicts: await findConflicts(g, { agent: q.agent, paths: [q.path] }) });
});

// parallelBatches rebuilds INTERFERES edges, so it is rate limited like the other writes.
app.get("/api/batches", limit(60), async (c) => c.json(await parallelBatches(g)));

app.get("/api/decisions", async (c) => c.json(await listDecisions(g)));

/** The two-minute story, driven from the page so a judge never needs a terminal. */
app.post("/api/demo", limit(6), async (c) => {
  lastWrite = Date.now();
  return c.json(await runDemo());
});

/**
 * Demo helper: POST { agent, paths, task?, intent? } so the UI can be driven without MCP.
 * Public mode: agents A-D only, paths must already be files of the code graph,
 * task and intent are ignored, and claims last 5 minutes.
 */
app.post("/api/claims", limit(20), async (c) => {
  const body = parse(
    z.object({
      agent: z.string().min(1).max(128),
      paths: z.array(pathString).min(1).max(100),
      task: z.string().min(1).max(128).optional(),
      intent: z.string().max(500).optional(),
    }),
    await jsonBody(c),
    c,
  );
  if (body instanceof Response) return body;
  // Wait out a running Play so this claim cannot land in the middle of the story.
  await demoRun?.catch(() => undefined);
  if (!PUBLIC) {
    lastWrite = Date.now();
    return c.json(await claim(g, { agent: body.agent, paths: body.paths, taskId: body.task, intent: body.intent }));
  }
  if (!PUBLIC_AGENTS.includes(body.agent)) return c.json({ error: "the public demo has agents A, B, C and D" }, 400);
  const missing = await missingFiles(g, body.paths);
  if (missing.length > 0) return c.json({ error: "not in the code graph", missing }, 404);
  lastWrite = Date.now();
  return c.json(await claim(g, { agent: body.agent, paths: body.paths, ttlMs: PUBLIC_TTL_MS }));
});

/** Editor hook: POST { agent, path, task? } after a file edit. Off in public mode. */
app.post("/api/edits", limit(60), async (c) => {
  if (PUBLIC) return c.json({ error: "not found" }, 404);
  const body = parse(
    z.object({ agent: z.string().min(1).max(128), path: pathString, task: z.string().min(1).max(128).optional() }),
    await jsonBody(c),
    c,
  );
  if (body instanceof Response) return body;
  lastWrite = Date.now();
  return c.json({ seq: await recordEdit(g, { agentId: body.agent, path: body.path, taskId: body.task }) });
});

/** Where a feed starts: after `from` when the client says, else the last REPLAY events. */
async function feedStart(from: string | undefined, c: Context): Promise<number | Response> {
  if (from === undefined) return Math.max(0, (await latestSeq(g)) - REPLAY);
  return parse(z.coerce.number().int().min(0), from, c);
}

/**
 * Polling twin of `/api/events`, for proxies that buffer SSE (Cloudflare quick tunnels do).
 * At most 200 events a call; 120 calls a minute is two tabs polling every 2 s with room to spare.
 */
app.get("/api/feed", limit(120), async (c) => {
  const last = await feedStart(c.req.query("last"), c);
  if (last instanceof Response) return last;
  return c.json(await feedSince(g, last));
});

/**
 * SSE feed. Resumes after `?last=` or the browser's `Last-Event-ID` on reconnect.
 * One loop per client: `last` only moves forward, so a row is never sent twice.
 */
app.get("/api/events", async (c) => {
  const last0 = await feedStart(c.req.header("last-event-id") ?? c.req.query("last"), c);
  if (last0 instanceof Response) return last0;
  return streamSSE(c, async (stream) => {
    await stream.write("retry: 3000\n\n");
    let last = last0;
    let pingedAt = Date.now();
    let open = true;
    stream.onAbort(() => {
      open = false;
    });
    while (open && !stream.aborted) {
      try {
        for (const item of await feedSince(g, last)) {
          if (item.seq <= last) continue;
          await stream.writeSSE({ event: "event", data: JSON.stringify(item), id: String(item.seq) });
          last = item.seq;
        }
      } catch (err) {
        // A FalkorDB hiccup should not end the stream; the browser would reconnect anyway.
        console.error("feed poll failed:", err instanceof Error ? err.message : err);
      }
      if (Date.now() - pingedAt >= PING_MS) {
        await stream.write(": ping\n\n");
        pingedAt = Date.now();
      }
      await stream.sleep(POLL_MS);
    }
  });
});

app.use("/*", serveStatic({ root: relative(process.cwd(), webDist) || "." }));
app.get("*", (c) => {
  // An unknown API route or a missing file (any path with an extension) is a 404, never the app shell.
  if (c.req.path.startsWith("/api/") || /\.[a-z0-9]+$/i.test(c.req.path)) return c.json({ error: "not found" }, 404);
  // Read on every request: a rebuild renames the hashed assets, so a cached shell would load deleted files.
  try {
    return c.html(readFileSync(join(webDist, "index.html"), "utf8"));
  } catch {
    return c.text("The web app is not built yet.", 503);
  }
});

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
  console.log(`switchboard server http://${HOST}:${PORT} graph=${g.name}${PUBLIC ? " public" : ""}`);
});

const shutdown = async () => {
  server.close();
  await g.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
