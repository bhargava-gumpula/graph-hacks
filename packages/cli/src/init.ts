// `switchboard init <repo>`: wire this Switchboard checkout into another repo's Claude Code and Cursor
// config (hooks + MCP server), merging into what is there. Pure planning here; index.ts parses the repo.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** This checkout (packages/cli/src → ../../..). */
export const SWITCHBOARD_ROOT = resolve(import.meta.dirname, "../../..");

const HOOK_MARK = "/packages/hooks/hook.sh";
const NPX_MARK = "switchboard-agents hook ";
const CLAUDE_MATCHER = "Edit|MultiEdit|Write|NotebookEdit|Bash";
/** Claude Code's per-machine settings file, git-ignored: where a local clone's absolute hook paths go. */
export const LOCAL_SETTINGS = ".claude/settings.local.json";

export interface FileChange {
  path: string;
  before: string | null;
  after: string;
}

export interface InitOptions {
  /** Point every config at the published npm package (`npx -y switchboard-agents ...`): no machine paths. */
  npx?: boolean;
  /** The graph, instead of sb_<repo name>. */
  graph?: string;
  /** The dashboard port the hooks post to, instead of the one derived from the graph name. */
  port?: number;
  /** More env for the hooks and the MCP servers, e.g. SB_ENV_FILE and SB_CLOUD (a path, never a secret). */
  env?: Record<string, string>;
}

export interface InitPlan {
  repo: string;
  npx: boolean;
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

/** The hook command. `npx` mode runs the published package and names no path on this machine. */
function hookCommand(root: string, env: Record<string, string>, editor: string, event: string, npx: boolean): string {
  const hook = join(root, "packages/hooks/hook.sh");
  const target = npx ? `npx -y switchboard-agents hook` : /\s/.test(hook) ? `"${hook}"` : hook;
  const vars = Object.entries(env).map(([k, v]) => `${k}=${/\s/.test(v) ? `"${v}"` : v}`);
  return `env ${vars.join(" ")} ${target} ${editor} ${event}`;
}

const isOurs = (command: unknown) => typeof command === "string" && (command.includes(HOOK_MARK) || command.includes(NPX_MARK));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Keep `wanted` if it is all there already; else drop our old entries (and emptied groups) and append it. */
function mergeList(list: unknown, wanted: Json[], strip: (item: Json) => Json | null): Json[] {
  const items = Array.isArray(list) ? (list as Json[]) : [];
  if (wanted.length > 0 && wanted.every((w) => items.some((item) => same(item, w)))) return items;
  return [...items.map(strip).filter((item): item is Json => item !== null), ...wanted];
}

/** Claude Code hooks; `cmd` null only strips ours (the other settings file of the pair). */
function claudeSettings(current: Json, cmd: ((event: string) => string) | null): Json {
  const entry = (event: string, timeout: number) => ({ type: "command", command: cmd!(event), timeout });
  const wanted: Record<string, Json[]> = cmd
    ? {
        SessionStart: [{ hooks: [entry("start", 15)] }],
        PreToolUse: [{ matcher: CLAUDE_MATCHER, hooks: [entry("pre", 5)] }],
        PostToolUse: [{ matcher: CLAUDE_MATCHER, hooks: [entry("post", 5)] }],
        SessionEnd: [{ hooks: [entry("end", 10)] }],
      }
    : { SessionStart: [], PreToolUse: [], PostToolUse: [], SessionEnd: [] };
  const strip = (group: Json): Json | null => {
    if (!Array.isArray(group.hooks)) return group;
    const hooks = (group.hooks as Json[]).filter((h) => !isOurs(h.command));
    return hooks.length === 0 ? null : { ...group, hooks };
  };
  const hooks = { ...((current.hooks as Json | undefined) ?? {}) };
  for (const [event, groups] of Object.entries(wanted)) {
    if (!cmd && !(event in hooks)) continue;
    const merged = mergeList(hooks[event], groups, strip);
    if (merged.length > 0) hooks[event] = merged;
    else delete hooks[event];
  }
  if (!cmd && Object.keys(hooks).length === 0) {
    const rest = { ...current };
    delete rest.hooks;
    return rest;
  }
  return { ...current, hooks };
}

/**
 * Cursor hooks (cursor.com/docs/agent/hooks): edits and deletes are claimed on preToolUse, shell commands on
 * beforeShellExecution; afterFileEdit and afterShellExecution record; postToolUse carries the notices.
 */
function cursorHooks(current: Json, cmd: (event: string) => string): Json {
  const wanted: Record<string, Json[]> = {
    sessionStart: [{ command: cmd("start") }],
    preToolUse: [{ command: cmd("pre"), matcher: "Write" }, { command: cmd("pre"), matcher: "Delete" }],
    beforeShellExecution: [{ command: cmd("pre") }],
    afterFileEdit: [{ command: cmd("post") }],
    afterShellExecution: [{ command: cmd("post") }],
    postToolUse: [{ command: cmd("notify"), matcher: "Write" }, { command: cmd("notify"), matcher: "Shell" }],
    sessionEnd: [{ command: cmd("end") }],
  };
  const strip = (entry: Json): Json | null => (isOurs(entry.command) ? null : entry);
  const hooks = { ...((current.hooks as Json | undefined) ?? {}) };
  for (const [event, entries] of Object.entries(wanted)) hooks[event] = mergeList(hooks[event], entries, strip);
  return { version: 1, ...current, hooks };
}

function mcpConfig(current: Json, server: Json): Json {
  return { ...current, mcpServers: { ...((current.mcpServers as Json | undefined) ?? {}), switchboard: server } };
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

/**
 * What init would write. Reads the repo's configs; writes nothing.
 * Default (a local clone of Switchboard): the hooks point at this checkout, so Claude Code's go in the
 * git-ignored .claude/settings.local.json; Cursor has no local hooks file, so .cursor/hooks.json carries the
 * path. With `npx`, every file names the npm package instead and can be committed.
 */
export function planInit(repoDir: string, root = SWITCHBOARD_ROOT, opts: InitOptions = {}): InitPlan {
  if (!existsSync(repoDir)) throw new Error(`no such directory: ${resolve(repoDir)}`);
  // Real path: git reports one (/private/var on macOS), and SB_PREFIX is relative to it.
  const repo = realpathSync(repoDir);
  const inside = relative(existsSync(root) ? realpathSync(root) : root, repo);
  if (inside !== ".." && !inside.startsWith(`..${sep}`) && !isAbsolute(inside)) {
    throw new Error(`${repo} is part of this Switchboard checkout. Pass the repo to wire, e.g. npm run switchboard -- init ~/code/my-app`);
  }
  const npx = opts.npx === true;
  const graph = opts.graph ?? graphName(repo);
  const port = opts.port ?? serverPort(graph);
  const env = { ...hookEnv(repo, graph), SB_URL: `http://localhost:${port}`, ...opts.env };
  const cmd = (editor: string) => (event: string) => hookCommand(root, env, editor, event, npx);
  const mcp = (editor: string): Json =>
    npx
      ? {
          command: "npx",
          args: ["-y", "switchboard-agents", "mcp"],
          env: { SB_EDITOR: editor, SB_GRAPH: graph, ...(editor === "cursor" ? { SB_PROJECT_DIR: "${workspaceFolder}" } : {}), ...opts.env },
        }
      : {
          command: join(root, "node_modules/.bin/tsx"),
          args: [join(root, "packages/mcp/src/index.ts")],
          env: { SB_GRAPH: graph, SB_PREFIX: "", SB_ROOT: repo, SB_EDITOR: editor, ...opts.env },
        };
  const [hooksIn, stripIn] = npx ? [".claude/settings.json", LOCAL_SETTINGS] : [LOCAL_SETTINGS, ".claude/settings.json"];
  const build: [string, (current: Json) => Json][] = [
    [hooksIn, (c) => claudeSettings(c, cmd("claude"))],
    [stripIn, (c) => claudeSettings(c, null)],
    [".cursor/hooks.json", (c) => cursorHooks(c, cmd("cursor"))],
    [".mcp.json", (c) => mcpConfig(c, mcp("claude"))],
    [".cursor/mcp.json", (c) => mcpConfig(c, mcp("cursor"))],
  ];
  const changes: FileChange[] = [];
  for (const [rel, merge] of build) {
    const path = join(repo, rel);
    const { text, json } = readJson(path);
    // The strip pass never creates a file.
    if (text === null && rel === stripIn) continue;
    changes.push({ path, before: text, after: `${JSON.stringify(merge(json), null, 2)}\n` });
  }
  if (!npx) {
    const ignore = gitignoreChange(repo);
    if (ignore) changes.push(ignore);
  }
  return { repo, npx, graph, port, env, changes: changes.filter((c) => c.before !== c.after) };
}

/** In a git repo, make sure .claude/settings.local.json is ignored, so a machine path is never committed. */
export function gitignoreChange(repo: string): FileChange | null {
  const inGit = spawnSync("git", ["-C", repo, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).status === 0;
  if (!inGit) return null;
  if (spawnSync("git", ["-C", repo, "check-ignore", "-q", LOCAL_SETTINGS]).status === 0) return null;
  const path = join(repo, ".gitignore");
  const before = existsSync(path) ? readFileSync(path, "utf8") : null;
  const base = before ?? "";
  return { path, before, after: `${base}${base && !base.endsWith("\n") ? "\n" : ""}${LOCAL_SETTINGS}\n` };
}

/** Does applying this change keep the original in <file>.bak? .gitignore only gains a line, so it needs none. */
export const keepsBackup = (c: FileChange): boolean => c.before !== null && !c.path.endsWith(".gitignore");

/** Write the plan. An existing file is copied to <file>.bak once, before its first change. */
export function applyInit(plan: InitPlan): void {
  for (const c of plan.changes) {
    mkdirSync(dirname(c.path), { recursive: true });
    if (keepsBackup(c) && !existsSync(`${c.path}.bak`)) copyFileSync(c.path, `${c.path}.bak`);
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
