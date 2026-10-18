import type { SbGraph } from "../graph.js";

/** Range index: file lookups by repo-relative path. */
export const INDEX_FILE_PATH = "CREATE INDEX FOR (f:File) ON (f.path)";

/** Range index: agent lookups by id (usually the branch name). */
export const INDEX_AGENT_ID = "CREATE INDEX FOR (a:Agent) ON (a.id)";

/** Range index: task lookups by id. */
export const INDEX_TASK_ID = "CREATE INDEX FOR (t:Task) ON (t.id)";

/** Range index: the event bus reads `seq > $last`. */
export const INDEX_EVENT_SEQ = "CREATE INDEX FOR (e:Event) ON (e.seq)";

/** Range index: decision lookups by id. */
export const INDEX_DECISION_ID = "CREATE INDEX FOR (d:Decision) ON (d.id)";

/** Edge range index: active claims are `until > $now`. */
export const INDEX_CLAIMS_UNTIL = "CREATE INDEX FOR ()-[c:CLAIMS]-() ON (c.until)";

/**
 * Full-text index on Decision `text` and `why`.
 * PLAN §3 writes `CALL db.idx.fulltext.createNodeIndex('Decision', 'text', 'why')`.
 * FalkorDB 6.0.2 rejects that call ("expected at most 1 argument").
 * `CREATE FULLTEXT INDEX` is the statement this server accepts, and the
 * one the falkordb client emits for the same properties.
 */
export const INDEX_DECISION_FULLTEXT =
  "CREATE FULLTEXT INDEX FOR (d:Decision) ON (d.text, d.why)";

/** Full-text index on Lesson `text`. Same syntax note as the Decision index. search.ts queries both. */
export const INDEX_LESSON_FULLTEXT = "CREATE FULLTEXT INDEX FOR (l:Lesson) ON (l.text)";

/**
 * The seq counter. The next event write does `SET m.value = m.value + 1`
 * in the same query as the Event node, so the number cannot gap.
 */
export const SEQ_COUNTER = "MERGE (m:Meta {key:'seq'}) ON CREATE SET m.value = 0";

const INDEXES = [
  INDEX_FILE_PATH,
  INDEX_AGENT_ID,
  INDEX_TASK_ID,
  INDEX_EVENT_SEQ,
  INDEX_DECISION_ID,
  INDEX_CLAIMS_UNTIL,
  INDEX_DECISION_FULLTEXT,
  INDEX_LESSON_FULLTEXT,
];

/** Bump when INDEXES changes, so every graph runs the new statements once. */
export const SCHEMA_VERSION = 1;

/** The marker ensureSchema leaves once a graph has every index: one read instead of nine writes. */
export const SCHEMA_MARKER = "MATCH (m:Meta {key:'schema'}) RETURN m.version AS version";
export const SET_SCHEMA_MARKER = "MERGE (m:Meta {key:'schema'}) SET m.version = $version";

function alreadyIndexed(err: unknown): boolean {
  return err instanceof Error && err.message.includes("already indexed");
}

/**
 * Create indexes and the seq counter, once per graph: a graph marked with this SCHEMA_VERSION costs one read.
 * Safe to call again. (Events MERGE the seq counter themselves, so nothing breaks before this has run.)
 */
export async function ensureSchema(g: SbGraph): Promise<void> {
  try {
    const [row] = await g.roQuery(SCHEMA_MARKER);
    if (row?.version === SCHEMA_VERSION) return;
  } catch {
    // a graph that does not exist yet: create it below
  }
  for (const cypher of INDEXES) {
    try {
      await g.query(cypher);
    } catch (err) {
      if (!alreadyIndexed(err)) throw err;
    }
  }
  await g.query(SEQ_COUNTER);
  await g.query(SET_SCHEMA_MARKER, { version: SCHEMA_VERSION });
}
