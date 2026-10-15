import { expect, test } from "vitest";
import { useTestGraph } from "../test-helpers.js";
import { ensureSchema } from "./schema.js";

const graph = useTestGraph("sb_test_schema");

test("ensureSchema can run twice and indexes File.path and Event.seq", async () => {
  const g = graph();
  await ensureSchema(g);
  await ensureSchema(g);

  const rows = await g.roQuery("CALL db.indexes()");
  expect(indexed(rows, "File", "path")).toBe(true);
  expect(indexed(rows, "Event", "seq")).toBe(true);
});

function indexed(
  rows: Record<string, unknown>[],
  label: string,
  property: string,
): boolean {
  return rows.some(
    (row) =>
      row.label === label &&
      Array.isArray(row.properties) &&
      row.properties.includes(property),
  );
}
