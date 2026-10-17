// Rebuilds the generated parts of README.md from the source of truth. Usage: npm run readme
//   <!-- cypher:start --> ... <!-- cypher:end -->   the query texts in packages/core/src/queries
//   <!-- bench:start --> ... <!-- bench:end -->     bench/results.json, and bench/pairs.json when it exists
// Idempotent: a second run changes nothing. It needs no database; it only imports the query strings.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const README = resolve(ROOT, "README.md");
const K = 3;

type Mod = Record<string, unknown>;

/** One exported name from one query module, or a clear failure. No copies of query text live here. */
function need<T>(mod: Mod, file: string, name: string): T {
  if (mod[name] === undefined) {
    throw new Error(`readme-gen: packages/core/src/queries/${file}.ts does not export ${name}. Merge the core package (N3) first.`);
  }
  return mod[name] as T;
}

interface Entry {
  title: string;
  call: string;
  file: string;
  text: string;
  what: string;
  lock: string;
}

async function entries(): Promise<Entry[]> {
  const load = (file: string) => import(`../packages/core/src/queries/${file}.js`) as Promise<Mod>;
  const [conflict, claims, blast, schedule, hubs, why, brief] = await Promise.all(
    ["conflict", "claims", "blast", "schedule", "hubs", "why", "brief"].map(load),
  );
  const fn = (mod: Mod, file: string, name: string) => need<(k: number) => string>(mod, file, name);
  const str = (mod: Mod, file: string, name: string) => need<string>(mod, file, name);

  return [
    {
      title: "Conflict",
      call: `conflictQuery(${K})`,
      file: "conflict",
      text: fn(conflict!, "conflict", "conflictQuery")(K),
      what: "For each file an agent asks for, find another agent's live claim on the same file (SAME), on a file it imports within 3 hops (UPSTREAM), or on a file that imports it within 3 hops (DOWNSTREAM). The path comes back with the row.",
      lock: "it compares names, so `LoginForm.tsx` and `session.ts` never meet. Here the import path is the answer.",
    },
    {
      title: "Conflict guard",
      call: `conflictGuard(${K})`,
      file: "conflict",
      text: fn(conflict!, "conflict", "conflictGuard")(K),
      what: "The same three checks as a prefix for a write. It yields one row when nothing conflicts and no rows otherwise, so whatever follows runs only when the claim is free.",
      lock: "its atomic step covers one name. This one covers every file within 3 import hops of the request.",
    },
    {
      title: "Claim: check and write in one query",
      call: `claimQuery(${K})`,
      file: "claims",
      text: fn(claims!, "claims", "claimQuery")(K),
      what: "The guard, then the write: the agent, its task, the `CLAIMS` edges and the `claim` event with the next `seq`. FalkorDB runs the write queries of one graph one at a time, so two racing claims cannot both pass the check.",
      lock: "it can make set-if-free atomic for a name, but it cannot put an import-path check in the same step.",
    },
    {
      title: "Blast radius",
      call: `blastQuery(${K})`,
      file: "blast",
      text: fn(blast!, "blast", "blastQuery")(K),
      what: "Every file that imports the changed file within 3 hops, with its nearest hop count and the agents that hold a live claim on it. Zero rows means nothing depends on it.",
      lock: "it has no idea who depends on a file.",
    },
    {
      title: "Interference between tasks",
      call: `interfereQuery(${K})`,
      file: "schedule",
      text: fn(schedule!, "schedule", "interfereQuery")(K),
      what: "For every pair of unfinished tasks, find the closest connection between their files: the same file, or an import path within 3 hops either way. The scheduler writes each row as an `INTERFERES` edge.",
      lock: "a lock exists only once an agent starts editing. This compares tasks before anyone has claimed anything.",
    },
    {
      title: "Parallel batches (WCC)",
      call: "WCC_BATCHES",
      file: "schedule",
      text: str(schedule!, "schedule", "WCC_BATCHES"),
      what: "Weakly connected components over the `INTERFERES` edges. Tasks in one component run one after another. Different components can run at the same time.",
      lock: "it tells you who is waiting, not which tasks could never have collided.",
    },
    {
      title: "Hubs (PageRank)",
      call: "MARK_HUBS",
      file: "hubs",
      text: str(hubs!, "hubs", "MARK_HUBS"),
      what: "PageRank over `IMPORTS`, then a flag on the files everything imports (`lib/utils.ts` in the demo repo). Paths that run through a flagged file are ignored.",
      lock: "it cannot tell a file everyone imports from a file two agents really share, so a path through it would look like a dependency.",
    },
    {
      title: "Why",
      call: "WHY_TRACE",
      file: "why",
      text: str(why!, "why", "WHY_TRACE"),
      what: "From a file back through its edits to the agent, the task, the decision that caused the task, and the newest decision that replaced it.",
      lock: "it forgets the claim when it is released. This is the history.",
    },
    {
      title: "Briefing neighbourhood",
      call: "NEAR_FILES",
      file: "brief",
      text: str(brief!, "brief", "NEAR_FILES"),
      what: "The files within 2 imports of the area an agent is about to touch, in either direction. The briefing reads claims, decisions and lessons on exactly that set.",
      lock: "it can list who holds what, not what the neighbours of a file have learned.",
    },
  ];
}

const fence = (code: string) => "```cypher\n" + code.trim() + "\n```";

async function cypherBlock(): Promise<string> {
  const parts = (await entries()).map(
    (e) =>
      `### ${e.title}\n\n` +
      `\`${e.call}\` in [\`packages/core/src/queries/${e.file}.ts\`](packages/core/src/queries/${e.file}.ts). ${e.what}\n\n` +
      `Why a lock table cannot do this: ${e.lock}\n\n` +
      fence(e.text),
  );
  return parts.join("\n\n");
}

// ---- benchmark -------------------------------------------------------------------------------

interface Results {
  n: number;
  without: { brokenBuilds: number };
  with: { brokenBuilds: number; blocked: number };
  checkMsMedian: number;
  checkMsMin?: number;
  checkMsMax?: number;
  claim?: { agent: string; file: string };
  edit?: { agent: string; file: string };
  baselineOk?: boolean;
  aAloneOk?: boolean;
  bAloneOk?: boolean;
  tsc?: string;
  node?: string;
  ranAt?: string;
}

interface Census {
  files: number;
  pairs: number;
  lock: number;
  oneHop: number;
  graph: number;
  hidden: number;
  ms?: number;
}

const ms = (x: number) => x.toFixed(2);

function readJson<T>(rel: string): T | null {
  const file = resolve(ROOT, rel);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null;
}

function benchBlock(): string {
  const r = readJson<Results>("bench/results.json");
  if (!r) throw new Error("readme-gen: bench/results.json is missing. Run `npm run bench` first.");
  const lines: string[] = [];

  const ran = [r.ranAt?.slice(0, 10), r.tsc && `TypeScript ${r.tsc.replace(/^Version\s+/, "")}`, r.node && `Node ${r.node}`]
    .filter(Boolean)
    .join(", ");
  lines.push(
    "| | Broken builds | Edit refused by the graph |",
    "|---|---|---|",
    `| Without Switchboard | ${r.without.brokenBuilds} / ${r.n} | not asked |`,
    `| With Switchboard | ${r.with.brokenBuilds} / ${r.n} | ${r.with.blocked} / ${r.n} |`,
    "",
  );
  if (r.claim && r.edit) {
    lines.push(`- Agent ${r.claim.agent} holds \`${r.claim.file}\`. Agent ${r.edit.agent} edits \`${r.edit.file}\`.`);
  }
  if (r.baselineOk && r.aAloneOk && r.bAloneOk) {
    lines.push(
      `- The untouched repo, A's edit alone and B's edit alone all pass \`tsc\`. Merged, the build failed in ${r.without.brokenBuilds} of ${r.n} runs without Switchboard.`,
    );
  }
  const range = r.checkMsMin !== undefined && r.checkMsMax !== undefined ? ` (range ${ms(r.checkMsMin)} to ${ms(r.checkMsMax)} ms)` : "";
  lines.push(`- The conflict check took a median of ${ms(r.checkMsMedian)} ms${range} over ${r.n} runs, timed around \`findConflicts\`, which includes the round trip to FalkorDB.`);
  if (ran) lines.push(`- Last run: ${ran}.`);

  const pairs = readJson<{ demo?: Census; real?: Census }>("bench/pairs.json");
  if (pairs?.demo) {
    lines.push("", "Pair census, computed by one query over the parsed import graph (`npx tsx scripts/pairs.ts`):", "");
    lines.push("| Repo | Files | File pairs | Caught by a file lock | One import apart | Within 3 imports | Hidden from a one-hop check |", "|---|---|---|---|---|---|---|");
    const row = (label: string, c: Census) =>
      `| ${label} | ${c.files} | ${c.pairs} | ${c.lock} | ${c.oneHop} | ${c.graph} | ${c.hidden} |`;
    lines.push(row("`demo-repo/`", pairs.demo));
    if (pairs.real) lines.push(row("`apps/web/src/`", pairs.real));
  }
  return lines.join("\n");
}

// ---- splice into README ----------------------------------------------------------------------

function splice(text: string, name: string, body: string): string {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  if (a === -1 || b === -1 || b < a) throw new Error(`readme-gen: README.md needs ${start} and ${end} markers.`);
  return text.slice(0, a + start.length) + "\n\n" + body + "\n\n" + text.slice(b);
}

const before = readFileSync(README, "utf8");
let after = splice(before, "cypher", await cypherBlock());
after = splice(after, "bench", benchBlock());
if (after !== before) writeFileSync(README, after);
console.log(after === before ? "README.md is up to date" : "README.md updated");
