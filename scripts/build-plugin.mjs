/* global console */
// Bundle Switchboard into single-file Node scripts for the Claude Code plugin and the npm package.
//   switchboard.mjs      the CLI (parse needs ts-morph, so this one carries the TypeScript compiler)
//   switchboard-mcp.mjs  the stdio MCP server
//   hook.mjs             the editor hook (no parser, no Anthropic SDK: it starts on every edit)
// Output: plugins/switchboard/dist (committed, so a marketplace install needs no npm install) and
// packages/npm/dist (built on `npm pack`). Usage: node scripts/build-plugin.mjs
import { cpSync, mkdirSync, rmSync, statSync } from "node:fs";
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

const [primary, ...copies] = outs;
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
for (const dir of copies) {
  rmSync(dir, { recursive: true, force: true });
  cpSync(primary, dir, { recursive: true });
}
console.log(`built ${outs.map((o) => o.slice(root.length + 1)).join(" and ")}`);
