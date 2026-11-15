// Headline cards (DESIGN.md 9.2 item 3; round 2 items 17 and 18): answer first.
// Reader name; period and kind of figure in words; the value big and navy in
// short scale; the change against the comparable figure (like with like) with
// an arrow and words in neutral ink; one plain sentence saying what the figure
// is (the series summary from editorial/titles.json); a source marker. The
// whole card links to the series; the value links to its receipt (or the
// one-tap sheet), the marker to the document. Candidates never appear here
// (decision 17.1). Topic cards (home) carry the topic's headline figure and a
// sparkline of its checked values.
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import Arrow, { type ArrowDir } from "@/components/ui/Arrow";
import Spark from "@/components/Spark";
import { Num } from "@/components/ui/Num";
import { db, seriesHref, type Observation, type Series } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { seriesSummary, seriesTitle } from "@/lib/titles";
import { DerivedInline, DerivedNotes, kindPeriod, PageWords, ShortValue, SourceMarker } from "./Bits";
import { compare, latestShown, showable, type Comparison, type Derived } from "./derive";
import { topicHref, type Topic } from "./editorial";
import { mainKind } from "./Topic";

/** "the 2025-26 BE", "June 2025", "the 2020-21 round": the comparable figure in words. */
export function baseWords(base: Observation, series: Series, words: PageWords): ReactNode {
  const p = <Num kind="period">{periodWords(base.period, series.frequency)}</Num>;
  if (base.kind === "be" || base.kind === "re")
    return (
      <>
        the {p} {words.kind(base.kind)}
      </>
    );
  if (base.kind === "survey_round") return <>the {p} round</>;
  return p;
}

/** Which way a derived change goes, from its own text ("up 17.1%", "−0.49%", "unchanged"). */
export function dirOf(d: Derived): ArrowDir {
  const t = d.text;
  if (t.startsWith("up") || t.startsWith("+")) return "up";
  if (t.startsWith("down") || t.startsWith("−")) return "down";
  return "flat";
}

/** The change line under a value, with its arrow (neutral ink, never red or green). */
export function changeLine(cmp: Comparison, series: Series, words: PageWords, notes: DerivedNotes, what: string): ReactNode {
  if (cmp.kind === "none") return null;
  const base = baseWords(cmp.base, series, words);
  if (cmp.kind === "change") {
    const id = notes.add(cmp.derived, what);
    return (
      <>
        <Arrow dir={dirOf(cmp.derived)} label={false} />
        <DerivedInline d={cmp.derived} id={id} href={notes.href(id)} /> on {base}
      </>
    );
  }
  if (cmp.kind === "break") return <>Not compared with {base}: the series breaks between them.</>;
  return <>No change shown: {base} is {cmp.base.reader.word || "not shown"}.</>;
}

export function headlineCard(c: { series: Series; kind: string; name: string }, words: PageWords, notes: DerivedNotes): ReactNode {
  const all = db().obsBySeries.get(c.series.series_id) ?? [];
  const { latest } = latestShown(all, c.kind);
  if (!latest) return null;
  const cmp = compare(c.series, latest, all);
  const kp = kindPeriod(latest, c.series, words, true);
  const chg = changeLine(cmp, c.series, words, notes, `${c.name}: change on the comparable figure`);
  // A budget estimate compared with last year's budget estimate can hide that last
  // year was later revised a long way (tester finding): say the revised figure too.
  const revisedLater =
    cmp.kind === "change" && cmp.base.kind === "be"
      ? all.find((o) => o.period === cmp.base.period && o.kind === "re" && showable(o) && o.reader.key !== "candidate")
      : undefined;
  const summary = seriesSummary(c.series);
  return (
    <li className="hc" key={c.series.series_id}>
      <h3 className="hc-name">
        <Link href={seriesHref(c.series.series_id)} className="hc-link">
          {c.name}
        </Link>
      </h3>
      <p className="hc-kind">{kp}</p>
      <p className="hc-v">
        <ShortValue o={latest} series={c.series} />
      </p>
      {chg ? <p className="hc-chg">{chg}</p> : null}
      {revisedLater ? (
        <p className="hc-rev">
          The <Num kind="period">{periodWords(revisedLater.period, c.series.frequency)}</Num> figure was later revised to{" "}
          <ShortValue o={revisedLater} series={c.series} /> ({words.kind("re")}).
        </p>
      ) : null}
      {summary ? <p className="hc-ans">{summary}</p> : null}
      <p className="hc-src">
        <SourceMarker o={latest} />
      </p>
    </li>
  );
}

/** A topic on the home page: its name and line, then one headline figure (a value link), its period and kind, and a sparkline of checked values. */
export function topicCard(t: Topic, words: PageWords, avoid: Set<string>): ReactNode {
  // The topic's first headline series not already among the headline cards above; else its first.
  const s = t.headline.find((x) => !avoid.has(x.series_id)) ?? t.headline[0] ?? t.groups[0]?.series[0];
  const latest = s ? latestShown(db().obsBySeries.get(s.series_id) ?? [], mainKind(s)).latest : undefined;
  return (
    <li className="tc" key={t.slug}>
      <h3 className="tc-name">
        <Link href={topicHref(t.slug)} className="tc-link">
          {t.name}
        </Link>
      </h3>
      {s && latest ? (
        <div className="tc-fig">
          <p className="tc-series">{seriesTitle(s)}</p>
          <p className="tc-v">
            <ShortValue o={latest} series={s} />
          </p>
          <div className="tc-row">
            <p className="tc-kind">{kindPeriod(latest, s, words, true)}</p>
            <span className="tc-spark" aria-hidden="true">
              <Spark series={s} width={96} height={28} link={false} />
            </span>
          </div>
        </div>
      ) : null}
      <p className="tc-short">{t.short}</p>
    </li>
  );
}
