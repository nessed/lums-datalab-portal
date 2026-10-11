// Keyboard-only walkthrough of the main tasks, with no mouse at all. Each step
// records whether it worked and whether the focused element shows a visible
// focus outline. Exits 1 if any step fails.
//
//   node scripts/keyboard.mjs --base http://localhost:3100 [--out ../docs/reports/qa/ui/keyboard.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { qaRoutes } from "./qa-routes.mjs";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const base = (args.base ?? "http://localhost:3100").replace(/\/$/, "");
const routes = Object.fromEntries(qaRoutes(siteDir));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const steps = [];

async function focusInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: "body" };
    const cs = getComputedStyle(el);
    // An SVG link shows focus on its hit circle (a ring), not with an outline.
    const ring = el.querySelector?.(".c-hit");
    const ringVisible = ring ? getComputedStyle(ring).stroke !== "none" && parseFloat(getComputedStyle(ring).strokeWidth) > 0 : false;
    const visible = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none" || ringVisible;
    return { tag: el.tagName.toLowerCase(), text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60), visible };
  });
}
/** Press Tab until `test(el)` is true for the focused element, at most `max` times. */
async function tabTo(page, test, max = 250) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(test)) return { presses: i + 1, ...(await focusInfo(page)) };
  }
  return null;
}
async function step(name, fn) {
  try {
    const r = await fn();
    steps.push({ name, ok: !!r && r.ok !== false, ...(typeof r === "object" ? r : {}) });
  } catch (e) {
    steps.push({ name, ok: false, error: String(e).slice(0, 200) });
  }
  const s = steps[steps.length - 1];
  console.log(`${s.ok ? "ok  " : "FAIL"} ${name}${s.presses ? ` (${s.presses} Tab presses)` : ""}${s.visible === false ? " [focus not visible]" : ""}${s.error ? ` ${s.error}` : ""}`);
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

await step("Skip link is the first Tab stop and moves focus to the content", async () => {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.keyboard.press("Tab");
  const f = await focusInfo(page);
  await page.keyboard.press("Enter");
  const onMain = await page.evaluate(() => document.activeElement?.id === "main");
  return { ok: f.text.startsWith("Skip") && onMain, ...f };
});

await step("Search: '/' opens it, typing and Enter opens a series", async () => {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.waitForTimeout(300);
  await page.keyboard.press("/");
  await page.waitForSelector("dialog.search-dialog[open]");
  await page.keyboard.type("health current revenue", { delay: 20 });
  await page.waitForSelector(".search-results li", { timeout: 5000 });
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/series\//, { timeout: 10000 });
  return { ok: true, url: page.url().replace(base, "") };
});

await step("Series: the tabs are reachable and arrow keys switch them", async () => {
  await page.goto(base + routes["series-break"], { waitUntil: "load" });
  await page.waitForTimeout(300);
  const r = await tabTo(page, () => document.activeElement?.getAttribute("role") === "tab");
  await page.keyboard.press("ArrowRight");
  const selected = await page.evaluate(() => document.activeElement?.textContent?.trim() === "Table" && document.activeElement?.getAttribute("aria-selected") === "true");
  const panelShown = await page.evaluate(() => !document.querySelector('[data-panel="table"]')?.hidden);
  await page.keyboard.press("ArrowLeft");
  return { ok: !!r && selected && panelShown, ...r };
});

await step("Series: a chart point is a Tab stop and Enter opens its receipt", async () => {
  await page.goto(base + routes["series-break"], { waitUntil: "load" });
  await page.waitForTimeout(300);
  const r = await tabTo(page, () => document.activeElement?.classList.contains("c-pt"));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/o\//, { timeout: 10000 });
  return { ok: !!r, ...r, url: page.url().replace(base, "") };
});

await step("Receipt: 'Copy citation' and 'Official PDF' are Tab stops", async () => {
  await page.goto(base + routes["receipt-tierA"], { waitUntil: "load" });
  const r = await tabTo(page, () => /Copy citation/.test(document.activeElement?.textContent ?? ""));
  const r2 = await tabTo(page, () => /Official PDF/.test(document.activeElement?.textContent ?? ""), 10);
  return { ok: !!r && !!r2, ...r };
});

await step("Receipt: a check opens with the keyboard (Show the arithmetic)", async () => {
  await page.goto(base + routes["receipt-tierA"], { waitUntil: "load" });
  const r = await tabTo(page, () => document.activeElement?.tagName === "SUMMARY" && /arithmetic|printings/.test(document.activeElement?.textContent ?? ""));
  await page.keyboard.press("Enter");
  const open = await page.evaluate(() => document.activeElement?.parentElement?.hasAttribute("open"));
  return { ok: !!r && open, ...r };
});

await step("Catalogue: a filter checkbox toggles with Space and filters the list", async () => {
  await page.goto(base + "/browse", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const r = await tabTo(page, () => document.activeElement?.id?.startsWith("f-dataset-"));
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  const url = page.url();
  const status = await page.textContent("#cat-status");
  return { ok: !!r && /dataset=/.test(url) && /match/.test(status ?? ""), ...r, status };
});

await step("Table as printed: Enter on a number selects it and shows its receipt link", async () => {
  await page.goto(base + routes["table-abs"], { waitUntil: "load" });
  await page.waitForTimeout(300);
  const r = await tabTo(page, () => document.activeElement?.closest?.(".tv-v") !== null && document.activeElement?.tagName === "A");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const sel = await page.evaluate(() => !!document.querySelector(".tv-sel .tv-sel-links a") && !!document.querySelector(".tv-box"));
  return { ok: !!r && sel, ...r };
});

await step("Compare: the series picker is reachable and Remove is a button", async () => {
  await page.goto(base + "/compare", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const r = await tabTo(page, () => document.activeElement?.tagName === "BUTTON" && /Remove/.test(document.activeElement?.textContent ?? ""));
  return { ok: !!r, ...r };
});

const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p2 = await phone.newPage();
await step("Phone: the Menu opens with Enter and its links are Tab stops", async () => {
  await p2.goto(base + "/", { waitUntil: "load" });
  await p2.waitForTimeout(300);
  for (let i = 0; i < 30; i++) {
    await p2.keyboard.press("Tab");
    if (await p2.evaluate(() => document.activeElement?.tagName === "SUMMARY" && document.activeElement?.textContent === "Menu")) break;
  }
  await p2.keyboard.press("Enter");
  await p2.keyboard.press("Tab");
  const f = await focusInfo(p2);
  return { ok: f.tag === "a" && /Data/.test(f.text), ...f };
});

await browser.close();
if (args.out) {
  fs.mkdirSync(path.dirname(path.resolve(siteDir, args.out)), { recursive: true });
  fs.writeFileSync(path.resolve(siteDir, args.out), JSON.stringify(steps, null, 2));
}
const failed = steps.filter((s) => !s.ok || s.visible === false);
console.log(failed.length ? `${failed.length} step(s) failed` : "keyboard walkthrough: every step works");
process.exit(failed.length ? 1 : 0);
