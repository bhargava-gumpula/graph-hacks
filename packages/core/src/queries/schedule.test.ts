import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { claim } from "./claims.js";
import { loadParse } from "./loader.js";
import { interfereQuery, parallelBatches, planTask, SET_TASK_STATUS } from "./schedule.js";

const g = useTestGraph("sb_test_schedule");

const INTERFERES = `
MATCH (a:Task)-[r:INTERFERES]->(b:Task)
RETURN a.id AS a, b.id AS b, r.via AS via, r.hops AS hops
ORDER BY a, b
`;

beforeAll(async () => {
  const graph = g();
  await loadParse(graph, parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
  await planTask(graph, { id: "t-login", paths: ["ui/LoginForm.tsx"] });
  await planTask(graph, { id: "t-session", paths: ["auth/session.ts"] });
  await planTask(graph, { id: "t-settings", paths: ["ui/SettingsPanel.tsx"] });
  await planTask(graph, { id: "t-prefs", paths: ["lib/prefs.ts"] });
  await planTask(graph, { id: "t-about", paths: ["ui/AboutPage.tsx"] });
});

test("five tasks fall into three batches: login chain, settings island, about", async () => {
  const batches = await parallelBatches(g());
  expect(batches.map((b) => b.tasks)).toEqual([["t-about"], ["t-login", "t-session"], ["t-prefs", "t-settings"]]);
});

test("each INTERFERES edge names the closest file and its hops", async () => {
  await parallelBatches(g());
  expect(await g().roQuery(INTERFERES)).toEqual([
    { a: "t-login", b: "t-session", via: "ui/LoginForm.tsx", hops: 2 },
    { a: "t-prefs", b: "t-settings", via: "lib/prefs.ts", hops: 1 }, // SettingsPanel imports prefs directly
  ]);
});

test("re-running rebuilds the same edges, no duplicates", async () => {
  await parallelBatches(g());
  await parallelBatches(g());
  expect(await g().roQuery(INTERFERES)).toHaveLength(2);
});

test("k=1 splits the 2-hop login chain but not the 1-hop settings pair", async () => {
  const batches = (await parallelBatches(g(), 1)).map((b) => b.tasks);
  expect(batches).toEqual([["t-about"], ["t-login"], ["t-prefs", "t-settings"], ["t-session"]]);
});

test("two tasks on files that only share the hub can run together", async () => {
  // Both import lib/utils.ts, which must not connect them.
  await planTask(g(), { id: "t-x", paths: ["ui/AboutPage.tsx"] });
  await planTask(g(), { id: "t-y", paths: ["lib/utils.ts"] });
  await planTask(g(), { id: "t-z", paths: ["lib/utils.ts"] });
  const batches = (await parallelBatches(g())).map((b) => b.tasks);
  expect(batches).toContainEqual(["t-y", "t-z"]); // same file, even a hub, is hop 0
  expect(batches).toContainEqual(["t-about", "t-x"]);
  for (const id of ["t-x", "t-y", "t-z"]) await g().query(SET_TASK_STATUS, { id, status: "done" });
});

test("a claimed file counts like a planned one; done tasks drop out", async () => {
  await claim(g(), { agent: "A", paths: ["lib/crypto.ts"], taskId: "T-claim" });
  let batches = (await parallelBatches(g())).map((b) => b.tasks);
  expect(batches).toContainEqual(["T-claim", "t-login", "t-session"]);

  await g().query(SET_TASK_STATUS, { id: "T-claim", status: "done" });
  batches = (await parallelBatches(g())).map((b) => b.tasks);
  expect(batches.flat()).not.toContain("T-claim");
});

test("an expired claim no longer pulls its task into the schedule", async () => {
  await g().query(SET_TASK_STATUS, { id: "T-claim", status: "active" });
  const later = Date.now() + 365 * 86_400_000;
  const batches = (await parallelBatches(g(), 3, later)).map((b) => b.tasks);
  expect(batches.flat()).not.toContain("T-claim");
});

test("k outside 1..4 is rejected", () => {
  expect(() => interfereQuery(0)).toThrow();
  expect(() => interfereQuery(5)).toThrow();
});
