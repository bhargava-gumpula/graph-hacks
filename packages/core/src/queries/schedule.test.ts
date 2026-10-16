import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { loadParse } from "./loader.js";
import { parallelBatches, TOUCH_FILE } from "./schedule.js";

const g = useTestGraph("sb_test_schedule");

beforeAll(async () => {
  const graph = g();
  await loadParse(graph, parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
  const tasks = [
    ["t-login", "ui/LoginForm.tsx"],
    ["t-session", "auth/session.ts"],
    ["t-settings", "ui/SettingsPanel.tsx"],
    ["t-prefs", "lib/prefs.ts"],
    ["t-about", "ui/AboutPage.tsx"],
  ] as const;
  for (const [id, path] of tasks) {
    await graph.query(TOUCH_FILE, { id, title: id, path });
  }
});

test("five tasks fall into three batches: login chain, settings island, about", async () => {
  const batches = await parallelBatches(g());
  const groups = batches.map((b) => b.tasks);
  expect(groups).toHaveLength(3);
  expect(groups).toContainEqual(["t-login", "t-session"]);
  expect(groups).toContainEqual(["t-prefs", "t-settings"]);
  expect(groups).toContainEqual(["t-about"]);
});
