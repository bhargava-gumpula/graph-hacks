import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { blastRadius, blastQuery } from "./blast.js";
import { claim } from "./claims.js";
import { loadParse } from "./loader.js";

const g = useTestGraph("sb_test_blast");

beforeAll(async () => {
  await loadParse(g(), parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
});

test("crypto.ts breaks session, login and LoginForm, one hop further each", async () => {
  const blast = await blastRadius(g(), "lib/crypto.ts");
  expect(blast.found).toBe(true);
  expect(blast.dependents.map((d) => [d.path, d.hops])).toEqual([
    ["auth/session.ts", 1],
    ["api/login.ts", 2],
    ["ui/LoginForm.tsx", 3],
  ]);
  expect(blast.byHop).toEqual([
    { hops: 1, count: 1 },
    { hops: 2, count: 1 },
    { hops: 3, count: 1 },
  ]);
});

test("k limits the hops", async () => {
  const blast = await blastRadius(g(), "lib/crypto.ts", 1);
  expect(blast.dependents.map((d) => d.path)).toEqual(["auth/session.ts"]);
});

test("a leaf with no dependents is provably safe to change alone", async () => {
  const blast = await blastRadius(g(), "ui/AboutPage.tsx");
  expect(blast).toEqual({ path: "ui/AboutPage.tsx", found: true, dependents: [], byHop: [] });
});

test("an unknown file is not reported as safe", async () => {
  const blast = await blastRadius(g(), "nope/missing.ts");
  expect(blast.found).toBe(false);
});

test("the hub's own importers are its blast radius, but no path runs through it", async () => {
  const blast = await blastRadius(g(), "lib/utils.ts", 1);
  expect(blast.dependents).toHaveLength(20);
  // utils imports nothing that matters here, but nothing reaches crypto through utils either.
  const viaHub = await blastRadius(g(), "lib/crypto.ts", 4);
  expect(viaHub.dependents.map((d) => d.path)).not.toContain("lib/utils.ts");
});

test("dependents list the agents claiming them", async () => {
  await claim(g(), { agent: "A", paths: ["api/login.ts"], taskId: "T1" });
  const blast = await blastRadius(g(), "lib/crypto.ts");
  expect(blast.dependents.find((d) => d.path === "api/login.ts")?.agents).toEqual(["A"]);
  expect(blast.dependents.find((d) => d.path === "auth/session.ts")?.agents).toEqual([]);
  const later = await blastRadius(g(), "lib/crypto.ts", 3, Date.now() + 365 * 86_400_000);
  expect(later.dependents.every((d) => d.agents.length === 0)).toBe(true);
});

test("k outside 1..5 is rejected before any Cypher is built", () => {
  expect(() => blastQuery(0)).toThrow();
  expect(() => blastQuery(6)).toThrow();
  expect(() => blastQuery(1.5)).toThrow();
});
