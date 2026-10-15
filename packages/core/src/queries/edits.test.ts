import { expect, test } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import { recordEdit } from "./edits.js";

const graph = useTestGraph("sb_test_edits");

test("recordEdit creates an EDITED edge whose seq is the Event seq", async () => {
  const g = graph();
  const seq = await recordEdit(g, {
    agentId: "ada",
    path: "lib/utils.ts",
    now: 42,
  });

  const rows = await g.roQuery(
    `MATCH (a:Agent {id: 'ada'})-[ed:EDITED]->(f:File {path: 'lib/utils.ts'})
     MATCH (e:Event {kind: 'edit'})-[:BY]->(a)
     MATCH (e)-[:ON]->(f)
     RETURN ed.seq AS seq, ed.at AS at, e.seq AS eventSeq`,
  );

  expect(seq).toBe(1);
  expect(rows).toEqual([{ seq, at: 42, eventSeq: seq }]);
});
