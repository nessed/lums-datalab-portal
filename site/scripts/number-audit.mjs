// The number audit: every check plug-in in scripts/checks/ run against the built
// output, without check-build's full HTML scan (round 2 change of plan: the full
// check-build runs after the foundations merge and on the final branch; between
// page merges this runs instead). Run after `npm run build`:
//   node scripts/number-audit.mjs
// The plug-ins recompute derived figures (series views, home and answer figures,
// sheets, compare transforms), the values in every downloadable file and the
// search answers from the release, and check the plain titles. What this does NOT
// do, and check-build does: prove every digit in every HTML page is a linked,
// checked value, and check that every derived figure on a page was claimed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(siteDir, "release.config.json"), "utf8"));
const rel = path.resolve(siteDir, "..", "releases", cfg.version);
const read = (n) => JSON.parse(fs.readFileSync(path.join(rel, n), "utf8"));
const slugify = (id) => id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");
const appDir = path.join(siteDir, ".next", "server", "app");
if (!fs.existsSync(appDir)) {
  console.error("number-audit: no build found; run `npm run build` first");
  process.exit(2);
}

// The same context check-build gives its plug-ins.
const release = read("release.json");
const seriesList = read("series.json");
const series = new Map(seriesList.map((s) => [s.series_id, s]));
const cells = new Map(read("cells.json").map((c) => [c.cell_id, c]));
const checks = new Map(read("checks.json").map((c) => [c.check_id, c]));
const sources = read("sources.json");
const sourceById = new Map(sources.map((s) => [s.source_id, s]));
const allObs = read("observations.json");
const published = (ds) => ["published", "candidate"].includes(release.dataset_status?.[ds]?.state);
const observations = allObs.filter((o) => published(series.get(o.series_id)?.dataset));
const isPub = (o) => !!o && o.published && o.value !== null && o.value !== undefined;
const problems = [];
const problem = (rule, where, msg) => problems.push({ rule, where, msg });
const derived = []; // filled only by check-build's HTML scan

const ctx = { siteDir, appDir, cfg, rel, read, slugify, isPub, release, seriesList, series, allObs, observations, cells, checks, sources, sourceById, problem, derived };
const dir = path.join(siteDir, "scripts", "checks");
for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".mjs")).sort()) {
  const mod = await import(pathToFileURL(path.join(dir, name)).href);
  const out = await mod.default(ctx);
  console.log(`number-audit: ${name}: ${out ?? "ran"}`);
}
if (problems.length) {
  for (const p of problems.slice(0, 60)) console.error(`  [${p.rule}] ${p.where}: ${p.msg}`);
  console.error(`number-audit: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("number-audit: OK");
