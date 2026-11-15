// Headline cards (DESIGN.md 9.2 item 3): answer first. Reader name; period
// and kind of figure in words; the value in short scale; the change against the
// comparable figure (like with like); a source marker. The whole card links to
// the series; the value links to its receipt (or the one-tap sheet), the
// marker to the document. Candidates never appear here (decision 17.1).
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import { Num } from "@/components/ui/Num";
import { db, seriesHref, type Observation, type Series } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { DerivedInline, DerivedNotes, kindPeriod, PageWords, ShortValue, SourceMarker } from "./Bits";
import { compare, latestShown, showable, type Comparison } from "./derive";

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

/** The change line under a value. `long` adds the reason when there is no change to show. */
export function changeLine(cmp: Comparison, series: Series, words: PageWords, notes: DerivedNotes, what: string): ReactNode {
  if (cmp.kind === "none") return null;
  const base = baseWords(cmp.base, series, words);
  if (cmp.kind === "change") {
    const id = notes.add(cmp.derived, what);
    return (
      <>
        <DerivedInline d={cmp.derived} id={id} /> on {base}
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
          The <Num kind="period">{periodWords(revisedLater.period, c.series.frequency)}</Num> figure was later revised:{" "}
          <ShortValue o={revisedLater} series={c.series} /> ({words.kind("re")})
        </p>
      ) : null}
      <p className="hc-src">
        <SourceMarker o={latest} />
      </p>
    </li>
  );
}
