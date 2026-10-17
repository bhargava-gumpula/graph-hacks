import { beforeAll, expect, test } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import { recordLesson } from "./brief.js";
import { fulltextQuery, searchMemory } from "./search.js";
import { recordDecision } from "./why.js";

const g = useTestGraph("sb_test_search");

beforeAll(async () => {
  await g().query("CREATE (:File {path: 'auth/session.ts', hub: false}), (:File {path: 'lib/crypto.ts', hub: false})");
  await recordDecision(g(), {
    agent: "A",
    text: "session TTL is 30 min",
    why: "the mobile client kept getting logged out",
    paths: ["auth/session.ts"],
    id: "D-ttl",
  });
  await recordDecision(g(), { agent: "A", text: "use argon2, not bcrypt", why: "FIPS note", paths: ["lib/crypto.ts"], id: "D-argon2" });
  await recordLesson(g(), { text: "run codegen before tsc, or the session types go stale", paths: ["auth/session.ts"], id: "L-codegen" });
});

test("a word that only appears in a decision's why finds it, with its files", async () => {
  expect(await searchMemory(g(), "mobile")).toEqual([
    {
      kind: "decision",
      id: "D-ttl",
      text: "session TTL is 30 min",
      why: "the mobile client kept getting logged out",
      status: "active",
      paths: ["auth/session.ts"],
      score: expect.any(Number),
    },
  ]);
});

test("lessons are searched too, and any one word can match", async () => {
  const hits = await searchMemory(g(), "Codegen? argon2!");
  expect(hits.map((h) => [h.kind, h.id]).sort()).toEqual([
    ["decision", "D-argon2"],
    ["lesson", "L-codegen"],
  ]);
  expect(hits.find((h) => h.kind === "lesson")).toMatchObject({ why: null, status: null, paths: ["auth/session.ts"] });
});

test("stemming: 'sessions' finds 'session'", async () => {
  expect((await searchMemory(g(), "sessions")).map((h) => h.id)).toContain("D-ttl");
});

test("punctuation and stop words never reach the index", async () => {
  expect(fulltextQuery("the @text:{x} | -bcrypt* and for")).toBe("text|bcrypt");
  expect(fulltextQuery("?! a an the")).toBeNull();
  expect(await searchMemory(g(), "?! -- the")).toEqual([]);
  expect((await searchMemory(g(), "-bcrypt*")).map((h) => h.id)).toEqual(["D-argon2"]);
});

test("limit caps the hits", async () => {
  expect(await searchMemory(g(), "session codegen mobile argon2", 2)).toHaveLength(2);
});
