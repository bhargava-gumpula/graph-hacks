import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseRepo, type ParseResult } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { latestSeq } from "./feed.js";
import { codeGraphCounts, loadParse, missingFiles, resetDemo } from "./loader.js";

const g = useTestGraph("sb_test_loader");
const parsed = parseRepo(join(import.meta.dirname, "../../../../demo-repo"));

async function importsOf(path: string): Promise<Record<string, unknown>[]> {
  return g().roQuery(
    "MATCH (:File {path: $path})-[r:IMPORTS]->(t:File) RETURN t.path AS to, r.specifiers AS specifiers, r.typeOnly AS typeOnly ORDER BY to",
    { path },
  );
}

describe("demo repo", () => {
  test("counts are zero on an empty graph", async () => {
    expect(await codeGraphCounts(g())).toEqual({ files: 0, imports: 0 });
  });

  test("loading creates every file and import", async () => {
    expect(await loadParse(g(), parsed)).toEqual({ files: 35, imports: 51 });
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
  });

  test("edges carry specifiers and the type-only flag", async () => {
    const rows = await importsOf("ui/LoginForm.tsx");
    expect(rows.find((r) => r.to === "lib/types.ts")).toMatchObject({ typeOnly: true, specifiers: ["User"] });
    expect(rows.find((r) => r.to === "api/login.ts")).toMatchObject({ typeOnly: false });
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

  test("a re-parse replaces a file's imports: removed edges go, changed specifiers update", async () => {
    const changed: ParseResult = {
      files: parsed.files,
      imports: parsed.imports
        .filter((i) => !(i.from === "ui/LoginForm.tsx" && i.to === "api/login.ts"))
        .map((i) => (i.from === "ui/LoginForm.tsx" && i.to === "lib/types.ts" ? { ...i, specifiers: ["User", "Role"] } : i)),
    };
    await loadParse(g(), changed);
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 50 });
    const rows = await importsOf("ui/LoginForm.tsx");
    expect(rows.some((r) => r.to === "api/login.ts")).toBe(false);
    expect(rows.find((r) => r.to === "lib/types.ts")?.specifiers).toEqual(["User", "Role"]);

    await loadParse(g(), parsed);
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
  });

  test("a deleted file is removed with its edges; a claimed-only file stays", async () => {
    await g().query("MERGE (:File {path: 'ui/NewThing.tsx'})"); // as a claim would create it: no hash
    const gone = "ui/AboutPage.tsx";
    await loadParse(g(), {
      files: parsed.files.filter((f) => f.path !== gone),
      imports: parsed.imports.filter((i) => i.from !== gone && i.to !== gone),
    });
    const outOf = parsed.imports.filter((i) => i.from === gone).length;
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 - outOf });
    const [row] = await g().roQuery("MATCH (f:File) WHERE f.path IN [$gone, 'ui/NewThing.tsx'] RETURN collect(f.path) AS paths", { gone });
    expect(row?.paths).toEqual(["ui/NewThing.tsx"]);

    await g().query("MATCH (f:File {path: 'ui/NewThing.tsx'}) DETACH DELETE f");
    await loadParse(g(), parsed);
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
  });

  test("resetDemo with no stray files still drops stray agents, claims and memory", async () => {
    await g().query(
      `MERGE (a:Agent {id: 'A'}) MERGE (c:Agent {id: 'C'}) MERGE (b:Agent {id: 'B'})
       WITH a, b, c
       MATCH (s:File {path: 'auth/session.ts'}), (l:File {path: 'ui/LoginForm.tsx'})
       MERGE (c)-[:CLAIMS {until: 9e12}]->(s)
       MERGE (b)-[:CLAIMS {until: 9e12}]->(l)
       MERGE (a)-[:EDITED {at: 1}]->(s)
       MERGE (:Decision {id: 'd1'}) MERGE (:Lesson {id: 'l1'}) MERGE (:Task {id: 't1'})`,
    );
    const seq = await latestSeq(g());
    await resetDemo(g());
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
    const [row] = await g().roQuery(
      `MATCH (a:Agent) WITH collect(a.id) AS agents
       OPTIONAL MATCH ()-[r]->() WHERE type(r) <> 'IMPORTS' WITH agents, count(r) AS edges
       OPTIONAL MATCH (n) WHERE n:Event OR n:Decision OR n:Lesson OR n:Task
       RETURN agents, edges, count(n) AS memory`,
    );
    expect(row).toEqual({ agents: ["A", "B"], edges: 0, memory: 0 });
    expect(await latestSeq(g())).toBe(seq);
  });

  test("resetDemo drops files outside the demo repo", async () => {
    await g().query("MERGE (:File {path: 'packages/core/src/x.ts'})");
    await resetDemo(g());
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
  });

  test("missingFiles lists paths that are not File nodes, in input order", async () => {
    expect(await missingFiles(g(), ["ui/evil.tsx", "auth/session.ts", "x"])).toEqual(["ui/evil.tsx", "x"]);
    expect(await missingFiles(g(), ["auth/session.ts"])).toEqual([]);
  });
});

describe("batches", () => {
  test("more than one batch of files and imports loads completely", async () => {
    await g().query("MATCH (f:File) DETACH DELETE f");
    const n = 1201;
    const path = (i: number) => `gen/f${i}.ts`;
    const big: ParseResult = {
      files: Array.from({ length: n }, (_, i) => ({ path: path(i), lang: "ts" as const, loc: 1, hash: "h" })),
      imports: Array.from({ length: n - 1 }, (_, i) => ({ from: path(i + 1), to: path(i), specifiers: ["x"], typeOnly: false })),
    };
    await loadParse(g(), big);
    expect(await codeGraphCounts(g())).toEqual({ files: n, imports: n - 1 });
  });
});
