// A series (DESIGN.md 9.5), one skeleton for every series. Phone order:
//   1 title (the plain title, editorial/titles.json), the printed name as a grey
//     second line, a one-sentence summary (the definition and the printed row labels are in About)
//   2 the answer line: latest checked value, kind, period, the change against
//     the comparable figure, the source marker
//   3 the chart, with the view switch, Units and range chips above it and the
//     source lines inside its frame (components/series/SeriesView)
//   4 the action bar (Download, Cite, Compare, Share)
//   5 the table, wide by kind of figure, newest first
//   6 About this series, 7 Where it sits (a side column on wide screens)
// Every value links to its receipt; every derived figure is recomputed by
// scripts/checks/series-derived.mjs. The number, chart, table and CSV link
// work without JavaScript.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/Link";
import Cite from "@/components/Cite";
import { ActionBar, CiteButton, CompareButton, DownloadButton, ShareButton } from "@/components/actions/Actions";
import { Breadcrumbs, Callout } from "@/components/ui/Basics";
import SeriesView from "@/components/series/SeriesView";
import { About, AnswerLine, KindTable, SourceLines, WhereItSits } from "@/components/series/Parts";
import { answerOf, kindWordsOf, parentForShare, printedModels, unitOptions } from "@/components/series/model";
import { datasetName, db, seriesCsvHref, seriesHref, slugify, visibleSeries } from "@/lib/data";
import { COMING, feature, isOn, type FeatureKey } from "@/lib/features";
import { periodWords, unitLabel } from "@/lib/format";
import { ancestors } from "@/lib/stats";
import { printedLine, seriesSummary, seriesTitle } from "@/lib/titles";

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
  const printedName = printedLine(series);
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
        <h1>{seriesTitle(series)}</h1>
        {printedName ? (
          <p className="sp-printed">
            <span className="sr-only">Printed name: </span>
            <span>{printedName}</span>
          </p>
        ) : null}
        {summary ? <p className="sp-def sp-summary">{summary}</p> : null}
      </header>

      <div className="sp-top">
          <AnswerLine series={series} answer={answer} />
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
          {coming.length ? (
            <p className="coming sp-coming">
              {coming.join(", ")}: {COMING}
            </p>
          ) : null}
          {series.dataset === "cpi" && !isOn("monthlyData") ? <p className="coming sp-coming">This release holds the June issue of each year. Every month: {COMING}</p> : null}
      </div>

      <div className="sp-grid">
        <div className="sp-main">

          <ActionBar label="Take this series">
            <DownloadButton seriesId={series.series_id} />
            <CiteButton path={path} />
            <CompareButton seriesId={series.series_id} />
            <ShareButton path={path} />
          </ActionBar>

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

          <section className="sp-cite" id="cite" aria-labelledby="h-cite">
            <h2 id="h-cite">Cite this series</h2>
            <Cite path={path} what={`Series ${series.series_id}, ${series.name}`} heading={false} />
          </section>
        </div>

        <aside className="sp-side" aria-label="About this series and where it sits">
          <About series={series} csv={seriesCsvHref(series.series_id)} />
          <WhereItSits series={series} />
        </aside>
      </div>
    </article>
  );
}
