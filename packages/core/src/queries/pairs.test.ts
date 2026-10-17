import { beforeAll, expect, test } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import { pairCensus } from "./pairs.js";

const g = useTestGraph("sb_test_pairs");

/**
 * Fixture. `a -> b` means a imports b.
 *   chain:   c0 -> c1 -> c2 -> c3 -> c4        (4 hops end to end; c0..c4 is out of range)
 *   hub:     x -> hub -> y,  z -> hub          (no path may run through the hub)
 *   shortcut: d0 -> d1 -> d3 and d0 -> d3      (d0..d3 is 1 hop and 2 hops: counts once, as 1)
 *   cycle:   e0 <-> e1                          (one pair, not two)
 *   w imports nothing and nothing imports it.
 */
beforeAll(async () => {
  await g().query(`
CREATE (c0:File {path:'c0'}), (c1:File {path:'c1'}), (c2:File {path:'c2'}), (c3:File {path:'c3'}), (c4:File {path:'c4'}),
       (x:File {path:'x'}), (hub:File {path:'hub', hub:true}), (y:File {path:'y'}), (z:File {path:'z'}),
       (d0:File {path:'d0'}), (d1:File {path:'d1'}), (d3:File {path:'d3'}),
       (e0:File {path:'e0'}), (e1:File {path:'e1'}), (w:File {path:'w'}),
       (c0)-[:IMPORTS]->(c1), (c1)-[:IMPORTS]->(c2), (c2)-[:IMPORTS]->(c3), (c3)-[:IMPORTS]->(c4),
       (x)-[:IMPORTS]->(hub), (hub)-[:IMPORTS]->(y), (z)-[:IMPORTS]->(hub),
       (d0)-[:IMPORTS]->(d1), (d1)-[:IMPORTS]->(d3), (d0)-[:IMPORTS]->(d3),
       (e0)-[:IMPORTS]->(e1), (e1)-[:IMPORTS]->(e0)
`);
});

test("counts each pair once at its fewest hops, and sees nothing through a hub", async () => {
  const census = await pairCensus(g());
  expect(census).toEqual({
    files: 15,
    pairs: 105, // 15 * 14 / 2
    lock: 0,
    oneHop: 11, // chain 4 + hub ends 3 + shortcut 3 + cycle 1
    graph: 16, // + chain 2-hop 3 + chain 3-hop 2; x..y, z..y (through the hub) and c0..c4 (4 hops) are out
    hidden: 5,
    byHop: [
      { hops: 1, pairs: 11 },
      { hops: 2, pairs: 3 },
      { hops: 3, pairs: 2 },
    ],
  });
});

test("an empty graph has no pairs", async () => {
  await g().query("MATCH (n) DETACH DELETE n");
  expect(await pairCensus(g())).toEqual({ files: 0, pairs: 0, lock: 0, oneHop: 0, graph: 0, hidden: 0, byHop: [] });
});
