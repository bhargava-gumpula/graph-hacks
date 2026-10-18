// The hook's answers for crafted Claude Code and Cursor events, against a real FalkorDB graph of demo-repo.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { latestSeq, loadParse, parseRepo, release } from "@switchboard/core";
import { useTestGraph } from "../../core/src/test-helpers.js";
import { sessionAgentId } from "../../core/src/agent-id.js";
import { answer, handle, repoPath, sessionAgent, type Ctx, type Editor, type Phase } from "./hook.js";

const g = useTestGraph("sb_test_hook");
const ROOT = join(import.meta.dirname, "../../../demo-repo");
const CLAUDE = "claude@main";
const CURSOR = "cursor@main";

beforeAll(async () => {
  await loadParse(g(), parseRepo(ROOT));
});
beforeEach(async () => {
  await release(g(), { agent: CLAUDE });
  await release(g(), { agent: CURSOR });
});

const run = (editor: Editor, phase: Phase, input: Record<string, unknown>, warn = false) =>
  handle({ editor, phase, input: { cwd: ROOT, ...input }, g: g(), agent: editor === "claude" ? CLAUDE : CURSOR, root: ROOT, prefix: "", graph: "test", warn } satisfies Ctx) as Promise<
    Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  >;
/** One hook call as `agent` in editor session `session`, in the checkout `root`. */
const as = (agent: string, session: string | undefined, phase: Phase, input: Record<string, unknown>, root = ROOT) =>
  handle({ editor: "claude", phase, input: { cwd: root, ...input }, g: g(), agent, root, prefix: "", graph: "test", warn: false, session } satisfies Ctx) as Promise<
    Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  >;
const claimsOf = async (agent: string) =>
  (await g().roQuery("MATCH (:Agent {id: $agent})-[:CLAIMS]->(f:File) RETURN f.path AS path ORDER BY path", { agent })).map((r) => r.path);
const claudeEdit = (file: string) => ({ tool_name: "Edit", tool_input: { file_path: join(ROOT, file) } });
const cursorWrite = (file: string) => ({ tool_name: "Write", tool_input: { file_path: join(ROOT, file) } });

describe("hook: refusal becomes coordination", () => {
  test("Claude claims session.ts; Cursor is refused on LoginForm.tsx and waits; Claude hears; SessionEnd frees it; Cursor retries", async () => {
    expect(await run("claude", "pre", claudeEdit("auth/session.ts"))).toEqual({});

    const refused = await run("cursor", "pre", cursorWrite("ui/LoginForm.tsx"));
    expect(refused.permission).toBe("deny");
    expect(refused.agent_message).toContain("ui/LoginForm.tsx ─imports→ api/login.ts ─imports→ auth/session.ts");
    expect(refused.agent_message).toContain("held by claude@main");
    expect(refused.agent_message).toContain("You are now waiting on auth/session.ts");

    const told = await run("claude", "post", claudeEdit("auth/session.ts"));
    expect(told.hookSpecificOutput).toEqual({
      hookEventName: "PostToolUse",
      additionalContext:
        "cursor@main is waiting on auth/session.ts: it wants ui/LoginForm.tsx, 2 imports from your claim. " +
        "Release it when you're done: switchboard release auth/session.ts --agent claude@main",
    });
    // Told once.
    expect(await run("claude", "pre", claudeEdit("auth/session.ts"))).toEqual({});

    expect(await run("claude", "end", {})).toEqual({});
    expect(await run("cursor", "notify", { tool_name: "Write" })).toEqual({
      additional_context: "auth/session.ts is free now; you can retry ui/LoginForm.tsx.",
    });
    expect(await run("cursor", "pre", cursorWrite("ui/LoginForm.tsx"))).toEqual({ permission: "allow" });
  });

  test("SB_MODE=warn allows the edit and passes the refusal as context; nobody waits", async () => {
    await run("cursor", "pre", cursorWrite("auth/session.ts"));
    const out = await run("claude", "pre", claudeEdit("ui/LoginForm.tsx"), true);
    expect(out.hookSpecificOutput.permissionDecision).toBeUndefined();
    expect(out.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(out.hookSpecificOutput.additionalContext).toContain("⚠ Switchboard warning (SB_MODE=warn, the edit goes ahead)");
    expect(out.hookSpecificOutput.additionalContext).toContain("held by cursor@main");
    const waits = await g().roQuery("MATCH (:Agent)-[w:WAITS_FOR]->(:File) RETURN count(w) AS n");
    expect(waits[0]?.n).toBe(0);
    await release(g(), { agent: CURSOR });
    await run("claude", "pre", claudeEdit("auth/session.ts"));
    const cursorWarn = await run("cursor", "pre", cursorWrite("ui/LoginForm.tsx"), true);
    expect(cursorWarn).toEqual({ permission: "allow", agent_message: expect.stringContaining("SB_MODE=warn") });
  });

  test("Bash: an obvious write is claimed and refused; a read-only command never is", async () => {
    await run("cursor", "pre", cursorWrite("ui/LoginForm.tsx"));
    const bash = (command: string) => ({ tool_name: "Bash", tool_input: { command }, tool_use_id: `t-${command.length}` });
    const denied = await run("claude", "pre", bash("sed -i '' 's/1/2/' auth/session.ts"));
    expect(denied.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(denied.hookSpecificOutput.permissionDecisionReason).toContain("held by cursor@main");
    expect(await run("claude", "pre", bash("cat auth/session.ts && grep -n x ui/LoginForm.tsx"))).toEqual({});
    // Cursor's beforeShellExecution sends `command` at the top level.
    expect((await run("cursor", "pre", { command: "rm auth/session.ts" })).permission).toBe("allow");
  });

  test("a shell command records its own changes, not the other editor's edits made while it ran", async () => {
    // A git checkout of demo-repo: the shell post call diffs `git status` before and after.
    const repo = join(realpathSync(mkdtempSync(join(tmpdir(), "sb-hook-sh-"))), "demo");
    cpSync(ROOT, repo, { recursive: true });
    const git = (...args: string[]) => execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { stdio: "ignore" });
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-qm", "init");
    const at = (editor: Editor, phase: Phase, input: Record<string, unknown>) =>
      handle({ editor, phase, input: { cwd: repo, ...input }, g: g(), agent: editor === "claude" ? CLAUDE : CURSOR, root: repo, prefix: "", graph: "test", warn: false }) as Promise<
        Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
      >;
    try {
      const seq = await latestSeq(g());
      const bash = { tool_name: "Bash", tool_input: { command: "npm test" }, tool_use_id: "t-npm-test", session_id: "s-sh" };
      expect(await at("claude", "pre", bash)).toEqual({});
      // While it runs, Cursor claims and edits Footer.tsx in the same checkout; the command writes a log.
      const footer = { tool_name: "Write", tool_input: { file_path: join(repo, "ui/Footer.tsx") } };
      expect(await at("cursor", "pre", footer)).toEqual({ permission: "allow" });
      writeFileSync(join(repo, "ui/Footer.tsx"), "export const Footer = () => null;\n");
      await at("cursor", "post", footer);
      writeFileSync(join(repo, "test.log"), "ok\n");
      await at("claude", "post", bash);

      const rows = await g().roQuery(
        "MATCH (e:Event)-[:BY]->(a:Agent) WHERE e.seq > $seq OPTIONAL MATCH (e)-[:ON]->(f:File) RETURN e.kind AS kind, a.id AS agent, f.path AS path ORDER BY e.seq",
        { seq },
      );
      expect(rows.filter((r) => r.agent === CLAUDE)).toEqual([{ kind: "edit", agent: CLAUDE, path: "test.log" }]);
      expect(rows.filter((r) => r.kind === "collision")).toEqual([]);
    } finally {
      rmSync(join(repo, ".."), { recursive: true, force: true });
    }
  });
});

describe("hook: graph updates, unparsed files and sessions", () => {
  test("PostToolUse re-reads the edited file alone: its new import is in the graph, every other file stays", async () => {
    const repo = join(realpathSync(mkdtempSync(join(tmpdir(), "sb-hook-up-"))), "demo");
    cpSync(ROOT, repo, { recursive: true });
    const count = async () => (await g().roQuery("MATCH (f:File) RETURN count(f) AS n"))[0]?.n as number;
    try {
      const before = await count();
      const write = { tool_name: "Write", tool_input: { file_path: join(repo, "ui/Fresh.tsx") } };
      expect(await as(CLAUDE, undefined, "pre", write, repo)).toEqual({});
      writeFileSync(join(repo, "ui/Fresh.tsx"), 'import { sessionLabel } from "../auth/session";\nexport const label = sessionLabel;\n');
      await as(CLAUDE, undefined, "post", write, repo);
      const [row] = await g().roQuery(
        "MATCH (f:File {path: 'ui/Fresh.tsx'})-[:IMPORTS]->(t:File) RETURN f.hash IS NOT NULL AS parsed, f.unparsed AS unparsed, collect(t.path) AS imports",
      );
      expect(row).toEqual({ parsed: true, unparsed: null, imports: ["auth/session.ts"] });
      expect(await count()).toBe(before + 1);
      // The new edge counts at once: Cursor's edit of session.ts is refused through it.
      const refused = await run("cursor", "pre", cursorWrite("auth/session.ts"));
      expect(refused.agent_message).toContain("ui/Fresh.tsx ─imports→ auth/session.ts");
    } finally {
      rmSync(join(repo, ".."), { recursive: true, force: true });
      await g().query("MATCH (f:File {path: 'ui/Fresh.tsx'}) DETACH DELETE f");
    }
  });

  test("README.md is outside the parsed graph: claimed, refused for the same file only, and the note comes once per session", async () => {
    const session = randomUUID();
    const readme = { tool_name: "Edit", tool_input: { file_path: join(ROOT, "README.md") } };
    expect(await as(CLAUDE, session, "pre", readme)).toEqual({
      systemMessage: "Switchboard: README.md is not in the parsed graph: claimed, but only an edit of the same file conflicts (no import check)",
    });
    expect(await as(CLAUDE, session, "pre", readme)).toEqual({});
    const refused = await run("cursor", "pre", { tool_name: "Write", tool_input: { file_path: join(ROOT, "README.md") } });
    expect(refused.permission).toBe("deny");
    expect(refused.agent_message).toContain("README.md (same file; not in the parsed graph, so only the same file is checked)\nheld by claude@main");
  });

  test("two Claude Code sessions on one branch are two agents; ending one keeps the other's claims", async () => {
    const [s1, s2, s3] = [randomUUID(), randomUUID(), randomUUID()];
    const a = await sessionAgent(g(), CLAUDE, s1, "test");
    const b = await sessionAgent(g(), CLAUDE, s2, "test");
    expect(a).toBe(CLAUDE);
    expect(b).toBe(sessionAgentId(CLAUDE, s2));
    expect(await sessionAgent(g(), CLAUDE, s2, "test")).toBe(b);
    expect(await sessionAgent(g(), CLAUDE, undefined, "test")).toBe(CLAUDE);

    expect(await as(a, s1, "pre", claudeEdit("auth/session.ts"))).toEqual({});
    const refused = await as(b, s2, "pre", claudeEdit("ui/LoginForm.tsx"));
    expect(refused.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(refused.hookSpecificOutput.permissionDecisionReason).toContain("held by claude@main");
    expect(await as(b, s2, "pre", claudeEdit("ui/Footer.tsx"))).toEqual({});

    // Session A ends: its claims go, B's stay, and the next session may take claude@main again.
    expect(await as(a, s1, "end", {})).toEqual({});
    expect(await claimsOf(a)).toEqual([]);
    expect(await claimsOf(b)).toEqual(["ui/Footer.tsx"]);
    expect(await sessionAgent(g(), CLAUDE, s3, "test")).toBe(CLAUDE);
    await as(b, s2, "end", {});
    await as(CLAUDE, s3, "end", {});
  });
});

describe("hook helpers", () => {
  test("repoPath keeps files inside the parsed repo only", () => {
    expect(repoPath("/r/demo/ui/a.ts", "/x", "/r", "demo")).toBe("ui/a.ts");
    expect(repoPath("ui/a.ts", "/r/demo", "/r", "demo")).toBe("ui/a.ts");
    expect(repoPath("/r/packages/x.ts", "/r", "/r", "demo")).toBeNull();
    expect(repoPath("/elsewhere/x.ts", "/r", "/r", "")).toBeNull();
    expect(repoPath("src/x.ts", "/r", "/r", "")).toBe("src/x.ts");
    // The editor's path through a symlink (macOS /var is /private/var); git gives the real root. A new file too.
    const real = realpathSync(mkdtempSync(join(tmpdir(), "sb-real-")));
    const link = `${real}-link`;
    symlinkSync(real, link);
    try {
      writeFileSync(join(real, "a.ts"), "");
      expect(repoPath(join(link, "a.ts"), link, real, "")).toBe("a.ts");
      expect(repoPath(join(link, "new.ts"), link, real, "")).toBe("new.ts");
    } finally {
      rmSync(link, { force: true });
      rmSync(real, { recursive: true, force: true });
    }
  });

  test("answer uses each editor's documented fields", () => {
    expect(answer("claude", "pre", {})).toEqual({});
    expect(answer("cursor", "pre", {})).toEqual({ permission: "allow" });
    expect(answer("cursor", "post", { context: "x" })).toEqual({});
    expect(answer("cursor", "start", { context: "x" })).toEqual({ additional_context: "x" });
    expect(answer("claude", "start", { context: "x" })).toEqual({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "x" } });
    expect(answer("claude", "pre", { note: "n" })).toEqual({ systemMessage: "n" });
  });
});
