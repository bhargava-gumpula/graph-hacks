import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { Node, Project, ts, type SourceFile, type StringLiteral } from "ts-morph";

export interface ParsedFile {
  /** Repo-relative POSIX path, e.g. `ui/LoginForm.tsx`. */
  path: string;
  lang: "ts" | "tsx" | "js" | "jsx";
  loc: number;
  /** sha1 of the file text; lets a later re-parse skip unchanged files. */
  hash: string;
}

export interface ParsedImport {
  from: string;
  to: string;
  /** Imported names (`default`, `*` and named), merged across statements, sorted. */
  specifiers: string[];
  /** True only if every statement for this pair imports types alone. */
  typeOnly: boolean;
}

export interface ParseResult {
  files: ParsedFile[];
  imports: ParsedImport[];
}

const SKIP_DIRS = ["node_modules", "dist"];
const SOURCE_GLOBS = ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}", ...SKIP_DIRS.map((d) => `!**/${d}/**`), "!**/*.d.ts"];

/** One import-like statement found in a file, before it is merged into an edge. */
interface Statement {
  target: SourceFile | undefined;
  typeOnly: boolean;
  names: string[];
}

/**
 * Parse a TS/JS repo into files and file→file import edges.
 *
 * The root tsconfig.json (if any) supplies compiler options only, so path aliases
 * like `@lib/*` resolve exactly as `tsc` resolves them; files are added by glob, so
 * files the tsconfig doesn't include are still parsed. Resolution is the compiler's,
 * which also maps `./x.js` to `x.ts` and `./dir` to `dir/index.ts`.
 * An import whose target is not one of the parsed files (a package, a node built-in,
 * a `.d.ts`, anything outside `root`) is dropped, never guessed.
 * Output is sorted, so the same tree always gives the same result.
 */
export function parseRepo(root: string): ParseResult {
  const absRoot = resolve(root);
  const project = createProject(absRoot);
  project.addSourceFilesAtPaths(
    SOURCE_GLOBS.map((g) => (g.startsWith("!") ? `!${join(absRoot, g.slice(1))}` : join(absRoot, g))),
  );

  const toPath = (sf: SourceFile) => relative(absRoot, sf.getFilePath()).split(sep).join("/");
  const sources = project.getSourceFiles().filter((sf) => !sf.isDeclarationFile() && !isSkipped(toPath(sf)));
  const known = new Set(sources.map(toPath));

  const files: ParsedFile[] = [];
  const edges = new Map<string, ParsedImport>();

  for (const sf of sources) {
    const path = toPath(sf);
    const text = sf.getFullText();
    files.push({ path, lang: langOf(path), loc: countLines(text), hash: createHash("sha1").update(text).digest("hex") });

    for (const s of statementsOf(sf)) {
      const to = s.target ? toPath(s.target) : undefined;
      if (!to || to === path || !known.has(to)) continue;
      const key = `${path}\0${to}`;
      const edge = edges.get(key);
      if (edge) {
        edge.specifiers = [...new Set([...edge.specifiers, ...s.names])].sort();
        edge.typeOnly &&= s.typeOnly;
      } else {
        edges.set(key, { from: path, to, specifiers: [...new Set(s.names)].sort(), typeOnly: s.typeOnly });
      }
    }
  }

  // Plain code-unit comparison, not localeCompare: the order must not depend on the machine's locale.
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  files.sort((a, b) => cmp(a.path, b.path));
  const imports = [...edges.values()].sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to));
  return { files, imports };
}

function createProject(root: string): Project {
  const tsConfigFilePath = join(root, "tsconfig.json");
  // allowJs so `.js` files resolve as targets even when the repo's tsconfig doesn't enable it.
  if (existsSync(tsConfigFilePath)) {
    return new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: true, compilerOptions: { allowJs: true } });
  }
  return new Project({
    compilerOptions: { allowJs: true, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler },
  });
}

/** Static imports, `export … from` re-exports, and `import("literal")` calls. */
function statementsOf(sf: SourceFile): Statement[] {
  const imports = sf.getImportDeclarations().map((d) => {
    const named = d.getNamedImports();
    const names = [
      ...(d.getDefaultImport() ? ["default"] : []),
      ...(d.getNamespaceImport() ? ["*"] : []),
      ...named.map((n) => n.getName()),
    ];
    // `import { type A, type B }` is type-only too; a bare `import "./x"` is not (it runs the module).
    const allNamedAreTypes = named.length > 0 && names.length === named.length && named.every((n) => n.isTypeOnly());
    return { target: d.getModuleSpecifierSourceFile(), typeOnly: d.isTypeOnly() || allNamedAreTypes, names };
  });

  const reExports = sf
    .getExportDeclarations()
    .filter((d) => d.hasModuleSpecifier())
    .map((d) => {
      const named = d.getNamedExports();
      const typeOnly = d.isTypeOnly() || (named.length > 0 && named.every((n) => n.isTypeOnly()));
      return { target: d.getModuleSpecifierSourceFile(), typeOnly, names: d.hasNamedExports() ? named.map((n) => n.getName()) : ["*"] };
    });

  const dynamic = sf
    .getDescendantsOfKind(ts.SyntaxKind.CallExpression)
    .filter((c) => c.getExpression().getKind() === ts.SyntaxKind.ImportKeyword)
    .map((c) => c.getArguments()[0])
    .filter((arg): arg is StringLiteral => arg !== undefined && Node.isStringLiteral(arg))
    .map((arg) => ({ target: moduleOf(arg), typeOnly: false, names: ["*"] }));

  return [...imports, ...reExports, ...dynamic];
}

/** The source file a module-specifier string resolves to (same lookup ts-morph uses for import declarations). */
function moduleOf(literal: StringLiteral): SourceFile | undefined {
  const decl = literal.getSymbol()?.getDeclarations()[0];
  return decl && Node.isSourceFile(decl) ? decl : undefined;
}

function isSkipped(path: string): boolean {
  const parts = path.split("/");
  return path.startsWith("..") || parts.some((p) => SKIP_DIRS.includes(p));
}

function langOf(path: string): ParsedFile["lang"] {
  const ext = path.slice(path.lastIndexOf(".") + 1);
  if (ext === "tsx" || ext === "jsx") return ext;
  return ext.endsWith("ts") ? "ts" : "js";
}

/** Lines of text; a trailing newline doesn't start an extra line. */
function countLines(text: string): number {
  if (text === "") return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}
