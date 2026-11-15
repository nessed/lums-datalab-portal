// The top of a series page (round 2, items 6, 7, 11, 19): the fact pills under
// the title, the headline block (the latest checked figure, big, with a plain
// sentence and the change in words), and the related-series rail with
// sparklines. Server components; every digit is a <V>, a <Num> or a derived
// figure that a check plug-in recomputes:
//   - the change in words ("up 17.1%", "down 7.8 percentage points") is
//     data-derived="pct" | "pp" with data-fmt="words", recomputed by
//     scripts/checks/home-derived.mjs (inputs: the earlier figure, then the later);
//   - a change that cannot be put in those words (a base at or below zero, a
//     change in units) falls back to the series view's own <D> (series-derived.mjs).
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import Arrow from "@/components/ui/Arrow";
import FactPills, { type Fact } from "@/components/ui/FactPills";
import NumberBlock from "@/components/ui/NumberBlock";
import PrintedPagePill from "@/components/ui/PrintedPagePill";
import Spark from "@/components/Spark";
import { StatusMark } from "@/components/ui/Status";
import { Num, V } from "@/components/ui/Num";
import { db, obsHref, RELEASE_VERSION, seriesHref, slugify, sourceHref, type Observation, type Series } from "@/lib/data";
import { derivedDisplay, periodWords, unitLabel } from "@/lib/format";
import { derivedText } from "@/lib/chart-model";
import { visualKey } from "@/lib/status";
import { latestPublished, ancestors } from "@/lib/stats";
import { seriesTitle } from "@/lib/titles";
import { KIND, STAGE_KINDS } from "@/lib/words";
import { D, PeriodsIn } from "./Parts";
import { kindLong, markerOf, type Answer } from "./model";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const isStage = (o: Observation) => STAGE_KINDS.includes(o.kind) && o.vintage !== "na";

/** "budget estimate 2026-27", "June 2026", "the 2024-25 round". */
function KindPeriodWords({ o, series, lead }: { o: Observation; series: Series; lead?: boolean }) {
  const k = kindLong(o);
  if (isStage(o))
    return (
      <>
        {lead ? cap(k) : k}, <Num kind="period">{periodWords(o.period, series.frequency)}</Num>
      </>
    );
  if (series.frequency === "survey_round")
    return (
      <>
        {lead ? "Survey round" : "survey round"} <Num kind="period">{o.period}</Num>
      </>
    );
  return (
    <>
      {k && k !== "as printed" ? `${lead ? cap(k) : k}, ` : ""}
      <Num kind="period">{periodWords(o.period, series.frequency)}</Num>
    </>
  );
}

/* ---------- how often it is published, and what this release holds (item 4) ---------- */

function publishedWords(series: Series): { how: string; holds: string | null } {
  const all = db().obsBySeries.get(series.series_id) ?? [];
  if (series.dataset === "cpi") {
    const months = [...new Set(all.map((o) => Number(o.period.slice(5, 7))))].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
    const names = months.map((m) => MONTH_NAMES[m - 1]);
    const list = names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    return { how: "Monthly, by the Pakistan Bureau of Statistics", holds: months.length && months.length < 12 ? `This release holds the ${list} ${names.length === 1 ? "issue" : "issues"} of each year it covers.` : null };
  }
  if (series.dataset === "abs") return { how: "Once a year, in the federal budget (Finance Division)", holds: "This release holds the budget editions listed under Source." };
  if (series.dataset === "lfs") return { how: "Each survey round, by the Pakistan Bureau of Statistics", holds: "This release holds the survey rounds shown on the chart." };
  const d = db();
  const o = all.find((x) => x.primary_cell_id);
  const s = o ? d.sourceById.get(d.cellById.get(o.primary_cell_id!)?.source_id ?? "") : undefined;
  return { how: s ? `By ${s.publisher}` : "As printed in its source documents", holds: null };
}

export function publishedSentence(series: Series): string {
  const p = publishedWords(series);
  return `${p.how}.${p.holds ? ` ${p.holds}` : ""}`;
}

/* ---------- the fact pills (item 7) ---------- */

export function SeriesFacts({ series, latest }: { series: Series; latest: Observation | null }) {
  const d = db();
  const all = d.obsBySeries.get(series.series_id) ?? [];
  const periods = [...new Set(all.map((o) => o.period))].sort();
  const pub = publishedWords(series);
  const m = latest ? markerOf(latest) : null;
  const cell = latest?.primary_cell_id ? d.cellById.get(latest.primary_cell_id) : undefined;
  const checked = latest && (latest.reader.key === "checked" || latest.reader.key === "checked-note");
  const asOf = (d.release.created_at ?? "").slice(0, 10);
  const items: Fact[] = [
    {
      key: "covers",
      label: "Covers",
      value: periods.length ? (
        periods.length === 1 ? (
          <Num kind="period">{periodWords(periods[0], series.frequency)}</Num>
        ) : (
          <>
            <Num kind="period">{periodWords(periods[0], series.frequency)}</Num> to <Num kind="period">{periodWords(periods[periods.length - 1], series.frequency)}</Num>
          </>
        )
      ) : null,
    },
    { key: "pub", label: "Published", value: pub.how },
    { key: "latest", label: "Latest figure", value: latest ? <KindPeriodWords o={latest} series={series} /> : "none checked yet" },
    { key: "next", label: "Next expected", value: "not stated in this release" },
    {
      key: "src",
      label: "Source",
      value: m && cell ? (
        <Link href={sourceHref(cell.source_id)}>
          {m.doc} <Num kind="period">{periodWords(m.period, m.frequency)}</Num>
        </Link>
      ) : null,
    },
    { key: "chk", label: "Checked", value: checked ? "against the printed page" : null },
    {
      key: "rel",
      label: "Release",
      value: (
        <>
          <Num kind="version">{RELEASE_VERSION}</Num>
          {asOf ? (
            <>
              , as of <Num kind="date">{asOf}</Num>
            </>
          ) : null}
        </>
      ),
    },
  ];
  return (
    <div className="sp-facts-wrap" role="region" aria-label="Facts about this series" tabIndex={0}>
      <FactPills items={items} className="sp-facts" />
    </div>
  );
}

/* ---------- the plain sentence under the headline figure (item 6) ---------- */

function sentence(series: Series, o: Observation): ReactNode {
  const v = <V o={o} short sheet />;
  const when = <Num kind="period">{periodWords(o.period, series.frequency)}</Num>;
  const id = series.series_id;
  const positive = !(o.value ?? "").trim().startsWith("-") && Number(o.value) > 0;
  if (series.dataset === "cpi") {
    const who = id.includes(".group.") ? "Prices in this group" : "Prices";
    if (id.includes(".yoy."))
      return positive ? (
        <>
          {who} were {v} higher in {when} than a year earlier.
        </>
      ) : (
        <>
          {who} changed by {v} over the year to {when}.
        </>
      );
    if (id.includes(".mom."))
      return positive ? (
        <>
          {who} were {v} higher in {when} than a month earlier.
        </>
      ) : (
        <>
          {who} changed by {v} over the month to {when}.
        </>
      );
    if (id.includes(".weight."))
      return (
        <>
          In {when}, this group carried a weight of {v} in the price basket.
        </>
      );
    return (
      <>
        The index stood at {v} in {when}.
      </>
    );
  }
  if (series.dataset === "abs") {
    if (series.unit === "percent")
      return (
        <>
          In the federal {kindLong(o)} for {when}, it is {v} of the total.
        </>
      );
    return (
      <>
        The federal {kindLong(o) || "figure"} for {when} is {v}.
      </>
    );
  }
  if (series.dataset === "lfs")
    return (
      <>
        {seriesTitle(series)}: {v} in the <Num kind="period">{o.period}</Num> Labour Force Survey.
      </>
    );
  return (
    <>
      {seriesTitle(series)}: {v} in {when}.
    </>
  );
}

/* ---------- the change, in words with an arrow ---------- */

function Change({ series, answer }: { series: Series; answer: Answer }) {
  const { latest, change } = answer;
  if (!latest || !change) return null;
  const v = change.point.v!;
  const neg = v.startsWith("-");
  const zero = /^[+-]?0*(\.0*)?$/.test(v);
  const dir = zero ? "flat" : neg ? "down" : "up";
  const against = change.against;
  const sinceWords = isStage(against) ? (
    <>
      the <Num kind="period">{periodWords(against.period, series.frequency)}</Num> {kindLong(against)}
    </>
  ) : series.frequency === "survey_round" ? (
    <>
      the <Num kind="period">{against.period}</Num> round
    </>
  ) : (
    <Num kind="period">{periodWords(against.period, series.frequency)}</Num>
  );
  const rate = series.unit === "percent";
  const base = Number(against.value);
  // Words form: recomputed by home-derived.mjs ("up 17.1%", "down 7.8 percentage points", "unchanged").
  const words = change.op === "pct" ? base > 0 : rate && change.op === "chg";
  if (words) {
    const mag = derivedDisplay(v.replace(/^[+-]/, ""), false);
    const text = zero ? "unchanged" : `${dir} ${mag}${change.op === "pct" ? "%" : " percentage points"}`;
    return (
      <>
        <Arrow dir={dir} label={false} />
        <span data-num="derived" data-derived={change.op === "pct" ? "pct" : "pp"} data-fmt="words" data-inputs={`${against.obs_id} ${latest.obs_id}`} className="d-val">
          {text}
        </span>{" "}
        {zero ? "from" : "on"} {sinceWords}
      </>
    );
  }
  return (
    <>
      <Arrow dir={dir} />
      <D op={change.op} inputs={change.point.in}>
        {derivedText(change.op, v)}
      </D>{" "}
      {change.op === "chg" ? (rate ? "percentage points " : `${unitLabel(series.unit, series.scale_factor)} `) : ""}on {sinceWords}
    </>
  );
}

/* ---------- the headline block (items 6, 19) ---------- */

export function Headline({ series, answer }: { series: Series; answer: Answer }) {
  const { latest, newer } = answer;
  const unit = unitLabel(series.unit, series.scale_factor);
  if (!latest) {
    return (
      <div className="numblock numblock--xl sp-num sp-num--none">
        <p className="numblock-label">Latest figure</p>
        <p className="sp-none">No checked figure in this release.</p>
        {newer ? (
          <p className="sp-newer">
            <StatusMark k={visualKey(newer.reader)} /> The newest, <KindPeriodWords o={newer} series={series} />, is {newer.reader.word || "not shown"}: {newer.reader.reason}
          </p>
        ) : null}
        <p className="small muted">Every figure is listed in the table below with its reason.</p>
      </div>
    );
  }
  const m = markerOf(latest);
  return (
    <NumberBlock
      className="sp-num"
      label={
        <>
          {newer ? "Latest checked figure · " : ""}
          <KindPeriodWords o={latest} series={series} lead />
        </>
      }
      value={<V o={latest} short sheet />}
      answer={sentence(series, latest)}
      change={
        answer.change ? (
          <Change series={series} answer={answer} />
        ) : answer.noChange ? (
          <>
            No change shown: <PeriodsIn text={answer.noChange} />
          </>
        ) : null
      }
    >
      {newer ? (
        <p className="sp-newer">
          <StatusMark k={visualKey(newer.reader)} /> The newer <KindPeriodWords o={newer} series={series} /> is {newer.reader.word || "not shown"}. {newer.reader.reason}
        </p>
      ) : null}
      <div className="sp-proof">
        <PrintedPagePill href={obsHref(latest.obs_id)} sheet={slugify(latest.obs_id)} />
        {m ? (
          <span className="sp-marker">
            {m.doc} <Num kind="period">{periodWords(m.period, m.frequency)}</Num>, <Num kind="page">{m.page}</Num>
          </span>
        ) : null}
      </div>
      <p className="sp-exact">
        <V o={latest} sheet /> {unit}, exactly as printed{latest.reader.key === "checked-note" ? "; the document attaches a note" : ""}.
      </p>
    </NumberBlock>
  );
}

/* ---------- related series with sparklines (item 11) ---------- */

function RailItem({ s }: { s: Series }) {
  const o = latestPublished(s.series_id);
  const kind = o ? kindLong(o) : "";
  return (
    <li className="rail-item">
      <Link href={seriesHref(s.series_id)} className="rail-title">
        {seriesTitle(s)}
      </Link>
      <span className="rail-fig">
        {o && o.reader.showsValue ? (
          <>
            <span className="rail-v">
              <V o={o} short sheet label={`${seriesTitle(s)}: ${kind ? `${kind} ` : ""}${periodWords(o.period, s.frequency)}, see where it is printed`} />
            </span>
            <span className="rail-when">
              {kind && isStage(o) ? `${KIND[o.kind]?.short ?? kind} ` : ""}
              <Num kind="period">{periodWords(o.period, s.frequency)}</Num>
            </span>
          </>
        ) : (
          <span className="rail-when">no checked figure</span>
        )}
      </span>
      <span className="rail-spark">
        <Spark series={s} width={88} height={26} link={false} />
      </span>
    </li>
  );
}

export function RelatedRail({ series }: { series: Series }) {
  const d = db();
  const visible = (s: Series) => !s.derived && (d.obsBySeries.get(s.series_id)?.length ?? 0) > 0;
  const children = (d.childrenOf.get(series.series_id) ?? []).filter(visible);
  const up = ancestors(series);
  const parent = up[0];
  const siblings = parent ? (d.childrenOf.get(parent.series_id) ?? []).filter((c) => visible(c) && c.series_id !== series.series_id) : [];
  const groups: { label: string; items: Series[]; more: Series | null }[] = [];
  const MAXN = 8;
  if (children.length) groups.push({ label: "Made up of", items: children.slice(0, MAXN), more: children.length > MAXN ? series : null });
  const room = Math.max(4, MAXN - Math.min(children.length, MAXN));
  if (siblings.length) groups.push({ label: parent ? `Alongside it, in ${seriesTitle(parent)}` : "Alongside it", items: siblings.slice(0, room), more: siblings.length > room && parent ? parent : null });
  if (!groups.length && parent) groups.push({ label: "Part of", items: [parent], more: null });
  if (!groups.length) return null;
  return (
    <section className="rail" aria-labelledby="h-rail">
      <h2 id="h-rail" className="rail-h">
        Related series
      </h2>
      <p className="rail-note">Latest checked figure of each; the small chart shows its checked figures, with gaps left open.</p>
      {groups.map((g) => (
        <div key={g.label} className="rail-group">
          <h3 className="rail-gh">{g.label}</h3>
          <ul className="rail-list">
            {g.items.map((s) => (
              <RailItem key={s.series_id} s={s} />
            ))}
          </ul>
          {g.more ? (
            <p className="rail-more">
              <Link href={seriesHref(g.more.series_id)}>Every line under {seriesTitle(g.more)}</Link>
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
