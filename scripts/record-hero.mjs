/* global process, console, document */
// Records the hero shot for the README and the blog: /app?play=1 -> docs/blog-assets/conflict.gif
// Usage: node scripts/record-hero.mjs [baseUrl]    (default http://127.0.0.1:8787)
// The server must be running with the demo graph. Needs Playwright's Chromium and ffmpeg.
// Env: FFMPEG (default /opt/homebrew/bin/ffmpeg), HOLD_MS (recording time after the caption, default 3500),
//      CAPTION (text that marks the refusal caption, default the end of the refusal sentence).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const base = (process.argv[2] ?? process.env.BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const out = resolve(import.meta.dirname, "../docs/blog-assets/conflict.gif");
const ffmpeg = process.env.FFMPEG ?? "/opt/homebrew/bin/ffmpeg";
const hold = Number(process.env.HOLD_MS ?? 3500);
const caption = process.env.CAPTION ?? "A file lock would have allowed the edit";
const MAX_BYTES = 5_000_000; // 5 MB, decimal, so it is under the limit in any unit
const dir = mkdtempSync(join(tmpdir(), "sb-hero-"));

const isDemoRequest = (r) => r.url().includes("/api/demo") && r.method() === "POST";
const isDemo = (res) => isDemoRequest(res.request());

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  colorScheme: "dark",
  recordVideo: { dir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const t0 = Date.now();
let playAt = null; // when the Play request went out, so the GIF can start just before it
page.on("request", (r) => {
  if (isDemoRequest(r)) playAt ??= Date.now();
});

// /app?play=1 starts the demo by itself. If this build does not, press the Play button.
const reply = page.waitForResponse(isDemo, { timeout: 12_000 });
await page.goto(`${base}/app?play=1`, { waitUntil: "networkidle" });
try {
  await reply;
} catch {
  console.log("no autoplay from ?play=1; pressing Play");
  await page.getByRole("button", { name: /play/i }).first().click();
  await page.waitForResponse(isDemo, { timeout: 12_000 });
}
await page.waitForFunction((text) => document.body.innerText.includes(text), caption, { timeout: 15_000 });
await page.waitForTimeout(hold);
await context.close(); // writes the video
await browser.close();

const webm = join(dir, readdirSync(dir).find((f) => f.endsWith(".webm")));
mkdirSync(resolve(out, ".."), { recursive: true });
const start = Math.max(0, ((playAt ?? t0) - t0) / 1000 - 0.6);

// Full width first, then smaller until the GIF is under 5 MB.
for (const width of [1280, 1100, 960, 800, 640]) {
  const filter = `fps=12,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-ss", start.toFixed(2), "-i", webm, "-vf", filter, "-loop", "0", out]);
  const size = statSync(out).size;
  console.log(`${out}: ${width}px wide, ${(size / 1e6).toFixed(2)} MB`);
  if (size < MAX_BYTES) break;
  if (width === 640) throw new Error("conflict.gif is still over 5 MB at 640px");
}
rmSync(dir, { recursive: true, force: true });
