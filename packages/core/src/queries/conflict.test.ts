import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import { claim } from "./claims.js";
import { conflictQuery, findConflicts, hops } from "./conflict.js";

const g = useTestGraph("sb_test_conflict");

/**
 * Fixture. `a -> b` means a imports b.
 *   chain:  c0 -> c1 -> c2 -> c3 -> c4      (4 hops end to end)
 *   hub:    x -> hub -> y,   z -> hub
 *   types:  t0 -type-> t1 -> t2          (t0 only has `import type` from t1)
 */
const FIXTURE = `
CREATE (c0:File {path:'c0', hub:false}), (c1:File {path:'c1', hub:false}), (c2:File {path:'c2', hub:false}),
       (c3:File {path:'c3', hub:false}), (c4:File {path:'c4', hub:false}),
       (x:File {path:'x', hub:false}), (hub:File {path:'hub', hub:true}), (y:File {path:'y', hub:false}),
       (z:File {path:'z', hub:false}),
       (c0)-[:IMPORTS]->(c1), (c1)-[:IMPORTS]->(c2), (c2)-[:IMPORTS]->(c3), (c3)-[:IMPORTS]->(c4),
       (x)-[:IMPORTS]->(hub), (hub)-[:IMPORTS]->(y), (z)-[:IMPORTS]->(hub),
       (t0:File {path:'t0', hub:false})-[:IMPORTS {typeOnly: true}]->(t1:File {path:'t1', hub:false}),
       (t1)-[:IMPORTS {typeOnly: false}]->(t2:File {path:'t2', hub:false})
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

afterEach(() => {
  delete process.env.SB_HOPS;
  delete process.env.SB_TYPE_IMPORTS;
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

  test("k = 4 reaches the far end; k is validated 1..5", async () => {
    await theyClaim(["c4"]);
    expect(await summary(["c0"], NOW, 4)).toEqual([["c0", "UPSTREAM", 4, "c0>c1>c2>c3>c4"]]);
    expect(await summary(["c0"], NOW, 5)).toEqual([["c0", "UPSTREAM", 4, "c0>c1>c2>c3>c4"]]);
    await expect(conflictsFor(["c0"], NOW, 6)).rejects.toThrow(/k must be an integer 1..5/);
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

describe("SB_HOPS", () => {
  test("narrows every check, the claim guard included, and wins over k", async () => {
    await theyClaim(["c4"]);
    process.env.SB_HOPS = "1";
    expect(hops(4)).toBe(1);
    expect(await summary(["c3", "c2"], NOW, 4)).toEqual([["c3", "UPSTREAM", 1, "c3>c4"]]);
    expect((await claim(g(), { agent: ME, paths: ["c2"], now: NOW })).ok).toBe(true);
    expect(conflictQuery(3)).toContain("*1..1]");
  });

  test("defaults to 3; a bad SB_HOPS warns and falls back, a bad k throws", () => {
    expect(hops()).toBe(3);
    process.env.SB_HOPS = "5";
    expect(hops()).toBe(5);
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const bad of ["0", "6", "2.5", "two"]) {
      process.env.SB_HOPS = bad;
      expect(hops()).toBe(3);
      expect(hops(2)).toBe(2);
    }
    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn.mock.calls[0]![0]).toMatch(/SB_HOPS must be an integer 1..5, got 0; using 3/);
    warn.mockRestore();
    delete process.env.SB_HOPS;
    for (const bad of [0, 6, 2.5]) expect(() => hops(bad)).toThrow(/k must be an integer 1..5/);
  });
});

describe("type-only imports", () => {
  test("are skipped in conflict paths by default", async () => {
    await theyClaim(["t1"]);
    expect(await conflictsFor(["t0"])).toEqual([]);
    expect((await claim(g(), { agent: ME, paths: ["t0"], now: NOW })).ok).toBe(true);
  });

  test("a value edge on the same chain still conflicts", async () => {
    await theyClaim(["t2"]);
    expect(await summary(["t1", "t0"])).toEqual([["t1", "UPSTREAM", 1, "t1>t2"]]);
  });

  test("SB_TYPE_IMPORTS=1 counts them again", async () => {
    process.env.SB_TYPE_IMPORTS = "1";
    await theyClaim(["t1"]);
    expect(await summary(["t0"])).toEqual([["t0", "UPSTREAM", 1, "t0>t1"]]);
    expect((await claim(g(), { agent: ME, paths: ["t0"], now: NOW })).ok).toBe(false);
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
