import { beforeEach, expect, test } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import { heartbeat, registerAgent, releaseStaleAgents, status } from "./agents.js";
import { claim, DEFAULT_TTL_MS } from "./claims.js";
import { feedSince, latestSeq } from "./feed.js";

const g = useTestGraph("sb_test_agents");

beforeEach(async () => {
  await g().query("MATCH (a:Agent) DETACH DELETE a");
  // claim() only claims files that are in the code graph.
  await g().query("UNWIND ['lib/crypto.ts', 'ui/AboutPage.tsx'] AS p MERGE (f:File {path: p}) ON CREATE SET f.hub = false, f.rank = 0.0");
});

test("register sets the agent active and records a register event", async () => {
  const first = await registerAgent(g(), { id: "ada", kind: "cursor", now: 1000 });
  const again = await registerAgent(g(), { id: "ada", kind: "claude", now: 1500 });

  const [agent] = await g().roQuery(
    `MATCH (a:Agent {id: 'ada'})
     RETURN a.status AS status, a.kind AS kind, a.startedAt AS startedAt, a.lastSeen AS lastSeen`,
  );
  expect(agent).toEqual({ status: "active", kind: "claude", startedAt: 1000, lastSeen: 1500 });

  const events = await g().roQuery(
    `MATCH (e:Event {kind: 'register'})-[:BY]->(:Agent {id: 'ada'})
     RETURN e.seq AS seq ORDER BY seq`,
  );
  expect(events.map((row) => row.seq)).toEqual([first.seq, again.seq]);
});

test("heartbeat updates lastSeen and leaves startedAt", async () => {
  await registerAgent(g(), { id: "grace", kind: "human", now: 2000 });
  const beat = await heartbeat(g(), { id: "grace", now: 9000 });

  const [agent] = await g().roQuery(
    `MATCH (a:Agent {id: 'grace'})
     RETURN a.lastSeen AS lastSeen, a.startedAt AS startedAt, a.status AS status`,
  );
  expect(agent).toEqual({ lastSeen: 9000, startedAt: 2000, status: "active" });

  const [event] = await g().roQuery(
    `MATCH (e:Event {kind: 'heartbeat'})-[:BY]->(:Agent {id: 'grace'})
     RETURN e.seq AS seq`,
  );
  expect(event?.seq).toBe(beat.seq);
});

test("status lists the claim after claim(), and skips an expired one", async () => {
  const now = 10_000;
  await registerAgent(g(), { id: "ada", kind: "cursor", now });
  await claim(g(), { agent: "ada", paths: ["lib/crypto.ts"], taskId: "T1", now });
  await claim(g(), { agent: "bea", paths: ["ui/AboutPage.tsx"], ttlMs: 5, now });

  const s = await status(g(), now + 10);

  expect(s.agents.map((a) => [a.id, a.kind, a.status, a.claims])).toEqual([
    ["ada", "cursor", "active", ["lib/crypto.ts"]],
    ["bea", null, "active", []],
  ]);
  expect(s.claims).toEqual([
    { agent: "ada", path: "lib/crypto.ts", until: now + DEFAULT_TTL_MS, taskId: "T1" },
  ]);
});

test("a stale agent is marked stale and its claims are released", async () => {
  const now = 1_000_000;
  await claim(g(), { agent: "dead", paths: ["lib/crypto.ts"], ttlMs: 10 * DEFAULT_TTL_MS, now });
  await claim(g(), { agent: "alive", paths: ["ui/AboutPage.tsx"], now });
  await heartbeat(g(), { id: "alive", now: now + 50_000 });
  const before = await latestSeq(g());

  expect(await releaseStaleAgents(g(), { staleMs: 60_000, now: now + 70_000 })).toEqual(["dead"]);

  const s = await status(g(), now + 70_000);
  expect(s.agents.map((a) => [a.id, a.status, a.claims])).toEqual([
    ["alive", "active", ["ui/AboutPage.tsx"]],
    ["dead", "stale", []],
  ]);
  const feed = await feedSince(g(), before);
  expect(feed.map((e) => [e.kind, e.agentId, e.payload])).toEqual([
    ["release", "dead", { reason: "stale", paths: ["lib/crypto.ts"] }],
  ]);
  // Idempotent: nothing left to release.
  expect(await releaseStaleAgents(g(), { staleMs: 60_000, now: now + 80_000 })).toEqual([]);
  // A heartbeat brings it back.
  await heartbeat(g(), { id: "dead", now: now + 90_000 });
  expect((await status(g(), now + 90_000)).agents.find((a) => a.id === "dead")?.status).toBe("active");
});

test("claim() releases a stale agent's long claim before checking", async () => {
  const now = 2_000_000;
  await claim(g(), { agent: "ghost", paths: ["lib/crypto.ts"], ttlMs: 10 * DEFAULT_TTL_MS, now });
  const later = now + DEFAULT_TTL_MS + 1;
  expect((await claim(g(), { agent: "next", paths: ["lib/crypto.ts"], now: later })).ok).toBe(true);
});
