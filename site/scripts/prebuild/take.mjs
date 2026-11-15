// Downloads (DESIGN.md 13.1, 8.2): every file a reader can take away, written at
// build time from the release only, read through the adapter so the status of
// every figure is the adapter's decision.
//
// Writes under public/data/<release>/:
//   series/<id>.csv        long CSV, one row per figure (replaces the older layout at the same address)
//   series/<id>.xlsx       Data, README, Sources and Citation sheets
//   series/<id>.zip        data package: the CSV, datapackage.json, README.md, LICENSE.txt, CITATION.cff
//   series/<id>.{latest,first,printings,vintages}.csv   version files, for series printed in more than one edition
//   datasets/<key>.{csv,xlsx,zip}                      per data type (replaces the older CSV at the same address)
//   all.{csv,xlsx,zip}                                 the whole release
//   compare/<id>.json, compare/index.json              what the compare page draws (checked by scripts/checks/take-files.mjs)
//   files.json                                         size of every file above, for the pages that list them
//
// A figure that has not passed its checks has an empty value in every file and
// its status in its own column. A printed dash is never written as 0.
// .xlsx and .zip are written with node:zlib (raw deflate) and a CRC-32 written
// here; no dependency.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";

/* ---------------- CRC-32, zip, xlsx ---------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip archive (deflate) of [{ name, data }], dated `when` (a Date). */
export function zip(entries, when) {
  const time = ((when.getUTCHours() & 31) << 11) | ((when.getUTCMinutes() & 63) << 5) | ((when.getUTCSeconds() / 2) & 31);
  const date = (((when.getUTCFullYear() - 1980) & 127) << 9) | (((when.getUTCMonth() + 1) & 15) << 5) | (when.getUTCDate() & 31);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, "utf8");
    const comp = zlib.deflateRawSync(raw, { level: 9 });
    const name = Buffer.from(e.name, "utf8");
    const crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // names are UTF-8
    lh.writeUInt16LE(8, 8); // deflate
    lh.writeUInt16LE(time, 10);
    lh.writeUInt16LE(date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(time, 12);
    ch.writeUInt16LE(date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const xmlEsc = (s) =>
  String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function colName(i) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * One worksheet. rows: arrays of cells; a cell is a string (text), { n: "123.4" }
 * (a number, written exactly as the stored decimal), or null/"" (empty).
 * The first row is a bold header and is frozen when `header` is set.
 */
function sheetXml(rows, { header = true, widths = [] } = {}) {
  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  out.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
  if (header) out.push('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>');
  if (widths.length) out.push(`<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`);
  out.push("<sheetData>");
  rows.forEach((row, r) => {
    const cells = [];
    row.forEach((v, c) => {
      if (v === null || v === undefined || v === "") return;
      const ref = `${colName(c)}${r + 1}`;
      const style = header && r === 0 ? ' s="1"' : typeof v === "string" && v.length > 80 ? ' s="2"' : "";
      if (typeof v === "object") cells.push(`<c r="${ref}"${style}><v>${xmlEsc(v.n)}</v></c>`);
      else cells.push(`<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`);
    });
    out.push(`<row r="${r + 1}">${cells.join("")}</row>`);
  });
  out.push("</sheetData></worksheet>");
  return out.join("");
}

/** An .xlsx workbook of [{ name, rows, header, widths }]. */
export function xlsx(sheets, meta, when) {
  const ns = "http://schemas.openxmlformats.org";
  const files = [];
  files.push({
    name: "[Content_Types].xml",
    data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<Types xmlns="${ns}/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      "</Types>",
  });
  files.push({
    name: "_rels/.rels",
    data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<Relationships xmlns="${ns}/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `<Relationship Id="rId2" Type="${ns}/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      "</Relationships>",
  });
  files.push({
    name: "docProps/core.xml",
    data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<cp:coreProperties xmlns:cp="${ns}/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>${xmlEsc(meta.title)}</dc:title><dc:creator>${xmlEsc(meta.creator)}</dc:creator><dc:description>${xmlEsc(meta.description)}</dc:description>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${when.toISOString().slice(0, 19)}Z</dcterms:created>` +
      "</cp:coreProperties>",
  });
  files.push({
    name: "xl/workbook.xml",
    data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>` +
      sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
      "</sheets></workbook>",
  });
  files.push({
    name: "xl/_rels/workbook.xml.rels",
    data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<Relationships xmlns="${ns}/package/2006/relationships">` +
      sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${sheets.length + 1}" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      "</Relationships>",
  });
  files.push({
    name: "xl/styles.xml",
    data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<styleSheet xmlns="${ns}/spreadsheetml/2006/main">` +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>",
  });
  sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s.rows, s) }));
  return zip(files, when);
}

const csvEsc = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const csv = (header, rows) => [header, ...rows].map((r) => r.map(csvEsc).join(",")).join("\r\n") + "\r\n";

/* ---------------- the step ---------------- */

export default async function take(ctx) {
  const { siteDir, version, dest, slugify } = ctx;
  const imp = (rel) => import(pathToFileURL(path.join(siteDir, rel)).href);
  const { loadDatalab } = await imp("src/lib/adapter/datalab.ts");
  const { formatCitation, citationCff, longDate, CITE_BOTH, PORTAL_AUTHOR } = await imp("src/lib/cite-format.ts");
  const { unitLabel, periodWords, DOC_TYPE_WORDS } = await imp("src/lib/format.ts");
  const { KIND, STAGE_KINDS } = await imp("src/lib/words.ts");
  const { LONG_COLUMNS, VERSION_FILES } = await imp("src/lib/take-columns.ts");
  const cfg = JSON.parse(fs.readFileSync(path.join(siteDir, "release.config.json"), "utf8"));
  if ((cfg.adapter ?? "datalab") !== "datalab") throw new Error("take: only the datalab adapter is switched on");
  const d = loadDatalab(ctx.src);

  const now = new Date();
  const generated = now.toISOString().slice(0, 10);
  const when = new Date(`${generated}T00:00:00Z`);
  const base = (cfg.siteUrl ?? "").replace(/\/$/, "");
  const pinned = (p) => `${base}/${version}${p}`;
  const currentUrl = `${base}/releases`;
  const LICENCE = d.info.licence;
  const relInfo = { id: version, year: (d.release.created_at ?? "").slice(0, 4) || "n.d.", doi: d.release.doi ?? null, isPrototype: d.info.isPrototype };
  const accessed = longDate(generated);
  const STATUS_TEXT = {
    checked: "checked",
    "checked-note": "checked, with a note",
    candidate: "not signed off",
    revised: "revised",
    disputed: "disputed",
    held: "held back",
    "not-checked": "not checked yet",
    "not-printed": "not printed",
    "dash-or-zero": "dash or zero",
    unknown: "no value",
  };

  const visible = (s) => ["published", "candidate"].includes(d.release.dataset_status?.[s.dataset]?.state ?? "");
  const seriesList = d.series.filter(visible);
  const docUrl = (src) => src?.file_url ?? src?.landing_url ?? src?.wayback_url ?? "";
  const kindLong = (k) => KIND[k]?.long ?? k;
  const what = (o, s) => {
    const p = periodWords(o.period, s.frequency);
    if (o.kind === "as_printed") return `${s.series_id}, ${p}`;
    return STAGE_KINDS.includes(o.kind) || o.kind === "survey_round" ? `${s.series_id}, ${kindLong(o.kind)} ${p}` : `${s.series_id}, ${p}, ${kindLong(o.kind)}`;
  };
  // A printed text that carries no digit (a dash, a blank) may be shown for any figure: it is the evidence of a gap.
  const printedFor = (o, cell) => (!cell ? "" : o.reader.showsValue ? (cell.value_raw ?? "") : /\d/.test(cell.value_raw ?? "") ? "" : (cell.value_raw ?? "").trim());

  function citeFigure(o, s, cell, src) {
    const doc = src
      ? { publisher: src.publisher, title: src.title, page: cell ? (cell.page_label ?? String(cell.page)) : null, pdfPage: cell?.page ?? null, label: cell?.row_label_raw ?? null, url: docUrl(src) || null }
      : null;
    return formatCitation({ release: relInfo, url: pinned(`/o/${slugify(o.obs_id)}`), accessed, accessedIso: generated, bracket: what(o, s), doc, title: s.name });
  }

  /** One row of the long layout for a figure, read from one printed cell (the primary one unless given). */
  function longRow(o, s, cellArg) {
    const cell = cellArg ?? (o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : null);
    const src = cell ? d.sourceById.get(cell.source_id) : null;
    // A printing other than the primary one carries its own reading, only for a figure that passed its checks.
    const value = !o.reader.showsValue ? "" : cellArg && cellArg.cell_id !== o.primary_cell_id ? (cellArg.value_parsed ?? "") : (o.value ?? "");
    return {
      series_id: s.series_id,
      series_name: s.name,
      period: o.period,
      kind: kindLong(o.kind),
      kind_code: o.kind,
      printed_in: src?.title ?? "",
      edition: src?.period ?? "",
      publisher: src?.publisher ?? "",
      page: cell ? (cell.page_label ?? String(cell.page)) : "",
      pdf_page: cell ? String(cell.page) : "",
      value_as_printed: printedFor(o, cell),
      value,
      unit: unitLabel(o.unit, o.scale_factor),
      unit_code: o.unit,
      scale_factor: String(o.scale_factor),
      status: STATUS_TEXT[o.reader.key] ?? o.reader.key,
      status_code: o.reader.key,
      status_reason: o.reader.key === "checked" ? (o.reader.reason ?? "") : o.reader.reason,
      release: version,
      receipt_url: pinned(`/o/${slugify(o.obs_id)}`),
      obs_id: o.obs_id,
      source_id: src?.source_id ?? "",
      source_url: docUrl(src),
      source_sha256: src?.sha256 ?? "",
      cell_id: cell?.cell_id ?? "",
      generated,
      licence: LICENCE,
      citation: citeFigure(o, s, cell, src).sentence,
      is_this_current: currentUrl,
    };
  }
  const COLS = LONG_COLUMNS.map(([k]) => k);
  const asCsvRow = (r) => COLS.map((c) => r[c]);
  const asXlsxRow = (r) => COLS.map((c) => (c === "value" && r.value !== "" ? { n: r.value } : r[c]));

  /* ---- printings of a figure, oldest edition first ---- */
  const edKey = (cell) => {
    const src = d.sourceById.get(cell.source_id);
    return `${src?.period ?? ""}|${cell.source_id}`;
  };
  const printCache = new Map();
  function printings(o) {
    const hit = printCache.get(o.obs_id);
    if (hit) return hit;
    const ids = [o.primary_cell_id, ...o.supporting_cell_ids].filter(Boolean);
    const cells = [...new Set(ids)].map((id) => d.cellById.get(id)).filter(Boolean);
    cells.sort((a, b) => edKey(a).localeCompare(edKey(b)) || (a.cell_id === o.primary_cell_id ? -1 : b.cell_id === o.primary_cell_id ? 1 : 0));
    printCache.set(o.obs_id, cells);
    return cells;
  }
  const isMulti = (obs) => obs.some((o) => new Set(printings(o).map((c) => c.source_id)).size > 1);

  /* ---- README, Sources and Citation, shared by every file ---- */
  const statusLines = [
    ["checked", "The figure passed its checks. value holds it."],
    ["checked, with a note", "Passed its checks; the document attaches a note to it."],
    ["disputed", "Two official documents print different figures; no single value is given."],
    ["held back", "Did not pass its checks; no value is given."],
    ["not checked yet", "Read, but no check covers it yet; no value is given."],
    ["not printed", "The document prints a dash or a blank, not a number. A dash is never read as zero."],
  ];
  function readmeRows({ title, scope, rows, cite, pagePath }) {
    return [
      ["What this file is", title],
      ["Scope", scope],
      ["Rows", `One row per figure (${rows} rows), including figures that have no value: their status says why.`],
      ["Release", version],
      ["Generated", generated],
      ["Licence", `${LICENCE}. Reuse freely with attribution.`],
      ["Is this file still current?", `${currentUrl} lists every release and every correction made since ${version}.`],
      ["This view on the site", pinned(pagePath)],
      ["How to cite", cite.sentence],
      ["", CITE_BOTH],
      ...(d.info.isPrototype ? [["Prototype", "This is a prototype release: not yet for citation in publications, and it has no DOI."]] : []),
      ["", ""],
      ["Statuses", "Status is always its own column. A figure without a value is a row with an empty value and its status, never a missing row and never a zero."],
      ...statusLines,
      ["", ""],
      ["Columns", ""],
      ...LONG_COLUMNS,
    ];
  }
  const readmeMd = (rows) =>
    rows
      .map(([k, v]) => (k === "Columns" || k === "Statuses" ? `\n## ${k}\n\n${v}` : !k && !v ? "" : k ? `- **${k}**: ${v}` : `  ${v}`))
      .join("\n")
      .replace(/^/, "# README\n\n") + "\n";
  function sourcesRows(rowObjs) {
    const ids = [...new Set(rowObjs.map((r) => r.source_id).filter(Boolean))];
    const srcs = ids.map((id) => d.sourceById.get(id)).filter(Boolean);
    srcs.sort((a, b) => a.doc_type.localeCompare(b.doc_type) || a.period.localeCompare(b.period));
    return [
      ["source_id", "publisher", "title", "edition", "official_url", "archive_url", "sha256", "pdf_pages", "retrieved"],
      ...srcs.map((s) => [s.source_id, s.publisher, s.title, s.period, s.file_url ?? s.landing_url ?? "", s.wayback_url ?? "", s.sha256, s.page_count ? String(s.page_count) : "", (s.retrieved_at ?? "").slice(0, 10)]),
    ];
  }
  const citeRows = (c) => [
    ["Style", "Citation"],
    ["Sentence", c.sentence],
    ["", CITE_BOTH],
    ["APA", c.apa],
    ["Chicago", c.chicago],
    ["Harvard", c.harvard],
    ["BibTeX", c.bibtex],
    ["RIS", c.ris],
  ];
  function datapackage(name, title, rowsN) {
    return JSON.stringify(
      {
        name,
        title,
        version,
        created: generated,
        licenses: [{ name: "CC-BY-4.0", path: "https://creativecommons.org/licenses/by/4.0/", title: "Creative Commons Attribution 4.0" }],
        homepage: pinned("/data"),
        "is-this-current": currentUrl,
        resources: [
          {
            name: "data",
            path: "data.csv",
            format: "csv",
            mediatype: "text/csv",
            encoding: "utf-8",
            rows: rowsN,
            schema: {
              fields: LONG_COLUMNS.map(([k, desc]) => ({ name: k, type: k === "value" ? "number" : k === "pdf_page" ? "integer" : "string", description: desc })),
              missingValues: [""],
            },
          },
        ],
      },
      null,
      2,
    );
  }
  const licenceText = `${title0()}\n\nLicensed under the Creative Commons Attribution 4.0 International licence (CC BY 4.0):\nhttps://creativecommons.org/licenses/by/4.0/\n\nYou may share and adapt the data for any purpose, provided you give credit.\n${CITE_BOTH}\nThe figures are read from official documents of the Government of Pakistan, which remain the authority.\n`;
  function title0() {
    return `LUMS DataLab, release ${version}`;
  }

  const sizes = {};
  const write = (rel, data) => {
    const full = path.join(dest, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, data);
    sizes[rel] = Buffer.byteLength(data);
  };

  /** CSV + xlsx + zip for a set of figures. */
  function bundle(relBase, { title, scope, pagePath, rows: rowObjs, cite, packageName }) {
    const csvText = csv(COLS, rowObjs.map(asCsvRow));
    write(`${relBase}.csv`, csvText);
    const readme = readmeRows({ title, scope, rows: rowObjs.length, cite, pagePath });
    write(
      `${relBase}.xlsx`,
      xlsx(
        [
          { name: "Data", rows: [COLS, ...rowObjs.map(asXlsxRow)], header: true, widths: COLS.map((c) => (c === "series_name" || c === "printed_in" || c === "status_reason" || c === "citation" ? 40 : c === "value" || c === "value_as_printed" ? 16 : 14)) },
          { name: "README", rows: [["Item", "Text"], ...readme], header: true, widths: [28, 120] },
          { name: "Sources", rows: sourcesRows(rowObjs), header: true, widths: [22, 36, 40, 12, 50, 50, 66, 10, 12] },
          { name: "Citation", rows: citeRows(cite), header: true, widths: [12, 120] },
        ],
        { title, creator: PORTAL_AUTHOR, description: `Release ${version}, generated ${generated}. ${LICENCE}. Is this file still current? ${currentUrl}` },
        when,
      ),
    );
    write(
      `${relBase}.zip`,
      zip(
        [
          { name: "data.csv", data: csvText },
          { name: "datapackage.json", data: datapackage(packageName, title, rowObjs.length) },
          { name: "README.md", data: readmeMd(readme) },
          { name: "LICENSE.txt", data: licenceText },
          { name: "CITATION.cff", data: citationCff({ releaseId: version, date: generated, url: pinned(pagePath), title, isPrototype: d.info.isPrototype }) },
        ],
        when,
      ),
    );
  }

  const order = (a, b) => a.period.localeCompare(b.period) || a.kind.localeCompare(b.kind);
  const allRows = [];
  const byDataset = new Map();
  let multiN = 0;
  for (const s of seriesList) {
    const obs = (d.obsBySeries.get(s.series_id) ?? []).slice().sort(order);
    const rows = obs.map((o) => longRow(o, s));
    allRows.push(...rows);
    if (!byDataset.has(s.dataset)) byDataset.set(s.dataset, []);
    byDataset.get(s.dataset).push(...rows);
    const slug = slugify(s.series_id);
    // Publisher first, as on the series page (src/lib/take.ts citationFor): "Annual Budget Statement, editions 2010-11 to 2026-27".
    const srcs = [...new Set(obs.map((o) => (o.primary_cell_id ? d.cellById.get(o.primary_cell_id)?.source_id : null)).filter(Boolean))]
      .map((id) => d.sourceById.get(id))
      .filter(Boolean)
      .sort((a, b) => a.period.localeCompare(b.period));
    const seriesDoc = srcs.length
      ? { publisher: srcs[0].publisher, title: `${DOC_TYPE_WORDS[srcs[0].doc_type] ?? srcs[0].doc_type}, ${srcs.length > 1 ? `editions ${srcs[0].period} to ${srcs.at(-1).period}` : `edition ${srcs[0].period}`}`, label: null, url: null }
      : null;
    const seriesCite = formatCitation({ release: relInfo, url: pinned(`/series/${slug}`), accessed, accessedIso: generated, bracket: `${s.series_id}, ${s.name}`, doc: seriesDoc, title: s.name });
    bundle(`series/${slug}`, {
      title: `${s.name} (${s.series_id})`,
      scope: "This series, all periods and every kind of figure, as published in this release.",
      pagePath: `/series/${slug}`,
      rows,
      cite: seriesCite,
      packageName: slug.toLowerCase().replace(/[^a-z0-9._-]/g, "-"),
    });

    // Version files (8.2), where some figure is printed in more than one edition.
    if (isMulti(obs)) {
      multiN++;
      const latest = obs.map((o) => longRow(o, s, printings(o).at(-1) ?? null));
      const first = obs.map((o) => longRow(o, s, printings(o)[0] ?? null));
      const every = obs.flatMap((o) => {
        const ps = printings(o);
        return ps.length ? ps.map((c) => longRow(o, s, c)) : [longRow(o, s)];
      });
      write(`series/${slug}.latest.csv`, csv(COLS, latest.map(asCsvRow)));
      write(`series/${slug}.first.csv`, csv(COLS, first.map(asCsvRow)));
      write(`series/${slug}.printings.csv`, csv(COLS, every.map(asCsvRow)));
      // Vintage grid: rows = period, columns = edition (and kind), each with its status beside it.
      const colsMap = new Map();
      for (const o of obs)
        for (const c of printings(o)) {
          const src = d.sourceById.get(c.source_id);
          const k = `${src?.period ?? ""}|${c.source_id}|${o.kind}`;
          if (!colsMap.has(k)) colsMap.set(k, { source: src, sourceId: c.source_id, kind: o.kind });
        }
      const kindRank = (k) => ["be", "re", "actual", "ac", "provisional"].indexOf(k) + 1 || 9;
      const gridCols = [...colsMap.entries()].sort((a, b) => a[1].source?.period.localeCompare(b[1].source?.period ?? "") || a[1].sourceId.localeCompare(b[1].sourceId) || kindRank(a[1].kind) - kindRank(b[1].kind)).map(([, v]) => v);
      const head = (g) => `${g.source?.title ?? g.sourceId} [${g.sourceId}]${g.kind === "as_printed" ? "" : `, ${kindLong(g.kind)}`}`;
      const header = ["period", ...gridCols.flatMap((g) => [head(g), `${head(g)} status`]), "release", "generated", "licence", "citation", "is_this_current"];
      const periods = [...new Set(obs.map((o) => o.period))].sort();
      const gridRows = periods.map((p) => [
        p,
        ...gridCols.flatMap((g) => {
          const o = obs.find((x) => x.period === p && x.kind === g.kind && printings(x).some((c) => c.source_id === g.sourceId));
          if (!o) return ["", ""];
          const cs = printings(o).filter((c) => c.source_id === g.sourceId);
          const c = cs.find((x) => x.cell_id === o.primary_cell_id) ?? cs[0];
          return [longRow(o, s, c).value, STATUS_TEXT[o.reader.key] ?? o.reader.key];
        }),
        version,
        generated,
        LICENCE,
        seriesCite.sentence,
        currentUrl,
      ]);
      write(`series/${slug}.vintages.csv`, csv(header, gridRows));
    }

    // What the compare page draws: checked values only; every other figure is a point with no value and its status.
    const pts = obs.map((o) => {
      const cell = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : null;
      const src = cell ? d.sourceById.get(cell.source_id) : null;
      return {
        p: o.period,
        k: o.kind,
        v: o.reader.showsValue ? o.value : null,
        d: o.reader.usableInDerived && o.reader.showsValue ? 1 : 0,
        s: o.reader.key,
        r: o.reader.key === "checked" ? undefined : o.reader.reason,
        o: slugify(o.obs_id),
        doc: src?.title,
        src: src?.source_id,
        pg: cell ? (cell.page_label ?? String(cell.page)) : undefined,
      };
    });
    write(
      `compare/${slug}.json`,
      JSON.stringify({
        release: version,
        id: s.series_id,
        n: s.name,
        // Plain title for the legend and picker (editorial/titles.json); n stays the printed name, used in the CSV.
        t: s.title,
        ds: d.release.dataset_status?.[s.dataset]?.name ?? s.dataset,
        dk: s.dataset,
        u: s.unit,
        sf: s.scale_factor,
        uw: unitLabel(s.unit, s.scale_factor),
        f: s.frequency,
        def: s.dims?.definition ?? null,
        base: s.dims?.base_year ?? null,
        parent: s.parent_id && d.seriesById.has(s.parent_id) && visible(d.seriesById.get(s.parent_id)) ? s.parent_id : null,
        br: (s.breaks ?? []).map((b) => ({ p: b.at_period, k: b.kind, note: b.note })),
        pts,
      }),
    );
  }

  // Search index for the compare box: names only, no values.
  write(
    "compare/index.json",
    JSON.stringify(
      seriesList.map((s) => {
        const pub = (d.obsBySeries.get(s.series_id) ?? []).filter((o) => o.reader.showsValue).map((o) => o.period).sort();
        return { id: s.series_id, n: s.title, d: d.release.dataset_status?.[s.dataset]?.name ?? s.dataset, u: unitLabel(s.unit, s.scale_factor), y: [s.name, ...(s.synonyms ?? [])].join(" "), c: pub.length, p: pub.length ? `${pub[0]} to ${pub.at(-1)}` : "" };
      }),
    ),
  );

  // Per data type and the whole release.
  const relCite = formatCitation({ release: relInfo, url: pinned("/data"), accessed, accessedIso: generated, bracket: null, doc: null, title: `Release ${version}` });
  for (const [ds, rows] of byDataset) {
    const name = d.release.dataset_status?.[ds]?.name ?? ds;
    bundle(`datasets/${ds}`, {
      title: `${name}: every figure in release ${version}`,
      scope: `Every series of the data type "${name}", every period and kind of figure.`,
      pagePath: `/datasets/${ds}`,
      rows,
      cite: formatCitation({ release: relInfo, url: pinned(`/datasets/${ds}`), accessed, accessedIso: generated, bracket: ds, doc: null, title: name }),
      packageName: `lums-datalab-${ds}`,
    });
  }
  bundle("all", {
    title: `Every figure in release ${version}`,
    scope: "The whole release: every series of every published data type, every period and kind of figure.",
    pagePath: "/data",
    rows: allRows,
    cite: relCite,
    packageName: "lums-datalab-release",
  });

  write("files.json", JSON.stringify({ release: version, generated, versionFiles: VERSION_FILES.map((v) => v.key), sizes }, null, 0));
  return `${Object.keys(sizes).length} files (${seriesList.length} series, ${multiN} with version files, ${byDataset.size} data types, whole release)`;
}
