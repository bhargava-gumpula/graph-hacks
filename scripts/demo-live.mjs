/* global process, console, fetch, AbortSignal, setTimeout */
// The live demo: Claude Code and Cursor on one repo, the graph in FalkorDB Cloud. See docs/DEMO-LIVE.md.
//   npm run demo:setup   once: ~/switchboard-demo (a git copy of demo-repo), hooks + MCP for both editors, parse
//   npm run demo:start   the dashboard on http://localhost:8790/app (--no-open to skip the browser)
//   npm run demo:reset   a fresh take: the repo back to its committed state, no claims, waits or events
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

async function setup() {
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
  // Claude Code starts the project's switchboard MCP server without asking.
  const local = join(REPO, ".claude/settings.local.json");
  const settings = JSON.parse(readFileSync(local, "utf8"));
  writeFileSync(local, `${JSON.stringify({ ...settings, enabledMcpjsonServers: ["switchboard"] }, null, 2)}\n`);
  // The configs hold this machine's paths and the .env's path, never a secret; commit them so a reset keeps them.
  sh(REPO, "add", "-A");
  sh(REPO, "-c", "user.name=Demo", "-c", "user.email=demo@example.com", "commit", "-qm", "Wire Switchboard");
  sh(REPO, "tag", "-f", TAG);

  await parse();
  console.log(`
Ready. Claude Code is claude@main and Cursor is cursor@main, both in ${REPO}.
  npm run demo:start                  dashboard on ${URL_APP}
  cd ${REPO} && claude                Claude Code
  cursor ${REPO}                      Cursor (enable the switchboard MCP server once in Settings > MCP)`);
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

function stop() {
  const pid = running();
  if (!pid) return console.log("No demo dashboard started by demo:start is running.");
  process.kill(-pid, "SIGTERM"); // its process group: tsx and the server under it
  rmSync(PID_FILE, { force: true });
  console.log(`Stopped the dashboard (pid ${pid}).`);
}

const [command, ...flags] = process.argv.slice(2);
const commands = { setup, start: () => start(!flags.includes("--no-open")), reset, stop };
if (!commands[command]) {
  console.error("usage: demo-live.mjs setup | start [--no-open] | reset | stop");
  process.exit(1);
}
try {
  await commands[command]();
} catch (err) {
  // Messages from core are already scrubbed of the password; nothing here prints the env.
  console.error(`demo:${command}: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
