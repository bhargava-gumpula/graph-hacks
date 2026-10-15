import { expect, test } from "vitest";
import { useTestGraph } from "./test-helpers.js";

const graph = useTestGraph("sb_test_graph");

test("RETURN 1 comes back as a row keyed by the alias", async () => {
  const rows = await graph().query("RETURN 1 AS one");
  expect(rows).toEqual([{ one: 1 }]);
});

test("roQuery rejects a CREATE", async () => {
  await expect(graph().roQuery("CREATE (:Nope {n: 1})")).rejects.toThrow(/read-only/);
});
