// A worked example: a short piece of analysis in which every figure links to
// its receipt and every caveat is stated where it applies. All numbers are
// read from the release; the sentences adapt to what the release holds.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import Cite from "@/components/Cite";
import SeriesChart from "@/components/SeriesChart";
import { Breadcrumbs, Callout } from "@/components/ui/Basics";
import { buildChart } from "@/lib/chart";
import { datasetName, db, isDatasetPublished, obsHref, publishedObs, seriesHref, visibleSeries, type Observation, type Series } from "@/lib/data";
import { figureWords, formatDecimalString, humanAmount, periodWords, vintageWords } from "@/lib/format";

export const metadata: Metadata = {
  title: "Worked example: health and jobs",
  description: "A short analysis built from the portal: federal health spending across the devolution break, prices, and the labour market. Every figure links to its receipt.",
};

/* ------------------------------------------------------------------------
 * DEMO CONFIG. The only place where this page decides which series to show.
 * A slot takes the series whose id is `id`, if the release has it and its
 * dataset is published; otherwise the slot says so. Adjust ids here if the
 * release names series differently.
 * ---------------------------------------------------------------------- */
const DEMO = {
  health: "fed.exp.current.function.health",
  healthShare: "fed.exp.current.function.health.share_of_total",
  prices: "cpi.national.yoy.general",
  pricesIndex: "cpi.national.general.b2015_16",
  unemployment: "lfs.unemployment_rate.total.total",
  unemploymentFemale: "lfs.unemployment_rate.female.total",
  participation: "lfs.lfpr_refined.total.total",
} as const;
/* ---------------------------------------------------------------------- */

function get(id: string): Series | undefined {
  const s = db().seriesById.get(id);
  return s && isDatasetPublished(s.dataset) && publishedObs(s.series_id).length > 0 ? s : undefined;
}

/** Observations of the series' most common estimate type, oldest first. */
function mainLine(s: Series, vintage?: string): Observation[] {
  const pub = publishedObs(s.series_id);
  const counts = new Map<string, number>();
  for (const o of pub) counts.set(o.vintage, (counts.get(o.vintage) ?? 0) + 1);
  const v = vintage ?? [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  return pub.filter((o) => o.vintage === v).sort((a, b) => a.period.localeCompare(b.period));
}

/** A figure in the text: the value with its unit in words, linked to its receipt. */
function Fig({ o, s, human }: { o: Observation; s: Series; human?: boolean }) {
  return (
    <Link href={obsHref(o.obs_id)} className="fig-link" title={`${s.name}, ${periodWords(o.period, s.frequency)}${o.vintage !== "na" ? `, ${vintageWords(o.vintage).toLowerCase()}` : ""}. Open the receipt.`}>
      {figureWords(o.value, o.unit, o.scale_factor)}
      {human && o.unit === "PKR" ? <span className="fig-human"> (about {humanAmount(Number(o.value), o.unit, o.scale_factor)})</span> : null}
    </Link>
  );
}

function Missing({ what, dataset }: { what: string; dataset: string }) {
  return (
    <Callout kind="caveat" title={`${what}: not in this release`}>
      <p>
        {isDatasetPublished(dataset)
          ? "The release has no checked values for this series yet, so there is nothing to say in numbers."
          : `${datasetName(dataset)} is not published in this release, so this section has no numbers. We show nothing rather than unverified figures.`}
      </p>
    </Callout>
  );
}

export default function DemoPage() {
  const d = db();
  const health = get(DEMO.health);
  const share = get(DEMO.healthShare);
  const prices = get(DEMO.prices);
  const pricesIndex = get(DEMO.pricesIndex);
  const unemp = get(DEMO.unemployment);
  const unempF = get(DEMO.unemploymentFemale);
  const lfpr = get(DEMO.participation);

  /* ---- health ---- */
  let healthText: ReactNode = null;
  if (health) {
    const be = mainLine(health, "be");
    const last = be[be.length - 1];
    const first = be[0];
    const brk = health.breaks.find((b) => first && last && first.period < b.at_period && b.at_period <= last.period);
    const afterBreak = brk ? be.find((o) => o.period >= brk.at_period) : undefined;
    const beforeBreak = brk ? [...be].reverse().find((o) => o.period < brk.at_period) : undefined;
    const lastShare = share && last ? publishedObs(share.series_id).find((o) => o.period === last.period && o.vintage === last.vintage) : undefined;
    const re = mainLine(health, "re");
    const lastRe = re[re.length - 1];
    const src = last?.primary_cell_id ? d.sourceById.get(d.cellById.get(last.primary_cell_id)?.source_id ?? "") : undefined;
    healthText = last ? (
      <>
        <p>
          The federal government budgeted <Fig o={last} s={health} human /> for current spending on health in {periodWords(last.period)}
          {src ? <>, according to the {src.title}</> : null}.
          {lastShare && share ? (
            <>
              {" "}
              That is <Fig o={lastShare} s={share} /> of total federal expenditure in the same column of the same document.
            </>
          ) : null}
          {lastRe ? (
            <>
              {" "}
              The latest revised estimate, printed a year later, is <Fig o={lastRe} s={health} /> for {periodWords(lastRe.period)}.
            </>
          ) : null}
        </p>
        {brk && beforeBreak && afterBreak ? (
          <p>
            The budget estimate goes from <Fig o={beforeBreak} s={health} /> in {beforeBreak.period} to <Fig o={afterBreak} s={health} /> in{" "}
            {afterBreak.period}, but the series breaks in between: {brk.note.charAt(0).toLowerCase() + brk.note.slice(1)} The chart does not join the
            lines across the break.
          </p>
        ) : null}
      </>
    ) : null;
  }

  /* ---- prices ---- */
  let pricesText: ReactNode = null;
  if (prices) {
    const line = mainLine(prices);
    const last = line[line.length - 1];
    const lastIdx = pricesIndex ? mainLine(pricesIndex).find((o) => o.period === last?.period) : undefined;
    const prevYear = last ? line.find((o) => o.period === `${Number(last.period.slice(0, 4)) - 1}${last.period.slice(4)}`) : undefined;
    pricesText = last ? (
      <p>
        Consumer prices in {periodWords(last.period, prices.frequency)} were <Fig o={last} s={prices} /> higher than a year earlier, by the national
        Consumer Price Index{prevYear ? <> (the same comparison a year before gave <Fig o={prevYear} s={prices} />)</> : null}.
        {lastIdx && pricesIndex ? (
          <>
            {" "}
            The index itself stood at <Fig o={lastIdx} s={pricesIndex} />, against 100 for the average of 2015-16.
          </>
        ) : null}{" "}
        This release reads the May and June figures printed in each June issue, so the chart shows those months only; the months in between are not
        missing data, they are not in the documents read.
      </p>
    ) : null;
  }

  /* ---- jobs ---- */
  let jobsText: ReactNode = null;
  if (unemp) {
    const line = mainLine(unemp);
    const last = line[line.length - 1];
    const fLast = unempF ? mainLine(unempF).find((o) => o.period === last?.period) : undefined;
    const pLast = lfpr ? mainLine(lfpr).find((o) => o.period === last?.period) : undefined;
    const brk = unemp.breaks.find((b) => last && b.at_period <= last.period);
    jobsText = last ? (
      <>
        <p>
          The Labour Force Survey for {last.period} puts unemployment at <Fig o={last} s={unemp} /> of the labour force
          {fLast && unempF ? (
            <>
              ; for women it is <Fig o={fLast} s={unempF} />
            </>
          ) : null}
          .
          {pLast && lfpr ? (
            <>
              {" "}
              <Fig o={pLast} s={lfpr} /> of people aged 10 and over were in the labour force (the refined participation rate).
            </>
          ) : null}
        </p>
        {brk ? (
          <p>
            Read the latest round with care: {brk.note.charAt(0).toLowerCase() + brk.note.slice(1)}. The chart marks it as a break and does not join the
            lines across it.
          </p>
        ) : null}
      </>
    ) : null;
  }

  return (
    <article className="demo">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Worked example" }]} />
      <header className="page-head demo-head">
        <p className="kicker">Worked example</p>
        <h1>Health, prices and jobs: what the documents say</h1>
        <p className="lede">
          A short piece of analysis written only from the current release. Every figure in the text is a link to its receipt, where you can see it boxed
          on the government page; every chart point is too.
        </p>
      </header>

      <section aria-labelledby="h-health" className="demo-section">
        <h2 id="h-health">Federal spending on health</h2>
        {health ? (
          <>
            {healthText}
            <Callout kind="caveat" title="What this line measures">
              <p>
                Current expenditure on revenue account only, as printed in the Summary of Expenditure of each Annual Budget Statement. It leaves out
                federal development spending on health and all provincial spending. Amounts are in current rupees, not adjusted for inflation.
              </p>
            </Callout>
            <SeriesChart amount={buildChart(health)} share={share ? buildChart(share) : null} amountLabel="Amount" shareLabel="Share of federal expenditure" />
            <p className="small">
              <Link href={seriesHref(health.series_id)}>Open the series: chart, every figure and downloads</Link>
            </p>
          </>
        ) : (
          <Missing what="Federal health spending" dataset="abs" />
        )}
      </section>

      <section aria-labelledby="h-prices" className="demo-section">
        <h2 id="h-prices">Prices</h2>
        {prices ? (
          <>
            {pricesText}
            <SeriesChart amount={buildChart(prices)} amountLabel="Change" />
            <p className="small">
              <Link href={seriesHref(prices.series_id)}>Open the series</Link>
              {pricesIndex ? (
                <>
                  {" "}
                  · <Link href={seriesHref(pricesIndex.series_id)}>the index levels</Link>
                </>
              ) : null}
            </p>
          </>
        ) : (
          <Missing what="Consumer prices" dataset="cpi" />
        )}
      </section>

      <section aria-labelledby="h-jobs" className="demo-section">
        <h2 id="h-jobs">Jobs</h2>
        {unemp ? (
          <>
            {jobsText}
            <SeriesChart amount={buildChart(unemp)} amountLabel="Rate" />
            <p className="small">
              <Link href={seriesHref(unemp.series_id)}>Open the series</Link>
              {lfpr ? (
                <>
                  {" "}
                  · <Link href={seriesHref(lfpr.series_id)}>participation rate</Link>
                </>
              ) : null}
            </p>
          </>
        ) : (
          <Missing what="Unemployment" dataset="lfs" />
        )}
      </section>

      <section aria-labelledby="h-how" className="demo-section">
        <h2 id="h-how">How this page was written</h2>
        <p>
          The sentences are templates filled from the release: no number on this page was typed by hand, and none was produced by a language model. If
          a figure in a later release changes, this page changes with it, and the old figure stays citable in the old release.{" "}
          {formatDecimalString(String(visibleSeries().length))} series are available to do the same; <Link href="/browse">browse them</Link>.
        </p>
        <Cite path="/demo/health-and-jobs" />
      </section>
    </article>
  );
}
