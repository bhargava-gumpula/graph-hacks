import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseRepo } from "./parser.js";

const DEMO = join(import.meta.dirname, "../../../demo-repo");
const expected = JSON.parse(readFileSync(join(DEMO, "expected.json"), "utf8"));
const parsed = parseRepo(DEMO);
const has = (from: string, to: string) => parsed.imports.some((i) => i.from === from && i.to === to);

describe("parseRepo(demo-repo) matches expected.json", () => {
  test("file and import counts", () => {
    expect(parsed.files).toHaveLength(expected.files);
    expect(parsed.imports).toHaveLength(expected.imports);
    expect(parsed.imports.filter((i) => i.typeOnly)).toHaveLength(expected.typeOnlyImports);
  });

  test("the hub is imported by 20 files and imports nothing", () => {
    expect(parsed.imports.filter((i) => i.to === expected.hub.path)).toHaveLength(expected.hub.importedBy);
    expect(parsed.imports.filter((i) => i.from === expected.hub.path)).toHaveLength(0);
  });

  test("the planted chain is three real import edges", () => {
    const chain: string[] = expected.chain;
    for (let i = 0; i < chain.length - 1; i++) expect(has(chain[i]!, chain[i + 1]!)).toBe(true);
  });

  test("@lib/ aliases resolve to lib/ files", () => {
    const aliased = parsed.imports.filter((i) => i.to.startsWith("lib/") && !i.from.startsWith("lib/"));
    expect(aliased.length).toBeGreaterThanOrEqual(expected.aliasImports);
    expect(parsed.imports.every((i) => !i.to.startsWith("@"))).toBe(true);
  });

  test("leaf file has no dependents", () => {
    for (const leaf of expected.noDependents) expect(parsed.imports.some((i) => i.to === leaf)).toBe(false);
  });

  test("paths are repo-relative and files have loc and hash", () => {
    for (const f of parsed.files) {
      expect(f.path).not.toMatch(/^\/|\\|\.\./);
      expect(f.loc).toBeGreaterThan(0);
      expect(f.hash).toMatch(/^[0-9a-f]{40}$/);
    }
  });
});
