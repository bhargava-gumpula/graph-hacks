// `switchboard init <repo>`: wire this Switchboard checkout into another repo's Claude Code and Cursor
// config (hooks + MCP server), merging into what is there. Pure planning here; index.ts parses the repo.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** This checkout (packages/cli/src → ../../..). */
export const SWITCHBOARD_ROOT = resolve(import.meta.dirname, "../../..");

const HOOK_MARK = "/packages/hooks/hook.sh";
const CLAUDE_MATCHER = "Edit|MultiEdit|Write|NotebookEdit";

export interface FileChange {
  path: string;
  before: string | null;
  after: string;
}

export interface InitPlan {
  repo: string;
  graph: string;
  port: number;
  env: Record<string, string>;
  changes: FileChange[];
}

type Json = Record<string, unknown>;

/** sb_<repo basename>, lowercased, anything but [a-z0-9] collapsed to _. */
export function graphName(repo: string): string {
  const slug = basename(resolve(repo))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `sb_${slug || "repo"}`;
}

/**
 * The repo's own server port, 8800-8999, fixed by its graph name. The hooks post to it, so a quickstart demo
 * server on 8787 (another graph) never receives this repo's claims.
 * ponytail: two repos can hash to the same port; if both servers run at once their hooks cross. Upgrade path:
 * hook.sh checks /api/health's graph against SB_GRAPH before taking the HTTP path.
 */
export function serverPort(graph: string): number {
  let h = 0;
  for (const ch of graph) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 8800 + (h % 200);
}

/**
 * The hook env for a repo. Inside git, SB_PREFIX is the repo's path below the git top level, so a worktree
 * resolves paths against its own checkout. Outside git there is no top level, so SB_ROOT pins the repo.
 */
export function hookEnv(repo: string, graph: string): Record<string, string> {
  const base = { SB_GRAPH: graph, SB_URL: `http://localhost:${serverPort(graph)}` };
  const top = spawnSync("git", ["-C", repo, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (top.status !== 0) return { ...base, SB_PREFIX: "", SB_ROOT: repo };
  return { ...base, SB_PREFIX: relative(top.stdout.trim(), repo).split("\\").join("/") };
}

function hookCommand(root: string, env: Record<string, string>, editor: string, event: string): string {
  const hook = join(root, "packages/hooks/hook.sh");
  const quoted = /\s/.test(hook) ? `"${hook}"` : hook;
  const vars = Object.entries(env).map(([k, v]) => `${k}=${/\s/.test(v) ? `"${v}"` : v}`);
  return `env ${vars.join(" ")} ${quoted} ${editor} ${event}`;
}

const isOurs = (command: unknown) => typeof command === "string" && command.includes(HOOK_MARK);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Keep `wanted` if it is already there; else drop our old entries (and emptied groups) and append it. */
function mergeList(list: unknown, wanted: Json, strip: (item: Json) => Json | null): Json[] {
  const items = Array.isArray(list) ? (list as Json[]) : [];
  if (items.some((item) => same(item, wanted))) return items;
  return [...items.map(strip).filter((item): item is Json => item !== null), wanted];
}

function claudeSettings(current: Json, root: string, env: Record<string, string>): Json {
  const cmd = (event: string, timeout: number) => ({ type: "command", command: hookCommand(root, env, "claude", event), timeout });
  const wanted: Record<string, Json> = {
    SessionStart: { hooks: [cmd("start", 15)] },
    PreToolUse: { matcher: CLAUDE_MATCHER, hooks: [cmd("pre", 5)] },
    PostToolUse: { matcher: CLAUDE_MATCHER, hooks: [cmd("post", 5)] },
    SessionEnd: { hooks: [cmd("end", 10)] },
  };
  const strip = (group: Json): Json | null => {
    if (!Array.isArray(group.hooks)) return group;
    const hooks = (group.hooks as Json[]).filter((h) => !isOurs(h.command));
    return hooks.length === 0 ? null : { ...group, hooks };
  };
  const hooks = { ...((current.hooks as Json | undefined) ?? {}) };
  for (const [event, group] of Object.entries(wanted)) hooks[event] = mergeList(hooks[event], group, strip);
  return { ...current, hooks };
}

function cursorHooks(current: Json, root: string, env: Record<string, string>): Json {
  const cmd = (event: string) => hookCommand(root, env, "cursor", event);
  const wanted: Record<string, Json> = {
    sessionStart: { command: cmd("start") },
    preToolUse: { command: cmd("pre"), matcher: "Write" },
    afterFileEdit: { command: cmd("post") },
    sessionEnd: { command: cmd("end") },
  };
  const strip = (entry: Json): Json | null => (isOurs(entry.command) ? null : entry);
  const hooks = { ...((current.hooks as Json | undefined) ?? {}) };
  for (const [event, entry] of Object.entries(wanted)) hooks[event] = mergeList(hooks[event], entry, strip);
  return { version: 1, ...current, hooks };
}

function mcpConfig(current: Json, root: string, repo: string, graph: string): Json {
  const servers = { ...((current.mcpServers as Json | undefined) ?? {}) };
  servers.switchboard = {
    command: join(root, "node_modules/.bin/tsx"),
    args: [join(root, "packages/mcp/src/index.ts")],
    env: { SB_GRAPH: graph, SB_PREFIX: "", SB_ROOT: repo },
  };
  return { ...current, mcpServers: servers };
}

function readJson(file: string): { text: string | null; json: Json } {
  if (!existsSync(file)) return { text: null, json: {} };
  const text = readFileSync(file, "utf8");
  try {
    const json = JSON.parse(text) as unknown;
    if (json && typeof json === "object" && !Array.isArray(json)) return { text, json: json as Json };
  } catch {
    // reported below
  }
  throw new Error(`${file} is not a JSON object. Fix it or move it aside, then run init again.`);
}

/** What init would write. Reads the repo's configs; writes nothing. */
export function planInit(repoDir: string, root = SWITCHBOARD_ROOT): InitPlan {
  if (!existsSync(repoDir)) throw new Error(`no such directory: ${resolve(repoDir)}`);
  // Real path: git reports one (/private/var on macOS), and SB_PREFIX is relative to it.
  const repo = realpathSync(repoDir);
  const inside = relative(existsSync(root) ? realpathSync(root) : root, repo);
  if (inside !== ".." && !inside.startsWith(`..${sep}`) && !isAbsolute(inside)) {
    throw new Error(`${repo} is part of this Switchboard checkout. Pass the repo to wire, e.g. npm run switchboard -- init ~/code/my-app`);
  }
  const graph = graphName(repo);
  const env = hookEnv(repo, graph);
  const build: [string, (current: Json) => Json][] = [
    [".claude/settings.json", (c) => claudeSettings(c, root, env)],
    [".cursor/hooks.json", (c) => cursorHooks(c, root, env)],
    [".mcp.json", (c) => mcpConfig(c, root, repo, graph)],
  ];
  const changes = build.map(([rel, merge]) => {
    const path = join(repo, rel);
    const { text, json } = readJson(path);
    return { path, before: text, after: `${JSON.stringify(merge(json), null, 2)}\n` };
  });
  return { repo, graph, port: serverPort(graph), env, changes: changes.filter((c) => c.before !== c.after) };
}

/** Write the plan. An existing file is copied to <file>.bak once, before its first change. */
export function applyInit(plan: InitPlan): void {
  for (const c of plan.changes) {
    mkdirSync(dirname(c.path), { recursive: true });
    if (c.before !== null && !existsSync(`${c.path}.bak`)) copyFileSync(c.path, `${c.path}.bak`);
    writeFileSync(c.path, c.after);
  }
}

/** A line diff (longest common subsequence), `-`/`+`/` ` prefixed. Config files are small. */
export function lineDiff(before: string, after: string): string {
  const a = before ? before.replace(/\n$/, "").split("\n") : [];
  const b = after.replace(/\n$/, "").split("\n");
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push(`  ${a[i++]}`);
      j++;
    } else if (j < b.length && (i === a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) out.push(`+ ${b[j++]}`);
    else out.push(`- ${a[i++]}`);
  }
  return out.join("\n");
}
