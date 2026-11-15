// Before/after screenshots for the round-2 report: the same views at 360 and 1280 px.
//   node scripts/round2-shots.mjs --base http://localhost:3100 --out ../docs/reports/qa/round2/after
// The evidence-sheet view opens the sheet through its own URL (?fig=<obs id>).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const base = (args.base ?? "http://localhost:3100").replace(/\/$/, "");
const out = path.resolve(siteDir, args.out ?? "../docs/reports/qa/round2/after");
const full = args.full !== "0";
const views = [
  ["home", "/"],
  ["search-inflation", "/search?q=inflation"],
  ["series-inflation", "/series/cpi.national.yoy.general"],
  ["series-health", "/series/fed.exp.current.function.health"],
  ["compare-health-education", "/compare?s=fed.exp.current.function.health,fed.exp.current.function.education"],
  ["evidence-sheet", "/series/fed.exp.current.function.health?fig=fed.exp.current.function.health~2025-26~re"],
];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const w of [360, 1280]) {
  for (const [name, url] of views) {
    const page = await browser.newPage({ viewport: { width: w, height: w < 600 ? 780 : 900 }, deviceScaleFactor: w < 600 ? 2 : 1 });
    await page.goto(base + url, { waitUntil: "load", timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    const file = path.join(out, `${name}-${w}.png`);
    await page.screenshot({ path: file, fullPage: full && name !== "evidence-sheet", clip: undefined, timeout: 60000 }).catch(async () => page.screenshot({ path: file }));
    // A first-screen shot too: what a reader sees before scrolling.
    await page.screenshot({ path: path.join(out, `${name}-${w}-first.png`) });
    console.log(file);
    await page.close();
  }
}
await browser.close();
