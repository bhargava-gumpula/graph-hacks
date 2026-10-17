import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseRepo, type ParseResult } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { loadParse } from "./loader.js";
import { HUB_INDEGREE, markHubs } from "./hubs.js";

const DEMO = join(import.meta.dirname, "../../../../demo-repo");

/** A ParseResult from `[from, to]` import pairs. */
function repo(edges: [string, string][]): ParseResult {
  const paths = [...new Set(edges.flat())];
  return {
    files: paths.map((path) => ({ path, lang: "ts" as const, loc: 1, hash: path })),
    imports: edges.map(([from, to]) => ({ from, to, specifiers: [], typeOnly: false })),
  };
}

describe("demo repo", () => {
  const g = useTestGraph("sb_test_hubs_demo");

  test("PageRank marks lib/utils.ts as the only hub and ranks it first", async () => {
    await loadParse(g(), parseRepo(DEMO));
    const scores = await markHubs(g());
    expect(scores).toHaveLength(35);
    expect(scores.filter((s) => s.hub).map((s) => s.path)).toEqual(["lib/utils.ts"]);
    expect(scores[0]).toMatchObject({ path: "lib/utils.ts", indegree: 20, hub: true });
    expect(scores[0]!.rank).toBeGreaterThan(scores[1]!.rank * 4);
  });

  test("re-running gives the same flags", async () => {
    const first = await markHubs(g());
    const second = await markHubs(g());
    expect(second.map((s) => [s.path, s.hub])).toEqual(first.map((s) => [s.path, s.hub]));
  });
});

describe("small graphs", () => {
  const g = useTestGraph("sb_test_hubs_small");

  test("an empty graph has no scores", async () => {
    expect(await markHubs(g())).toEqual([]);
  });

  test("files that import nothing are scored, not an error", async () => {
    await g().query("UNWIND ['x.ts', 'y.ts'] AS p CREATE (:File {path: p})");
    const scores = await markHubs(g());
    expect(scores.map((s) => [s.path, s.hub]).sort()).toEqual([["x.ts", false], ["y.ts", false]]);
    await g().query("MATCH (f:File) DETACH DELETE f");
  });

  test("a file with two importers in a tiny repo is not a hub", async () => {
    await loadParse(g(), repo([["a.ts", "b.ts"], ["c.ts", "b.ts"]]));
    const scores = await markHubs(g());
    expect(scores.some((s) => s.hub)).toBe(false);
    expect(scores[0]?.path).toBe("b.ts");
  });

  test(`a file imported by ${HUB_INDEGREE} others is a hub`, async () => {
    const edges = Array.from({ length: HUB_INDEGREE }, (_, i): [string, string] => [`f${i}.ts`, "core.ts"]);
    await loadParse(g(), repo(edges));
    const hubs = (await markHubs(g())).filter((s) => s.hub);
    expect(hubs.map((h) => [h.path, h.indegree])).toEqual([["core.ts", HUB_INDEGREE]]);
  });
});
