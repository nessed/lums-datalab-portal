// The catalogue ("Data"): every series of every published data type, with
// filters in a left column (a drawer on phones). Rows are rendered on the
// server, so the whole list works without JavaScript; the filter narrows and
// sorts them in place and keeps its state in the URL.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import CatalogueFilter, { CatalogueResults, type FacetGroup } from "@/components/CatalogueFilter";
import { KindAndPeriod } from "@/components/Figure";
import { Breadcrumbs } from "@/components/ui/Basics";
import { Count, Num, V } from "@/components/ui/Num";
import { DATA_BASE, datasetName, db, seriesCsvHref, seriesHref, visibleSeries, type Series } from "@/lib/data";
import { FACETS, facetCounts, topicLabels, valueWords } from "@/lib/facets.mjs";
import { COMING } from "@/lib/features";
import { periodWords, unitLabel } from "@/lib/format";
import { ancestors, baseYearOf, latestPublished, publishedDatasets, totalVisible } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Data: the catalogue",
  description: "Every series in the current release, with filters by data type, topic, geography and definition, the latest checked figure and a download for each.",
};

function Row({ s, order }: { s: Series; order: number }) {
  const d = db();
  const all = d.obsBySeries.get(s.series_id) ?? [];
  const pub = all.filter((o) => o.published && o.value !== null);
  const periods = [...new Set(all.map((o) => o.period))].sort();
  const latest = latestPublished(s.series_id);
  const parents = ancestors(s);
  const base = s.dataset === "cpi" ? baseYearOf(s) : null;
  return (
    <li className="cat-row" data-cat-row="" data-order={order}>
      <div className="cat-name">
        <Link href={seriesHref(s.series_id)}>{s.name}</Link>
        {s.dims?.definition ? <span className={`tag${s.dims.definition === "19th ICLS" ? " tag-warn" : ""}`}><Num kind="ui">{s.dims.definition}</Num></span> : null}
        {base ? (
          <span className="tag">
            base <Num kind="period">{base}</Num>
          </span>
        ) : null}
        {s.dims?.area_as_printed === "none stated" ? <span className="tag">no area stated</span> : null}
        {s.derived ? <span className="tag">computed</span> : null}
        {parents.length ? <span className="cat-path">in {parents[0].name}</span> : null}
      </div>
      <div className="cat-unit">{unitLabel(s.unit, s.scale_factor)}</div>
      <div className="cat-periods">
        {periods.length ? (
          <>
            <Num kind="period">{periodWords(periods[0], s.frequency)}</Num> to <Num kind="period">{periodWords(periods[periods.length - 1], s.frequency)}</Num>
          </>
        ) : (
          "no periods"
        )}
      </div>
      <div className="cat-count num">
        <Count k={`values:series:${s.series_id}`} n={pub.length} /> <span className="muted">of</span> <Count k={`obs:series:${s.series_id}`} n={all.length} />
        <span className="cat-count-w"> checked</span>
      </div>
      <div className="cat-latest num">
        {latest ? (
          <>
            <V o={latest} />
            <span className="cat-kind">
              <KindAndPeriod o={latest} series={s} short />
            </span>
          </>
        ) : (
          <span className="muted">no checked value</span>
        )}
      </div>
      <div className="cat-spark" />
      <div className="cat-dl">
        <a href={seriesCsvHref(s.series_id)} download aria-label={`Download ${s.name} as CSV`}>
          CSV
        </a>
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
  const groups: FacetGroup[] = FACETS.map((f) => {
    const entries = [...counts[f.key].entries()];
    if (f.key === "topic") entries.sort((a, b) => b[1] - a[1]);
    return {
      key: f.key,
      label: f.label,
      open: f.open,
      more: f.more,
      values: entries.map(([v, n]) => ({ value: v, label: valueWords(f.key, v, topics, datasets), count: n })),
      note: f.key === "geo" ? `Districts: ${COMING}` : undefined,
    };
  }).filter((g) => g.values.length > 0);
  // Only the top-level series are in the HTML; everything else is one tap away
  // (its parent's page) or loaded as JSON when the reader filters (DESIGN.md 14.1).
  const ids = new Set(d.series.map((x) => x.series_id));
  const roots = series.filter((s) => !s.parent_id || !ids.has(s.parent_id));

  return (
    <div className="catalogue">
      <Breadcrumbs items={[{ label: "Data" }]} />
      <header className="cat-head">
        <h1>Data</h1>
        <p className="cat-sum">
          <Count k="series" n={total.series} /> series · <Count k="values" n={total.values} /> checked values · release{" "}
          <Num kind="version">{d.release.version}</Num>
        </p>
        <Link href="/data" className="cat-all">
          Download everything
        </Link>
      </header>
      <nav className="tabs" aria-label="Ways to browse">
        <a href="#series" aria-current="page">
          Series
        </a>
        <Link href="/sources">By document</Link>
        <Link href="/datasets">By data type</Link>
      </nav>

      <div className="cat-layout" id="series">
        <CatalogueFilter groups={groups} indexUrl={`${DATA_BASE}/search.json`} />
        <section className="cat-results" aria-labelledby="cat-results-h">
          <h2 id="cat-results-h" className="sr-only">
            Series
          </h2>
          <div className="cat-tools">
            <p className="cat-status" id="cat-status" aria-live="polite">
              <Count k="series:roots" n={roots.length} /> top-level series of <Count k="series" n={total.series} />
            </p>
            <div className="cat-active" id="cat-active" />
            <label className="cat-sort">
              Sort{" "}
              <select id="cat-sort" className="input" defaultValue="order">
                <option value="order">Document order (relevance when searching)</option>
                <option value="name">Name</option>
                <option value="latest">Latest period</option>
                <option value="n">Most checked values</option>
              </select>
            </label>
          </div>
          <div className="cat-cols" aria-hidden="true">
            <span>Series</span>
            <span>Unit</span>
            <span>Periods</span>
            <span className="num">Checked</span>
            <span className="num">Latest</span>
            <span>Trend</span>
            <span />
          </div>
          <ul className="cat-list" id="cat-list">
            {roots.map((s, i) => (
              <Row key={s.series_id} s={s} order={i} />
            ))}
          </ul>
          <p className="small cat-roots" id="cat-roots-note">
            The other series sit under these: open one to see its parts, or filter the list.{" "}
            <a href="/browse?all=1" className="js-only">
              Show every series
            </a>
          </p>
          <CatalogueResults groups={groups} total={total.series} indexUrl={`${DATA_BASE}/search.json`} />
          <p className="small muted cat-foot">
            Checked: checked values out of all figures of the series; the rest are labelled gaps that say why. Latest: the most recent checked value,
            linked to its receipt; <abbr title="budget estimate">BE</abbr> budget estimate, <abbr title="revised estimate">RE</abbr> revised estimate.
          </p>
        </section>
      </div>

    </div>
  );
}
