import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { claim, release } from "./claims.js";
import { recordEvent, viaPaths } from "./events.js";
import { hotspots } from "./history.js";
import { loadParse } from "./loader.js";

const g = useTestGraph("sb_test_history");
const NOW = Date.now();
const MONTH_AGO = NOW - 30 * 86_400_000;

const via = async (seq: number) =>
  (await g().roQuery("MATCH (:Event {seq: $seq})-[:VIA]->(f:File) RETURN f.path AS path ORDER BY path", { seq })).map((r) => r.path);

beforeAll(async () => {
  await loadParse(g(), parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
});

test("a refusal links every file on its import path with VIA", async () => {
  await claim(g(), { agent: "A", paths: ["auth/session.ts"], now: NOW });
  const refused = await claim(g(), { agent: "B", paths: ["ui/LoginForm.tsx"], now: NOW });
  expect(refused.ok).toBe(false);
  expect(await via(refused.seq)).toEqual(["api/login.ts", "auth/session.ts", "ui/LoginForm.tsx"]);
});

test("hotspots: files on the most refused paths, in the window only", async () => {
  const again = await claim(g(), { agent: "C", paths: ["api/login.ts"], now: NOW });
  expect(await via(again.seq)).toEqual(["api/login.ts", "auth/session.ts"]);
  // An old refusal outside a 7-day window.
  await release(g(), { agent: "A" });
  await claim(g(), { agent: "A", paths: ["lib/crypto.ts"], now: MONTH_AGO, ttlMs: 1000 });
  const old = await claim(g(), { agent: "D", paths: ["auth/session.ts"], now: MONTH_AGO });
  expect(old.ok).toBe(false);

  expect((await hotspots(g(), { now: NOW })).map((h) => [h.path, h.refusals])).toEqual([
    ["api/login.ts", 2],
    ["auth/session.ts", 2],
    ["ui/LoginForm.tsx", 1],
  ]);
  const all = await hotspots(g(), { days: 60, now: NOW });
  expect(all.map((h) => [h.path, h.refusals])).toEqual([
    ["auth/session.ts", 3],
    ["api/login.ts", 2],
    ["ui/LoginForm.tsx", 1],
    ["lib/crypto.ts", 1],
  ]);
  expect(await hotspots(g(), { limit: 1, now: NOW })).toHaveLength(1);
  await expect(hotspots(g(), { days: 0 })).rejects.toThrow(/days/);
});

test("other events link nothing; a conflict payload without paths links nothing", async () => {
  const seq = await recordEvent(g(), { kind: "claim", payload: { conflicts: [{ path: ["x"] }] } });
  expect(await via(seq)).toEqual([]);
  expect(viaPaths({ kind: "conflict", payload: null })).toEqual([]);
  expect(viaPaths({ kind: "conflict", payload: { conflicts: [{ path: ["a", "b"] }, { path: ["a", "c"] }] } })).toEqual(["a", "b", "c"]);
});
