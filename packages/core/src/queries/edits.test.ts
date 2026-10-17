import { beforeAll, expect, test } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import { claim } from "./claims.js";
import { recordEdit, recordEditAndCheck } from "./edits.js";
import { feedSince } from "./feed.js";

const graph = useTestGraph("sb_test_edits");
const NOW = 1_000_000;

beforeAll(async () => {
  // a.ts -> b.ts -> c.ts, plus a lone file.
  await graph().query(
    `CREATE (:File {path:'a.ts', hub:false})-[:IMPORTS]->(:File {path:'b.ts', hub:false})-[:IMPORTS]->(:File {path:'c.ts', hub:false}),
            (:File {path:'lone.ts', hub:false})`,
  );
});

test("recordEdit creates an EDITED edge whose seq is the Event seq", async () => {
  const g = graph();
  const seq = await recordEdit(g, { agentId: "ada", path: "lib/utils.ts", taskId: "T9", now: 42 });

  const rows = await g.roQuery(
    `MATCH (a:Agent {id: 'ada'})-[ed:EDITED]->(f:File {path: 'lib/utils.ts'})
     MATCH (e:Event {kind: 'edit'})-[:BY]->(a)
     MATCH (e)-[:ON]->(f)
     MATCH (e)-[:UNDER]->(:Task {id: 'T9'})
     RETURN ed.seq AS seq, ed.at AS at, e.seq AS eventSeq, f.hub AS hub`,
  );

  expect(seq).toBe(1);
  expect(rows).toEqual([{ seq, at: 42, eventSeq: seq, hub: false }]);
});

test("each edit keeps its own EDITED edge", async () => {
  const g = graph();
  await recordEdit(g, { agentId: "ada", path: "lone.ts", now: NOW });
  await recordEdit(g, { agentId: "ada", path: "lone.ts", now: NOW + 1 });
  const rows = await g.roQuery(`MATCH (:Agent {id:'ada'})-[ed:EDITED]->(:File {path:'lone.ts'}) RETURN count(ed) AS n`);
  expect(rows).toEqual([{ n: 2 }]);
});

test("no collision when nobody else claims the file", async () => {
  const result = await recordEditAndCheck(graph(), { agentId: "ada", path: "lone.ts", now: NOW });
  expect(result.collision).toBeNull();
});

test("editing a file another agent claimed records a collision event", async () => {
  const g = graph();
  await claim(g, { agent: "B", paths: ["b.ts"], taskId: "TB", now: NOW });

  const same = await recordEditAndCheck(g, { agentId: "A", path: "b.ts", now: NOW + 10 });
  expect(same.collision?.seq).toBe(same.seq + 1);
  expect(same.collision?.conflicts).toEqual([
    expect.objectContaining({ file: "b.ts", type: "SAME", agent: "B", taskId: "TB", hops: 0 }),
  ]);

  const [edit, collision] = await feedSince(g, same.seq - 1);
  expect(edit).toMatchObject({ kind: "edit", agentId: "A", onKey: "b.ts" });
  expect(collision).toMatchObject({
    kind: "collision",
    agentId: "A",
    onKey: "b.ts",
    payload: { requested: ["b.ts"], conflicts: [expect.objectContaining({ agent: "B" })] },
  });
});

test("editing a file that imports another agent's claim is an UPSTREAM collision", async () => {
  const result = await recordEditAndCheck(graph(), { agentId: "A", path: "a.ts", now: NOW + 10 });
  expect(result.collision?.conflicts).toEqual([
    expect.objectContaining({ type: "UPSTREAM", claimed: "b.ts", path: ["a.ts", "b.ts"], hops: 1 }),
  ]);
});

test("no collision when the editor holds its own claim, or the other claim expired", async () => {
  const g = graph();
  await claim(g, { agent: "C", paths: ["lone.ts"], now: NOW });
  expect((await recordEditAndCheck(g, { agentId: "C", path: "lone.ts", now: NOW + 10 })).collision).toBeNull();

  const until = (await g.roQuery(`MATCH (:Agent {id:'B'})-[c:CLAIMS]->() RETURN c.until AS u`))[0]!.u as number;
  expect((await recordEditAndCheck(g, { agentId: "A", path: "b.ts", now: until + 1 })).collision).toBeNull();
});
