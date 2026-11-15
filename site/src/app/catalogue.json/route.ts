// Every catalogue row as one static JSON file, written at build time from the
// release. The catalogue page renders only the top-level series in HTML; this
// file is fetched once, when a reader filters or asks for every series
// (DESIGN.md 14.1: catalogue HTML at most 100 KB and 1,500 elements).
// scripts/check-build.mjs checks every value in it against the release.
import { datasetName, db, obsHref, seriesCsvHref, seriesHref, visibleSeries } from "@/lib/data";
import { printedLine, seriesTitle } from "@/lib/titles";
import { facetValuesOf } from "@/lib/facets.mjs";
import { kindWords } from "@/components/Figure";
import { formatDecimalString, periodWords, unitLabel } from "@/lib/format";
import { ancestors, baseYearOf, latestPublished } from "@/lib/stats";

export const dynamic = "force-static";

export type CatalogueRow = {
  id: string;
  /** The plain title (editorial/titles.json); the printed name when there is none. */
  name: string;
  /** The printed name, when it differs from the title (shown as a grey second line). */
  printed: string | null;
  href: string;
  csv: string;
  unit: string;
  from: string | null;
  to: string | null;
  /** Checked values, all figures. */
  n: number;
  all: number;
  latest: { obs: string; v: string; href: string; kind: string; period: string; latestPeriod: string } | null;
  tags: string[];
  parent: string | null;
  root: boolean;
  order: number;
  f: Record<string, string>;
  search: string;
};

export function GET() {
  const d = db();
  const series = visibleSeries();
  const ids = new Set(d.series.map((s) => s.series_id));
  const rows: CatalogueRow[] = series.map((s, order) => {
    const all = d.obsBySeries.get(s.series_id) ?? [];
    const pub = all.filter((o) => o.published && o.value !== null);
    const periods = [...new Set(all.map((o) => o.period))].sort();
    const latest = latestPublished(s.series_id);
    const parents = ancestors(s);
    const base = s.dataset === "cpi" ? baseYearOf(s) : null;
    const tags = [
      s.dims?.definition ?? null,
      base ? `base ${base}` : null,
      s.dims?.area_as_printed === "none stated" ? "no area stated" : null,
      s.derived ? "computed" : null,
    ].filter((t): t is string => !!t);
    const f = facetValuesOf(s) as Record<string, string | null>;
    return {
      id: s.series_id,
      name: seriesTitle(s),
      printed: printedLine(s),
      href: seriesHref(s.series_id),
      csv: seriesCsvHref(s.series_id),
      unit: unitLabel(s.unit, s.scale_factor),
      from: periods.length ? periodWords(periods[0], s.frequency) : null,
      to: periods.length ? periodWords(periods[periods.length - 1], s.frequency) : null,
      n: pub.length,
      all: all.length,
      latest: latest
        ? {
            obs: latest.obs_id,
            v: formatDecimalString(latest.value),
            href: obsHref(latest.obs_id),
            kind: kindWords(latest.vintage) ? latest.vintage.toUpperCase() : "",
            period: periodWords(latest.period, s.frequency),
            latestPeriod: latest.period,
          }
        : null,
      tags,
      parent: parents[0] ? seriesTitle(parents[0]) : null,
      root: !s.parent_id || !ids.has(s.parent_id),
      order,
      f: Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<string, string>,
      search: [seriesTitle(s), s.name, s.series_id, ...(s.synonyms ?? []), datasetName(s.dataset), ...parents.flatMap((p) => [seriesTitle(p), p.name])].join(" ").toLowerCase(),
    };
  });
  return Response.json({ release: d.release.version, rows });
}
