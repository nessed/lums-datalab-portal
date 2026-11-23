// Guide: what is a revised estimate? (2026-11-23, Guide design). The design was a
// picture, not a data source. The worked example is federal tax revenue in the
// latest year for which the release holds both a checked budget estimate and a
// checked revised estimate (found from the data, never fixed here); each figure
// is a <V> linked to its receipt, with the page it is printed on; the gap between
// them is a derived figure ("pct", recomputed by scripts/checks/home-derived.mjs).
// scripts/checks/guides-revised-estimate.mjs checks that the example is that
// latest year and that the side list shows each series' latest budget estimate.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { Breadcrumbs } from "@/components/ui/Basics";
import { Num, V } from "@/components/ui/Num";
import { DerivedValue, ShortValue } from "@/components/home/Bits";
import { change, latestShown, revisionPairs } from "@/components/home/derive";
import { PageRef, sourceOf } from "@/components/pages/PageRef";
import { GUIDES_COMING } from "@/components/pages/guides";
import { db, isDatasetPublished, seriesHref, type Series } from "@/lib/data";
import { periodWords, unitLabel } from "@/lib/format";
import { seriesTitle } from "@/lib/titles";

export const metadata: Metadata = {
  title: "What is a revised estimate?",
  description: "A revised estimate is the government's updated figure for a year that is nearly over, printed in the next year's budget. A worked example from federal tax revenue, with every figure linked to the page it is printed on.",
};

/** The series of the worked example. */
const EXAMPLE = "fed.rev.tax";
/** "Datasets this explains": budget series, each with its latest checked budget estimate. */
const EXPLAINS = ["fed.rev.tax", "fed.exp.total", "fed.exp.current.function.health", "fed.exp.current.function.defence_affairs_and_services"];

const P = (p: string, s: Pick<Series, "frequency">) => <Num kind="period">{periodWords(p, s.frequency)}</Num>;

function shownSeries(id: string): Series | null {
  const s = db().seriesById.get(id);
  return s && isDatasetPublished(s.dataset) ? s : null;
}

function WorkedExample({ s }: { s: Series }) {
  const pairs = revisionPairs(db().obsBySeries.get(s.series_id) ?? []);
  const pair = pairs[pairs.length - 1];
  if (!pair) {
    return (
      <p className="gd-none">
        The release holds no year of {seriesTitle(s).toLowerCase()} with both a checked budget estimate and a checked revised estimate, so no example is shown.
      </p>
    );
  }
  const { be, re } = pair;
  const gap = change(be, re, "words");
  const unit = unitLabel(s.unit, s.scale_factor);
  return (
    <>
      <h2 className="pg-h2" id="gd-example-h">
        {seriesTitle(s)} for {P(be.period, s)}
      </h2>
      <div className="gd-three" data-guide-example={s.series_id} data-guide-be={be.obs_id} data-guide-re={re.obs_id}>
        <div className="gd-fig">
          <p className="gd-fig-k">Budget estimate</p>
          <p className="gd-fig-v">
            <V o={be} sheet className="v-link" />
          </p>
          <p className="gd-fig-m">
            {unit} · <PageRef o={be} />
          </p>
        </div>
        <div className="gd-fig">
          <p className="gd-fig-k">Revised estimate</p>
          <p className="gd-fig-v">
            <V o={re} sheet className="v-link" />
          </p>
          <p className="gd-fig-m">
            {unit}
            {gap ? (
              <>
                {" "}
                · <DerivedValue d={gap} /> on the budget estimate
              </>
            ) : null}{" "}
            · <PageRef o={re} />
          </p>
        </div>
        <div className="gd-fig gd-fig-gap">
          <p className="gd-fig-k">Actual</p>
          <p className="gd-fig-none">Not on this site yet</p>
          <p className="gd-fig-m">Comes from the federal accounts after the year closes.</p>
        </div>
      </div>
      {gap ? (
        <p className="gd-how">
          The change is (revised estimate − budget estimate) ÷ budget estimate, worked out from the two printed figures when the site is built, to one decimal place; halves round away
          from zero.
        </p>
      ) : null}
    </>
  );
}

function Lead({ s }: { s: Series | null }) {
  const first = "A revised estimate is the government’s updated figure for a year that is nearly over, printed in the next year’s budget.";
  const pairs = s ? revisionPairs(db().obsBySeries.get(s.series_id) ?? []) : [];
  const pair = pairs[pairs.length - 1];
  if (!s || !pair) return <p className="pg-lede gd-lede">{first}</p>;
  const { be, re } = pair;
  const one = sourceOf(be) === sourceOf(re);
  return (
    <p className="pg-lede gd-lede">
      {first} For {P(be.period, s)}, {seriesTitle(s).toLowerCase()} was budgeted at <ShortValue o={be} series={s} /> and revised to <ShortValue o={re} series={s} />{" "}
      <span className="gd-lede-src">
        (
        {one ? (
          <PageRef o={re} />
        ) : (
          <>
            budget estimate: <PageRef o={be} />; revised: <PageRef o={re} />
          </>
        )}
        )
      </span>
      .
    </p>
  );
}

function Explains() {
  const rows = EXPLAINS.map(shownSeries)
    .filter((s): s is Series => !!s)
    .map((s) => ({ s, o: latestShown(db().obsBySeries.get(s.series_id) ?? [], "be").latest }))
    .filter((r) => !!r.o);
  if (!rows.length) return null;
  const periods = new Set(rows.map((r) => r.o!.period));
  const onePeriod = periods.size === 1 ? rows[0] : null;
  return (
    <section className="gd-aside-sec" aria-labelledby="gd-explains-h">
      <h2 id="gd-explains-h" className="gd-aside-h">
        Datasets this explains
      </h2>
      <ul className="gd-explains">
        {rows.map(({ s, o }) => (
          <li key={s.series_id} data-guide-latest-be={o!.obs_id}>
            <Link href={seriesHref(s.series_id)} className="gd-ex-name">
              {seriesTitle(s)}
            </Link>
            <span className="gd-ex-v">
              <ShortValue o={o!} series={s} />
              {onePeriod ? null : <span className="gd-ex-when"> {P(o!.period, s)}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="gd-aside-note">
        {onePeriod ? <>Budget estimates for {P(onePeriod.o!.period, onePeriod.s)}.</> : <>The latest budget estimate of each.</>}
      </p>
    </section>
  );
}

export default function RevisedEstimateGuide() {
  const s = shownSeries(EXAMPLE);
  return (
    <div className="pg gd">
      <Breadcrumbs items={[{ href: "/guides", label: "Guides" }, { label: "What is a revised estimate?" }]} />
      <div className="gd-grid">
        <article className="gd-main">
          <p className="pg-kicker">Reading the budget</p>
          <h1 className="pg-h1">What is a revised estimate?</h1>
          <Lead s={s} />

          <h2 className="pg-h2">One year, three figures</h2>
          <dl className="gd-defs">
            <div>
              <dt>Budget estimate</dt>
              <dd>What the government plans to spend or collect in a year, presented to the National Assembly with the budget before the year starts.</dd>
            </div>
            <div>
              <dt>Revised estimate</dt>
              <dd>The updated figure about a year later, printed in the next budget, once most of the year has happened but before the accounts are closed.</dd>
            </div>
            <div>
              <dt>Actual</dt>
              <dd>What was really spent or collected, from the federal accounts after the year closes. This site does not hold actual figures yet.</dd>
            </div>
          </dl>

          {s ? <WorkedExample s={s} /> : null}

          <h2 className="pg-h2">Why it matters</h2>
          <p className="pg-p">
            A budget estimate is a plan; a revised estimate is closer to what happened. Comparing this year&rsquo;s plan with last year&rsquo;s revised figure makes growth look bigger than
            it is when last year fell short. So on this site a budget estimate is compared only with an earlier budget estimate, and the revised figure is shown beside it.
          </p>
          <h2 className="pg-h2">How this site shows them</h2>
          <p className="pg-p">
            Each kind of figure is its own line on a chart, with its own colour, dash and marker: budget estimates as a solid line with hollow circles, revised estimates as a dashed line with
            squares. They are never joined into one line. In text we write &ldquo;budget estimate&rdquo; and &ldquo;revised estimate&rdquo; in full; tables use the short forms BE and RE,
            with a key.
          </p>
        </article>
        <aside className="gd-aside" aria-label="Related">
          <Explains />
          <section className="gd-aside-sec" aria-labelledby="gd-other-h">
            <h2 id="gd-other-h" className="gd-aside-h">
              Other guides, being written
            </h2>
            <ul className="gd-coming-list">
              {GUIDES_COMING.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="gd-aside-note">
              <Link href="/guides">All guides</Link>
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
