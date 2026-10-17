import { join } from "node:path";
import { expect, test } from "vitest";
import { brief, claim, parallelBatches, release, resetDemo, whyTrace } from "../packages/core/src/index.js";
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

test("a vandal's claim is cleared by the reset and the story still plays", async () => {
  const before = (await parallelBatches(g())).length;
  await release(g(), { agent: "A" });
  expect((await claim(g(), { agent: "C", paths: ["auth/session.ts"] })).ok).toBe(true);
  const [stray] = await g().roQuery(
    "MATCH (f:File) WHERE NOT (f.path STARTS WITH 'ui/' OR f.path STARTS WITH 'api/' OR f.path STARTS WITH 'auth/' OR f.path STARTS WITH 'lib/') RETURN count(f) AS n",
  );
  expect(stray?.n).toBe(0);

  await resetDemo(g());
  const [left] = await g().roQuery(
    "OPTIONAL MATCH (c:Agent {id: 'C'}) WITH count(c) AS agents OPTIONAL MATCH ()-[r:CLAIMS]->() RETURN agents, count(r) AS claims",
  );
  expect(left).toEqual({ agents: 0, claims: 0 });

  const result = await runMvpScenario(g(), demo);
  expect(result.b.conflicts[0]).toMatchObject({ agent: "A", hops: 2 });
  expect((await whyTrace(g(), "auth/session.ts"))[0]?.path).toEqual(["auth/session.ts", "A", "T1", "session ttl 30m"]);
  expect((await brief(g(), { taskId: "T1" })).lessons.map((l) => l.text)).toContain("run codegen before tsc");
  expect(result.batches).toHaveLength(before);
});
