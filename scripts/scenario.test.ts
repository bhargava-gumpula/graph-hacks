import { join } from "node:path";
import { expect, test } from "vitest";
import { useTestGraph } from "../packages/core/src/test-helpers.js";
import { runMvpScenario } from "./scenario.js";

const g = useTestGraph("sb_test_scenario");
const demo = join(import.meta.dirname, "../demo-repo");

test("beats 1–2: A claims session.ts, B claims LoginForm.tsx → CONFLICT", async () => {
  const result = await runMvpScenario(g(), demo);
  expect(result.files).toBe(35);
  expect(result.imports).toBe(51);
  expect(result.a.ok).toBe(true);
  expect(result.b.ok).toBe(false);
  expect(result.b.conflicts[0]).toMatchObject({
    type: "UPSTREAM",
    hops: 2,
    agent: "A",
    claimed: "auth/session.ts",
    path: ["ui/LoginForm.tsx", "api/login.ts", "auth/session.ts"],
  });
  expect(result.batches).toHaveLength(3);
  expect(result.why).toContain("use argon2, not bcrypt");
});

test("the scenario is re-runnable on the same graph", async () => {
  await runMvpScenario(g(), demo);
  const again = await runMvpScenario(g(), demo);
  expect(again.b.conflicts[0]?.path).toEqual(["ui/LoginForm.tsx", "api/login.ts", "auth/session.ts"]);
});
