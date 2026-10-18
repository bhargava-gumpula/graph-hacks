// The editor hook, in Node: `switchboard hook <editor> <phase>`, the plugin's dist/hook.mjs, and what
// packages/hooks/hook.sh runs. It talks to FalkorDB directly; the dashboard server reads the same graph.
// Usage: hook <claude|cursor> <start|pre|post|notify|end>   (JSON event on stdin)
//   start   register the agent, put a brief in the context; files changed since the graph last saw them are
//           re-read in the background (a full load only when the graph has no parsed file yet).
//   pre     claim the file (Edit/Write) or the obvious write targets of a shell command; on a conflict,
//           deny with the import path and wait on the blocking file. SB_MODE=warn allows it with the text.
//   post    record the edit, or the files a shell command changed (git status before and after), minus
//           files another agent claims or edited meanwhile: the checkout is shared, those edits are theirs.
//           Each edited file is re-read alone (core updateFile); a hook never deletes another file's node.
// A read-only shell command (`ls`, `git diff`, `grep`...) is skipped before git or the graph.
//   notify  Cursor postToolUse: only the notices (who waits on your files, which files are free now).
//   end     release this agent's claims; files others waited on are free, and its own waits end.
// Fails open: FalkorDB down, a timeout, a parse failure or any error allows the edit. SWITCHBOARD_OFF=1 disables it.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, realpathSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  brief,
  claim,
  codeGraphCounts,
  connect,
  dbUrl,
  ensureSchema,
  formatBrief,
  markHubs,
  recordEdit,
  redactUrl,
  registerAgent,
  release,
  type Conflict,
  type SbGraph,
} from "@switchboard/core";
import { agentId, sessionAgentId } from "../../core/src/agent-id.js";
import { isSourcePath } from "../../core/src/parser.js";
import { endSession, othersOn, takeAgentId } from "../../core/src/queries/claims.js";
import { recordLiveEdit, staleFiles } from "../../core/src/queries/loader.js";
import { formatNotices, recordWaits, waitNotices } from "../../core/src/queries/waits.js";
import { configure } from "../../npm/src/env.js";
import { changedFiles, dirtyFiles, readOnly, writeTargets } from "./shell.js";

export type Editor = "claude" | "cursor";
export type Phase = "start" | "pre" | "post" | "notify" | "end";
const PHASES: Phase[] = ["start", "pre", "post", "notify", "end"];

const HERE = import.meta.dirname;
/** Hooks must answer fast; past this the edit is allowed. SessionEnd may take longer: nobody waits on it. */
const LIMIT_MS: Record<Phase, number> = { start: 4000, pre: 3000, post: 3000, notify: 3000, end: 8000 };
/** A first full load of an empty graph at most this often per graph. */
const LOAD_EVERY_MS = 20_000;
/** A shell command that changed more files than this records only the first ones. */
const MAX_SHELL_EDITS = 50;

const log = (editor: Editor, phase: Phase, msg: string) => {
  const file = process.env.SB_HOOK_LOG ?? join(tmpdir(), "switchboard-hook.log");
  try {
    appendFileSync(file, `${new Date().toISOString()} ${editor} ${phase} ${msg}\n`);
  } catch {
    // logging never blocks an edit
  }
};

/** The refusal: the import path, then who holds it and for how long. `unparsed`: requested files outside the parsed graph. */
export function denyReason(conflicts: Conflict[], safe: string[] | undefined, now = Date.now(), unparsed: string[] = []): string {
  const lines = ["✗ Switchboard blocked this edit"];
  for (const c of conflicts) {
    const same = unparsed.includes(c.file) ? " (same file; not in the parsed graph, so only the same file is checked)" : " (same file)";
    lines.push(c.path.join(" ─imports→ ") + (c.type === "SAME" ? same : ""));
    let held = `held by ${c.agent}`;
    if (c.taskId) held += ` · task ${c.taskId}`;
    if (c.intent) held += ` "${c.intent}"`;
    if (c.until) held += ` · free in ${Math.round((c.until - now) / 60000)} min`;
    lines.push(held);
  }
  if (safe?.length) lines.push(`Safe now: ${safe.join(", ")}`);
  lines.push("Don't work around this with Bash. Pick another file or call brief_me.");
  return lines.join("\n");
}

/** What the editor reads back. Each field is one the editor's hook docs list for that event. */
export function answer(editor: Editor, phase: Phase, a: { deny?: string; context?: string; note?: string }): object {
  const context = a.context || undefined;
  if (editor === "cursor") {
    // preToolUse / beforeShellExecution: permission, user_message, agent_message.
    if (phase === "pre") {
      if (a.deny) return { permission: "deny", user_message: a.deny, agent_message: a.deny };
      return context ? { permission: "allow", agent_message: context } : { permission: "allow" };
    }
    // sessionStart and postToolUse take additional_context; afterFileEdit and sessionEnd take nothing.
    return (phase === "start" || phase === "notify") && context ? { additional_context: context } : {};
  }
  const out: Record<string, unknown> = a.note ? { systemMessage: a.note } : {};
  const hookEventName = phase === "start" ? "SessionStart" : phase === "pre" ? "PreToolUse" : "PostToolUse";
  if (phase === "end" || (!a.deny && !context)) return out;
  out.hookSpecificOutput = {
    hookEventName,
    ...(a.deny ? { permissionDecision: "deny", permissionDecisionReason: a.deny } : {}),
    ...(context ? { additionalContext: context } : {}),
  };
  return out;
}

const CLI = join(HERE, "switchboard.mjs");
/** The plugin and the npm package ship the CLI (with the parser) next to this bundle; the hook itself has no parser. */
const bundled = () => existsSync(CLI);
const tmpName = (kind: string, ...parts: string[]) =>
  join(tmpdir(), `switchboard-${kind}-${createHash("sha1").update(parts.join("\0")).digest("hex").slice(0, 16)}`);

/**
 * `switchboard parse <dir> --update [files]` in a detached process (core updateRepo): each file re-read alone
 * with core updateFile, or with no files a first full load that deletes nothing. The editor never waits for
 * the parser, and no hook replaces the graph: every worktree shares it.
 * ponytail: two quick edits of one file are two processes; the later reads the newer text but may finish first.
 */
function updateInBackground(dir: string, files: string[]): void {
  try {
    spawn(process.execPath, [CLI, "parse", dir, "--update", ...files], { detached: true, stdio: "ignore", env: process.env }).unref();
  } catch {
    // the next edit tries again
  }
}

/** A first load of an empty graph, at most every LOAD_EVERY_MS per graph and directory. */
function loadInBackground(dir: string, graph: string): void {
  const lock = tmpName("load", graph, dir);
  try {
    if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs < LOAD_EVERY_MS) return;
    writeFileSync(lock, String(process.pid));
  } catch {
    return;
  }
  updateInBackground(dir, []);
}

/**
 * This session's agent id. SB_AGENT pins it; otherwise `<editor>@<branch>`, unless another live session in the
 * same editor holds that id: then `<editor>@<branch>#<4 characters of the session id>`. Remembered per session in
 * the temp dir, so only a session's first hook call asks the graph.
 * ponytail: a session idle past the stale window (30 min) can lose its id to a new one; both share it until one ends.
 */
export async function sessionAgent(g: SbGraph, base: string, session: string | undefined, graph: string): Promise<string> {
  if (!session) return base;
  const file = tmpName("agent", graph, base, session);
  try {
    const id = readFileSync(file, "utf8").trim();
    if (id) return id;
  } catch {
    // first call of this session
  }
  const id = (await takeAgentId(g, { id: base, session })) ? base : sessionAgentId(base, session);
  try {
    writeFileSync(file, id);
  } catch {
    // asked again next call
  }
  return id;
}

export interface Ctx {
  editor: Editor;
  phase: Phase;
  input: Record<string, unknown>;
  g: SbGraph;
  agent: string;
  /** The agent's checkout (git top level) and the parsed repo's directory inside it ("" = all of it). */
  root: string;
  prefix: string;
  graph: string;
  warn: boolean;
  /** The editor's session id (Claude Code `session_id`, Cursor `conversation_id`), when it sent one. */
  session?: string;
  /** `<editor>@<branch>`, which `agent` extends with `#xxxx` for a second session (see sessionAgent). */
  base?: string;
}

/** The real path of a file that may not exist yet (a Write of a new file): its folder's real path plus its name. */
function realFile(abs: string): string {
  try {
    return realpathSync(abs);
  } catch {
    return join(realpathSync(dirname(abs)), basename(abs));
  }
}

/** A path the agent sent, as the graph stores it; null when it is outside the parsed repo. */
export function repoPath(file: string, cwd: string, root: string, prefix: string): string | null {
  const abs = resolve(cwd, file);
  let rel = relative(root, abs).split("\\").join("/");
  // git reports real paths (/private/var on macOS) and the editor may not (/var, a symlinked folder): compare real ones.
  if (rel.startsWith("../")) {
    try {
      rel = relative(realpathSync(root), realFile(abs)).split("\\").join("/");
    } catch {
      // keep the first answer
    }
  }
  if (!rel || rel.startsWith("../") || rel === ".." || isAbsolute(rel)) return null;
  if (!prefix) return rel;
  return rel.startsWith(`${prefix}/`) ? rel.slice(prefix.length + 1) : null;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** One shell command's snapshot file, the same in its pre and post call. */
function snapshotFile(input: Record<string, unknown>, command: string): string {
  const id = [input.tool_use_id, input.session_id ?? input.conversation_id, input.generation_id, command].map((v) => String(v ?? "")).join("\0");
  return join(tmpdir(), `switchboard-sh-${createHash("sha1").update(id).digest("hex").slice(0, 16)}.json`);
}

/** The repo's own server (SB_EDIT_URL) records the edit and re-parses the file itself. False when there is none or it failed. */
async function postLive(c: Ctx, path: string): Promise<boolean> {
  const live = process.env.SB_EDIT_URL;
  if (!live) return false;
  try {
    const res = await fetch(`${live.replace(/\/+$/, "")}/api/edits`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent: c.agent, path }),
      signal: AbortSignal.timeout(1000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Record the edits and bring each edited file's node and imports up to date (core updateFile; a file the
 * agent deleted loses its node, nothing else does). In the plugin the parser runs in the background; from
 * source it runs here.
 */
async function recordEdits(c: Ctx, paths: string[]): Promise<void> {
  const dir = join(c.root, c.prefix);
  const later: string[] = [];
  let hubs = false;
  for (const path of paths) {
    if (await postLive(c, path)) continue;
    if (bundled()) {
      await recordEdit(c.g, { agentId: c.agent, path });
      if (isSourcePath(path)) later.push(path);
    } else {
      const { graph } = await recordLiveEdit(c.g, dir, { agentId: c.agent, path });
      hubs ||= (graph?.seq ?? null) !== null;
    }
  }
  if (later.length > 0) updateInBackground(dir, later);
  if (hubs) await markHubs(c.g);
}

export async function handle(c: Ctx): Promise<object> {
  const { editor, phase, input, g, agent } = c;
  const cwd = str(input.cwd) ?? c.root;

  if (phase === "start") {
    await registerAgent(g, { id: agent, kind: editor });
    const { files } = await codeGraphCounts(g);
    // The cheap check: hash the checkout's source files against the graph; only changed ones are re-read.
    const dir = join(c.root, c.prefix);
    const stale = await staleFiles(g, dir).catch(() => []);
    if (bundled() && stale === null) loadInBackground(dir, c.graph);
    else if (bundled() && stale && stale.length > 0) updateInBackground(dir, stale);
    const head =
      stale === null
        ? `Switchboard is indexing ${c.root} into graph ${c.graph} in the background. Edits are checked once it finishes.`
        : `Switchboard is on: graph ${c.graph}, ${files} files. You are ${agent}. Every edit is claimed for you; a refusal names the file, the holder and the import path.`;
    const dashboard = process.env.SB_URL ? `\nLive graph: ${process.env.SB_URL.replace(/\/+$/, "")}/app` : "";
    const text = formatBrief(await brief(g, { prefix: "" }));
    log(editor, phase, `${agent} ${c.graph} files=${files}`);
    return answer(editor, phase, { context: `${head}${dashboard}\n\n${text}` });
  }

  if (phase === "end") {
    const res = await release(g, { agent });
    if (c.session) {
      await endSession(g, { id: agent, session: c.session });
      rmSync(tmpName("agent", c.graph, c.base ?? agent, c.session), { force: true });
    }
    log(editor, phase, `${agent} released ${res.released}`);
    return {};
  }

  // Cursor's preToolUse cannot carry context on an allow and afterFileEdit none at all, so Cursor hears
  // notices on postToolUse (notify) only; Claude Code on every PreToolUse and PostToolUse.
  const tells = editor === "claude" ? phase !== "notify" : phase === "notify";
  const notices = tells ? formatNotices(await waitNotices(g, agent), agent) : "";
  if (phase === "notify") return answer(editor, phase, { context: notices });

  const tool = (input.tool_input ?? {}) as Record<string, unknown>;
  const command = input.tool_name === "Bash" ? str(tool.command) : str(input.command);
  const inRepo = (files: string[]) => [...new Set(files.map((f) => repoPath(f, cwd, c.root, c.prefix)).filter((p): p is string => p !== null))];

  if (phase === "post") {
    let paths: string[];
    if (command !== undefined) {
      const snap = snapshotFile(input, command);
      try {
        const before = JSON.parse(readFileSync(snap, "utf8")) as { at: number; files: Record<string, number> };
        unlinkSync(snap);
        const changed = inRepo(changedFiles(before.files, dirtyFiles(cwd)));
        // The checkout is shared: another editor's edits while the command ran are theirs, not this command's.
        const theirs = new Set(await othersOn(g, { agent, paths: changed, since: before.at }));
        paths = changed.filter((p) => !theirs.has(p)).slice(0, MAX_SHELL_EDITS);
      } catch {
        // no snapshot (not a git checkout), git timed out, or the graph failed: nothing to record
        paths = [];
      }
    } else {
      const file = [tool.file_path, tool.notebook_path, tool.path, input.file_path].map(str).find(Boolean);
      paths = file ? inRepo([file]) : [];
    }
    await recordEdits(c, paths);
    if (paths.length > 0) log(editor, phase, `edit ${paths.join(", ")} by ${agent}`);
    return answer(editor, phase, { context: notices });
  }

  // pre
  let files: string[];
  // ponytail: a command that fails (no PostToolUse) leaves its small snapshot in the temp dir.
  const snap = command === undefined ? undefined : snapshotFile(input, command);
  if (command !== undefined && snap) {
    try {
      writeFileSync(snap, JSON.stringify({ at: Date.now(), files: dirtyFiles(cwd) }));
    } catch {
      // not a git checkout: the post call records nothing
    }
    files = writeTargets(command);
  } else {
    const file = [tool.file_path, tool.notebook_path, tool.path, input.file_path].map(str).find(Boolean);
    files = file ? [file] : [];
  }
  const paths = inRepo(files);
  if (paths.length === 0) return answer(editor, phase, { context: notices });

  const res = await claim(g, { agent, paths });
  if (res.ok) {
    // A new source file is parsed once written (PostToolUse); the rest are never parsed.
    const unknown = (res.unknown ?? []).filter((p) => !isSourcePath(p));
    log(editor, phase, unknown.length ? `allow ${paths.join(", ")} for ${agent}: not all in the parsed graph` : `allow ${paths.join(", ")} for ${agent} (claimed)`);
    // A shell command often writes files no parser sees (logs, build output): no note for those. Once per session.
    const note = unknown.length && command === undefined && firstNote(c)
      ? `Switchboard: ${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not in the parsed graph: claimed, but only an edit of the same file conflicts (no import check)`
      : undefined;
    return answer(editor, phase, { context: notices, note });
  }
  const reason = denyReason(res.conflicts, res.safe, Date.now(), res.unknown);
  if (c.warn) {
    log(editor, phase, `warn ${paths.join(", ")} for ${agent}: ${reason.replaceAll("\n", " | ")}`);
    const warning = reason.replace("✗ Switchboard blocked this edit", "⚠ Switchboard warning (SB_MODE=warn, the edit goes ahead)");
    return answer(editor, phase, { context: [warning, notices].filter(Boolean).join("\n\n") });
  }
  await recordWaits(g, { agent, conflicts: res.conflicts });
  if (snap) rmSync(snap, { force: true });
  const held = [...new Set(res.conflicts.map((x) => x.claimed))].join(", ");
  const wait = held && `You are now waiting on ${held}; Switchboard tells you here when it is free.`;
  log(editor, phase, `deny ${paths.join(", ")} for ${agent}: ${reason.replaceAll("\n", " | ")}`);
  return answer(editor, phase, { deny: [reason, wait, notices].filter(Boolean).join("\n") });
}

/** True the first time this session is told that a file is outside the parsed graph (always without a session id). */
function firstNote(c: Ctx): boolean {
  if (!c.session) return true;
  const file = tmpName("note", c.graph, c.session);
  if (existsSync(file)) return false;
  try {
    writeFileSync(file, "");
  } catch {
    // told again next time
  }
  return true;
}

async function readStdin(): Promise<Record<string, unknown>> {
  if (process.stdin.isTTY) return {};
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    const json = JSON.parse(raw) as unknown;
    return json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Run one hook event and print its JSON answer. Never throws and never blocks on an error. */
export async function main(editorArg = "claude", phaseArg = "pre"): Promise<void> {
  const editor: Editor = editorArg === "cursor" ? "cursor" : "claude";
  const phase = (PHASES.includes(phaseArg as Phase) ? phaseArg : "pre") as Phase;
  const fallback = answer(editor, phase, {});
  const done = (out: object) => {
    process.stdout.write(`${JSON.stringify(out)}\n`);
    // The Redis client keeps the loop alive; the answer is out, so leave now.
    process.exit(0);
  };
  const off = process.env.SWITCHBOARD_OFF;
  if (off && off !== "0") return done(fallback);

  const timer = setTimeout(() => {
    log(editor, phase, "timed out, allowed");
    done(fallback);
  }, LIMIT_MS[phase]);
  timer.unref();

  try {
    const input = await readStdin();
    // Cursor also runs Claude Code hooks; its own hook already handled this event.
    if (editor === "claude" && "cursor_version" in input) return done({});
    // `ls`, `git diff`, `grep`: nothing to claim or record, so no git status and no graph connection.
    const tool = (input.tool_input ?? {}) as Record<string, unknown>;
    const command = input.tool_name === "Bash" ? str(tool.command) : str(input.command);
    if ((phase === "pre" || phase === "post") && command !== undefined && readOnly(command)) return done(fallback);
    const cwd = str(input.cwd) ?? process.env.CLAUDE_PROJECT_DIR ?? process.env.CURSOR_PROJECT_DIR ?? process.cwd();
    const chosen = process.env.SB_GRAPH;
    const pinned = process.env.SB_AGENT?.trim();
    const p = configure(cwd, editor);
    // A plugin is on in every session; outside a git repo (say, ~) there is no project to parse or guard.
    if (!p.git && !chosen) return done(fallback);
    const g = await connect();
    // Once per graph (a marker makes later calls one read), and only where a session starts.
    if (phase === "start") await ensureSchema(g);
    const session = str(input.session_id) ?? str(input.conversation_id);
    const base = agentId(cwd, editor);
    const ctx: Ctx = {
      editor,
      phase,
      input,
      g,
      agent: pinned || (await sessionAgent(g, base, session, p.graph)),
      root: p.root,
      prefix: (process.env.SB_PREFIX ?? "").replace(/\/+$/, ""),
      graph: p.graph,
      warn: process.env.SB_MODE === "warn",
      session,
      base,
    };
    done(await handle(ctx));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(editor, phase, `error, allowed: ${msg}`);
    // Only a failed connect means Switchboard is off; a failed brief query still leaves every edit checked.
    if (phase === "start" && !/^(Cannot connect|SB_CLOUD=|SB_ENV_FILE=)/.test(msg)) return done(answer(editor, phase, { context: `Switchboard's session brief failed (${msg}). Edits are still checked.` }));
    if (phase === "start") {
      let url: string;
      try {
        url = redactUrl(dbUrl());
      } catch {
        url = `(${msg})`;
      }
      return done(
        answer(editor, phase, {
          context:
            `Switchboard is installed but off: it cannot reach FalkorDB at ${url}, so edits are not checked. ` +
            "Start it with: docker run -d -p 6379:6379 falkordb/falkordb",
        }),
      );
    }
    done(fallback);
  }
}

function isDirectRun(): boolean {
  try {
    return realpathSync(process.argv[1] ?? "") === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) void main(process.argv[2], process.argv[3]);
