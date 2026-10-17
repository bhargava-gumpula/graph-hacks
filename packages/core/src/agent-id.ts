import { execFileSync } from "node:child_process";

/**
 * Who is calling. Both the MCP server and the CLI use this.
 * `SB_AGENT` wins; otherwise the git branch of `cwd` (the checkout the agent is in).
 */
export function agentId(cwd?: string): string {
  const fromEnv = process.env.SB_AGENT?.trim();
  if (fromEnv) return fromEnv;
  try {
    const branch = git(cwd, "--abbrev-ref", "HEAD");
    // A detached HEAD prints "HEAD"; every detached checkout would then share one id.
    if (branch === "HEAD") return `detached-${git(cwd, "--short", "HEAD")}`;
    if (branch) return branch;
  } catch {
    // Not a git checkout, a repo with no commits, or git isn't on PATH.
  }
  return "unknown";
}

function git(cwd: string | undefined, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd ?? process.cwd(), "rev-parse", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
}
