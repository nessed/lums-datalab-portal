// Copies the frozen release into public/ so the static site can serve page
// renders and downloads, and writes one JSON receipt per observation and one
// CSV per series. Plain Node, no dependencies, runs on Windows and Linux.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(siteDir, "release.config.json"), "utf8"));
const version = cfg.version;
const src = path.resolve(siteDir, "..", "releases", version);
const dest = path.join(siteDir, "public", "data", version);

if (!fs.existsSync(src)) {
  console.error(`prebuild: release folder not found: ${src}`);
  process.exit(1);
}

// Must match slugify() in src/lib/data.ts.
const slugify = (id) => id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(src, name), "utf8"));

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

if (fs.existsSync(path.join(src, "pages"))) {
  fs.cpSync(path.join(src, "pages"), path.join(dest, "pages"), { recursive: true });
}
if (fs.existsSync(path.join(src, "runs"))) {
  fs.cpSync(path.join(src, "runs"), path.join(dest, "runs"), { recursive: true });
}
for (const name of fs.readdirSync(src)) {
  if (/\.(json|csv|md|parquet)$/i.test(name)) {
    fs.copyFileSync(path.join(src, name), path.join(dest, name));
  }
}

const release = readJson("release.json");
const series = readJson("series.json");
const observations = readJson("observations.json");
const cells = readJson("cells.json");
const checks = readJson("checks.json");
const sources = readJson("sources.json");
const by = (rows, key) => new Map(rows.map((r) => [r[key], r]));
const seriesById = by(series, "series_id");
const cellById = by(cells, "cell_id");
const checkById = by(checks, "check_id");
const sourceById = by(sources, "source_id");

// One JSON receipt per observation: observation + cells + checks + sources.
const receiptDir = path.join(dest, "receipts");
fs.mkdirSync(receiptDir, { recursive: true });
for (const o of observations) {
  const cellIds = [o.primary_cell_id, ...(o.supporting_cell_ids ?? [])].filter(Boolean);
  const obsCells = cellIds.map((id) => cellById.get(id)).filter(Boolean);
  const obsChecks = (o.check_ids ?? []).map((id) => checkById.get(id)).filter(Boolean);
  const srcIds = [...new Set(obsCells.map((c) => c.source_id))];
  const receipt = {
    release: { version: release.version, label: release.label, doi: release.doi, created_at: release.created_at, git_commit: release.git_commit },
    observation: o,
    series: seriesById.get(o.series_id) ?? null,
    cells: obsCells,
    checks: obsChecks,
    sources: srcIds.map((id) => sourceById.get(id)).filter(Boolean),
  };
  fs.writeFileSync(path.join(receiptDir, `${slugify(o.obs_id)}.json`), JSON.stringify(receipt, null, 2));
}

// One CSV per series, with provenance columns.
const csvDir = path.join(dest, "series");
fs.mkdirSync(csvDir, { recursive: true });
const cols = [
  "obs_id", "series_id", "series_name", "dataset", "period", "vintage", "value", "unit", "scale_factor",
  "status", "tier", "published", "gap_kind", "gap_reason", "source_id", "source_title", "source_file_url",
  "source_sha256", "page", "cell_id", "value_as_printed", "check_ids", "derived_from", "evidence_summary", "release",
];
const esc = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const bySeries = new Map();
for (const o of observations) {
  if (!bySeries.has(o.series_id)) bySeries.set(o.series_id, []);
  bySeries.get(o.series_id).push(o);
}
for (const s of series) {
  const rows = (bySeries.get(s.series_id) ?? []).slice().sort((a, b) => (a.period + a.vintage < b.period + b.vintage ? -1 : 1));
  const lines = [cols.join(",")];
  for (const o of rows) {
    const cell = o.primary_cell_id ? cellById.get(o.primary_cell_id) : null;
    const source = cell ? sourceById.get(cell.source_id) : null;
    const rec = {
      obs_id: o.obs_id, series_id: o.series_id, series_name: s.name, dataset: s.dataset, period: o.period,
      vintage: o.vintage, value: o.published ? o.value : null, unit: o.unit, scale_factor: o.scale_factor,
      status: o.status, tier: o.tier, published: o.published, gap_kind: o.gap_kind, gap_reason: o.gap_reason,
      source_id: source?.source_id, source_title: source?.title, source_file_url: source?.file_url,
      source_sha256: source?.sha256, page: cell?.page, cell_id: cell?.cell_id, value_as_printed: cell?.value_raw,
      check_ids: (o.check_ids ?? []).join(" "), derived_from: (o.derived_from ?? []).join(" "),
      evidence_summary: o.evidence_summary, release: release.version,
    };
    lines.push(cols.map((c) => esc(rec[c])).join(","));
  }
  fs.writeFileSync(path.join(csvDir, `${slugify(s.series_id)}.csv`), lines.join("\n") + "\n");
}

console.log(`prebuild: copied release ${version} -> public/data/${version} (${observations.length} receipts, ${series.length} series CSVs)`);
