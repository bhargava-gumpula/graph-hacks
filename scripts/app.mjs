#!/usr/bin/env node
/* global process, console, fetch, AbortSignal, setTimeout */
// The dashboard as a laptop app. Usage: npm run app [-- --no-open]
// Reuses a Switchboard server that already answers on SERVER_PORT (default 8787); otherwise runs
// `npm run quickstart -- --no-open` (FalkorDB, deps, parse, build, server) and waits for it.
// Then opens /app in an app window: Chrome, Edge or Brave with --app, else the default browser.
// Install it as an app once: Chrome or Edge, the install icon at the right of the address bar (or the
// menu, Cast, save and share > Install page as app). Safari 17+, File > Add to Dock. Then it opens from the Dock.
// Plain Node, no dependencies.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as util from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIN = process.platform === "win32";
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: npm run app [-- --no-open]\n  --no-open  start or reuse the server, print the URL, open nothing");
  process.exit(0);
}
const bad = args.find((a) => a !== "--no-open");
if (bad) {
  console.error(`unknown option ${bad}. Options: --no-open`);
  process.exit(1);
}
const open = !args.includes("--no-open");

const envFile = join(ROOT, ".env");
const env = { ...(existsSync(envFile) ? util.parseEnv(readFileSync(envFile, "utf8")) : {}), ...process.env };
const port = Number(env.SERVER_PORT || 8787);
const url = `http://localhost:${port}/app`;

async function health() {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Chrome, Edge or Brave as an app window (no tabs, no address bar); null when none is installed. */
function appWindow() {
  const flag = `--app=${url}`;
  if (process.platform === "darwin") {
    const app = ["Google Chrome", "Microsoft Edge", "Brave Browser", "Chromium"].find((a) => existsSync(`/Applications/${a}.app`));
    return app ? ["open", ["-na", app, "--args", flag]] : null;
  }
  if (WIN) return ["cmd", ["/c", "start", "", "chrome", flag]];
  const bin = ["google-chrome", "microsoft-edge", "brave-browser", "chromium", "chromium-browser"].find(
    (b) => spawnSync("which", [b], { stdio: "ignore" }).status === 0,
  );
  return bin ? [bin, [flag]] : null;
}

function launch() {
  const browser = process.platform === "darwin" ? ["open", [url]] : WIN ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  const [cmd, argv] = appWindow() ?? browser;
  const child = spawn(cmd, argv, { stdio: "ignore", detached: true });
  child.on("error", () => console.log(`Could not open a window. Open ${url} yourself.`));
  child.unref();
}

let server;
const running = await health();
if (running?.ok) {
  console.log(`Switchboard already runs on port ${port} (graph ${running.graph}): reusing it.`);
} else {
  console.log(`Nothing answers on port ${port}: starting it with npm run quickstart.`);
  server = spawn("npm", ["run", "quickstart", "--", "--no-open"], { cwd: ROOT, env, stdio: "inherit", shell: WIN });
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.kill(sig));
  const exited = new Promise((done) => server.on("exit", (code) => done(code ?? 1)));
  let up = false;
  // The first run pulls FalkorDB, installs and builds: give it a few minutes.
  for (let i = 0; i < 600 && !up; i++) {
    const code = await Promise.race([exited, new Promise((r) => setTimeout(() => r(null), 500))]);
    if (code !== null) {
      console.error(`\nnpm run app stopped: quickstart exited with code ${code}. The output above says why.`);
      process.exit(Number(code) || 1);
    }
    up = (await health())?.ok === true;
  }
  if (!up) {
    console.error(`\nnpm run app stopped: the server on port ${port} did not come up within 5 minutes.`);
    server.kill("SIGTERM");
    process.exit(1);
  }
}

console.log(`\nSwitchboard app: ${url}`);
if (open) launch();
else console.log("--no-open: not opening a window.");
console.log("Install it: Chrome or Edge, the install icon in the address bar. Safari, File > Add to Dock.");
if (server) console.log("Press Ctrl+C to stop the server.");
