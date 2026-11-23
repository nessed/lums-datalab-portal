// The inflation calculator (2026-11-23, Inflation Calculator design). The design
// was a picture, not a data source: its index values, months and pages were
// placeholders and none is used. Every figure here is read from the release:
//   - the h1: the latest checked national inflation rate, with its page;
//   - the calculator: the national consumer price index, base 2015-16, for every
//     month the release holds in every year (June); no month before the base is
//     offered, since earlier issues print a different index (2007-08 = 100);
//   - the default result (Rs 1,000 from the earliest June to the latest), a
//     derived figure claimed and recomputed by scripts/checks/calc-inflation.mjs;
//   - the table of every index value used, each linked to its receipt and page.
// The form (components/pages/InflationCalc.tsx) recalculates in the browser for
// a reader's own amount, from the same values, with the same exact function.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import { Breadcrumbs } from "@/components/ui/Basics";
import { Num, V } from "@/components/ui/Num";
import { showable, usable } from "@/components/home/derive";
import InflationCalc, { type CalcPoint, type CalcSlot } from "@/components/pages/InflationCalc";
import { PageRef } from "@/components/pages/PageRef";
import { db, isDatasetPublished, seriesHref, type Observation, type Series } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { seriesTitle } from "@/lib/titles";

export const metadata: Metadata = {
  title: "Inflation calculator",
  description: "What a past amount of rupees is worth today, worked out from Pakistan's consumer price index as the statistics bureau prints it, with every index value linked to its page.",
};

/** The index the calculator uses, and the rate the heading quotes. */
const INDEX = "cpi.national.general.b2015_16";
const RATE = "cpi.national.yoy.general";
/** The reading month: the one month the release holds for every year (AGENTS.md: CPI June issues). */
const MONTH = "06";
const DEFAULT_AMOUNT = "1000";

function shown(id: string): Series | null {
  const s = db().seriesById.get(id);
  return s && isDatasetPublished(s.dataset) ? s : null;
}

const P = (p: string, s: Pick<Series, "frequency">) => <Num kind="period">{periodWords(p, s.frequency)}</Num>;

function Heading({ rate }: { rate: Series | null }) {
  const o = rate ? (db().obsBySeries.get(rate.series_id) ?? []).filter(showable).sort((a, b) => a.period.localeCompare(b.period)).pop() : undefined;
  if (!rate || !o) return <h1 className="pg-h1 ic-h1">Inflation calculator</h1>;
  const v = o.value!.trim();
  const neg = v.startsWith("-");
  const zero = /^[+-]?0+(\.0+)?$/.test(v);
  const src = (
    <span className="ic-h1-src">
      {" "}
      (<PageRef o={o} />)
    </span>
  );
  if (zero)
    return (
      <h1 className="pg-h1 ic-h1">
        Prices in Pakistan did not change over the year to {P(o.period, rate)}
        {src}.
      </h1>
    );
  return (
    <h1 className="pg-h1 ic-h1">
      {neg ? (
        <>
          Prices in Pakistan fell over the year to {P(o.period, rate)}, a change of <V o={o} sheet className="v-link" />%
        </>
      ) : (
        <>
          Prices in Pakistan rose <V o={o} sheet className="v-link" />% in the year to {P(o.period, rate)}
        </>
      )}
      {src}.
    </h1>
  );
}

export default function InflationCalculatorPage() {
  const s = shown(INDEX);
  const rate = shown(RATE);
  const points: Observation[] = s
    ? (db().obsBySeries.get(s.series_id) ?? [])
        .filter((o) => usable(o) && o.period.slice(5) === MONTH)
        .sort((a, b) => a.period.localeCompare(b.period))
    : [];
  const ok = !!s && points.length >= 2;
  const first = points[0];
  const last = points[points.length - 1];
  const years = points.map((o) => Number(o.period.slice(0, 4)));
  const everyYear = years.every((y, i) => i === 0 || y === years[i - 1] + 1);
  const base = s?.dims?.base_year ? String(s.dims.base_year) : null;
  // An earlier index of the same kind on another base (never joined to this one).
  const older = s
    ? db().series.find(
        (x) => x.series_id !== s.series_id && isDatasetPublished(x.dataset) && x.dataset === s.dataset && x.dims?.measure === "index" && x.dims?.group === s.dims?.group && x.dims?.base_year && x.dims.base_year !== s.dims?.base_year,
      )
    : undefined;
  const publisher = first?.primary_cell_id ? db().sourceById.get(db().cellById.get(first.primary_cell_id)?.source_id ?? "")?.publisher : undefined;

  const calcPoints: CalcPoint[] = points.map((o) => ({ key: o.obs_id, label: periodWords(o.period, s!.frequency), value: o.value! }));
  const slots: Record<string, CalcSlot> = {};
  for (const o of points) slots[o.obs_id] = { idx: <V o={o} sheet className="v-link" />, page: <PageRef o={o} doc={false} /> };

  let limits: ReactNode = null;
  if (ok)
    limits = (
      <>
        {everyYear ? (
          <>
            June of each year only: the one month this release holds for every year from {P(first.period, s!)} to {P(last.period, s!)}.
          </>
        ) : (
          <>June of the years in the table below only.</>
        )}{" "}
        {older?.dims?.base_year ? (
          <>
            Earlier price reviews print the index on another base (<Num kind="period">{String(older.dims.base_year)}</Num> = <Num kind="ui">100</Num>), a different series that is
            not joined to this one, so no month before {P(first.period, s!)} is offered.
          </>
        ) : null}
      </>
    );

  return (
    <div className="pg ic">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/topics/prices", label: "Prices" }, { label: "Inflation calculator" }]} />
      <Heading rate={rate} />

      <div className="ic-grid">
        <section className="ic-main" aria-labelledby="ic-calc-h">
          <h2 id="ic-calc-h" className="pg-h2 ic-h2">
            What is a past amount worth today?
          </h2>
          {ok ? (
            <>
              <InflationCalc points={calcPoints} slots={slots} defaultAmount={DEFAULT_AMOUNT} defaultFrom={first.obs_id} defaultTo={last.obs_id} />
              <noscript>
                <p className="ic-note">This example is worked out when the site is built. To try your own amount and months, turn on JavaScript; every index value is in the table below.</p>
              </noscript>
            </>
          ) : (
            <p className="ic-note">The release does not yet hold two checked values of the price index, so nothing can be worked out.</p>
          )}
          <p className="ic-note">An average for the whole country, worked out from the price index; not the change in your own costs.</p>
        </section>

        {s ? (
          <aside className="ic-aside" aria-labelledby="ic-how-h">
            <h2 id="ic-how-h" className="pg-h2 ic-h2">
              How it is worked out
            </h2>
            <dl className="ic-dl">
              <dt>Index</dt>
              <dd>
                <Link href={seriesHref(s.series_id)}>{seriesTitle(s)}</Link>, national, all goods and services
              </dd>
              {base ? (
                <>
                  <dt>Base year</dt>
                  <dd>
                    <Num kind="period">{base}</Num> = <Num kind="ui">100</Num>
                  </dd>
                </>
              ) : null}
              <dt>Source</dt>
              <dd>
                Monthly Review of Price Indices, June issues{publisher ? <>, {publisher}</> : null}. The page of each value is in the table below.
              </dd>
              <dt>Sum</dt>
              <dd>Amount × index in the later month ÷ index in the earlier month, in whole rupees; halves round away from zero.</dd>
              {limits ? (
                <>
                  <dt>Limits</dt>
                  <dd>{limits}</dd>
                </>
              ) : null}
            </dl>
            <p className="ic-more">
              <Link href="/guides">Guides to reading the figures</Link>
            </p>
          </aside>
        ) : null}
      </div>

      {ok ? (
        <section className="pg-sec ic-table" aria-labelledby="ic-table-h">
          <h2 id="ic-table-h" className="pg-h2 ic-h2">
            The index, June of each year
          </h2>
          <div className="ic-tbl-wrap">
            <table className="tbl2 ic-tbl">
              <caption className="sr-only">{seriesTitle(s!)}, June of each year, with the page each value is printed on</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" className="ic-num">
                    Index{base ? (
                      <>
                        , <Num kind="period">{base}</Num> = <Num kind="ui">100</Num>
                      </>
                    ) : null}
                  </th>
                  <th scope="col">Printed in</th>
                </tr>
              </thead>
              <tbody>
                {points
                  .slice()
                  .reverse()
                  .map((o) => (
                    <tr key={o.obs_id} data-calc-obs={o.obs_id}>
                      <th scope="row">{P(o.period, s!)}</th>
                      <td className="ic-num">
                        <V o={o} sheet className="v-link" />
                      </td>
                      <td>
                        <PageRef o={o} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
