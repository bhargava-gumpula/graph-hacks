// Switchboard MCP server (stdio). Every tool returns a one-screen text answer
// plus the same data as `structuredContent`, validated by its `outputSchema`.
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
  hotspots,
  parallelBatches,
  planTask,
  recordDecision,
  recordLesson,
  registerAgent,
  release,
  searchMemory,
  status,
  summarizeBrief,
  SWITCHBOARD_VERSION,
  whyTrace,
  type Conflict,
  type SbGraph,
} from "@switchboard/core";
import { z } from "zod";

const KINDS = ["cursor", "claude", "human"] as const;

/** Sent once at initialize; clients put it in the agent's context. */
export const INSTRUCTIONS =
  "Switchboard coordinates the agents on this repo through a shared graph of its imports. Call claim before " +
  "editing any file, unless the Switchboard hooks are installed: they claim each edit for you and refuse one that " +
  "collides. Paths are relative to the parsed repo (ui/LoginForm.tsx, not demo-repo/ui/LoginForm.tsx). ok=false or " +
  "a refusal names the file, who holds it, the import path and when it frees: do not edit it or work around it " +
  "with Bash; report the path, then pick a safe file or call brief_me. Call brief_me at the start, " +
  "search_memory to find earlier decisions and lessons by their words, record_decision when you choose an approach, record_lesson for a gotcha others need, handoff to pass work on, " +
  "release when done.";

/** brief_me returns at most this many events: the newest per (kind, path, agent). */
const BRIEF_EVENTS = 5;

const path = z.string().min(1).describe("Repo-relative file path, e.g. auth/session.ts");
const paths = z.array(path).min(1);
const agentArg = z
  .string()
  .min(1)
  .optional()
  .describe("Agent id. Omit it: defaults to SB_AGENT, else the git branch of this checkout.");

const conflictSchema = z.object({
  file: z.string(),
  type: z.enum(["SAME", "UPSTREAM", "DOWNSTREAM"]),
  claimed: z.string(),
  path: z.array(z.string()),
  hops: z.number(),
  agent: z.string(),
  taskId: z.string().nullable(),
  intent: z.string().nullable(),
  until: z.number().optional(),
  hub: z.boolean().optional(),
});

function unknownText(paths: string[] | undefined): string[] {
  return (paths ?? []).map((p) => `WARNING not in the parsed graph, no dependency check: ${p}`);
}

/** Text for humans and older clients, structured data for agents. */
function reply<T extends Record<string, unknown>>(text: string, data: T) {
  return { content: [{ type: "text" as const, text }], structuredContent: data };
}

export function conflictText(c: Conflict): string {
  return `${c.type} ${c.file} ← ${c.agent} via ${c.path.join(" → ")}`;
}

let graphPromise: Promise<SbGraph> | undefined;

/** One connection per process, opened on the first tool call so `tools/list` works without FalkorDB. */
function graph(): Promise<SbGraph> {
  graphPromise ??= connect()
    .then(async (g) => {
      await ensureSchema(g);
      return g;
    })
    .catch((err: unknown) => {
      graphPromise = undefined; // retry on the next call
      throw err;
    });
  return graphPromise;
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "switchboard", version: SWITCHBOARD_VERSION }, { instructions: INSTRUCTIONS });
  const who = (agent?: string) => agent ?? agentId();

  server.registerTool(
    "register_agent",
    {
      title: "Register agent",
      description:
        "Call once at the start of a session. Marks you active in the shared Switchboard graph so other agents see you.",
      inputSchema: z.object({
        kind: z.enum(KINDS).optional().describe("Which tool you are: cursor, claude, or human"),
        agent: agentArg,
      }),
      outputSchema: z.object({ agent: z.string(), kind: z.string().nullable(), seq: z.number() }),
    },
    async ({ kind, agent }) => {
      const id = who(agent);
      const { seq } = await registerAgent(await graph(), { id, kind });
      return reply(`registered ${id}${kind ? ` kind=${kind}` : ""}`, { agent: id, kind: kind ?? null, seq });
    },
  );

  server.registerTool(
    "claim",
    {
      title: "Claim files",
      description:
        "Call BEFORE editing files. Checks the import graph for other agents' claims on these files or on files they " +
        "import / are imported by (up to 3 hops, or SB_HOPS). ok=true: the files are yours until `until`. ok=false: do NOT edit; " +
        "each conflict names the other agent and the import path that links your file to theirs. " +
        "`unknown` lists paths the parser never saw: they were not checked or claimed.",
      inputSchema: z.object({
        paths: paths.describe("Files you are about to edit"),
        task: z.string().optional().describe("Task id this work belongs to"),
        intent: z.string().optional().describe("One line on what you will change; shown to other agents"),
        agent: agentArg,
      }),
      outputSchema: z.object({
        ok: z.boolean(),
        until: z.number().optional().describe("Epoch ms when the claim expires"),
        conflicts: z.array(conflictSchema),
        unknown: z.array(z.string()).describe("Paths not in the parsed graph: not checked, not claimed"),
        safe: z.array(z.string()).optional().describe("On a conflict: open-task files you could claim instead right now"),
      }),
    },
    async ({ paths: files, task, intent, agent }) => {
      const res = await claim(await graph(), { agent: who(agent), paths: files, taskId: task, intent });
      const unknown = res.unknown ?? [];
      const warnings = unknownText(unknown);
      if (res.ok) {
        const checked = files.length - unknown.length;
        const ok = checked > 0 ? [`OK until=${new Date(res.until).toISOString()} (${checked} checked)`] : [];
        return reply([...ok, ...warnings].join("\n"), { ok: true, until: res.until, conflicts: [], unknown });
      }
      const safe = res.safe ?? [];
      const hint = safe.length > 0 ? [`Safe now: ${safe.join(", ")}`] : [];
      const text = ["CONFLICT", ...res.conflicts.map(conflictText), ...hint, ...warnings].join("\n");
      return reply(text, { ok: false, conflicts: res.conflicts, unknown, safe });
    },
  );

  server.registerTool(
    "release",
    {
      title: "Release claims",
      description: "Call when you finish editing. Releases your claims on the given files, or all of them if `paths` is omitted.",
      inputSchema: z.object({ paths: paths.optional(), agent: agentArg }),
      outputSchema: z.object({ released: z.number() }),
    },
    async ({ paths: files, agent }) => {
      const { released } = await release(await graph(), { agent: who(agent), paths: files });
      return reply(`released ${released}`, { released });
    },
  );

  server.registerTool(
    "heartbeat",
    {
      title: "Heartbeat",
      description: "Call every few minutes during long work so other agents know you are still active.",
      inputSchema: z.object({ agent: agentArg }),
      outputSchema: z.object({ agent: z.string(), seq: z.number() }),
    },
    async ({ agent }) => {
      const id = who(agent);
      const { seq } = await heartbeat(await graph(), { id });
      return reply(`ok ${id}`, { agent: id, seq });
    },
  );

  server.registerTool(
    "status",
    {
      title: "Status",
      description: "Who is working right now: every agent and every claim that has not expired.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        agents: z.array(
          z.object({
            id: z.string(),
            kind: z.string().nullable(),
            status: z.string().nullable(),
            lastSeen: z.number().nullable(),
            claims: z.array(z.string()),
          }),
        ),
        claims: z.array(
          z.object({ agent: z.string(), path: z.string(), until: z.number(), taskId: z.string().nullable() }),
        ),
      }),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const s = await status(await graph());
      const agents = s.agents.map((a) => `${a.id} ${a.kind ?? "-"} ${a.status ?? "-"} claims=${a.claims.join(",") || "-"}`);
      const claims = s.claims.map(
        (c) => `${c.agent} ${c.path} until=${new Date(c.until).toISOString()} task=${c.taskId ?? "-"}`,
      );
      const text = `agents:\n${agents.join("\n") || "(none)"}\nclaims:\n${claims.join("\n") || "(none)"}`;
      return reply(text, { agents: s.agents, claims: s.claims });
    },
  );

  server.registerTool(
    "record_decision",
    {
      title: "Record decision",
      description:
        "Record a design decision and the files it affects, so later agents (and `why`) can find it. " +
        "An older active decision on the same file is marked superseded.",
      inputSchema: z.object({
        text: z.string().min(1).describe("The decision, e.g. 'use argon2, not bcrypt'"),
        why: z.string().min(1).describe("The reason"),
        affects: paths.describe("Files the decision applies to"),
        task: z.string().optional().describe("Task the decision caused"),
        agent: agentArg,
      }),
      outputSchema: z.object({ id: z.string() }),
    },
    async ({ text, why, affects, task, agent }) => {
      const id = await recordDecision(await graph(), { agent: who(agent), text, why, paths: affects, taskId: task });
      return reply(`decision ${id}`, { id });
    },
  );

  server.registerTool(
    "record_lesson",
    {
      title: "Record lesson",
      description: "Record something you learned about files (a gotcha, a failed approach) so the next agent's briefing shows it.",
      inputSchema: z.object({
        text: z.string().min(1).describe("The lesson"),
        about: paths.describe("Files it is about"),
        agent: agentArg,
      }),
      outputSchema: z.object({ id: z.string() }),
    },
    async ({ text, about, agent }) => {
      const id = await recordLesson(await graph(), { text, paths: about, agent: who(agent) });
      return reply(`lesson ${id}`, { id });
    },
  );

  server.registerTool(
    "brief_me",
    {
      title: "Brief me",
      description:
        "Call before starting a task or taking over someone else's. Returns nearby claims, active decisions, lessons, " +
        "recent events and the latest handoff note for a task id or a directory prefix. With neither, the whole repo. " +
        "Pass `about` to also get decisions and lessons anywhere in the repo that mention its words.",
      inputSchema: z.object({
        task: z.string().min(1).optional().describe("Task id"),
        prefix: z.string().optional().describe("Directory prefix, e.g. auth/ ('' or omitted: the whole repo)"),
        about: z.string().max(500).optional().describe("What you are about to do, in a few words, e.g. 'shorter session ttl'"),
      }),
      outputSchema: z.object({ text: z.string(), summary: z.string().nullable(), brief: z.record(z.string(), z.unknown()) }),
      annotations: { readOnlyHint: true },
    },
    async ({ task, prefix, about }) => {
      const b = await brief(await graph(), {
        taskId: task,
        prefix: task === undefined && prefix === undefined ? "" : prefix,
        text: about,
      });
      const text = formatBrief(b);
      const summary = await summarizeBrief(text);
      // Events arrive newest first; keep the newest per (kind, path, agent).
      const seen = new Set<string>();
      const events = b.events
        .filter((e) => {
          const key = `${e.kind}\0${e.path}\0${e.agentId ?? ""}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, BRIEF_EVENTS);
      return reply(summary ? `${text}\n\nSummary: ${summary}` : text, { text, summary, brief: { ...b, events } });
    },
  );

  server.registerTool(
    "search_memory",
    {
      title: "Search memory",
      description:
        "Find recorded decisions (by their text or their reason) and lessons that mention any of these words, " +
        "best match first, with the files they are about. Use it before choosing an approach someone may have ruled out.",
      inputSchema: z.object({
        words: z.string().min(1).max(500).describe("Plain words, e.g. 'session ttl mobile'. Punctuation is ignored."),
        limit: z.number().int().min(1).max(20).optional().describe("Most hits to return (default 5)"),
      }),
      outputSchema: z.object({
        hits: z.array(
          z.object({
            kind: z.enum(["decision", "lesson"]),
            id: z.string(),
            text: z.string(),
            why: z.string().nullable(),
            status: z.string().nullable(),
            paths: z.array(z.string()),
            score: z.number(),
          }),
        ),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ words, limit }) => {
      const hits = await searchMemory(await graph(), words, limit);
      const text =
        hits.length === 0
          ? `nothing recorded mentions: ${words}`
          : hits
              .map((h) => `${h.kind} ${h.id}: ${h.text}${h.why ? `. Why: ${h.why}` : ""}${h.paths.length ? ` (${h.paths.join(", ")})` : ""}`)
              .join("\n");
      return reply(text, { hits });
    },
  );

  server.registerTool(
    "hotspots",
    {
      title: "Refusal hotspots",
      description:
        "Files that sat on the most refused import paths in the last N days, most refused first. " +
        "A file high on this list is where agents keep colliding: plan work around it or split it.",
      inputSchema: z.object({
        days: z.number().positive().max(365).optional().describe("Look back this many days (default 7)"),
        limit: z.number().int().min(1).max(50).optional().describe("Most files to return (default 10)"),
      }),
      outputSchema: z.object({
        hotspots: z.array(z.object({ path: z.string(), refusals: z.number(), lastAt: z.number() })),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ days, limit }) => {
      const spots = await hotspots(await graph(), { days, limit });
      const text =
        spots.length === 0
          ? "no refusals in that window"
          : spots.map((h) => `${h.refusals} ${h.path} (last ${new Date(h.lastAt).toISOString()})`).join("\n");
      return reply(text, { hotspots: spots });
    },
  );

  server.registerTool(
    "why",
    {
      title: "Why is this file like this",
      description: "Trace a file's recent edits to the agent, task and decision behind them (newest first).",
      inputSchema: z.object({ path }),
      outputSchema: z.object({ path: z.string(), hits: z.array(z.record(z.string(), z.unknown())) }),
      annotations: { readOnlyHint: true },
    },
    async ({ path: file }) => {
      const hits = await whyTrace(await graph(), file);
      const text =
        hits.length === 0
          ? `no edits or decisions recorded for ${file}`
          : hits.map((h) => `${h.path.join(" → ")}${h.edits > 1 ? ` (${h.edits} edits)` : ""}`).join("\n");
      return reply(text, { path: file, hits: hits.map((h) => ({ ...h })) });
    },
  );

  server.registerTool(
    "blast_radius",
    {
      title: "Blast radius",
      description:
        "Files that import this one, directly or up to 3 hops away (SB_HOPS changes it), with any agent claiming them. " +
        "Check before changing an export.",
      inputSchema: z.object({ path }),
      outputSchema: z.object({
        path: z.string(),
        dependents: z.array(z.object({ path: z.string(), hops: z.number(), agents: z.array(z.string()) })),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ path: file }) => {
      const blast = await blastRadius(await graph(), file);
      const text =
        blast.dependents.length === 0
          ? `${file}: no dependents`
          : blast.dependents.map((d) => `${d.hops} ${d.path}${d.agents.length ? ` (claimed by ${d.agents.join(",")})` : ""}`).join("\n");
      return reply(text, { path: blast.path, dependents: blast.dependents });
    },
  );

  server.registerTool(
    "plan_task",
    {
      title: "Plan task",
      description: "Open a task and list the files it will touch. Feeds `parallel_batches`.",
      inputSchema: z.object({
        id: z.string().min(1).describe("Task id"),
        title: z.string().optional(),
        paths: paths.describe("Files the task will touch"),
      }),
      outputSchema: z.object({ id: z.string(), paths: z.array(z.string()) }),
    },
    async ({ id, title, paths: files }) => {
      await planTask(await graph(), { id, title, paths: files });
      return reply(`planned ${id}`, { id, paths: files });
    },
  );

  server.registerTool(
    "parallel_batches",
    {
      title: "Parallel rounds",
      description:
        "Split open tasks into rounds. Tasks in one round touch unrelated code and can run at the same time; " +
        "run round 0 first, then round 1, and so on. Each item's componentId is its round index.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        batches: z.array(z.object({ componentId: z.number(), tasks: z.array(z.string()), paths: z.array(z.string()) })),
      }),
    },
    async () => {
      const batches = await parallelBatches(await graph());
      const text =
        batches.length === 0 ? "no open tasks" : batches.map((b) => `round ${b.componentId}: ${b.tasks.join(" ")}`).join("\n");
      return reply(text, { batches });
    },
  );

  server.registerTool(
    "handoff",
    {
      title: "Hand off",
      description: "Hand a task to another agent with a note. The next `brief_me` for that task shows the note.",
      inputSchema: z.object({
        task: z.string().min(1).describe("Task id"),
        to: z.string().min(1).describe("Agent id receiving the task"),
        note: z.string().min(1).describe("What they need to know"),
        agent: agentArg,
      }),
      outputSchema: z.object({ task: z.string(), from: z.string(), to: z.string() }),
    },
    async ({ task, to, note, agent }) => {
      const from = who(agent);
      await handoff(await graph(), { from, to, taskId: task, note });
      return reply(`handed ${task} to ${to}`, { task, from, to });
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
    void graphPromise?.then((g) => g.close()).catch(() => undefined);
  });
  createServer()
    .connect(new StdioServerTransport())
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}
