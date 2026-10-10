// Build-time data access. Everything on the site comes from the frozen release
// folder ../releases/<version>/ (relative to site/). Nothing is fetched in the
// browser. The version lives in one place: site/release.config.json.
import fs from "node:fs";
import path from "node:path";
import config from "../../release.config.json";

export const RELEASE_VERSION: string = config.version;
export const REPO_URL: string = config.repoUrl;
export const SITE_URL: string = config.siteUrl;
export const ISSUES_URL = `${REPO_URL}/issues`;
export const DATA_BASE = `/data/${RELEASE_VERSION}`;

const RELEASE_DIR = path.resolve(process.cwd(), "..", "releases", RELEASE_VERSION);
const DOCS_DIR = path.resolve(process.cwd(), "..", "docs");

/* ---------- types (only the fields the site reads) ---------- */

export type PassRate = {
  pass: number;
  pass_within_rounding: number;
  fail: number;
  not_evaluable: number;
  evaluable?: number;
  pass_rate: number | null;
};

export type CoverageSummary = {
  printed_numeric_tokens: number;
  matched: number;
  coverage: number | null;
  tables?: number;
};

export type DatasetStatus = {
  dataset?: string;
  name: string;
  state: string;
  reasons?: string[];
  coverage?: CoverageSummary | null;
  check_pass_rate?: PassRate | null;
  cross_edition_agreement?: PassRate | null;
};

export type Release = {
  version: string;
  created_at: string;
  git_commit: string;
  label: string;
  doi: string | null;
  scope?: { datasets?: string[]; sources?: string[]; periods?: Record<string, string[]> };
  thresholds_sha256?: string;
  tool_versions?: Record<string, string>;
  counts?: {
    sources?: number;
    cells?: number;
    series?: number;
    observations?: number;
    observations_by_dataset?: Record<string, Record<string, number>>;
    checks_by_result?: Record<string, number>;
    page_renders?: number;
  };
  dataset_status: Record<string, DatasetStatus>;
  gold_set?: { status?: string };
  measured_error_rate: string | number | null;
  notes?: string;
};

export type SeriesBreak = { at_period: string; kind: string; note: string };

export type Series = {
  series_id: string;
  name: string;
  parent_id: string | null;
  dataset: string;
  dims?: Record<string, string>;
  frequency: string;
  unit: string;
  scale_factor: number;
  definition?: string;
  definition_status?: string;
  synonyms?: string[];
  breaks: SeriesBreak[];
  derived: boolean;
  derivation: { formula: string; inputs: string[] } | null;
  sort_key: number;
};

export type Observation = {
  obs_id: string;
  series_id: string;
  period: string;
  vintage: string;
  value: string | null;
  unit: string;
  scale_factor: number;
  primary_cell_id: string | null;
  supporting_cell_ids: string[];
  check_ids: string[];
  tier: string | null;
  status: string;
  published: boolean;
  gap_kind: string | null;
  gap_reason: string | null;
  evidence_summary: string | null;
  notes?: string | null;
  derived_from: string[];
};

export type Cell = {
  cell_id: string;
  source_id: string;
  page: number;
  table_index: number;
  table_bbox_norm: number[] | null;
  cell_bbox_norm: number[] | null;
  row_index: number;
  col_index: number;
  row_label_raw: string | null;
  col_label_raw: string | null;
  value_raw: string | null;
  value_parsed: string | null;
  normalization_flags: string[];
  structural_flags: string[];
  series_id: string | null;
  period: string | null;
  vintage: string | null;
  unit: string | null;
  scale_factor: number | null;
  extractor_name: string;
  extractor_version: string;
  run_id: string;
  extract_config_sha256: string;
  page_render_sha256?: string;
};

export type Check = {
  check_id: string;
  check_type: string;
  dataset: string;
  source_ids: string[];
  member_cell_ids: string[];
  target_cell_id: string | null;
  expected: string | null;
  observed: string | null;
  residual: string | null;
  tolerance_rule: string | null;
  result: string;
  not_evaluable_reason: string | null;
  description: string;
  official?: boolean;
  rule_id?: string;
};

export type Source = {
  source_id: string;
  doc_type: string;
  publisher: string;
  jurisdiction: string;
  title: string;
  period: string;
  role: string;
  landing_url: string | null;
  file_url: string | null;
  wayback_url: string | null;
  wayback_timestamp: string | null;
  retrieved_at: string | null;
  retrieved_via: string | null;
  sha256: string;
  size_bytes: number | null;
  page_count: number | null;
  verification_status: string;
  notes: string | null;
  pages_used?: number[];
  run_ids?: string[];
  verification?: Record<string, unknown> | null;
};

export type CoverageRow = {
  dataset: string;
  source_id: string;
  table: string;
  page: number;
  printed_numeric_tokens: number;
  matched: number;
  coverage: number | null;
  coverage_row_band: number | null;
};

export type RunManifest = {
  run_id: string;
  source_id?: string;
  run_mode?: string;
  page_range?: unknown;
  tool_versions?: Record<string, string>;
  config?: Record<string, unknown>;
  config_sha256?: string;
  started_at?: string;
  finished_at?: string;
  duration_s?: number;
  pages_emitted?: number;
  tables_emitted?: number;
  errors?: { count?: number };
  validated?: boolean;
};

/* ---------- loading ---------- */

function readJson<T>(name: string, fallback: T): T {
  const p = path.join(RELEASE_DIR, name);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

/** URL-safe slug for ids. Colons (in observation ids) are not safe in file
 * names on Windows, so ":" becomes "~". Must match scripts/prebuild.mjs. */
export function slugify(id: string): string {
  return id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");
}

type Db = {
  release: Release;
  series: Series[];
  observations: Observation[];
  cells: Cell[];
  checks: Check[];
  sources: Source[];
  coverage: CoverageRow[];
  seriesById: Map<string, Series>;
  obsById: Map<string, Observation>;
  cellById: Map<string, Cell>;
  checkById: Map<string, Check>;
  sourceById: Map<string, Source>;
  obsBySeries: Map<string, Observation[]>;
  childrenOf: Map<string, Series[]>;
  obsBySlug: Map<string, Observation>;
  seriesBySlug: Map<string, Series>;
  sourceBySlug: Map<string, Source>;
  cellsBySource: Map<string, Cell[]>;
};

let cache: Db | null = null;

export function db(): Db {
  if (cache) return cache;
  if (!fs.existsSync(path.join(RELEASE_DIR, "release.json"))) {
    throw new Error(`Release folder not found or incomplete: ${RELEASE_DIR}`);
  }
  const release = readJson<Release>("release.json", {} as Release);
  const series = readJson<Series[]>("series.json", []).map((s) => ({ ...s, breaks: s.breaks ?? [] }));
  const observations = readJson<Observation[]>("observations.json", []).map((o) => ({
    ...o,
    supporting_cell_ids: o.supporting_cell_ids ?? [],
    check_ids: o.check_ids ?? [],
    derived_from: o.derived_from ?? [],
    // Belt and braces: an unpublished observation never carries a value on the site.
    value: o.published ? o.value : null,
  }));
  const cells = readJson<Cell[]>("cells.json", []);
  const checks = readJson<Check[]>("checks.json", []);
  const sources = readJson<Source[]>("sources.json", []);
  const coverage = readJson<CoverageRow[]>("coverage.json", []);

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
  cache = {
    release,
    series,
    observations,
    cells,
    checks,
    sources,
    coverage,
    seriesById: new Map(series.map((s) => [s.series_id, s])),
    obsById: new Map(observations.map((o) => [o.obs_id, o])),
    cellById: new Map(cells.map((c) => [c.cell_id, c])),
    checkById: new Map(checks.map((c) => [c.check_id, c])),
    sourceById: new Map(sources.map((s) => [s.source_id, s])),
    obsBySeries,
    childrenOf,
    obsBySlug: new Map(observations.map((o) => [slugify(o.obs_id), o])),
    seriesBySlug: new Map(series.map((s) => [slugify(s.series_id), s])),
    sourceBySlug: new Map(sources.map((s) => [slugify(s.source_id), s])),
    cellsBySource,
  };
  return cache;
}

/* ---------- links ---------- */

export const obsHref = (obsId: string) => `/o/${slugify(obsId)}`;
export const seriesHref = (seriesId: string) => `/series/${slugify(seriesId)}`;
export const sourceHref = (sourceId: string) => `/sources/${slugify(sourceId)}`;
export const receiptJsonHref = (obsId: string) => `${DATA_BASE}/receipts/${slugify(obsId)}.json`;
export const seriesCsvHref = (seriesId: string) => `${DATA_BASE}/series/${slugify(seriesId)}.csv`;

/* ---------- datasets ---------- */

export function datasetKeys(): string[] {
  const d = db();
  const keys = Object.keys(d.release.dataset_status ?? {});
  for (const s of d.series) if (!keys.includes(s.dataset)) keys.push(s.dataset);
  return keys;
}

export function datasetName(key: string): string {
  return db().release.dataset_status?.[key]?.name ?? key.toUpperCase();
}

export function isDatasetPublished(key: string): boolean {
  return db().release.dataset_status?.[key]?.state === "published";
}

/** Series the site may show values for: only datasets whose state is "published". */
export function visibleSeries(): Series[] {
  return db().series.filter((s) => isDatasetPublished(s.dataset));
}

export function publishedObs(seriesId: string): Observation[] {
  return (db().obsBySeries.get(seriesId) ?? []).filter((o) => o.published && o.value !== null);
}

/* ---------- page renders ---------- */

export function pageFileName(page: number): string {
  return `p${String(page).padStart(3, "0")}.png`;
}

export type PageImage = { src: string; width: number; height: number };

const pageImageCache = new Map<string, PageImage | null>();

/** Returns the page render (and its pixel size, read from the PNG header) or null if the release has no render. */
export function pageImage(sourceId: string, page: number): PageImage | null {
  const key = `${sourceId}/${page}`;
  if (pageImageCache.has(key)) return pageImageCache.get(key) ?? null;
  const file = path.join(RELEASE_DIR, "pages", sourceId, pageFileName(page));
  let out: PageImage | null = null;
  if (fs.existsSync(file)) {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(24);
    fs.readSync(fd, buf, 0, 24, 0);
    fs.closeSync(fd);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width > 0 && height > 0) {
      out = { src: `${DATA_BASE}/pages/${encodeURIComponent(sourceId)}/${pageFileName(page)}`, width, height };
    }
  }
  pageImageCache.set(key, out);
  return out;
}

/* ---------- run manifests and markdown ---------- */

export function runManifest(runId: string): RunManifest | null {
  const p = path.join(RELEASE_DIR, "runs", `${runId}.manifest.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as RunManifest;
}

export function releaseMarkdown(name: string): string | null {
  const p = path.join(RELEASE_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

export function methodsMarkdown(): string | null {
  const p = path.join(DOCS_DIR, "METHODS.md");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

export function releaseFileExists(name: string): boolean {
  return fs.existsSync(path.join(RELEASE_DIR, name));
}

/** Date the site was built, used as the access date in citations. */
export function buildDate(): string {
  return new Date().toISOString().slice(0, 10);
}
