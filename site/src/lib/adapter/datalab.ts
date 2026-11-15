// The datalab adapter: reads our own frozen release (releases/<version>/) and
// produces the contract of DESIGN.md 5.1. It is the only code that knows our
// pipeline's vocabulary (status, gap_kind, tier, vintage "na"); pages see the
// reader statuses and kinds of figure it decides here.
//
// Mapping (DESIGN.md 5.2, written down and tested in scripts/contract-test.mjs):
//   checked + published          -> "checked" (or "checked-note" if the figure has a note)
//   checked + dataset "candidate"-> "candidate" (our pipeline does not use this state today)
//   disputed                     -> "disputed"
//   gap not_in_source            -> "not-printed"  (a printed dash or blank, never 0)
//   gap not_yet_verified         -> "not-checked"
//   gap failed_checks            -> "held"
//   anything else                -> "unknown" (no value, raw label kept)
// A value is kept only where the reader status shows one; everything else is
// emptied here, so no page can show it by mistake.
import fs from "node:fs";
import path from "node:path";
import type { Cell, Check, CoverageRow, Db, Observation, Release, Series, Source } from "../data";
import { slugify } from "../ids.ts";
import { readerStatus } from "../words.ts";
import type { KindKey, ReaderStatus, ReaderStatusKey, ReleaseInfo, SignOff } from "./contract";
import { defaultTitlesFile, readTitles, titleFields } from "./titles.ts";

type RawObservation = Omit<Observation, "kind" | "reader" | "printed_text" | "signoff">;

function readJson<T>(dir: string, name: string, fallback: T): T {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

/** Kind of figure from our vintage code and the series. */
export function kindOf(vintage: string, s: Pick<Series, "dataset" | "unit" | "frequency" | "dims"> | undefined): KindKey {
  if (vintage === "be" || vintage === "re" || vintage === "actual" || vintage === "provisional" || vintage === "final") return vintage;
  if (vintage === "ac") return "ac";
  if (!s) return "as_printed";
  if (s.frequency === "survey_round") return "survey_round";
  if (s.dataset === "cpi") {
    const m = s.dims?.measure;
    if (m === "yoy") return "change_yoy";
    if (m === "mom") return "change_mom";
    if (m === "weight") return "weight";
    if (s.unit === "index") return "index";
  }
  return "as_printed";
}

/** "a sum and a second printing in another edition": from the checks that passed, so it never claims evidence the figure lacks. */
export function evidenceWords(checks: Check[]): string | null {
  const kinds: string[] = [];
  const add = (k: string) => {
    if (!kinds.includes(k)) kinds.push(k);
  };
  for (const c of checks) {
    if (c.official === false || c.credits_members === false || (c.result !== "pass" && c.result !== "pass_within_rounding")) continue;
    if (["column_total", "row_total", "hierarchy_sum", "accounting_identity"].includes(c.check_type)) add("a sum");
    else if (c.check_type === "cross_edition") add("a second printing in another edition");
    else if (c.check_type === "cross_table") add("a second printing in another table");
    else if (c.check_type === "cross_source") add("another official source");
    else if (c.check_type === "index_aggregation") add("recomputing the weighted average");
    else if (c.check_type === "recompute") add("a recomputed rate");
    else if (c.check_type === "weights_sum") add("weights that add up");
    else if (c.check_type === "reference_value") continue; // earns no status by itself
    else add(c.check_type.replaceAll("_", " "));
  }
  if (kinds.length === 0) return null;
  kinds.sort((a, b) => (a === "a sum" ? -1 : b === "a sum" ? 1 : 0));
  return kinds.length === 1 ? kinds[0] : `${kinds.slice(0, -1).join(", ")} and ${kinds[kinds.length - 1]}`;
}

/** The reader status of one figure. The only place our pipeline's statuses are interpreted. */
export function statusFor(o: RawObservation, datasetState: string | undefined, checks: Check[]): ReaderStatus {
  const valued = o.published && o.value !== null && o.value !== undefined;
  if (o.status === "disputed") return readerStatus("disputed");
  if (o.status === "checked" && valued) {
    const ev = evidenceWords(checks);
    const why = ev ? `Checked by ${ev}.` : null;
    if (datasetState === "candidate") return readerStatus("candidate", why ? `A person has not yet approved this dataset. ${why}` : null);
    if (o.notes && o.notes.trim()) return readerStatus("checked-note", why ? `${why} The document attaches a note to this figure.` : null);
    return readerStatus("checked", why);
  }
  const map: Record<string, ReaderStatusKey> = { not_in_source: "not-printed", not_yet_verified: "not-checked", failed_checks: "held" };
  const key = (o.gap_kind && map[o.gap_kind]) || "unknown";
  return readerStatus(key);
}

function signoffOf(state: string | undefined): SignOff {
  if (state === "candidate") return "candidate";
  if (state === "published") return "not-applicable";
  return "not-applicable";
}

export type DatalabOptions = {
  /** site/editorial/titles.json; default: the one next to the release folder (releases/<v> -> site/editorial). null: none. */
  titlesFile?: string | null;
};

type RawSeries = Omit<Series, "title" | "summary" | "titleStatus">;

export function loadDatalab(dir: string, opts: DatalabOptions = {}): Db {
  if (!fs.existsSync(path.join(dir, "release.json"))) {
    throw new Error(`Release folder not found or incomplete: ${dir}`);
  }
  const release = readJson<Release>(dir, "release.json", {} as Release);
  // Plain titles are editorial (DESIGN.md 6.4): added here, never written into the release. A series without
  // an entry keeps its printed name as its title (titleStatus "printed"); the printed name stays as `name`.
  const titles = readTitles(opts.titlesFile === undefined ? defaultTitlesFile(dir) : opts.titlesFile);
  const series: Series[] = readJson<RawSeries[]>(dir, "series.json", []).map((s) => ({ ...s, breaks: s.breaks ?? [], ...titleFields(s.series_id, s.name, titles) }));
  const cells = readJson<Cell[]>(dir, "cells.json", []);
  const checks = readJson<Check[]>(dir, "checks.json", []);
  const sources = readJson<Source[]>(dir, "sources.json", []);
  const coverage = readJson<CoverageRow[]>(dir, "coverage.json", []);
  const seriesById = new Map(series.map((s) => [s.series_id, s]));
  const cellById = new Map(cells.map((c) => [c.cell_id, c]));
  const checkById = new Map(checks.map((c) => [c.check_id, c]));

  const observations: Observation[] = readJson<RawObservation[]>(dir, "observations.json", []).map((raw) => {
    const o: RawObservation = { ...raw, supporting_cell_ids: raw.supporting_cell_ids ?? [], check_ids: raw.check_ids ?? [], derived_from: raw.derived_from ?? [] };
    const s = seriesById.get(o.series_id);
    const state = s ? release.dataset_status?.[s.dataset]?.state : undefined;
    const reader = statusFor(o, state, o.check_ids.map((id) => checkById.get(id)).filter((c): c is Check => !!c));
    const cell = o.primary_cell_id ? cellById.get(o.primary_cell_id) : undefined;
    return {
      ...o,
      // A value travels only where the reader status shows one.
      value: reader.showsValue && o.published ? o.value : null,
      published: reader.showsValue && o.published && o.value !== null,
      kind: kindOf(o.vintage, s),
      reader,
      printed_text: cell?.value_raw ?? null,
      signoff: signoffOf(state),
    };
  });

  series.sort((a, b) => a.sort_key - b.sort_key || a.series_id.localeCompare(b.series_id));
  sources.sort((a, b) => a.doc_type.localeCompare(b.doc_type) || a.period.localeCompare(b.period));

  const obsBySeries = new Map<string, Observation[]>();
  for (const o of observations) {
    const list = obsBySeries.get(o.series_id) ?? [];
    list.push(o);
    obsBySeries.set(o.series_id, list);
  }
  for (const list of obsBySeries.values()) {
    list.sort((a, b) => a.period.localeCompare(b.period) || a.vintage.localeCompare(b.vintage));
  }
  const childrenOf = new Map<string, Series[]>();
  const ids = new Set(series.map((s) => s.series_id));
  for (const s of series) {
    const key = s.parent_id && ids.has(s.parent_id) ? s.parent_id : "";
    const list = childrenOf.get(key) ?? [];
    list.push(s);
    childrenOf.set(key, list);
  }
  const cellsBySource = new Map<string, Cell[]>();
  for (const c of cells) {
    const list = cellsBySource.get(c.source_id) ?? [];
    list.push(c);
    cellsBySource.set(c.source_id, list);
  }
  const info: ReleaseInfo = {
    id: release.version,
    builtFrom: "LUMS DataLab pipeline",
    frozenAt: release.created_at,
    licence: "CC BY 4.0",
    isLatest: true,
    isPrototype: /prototype/i.test(release.version) || /prototype/i.test(release.label ?? ""),
  };
  return {
    release,
    info,
    // Our release has a row for every figure, held ones included; it never drops a whole batch.
    batchGaps: [],
    series,
    observations,
    cells,
    checks,
    sources,
    coverage,
    seriesById,
    obsById: new Map(observations.map((o) => [o.obs_id, o])),
    cellById,
    checkById,
    sourceById: new Map(sources.map((s) => [s.source_id, s])),
    obsBySeries,
    childrenOf,
    obsBySlug: new Map(observations.map((o) => [slugify(o.obs_id), o])),
    seriesBySlug: new Map(series.map((s) => [slugify(s.series_id), s])),
    sourceBySlug: new Map(sources.map((s) => [slugify(s.source_id), s])),
    cellsBySource,
  };
}
