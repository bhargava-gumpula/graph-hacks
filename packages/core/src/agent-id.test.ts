import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, expect, test } from "vitest";
import { agentId } from "./agent-id.js";

const saved = process.env.SB_AGENT;
beforeEach(() => delete process.env.SB_AGENT);
afterEach(() => {
  if (saved === undefined) delete process.env.SB_AGENT;
  else process.env.SB_AGENT = saved;
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
