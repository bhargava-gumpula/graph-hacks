// The editor hook, in Node: `switchboard hook <editor> <phase>`, the plugin's dist/hook.mjs, and what
// packages/hooks/hook.sh runs. It talks to FalkorDB directly; the dashboard server reads the same graph.
// Usage: hook <claude|cursor> <start|pre|post|notify|end>   (JSON event on stdin)
//   start   register the agent, re-parse in the background, put a brief in the context.
//   pre     claim the file (Edit/Write) or the obvious write targets of a shell command; on a conflict,
//           deny with the import path and wait on the blocking file. SB_MODE=warn allows it with the text.
//   post    record the edit, or the files a shell command changed (git status before and after).
//   notify  Cursor postToolUse: only the notices (who waits on your files, which files are free now).
//   end     release this agent's claims; files others waited on are free, and its own waits end.
// Fails open: FalkorDB down, a timeout, a parse failure or any error allows the edit. SWITCHBOARD_OFF=1 disables it.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  brief,
  claim,
  codeGraphCounts,
  connect,
  ensureSchema,
  formatBrief,
  recordEdit,
  registerAgent,
  release,
  type Conflict,
  type SbGraph,
} from "@switchboard/core";
import { agentId } from "../../core/src/agent-id.js";
import { formatNotices, recordWaits, waitNotices } from "../../core/src/queries/waits.js";
import { configure } from "../../npm/src/env.js";
import { changedFiles, dirtyFiles, writeTargets } from "./shell.js";

export type Editor = "claude" | "cursor";
export type Phase = "start" | "pre" | "post" | "notify" | "end";
const PHASES: Phase[] = ["start", "pre", "post", "notify", "end"];

const HERE = import.meta.dirname;
/** Hooks must answer fast; past this the edit is allowed. SessionEnd may take longer: nobody waits on it. */
const LIMIT_MS: Record<Phase, number> = { start: 4000, pre: 3000, post: 3000, notify: 3000, end: 8000 };
/** A background re-parse at most this often per graph. */
const PARSE_EVERY_MS = 20_000;
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

/** The refusal: the import path, then who holds it and for how long. */
export function denyReason(conflicts: Conflict[], safe: string[] | undefined, now = Date.now()): string {
  const lines = ["✗ Switchboard blocked this edit"];
  for (const c of conflicts) {
    lines.push(c.path.join(" ─imports→ ") + (c.type === "SAME" ? " (same file)" : ""));
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

/**
 * Re-parse the repo in a detached process so the import graph follows every edit without slowing the
 * editor. Only where the CLI bundle sits next to this one (the plugin, the npm package).
 * ponytail: a lock file's mtime rate-limits it per graph; a queue would catch edits inside the window.
 */
function reparse(root: string, graph: string): void {
  const cli = join(HERE, "switchboard.mjs");
  const lock = join(tmpdir(), `switchboard-parse-${graph}.lock`);
  try {
    if (!existsSync(cli)) return;
    if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs < PARSE_EVERY_MS) return;
    writeFileSync(lock, String(process.pid));
    spawn(process.execPath, [cli, "parse", root], { detached: true, stdio: "ignore", env: process.env }).unref();
  } catch {
    // the next edit tries again
  }
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
}

/** A path the agent sent, as the graph stores it; null when it is outside the parsed repo. */
export function repoPath(file: string, cwd: string, root: string, prefix: string): string | null {
  const abs = resolve(cwd, file);
  let rel = relative(root, abs).split("\\").join("/");
  // git reports real paths (/private/var on macOS); the root may not be one.
  if (rel.startsWith("../")) {
    try {
      rel = relative(realpathSync(root), abs).split("\\").join("/");
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

async function record(c: Ctx, path: string): Promise<void> {
  const live = process.env.SB_EDIT_URL;
  if (live) {
    // The repo's own server re-parses the file first, so the live graph follows the edit.
    try {
      const res = await fetch(`${live.replace(/\/+$/, "")}/api/edits`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: c.agent, path }),
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) return;
    } catch {
      // fall through to the graph
    }
  }
  await recordEdit(c.g, { agentId: c.agent, path });
}

export async function handle(c: Ctx): Promise<object> {
  const { editor, phase, input, g, agent } = c;
  const cwd = str(input.cwd) ?? c.root;

  if (phase === "start") {
    await registerAgent(g, { id: agent, kind: editor });
    const { files } = await codeGraphCounts(g);
    reparse(c.root, c.graph);
    const head =
      files === 0
        ? `Switchboard is indexing ${c.root} into graph ${c.graph} in the background. Edits are checked once it finishes.`
        : `Switchboard is on: graph ${c.graph}, ${files} files. You are ${agent}. Every edit is claimed for you; a refusal names the file, the holder and the import path.`;
    const dashboard = process.env.SB_URL ? `\nLive graph: ${process.env.SB_URL.replace(/\/+$/, "")}/app` : "";
    const text = formatBrief(await brief(g, { prefix: "" }));
    log(editor, phase, `${agent} ${c.graph} files=${files}`);
    return answer(editor, phase, { context: `${head}${dashboard}\n\n${text}` });
  }

  if (phase === "end") {
    const res = await release(g, { agent });
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
      if (!existsSync(snap)) return answer(editor, phase, { context: notices });
      const before = JSON.parse(readFileSync(snap, "utf8")) as Record<string, number>;
      unlinkSync(snap);
      paths = inRepo(changedFiles(before, dirtyFiles(cwd))).slice(0, MAX_SHELL_EDITS);
    } else {
      const file = [tool.file_path, tool.notebook_path, tool.path, input.file_path].map(str).find(Boolean);
      paths = file ? inRepo([file]) : [];
    }
    for (const p of paths) await record(c, p);
    if (paths.length > 0) {
      reparse(c.root, c.graph);
      log(editor, phase, `edit ${paths.join(", ")} by ${agent}`);
    }
    return answer(editor, phase, { context: notices });
  }

  // pre
  let files: string[];
  if (command !== undefined) {
    try {
      writeFileSync(snapshotFile(input, command), JSON.stringify(dirtyFiles(cwd)));
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
    const unknown = res.unknown ?? [];
    log(editor, phase, unknown.length ? `allow ${paths.join(", ")} for ${agent}: not all in the parsed graph` : `allow ${paths.join(", ")} for ${agent} (claimed)`);
    const note = unknown.length
      ? `Switchboard: ${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not in the parsed graph, no dependency check`
      : undefined;
    return answer(editor, phase, { context: notices, note });
  }
  const reason = denyReason(res.conflicts, res.safe);
  if (c.warn) {
    log(editor, phase, `warn ${paths.join(", ")} for ${agent}: ${reason.replaceAll("\n", " | ")}`);
    const warning = reason.replace("✗ Switchboard blocked this edit", "⚠ Switchboard warning (SB_MODE=warn, the edit goes ahead)");
    return answer(editor, phase, { context: [warning, notices].filter(Boolean).join("\n\n") });
  }
  await recordWaits(g, { agent, conflicts: res.conflicts });
  const held = [...new Set(res.conflicts.map((x) => x.claimed))].join(", ");
  const wait = `You are now waiting on ${held}; Switchboard tells you here when it is free.`;
  log(editor, phase, `deny ${paths.join(", ")} for ${agent}: ${reason.replaceAll("\n", " | ")}`);
  return answer(editor, phase, { deny: [reason, wait, notices].filter(Boolean).join("\n") });
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
    const cwd = str(input.cwd) ?? process.env.CLAUDE_PROJECT_DIR ?? process.env.CURSOR_PROJECT_DIR ?? process.cwd();
    const chosen = process.env.SB_GRAPH;
    const p = configure(cwd, editor);
    // A plugin is on in every session; outside a git repo (say, ~) there is no project to parse or guard.
    if (!p.git && !chosen) return done(fallback);
    const g = await connect();
    await ensureSchema(g);
    const ctx: Ctx = {
      editor,
      phase,
      input,
      g,
      agent: agentId(cwd, editor),
      root: p.root,
      prefix: (process.env.SB_PREFIX ?? "").replace(/\/+$/, ""),
      graph: p.graph,
      warn: process.env.SB_MODE === "warn",
    };
    done(await handle(ctx));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(editor, phase, `error, allowed: ${msg}`);
    if (phase === "start") {
      const url = process.env.FALKORDB_URL ?? "redis://localhost:6379";
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
