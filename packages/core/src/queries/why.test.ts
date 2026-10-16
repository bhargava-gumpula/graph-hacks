import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { recordEvent } from "./events.js";
import { loadParse } from "./loader.js";
import { LINK_DECISION, whyTrace } from "./why.js";

const g = useTestGraph("sb_test_why");

beforeAll(async () => {
  const graph = g();
  await loadParse(graph, parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
  await recordEvent(graph, { kind: "edit", agentId: "A", onPath: "lib/crypto.ts", taskId: "T3" });
  await graph.query(LINK_DECISION, {
    taskId: "T3",
    agent: "A",
    decisionId: "D1",
    text: "use argon2, not bcrypt",
    why: "FIPS note",
    at: Date.now(),
    paths: ["lib/crypto.ts"],
  });
});

test("why(crypto.ts) is the edit, the task, and the argon2 decision", async () => {
  const hits = await whyTrace(g(), "lib/crypto.ts");
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatchObject({
    agent: "A",
    task: "T3",
    decision: "use argon2, not bcrypt",
    why: "FIPS note",
    decidedBy: "A",
    path: ["lib/crypto.ts", "A", "T3", "use argon2, not bcrypt"],
  });
});
