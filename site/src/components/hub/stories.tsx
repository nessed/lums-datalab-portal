// The stories, ticker items and ranked panels of the home page (data hub plan,
// sections 5 and 6), computed at build time from the release through db().
// editorial/stories.json only names series, kinds and patterns; every value is a
// <V> link to its receipt and every change or share is a derived figure
// (data-num="derived") recomputed by scripts/checks/home-derived.mjs (pct, pp)
// or scripts/checks/home-stories.mjs (share, and the "rose fastest" claim of a
// ranking). A story whose figures are not all checked is not built: no number,
// no sentence. Like with like: a budget estimate only against a budget estimate,
// and where that earlier budget estimate was later revised the sentence says so.
import type { ReactNode } from "react";
import storiesFile from "../../../editorial/stories.json";
import Arrow from "@/components/ui/Arrow";
import { Num, V } from "@/components/ui/Num";
import { db, isDatasetPublished, seriesHref, type Observation, type Series } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { DerivedValue, ShortValue, type DerivedNotes } from "@/components/home/Bits";
import { dirOf } from "@/components/home/Cards";
import { change, compare, latestShown, ofKind, share, showable, usable, type Derived } from "@/components/home/derive";
import { answerHref } from "@/components/home/editorial";

type StoryDef = {
  slug: string;
  pattern: "latest-vs-previous" | "change-over-years" | "rank-in-group" | "share-of-total";
  series?: string;
  total?: string;
  kind: string;
  subject?: string;
  whole?: string;
  group?: string;
  answer?: string;
  featured?: boolean;
};
type GroupDef = { heading: string; kind?: string; total: string; totalName?: string; noun?: string; note?: string; members: { series: string; name: string }[] };
type TickerDef = { series: string; kind: string; name: string };

const FILE = storiesFile as unknown as { stories: StoryDef[]; ticker: TickerDef[]; groups: Record<string, GroupDef> };

export type Story = {
  slug: string;
  featured: boolean;
  /** The one sentence. */
  sentence: ReactNode;
  /** The series whose trajectory is drawn, and the kind of figure drawn. */
  series: Series;
  kind: string;
  /** The figure the sentence leads with (its source marker goes under the chart). */
  lead: Observation;
  href: string;
  derived: Derived[];
};

/** A series the release holds in a visible dataset. */
function visible(id: string | undefined): Series | undefined {
  const s = id ? db().seriesById.get(id) : undefined;
  return s && isDatasetPublished(s.dataset) ? s : undefined;
}
const obsOf = (s: Series) => db().obsBySeries.get(s.series_id) ?? [];
const isKind = (o: Observation, kind: string) => o.kind === kind || o.vintage === kind;
const P = (o: Observation, s: Series) => <Num kind="period">{periodWords(o.period, s.frequency)}</Num>;

/** A derived figure in running text, collected (now, in order) for the page's list of how it was computed. */
function D(d: Derived, notes: DerivedNotes, what: string): ReactNode {
  notes.add(d, what);
  return <DerivedValue d={d} />;
}

/** "the 2025-26 budget estimate", "June 2025", "the 2020-21 survey round". */
function baseFull(o: Observation, s: Series): ReactNode {
  if (o.kind === "be") return <>the {P(o, s)} budget estimate</>;
  if (o.kind === "re") return <>the {P(o, s)} revised estimate</>;
  if (o.kind === "survey_round") return <>the {P(o, s)} survey</>;
  return P(o, s);
}

/** The latest figure, its change on the previous comparable one, and (for a budget estimate) what that earlier budget was revised to. */
function latestVsPrevious(def: StoryDef, notes: DerivedNotes): Story | null {
  const s = visible(def.series);
  if (!s) return null;
  const all = obsOf(s);
  const { latest } = latestShown(all, def.kind);
  if (!latest || !usable(latest)) return null;
  const cmp = compare(s, latest, all);
  if (cmp.kind !== "change") return null;
  const base = cmp.base;
  const derived = [cmp.derived];
  const re = base.kind === "be" ? all.find((o) => o.period === base.period && o.kind === "re") : undefined;
  // A revised estimate that exists but may not be used: the story cannot say the whole truth, so it is not built.
  if (re && !usable(re)) return null;
  const subj = def.subject ?? s.title;
  let sentence: ReactNode;
  if (latest.kind === "be")
    sentence = (
      <>
        {subj} is budgeted at <ShortValue o={latest} series={s} /> for {P(latest, s)},{" "}
        {D(cmp.derived, notes, `${subj}: change on the previous budget estimate`)} on the {P(base, s)} budget
        {re ? (
          <>
            , which was revised to <ShortValue o={re} series={s} />
          </>
        ) : null}
        .
      </>
    );
  else if (latest.kind === "change_yoy")
    sentence = (
      <>
        {subj} was <ShortValue o={latest} series={s} /> in {P(latest, s)}, {D(cmp.derived, notes, `${subj}: change on a year earlier`)} on{" "}
        <ShortValue o={base} series={s} /> in {P(base, s)}.
      </>
    );
  else
    sentence = (
      <>
        {subj} was <ShortValue o={latest} series={s} /> in {baseFull(latest, s)}, {D(cmp.derived, notes, `${subj}: change on the previous figure`)} on {baseFull(base, s)}.
      </>
    );
  return { slug: def.slug, featured: !!def.featured, sentence, series: s, kind: def.kind, lead: latest, href: def.answer ? answerHref(def.answer) : seriesHref(s.series_id), derived };
}

/** From the first checked figure of a kind after the series' last break to the latest: both checked, same kind. */
function changeOverYears(def: StoryDef, notes: DerivedNotes): Story | null {
  const s = visible(def.series);
  if (!s) return null;
  const list = ofKind(obsOf(s), def.kind).filter(showable).filter(usable);
  const last = list[list.length - 1];
  if (!last) return null;
  const brk = s.breaks.filter((b) => b.at_period <= last.period).sort((a, b) => a.at_period.localeCompare(b.at_period)).pop();
  const lastBreak = brk?.at_period;
  const first = list.find((o) => !lastBreak || o.period >= lastBreak);
  if (!first || first.period === last.period) return null;
  const d = change(first, last, "words");
  if (!d) return null;
  const subj = def.subject ?? s.title;
  const rupees = s.unit === "PKR";
  const sentence = (
    <>
      {subj}
      {def.kind === "be" ? ", as budgeted," : ""} went from <ShortValue o={first} series={s} /> in {P(first, s)} to <ShortValue o={last} series={s} /> in {P(last, s)}:{" "}
      {D(d, notes, `${subj}: change over the years, ${def.kind === "be" ? "budget estimate against budget estimate" : "same kind of figure"}`)}
      {rupees ? <> in rupees of each year, not adjusted for rising prices</> : null}
      {brk?.kind === "devolution" ? <>, counted from the first budget after the eighteenth amendment moved much spending to the provinces</> : null}.
    </>
  );
  return { slug: def.slug, featured: !!def.featured, sentence, series: s, kind: def.kind, lead: last, href: def.answer ? answerHref(def.answer) : seriesHref(s.series_id), derived: [d] };
}

export type GroupRow = { name: string; series: Series; o: Observation };
export type GroupFigures = { key: string; def: GroupDef; total: Series; totalObs: Observation; period: Observation; rows: GroupRow[]; missing: number };

/** A group of series at the latest period its total is checked, with every member checked at that period, largest first. */
export function groupFigures(key: string): GroupFigures | null {
  const def = FILE.groups[key];
  if (!def) return null;
  const total = visible(def.total);
  const kind = def.kind ?? "change_yoy";
  if (!total) return null;
  const { latest } = latestShown(obsOf(total), kind);
  if (!latest || !usable(latest)) return null;
  const rows: GroupRow[] = [];
  let missing = 0;
  for (const m of def.members) {
    const s = visible(m.series);
    const o = s ? obsOf(s).find((x) => x.period === latest.period && isKind(x, kind)) : undefined;
    if (s && o && usable(o)) rows.push({ name: m.name, series: s, o });
    else missing++;
  }
  // Number() orders the rows only; the figures shown are the printed values.
  rows.sort((a, b) => Number(b.o.value) - Number(a.o.value));
  return { key, def, total, totalObs: latest, period: latest, rows, missing };
}

/** "Transport prices rose fastest of all groups in June 2026": only when every group of the table is checked for that month. */
function rankInGroup(def: StoryDef): Story | null {
  const g = def.group ? groupFigures(def.group) : null;
  if (!g || g.missing || g.rows.length < 2) return null;
  const top = g.rows[0];
  if (Number(top.o.value) <= 0) return null;
  const sentence = (
    <span data-rank="max" data-rank-pick={top.o.obs_id} data-rank-of={g.rows.map((r) => r.o.obs_id).join(" ")}>
      {top.name} {g.def.noun ?? ""} rose fastest of all groups in {P(top.o, top.series)}: <ShortValue o={top.o} series={top.series} /> over a year, against{" "}
      <ShortValue o={g.totalObs} series={g.total} /> for {g.def.totalName ?? "the total"}.
    </span>
  );
  return { slug: def.slug, featured: !!def.featured, sentence, series: top.series, kind: def.kind, lead: top.o, href: def.answer ? answerHref(def.answer) : seriesHref(top.series.series_id), derived: [] };
}

/** The check that a part and a total belong to one passed sum (column total or hierarchy sum), in the same column. */
export function addUpCheck(part: Observation, total: Observation): string | null {
  const d = db();
  const partCells = new Set([part.primary_cell_id, ...part.supporting_cell_ids].filter(Boolean) as string[]);
  const totalCells = new Set([total.primary_cell_id, ...total.supporting_cell_ids].filter(Boolean) as string[]);
  for (const id of part.check_ids) {
    const c = d.checkById.get(id) as unknown as { check_type: string; result: string; target_cell_id: string | null; member_cell_ids: string[] } | undefined;
    if (!c || (c.result !== "pass" && c.result !== "pass_within_rounding")) continue;
    if (c.check_type !== "column_total" && c.check_type !== "hierarchy_sum") continue;
    if (c.target_cell_id && totalCells.has(c.target_cell_id) && c.member_cell_ids.some((m) => partCells.has(m))) return id;
  }
  return null;
}

/** "Defence is 17.2% of ...": the latest year both are checked and a passed sum links them. */
function shareOfTotal(def: StoryDef, notes: DerivedNotes): Story | null {
  const s = visible(def.series);
  const t = visible(def.total);
  if (!s || !t) return null;
  const parts = ofKind(obsOf(s), def.kind).filter(usable).reverse();
  for (const part of parts) {
    const total = obsOf(t).find((o) => o.period === part.period && o.vintage === part.vintage);
    if (!total || !usable(total)) continue;
    const chk = addUpCheck(part, total);
    if (!chk) continue;
    const d = share(part, total);
    if (!d) continue;
    const subj = def.subject ?? s.title;
    const sentence = (
      <span data-share-check={chk}>
        {subj} takes {D(d, notes, `${subj}: share of the total its sum check adds up to`)} of {def.whole ?? t.title} in the {P(part, s)} budget:{" "}
        <ShortValue o={part} series={s} /> of <ShortValue o={total} series={t} />.
      </span>
    );
    return { slug: def.slug, featured: !!def.featured, sentence, series: s, kind: def.kind, lead: part, href: def.answer ? answerHref(def.answer) : seriesHref(s.series_id), derived: [d] };
  }
  return null;
}

/** Every story the release can tell, in file order (the featured one first). */
export function stories(notes: DerivedNotes): Story[] {
  const out: Story[] = [];
  for (const def of FILE.stories) {
    const st =
      def.pattern === "latest-vs-previous"
        ? latestVsPrevious(def, notes)
        : def.pattern === "change-over-years"
          ? changeOverYears(def, notes)
          : def.pattern === "rank-in-group"
            ? rankInGroup(def)
            : def.pattern === "share-of-total"
              ? shareOfTotal(def, notes)
              : null;
    if (st) out.push(st);
  }
  return out.sort((a, b) => Number(b.featured) - Number(a.featured));
}

/* ---------- ticker ---------- */

export type TickerItem = { key: string; name: string; series: Series; o: Observation; change: Derived | null; base: Observation | null };

export function tickerItems(): TickerItem[] {
  const out: TickerItem[] = [];
  for (const t of FILE.ticker) {
    const s = visible(t.series);
    if (!s) continue;
    const all = obsOf(s);
    const { latest } = latestShown(all, t.kind);
    if (!latest) continue;
    const cmp = compare(s, latest, all, "signed");
    out.push({ key: `${t.series}:${t.kind}`, name: t.name, series: s, o: latest, change: cmp.kind === "change" ? cmp.derived : null, base: cmp.kind === "change" ? cmp.base : null });
  }
  return out;
}

/** One ticker item: name, value, arrow and the change (its basis for screen readers and on hover). */
export function TickerEntry({ it }: { it: TickerItem }) {
  return (
    <span className="tk-item">
      <span className="tk-name">{it.name}</span> <V o={it.o} short sheet className="v-link tk-v" />
      {it.change && it.base ? (
        <span className="tk-chg">
          {" "}
          <Arrow dir={dirOf(it.change)} />
          <DerivedValue d={it.change} />
          <span className="sr-only"> on {baseFull(it.base, it.series)}</span>
        </span>
      ) : null}
    </span>
  );
}

export { baseFull };
