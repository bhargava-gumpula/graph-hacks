import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { applyInit, graphName, lineDiff, planInit } from "./init.js";

const ROOT = "/opt/switchboard";
const HOOK = `${ROOT}/packages/hooks/hook.sh`;

function tempRepo(name: string, git = false): string {
  const repo = join(realpathSync(mkdtempSync(join(tmpdir(), "sb-init-"))), name);
  mkdirSync(repo);
  if (git) spawnSync("git", ["init", "-q", repo]);
  return repo;
}

const json = (repo: string, rel: string) => JSON.parse(readFileSync(join(repo, rel), "utf8"));

test("graphName is sb_ plus the sanitized basename", () => {
  expect(graphName("/x/My-App.v2")).toBe("sb_my_app_v2");
  expect(graphName("/x/---")).toBe("sb_repo");
});

test("a fresh repo gets all three configs, wired like this repo's own", () => {
  const repo = tempRepo("my-app");
  const plan = planInit(repo, ROOT);
  expect(plan.graph).toBe("sb_my_app");
  expect(plan.changes.map((c) => c.path.slice(repo.length + 1))).toEqual([".claude/settings.json", ".cursor/hooks.json", ".mcp.json"]);
  applyInit(plan);

  // Not a git repo: SB_ROOT pins it.
  const env = `env SB_GRAPH=sb_my_app SB_PREFIX= SB_ROOT=${repo} ${HOOK}`;
  const claude = json(repo, ".claude/settings.json");
  expect(claude.hooks.SessionStart).toEqual([{ hooks: [{ type: "command", command: `${env} claude start`, timeout: 15 }] }]);
  expect(claude.hooks.PreToolUse).toEqual([
    { matcher: "Edit|MultiEdit|Write|NotebookEdit", hooks: [{ type: "command", command: `${env} claude pre`, timeout: 5 }] },
  ]);
  expect(claude.hooks.PostToolUse[0].hooks[0].command).toBe(`${env} claude post`);
  expect(claude.hooks.SessionEnd[0].hooks[0]).toEqual({ type: "command", command: `${env} claude end`, timeout: 10 });

  expect(json(repo, ".cursor/hooks.json")).toEqual({
    version: 1,
    hooks: {
      sessionStart: [{ command: `${env} cursor start` }],
      preToolUse: [{ command: `${env} cursor pre`, matcher: "Write" }],
      afterFileEdit: [{ command: `${env} cursor post` }],
      sessionEnd: [{ command: `${env} cursor end` }],
    },
  });
  expect(json(repo, ".mcp.json")).toEqual({
    mcpServers: {
      switchboard: {
        command: `${ROOT}/node_modules/.bin/tsx`,
        args: [`${ROOT}/packages/mcp/src/index.ts`],
        env: { SB_GRAPH: "sb_my_app", SB_PREFIX: "", SB_ROOT: repo },
      },
    },
  });
});

test("a git repo resolves paths from its own top level, so worktrees work", () => {
  const repo = tempRepo("app", true);
  mkdirSync(join(repo, "web"));
  expect(planInit(repo, ROOT).env).toEqual({ SB_GRAPH: "sb_app", SB_PREFIX: "" });
  expect(planInit(join(repo, "web"), ROOT).env).toEqual({ SB_GRAPH: "sb_web", SB_PREFIX: "web" });
});

test("existing settings are merged, the original is kept once in .bak, and a second run changes nothing", () => {
  const repo = tempRepo("shop");
  mkdirSync(join(repo, ".claude"));
  const original = JSON.stringify({
    permissions: { allow: ["Bash(ls:*)"] },
    hooks: {
      PreToolUse: [
        { matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] },
        // An older install's hook: replaced, not duplicated.
        { matcher: "Edit", hooks: [{ type: "command", command: "/old/packages/hooks/hook.sh claude pre" }] },
      ],
      Stop: [{ hooks: [{ type: "command", command: "say done" }] }],
    },
  });
  writeFileSync(join(repo, ".claude/settings.json"), original);
  writeFileSync(join(repo, ".mcp.json"), JSON.stringify({ mcpServers: { other: { command: "other-mcp" } } }));

  applyInit(planInit(repo, ROOT));
  const claude = json(repo, ".claude/settings.json");
  expect(claude.permissions).toEqual({ allow: ["Bash(ls:*)"] });
  expect(claude.hooks.Stop).toEqual([{ hooks: [{ type: "command", command: "say done" }] }]);
  expect(claude.hooks.PreToolUse).toHaveLength(2);
  expect(claude.hooks.PreToolUse[0]).toEqual({ matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] });
  expect(claude.hooks.PreToolUse[1].hooks[0].command).toContain(`${HOOK} claude pre`);
  expect(json(repo, ".mcp.json").mcpServers.other).toEqual({ command: "other-mcp" });
  expect(readFileSync(join(repo, ".claude/settings.json.bak"), "utf8")).toBe(original);

  const again = planInit(repo, ROOT);
  expect(again.changes).toEqual([]);
  applyInit(again);
  expect(readFileSync(join(repo, ".claude/settings.json.bak"), "utf8")).toBe(original);
});

test("a config that is not a JSON object stops init before anything is written", () => {
  const repo = tempRepo("broken");
  writeFileSync(join(repo, ".mcp.json"), "{ nope");
  expect(() => planInit(repo, ROOT)).toThrow(/\.mcp\.json is not a JSON object/);
});

test("lineDiff marks added and removed lines", () => {
  expect(lineDiff("a\nb\nc\n", "a\nx\nc\n")).toBe("  a\n+ x\n- b\n  c");
  expect(lineDiff("", "a\n")).toBe("+ a");
});
