// Topic pages, Home v3 pages set (design handoff, 2026-11-24): the left list of
// topics, the headline tiles and the indicator rows. Server components; every
// figure a <V> (via ShortValue) from the release, every change a derived figure
// recomputed by home-derived, every other digit a <Num>. Topics the release has
// no data for are listed as "Coming soon", not linked.
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import Arrow from "@/components/ui/Arrow";
import Spark from "@/components/Spark";
import { Num } from "@/components/ui/Num";
import { DerivedValue, ShortValue } from "@/components/home/Bits";
import { dirOf } from "@/components/home/Cards";
import { compare, latestShown } from "@/components/home/derive";
import { mainKind } from "@/components/home/Topic";
import { topicHref, topics, type Topic } from "@/components/home/editorial";
import { basis } from "@/components/indicators/Basis";
import { db, library, seriesHref, sourceHref, type Observation, type Series } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { seriesTitle } from "@/lib/titles";
import { SOON_TOPICS } from "./soon";
import calendar from "../../../editorial/calendar.json";

export const FREQ_WORDS: Record<string, string> = { month: "Monthly", fiscal_year: "Yearly", year: "Yearly", quarter: "Quarterly", survey_round: "Each survey" };

/** Sticky list of every topic: the ones with data linked, the rest "Coming soon". */
export function TopicNav({ current }: { current?: string }) {
  return (
    <nav className="tp5-nav" aria-label="Topics">
      <h2>All topics</h2>
      <ul>
        {topics().map((t) => (
          <li key={t.slug}>
            <Link href={topicHref(t.slug)} aria-current={t.slug === current ? "page" : undefined}>
              {t.name}
            </Link>
          </li>
        ))}
        {SOON_TOPICS.map((n) => (
          <li key={n} className="tp5-soon">
            <span>{n}</span>
            <span className="tp5-soon-tag">Coming soon</span>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function latestOf(s: Series): Observation | undefined {
  return latestShown(db().obsBySeries.get(s.series_id) ?? [], mainKind(s)).latest;
}

/** Up to four headline series: the topic's own headline first, then its first indicators. */
export function headSeries(t: Topic): Series[] {
  const out: Series[] = [];
  for (const s of [...t.headline, ...t.groups.flatMap((g) => g.series)]) {
    if (out.length >= 4) break;
    // No figure nobody signed off in the headline tiles (decision 17.1; home-derived checks ul.hc-grid).
    const o = latestOf(s);
    if (!out.some((x) => x.series_id === s.series_id) && o && o.reader?.key !== "candidate") out.push(s);
  }
  return out;
}

export function HeadTiles({ series }: { series: Series[] }) {
  if (!series.length) return null;
  return (
    <ul className="hc-grid" data-n={series.length}>
      {series.map((s) => {
        const all = db().obsBySeries.get(s.series_id) ?? [];
        const o = latestOf(s)!;
        const cmp = compare(s, o, all);
        return (
          <li key={s.series_id}>
            <Link href={seriesHref(s.series_id)} className="tp5-tile-n">
              {seriesTitle(s)}
            </Link>
            <span className="tp5-tile-v">
              <ShortValue o={o} series={s} />
            </span>
            <span className="tp5-tile-d">
              {basis(o, s)}
              {cmp.kind === "change" ? (
                <>
                  <br />
                  <Arrow dir={dirOf(cmp.derived)} label={false} /> <DerivedValue d={cmp.derived} /> on <Num kind="period">{periodWords(cmp.base.period, s.frequency)}</Num>
                </>
              ) : null}
            </span>
            <span className="tp5-tile-s" aria-hidden="true">
              <Spark series={s} width={120} height={28} link={false} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

type CalEntry = { id: string; name: string; when: string; status: string };
const CAL_PREFIX: Record<string, string> = { cpi: "cpi-", abs: "budget-", lfs: "lfs-" };

/** The next expected edition of the publication a series is read from, if the calendar lists one. */
function nextFor(s: Series): ReactNode {
  const pre = CAL_PREFIX[s.dataset];
  if (!pre) return null;
  const e = (calendar.entries as CalEntry[]).filter((x) => x.id.startsWith(pre)).sort((a, b) => a.when.localeCompare(b.when))[0];
  if (!e) return null;
  return (
    <>
      Next: {e.status === "announced" ? "" : "expected "}
      <Num kind="ui">{e.status === "announced" ? e.when : periodWords(e.when, "month")}</Num>
    </>
  );
}

/** One indicator row; data-name and data-freq feed the client filter. */
export function IndicatorRow({ s }: { s: Series }) {
  const o = latestOf(s);
  const d = db();
  const cell = o?.primary_cell_id ? d.cellById.get(o.primary_cell_id) : undefined;
  const doc = cell ? library().documents.find((x) => x.id === cell.source_id) : undefined;
  const freq = FREQ_WORDS[s.frequency ?? ""] ?? null;
  const next = nextFor(s);
  return (
    <tr data-name={seriesTitle(s).toLowerCase()} data-freq={freq ?? ""}>
      <td className="tp5-r-name">
        <Link href={seriesHref(s.series_id)} className="strong">
          {seriesTitle(s)}
        </Link>
        {doc ? (
          <span className="tp5-r-src">
            {doc.publisher} · {doc.kindName}
          </span>
        ) : null}
      </td>
      <td className="tp5-r-spark" aria-hidden="true">
        <Spark series={s} width={72} height={20} link={false} />
      </td>
      <td className="tp5-r-v">
        {o ? (
          <>
            <ShortValue o={o} series={s} />
            <span className="tp5-r-p">{basis(o, s)}</span>
          </>
        ) : (
          <span className="tp5-r-p">No checked figure yet</span>
        )}
      </td>
      <td className="tp5-r-f">
        {freq}
        {next ? (
          <>
            <br />
            {next}
          </>
        ) : null}
      </td>
    </tr>
  );
}

/** Documents that hold at least one figure of the topic's series, newest first. */
export function TopicDocs({ series }: { series: Series[] }) {
  const ids = new Set(series.map((s) => s.series_id));
  const docs = library()
    .documents.filter((d) => d.state === "read" && d.seriesIds.some((x) => ids.has(x)))
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 8);
  if (!docs.length) return <p className="muted">No document yet.</p>;
  const freq = (p: string) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(p) ? "month" : "");
  return (
    <ul className="tp5-list">
      {docs.map((d) => (
        <li key={d.id}>
          <Link href={sourceHref(d.id)}>
            {d.kindName} <Num kind="period">{periodWords(d.period, freq(d.period))}</Num>
          </Link>
          <span className="muted">{d.publisher}</span>
        </li>
      ))}
    </ul>
  );
}
