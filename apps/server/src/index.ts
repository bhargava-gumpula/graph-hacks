// Switchboard HTTP server: read routes for the web UI, a few demo/hook writes, and the SSE feed.
// Contract: docs/api.md. FalkorDB is the only store; the server keeps no state beyond a rate-limit window.
// SB_PUBLIC=1 locks the write routes down for a public link (see the claims and edits routes) and gives each
// visitor their own copy of the demo graph (visitors.ts; SB_ISOLATE=0 turns that off).
// The graph is live per edit: POST /api/edits re-parses that one file first. SB_REPO is the parsed repo
// on disk (default demo-repo); SB_WATCH=1 also watches it, so a person's saves update the graph too.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  blastQuery,
  blastRadius,
  brief,
  claim,
  claimQuery,
  clientOptions,
  codeGraphCounts,
  conflictGuard,
  conflictQuery,
  connect,
  ensureSchema,
  feedSince,
  findConflicts,
  formatBrief,
  graphSnapshot,
  hubMarker,
  interfereQuery,
  isRepoOf,
  latestSeq,
  listClaims,
  loadParse,
  listDecisions,
  MARK_HUBS,
  missingFiles,
  NEAR_FILES,
  parallelBatches,
  parseRepo,
  recordLiveEdit,
  resetDemo,
  runMvpScenario,
  watchRepo,
  WCC_BATCHES,
  WHY_TRACE,
  whyTrace,
  type FileUpdate,
  type SbGraph,
} from "@switchboard/core";
import { FalkorDB } from "falkordb";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { z } from "zod";
import { allowedOrigin, newVisitorId, VISITOR_COOKIE, VISITOR_ID, visitorGraphs } from "./visitors.js";

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
const repoDir = process.env.SB_REPO ? resolve(process.env.SB_REPO) : demoRepo;
const startedAt = Date.now();
const CORS_EXTRA = (process.env.SB_CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
let lastWrite = 0; // writes to the server's own graph only, not to visitor copies
const lastResetAt = new Map<string, number>();

const g: SbGraph = await connect();
await ensureSchema(g);
const remarkHubs = hubMarker(g);

/** One line per live graph change, e.g. `graph updated ui/A.tsx +lib/b.ts -lib/c.ts (3.1 ms)`. */
const updateLine = (u: FileUpdate) =>
  `graph ${u.status} ${u.path}${u.added.map((t) => ` +${t}`).join("")}${u.removed.map((t) => ` -${t}`).join("")} (${u.ms} ms)`;

interface DemoReply {
  sentence: string;
  checkMs: number;
  path: string[];
  batches: string[][];
  why: string[];
}

/**
 * Reset a demo graph and replay the story. Single flight per graph: Plays that arrive while
 * one runs share its result, so concurrent clicks never race each other's writes.
 * A claim that slips in mid-run can break the story; one fresh reset fixes that.
 */
const demoRuns = new Map<string, Promise<DemoReply>>();
function runDemo(graph: SbGraph = g): Promise<DemoReply> {
  let run = demoRuns.get(graph.name);
  if (!run) {
    run = (async () => {
      if (!(await isDemoGraph(graph))) throw new Error(NOT_DEMO);
      const play = async () => {
        await resetDemo(graph);
        return runMvpScenario(graph, demoRepo);
      };
      const r = await play().catch(play);
      lastResetAt.set(graph.name, Date.now());
      return { sentence: r.sentence, checkMs: r.checkMs, path: r.b.conflicts[0]?.path ?? [], batches: r.batches, why: r.why };
    })().finally(() => demoRuns.delete(graph.name));
    demoRuns.set(graph.name, run);
  }
  return run;
}
/** Wait out a running Play on this graph, so a claim or a copy never lands in the middle of the story. */
const demoSettled = (graph: SbGraph) => demoRuns.get(graph.name)?.catch(() => undefined);

/**
 * The demo story replaces the whole graph, so it runs only on demo-repo's own graph: no SB_REPO, and every
 * parsed file of the graph is on disk in demo-repo. Checked before each run, not once at start: a shared
 * (cloud) graph can be loaded with a team's repo while this server runs.
 */
const NOT_DEMO = "this graph is a real repo's, not demo-repo's; the demo would reset it";
const isDemoGraph = async (graph: SbGraph = g) => repoDir === demoRepo && (await isRepoOf(graph, demoRepo, 1));
/** For the replay timers: a graph that is not the demo's is skipped quietly. */
const logDemoError = (err: unknown) => {
  if (!(err instanceof Error && err.message === NOT_DEMO)) console.error(err);
};

/** The public story needs A holding session.ts for a while yet; a restart, an expired lease or a visitor's A claim (5 min) breaks it. */
async function storyIntact(): Promise<boolean> {
  const soon = Date.now() + 5 * 60_000;
  return (await listClaims(g)).some((c) => c.agent === "A" && c.path === "auth/session.ts" && c.until > soon);
}

// A fresh graph (first start, or FalkorDB lost its data) gets the demo right away, or a parse of SB_REPO.
const fresh = (await codeGraphCounts(g)).files === 0;
if (fresh) await (repoDir === demoRepo ? runDemo() : loadParse(g, parseRepo(repoDir)));
// Per-edit re-parse only against the repo this graph came from (see isRepoOf), checked again on every
// edit: another repo parsed into the same graph later (a shared or cloud graph) must not lose its nodes.
const liveRepo = (await isRepoOf(g, repoDir)) ? repoDir : null;
if (!liveRepo) console.warn(`${repoDir} is not the repo in graph ${g.name}: edits are recorded, not re-parsed. Set SB_REPO to the repo's directory.`);
// A public start with a broken story replays it.
if (!fresh && PUBLIC && (await isDemoGraph()) && !(await storyIntact())) await runDemo();

if (PUBLIC && repoDir === demoRepo) {
  // Checked every minute, not on idle time: steady claim traffic must not starve the replay.
  setInterval(() => {
    if (demoRuns.has(g.name) || Date.now() - lastWrite < 60_000) return;
    storyIntact()
      .then((ok) => (ok ? undefined : runDemo()))
      .catch(logDemoError);
  }, 60_000);
} else if (repoDir === demoRepo) {
  setInterval(() => {
    if (Date.now() - lastWrite > IDLE_MS) runDemo().catch(logDemoError);
  }, RESEED_EVERY_MS);
}

/**
 * Public mode: every visitor gets their own GRAPH.COPY of this server's graph (the template, kept seeded with the
 * story above), named sb_visit_<hex> and swept after 30 idle minutes. Past 200 graphs, or 10 new ones from one IP in
 * 10 minutes, a visitor shares the template as before. Off the public link everyone uses the one graph.
 */
const visitors =
  PUBLIC && process.env.SB_ISOLATE !== "0"
    ? visitorGraphs({
        db: await FalkorDB.connect(clientOptions(process.env.FALKORDB_URL ?? "redis://localhost:6379")),
        template: g,
        location: g.location,
        idleMs: Number(process.env.SB_VISIT_IDLE_MS ?? 30 * 60_000),
        max: Number(process.env.SB_VISIT_MAX ?? 200),
        perIp: 10,
      })
    : null;
if (visitors) {
  setInterval(() => {
    visitors
      .sweep()
      .then((gone) => gone.forEach((name) => lastResetAt.delete(name)))
      .catch((err: unknown) => console.error("visitor sweep failed:", err instanceof Error ? err.message : err));
  }, Number(process.env.SB_VISIT_SWEEP_MS ?? 60_000));
}

/** The visitor's id from the sbv cookie, or a new one set on this response. HttpOnly; Secure behind https. */
function visitorId(c: Context): string {
  const id = getCookie(c, VISITOR_COOKIE);
  if (id && VISITOR_ID.test(id)) return id;
  const fresh = newVisitorId();
  const https = c.req.header("x-forwarded-proto") === "https" || c.req.header("cf-visitor")?.includes('"https"') || c.req.url.startsWith("https:");
  setCookie(c, VISITOR_COOKIE, fresh, { path: "/", httpOnly: true, sameSite: "Lax", secure: https, maxAge: 24 * 3600 });
  return fresh;
}

type Env = { Variables: { g: SbGraph; shared: boolean } };
const app = new Hono<Env>();
// Only the site, local dev pages and SB_CORS_ORIGINS may read the API from a browser.
app.use("/api/*", cors({ origin: (origin, c) => (allowedOrigin(origin, c.req.header("host"), CORS_EXTRA) ? origin : null), credentials: true }));
// A browser always sends Origin on a cross-site POST, which CORS alone would still let run: refuse it. Hooks send none.
app.use("/api/*", async (c, next) => {
  const origin = c.req.header("origin");
  if (c.req.method === "POST" && origin && !allowedOrigin(origin, c.req.header("host"), CORS_EXTRA)) return c.json({ error: "origin not allowed" }, 403);
  await next();
});
// Every API route reads and writes c.var.g: the visitor's own graph in public mode, else the server's.
app.use("/api/*", async (c, next) => {
  let graph = g;
  if (visitors) {
    const id = visitorId(c);
    await demoSettled(g); // never copy the template mid-replay
    graph = (await visitors.graphFor(id, c.req.header("cf-connecting-ip"))) ?? g;
  }
  c.set("g", graph);
  c.set("shared", visitors !== null && graph === g);
  await next();
});
app.use("/api/*", bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: "body too large" }, 413) }));

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
  const g = c.var.g;
  const started = performance.now();
  const { files } = await codeGraphCounts(g);
  const dbMs = Math.round((performance.now() - started) * 10) / 10;
  const uptimeS = Math.round((Date.now() - startedAt) / 1000);
  // Where the graph lives (local, cloud or remote). The host only off the public link, never credentials.
  const db = PUBLIC ? { where: g.location.where } : { where: g.location.where, host: g.location.host };
  // visitor: "own" is this visitor's copy, "shared" means the copies are full and this tab shares the demo.
  const visitor = visitors ? (c.var.shared ? "shared" : "own") : undefined;
  return c.json({ ok: true, graph: g.name, db, seq: await latestSeq(g), files, dbMs, uptimeS, lastResetAt: lastResetAt.get(g.name) ?? null, visitor });
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

app.get("/api/graph", async (c) => c.json(await graphSnapshot(c.var.g)));

app.get("/api/claims", async (c) => c.json(await listClaims(c.var.g)));

app.get("/api/brief", limit(30), async (c) => {
  const q = parse(z.object({ task: z.string().min(1).optional(), prefix: z.string().optional() }), c.req.query(), c);
  if (q instanceof Response) return q;
  if (q.task === undefined && q.prefix === undefined) return c.json({ error: "give task or prefix" }, 400);
  const result = await brief(c.var.g, { taskId: q.task, prefix: q.prefix });
  return c.json({ ...result, text: formatBrief(result) });
});

app.get("/api/why", async (c) => {
  const q = parse(pathQuery, c.req.query(), c);
  if (q instanceof Response) return q;
  return c.json(await whyTrace(c.var.g, q.path));
});

app.get("/api/blast", async (c) => {
  const q = parse(pathQuery, c.req.query(), c);
  if (q instanceof Response) return q;
  return c.json(await blastRadius(c.var.g, q.path));
});

/** Read-only conflict check for the editor hook: `{ conflicts }`, empty when the edit is safe. */
app.get("/api/check", async (c) => {
  const q = parse(z.object({ path: pathString, agent: z.string().min(1).max(128) }), c.req.query(), c);
  if (q instanceof Response) return q;
  return c.json({ conflicts: await findConflicts(c.var.g, { agent: q.agent, paths: [q.path] }) });
});

// parallelBatches rebuilds INTERFERES edges, so it is rate limited like the other writes.
app.get("/api/batches", limit(60), async (c) => c.json(await parallelBatches(c.var.g)));

app.get("/api/decisions", async (c) => c.json(await listDecisions(c.var.g)));

/** The two-minute story, driven from the page so a judge never needs a terminal. */
app.post("/api/demo", limit(6), async (c) => {
  const g = c.var.g;
  if (!(await isDemoGraph(g))) return c.json({ error: NOT_DEMO }, 409);
  if (c.var.shared || !visitors) lastWrite = Date.now();
  return c.json(await runDemo(g));
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
  const g = c.var.g;
  // Wait out a running Play so this claim cannot land in the middle of the story.
  await demoSettled(g);
  if (!PUBLIC) {
    lastWrite = Date.now();
    return c.json(await claim(g, { agent: body.agent, paths: body.paths, taskId: body.task, intent: body.intent }));
  }
  if (!PUBLIC_AGENTS.includes(body.agent)) return c.json({ error: "the public demo has agents A, B, C and D" }, 400);
  const missing = await missingFiles(g, body.paths);
  if (missing.length > 0) return c.json({ error: "not in the code graph", missing }, 404);
  if (c.var.shared) lastWrite = Date.now();
  return c.json(await claim(g, { agent: body.agent, paths: body.paths, ttlMs: PUBLIC_TTL_MS }));
});

/**
 * Editor hook: POST { agent, path, task? } after a file edit. Off in public mode.
 * Re-parses that file first, so the edit's own collision check and the dashboard's refetch (on the
 * `edit` event) already see its new imports. A failed re-parse never loses the edit.
 */
app.post("/api/edits", limit(60), async (c) => {
  if (PUBLIC) return c.json({ error: "not found" }, 404);
  const body = parse(
    z.object({ agent: z.string().min(1).max(128), path: pathString, task: z.string().min(1).max(128).optional() }),
    await jsonBody(c),
    c,
  );
  if (body instanceof Response) return body;
  lastWrite = Date.now();
  const edit = await recordLiveEdit(g, (await isRepoOf(g, repoDir)) ? repoDir : null, { agentId: body.agent, path: body.path, taskId: body.task });
  if (edit.graph?.seq) remarkHubs();
  return c.json(edit);
});

/** Where a feed starts: after `from` when the client says, else the last REPLAY events. */
async function feedStart(from: string | undefined, c: Context<Env>): Promise<number | Response> {
  if (from === undefined) return Math.max(0, (await latestSeq(c.var.g)) - REPLAY);
  return parse(z.coerce.number().int().min(0), from, c);
}

/**
 * Polling twin of `/api/events`, for proxies that buffer SSE (Cloudflare quick tunnels do).
 * At most 200 events a call; 120 calls a minute is two tabs polling every 2 s with room to spare.
 */
app.get("/api/feed", limit(120), async (c) => {
  const last = await feedStart(c.req.query("last"), c);
  if (last instanceof Response) return last;
  return c.json(await feedSince(c.var.g, last));
});

/**
 * SSE feed. Resumes after `?last=` or the browser's `Last-Event-ID` on reconnect.
 * One loop per client: `last` only moves forward, so a row is never sent twice.
 */
app.get("/api/events", async (c) => {
  const last0 = await feedStart(c.req.header("last-event-id") ?? c.req.query("last"), c);
  if (last0 instanceof Response) return last0;
  const g = c.var.g;
  return streamSSE(c, async (stream) => {
    await stream.write("retry: 3000\n\n");
    let last = last0;
    let pingedAt = Date.now();
    let open = true;
    stream.onAbort(() => {
      open = false;
    });
    while (open && !stream.aborted) {
      visitors?.touch(g.name); // an open tab keeps its graph
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
  // The shell hands out the visitor cookie, so the page's first API calls already share one graph.
  if (visitors) visitorId(c);
  try {
    return c.html(readFileSync(join(webDist, "index.html"), "utf8"));
  } catch {
    return c.text("The web app is not built yet.", 503);
  }
});

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
  console.log(`switchboard server http://${HOST}:${PORT} graph=${g.name} db=${g.location.where}${PUBLIC ? " public" : ""}`);
});

// Human saves too. Never on the public link: visitors do not edit files.
const watcher =
  process.env.SB_WATCH === "1" && !PUBLIC && liveRepo ? watchRepo(g, liveRepo, { onUpdate: (u) => console.log(updateLine(u)) }) : null;
if (watcher) console.log(`watching ${liveRepo} for saves`);

const shutdown = async () => {
  watcher?.close();
  server.close();
  await g.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
