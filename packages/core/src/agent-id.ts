import { execFileSync } from "node:child_process";

/** The editor half of an agent id: `claude` or `cursor`. `claude-code` is the older spelling of `claude`. */
export function editorName(editor: string | undefined): string | undefined {
  const e = editor?.trim().toLowerCase();
  if (!e) return undefined;
  return e === "claude-code" ? "claude" : e;
}

/**
 * Who is calling. The hooks, the MCP server and the CLI all use this, so one editor gets one id.
 * `SB_AGENT` wins; otherwise `<editor>@<branch>` of `cwd` (the checkout the agent is in), where the
 * editor is the argument or `SB_EDITOR`. So Claude Code and Cursor on one branch are two agents:
 * `claude@main` and `cursor@main`. With no editor it is the bare branch, as before.
 */
export function agentId(cwd?: string, editor: string | undefined = process.env.SB_EDITOR): string {
  const fromEnv = process.env.SB_AGENT?.trim();
  if (fromEnv) return fromEnv;
  const ed = editorName(editor);
  let branch: string | undefined;
  try {
    const b = git(cwd, "--abbrev-ref", "HEAD");
    // A detached HEAD prints "HEAD"; every detached checkout would then share one id.
    branch = b === "HEAD" ? `detached-${git(cwd, "--short", "HEAD")}` : b || undefined;
  } catch {
    // Not a git checkout, a repo with no commits, or git isn't on PATH.
  }
  if (ed) return branch ? `${ed}@${branch}` : ed;
  return branch ?? "unknown";
}

function git(cwd: string | undefined, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd ?? process.cwd(), "rev-parse", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
}
