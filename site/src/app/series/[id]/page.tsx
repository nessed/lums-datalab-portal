// A series (DESIGN.md 9.5, round 2), one skeleton for every series. Phone order:
//   1 title (the plain title, editorial/titles.json) with the series id beside it,
//     a one-sentence summary, the fact pills (period covered, how often it is
//     published, latest figure, next expected, source, checked, release)
//   2 the headline block: the latest checked figure big, a plain sentence, the
//     change in words with an arrow, "See it on the printed page"
//   3 the chart, with its controls and the source lines inside its frame
//   4 related series with sparklines (a rail beside the chart on wide screens)
//   5 the action bar, the table by kind of figure, where it sits, citation
//   6 About this series (the printed name, definition, labels as printed, id)
// Every value links to its receipt; derived figures are recomputed by
// scripts/checks/series-derived.mjs (data-op) and home-derived.mjs (the change
// in words). The number, chart, table and CSV link work without JavaScript.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/Link";
import Cite from "@/components/Cite";
import { ActionBar, CiteButton, CompareButton, DownloadButton, ShareButton } from "@/components/actions/Actions";
import { Breadcrumbs, Callout } from "@/components/ui/Basics";
import { Panel } from "@/components/ui/Card";
import SeriesId from "@/components/ui/SeriesId";
import SeriesView from "@/components/series/SeriesView";
import { About, KindTable, SourceLines, WhereItSits } from "@/components/series/Parts";
import { Headline, publishedSentence, RelatedRail, SeriesFacts } from "@/components/series/Head";
import { answerOf, kindWordsOf, parentForShare, printedModels, unitOptions } from "@/components/series/model";
import { datasetName, db, seriesCsvHref, seriesHref, slugify, visibleSeries } from "@/lib/data";
import { feature, isOn, type FeatureKey } from "@/lib/features";
import { periodWords, unitLabel } from "@/lib/format";
import { ancestors } from "@/lib/stats";
import { seriesSummary, seriesTitle } from "@/lib/titles";

export const dynamicParams = false;

export function generateStaticParams() {
  return visibleSeries().map((s) => ({ id: slugify(s.series_id) }));
}

type Props = { params: Promise<{ id: string }> };

function find(id: string) {
  const d = db();
  return d.seriesBySlug.get(id) ?? d.seriesBySlug.get(decodeURIComponent(id));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = find((await params).id);
  if (!s) return { title: "Series" };
  return { title: seriesTitle(s), description: `${seriesSummary(s) ?? s.definition ?? s.name} Every figure links to the page of the government document it was read from.` };
}

export default async function SeriesPage({ params }: Props) {
  const { id } = await params;
  const series = find(id);
  if (!series) notFound();
  const d = db();
  const path = seriesHref(series.series_id);
  const parents = ancestors(series);
  const answer = answerOf(series);
  const printed = printedModels(series);
  const summary = seriesSummary(series);
  const all = d.obsBySeries.get(series.series_id) ?? [];
  const periods = [...new Set(all.map((o) => o.period))].sort();
  const inside = series.breaks.find((b) => periods.some((p) => p < b.at_period) && periods.some((p) => p >= b.at_period));
  // Real terms and % of GDP come from their feature flags. "Per person" has no flag yet (adding one touches the
  // Releases page, outside this lane); it stays "coming" until a checked population series exists.
  const coming = series.unit === "PKR" ? [...(["realTerms", "percentOfGdp"] as FeatureKey[]).filter((k) => !isOn(k)).map((k) => feature(k).label), "Per person"] : [];
  const parent = parentForShare(series);

  return (
    <article className="sp">
      <Breadcrumbs
        items={[
          { href: "/browse", label: "Data" },
          { href: `/datasets/${series.dataset}`, label: datasetName(series.dataset) },
          ...[...parents].reverse().slice(-1).map((p) => ({ href: seriesHref(p.series_id), label: seriesTitle(p) })),
          { label: seriesTitle(series) },
        ]}
      />
      <header className="sp-head">
        <div className="sp-titlerow">
          <h1>{seriesTitle(series)}</h1>
          <SeriesId id={series.series_id} className="sp-id" />
        </div>
        {summary ? <p className="sp-summary">{summary}</p> : null}
        <SeriesFacts series={series} latest={answer.latest} />
      </header>

      <div className="sp-top">
        <div className="sp-numcol">
          <Headline series={series} answer={answer} />
        </div>
        <Panel className="sp-chart" label="Chart">
          <SeriesView
            slug={slugify(series.series_id)}
            series={{ series_id: series.series_id, name: seriesTitle(series), frequency: series.frequency, unit: series.unit, scale_factor: series.scale_factor, breaks: series.breaks }}
            printed={printed}
            units={unitOptions(series)}
            coming={coming}
            kindWords={kindWordsOf(series)}
            unitWords={unitLabel(series.unit, series.scale_factor)}
            parentName={parent ? seriesTitle(parent) : null}
            breakFrom={inside ? { at: inside.at_period, label: periodWords(inside.at_period, series.frequency) } : null}
            frame={<SourceLines series={series} path={path} />}
          />
          <p className="sp-release-note small">
            {publishedSentence(series)}
            {coming.length ? ` Not in this release yet: ${coming.join(", ").toLowerCase().replace("% of gdp", "% of GDP")}.` : ""}
          </p>
        </Panel>
        <aside className="sp-railcol" aria-label="Related series">
          <RelatedRail series={series} />
        </aside>
      </div>

      <ActionBar label="Take this series">
        <DownloadButton seriesId={series.series_id} />
        <CiteButton path={path} />
        <CompareButton seriesId={series.series_id} />
        <ShareButton path={path} />
      </ActionBar>

      <div className="sp-lower">
        <div className="sp-main">
          <KindTable series={series} />

          {series.derived && series.derivation ? (
            <Callout kind="note" title="A computed series">
              <p>
                The government does not print these figures. They are computed by code from checked figures with <code data-num="id">{series.derivation.formula}</code>.
                Inputs:{" "}
                {series.derivation.inputs.map((i, n) => (
                  <span key={i}>
                    {n > 0 ? ", " : ""}
                    {d.seriesById.has(i) ? <Link href={seriesHref(i)}>{seriesTitle(d.seriesById.get(i)!)}</Link> : <code data-num="id">{i}</code>}
                  </span>
                ))}
                .
              </p>
            </Callout>
          ) : null}

          <WhereItSits series={series} />

          <details className="sp-cite" id="cite">
            <summary>
              <h2 id="h-cite">Cite this series</h2>
            </summary>
            <Cite path={path} what={`Series ${series.series_id}, ${series.name}`} heading={false} />
          </details>
        </div>

        <div className="sp-side">
          <About series={series} csv={seriesCsvHref(series.series_id)} />
        </div>
      </div>
    </article>
  );
}
