// Answer sentences (DESIGN.md 9.4), generated from a template and the release.
// One part of an answer: the first sentence (the answer, with its date and
// kind of figure), the comparison with the like figure, the revision as its
// own labelled sentence, the source marker and the chart. Nothing is added up.
import type { ReactNode } from "react";
import { seriesTitle } from "@/lib/titles";
import Chart from "@/components/Chart";
import Link from "@/components/ui/Link";
import Arrow from "@/components/ui/Arrow";
import PrintedPagePill from "@/components/ui/PrintedPagePill";
import { Num } from "@/components/ui/Num";
import { chartModelFrom, obsSlug } from "@/lib/chart-model";
import { datasetName, db, obsHref, seriesHref, type Observation, type Series } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { DerivedInline, DerivedNotes, kindPeriod, NotShownList, PageWords, ShortValue, SourceMarker } from "./Bits";
import { baseWords, dirOf } from "./Cards";
import { change, compare, latestRevision, latestShown, showable } from "./derive";
import type { QuestionPart } from "./editorial";

const P = ({ o, s }: { o: Observation; s: Series }) => <Num kind="period">{periodWords(o.period, s.frequency)}</Num>;

/** The answer itself: "The federal budget estimate for 2026-27 for current spending on health (revenue account) is Rs 37.4 billion." */
function firstSentence(part: QuestionPart, o: Observation, words: PageWords): ReactNode {
  const s = part.series;
  const v = <ShortValue o={o} series={s} className="ans-v" />;
  switch (o.kind) {
    case "be":
    case "re":
      return (
        <>
          The federal {words.kind(o.kind)} for <P o={o} s={s} /> for {part.label} is {v}.
        </>
      );
    case "change_yoy":
      return (
        <>
          {part.subject} in <P o={o} s={s} /> was {v}: the change in {part.label} over the same month a year earlier.
        </>
      );
    case "survey_round":
      return (
        <>
          {part.subject} was {v} in the <P o={o} s={s} /> round of the {datasetName(s.dataset)} ({part.label}).
        </>
      );
    case "index":
      return (
        <>
          {part.subject} stood at {v} in <P o={o} s={s} /> ({part.label}).
        </>
      );
    case "weight":
      return (
        <>
          {part.subject} have a weight of {v} in <P o={o} s={s} /> ({part.label}).
        </>
      );
    default:
      return (
        <>
          {part.subject} for <P o={o} s={s} /> is {v}.
        </>
      );
  }
}

function comparisonSentence(s: Series, o: Observation, all: Observation[], words: PageWords, notes: DerivedNotes, what: string): ReactNode {
  const cmp = compare(s, o, all);
  if (cmp.kind === "none") return <>This release holds no earlier figure of the same kind to compare it with.</>;
  const base = baseWords(cmp.base, s, words);
  const baseV = showable(cmp.base) ? (
    <>
      {" "}
      (<ShortValue o={cmp.base} series={s} />)
    </>
  ) : null;
  if (cmp.kind === "change") {
    const id = notes.add(cmp.derived, what);
    return (
      <>
        <Arrow dir={dirOf(cmp.derived)} label={false} />
        Compared with {base}
        {baseV}, that is <DerivedInline d={cmp.derived} id={id} />.
      </>
    );
  }
  if (cmp.kind === "break")
    return (
      <>
        It is not compared with {base}
        {baseV}, because the series breaks in between: <Num kind="text">{cmp.note}</Num>
      </>
    );
  return (
    <>
      It is not compared with {base}: that figure is {cmp.base.reader.word || "not shown"}. {cmp.base.reader.reason}
    </>
  );
}

function revisionSentence(s: Series, all: Observation[], words: PageWords, notes: DerivedNotes, what: string): ReactNode {
  const r = latestRevision(all);
  if (!r) return null;
  const d = db();
  const reSrc = r.re.primary_cell_id ? d.sourceById.get(d.cellById.get(r.re.primary_cell_id)?.source_id ?? "") : undefined;
  const be = words.kind("be");
  const reWord = words.kind("re");
  if (!showable(r.re))
    return (
      <>
        The latest {reWord} in this release, for <P o={r.re} s={s} />, is {r.re.reader.word || "not shown"}: {r.re.reader.reason}
      </>
    );
  const printed = reSrc ? (
    <>
      , printed in the <Num kind="text">{reSrc.title}</Num>
    </>
  ) : null;
  if (!r.be || !showable(r.be))
    return (
      <>
        The {reWord} for <P o={r.re} s={s} />
        {printed}, is <ShortValue o={r.re} series={s} />. {r.be ? <>Its {be} is {r.be.reader.word || "not shown"}, so the revision is not computed.</> : <>This release has no {be} for that year to compare it with.</>}
      </>
    );
  const dd = change(r.be, r.re);
  const id = dd ? notes.add(dd, what) : null;
  return (
    <>
      The <P o={r.be} s={s} /> {be} was <ShortValue o={r.be} series={s} />; the {reWord} for the same year{printed}, is <ShortValue o={r.re} series={s} />
      {dd && id ? (
        <>
          , <DerivedInline d={dd} id={id} />
        </>
      ) : (
        <>; the change is not computed because one of the two figures is not checked</>
      )}
      .
    </>
  );
}

/** One part of an answer, ready to render. `first` marks the page's opening sentence. */
export function answerPart(part: QuestionPart, words: PageWords, notes: DerivedNotes, opts: { first: boolean; multi: boolean }): ReactNode {
  const s = part.series;
  const all = (db().obsBySeries.get(s.series_id) ?? []).filter((o) => o.reader.key !== "candidate");
  const { latest, newer } = latestShown(all, part.kind);
  if (!latest) return null;
  const first = firstSentence(part, latest, words);
  const cmp = comparisonSentence(s, latest, all, words, notes, `${part.subject}: change on the comparable figure`);
  const rev = latest.kind === "be" ? revisionSentence(s, all, words, notes, `${part.subject}: change from budget to revised estimate`) : null;
  const model = chartModelFrom(s, all);
  // The label is in full words on its own (a fresh PageWords), so the answer sentence below still introduces BE and RE.
  const label = kindPeriod(latest, s, new PageWords(), true);
  return (
    <section className="ans-part" key={s.series_id} aria-label={part.heading ?? part.subject}>
      {opts.multi && !opts.first && part.heading ? <h2>{part.heading}</h2> : null}
      <div className={`numblock numblock--${opts.first ? "xl" : "l"} ans-block`}>
        <p className="numblock-label">
          {seriesTitle(s)} · {label}
        </p>
        <p className="numblock-value">
          <ShortValue o={latest} series={s} />
        </p>
        <p className={opts.first ? "ans-first" : "ans-sentence"} data-answer-part={s.series_id} data-answer-kind={part.kind}>
          <span>{first}</span>
        </p>
        <p className="numblock-change ans-cmp">{cmp}</p>
        {rev ? (
          <p className="ans-rev">
            <strong>Revision.</strong> {rev}
          </p>
        ) : null}
        <p className="ans-act">
          <PrintedPagePill href={obsHref(latest.obs_id)} sheet={obsSlug(latest.obs_id)} />
          <span className="ans-src">
            <SourceMarker o={latest} />
          </span>
        </p>
      </div>
      {newer.length ? (
        <p className="ans-newer">
          This is the latest checked figure. Newer figures of this kind are in the release but not shown: <NotShownList list={newer} series={s} />. {newer[newer.length - 1].reader.reason}
        </p>
      ) : null}
      <p className="ans-more small">
        <Link href={seriesHref(s.series_id)}>The whole series: table, every figure, downloads</Link>
      </p>
      <figure className="ans-chart">
        <Chart model={model} idBase={`ans-${s.series_id.replace(/[^a-z0-9]/gi, "-")}`} caption={seriesTitle(s)} />
        <figcaption className="small muted">
          Every point links to its receipt: the printed page it was read from.
        </figcaption>
      </figure>
    </section>
  );
}
