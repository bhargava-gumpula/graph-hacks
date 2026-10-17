import { expect, test } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import { recordEvent } from "./events.js";
import { feedSince, latestSeq } from "./feed.js";

const graph = useTestGraph("sb_test_feed");

test("an empty graph has latestSeq 0 and an empty feed", async () => {
  expect(await latestSeq(graph())).toBe(0);
  expect(await feedSince(graph(), 0)).toEqual([]);
});

test("feedSince returns later events in order with agent, path and payload", async () => {
  const g = graph();
  for (let n = 1; n <= 5; n += 1) {
    await recordEvent(g, {
      kind: "edit",
      agentId: "bob",
      onPath: `file-${n}.ts`,
      payload: { n },
      now: 1_000 + n,
    });
  }

  const feed = await feedSince(g, 2);
  expect(feed[0]).toEqual({
    seq: 3,
    kind: "edit",
    at: 1_003,
    payload: { n: 3 },
    agentId: "bob",
    onLabel: "File",
    onKey: "file-3.ts",
  });
  expect(feed.map((item) => item.seq)).toEqual([3, 4, 5]);
  expect(feed.map((item) => item.onKey)).toEqual(["file-3.ts", "file-4.ts", "file-5.ts"]);
  expect(await latestSeq(g)).toBe(5);
  expect(await feedSince(g, 5)).toEqual([]);
});

test("paging with limit walks every event once", async () => {
  const g = graph();
  const seen: number[] = [];
  let last = 0;
  for (;;) {
    const page = await feedSince(g, last, 2);
    if (page.length === 0) break;
    expect(page.length).toBeLessThanOrEqual(2);
    seen.push(...page.map((item) => item.seq));
    last = page[page.length - 1]!.seq;
  }
  expect(seen).toEqual([1, 2, 3, 4, 5]);
});

test("an event with no links and a null payload", async () => {
  const g = graph();
  const seq = await recordEvent(g, { kind: "heartbeat" });
  const [item] = await feedSince(g, seq - 1);
  expect(item).toMatchObject({ seq, payload: null, agentId: null, onLabel: null, onKey: null });
});

test("a payload that is not valid JSON comes back as the raw string", async () => {
  const g = graph();
  const seq = (await latestSeq(g)) + 1;
  // Hand-written Event, as another writer might leave it.
  await g.query(`MATCH (m:Meta {key:'seq'}) SET m.value = $seq CREATE (:Event {seq: $seq, kind: 'parse', at: 0, payload: '{oops'})`, { seq });
  const [item] = await feedSince(g, seq - 1);
  expect(item?.payload).toBe("{oops");
});

test("bad last or limit is rejected", async () => {
  await expect(feedSince(graph(), Number.NaN)).rejects.toThrow(RangeError);
  await expect(feedSince(graph(), 0, 0)).rejects.toThrow(RangeError);
  await expect(feedSince(graph(), 0, 1.5)).rejects.toThrow(RangeError);
  await expect(feedSince(graph(), 0, 5000)).rejects.toThrow(RangeError);
});
