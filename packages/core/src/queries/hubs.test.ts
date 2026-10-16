import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { loadParse } from "./loader.js";
import { markHubs } from "./hubs.js";

const g = useTestGraph("sb_test_hubs");

beforeAll(async () => {
  await loadParse(g(), parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
});

test("PageRank marks lib/utils.ts as the only hub", async () => {
  const scores = await markHubs(g());
  const hubs = scores.filter((s) => s.hub).map((s) => s.path);
  expect(hubs).toEqual(["lib/utils.ts"]);
  expect(scores[0]?.path).toBe("lib/utils.ts");
  expect(scores[0]!.indegree).toBe(20);
});
