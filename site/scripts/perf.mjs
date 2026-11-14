// Page weight and load time on an emulated phone (DESIGN.md 14.1), against a
// running build:
//   npx next start -p 3100   (in another terminal)
//   node scripts/perf.mjs --base http://localhost:3100 [--out file.json] [--budget]
// For each key page: bytes transferred (compressed, first load, cold cache),
// bytes after 30 s idle on the page (background downloads), JavaScript and font
// bytes, HTML size and element count, and the time until the main number (or the
// chart) is visible on Fast 3G and at 400 kbps, with 4x CPU slowdown, 360 x 740.
// With --budget it exits 1 when a page is over its budget.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(siteDir, "package.json"));
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const base = arg("--base", "http://localhost:3100");
const out = arg("--out", null);
const enforce = args.includes("--budget");
const idle = Number(arg("--idle", "30")) * 1000;

const cfg = JSON.parse(fs.readFileSync(path.join(siteDir, "release.config.json"), "utf8"));
const relDir = path.resolve(siteDir, "..", "releases", cfg.version);
const obs = JSON.parse(fs.readFileSync(path.join(relDir, "observations.json"), "utf8"));
const slug = (id) => id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");
const health = obs.find((o) => o.series_id === "fed.exp.current.function.health" && o.period === "2026-27" && o.vintage === "be" && o.published);

// Budgets in KB (compressed, first load). "visible" selectors: the first thing a reader came for.
const PAGES = [
  { name: "home", path: "/", kb: 200, kbIdle: 250, visible: "main h1, main .v-link" },
  { name: "series", path: "/series/fed.exp.current.function.health", kb: 200, visible: "main .v-link, main svg" },
  { name: "receipt", path: health ? `/o/${slug(health.obs_id)}` : "/o/", kb: 250, visible: "[data-receipt-value], main img" },
  { name: "catalogue", path: "/browse", kb: null, htmlKb: 100, elements: 1500, visible: "main h1" },
  { name: "compare", path: "/compare", kb: 200, visible: "main h1" },
  { name: "search", path: "/search?q=health", kb: null, htmlKb: 100, elements: 1500, visible: "main h1", optional: true },
];
const NET = {
  "fast-3g": { latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  "400kbps": { latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 },
};

async function measure(browser, page, net) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, ...NET[net] });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const sizes = new Map();
  const types = new Map();
  cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => sizes.set(e.requestId, e.encodedDataLength));
  const t0 = Date.now();
  const resp = await p.goto(base + page.path, { waitUntil: "commit", timeout: 180000 });
  if (!resp || resp.status() >= 400) {
    await ctx.close();
    return { status: resp?.status() ?? 0 };
  }
  let visibleMs = null;
  try {
    await p.locator(page.visible).first().waitFor({ state: "visible", timeout: 120000 });
    visibleMs = Date.now() - t0;
  } catch {}
  await p.waitForLoadState("load", { timeout: 180000 }).catch(() => {});
  const loadMs = Date.now() - t0;
  await p.waitForTimeout(1500);
  const sum = (pred) => [...sizes.entries()].filter(([id]) => pred(types.get(id))).reduce((a, [, n]) => a + n, 0);
  const first = { total: sum(() => true), doc: sum((t) => t === "Document"), js: sum((t) => t === "Script"), font: sum((t) => t === "Font"), img: sum((t) => t === "Image") };
  const dom = await p.evaluate(() => ({ elements: document.getElementsByTagName("*").length, html: document.documentElement.outerHTML.length }));
  let afterIdle = null;
  if (idle > 0 && net === "fast-3g") {
    await p.waitForTimeout(idle);
    afterIdle = sum(() => true);
  }
  await ctx.close();
  return { status: 200, visibleMs, loadMs, first, afterIdle, dom };
}

const browser = await chromium.launch();
const results = [];
let over = 0;
for (const page of PAGES) {
  const fast = await measure(browser, page, "fast-3g");
  if (fast.status !== 200) {
    if (!page.optional) console.log(`${page.name}: HTTP ${fast.status} at ${page.path}`);
    continue;
  }
  const slow = await measure(browser, page, "400kbps");
  const kb = (n) => (n === null || n === undefined ? "n/a" : `${Math.round(n / 1024)} KB`);
  const r = { page: page.name, path: page.path, ...fast, visibleMs400: slow.visibleMs, loadMs400: slow.loadMs };
  const fails = [];
  if (page.kb && fast.first.total / 1024 > page.kb) fails.push(`first load ${kb(fast.first.total)} > ${page.kb} KB`);
  if (page.kbIdle && fast.afterIdle / 1024 > page.kbIdle) fails.push(`after idle ${kb(fast.afterIdle)} > ${page.kbIdle} KB`);
  if (fast.first.js / 1024 > 100) fails.push(`JavaScript ${kb(fast.first.js)} > 100 KB`);
  if (fast.first.font / 1024 > 40) fails.push(`fonts ${kb(fast.first.font)} > 40 KB`);
  if (page.htmlKb && fast.first.doc / 1024 > page.htmlKb) fails.push(`HTML ${kb(fast.first.doc)} > ${page.htmlKb} KB`);
  if (page.elements && fast.dom.elements > page.elements) fails.push(`${fast.dom.elements} elements > ${page.elements}`);
  if (fast.visibleMs !== null && fast.visibleMs > 2000 && page.name === "series") fails.push(`series visible ${fast.visibleMs} ms on Fast 3G > 2,000 ms`);
  if (slow.visibleMs !== null && slow.visibleMs > 4000 && page.name === "series") fails.push(`series visible ${slow.visibleMs} ms at 400 kbps > 4,000 ms`);
  r.fails = fails;
  over += fails.length ? 1 : 0;
  results.push(r);
  console.log(
    `${page.name.padEnd(9)} first ${kb(fast.first.total).padStart(7)} (HTML ${kb(fast.first.doc)}, JS ${kb(fast.first.js)}, fonts ${kb(fast.first.font)}, img ${kb(fast.first.img)})` +
      ` · after ${idle / 1000}s ${kb(fast.afterIdle)} · ${fast.dom.elements} elements, HTML ${kb(fast.dom.html)} raw` +
      ` · visible ${fast.visibleMs ?? "n/a"} ms (Fast 3G), ${slow.visibleMs ?? "n/a"} ms (400 kbps)${fails.length ? `  OVER: ${fails.join("; ")}` : ""}`,
  );
}
await browser.close();
if (out) fs.writeFileSync(out, JSON.stringify({ base, measuredAt: new Date().toISOString(), results }, null, 1));
if (enforce && over) {
  console.error(`perf: ${over} page(s) over budget`);
  process.exit(1);
}
