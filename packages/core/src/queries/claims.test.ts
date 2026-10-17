import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { connect } from "../graph.js";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { heartbeat } from "./agents.js";
import { claim, release } from "./claims.js";
import { findConflicts } from "./conflict.js";
import { feedSince, latestSeq } from "./feed.js";
import { loadParse } from "./loader.js";

const g = useTestGraph("sb_test_claims");
const HUB = "lib/utils.ts";

beforeAll(async () => {
  await loadParse(g(), parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
  // Q6 (PageRank) will set hubs later; mark the planted hub by hand for now.
  await g().query("MATCH (f:File {path: $p}) SET f.hub = true", { p: HUB });
});

beforeEach(async () => {
  await release(g(), { agent: "A" });
  await release(g(), { agent: "B" });
});

describe("Q1 conflicts on the demo repo", () => {
  test("the hero: A claims crypto.ts, B wants LoginForm.tsx → 3-hop UPSTREAM conflict", async () => {
    expect((await claim(g(), { agent: "A", paths: ["lib/crypto.ts"], taskId: "T1" })).ok).toBe(true);

    const res = await claim(g(), { agent: "B", paths: ["ui/LoginForm.tsx"], taskId: "T2" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.conflicts).toEqual([
      {
        file: "ui/LoginForm.tsx",
        type: "UPSTREAM",
        claimed: "lib/crypto.ts",
        path: ["ui/LoginForm.tsx", "api/login.ts", "auth/session.ts", "lib/crypto.ts"],
        hops: 3,
        agent: "A",
        taskId: "T1",
        intent: null,
      },
    ]);
  });

  test("A claims session.ts: LoginForm is 2 hops UPSTREAM, crypto.ts is DOWNSTREAM", async () => {
    await claim(g(), { agent: "A", paths: ["auth/session.ts"] });

    const up = await findConflicts(g(), { agent: "B", paths: ["ui/LoginForm.tsx"] });
    expect(up.map((c) => [c.type, c.hops, c.path.join(" → ")])).toEqual([
      ["UPSTREAM", 2, "ui/LoginForm.tsx → api/login.ts → auth/session.ts"],
    ]);

    const down = await findConflicts(g(), { agent: "B", paths: ["lib/crypto.ts"] });
    expect(down.map((c) => [c.type, c.hops, c.path.join(" → ")])).toEqual([
      ["DOWNSTREAM", 1, "auth/session.ts → lib/crypto.ts"],
    ]);
  });

  test("same file → SAME at hop 0, even for the hub", async () => {
    await claim(g(), { agent: "A", paths: [HUB, "api/login.ts"] });
    const res = await findConflicts(g(), { agent: "B", paths: [HUB, "api/login.ts"] });
    expect(res.map((c) => [c.file, c.type, c.hops])).toEqual([
      ["api/login.ts", "SAME", 0],
      [HUB, "SAME", 0],
    ]);
  });

  test("no path = provably safe: unrelated file, hub-only link, separate island", async () => {
    await claim(g(), { agent: "A", paths: ["lib/crypto.ts", HUB] });
    expect(await findConflicts(g(), { agent: "B", paths: ["ui/AboutPage.tsx"] })).toEqual([]);
    expect((await claim(g(), { agent: "B", paths: ["ui/SettingsPanel.tsx", "api/settings.ts", "lib/prefs.ts"] })).ok).toBe(true);
  });

  test("own claims and expired claims never conflict", async () => {
    const now = Date.now();
    await claim(g(), { agent: "A", paths: ["lib/crypto.ts"], ttlMs: 1000, now });
    expect(await findConflicts(g(), { agent: "A", paths: ["ui/LoginForm.tsx"], now })).toEqual([]);
    expect(await findConflicts(g(), { agent: "B", paths: ["ui/LoginForm.tsx"], now: now + 2000 })).toEqual([]);
  });

  test("k limits the hop count and is validated", async () => {
    await claim(g(), { agent: "A", paths: ["lib/crypto.ts"] });
    expect(await findConflicts(g(), { agent: "B", paths: ["ui/LoginForm.tsx"], k: 2 })).toEqual([]);
    await expect(findConflicts(g(), { agent: "B", paths: ["x"], k: 9 })).rejects.toThrow(/k must be/);
  });
});

describe("claims and the event bus", () => {
  test("granted claims are edges; conflicts write no claim; both are events", async () => {
    const before = await latestSeq(g());
    await claim(g(), { agent: "A", paths: ["lib/crypto.ts"], taskId: "T1", intent: "argon2" });
    await claim(g(), { agent: "B", paths: ["ui/LoginForm.tsx"] });

    const [claims] = await g().roQuery(
      "MATCH (a:Agent)-[c:CLAIMS]->(f:File) RETURN collect(a.id + ':' + f.path + ':' + c.intent) AS all",
    );
    expect(claims?.all).toEqual(["A:lib/crypto.ts:argon2"]);

    const feed = await feedSince(g(), before);
    expect(feed.map((e) => [e.kind, e.agentId])).toEqual([
      ["claim", "A"],
      ["conflict", "B"],
    ]);
    expect((feed[1]!.payload as { conflicts: unknown[] }).conflicts).toHaveLength(1);
  });

  test("release drops claims and is an event", async () => {
    await claim(g(), { agent: "A", paths: ["lib/crypto.ts", "auth/session.ts"] });
    expect((await release(g(), { agent: "A", paths: ["lib/crypto.ts"] })).released).toBe(1);
    expect((await release(g(), { agent: "A" })).released).toBe(1);
    expect((await claim(g(), { agent: "B", paths: ["ui/LoginForm.tsx"] })).ok).toBe(true);
  });
});

describe("atomic claim under concurrency", () => {
  // Two connections, so the requests really are in flight together. With a
  // separate read-then-write, both checks could pass before either write lands.
  test("racing claims on linked files: exactly one wins, every round", async () => {
    const other = await connect({ graph: g().name });
    try {
      for (let round = 0; round < 20; round++) {
        await release(g(), { agent: "A" });
        await release(g(), { agent: "B" });
        const [a, b] = await Promise.all([
          claim(g(), { agent: "A", paths: ["lib/crypto.ts"] }),
          claim(other, { agent: "B", paths: ["ui/LoginForm.tsx"] }),
        ]);
        expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
        const loser = a.ok ? b : a;
        if (!loser.ok) expect(loser.conflicts[0]?.hops).toBe(3);
      }
    } finally {
      await other.close();
    }
  });

  test("ten agents race for the same file: one holder", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => claim(g(), { agent: `R${i}`, paths: ["auth/session.ts"] })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const [holders] = await g().roQuery(
      "MATCH (a:Agent)-[:CLAIMS]->(:File {path: 'auth/session.ts'}) RETURN count(a) AS n",
    );
    expect(holders?.n).toBe(1);
    for (let i = 0; i < 10; i++) await release(g(), { agent: `R${i}` });
  });
});

describe("TTL and release", () => {
  test("release frees the file for the next agent", async () => {
    await claim(g(), { agent: "A", paths: ["auth/session.ts"] });
    expect((await claim(g(), { agent: "B", paths: ["auth/session.ts"] })).ok).toBe(false);
    await release(g(), { agent: "A", paths: ["auth/session.ts"] });
    expect((await claim(g(), { agent: "B", paths: ["auth/session.ts"] })).ok).toBe(true);
  });

  test("a claim expires after its TTL; a heartbeat extends it", async () => {
    const now = Date.now();
    await claim(g(), { agent: "A", paths: ["lib/crypto.ts"], ttlMs: 1000, now });
    expect((await heartbeat(g(), { id: "A", now: now + 900 })).extended).toBe(1);
    // until is now + 900 + 1000: still held at +1500, gone at +1900.
    expect(await findConflicts(g(), { agent: "B", paths: ["lib/crypto.ts"], now: now + 1500 })).toHaveLength(1);
    expect((await claim(g(), { agent: "B", paths: ["lib/crypto.ts"], now: now + 1900 })).ok).toBe(true);
  });

  test("re-claiming your own file extends it instead of conflicting", async () => {
    const now = Date.now();
    await claim(g(), { agent: "A", paths: ["lib/crypto.ts"], ttlMs: 1000, now });
    const again = await claim(g(), { agent: "A", paths: ["lib/crypto.ts", "lib/crypto.ts"], ttlMs: 5000, now });
    expect(again).toMatchObject({ ok: true, until: now + 5000 });
  });

  test("an empty claim is rejected", async () => {
    await expect(claim(g(), { agent: "A", paths: [] })).rejects.toThrow(/at least one path/);
  });
});
