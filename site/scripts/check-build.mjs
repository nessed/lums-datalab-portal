// Sanity check of the built HTML. Run after `npm run build`:  node scripts/check-build.mjs
// - a value receipt contains the printed value and the positioned overlay box
// - a gap receipt contains no value and names its gap kind
// - every receipt has a prerendered page and a JSON download
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(siteDir, "release.config.json"), "utf8"));
const rel = path.resolve(siteDir, "..", "releases", cfg.version);
const read = (n) => JSON.parse(fs.readFileSync(path.join(rel, n), "utf8"));
const slugify = (id) => id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");
const htmlDir = path.join(siteDir, ".next", "server", "app", "o");

const release = read("release.json");
const series = new Map(read("series.json").map((s) => [s.series_id, s]));
const cells = new Map(read("cells.json").map((c) => [c.cell_id, c]));
const observations = read("observations.json").filter((o) => release.dataset_status?.[series.get(o.series_id)?.dataset]?.state === "published");

const problems = [];
let values = 0;
let gaps = 0;
let disputed = 0;
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

for (const o of observations) {
  const slug = slugify(o.obs_id);
  const file = path.join(htmlDir, `${slug}.html`);
  if (!fs.existsSync(file)) {
    problems.push(`${o.obs_id}: no prerendered HTML`);
    continue;
  }
  if (!fs.existsSync(path.join(siteDir, "public", "data", cfg.version, "receipts", `${slug}.json`))) problems.push(`${o.obs_id}: no JSON receipt`);
  // Look only at the server-rendered markup, not the serialized React payload in <script> tags.
  const html = fs.readFileSync(file, "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  if (o.published) {
    values++;
    const cell = o.primary_cell_id ? cells.get(o.primary_cell_id) : null;
    if (!html.includes("data-receipt-value")) problems.push(`${o.obs_id}: value block missing`);
    if (cell) {
      if (!html.includes(esc(cell.value_raw))) problems.push(`${o.obs_id}: printed value ${cell.value_raw} not in HTML`);
      if (!new RegExp(`data-cell-box="${cell.cell_id}" style="left:[\\d.]+%;top:[\\d.]+%;width:[\\d.]+%;height:[\\d.]+%"`).test(html))
        problems.push(`${o.obs_id}: overlay box style missing`);
    }
  } else if (o.status === "disputed") {
    // Disputed: no single value; every printing is listed with its printed text.
    disputed++;
    if (html.includes("data-receipt-value")) problems.push(`${o.obs_id}: disputed receipt shows a single value`);
    if (!html.includes("data-receipt-disputed")) problems.push(`${o.obs_id}: disputed status not shown`);
    const ids = Array.isArray(o.disputed_readings)
      ? o.disputed_readings.map((r) => (typeof r === "string" ? r : r?.cell_id)).filter(Boolean)
      : [o.primary_cell_id, ...(o.supporting_cell_ids ?? [])].filter(Boolean);
    for (const id of ids) {
      const c = cells.get(id);
      if (c && c.value_raw && !html.includes(esc(c.value_raw))) problems.push(`${o.obs_id}: disputed printing ${c.value_raw} (${id}) not listed`);
    }
  } else {
    gaps++;
    if (html.includes("data-receipt-value") || html.includes("data-printed")) problems.push(`${o.obs_id}: gap receipt shows a value`);
    if (!html.includes(`data-receipt-gap="${o.gap_kind ?? "unknown"}"`)) problems.push(`${o.obs_id}: gap kind not shown`);
    // A page box is allowed only where the government printed no figure (a dash
    // or a blank): the page is then the evidence for the gap. Never for a figure
    // that is unverified or withheld, whose reading must not be shown.
    const cell = o.primary_cell_id ? cells.get(o.primary_cell_id) : null;
    const boxAllowed = o.gap_kind === "not_in_source" && cell && (cell.value_parsed === null || cell.value_parsed === undefined || cell.value_parsed === "");
    if (html.includes("cell-box") && !boxAllowed) problems.push(`${o.obs_id}: gap receipt shows a page box`);
  }
}

console.log(`check-build: ${values} value receipts, ${gaps} gap receipts, ${disputed} disputed receipts checked`);
if (problems.length) {
  console.error(problems.slice(0, 40).join("\n"));
  console.error(`check-build: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("check-build: OK");
