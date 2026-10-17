import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import type { SbGraph } from "../graph.js";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { claim } from "./claims.js";
import { loadParse } from "./loader.js";
import { colourRounds, interfereQuery, parallelBatches, planTask, SET_TASK_STATUS, TASK_FOOTPRINTS } from "./schedule.js";

const g = useTestGraph("sb_test_schedule");
const chain = useTestGraph("sb_test_rounds");

/** The interfering pairs, as the rounds path computes them. */
async function pairs(graph: SbGraph, k = 3, now = Date.now()) {
  const tasks = await graph.roQuery(TASK_FOOTPRINTS, { now });
  return graph.roQuery(interfereQuery(k), { tasks });
}

const rounds = async (graph: SbGraph, k?: number, now?: number) =>
  (await parallelBatches(graph, k, now)).map((b) => b.tasks);

beforeAll(async () => {
  const graph = g();
  await loadParse(graph, parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
  await planTask(graph, { id: "t-login", paths: ["ui/LoginForm.tsx"] });
  await planTask(graph, { id: "t-session", paths: ["auth/session.ts"] });
  await planTask(graph, { id: "t-settings", paths: ["ui/SettingsPanel.tsx"] });
  await planTask(graph, { id: "t-prefs", paths: ["lib/prefs.ts"] });
  await planTask(graph, { id: "t-about", paths: ["ui/AboutPage.tsx"] });

  // Chain A-B-C: a.ts and c.ts both import b.ts, and nothing links a.ts and c.ts.
  await chain().query(`
    CREATE (a:File {path:'a.ts', hub:false})-[:IMPORTS]->(b:File {path:'b.ts', hub:false}),
           (c:File {path:'c.ts', hub:false})-[:IMPORTS]->(b)`);
  for (const id of ["A", "B", "C"]) await planTask(chain(), { id, paths: [`${id.toLowerCase()}.ts`] });
});

afterEach(() => {
  delete process.env.SB_TYPE_IMPORTS;
});

describe("rounds by graph colouring", () => {
  test("chain A-B-C: two rounds, A and C together (one WCC batch would run all three in turn)", async () => {
    expect(await pairs(chain())).toEqual([
      { a: "A", b: "B", via: "a.ts", hops: 1 },
      { a: "B", b: "C", via: "b.ts", hops: 1 },
    ]);
    expect(await parallelBatches(chain())).toEqual([
      { componentId: 0, tasks: ["B"], paths: ["b.ts"] },
      { componentId: 1, tasks: ["A", "C"], paths: ["a.ts", "c.ts"] },
    ]);
  });

  test("colourRounds: highest degree first, lowest free round, isolated tasks in round 0", () => {
    expect(colourRounds(["A", "B", "C"], [{ a: "A", b: "B" }, { a: "B", b: "C" }])).toEqual([["B"], ["A", "C"]]);
    expect(colourRounds(["A", "B", "C"], [{ a: "A", b: "B" }, { a: "B", b: "C" }, { a: "A", b: "C" }])).toEqual([["A"], ["B"], ["C"]]);
    expect(colourRounds(["x", "y"], [])).toEqual([["x", "y"]]);
    expect(colourRounds([], [])).toEqual([]);
  });

  test("reading the rounds writes nothing: no INTERFERES edges, no write query", async () => {
    const count = async () => (await g().roQuery("MATCH ()-[r:INTERFERES]->() RETURN count(r) AS n"))[0]?.n;
    const before = await count();
    const readOnly = new Proxy(g(), {
      get(target, prop, receiver) {
        if (prop === "query") return () => Promise.reject(new Error("parallelBatches wrote to the graph"));
        return Reflect.get(target, prop, receiver);
      },
    });
    expect((await parallelBatches(readOnly)).length).toBeGreaterThan(0);
    expect(await count()).toBe(before);
    expect(before).toBe(0);
  });
});

describe("demo repo", () => {
  test("five tasks, two rounds: each pair split, the leaf free to go first", async () => {
    // t-login/t-session interfere (2 hops), t-prefs/t-settings (2 hops); t-about only shares the hub.
    expect(await parallelBatches(g())).toEqual([
      { componentId: 0, tasks: ["t-about", "t-login", "t-prefs"], paths: ["lib/prefs.ts", "ui/AboutPage.tsx", "ui/LoginForm.tsx"] },
      { componentId: 1, tasks: ["t-session", "t-settings"], paths: ["auth/session.ts", "ui/SettingsPanel.tsx"] },
    ]);
  });

  test("each interfering pair names the closest file and its hops; type-only imports are skipped", async () => {
    expect(await pairs(g())).toEqual([
      { a: "t-login", b: "t-session", via: "ui/LoginForm.tsx", hops: 2 },
      // SettingsPanel's direct `import type` from prefs is ignored; the value path goes through api/settings.ts.
      { a: "t-prefs", b: "t-settings", via: "lib/prefs.ts", hops: 2 },
    ]);
  });

  test("SB_TYPE_IMPORTS=1 counts the type-only edge again", async () => {
    process.env.SB_TYPE_IMPORTS = "1";
    expect(await pairs(g(), 1)).toEqual([{ a: "t-prefs", b: "t-settings", via: "lib/prefs.ts", hops: 1 }]);
  });

  test("k=1 links nothing: both pairs are 2 hops apart", async () => {
    expect(await rounds(g(), 1)).toEqual([["t-about", "t-login", "t-prefs", "t-session", "t-settings"]]);
  });

  test("a task on the hub interferes with the hub's importers; a hub inside a path links nothing", async () => {
    await planTask(g(), { id: "t-hub", paths: ["lib/utils.ts"] });
    // Make lib/errors.ts a hub for this test: api/audit.ts reaches utils.ts only through it.
    await planTask(g(), { id: "t-audit", paths: ["api/audit.ts"] });
    await g().query("MATCH (f:File {path: 'lib/errors.ts'}) SET f.hub = true");
    try {
      const linked = (await pairs(g())).map((p) => `${p.a}-${p.b}`);
      expect(linked).toContain("t-about-t-hub"); // AboutPage imports the hub directly
      expect(linked.filter((p) => p.includes("t-audit"))).toEqual([]);
      expect((await rounds(g()))[0]).toContain("t-audit");
    } finally {
      await g().query("MATCH (f:File {path: 'lib/errors.ts'}) SET f.hub = false");
      for (const id of ["t-hub", "t-audit"]) await g().query(SET_TASK_STATUS, { id, status: "done" });
    }
  });

  test("a claimed file counts like a planned one; done tasks drop out", async () => {
    await claim(g(), { agent: "A", paths: ["lib/crypto.ts"], taskId: "T-claim" });
    const linked = (await pairs(g())).map((p) => `${p.a}-${p.b}`);
    expect(linked).toEqual(expect.arrayContaining(["T-claim-t-login", "T-claim-t-session"]));
    const together = (await rounds(g())).find((r) => r.includes("T-claim"))!;
    expect(together).not.toContain("t-session");
    expect(together).not.toContain("t-login");

    await g().query(SET_TASK_STATUS, { id: "T-claim", status: "done" });
    expect((await rounds(g())).flat()).not.toContain("T-claim");
  });

  test("an expired claim no longer pulls its task into the schedule", async () => {
    await g().query(SET_TASK_STATUS, { id: "T-claim", status: "active" });
    const later = Date.now() + 365 * 86_400_000;
    expect((await rounds(g(), 3, later)).flat()).not.toContain("T-claim");
  });

  test("k outside 1..5 is rejected", () => {
    expect(() => interfereQuery(0)).toThrow(/k must be/);
    expect(() => interfereQuery(6)).toThrow(/k must be/);
    expect(interfereQuery(5)).toContain("*1..5");
  });
});
