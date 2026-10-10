// Captures every route type at three widths for the UI audit and the
// before/after record. The route list is built from the release, so it keeps
// working as series, periods and statuses are added.
//
//   node scripts/screenshot.mjs --base http://localhost:3100 --out ../docs/reports/qa/ui/after [--only receipt,series] [--widths 390,1280]
//
// Needs a running server (next start -p 3100 after a build, or next dev -p 3100).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { qaRoutes } from "./qa-routes.mjs";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const base = (args.base ?? "http://localhost:3100").replace(/\/$/, "");
const out = path.resolve(siteDir, args.out ?? "../docs/reports/qa/ui/after");
const widths = (args.widths ?? "390,820,1280").split(",").map(Number);
const only = args.only ? new Set(args.only.split(",")) : null;

const routes = qaRoutes(siteDir);

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const index = [];
for (const [name, url] of routes) {
  if (only && !only.has(name) && !only.has(name.split("-")[0])) continue;
  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
    const res = await page.goto(base + url, { waitUntil: "networkidle" });
    // Lazy images below the fold: scroll through once so the full-page capture has them.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(150);
    const file = `${name}-${w}.png`;
    await page.screenshot({ path: path.join(out, file), fullPage: true });
    index.push({ name, url, width: w, status: res?.status() ?? null, file });
    await page.close();
  }
  console.log(`${name.padEnd(18)} ${url}`);
}
await browser.close();
fs.writeFileSync(path.join(out, "index.json"), JSON.stringify(index, null, 2));
console.log(`${index.length} screenshots -> ${path.relative(siteDir, out)}`);
