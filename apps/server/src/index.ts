// Switchboard HTTP server: read routes for the web UI, a few demo/hook writes, and the SSE feed.
// Contract: docs/api.md. FalkorDB is the only store; the server keeps no state beyond a rate-limit window.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  blastRadius,
  brief,
  claim,
  connect,
  ensureSchema,
  feedSince,
  findConflicts,
  formatBrief,
  graphSnapshot,
  listClaims,
  listDecisions,
  parallelBatches,
  recordEdit,
  RESET_DEMO_EXTRAS,
  runMvpScenario,
  whyTrace,
  type SbGraph,
} from "@switchboard/core";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";

const PORT = Number(process.env.SERVER_PORT ?? 8787);
const POLL_MS = 500;
const RATE_LIMIT = Number(process.env.SB_RATE_LIMIT ?? 60); // mutating requests per client per minute
const webDist = join(import.meta.dirname, "../../web/dist");
const demoRepo = join(import.meta.dirname, "../../../demo-repo");

const g: SbGraph = await connect();
await ensureSchema(g);

const app = new Hono();
app.use("/api/*", cors());

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err instanceof Error ? err.message : "internal error" }, 500);
});

// ponytail: in-memory fixed window per client IP; move to a shared store if the server ever runs as several processes.
const hits = new Map<string, { windowStart: number; count: number }>();
const rateLimit: MiddlewareHandler = async (c, next) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || clientAddress(c) || "local";
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart >= 60_000) hits.set(ip, { windowStart: now, count: 1 });
  else if (++entry.count > RATE_LIMIT) {
    c.header("Retry-After", String(Math.ceil((entry.windowStart + 60_000 - now) / 1000)));
    return c.json({ error: "rate limit exceeded" }, 429);
  }
  await next();
};

function clientAddress(c: Context): string | undefined {
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
  return incoming?.socket?.remoteAddress;
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

app.get("/api/health", (c) => c.json({ ok: true, graph: g.name }));

app.get("/api/graph", async (c) => c.json(await graphSnapshot(g)));

app.get("/api/claims", async (c) => c.json(await listClaims(g)));

app.get("/api/brief", async (c) => {
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
app.get("/api/batches", rateLimit, async (c) => c.json(await parallelBatches(g)));

app.get("/api/decisions", async (c) => c.json(await listDecisions(g)));

/** The two-minute story, driven from the page so a judge never needs a terminal. */
app.post("/api/demo", rateLimit, async (c) => {
  // Hook edits of this checkout must not sit in the demo graph.
  await g.query(RESET_DEMO_EXTRAS);
  const result = await runMvpScenario(g, demoRepo);
  return c.json({
    sentence: result.sentence,
    checkMs: result.checkMs,
    path: result.b.conflicts[0]?.path ?? [],
    batches: result.batches,
    why: result.why,
  });
});

/** Demo helper: POST { agent, paths, task?, intent? } so the UI can be driven without MCP. */
app.post("/api/claims", rateLimit, async (c) => {
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
  return c.json(await claim(g, { agent: body.agent, paths: body.paths, taskId: body.task, intent: body.intent }));
});

/** Editor hook: POST { agent, path, task? } after a file edit. */
app.post("/api/edits", rateLimit, async (c) => {
  const body = parse(
    z.object({ agent: z.string().min(1).max(128), path: pathString, task: z.string().min(1).max(128).optional() }),
    await jsonBody(c),
    c,
  );
  if (body instanceof Response) return body;
  return c.json({ seq: await recordEdit(g, { agentId: body.agent, path: body.path, taskId: body.task }) });
});

/**
 * SSE feed. Resumes after `?last=` or the browser's `Last-Event-ID` on reconnect.
 * One loop per client: `last` only moves forward, so a row is never sent twice.
 */
app.get("/api/events", (c) => {
  const from = c.req.header("last-event-id") ?? c.req.query("last") ?? "0";
  const last0 = parse(z.coerce.number().int().min(0), from, c);
  if (last0 instanceof Response) return last0;
  return streamSSE(c, async (stream) => {
    let last = last0;
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
      await stream.sleep(POLL_MS);
    }
  });
});

if (existsSync(webDist)) {
  const root = relative(process.cwd(), webDist) || ".";
  app.use("/*", serveStatic({ root }));
  const indexHtml = readFileSync(join(webDist, "index.html"), "utf8");
  app.get("*", (c) => (c.req.path.startsWith("/api/") ? c.json({ error: "not found" }, 404) : c.html(indexHtml)));
}

const server = serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`switchboard server http://localhost:${PORT} graph=${g.name}`);
});

const shutdown = async () => {
  server.close();
  await g.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
