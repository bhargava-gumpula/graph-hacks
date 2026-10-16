import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { brief, formatBrief, LINK_HANDOFF, LINK_LESSON } from "./brief.js";
import { claim } from "./claims.js";
import { registerAgent } from "./agents.js";
import { recordEvent } from "./events.js";
import { loadParse } from "./loader.js";
import { TOUCH_FILE } from "./schedule.js";
import { LINK_DECISION } from "./why.js";

const g = useTestGraph("sb_test_brief");

beforeAll(async () => {
  const graph = g();
  await loadParse(graph, parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
  await registerAgent(graph, { id: "A", kind: "cursor" });
  await registerAgent(graph, { id: "B", kind: "claude" });
  await graph.query(TOUCH_FILE, { id: "T1", title: "session ttl", path: "auth/session.ts" });
  await claim(graph, { agent: "A", paths: ["auth/session.ts"], taskId: "T1" });
  await graph.query(LINK_DECISION, {
    taskId: "T1",
    agent: "A",
    decisionId: "D1",
    text: "use argon2, not bcrypt",
    why: "FIPS note",
    at: Date.now(),
    paths: ["auth/session.ts"],
  });
  await graph.query(LINK_LESSON, {
    id: "L1",
    text: "run codegen before tsc",
    at: Date.now(),
    paths: ["auth/session.ts"],
  });
  await recordEvent(graph, { kind: "edit", agentId: "A", onPath: "auth/session.ts", taskId: "T1" });
  await graph.query(LINK_HANDOFF, {
    from: "A",
    to: "B",
    taskId: "T1",
    note: "session claim is mine",
    at: Date.now(),
  });
});

test("a replacement agent hears the claim, the decision, the lesson, and the handoff", async () => {
  const result = await brief(g(), { taskId: "T1" });
  expect(result.files).toEqual(["auth/session.ts"]);
  expect(result.claims.map((c) => [c.agent, c.path, c.hops])).toContainEqual(["A", "auth/session.ts", 0]);
  expect(result.decisions.map((d) => d.text)).toContain("use argon2, not bcrypt");
  expect(result.lessons.map((l) => l.text)).toContain("run codegen before tsc");
  expect(result.events.some((e) => e.kind === "edit" && e.agentId === "A")).toBe(true);
  expect(result.tasks.map((t) => t.id)).toContain("T1");
  expect(result.handoff).toEqual({ note: "session claim is mine", from: "A", to: "B" });
  expect(formatBrief(result)).toContain("use argon2, not bcrypt");
});
