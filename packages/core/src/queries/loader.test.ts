import { join } from "node:path";
import { expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { codeGraphCounts, loadParse } from "./loader.js";

const g = useTestGraph("sb_test_loader");
const parsed = parseRepo(join(import.meta.dirname, "../../../../demo-repo"));

test("loading the demo repo creates every file and import", async () => {
  expect(await loadParse(g(), parsed)).toEqual({ files: 35, imports: 51 });
  expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
});

test("the 3-hop chain is a path in the graph", async () => {
  const [row] = await g().roQuery(
    "MATCH p=(:File {path:'ui/LoginForm.tsx'})-[:IMPORTS*3]->(:File {path:'lib/crypto.ts'}) RETURN count(p) AS n",
  );
  expect(Number(row?.n)).toBeGreaterThanOrEqual(1);
});

test("the planted hub is flagged and every other file is not", async () => {
  const [hubs] = await g().roQuery("MATCH (f:File) WHERE f.hub RETURN collect(f.path) AS paths");
  expect(hubs?.paths).toEqual(["lib/utils.ts"]);
});

test("loading twice is idempotent", async () => {
  await loadParse(g(), parsed);
  expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
});

test("a removed import disappears on re-load", async () => {
  const without = {
    files: parsed.files,
    imports: parsed.imports.filter((i) => !(i.from === "ui/LoginForm.tsx" && i.to === "api/login.ts")),
  };
  await loadParse(g(), without);
  expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 50 });
  await loadParse(g(), parsed);
  expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
});
