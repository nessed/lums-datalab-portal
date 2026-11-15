// The evidence area's numbers that the HTML scan does not see, checked against
// the release, written independently of src/components/evidence/model.ts:
//   1. one-tap sheets (public/data/<v>/evidence/sheet/<slug>.json), drawn in
//      the browser: one per shown value and none for anything else; the value,
//      the printed text, document, page, row and column are the release's; the
//      verdict carries no digit except inside a document title; the versions
//      strip lists every printing of the series and period, a value only for a
//      checked figure, and each change is recomputed here;
//   2. pre-cut crops: every window a sheet or receipt names exists, has the
//      width and height the page says, and one cell's crop is at most 40 KB;
//   3. the changes on receipts (data-num="derived" data-derived="pct-change"),
//      recomputed here from the two figures named, which must both be checked.
import fs from "node:fs";
import path from "node:path";

const CROP_BUDGET = 40 * 1024;

// Same rule as formatDecimalString, written again.
const fmt = (v) => {
  const m = /^([+-]?)(\d+)(\.\d+)?$/.exec(String(v).trim());
  if (!m) return String(v).trim();
  return `${m[1] === "-" ? "−" : ""}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${m[3] ?? ""}`;
};
const SCALE = { 1: "", 1000: "thousand", 100000: "lakh", 1000000: "million", 10000000: "crore", 1000000000: "billion" };
const unitOf = (u, s) => {
  const w = SCALE[String(s ?? 1)] ?? "";
  if (u === "PKR") return w ? `Rs ${w}` : "Rs";
  if (u === "percent") return "per cent";
  if (u === "index") return "index points";
  if (u === "persons") return w ? `${w} persons` : "persons";
  return [w, u ?? ""].filter(Boolean).join(" ");
};

/**
 * Percentage change from a to b, from decimal strings, under the rounding rule
 * for derived figures (DECISIONS.md, round 2), written again here: one decimal;
 * two when the magnitude is below 1; a change that is not zero but would read
 * 0.00 to its first significant digit; halves away from zero on the exact
 * quotient; "+" / "−" (U+2212); "0.00%" for no change. The direction is
 * relative to the size of a. Null when a is zero.
 */
function pctIndep(a, b) {
  const parse = (s) => {
    const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(s).trim());
    return m ? { neg: m[1] === "-", int: m[2], frac: m[3] ?? "" } : null;
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return null;
  const k = Math.max(pa.frac.length, pb.frac.length);
  const big = (p) => (p.neg ? -1n : 1n) * BigInt(p.int + p.frac.padEnd(k, "0"));
  const A = big(pa);
  const B = big(pb);
  if (A === 0n) return null;
  const den = A < 0n ? -A : A;
  const num = (B - A) * (A < 0n ? -1n : 1n) * 100n;
  if (num === 0n) return "0.00%";
  const mag = num < 0n ? -num : num;
  // mag / den rounded to dp decimals, halves away from zero, as a string.
  const at = (dp) => {
    const x = mag * 10n ** BigInt(dp);
    const r = (x * 2n + den) / (den * 2n);
    const t = r.toString().padStart(dp + 1, "0");
    return { r, text: `${t.slice(0, t.length - dp).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${t.slice(t.length - dp)}` };
  };
  let body;
  const two = at(2);
  if (two.r >= 100n) body = at(1).text;
  else if (two.r > 0n) body = two.text;
  else {
    let dp = 3;
    while (mag * 10n ** BigInt(dp) < den) dp++;
    const d = at(dp);
    body = d.r === 10n ? at(dp - 1).text : d.text;
  }
  return `${num < 0n ? "−" : "+"}${body}%`;
}

/** Width and height of a WebP file, from its header. */
function webpSize(buf) {
  if (buf.length < 30 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  return null;
}

export default function check({ siteDir, appDir, cfg, release, series, allObs, observations, cells, sourceById, isPub, slugify, problem, derived }) {
  const titlesFile = path.join(siteDir, "editorial", "titles.json");
  const plainTitles = fs.existsSync(titlesFile)
    ? Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(titlesFile, "utf8")).series ?? {}).map(([id, e]) => [id, e?.title]).filter(([, t]) => typeof t === "string" && t.trim()).map(([id, t]) => [id, t.trim()]))
    : {};
  const base = path.join(siteDir, "public", "data", cfg.version, "evidence");
  const sheetDir = path.join(base, "sheet");
  const cropDir = path.join(base, "crops");
  if (!fs.existsSync(sheetDir)) {
    problem("evidence-sheet", "/evidence", "no sheets written (scripts/prebuild/evidence.mjs)");
    return "missing";
  }
  const obsById = new Map(allObs.map((o) => [o.obs_id, o]));
  const state = (o) => release.dataset_status?.[series.get(o.series_id)?.dataset]?.state;
  // Only a checked figure of a signed-off (published) dataset may feed a derived value.
  const usable = (o) => !!o && isPub(o) && o.status === "checked" && state(o) === "published";
  const titles = [...sourceById.values()].map((s) => s.title).filter(Boolean).sort((a, b) => b.length - a.length);
  const cropSeen = new Map();

  const checkCrop = (crop, where, cellId) => {
    if (!crop) return;
    if (crop.cellId !== cellId) problem("evidence-crop", where, `crop of ${crop.cellId}, figure printed in ${cellId}`);
    if (!crop.windows?.some((w) => w.box)) problem("evidence-crop", where, "crop with no box in it");
    let total = 0;
    for (const w of crop.windows ?? []) {
      const f = path.join(cropDir, w.file);
      if (!fs.existsSync(f)) {
        problem("evidence-crop", where, `crop file ${w.file} missing`);
        continue;
      }
      const buf = fs.readFileSync(f);
      total += buf.length;
      const sz = webpSize(buf);
      if (!sz || sz.w !== w.px[2] || sz.h !== w.px[3]) problem("evidence-crop", where, `${w.file} is ${sz ? `${sz.w}x${sz.h}` : "not a WebP"}, the page says ${w.px[2]}x${w.px[3]}`);
    }
    if (total > CROP_BUDGET) problem("evidence-crop", where, `crop of ${cellId} is ${total} bytes, over ${CROP_BUDGET}`);
    cropSeen.set(cellId, total);
  };

  // 1. sheets
  let sheets = 0;
  let changes = 0;
  const visibleSlugs = new Map(observations.map((o) => [slugify(o.obs_id), o]));
  for (const name of fs.readdirSync(sheetDir)) {
    const where = `sheet ${name}`;
    const o = visibleSlugs.get(name.replace(/\.json$/, ""));
    if (!o) {
      problem("evidence-sheet", where, "sheet for a figure that is not on the site");
      continue;
    }
    if (!isPub(o)) {
      problem("evidence-sheet", where, `sheet for ${o.obs_id}, which shows no value`);
      continue;
    }
    sheets++;
    const j = JSON.parse(fs.readFileSync(path.join(sheetDir, name), "utf8"));
    const s = series.get(o.series_id);
    const cell = o.primary_cell_id ? cells.get(o.primary_cell_id) : null;
    const src = cell ? sourceById.get(cell.source_id) : null;
    if (j.release !== release.version) problem("evidence-sheet", where, `release ${j.release}`);
    if (j.obs !== o.obs_id || j.href !== `/o/${slugify(o.obs_id)}`) problem("evidence-sheet", where, `names ${j.obs} / ${j.href}`);
    // The sheet is headed by the series' plain title (editorial/titles.json, round 2), or its printed name when it has none.
    const wantTitle = plainTitles[o.series_id] ?? s?.name;
    if (j.title !== wantTitle) problem("evidence-sheet", where, `title "${j.title}" is not the series title "${wantTitle}"`);
    if (j.value !== fmt(o.value)) problem("evidence-sheet", where, `value ${j.value}, release stores ${o.value}`);
    if (j.unit !== unitOf(o.unit, o.scale_factor)) problem("evidence-sheet", where, `unit "${j.unit}"`);
    if (cell) {
      if (j.printed !== cell.value_raw) problem("evidence-sheet", where, `printed "${j.printed}", cell ${cell.cell_id} prints "${cell.value_raw}"`);
      if (j.page?.pdf !== cell.page) problem("evidence-sheet", where, `page ${j.page?.pdf}, cell is on ${cell.page}`);
      const label = cell.page_label && cell.page_label !== String(cell.page) ? cell.page_label : null;
      if ((j.page?.printed ?? null) !== label) problem("evidence-sheet", where, `printed page ${j.page?.printed}, cell says ${cell.page_label}`);
      if (j.row !== cell.row_label_raw || j.col !== cell.col_label_raw) problem("evidence-sheet", where, "row or column differs from the printed labels");
      if (j.doc?.title !== src?.title) problem("evidence-sheet", where, `document "${j.doc?.title}"`);
      if (j.doc?.pdf && !(src?.file_url && j.doc.pdf === `${src.file_url}#page=${cell.page}`)) problem("evidence-sheet", where, `PDF link ${j.doc.pdf}`);
      checkCrop(j.crop, where, cell.cell_id);
    } else if (j.printed || j.page || j.crop) problem("evidence-sheet", where, "printed text, page or crop for a figure with no printed cell");
    // The verdict: no digit outside a document title.
    let v = String(j.verdict ?? "");
    for (const t of titles) v = v.split(t).join("");
    if (/\d/.test(v)) problem("evidence-sheet", where, `verdict has a digit outside a document title: "${j.verdict}"`);

    // The versions strip.
    const same = allObs.filter((x) => x.series_id === o.series_id && x.period === o.period);
    const items = j.versions?.items ?? [];
    const listed = items.map((it) => it.obsId).sort();
    if (listed.join("|") !== same.map((x) => x.obs_id).sort().join("|")) problem("evidence-versions", where, `lists ${listed.join(", ")}; the release has ${same.map((x) => x.obs_id).join(", ")}`);
    for (const it of items) {
      const x = obsById.get(it.obsId);
      if (!x) continue;
      if (it.value !== null && (!isPub(x) || it.value !== x.value)) problem("evidence-versions", where, `${it.obsId} shows ${it.value}; release: ${isPub(x) ? x.value : "no value"}`);
      if (it.value === null && isPub(x)) problem("evidence-versions", where, `${it.obsId} is a checked figure shown without its value`);
      if (it.slug !== slugify(it.obsId)) problem("evidence-versions", where, `${it.obsId} links to ${it.slug}`);
      const pc = x.primary_cell_id ? cells.get(x.primary_cell_id) : null;
      if (pc && it.printedIn?.[0]?.title !== sourceById.get(pc.source_id)?.title) problem("evidence-versions", where, `${it.obsId} is printed in ${pc.source_id}, strip says ${it.printedIn?.[0]?.title}`);
    }
    const steps = j.versions?.steps ?? [];
    if (steps.length !== Math.max(0, items.length - 1)) problem("evidence-versions", where, `${steps.length} changes for ${items.length} printings`);
    steps.forEach((st, i) => {
      const a = obsById.get(st.from);
      const b = obsById.get(st.to);
      if (st.from !== items[i]?.obsId || st.to !== items[i + 1]?.obsId) problem("evidence-versions", where, `change ${i} is not between neighbouring printings`);
      // A rate in per cent is never given a per-cent change of itself.
      const ok = usable(a) && usable(b) && a.unit === b.unit && a.scale_factor === b.scale_factor && a.unit !== "percent";
      const want = ok ? pctIndep(a.value, b.value) : null;
      if (st.pct !== want) problem("evidence-versions", where, `change ${st.from} -> ${st.to} is ${st.pct}; recomputed ${want ?? "none (not both checked)"}`);
      if (!st.pct && !st.reason) problem("evidence-versions", where, `change ${st.from} -> ${st.to} is not shown and gives no reason`);
      if (st.pct) changes++;
    });
  }
  for (const o of observations) if (isPub(o) && !fs.existsSync(path.join(sheetDir, `${slugify(o.obs_id)}.json`))) problem("evidence-sheet", o.obs_id, "no one-tap sheet for a shown value");

  // 2. crop budget over every crop file, grouped by cell (receipts also show crops of other printings).
  const byCell = new Map();
  if (fs.existsSync(cropDir))
    for (const f of fs.readdirSync(cropDir)) {
      const m = /^(.+)-(\d+)\.webp$/.exec(f);
      if (!m) {
        problem("evidence-crop", f, "unexpected file in the crops folder");
        continue;
      }
      byCell.set(m[1], (byCell.get(m[1]) ?? 0) + fs.statSync(path.join(cropDir, f)).size);
    }
  let largest = 0;
  for (const [cellId, total] of byCell) {
    largest = Math.max(largest, total);
    if (total > CROP_BUDGET && !cropSeen.has(cellId)) problem("evidence-crop", cellId, `crop is ${total} bytes, over ${CROP_BUDGET}`);
    if (!cells.has(cellId)) problem("evidence-crop", cellId, "crop of a cell that is not in the release");
  }

  // 3. changes printed on receipts.
  let onPages = 0;
  const oDir = path.join(appDir, "o");
  const re = /<span([^>]*\sdata-num="derived"[^>]*)>([^<]*)<\/span>/g;
  const attr = (s, n) => new RegExp(`\\s${n}="([^"]*)"`).exec(s)?.[1];
  if (fs.existsSync(oDir))
    for (const f of fs.readdirSync(oDir)) {
      if (!f.endsWith(".html")) continue;
      const html = fs.readFileSync(path.join(oDir, f), "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
      for (const m of html.matchAll(re)) {
        const kind = attr(m[1], "data-derived");
        const where = `/o/${f.replace(/\.html$/, "")}`;
        if (kind !== "pct-change") {
          problem("evidence-derived", where, `derived value of unknown kind "${kind}"`);
          continue;
        }
        const a = obsById.get(attr(m[1], "data-from"));
        const b = obsById.get(attr(m[1], "data-to"));
        if (!usable(a) || !usable(b)) {
          problem("evidence-derived", where, `change "${m[2]}" computed from a figure that is not a checked, signed-off value`);
          continue;
        }
        const want = a.unit === b.unit && a.scale_factor === b.scale_factor && a.unit !== "percent" ? pctIndep(a.value, b.value) : null;
        if (m[2].trim() !== want) problem("evidence-derived", where, `change "${m[2]}" from ${a.obs_id} to ${b.obs_id}; recomputed ${want}`);
        onPages++;
      }
    }
  // Changes on receipts are recomputed by the scan above; claim them in the shared list.
  for (const d of derived ?? []) if (d.page.startsWith("/o/") && d.attrs["data-derived"] === "pct-change") d.claimed = true;
  return `${sheets} sheets (${changes} changes recomputed), ${byCell.size} crops (largest ${(largest / 1024).toFixed(1)} KB), ${onPages} changes on receipts recomputed`;
}
