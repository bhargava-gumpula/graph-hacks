#!/usr/bin/env node
/* global process, console, URL, fetch, AbortSignal, setTimeout */
// One command from clone to the running demo. Usage: npm run quickstart [-- --dry-run] [--no-open]
// Checks Node, reuses a FalkorDB that already answers (else `docker compose up -d`), installs deps if
// node_modules is missing, creates .env from .env.example, parses demo-repo, builds the web app,
// starts the server and opens /app?tour=1. Safe to run again: each step is skipped when already done.
// Plain Node, no dependencies, so it runs before `npm install`.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as util from "node:util"; // parseEnv is Node 21.7+; a named import would crash older Node before the version check

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIN_NODE = 22;
const WIN = process.platform === "win32";

/** @returns {{ dryRun: boolean, open: boolean, help: boolean }} */
export function parseArgs(argv) {
  const opts = { dryRun: false, open: true, help: false };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--no-open") opts.open = false;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`unknown option ${arg}. Options: --dry-run, --no-open`);
  }
  return opts;
}

const isLocal = (host) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);

/**
 * The steps for a given machine state. Each step is { do, say }: `do` names the action, `say` is the plan line.
 * state: { node, falkorUrl, falkorUp, docker, hasDeps, hasEnv, port, graph, serverUp, open }
 */
export function buildPlan(s) {
  const major = Number(s.node.split(".")[0]);
  if (major < MIN_NODE) {
    throw new Error(`Node ${MIN_NODE} or newer is needed, you have ${s.node}. Install it from nodejs.org or run: nvm install ${MIN_NODE}`);
  }
  const url = `http://localhost:${s.port}/app?tour=1`;
  const steps = [];
  if (s.falkorUp) steps.push({ do: "none", say: `FalkorDB already answers at ${s.falkorUrl}: reuse it (no docker command)` });
  else if (isLocal(new URL(s.falkorUrl).hostname)) {
    if ((new URL(s.falkorUrl).port || "6379") !== "6379") {
      throw new Error(`Nothing answers at ${s.falkorUrl}, and docker-compose.yml serves FalkorDB on 6379. Start your FalkorDB, or unset FALKORDB_URL.`);
    }
    if (s.docker === "missing") {
      throw new Error("Docker isn't installed: install Docker Desktop or OrbStack, or set FALKORDB_URL to a running FalkorDB.");
    }
    if (s.docker === "stopped") throw new Error("Docker isn't running: start Docker Desktop or OrbStack, then run npm run quickstart again.");
    steps.push({ do: "docker", say: `nothing answers at ${s.falkorUrl}: run docker compose up -d and wait for FalkorDB` });
  } else {
    throw new Error(`Nothing answers at FALKORDB_URL=${s.falkorUrl}. Start that FalkorDB, or unset FALKORDB_URL to run one locally with Docker.`);
  }
  steps.push(s.hasDeps ? { do: "none", say: "node_modules exists: skip npm install" } : { do: "install", say: "install dependencies: npm ci" });
  steps.push(s.hasEnv ? { do: "none", say: ".env exists: keep it" } : { do: "env", say: "create .env from .env.example" });
  if (s.serverUp) {
    steps.push({ do: "none", say: `Switchboard already runs on port ${s.port} with graph ${s.graph}: skip parse, build and start` });
  } else {
    steps.push(
      { do: "parse", say: `parse demo-repo into graph ${s.graph}` },
      { do: "build", say: "build the web app: npm run build -w @switchboard/web" },
      { do: "server", say: `start the server on port ${s.port} and wait for /api/health` },
    );
  }
  steps.push(s.open ? { do: "open", say: `open ${url}` } : { do: "none", say: `print ${url} (--no-open)` });
  return steps;
}

/** True when something at redis://host:port answers a PING within the timeout. */
function pingRedis(url, timeoutMs = 1500) {
  const { hostname, port } = new URL(url);
  return new Promise((done) => {
    const socket = connect({ host: hostname.replace(/^\[|\]$/g, ""), port: Number(port || 6379) });
    const finish = (ok) => {
      socket.destroy();
      done(ok);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.on("error", () => finish(false));
    socket.on("connect", () => socket.write("PING\r\n"));
    // +PONG, or -NOAUTH from a password-protected server: either way, it answers.
    socket.on("data", (buf) => finish(/^[+-]/.test(buf.toString())));
  });
}

/** The /api/health reply on this port, or null. */
async function health(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function portBusy(port) {
  return new Promise((done) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.on("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.on("error", () => done(false));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(check, seconds, what) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await check()) return;
    await sleep(500);
  }
  throw new Error(`${what} did not come up within ${seconds} s.`);
}

function sh(cmd, args, env) {
  console.log(`\n$ ${[cmd, ...args].join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, env, stdio: "inherit", shell: WIN });
  if (r.error?.code === "ENOENT") throw new Error(`${cmd} is not installed or not on PATH.`);
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (exit ${r.status}). The output above says why.`);
}

/** "ok", "missing" (no docker binary) or "stopped" (the daemon does not answer). */
function dockerStatus() {
  const r = spawnSync("docker", ["info"], { stdio: "ignore", shell: WIN, timeout: 15_000 });
  if (r.error?.code === "ENOENT") return "missing";
  return r.status === 0 ? "ok" : "stopped";
}

function openUrl(url) {
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [url]] : WIN ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", () => console.log(`Could not open a browser. Open ${url} yourself.`));
  child.unref();
}

async function main(opts) {
  // Real environment first, then .env, then the defaults the code uses.
  buildPlan({ node: process.versions.node, falkorUrl: "redis://localhost", falkorUp: true, port: 0 }); // Node check first
  const envFile = join(ROOT, ".env");
  const fromFile = existsSync(envFile) ? util.parseEnv(readFileSync(envFile, "utf8")) : {};
  const env = { ...fromFile, ...process.env };
  const falkorUrl = env.FALKORDB_URL || "redis://localhost:6379";
  const port = Number(env.SERVER_PORT || 8787);
  const graph = env.SB_GRAPH || "sb_demo";
  env.FALKORDB_URL = falkorUrl;
  env.SERVER_PORT = String(port);
  env.SB_GRAPH = graph;

  const running = await health(port);
  const falkorUp = await pingRedis(falkorUrl);
  const state = {
    node: process.versions.node,
    falkorUrl,
    falkorUp,
    docker: falkorUp ? "not needed" : dockerStatus(),
    hasDeps: existsSync(join(ROOT, "node_modules")),
    hasEnv: existsSync(envFile),
    port,
    graph,
    serverUp: running?.ok === true && running.graph === graph,
    open: opts.open,
  };
  if (!state.serverUp && (await portBusy(port))) {
    const what = running?.graph ? `a Switchboard server on graph ${running.graph}` : "another program";
    throw new Error(`Port ${port} is taken by ${what}. Stop it, or pick a free port: SERVER_PORT=8790 npm run quickstart`);
  }
  const plan = buildPlan(state);
  console.log("Switchboard quickstart plan:");
  plan.forEach((s, i) => console.log(`  ${i + 1}. ${s.say}`));
  if (opts.dryRun) {
    console.log("\n--dry-run: nothing was changed.");
    return;
  }

  const url = `http://localhost:${port}/app?tour=1`;
  let server;
  for (const step of plan) {
    if (step.do === "docker") {
      sh("docker", ["compose", "up", "-d"], env);
      await waitFor(() => pingRedis(falkorUrl), 60, `FalkorDB at ${falkorUrl}`);
    } else if (step.do === "install") sh("npm", ["ci"], env);
    else if (step.do === "env") {
      copyFileSync(join(ROOT, ".env.example"), envFile);
      console.log("\ncreated .env from .env.example");
    } else if (step.do === "parse") sh("npm", ["run", "parse", "--", "demo-repo"], env);
    else if (step.do === "build") sh("npm", ["run", "build", "-w", "@switchboard/web"], env);
    else if (step.do === "server") {
      console.log(`\n$ npm run server   (port ${port}, graph ${graph})`);
      server = spawn("npm", ["run", "server"], { cwd: ROOT, env, stdio: "inherit", shell: WIN });
      for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.kill(sig));
      server.on("exit", (code) => {
        process.exitCode = code ?? 1;
      });
      await waitFor(async () => (await health(port))?.ok === true, 60, `The server on port ${port}`);
    }
  }
  const h = await health(port);
  console.log(`\nSwitchboard is running: graph ${h?.graph}, ${h?.files} files.\n\n  ${url}\n`);
  if (opts.open) openUrl(url);
  if (server) console.log("Press Ctrl+C to stop the server.");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (opts.help) {
    console.log("Usage: npm run quickstart [-- --dry-run] [--no-open]\n  --dry-run  print the plan, change nothing\n  --no-open  do not open a browser");
  } else {
    main(opts).catch((err) => {
      console.error(`\nquickstart stopped: ${err.message}`);
      process.exit(1);
    });
  }
}
