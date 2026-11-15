// The golden adapter: reads one tagged golden release of Ahmad's repository
// (the extracted `golden/` folder of a tag such as golden-2026.11.11) and
// produces the same Db as the datalab adapter (DESIGN.md 5.1). NOT SWITCHED ON:
// data.ts refuses every adapter but "datalab" (decision 17.7). The contract
// tests (scripts/contract-test.mjs) run it against the real tag.
//
// ---------------------------------------------------------------- fingerprints
// Before any row is read, every golden data file is hashed and compared
// (DESIGN.md 5, task A8), exactly as his query tool does (core/fingerprint.py):
//   file hash    = SHA-256 of the file's bytes with CRLF turned into LF
//   catalogue    = golden/catalogue.json `fingerprints` {file: hash} per dataset
//   dataset hash = SHA-256 of the sorted "name:hash" lines joined by "\n",
//                  which must equal golden/RELEASE.json datasets.<id>.fingerprint
// Any difference throws an error that names the file. The release id in
// RELEASE.json must equal the pinned tag. A golden dataset listed in the
// catalogue but not in RELEASE.json was added after the release: it is not
// read (GoldenDb.notInRelease names it). After parsing, each dataset's row
// count must equal RELEASE.json `rows`.
//
// ---------------------------------------------------------------- statuses
// The only place his vocabulary is interpreted (DESIGN.md 5.2 and the section
// 17 proposals). Per row, the first rule that applies wins:
//   1. misprint* (or a survey check_status "differs")  -> held, the source's own
//      explanation from exceptions.csv as the reason (decision 17.2)
//   2. unpublished* (or check_status "not_published")  -> not-checked: PBS did
//      not print it, so no published figure checks it (decision 17.8)
//   3. an asterisk this code does not know              -> unknown (no value)
//   4. a budget dataset with no printed-text column (the three federal ABS
//      datasets) and a stored 0                        -> dash-or-zero: no value,
//      never usable in a derived value (decision 17.3)
//   5. printed text that is a dash                      -> not-printed
//   6. a row of a candidate dataset                     -> candidate (decision
//      17.1); an asterisk note is added to the reason
//   7. restated*, memo*, assumption*, small_sample*     -> checked-note, with the
//      exceptions.csv text
//   8. any other row of a golden (signed-off) dataset   -> checked
//   A held batch (catalogue `held_batches`: a budget year or survey round with
//   no rows at all) -> a BatchGap with status "held" and the catalogue's reason.
// Only deterministic evidence counts. His Economic Survey "second reading" (a
// Haiku transcription that agreed with every value) is ignored for status and
// never cited: no field of this adapter reads it.
// A value (and the printed text, and our recomputed value) travels only where
// the reader status shows one; everything else is emptied here, so no page
// can show it by mistake. A printed dash is kept as text: it is not a number.
//
// ---------------------------------------------------------------- kinds (6.2)
//   estimate_type BE / RE / ACTUAL / AC -> be / re / actual / ac
//   Economic Survey: partial_period (Jul-Mar ...) -> part_year; otherwise the
//   printed column flag F / R / P -> final / es_revised / es_provisional; no
//   flag -> as_printed. Survey indicators -> survey_round.
//
// ---------------------------------------------------------------- series ids
// His rows have keys, not series ids. The rule (his query/series.py: "a series
// is one item in one group"):
//   series_id = "golden." + dataset + "." + each GROUP column value, in his
//               order, an empty value written "_" + "." + the item key
//   item key  = his doc_lookup.CONFIG item column: item_id (federal economic,
//               receipts), code (functional), line_key (KP, Sindh),
//               "grant_no grant_name" (Demands for Grants), indicator (Economic
//               Survey and surveys)
//   GROUP     = his series.GROUP; the survey datasets are not in his series
//               tool, so their group is the rest of their grain: geography,
//               area, sex.
//   e.g. golden.abs_federal_functional.current_capital.total.1.01
// An id never changes meaning while his keys keep theirs. Two ids that would
// give the same URL slug stop the load.
//   obs_id = series_id ":" period ":" vintage [":" doc_fy] [":" extra grain]
//   vintage = be / re / actual / ac for budget rows, "na" otherwise; doc_fy is
//   the document (ABS, DFG book, Survey edition) that printed the figure, so
//   every printing is its own observation, as his rows are.
//
// ---------------------------------------------------------------- evidence
// Budget and Economic Survey rows: printed-cell (document, PDF page, box).
// His boxes are PDF points (pdfplumber, origin top-left). The release does not
// carry page sizes or page images (decision 17.7), so the box can only become
// fractions when the caller supplies the page size (opts.pageSize); then the
// box is "tentative" (his proof index, not shipped, is what confirms a box).
// Without a page size the box is null with boxState "no-image", and the points
// are kept in GoldenEvidence.boxPoints with a sentence saying why.
// Survey indicators: recomputed (our value, PBS's printed value, the table and
// page it was checked against, the method in words).
// budget_credibility (derived): derived evidence, a formula and the two printed
// figures it uses; a deviation whose inputs are not usable is itself withheld
// with the input's status (gaps travel, DESIGN.md 6.1). It is not in
// golden-2026.11.11 (added to his repository after the tag), so this code runs
// only when a release lists it.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Cell, Db, Observation, Release, Series, Source } from "../data";
import { slugify } from "../ids.ts";
import { readerStatus } from "../words.ts";
import { readTitles, titleFields } from "./titles.ts";
import type { BatchGap, Evidence, KindKey, ReaderStatus, ReaderStatusKey, ReleaseInfo, SeriesBreak } from "./contract";

/* ---------- options and the extra things this adapter returns ---------- */

export type GoldenOptions = {
  /** The pinned tag, e.g. "golden-2026.11.11". RELEASE.json must name the same release. */
  tag: string;
  /** Page size in PDF points for a document (by file SHA-256) and 1-based page, when known. */
  pageSize?: (sourceSha256: string, page: number) => { width: number; height: number } | null;
  /** his query/series_breaks.csv; default: ../query/series_breaks.csv next to the golden folder, if present. */
  breaksCsv?: string | null;
  /** his registry/signoffs.csv; default: ../registry/signoffs.csv next to the golden folder, if present. */
  signoffsCsv?: string | null;
  /** The commit the tag points to, if the caller knows it (the extracted folder does not say). */
  commit?: string;
  isLatest?: boolean;
  /**
   * Plain titles (site/editorial/titles.json, DESIGN.md 6.4), keyed by series id. Default: none. Golden series ids
   * are not ours, so today no golden series has an entry: each keeps its printed name as its title, with
   * titleStatus "printed", and pages say the title is the printed label.
   */
  titlesFile?: string | null;
};

export type GoldenEvidence = Evidence & {
  /** printed-cell only: his box in PDF points [x0, top, x1, bottom], kept when it could not be made fractions. */
  boxPoints?: [number, number, number, number] | null;
  /** Why the box is what it is, in one sentence. */
  boxNote?: string;
};

export type SignoffRow = { date_utc: string; dataset_id: string; scope: string; decision: string; status_after: string; reviewer: string; evidence: string; note: string };

export type GoldenDb = Db & {
  /** Evidence of each observation (DESIGN.md 5.1), by obs_id. */
  evidence: Map<string, GoldenEvidence[]>;
  /** Which dataset and document printed each observation. */
  printing: Map<string, { dataset: string; doc: string | null; sourceId: string | null }>;
  /** "<dataset>#<row index in its CSV, from 0>" -> obs_id. */
  rowObs: Map<string, string>;
  /** His natural key of a figure ("doc|ref|EST|table|code|instance" for the functional table) -> obs_id. */
  keyObs: Map<string, string>;
  /** Golden datasets in the catalogue that are not part of this release (added after it). Not read. */
  notInRelease: string[];
  /** Sources held but not verified (catalogue layer "source"): names only, never a number. */
  heldSources: { id: string; name: string; status: string }[];
  /** The public sign-off log (not fingerprinted by the release; read as is). */
  signoffs: SignoffRow[];
};

/* ---------- CSV and hashing ---------- */

/** RFC 4180 CSV: quoted fields, "" escapes, CRLF or LF, a leading BOM. Returns header-keyed rows. */
export function parseCsv(text: string): Record<string, string>[] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const head = rows.shift() ?? [];
  return rows.filter((r) => !(r.length === 1 && r[0] === "")).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

/** His file fingerprint: SHA-256 of the bytes with CRLF -> LF (core/fingerprint.py file_hash). */
export function fileHash(file: string): string {
  const buf = fs.readFileSync(file);
  const out = Buffer.alloc(buf.length);
  let n = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a) continue;
    out[n++] = buf[i];
  }
  return crypto.createHash("sha256").update(out.subarray(0, n)).digest("hex");
}

/** His combined dataset fingerprint (core/fingerprint.py combined). */
export function combinedHash(fps: Record<string, string>): string {
  const lines = Object.keys(fps)
    .sort()
    .map((k) => `${k}:${fps[k]}`);
  return crypto.createHash("sha256").update(lines.join("\n")).digest("hex");
}

/* ---------- his catalogue ---------- */

type CatalogueEntry = {
  dataset_id: string;
  layer: string;
  name: string;
  publisher?: string;
  level?: string;
  status: string;
  signoff?: string;
  unit?: string;
  path?: string;
  batch_column?: string;
  verification?: string;
  caveat_notes?: string[];
  fingerprints?: Record<string, string>;
  held_batches?: { batch: string; reason: string }[];
  reliability?: { class?: string; tier?: string; status?: string; note?: string };
};

type ReleaseJson = { release: string; created_utc: string; datasets: Record<string, { rows: number; fingerprint: string }> };

/* ---------- shapes and the series rule ---------- */

type Shape = "budget" | "survey_es" | "survey" | "derived";

/** His series.GROUP, plus the survey datasets (not in his series tool): the rest of their grain. */
const GROUP: Record<string, string[]> = {
  abs_federal_functional: ["table", "row_type", "row_instance"],
  abs_federal_receipts: ["table"],
  abs_federal_economic: ["table"],
  kp_abs_summary: ["table"],
  sindh_abs_summary: ["table"],
  fed_dfg: ["charge_status", "row_instance"],
  pes_headline_indicators: ["period_type", "partial_period"],
  pes_debt_external: ["table_group", "period_type", "partial_period"],
  budget_credibility: ["table", "row_instance"],
};
const SURVEY_GROUP = ["geography", "area", "sex"];

/** Grain columns that are neither the series, the period, the kind nor the document, but still tell two printings apart. */
const EXTRA_GRAIN: Record<string, string[]> = {
  fed_dfg: ["source_table"],
  abs_federal_economic: ["row_seq"],
  abs_federal_receipts: ["row_seq"],
  kp_abs_summary: ["row_order"],
  sindh_abs_summary: ["row_order"],
  pes_debt_external: ["table"],
};

/** Readable title of a document family, used for source titles (no numbers). */
const DOC_TITLE: Record<string, string> = {
  abs_federal_economic: "Federal Annual Budget Statement",
  abs_federal_functional: "Federal Annual Budget Statement",
  abs_federal_receipts: "Federal Annual Budget Statement",
  fed_dfg: "Federal Demands for Grants and Appropriations",
  kp_abs_summary: "Khyber Pakhtunkhwa Annual Budget Statement",
  sindh_abs_summary: "Sindh Annual Budget Statement",
  pes_headline_indicators: "Pakistan Economic Survey",
  pes_debt_external: "Pakistan Economic Survey",
};

function shapeOf(ds: string, cols: string[]): Shape {
  const has = (c: string) => cols.includes(c);
  if (has("budget_estimate") && has("revised_estimate")) return "derived";
  if (has("round") && has("indicator") && has("check_status")) return "survey";
  if (has("doc_fy") && has("ref_period")) return "survey_es";
  if (has("doc_fy") && has("ref_fy") && has("estimate_type")) return "budget";
  throw new Error(`golden dataset ${ds}: row shape not known to this adapter (columns ${cols.join(", ")})`);
}

function itemKey(ds: string, shape: Shape, r: Record<string, string>): string {
  if (ds === "fed_dfg") return `${r.grant_no} ${r.grant_name}`;
  if (shape === "survey" || shape === "survey_es") return r.indicator;
  if (ds === "abs_federal_functional" || shape === "derived") return r.code;
  return r.item_id || r.line_key || r.code;
}

function seriesIdOf(ds: string, shape: Shape, r: Record<string, string>): string {
  const group = shape === "survey" ? SURVEY_GROUP : (GROUP[ds] ?? ["table"]);
  return ["golden", ds, ...group.map((c) => r[c] || "_"), itemKey(ds, shape, r)].join(".");
}

/* ---------- small helpers ---------- */

/** "1189082.0" -> "1189082"; "-0.0" -> "0"; anything that is not a plain decimal -> null. */
function decimal(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null;
  let out = t.replace(/^\+/, "");
  if (out.includes(".")) out = out.replace(/0+$/, "").replace(/\.$/, "");
  if (/^-0+$/.test(out)) out = "0";
  return out;
}

const isDash = (t: string | null | undefined) => !!t && /^[-‐‑‒–—―]+$/.test(t.trim());

function unitOf(shape: Shape, raw: string | undefined): { unit: string; scale: number } {
  if (shape === "budget" || shape === "derived") return { unit: "PKR", scale: 1_000_000 };
  const u = (raw ?? "").trim();
  if (u === "%" || u === "% growth") return { unit: "percent", scale: 1 };
  if (u === "Rs million") return { unit: "PKR", scale: 1_000_000 };
  if (u === "Rs billion") return { unit: "PKR", scale: 1_000_000_000 };
  if (u === "US$ million") return { unit: "USD", scale: 1_000_000 };
  return { unit: u || "as printed", scale: 1 };
}

const GEO: Record<string, string> = { Pakistan: "pk", Punjab: "pk-pb", Sindh: "pk-sd", "Khyber Pakhtunkhwa": "pk-kp", Balochistan: "pk-ba" };
function geoOf(ds: string, r: Record<string, string>): string | null {
  if (r.geography) return GEO[r.geography] ?? null;
  if (ds.startsWith("kp_")) return "pk-kp";
  if (ds.startsWith("sindh_")) return "pk-sd";
  return "pk";
}

function kindOf(shape: Shape, r: Record<string, string>): KindKey {
  if (shape === "survey") return "survey_round";
  if (shape === "survey_es") {
    if (r.partial_period) return "part_year";
    if (r.col_flag === "F") return "final";
    if (r.col_flag === "R") return "es_revised";
    if (r.col_flag === "P") return "es_provisional";
    return "as_printed";
  }
  const e = (r.estimate_type ?? "").toUpperCase();
  if (e === "BE") return "be";
  if (e === "RE") return "re";
  if (e === "ACTUAL") return "actual";
  if (e === "AC") return "ac";
  return "as_printed";
}

function frequencyOf(shape: Shape, r: Record<string, string>): string {
  if (shape === "survey") return "survey_round";
  if (shape === "survey_es") return r.period_type === "decade_average" ? "decade" : r.period_type === "end_june" ? "end_june" : "fiscal_year";
  return "fiscal_year";
}

/* ---------- exceptions.csv ---------- */

const EXC_META = new Set(["id", "type", "value", "source_value", "other_doc_fy", "other_value", "delta", "classification", "evidence", "status", "output_rows"]);
const NOTE_TYPES = new Set(["restated", "memo", "assumption", "small_sample"]);
const KNOWN_TYPES = new Set([...NOTE_TYPES, "misprint", "unpublished"]);

type ExceptionRow = Record<string, string>;

/** The exceptions.csv line for one asterisk of one row: the exact key; else the row is the "other" document of a
 * restatement; else his "#2" item suffix dropped and the value matched. Null if none (the reason then says so). */
function findException(list: ExceptionRow[], type: string, r: Record<string, string>, valueCol: string): ExceptionRow | null {
  const of = list.filter((x) => x.type === type);
  if (!of.length) return null;
  const keys = Object.keys(of[0]).filter((k) => !EXC_META.has(k) && k in r);
  const eq = (x: ExceptionRow, k: string, rv: string) => x[k] === rv;
  const exact = of.find((x) => keys.every((k) => eq(x, k, r[k])));
  if (exact) return exact;
  const other = of.find((x) => keys.every((k) => eq(x, k, r[k]) || (k === "doc_fy" && x.other_doc_fy === r[k])));
  if (other) return other;
  const strip = (v: string) => v.replace(/#\d+$/, "");
  const num = Number(r[valueCol]);
  return (
    of.find(
      (x) =>
        keys.every((k) => k === "doc_fy" || strip(x[k]) === strip(r[k])) &&
        (Number(x.value) === num || (x.other_value !== undefined && x.other_value !== "" && Number(x.other_value) === num)),
    ) ?? null
  );
}

function exceptionText(x: ExceptionRow | null, type: string): string {
  if (!x) return `The source marks this figure "${type}*", but its exceptions file has no line for it.`;
  const ev = (x.evidence ?? "").trim();
  const cl = (x.classification ?? "").replace(/^caveat:\s*/i, "").trim();
  if (type === "assumption" || type === "small_sample") {
    const head = cl ? `${cl.charAt(0).toUpperCase()}${cl.slice(1)}${/[.!?]$/.test(cl) ? "" : "."}` : "";
    return [head, ev].filter(Boolean).join(" ");
  }
  return ev || cl || `The source marks this figure "${type}*".`;
}

/* ---------- status ---------- */

type DatasetCtx = {
  id: string;
  entry: CatalogueEntry;
  shape: Shape;
  candidate: boolean;
  hasPrintedText: boolean;
  printedCol: string | null;
  valueCol: string;
  exceptions: ExceptionRow[];
};

function checkedReason(d: DatasetCtx, r: Record<string, string>): string | null {
  if (d.shape === "survey") {
    const where = (r.published_source ?? "").trim();
    return where
      ? "Recomputed from the PBS microdata; it matches the figure PBS printed in its report (the receipt names the table and page)."
      : "Recomputed from the PBS microdata and checked against the figure PBS printed.";
  }
  const v = (d.entry.verification ?? "").replace(/^verified by us:\s*/i, "").trim();
  return v ? `Checked by the source's ${v}.` : null;
}

export function goldenStatus(d: DatasetCtx, r: Record<string, string>): { reader: ReaderStatus; note: string | null } {
  const tokens = (r.exception ?? "")
    .split(";")
    .map((t) => t.trim().replace(/\*$/, ""))
    .filter(Boolean);
  const text = (type: string) => exceptionText(findException(d.exceptions, type, r, d.valueCol), type);
  const value = decimal(r[d.valueCol]);
  if (tokens.includes("misprint") || r.check_status === "differs") {
    return { reader: readerStatus("held", tokens.includes("misprint") ? text("misprint") : null), note: null };
  }
  if (tokens.includes("unpublished") || r.check_status === "not_published") {
    return {
      reader: readerStatus("not-checked", "Recomputed from the PBS microdata, but PBS did not print this figure, so no published figure checks it."),
      note: null,
    };
  }
  const unknownTok = tokens.find((t) => !KNOWN_TYPES.has(t));
  if (unknownTok) return { reader: readerStatus("unknown", `The source marks this figure "${unknownTok}*", which this site does not describe yet. No value is shown.`), note: null };
  if (d.shape === "survey" && r.check_status && r.check_status !== "matched") {
    return { reader: readerStatus("unknown", `The source's check result "${r.check_status}" is not one this site describes yet. No value is shown.`), note: null };
  }
  if (value === null) return { reader: readerStatus("unknown", "The release holds no readable figure here. No value is shown."), note: null };
  if (d.shape === "budget" && !d.hasPrintedText && Number(value) === 0) return { reader: readerStatus("dash-or-zero"), note: null };
  if (d.printedCol && isDash(r[d.printedCol])) return { reader: readerStatus("not-printed"), note: null };
  const notes = tokens.filter((t) => NOTE_TYPES.has(t)).map(text);
  const note = notes.length ? notes.join(" ") : null;
  if (d.candidate) return { reader: readerStatus("candidate", `A person has not yet approved this dataset.${note ? ` The source's note: ${note}` : ""}`), note };
  if (note) return { reader: readerStatus("checked-note", note), note };
  return { reader: readerStatus("checked", checkedReason(d, r)), note: null };
}

/* ---------- the loader ---------- */

function readJsonFile<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

/** Throws, naming the file, when any golden file differs from its recorded fingerprint. */
export function verifyGolden(dir: string, cat: CatalogueEntry[], rel: ReleaseJson): void {
  for (const e of cat) {
    if (e.layer !== "golden" || !(e.dataset_id in rel.datasets)) continue;
    const fps = e.fingerprints;
    if (!fps || !Object.keys(fps).length) throw new Error(`golden dataset ${e.dataset_id} has no file fingerprints in catalogue.json`);
    if (!e.path) throw new Error(`golden dataset ${e.dataset_id} has no path in catalogue.json`);
    const gdir = path.join(dir, path.dirname(e.path));
    const actual: Record<string, string> = {};
    for (const name of Object.keys(fps).sort()) {
      const p = path.join(gdir, name);
      const rel_ = `${path.dirname(e.path)}/${name}`;
      if (!fs.existsSync(p)) throw new Error(`golden file ${rel_} is missing (catalogue.json lists it)`);
      actual[name] = fileHash(p);
      if (actual[name] !== fps[name]) throw new Error(`golden file ${rel_} differs from its catalogue.json fingerprint`);
    }
    if (combinedHash(actual) !== rel.datasets[e.dataset_id].fingerprint) {
      throw new Error(`golden dataset ${e.dataset_id} (files ${Object.keys(fps).sort().join(", ")}) differs from its RELEASE.json fingerprint`);
    }
  }
  for (const id of Object.keys(rel.datasets)) {
    if (!cat.some((e) => e.layer === "golden" && e.dataset_id === id)) throw new Error(`RELEASE.json lists ${id}, which catalogue.json does not hold`);
  }
}

function sourceIdOf(sha: string, file: string): string {
  return sha ? `golden.src.${sha.slice(0, 16)}` : `golden.doc.${slugify(file).slice(0, 80)}`;
}

/** "raw/pbs/pslm/2004-05/x.pdf p40, Table 2.12 (b) ..." -> file, page, table text. */
function publishedSourceParts(s: string): { file: string; page: number | null; table: string } {
  const m = /^(.*?\.pdf)\s*(.*)$/i.exec(s.trim());
  const file = m ? m[1] : s.trim();
  const rest = m ? m[2] : "";
  const pm = /\bp\.?\s?(\d+)\b/i.exec(rest);
  const table = rest.replace(/^,?\s*(PDF\s+)?p\.?\s?\d+\s*,?\s*/i, "").trim();
  return { file, page: pm ? Number(pm[1]) : null, table: table || rest.trim() };
}

export function loadGolden(dir: string, opts: GoldenOptions): GoldenDb {
  const relFile = path.join(dir, "RELEASE.json");
  const catFile = path.join(dir, "catalogue.json");
  if (!fs.existsSync(relFile) || !fs.existsSync(catFile)) throw new Error(`Golden release folder not found or incomplete (needs RELEASE.json and catalogue.json): ${dir}`);
  const rel = readJsonFile<ReleaseJson>(relFile);
  if (!opts?.tag) throw new Error("loadGolden needs the pinned tag (opts.tag)");
  if (rel.release !== opts.tag) throw new Error(`golden RELEASE.json names release ${rel.release}, but the build is pinned to ${opts.tag}`);
  const cat = readJsonFile<CatalogueEntry[]>(catFile);
  verifyGolden(dir, cat, rel);

  const notInRelease = cat.filter((e) => e.layer === "golden" && !(e.dataset_id in rel.datasets)).map((e) => e.dataset_id);
  const entries = cat.filter((e) => e.layer === "golden" && e.dataset_id in rel.datasets);
  const relId = rel.release;

  const sources = new Map<string, Source>();
  const series = new Map<string, Series>();
  const seriesLatestDoc = new Map<string, string>();
  const observations: Observation[] = [];
  const cells: Cell[] = [];
  const evidence = new Map<string, GoldenEvidence[]>();
  const printing = new Map<string, { dataset: string; doc: string | null; sourceId: string | null }>();
  const rowObs = new Map<string, string>();
  const keyObs = new Map<string, string>();
  const batchGaps: BatchGap[] = [];
  const derivedRows: { d: DatasetCtx; rows: Record<string, string>[] }[] = [];
  let sortKey = 0;

  const addSource = (id: string, s: Omit<Source, "source_id">) => {
    if (!sources.has(id)) sources.set(id, { source_id: id, ...s });
    return id;
  };

  for (const e of entries) {
    const gdir = path.join(dir, path.dirname(e.path!));
    const rows = parseCsv(fs.readFileSync(path.join(dir, e.path!), "utf8"));
    if (rows.length !== rel.datasets[e.dataset_id].rows) {
      throw new Error(`golden file ${e.path} has ${rows.length} rows; RELEASE.json records ${rel.datasets[e.dataset_id].rows}`);
    }
    const excFile = path.join(gdir, "exceptions.csv");
    const exceptions = fs.existsSync(excFile) ? parseCsv(fs.readFileSync(excFile, "utf8")) : [];
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const shape = rows.length ? shapeOf(e.dataset_id, cols) : "budget";
    const printedCol = cols.includes("printed_value") ? "printed_value" : cols.includes("value_printed") ? "value_printed" : null;
    const d: DatasetCtx = {
      id: e.dataset_id,
      entry: e,
      shape,
      candidate: e.status !== "golden",
      hasPrintedText: !!printedCol,
      printedCol,
      valueCol: cols.includes("value_rs_million") ? "value_rs_million" : "value",
      exceptions,
    };
    for (const h of e.held_batches ?? []) {
      batchGaps.push({ dataset: e.dataset_id, batch: h.batch, status: "held", reason: `The source holds this whole ${e.batch_column === "round" ? "survey round" : "batch"} back: ${h.reason}.` });
    }
    if (shape === "derived") {
      derivedRows.push({ d, rows });
      continue;
    }

    rows.forEach((r, i) => {
      const sid = seriesIdOf(d.id, shape, r);
      const kind = kindOf(shape, r);
      const vintage = shape === "budget" ? kind : "na";
      const period = shape === "survey" ? r.round : shape === "survey_es" ? r.ref_period : r.ref_fy;
      const doc = shape === "survey" ? null : r.doc_fy;
      const extra = (EXTRA_GRAIN[d.id] ?? []).map((c) => r[c]).filter(Boolean);
      const obsId = [sid, period, vintage, ...(doc ? [doc] : []), ...extra].join(":");
      if (printing.has(obsId)) throw new Error(`golden dataset ${d.id}: two rows give the same observation id ${obsId} (row ${i + 2} of ${e.path})`);
      const { unit, scale } = unitOf(shape, r.unit);
      const { reader, note } = goldenStatus(d, r);
      const shown = reader.showsValue;
      const value = shown ? decimal(r[d.valueCol]) : null;
      const printedRaw = printedCol ? r[printedCol] : null;
      const printedText = shown ? printedRaw || null : reader.key === "not-printed" ? printedRaw || null : null;

      // series
      if (!series.has(sid)) {
        const group = shape === "survey" ? SURVEY_GROUP : (GROUP[d.id] ?? ["table"]);
        const dims: Record<string, string> = {};
        for (const c of group) if (r[c]) dims[c] = r[c];
        series.set(sid, {
          series_id: sid,
          name: "",
          parent_id: null,
          dataset: d.id,
          dims,
          frequency: frequencyOf(shape, r),
          unit,
          scale_factor: scale,
          definition_status: "not in this release",
          synonyms: [],
          breaks: [],
          derived: false,
          derivation: null,
          sort_key: sortKey++,
          notes: null,
          geo: geoOf(d.id, r),
          source_doc_types: [d.id],
          // Set from the editorial file once the printed name is known (below).
          title: "",
          summary: null,
          titleStatus: "printed",
        });
      }
      const s = series.get(sid)!;
      const label =
        shape === "survey"
          ? `${r.indicator} (${[r.geography, r.area, r.sex].filter((x) => x && x !== "all").join(", ") || "all"})`
          : r.printed_name || r.printed_label || r.grant_name || itemKey(d.id, shape, r);
      const docKey = doc ?? period;
      if (!seriesLatestDoc.has(sid) || docKey >= seriesLatestDoc.get(sid)!) {
        seriesLatestDoc.set(sid, docKey);
        s.name = label; // the name as printed in the latest document that prints the series
      }

      // source and evidence
      let sourceId: string | null = null;
      const ev: GoldenEvidence[] = [];
      let cellId: string | null = null;
      if (shape === "survey") {
        sourceId = addSource(sourceIdOf(r.source_sha256, r.source_file), {
          doc_type: "pbs_microdata",
          publisher: e.publisher ?? "Pakistan Bureau of Statistics",
          jurisdiction: e.level ?? "national",
          title: `PBS microdata, ${d.id.split("_")[0].toUpperCase()} ${r.round}`,
          period: r.round,
          role: "core",
          landing_url: null,
          file_url: r.source_url || null,
          wayback_url: null,
          wayback_timestamp: null,
          retrieved_at: null,
          retrieved_via: null,
          sha256: r.source_sha256 ?? "",
          size_bytes: null,
          page_count: null,
          verification_status: "fingerprint recorded in the golden release",
          notes: e.reliability?.class ?? null,
        });
        const ps = r.published_source ? publishedSourceParts(r.published_source) : null;
        const reportId = ps
          ? addSource(sourceIdOf("", ps.file), {
              doc_type: "pbs_report",
              publisher: "Pakistan Bureau of Statistics",
              jurisdiction: e.level ?? "national",
              title: path.basename(ps.file),
              period: r.round,
              role: "check",
              landing_url: null,
              file_url: null,
              wayback_url: null,
              wayback_timestamp: null,
              retrieved_at: null,
              retrieved_via: null,
              sha256: "",
              size_bytes: null,
              page_count: null,
              verification_status: "not fingerprinted in this release",
              notes: "Named by the golden release as the printed table this figure was checked against; its file and fingerprint are not in the release.",
            })
          : sourceId;
        ev.push({
          kind: "recomputed",
          // Our value only where it may be shown (rule 2): a figure no check covers shows no number, even here.
          ourValue: shown ? (value ?? "") : "",
          publishedValue: shown ? decimal(r.published_value) : null,
          sourceId: reportId,
          table: ps?.table ?? "",
          page: ps?.page ?? null,
          method: r.method ?? "",
        });
      } else {
        sourceId = addSource(sourceIdOf(r.source_sha256, r.source_file), {
          doc_type: d.id,
          publisher: e.publisher ?? "",
          jurisdiction: e.level ?? "",
          title: `${DOC_TITLE[d.id] ?? e.name} ${r.doc_fy}`,
          period: r.doc_fy,
          role: "core",
          landing_url: null,
          file_url: r.source_url || null,
          wayback_url: null,
          wayback_timestamp: null,
          retrieved_at: null,
          retrieved_via: null,
          sha256: r.source_sha256 ?? "",
          size_bytes: null,
          page_count: null,
          verification_status: "fingerprint recorded in the golden release",
          notes: e.reliability?.class ?? null,
        });
        const page = Number(r.page);
        const pts = ["bbox_x0", "bbox_top", "bbox_x1", "bbox_bottom"].map((c) => Number(r[c]));
        const hasBox = cols.includes("bbox_x0") && r.bbox_x0 !== "" && pts.every((x) => Number.isFinite(x));
        const size = opts.pageSize && r.source_sha256 && Number.isFinite(page) ? opts.pageSize(r.source_sha256, page) : null;
        let box: [number, number, number, number] | null = null;
        let boxState: "exact" | "tentative" | "none" | "no-image" = "no-image";
        let boxNote: string;
        if (hasBox && size && size.width > 0 && size.height > 0) {
          const f = (x: number, dim: number) => Math.round((x / dim) * 100000) / 100000;
          box = [f(pts[0], size.width), f(pts[1], size.height), f(pts[2], size.width), f(pts[3], size.height)];
          boxState = "tentative";
          boxNote = "Box converted from PDF points with the page size given to the adapter; not confirmed against a page proof, so it is shown as tentative.";
        } else if (hasBox) {
          boxNote = "The release gives this box in PDF points but neither the page size nor a page image, so it cannot be drawn yet.";
        } else {
          boxState = size ? "none" : "no-image";
          boxNote = "The release gives the page but no box for this figure.";
        }
        cellId = `${obsId}~cell`;
        cells.push({
          cell_id: cellId,
          source_id: sourceId,
          page: Number.isFinite(page) ? page : 0,
          page_label: null,
          table_index: 0,
          table_bbox_norm: null,
          cell_bbox_norm: box,
          row_index: 0,
          col_index: 0,
          row_label_raw: label,
          col_label_raw: shape === "budget" ? `${r.estimate_type} ${r.ref_fy}` : r.ref_period,
          value_raw: printedText,
          value_parsed: value,
          normalization_flags: [],
          structural_flags: r.flag ? [r.flag] : [],
          series_id: sid,
          period,
          vintage,
          unit,
          scale_factor: scale,
          extractor_name: r.parser ?? "",
          extractor_version: "",
          run_id: relId,
          extract_config_sha256: "",
        });
        ev.push({
          kind: "printed-cell",
          sourceId,
          page: Number.isFinite(page) ? page : 0,
          pageLabel: null,
          box,
          boxState,
          printedText,
          cellId,
          boxPoints: hasBox && !box ? (pts as [number, number, number, number]) : null,
          boxNote,
        });
      }

      const o: Observation = {
        obs_id: obsId,
        series_id: sid,
        period,
        vintage,
        value,
        unit,
        scale_factor: scale,
        primary_cell_id: cellId,
        supporting_cell_ids: [],
        check_ids: [],
        tier: null,
        status: [d.candidate ? "candidate" : "golden", r.exception].filter(Boolean).join(" "),
        published: shown && value !== null,
        gap_kind: shown ? null : reader.key,
        gap_reason: shown ? null : reader.reason,
        evidence_summary: reader.reason,
        notes: note,
        derived_from: [],
        first_published_release: relId,
        last_changed_release: relId,
        kind,
        reader,
        printed_text: printedText,
        signoff: d.candidate ? "candidate" : "signed",
      };
      observations.push(o);
      evidence.set(obsId, ev);
      printing.set(obsId, { dataset: d.id, doc, sourceId });
      rowObs.set(`${d.id}#${i}`, obsId);
      if (d.id === "abs_federal_functional") keyObs.set(`${d.id}|${r.doc_fy}|${r.ref_fy}|${r.estimate_type}|${r.table}|${r.code}|${r.row_instance}`, obsId);
    });
  }

  // budget_credibility: derived from abs_federal_functional rows (not in golden-2026.11.11).
  const obsById = new Map(observations.map((o) => [o.obs_id, o]));
  for (const { d, rows } of derivedRows) {
    rows.forEach((r, i) => {
      const m = mapBudgetCredibilityRow(r, d.candidate, keyObs, obsById, relId);
      if (!m) return;
      if (!series.has(m.series.series_id)) series.set(m.series.series_id, { ...m.series, sort_key: sortKey++ });
      observations.push(m.obs);
      obsById.set(m.obs.obs_id, m.obs);
      evidence.set(m.obs.obs_id, [m.evidence]);
      printing.set(m.obs.obs_id, { dataset: d.id, doc: null, sourceId: null });
      rowObs.set(`${d.id}#${i}`, m.obs.obs_id);
    });
  }

  // documented breaks (his query/series_breaks.csv): never joined across.
  const breaksFile = opts.breaksCsv === undefined ? path.join(dir, "..", "query", "series_breaks.csv") : opts.breaksCsv;
  if (breaksFile && fs.existsSync(breaksFile)) {
    for (const b of parseCsv(fs.readFileSync(breaksFile, "utf8"))) {
      if (!b.dataset_id) continue;
      const re = new RegExp(b.item_pattern);
      for (const s of series.values()) {
        const item = s.series_id.split(".").pop() ?? "";
        if (s.dataset !== b.dataset_id || !re.test(item)) continue;
        const brk: SeriesBreak = {
          at_period: b.new_from,
          kind: "edition",
          note: `${b.short_reason} The break falls between the ${b.old_until} and ${b.new_from} editions; figures are never joined across it.`,
        };
        s.breaks.push(brk);
      }
    }
  }

  const signoffFile = opts.signoffsCsv === undefined ? path.join(dir, "..", "registry", "signoffs.csv") : opts.signoffsCsv;
  const signoffs = signoffFile && fs.existsSync(signoffFile) ? (parseCsv(fs.readFileSync(signoffFile, "utf8")) as SignoffRow[]) : [];

  const seriesList = [...series.values()];
  // Plain titles: an entry of the editorial file, or the printed name (the latest printing's), said so.
  const titles = readTitles(opts.titlesFile ?? null);
  for (const s of seriesList) Object.assign(s, titleFields(s.series_id, s.name, titles));
  const seriesBySlug = new Map<string, Series>();
  for (const s of seriesList) {
    const slug = slugify(s.series_id);
    if (seriesBySlug.has(slug)) throw new Error(`golden series ids ${seriesBySlug.get(slug)!.series_id} and ${s.series_id} give the same URL slug`);
    seriesBySlug.set(slug, s);
  }
  const sourceList = [...sources.values()].sort((a, b) => a.doc_type.localeCompare(b.doc_type) || a.period.localeCompare(b.period) || a.source_id.localeCompare(b.source_id));

  const obsBySeries = new Map<string, Observation[]>();
  for (const o of observations) {
    const list = obsBySeries.get(o.series_id) ?? [];
    list.push(o);
    obsBySeries.set(o.series_id, list);
  }
  for (const list of obsBySeries.values()) list.sort((a, b) => a.period.localeCompare(b.period) || a.vintage.localeCompare(b.vintage) || a.obs_id.localeCompare(b.obs_id));
  const childrenOf = new Map<string, Series[]>([["", seriesList]]);
  const cellsBySource = new Map<string, Cell[]>();
  for (const c of cells) {
    const list = cellsBySource.get(c.source_id) ?? [];
    list.push(c);
    cellsBySource.set(c.source_id, list);
  }
  const datasetStatus: Release["dataset_status"] = {};
  for (const e of entries) {
    datasetStatus[e.dataset_id] = { dataset: e.dataset_id, name: e.name, state: e.status === "golden" ? "published" : "candidate", reasons: e.caveat_notes ?? [] };
  }
  const release: Release = {
    version: relId,
    created_at: rel.created_utc,
    git_commit: opts.commit ?? "",
    label: relId,
    doi: null,
    scope: { datasets: entries.map((e) => e.dataset_id), sources: sourceList.map((s) => s.source_id) },
    dataset_status: datasetStatus,
    measured_error_rate: null,
    notes: `Golden data release ${relId}, read through the golden adapter. Figures from candidate datasets are marked "not signed off".`,
  };
  const info: ReleaseInfo = {
    id: relId,
    builtFrom: "Golden data release",
    frozenAt: rel.created_utc,
    licence: "not stated in this release",
    isLatest: opts.isLatest ?? false,
    isPrototype: false,
  };
  return {
    release,
    info,
    batchGaps,
    series: seriesList,
    observations,
    cells,
    checks: [],
    sources: sourceList,
    coverage: [],
    seriesById: series,
    obsById,
    cellById: new Map(cells.map((c) => [c.cell_id, c])),
    checkById: new Map(),
    sourceById: new Map(sourceList.map((s) => [s.source_id, s])),
    obsBySeries,
    childrenOf,
    obsBySlug: new Map(observations.map((o) => [slugify(o.obs_id), o])),
    seriesBySlug,
    sourceBySlug: new Map(sourceList.map((s) => [slugify(s.source_id), s])),
    cellsBySource,
    evidence,
    printing,
    rowObs,
    keyObs,
    notInRelease,
    heldSources: cat.filter((e) => e.layer !== "golden").map((e) => ({ id: e.dataset_id, name: e.name, status: e.status })),
    signoffs,
  };
}

/* ---------- his series rule (query/series.py choose) ---------- */

const RANK: Partial<Record<KindKey, number>> = { actual: 0, ac: 0, re: 1, be: 2 };

/**
 * One figure per period, chosen as his query tool chooses it, so the portal and his tool never give different
 * "latest" figures (DESIGN.md 5.3, 8.2): accounts or actual beat revised, which beats budget estimate; within one
 * kind, the latest document. Figures with no budget stage rank alike, so the latest edition wins. The other
 * printings are returned too. Ties resolve by obs_id, so the result never depends on load order.
 */
export function chooseByPeriod(g: GoldenDb, seriesId: string): { period: string; chosen: Observation; others: Observation[] }[] {
  const byPeriod = new Map<string, Observation[]>();
  for (const o of g.obsBySeries.get(seriesId) ?? []) {
    const list = byPeriod.get(o.period) ?? [];
    list.push(o);
    byPeriod.set(o.period, list);
  }
  const doc = (o: Observation) => g.printing.get(o.obs_id)?.doc ?? "";
  const rank = (o: Observation) => RANK[o.kind] ?? (o.vintage !== "na" ? 3 : 0); // an unknown budget stage ranks last, as in his _rank
  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, list]) => {
      const best = Math.min(...list.map(rank));
      const top = list.filter((o) => rank(o) === best).sort((a, b) => doc(b).localeCompare(doc(a)) || a.obs_id.localeCompare(b.obs_id));
      const chosen = top[0];
      return { period, chosen, others: list.filter((o) => o !== chosen) };
    });
}

/* ---------- budget_credibility (derived) ---------- */

/**
 * One budget_credibility row -> one derived observation: the deviation (revised minus budget, Rs million) of one
 * functional line in one year. The two printed figures are found by his source keys in the functional table of the
 * same release. Gaps travel (DESIGN.md 6.1): if either input is not usable in a derived value, the deviation shows
 * no number and takes that input's status and reason. Otherwise it takes the dataset's status (a candidate today).
 * Returns null when an input is not in the release (the row cannot be traced, so it is not shown at all).
 */
export function mapBudgetCredibilityRow(
  r: Record<string, string>,
  candidate: boolean,
  keyObs: Map<string, string>,
  obsById: Map<string, Observation>,
  relId: string,
): { series: Series; obs: Observation; evidence: GoldenEvidence } | null {
  const key = (k: string) => (k ? keyObs.get(`abs_federal_functional|${k}`) : undefined);
  const be = key(r.budget_source_key);
  const re = key(r.revised_source_key);
  if (!be || !re) return null;
  const inputs = [obsById.get(be)!, obsById.get(re)!];
  const sid = ["golden", "budget_credibility", r.table || "_", r.row_instance || "_", r.code].join(".");
  const obsId = `${sid}:${r.ref_fy}:na`;
  // Rule 3 of the brief: only figures usable in derived values may feed one. A shown but unusable input (a
  // candidate) holds the deviation back; an input with no value passes on its own status.
  const blocked = inputs.find((o) => !o.reader.usableInDerived);
  let reader: ReaderStatus;
  if (blocked) {
    const k: ReaderStatusKey = blocked.reader.showsValue ? "held" : blocked.reader.key;
    reader = readerStatus(k, `It is computed from a figure that cannot be used in a derived value: ${blocked.reader.reason}`);
  } else if (candidate) {
    reader = readerStatus("candidate", "A person has not yet approved this derived dataset.");
  } else {
    reader = readerStatus("checked", "Computed from two printed figures that are themselves checked.");
  }
  const value = reader.showsValue ? decimal(r.deviation) : null;
  return {
    series: {
      series_id: sid,
      name: `${r.printed_name} (revised minus budget estimate)`,
      parent_id: null,
      dataset: "budget_credibility",
      dims: { table: r.table, row_instance: r.row_instance },
      frequency: "fiscal_year",
      unit: "PKR",
      scale_factor: 1_000_000,
      definition_status: "not in this release",
      synonyms: [],
      breaks: [],
      derived: true,
      derivation: { formula: "revised estimate minus budget estimate", inputs: [] },
      sort_key: 0,
      notes: null,
      geo: "pk",
      source_doc_types: ["abs_federal_functional"],
      // No editorial title for a derived golden row: the printed name, said so.
      title: `${r.printed_name} (revised minus budget estimate)`,
      summary: null,
      titleStatus: "printed",
    },
    obs: {
      obs_id: obsId,
      series_id: sid,
      period: r.ref_fy,
      vintage: "na",
      value,
      unit: "PKR",
      scale_factor: 1_000_000,
      primary_cell_id: null,
      supporting_cell_ids: [],
      check_ids: [],
      tier: null,
      status: candidate ? "candidate" : "golden",
      published: value !== null,
      gap_kind: value === null ? reader.key : null,
      gap_reason: value === null ? reader.reason : null,
      evidence_summary: reader.reason,
      notes: null,
      derived_from: [be, re],
      first_published_release: relId,
      last_changed_release: relId,
      kind: "as_printed",
      reader,
      printed_text: null,
      signoff: candidate ? "candidate" : "signed",
    },
    evidence: { kind: "derived", formula: "revised estimate (next year's ABS) minus budget estimate (the year's own ABS)", inputs: [be, re] },
  };
}
