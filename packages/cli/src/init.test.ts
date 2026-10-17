import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { applyInit, graphName, lineDiff, planInit, serverPort, SWITCHBOARD_ROOT } from "./init.js";

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

test("each graph gets its own fixed server port, away from the demo's 8787", () => {
  expect(serverPort("sb_my_app")).toBe(8870);
  expect(serverPort("sb_my_app")).toBe(serverPort("sb_my_app"));
  for (const g of ["sb_a", "sb_web", "sb_demo", "sb_" + "x".repeat(200)]) {
    expect(serverPort(g)).toBeGreaterThanOrEqual(8800);
    expect(serverPort(g)).toBeLessThan(9000);
  }
});

test("a fresh repo gets all three configs, wired like this repo's own", () => {
  const repo = tempRepo("my-app");
  const plan = planInit(repo, ROOT);
  expect(plan.graph).toBe("sb_my_app");
  expect(plan.port).toBe(8870);
  expect(plan.changes.map((c) => c.path.slice(repo.length + 1))).toEqual([".claude/settings.json", ".cursor/hooks.json", ".mcp.json"]);
  applyInit(plan);

  // Not a git repo: SB_ROOT pins it. SB_URL sends the hooks to this repo's own server, never the demo's.
  const env = `env SB_GRAPH=sb_my_app SB_URL=http://localhost:8870 SB_PREFIX= SB_ROOT=${repo} ${HOOK}`;
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
  expect(planInit(repo, ROOT).env).toEqual({ SB_GRAPH: "sb_app", SB_URL: "http://localhost:8969", SB_PREFIX: "" });
  expect(planInit(join(repo, "web"), ROOT).env).toEqual({ SB_GRAPH: "sb_web", SB_URL: "http://localhost:8956", SB_PREFIX: "web" });
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

test("init refuses to wire the Switchboard checkout itself or a folder inside it", () => {
  const root = tempRepo("switchboard");
  mkdirSync(join(root, "demo-repo"));
  expect(() => planInit(root, root)).toThrow(/is part of this Switchboard checkout\. Pass the repo to wire/);
  expect(() => planInit(join(root, "demo-repo"), root)).toThrow(/is part of this Switchboard checkout/);
  // A sibling whose name starts with the checkout's is not inside it.
  const sibling = join(dirname(root), "switchboard-app");
  mkdirSync(sibling);
  expect(planInit(sibling, root).graph).toBe("sb_switchboard_app");
});

// npm run moves cwd to the Switchboard checkout; the CLI resolves the directory from INIT_CWD instead.
function cliInit(initCwd: string, args: string[]) {
  return spawnSync(join(SWITCHBOARD_ROOT, "node_modules/.bin/tsx"), ["packages/cli/src/index.ts", "init", ...args, "--dry-run"], {
    cwd: SWITCHBOARD_ROOT,
    env: { ...process.env, INIT_CWD: initCwd },
    encoding: "utf8",
  });
}

test("the CLI resolves init's directory from where the user ran npm, not the checkout", () => {
  const repo = tempRepo("rel-app");
  mkdirSync(join(repo, "src"));
  const here = cliInit(repo, []);
  expect(here.status).toBe(0);
  expect(here.stdout).toContain(`Would parse ${repo} into graph sb_rel_app, served on port ${serverPort("sb_rel_app")}`);
  const up = cliInit(join(repo, "src"), [".."]);
  expect(up.stdout).toContain(`Would parse ${repo} into graph sb_rel_app`);

  const self = cliInit(SWITCHBOARD_ROOT, []);
  expect(self.status).toBe(1);
  expect(self.stderr).toContain("is part of this Switchboard checkout. Pass the repo to wire, e.g. npm run switchboard -- init ~/code/my-app");
}, 30_000);
