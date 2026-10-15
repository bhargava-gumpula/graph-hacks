import { expect, test } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import { recordEvent } from "./events.js";
import { feedSince, latestSeq } from "./feed.js";

const graph = useTestGraph("sb_test_feed");

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
  expect(feed.map((item) => item.seq)).toEqual([3, 4, 5]);
  expect(feed.map((item) => item.agentId)).toEqual(["bob", "bob", "bob"]);
  expect(feed.map((item) => item.onKey)).toEqual(["file-3.ts", "file-4.ts", "file-5.ts"]);
  expect(feed.map((item) => item.onLabel)).toEqual(["File", "File", "File"]);
  expect(feed.map((item) => item.payload)).toEqual([{ n: 3 }, { n: 4 }, { n: 5 }]);
  expect(await latestSeq(g)).toBe(5);
});
