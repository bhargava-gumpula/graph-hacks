import { spawn } from "node:child_process";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { connect } from "@switchboard/core";

const root = join(import.meta.dirname, "../../..");
const tsx = join(root, "node_modules/.bin/tsx");
const GRAPH = "sb_test_cli";
const PATH_3 =
  "CONFLICT UPSTREAM ui/LoginForm.tsx ← A via ui/LoginForm.tsx → api/login.ts → auth/session.ts → lib/crypto.ts";

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
  expect(claimed.stdout).toMatch(/^OK until=/);

  const blocked = await run(["check", "ui/LoginForm.tsx", "--agent", "B"]);
  expect(blocked.code, blocked.stderr).toBe(2);
  expect(blocked.stdout.trim()).toBe(PATH_3);

  const clear = await run(["check", "ui/AboutPage.tsx", "--agent", "B"]);
  expect(clear.code, clear.stderr).toBe(0);
  expect(clear.stdout).toBe("");

  const released = await run(["release", "--agent", "A"]);
  expect(released.code, released.stderr).toBe(0);

  const after = await run(["check", "ui/LoginForm.tsx", "--agent", "B"]);
  expect(after.code, after.stderr).toBe(0);
  expect(after.stdout).toBe("");
}, 60_000);

test("blast, plan, batches, decide, and why", async () => {
  expect((await run(["parse", "demo-repo"])).code).toBe(0);
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
