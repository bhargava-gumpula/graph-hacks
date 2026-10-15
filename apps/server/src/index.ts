import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  claim,
  connect,
  ensureSchema,
  feedSince,
  graphSnapshot,
  listClaims,
  type SbGraph,
} from "@switchboard/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.SERVER_PORT ?? 8787);
const POLL_MS = 500;
const webDist = join(import.meta.dirname, "../../web/dist");

const g: SbGraph = await connect();
await ensureSchema(g);

const app = new Hono();
app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ ok: true, graph: g.name }));

app.get("/api/graph", async (c) => c.json(await graphSnapshot(g)));

app.get("/api/claims", async (c) => c.json(await listClaims(g)));

/** Demo helper: POST { agent, paths, task? } so the UI can be driven without MCP. */
app.post("/api/claims", async (c) => {
  const body = await c.req.json<{ agent: string; paths: string[]; task?: string }>();
  return c.json(await claim(g, { agent: body.agent, paths: body.paths, taskId: body.task }));
});

app.get("/api/events", (c) => {
  let last = Number(c.req.query("last") ?? 0);
  return streamSSE(c, async (stream) => {
    while (!c.req.raw.signal.aborted) {
      const items = await feedSince(g, last);
      for (const item of items) {
        await stream.writeSSE({ event: "event", data: JSON.stringify(item), id: String(item.seq) });
        last = item.seq;
      }
      await stream.sleep(POLL_MS);
    }
  });
});

if (existsSync(webDist)) {
  app.use("/*", serveStatic({ root: webDist }));
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
