import { connect, ensureSchema, type SbGraph } from "@switchboard/core";
import { FalkorDB } from "falkordb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowedOrigin, visitorGraphs, type Visitors } from "./visitors.js";

describe("allowedOrigin", () => {
  it("allows the site, local dev pages, the request's own host and SB_CORS_ORIGINS", () => {
    expect(allowedOrigin("https://switchboard-agents.xyz", undefined)).toBe(true);
    expect(allowedOrigin("https://www.switchboard-agents.xyz", undefined)).toBe(true);
    expect(allowedOrigin("http://localhost:5173", undefined)).toBe(true);
    expect(allowedOrigin("http://127.0.0.1:8787", undefined)).toBe(true);
    expect(allowedOrigin("http://box.lan:8787", "box.lan:8787")).toBe(true);
    expect(allowedOrigin("https://team.example", undefined, ["https://team.example"])).toBe(true);
  });

  it("refuses everything else", () => {
    expect(allowedOrigin("https://evil.example", "localhost:8787")).toBe(false);
    expect(allowedOrigin("http://localhost.evil.example", undefined)).toBe(false);
    expect(allowedOrigin("https://localhost:5173", undefined)).toBe(false); // dev pages are plain http
    expect(allowedOrigin("http://switchboard-agents.xyz", undefined)).toBe(false);
    expect(allowedOrigin("null", "localhost:8787")).toBe(false);
  });
});

describe("visitorGraphs", () => {
  let tpl: SbGraph;
  const template = () => tpl;
  let db: FalkorDB;
  let v: Visitors;
  const make = (over: Partial<Parameters<typeof visitorGraphs>[0]> = {}) =>
    visitorGraphs({ db, template: template(), location: template().location, idleMs: 1000, max: 10, perIp: 10, ...over });
  const exists = async (name: string) => (await db.list()).includes(name);
  const count = async (graph: SbGraph) => Number((await graph.roQuery("MATCH (n:Probe) RETURN count(n) AS n"))[0]?.n);

  beforeAll(async () => {
    db = await FalkorDB.connect({ url: process.env.FALKORDB_URL ?? "redis://localhost:6379" });
    tpl = await connect({ graph: `sb_test_visit_tpl${process.env.SB_TEST_NS ?? ""}` });
    if ((await db.list()).includes(tpl.name)) await tpl.drop();
    await ensureSchema(tpl);
    await template().query("CREATE (:Probe {v: 1}), (:Probe {v: 2})");
    v = make();
  });

  afterAll(async () => {
    for (const name of await db.list()) if (name.startsWith(v.prefix)) await db.selectGraph(name).delete();
    await tpl.drop();
    await tpl.close();
    await db.close();
  });

  it("gives each visitor their own copy of the template", async () => {
    const [a, b] = await Promise.all([v.graphFor("aaaaaaaaaaaaaaaa"), v.graphFor("bbbbbbbbbbbbbbbb")]);
    expect(a!.name).toBe(`${v.prefix}aaaaaaaaaaaaaaaa`);
    expect(b!.name).not.toBe(a!.name);
    expect(await count(a!)).toBe(2);
    await a!.query("CREATE (:Probe {v: 3})");
    expect(await count(a!)).toBe(3);
    expect(await count(b!)).toBe(2);
    expect(await count(template())).toBe(2);
  });

  it("copies once when a visitor's first requests arrive together", async () => {
    const all = await Promise.all([1, 2, 3].map(() => v.graphFor("cccccccccccccccc")));
    expect(new Set(all.map((x) => x!.name)).size).toBe(1);
  });

  it("sweeps only idle visitor graphs of its own prefix", async () => {
    const other = await connect({ graph: `sb_visit_${v.prefix.endsWith("ffff") ? "eeee" : "ffff"}${"0".repeat(16)}` }); // another server's visitor
    await other.query("CREATE (:Probe)");
    const keep = await v.graphFor("dddddddddddddddd", undefined, Date.now() + 5000);
    const gone = await v.sweep(Date.now() + 2000);
    expect(gone.sort()).toEqual(["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb", "cccccccccccccccc"].map((id) => v.prefix + id));
    for (const name of gone) expect(await exists(name)).toBe(false);
    expect(await exists(keep!.name)).toBe(true);
    expect(await exists(template().name)).toBe(true);
    expect(await exists(other.name)).toBe(true);
    await other.drop();
    await other.close();
  });

  it("adopts a graph left by a restart and sweeps it once idle", async () => {
    const restarted = make();
    const left = await restarted.graphFor("eeeeeeeeeeeeeeee");
    const fresh = make();
    expect(await fresh.sweep()).toEqual([]);
    expect(fresh.size).toBeGreaterThanOrEqual(1);
    expect(await fresh.sweep(Date.now() + 2000)).toContain(left!.name);
    expect(await exists(left!.name)).toBe(false);
  });

  it("shares the template past the cap or the per-IP limit", async () => {
    const capped = make({ max: 1 });
    expect(await capped.graphFor("1111111111111111")).not.toBeNull();
    expect(await capped.graphFor("2222222222222222")).toBeNull();
    const limited = make({ perIp: 1 });
    expect(await limited.graphFor("3333333333333333", "203.0.113.9")).not.toBeNull();
    expect(await limited.graphFor("4444444444444444", "203.0.113.9")).toBeNull();
    expect(await limited.graphFor("5555555555555555")).not.toBeNull(); // local callers are not limited
  });
});
