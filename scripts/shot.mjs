// Screenshot helper: node scripts/shot.mjs <url> <out.png> [w] [h] [scrollY] [waitMs]; env FULL=1 full page, LIGHT=1 light scheme.
import { chromium } from "@playwright/test";
const [url, out, w = "1440", h = "900", scroll = "0", wait = "6000"] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, colorScheme: process.env.LIGHT === "1" ? "light" : "dark" });
await p.goto(url, { waitUntil: "networkidle" });
if (+scroll) await p.evaluate((y) => window.scrollTo(0, y), +scroll);
await p.waitForTimeout(+wait);
await p.screenshot({ path: out, fullPage: process.env.FULL === "1" });
await b.close();
console.log(out);
