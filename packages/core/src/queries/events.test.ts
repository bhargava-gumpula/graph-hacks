import { expect, test } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import { recordEvent } from "./events.js";

const graph = useTestGraph("sb_test_events");

test("20 concurrent recordEvent calls return seq 1..20 with no gaps", async () => {
  const seqs = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      recordEvent(graph(), { kind: "heartbeat", payload: { i } }),
    ),
  );
  expect([...seqs].sort((a, b) => a - b)).toEqual(
    Array.from({ length: 20 }, (_, i) => i + 1),
  );
});

test("BY, ON and UNDER are created only when the ids are given", async () => {
  const g = graph();
  const bare = await recordEvent(g, { kind: "heartbeat" });
  const linked = await recordEvent(g, {
    kind: "claim",
    agentId: "alice",
    onPath: "auth/session.ts",
    taskId: "T1",
  });

  const rows = await g.roQuery(
    `MATCH (e:Event)
     WHERE e.seq IN [$bare, $linked]
     OPTIONAL MATCH (e)-[:BY]->(a)
     OPTIONAL MATCH (e)-[:ON]->(f)
     OPTIONAL MATCH (e)-[:UNDER]->(t)
     RETURN e.seq AS seq, a.id AS agentId, f.path AS path, t.id AS taskId
     ORDER BY e.seq`,
    { bare, linked },
  );

  expect(rows).toEqual([
    { seq: bare, agentId: null, path: null, taskId: null },
    { seq: linked, agentId: "alice", path: "auth/session.ts", taskId: "T1" },
  ]);
});
