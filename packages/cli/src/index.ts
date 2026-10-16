#!/usr/bin/env tsx
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  agentId,
  blastRadius,
  brief,
  claim,
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
  whyTrace,
  type Conflict,
} from "@switchboard/core";

const USAGE = `switchboard parse [dir]
switchboard claim <file...> [--task T] [--intent text] [--agent id]
switchboard release [file...] [--agent id]
switchboard check <file> [--agent id]
switchboard edited <file> [--agent id]
switchboard decide <text> --why <why> --affects <file> [--task T] [--agent id]
switchboard lesson <text> --about <file>
switchboard brief (--task T | --prefix dir/)
switchboard why <file>
switchboard blast <file>
switchboard plan <task> <file...> [--title text]
switchboard batches
switchboard handoff <task> --to <agent> --note <text> [--agent id]`;

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
}

/** One conflict, the line hooks and agents read. */
function conflictLine(c: Conflict): string {
  return `CONFLICT ${c.type} ${c.file} ← ${c.agent} via ${c.path.join(" → ")}`;
}

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
    else if (arg.startsWith("--")) throw new Error(`unknown flag ${arg}`);
    else positional.push(arg);
  }
  return { positional, task, intent, agent, why, affects, about, prefix, to, note, title };
}

function agentOf(flags: Flags): string {
  return flags.agent ?? agentId();
}

function filesOf(flags: Flags): string[] {
  return flags.positional.slice(1);
}

const COMMANDS = new Set([
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

async function run(flags: Flags): Promise<number> {
  const command = flags.positional[0];
  if (!command || !COMMANDS.has(command)) {
    console.error(USAGE);
    return 1;
  }

  const g = await connect();
  try {
    await ensureSchema(g);
    const agent = agentOf(flags);
    const files = filesOf(flags);

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
      if (res.ok) {
        console.log(`OK until=${new Date(res.until).toISOString()}`);
        return 0;
      }
      for (const c of res.conflicts) console.log(conflictLine(c));
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
      const conflicts = await findConflicts(g, { agent, paths: [file] });
      if (conflicts.length === 0) return 0;
      for (const c of conflicts) console.log(conflictLine(c));
      return 2;
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
      if (!flags.task && !flags.prefix) throw new Error("brief needs --task or --prefix");
      const text = formatBrief(await brief(g, { taskId: flags.task, prefix: flags.prefix }));
      const summary = await summarizeBrief(text);
      console.log(summary ? `${text}\n\nSummary: ${summary}` : text);
      return 0;
    }

    if (command === "why") {
      const file = files[0];
      if (!file || files.length !== 1) throw new Error("why needs one file");
      const hits = await whyTrace(g, file);
      if (hits.length === 0) console.log(`no edits recorded for ${file}`);
      else for (const hit of hits) console.log(hit.path.join(" → "));
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
