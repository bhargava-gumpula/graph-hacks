import { spawn } from "node:child_process";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { connect } from "@switchboard/core";

const root = join(import.meta.dirname, "../../..");
const tsx = join(root, "node_modules/.bin/tsx");
const GRAPH = `sb_test_cli_${process.pid}`;
const PATH_3 =
  "CONFLICT UPSTREAM ui/LoginForm.tsx ← A via ui/LoginForm.tsx → api/login.ts → auth/session.ts → lib/crypto.ts";
const OK_CHECK = /^OK no claim within 3 import hops \(\d+(\.\d+)? ms\)\n$/;
/** The hook's deny reason when it took the CLI fallback. */
// t-about (planned in an earlier test) is the open task that is free.
const DENY_3 = `✗ Switchboard blocked this edit\n${PATH_3}\nSafe now: ui/AboutPage.tsx\nDon't work around this with Bash. Pick another file or call brief_me.`;

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(tsx, ["packages/cli/src/index.ts", ...args], {
      cwd: root,
      env: { ...process.env, SB_GRAPH: GRAPH },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

afterAll(async () => {
  const g = await connect({ graph: GRAPH });
  try {
    await g.drop();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("empty key")) throw err;
  }
  await g.close();
});

test("check exits 2 with the 3-hop path, and 0 once the claim is released", async () => {
  const parsed = await run(["parse", "demo-repo"]);
  expect(parsed.code, parsed.stderr).toBe(0);
  expect(parsed.stdout).toContain("files=35");

  const claimed = await run(["claim", "lib/crypto.ts", "--agent", "A"]);
  expect(claimed.code, claimed.stderr).toBe(0);
  expect(claimed.stdout).toMatch(/^OK until=\S+ \(1 file checked within 3 import hops\)\n$/);

  const blocked = await run(["check", "ui/LoginForm.tsx", "--agent", "B"]);
  expect(blocked.code, blocked.stderr).toBe(2);
  expect(blocked.stdout.trim()).toBe(PATH_3);

  const prefixed = await run(["check", "demo-repo/ui/LoginForm.tsx", "--agent", "B"]);
  expect(prefixed.code, prefixed.stderr).toBe(2);
  expect(prefixed.stdout.trim()).toBe(PATH_3);

  const clear = await run(["check", "ui/AboutPage.tsx", "--agent", "B"]);
  expect(clear.code, clear.stderr).toBe(0);
  expect(clear.stdout).toMatch(OK_CHECK);

  const unknown = await run(["check", "ui/Nope.tsx", "--agent", "B"]);
  expect(unknown.code, unknown.stderr).toBe(0);
  expect(unknown.stdout).toBe("WARNING not in the parsed graph, no dependency check: ui/Nope.tsx\n");
  const unclaimed = await run(["claim", "ui/Nope.tsx", "ui/AboutPage.tsx", "--agent", "B"]);
  expect(unclaimed.code, unclaimed.stderr).toBe(0);
  expect(unclaimed.stdout).toMatch(
    /^WARNING not in the parsed graph, no dependency check: ui\/Nope.tsx\nOK until=\S+ \(1 file checked within 3 import hops\)\n$/,
  );

  const briefed = await run(["brief", "--prefix", ""]);
  expect(briefed.code, briefed.stderr).toBe(0);
  expect(briefed.stdout).toMatch(/^Files: \S+/);
  expect(briefed.stdout).toContain("Claim: A holds lib/crypto.ts");

  const released = await run(["release", "--agent", "A"]);
  expect(released.code, released.stderr).toBe(0);

  const after = await run(["check", "ui/LoginForm.tsx", "--agent", "B"]);
  expect(after.code, after.stderr).toBe(0);
  expect(after.stdout).toMatch(OK_CHECK);
  await run(["release", "--agent", "B"]);
}, 60_000);

test("blast, plan, batches, decide, and why", async () => {
  const parsed = await run(["parse", "demo-repo"]);
  expect(parsed.code, parsed.stderr).toBe(0);
  const blast = await run(["blast", "auth/session.ts"]);
  expect(blast.code, blast.stderr).toBe(0);
  expect(blast.stdout).toContain("1 api/login.ts");
  expect(blast.stdout).toContain("2 ui/LoginForm.tsx");

  expect((await run(["plan", "t-about", "ui/AboutPage.tsx"])).code).toBe(0);
  expect((await run(["plan", "t-login", "ui/LoginForm.tsx"])).code).toBe(0);
  const batches = await run(["batches"]);
  expect(batches.code, batches.stderr).toBe(0);
  expect(batches.stdout).toContain("t-about");
  expect(batches.stdout).toContain("t-login");
  expect(batches.stdout).not.toMatch(/t-about t-login|t-login t-about/);

  const decided = await run([
    "decide",
    "use argon2, not bcrypt",
    "--why",
    "FIPS note",
    "--affects",
    "lib/crypto.ts",
    "--task",
    "T3",
    "--agent",
    "A",
  ]);
  expect(decided.code, decided.stderr).toBe(0);
  expect((await run(["edited", "lib/crypto.ts", "--task", "T3", "--agent", "A"])).code).toBe(0);
  const why = await run(["why", "lib/crypto.ts"]);
  expect(why.stdout).toContain("use argon2, not bcrypt");
}, 60_000);

test("help, bad usage, register and status", async () => {
  const help = await run(["--help"]);
  expect(help.code).toBe(0);
  expect(help.stdout).toContain("check <file>");
  expect(help.stdout).toContain("Exit codes");

  const unknown = await run(["frobnicate"]);
  expect(unknown.code).toBe(1);
  expect(unknown.stderr).toContain("unknown command frobnicate");

  expect((await run(["check", "--agent"])).code).toBe(1);
  expect((await run(["register", "--kind", "robot", "--agent", "R"])).code).toBe(1);

  const registered = await run(["register", "--kind", "claude", "--agent", "R"]);
  expect(registered.code, registered.stderr).toBe(0);
  expect(registered.stdout.trim()).toBe("registered R kind=claude");
  expect((await run(["heartbeat", "--agent", "R"])).code).toBe(0);

  const parsed = await run(["parse", "demo-repo"]);
  expect(parsed.code, parsed.stderr).toBe(0);
  expect((await run(["claim", "auth/session.ts", "--agent", "R", "--task", "T9"])).code).toBe(0);
  const s = await run(["status"]);
  expect(s.code, s.stderr).toBe(0);
  expect(s.stdout).toContain("R claude active claims=auth/session.ts");
  expect(s.stdout).toMatch(/R auth\/session\.ts until=\S+ task=T9/);

  const conflict = await run(["claim", "ui/LoginForm.tsx", "--agent", "S"]);
  expect(conflict.code).toBe(2);
  expect(conflict.stdout).toContain("ui/LoginForm.tsx → api/login.ts → auth/session.ts");
  expect((await run(["release", "--agent", "R"])).code).toBe(0);
}, 60_000);

function hook(
  args: string[],
  event: object,
  env: Record<string, string> = {},
): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [join(root, "packages/hooks/hook.sh"), ...args], {
      cwd: root,
      // Port 9 is closed, so the hook takes the CLI fallback against the test graph.
      env: { ...process.env, SB_GRAPH: GRAPH, SB_URL: "http://127.0.0.1:9", SB_HOOK_LOG: "/dev/null", ...env },
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout }));
    child.stdin.end(JSON.stringify(event));
  });
}

test("hook: denies a conflicting edit with the path, fails open, and can be switched off", async () => {
  const parsed = await run(["parse", "demo-repo"]);
  expect(parsed.code, parsed.stderr).toBe(0);
  expect((await run(["claim", "lib/crypto.ts", "--agent", "A"])).code).toBe(0);
  const edit = { tool_name: "Edit", tool_input: { file_path: join(root, "demo-repo/ui/LoginForm.tsx") }, cwd: root };

  const denied = await hook(["claude", "pre"], edit, { SB_AGENT: "B" });
  expect(denied.code).toBe(0);
  expect(JSON.parse(denied.stdout)).toEqual({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: DENY_3,
    },
  });

  const cursor = await hook(["cursor", "pre"], edit, { SB_AGENT: "B" });
  expect(JSON.parse(cursor.stdout)).toMatchObject({ permission: "deny", agent_message: DENY_3 });

  // An allowed edit is claimed; `end` releases the session's claims.
  const about = { tool_name: "Edit", tool_input: { file_path: join(root, "demo-repo/ui/AboutPage.tsx") }, cwd: root };
  expect(JSON.parse((await hook(["claude", "pre"], about, { SB_AGENT: "B" })).stdout)).toEqual({});
  expect((await run(["status"])).stdout).toMatch(/B ui\/AboutPage\.tsx until=/);
  expect(JSON.parse((await hook(["claude", "end"], { cwd: root }, { SB_AGENT: "B" })).stdout)).toEqual({});
  expect((await run(["status"])).stdout).toContain("B - active claims=-");

  // A notebook is read from notebook_path; a file the parser never saw is allowed with a warning.
  const notebook = { tool_name: "NotebookEdit", tool_input: { notebook_path: join(root, "demo-repo/ui/New.ipynb") }, cwd: root };
  expect(JSON.parse((await hook(["claude", "pre"], notebook, { SB_AGENT: "B" })).stdout)).toEqual({
    systemMessage: "Switchboard: ui/New.ipynb is not in the parsed graph, no dependency check",
  });

  const start = await hook(["claude", "start"], { cwd: root }, { SB_AGENT: "B" });
  expect(JSON.parse(start.stdout).hookSpecificOutput.additionalContext).toContain("Claim: A holds lib/crypto.ts");

  expect(JSON.parse((await hook(["claude", "pre"], edit, { SB_AGENT: "A" })).stdout)).toEqual({});
  expect(JSON.parse((await hook(["claude", "pre"], edit, { SB_AGENT: "B", SWITCHBOARD_OFF: "1" })).stdout)).toEqual({});
  const down = await hook(["cursor", "pre"], edit, { SB_AGENT: "B", FALKORDB_URL: "redis://127.0.0.1:9" });
  expect(JSON.parse(down.stdout)).toEqual({ permission: "allow" });
  const outside = { tool_input: { file_path: join(root, "packages/core/src/index.ts") } };
  expect(JSON.parse((await hook(["claude", "pre"], outside, { SB_AGENT: "B" })).stdout)).toEqual({});

  await run(["release", "--agent", "A"]);
}, 60_000);
