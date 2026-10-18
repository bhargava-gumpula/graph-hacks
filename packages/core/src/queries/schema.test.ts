import { expect, test } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import type { SbGraph } from "../graph.js";
import { ensureSchema, SCHEMA_MARKER } from "./schema.js";

const graph = useTestGraph("sb_test_schema");

const EXPECTED: [label: string, property: string, type: "RANGE" | "FULLTEXT"][] = [
  ["File", "path", "RANGE"],
  ["Agent", "id", "RANGE"],
  ["Task", "id", "RANGE"],
  ["Event", "seq", "RANGE"],
  ["Decision", "id", "RANGE"],
  ["CLAIMS", "until", "RANGE"],
  ["Decision", "text", "FULLTEXT"],
  ["Decision", "why", "FULLTEXT"],
  ["Lesson", "text", "FULLTEXT"],
];

async function indexTypes(): Promise<Map<string, string[]>> {
  const rows = await graph().roQuery("CALL db.indexes()");
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const types = row.types as Record<string, string[]>;
    for (const [prop, list] of Object.entries(types)) out.set(`${String(row.label)}.${prop}`, list);
  }
  return out;
}

test("every index exists with the right type", async () => {
  const types = await indexTypes();
  for (const [label, prop, type] of EXPECTED) expect(types.get(`${label}.${prop}`), `${label}.${prop}`).toContain(type);
});

test("ensureSchema is idempotent and never resets the seq counter", async () => {
  await graph().query("MATCH (m:Meta {key:'seq'}) SET m.value = 7");
  await ensureSchema(graph());
  await ensureSchema(graph());

  const rows = await graph().roQuery("MATCH (m:Meta {key:'seq'}) RETURN m.value AS value");
  expect(rows).toEqual([{ value: 7 }]);
  expect((await indexTypes()).size).toBe(EXPECTED.length);
});

test("the seq counter starts at 0 on a fresh graph", async () => {
  await graph().query("MATCH (m:Meta) DELETE m");
  await ensureSchema(graph());
  expect(await graph().roQuery("MATCH (m:Meta {key:'seq'}) RETURN m.value AS value")).toEqual([{ value: 0 }]);
});

test("ensureSchema runs once per graph: once marked, a call is one read and no write", async () => {
  await ensureSchema(graph());
  const g = graph();
  const calls: string[] = [];
  const spy: SbGraph = {
    ...g,
    query: (c, p, o) => (calls.push(c), g.query(c, p, o)),
    roQuery: (c, p, o) => (calls.push(c), g.roQuery(c, p, o)),
  };
  await ensureSchema(spy);
  await ensureSchema(spy);
  expect(calls).toEqual([SCHEMA_MARKER, SCHEMA_MARKER]);
});
