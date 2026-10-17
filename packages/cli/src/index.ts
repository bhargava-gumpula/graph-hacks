#!/usr/bin/env tsx
import { existsSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  agentId,
  blastRadius,
  heartbeat,
  registerAgent,
  status,
  brief,
  claim,
  codeGraphCounts,
  connect,
  ensureSchema,
  findConflicts,
  formatBrief,
  handoff,
  loadParse,
  parallelBatches,
  parseRepo,
  planTask,
  recordDecision,
  recordEdit,
  recordLesson,
  release,
  summarizeBrief,
  unknownPaths,
  whyTrace,
  type AgentKind,
  type Conflict,
} from "@switchboard/core";
import { applyInit, lineDiff, planInit, SWITCHBOARD_ROOT } from "./init.js";

const USAGE = `switchboard: coordinate AI coding agents through a shared FalkorDB graph.

Usage: switchboard <command> [args] [--agent id]

Agents and claims
  register [--kind cursor|claude|human]     mark this agent active
  heartbeat                                 tell others you are still working
  status                                    agents and live claims
  claim <file...> [--task T] [--intent text]
                                            claim files before editing (exit 2 on conflict)
  release [file...]                         release your claims (all if no files)
  check <file>                              exit 2 and print the import path if editing <file>
                                            would collide with another agent's claim; else exit 0
                                            Paths are repo-relative; demo-repo/, ./ and absolute
                                            paths are normalised. A file the parser never saw
                                            prints a WARNING: nothing was checked.
  edited <file> [--task T]                  record that you edited <file>

Memory
  decide <text> --why <why> --affects <file> [--affects <file>...] [--task T]
  lesson <text> --about <file> [--about <file>...]
  brief (--task T | --prefix dir/)          briefing before you start or take over ('' = whole repo)
  why <file>                                edit -> agent -> task -> decision trace
  handoff <task> --to <agent> --note <text>

Setup
  init [repoDir] [--dry-run]                wire Switchboard into another repo: hooks in .claude/settings.json
                                            and .cursor/hooks.json, the MCP server in .mcp.json, then parse it
                                            into its own graph sb_<repo name>. Merges; --dry-run prints the diff.

Planning
  parse [dir]                               load a repo's import graph (default demo-repo)
  blast <file>                              files that import <file>, hop by hop
  plan <task> <file...> [--title text]      open a task with its files
  batches                                   open tasks grouped into parallel-safe batches

Agent id: --agent, else SB_AGENT, else the git branch of the current directory.
Graph: SB_GRAPH (default sb_demo). FalkorDB: FALKORDB_URL (default redis://localhost:6379).
Exit codes: 0 ok, 1 error or bad usage, 2 conflict.`;

interface Flags {
  positional: string[];
  task?: string;
  intent?: string;
  agent?: string;
  why?: string;
  affects: string[];
  about: string[];
  prefix?: string;
  to?: string;
  note?: string;
  title?: string;
  kind?: string;
  dryRun: boolean;
  help: boolean;
}

/** One conflict, the line hooks and agents read. */
function conflictLine(c: Conflict): string {
  return `CONFLICT ${c.type} ${c.file} ← ${c.agent} via ${c.path.join(" → ")}`;
}

/** A path the parser never saw gets no dependency check; say so instead of a silent OK. */
function warnUnknown(paths: string[] | undefined): void {
  for (const p of paths ?? []) console.log(`WARNING not in the parsed graph, no dependency check: ${p}`);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function parseArgs(argv: string[]): Flags {
  const positional: string[] = [];
  const affects: string[] = [];
  const about: string[] = [];
  let task: string | undefined;
  let intent: string | undefined;
  let agent: string | undefined;
  let why: string | undefined;
  let prefix: string | undefined;
  let to: string | undefined;
  let note: string | undefined;
  let title: string | undefined;
  let kind: string | undefined;
  let help = false;
  let dryRun = false;
  const take = (flag: string, i: number) => {
    const value = argv[i + 1];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--affects") affects.push(take(arg, i++));
    else if (arg === "--about") about.push(take(arg, i++));
    else if (arg === "--task") task = take(arg, i++);
    else if (arg === "--intent") intent = take(arg, i++);
    else if (arg === "--agent") agent = take(arg, i++);
    else if (arg === "--why") why = take(arg, i++);
    else if (arg === "--prefix") prefix = take(arg, i++);
    else if (arg === "--to") to = take(arg, i++);
    else if (arg === "--note") note = take(arg, i++);
    else if (arg === "--title") title = take(arg, i++);
    else if (arg === "--kind") kind = take(arg, i++);
    else if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--")) throw new Error(`unknown flag ${arg}`);
    else positional.push(arg);
  }
  return { positional, task, intent, agent, why, affects, about, prefix, to, note, title, kind, dryRun, help };
}

function agentOf(flags: Flags): string {
  return flags.agent ?? agentId();
}

function filesOf(flags: Flags): string[] {
  return flags.positional.slice(1);
}

const KINDS: readonly AgentKind[] = ["cursor", "claude", "human"];

const COMMANDS = new Set([
  "init",
  "register",
  "heartbeat",
  "status",
  "parse",
  "claim",
  "release",
  "check",
  "edited",
  "decide",
  "lesson",
  "brief",
  "why",
  "blast",
  "plan",
  "batches",
  "handoff",
]);

/** `init`: write the merged configs, parse the repo into its graph, print what to do next. */
async function init(flags: Flags): Promise<number> {
  if (flags.positional.length > 2) throw new Error("init takes one directory");
  const plan = planInit(flags.positional[1] ?? ".");
  const shown = (path: string) => relative(plan.repo, path);
  if (flags.dryRun) {
    if (plan.changes.length === 0) console.log(`${plan.repo} is already wired to Switchboard. Nothing to change.`);
    for (const c of plan.changes) {
      console.log(`--- ${shown(c.path)}${c.before === null ? " (new file)" : ""}\n${lineDiff(c.before ?? "", c.after)}\n`);
    }
    console.log(`Would parse ${plan.repo} into graph ${plan.graph}. Nothing was written (--dry-run).`);
    return 0;
  }
  applyInit(plan);
  for (const c of plan.changes) {
    console.log(`${c.before === null ? "created" : "updated"} ${shown(c.path)}${c.before === null ? "" : ` (original kept in ${shown(c.path)}.bak)`}`);
  }
  if (plan.changes.length === 0) console.log("configs already wired, nothing changed");

  const parseCmd = `SB_GRAPH=${plan.graph} npm run switchboard -- parse ${plan.repo}`;
  const g = await connect({ graph: plan.graph }).catch((err: unknown) => {
    throw new Error(`${err instanceof Error ? err.message : err}\nThe configs are written. Once FalkorDB is up, run: ${parseCmd}`);
  });
  try {
    await ensureSchema(g);
    const parsed = parseRepo(plan.repo);
    await loadParse(g, parsed);
    const counts = await codeGraphCounts(g);
    console.log(`parsed ${plan.repo} into graph ${plan.graph}: ${counts.files} files, ${counts.imports} imports`);
  } finally {
    await g.close();
  }

  const steps = [
    `cd ${SWITCHBOARD_ROOT}`,
    ...(existsSync(join(SWITCHBOARD_ROOT, "apps/web/dist/index.html")) ? [] : ["npm run build -w @switchboard/web"]),
    `SB_GRAPH=${plan.graph} npm run server`,
  ];
  console.log(`
Next steps:
  1. Start the server on this repo's graph (one server serves one graph, so stop the demo server first):
       ${steps.join(" && ")}
  2. Open http://localhost:8787/app to watch claims and conflicts.
  3. Run claude or cursor in ${plan.repo}. Approve the switchboard MCP server when asked.
     Re-parse after big changes: ${parseCmd}`);
  if (spawnSync("jq", ["--version"]).status !== 0) {
    console.log("\nWarning: jq is not installed, so the hooks let every edit through. Install it (brew install jq).");
  }
  return 0;
}

async function run(flags: Flags): Promise<number> {
  const command = flags.positional[0];
  if (flags.help || command === "help") {
    console.log(USAGE);
    return 0;
  }
  if (!command || !COMMANDS.has(command)) {
    console.error(command ? `unknown command ${command}\n\n${USAGE}` : USAGE);
    return 1;
  }
  if (command === "init") return init(flags);
  if (flags.kind !== undefined && !(KINDS as readonly string[]).includes(flags.kind)) {
    throw new Error(`--kind must be one of ${KINDS.join(", ")}`);
  }

  const g = await connect();
  try {
    await ensureSchema(g);
    const agent = agentOf(flags);
    const files = filesOf(flags);

    if (command === "register") {
      await registerAgent(g, { id: agent, kind: flags.kind as AgentKind | undefined });
      console.log(`registered ${agent}${flags.kind ? ` kind=${flags.kind}` : ""}`);
      return 0;
    }

    if (command === "heartbeat") {
      await heartbeat(g, { id: agent });
      console.log(`ok ${agent}`);
      return 0;
    }

    if (command === "status") {
      const s = await status(g);
      console.log("agents:");
      for (const a of s.agents) console.log(`  ${a.id} ${a.kind ?? "-"} ${a.status ?? "-"} claims=${a.claims.join(",") || "-"}`);
      if (s.agents.length === 0) console.log("  (none)");
      console.log("claims:");
      for (const c of s.claims) {
        console.log(`  ${c.agent} ${c.path} until=${new Date(c.until).toISOString()} task=${c.taskId ?? "-"}`);
      }
      if (s.claims.length === 0) console.log("  (none)");
      return 0;
    }

    if (command === "parse") {
      if (files.length > 1) throw new Error("parse takes one directory");
      const parsed = parseRepo(resolve(files[0] ?? "demo-repo"));
      const counts = await loadParse(g, parsed);
      console.log(`files=${counts.files} imports=${counts.imports}`);
      return 0;
    }

    if (command === "claim") {
      if (files.length === 0) throw new Error("claim needs at least one file");
      const res = await claim(g, { agent, paths: files, taskId: flags.task, intent: flags.intent });
      warnUnknown(res.unknown);
      if (res.ok) {
        const checked = files.length - (res.unknown?.length ?? 0);
        if (checked > 0) {
          console.log(`OK until=${new Date(res.until).toISOString()} (${plural(checked, "file")} checked within 3 import hops)`);
        }
        return 0;
      }
      for (const c of res.conflicts) console.log(conflictLine(c));
      if (res.safe?.length) console.log(`Safe now: ${res.safe.join(", ")}`);
      return 2;
    }

    if (command === "release") {
      const res = await release(g, { agent, paths: files.length > 0 ? files : undefined });
      console.log(`released ${res.released}`);
      return 0;
    }

    if (command === "check") {
      const file = files[0];
      if (!file || files.length !== 1) throw new Error("check needs one file");
      const started = performance.now();
      const conflicts = await findConflicts(g, { agent, paths: [file] });
      const ms = (performance.now() - started).toFixed(1);
      if (conflicts.length > 0) {
        for (const c of conflicts) console.log(conflictLine(c));
        return 2;
      }
      const unknown = await unknownPaths(g, [file]);
      if (unknown.length > 0) warnUnknown(unknown);
      else console.log(`OK no claim within 3 import hops (${ms} ms)`);
      return 0;
    }

    if (command === "edited") {
      const file = files[0];
      if (!file || files.length !== 1) throw new Error("edited needs one file");
      const seq = await recordEdit(g, { agentId: agent, path: file, taskId: flags.task });
      console.log(`edited ${file} seq=${seq}`);
      return 0;
    }

    if (command === "decide") {
      const decision = files[0];
      if (!decision || !flags.why || flags.affects.length === 0) {
        throw new Error("decide needs text, --why, and --affects");
      }
      const id = await recordDecision(g, {
        agent,
        text: decision,
        why: flags.why,
        paths: flags.affects,
        taskId: flags.task,
      });
      console.log(`decision ${id}`);
      return 0;
    }

    if (command === "lesson") {
      const lesson = files[0];
      if (!lesson || flags.about.length === 0) throw new Error("lesson needs text and --about");
      const id = await recordLesson(g, { text: lesson, paths: flags.about, agent });
      console.log(`lesson ${id}`);
      return 0;
    }

    if (command === "brief") {
      if (!flags.task && flags.prefix === undefined) throw new Error("brief needs --task or --prefix");
      const text = formatBrief(await brief(g, { taskId: flags.task, prefix: flags.prefix }));
      const summary = await summarizeBrief(text);
      console.log(summary ? `${text}\n\nSummary: ${summary}` : text);
      return 0;
    }

    if (command === "why") {
      const file = files[0];
      if (!file || files.length !== 1) throw new Error("why needs one file");
      const hits = await whyTrace(g, file);
      if (hits.length === 0) console.log(`no edits or decisions recorded for ${file}`);
      for (const hit of hits) console.log(`${hit.path.join(" → ")}${hit.edits > 1 ? ` (${hit.edits} edits)` : ""}`);
      return 0;
    }

    if (command === "blast") {
      const file = files[0];
      if (!file || files.length !== 1) throw new Error("blast needs one file");
      const blast = await blastRadius(g, file);
      if (blast.dependents.length === 0) console.log(`${file}: no dependents`);
      else for (const dep of blast.dependents) console.log(`${dep.hops} ${dep.path}`);
      return 0;
    }

    if (command === "plan") {
      const id = files[0];
      const paths = files.slice(1);
      if (!id || paths.length === 0) throw new Error("plan needs a task id and at least one file");
      await planTask(g, { id, title: flags.title, paths });
      console.log(`planned ${id}`);
      return 0;
    }

    if (command === "batches") {
      const batches = await parallelBatches(g);
      if (batches.length === 0) console.log("no open tasks");
      else for (const batch of batches) console.log(batch.tasks.join(" "));
      return 0;
    }

    if (command === "handoff") {
      const taskId = files[0];
      if (!taskId || !flags.to || !flags.note) throw new Error("handoff needs a task, --to, and --note");
      await handoff(g, { from: agent, to: flags.to, taskId, note: flags.note });
      console.log(`handed ${taskId} to ${flags.to}`);
      return 0;
    }

    console.error(USAGE);
    return 1;
  } finally {
    await g.close();
  }
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
  let flags: Flags;
  try {
    flags = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
  run(flags)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}
