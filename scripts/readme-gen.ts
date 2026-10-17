// Rebuilds the generated parts of README.md from the source of truth. Usage: npm run readme
//   <!-- cypher:start --> ... <!-- cypher:end -->   the query texts in packages/core/src/queries
//   <!-- bench:start --> ... <!-- bench:end -->     bench/results.json, and bench/pairs.json when it exists
//   <!-- quickstart:start --> ... <!-- quickstart:end -->   the Quick start section, written below
//   <!-- install:start --> ... <!-- install:end -->         the Install section, written below
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
  const [conflict, claims, blast, schedule, hubs, why, brief, search, history] = await Promise.all(
    ["conflict", "claims", "blast", "schedule", "hubs", "why", "brief", "search", "history"].map(load),
  );
  const fn = (mod: Mod, file: string, name: string) => need<(k: number) => string>(mod, file, name);
  const str = (mod: Mod, file: string, name: string) => need<string>(mod, file, name);

  return [
    {
      title: "Conflict",
      call: `conflictQuery(${K})`,
      file: "conflict",
      text: fn(conflict!, "conflict", "conflictQuery")(K),
      what: "For each file an agent asks for, find another agent's live claim on the same file (SAME), on a file it imports within 3 hops (UPSTREAM), or on a file that imports it within 3 hops (DOWNSTREAM). The path comes back with the row. `SB_HOPS` sets the hop limit (1 to 5). A path may not run through a hub or use an `import type` edge; `SB_TYPE_IMPORTS=1` counts type-only imports again.",
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
      what: "Every file that imports the changed file within 3 hops (`SB_HOPS`), with its nearest hop count and the agents that hold a live claim on it. Zero rows means nothing depends on it. Type-only importers count here: a changed type breaks them at compile time.",
      lock: "it has no idea who depends on a file.",
    },
    {
      title: "Interference between tasks",
      call: `interfereQuery(${K})`,
      file: "schedule",
      text: fn(schedule!, "schedule", "interfereQuery")(K),
      what: "For every pair of unfinished tasks, find the closest connection between their files: the same file, or an import path within 3 hops either way, with the conflict check's hub and type-only rules. It is a read query: the scheduler colours its rows and stores nothing.",
      lock: "a lock exists only once an agent starts editing. This compares tasks before anyone has claimed anything.",
    },
    {
      title: "Rounds: tasks that can run at once",
      call: "TASK_FOOTPRINTS",
      file: "schedule",
      text: str(schedule!, "schedule", "TASK_FOOTPRINTS"),
      what: "Every unfinished task's files, planned and claimed. `parallelBatches` passes them to the interference query above, then colours the interference graph: the task with the most interfering tasks goes first, and each task takes the lowest round none of them holds. Tasks in one round can run at the same time; round 0 runs first. On a chain where A touches B and B touches C, A and C share a round. One weakly connected component per batch, the old rule, ran all three in turn. Reading the rounds writes nothing to the graph.",
      lock: "it tells you who is waiting, not which tasks could never have collided.",
    },
    {
      title: "Hubs (PageRank)",
      call: "MARK_HUBS",
      file: "hubs",
      text: str(hubs!, "hubs", "MARK_HUBS"),
      what: "PageRank over `IMPORTS`, then a flag on heavily imported files (`lib/utils.ts` in the demo repo). A conflict path may not pass through a flagged file, so a shared helper that imports other code cannot chain all its callers into one conflict. In the demo repo `lib/utils.ts` imports nothing, so the rule changes no result there. We measured it against `algo.betweenness`; the numbers are under Limits.",
      lock: "it cannot tell a file everyone imports from a file two agents really share, so a path through it would look like a dependency.",
    },
    {
      title: "Memory search (full-text)",
      call: "SEARCH_DECISIONS",
      file: "search",
      text: str(search!, "search", "SEARCH_DECISIONS"),
      what: "The full-text index on `Decision(text, why)`, so a word that only appears in the reason still finds the decision, with the files it affects. `SEARCH_LESSONS` does the same over `Lesson(text)`. The agent's words are cut to plain words joined by OR before they reach the index. `brief_me` with `about` and the `search_memory` tool use it.",
      lock: "it holds names and owners, no text to search.",
    },
    {
      title: "Refusal hotspots",
      call: "HOTSPOTS",
      file: "history",
      text: str(history!, "history", "HOTSPOTS"),
      what: "Every refusal is an `Event` linked by `VIA` to each file on its import path. This ranks the files that sat on the most refused paths since `$since`, including files in the middle of a path that nobody asked for.",
      lock: "it forgets a refusal as soon as it answers it.",
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
  without: { brokenBuilds: number; editsApplied?: number };
  with: { brokenBuilds: number; blocked: number; caught?: number; editsApplied?: number };
  checkMsMedian: number;
  checkMsMin?: number;
  checkMsMax?: number;
  claim?: { agent: string; file: string };
  edit?: { agent: string; file: string };
  conflict?: { type: string; hops: number; path: string[] };
  baselineOk?: boolean;
  aAloneOk?: boolean;
  bAloneOk?: boolean;
  mergedOk?: boolean;
  mergedError?: string;
  tsc?: string;
  node?: string;
  ranAt?: string;
  loadAvg1m?: number;
  cpus?: number;
}

interface Census {
  dir?: string;
  files: number;
  pairs: number;
  lock: number;
  oneHop: number;
  graph: number;
  hidden: number;
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
  const b = r.edit?.agent ?? "B";

  const landed = r.without.editsApplied !== undefined ? ` ${b}'s edit landed in ${r.without.editsApplied} / ${r.n} runs.` : "";
  const caught = r.with.caught !== undefined ? ` ${b}'s own \`tsc\` caught the clash ${r.with.caught} / ${r.n} times.` : "";
  const withLanded = r.with.editsApplied !== undefined ? ` ${b}'s edit landed in ${r.with.editsApplied} / ${r.n} runs.` : "";
  lines.push(
    "| | Broken builds | What happened |",
    "|---|---|---|",
    `| Without Switchboard | ${r.without.brokenBuilds} / ${r.n} |${landed || " not asked"} |`,
    `| With Switchboard | ${r.with.brokenBuilds} / ${r.n} | ${b}'s claim was refused ${r.with.blocked} / ${r.n} times.${caught}${withLanded} |`,
    "",
  );
  if (r.claim && r.edit) {
    const via = r.conflict ? ` The refusal: ${r.conflict.type}, ${r.conflict.hops} hops, ${r.conflict.path.join(" → ")}.` : "";
    lines.push(`- Agent ${r.claim.agent} holds \`${r.claim.file}\`. Agent ${r.edit.agent} edits \`${r.edit.file}\`.${via}`);
  }
  if (r.baselineOk && r.aAloneOk && r.bAloneOk) {
    const merged = r.mergedOk === false && r.mergedError ? ` Merged, \`tsc\` fails: \`${r.mergedError}\`` : "";
    lines.push(`- The untouched repo, A's edit alone and B's edit alone all pass \`tsc\`.${merged}`);
  }
  const range = r.checkMsMin !== undefined && r.checkMsMax !== undefined ? ` (range ${ms(r.checkMsMin)} to ${ms(r.checkMsMax)} ms)` : "";
  const load = r.loadAvg1m !== undefined ? ` The machine was busy: 1-minute load average ${r.loadAvg1m}${r.cpus ? ` on ${r.cpus} cores` : ""}.` : "";
  lines.push(
    `- The conflict check (\`findConflicts\`, one FalkorDB query from Node) took a median of ${ms(r.checkMsMedian)} ms${range} over ${r.n} runs.${load}`,
  );
  const ran = [r.ranAt?.slice(0, 10), r.tsc && `TypeScript ${r.tsc.replace(/^Version\s+/, "")}`, r.node && `Node ${r.node}`]
    .filter(Boolean)
    .join(", ");
  if (ran) lines.push(`- Last run: ${ran}.`);

  const pairs = readJson<{ demo?: Census; real?: Census }>("bench/pairs.json");
  if (pairs?.demo) {
    lines.push(
      "",
      "Pair census, one query over the parsed import graph (`npm run pairs`). A pair is two different files, counted once. A file lock collides only on the same path, so by definition it catches none of them:",
      "",
      "| Repo | Files | Pairs | Caught by a file lock | 1 hop | Within 3 hops | 2 to 3 hops (missed by a one-hop check) |",
      "|---|---|---|---|---|---|---|",
    );
    const row = (fallback: string, c: Census) =>
      `| \`${c.dir ?? fallback}/\` | ${c.files} | ${c.pairs} | ${c.lock} | ${c.oneHop} | ${c.graph} | ${c.hidden} |`;
    lines.push(row("demo-repo", pairs.demo));
    if (pairs.real) lines.push(row("apps/web", pairs.real));
  }
  return lines.join("\n");
}

// ---- quick start -------------------------------------------------------------------------------

/** The two commands a new reader needs, right under the link row. Kept here so a hand edit is not lost. */
function quickstartBlock(): string {
  return [
    "## Quick start",
    "",
    "You need Node 22 or newer and Docker (Docker Desktop or OrbStack). The editor hooks also need `jq`.",
    "",
    "```bash",
    "git clone https://github.com/bhargava-gumpula/graph-hacks.git && cd graph-hacks",
    "npm run quickstart",
    "```",
    "",
    "That is all. It reuses a FalkorDB that already answers on port 6379, or starts one with `docker compose up -d`. Then it installs packages if `node_modules` is missing, creates `.env` from `.env.example`, parses `demo-repo`, builds the web app, starts the server and opens http://localhost:8787/app?tour=1. Run it again any time: finished steps are skipped. `npm run quickstart -- --dry-run` prints the plan and changes nothing; `--no-open` skips the browser.",
    "",
    "**Use it on your own repo:**",
    "",
    "```bash",
    "npm run switchboard -- init ~/code/my-app",
    "```",
    "",
    "`init` merges the Switchboard hooks into the repo's `.claude/settings.json` and `.cursor/hooks.json` and adds the MCP server to `.mcp.json`. Other settings stay, and the first change keeps the original as `.bak`. It parses the repo into its own graph (`sb_my_app`) with its own server port (8870 here, fixed by the name), and the hooks post only to that port. So the quickstart demo can keep running on 8787 and never sees this repo's claims. Then start that repo's server with `SERVER_PORT=8870 SB_GRAPH=sb_my_app npm run server` and open http://localhost:8870/app; `init` prints both lines. Until that server runs, the hooks fall back to the CLI on the same graph. Running it twice changes nothing. `--dry-run` prints the diff.",
  ].join("\n");
}

// ---- install -----------------------------------------------------------------------------------

/** Cursor's MCP install link: the server config as base64 JSON (https://cursor.com/docs/context/mcp/install-links). */
export const CURSOR_MCP_CONFIG = {
  command: "npx",
  args: ["-y", "switchboard-agents", "mcp"],
  env: { SB_EDITOR: "cursor", SB_PROJECT_DIR: "${workspaceFolder}" },
};
export const CURSOR_INSTALL_URL = `https://cursor.com/install-mcp?name=switchboard&config=${Buffer.from(
  JSON.stringify(CURSOR_MCP_CONFIG),
).toString("base64")}`;

/** How to install Switchboard without cloning this repo. Details and doc links: docs/INSTALL.md. */
function installBlock(): string {
  return [
    "## Install",
    "",
    "Switchboard needs Node 22 or newer and a FalkorDB it can reach. One command starts FalkorDB locally:",
    "",
    "```bash",
    "docker run -d -p 6379:6379 falkordb/falkordb",
    "```",
    "",
    "After that the agents never have to be told to use it. Hooks claim every edit, refuse one that collides with another agent's work, record it, and release the claims when the session ends. Each repo gets its own graph, `sb_<repo name>`, shared by all its worktrees.",
    "",
    "**Claude Code (plugin: hooks, MCP server and a skill).** In Claude Code:",
    "",
    "```",
    "/plugin marketplace add bhargava-gumpula/graph-hacks",
    "/plugin install switchboard@switchboard",
    "```",
    "",
    "**Cursor.** The button adds the MCP server. The hooks that claim each edit come from `init`, run in your repo (a global install keeps the hook path stable):",
    "",
    `[![Add switchboard MCP server to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](${CURSOR_INSTALL_URL})`,
    "",
    "```bash",
    "npm i -g switchboard-agents && switchboard init --cursor",
    "```",
    "",
    "**npm (any MCP client).** After `npm i -g switchboard-agents`, `switchboard init` in a repo wires both Cursor and Claude Code. For another client, run `switchboard-mcp` (or `npx -y switchboard-agents mcp`) as a stdio MCP server from the repo.",
    "",
    "**From source.** The quick start below runs the demo and the live dashboard. [docs/INSTALL.md](docs/INSTALL.md) has every option, the settings and the limits.",
  ].join("\n");
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
let after = splice(before, "install", installBlock());
after = splice(after, "quickstart", quickstartBlock());
after = splice(after, "cypher", await cypherBlock());
after = splice(after, "bench", benchBlock());
if (after !== before) writeFileSync(README, after);
console.log(after === before ? "README.md is up to date" : "README.md updated");
