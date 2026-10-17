import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, expect, test } from "vitest";
import { agentId, editorName } from "./agent-id.js";

const saved = { agent: process.env.SB_AGENT, editor: process.env.SB_EDITOR };
beforeEach(() => {
  delete process.env.SB_AGENT;
  delete process.env.SB_EDITOR;
});
afterEach(() => {
  for (const [key, value] of [["SB_AGENT", saved.agent], ["SB_EDITOR", saved.editor]] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "sb-agent-"));
  dirs.push(d);
  return d;
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-C", cwd, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { stdio: "pipe" });

test("SB_AGENT wins, trimmed", () => {
  process.env.SB_AGENT = "  agent-7 \n";
  expect(agentId(tempDir())).toBe("agent-7");
});

test("a blank SB_AGENT falls through to git", () => {
  process.env.SB_AGENT = "   ";
  expect(agentId(tempDir())).toBe("unknown");
});

test("the branch of the checkout", () => {
  const repo = tempDir();
  git(repo, "init", "-q", "-b", "feat/login");
  git(repo, "commit", "-q", "--allow-empty", "-m", "x");
  expect(agentId(repo)).toBe("feat/login");

  git(repo, "checkout", "-q", "--detach");
  expect(agentId(repo)).toMatch(/^detached-[0-9a-f]{7,}$/);
});

test("not a git checkout gives unknown", () => {
  expect(agentId(tempDir())).toBe("unknown");
});

test("one id per editor: <editor>@<branch>, so Claude Code and Cursor on one branch are two agents", () => {
  const repo = tempDir();
  git(repo, "init", "-q", "-b", "main");
  git(repo, "commit", "-q", "--allow-empty", "-m", "x");
  expect(agentId(repo, "claude")).toBe("claude@main");
  expect(agentId(repo, "claude-code")).toBe("claude@main");
  expect(agentId(repo, "cursor")).toBe("cursor@main");
  process.env.SB_EDITOR = "cursor";
  expect(agentId(repo)).toBe("cursor@main");
  process.env.SB_AGENT = "pinned";
  expect(agentId(repo, "claude")).toBe("pinned");
  expect(agentId(tempDir(), "cursor")).toBe("pinned");
  delete process.env.SB_AGENT;
  expect(agentId(tempDir(), "cursor")).toBe("cursor");
  expect(editorName(" Claude-Code ")).toBe("claude");
  expect(editorName("")).toBeUndefined();
});
