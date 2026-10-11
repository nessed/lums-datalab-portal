// Checks the built HTML against the release. Run after `npm run build`:
//   node scripts/check-build.mjs
//
// 1. Receipts (one per observation of a published data type):
//    - a value receipt holds the printed value and the positioned box over the page;
//    - a gap receipt holds no value and names its gap kind; a page box only where
//      the government printed no figure;
//    - a disputed receipt lists every printing and no single value;
//    - every receipt has a JSON download.
// 2. Every page: every digit a reader can see is accounted for.
//    - a data value is a link to an existing receipt (data-v), and its text is the
//      value the release stores for that figure (or the printed text of one of its
//      cells, data-v-cell);
//    - a count or rate (data-count) equals the same count recomputed here,
//      independently, from the release files;
//    - a period, date, page label, id, version, axis tick, threshold or printed
//      reading (data-num) is checked for its kind: a printed reading may appear only
//      where the figure is published, or inside a check that passed;
//    - any other text with a digit must be a label copied from the release (a series
//      name, a document title, a printed row label...), or the check fails.
// 3. Every internal link to a receipt, series, table, data type or document exists.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { facetCounts } from "../src/lib/facets.mjs";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(siteDir, "release.config.json"), "utf8"));
const rel = path.resolve(siteDir, "..", "releases", cfg.version);
const read = (n) => JSON.parse(fs.readFileSync(path.join(rel, n), "utf8"));
const slugify = (id) => id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");
const appDir = path.join(siteDir, ".next", "server", "app");
const htmlDir = path.join(appDir, "o");

const release = read("release.json");
const seriesList = read("series.json");
const series = new Map(seriesList.map((s) => [s.series_id, s]));
const cellList = read("cells.json");
const cells = new Map(cellList.map((c) => [c.cell_id, c]));
const checkList = read("checks.json");
const checks = new Map(checkList.map((c) => [c.check_id, c]));
const sources = read("sources.json");
const sourceById = new Map(sources.map((s) => [s.source_id, s]));
const coverage = read("coverage.json");
const allObs = read("observations.json");
const published = (ds) => release.dataset_status?.[ds]?.state === "published";
const observations = allObs.filter((o) => published(series.get(o.series_id)?.dataset));
const obsBySlug = new Map(allObs.map((o) => [slugify(o.obs_id), o]));
const isPub = (o) => !!o && o.published && o.value !== null && o.value !== undefined;

const problems = [];
const problem = (rule, where, msg) => problems.push({ rule, where, msg });
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/* ------------------------------------------------------------------ */
/* 1. receipts                                                         */
/* ------------------------------------------------------------------ */
let values = 0;
let gaps = 0;
let disputed = 0;
for (const o of observations) {
  const slug = slugify(o.obs_id);
  const file = path.join(htmlDir, `${slug}.html`);
  if (!fs.existsSync(file)) {
    problem("receipt", o.obs_id, "no prerendered HTML");
    continue;
  }
  if (!fs.existsSync(path.join(siteDir, "public", "data", cfg.version, "receipts", `${slug}.json`))) problem("receipt", o.obs_id, "no JSON receipt");
  // Only the server-rendered markup, not the serialized React payload in <script> tags.
  const html = fs.readFileSync(file, "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  // Every subtracted member (member_signs -1) of every check on the receipt is marked as subtracted (S1).
  const minusWanted = (o.check_ids ?? []).reduce((n, id) => {
    const ch = checks.get(id);
    return n + (ch?.member_signs ?? []).filter((s, i) => s === -1 && cells.has(ch.member_cell_ids[i])).length;
  }, 0);
  const minusFound = (html.match(/data-member-sign="-1"/g) ?? []).length;
  if (minusFound !== minusWanted) problem("receipt", o.obs_id, `${minusWanted} subtracted members, ${minusFound} marked as subtracted`);
  if (o.published) {
    values++;
    const cell = o.primary_cell_id ? cells.get(o.primary_cell_id) : null;
    if (!html.includes("data-receipt-value")) problem("receipt", o.obs_id, "value block missing");
    if (cell) {
      if (!html.includes(esc(cell.value_raw))) problem("receipt", o.obs_id, `printed value ${cell.value_raw} not in HTML`);
      if (!new RegExp(`data-cell-box="${cell.cell_id}" style="left:[\\d.]+%;top:[\\d.]+%;width:[\\d.]+%;height:[\\d.]+%"`).test(html))
        problem("receipt", o.obs_id, "overlay box style missing");
    }
  } else if (o.status === "disputed") {
    disputed++;
    if (html.includes("data-receipt-value")) problem("receipt", o.obs_id, "disputed receipt shows a single value");
    if (!html.includes("data-receipt-disputed")) problem("receipt", o.obs_id, "disputed status not shown");
    const ids = Array.isArray(o.disputed_readings)
      ? o.disputed_readings.map((r) => (typeof r === "string" ? r : r?.cell_id)).filter(Boolean)
      : [o.primary_cell_id, ...(o.supporting_cell_ids ?? [])].filter(Boolean);
    for (const id of ids) {
      const c = cells.get(id);
      if (c && c.value_raw && !html.includes(esc(c.value_raw))) problem("receipt", o.obs_id, `disputed printing ${c.value_raw} (${id}) not listed`);
    }
  } else {
    gaps++;
    if (html.includes("data-receipt-value")) problem("receipt", o.obs_id, "gap receipt shows a value");
    if (!html.includes(`data-receipt-gap="${o.gap_kind ?? "unknown"}"`)) problem("receipt", o.obs_id, "gap kind not shown");
    // A page box only where the government printed no figure (a dash or a blank).
    const cell = o.primary_cell_id ? cells.get(o.primary_cell_id) : null;
    const boxAllowed = o.gap_kind === "not_in_source" && cell && (cell.value_parsed === null || cell.value_parsed === undefined || cell.value_parsed === "");
    if (html.includes("cell-box") && !boxAllowed) problem("receipt", o.obs_id, "gap receipt shows a page box");
  }
}

/* ------------------------------------------------------------------ */
/* Independent recomputation of everything the pages count             */
/* ------------------------------------------------------------------ */
const visibleSeries = seriesList.filter((s) => published(s.dataset));
const obsBySeries = new Map();
for (const o of allObs) {
  if (!obsBySeries.has(o.series_id)) obsBySeries.set(o.series_id, []);
  obsBySeries.get(o.series_id).push(o);
}
const obsOfCell = new Map();
for (const o of allObs) {
  if (o.primary_cell_id) obsOfCell.set(o.primary_cell_id, o);
  for (const c of o.supporting_cell_ids ?? []) if (!obsOfCell.has(c)) obsOfCell.set(c, o);
}
const dsOf = (o) => series.get(o.series_id)?.dataset;
const pubIn = (pred) => observations.filter((o) => isPub(o) && pred(o)).length;
const primarySrc = (o) => (o.primary_cell_id ? cells.get(o.primary_cell_id)?.source_id : undefined);

// Printed tables, grouped the way the site groups them (best reading per table).
const tableGroups = new Map();
for (const c of cellList) {
  const k = `${c.source_id}|${c.page}|${c.table_index}|${c.extractor_name}`;
  if (!tableGroups.has(k)) tableGroups.set(k, []);
  tableGroups.get(k).push(c);
}
const bestTable = new Map();
const tscore = (cs) => cs.filter((c) => isPub(obsOfCell.get(c.cell_id))).length;
for (const cs of tableGroups.values()) {
  const k = slugify(`${cs[0].source_id}~p${cs[0].page}~t${cs[0].table_index}`);
  const cur = bestTable.get(k);
  if (!cur || tscore(cs) > tscore(cur) || (tscore(cs) === tscore(cur) && cs.length > cur.length)) bestTable.set(k, cs);
}

const facetTotals = facetCounts(visibleSeries);

function countFor(key) {
  const p = key.split(":");
  const [a, b, c, d, e] = p;
  switch (a) {
    case "series":
      return b ? visibleSeries.filter((s) => s.dataset === b).length : visibleSeries.length;
    case "values":
      if (!b) return pubIn(() => true);
      if (b === "series" && d === "source") return pubIn((o) => o.series_id === c && primarySrc(o) === e);
      if (b === "series") return pubIn((o) => o.series_id === c);
      if (b === "source") return allObs.filter((o) => isPub(o) && primarySrc(o) === c).length;
      return pubIn((o) => dsOf(o) === b);
    case "obs":
      if (b === "series") return (obsBySeries.get(c) ?? []).length;
      break;
    case "docs": {
      const pred = b === "series" ? (o) => o.series_id === c : (o) => dsOf(o) === b;
      return new Set(observations.filter((o) => isPub(o) && pred(o)).map(primarySrc).filter(Boolean)).size;
    }
    case "gaps": {
      const inDs = observations.filter((o) => dsOf(o) === b && !isPub(o));
      if (!c) return inDs.length;
      return inDs.filter((o) => (c === "disputed" ? o.status === "disputed" : o.status !== "disputed" && o.gap_kind === c)).length;
    }
    case "pages":
      if (b === "source") return (sourceById.get(c)?.pages_used ?? []).length;
      break;
    case "sources":
      if (b === "read") return sources.filter((s) => (s.pages_used ?? []).length > 0).length;
      if (b === "all") return sources.length;
      if (b === "type") return sources.filter((s) => s.doc_type === c).length;
      break;
    case "src": {
      let v = sourceById.get(b);
      for (const part of p.slice(2).join(":").split(".")) v = v?.[part];
      return typeof v === "number" ? v : null;
    }
    case "covrow": {
      const row = coverage.filter((r) => r.source_id === b)[Number(c)];
      return typeof row?.[d] === "number" ? row[d] : null;
    }
    case "coverage": {
      if (b !== "source") break;
      const rows = coverage.filter((r) => r.source_id === c);
      const printed = rows.reduce((x, r) => x + (r.printed_numeric_tokens ?? 0), 0);
      const matched = rows.reduce((x, r) => x + (r.matched ?? 0), 0);
      if (d === "matched") return matched;
      if (d === "printed") return printed;
      if (d === "tables") return rows.length;
      return printed > 0 ? matched / printed : null;
    }
    case "checktype":
      return Object.values(release.counts?.checks_by_type?.[b] ?? {}).reduce((x, y) => x + y, 0);
    case "datasets":
      if (b === "published") return Object.keys(release.dataset_status ?? {}).filter(published).length;
      if (b === "all") return new Set([...Object.keys(release.dataset_status ?? {}), ...seriesList.map((s) => s.dataset)]).size;
      break;
    case "checks":
      if (b === "obs") return (allObs.find((o) => o.obs_id === p.slice(2).join(":"))?.check_ids ?? []).filter((id) => checks.has(id)).length;
      break;
    case "cells":
      if (b === "check") {
        const ch = checks.get(p.slice(2).join(":"));
        return ch ? ch.member_cell_ids.filter((id) => cells.has(id)).length + (ch.target_cell_id && cells.has(ch.target_cell_id) ? 1 : 0) : null;
      }
      break;
    case "release": {
      let v = release;
      for (const part of p.slice(1).join(":").split(".")) v = v?.[part];
      return typeof v === "number" ? v : null;
    }
    case "facet":
      return facetTotals[b]?.get(p.slice(2).join(":")) ?? null;
    case "facetvalues":
      return facetTotals[b]?.size ?? null;
    case "tables":
      if (b === "source") return [...bestTable.values()].filter((cs) => cs[0].source_id === c && cs.some((x) => published(series.get(x.series_id)?.dataset))).length;
      break;
    case "table": {
      const cs = bestTable.get(b);
      if (!cs) return null;
      const st = cs.map((x) => obsOfCell.get(x.cell_id));
      if (c === "values") return st.filter((o) => isPub(o)).length;
      if (c === "gaps") return st.filter((o) => o && !isPub(o)).length;
      if (c === "none") return st.filter((o) => !o).length;
      break;
    }
  }
  return undefined;
}

const fmtDec = (v) => {
  const m = /^([+-]?)(\d+)(\.\d+)?$/.exec(String(v).trim());
  if (!m) return String(v).trim();
  return `${m[1] === "-" ? "−" : ""}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${m[3] ?? ""}`;
};
const fmtPct = (r) => {
  if (r === null || r === undefined || Number.isNaN(r)) return "not available";
  const v = r * 100;
  return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}%`;
};

/* ------------------------------------------------------------------ */
/* Text that may carry digits without an annotation: release labels    */
/* ------------------------------------------------------------------ */
const norm = (s) => s.replace(/\s+/g, " ").trim();
const labels = new Set();
const addL = (s) => {
  if (s === null || s === undefined) return;
  const t = norm(String(s));
  if (t) labels.add(t);
};
for (const s of seriesList) {
  addL(s.name);
  addL(s.definition);
  addL(s.notes);
  addL(s.series_id);
  for (const b of s.breaks ?? []) {
    addL(b.note);
    addL(b.at_period);
  }
  for (const v of Object.values(s.dims ?? {})) {
    addL(v);
    addL(String(v).replaceAll("_", " "));
  }
  if (s.synonyms?.length) addL(s.synonyms.join(", "));
}
for (const s of sources) {
  addL(s.title);
  addL(s.publisher);
  addL(s.period);
  addL(s.notes);
  addL(s.source_id);
}
for (const [k, v] of Object.entries(release.dataset_status ?? {})) {
  addL(v.name);
  for (const r of v.reasons ?? []) addL(r);
  addL(k);
}
for (const c of coverage) addL(c.table);
for (const c of cellList) {
  addL(c.row_label_raw);
  addL(c.col_label_raw);
}
for (const o of allObs) addL(o.gap_reason);
for (const c of checkList) addL(c.tolerance_rule);
addL(release.version);
addL(release.label);

const periods = new Set();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const addP = (p) => {
  if (!p) return;
  periods.add(p);
  const y = /^(\d{4})/.exec(p);
  if (y) periods.add(y[1]);
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    periods.add(`${MONTHS[Number(m[2]) - 1]} ${m[1]}`);
    periods.add(`${MONTHS[Number(m[2]) - 1].slice(0, 3)} ${m[1]}`);
  }
};
for (const o of allObs) addP(o.period);
for (const s of sources) addP(s.period);
for (const s of seriesList) {
  for (const b of s.breaks ?? []) addP(b.at_period);
  if (s.dims?.base_year) addP(s.dims.base_year);
}
for (const ps of Object.values(release.scope?.periods ?? {})) for (const p of ps) addP(p);

const thresholdsFile = path.resolve(siteDir, "..", "thresholds", "thresholds.yaml");
const thresholdTexts = new Set();
if (fs.existsSync(thresholdsFile))
  for (const m of fs.readFileSync(thresholdsFile, "utf8").matchAll(/:\s*(\d+(?:\.\d+)?)/g)) {
    const n = Number(m[1]);
    for (const t of [fmtPct(n), `≥ ${fmtPct(n)}`, `≤ ${fmtPct(n)}`, m[1]]) thresholdTexts.add(t);
  }
thresholdTexts.add("residual 0");

/** May this check's wording be shown on the receipt of `obs`? Mirrors the site's rule. */
function evidenceAllowed(check, obs) {
  if (!check || !obs) return false;
  const gap = !isPub(obs) && obs.status !== "disputed";
  if (gap) return false;
  if (check.result === "pass" || check.result === "pass_within_rounding") return true;
  if (check.result === "disputed" && obs.status === "disputed") return true;
  const ids = [...check.member_cell_ids, ...(check.target_cell_id ? [check.target_cell_id] : [])];
  return ids.every((id) => isPub(obsOfCell.get(id)));
}

/* ------------------------------------------------------------------ */
/* 2. every page                                                       */
/* ------------------------------------------------------------------ */
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "path", "circle", "rect", "line", "polyline", "polygon", "use", "stop"]);
const SKIP = new Set(["script", "style", "template", "noscript", "title", "desc", "head"]);
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", hellip: "…", middot: "·", ndash: "–", mdash: "—", minus: "−" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENT[e] ?? m),
  );
// Fixed names with digits in them: algorithms, licences, typefaces, standards.
const NAMES = /SHA-256|CC BY 4\.0|Source Serif 4|Source Sans 3|ISO 8601|\b1[39]th ICLS\b|UTF-8|WCAG 2\.\d|Python 3|\bR 4\b/g;
const attrRe = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
function parseAttrs(s) {
  const out = {};
  if (!s) return out;
  for (const m of s.matchAll(attrRe)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

const mdCache = new Map();
const counters = { pages: 0, values: 0, counts: 0, labels: 0, nums: {} };
const linkTargets = { o: new Set(), series: new Set(), tables: new Set(), datasets: new Set(), sources: new Set() };

function validateAnnotated(el, text, page) {
  const t = norm(text);
  const a = el.attrs;
  if ("data-v" in a) {
    counters.values++;
    const href = el.tag === "a" ? a.href : null;
    const m = href ? /^\/o\/([^?#]+)/.exec(href) : null;
    if (!m) return problem("value-link", page, `value "${t}" is not a link to a receipt`);
    const o = obsBySlug.get(decodeURIComponent(m[1]));
    if (!o || !published(series.get(o.series_id)?.dataset)) return problem("value-link", page, `value "${t}" links to an unknown receipt ${href}`);
    if (!isPub(o)) return problem("value-unchecked", page, `value "${t}" links to ${o.obs_id}, which is not a published figure`);
    if (a["data-v-cell"]) {
      const c = cells.get(a["data-v-cell"]);
      const own = [o.primary_cell_id, ...(o.supporting_cell_ids ?? [])];
      if (!c || !own.includes(c.cell_id)) return problem("value-text", page, `value "${t}" names cell ${a["data-v-cell"]}, which is not a printing of ${o.obs_id}`);
      if (norm(c.value_raw ?? "") !== t) return problem("value-text", page, `value "${t}" differs from the printed text "${c.value_raw}" of ${c.cell_id}`);
    } else if (t !== fmtDec(o.value)) return problem("value-text", page, `value "${t}" differs from the release value ${o.value} of ${o.obs_id}`);
    return;
  }
  if ("data-v-self" in a) {
    counters.values++;
    const o = allObs.find((x) => x.obs_id === a["data-v-self"]);
    if (!o || !page.startsWith(`/o/${slugify(o.obs_id)}`)) return problem("value-self", page, `figure "${t}" is shown as this page's own value but the page is not its receipt`);
    if (!isPub(o)) return problem("value-unchecked", page, `figure "${t}" (${o.obs_id}) is not published`);
    if (t !== fmtDec(o.value) && t !== String(o.value)) problem("value-text", page, `figure "${t}" differs from the release value ${o.value}`);
    return;
  }
  if ("data-count" in a) {
    counters.counts++;
    const want = countFor(a["data-count"]);
    if (want === undefined) return problem("count-key", page, `unknown count key "${a["data-count"]}"`);
    if (want === null) return problem("count", page, `count "${a["data-count"]}" has no value in the release`);
    const got = a["data-fmt"] === "pct" ? fmtPct(want) : fmtDec(String(want));
    if (t !== got) problem("count", page, `count ${a["data-count"]} shows "${t}" but the release gives ${got}`);
    return;
  }
  const kind = a["data-num"];
  counters.nums[kind] = (counters.nums[kind] ?? 0) + 1;
  const pageObs = page.startsWith("/o/") ? obsBySlug.get(decodeURIComponent(page.slice(3).split(/[?#]/)[0])) : null;
  switch (kind) {
    case "period": {
      const tokens = t.match(/\b\d{4}(?:-\d{2})?\b|[A-Z][a-z]+ \d{4}/g) ?? [];
      if (!periods.has(t) && !tokens.every((x) => periods.has(x))) problem("period", page, `"${t}" is not a period of the release`);
      break;
    }
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t) && t !== "not recorded") problem("date", page, `"${t}" is not a date`);
      break;
    case "version":
      if (t !== release.version && !allObs.some((o) => o.first_published_release === t || o.last_changed_release === t)) problem("version", page, `"${t}" is not the release version`);
      break;
    case "page":
      if (/\d{1,3},\d{3}|\d\.\d/.test(t)) problem("page", page, `page label "${t}" looks like a figure`);
      break;
    case "threshold":
      if (!thresholdTexts.has(t)) problem("threshold", page, `threshold "${t}" is not in thresholds.yaml`);
      break;
    case "approx": {
      const o = a["data-obs"] ? allObs.find((x) => x.obs_id === a["data-obs"]) : pageObs;
      if (!isPub(o)) problem("approx", page, `approximate amount "${t}" is not tied to a published figure`);
      break;
    }
    case "text":
      if (t && !labels.has(t)) problem("text", page, `"${t}" is marked as a release label but is not one`);
      break;
    case "evidence": {
      if (a["data-check"]) {
        if (!pageObs) problem("evidence", page, `check wording outside a receipt (${a["data-check"]})`);
        else if (!evidenceAllowed(checks.get(a["data-check"]), pageObs)) problem("evidence", page, `check ${a["data-check"]} quotes figures that are not published, on the receipt of ${pageObs.obs_id}`);
      } else if (a["data-obs"]) {
        const o = allObs.find((x) => x.obs_id === a["data-obs"]);
        if (!o || !(isPub(o) || o.status === "disputed") || !pageObs || o.obs_id !== pageObs.obs_id) problem("evidence", page, `evidence text of ${a["data-obs"]} where it may not be shown`);
      } else problem("evidence", page, "evidence text without a check or figure");
      break;
    }
    case "printed": {
      const id = a["data-cell"] ?? "";
      if (id.startsWith("residual:") || id.startsWith("target:")) {
        const ch = checks.get(id.slice(id.indexOf(":") + 1));
        if (!pageObs || !evidenceAllowed(ch, pageObs)) problem("printed", page, `"${t}" from check ${id} on a receipt where its figures are not all published`);
        break;
      }
      const c = cells.get(id);
      if (!c) {
        problem("printed", page, `printed reading "${t}" names no cell`);
        break;
      }
      if (norm(c.value_raw ?? "") !== t) problem("printed", page, `printed reading "${t}" differs from cell ${id} ("${c.value_raw}")`);
      const o = obsOfCell.get(id);
      const inCheck = el.inCheck ? checks.get(el.inCheck) : null;
      const ok =
        isPub(o) ||
        (o && o.status === "disputed" && pageObs && pageObs.obs_id === o.obs_id) ||
        (!o && inCheck && (inCheck.result === "pass" || inCheck.result === "pass_within_rounding"));
      if (!ok) problem("printed-unchecked", page, `printed reading "${t}" (${id}) shown although its figure is not published`);
      break;
    }
    case "md": {
      // Text rendered from a release Markdown file (or a file under docs/): every
      // number in it must be in that file.
      const f = a["data-file"] ?? "";
      const full = f.startsWith("repo:") ? path.resolve(siteDir, "..", f.slice(5)) : path.join(rel, f);
      if (!fs.existsSync(full)) {
        problem("md", page, `Markdown file ${f} not found`);
        break;
      }
      const src = mdCache.get(full) ?? fs.readFileSync(full, "utf8");
      mdCache.set(full, src);
      for (const tok of t.match(/\d[\d,.]*\d|\d/g) ?? []) if (!src.includes(tok)) problem("md", page, `"${tok}" is not in ${f}`);
      break;
    }
    case "id":
    case "ui":
    case "axis":
    case "cite":
      break;
    default:
      problem("annotation", page, `unknown data-num kind "${kind}"`);
  }
}

function scanPage(file, page) {
  const html = fs.readFileSync(file, "utf8");
  counters.pages++;
  const stack = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  const bodyAt = html.indexOf("<body");
  re.lastIndex = bodyAt >= 0 ? bodyAt : 0;
  while ((m = re.exec(html))) {
    if (m[0].startsWith("<!--")) continue;
    if (m[5] !== undefined) {
      const text = decode(m[5]);
      // Names that carry digits but are not numbers.
      if (!/\d/.test(text.replace(NAMES, ""))) {
        for (const el of stack) if (el.ann) el.parts.push(text);
        continue;
      }
      let ann = null;
      for (let i = stack.length - 1; i >= 0; i--)
        if (stack[i].ann) {
          ann = stack[i];
          break;
        }
      for (const el of stack) if (el.ann) el.parts.push(text);
      if (!ann) {
        const t = norm(text);
        if (labels.has(t) || periods.has(t) || t === release.version) counters.labels++;
        else problem("unmarked-digit", page, `"${t.slice(0, 90)}" in <${stack.map((s) => s.tag).slice(-3).join(">")}> is not a value link, a recomputed count or a release label`);
      }
      continue;
    }
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (!closing && SKIP.has(tag)) {
      const end = html.indexOf(`</${tag}`, re.lastIndex);
      re.lastIndex = end < 0 ? html.length : end;
      continue;
    }
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          const done = stack.splice(i);
          for (const el of done.reverse()) {
            if (!el.ann) continue;
            // Markdown is checked token by token, so its text nodes are kept apart.
            const text = el.parts.join(el.attrs["data-num"] === "md" ? " " : "");
            if (/\d/.test(text)) validateAnnotated(el, text, page);
          }
          break;
        }
      }
      continue;
    }
    const attrs = parseAttrs(m[3]);
    if (tag === "a" && attrs.href) {
      const hm = /^\/(o|series|tables|datasets|sources)\/([^?#]+)/.exec(attrs.href);
      if (hm) linkTargets[hm[1]].add(decodeURIComponent(hm[2]));
    }
    if (VOID.has(tag) || m[4] === "/") continue;
    const ann = "data-v" in attrs || "data-v-self" in attrs || "data-count" in attrs || "data-num" in attrs;
    const parentCheck = stack.length ? stack[stack.length - 1].inCheck : null;
    stack.push({ tag, attrs, ann, parts: [], inCheck: attrs["data-check"] && !attrs["data-num"] ? attrs["data-check"] : parentCheck });
  }
}

function walk(dir, base) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, `${base}/${name}`);
    else if (name.endsWith(".html") && !name.startsWith("_global-error")) {
      const route = `${base}/${name.replace(/\.html$/, "")}`.replace(/\/index$/, "") || "/";
      scanPage(full, route === "/page" ? "/" : route);
    }
  }
}
walk(appDir, "");

/* ------------------------------------------------------------------ */
/* 3. internal links                                                   */
/* ------------------------------------------------------------------ */
const exists = (sub, id) => fs.existsSync(path.join(appDir, sub, `${id}.html`));
for (const id of linkTargets.o) if (!exists("o", id)) problem("link", `/o/${id}`, "linked receipt does not exist");
for (const id of linkTargets.series) if (!exists("series", id)) problem("link", `/series/${id}`, "linked series page does not exist");
for (const id of linkTargets.tables) if (!exists("tables", id)) problem("link", `/tables/${id}`, "linked table page does not exist");
for (const id of linkTargets.datasets) if (!exists("datasets", id)) problem("link", `/datasets/${id}`, "linked data type page does not exist");
for (const id of linkTargets.sources) if (!exists("sources", id)) problem("link", `/sources/${id}`, "linked document page does not exist");

/* ------------------------------------------------------------------ */
console.log(`check-build: ${values} value receipts, ${gaps} gap receipts, ${disputed} disputed receipts checked`);
console.log(
  `check-build: ${counters.pages} pages scanned; ${counters.values} value links, ${counters.counts} counts recomputed, ${counters.labels} release labels; other digits by kind: ${Object.entries(counters.nums)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ")}`,
);
console.log(
  `check-build: links checked: ${linkTargets.o.size} receipts, ${linkTargets.series.size} series, ${linkTargets.tables.size} tables, ${linkTargets.datasets.size} data types, ${linkTargets.sources.size} documents`,
);
// Every problem, for whoever is fixing them.
fs.writeFileSync(path.join(siteDir, ".next", "check-build-problems.json"), JSON.stringify(problems, null, 1));
if (problems.length) {
  const byRule = new Map();
  for (const p of problems) {
    if (!byRule.has(p.rule)) byRule.set(p.rule, []);
    byRule.get(p.rule).push(p);
  }
  for (const [rule, list] of byRule) {
    console.error(`\n[${rule}] ${list.length} problem(s)`);
    const seen = new Set();
    for (const p of list) {
      const k = p.msg.replace(/\d+/g, "#");
      if (seen.has(k) && seen.size > 25) continue;
      seen.add(k);
      console.error(`  ${p.where}: ${p.msg}`);
      if (seen.size > 40) break;
    }
  }
  console.error(`\ncheck-build: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("check-build: OK");
