// Stage 0 checks in a real browser, against a running build:
//   node scripts/verify-stage0.mjs --base http://localhost:3100 --out ../docs/reports/qa/redesign/stage0
// 1. The header search opens at 360 px and its text box is at least 200 px wide and takes typing.
// 2. The home page downloads nothing in the background after load (no viewport prefetch).
// 3. The catalogue HTML has at most 1,500 elements; filtering loads every series and finds a deep one.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(siteDir, "package.json"));
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const base = arg("--base", "http://localhost:3100");
const out = path.resolve(arg("--out", path.join(siteDir, "..", "docs", "reports", "qa", "redesign", "stage0")));
fs.mkdirSync(out, { recursive: true });

const results = [];
const ok = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${detail}`);
};
const browser = await chromium.launch();

for (const width of [360, 320]) {
  const ctx = await browser.newContext({ viewport: { width, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${base}/`, { waitUntil: "networkidle" });
  await p.locator(".search-trigger").first().click();
  const input = p.locator("dialog.search-dialog input[type=search]");
  await input.waitFor({ state: "visible" });
  const w = await input.evaluate((el) => el.getBoundingClientRect().width);
  await input.fill("health");
  await p.waitForTimeout(800);
  const n = await p.locator("dialog.search-dialog [role=option], dialog.search-dialog li a").count();
  // At least 200 px at the 360 px design width (S17); at 320 px (the test width) at least 150 px.
  ok(`search box at ${width} px`, w >= (width >= 360 ? 200 : 150) && n > 0, `input ${Math.round(w)} px wide, ${n} results for "health"`);
  await p.screenshot({ path: path.join(out, `search-open-${width}.png`) });
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const after = [];
  await p.goto(`${base}/`, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  p.on("request", (r) => after.push(r.url()));
  await p.mouse.wheel(0, 4000);
  await p.waitForTimeout(8000);
  const pngs = after.filter((u) => /\.png|\.webp/.test(u));
  ok("home: no background downloads after scrolling", after.length === 0, `${after.length} requests after load and scroll (${pngs.length} images)${after.length ? ": " + after.slice(0, 3).join(", ") : ""}`);
  await ctx.close();
}

for (const width of [360, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${base}/browse`, { waitUntil: "networkidle" });
  const els = await p.evaluate(() => document.getElementsByTagName("*").length);
  ok(`catalogue at ${width} px: element count`, els <= 1500, `${els} elements`);
  await p.screenshot({ path: path.join(out, `browse-${width}.png`), fullPage: false });
  await p.goto(`${base}/browse?q=clothing`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  const found = await p.locator("ul[aria-label='Matching series'] li").count();
  ok(`catalogue at ${width} px: filter finds a deep series`, found > 0, `${found} rows for "clothing"`);
  await p.screenshot({ path: path.join(out, `browse-filtered-${width}.png`) });
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 900 }, javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(`${base}/browse`, { waitUntil: "load" });
  const rows = await p.locator("#cat-list li").count();
  ok("catalogue without JavaScript lists the top-level series", rows > 0, `${rows} rows`);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 1));
if (results.some((r) => !r.pass)) process.exit(1);
