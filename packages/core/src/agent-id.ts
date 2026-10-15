import { execFileSync } from "node:child_process";

/**
 * Who is calling. Both the MCP server and the CLI use this.
 * `SB_AGENT` wins; otherwise the git branch of `cwd` (the checkout the agent is in).
 */
export function agentId(cwd?: string): string {
  const fromEnv = process.env.SB_AGENT?.trim();
  if (fromEnv) return fromEnv;
  try {
    const branch = execFileSync(
      "git",
      ["-C", cwd ?? process.cwd(), "rev-parse", "--abbrev-ref", "HEAD"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      },
    ).trim();
    if (branch) return branch;
  } catch {
    // Not a git checkout, or git isn't on PATH.
  }
  return "unknown";
}
