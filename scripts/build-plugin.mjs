/* global console, process */
// Bundle Switchboard into single-file Node scripts for the Claude Code plugin and the npm package.
//   switchboard.mjs      the CLI (parse needs ts-morph, so this one carries the TypeScript compiler)
//   switchboard-mcp.mjs  the stdio MCP server
//   hook.mjs             the editor hook (no parser, no Anthropic SDK: it starts on every edit)
// Output: plugins/switchboard/dist (committed, so a marketplace install needs no npm install) and
// packages/npm/dist (built on `npm pack`). Usage: node scripts/build-plugin.mjs [--check]
//   --check builds to a temp dir and exits 1 if the committed plugin bundles differ (stale after a core change).
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const root = join(import.meta.dirname, "..");
const outs = [join(root, "plugins/switchboard/dist"), join(root, "packages/npm/dist")];

// ESM bundles of CommonJS deps (ts-morph, the Redis client) need require, __filename and __dirname.
const banner = [
  'import { createRequire as __sbRequire } from "node:module";',
  'import { fileURLToPath as __sbPath } from "node:url";',
  'import { dirname as __sbDir } from "node:path";',
  "const require = __sbRequire(import.meta.url);",
  "const __filename = __sbPath(import.meta.url);",
  "const __dirname = __sbDir(__filename);",
].join("\n");

/** Replace a dependency the bundle never calls with a tiny module, to keep it small. */
const stub = (modules) => ({
  name: "stub",
  setup(b) {
    const filter = new RegExp(`^(${modules.map((m) => m.replace(/[/@.-]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter }, (args) => ({ path: args.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export default class {}; export const Node = {}, Project = class {}, ts = {};",
      loader: "js",
    }));
  },
});

const entries = [
  { src: "packages/npm/src/cli.ts", out: "switchboard.mjs", stubs: [] },
  { src: "packages/npm/src/mcp.ts", out: "switchboard-mcp.mjs", stubs: ["ts-morph"] },
  { src: "packages/npm/src/hook.ts", out: "hook.mjs", stubs: ["ts-morph", "@anthropic-ai/sdk"] },
];

const check = process.argv.includes("--check");
const [primary, ...copies] = check ? [mkdtempSync(join(tmpdir(), "sb-plugin-"))] : outs;
rmSync(primary, { recursive: true, force: true });
mkdirSync(primary, { recursive: true });
for (const e of entries) {
  await build({
    entryPoints: [join(root, e.src)],
    outfile: join(primary, e.out),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    minify: true,
    legalComments: "eof",
    banner: { js: banner },
    plugins: e.stubs.length ? [stub(e.stubs)] : [],
    logLevel: "warning",
  });
  console.log(`${e.out} ${(statSync(join(primary, e.out)).size / 1024).toFixed(0)} KB`);
}
if (check) {
  const stale = entries.filter((e) => {
    try {
      return !readFileSync(join(primary, e.out)).equals(readFileSync(join(outs[0], e.out)));
    } catch {
      return true;
    }
  });
  rmSync(primary, { recursive: true, force: true });
  if (stale.length > 0) {
    console.error(`stale: ${stale.map((e) => e.out).join(", ")}. Run npm run build:plugin and commit plugins/switchboard/dist.`);
    process.exit(1);
  }
  console.log("plugins/switchboard/dist is up to date");
  process.exit(0);
}
for (const dir of copies) {
  rmSync(dir, { recursive: true, force: true });
  cpSync(primary, dir, { recursive: true });
}
console.log(`built ${outs.map((o) => o.slice(root.length + 1)).join(" and ")}`);
