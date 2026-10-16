import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { blastRadius } from "./blast.js";
import { loadParse } from "./loader.js";

const g = useTestGraph("sb_test_blast");

beforeAll(async () => {
  await loadParse(g(), parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
});

test("session.ts is imported by login.ts and, one hop further, LoginForm", async () => {
  const blast = await blastRadius(g(), "auth/session.ts");
  expect(blast.dependents.map((d) => [d.path, d.hops])).toEqual([
    ["api/login.ts", 1],
    ["ui/LoginForm.tsx", 2],
  ]);
  expect(blast.byHop).toEqual([
    { hops: 1, count: 1 },
    { hops: 2, count: 1 },
  ]);
});

test("a leaf with no dependents is provably safe to change alone", async () => {
  const blast = await blastRadius(g(), "ui/AboutPage.tsx");
  expect(blast.dependents).toEqual([]);
});
