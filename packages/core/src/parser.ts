import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { Project, type SourceFile } from "ts-morph";

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
  /** Imported names (`default`, `* as x` and named), merged across statements. */
  specifiers: string[];
  /** True only if every statement for this pair is `import type` / `export type`. */
  typeOnly: boolean;
}

export interface ParseResult {
  files: ParsedFile[];
  imports: ParsedImport[];
}

const SOURCE_GLOBS = ["**/*.{ts,tsx,js,jsx}", "!**/node_modules/**", "!**/dist/**", "!**/*.d.ts"];

/**
 * Parse a TS/JS repo into files and file→file import edges.
 * The repo's tsconfig.json (if any) is loaded only for its compiler options, so
 * path aliases like `@lib/*` resolve exactly as `tsc` resolves them. Files are
 * added by glob, so files the tsconfig doesn't include are still parsed.
 * Imports that resolve outside `root` (packages, node built-ins) are dropped.
 */
export function parseRepo(root: string): ParseResult {
  const tsConfigFilePath = join(root, "tsconfig.json");
  const project = existsSync(tsConfigFilePath)
    ? new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: true })
    : new Project({ compilerOptions: { allowJs: true } });
  project.addSourceFilesAtPaths(SOURCE_GLOBS.map((g) => (g.startsWith("!") ? `!${join(root, g.slice(1))}` : join(root, g))));

  const toPath = (sf: SourceFile): string | undefined => {
    const rel = relative(root, sf.getFilePath());
    if (rel.startsWith("..") || rel.includes("node_modules")) return undefined;
    return rel.split(sep).join("/");
  };

  const files: ParsedFile[] = [];
  const edges = new Map<string, ParsedImport>();

  for (const sf of project.getSourceFiles()) {
    const path = toPath(sf);
    if (!path || sf.isDeclarationFile()) continue;
    const text = sf.getFullText();
    files.push({
      path,
      lang: sf.getExtension().slice(1) as ParsedFile["lang"],
      loc: text.split("\n").length,
      hash: createHash("sha1").update(text).digest("hex"),
    });

    const statements = [
      ...sf.getImportDeclarations().map((d) => ({
        target: d.getModuleSpecifierSourceFile(),
        typeOnly: d.isTypeOnly(),
        names: [
          ...(d.getDefaultImport() ? ["default"] : []),
          ...(d.getNamespaceImport() ? ["*"] : []),
          ...d.getNamedImports().map((n) => n.getName()),
        ],
      })),
      ...sf.getExportDeclarations().map((d) => ({
        target: d.getModuleSpecifierSourceFile(),
        typeOnly: d.isTypeOnly(),
        names: d.hasNamedExports() ? d.getNamedExports().map((n) => n.getName()) : ["*"],
      })),
    ];

    for (const s of statements) {
      const to = s.target ? toPath(s.target) : undefined;
      if (!to || to === path) continue;
      const key = `${path}\0${to}`;
      const edge = edges.get(key);
      if (edge) {
        edge.specifiers = [...new Set([...edge.specifiers, ...s.names])];
        edge.typeOnly &&= s.typeOnly;
      } else {
        edges.set(key, { from: path, to, specifiers: s.names, typeOnly: s.typeOnly });
      }
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  const imports = [...edges.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return { files, imports };
}
