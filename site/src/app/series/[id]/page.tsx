// A series: what it measures, its chart, every figure with its status, and
// how to take it away.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cite from "@/components/Cite";
import SeriesChart from "@/components/SeriesChart";
import SeriesTable from "@/components/SeriesTable";
import { Breadcrumbs, Callout, DownloadLink, Toc } from "@/components/ui/Basics";
import CopyButton from "@/components/ui/CopyButton";
import { StatusLegend } from "@/components/ui/Status";
import { buildChart } from "@/lib/chart";
import { DATA_BASE, datasetName, db, seriesCsvHref, seriesHref, slugify, visibleSeries, type Series } from "@/lib/data";
import { DOC_TYPE_WORDS, formatDecimalString, periodWords, unitLabel, vintageWords } from "@/lib/format";
import { statusOf, type StatusKey } from "@/lib/status";

export const dynamicParams = false;

export function generateStaticParams() {
  return visibleSeries().map((s) => ({ id: slugify(s.series_id) }));
}

type Props = { params: Promise<{ id: string }> };

function find(id: string) {
  const d = db();
  return d.seriesBySlug.get(id) ?? d.seriesBySlug.get(decodeURIComponent(id));
}

const FREQ: Record<string, string> = { fiscal_year: "Fiscal year (July to June)", month: "Monthly", survey_round: "Survey round", year: "Calendar year", quarter: "Quarterly" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = find((await params).id);
  if (!s) return { title: "Series" };
  return { title: s.name, description: `${s.definition ?? s.name}. Every figure links to the page of the government document it was read from.` };
}

function SeriesList({ items, label }: { items: Series[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2>{label}</h2>
      <ul className="nb-list">
        {items.map((c) => {
          const n = (db().obsBySeries.get(c.series_id) ?? []).filter((o) => o.published).length;
          return (
            <li key={c.series_id}>
              <Link href={seriesHref(c.series_id)} className="nb">
                <span className="nb-k">{c.name}</span>
                <span className="nb-v small">{n}</span>
              </Link>
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
  const parent = series.parent_id ? d.seriesById.get(series.parent_id) : undefined;
  const children = (d.childrenOf.get(series.series_id) ?? []).filter((c) => !c.derived);
  const siblings = parent ? (d.childrenOf.get(parent.series_id) ?? []).filter((c) => !c.derived && c.series_id !== series.series_id) : [];
  const share = d.seriesById.get(`${series.series_id}.share_of_total`);
  const shareUsable = share && share.unit === "percent" && share.derived ? share : null;
  const path = seriesHref(series.series_id);
  const unit = unitLabel(series.unit, series.scale_factor);
  const all = d.obsBySeries.get(series.series_id) ?? [];
  const counts = new Map<StatusKey, number>();
  for (const o of all) {
    const k = statusOf(o).key;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const pub = all.filter((o) => o.published && o.value !== null);
  const periods = [...new Set(all.map((o) => o.period))].sort();
  const latest = [...pub].sort((a, b) => b.period.localeCompare(a.period) || (a.vintage === "re" ? -1 : 1))[0];
  const docTypes = [...new Set((series.source_doc_types ?? []).map((t) => DOC_TYPE_WORDS[t] ?? t))];
  const present = [...counts.keys()].filter((k) => k !== "unknown") as Exclude<StatusKey, "unknown">[];
  const dims = Object.entries(series.dims ?? {}).filter(([, v]) => v);

  return (
    <article className="series-page">
      <Breadcrumbs
        items={[
          { href: "/browse", label: "Browse" },
          { href: `/browse?dataset=${series.dataset}`, label: datasetName(series.dataset) },
          ...(parent ? [{ href: seriesHref(parent.series_id), label: parent.name }] : []),
          { label: series.name },
        ]}
      />
      <header className="page-head series-head">
        <p className="kicker">{datasetName(series.dataset)} · series</p>
        <h1>{series.name}</h1>
        <p className="series-meta">
          <span>{unit}</span>
          <span>{FREQ[series.frequency] ?? series.frequency.replaceAll("_", " ")}</span>
          {periods.length ? (
            <span>
              {periodWords(periods[0], series.frequency)} to {periodWords(periods[periods.length - 1], series.frequency)}
            </span>
          ) : null}
          <span>
            {counts.get("checked") ?? 0} checked {counts.get("checked") === 1 ? "figure" : "figures"}
            {all.length - (counts.get("checked") ?? 0) > 0 ? `, ${all.length - (counts.get("checked") ?? 0)} without a value` : ""}
          </span>
        </p>
        {series.definition ? (
          <p className="lede">
            {series.definition}
            {series.definition_status && series.definition_status !== "reviewed" ? <span className="draft-mark"> Draft definition, not yet reviewed by a person.</span> : null}
          </p>
        ) : null}
        {latest ? (
          <p className="series-latest">
            Latest checked figure:{" "}
            <Link href={`/o/${slugify(latest.obs_id)}`} className="v-link tnum">
              {formatDecimalString(latest.value)} {unit}
            </Link>{" "}
            <span className="muted">
              ({periodWords(latest.period, series.frequency)}
              {latest.vintage !== "na" ? `, ${vintageWords(latest.vintage).toLowerCase()}` : ""})
            </span>
          </p>
        ) : null}
        <div className="action-row no-print">
          <DownloadLink href={seriesCsvHref(series.series_id)} className="btn btn-primary">
            Download CSV
          </DownloadLink>
          <DownloadLink href={`${DATA_BASE}/series/${slugify(series.series_id)}.json`}>JSON</DownloadLink>
          <CopyButton text={path} origin label="Copy link" />
          <Link className="btn" href={`/compare?s=${encodeURIComponent(series.series_id)}`}>
            Compare with…
          </Link>
          <a className="btn btn-text" href="#cite">
            Cite
          </a>
        </div>
      </header>

      {series.derived && series.derivation ? (
        <Callout kind="note" title="A computed series">
          <p>
            The government does not print these figures. They are computed by code from checked figures with <code>{series.derivation.formula}</code>.
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
      {series.breaks.length > 0 ? (
        <Callout kind="caveat" title={series.breaks.length === 1 ? "This series has a break" : "This series has breaks"}>
          <ul className="caveat-list">
            {series.breaks.map((b) => (
              <li key={b.at_period + b.kind}>
                <strong>
                  From {periodWords(b.at_period, series.frequency)} ({b.kind.replaceAll("_", " ")}).
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

      <div className="with-rail">
        <div className="series-body">
          <section id="chart" aria-labelledby="chart-h">
            <h2 id="chart-h" className="sr-only">
              Chart
            </h2>
            <SeriesChart
              amount={buildChart(series)}
              share={shareUsable ? buildChart(shareUsable) : null}
              amountLabel={series.unit === "PKR" ? "Amount" : "Value"}
              shareLabel="Share of total federal expenditure"
            />
            <p className="chart-notes">
              Lines join neighbouring periods only and stop at gaps and breaks. Periods without a value are marked under the axis with their status. The
              table below lists every figure, so it is also the text version of this chart.
            </p>
          </section>

          <section id="data" aria-labelledby="data-h">
            <h2 id="data-h">Every figure</h2>
            <StatusLegend only={present.length ? present : ["checked"]} />
            <SeriesTable series={series} />
          </section>

          <section id="cite" aria-labelledby="cite-h">
            <h2 id="cite-h">Cite this series</h2>
            <Cite path={path} what={`Series ${series.series_id}, ${series.name}`} heading={false} />
          </section>
        </div>

        <aside className="rail" aria-label="About this series">
          <Toc
            items={[
              { id: "chart", label: "Chart" },
              { id: "data", label: "Every figure" },
              { id: "cite", label: "Cite" },
            ]}
          />
          <section>
            <h2>About this series</h2>
            <dl className="facts rail-facts">
              <dt>Unit</dt>
              <dd>{unit}</dd>
              <dt>Frequency</dt>
              <dd>{FREQ[series.frequency] ?? series.frequency}</dd>
              {dims.map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{k.replaceAll("_", " ")}</dt>
                  <dd>{String(v).replaceAll("_", " ")}</dd>
                </div>
              ))}
              {docTypes.length ? (
                <>
                  <dt>Printed in</dt>
                  <dd>{docTypes.join("; ")}</dd>
                </>
              ) : null}
              <dt>Series id</dt>
              <dd className="mono">{series.series_id}</dd>
              {series.synonyms && series.synonyms.length > 0 ? (
                <>
                  <dt>Also searched as</dt>
                  <dd>{series.synonyms.join(", ")}</dd>
                </>
              ) : null}
            </dl>
          </section>
          {parent ? <SeriesList items={[parent]} label="Part of" /> : null}
          <SeriesList items={children} label={`Made up of (${children.length})`} />
          <SeriesList items={siblings.slice(0, 16)} label="Alongside it" />
        </aside>
      </div>
    </article>
  );
}
