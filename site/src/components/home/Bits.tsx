// Small pieces shared by the home, topic and answer pages: the words for a
// kind of figure (full the first time on a page, BE and RE after: DESIGN.md
// 6.2), a value in headline form with its unit, a source marker, a derived
// figure with a link to how it was computed, and the list of those
// computations at the foot of the page.
import Link from "@/components/ui/Link";
import { Num, V } from "@/components/ui/Num";
import type { KindKey } from "@/lib/adapter/contract";
import { db, obsHref, pageShort, sourceHref, type Observation, type Series } from "@/lib/data";
import { periodWords, unitLabel } from "@/lib/format";
import { baseYearOf } from "@/lib/stats";
import { KIND } from "@/lib/words";
import type { ReactNode } from "react";
import type { Derived } from "./derive";

/* ---------- words for kinds of figure, per page ---------- */

/** Tracks which abbreviations a page has introduced. Create one per page and use it in document order. */
export class PageWords {
  private used = new Set<string>();
  /** "budget estimate" the first time, "BE" after; other kinds always in full. */
  kind(k: KindKey | string): string {
    const w = KIND[k as KindKey];
    if (!w) return String(k).replaceAll("_", " ");
    if (k === "be" || k === "re") {
      if (this.used.has(k)) return w.short;
      this.used.add(k);
    }
    return w.long;
  }
  /** Mark a kind as introduced (when the full words appear in text written by hand). */
  introduce(k: KindKey) {
    this.used.add(k);
  }
}

/** "budget estimate 2026-27", "June 2026", "survey round 2024-25". A plain function, called in document order, so the words are decided when it is called. */
export function kindPeriod(o: Observation, series: Series, words: PageWords, capital?: boolean): ReactNode {
  const period = <Num kind="period">{periodWords(o.period, series.frequency)}</Num>;
  if (o.kind === "be" || o.kind === "re" || o.kind === "actual" || o.kind === "provisional") {
    const w = words.kind(o.kind);
    return (
      <>
        {capital ? w.charAt(0).toUpperCase() + w.slice(1) : w} {period}
      </>
    );
  }
  if (o.kind === "survey_round")
    return (
      <>
        {capital ? "Survey round" : "survey round"} {period}
      </>
    );
  if (o.kind === "change_yoy")
    return (
      <>
        {period}, change over a year
      </>
    );
  return period;
}

/* ---------- values ---------- */

/** Unit words a short-scale value does not already carry. */
export function unitAfterShort(s: Series): string | null {
  if (s.unit === "PKR" || s.unit === "percent" || s.unit === "persons") return null;
  return unitLabel(s.unit, s.scale_factor) || null;
}

/** The headline form of a figure ("Rs 37.4 billion"), linked to its receipt (or the one-tap sheet), with any unit words it lacks. */
export function ShortValue({ o, series, className }: { o: Observation; series: Series; className?: string }) {
  const extra = unitAfterShort(series);
  const base = series.unit === "index" ? baseYearOf(series) : null;
  return (
    <span className={className}>
      <V o={o} short sheet className="v-link" />
      {extra ? (
        <span className="v-unit">
          {" "}
          {extra}
          {base ? (
            <>
              {" "}
              (<Num kind="period">{base}</Num> = <Num kind="ui">100</Num>)
            </>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/* ---------- source marker ---------- */

const DOC_ABBR: Record<string, string> = {
  abs: "Annual Budget Statement",
  cpi_monthly_review: "PBS price review",
  lfs_annual_report: "Labour Force Survey",
  pes_chapter: "Economic Survey",
  sbp_easydata: "SBP EasyData",
};

/** "Annual Budget Statement 2026-27, p. 17": the document and page the figure is printed on, linked to the document. */
export function SourceMarker({ o, className = "src-marker" }: { o: Observation; className?: string }) {
  const d = db();
  const cell = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : undefined;
  const src = cell ? d.sourceById.get(cell.source_id) : undefined;
  if (!cell || !src) return null;
  const freq = /^\d{4}-\d{2}$/.test(src.period) && Number(src.period.slice(5)) <= 12 && src.doc_type !== "abs" && src.doc_type !== "lfs_annual_report" ? "month" : null;
  return (
    <span className={className}>
      <span className="sr-only">Printed in </span>
      <Link href={sourceHref(src.source_id)}>
        {DOC_ABBR[src.doc_type] ?? src.doc_type} <Num kind="period">{periodWords(src.period, freq)}</Num>, <Num kind="page">{pageShort(cell)}</Num>
      </Link>
    </span>
  );
}

/* ---------- derived figures ---------- */

/** Collects the derived figures of one page, numbered in order, for the "how these were computed" list. */
export class DerivedNotes {
  readonly items: { id: string; d: Derived; what: string }[] = [];
  constructor(private prefix = "drv") {}
  add(d: Derived, what: string): string {
    const id = `${this.prefix}-${this.items.length + 1}`;
    this.items.push({ id, d, what });
    return id;
  }
}

/** The figure itself, marked for scripts/check-build.mjs (data-num="derived": recomputed by scripts/checks/home-derived.mjs). */
export function DerivedValue({ d }: { d: Derived }) {
  return (
    <span className="drv-v" data-num="derived" data-derived={d.formula} data-fmt={d.fmt} data-inputs={d.inputs.map((o) => o.obs_id).join(" ")}>
      {d.text}
    </span>
  );
}

/** A derived figure with its "how" link (one tap to the formula and inputs). */
export function DerivedInline({ d, id }: { d: Derived; id: string }) {
  return (
    <span className="drv">
      <DerivedValue d={d} />
      <a className="drv-how" href={`#${id}`} aria-label="How this was computed">
        <span aria-hidden="true">how</span>
      </a>
    </span>
  );
}

const FORMULA_WORDS: Record<string, string> = {
  pct: "(later figure − earlier figure) ÷ earlier figure",
  pp: "later rate − earlier rate, in percentage points",
  "mean-rev": "average over the years of (revised estimate − budget estimate) ÷ budget estimate",
  "mean-abs-rev": "average over the years of the size of (revised estimate − budget estimate) ÷ budget estimate, ignoring its sign",
  "n-pairs": "years with both a checked budget estimate and a checked revised estimate",
};

function InputList({ inputs }: { inputs: Observation[] }) {
  const d = db();
  return (
    <>
      {inputs.map((o, i) => {
        const s = d.seriesById.get(o.series_id);
        return (
          <span key={o.obs_id}>
            {i > 0 ? "; " : ""}
            <Num kind="period">{periodWords(o.period, s?.frequency)}</Num>
            {o.kind === "be" || o.kind === "re" ? ` ${KIND[o.kind].short}` : ""}: <V o={o} /> {unitLabel(o.unit, o.scale_factor)}
          </span>
        );
      })}
    </>
  );
}

/** The foot-of-page list: what each derived figure is, its formula and its inputs (each linked to its receipt). */
export function DerivedList({ notes, title = "How the changes on this page are computed" }: { notes: DerivedNotes; title?: string }) {
  if (notes.items.length === 0) return null;
  return (
    <section className="drv-list" aria-labelledby="drv-h">
      <h2 id="drv-h">{title}</h2>
      <p className="small muted">
        Computed when the site is built, only from figures that passed their checks; a change from a figure that did not is not computed. Percentages are
        rounded to one decimal place below ten per cent and to whole per cent above.
      </p>
      <ol>
        {notes.items.map(({ id, d, what }) => (
          <li key={id} id={id}>
            <strong>
              <DerivedValue d={d} />
            </strong>{" "}
            {what}. Formula: {FORMULA_WORDS[d.formula]}. {d.formula === "n-pairs" || d.formula.startsWith("mean") ? "Pairs" : "Inputs"}: <InputList inputs={d.inputs} />.
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- status of a figure that is not shown ---------- */

/** "survey round 2018-19: not checked yet" in words, for figures newer than the one shown. */
export function NotShownList({ list, series }: { list: Observation[]; series: Series }) {
  return (
    <>
      {list.map((o, i) => (
        <span key={o.obs_id}>
          {i > 0 ? (i === list.length - 1 ? " and " : ", ") : ""}
          <Link href={obsHref(o.obs_id)}>
            <Num kind="period">{periodWords(o.period, series.frequency)}</Num> ({o.reader.word || "no value"})
          </Link>
        </span>
      ))}
    </>
  );
}
