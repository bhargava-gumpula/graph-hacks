import { expect, test } from "vitest";
import { connect } from "./graph.js";
import { useTestGraph } from "./test-helpers.js";

const graph = useTestGraph("sb_test_graph");

test("RETURN 1 comes back as a row keyed by the alias", async () => {
  expect(await graph().query("RETURN 1 AS one")).toEqual([{ one: 1 }]);
});

test("parameters are passed, not concatenated", async () => {
  const rows = await graph().query("RETURN $s AS s, $n AS n, $list AS list", { s: "a'b\"c", n: 2, list: ["x", "y"] });
  expect(rows).toEqual([{ s: "a'b\"c", n: 2, list: ["x", "y"] }]);
});

test("a write with no RETURN gives an empty array", async () => {
  expect(await graph().query("CREATE (:Probe {n: 1})")).toEqual([]);
  expect(await graph().roQuery("MATCH (p:Probe) RETURN p.n AS n")).toEqual([{ n: 1 }]);
});

test("roQuery rejects a CREATE", async () => {
  await expect(graph().roQuery("CREATE (:Nope {n: 1})")).rejects.toThrow(/read-only/);
});

test("the timeout option is enforced by the server", async () => {
  await expect(
    graph().roQuery("UNWIND range(1, 50000000) AS x RETURN count(x) AS n", undefined, { timeout: 1 }),
  ).rejects.toThrow(/timed out/);
});

test("a failing query keeps the server message and names the statement", async () => {
  const err = await graph().query("RETURN nope").catch((e: unknown) => e);
  expect(err).toBeInstanceOf(Error);
  expect((err as Error).message).toMatch(/^'nope' not defined \[query: RETURN nope\]$/);
  expect((err as Error).cause).toBeDefined();
});

test("connect to a closed port says where and what to do", async () => {
  await expect(connect({ url: "redis://localhost:1" })).rejects.toThrow(
    /Cannot connect to FalkorDB at redis:\/\/localhost:1\. Is it running\?.*ECONNREFUSED/,
  );
});
