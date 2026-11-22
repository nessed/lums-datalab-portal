// Search index (DESIGN.md section 10), written to public/data/<version>/search.json.
// Read through the adapter (src/lib/adapter/datalab.ts), so the reader status
// and the kind of figure are the adapter's decisions, not this file's. Values
// are formatted with the site's own short-scale rule (src/lib/words.ts).
// scripts/checks/search-index.mjs checks every value here against the release.
//
// What goes in, kept small (budget: 40 KB compressed, loaded on first focus):
//   s  every visible series: plain title (n, editorial/titles.json, through the
//      adapter), printed name (pn, when it differs), synonyms, printed row label, unit, periods,
//      geography, and its latest checked value (short form, kind, period,
//      receipt). A candidate's value is marked; it never enters the headline
//      layer or an answer card (decision 17.1).
//   d  every source document;  t  every table as printed of a visible data type;
//   c  every concept of editorial/concepts.json, with its answer: the checked,
//      signed-off values of its headline series, each with its source marker;
//   m  the release id and the word equivalences.
//
// A second file, spark.json, holds the sparkline of every visible series (its
// checked values of its main kind of figure, in segments that break at gaps and
// series breaks, as the full chart does). It is fetched only after the results
// show, so it never counts against the index budget. Its numbers are the stored
// values of checked figures; scripts/checks/search-index.mjs recomputes it all.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";

const imp = (siteDir, rel) => import(pathToFileURL(path.join(siteDir, rel)).href);

export default async function searchIndex(ctx) {
  const { siteDir, src, dest, slugify } = ctx;
  const { loadDatalab } = await imp(siteDir, "src/lib/adapter/datalab.ts");
  const { shortScale, KIND } = await imp(siteDir, "src/lib/words.ts");
  const { periodWords, unitLabel } = await imp(siteDir, "src/lib/format.ts");
  const d = loadDatalab(src);
  const editorial = JSON.parse(fs.readFileSync(path.join(siteDir, "editorial.config.json"), "utf8"));
  const concepts = JSON.parse(fs.readFileSync(path.join(siteDir, "editorial", "concepts.json"), "utf8"));

  const state = (ds) => d.release.dataset_status?.[ds]?.state;
  const visible = (ds) => ["published", "candidate"].includes(state(ds));
  const isCandidate = (ds) => state(ds) === "candidate";
  const shows = (o) => o.reader.showsValue && o.published && o.value !== null;

  // Latest checked value: latest period, then the most final kind (as src/lib/stats.ts latestPublished).
  const RANK = { actual: 4, re: 3, provisional: 2, be: 1, na: 0 };
  const byRecency = (a, b) => b.period.localeCompare(a.period) || (RANK[b.vintage] ?? 0) - (RANK[a.vintage] ?? 0);
  const kindWord = (o) => KIND[o.kind]?.long ?? "";

  // Source marker (DESIGN.md 7, glance depth): "ABS 2026-27, p. 11".
  const DOC_SHORT = { abs: "ABS", cpi_monthly_review: "Monthly Review", lfs_annual_report: "LFS", pes_chapter: "Economic Survey", sbp_easydata: "SBP EasyData" };
  const marker = (o) => {
    const cell = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : null;
    const s = cell ? d.sourceById.get(cell.source_id) : null;
    if (!cell || !s) return "";
    const page = cell.page_label && cell.page_label !== String(cell.page) ? cell.page_label : String(cell.page);
    return `${DOC_SHORT[s.doc_type] ?? s.doc_type} ${periodWords(s.period, s.doc_type === "cpi_monthly_review" ? "month" : "fiscal_year")}, p. ${page}`;
  };

  // Printed label: the row label most often printed for the series' cells.
  const labelOf = new Map();
  {
    const counts = new Map();
    for (const c of d.cells) {
      if (!c.series_id || !c.row_label_raw) continue;
      const k = c.series_id;
      const m = counts.get(k) ?? new Map();
      const l = c.row_label_raw.replace(/\s+/g, " ").trim();
      m.set(l, (m.get(l) ?? 0) + 1);
      counts.set(k, m);
    }
    for (const [k, m] of counts) labelOf.set(k, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  const words = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const conceptSeries = new Set(concepts.concepts.map((c) => c.series[0]).filter(Boolean));
  const headline = new Set([...(editorial.headline ?? []), ...conceptSeries]);
  const seriesIds = new Set(d.series.map((s) => s.series_id));

  // Search words the build adds (no numbers): what a reader calls a kind of series.
  const extraWords = (s) => {
    const m = s.dims?.measure;
    if (s.dataset === "cpi" && m === "yoy") return "inflation rate year on year";
    if (s.dataset === "cpi" && m === "mom") return "monthly inflation month on month";
    if (s.dataset === "cpi" && s.unit === "index") return "index level";
    return "";
  };

  const index = [];
  // Data type names once, in the meta row; each series names its data type by position (d), and the engine puts
  // the name back. Keeps room in the 40 KB budget for the answer card's sentence.
  const dsNames = [];
  const dsCode = (name) => (dsNames.includes(name) ? dsNames.indexOf(name) : dsNames.push(name) - 1);
  // Word groups: editorial/concepts.json first, then the English and Roman Urdu synonyms of editorial/synonyms.json (Home v2).
  const synonymsFile = path.join(siteDir, "editorial", "synonyms.json");
  const synonymGroups = fs.existsSync(synonymsFile) ? JSON.parse(fs.readFileSync(synonymsFile, "utf8")).groups ?? [] : [];
  const meta = { k: "m", id: "meta", n: "meta", r: d.release.version, w: [...concepts.words, ...synonymGroups], ds: dsNames };
  index.push(meta);

  const visibleSeries = d.series.filter((s) => visible(s.dataset));
  // The latest base year of each data type (CPI: 2015-16). A series on an earlier base is marked (ob), so search
  // can rank it below the current ones and say "earlier base" on its card.
  const latestBase = new Map();
  for (const s of visibleSeries) {
    const b = s.dims?.base_year;
    if (b && (!latestBase.has(s.dataset) || b > latestBase.get(s.dataset))) latestBase.set(s.dataset, b);
  }
  for (const s of visibleSeries) {
    const all = d.obsBySeries.get(s.series_id) ?? [];
    const pub = all.filter(shows);
    const periods = pub.map((o) => o.period).sort();
    const latest = [...pub].sort(byRecency)[0];
    const label = labelOf.get(s.series_id);
    const cand = isCandidate(s.dataset);
    const e = {
      k: "s",
      id: s.series_id,
      n: s.title,
      d: dsCode(d.release.dataset_status?.[s.dataset]?.name ?? s.dataset),
      u: unitLabel(s.unit, s.scale_factor),
      f: s.frequency,
      c: pub.length,
    };
    if (periods.length) {
      e.fr = periods[0];
      e.to = periods[periods.length - 1];
    }
    const y = [...(s.synonyms ?? []), extraWords(s)].filter(Boolean).join(" ");
    if (y) e.y = y;
    if (s.derived) e.x = 1;
    // The printed name stays searchable (official names people know: "CPI National ...").
    if (words(s.name) !== words(s.title)) e.pn = s.name;
    // The printed row label ("6. Health") only when it adds a word the title, printed name and synonyms do not
    // already make searchable (keeps the index within its 40 KB budget once printed names are in it).
    const letters = (x) => (x ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean);
    const have = new Set([...letters(s.title), ...letters(s.name), ...letters(y)]);
    if (label && letters(label).some((w) => !have.has(w))) e.l = label;
    if (s.geo && s.geo !== "pk") e.g = s.geo;
    if (headline.has(s.series_id) && !cand) e.hl = 1;
    if (cand) e.cand = 1;
    if (s.dims?.base_year && s.dims.base_year < latestBase.get(s.dataset)) e.ob = 1;
    if (latest) {
      // The link to its receipt (/o/<series>~<period>~<vintage>) and the period in words are rebuilt by the engine.
      e.lv = shortScale(latest.value, s.unit, s.scale_factor);
      e.lk = kindWord(latest);
      e.lpr = latest.period;
      e.lvt = latest.vintage;
      // Later figures exist but none is checked: the card says "checked to", never "ends".
      if (all.some((o) => o.period > latest.period)) e.lw = 1;
    }
    index.push(e);
  }
  const docWords = { abs: "Annual Budget Statement", cpi_monthly_review: "Monthly Review of Price Indices", lfs_annual_report: "Labour Force Survey annual report", pes_chapter: "Pakistan Economic Survey chapter", sbp_easydata: "State Bank of Pakistan EasyData" };
  for (const s of d.sources) {
    index.push({ k: "d", id: s.source_id, n: s.title, d: `${docWords[s.doc_type] ?? s.doc_type}, ${s.publisher}`, p: s.period, dt: s.doc_type });
  }

  // Tables as printed, grouped as src/lib/tables.ts groups them (document, page, table).
  const tables = new Map();
  for (const c of d.cells) {
    const k = `${c.source_id}|${c.page}|${c.table_index}`;
    const t = tables.get(k) ?? { c, datasets: new Set() };
    const ds = c.series_id ? d.seriesById.get(c.series_id)?.dataset : undefined;
    if (ds) t.datasets.add(ds);
    tables.set(k, t);
  }
  for (const { c, datasets } of tables.values()) {
    const ds = [...datasets][0];
    if (!ds || !visible(ds)) continue;
    const s = d.sourceById.get(c.source_id);
    const title = d.coverage.find((r) => r.source_id === c.source_id && r.page === c.page)?.table ?? "Table";
    const page = c.page_label && c.page_label !== String(c.page) ? `p. ${c.page_label} (PDF p. ${c.page})` : `p. ${c.page}`;
    index.push({
      k: "t",
      id: slugify(`${c.source_id}~p${c.page}~t${c.table_index}`),
      n: title,
      d: `${s?.title ?? c.source_id}, ${page}`,
      p: s?.period,
      dt: s?.doc_type,
    });
  }

  // Concepts and their answers.
  const problems = [];
  for (const c of concepts.concepts) {
    for (const id of [...c.series, ...(c.related ?? [])]) if (!seriesIds.has(id)) problems.push(`concept ${c.id}: series ${id} is not in the release`);
    const ids = c.series.filter((id) => seriesIds.has(id) && visible(d.seriesById.get(id).dataset));
    const e = { k: "c", id: c.id, n: c.name, ys: c.synonyms, s: ids, t: c.topic };
    if (c.missing) e.miss = c.missing;
    if (c.related?.length) e.rel = c.related.filter((id) => seriesIds.has(id));
    if (c.doc) e.doc = c.doc;
    const head = ids[0] ? d.seriesById.get(ids[0]) : null;
    if (head && !isCandidate(head.dataset)) {
      const vals = (d.obsBySeries.get(head.series_id) ?? []).filter(shows).sort((a, b) => a.period.localeCompare(b.period) || (RANK[a.vintage] ?? 0) - (RANK[b.vintage] ?? 0));
      const latest = [...vals].sort(byRecency)[0];
      if (latest) {
        // Each value: [period, vintage, short value, source marker, kind in words]. The receipt link is rebuilt from
        // the series id, period and vintage (/o/<series>~<period>~<vintage>).
        e.a = {
          s: head.series_id,
          n: head.title,
          pn: head.name,
          // The one-sentence plain summary of the headline series (editorial/titles.json, no digits), the answer
          // card's sentence.
          ...(head.summary ? { sm: head.summary } : {}),
          u: unitLabel(head.unit, head.scale_factor),
          f: head.frequency,
          vals: vals.map((o) => [o.period, o.vintage, shortScale(o.value, head.unit, head.scale_factor), marker(o), kindWord(o)]),
          latest: vals.indexOf(latest),
        };
      }
    }
    index.push(e);
  }
  if (problems.length) throw new Error(`search index:\n  ${problems.join("\n  ")}`);

  const json = JSON.stringify(index);
  fs.writeFileSync(path.join(dest, "search.json"), json);

  // Sparklines: { r: release, s: { id: [span, step, [x, "value", "value", ...], ...] } }.
  // One line per series: its main kind of figure (budget estimate if it has one, else the kind it has most of), as
  // the sparkline and chart on the series page draw it. x is the period's position on the time axis (years for
  // fiscal years and survey rounds, months for months) less that of the series' first period; span is the last
  // period's position; step the normal distance between periods. Neighbouring checked values sit in one segment
  // only when they are exactly one step apart and no series break lies between them; gaps and breaks start a new
  // segment. Values are the release's stored strings, of checked figures only.
  const ordinal = (p, f) => {
    const m = /^(\d{4})-(\d{2})$/.exec(p);
    if (f === "month" && m) return Number(m[1]) * 12 + (Number(m[2]) - 1);
    const y = /^(\d{4})/.exec(p);
    return y ? Number(y[1]) : null;
  };
  const spark = {};
  for (const s of visibleSeries) {
    const all = d.obsBySeries.get(s.series_id) ?? [];
    const pub = all.filter(shows);
    if (!pub.length) continue;
    let v = "na";
    if (pub.some((o) => o.vintage === "be")) v = "be";
    else {
      const n = new Map();
      for (const o of pub) n.set(o.vintage, (n.get(o.vintage) ?? 0) + 1);
      v = [...n.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    const periods = [...new Set(all.filter((o) => o.vintage === v).map((o) => o.period))].sort();
    const ord = new Map(periods.map((p) => [p, ordinal(p, s.frequency)]));
    let computable = [...ord.values()].every((x) => x !== null) && new Set(ord.values()).size === periods.length;
    if (!computable) periods.forEach((p, i) => ord.set(p, i));
    let step = Infinity;
    for (let i = 1; i < periods.length; i++) step = Math.min(step, ord.get(periods[i]) - ord.get(periods[i - 1]));
    if (!Number.isFinite(step) || step <= 0) step = 1;
    const x0 = ord.get(periods[0]);
    const breaks = [];
    for (const b of s.breaks ?? []) {
      let at = computable ? ordinal(b.at_period, s.frequency) : null;
      if (at === null) {
        const next = periods.find((p) => p >= b.at_period);
        at = next !== undefined ? ord.get(next) : null;
      }
      if (at !== null) breaks.push(at - step / 2);
    }
    const pts = pub.filter((o) => o.vintage === v).map((o) => ({ x: ord.get(o.period), v: o.value })).sort((a, b) => a.x - b.x);
    const segs = [];
    let cur = null;
    let prev = null;
    for (const p of pts) {
      const join = prev && Math.abs(p.x - prev.x - step) < 1e-9 && !breaks.some((bx) => bx > prev.x && bx < p.x);
      if (!join) {
        cur = [p.x - x0];
        segs.push(cur);
      }
      cur.push(p.v);
      prev = p;
    }
    spark[s.series_id] = [ord.get(periods[periods.length - 1]) - x0, step, ...segs];
  }
  const sparkJson = JSON.stringify({ r: d.release.version, s: spark });
  fs.writeFileSync(path.join(dest, "spark.json"), sparkJson);
  const sgz = zlib.gzipSync(sparkJson, { level: 9 }).length;
  const gz = zlib.gzipSync(json, { level: 9 }).length;
  const br = zlib.brotliCompressSync(json).length;
  return `search.json: ${index.length} entries, ${(json.length / 1024).toFixed(1)} KB, ${(gz / 1024).toFixed(1)} KB gzip, ${(br / 1024).toFixed(1)} KB brotli; spark.json: ${Object.keys(spark).length} series, ${(sparkJson.length / 1024).toFixed(1)} KB, ${(sgz / 1024).toFixed(1)} KB gzip`;
}
