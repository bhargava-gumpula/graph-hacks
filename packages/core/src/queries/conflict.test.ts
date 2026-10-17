import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import { claim } from "./claims.js";
import { findConflicts } from "./conflict.js";

const g = useTestGraph("sb_test_conflict");

/**
 * Fixture. `a -> b` means a imports b.
 *   chain:  c0 -> c1 -> c2 -> c3 -> c4      (4 hops end to end)
 *   hub:    x -> hub -> y,   z -> hub
 */
const FIXTURE = `
CREATE (c0:File {path:'c0', hub:false}), (c1:File {path:'c1', hub:false}), (c2:File {path:'c2', hub:false}),
       (c3:File {path:'c3', hub:false}), (c4:File {path:'c4', hub:false}),
       (x:File {path:'x', hub:false}), (hub:File {path:'hub', hub:true}), (y:File {path:'y', hub:false}),
       (z:File {path:'z', hub:false}),
       (c0)-[:IMPORTS]->(c1), (c1)-[:IMPORTS]->(c2), (c2)-[:IMPORTS]->(c3), (c3)-[:IMPORTS]->(c4),
       (x)-[:IMPORTS]->(hub), (hub)-[:IMPORTS]->(y), (z)-[:IMPORTS]->(hub)
`;

const NOW = 1_000_000;
const ME = "me";
const THEM = "them";

beforeAll(async () => {
  await g().query(FIXTURE);
});

beforeEach(async () => {
  await g().query("MATCH ()-[c:CLAIMS]->() DELETE c");
});

const theyClaim = (paths: string[], extra: { ttlMs?: number; taskId?: string; intent?: string } = {}) =>
  claim(g(), { agent: THEM, paths, now: NOW, ...extra });

const conflictsFor = (paths: string[], now = NOW, k = 3) =>
  findConflicts(g(), { agent: ME, paths, now, k });

/** [type, hops, path] per conflict, for compact assertions. */
const summary = async (paths: string[], now = NOW, k = 3) =>
  (await conflictsFor(paths, now, k)).map((c) => [c.file, c.type, c.hops, c.path.join(">")]);

describe("Q1 on a 4-hop chain, k = 3", () => {
  test("UPSTREAM: my file imports their claim at 1, 2, 3 hops; not at 4", async () => {
    await theyClaim(["c4"], { taskId: "T9", intent: "rewrite" });
    expect(await summary(["c3", "c2", "c1", "c0"])).toEqual([
      ["c3", "UPSTREAM", 1, "c3>c4"],
      ["c2", "UPSTREAM", 2, "c2>c3>c4"],
      ["c1", "UPSTREAM", 3, "c1>c2>c3>c4"],
    ]);
    const [first] = await conflictsFor(["c3"]);
    expect(first).toMatchObject({ claimed: "c4", agent: THEM, taskId: "T9", intent: "rewrite" });
  });

  test("DOWNSTREAM: their claim imports my file at 1, 2, 3 hops; not at 4", async () => {
    await theyClaim(["c0"]);
    expect(await summary(["c1", "c2", "c3", "c4"])).toEqual([
      ["c1", "DOWNSTREAM", 1, "c0>c1"],
      ["c2", "DOWNSTREAM", 2, "c0>c1>c2"],
      ["c3", "DOWNSTREAM", 3, "c0>c1>c2>c3"],
    ]);
  });

  test("k = 4 reaches the far end; k is validated", async () => {
    await theyClaim(["c4"]);
    expect(await summary(["c0"], NOW, 4)).toEqual([["c0", "UPSTREAM", 4, "c0>c1>c2>c3>c4"]]);
    await expect(conflictsFor(["c0"], NOW, 5)).rejects.toThrow(/k must be/);
    await expect(conflictsFor(["c0"], NOW, 0)).rejects.toThrow(/k must be/);
  });

  test("SAME file is hop 0 and beats a longer path to the same agent", async () => {
    await theyClaim(["c2", "c3"]);
    expect(await summary(["c2"])).toEqual([["c2", "SAME", 0, "c2"]]);
  });

  test("shortest path per (file, agent) when an agent holds several linked files", async () => {
    await theyClaim(["c3", "c4"]);
    expect(await summary(["c1"])).toEqual([["c1", "UPSTREAM", 2, "c1>c2>c3"]]);
  });
});

describe("Q1 filters", () => {
  test("a hub in the middle of the path does not conflict", async () => {
    await theyClaim(["y"]);
    expect(await conflictsFor(["x", "z"])).toEqual([]);
  });

  test("a claimed hub conflicts with its importers and imports: hubs are skipped only inside a path", async () => {
    await theyClaim(["hub"]);
    expect(await summary(["x", "y", "z", "hub"])).toEqual([
      ["hub", "SAME", 0, "hub"],
      ["x", "UPSTREAM", 1, "x>hub"],
      ["y", "DOWNSTREAM", 1, "hub>y"],
      ["z", "UPSTREAM", 1, "z>hub"],
    ]);
  });

  test("conflicts with a hub at either end carry hub: true; others have no hub field", async () => {
    await theyClaim(["hub", "c4"]);
    const [x] = await conflictsFor(["x"]);
    expect(x).toMatchObject({ type: "UPSTREAM", claimed: "hub", hub: true });
    const [c3] = await conflictsFor(["c3"]);
    expect(c3).not.toHaveProperty("hub");
  });

  test("nodes(p)[1..-1] is the interior: both ends dropped, middle kept", async () => {
    const [row] = await g().roQuery(
      "MATCH p = (:File {path:'c0'})-[:IMPORTS*3]->(:File {path:'c3'}) RETURN [n IN nodes(p)[1..-1] | n.path] AS mid",
    );
    expect(row?.mid).toEqual(["c1", "c2"]);
  });

  test("an expired claim is ignored", async () => {
    await theyClaim(["c4"], { ttlMs: 1000 });
    expect(await conflictsFor(["c3"], NOW + 999)).toHaveLength(1);
    expect(await conflictsFor(["c3"], NOW + 1000)).toEqual([]);
  });

  test("my own claims are ignored", async () => {
    await claim(g(), { agent: ME, paths: ["c4"], now: NOW });
    expect(await conflictsFor(["c4", "c3", "c0"])).toEqual([]);
  });

  test("unknown files and empty requests are safe", async () => {
    await theyClaim(["c4"]);
    expect(await conflictsFor(["nope.ts"])).toEqual([]);
    expect(await conflictsFor([])).toEqual([]);
  });
});

describe("claim() uses the same rules", () => {
  test("grant and deny match findConflicts", async () => {
    await theyClaim(["c4"]);
    expect((await claim(g(), { agent: ME, paths: ["c0"], now: NOW })).ok).toBe(true);
    const denied = await claim(g(), { agent: ME, paths: ["c2"], now: NOW });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.conflicts.map((c) => c.type)).toEqual(["UPSTREAM"]);
    expect((await claim(g(), { agent: ME, paths: ["x"], now: NOW })).ok).toBe(true);
  });

  test("the claim guard uses the same hub rule: blocked by a claimed hub, not through one", async () => {
    await theyClaim(["hub"]);
    expect((await claim(g(), { agent: ME, paths: ["x"], now: NOW })).ok).toBe(false);
    await g().query("MATCH ()-[c:CLAIMS]->() DELETE c");
    await theyClaim(["y"]);
    expect((await claim(g(), { agent: ME, paths: ["x"], now: NOW })).ok).toBe(true);
  });
});
