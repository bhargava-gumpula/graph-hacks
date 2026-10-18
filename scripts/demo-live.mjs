/* global process, console, fetch, AbortSignal, setTimeout */
// The live demo: Claude Code and Cursor on one repo, the graph in FalkorDB Cloud. See docs/DEMO-LIVE.md.
//   npm run demo:setup   once: ~/switchboard-demo (a git copy of demo-repo), hooks + MCP for both editors, parse
//                        (-- --allow-mcp also lets Claude Code call the switchboard MCP tools without asking)
//   npm run demo:start   the dashboard on http://localhost:8790/app (--no-open to skip the browser)
//   npm run demo:reset   a fresh take: the repo back to its committed state, no claims, waits or events
//   npm run demo:cursor  -- <file>: Cursor's side without the Cursor app, through its exact hook commands (--end: session end)
//   npm run demo:log     the last hook decisions (which editor, allow or deny, which file)
//   npm run demo:stop    stop the dashboard that start started
// The password stays in the git-ignored .env: every config names that file (SB_ENV_FILE) and SB_CLOUD=1, and
// core reads FALKORDB_CLOUD_* from it at run time. Run with tsx (the npm scripts do).
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { applyInit, planInit } from "../packages/cli/src/init.ts";
import { clearActivity, codeGraphCounts, connect, ensureSchema, loadParse, parseRepo } from "../packages/core/src/index.ts";

const ROOT = resolve(import.meta.dirname, "..");
const REPO = resolve(process.env.SB_DEMO_DIR ?? join(homedir(), "switchboard-demo"));
const GRAPH = "sb_demo_live";
const PORT = 8790;
const URL_APP = `http://localhost:${PORT}/app`;
const TAG = "demo-start";
const PID_FILE = join(tmpdir(), "switchboard-demo-live.pid");
const LOG_FILE = join(tmpdir(), "switchboard-demo-live.log");
const HOOK_LOG = process.env.SB_HOOK_LOG ?? join(tmpdir(), "switchboard-hook.log");

/** The one .env with FALKORDB_CLOUD_*: SB_ENV_FILE, else the main checkout's (a worktree has none of its own). */
function envFile() {
  if (process.env.SB_ENV_FILE) return resolve(process.env.SB_ENV_FILE);
  const common = git(ROOT, "rev-parse", "--path-format=absolute", "--git-common-dir");
  const file = join(common ? dirname(common) : ROOT, ".env");
  if (!existsSync(file)) throw new Error(`No ${file}. Put FALKORDB_CLOUD_HOST/PORT/USERNAME/PASSWORD there, or set SB_ENV_FILE.`);
  return file;
}

function git(dir, ...args) {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

function sh(dir, ...args) {
  const r = spawnSync("git", ["-C", dir, ...args], { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${dir}`);
}

/** Point this process at the cloud graph, like the hooks and the MCP servers. */
function useCloud() {
  Object.assign(process.env, { SB_ENV_FILE: envFile(), SB_CLOUD: "1", SB_GRAPH: GRAPH });
}

async function parse() {
  const g = await connect({ graph: GRAPH });
  try {
    await ensureSchema(g);
    await loadParse(g, parseRepo(REPO));
    const counts = await codeGraphCounts(g);
    console.log(`parsed ${REPO} into ${GRAPH} on ${g.location.where} (${g.location.host}): ${counts.files} files, ${counts.imports} imports`);
  } finally {
    await g.close();
  }
}

async function setup(allowMcp) {
  useCloud();
  if (existsSync(REPO)) {
    // Only ever replace a demo repo this script made.
    if (git(REPO, "rev-parse", "-q", "--verify", `refs/tags/${TAG}`) === undefined) {
      throw new Error(`${REPO} exists and is not a demo repo made by demo:setup. Move it, or set SB_DEMO_DIR.`);
    }
    rmSync(REPO, { recursive: true, force: true });
  }
  mkdirSync(REPO, { recursive: true });
  cpSync(join(ROOT, "demo-repo"), REPO, { recursive: true, filter: (src) => !src.endsWith("expected.json") });
  sh(REPO, "init", "-q", "-b", "main");
  sh(REPO, "add", "-A");
  sh(REPO, "-c", "user.name=Demo", "-c", "user.email=demo@example.com", "commit", "-qm", "Notes app");

  const plan = planInit(REPO, ROOT, { graph: GRAPH, port: PORT, env: { SB_ENV_FILE: process.env.SB_ENV_FILE, SB_CLOUD: "1" } });
  applyInit(plan);
  // Claude Code starts the project's switchboard MCP server without asking. Its tools still ask before each
  // call, unless --allow-mcp: then this git-ignored file also allows mcp__switchboard (that server's tools only).
  const local = join(REPO, ".claude/settings.local.json");
  const settings = JSON.parse(readFileSync(local, "utf8"));
  const permissions = allowMcp ? { permissions: { ...settings.permissions, allow: [...(settings.permissions?.allow ?? []), "mcp__switchboard"] } } : {};
  writeFileSync(local, `${JSON.stringify({ ...settings, enabledMcpjsonServers: ["switchboard"], ...permissions }, null, 2)}\n`);
  // The configs hold this machine's paths and the .env's path, never a secret; commit them so a reset keeps them.
  sh(REPO, "add", "-A");
  sh(REPO, "-c", "user.name=Demo", "-c", "user.email=demo@example.com", "commit", "-qm", "Wire Switchboard");
  sh(REPO, "tag", "-f", TAG);

  await parse();
  console.log(`
Ready. Claude Code is claude@main and Cursor is cursor@main, both in ${REPO}.${allowMcp ? "\nClaude Code may call the switchboard MCP tools without asking (--allow-mcp)." : ""}
  Dashboard:    npm run demo:start -- --no-open    then open ${URL_APP}
  Claude Code:  cd ${REPO} && claude
  Cursor:       cursor ${REPO}    (Settings > MCP: turn on switchboard once)`);
}

async function health() {
  try {
    const res = await fetch(`http://localhost:${PORT}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok ? await res.json() : { other: true };
  } catch (err) {
    return err?.cause?.code === "ECONNREFUSED" ? null : { other: true };
  }
}

function running() {
  try {
    const pid = Number(readFileSync(PID_FILE, "utf8"));
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

async function start(open) {
  useCloud();
  if (!existsSync(join(REPO, ".git"))) throw new Error(`No demo repo at ${REPO}. Run npm run demo:setup first.`);
  const h = await health();
  if (h && h.graph !== GRAPH) throw new Error(`Port ${PORT} is taken by something else. Stop it first.`);
  if (!h) {
    if (!existsSync(join(ROOT, "apps/web/dist/index.html"))) {
      spawnSync("npm", ["run", "build", "-w", "@switchboard/web"], { cwd: ROOT, stdio: "inherit" });
    }
    const env = { ...process.env, SERVER_PORT: String(PORT), SB_REPO: REPO, SB_WATCH: "1", SB_URL: `http://localhost:${PORT}` };
    delete env.SB_PUBLIC;
    const log = openSync(LOG_FILE, "a");
    const child = spawn(join(ROOT, "node_modules/.bin/tsx"), ["apps/server/src/index.ts"], { cwd: ROOT, env, detached: true, stdio: ["ignore", log, log] });
    writeFileSync(PID_FILE, String(child.pid));
    child.unref();
    for (let i = 0; i < 60 && !(await health()); i++) await new Promise((r) => setTimeout(r, 500));
  }
  const up = await health();
  if (!up?.ok) throw new Error(`The dashboard did not come up. See ${LOG_FILE}`);
  console.log(`Dashboard: ${URL_APP}  (graph ${up.graph} on ${up.db?.where ?? "?"} ${up.db?.host ?? ""}; log ${LOG_FILE})`);
  if (open) spawn("open", [URL_APP], { stdio: "ignore", detached: true }).unref();
}

async function reset() {
  useCloud();
  sh(REPO, "reset", "-q", "--hard", TAG);
  // -fd, not -x: the git-ignored .claude/settings.local.json (Claude Code's hooks) stays.
  sh(REPO, "clean", "-qfd");
  const g = await connect({ graph: GRAPH });
  try {
    await clearActivity(g);
  } finally {
    await g.close();
  }
  await parse();
  console.log(`Reset: ${REPO} is at ${TAG}; no agents, claims, waits or events. Reload the dashboard, restart both editors' agents.`);
}

/**
 * Cursor's side without the Cursor app: Cursor-shaped events through the exact commands in .cursor/hooks.json,
 * so the claim, refusal, wait and free are the ones a real Cursor edit gets. First its notices (as on Cursor's
 * next tool use), then a Write of `file`: refused, or allowed and written (a comment line) and recorded.
 */
function cursor(file, end) {
  const hooks = JSON.parse(readFileSync(join(REPO, ".cursor/hooks.json"), "utf8")).hooks;
  const run = (event, input) => {
    const r = spawnSync("sh", ["-c", hooks[event][0].command], {
      cwd: REPO,
      input: JSON.stringify({ hook_event_name: event, conversation_id: "demo-cursor", workspace_roots: [REPO], cwd: REPO, ...input }),
      encoding: "utf8",
    });
    try {
      return JSON.parse(r.stdout || "{}");
    } catch {
      return {};
    }
  };
  if (end) {
    run("sessionEnd", {});
    return console.log("Cursor (scripted): session ended, its claims are released.");
  }
  if (!file) throw new Error("usage: npm run demo:cursor -- <file in the demo repo, e.g. ui/LoginForm.tsx> | --end");
  const abs = join(REPO, file);
  if (!existsSync(abs)) throw new Error(`No ${abs}.`);
  const told = run("postToolUse", { tool_name: "Read", tool_input: { path: abs } }).additional_context;
  if (told) console.log(`Cursor (scripted) is told:\n  ${told.replaceAll("\n", "\n  ")}\n`);
  const out = run("preToolUse", { tool_name: "Write", tool_input: { file_path: abs } });
  if (out.permission === "deny") return console.log(`Cursor (scripted) tries to write ${file}. Its agent reads:\n\n${out.agent_message}`);
  writeFileSync(abs, `${readFileSync(abs, "utf8")}// edited by the scripted Cursor (demo:cursor)\n`);
  run("afterFileEdit", { file_path: abs, edits: [] });
  console.log(`Cursor (scripted) wrote ${file}: allowed, claimed and recorded.`);
}

function log() {
  if (!existsSync(HOOK_LOG)) return console.log(`No hook has run yet (${HOOK_LOG}).`);
  console.log(readFileSync(HOOK_LOG, "utf8").trimEnd().split("\n").slice(-15).join("\n"));
}

function stop() {
  const pid = running();
  if (!pid) return console.log("No demo dashboard started by demo:start is running.");
  process.kill(-pid, "SIGTERM"); // its process group: tsx and the server under it
  rmSync(PID_FILE, { force: true });
  console.log(`Stopped the dashboard (pid ${pid}).`);
}

const [command, ...flags] = process.argv.slice(2);
const commands = {
  setup: () => setup(flags.includes("--allow-mcp")),
  start: () => start(!flags.includes("--no-open")),
  reset,
  cursor: () => cursor(flags.find((f) => !f.startsWith("--")), flags.includes("--end")),
  log,
  stop,
};
if (!commands[command]) {
  console.error("usage: demo-live.mjs setup [--allow-mcp] | start [--no-open] | reset | cursor <file> | cursor --end | log | stop");
  process.exit(1);
}
try {
  await commands[command]();
} catch (err) {
  // Messages from core are already scrubbed of the password; nothing here prints the env.
  console.error(`demo:${command}: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
