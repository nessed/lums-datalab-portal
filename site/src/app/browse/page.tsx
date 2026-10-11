// The catalogue ("Data"): every series of every published data type, with
// filters in a left column (a drawer on phones). Rows are rendered on the
// server, so the whole list works without JavaScript; the filter narrows and
// sorts them in place and keeps its state in the URL.
import type { Metadata } from "next";
import Link from "next/link";
import CatalogueFilter, { type FacetGroup, type RowData } from "@/components/CatalogueFilter";
import { KindAndPeriod } from "@/components/Figure";
import Spark from "@/components/Spark";
import { Breadcrumbs } from "@/components/ui/Basics";
import { Count, Num, V } from "@/components/ui/Num";
import { datasetName, db, seriesCsvHref, seriesHref, sourceHref, visibleSeries, type Series } from "@/lib/data";
import { FACETS, facetCounts, facetValuesOf, topicLabels, valueWords } from "@/lib/facets.mjs";
import { COMING } from "@/lib/features";
import { DOC_TYPE_WORDS, periodWords, unitLabel } from "@/lib/format";
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
      <div className="cat-spark">
        <Spark series={s} width={84} height={26} />
      </div>
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
  const rowData: RowData[] = series.map((s) => {
    const f = facetValuesOf(s);
    const latest = latestPublished(s.series_id);
    return {
      f: Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<string, string>,
      search: [s.name, s.series_id, ...(s.synonyms ?? []), datasetName(s.dataset), ...ancestors(s).map((p) => p.name)].join(" ").toLowerCase(),
      values: (d.obsBySeries.get(s.series_id) ?? []).some((o) => o.published && o.value !== null),
      name: s.name.toLowerCase(),
      latest: latest?.period ?? "",
      n: (d.obsBySeries.get(s.series_id) ?? []).filter((o) => o.published && o.value !== null).length,
    };
  });
  const docTypes = [...new Set(d.sources.map((s) => s.doc_type))];
  const primaryCount = new Map<string, number>();
  for (const o of d.observations) {
    if (!o.published || !o.primary_cell_id) continue;
    const src = d.cellById.get(o.primary_cell_id)?.source_id;
    if (src) primaryCount.set(src, (primaryCount.get(src) ?? 0) + 1);
  }

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
        <a href="#by-document">By document</a>
        <Link href="/datasets">By data type</Link>
      </nav>

      <div className="cat-layout" id="series">
        <CatalogueFilter groups={groups} total={total.series} rows={rowData} />
        <section className="cat-results" aria-labelledby="cat-results-h">
          <h2 id="cat-results-h" className="sr-only">
            Series
          </h2>
          <div className="cat-tools">
            <p className="cat-status" id="cat-status" aria-live="polite">
              <Count k="series" n={total.series} /> series
            </p>
            <div className="cat-active" id="cat-active" />
            <label className="cat-sort">
              Sort{" "}
              <select id="cat-sort" className="input" defaultValue="order">
                <option value="order">Document order</option>
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
            {series.map((s, i) => (
              <Row key={s.series_id} s={s} order={i} />
            ))}
          </ul>
          <p className="cat-empty" data-cat-empty hidden>
            No series matches. Try fewer words or fewer filters, or <a href="/browse">clear them all</a>.
          </p>
          <p className="small muted cat-foot">
            Checked: checked values out of all figures of the series; the rest are labelled gaps that say why. Latest: the most recent checked value,
            linked to its receipt; <abbr title="budget estimate">BE</abbr> budget estimate, <abbr title="revised estimate">RE</abbr> revised estimate.
          </p>
        </section>
      </div>

      <section className="cat-docs" aria-labelledby="by-document">
        <h2 id="by-document">By document</h2>
        <p className="small muted">Each government document, how many checked values in this release are read from it, and its tables as printed.</p>
        {docTypes.map((t) => (
          <div key={t} className="cat-doctype">
            <h3>{DOC_TYPE_WORDS[t] ?? t}</h3>
            <div className="table-wrap" role="region" aria-label={`${DOC_TYPE_WORDS[t] ?? t} documents`} tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Period</th>
                    <th scope="col" className="num">
                      Pages read
                    </th>
                    <th scope="col" className="num">
                      Values from it
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.sources
                    .filter((s) => s.doc_type === t)
                    .map((s) => (
                      <tr key={s.source_id}>
                        <th scope="row">
                          <Link href={sourceHref(s.source_id)}>{s.title}</Link>
                          {s.verification_status === "failed" ? <span className="tag">not used</span> : null}
                        </th>
                        <td>
                          <Num kind="period">{s.period}</Num>
                        </td>
                        <td className="num">
                          {(s.pages_used ?? []).length ? <Count k={`pages:source:${s.source_id}`} n={(s.pages_used ?? []).length} /> : "none"}
                        </td>
                        <td className="num">
                          <Count k={`values:source:${s.source_id}`} n={primaryCount.get(s.source_id) ?? 0} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
