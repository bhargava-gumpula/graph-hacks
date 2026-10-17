#!/usr/bin/env node
// `switchboard` / `switchboard-agents`: the repo CLI (packages/cli) plus what an installed package needs:
// `mcp` (the stdio MCP server), `hook` (the editor hook) and an `init` that points configs at this install.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gitignoreChange, LOCAL_SETTINGS } from "../../cli/src/init.js";
import { configure, project } from "./env.js";

const HERE = import.meta.dirname;
// Sibling bundles, loaded only by the command that needs them, so `hook` stays fast.
const MCP = "./switchboard-mcp.mjs";
const HOOK = "./hook.mjs";

const EXTRA = `
Installed package
  init [dir] [--cursor] [--claude] [--dry-run]
                                            wire a repo: Cursor (.cursor/hooks.json, .cursor/mcp.json) and/or
                                            Claude Code (.claude/settings.local.json hooks, .mcp.json); both by default.
                                            Then parse it into its graph (sb_<repo name>).
  mcp                                       run the stdio MCP server (15 tools)
  hook <claude|cursor> <start|pre|post|notify|end>
                                            run the editor hook (JSON event on stdin)

Defaults outside a Switchboard checkout: the graph is sb_<repo name> (shared by every worktree), paths
are relative to the git root, the agent id is <editor>@<branch>. FALKORDB_URL, SB_GRAPH and SB_AGENT override.`;

type Json = Record<string, unknown>;

const quote = (s: string) => (/[\s"]/.test(s) ? JSON.stringify(s) : s);
const hookCmd = (editor: string, event: string) =>
  `${quote(process.execPath)} ${quote(join(HERE, "hook.mjs"))} ${editor} ${event}`;
const isOurs = (cmd: unknown) => typeof cmd === "string" && /hook\.mjs"? (claude|cursor) (start|pre|post|notify|end)$/.test(cmd);

function readJson(file: string): Json {
  if (!existsSync(file)) return {};
  const json = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error(`${file} is not a JSON object`);
  return json as Json;
}

/** Claude Code settings: drop our old hook entries (and groups and events they emptied); `add` then adds ours. */
function claudeSettings(cur: Json, add = true): Json {
  const hooks = { ...((cur.hooks as Json | undefined) ?? {}) };
  const matcher = "Edit|MultiEdit|Write|NotebookEdit|Bash";
  const wanted: Record<string, Json> = {
    SessionStart: { hooks: [{ type: "command", command: hookCmd("claude", "start"), timeout: 15 }] },
    PreToolUse: { matcher, hooks: [{ type: "command", command: hookCmd("claude", "pre"), timeout: 5 }] },
    PostToolUse: { matcher, hooks: [{ type: "command", command: hookCmd("claude", "post"), timeout: 5 }] },
    SessionEnd: { hooks: [{ type: "command", command: hookCmd("claude", "end"), timeout: 10 }] },
  };
  for (const [event, group] of Object.entries(wanted)) {
    if (!add && !Array.isArray(hooks[event])) continue;
    const groups = (Array.isArray(hooks[event]) ? (hooks[event] as Json[]) : [])
      .map((g) => (Array.isArray(g.hooks) ? { ...g, hooks: (g.hooks as Json[]).filter((h) => !isOurs(h.command)) } : g))
      .filter((g) => !Array.isArray(g.hooks) || g.hooks.length > 0);
    if (add) hooks[event] = [...groups, group];
    else if (groups.length > 0) hooks[event] = groups;
    else delete hooks[event];
  }
  if (Object.keys(hooks).length > 0) return { ...cur, hooks };
  const rest = { ...cur };
  delete rest.hooks;
  return rest;
}

function cursorHooks(cur: Json): Json {
  const hooks = { ...((cur.hooks as Json | undefined) ?? {}) };
  // The same events as packages/cli/src/init.ts: claims on preToolUse and beforeShellExecution, records after,
  // notices (who waits, what is free) on postToolUse.
  const wanted: Record<string, Json[]> = {
    sessionStart: [{ command: hookCmd("cursor", "start") }],
    preToolUse: [{ command: hookCmd("cursor", "pre"), matcher: "Write" }, { command: hookCmd("cursor", "pre"), matcher: "Delete" }],
    beforeShellExecution: [{ command: hookCmd("cursor", "pre") }],
    afterFileEdit: [{ command: hookCmd("cursor", "post") }],
    afterShellExecution: [{ command: hookCmd("cursor", "post") }],
    postToolUse: [{ command: hookCmd("cursor", "notify"), matcher: "Write" }, { command: hookCmd("cursor", "notify"), matcher: "Shell" }],
    sessionEnd: [{ command: hookCmd("cursor", "end") }],
  };
  for (const [event, entries] of Object.entries(wanted)) {
    const kept = (Array.isArray(hooks[event]) ? (hooks[event] as Json[]) : []).filter((e) => !isOurs(e.command));
    hooks[event] = [...kept, ...entries];
  }
  return { version: 1, ...cur, hooks };
}

function mcpServers(cur: Json, editor: string): Json {
  const env: Record<string, string> = { SB_EDITOR: editor };
  if (editor === "cursor") env.SB_PROJECT_DIR = "${workspaceFolder}";
  const server = { command: process.execPath, args: [join(HERE, "switchboard-mcp.mjs")], env };
  return { ...cur, mcpServers: { ...((cur.mcpServers as Json | undefined) ?? {}), switchboard: server } };
}

async function init(argv: string[]): Promise<number> {
  const dirs = argv.filter((a) => !a.startsWith("--"));
  const unknown = argv.filter((a) => a.startsWith("--") && !["--cursor", "--claude", "--dry-run"].includes(a));
  if (dirs.length > 1 || unknown.length > 0) {
    console.error("usage: switchboard init [dir] [--cursor] [--claude] [--dry-run]");
    return 1;
  }
  const repo = realpathSync(resolve(process.env.INIT_CWD ?? process.cwd(), dirs[0] ?? "."));
  const both = !argv.includes("--cursor") && !argv.includes("--claude");
  const p = project(repo);
  const files: [string, (cur: Json) => Json][] = [];
  if (both || argv.includes("--cursor")) {
    files.push([".cursor/hooks.json", cursorHooks], [".cursor/mcp.json", (c) => mcpServers(c, "cursor")]);
  }
  const claude = both || argv.includes("--claude");
  if (claude) {
    // The hook commands name this machine's node and install, so they go in Claude Code's git-ignored
    // per-machine file; hooks an older init left in the committed settings.json are taken out.
    files.push(
      [LOCAL_SETTINGS, claudeSettings],
      [".claude/settings.json", (c) => claudeSettings(c, false)],
      [".mcp.json", (c) => mcpServers(c, "claude")],
    );
  }
  const write = (rel: string, text: string) => {
    const path = join(p.root, rel);
    if (argv.includes("--dry-run")) console.log(`--- ${rel}\n${text}`);
    else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
      console.log(`wrote ${rel}`);
    }
  };
  for (const [rel, merge] of files) {
    const path = join(p.root, rel);
    const exists = existsSync(path);
    // The strip pass never creates a file, and a file that already holds what we want is left as it is.
    if (!exists && rel === ".claude/settings.json") continue;
    const cur = readJson(path);
    const next = merge(cur);
    if (!exists || JSON.stringify(next) !== JSON.stringify(cur)) write(rel, `${JSON.stringify(next, null, 2)}\n`);
  }
  const ignore = claude ? gitignoreChange(p.root) : null;
  if (ignore) write(".gitignore", ignore.after);
  if (argv.includes("--dry-run")) {
    console.log(`Would parse ${p.root} into graph ${process.env.SB_GRAPH ?? p.graph}. Nothing was written (--dry-run).`);
    return 0;
  }
  if (HERE.includes("/_npx/")) {
    console.log("\nThese configs point into the npx cache, which npm may clean. For a stable path: npm i -g switchboard-agents && switchboard init");
  }
  const parsed = spawnSync(process.execPath, [join(HERE, "switchboard.mjs"), "parse", p.root], {
    stdio: "inherit",
    env: { ...process.env, SB_GRAPH: process.env.SB_GRAPH ?? p.graph, SB_ROOT: p.root, SB_PREFIX: "" },
  });
  if (parsed.status !== 0) {
    console.log("\nThe configs are written, but the parse failed. Start FalkorDB (docker run -d -p 6379:6379 falkordb/falkordb), then: switchboard parse");
    return 1;
  }
  console.log(`\nParsed ${p.root} into graph ${process.env.SB_GRAPH ?? p.graph}. Restart Cursor or Claude Code in this repo; edits are now claimed automatically.`);
  return 0;
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "mcp") {
  const mcp = (await import(MCP)) as { start(): Promise<void> };
  await mcp.start();
} else if (cmd === "hook") {
  const hook = (await import(HOOK)) as { main(editor?: string, event?: string): Promise<void> };
  await hook.main(rest[0], rest[1]);
} else if (cmd === "init") {
  process.exitCode = await init(rest);
} else {
  configure(process.cwd());
  // `parse` with no directory parses this project, not the repo CLI's demo-repo default.
  if (cmd === "parse" && !rest.some((a) => !a.startsWith("--"))) process.argv.push(process.env.SB_ROOT!);
  await import("../../cli/src/index.js");
  if (cmd === undefined || cmd === "help" || rest.includes("--help") || process.argv.includes("-h") || cmd === "--help") {
    console.log(EXTRA);
  }
}
