// Route list for the QA scripts, built from the release so it keeps working as
// series, periods and statuses are added. Shared by screenshot.mjs and a11y.mjs.
import fs from "node:fs";
import path from "node:path";

export function qaRoutes(siteDir) {
  const cfg = JSON.parse(fs.readFileSync(path.join(siteDir, "release.config.json"), "utf8"));
  const rel = path.resolve(siteDir, "..", "releases", cfg.version);
  const read = (n) => JSON.parse(fs.readFileSync(path.join(rel, n), "utf8"));
  const release = read("release.json");
  const series = read("series.json");
  const observations = read("observations.json");
  const sources = read("sources.json");
  const slugify = (id) => id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");

  const published = (ds) => release.dataset_status?.[ds]?.state === "published";
  const visible = series.filter((s) => published(s.dataset));
  const visibleIds = new Set(visible.map((s) => s.series_id));
  const obsOf = (id) => observations.filter((o) => o.series_id === id);
  const pick = (list, pref) => list.find(pref) ?? list[0];

  const withBreak = pick(
    visible.filter((s) => (s.breaks ?? []).length > 0 && !s.derived),
    (s) => /health/.test(s.series_id),
  );
  const gapCount = (s) => obsOf(s.series_id).filter((o) => !o.published).length;
  const withGaps = [...visible].filter((s) => !s.derived).sort((a, b) => gapCount(b) - gapCount(a))[0];
  const monthly = pick(
    visible.filter((s) => s.frequency === "month" && s.unit === "index" && s !== withGaps),
    (s) => /general|overall/i.test(s.series_id),
  );

  const visObs = observations.filter((o) => visibleIds.has(o.series_id));
  const tierA = pick(
    visObs.filter((o) => o.published && o.tier === "A"),
    (o) => withBreak && o.series_id === withBreak.series_id,
  );
  const gap = pick(
    visObs.filter((o) => !o.published),
    (o) => o.gap_kind === "not_in_source",
  );
  const disputed = visObs.find((o) => o.status === "disputed");
  const withheld = visObs.find((o) => o.gap_kind === "failed_checks" && o.obs_id.startsWith("fed.exp.current.function.economic_affairs.other_industries:2021-22")) ?? visObs.find((o) => o.gap_kind === "failed_checks");
  const cpiReceipt = visObs.find((o) => o.published && series.find((s) => s.series_id === o.series_id)?.dataset === "cpi");
  const source = pick(
    sources.filter((s) => (s.pages_used ?? []).length > 0),
    (s) => s.doc_type === "abs",
  );

  const cells = read("cells.json");
  const coverage = read("coverage.json");
  const summary = coverage.find((c) => /Summary of Expenditure/.test(c.table) && c.source_id === "abs-fed-2025-26") ?? coverage[0];
  const tcell = summary ? cells.find((c) => c.source_id === summary.source_id && c.page === summary.page) : null;
  const lfsCov = coverage.find((c) => c.dataset === "lfs");
  const lcell = lfsCov ? cells.find((c) => c.source_id === lfsCov.source_id && c.page === lfsCov.page) : null;
  const tslug = (c) => slugify(`${c.source_id}~p${c.page}~t${c.table_index}`);
  const provincial = visible.find((s) => s.geo === "pk-sd" && !s.derived && obsOf(s.series_id).some((o) => o.published));

  return [
    ["home", "/"],
    ["browse", "/browse"],
    ["datasets", "/datasets"],
    ["dataset-abs", "/datasets/abs"],
    ["dataset-cpi", "/datasets/cpi"],
    ["dataset-lfs", "/datasets/lfs"],
    tcell && ["table-abs", `/tables/${tslug(tcell)}`],
    lcell && ["table-lfs", `/tables/${tslug(lcell)}`],
    provincial && ["series-provincial", `/series/${slugify(provincial.series_id)}`],
    withBreak && ["series-break", `/series/${slugify(withBreak.series_id)}`],
    withGaps && ["series-gaps", `/series/${slugify(withGaps.series_id)}`],
    monthly && ["series-monthly", `/series/${slugify(monthly.series_id)}`],
    tierA && ["receipt-tierA", `/o/${slugify(tierA.obs_id)}`],
    cpiReceipt && ["receipt-cpi", `/o/${slugify(cpiReceipt.obs_id)}`],
    gap && ["receipt-gap", `/o/${slugify(gap.obs_id)}`],
    disputed && ["receipt-disputed", `/o/${slugify(disputed.obs_id)}`],
    withheld && ["receipt-withheld", `/o/${slugify(withheld.obs_id)}`],
    ["sources", "/sources"],
    source && ["source", `/sources/${slugify(source.source_id)}`],
    ["methods", "/methods"],
    ["releases", "/releases"],
    ["demo", "/demo/health-and-jobs"],
    ["compare", "/compare"],
    ["compare-mixed", "/compare?s=cpi.national.yoy.general,lfs.unemployment_rate.total.total,fed.exp.total"],
    ["api", "/api"],
    ["data", "/data"],
    ["about", "/about"],
    ["404", "/no-such-page"],
  ].filter(Boolean);

}
