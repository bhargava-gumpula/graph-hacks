// The editor hook for the plugin and the npm package: packages/hooks/hook.sh in Node, so it needs no jq
// and no Switchboard checkout. It talks to FalkorDB directly; the dashboard server reads the same graph.
// Usage: node hook.mjs <claude|cursor> <start|pre|post|end>   (JSON event on stdin)
// Fails open: FalkorDB down, a timeout or any error allows the edit. SWITCHBOARD_OFF=1 disables it.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
import { normPath } from "../../core/src/paths.js";
import { configure } from "./env.js";

type Editor = "claude" | "cursor";
type Event = "start" | "pre" | "post" | "end";

const HERE = import.meta.dirname;
/** Hooks must answer fast; past this the edit is allowed. SessionEnd may take longer: nobody waits on it. */
const LIMIT_MS = { start: 4000, pre: 3000, post: 3000, end: 8000 } as const;
/** A background re-parse at most this often per graph. */
const PARSE_EVERY_MS = 20_000;

const log = (editor: Editor, event: Event, msg: string) => {
  const file = process.env.SB_HOOK_LOG ?? join(tmpdir(), "switchboard-hook.log");
  try {
    appendFileSync(file, `${new Date().toISOString()} ${editor} ${event} ${msg}\n`);
  } catch {
    // logging never blocks an edit
  }
};

function allowOutput(editor: Editor, event: Event): object {
  return editor === "cursor" && event === "pre" ? { permission: "allow" } : {};
}

function startOutput(editor: Editor, text: string): object {
  return editor === "cursor"
    ? { additional_context: text }
    : { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } };
}

/** The same lines hook.sh prints: the import path, then who holds it and for how long. */
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

/**
 * Re-parse the repo in a detached process so the import graph follows every edit without slowing the
 * editor. ponytail: a lock file's mtime rate-limits it per graph; a queue would catch edits inside the window.
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

async function handle(editor: Editor, event: Event, input: Record<string, unknown>, g: SbGraph): Promise<object> {
  const agent = process.env.SB_AGENT ?? (editor === "claude" ? "claude-code" : "cursor");
  const root = process.env.SB_ROOT!;
  const graph = process.env.SB_GRAPH!;

  if (event === "start") {
    await registerAgent(g, { id: agent, kind: editor });
    const { files } = await codeGraphCounts(g);
    reparse(root, graph);
    const head =
      files === 0
        ? `Switchboard is indexing ${root} into graph ${graph} in the background. Edits are checked once it finishes.`
        : `Switchboard is on: graph ${graph}, ${files} files. You are ${agent}. Every edit is claimed for you; a refusal names the file, the holder and the import path.`;
    const dashboard = process.env.SB_URL ? `\nLive graph: ${process.env.SB_URL.replace(/\/+$/, "")}/app` : "";
    const text = formatBrief(await brief(g, { prefix: "" }));
    log(editor, event, `${agent} ${graph} files=${files}`);
    return startOutput(editor, `${head}${dashboard}\n\n${text}`);
  }

  if (event === "end") {
    const res = await release(g, { agent });
    log(editor, event, `${agent} released ${res.released}`);
    return {};
  }

  const tool = (input.tool_input ?? {}) as Record<string, unknown>;
  const file = [tool.file_path, tool.notebook_path, tool.path, input.file_path].find((v) => typeof v === "string" && v);
  if (typeof file !== "string") return allowOutput(editor, event);
  const rel = normPath(file);
  // A file outside this project (another repo, ~/.claude) is not ours to check.
  if (rel.startsWith("/") || rel.startsWith("../")) return allowOutput(editor, event);

  if (event === "post") {
    await recordEdit(g, { agentId: agent, path: rel });
    reparse(root, graph);
    log(editor, event, `edit ${rel} by ${agent}`);
    return {};
  }

  const res = await claim(g, { agent, paths: [rel] });
  if (res.ok) {
    if (res.unknown?.length) {
      log(editor, event, `allow ${rel} for ${agent}: not in the parsed graph`);
      if (editor === "claude") return { systemMessage: `Switchboard: ${rel} is not in the parsed graph yet, no dependency check` };
    } else log(editor, event, `allow ${rel} for ${agent} (claimed)`);
    return allowOutput(editor, event);
  }
  const reason = denyReason(res.conflicts, res.safe);
  log(editor, event, `deny ${rel} for ${agent}: ${reason.replaceAll("\n", " | ")}`);
  return editor === "cursor"
    ? { permission: "deny", user_message: reason, agent_message: reason }
    : { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } };
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
export async function main(editorArg = "claude", eventArg = "pre"): Promise<void> {
  const editor: Editor = editorArg === "cursor" ? "cursor" : "claude";
  const event = (["start", "pre", "post", "end"].includes(eventArg) ? eventArg : "pre") as Event;
  const fallback = allowOutput(editor, event);
  const done = (out: object) => {
    process.stdout.write(`${JSON.stringify(out)}\n`);
    // The Redis client keeps the loop alive; the answer is out, so leave now.
    process.exit(0);
  };
  const off = process.env.SWITCHBOARD_OFF;
  if (off && off !== "0") return done(fallback);

  const timer = setTimeout(() => {
    log(editor, event, "timed out, allowed");
    done(fallback);
  }, LIMIT_MS[event]);
  timer.unref();

  let g: SbGraph | undefined;
  try {
    const input = await readStdin();
    // Cursor also runs Claude Code hooks; its own hook already handled this event.
    if (editor === "claude" && "cursor_version" in input) return done({});
    const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : (process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
    const chosen = process.env.SB_GRAPH;
    const p = configure(cwd, editor === "claude" ? "claude-code" : "cursor");
    // A plugin is on in every session; outside a git repo (say, ~) there is no project to parse or guard.
    if (!p.git && !chosen) return done(fallback);
    g = await connect();
    await ensureSchema(g);
    done(await handle(editor, event, input, g));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(editor, event, `error, allowed: ${msg}`);
    if (event === "start") {
      const url = process.env.FALKORDB_URL ?? "redis://localhost:6379";
      return done(
        startOutput(
          editor,
          `Switchboard is installed but off: it cannot reach FalkorDB at ${url}, so edits are not checked. ` +
            "Start it with: docker run -d -p 6379:6379 falkordb/falkordb",
        ),
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
