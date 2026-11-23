// Data hub run, stage 4: desktop screenshots of each page type (1440 x 900, first screen and full page),
// a 360 px pass that fails on horizontal overflow, and the home page's first-screen word count (plan
// section 5: one chart, the ticker and six numbers within 120 words, header and ticker excluded).
//
//   node scripts/hub-shots.mjs --base http://localhost:3100 --out ../docs/reports/qa/hub
//
// Needs `next start` on a fresh build. Exits 2 if the stylesheet did not load, 1 if a page overflows at
// 360 px, answers other than 200, or the first screen is over the limit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const base = (args.base ?? "http://localhost:3100").replace(/\/$/, "");
const out = path.resolve(siteDir, args.out ?? "../docs/reports/qa/hub");
const LIMIT = 120;

// One page of each type. The document page is the largest served report, opened at a page.
const routes = [
  ["home", "/"],
  ["library", "/library"],
  ["datasets", "/library/datasets"],
  ["document", "/sources/lfs-pbs-2020-21?page=150"],
  ["indicators", "/topics"],
  ["topic", "/topics/prices"],
  ["stories", "/answers"],
  ["story", "/answers/federal-tax-revenue"],
  ["chart-builder", "/compare"],
  ["series", "/series/fed.rev.tax"],
  ["search", "/search?q=inflation"],
  ["about", "/about"],
  ["type-trial", "/demo/type"],
  ["find-data", "/browse"],
  ["whats-new", "/releases"],
  ["guides", "/guides"],
  ["guide", "/guides/revised-estimate"],
  ["inflation-calculator", "/inflation-calculator"],
  ["compare-provinces", "/compare/education"],
];

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const result = { base, pages: [], firstScreen: null, failures: [] };

async function open(url, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const res = await page.goto(base + url, { waitUntil: "load" });
  if (!(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--link").trim()))) {
    console.error(`${url}: the stylesheet did not load; is the server serving the current build?`);
    process.exit(2);
  }
  await page.waitForTimeout(600);
  // The PDF viewer opens the file after load: wait (up to 15 s) until a page is drawn.
  if (url.startsWith("/sources/")) await page.waitForFunction(() => !document.body.innerText.includes("Opening the document"), null, { timeout: 15000 }).catch(() => {});
  return { page, status: res?.status() ?? null };
}

for (const [name, url] of routes) {
  // Desktop: the first screen and the full page (cut at 6,000 px).
  const d = await open(url, 1440, 900);
  await d.page.screenshot({ path: path.join(out, `${name}-1440-first.png`) });
  const h = await d.page.evaluate(() => document.documentElement.scrollHeight);
  await d.page.screenshot({ path: path.join(out, `${name}-1440.png`), fullPage: true, clip: { x: 0, y: 0, width: 1440, height: Math.min(h, 6000) } });
  if (name === "home") {
    result.firstScreen = await d.page.evaluate(() => {
      const main = document.querySelector("main");
      const skip = (el) => el.closest("header, footer, .tk, .chart-notes, .sr-only, [hidden], [aria-hidden='true']");
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      let words = 0;
      let tokens = 0;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || skip(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.top >= innerHeight || r.bottom <= 0 || r.width === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        for (const t of n.textContent.split(/\s+/).filter(Boolean)) {
          tokens++;
          if (/\p{L}/u.test(t)) words++;
        }
      }
      const svgs = [...main.querySelectorAll("svg")].filter((s) => {
        const r = s.getBoundingClientRect();
        return r.width > 300 && r.top < innerHeight;
      }).length;
      const keyNumbers = document.querySelectorAll(".kn-row").length;
      const ticker = !!document.querySelector(".tk");
      return { words, tokens, charts: svgs, keyNumbers, ticker };
    });
  }
  await d.page.close();
  // Phone: no horizontal page scroll at 360 px.
  const m = await open(url, 360, 800);
  const over = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await m.page.screenshot({ path: path.join(out, `${name}-360-first.png`) });
  await m.page.close();
  result.pages.push({ name, url, status: d.status, overflow360: over });
  if (d.status !== 200) result.failures.push(`${url}: answered ${d.status}`);
  if (over > 0) result.failures.push(`${url}: ${over} px horizontal overflow at 360 px`);
  console.log(`${name.padEnd(14)} ${String(d.status).padEnd(4)} overflow@360 ${over}px  ${url}`);
}
await browser.close();
const fsr = result.firstScreen;
if (fsr && (fsr.words > LIMIT || fsr.charts < 1 || fsr.keyNumbers !== 6 || !fsr.ticker))
  result.failures.push(`first screen: ${fsr.words} words (limit ${LIMIT}), ${fsr.charts} chart(s), ${fsr.keyNumbers} key numbers, ticker ${fsr.ticker}`);
fs.writeFileSync(path.join(out, "index.json"), JSON.stringify(result, null, 2));
console.log(`first screen at 1440 x 900: ${JSON.stringify(fsr)}`);
if (result.failures.length) {
  console.log(result.failures.join("\n"));
  process.exit(1);
}
