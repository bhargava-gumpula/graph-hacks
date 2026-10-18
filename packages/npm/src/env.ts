// Defaults for the installed package and the Claude Code plugin, where there is no Switchboard checkout.
// The repo's own scripts set SB_GRAPH, SB_PREFIX and SB_ROOT themselves; this only fills what is unset.
import { execFileSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { agentId, editorName } from "../../core/src/agent-id.js";
import { graphName } from "../../cli/src/init.js";

function git(dir: string, ...args: string[]): string | undefined {
  try {
    const out = execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

export interface Project {
  /** False outside a git repo: the hooks then stay out of the way and nothing is parsed. */
  git: boolean;
  root: string;
  graph: string;
  agent: string | undefined;
}

/**
 * The project an agent works in, from its directory. Every worktree of one repo shares one graph:
 * the name comes from the main checkout (the git common dir), not the worktree folder.
 * The agent id is `<editor>@<branch>` from core's agentId (so `claude-code` reads as `claude`, as in the
 * hook and packages/mcp), and Claude Code and Cursor on the same branch are two agents.
 */
export function project(dir: string, editor?: string): Project {
  // One git start for all three answers: every hook call runs this, and each git start costs ~20 ms.
  // A repo with no commits has no HEAD, so that call fails and the answers come one by one.
  const [top0, common0, head] = git(dir, "rev-parse", "--show-toplevel", "--path-format=absolute", "--git-common-dir", "--abbrev-ref", "HEAD")?.split("\n") ?? [];
  const top = top0 ?? git(dir, "rev-parse", "--show-toplevel");
  const root = top ?? resolve(dir);
  const common = common0 ?? git(dir, "rev-parse", "--path-format=absolute", "--git-common-dir");
  const main = common ? (basename(common) === ".git" ? dirname(common) : common.replace(/\.git$/, "")) : root;
  const ed = editorName(editor);
  const agent = ed ? agentId(dir, ed, head) : undefined;
  return { git: top !== undefined, root, graph: graphName(main), agent };
}

/** Fill SB_ROOT, SB_PREFIX, SB_GRAPH and SB_AGENT for core, which reads them on each call. */
export function configure(dir: string, editor = process.env.SB_EDITOR): Project {
  const p = project(dir, editor);
  const env = process.env;
  env.SB_ROOT ??= p.root;
  env.SB_PREFIX ??= "";
  env.SB_GRAPH ??= p.graph;
  if (!env.SB_AGENT && p.agent) env.SB_AGENT = p.agent;
  return { git: p.git, root: env.SB_ROOT, graph: env.SB_GRAPH, agent: env.SB_AGENT };
}
