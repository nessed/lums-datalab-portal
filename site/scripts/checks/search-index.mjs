// The search index (public/data/<version>/search.json) is drawn in the browser,
// so the HTML scan never sees its numbers. Check it here instead (DESIGN.md 10,
// decision 17.1):
//   - every series of a visible data type is in it once, and nothing else;
//   - each count of checked values equals the release's;
//   - each latest value is a checked figure of that series, the latest one, in
//     the short form V short gives it (recomputed here independently, the same
//     rule as shortIndep in check-build.mjs), with its kind;
//   - each answer-card value is a checked figure of the concept's headline
//     series, not from a dataset nobody signed off, short form and source
//     marker recomputed; a candidate is never in the headline layer;
//   - editorial/concepts.json holds no numbers and names only series the release holds;
//   - every document and table it links to exists;
//   - the file is at most 40 KB compressed (DESIGN.md 14.1).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const fmtDec = (v) => {
  const m = /^([+-]?)(\d+)(\.\d+)?$/.exec(String(v).trim());
  if (!m) return String(v).trim();
  return `${m[1] === "-" ? "−" : ""}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${m[3] ?? ""}`;
};

// Written independently of src/lib/words.ts (shortScale): the same rule as
// shortIndep in check-build.mjs. Rupees and persons in trillion / billion /
// million to one decimal, half up on the hundredths; per cent with "%".
function shortIndep(v, unit, scale) {
  const str = String(v).trim();
  if (unit === "PKR" || unit === "persons") {
    const neg = str.startsWith("-");
    const [ip, fp = ""] = str.replace(/^[+-]/, "").split(".");
    const k = Math.round(Math.log10(Number(scale ?? 1)));
    if (10 ** k !== Number(scale ?? 1)) return str;
    const num = BigInt(ip + fp) * 10n ** BigInt(k);
    const den = 10n ** BigInt(fp.length);
    const whole = num / den;
    const digits = whole.toString().length;
    const pick = [
      [12, "trillion"],
      [9, "billion"],
      [6, "million"],
    ].find(([e]) => digits > e);
    let text;
    if (pick) {
      const hundredths = (num * 100n) / (den * 10n ** BigInt(pick[0]));
      const tenths = (hundredths + 5n) / 10n;
      const r = tenths % 10n;
      text = `${tenths / 10n}${r ? `.${r}` : ""} ${pick[1]}`;
    } else text = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return unit === "PKR" ? `${neg ? "−" : ""}Rs ${text}` : `${neg ? "−" : ""}${text} persons`;
  }
  return unit === "percent" ? `${fmtDec(str)}%` : fmtDec(str);
}

const RANK = { actual: 4, re: 3, provisional: 2, be: 1, na: 0 };
const STAGE_WORDS = { be: "budget estimate", re: "revised estimate", actual: "actual", provisional: "provisional", final: "final" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthWords = (p) => {
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : p;
};
const DOC_SHORT = { abs: "ABS", cpi_monthly_review: "Monthly Review", lfs_annual_report: "LFS", pes_chapter: "Economic Survey", sbp_easydata: "SBP EasyData" };

export default function check({ siteDir, appDir, cfg, release, seriesList, series, allObs, cells, sourceById, isPub, slugify, problem }) {
  const where = "/search.json";
  const file = path.join(siteDir, "public", "data", cfg.version, "search.json");
  if (!fs.existsSync(file)) {
    problem("search-index", where, "not written (scripts/prebuild/search.mjs)");
    return "missing";
  }
  const raw = fs.readFileSync(file, "utf8");
  const index = JSON.parse(raw);
  const gz = zlib.gzipSync(raw, { level: 9 }).length;
  if (gz > 40 * 1024) problem("search-index", where, `${(gz / 1024).toFixed(1)} KB compressed, over the 40 KB budget`);

  const meta = index.find((e) => e.k === "m");
  if (meta?.r !== release.version) problem("search-index", where, `release ${meta?.r}, built from ${release.version}`);

  const state = (ds) => release.dataset_status?.[ds]?.state;
  const visible = seriesList.filter((s) => ["published", "candidate"].includes(state(s.dataset)));
  const obsById = new Map(allObs.map((o) => [o.obs_id, o]));
  const pubOf = new Map();
  for (const o of allObs) if (isPub(o)) (pubOf.get(o.series_id) ?? pubOf.set(o.series_id, []).get(o.series_id)).push(o);
  const latestOf = (id) => [...(pubOf.get(id) ?? [])].sort((a, b) => b.period.localeCompare(a.period) || (RANK[b.vintage] ?? 0) - (RANK[a.vintage] ?? 0))[0];
  const cellById = new Map(cells instanceof Map ? cells : []);

  // A value in the index: a checked figure of this series, in its short form.
  const checkValue = (who, s, period, vintage, shown) => {
    const o = obsById.get(`${s.series_id}:${period}:${vintage}`);
    if (!o || o.series_id !== s.series_id) return problem("search-index", who, `value ${shown} names ${s.series_id}:${period}:${vintage}, which is not a figure of the release`), null;
    if (!isPub(o)) return problem("search-index", who, `value ${shown} is ${o.obs_id}, which is not a published figure`), null;
    const want = shortIndep(o.value, s.unit, s.scale_factor);
    if (shown !== want) problem("search-index", who, `shows "${shown}" for ${o.obs_id}; the short form of ${o.value} is "${want}"`);
    return o;
  };

  /* series */
  const seen = new Set();
  let values = 0;
  for (const e of index.filter((x) => x.k === "s")) {
    const s = series.get(e.id);
    const who = `${where} ${e.id}`;
    if (!s || !visible.includes(s)) {
      problem("search-index", who, "series that is not visible in this release");
      continue;
    }
    if (seen.has(e.id)) problem("search-index", who, "listed twice");
    seen.add(e.id);
    const pub = pubOf.get(e.id) ?? [];
    if ((e.c ?? 0) !== pub.length) problem("search-index", who, `checked count ${e.c}, release ${pub.length}`);
    const periods = pub.map((o) => o.period).sort();
    if ((e.fr ?? null) !== (periods[0] ?? null) || (e.to ?? null) !== (periods[periods.length - 1] ?? null)) problem("search-index", who, `periods ${e.fr} to ${e.to}`);
    const cand = state(s.dataset) === "candidate";
    if (!!e.cand !== cand) problem("search-index", who, cand ? "a candidate not marked as one" : "marked as a candidate");
    if (e.hl && cand) problem("search-index", who, "a candidate in the headline layer");
    const latest = latestOf(e.id);
    if (!latest) {
      if (e.lv || e.lpr) problem("search-index", who, "shows a latest value but has no checked figure");
      continue;
    }
    if (e.lpr !== latest.period || e.lvt !== latest.vintage) problem("search-index", who, `latest ${e.lpr} ${e.lvt}, release ${latest.period} ${latest.vintage}`);
    const o = checkValue(who, s, e.lpr, e.lvt, e.lv);
    if (o) {
      values++;
      const stage = STAGE_WORDS[o.vintage];
      if (stage ? e.lk !== stage : Object.values(STAGE_WORDS).includes(e.lk)) problem("search-index", who, `kind "${e.lk}" for vintage ${o.vintage}`);
    }
  }
  for (const s of visible) if (!seen.has(s.series_id)) problem("search-index", `${where} ${s.series_id}`, "visible series missing from the index");

  /* documents and tables */
  for (const e of index.filter((x) => x.k === "d")) if (!sourceById.has(e.id)) problem("search-index", `${where} ${e.id}`, "document not in the release");
  const tableDir = path.join(appDir, "tables");
  let tables = 0;
  for (const e of index.filter((x) => x.k === "t")) {
    tables++;
    if (fs.existsSync(tableDir) && !fs.existsSync(path.join(tableDir, `${e.id}.html`))) problem("search-index", `${where} ${e.id}`, "table page does not exist");
  }

  /* concepts */
  const editorial = JSON.parse(fs.readFileSync(path.join(siteDir, "editorial", "concepts.json"), "utf8"));
  if (editorial.provisional !== true) problem("search-concepts", "editorial/concepts.json", 'not marked "provisional": true');
  const digits = (o, at) => {
    if (typeof o === "string") {
      if (/\d/.test(o)) problem("search-concepts", "editorial/concepts.json", `number in editorial text at ${at}: "${o.slice(0, 80)}"`);
    } else if (Array.isArray(o)) o.forEach((v, i) => digits(v, `${at}[${i}]`));
    else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (k !== "series" && k !== "related") digits(v, `${at}.${k}`);
  };
  digits(editorial, "");
  const byId = new Map(editorial.concepts.map((c) => [c.id, c]));
  let answers = 0;
  for (const e of index.filter((x) => x.k === "c")) {
    const c = byId.get(e.id);
    const who = `${where} concept ${e.id}`;
    if (!c) {
      problem("search-index", who, "not in editorial/concepts.json");
      continue;
    }
    for (const id of [...c.series, ...(c.related ?? [])]) if (!series.has(id)) problem("search-concepts", who, `series ${id} is not in the release`);
    if (c.missing && c.series.length) problem("search-concepts", who, "has series and a 'missing' sentence");
    if (!c.missing && !c.series.length) problem("search-concepts", who, "has neither series nor a 'missing' sentence");
    if (!e.a) {
      const head = series.get(c.series[0]);
      if (head && state(head.dataset) === "published" && latestOf(head.series_id)) problem("search-index", who, "no answer although its headline series has checked figures");
      continue;
    }
    const s = series.get(e.a.s);
    if (!s || e.a.s !== c.series[0]) {
      problem("search-index", who, `answers from ${e.a.s}, not its headline series ${c.series[0]}`);
      continue;
    }
    if (state(s.dataset) !== "published") problem("search-index", who, `answer card from ${s.dataset}, which is not signed off`);
    const pub = pubOf.get(s.series_id) ?? [];
    if (e.a.vals.length !== pub.length) problem("search-index", who, `${e.a.vals.length} answer values, release has ${pub.length} checked`);
    const latest = latestOf(s.series_id);
    const shownLatest = e.a.vals[e.a.latest];
    if (!shownLatest || shownLatest[0] !== latest.period || shownLatest[1] !== latest.vintage) problem("search-index", who, "latest answer value is not the latest checked figure");
    for (const [period, vintage, shown, mark, kind] of e.a.vals) {
      const o = checkValue(who, s, period, vintage, shown);
      if (!o) continue;
      answers++;
      const stage = STAGE_WORDS[vintage];
      if (stage ? kind !== stage : Object.values(STAGE_WORDS).includes(kind)) problem("search-index", who, `kind "${kind}" for vintage ${vintage}`);
      const cell = cellById.get(o.primary_cell_id);
      const src = cell ? sourceById.get(cell.source_id) : null;
      const page = cell ? (cell.page_label && cell.page_label !== String(cell.page) ? cell.page_label : String(cell.page)) : "";
      const want = src ? `${DOC_SHORT[src.doc_type] ?? src.doc_type} ${src.doc_type === "cpi_monthly_review" ? monthWords(src.period) : src.period}, p. ${page}` : "";
      if (mark !== want) problem("search-index", who, `source marker "${mark}" for ${o.obs_id}; its cell is printed at "${want}"`);
    }
  }
  return `${seen.size} series, ${values} latest values, ${answers} answer values, ${tables} tables checked; ${(gz / 1024).toFixed(1)} KB compressed`;
}
