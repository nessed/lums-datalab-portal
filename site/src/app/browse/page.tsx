// Find data (design set 2026-11-23, "Find Data"). The list is every top-level
// series of every published data type (the series that sit under no other),
// A to Z, each with its years and its latest checked figure, the period and
// the page it is printed on. Rows are rendered on the server, so the list
// works without JavaScript; the search field and the facets narrow it in
// place (the full list of every series, /catalogue.json, is loaded then) and
// keep their state in the URL (?q=&topic=&dataset=&geo=&from=&to=).
// scripts/checks/find-list.mjs checks the list against the release.
import type { Metadata } from "next";
import { seriesTitle } from "@/lib/titles";
import Link from "@/components/ui/Link";
import CatalogueFilter, { CatalogueResults, CatalogueSearch, type FacetGroup } from "@/components/CatalogueFilter";
import { KindAndPeriod } from "@/components/Figure";
import { Breadcrumbs } from "@/components/ui/Basics";
import { Count, Num, V } from "@/components/ui/Num";
import { DATA_BASE, datasetName, db, docPageHref, pageShort, seriesHref, visibleSeries, type Series } from "@/lib/data";
import { FACETS, facetCounts, topicLabels, valueWords, type FacetKey } from "@/lib/facets.mjs";
import { COMING, feature, type FeatureKey } from "@/lib/features";
import { periodWords, unitLabel } from "@/lib/format";
import { ancestors, baseYearOf, latestPublished, publishedDatasets, totalVisible } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Find data: every series in the release",
  description: "Every series in the current release, A to Z, with its years, its latest checked figure and the page it is printed on. Filter by topic, publication, province and years.",
};

/** Facets in the order of the design: topic, publication, province first; the rest closed below. */
const FIRST: FacetKey[] = ["topic", "dataset", "geo"];
const LABEL: Partial<Record<FacetKey, string>> = { dataset: "Publication", geo: "Province" };
/** Planned data named in the "Not here yet" line (features.config.json labels). */
const NOT_YET: FeatureKey[] = ["provincialBudgets", "districts", "monthlyData", "moreDataTypes"];

function Row({ s, order }: { s: Series; order: number }) {
  const d = db();
  const all = d.obsBySeries.get(s.series_id) ?? [];
  const periods = [...new Set(all.map((o) => o.period))].sort();
  const latest = latestPublished(s.series_id);
  const cell = latest?.primary_cell_id ? d.cellById.get(latest.primary_cell_id) : undefined;
  const parents = ancestors(s);
  const base = s.dataset === "cpi" ? baseYearOf(s) : null;
  return (
    <li className="cat-row fd-row" data-cat-row="" data-order={order} data-series={s.series_id}>
      <div className="fd-name">
        <Link href={seriesHref(s.series_id)}>{seriesTitle(s)}</Link>
        <span className="fd-sub">
          {datasetName(s.dataset)} · {unitLabel(s.unit, s.scale_factor)}
          {parents.length ? <> · in {seriesTitle(parents[0])}</> : null}
        </span>
        {s.dims?.definition || base || s.derived ? (
          <span className="fd-tags">
            {s.dims?.definition ? (
              <span className={`fd-tag${s.dims.definition === "19th ICLS" ? " fd-tag-warn" : ""}`}>
                <Num kind="ui">{s.dims.definition}</Num>
              </span>
            ) : null}
            {base ? (
              <span className="fd-tag">
                base <Num kind="period">{base}</Num>
              </span>
            ) : null}
            {s.derived ? <span className="fd-tag">computed</span> : null}
          </span>
        ) : null}
      </div>
      <div className="fd-years">
        {periods.length ? (
          <>
            <Num kind="period">{periodWords(periods[0], s.frequency)}</Num> to <Num kind="period">{periodWords(periods[periods.length - 1], s.frequency)}</Num>
          </>
        ) : (
          "no periods"
        )}
      </div>
      <div className="fd-latest" data-latest={latest?.obs_id}>
        {latest ? (
          <>
            <V o={latest} short className="v-link fd-v" />
            <span className="fd-when">
              <KindAndPeriod o={latest} series={s} />
              {cell ? (
                <>
                  {" · "}
                  <Link href={docPageHref(cell.source_id, cell.page)} className="fd-pref" aria-label={`Open the document at ${pageShort(cell)}`}>
                    <Num kind="page">{pageShort(cell)}</Num>
                  </Link>
                </>
              ) : null}
            </span>
          </>
        ) : (
          <span className="fd-none">no checked figure yet</span>
        )}
      </div>
    </li>
  );
}

export default function BrowsePage() {
  const d = db();
  const series = visibleSeries();
  const keys = publishedDatasets();
  const datasets = Object.fromEntries(keys.map((k) => [k, datasetName(k)]));
  const topics = topicLabels(series);
  const counts = facetCounts(series);
  const total = totalVisible();
  const order = [...FIRST, ...FACETS.map((f) => f.key).filter((k) => !FIRST.includes(k))];
  const groups: FacetGroup[] = order
    .map((key) => {
      const f = FACETS.find((x) => x.key === key)!;
      const entries = [...counts[f.key].entries()];
      if (f.key === "topic") entries.sort((a, b) => b[1] - a[1]);
      return {
        key: f.key,
        label: LABEL[f.key] ?? f.label,
        open: FIRST.includes(f.key),
        more: f.more,
        values: entries.map(([v, n]) => ({ value: v, label: valueWords(f.key, v, topics, datasets), count: n })),
        note: f.key === "geo" ? `Districts: ${COMING}` : undefined,
      };
    })
    .filter((g) => g.values.length > 0);
  // Years for the range: the first year of every period a visible series has.
  const years = [
    ...new Set(series.flatMap((s) => (d.obsBySeries.get(s.series_id) ?? []).map((o) => /^(\d{4})/.exec(o.period)?.[1]).filter((y): y is string => !!y))),
  ].sort();
  // Only the top-level series are in the HTML; everything else is one tap away
  // (its parent's page) or loaded as JSON when the reader filters (DESIGN.md 14.1).
  const ids = new Set(d.series.map((x) => x.series_id));
  const roots = series
    .filter((s) => !s.parent_id || !ids.has(s.parent_id))
    .sort((a, b) => seriesTitle(a).localeCompare(seriesTitle(b)) || a.series_id.localeCompare(b.series_id));
  const names = keys.map((k) => datasetName(k));
  const notYet = NOT_YET.map((k) => feature(k).label).map((l) => l.charAt(0).toLowerCase() + l.slice(1));

  return (
    <div className="catalogue find">
      <Breadcrumbs items={[{ label: "Find data" }]} />
      <h1 className="fd-h1">
        <Count k="series" n={total.series} /> series from the{" "}
        {names.map((n, i) => (
          <span key={n}>
            {i ? (i === names.length - 1 ? " and the " : ", the ") : null}
            {n}
          </span>
        ))}
        : <Count k="values" n={total.values} /> checked figures, each linked to the page it is printed on.
      </h1>
      <CatalogueSearch groups={groups} indexUrl={`${DATA_BASE}/search.json`} />

      <div className="cat-layout fd-layout" id="series">
        <CatalogueFilter groups={groups} indexUrl={`${DATA_BASE}/search.json`} years={years} />
        <section className="cat-results fd-results" aria-labelledby="cat-results-h">
          <h2 id="cat-results-h" className="sr-only">
            Series
          </h2>
          <div className="fd-tools">
            <p className="cat-status fd-status" id="cat-status" aria-live="polite">
              <Count k="series:roots" n={roots.length} /> main series of <Count k="series" n={total.series} />
            </p>
            <label className="fd-sort">
              Sort{" "}
              <select id="cat-sort" className="fd-select" defaultValue="name">
                <option value="name">A to Z</option>
                <option value="order">Document order (best match when filtering by words)</option>
                <option value="latest">Latest period</option>
                <option value="n">Most checked figures</option>
              </select>
            </label>
          </div>
          <div className="fd-cols" aria-hidden="true">
            <span>Series</span>
            <span>Years</span>
            <span className="fd-col-latest">Latest</span>
          </div>
          <ul className="cat-list fd-list" id="cat-list">
            {roots.map((s, i) => (
              <Row key={s.series_id} s={s} order={i} />
            ))}
          </ul>
          <p className="fd-note" id="cat-roots-note">
            The other series sit under these: open one to see its parts, or filter the list.{" "}
            <a href="/browse?all=1" className="js-only">
              Show every series
            </a>
          </p>
          <CatalogueResults groups={groups} total={total.series} indexUrl={`${DATA_BASE}/search.json`} />
          <p className="fd-note">Latest: the most recent checked figure, linked to its receipt; the page reference opens the document at that page.</p>
          <p className="fd-note fd-notyet">
            Not here yet: {notYet.join(", ")}. What is planned is listed on <Link href="/releases#coming">What&rsquo;s new</Link>.
          </p>
          <p className="fd-note fd-more-ways">
            Also: <Link href="/library">by document</Link> · <Link href="/library/datasets">by dataset</Link> · <Link href="/data">download everything</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
