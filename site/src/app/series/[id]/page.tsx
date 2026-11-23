// A series: the "Dataset" screen of the v3 design set (2026-11-23), one skeleton
// for every series (abs budget, cpi monthly, lfs survey). Order:
//   1 breadcrumb: Find data / topic (or dataset) / series
//   2 the heading as a sentence: the plain title (editorial/titles.json, which
//     scripts/checks/titles.mjs requires first) and the latest figure, with its
//     document and page
//   3 the headline block: the figure big, "Printed as", the change in words;
//     beside it the facts (figure type, period, unit, source, checked, release)
//   4 tabs over server-rendered panels (components/Tabs.tsx, ?tab=; ?view= is
//     the chart's own): Chart, Table, Editions, Download, Cite. Without
//     JavaScript every panel is shown in order.
//   5 related datasets and the guide to read first (budget series only)
//   6 compare and share, the computed-series note, where it sits, About (the
//     printed name, definition, labels as printed, id)
// Every value links to its receipt. Derived figures are recomputed by
// scripts/checks/home-derived.mjs (the change in words, budget to revised) and
// series-derived.mjs (the chart's own computed views).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/Link";
import Tabs, { type TabDef } from "@/components/Tabs";
import { ActionBar, CompareButton, ShareButton } from "@/components/actions/Actions";
import { Breadcrumbs, Callout } from "@/components/ui/Basics";
import SeriesView from "@/components/series/SeriesView";
import { About, SourceLines, WhereItSits } from "@/components/series/Parts";
import { publishedSentence } from "@/components/series/Head";
import { CitePanel, Downloads, Editions, editionPeriods, HeadlineBlock, ReadFirst, Related, TitleSentence, YearTable } from "@/components/series/Dataset";
import { answerOf, hasBudgetPair, kindWordsOf, parentForShare, printedModels, unitOptions } from "@/components/series/model";
import { topicHref, topics } from "@/components/home/editorial";
import { datasetName, db, seriesCsvHref, seriesHref, slugify, visibleSeries, type Series } from "@/lib/data";
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

/** The first topic that lists this series or one of its parents; else its dataset. */
function crumbOf(series: Series): { href: string; label: string } {
  const ids = [series.series_id, ...ancestors(series).map((p) => p.series_id)];
  for (const id of ids) {
    const t = topics().find((t) => t.groups.some((g) => g.series.some((s) => s.series_id === id)) || t.headline.some((s) => s.series_id === id));
    if (t) return { href: topicHref(t.slug), label: t.name };
  }
  return { href: `/datasets/${series.dataset}`, label: datasetName(series.dataset) };
}

export default async function SeriesPage({ params }: Props) {
  const { id } = await params;
  const series = find(id);
  if (!series) notFound();
  const d = db();
  const path = seriesHref(series.series_id);
  const answer = answerOf(series);
  const printed = printedModels(series);
  const summary = seriesSummary(series);
  const all = d.obsBySeries.get(series.series_id) ?? [];
  const periods = [...new Set(all.map((o) => o.period))].sort();
  const inside = series.breaks.find((b) => periods.some((p) => p < b.at_period) && periods.some((p) => p >= b.at_period));
  // Real terms and % of GDP come from their feature flags. "Per person" has no flag yet; it stays "coming"
  // until a checked population series exists.
  const coming = series.unit === "PKR" ? [...(["realTerms", "percentOfGdp"] as FeatureKey[]).filter((k) => !isOn(k)).map((k) => feature(k).label), "Per person"] : [];
  const parent = parentForShare(series);
  const budget = hasBudgetPair(series);
  const noActual = budget && !all.some((o) => o.vintage === "actual" || o.vintage === "ac");
  const eds = editionPeriods(series);
  const tabs: TabDef[] = [
    { id: "chart", label: "Chart" },
    { id: "table", label: "Table" },
    ...(eds.length ? [{ id: "editions", label: "Editions" }] : []),
    { id: "download", label: "Download" },
    { id: "cite", label: "Cite" },
  ];

  return (
    <article className="sp ds">
      <Breadcrumbs items={[{ href: "/browse", label: "Find data" }, crumbOf(series), { label: seriesTitle(series) }]} />

      <header className="ds-top">
        <TitleSentence series={series} latest={answer.latest} />
        {summary ? <p className="ds-summary">{summary}</p> : null}
      </header>

      <HeadlineBlock series={series} answer={answer} />

      <div className="ds-tabs">
        <Tabs tabs={tabs} label="Views of this series">
          <section className="ds-sec" aria-labelledby="h-chart">
            <div className="ds-sec-head">
              <h2 id="h-chart" className="ds-h2">
                {budget ? (noActual ? "Budget and revised estimates, by year" : "Budget, revised and actual, by year") : "Over time"}
              </h2>
              <p className="ds-sub">{budget ? "Each kind of figure is its own line: a budget estimate and its revised estimate are never joined into one." : "Each point is a printed figure; a gap in the line is a period with no figure in this release."}</p>
            </div>
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
              defaultView={budget ? "kind" : "best"}
            />
            <p className="ds-note">
              {noActual ? "Actual figures: not in this release. " : ""}
              {publishedSentence(series)}
              {coming.length ? ` Not in this release yet: ${coming.join(", ").toLowerCase().replace("% of gdp", "% of GDP")}.` : ""}
            </p>
          </section>
          <YearTable series={series} model={printed.kind} />
          {eds.length ? <Editions series={series} periods={eds} /> : null}
          <Downloads series={series} />
          <CitePanel series={series} latest={answer.latest} path={path} />
        </Tabs>
      </div>

      <div className="ds-after">
        <Related series={series} />
        <ReadFirst series={series} />
      </div>

      <ActionBar label="Take this series">
        <CompareButton seriesId={series.series_id} />
        <ShareButton path={path} />
      </ActionBar>

      <div className="ds-lower">
        <div className="ds-lower-main">
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
        </div>
        <div className="ds-lower-side">
          <About series={series} csv={seriesCsvHref(series.series_id)} />
        </div>
      </div>
    </article>
  );
}
