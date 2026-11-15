// The downloadable files (scripts/prebuild/take.mjs) are numbers the HTML scan
// never sees. This opens every one of them, the .xlsx and .zip ones too (unzipped
// here with node:zlib), and checks every value cell against the release, read
// independently of the site's adapter:
//   - a checked figure carries its stored value (or, in a file of printings,
//     the reading of that printing's own cell);
//   - every figure that is not checked has an empty value and no printed digits;
//   - no 0 stands in for a dash: a zero value needs a printed zero;
//   - every figure of the series (or data type, or release) has its row, with
//     a status, and every row names the release, the date, the licence, the
//     citation and the "Is this file still current?" link.
// It also checks the compare files the browser draws (compare/<id>.json).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/* ---------- readers ---------- */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(f);
      f = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
    } else f += c;
  }
  if (f !== "" || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows;
}

/** Every entry of a zip archive, inflated: { name: Buffer }. */
export function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--)
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error("not a zip file");
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central directory");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString("utf8");
    const lstart = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const data = buf.subarray(lstart, lstart + csize);
    out[name] = method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
    p += 46 + nlen + elen + clen;
  }
  return out;
}

const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const colIndex = (ref) => {
  const letters = /^[A-Z]+/.exec(ref)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Rows of a worksheet (inline strings and numbers, as this site writes them). */
export function sheetRows(xml) {
  const rows = [];
  for (const rm of xml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const r = [];
    for (const cm of rm[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const idx = colIndex(cm[1]);
      const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(cm[3]);
      const v = /<v>([\s\S]*?)<\/v>/.exec(cm[3]);
      r[idx] = unxml(t ? t[1] : v ? v[1] : "");
    }
    for (let i = 0; i < r.length; i++) if (r[i] === undefined) r[i] = "";
    rows[Number(rm[1]) - 1] = r;
  }
  return rows;
}

/* ---------- the check ---------- */

export default function check({ siteDir, cfg, release, seriesList, allObs, cells, slugify, isPub, problem }) {
  const dir = path.join(siteDir, "public", "data", cfg.version);
  if (!fs.existsSync(path.join(dir, "files.json"))) {
    problem("take-files", "files.json", "the download files were not generated (scripts/prebuild/take.mjs)");
    return "missing";
  }
  const visible = (s) => ["published", "candidate"].includes(release.dataset_status?.[s.dataset]?.state);
  const vis = seriesList.filter(visible);
  const obsById = new Map(allObs.map((o) => [o.obs_id, o]));
  const obsBySeries = new Map();
  for (const o of allObs) {
    if (!obsBySeries.has(o.series_id)) obsBySeries.set(o.series_id, []);
    obsBySeries.get(o.series_id).push(o);
  }
  const cellsOf = (o) => [o.primary_cell_id, ...(o.supporting_cell_ids ?? [])].filter(Boolean);
  const ZERO = /^[+-]?0+(\.0+)?$/;
  const META = ["release", "generated", "licence", "citation", "is_this_current"];
  let files = 0;
  let valueCells = 0;
  let emptyCells = 0;

  /** Rows of the long layout (CSV, Data sheet or data package). `printings`: one row per printed cell is allowed. */
  function checkLong(where, rows, expectIds, printings) {
    files++;
    const head = rows[0] ?? [];
    const col = Object.fromEntries(head.map((h, i) => [h, i]));
    for (const k of ["obs_id", "value", "value_as_printed", "status", "cell_id", ...META])
      if (col[k] === undefined) {
        problem("take-files", where, `no ${k} column`);
        return;
      }
    const seen = new Set();
    for (const r of rows.slice(1)) {
      if (r.length === 1 && r[0] === "") continue;
      const id = r[col.obs_id];
      const o = obsById.get(id);
      if (!o) {
        problem("take-files", where, `row for ${id}, which is not in the release`);
        continue;
      }
      if (seen.has(id) && !printings) problem("take-files", where, `${id} has two rows`);
      seen.add(id);
      const v = r[col.value] ?? "";
      const cellId = r[col.cell_id] ?? "";
      if (cellId && !cellsOf(o).includes(cellId)) problem("take-files", where, `${id}: cell ${cellId} is not a printing of it`);
      if (!r[col.status]) problem("take-files", where, `${id}: no status`);
      for (const k of META) if (!r[col[k]]) problem("take-files", where, `${id}: empty ${k}`);
      if (r[col.release] !== release.version) problem("take-files", where, `${id}: release ${r[col.release]}`);
      if (isPub(o)) {
        const want = cellId && cellId !== o.primary_cell_id ? (cells.get(cellId)?.value_parsed ?? "") : o.value;
        if (v !== String(want)) problem("take-files", where, `${id}: value "${v}", release stores "${want}"`);
        else valueCells++;
        if (v !== "" && ZERO.test(v) && !/0/.test(cells.get(cellId || o.primary_cell_id)?.value_raw ?? "")) problem("take-files", where, `${id}: a 0 with no printed zero`);
      } else {
        if (v !== "") problem("take-files", where, `${id} is not a checked figure but has the value "${v}"`);
        else emptyCells++;
        if (/\d/.test(r[col.value_as_printed] ?? "")) problem("take-files", where, `${id} is not a checked figure but its printed text "${r[col.value_as_printed]}" is in the file`);
      }
    }
    if (expectIds) for (const id of expectIds) if (!seen.has(id)) problem("take-files", where, `no row for ${id}`);
  }

  function checkXlsx(where, buf, expectIds) {
    let z;
    try {
      z = unzip(buf);
    } catch (e) {
      problem("take-files", where, `cannot open: ${e.message}`);
      return;
    }
    const wb = z["xl/workbook.xml"]?.toString("utf8") ?? "";
    for (const name of ["Data", "README", "Sources", "Citation"]) if (!wb.includes(`name="${name}"`)) problem("take-files", where, `no ${name} sheet`);
    const data = z["xl/worksheets/sheet1.xml"];
    if (!data) return problem("take-files", where, "no Data sheet");
    checkLong(`${where} (Data)`, sheetRows(data.toString("utf8")), expectIds, false);
    const readme = z["xl/worksheets/sheet2.xml"]?.toString("utf8") ?? "";
    for (const must of [release.version, "Is this file still current?", "Licence", "How to cite"]) if (!readme.includes(must)) problem("take-files", where, `README sheet lacks "${must}"`);
  }

  function checkZip(where, buf, expectIds) {
    let z;
    try {
      z = unzip(buf);
    } catch (e) {
      problem("take-files", where, `cannot open: ${e.message}`);
      return;
    }
    for (const name of ["data.csv", "datapackage.json", "README.md", "LICENSE.txt", "CITATION.cff"]) if (!z[name]) problem("take-files", where, `no ${name}`);
    if (z["data.csv"]) checkLong(`${where} (data.csv)`, parseCsv(z["data.csv"].toString("utf8")), expectIds, false);
    if (z["CITATION.cff"] && !z["CITATION.cff"].toString("utf8").includes(release.version)) problem("take-files", where, "CITATION.cff does not name the release");
  }

  function checkBundle(stem, ids) {
    const csvP = path.join(dir, `${stem}.csv`);
    if (!fs.existsSync(csvP)) return problem("take-files", stem, "no CSV");
    checkLong(`${stem}.csv`, parseCsv(fs.readFileSync(csvP, "utf8")), ids, false);
    const x = path.join(dir, `${stem}.xlsx`);
    if (fs.existsSync(x)) checkXlsx(`${stem}.xlsx`, fs.readFileSync(x), ids);
    else problem("take-files", stem, "no .xlsx");
    const zp = path.join(dir, `${stem}.zip`);
    if (fs.existsSync(zp)) checkZip(`${stem}.zip`, fs.readFileSync(zp), ids);
    else problem("take-files", stem, "no .zip");
  }

  const allIds = [];
  const byDs = new Map();
  let versionSeries = 0;
  for (const s of vis) {
    const ids = (obsBySeries.get(s.series_id) ?? []).map((o) => o.obs_id);
    allIds.push(...ids);
    if (!byDs.has(s.dataset)) byDs.set(s.dataset, []);
    byDs.get(s.dataset).push(...ids);
    const slug = slugify(s.series_id);
    checkBundle(`series/${slug}`, ids);
    // Version files.
    const latestP = path.join(dir, "series", `${slug}.latest.csv`);
    if (!fs.existsSync(latestP)) continue;
    versionSeries++;
    for (const k of ["latest", "first"]) checkLong(`series/${slug}.${k}.csv`, parseCsv(fs.readFileSync(path.join(dir, "series", `${slug}.${k}.csv`), "utf8")), ids, false);
    checkLong(`series/${slug}.printings.csv`, parseCsv(fs.readFileSync(path.join(dir, "series", `${slug}.printings.csv`), "utf8")), ids, true);
    // Vintage grid: every value cell is the reading of a printing in that edition, of a checked figure.
    files++;
    const grid = parseCsv(fs.readFileSync(path.join(dir, "series", `${slug}.vintages.csv`), "utf8"));
    const head = grid[0];
    const mine = obsBySeries.get(s.series_id) ?? [];
    for (const r of grid.slice(1)) {
      if (r.length === 1) continue;
      const period = r[0];
      for (let i = 1; i < head.length; i++) {
        const m = /\[([^\]]+)\](?:, (.+))?$/.exec(head[i]);
        if (!m || head[i].endsWith(" status")) continue;
        const v = r[i] ?? "";
        const status = r[i + 1] ?? "";
        const src = m[1];
        const cands = mine.filter((o) => o.period === period && cellsOf(o).some((c) => cells.get(c)?.source_id === src));
        if (v === "") {
          emptyCells++;
          continue;
        }
        const ok = cands.some((o) => isPub(o) && cellsOf(o).some((c) => cells.get(c)?.source_id === src && String(c === o.primary_cell_id ? o.value : cells.get(c).value_parsed) === v));
        if (!ok) problem("take-files", `series/${slug}.vintages.csv`, `${period}, ${head[i]}: "${v}" is not a checked figure printed there`);
        else valueCells++;
        if (status !== "checked" && status !== "checked, with a note") problem("take-files", `series/${slug}.vintages.csv`, `${period}, ${head[i]}: a value with status "${status}"`);
      }
      for (const k of META) if (!r[head.indexOf(k)]) problem("take-files", `series/${slug}.vintages.csv`, `${period}: empty ${k}`);
    }
  }
  for (const [ds, ids] of byDs) checkBundle(`datasets/${ds}`, ids);
  checkBundle("all", allIds);

  // What the compare page draws.
  let pts = 0;
  for (const s of vis) {
    const p = path.join(dir, "compare", `${slugify(s.series_id)}.json`);
    if (!fs.existsSync(p)) {
      problem("take-files", `compare/${s.series_id}`, "missing");
      continue;
    }
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    if (j.release !== release.version) problem("take-files", p, `release ${j.release}`);
    const mine = obsBySeries.get(s.series_id) ?? [];
    if (j.pts.length !== mine.length) problem("take-files", `compare/${s.series_id}`, `${j.pts.length} points, ${mine.length} figures`);
    const bySlug = new Map(mine.map((o) => [slugify(o.obs_id), o]));
    for (const x of j.pts) {
      pts++;
      const o = bySlug.get(x.o);
      if (!o) {
        problem("take-files", `compare/${s.series_id}`, `point ${x.o} is not a figure of this series`);
        continue;
      }
      if (o.period !== x.p) problem("take-files", `compare/${s.series_id}`, `${x.o}: period ${x.p}`);
      const want = isPub(o) ? o.value : null;
      if (x.v !== want) problem("take-files", `compare/${s.series_id}`, `${x.o}: value ${x.v}, release ${want}`);
      if (x.d === 1 && !(isPub(o) && o.status === "checked")) problem("take-files", `compare/${s.series_id}`, `${x.o} may feed a derived value but is not checked`);
    }
  }
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "compare", "index.json"), "utf8"));
  for (const e of idx) {
    const mine = (obsBySeries.get(e.id) ?? []).filter(isPub);
    if (e.c !== mine.length) problem("take-files", "compare/index.json", `${e.id}: ${e.c} checked figures, release ${mine.length}`);
  }
  return `${files} files and tables opened (${versionSeries} series with version files); ${valueCells} values equal the release, ${emptyCells} figures without a value are empty; ${pts} compare points`;
}
