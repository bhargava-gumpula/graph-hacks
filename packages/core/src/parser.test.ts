import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { gitignore, parseFile, parseRepo, type ParseResult } from "./parser.js";

const DEMO = join(import.meta.dirname, "../../../demo-repo");
const expected = JSON.parse(readFileSync(join(DEMO, "expected.json"), "utf8"));
const parsed = parseRepo(DEMO);
const edge = (r: ParseResult, from: string, to: string) => r.imports.find((i) => i.from === from && i.to === to);

describe("parseRepo(demo-repo) matches expected.json", () => {
  test("file, import and type-only counts", () => {
    expect(parsed.files).toHaveLength(expected.files);
    expect(parsed.imports).toHaveLength(expected.imports);
    expect(parsed.imports.filter((i) => i.typeOnly)).toHaveLength(expected.typeOnlyImports);
  });

  test("the hub is imported by 20 files and imports nothing", () => {
    expect(parsed.imports.filter((i) => i.to === expected.hub.path)).toHaveLength(expected.hub.importedBy);
    expect(parsed.imports.filter((i) => i.from === expected.hub.path)).toHaveLength(0);
  });

  test("the planted chain and the island are real import edges", () => {
    for (const path of [expected.chain, expected.island] as string[][]) {
      for (let i = 0; i < path.length - 1; i++) expect(edge(parsed, path[i]!, path[i + 1]!)).toBeDefined();
    }
  });

  test("every @lib/ alias in the source resolves to its lib/ file", () => {
    let aliases = 0;
    for (const f of parsed.files) {
      const text = readFileSync(join(DEMO, f.path), "utf8");
      for (const m of text.matchAll(/from "@lib\/([\w-]+)"/g)) {
        aliases++;
        expect(edge(parsed, f.path, `lib/${m[1]}.ts`)).toBeDefined();
      }
    }
    expect(aliases).toBe(expected.aliasImports);
  });

  test("leaf files have no dependents", () => {
    for (const leaf of expected.noDependents) expect(parsed.imports.some((i) => i.to === leaf)).toBe(false);
  });

  test("paths are repo-relative and files have loc and hash", () => {
    for (const f of parsed.files) {
      expect(f.path).not.toMatch(/^\/|\\|\.\./);
      expect(f.loc).toBeGreaterThan(0);
      expect(f.hash).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  test("is deterministic, and a relative root gives the same result", () => {
    expect(parseRepo(DEMO)).toEqual(parsed);
    expect(parseRepo("demo-repo")).toEqual(parsed); // vitest runs from the repo root
  });
});

describe("parseRepo edge cases", () => {
  const root = mkdtempSync(join(tmpdir(), "sb-parser-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };

  write("tsconfig.json", JSON.stringify({ compilerOptions: { moduleResolution: "bundler", module: "esnext", baseUrl: ".", paths: { "~/*": ["src/*"] } } }));
  write("src/a.ts", "export const a = 1;\nexport type A = number;\n");
  write("src/b.ts", "export const b = 2;\n");
  write("src/barrel/index.ts", 'export { a } from "../a";\nexport * from "../b";\n');
  write("src/types-only.ts", 'import type { A } from "./a";\nimport { type A as A2 } from "~/a";\nexport type T = A | A2;\n');
  write("src/mixed.ts", 'import type { A } from "./a";\nimport { a } from "./a";\nexport const m: A = a;\n');
  write("src/uses-barrel.ts", 'import { a, b } from "./barrel";\nexport const s = a + b;\n');
  write("src/js-ext.ts", 'import { b } from "./b.js";\nexport const j = b;\n');
  write("src/lazy.ts", 'export async function load() { return import("./b"); }\n');
  write("src/side.ts", 'import "./a";\n');
  write("src/legacy.js", 'import { b } from "./b";\nexport const l = b;\n');
  write("src/external.ts", 'import { join } from "node:path";\nimport { x } from "./missing";\nimport { y } from "some-pkg";\nexport const e = [join, x, y];\n');
  write("node_modules/some-pkg/index.ts", "export const y = 1;\n");
  write("dist/a.js", "export const a = 1;\n");

  const r = parseRepo(root);

  test("skips node_modules and dist, keeps .js files", () => {
    expect(r.files.map((f) => f.path)).toEqual([
      "src/a.ts", "src/b.ts", "src/barrel/index.ts", "src/external.ts", "src/js-ext.ts", "src/lazy.ts",
      "src/legacy.js", "src/mixed.ts", "src/side.ts", "src/types-only.ts", "src/uses-barrel.ts",
    ]);
    expect(r.files.find((f) => f.path === "src/legacy.js")?.lang).toBe("js");
    expect(r.files.find((f) => f.path === "src/a.ts")?.loc).toBe(2);
  });

  test("a directory import resolves to its index file", () => {
    expect(edge(r, "src/uses-barrel.ts", "src/barrel/index.ts")?.specifiers).toEqual(["a", "b"]);
  });

  test("re-exports are edges", () => {
    expect(edge(r, "src/barrel/index.ts", "src/a.ts")?.specifiers).toEqual(["a"]);
    expect(edge(r, "src/barrel/index.ts", "src/b.ts")?.specifiers).toEqual(["*"]);
  });

  test("type-only imports are flagged; one value import clears the flag", () => {
    expect(edge(r, "src/types-only.ts", "src/a.ts")).toMatchObject({ typeOnly: true, specifiers: ["A"] });
    expect(edge(r, "src/mixed.ts", "src/a.ts")).toMatchObject({ typeOnly: false, specifiers: ["A", "a"] });
  });

  test("./b.js maps to b.ts, import() and side-effect imports count, .js files import too", () => {
    expect(edge(r, "src/js-ext.ts", "src/b.ts")).toBeDefined();
    expect(edge(r, "src/lazy.ts", "src/b.ts")).toMatchObject({ typeOnly: false, specifiers: ["*"] });
    expect(edge(r, "src/side.ts", "src/a.ts")).toMatchObject({ typeOnly: false, specifiers: [] });
    expect(edge(r, "src/legacy.js", "src/b.ts")).toBeDefined();
  });

  test("packages, built-ins and unresolved imports are dropped", () => {
    expect(r.imports.filter((i) => i.from === "src/external.ts")).toEqual([]);
    expect(r.imports.every((i) => !i.to.includes("node_modules"))).toBe(true);
  });

  test("works without a tsconfig", () => {
    rmSync(join(root, "tsconfig.json"));
    const plain = parseRepo(root);
    expect(edge(plain, "src/js-ext.ts", "src/b.ts")).toBeDefined();
    expect(edge(plain, "src/uses-barrel.ts", "src/barrel/index.ts")).toBeDefined();
  });
});

describe(".gitignore and build output", () => {
  const root = mkdtempSync(join(tmpdir(), "sb-ignore-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const write = (path: string, text = "export const x = 1;\n") => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write(".gitignore", "# generated\n/generated/\n*.gen.ts\n!keep.gen.ts\ntmp\nsrc/legacy/**\n");
  for (const p of ["src/a.ts", "src/keep.gen.ts", "src/b.gen.ts", "generated/api.ts", "src/generated/ok.ts", "tmp/x.ts", "src/tmp/y.ts",
    "src/legacy/old.ts", ".next/server/page.js", "out/index.js", "build/main.js", "coverage/lcov.js", ".turbo/x.js", ".vercel/output/f.js",
    "dist/a.js"]) write(p);

  test("skips build output always and the repo's .gitignore patterns", () => {
    expect(parseRepo(root).files.map((f) => f.path)).toEqual(["src/a.ts", "src/generated/ok.ts", "src/keep.gen.ts"]);
    expect(parseFile(root, "src/b.gen.ts")).toBeNull();
    expect(parseFile(root, "out/index.js")).toBeNull();
    expect(parseFile(root, "src/a.ts")?.file.path).toBe("src/a.ts");
  });

  test("the matcher: dirs, globs, anchoring, negation", () => {
    const ignored = gitignore(root);
    expect(ignored("generated/api.ts")).toBe(true);
    expect(ignored("src/generated/ok.ts")).toBe(false);
    expect(ignored("deep/tmp/z.ts")).toBe(true);
    expect(ignored("src/keep.gen.ts")).toBe(false);
    expect(ignored("src/legacy/a/b.ts")).toBe(true);
    expect(ignored("src/legacyish.ts")).toBe(false);
    expect(gitignore(join(root, "no-such-dir"))("anything.ts")).toBe(false);
  });
});

describe("parseRepo(packages/) sanity", () => {
  const pkgs = parseRepo(join(import.meta.dirname, "../.."));
  const paths = new Set(pkgs.files.map((f) => f.path));

  test("finds this package's sources and resolves its NodeNext `.js` imports", () => {
    expect(paths.has("core/src/parser.ts")).toBe(true);
    expect(edge(pkgs, "core/src/index.ts", "core/src/parser.ts")).toBeDefined();
    expect(edge(pkgs, "core/src/parser.test.ts", "core/src/parser.ts")).toBeDefined();
  });

  test("every edge points at a parsed file and nothing under node_modules or dist", () => {
    for (const i of pkgs.imports) {
      expect(paths.has(i.from) && paths.has(i.to)).toBe(true);
    }
    for (const p of paths) expect(p).not.toMatch(/(^|\/)(node_modules|dist)\//);
  });

  test("the type-only import of SbGraph is flagged", () => {
    expect(edge(pkgs, "core/src/queries/schema.ts", "core/src/graph.ts")?.typeOnly).toBe(true);
  });
});
