// The pieces of the hub home page (data hub plan, section 5): ticker, featured
// chart, key numbers, what moved, story cards, library strip, themes. Server
// components; every value is a <V> from the release, every change a derived
// figure recomputed by a check plug-in. The only client code is the chart.
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import Arrow from "@/components/ui/Arrow";
import Chart from "@/components/Chart";
import Spark from "@/components/Spark";
import { Num, V } from "@/components/ui/Num";
import { buildChart } from "@/lib/chart";
import { db, library, seriesHref, sourceHref, type Observation, type Series } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { seriesTitle } from "@/lib/titles";
import { DerivedNotes, DerivedValue, ShortValue, SourceMarker } from "@/components/home/Bits";
import { dirOf } from "@/components/home/Cards";
import { compare, latestShown, usable } from "@/components/home/derive";
import { headlineCards, topicHref, topics } from "@/components/home/editorial";
import { groupFigures, TickerEntry, tickerItems, type Story } from "./stories";
import daily from "../../../editorial/daily.json";

const P = (p: string, s: Pick<Series, "frequency">) => <Num kind="period">{periodWords(p, s.frequency)}</Num>;

/* ---------- ticker ---------- */

/**
 * One line of key figures moving left (Ali's override of DESIGN.md 16). Pure CSS:
 * it pauses on hover, on keyboard focus inside it and with the pause switch, and
 * stands still under reduced motion. The second copy that makes the loop
 * seamless is `hidden` (so without CSS, or with reduced motion, the ticker is one
 * plain wrapping row) and is shown only while the animation runs.
 */
export function Ticker({ notes }: { notes: DerivedNotes }) {
  const items = tickerItems();
  if (!items.length) return null;
  for (const it of items) if (it.change) notes.add(it.change, `${it.name}: change on the comparable earlier figure`);
  const run = (copy: boolean) => (
    <div className="tk-run" {...(copy ? { hidden: true, "aria-hidden": true, inert: true } : {})}>
      {items.map((it) => (
        <TickerEntry key={it.key} it={it} />
      ))}
    </div>
  );
  return (
    <section className="tk" aria-label="Key figures">
      <input type="checkbox" id="tk-pause" className="tk-toggle sr-only" />
      <label htmlFor="tk-pause" className="tk-pause">
        <span className="tk-pause-on">Pause</span>
        <span className="tk-pause-off">Play</span>
        <span className="sr-only"> the moving line of figures</span>
      </label>
      <div className="tk-window">
        <div className="tk-track">
          {run(false)}
          {run(true)}
        </div>
      </div>
    </section>
  );
}

/* ---------- key numbers ---------- */

/** The basis of a change in four words or fewer. */
function basis(base: Observation, s: Series): ReactNode {
  if (base.kind === "be") return <>on {P(base.period, s)} budget</>;
  if (base.kind === "re") return <>on {P(base.period, s)} revised</>;
  if (base.kind === "survey_round") return <>on {P(base.period, s)} survey</>;
  return <>on {P(base.period, s)}</>;
}

/**
 * The six headline figures as a slim list: name, value, arrow and change with its
 * basis. The changes are numbered in the same order as the list on /methods
 * (HomeFormulas), which they link to. A budget estimate compared with last year's
 * budget estimate also shows what that budget was later revised to.
 */
export function KeyNumbers({ notes }: { notes: DerivedNotes }) {
  const rows = headlineCards().map((c) => {
    const all = db().obsBySeries.get(c.series.series_id) ?? [];
    const { latest } = latestShown(all, c.kind);
    if (!latest) return null;
    const cmp = compare(c.series, latest, all);
    let chg: ReactNode = null;
    let rev: ReactNode = null;
    if (cmp.kind === "change") {
      const id = notes.add(cmp.derived, `${c.name}: change on the comparable figure`);
      chg = (
        <>
          <Arrow dir={dirOf(cmp.derived)} label={false} />
          <a href={notes.href(id)} className="kn-drv">
            <DerivedValue d={cmp.derived} />
          </a>{" "}
          <span className="kn-basis">{basis(cmp.base, c.series)}</span>
        </>
      );
      if (cmp.base.kind === "be") {
        const re = all.find((o) => o.period === cmp.base.period && o.kind === "re");
        if (re && usable(re))
          rev = (
            <>
              revised to <ShortValue o={re} series={c.series} />
            </>
          );
      }
    } else if (cmp.kind === "break") chg = <span className="kn-basis">No comparable earlier figure</span>;
    else if (cmp.kind === "not-usable") chg = <span className="kn-basis">Earlier figure not checked</span>;
    return (
      <li className="kn-row" key={c.series.series_id}>
        <Link href={seriesHref(c.series.series_id)} className="kn-name">
          {c.name}
        </Link>
        <span className="kn-v">
          <ShortValue o={latest} series={c.series} />
        </span>
        <span className="kn-when">{latest.kind === "be" ? <>{P(latest.period, c.series)} budget</> : P(latest.period, c.series)}</span>
        {chg ? <span className="kn-chg">{chg}</span> : null}
        {rev ? <span className="kn-rev">{rev}</span> : null}
      </li>
    );
  });
  return (
    <section className="kn" aria-labelledby="kn-h">
      <h2 id="kn-h" className="hub-h">
        Key numbers
      </h2>
      <ul className="kn-list">{rows}</ul>
    </section>
  );
}

/* ---------- featured chart ---------- */

export function Featured({ story }: { story: Story }) {
  const full = buildChart(story.series);
  // One trajectory: the story's kind of figure only.
  const key = story.lead.vintage;
  const model = { ...full, lines: full.lines.filter((l) => l.key === key), marks: full.marks.filter((m) => m.vintage === key) };
  return (
    <section className="ft" aria-labelledby="ft-h">
      <h2 id="ft-h" className="ft-sentence">
        {story.sentence}
      </h2>
      <div className="ft-chart">
        <Chart model={model} idBase="featured" caption={seriesTitle(story.series)} options={{ height: 540, noKey: true }} />
      </div>
      <p className="ft-src">
        <SourceMarker o={story.lead} /> · <Link href={story.href}>The full story</Link>
      </p>
    </section>
  );
}

/* ---------- what moved ---------- */

function Panel({ k, title }: { k: string; title?: ReactNode }) {
  const g = groupFigures(k);
  if (!g || !g.rows.length) return null;
  const s = g.total;
  const max = Math.max(...g.rows.map((r) => Math.abs(Number(r.o.value))));
  const when = g.period.kind === "be" ? <>{P(g.period.period, s)} budget</> : P(g.period.period, s);
  return (
    <section className="mv" aria-labelledby={`mv-${k}`}>
      <h3 id={`mv-${k}`} className="mv-h">
        {title ?? g.def.heading}
      </h3>
      <p className="mv-when">{when}</p>
      <ol className="mv-list">
        {g.rows.map((r) => (
          <li key={r.series.series_id} className="mv-row">
            <Link href={seriesHref(r.series.series_id)} className="mv-name">
              {r.name}
            </Link>
            <span className="mv-bar" aria-hidden="true">
              <span style={{ width: `${max > 0 ? Math.max(1, (Math.abs(Number(r.o.value)) / max) * 100) : 0}%` }} />
            </span>
            <span className="mv-v">
              <V o={r.o} short sheet className="v-link" />
            </span>
          </li>
        ))}
      </ol>
      {g.missing ? <p className="mv-note">Some lines are not shown: their figures have not passed their checks.</p> : null}
      {g.def.note ? (
        <details className="mv-more">
          <summary>What this covers</summary>
          <p>{g.def.note}</p>
        </details>
      ) : null}
    </section>
  );
}

export function WhatMoved() {
  return (
    <section className="hub-sec" aria-labelledby="mv-h">
      <h2 id="mv-h" className="hub-h">
        What moved
      </h2>
      <div className="mv-grid">
        <Panel k="prices" />
        <Panel k="functions" />
        <Panel k="provinces" />
      </div>
    </section>
  );
}

/* ---------- daily prices (placeholder) ---------- */

/**
 * A placeholder for prices to be collected once a day (Ali, 2026-11-23). Names
 * only, from editorial/daily.json: no figure, no source, nothing fetched. When
 * the collection exists, each item becomes an ordinary <V> from the release.
 */
export function DailyPrices() {
  if (!daily.items.length) return null;
  return (
    <section className="hub-sec dp" aria-labelledby="dp-h">
      <h2 id="dp-h" className="hub-h">
        {daily.heading}
      </h2>
      <p className="dp-note">{daily.note}</p>
      <ul className="dp-list">
        {daily.items.map((it) => (
          <li key={it.id} className="dp-item">
            <span className="dp-name">{it.name}</span>
            <span className="dp-state">Not yet collected</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- stories ---------- */

export function StoryCards({ list }: { list: Story[] }) {
  if (!list.length) return null;
  return (
    <section className="hub-sec" aria-labelledby="st-h">
      <div className="hub-sechead">
        <h2 id="st-h" className="hub-h">
          Stories
        </h2>
        <Link href="/answers">All stories</Link>
      </div>
      <ul className="st-grid">
        {list.map((st) => (
          <li key={st.slug} className="st-card">
            <p className="st-sentence">{st.sentence}</p>
            <span className="st-spark" aria-hidden="true">
              <Spark series={st.series} width={220} height={44} link={false} />
            </span>
            <Link href={st.href} className="st-more">
              Read the story
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- library strip ---------- */

export function LibraryStrip() {
  const lib = library();
  const docs = lib.documents
    .filter((d) => d.state === "read")
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 4);
  const freqOf = (key: string) => db().series.find((s) => s.dataset === key)?.frequency ?? null;
  return (
    <section className="hub-sec lib-strip" aria-labelledby="lib-h">
      <div className="hub-sechead">
        <h2 id="lib-h" className="hub-h">
          Library
        </h2>
        <Link href="/library">All documents and datasets</Link>
      </div>
      <div className="ls-grid">
        <div>
          <h3 className="ls-h">Newest documents</h3>
          <ul className="ls-list">
            {docs.map((d) => (
              <li key={d.id}>
                <span className="ls-kind">{d.kindName}</span> {P(d.period, { frequency: /^\d{4}-(0[1-9]|1[0-2])$/.test(d.period) && d.kind === "cpi_monthly_review" ? "month" : "" })}
                <Link href={sourceHref(d.id)} className="ls-open">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="ls-h">Datasets</h3>
          <ul className="ls-list">
            {lib.datasets
              .filter((x) => x.visible)
              .map((x) => {
                const f = { frequency: freqOf(x.key) ?? "" };
                return (
                  <li key={x.key}>
                    <span className="ls-kind">{x.name}</span>{" "}
                    {x.firstPeriod && x.lastPeriod ? (
                      <>
                        {P(x.firstPeriod, f)} to {P(x.lastPeriod, f)}
                      </>
                    ) : null}
                    {x.files.csv ? (
                      <a href={x.files.csv} className="ls-open" download>
                        Download
                      </a>
                    ) : (
                      <Link href="/library/datasets" className="ls-open">
                        Download
                      </Link>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- themes ---------- */

export function Themes() {
  const tps = topics();
  if (!tps.length) return null;
  return (
    <section className="hub-sec" aria-labelledby="th-h">
      <div className="hub-sechead">
        <h2 id="th-h" className="hub-h">
          Explore by theme
        </h2>
        <Link href="/topics">All indicators</Link>
      </div>
      <ul className="th-grid">
        {tps.map((t) => (
          <li key={t.slug}>
            <Link href={topicHref(t.slug)} className="th-tile">
              <span className="th-name">{t.name}</span>
              <span className="th-short">{t.short}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
