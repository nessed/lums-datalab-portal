// A series: title, one-line definition and a metadata strip, then the chart
// component with tabs (Chart | Table | Sources | Download | Cite) on the first
// screen; related series in the rail. Every value links to its receipt.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cite from "@/components/Cite";
import { KindAndPeriod } from "@/components/Figure";
import SeriesChart from "@/components/SeriesChart";
import SeriesTable from "@/components/SeriesTable";
import Tabs from "@/components/Tabs";
import { LineKey } from "@/components/Chart";
import { Breadcrumbs, Callout, DownloadLink } from "@/components/ui/Basics";
import CopyButton from "@/components/ui/CopyButton";
import { Count, Num, V } from "@/components/ui/Num";
import { StatusLegend } from "@/components/ui/Status";
import { buildChart } from "@/lib/chart";
import { DATA_BASE, datasetName, db, pageShort, publishedObs, seriesCsvHref, seriesHref, slugify, sourceHref, visibleSeries, type Series } from "@/lib/data";
import { COMING, isOn } from "@/lib/features";
import { periodWords, unitLabel, vintageWords } from "@/lib/format";
import { statusOf, type StatusKey } from "@/lib/status";
import { ancestors, latestPublished } from "@/lib/stats";
import { tableHrefOf, tableOfCell } from "@/lib/tables";

export const dynamicParams = false;

export function generateStaticParams() {
  return visibleSeries().map((s) => ({ id: slugify(s.series_id) }));
}

type Props = { params: Promise<{ id: string }> };

function find(id: string) {
  const d = db();
  return d.seriesBySlug.get(id) ?? d.seriesBySlug.get(decodeURIComponent(id));
}

const FREQ: Record<string, string> = { fiscal_year: "fiscal year (July to June)", month: "month", survey_round: "survey round", year: "calendar year", quarter: "quarter" };
const GEO: Record<string, string> = { pk: "Pakistan", "pk-pb": "Punjab", "pk-sd": "Sindh", "pk-kp": "Khyber Pakhtunkhwa", "pk-ba": "Balochistan" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = find((await params).id);
  if (!s) return { title: "Series" };
  return { title: s.name, description: `${s.definition ?? s.name}. Every figure links to the page of the government document it was read from.` };
}

function Related({ items, label }: { items: Series[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <section className="rel">
      <h2>{label}</h2>
      <ul>
        {items.map((c) => {
          const o = latestPublished(c.series_id);
          return (
            <li key={c.series_id}>
              <Link href={seriesHref(c.series_id)} className="rel-name">
                {c.name}
              </Link>
              {o ? (
                <span className="rel-v">
                  <V o={o} />
                  <span className="rel-k">
                    <KindAndPeriod o={o} series={c} short />
                  </span>
                </span>
              ) : (
                <span className="rel-v muted">no checked value</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function SeriesPage({ params }: Props) {
  const { id } = await params;
  const series = find(id);
  if (!series) notFound();
  const d = db();
  const parents = ancestors(series);
  const parent = parents[0];
  const children = (d.childrenOf.get(series.series_id) ?? []).filter((c) => !c.derived);
  const siblings = parent ? (d.childrenOf.get(parent.series_id) ?? []).filter((c) => !c.derived && c.series_id !== series.series_id) : [];
  const share = d.seriesById.get(`${series.series_id}.share_of_total`);
  const shareUsable = share && share.unit === "percent" && share.derived ? share : null;
  const path = seriesHref(series.series_id);
  const unit = unitLabel(series.unit, series.scale_factor);
  const all = d.obsBySeries.get(series.series_id) ?? [];
  const pub = publishedObs(series.series_id);
  const counts = new Map<StatusKey, number>();
  for (const o of all) counts.set(statusOf(o).key, (counts.get(statusOf(o).key) ?? 0) + 1);
  const latest = latestPublished(series.series_id);
  const vintages = [...new Set(all.map((o) => o.vintage))].filter((v) => v !== "na");
  const present = [...counts.keys()].filter((k) => k !== "unknown") as Exclude<StatusKey, "unknown">[];
  const amount = buildChart(series);
  const defn = series.definition;

  // Documents this series is read from: primary cells of its published figures.
  const bySource = new Map<string, { pages: Map<string, { label: string; href: string | null }>; n: number }>();
  for (const o of pub) {
    const c = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : undefined;
    if (!c) continue;
    const e = bySource.get(c.source_id) ?? { pages: new Map(), n: 0 };
    e.n++;
    const t = tableOfCell(c);
    e.pages.set(`${c.page}|${c.table_index}`, { label: pageShort(c), href: t ? tableHrefOf(c) : null });
    bySource.set(c.source_id, e);
  }
  const sources = [...bySource.entries()].map(([sid, e]) => ({ src: d.sourceById.get(sid), sid, ...e })).sort((a, b) => (a.src?.period ?? "").localeCompare(b.src?.period ?? ""));
  const provincial = !!series.geo && series.geo !== "pk";
  const breakNote = series.breaks[0];

  return (
    <article className="series-page">
      <Breadcrumbs
        items={[
          { href: "/browse", label: "Data" },
          { href: `/datasets/${series.dataset}`, label: datasetName(series.dataset) },
          ...[...parents].reverse().slice(-2).map((p) => ({ href: seriesHref(p.series_id), label: p.name })),
          { label: series.name },
        ]}
      />
      <header className="series-head">
        <div className="series-title">
          <h1>{series.name}</h1>
          {defn ? (
            <p className="series-def">
              {defn}
              {series.definition_status && series.definition_status !== "reviewed" ? <span className="draft-mark"> Draft definition, not yet reviewed by a person.</span> : null}
            </p>
          ) : null}
        </div>
        <div className="series-actions no-print">
          <DownloadLink href={seriesCsvHref(series.series_id)} className="btn btn-primary">
            Download CSV
          </DownloadLink>
          <DownloadLink href={`${DATA_BASE}/series/${slugify(series.series_id)}.json`}>JSON</DownloadLink>
          <Link className="btn" href={`/compare?s=${encodeURIComponent(series.series_id)}`}>
            Add to compare
          </Link>
          <a className="btn" href="?tab=cite#chart">
            Cite
          </a>
        </div>
      </header>

      <dl className="meta-strip">
        <div>
          <dt>Latest checked figure</dt>
          <dd>
            {latest ? (
              <>
                <V o={latest} /> {unit} · <KindAndPeriod o={latest} series={series} />
              </>
            ) : (
              "none in this release"
            )}
          </dd>
        </div>
        <div>
          <dt>Checked figures</dt>
          <dd>
            <Count k={`values:series:${series.series_id}`} n={pub.length} /> of <Count k={`obs:series:${series.series_id}`} n={all.length} />
            {all.length > pub.length ? "; the rest are labelled gaps" : ""}
          </dd>
        </div>
        <div>
          <dt>Unit · frequency</dt>
          <dd>
            {unit} · {FREQ[series.frequency] ?? series.frequency.replaceAll("_", " ")}
          </dd>
        </div>
        <div>
          <dt>Geography</dt>
          <dd>
            {series.geo ? (GEO[series.geo] ?? series.geo) : "not stated"}
            {series.dataset === "abs" ? " (federal government)" : ""}
          </dd>
        </div>
        {vintages.length ? (
          <div>
            <dt>Kinds of figure</dt>
            <dd>{vintages.map((v) => vintageWords(v)).join(", ")}</dd>
          </div>
        ) : null}
        {series.dims?.definition ? (
          <div>
            <dt>Definition</dt>
            <dd>{series.dims.definition}</dd>
          </div>
        ) : null}
        <div>
          <dt>Printed in</dt>
          <dd>
            <a href="?tab=sources#chart">
              <Count k={`docs:series:${series.series_id}`} n={sources.length} /> {sources.length === 1 ? "document" : "documents"}
            </a>
          </dd>
        </div>
        <div>
          <dt>Series id</dt>
          <dd className="mono">
            <Num kind="id">{series.series_id}</Num> <CopyButton text={series.series_id} label="Copy" className="btn btn-text btn-tiny" />
          </dd>
        </div>
      </dl>

      <div className="series-grid">
        <div className="series-main" id="chart">
          <Tabs
            label="Views of this series"
            tabs={[
              { id: "chart", label: "Chart" },
              { id: "table", label: "Table" },
              { id: "sources", label: "Sources" },
              { id: "download", label: "Download" },
              { id: "cite", label: "Cite" },
            ]}
          >
            <section aria-labelledby="h-chart">
              <h2 id="h-chart" className="panel-h">
                Chart
              </h2>
              {breakNote ? (
                <details className="break-note">
                  <summary>
                    <strong>
                      Series break from <Num kind="period">{periodWords(breakNote.at_period, series.frequency)}</Num> ({breakNote.kind.replaceAll("_", " ")}):
                    </strong>{" "}
                    figures before and after are not comparable; the lines stop there. <span className="break-more">Why</span>
                  </summary>
                  <p>{breakNote.note}</p>
                </details>
              ) : null}
              <SeriesChart amount={amount} share={shareUsable ? buildChart(shareUsable) : null} amountLabel={series.unit === "PKR" ? "Amount" : "Value"} shareLabel="Share of total" />
              <div className="chart-foot">
                {amount.lines.length > 1 ? (
                  <ul className="line-key" aria-label="Lines">
                    {amount.lines.map((l) => (
                      <li key={l.key}>
                        <LineKey line={l} /> {l.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {amount.marks.length ? <span className="muted">Under the axis: periods without a value, with their status mark.</span> : null}
                {series.unit === "PKR" && !isOn("realTerms") ? (
                  <span className="coming chart-coming">
                    Real terms · % of GDP: {COMING}
                  </span>
                ) : null}
              </div>
            </section>
            <section aria-labelledby="h-table">
              <h2 id="h-table" className="panel-h">
                Table: every figure
              </h2>
              <StatusLegend only={present.length ? present : ["checked"]} />
              <SeriesTable series={series} />
            </section>
            <section aria-labelledby="h-sources">
              <h2 id="h-sources" className="panel-h">
                Sources
              </h2>
              <p className="small muted">The documents this series is read from, the pages, and how many of its checked figures come from each. Open a table to see it as printed.</p>
              <ul className="src-list">
                {sources.map((s) => (
                  <li key={s.sid}>
                    <Link href={sourceHref(s.sid)}>{s.src?.title ?? s.sid}</Link>
                    <span className="muted"> · {s.src?.publisher}</span>
                    <span className="src-n">
                      <Count k={`values:series:${series.series_id}:source:${s.sid}`} n={s.n} /> checked figures
                    </span>
                    <span className="src-pages">
                      Tables:{" "}
                      {[...s.pages.values()].map((p, i) => (
                        <span key={p.label + i}>
                          {i ? ", " : ""}
                          {p.href ? (
                            <Link href={p.href}>
                              <Num kind="page">{p.label}</Num>
                            </Link>
                          ) : (
                            <Num kind="page">{p.label}</Num>
                          )}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              {provincial ? <p className="coming">Map of the provinces: {COMING}</p> : null}
            </section>
            <section aria-labelledby="h-download">
              <h2 id="h-download" className="panel-h">
                Download
              </h2>
              <div className="action-row">
                <DownloadLink href={seriesCsvHref(series.series_id)} className="btn btn-primary">
                  CSV, one row per figure
                </DownloadLink>
                <DownloadLink href={`${DATA_BASE}/series/${slugify(series.series_id)}.json`}>JSON, with the series definition</DownloadLink>
                <Link className="btn btn-text" href="/data">
                  How the files are laid out
                </Link>
              </div>
              <p className="small">
                Each row carries its provenance: <code>obs_id</code>, the document and its official address, the SHA-256 fingerprint of the file, the page,
                the printed text and the checks. Gaps are rows too, with no value and the reason. Values are decimal strings: read them as text.
              </p>
            </section>
            <section aria-labelledby="h-cite">
              <h2 id="h-cite" className="panel-h">
                Cite
              </h2>
              <Cite path={path} what={`Series ${series.series_id}, ${series.name}`} heading={false} />
            </section>
          </Tabs>
        </div>

        <aside className="series-rail" aria-label="Related series">
          {parent ? <Related items={[parent]} label="Part of" /> : null}
          <Related items={children} label="Made up of" />
          <Related items={siblings.slice(0, 12)} label="Alongside it" />
          {siblings.length > 12 && parent ? (
            <p className="small">
              <Link href={seriesHref(parent.series_id)}>All lines under {parent.name}</Link>
            </p>
          ) : null}
        </aside>
      </div>

      {series.derived && series.derivation ? (
        <Callout kind="note" title="A computed series">
          <p>
            The government does not print these figures. They are computed by code from checked figures with <code data-num="id">{series.derivation.formula}</code>.
            Inputs:{" "}
            {series.derivation.inputs.map((i, n) => (
              <span key={i}>
                {n > 0 ? ", " : ""}
                {d.seriesById.has(i) ? <Link href={seriesHref(i)}>{d.seriesById.get(i)!.name}</Link> : <code>{i}</code>}
              </span>
            ))}
            .
          </p>
        </Callout>
      ) : null}
      {series.breaks.length > 1 ? (
        <Callout kind="caveat" title="This series has breaks">
          <ul className="caveat-list">
            {series.breaks.map((b) => (
              <li key={b.at_period + b.kind}>
                <strong>
                  From <Num kind="period">{periodWords(b.at_period, series.frequency)}</Num> ({b.kind.replaceAll("_", " ")}).
                </strong>{" "}
                {b.note}
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}
      {series.notes ? (
        <Callout kind="caveat">
          <p>{series.notes}</p>
        </Callout>
      ) : null}
      {series.dataset === "cpi" && !isOn("monthlyData") ? <p className="coming">This release holds the June issue of each year. Every month: {COMING}</p> : null}

      <details className="disclosure about-series">
        <summary>
          <span>About this series: definition, dimensions, search terms</span>
        </summary>
        <div className="disclosure-body">
          <dl className="facts">
            {defn ? (
              <>
                <dt>Definition</dt>
                <dd>{defn}</dd>
              </>
            ) : null}
            {Object.entries(series.dims ?? {})
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{k.replaceAll("_", " ")}</dt>
                  <dd>{String(v).replaceAll("_", " ")}</dd>
                </div>
              ))}
            {series.synonyms && series.synonyms.length > 0 ? (
              <>
                <dt>Also searched as</dt>
                <dd>{series.synonyms.join(", ")}</dd>
              </>
            ) : null}
            <dt>Series id</dt>
            <dd className="mono">
              <Num kind="id">{series.series_id}</Num>
            </dd>
          </dl>
        </div>
      </details>

      <div className="mobile-bar no-print" aria-label="Take this series">
        <DownloadLink href={seriesCsvHref(series.series_id)} className="btn btn-primary">
          Download CSV
        </DownloadLink>
        <a className="btn" href="?tab=cite#chart">
          Cite
        </a>
        <Link className="btn" href={`/compare?s=${encodeURIComponent(series.series_id)}`}>
          Compare
        </Link>
      </div>
    </article>
  );
}
