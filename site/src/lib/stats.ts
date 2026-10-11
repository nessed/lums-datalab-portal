// Counts and picks derived from the release at build time. Every number here is
// a count of release records; scripts/check-build.mjs recomputes each one
// independently from the release files (the key passed to <Count k>).
import { db, isDatasetPublished, publishedObs, visibleSeries, type Observation, type Series } from "./data";

const VINTAGE_RANK: Record<string, number> = { actual: 4, re: 3, provisional: 2, be: 1, na: 0 };

/** The most recent checked figure of a series: latest period, then the most
 * final kind of figure printed for it (actual, revised, budget). */
export function latestPublished(seriesId: string): Observation | undefined {
  return [...publishedObs(seriesId)].sort(
    (a, b) => b.period.localeCompare(a.period) || (VINTAGE_RANK[b.vintage] ?? 0) - (VINTAGE_RANK[a.vintage] ?? 0),
  )[0];
}

/** The kind of figure a series is usually read on: budget estimate if it has any, else its most common. */
export function mainVintage(seriesId: string): string {
  const pub = publishedObs(seriesId);
  if (pub.some((o) => o.vintage === "be")) return "be";
  const n = new Map<string, number>();
  for (const o of pub) n.set(o.vintage, (n.get(o.vintage) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "na";
}

export type DatasetStats = {
  key: string;
  series: number;
  values: number;
  gaps: Record<string, number>;
  gapTotal: number;
  disputed: number;
  docs: string[];
  periods: string[];
  publisher: string | null;
  frequency: string | null;
};

const statsCache = new Map<string, DatasetStats>();

export function datasetStats(key: string): DatasetStats {
  const hit = statsCache.get(key);
  if (hit) return hit;
  const d = db();
  const series = d.series.filter((s) => s.dataset === key);
  const ids = new Set(series.map((s) => s.series_id));
  const obs = d.observations.filter((o) => ids.has(o.series_id));
  const gaps: Record<string, number> = {};
  let values = 0;
  let disputed = 0;
  const docs = new Set<string>();
  for (const o of obs) {
    if (o.published && o.value !== null) {
      values++;
      const c = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : undefined;
      if (c) docs.add(c.source_id);
    } else {
      const k = o.status === "disputed" ? "disputed" : (o.gap_kind ?? "unknown");
      gaps[k] = (gaps[k] ?? 0) + 1;
      if (o.status === "disputed") disputed++;
    }
  }
  const docList = [...docs].sort();
  const src = docList.length ? d.sourceById.get(docList[0]) : undefined;
  const freqs = [...new Set(series.map((s) => s.frequency))];
  const out: DatasetStats = {
    key,
    series: series.length,
    values,
    gaps,
    gapTotal: Object.values(gaps).reduce((a, b) => a + b, 0),
    disputed,
    docs: docList,
    periods: [...new Set(obs.filter((o) => o.published).map((o) => o.period))].sort(),
    publisher: src?.publisher ?? null,
    frequency: freqs.length === 1 ? freqs[0] : null,
  };
  statsCache.set(key, out);
  return out;
}

/** Published datasets, in release order. */
export function publishedDatasets(): string[] {
  return Object.keys(db().release.dataset_status ?? {}).filter(isDatasetPublished);
}

export function totalVisible(): { series: number; values: number } {
  const vs = visibleSeries();
  return { series: vs.length, values: vs.reduce((a, s) => a + publishedObs(s.series_id).length, 0) };
}

/** Documents behind at least one published value (all published datasets). */
export function docsUsed(): string[] {
  return [...new Set(publishedDatasets().flatMap((k) => datasetStats(k).docs))].sort();
}

/** Parent chain, nearest first. */
export function ancestors(s: Series): Series[] {
  const d = db();
  const out: Series[] = [];
  let p = s.parent_id ? d.seriesById.get(s.parent_id) : undefined;
  while (p && out.length < 8) {
    out.push(p);
    p = p.parent_id ? d.seriesById.get(p.parent_id) : undefined;
  }
  return out;
}

/** Series in other datasets or definitions that must never share a line with this one. */
export function definitionOf(s: Series): string | null {
  return s.dims?.definition ?? null;
}

export function baseYearOf(s: Series): string | null {
  if (s.dims?.base_year) return s.dims.base_year;
  const m = /b(\d{4})_(\d{2})$/.exec(s.series_id);
  return m ? `${m[1]}-${m[2]}` : null;
}
