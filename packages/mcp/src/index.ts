import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import {
  agentId,
  blastRadius,
  brief,
  claim,
  connect,
  ensureSchema,
  formatBrief,
  handoff,
  heartbeat,
  parallelBatches,
  planTask,
  recordDecision,
  recordLesson,
  registerAgent,
  release,
  status,
  summarizeBrief,
  whyTrace,
  type AgentKind,
  type Conflict,
  type SbGraph,
} from "@switchboard/core";
import { z } from "zod";

const KINDS = ["cursor", "claude", "human"] as const;

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function conflictText(c: Conflict): string {
  return `${c.type} ${c.file} ← ${c.agent} via ${c.path.join(" → ")}`;
}

let graphPromise: Promise<SbGraph> | undefined;

/** One connection for the process. Opened on the first tool call, not at startup. */
function graph(): Promise<SbGraph> {
  if (!graphPromise) {
    graphPromise = connect()
      .then(async (g) => {
        await ensureSchema(g);
        return g;
      })
      .catch((err: unknown) => {
        graphPromise = undefined;
        throw err;
      });
  }
  return graphPromise;
}

function isKind(value: string | undefined): value is AgentKind {
  return value !== undefined && (KINDS as readonly string[]).includes(value);
}

/** The five tools agents call. Agent id is `agentId()` (SB_AGENT, else the git branch). */
export function createServer(): McpServer {
  const server = new McpServer({ name: "switchboard", version: "0.0.0" });

  server.registerTool(
    "register_agent",
    {
      description: "Register this agent. Id is SB_AGENT or the git branch of this checkout.",
      inputSchema: z.object({
        kind: z.enum(KINDS).optional().describe("cursor, claude, or human"),
      }),
    },
    async ({ kind }) => {
      const id = agentId();
      await registerAgent(await graph(), { id, kind: isKind(kind) ? kind : undefined });
      return text(`registered ${id}${kind ? ` kind=${kind}` : ""}`);
    },
  );

  server.registerTool(
    "claim",
    {
      description: "Claim files before editing. OK until=<iso>, or CONFLICT plus the import path.",
      inputSchema: z.object({
        paths: z.array(z.string()).min(1).describe("Repo-relative paths"),
        task: z.string().optional().describe("Task id"),
        intent: z.string().optional().describe("What you intend to change"),
      }),
    },
    async ({ paths, task, intent }) => {
      const res = await claim(await graph(), {
        agent: agentId(),
        paths,
        taskId: task,
        intent,
      });
      if (res.ok) return text(`OK until=${new Date(res.until).toISOString()}`);
      return text(["CONFLICT", ...res.conflicts.map(conflictText)].join("\n"));
    },
  );

  server.registerTool(
    "release",
    {
      description: "Release this agent's claims. Omit paths to release all of them.",
      inputSchema: z.object({
        paths: z.array(z.string()).optional().describe("Repo-relative paths"),
      }),
    },
    async ({ paths }) => {
      const res = await release(await graph(), { agent: agentId(), paths });
      return text(`released ${res.released}`);
    },
  );

  server.registerTool(
    "heartbeat",
    {
      description: "Tell the graph this agent is still working.",
      inputSchema: z.object({}),
    },
    async () => {
      await heartbeat(await graph(), { id: agentId() });
      return text("ok");
    },
  );

  server.registerTool(
    "status",
    {
      description: "List agents and claims that have not expired.",
      inputSchema: z.object({}),
    },
    async () => {
      const s = await status(await graph());
      const agents = s.agents.map(
        (a) => `${a.id} ${a.kind ?? "-"} ${a.status ?? "-"} claims=${a.claims.join(",") || "-"}`,
      );
      const claims = s.claims.map(
        (c) => `${c.agent} ${c.path} until=${new Date(c.until).toISOString()} task=${c.taskId ?? "-"}`,
      );
      return text(`agents:\n${agents.join("\n") || "(none)"}\nclaims:\n${claims.join("\n") || "(none)"}`);
    },
  );

  server.registerTool(
    "record_decision",
    {
      description: "Record a decision and the files it affects. An older active decision on the same file is superseded.",
      inputSchema: z.object({
        text: z.string(),
        why: z.string(),
        affects: z.array(z.string()).min(1),
        task: z.string().optional(),
      }),
    },
    async ({ text: decision, why, affects, task }) => {
      const id = await recordDecision(await graph(), {
        agent: agentId(),
        text: decision,
        why,
        paths: affects,
        taskId: task,
      });
      return text(`decision ${id}`);
    },
  );

  server.registerTool(
    "record_lesson",
    {
      description: "Record a lesson about one or more files.",
      inputSchema: z.object({
        text: z.string(),
        about: z.array(z.string()).min(1),
      }),
    },
    async ({ text: lesson, about }) => {
      const id = await recordLesson(await graph(), { text: lesson, paths: about, agent: agentId() });
      return text(`lesson ${id}`);
    },
  );

  server.registerTool(
    "brief_me",
    {
      description: "Briefing for a task id or a directory prefix: claims, decisions, lessons, events, handoff.",
      inputSchema: z.object({
        task: z.string().optional(),
        prefix: z.string().optional(),
      }),
    },
    async ({ task, prefix }) => {
      const body = formatBrief(await brief(await graph(), { taskId: task, prefix }));
      const summary = await summarizeBrief(body);
      return text(summary ? `${body}\n\nSummary: ${summary}` : body);
    },
  );

  server.registerTool(
    "why",
    {
      description: "Why a file looks like this: edit, agent, task, decision.",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path }) => {
      const hits = await whyTrace(await graph(), path);
      if (hits.length === 0) return text(`no edits recorded for ${path}`);
      return text(hits.map((h) => h.path.join(" → ")).join("\n"));
    },
  );

  server.registerTool(
    "blast_radius",
    {
      description: "Files that import this one, hop by hop. Empty means nothing depends on it.",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path }) => {
      const blast = await blastRadius(await graph(), path);
      if (blast.dependents.length === 0) return text(`${path}: no dependents`);
      return text(blast.dependents.map((d) => `${d.hops} ${d.path}`).join("\n"));
    },
  );

  server.registerTool(
    "plan_task",
    {
      description: "Open a task and name the files it will touch.",
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        paths: z.array(z.string()).min(1),
      }),
    },
    async ({ id, title, paths }) => {
      await planTask(await graph(), { id, title, paths });
      return text(`planned ${id}`);
    },
  );

  server.registerTool(
    "parallel_batches",
    {
      description: "Open tasks split into batches that can run at the same time.",
      inputSchema: z.object({}),
    },
    async () => {
      const batches = await parallelBatches(await graph());
      if (batches.length === 0) return text("no open tasks");
      return text(batches.map((b) => b.tasks.join(" ")).join("\n"));
    },
  );

  server.registerTool(
    "handoff",
    {
      description: "Hand a task to another agent, with a note the next briefing shows.",
      inputSchema: z.object({
        task: z.string(),
        to: z.string(),
        note: z.string(),
      }),
    },
    async ({ task, to, note }) => {
      await handoff(await graph(), { from: agentId(), to, taskId: task, note });
      return text(`handed ${task} to ${to}`);
    },
  );

  return server;
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  process.stdin.on("end", () => {
    if (!graphPromise) return;
    void graphPromise.then((g) => g.close()).catch(() => undefined);
  });
  const server = createServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
