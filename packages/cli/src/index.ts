#!/usr/bin/env tsx
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  agentId,
  claim,
  connect,
  ensureSchema,
  findConflicts,
  loadParse,
  parseRepo,
  recordEdit,
  release,
  type Conflict,
} from "@switchboard/core";

const USAGE = `switchboard parse [dir]
switchboard claim <file...> [--task T] [--intent text] [--agent id]
switchboard release [file...] [--agent id]
switchboard check <file> [--agent id]
switchboard edited <file> [--agent id]`;

interface Flags {
  positional: string[];
  task?: string;
  intent?: string;
  agent?: string;
}

/** One conflict, the line hooks and agents read. */
function conflictLine(c: Conflict): string {
  return `CONFLICT ${c.type} ${c.file} ← ${c.agent} via ${c.path.join(" → ")}`;
}

function parseArgs(argv: string[]): Flags {
  const positional: string[] = [];
  let task: string | undefined;
  let intent: string | undefined;
  let agent: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--task" || arg === "--intent" || arg === "--agent") {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      if (arg === "--task") task = value;
      else if (arg === "--intent") intent = value;
      else agent = value;
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown flag ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  return { positional, task, intent, agent };
}

function agentOf(flags: Flags): string {
  return flags.agent ?? agentId();
}

function filesOf(flags: Flags): string[] {
  return flags.positional.slice(1);
}

const COMMANDS = new Set(["parse", "claim", "release", "check", "edited"]);

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
      const seq = await recordEdit(g, { agentId: agent, path: file });
      console.log(`edited ${file} seq=${seq}`);
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
