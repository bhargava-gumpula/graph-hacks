import { afterAll, beforeAll } from "vitest";
import { connect, type SbGraph } from "./graph.js";
import { ensureSchema } from "./queries/schema.js";

/** FalkorDB's GRAPH.DELETE error when the key is already gone. */
const MISSING_GRAPH = "empty key";

/**
 * Connect to `sb_test_<file>`, delete it, and create the schema.
 * `beforeAll` and `afterAll` both delete, so a failed run can be re-run.
 */
export function useTestGraph(name: string): () => SbGraph {
  let graph: SbGraph | undefined;

  beforeAll(async () => {
    graph = await connect({ graph: name });
    await deleteIfExists(graph);
    await ensureSchema(graph);
  });

  afterAll(async () => {
    if (!graph) return;
    await deleteIfExists(graph);
    await graph.close();
  });

  return () => {
    if (!graph) throw new Error(`graph ${name} is not open`);
    return graph;
  };
}

async function deleteIfExists(graph: SbGraph): Promise<void> {
  try {
    await graph.drop();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes(MISSING_GRAPH)) throw err;
  }
}
