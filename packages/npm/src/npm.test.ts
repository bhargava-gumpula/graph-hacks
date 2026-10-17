// The installed package's own logic: which graph and agent id a directory maps to, and the refusal text.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    expect(a.agent).toBe("claude@main");
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

describe("init", () => {
  it("puts the Claude Code hooks in the git-ignored settings.local.json, never the committed settings.json", () => {
    const repo = join(base, "wired");
    mkdirSync(join(repo, ".claude"), { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    const mine = { type: "command", command: "echo mine" };
    const old = { type: "command", command: "/old/node /old/dist/hook.mjs claude pre" };
    const settings = `${JSON.stringify({ model: "x", hooks: { PreToolUse: [{ hooks: [mine] }, { matcher: "Edit", hooks: [old] }] } }, null, 2)}\n`;
    writeFileSync(join(repo, ".claude/settings.json"), settings);

    const tsx = join(import.meta.dirname, "../../../node_modules/.bin/tsx");
    const out = execFileSync(tsx, [join(import.meta.dirname, "cli.ts"), "init", repo, "--claude", "--dry-run"], {
      encoding: "utf8",
    });
    const file = (rel: string) => {
      const m = out.match(new RegExp(`^--- ${rel.replace(/\./g, "\\.")}\\n([\\s\\S]*?)(?=^--- |^Would parse)`, "m"));
      return m?.[1];
    };
    const local = JSON.parse(file(".claude/settings.local.json")!) as { hooks: Record<string, unknown> };
    expect(Object.keys(local.hooks)).toEqual(["SessionStart", "PreToolUse", "PostToolUse", "SessionEnd"]);
    expect(JSON.stringify(local)).toContain("hook.mjs claude pre");
    // Ours is gone from settings.json; the user's own hook and settings stay.
    expect(JSON.parse(file(".claude/settings.json")!)).toEqual({ model: "x", hooks: { PreToolUse: [{ hooks: [mine] }] } });
    expect(file(".gitignore")?.trim()).toBe(".claude/settings.local.json");
    expect(readFileSync(join(repo, ".claude/settings.json"), "utf8")).toBe(settings); // --dry-run wrote nothing
  });
});
