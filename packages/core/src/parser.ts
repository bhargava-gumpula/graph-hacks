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

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;

/** One import-like statement found in a file, before it is merged into an edge. */
interface Statement {
  /** The module specifier, e.g. `"./a"` in `import { x } from "./a"`. */
  literal: StringLiteral;
  typeOnly: boolean;
  names: string[];
}

/**
 * The repo-relative POSIX path of a file parseRepo would load: a TS/JS source file inside the
 * repo, not a declaration file, not under node_modules or dist, and not a dotfile or under a dot
 * directory (.git, .next), which the source globs skip too.
 */
export function isSourcePath(path: string): boolean {
  return SOURCE_EXT.test(path) && !/\.d\.[mc]?ts$/.test(path) && !isSkipped(path);
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

  const toPath = (abs: string) => relative(absRoot, abs).split(sep).join("/");
  const sources = project.getSourceFiles().filter((sf) => isSourcePath(toPath(sf.getFilePath())));
  const known = new Set(sources.map((sf) => toPath(sf.getFilePath())));
  const resolveTarget = resolverFor(project, absRoot);

  const files: ParsedFile[] = [];
  const imports: ParsedImport[] = [];
  for (const sf of sources) {
    const parsed = parseSource(sf, toPath, resolveTarget, (to) => known.has(to));
    files.push(parsed.file);
    imports.push(...parsed.imports);
  }

  files.sort((a, b) => cmp(a.path, b.path));
  imports.sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to));
  return { files, imports };
}

/** One project per repo root, so a run of single-file parses reads the tsconfig once. */
const projects = new Map<string, Project>();

/**
 * Parse one file of a repo: its row and its outgoing imports, exactly as parseRepo would give them
 * (same resolver, same rules). An import counts when its target is a source file on disk now.
 * Returns null when the file is gone or is not a source file parseRepo would load.
 * ponytail: the tsconfig is read once per root; restart the process after changing its paths.
 */
export function parseFile(root: string, path: string): { file: ParsedFile; imports: ParsedImport[] } | null {
  const absRoot = resolve(root);
  const abs = join(absRoot, path);
  const toPath = (p: string) => relative(absRoot, p).split(sep).join("/");
  if (!isSourcePath(toPath(abs)) || !existsSync(abs)) return null;

  let project = projects.get(absRoot);
  if (!project) projects.set(absRoot, (project = createProject(absRoot)));
  const sf = project.addSourceFileAtPath(abs);
  try {
    sf.refreshFromFileSystemSync();
    // The resolver checks the disk itself, so a target counts while it exists, as in a full parse.
    return parseSource(sf, toPath, resolverFor(project, absRoot), (to) => isSourcePath(to));
  } finally {
    project.removeSourceFile(sf);
  }
}

/** Plain code-unit comparison, not localeCompare: the order must not depend on the machine's locale. */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** A file's row and its merged import edges (one per target, sorted by target). */
function parseSource(
  sf: SourceFile,
  toPath: (abs: string) => string,
  resolveTarget: (sf: SourceFile, literal: StringLiteral) => string | undefined,
  isKnown: (path: string) => boolean,
): { file: ParsedFile; imports: ParsedImport[] } {
  const from = sf.getFilePath();
  const path = toPath(from);
  const text = sf.getFullText();
  const file: ParsedFile = { path, lang: langOf(path), loc: countLines(text), hash: createHash("sha1").update(text).digest("hex") };

  const edges = new Map<string, ParsedImport>();
  for (const s of statementsOf(sf)) {
    const target = resolveTarget(sf, s.literal);
    const to = target ? toPath(target) : undefined;
    if (!to || to === path || !isKnown(to)) continue;
    const edge = edges.get(to);
    if (edge) {
      edge.specifiers = [...new Set([...edge.specifiers, ...s.names])].sort();
      edge.typeOnly &&= s.typeOnly;
    } else {
      edges.set(to, { from: path, to, specifiers: [...new Set(s.names)].sort(), typeOnly: s.typeOnly });
    }
  }
  return { file, imports: [...edges.values()].sort((a, b) => cmp(a.to, b.to)) };
}

/**
 * The compiler's own module resolution with the repo's compiler options and the same per-import
 * mode a program would use, so path aliases like `@lib/*` resolve exactly as `tsc` resolves them,
 * `./x.js` maps to `x.ts` and `./dir` to `dir/index.ts`. No type checker, so it is fast.
 * A fresh cache per call: files come and go between single-file parses.
 */
function resolverFor(project: Project, absRoot: string) {
  const options = project.getCompilerOptions();
  const cache = ts.createModuleResolutionCache(absRoot, (f) => f, options);
  return (sf: SourceFile, literal: StringLiteral): string | undefined => {
    const mode = ts.getModeForUsageLocation(sf.compilerNode, literal.compilerNode, options);
    return ts.resolveModuleName(literal.getLiteralValue(), sf.getFilePath(), options, ts.sys, cache, undefined, mode).resolvedModule
      ?.resolvedFileName;
  };
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
    return { literal: d.getModuleSpecifier(), typeOnly: d.isTypeOnly() || allNamedAreTypes, names };
  });

  const reExports = sf
    .getExportDeclarations()
    .flatMap((d) => {
      const literal = d.getModuleSpecifier();
      if (literal === undefined) return [];
      const named = d.getNamedExports();
      const typeOnly = d.isTypeOnly() || (named.length > 0 && named.every((n) => n.isTypeOnly()));
      return [{ literal, typeOnly, names: d.hasNamedExports() ? named.map((n) => n.getName()) : ["*"] }];
    });

  const dynamic = sf
    .getDescendantsOfKind(ts.SyntaxKind.CallExpression)
    .filter((c) => c.getExpression().getKind() === ts.SyntaxKind.ImportKeyword)
    .map((c) => c.getArguments()[0])
    .filter((arg): arg is StringLiteral => arg !== undefined && Node.isStringLiteral(arg))
    .map((literal) => ({ literal, typeOnly: false, names: ["*"] }));

  return [...imports, ...reExports, ...dynamic];
}

function isSkipped(path: string): boolean {
  // A leading dot also covers "..": a path outside the root.
  return path.split("/").some((p) => SKIP_DIRS.includes(p) || p.startsWith("."));
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
