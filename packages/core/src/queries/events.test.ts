import { expect, test } from "vitest";
import { connect } from "../graph.js";
import { useTestGraph } from "../test-helpers.js";
import { recordEvent } from "./events.js";

const NAME = "sb_test_events";
const graph = useTestGraph(NAME);

test("50 concurrent recordEvent calls on 5 connections get seq 1..50, no gaps or duplicates", async () => {
  const clients = await Promise.all(Array.from({ length: 5 }, () => connect({ graph: NAME })));
  try {
    const seqs = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        recordEvent(clients[i % clients.length]!, { kind: "heartbeat", payload: { i } }),
      ),
    );
    const want = Array.from({ length: 50 }, (_, i) => i + 1);
    expect([...seqs].sort((a, b) => a - b)).toEqual(want);

    // The stored Events agree with what the callers were told.
    const rows = await graph().roQuery(
      `MATCH (e:Event) WITH e.seq AS seq ORDER BY seq RETURN collect(seq) AS seqs`,
    );
    expect(rows[0]?.seqs).toEqual(want);
    const meta = await graph().roQuery(`MATCH (m:Meta {key:'seq'}) RETURN m.value AS v`);
    expect(meta).toEqual([{ v: 50 }]);
  } finally {
    await Promise.all(clients.map((c) => c.close()));
  }
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

  expect(linked).toBe(bare + 1);
  expect(rows).toEqual([
    { seq: bare, agentId: null, path: null, taskId: null },
    { seq: linked, agentId: "alice", path: "auth/session.ts", taskId: "T1" },
  ]);
});

test("a File created by an event gets hub = false, and reusing an id links to the same node", async () => {
  const g = graph();
  await recordEvent(g, { kind: "edit", agentId: "alice", onPath: "new/file.ts" });
  const rows = await g.roQuery(
    `MATCH (f:File {path: 'new/file.ts'}) RETURN f.hub AS hub
     UNION ALL
     MATCH (a:Agent {id: 'alice'}) RETURN count(a) AS hub`,
  );
  expect(rows).toEqual([{ hub: false }, { hub: 1 }]);
});

test("payload and at are stored as given", async () => {
  const g = graph();
  const seq = await recordEvent(g, { kind: "decision", payload: { text: "use argon2" }, now: 7 });
  const rows = await g.roQuery(`MATCH (e:Event {seq: $seq}) RETURN e.kind AS kind, e.at AS at, e.payload AS payload`, { seq });
  expect(rows).toEqual([{ kind: "decision", at: 7, payload: '{"text":"use argon2"}' }]);
});
