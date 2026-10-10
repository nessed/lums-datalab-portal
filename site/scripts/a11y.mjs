// Runs axe (WCAG 2.1 A and AA rules) on every route type and writes a summary.
// Exits 1 if any serious or critical violation is found.
//
//   node scripts/a11y.mjs --base http://localhost:3100 --out ../docs/reports/qa/ui/a11y.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { qaRoutes } from "./qa-routes.mjs";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const base = (args.base ?? "http://localhost:3100").replace(/\/$/, "");
const out = args.out ? path.resolve(siteDir, args.out) : null;

const browser = await chromium.launch();
const results = [];
let blocking = 0;
for (const [name, url] of qaRoutes(siteDir)) {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(base + url, { waitUntil: "load" });
    await page.waitForTimeout(400);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const v = r.violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.length, sample: x.nodes[0]?.target?.join(" ") }));
    const bad = v.filter((x) => x.impact === "serious" || x.impact === "critical");
    blocking += bad.length;
    results.push({ name, url, width, violations: v });
    console.log(`${name.padEnd(18)} ${String(width).padStart(4)}px  ${v.length ? v.map((x) => `${x.impact}:${x.id}(${x.nodes})`).join(" ") : "clean"}`);
    await context.close();
  }
}
await browser.close();
if (out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
}
console.log(blocking ? `${blocking} serious/critical violations` : "no serious or critical violations");
process.exit(blocking ? 1 : 0);
