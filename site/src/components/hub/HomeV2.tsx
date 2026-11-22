// Home v2 (2026-11-23, Ali; DECISIONS.md D-HV2-2). The sections of the new home
// page, server components. The design was a picture, not a data source: every
// figure here is a <V> read from the release through db(), every count a
// <Count>, every other digit a <Num>; every change, share, cost or sum is a
// derived figure (data-num="derived") that a plug-in under scripts/checks/
// recomputes from the release. A slot the release cannot fill is left out or
// says so in words. Client code only picks which server-rendered panel shows
// (components/hub/Switch.tsx).
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import Arrow from "@/components/ui/Arrow";
import Chart, { LineKey } from "@/components/Chart";
import Spark from "@/components/Spark";
import { Num, V } from "@/components/ui/Num";
import { buildChart, type ChartModel } from "@/lib/chart";
import { db, library, seriesHref, sourceHref, type Observation, type Series } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { seriesTitle } from "@/lib/titles";
import { feature, isOn, type FeatureKey } from "@/lib/features";
import { DerivedNotes, DerivedValue, PageWords, ShortValue, SourceMarker } from "@/components/home/Bits";
import { dirOf } from "@/components/home/Cards";
import { compare, latestShown, ofKind, showable, usable } from "@/components/home/derive";
import { evidenceExample, headlineCards } from "@/components/home/editorial";
import EvidenceExample from "@/components/home/Evidence";
import { addUpCheck, groupFigures, type Story } from "./stories";
import { CostSwitch, SelectSwitch, Switch, TileSwitch } from "./Switch";
import daily from "../../../editorial/daily.json";
import calendar from "../../../editorial/calendar.json";

const P = (p: string, s: Pick<Series, "frequency">) => <Num kind="period">{periodWords(p, s.frequency)}</Num>;

/** A section heading with the gold square (Archivo 19 px). */
function H({ id, children, more }: { id: string; children: ReactNode; more?: ReactNode }) {
  return (
    <div className="v2-head">
      <h2 id={id} className="sec-h">
        {children}
      </h2>
      {more ? <span className="v2-more">{more}</span> : null}
    </div>
  );
}

/* ================================ exact decimals ================================ */
// The cost and Rs 100 figures are new derived figures (Home v2). Exact decimal
// arithmetic in BigInt, halves away from zero; scripts/checks/home-costs.mjs and
// home-per100.mjs recompute them independently.

function dec(v: string): { n: bigint; s: number } {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(v.trim());
  if (!m) throw new Error(`not a decimal: ${v}`);
  const f = m[3] ?? "";
  const n = BigInt(m[2] + f);
  return { n: m[1] === "-" ? -n : n, s: f.length };
}
const absB = (x: bigint) => (x < BigInt(0) ? -x : x);
const p10 = (k: number) => BigInt(10) ** BigInt(k);
/** num / den rounded to k decimals, halves away from zero, as a digit string with thousands separators. */
function roundTo(num: bigint, den: bigint, k: number): string {
  const neg = num < BigInt(0) !== den < BigInt(0) && num !== BigInt(0);
  const a = absB(num) * p10(k);
  const b = absB(den);
  let q = a / b;
  if ((a % b) * BigInt(2) >= b) q += BigInt(1);
  const t = q.toString().padStart(k + 1, "0");
  const int = t.slice(0, t.length - k).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const out = k ? `${int}.${t.slice(t.length - k)}` : int;
  return neg && /[1-9]/.test(out) ? `−${out}` : out;
}

/** Rupees out of every Rs 100: part / total × 100, two decimals; a non-zero figure that would read 0.00 to its first significant digit. */
function per100Text(part: bigint, total: bigint): string {
  const two = roundTo(part * BigInt(100), total, 2);
  if (two !== "0.00" || part === BigInt(0)) return two;
  let k = 3;
  while (part * BigInt(100) * p10(k) < total) k++;
  return roundTo(part * BigInt(100), total, k);
}

/* =================================== ticker ===================================== */
// The ticker (home-stories.mjs section 4 requires it) is Hub.tsx's Ticker,
// restyled slim in v2.css; page.tsx places it under the search row.

/* =============================== today's rates board ============================ */

type RateItem = { id: string; name: string; o?: Observation; collectedOn?: string };
export type RatesState = "live" | "stale" | "not-collected";

/**
 * Today's rates (petrol, diesel, the dollar ...). Three states:
 *   live           every item is a checked figure collected today: a <V> each
 *   stale          the latest collection is older than a day: the figures, and when they were collected
 *   not-collected  names only (editorial/daily.json): no number at all
 * Ships as "not-collected" behind the `dailyRates` flag (features.config.json).
 * No collector exists, so turning the flag on fails the build (lib/features.ts).
 */
export function RatesBoard({ state, items, theme = "gold" }: { state: RatesState; items: RateItem[]; theme?: "gold" | "navy" | "white" }) {
  if (!items.length) return null;
  return (
    <section className="rb" data-theme={theme} data-state={state} aria-labelledby="rb-h">
      <div className="rb-head">
        <h2 id="rb-h" className="rb-h">
          Today&rsquo;s rates
        </h2>
        <p className="rb-note">
          {state === "not-collected" ? (
            <>Not yet collected. These will come from official notices, once a day. No rate is shown until then.</>
          ) : state === "stale" ? (
            <>Not updated today: each rate shows the day it was collected.</>
          ) : (
            <>From official notices, collected today. Each rate links to the notice it was read from.</>
          )}
        </p>
      </div>
      <ul className="rb-grid">
        {items.map((it) => (
          <li key={it.id} className="rb-item">
            <span className="rb-name">{it.name}</span>
            {state !== "not-collected" && it.o && showable(it.o) ? (
              <>
                <span className="rb-v">
                  <V o={it.o} sheet className="v-link" />
                </span>
                {state === "stale" && it.collectedOn ? (
                  <span className="rb-when">
                    Collected <Num kind="date">{it.collectedOn}</Num>
                  </span>
                ) : null}
              </>
            ) : (
              <span className="rb-none">Not yet collected</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The board as this release can fill it: off (names only) until a collector exists. */
export function TodaysRates() {
  const items: RateItem[] = (daily.items as { id: string; name: string }[]).map((x) => ({ id: x.id, name: x.name }));
  // isOn("dailyRates") cannot be true here: lib/features.ts fails the build first.
  return <RatesBoard state={isOn("dailyRates") ? "live" : "not-collected"} items={items} />;
}

/* ================================== key numbers ================================== */

function basis(base: Observation, s: Series): ReactNode {
  if (base.kind === "be") return <>on {P(base.period, s)} budget</>;
  if (base.kind === "re") return <>on {P(base.period, s)} revised</>;
  if (base.kind === "survey_round") return <>on {P(base.period, s)} survey</>;
  return <>on {P(base.period, s)}</>;
}

const KIND_LINE: Record<string, string> = { be: "Budget estimate", re: "Revised estimate", change_yoy: "Change over a year", survey_round: "Survey figure" };

/** One kind of figure per line; for a budget estimate the revised estimate of the compared year is one separate marker. */
function panelModel(series: Series, key: string, reOf: Observation | null): ChartModel {
  const full = buildChart(series);
  const lines = full.lines.filter((l) => l.key === key);
  if (reOf) {
    const re = full.lines.find((l) => l.key === "re");
    const pt = re?.points.find((p) => p.period === reOf.period);
    if (re && pt) lines.push({ ...re, key: "re-mark", label: `${re.label} (one year)`, points: [pt] });
  }
  return { ...full, lines, marks: full.marks.filter((m) => m.vintage === key) };
}

/** The table behind a panel's chart: every shown figure of the line, and the revised marker. */
function PanelTable({ series, kind, reOf, caption }: { series: Series; kind: string; reOf: Observation | null; caption: string }) {
  const rows = ofKind(db().obsBySeries.get(series.series_id) ?? [], kind).filter(showable);
  return (
    <div className="kp-table">
      <table className="tbl2">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">{KIND_LINE[kind] ?? "Figure"}</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .slice()
            .reverse()
            .map((o) => (
              <tr key={o.obs_id}>
                <th scope="row">{P(o.period, series)}</th>
                <td>
                  <V o={o} sheet className="v-link" />
                  {reOf && o.period === reOf.period ? (
                    <span className="kp-re">
                      {" "}
                      revised to <V o={reOf} sheet className="v-link" />
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The six headline figures as tiles; selecting one swaps the chart, sentence and
 * source below. The changes are added to `notes` in the same order as
 * HomeFormulas lists them on /methods (Moved.tsx), which they link to.
 */
export function KeyTiles({ notes }: { notes: DerivedNotes }) {
  const tiles: { key: string; name: ReactNode; body: ReactNode }[] = [];
  const panels: ReactNode[] = [];
  for (const c of headlineCards()) {
    const all = db().obsBySeries.get(c.series.series_id) ?? [];
    const { latest } = latestShown(all, c.kind);
    if (!latest) continue;
    const cmp = compare(c.series, latest, all);
    let chg: ReactNode = null;
    let rev: ReactNode = null;
    let reOf: Observation | null = null;
    if (cmp.kind === "change") {
      const id = notes.add(cmp.derived, `${c.name}: change on the comparable figure`);
      chg = (
        <>
          <Arrow dir={dirOf(cmp.derived)} label={false} />
          <a href={notes.href(id)} className="kt-drv">
            <DerivedValue d={cmp.derived} />
          </a>{" "}
          <span className="kt-basis">{basis(cmp.base, c.series)}</span>
        </>
      );
      if (cmp.base.kind === "be") {
        const re = all.find((o) => o.period === cmp.base.period && o.kind === "re");
        if (re && usable(re)) {
          reOf = re;
          rev = (
            <>
              {P(re.period, c.series)} revised to <ShortValue o={re} series={c.series} />
            </>
          );
        }
      }
    } else if (cmp.kind === "break") chg = <span className="kt-basis">No comparable earlier figure</span>;
    else if (cmp.kind === "not-usable") chg = <span className="kt-basis">Earlier figure not checked</span>;
    const when = latest.kind === "be" ? <>{P(latest.period, c.series)} budget</> : P(latest.period, c.series);
    const key = c.series.series_id;
    tiles.push({
      key,
      name: c.name,
      body: (
        <>
          <span className="kt-v">
            <ShortValue o={latest} series={c.series} />
          </span>
          <span className="kt-when">{when}</span>
          {chg ? <span className="kt-chg">{chg}</span> : null}
          {rev ? <span className="kt-rev">{rev}</span> : null}
          <span className="kt-spark" aria-hidden="true">
            <Spark series={c.series} width={72} height={20} link={false} />
          </span>
        </>
      ),
    });
    const model = panelModel(c.series, latest.vintage, reOf);
    const title = seriesTitle(c.series);
    panels.push(
      <>
        <div className="kp-head">
          <p className="kp-sentence">
            {c.name}: <ShortValue o={latest} series={c.series} /> for {latest.kind === "be" ? <>the {P(latest.period, c.series)} budget</> : P(latest.period, c.series)}
            {rev ? <>; the {P(reOf!.period, c.series)} budget was later revised to <ShortValue o={reOf!} series={c.series} /></> : null}.
          </p>
          <p className="kp-src">
            <SourceMarker o={latest} /> · <Link href={seriesHref(key)}>All figures of this series</Link>
          </p>
        </div>
        <Switch
          label={`${c.name}: chart or table`}
          variant="seg"
          className="kp-sw"
          options={[
            { key: "chart", label: "Chart" },
            { key: "table", label: "Table" },
          ]}
          panels={[
            <div key="c" className="kp-chart">
              <ul className="kp-key" aria-label="Key">
                {model.lines.map((l) => (
                  <li key={l.key}>
                    <LineKey line={l} /> {l.label}
                  </li>
                ))}
              </ul>
              <Chart model={model} idBase={`kp-${tiles.length}`} caption={title} options={{ height: 300, noKey: true }} />
            </div>,
            <PanelTable key="t" series={c.series} kind={c.kind} reOf={reOf} caption={title} />,
          ]}
        />
      </>,
    );
  }
  if (!tiles.length) return null;
  return (
    <section className="v2-sec kn2" aria-labelledby="kn2-h">
      <H id="kn2-h" more={<Link href="/browse">Explore all data</Link>}>
        Key numbers
      </H>
      <TileSwitch label="Key numbers: pick one to see its chart" tiles={tiles} panels={panels} />
    </section>
  );
}

/* =============================== just added / coming up ============================ */

type CalEntry = { id: string; name: string; agency: string; when: string; status: "expected" | "announced"; basis?: string; announcedAt?: string };

export function AddedAndComing() {
  const docs = library()
    .documents.filter((d) => d.state === "read")
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 6);
  const freq = (d: { period: string; kind: string }) => ({ frequency: /^\d{4}-(0[1-9]|1[0-2])$/.test(d.period) && d.kind === "cpi_monthly_review" ? "month" : "" });
  const entries = (calendar.entries as CalEntry[]).slice().sort((a, b) => a.when.localeCompare(b.when));
  const added = docs.length ? (
    <ul className="ac-list">
      {docs.map((d) => (
        <li key={d.id} className="ac-row">
          <span className="ac-what">
            <Link href={sourceHref(d.id)}>{d.kindName}</Link> {P(d.period, freq(d))}
          </span>
          <span className="ac-who">{d.publisher}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="ac-none">Nothing has been added to this release yet.</p>
  );
  const coming = entries.length ? (
    <ul className="ac-list">
      {entries.map((e) => (
        <li key={e.id} className="ac-row" data-cal-entry={e.id}>
          <span className="ac-what">{e.name}</span>
          <span className="ac-who">{e.agency}</span>
          <span className="ac-when">
            {e.status === "announced" ? "Announced for " : "Expected "}
            <span data-num={e.status === "announced" ? "date" : "ui"} data-cal={e.id}>
              {e.status === "announced" ? e.when : periodWords(e.when, "month")}
            </span>
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="ac-none">No dates are expected yet.</p>
  );
  return (
    <section className="v2-sec ac" aria-labelledby="ac-h">
      <H id="ac-h" more={<Link href="/library">Library</Link>}>
        New and next
      </H>
      <Switch
        label="Just added or coming up"
        options={[
          { key: "added", label: "Just added" },
          { key: "coming", label: "Coming up" },
        ]}
        panels={[
          added,
          <>
            {coming}
            <p className="ac-foot">
              &ldquo;Expected&rdquo; dates are our estimate from when each publication usually appears, not a date the agency has announced.{" "}
              <Link href="/calendar">Calendar</Link>
            </p>
          </>,
        ]}
      />
    </section>
  );
}

/* ================================ what it costs you ================================ */

const AMOUNTS = ["1000", "5000", "10000", "50000"];
const rs = (a: string) => a.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** amount × (100 + rate) ÷ 100 and amount × rate ÷ 100, whole rupees, halves away from zero. */
function costFigures(amount: string, rate: string): { now: string; more: string; dir: "more" | "less" | "same" } {
  const A = BigInt(amount);
  const r = dec(rate);
  const den = BigInt(100) * p10(r.s);
  const nowN = A * (BigInt(100) * p10(r.s) + r.n);
  const moreN = A * r.n;
  const more = roundTo(absB(moreN), den, 0);
  return { now: roundTo(nowN, den, 0), more, dir: more === "0" ? "same" : r.n < BigInt(0) ? "less" : "more" };
}

export function WhatItCosts() {
  const g = groupFigures("prices");
  if (!g) return null;
  const rows = [{ name: "Everything", series: g.total, o: g.totalObs, overall: true }, ...g.rows.map((r) => ({ ...r, overall: false }))].filter((r) => usable(r.o) && r.series.unit === "percent");
  if (!rows.length) return null;
  const panels: Record<string, ReactNode> = {};
  for (const a of AMOUNTS) {
    for (const r of rows) {
      const f = costFigures(a, r.o.value!);
      const attrs = { "data-num": "derived", "data-amount": a, "data-inputs": r.o.obs_id } as const;
      panels[`${a}|${r.series.series_id}`] = (
        <div className="cost-out">
          <p className="cost-big">
            Rs{" "}
            <span {...attrs} data-derived="cost-now" data-fmt="rs">
              {f.now}
            </span>
          </p>
          <p className="cost-line">
            What cost Rs <Num kind="ui">{rs(a)}</Num> a year earlier cost about this in {P(r.o.period, r.series)}
            {f.dir === "same" ? (
              <>: the same.</>
            ) : (
              <>
                : Rs{" "}
                <span {...attrs} data-derived="cost-more" data-fmt="rs" data-dir={f.dir}>
                  {f.more}
                </span>{" "}
                {f.dir}.
              </>
            )}
          </p>
          <p className="cost-src">
            {r.overall ? "Prices overall" : <>Prices of {r.name.toLowerCase()}</>} changed by <V o={r.o} sheet className="v-link" /> over the year (<SourceMarker o={r.o} />
            ).
          </p>
        </div>
      );
    }
  }
  return (
    <section className="v2-band" aria-labelledby="cost-h">
      <div className="v2-band-in">
        <H id="cost-h">What it costs you</H>
        <p className="v2-lede">The amount, times the year-on-year change in prices that the statistics bureau printed for that group, rounded to whole rupees. An average for the country, not your own bill.</p>
        <CostSwitch
          amounts={AMOUNTS.map((a) => ({ key: a, label: <>Rs <Num kind="ui">{rs(a)}</Num></> }))}
          groups={rows.map((r) => ({ key: r.series.series_id, label: r.name }))}
          panels={panels}
        />
      </div>
    </section>
  );
}

/* ================================== your province ================================== */

export function YourProvince() {
  const g = groupFigures("provinces");
  if (!g || !g.rows.length) return null;
  const order = ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan"];
  const rows = g.rows.slice().sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  const NOT_YET = ["Unemployment rate", "Prices", "Provincial budget"];
  return (
    <section className="v2-band v2-band-2" aria-labelledby="prov-h">
      <div className="v2-band-in">
        <H id="prov-h" more={<Link href="/topics/provinces">Provinces</Link>}>
          Your province
        </H>
        <SelectSwitch
          id="prov-pick"
          label="Province"
          storeKey="v2-province"
          options={rows.map((r) => ({ key: r.series.series_id, label: r.name }))}
          panels={rows.map((r) => (
            <dl key={r.series.series_id} className="prov-dl">
              <div>
                <dt>Labour force</dt>
                <dd>
                  <V o={r.o} short sheet className="v-link" /> <span className="prov-when">survey year {P(r.o.period, r.series)}</span>
                </dd>
              </div>
              {NOT_YET.map((n) => (
                <div key={n}>
                  <dt>{n}</dt>
                  <dd className="prov-none">Not here yet</dd>
                </div>
              ))}
            </dl>
          ))}
        />
        <p className="prov-note">Your choice is kept in this browser only.</p>
      </div>
    </section>
  );
}

/* ================================ where Rs 100 goes ================================ */

export function Per100() {
  const g = groupFigures("functions");
  if (!g) return null;
  const total = g.totalObs;
  if (!usable(total)) return null;
  // Only lines whose add-up check against this total passed (stories.tsx addUpCheck).
  const ok = g.rows.filter((r) => addUpCheck(r.o, total));
  if (ok.length < 2) return null;
  const top = ok.slice(0, 4);
  const T = dec(total.value!);
  const parts = top.map((r) => {
    const d = dec(r.o.value!);
    const s = Math.max(d.s, T.s);
    const pn = d.n * p10(s - d.s);
    const tn = T.n * p10(s - T.s);
    return { r, pn, tn, text: per100Text(pn, tn), chk: addUpCheck(r.o, total)! };
  });
  const s = Math.max(T.s, ...top.map((r) => dec(r.o.value!).s));
  const tn = T.n * p10(s - T.s);
  const restN = tn - top.reduce((acc, r) => acc + dec(r.o.value!).n * p10(s - dec(r.o.value!).s), BigInt(0));
  if (restN < BigInt(0)) return null;
  const rest = per100Text(restN, tn);
  const width = (n: bigint, d: bigint) => `${(Number((n * BigInt(100000)) / d) / 1000).toFixed(3)}%`;
  const segs = [
    ...parts.map((p, i) => ({ key: p.r.series.series_id, name: p.r.name, text: p.text, w: width(p.pn, p.tn), cls: `p100-${i + 1}`, derived: "per100", inputs: `${p.r.o.obs_id} ${total.obs_id}`, chk: p.chk, link: p.r.o as Observation | null })),
    { key: "rest", name: "Everything else", text: rest, w: width(restN, tn), cls: "p100-5", derived: "per100-rest", inputs: `${total.obs_id} ${top.map((r) => r.o.obs_id).join(" ")}`, chk: parts.map((p) => p.chk).join(" "), link: null as Observation | null },
  ];
  return (
    <section className="v2-sec p100" aria-labelledby="p100-h">
      <H id="p100-h" more={<Link href="/topics/spending">Budget</Link>}>
        Where Rs <Num kind="ui">100</Num> goes
      </H>
      <p className="v2-lede">
        Of every Rs <Num kind="ui">100</Num> the federal government budgeted for its day-to-day spending in {P(total.period, g.total)} (<ShortValue o={total} series={g.total} />
        ), by what it is spent on. Shown only for lines whose figures add up to the printed total.
      </p>
      <div className="p100-bar" aria-hidden="true">
        {segs.map((x) => (
          <span key={x.key} className={`p100-seg ${x.cls}`} style={{ width: x.w }} />
        ))}
      </div>
      <ul className="p100-list">
        {segs.map((x) => (
          <li key={x.key}>
            <span className={`p100-sw ${x.cls}`} aria-hidden="true" />
            <span className="p100-name">{x.link ? <Link href={seriesHref(x.key)}>{x.name}</Link> : x.name}</span>
            <span className="p100-v">
              Rs{" "}
              <span data-num="derived" data-derived={x.derived} data-fmt="rs2" data-inputs={x.inputs} data-share-check={x.chk}>
                {x.text}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="p100-src">
        <SourceMarker o={total} />
      </p>
    </section>
  );
}

/* ===================================== stories ===================================== */

export function StoriesV2({ list }: { list: Story[] }) {
  if (!list.length) return null;
  return (
    <section className="v2-sec st2" aria-labelledby="st2-h">
      <H id="st2-h" more={<Link href="/answers">All stories</Link>}>
        What the numbers say
      </H>
      <ul className="st2-grid">
        {list.map((st) => (
          <li key={st.slug} className="st2-item">
            <p className="st2-h">{st.sentence}</p>
            <p className="st2-src">
              <SourceMarker o={st.lead} />
            </p>
            <Link href={st.href} className="st2-more">
              Read the story
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ================================ check it yourself ================================ */

export function CheckItYourself() {
  const ex = evidenceExample();
  if (!ex) return null;
  return (
    <div className="evband">
      <div className="evband-in">
        <EvidenceExample series={ex.series} kind={ex.kind} words={new PageWords()} />
      </div>
    </div>
  );
}

/* =============================== everything we hold ================================ */

const NOT_HERE: FeatureKey[] = ["provincialBudgets", "districts", "monthlyData", "realTerms", "percentOfGdp", "maps"];

export function EverythingWeHold() {
  const lib = library();
  const sets = lib.datasets.filter((x) => x.visible);
  const freqOf = (key: string) => db().series.find((s) => s.dataset === key)?.frequency ?? "";
  const later = lib.datasets.filter((x) => !x.visible);
  return (
    <section className="v2-sec hold" aria-labelledby="hold-h">
      <H id="hold-h" more={<Link href="/library/datasets">All datasets</Link>}>
        Everything we hold
      </H>
      <div className="hold-grid">
        <ul className="hold-list">
          {sets.map((x) => {
            const f = { frequency: freqOf(x.key) };
            return (
              <li key={x.key} className="hold-item">
                <Link href="/library/datasets" className="hold-name">
                  {x.name}
                </Link>
                <span className="hold-line">{x.line}</span>
                {x.firstPeriod && x.lastPeriod ? (
                  <span className="hold-when">
                    {P(x.firstPeriod, f)} to {P(x.lastPeriod, f)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="hold-not">
          <h3 className="hold-not-h">Not here yet</h3>
          <ul>
            {later.map((x) => (
              <li key={x.key}>{x.name}</li>
            ))}
            {NOT_HERE.map((k) => (
              <li key={k}>{feature(k)?.label}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
