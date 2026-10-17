// The installed package's own logic: which graph and agent id a directory maps to, and the refusal text.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Conflict } from "@switchboard/core";
import { project } from "./env.js";
import { denyReason } from "./hook.js";

const base = mkdtempSync(join(tmpdir(), "sb-npm-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-C", cwd, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { stdio: "ignore" });

describe("project", () => {
  it("gives every worktree of a repo one graph and a per-editor, per-branch agent id", () => {
    const main = join(base, "My App");
    execFileSync("mkdir", ["-p", main]);
    git(main, "init", "-q", "-b", "main");
    writeFileSync(join(main, "a.ts"), "export const a = 1;\n");
    git(main, "add", "-A");
    git(main, "commit", "-qm", "init");
    const wt = join(base, "feature-wt");
    git(main, "worktree", "add", "-q", "-b", "feature", wt);

    const a = project(main, "claude-code");
    const b = project(wt, "cursor");
    expect(a.graph).toBe("sb_my_app");
    expect(b.graph).toBe("sb_my_app");
    expect(a.agent).toBe("claude-code@main");
    expect(b.agent).toBe("cursor@feature");
    expect(a.git && b.git).toBe(true);
  });

  it("marks a plain directory as not a git repo", () => {
    const dir = join(base, "plain");
    execFileSync("mkdir", ["-p", dir]);
    expect(project(dir, "cursor")).toMatchObject({ git: false, agent: "cursor", graph: "sb_plain" });
  });
});

describe("denyReason", () => {
  it("prints the import path, the holder and the way out, like hook.sh", () => {
    const now = 1_000_000;
    const conflict: Conflict = {
      file: "src/login.ts",
      type: "UPSTREAM",
      claimed: "src/db.ts",
      path: ["src/login.ts", "src/session.ts", "src/db.ts"],
      hops: 2,
      agent: "cursor@main",
      taskId: null,
      intent: "rename db url",
      until: now + 28 * 60_000,
    };
    expect(denyReason([conflict], ["src/util.ts"], now)).toBe(
      [
        "✗ Switchboard blocked this edit",
        "src/login.ts ─imports→ src/session.ts ─imports→ src/db.ts",
        'held by cursor@main "rename db url" · free in 28 min',
        "Safe now: src/util.ts",
        "Don't work around this with Bash. Pick another file or call brief_me.",
      ].join("\n"),
    );
  });
});
