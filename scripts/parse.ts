// Parse a repo into the code graph. Usage: npm run parse -- <dir>   (default: demo-repo)
// Graph: SB_GRAPH (default sb_demo). FalkorDB: FALKORDB_URL (default redis://localhost:6379).
import { resolve } from "node:path";
import { codeGraphCounts, connect, ensureSchema, loadParse, parseRepo } from "../packages/core/src/index.js";

const dir = resolve(process.argv[2] ?? "demo-repo");
const started = Date.now();
const parsed = parseRepo(dir);
const parsedMs = Date.now() - started;

const g = await connect();
try {
  await ensureSchema(g);
  await loadParse(g, parsed);
  const counts = await codeGraphCounts(g);
  console.log(
    `${dir} → graph ${g.name}: ${parsed.files.length} files, ${parsed.imports.length} imports parsed in ${parsedMs} ms; ` +
      `graph now holds ${counts.files} files, ${counts.imports} imports (${Date.now() - started} ms total)`,
  );
} finally {
  await g.close();
}
