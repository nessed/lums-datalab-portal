// The series page as the "Dataset" screen of the v3 design set (2026-11-23).
// Server components only. Every digit is a <V> (a checked value linked to its
// receipt), a <Num>, or a derived figure a check plug-in recomputes:
//   - the change in words in the headline ("up 8.0% on the 2025-26 budget
//     estimate") is Head.tsx's <Change> (home-derived.mjs "pct"/"pp", or
//     series-derived.mjs through <D>);
//   - "down 8.1%" from a budget estimate to the revised estimate of the same
//     year (Editions) is data-derived="pct" data-fmt="words" with the inputs
//     budget, then revised: home-derived.mjs already claims and recomputes it.
// Nothing here is copied from the design picture; a slot the release cannot
// fill is left out or says so in words.
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import Cite from "@/components/Cite";
import { Num, V } from "@/components/ui/Num";
import { StatusMark } from "@/components/ui/Status";
import { OriginText } from "@/components/actions/OriginText";
import { SelectSwitch } from "@/components/hub/Switch";
import { db, obsHref, RELEASE_VERSION, seriesHref, slugify, sourceHref, type Cell, type Observation, type Series, type Source } from "@/lib/data";
import { CHECK_TYPE_WORDS, decimalFraction, derivedDisplay, periodWords, unitLabel } from "@/lib/format";
import { decPctChange, KIND_RANK } from "@/lib/series-derive";
import { periodOfOrdinal, type ChartModel } from "@/lib/chart-model";
import { statusOf, visualKey, type StatusKey } from "@/lib/status";
import { ancestors, latestPublished } from "@/lib/stats";
import { seriesTitle } from "@/lib/titles";
import { absoluteUrl, fileHref, latestFileHref, seriesFiles, sizeText } from "@/lib/take";
import { VERSION_FILES } from "@/lib/take-columns";
import { breakWords, KIND, READER_STATUS, shortScale } from "@/lib/words";
import { Change, isStage, KindPeriodWords } from "./Head";
import { PeriodsIn } from "./Parts";
import { hasBudgetPair, kindLong, markerOf, type Answer } from "./model";

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** May a figure feed a derived value checked by home-derived.mjs (checked, in a signed-off dataset)? */
function usable(o: Observation | undefined): o is Observation {
  if (!o) return false;
  const ds = db().seriesById.get(o.series_id)?.dataset ?? "";
  return o.reader.usableInDerived && o.reader.showsValue && o.published && o.value !== null && o.status === "checked" && db().release.dataset_status?.[ds]?.state === "published";
}
const shows = (o: Observation | undefined): o is Observation => !!o && o.reader.showsValue && o.published && o.value !== null;
/** The same test, without narrowing the type (for an early return followed by a fallback). */
const showsValue = (o: Observation): boolean => shows(o);

/* ---------- small pieces ---------- */

/** The page reference chip: the printed page label, a link to the figure's receipt (the crop of that page). */
export function PageRef({ o, cell, doc }: { o: Observation; cell?: Cell | null; doc?: string }) {
  const c = cell ?? (o.primary_cell_id ? db().cellById.get(o.primary_cell_id) : undefined);
  if (!c) return null;
  const label = `p. ${c.page_label ?? c.page}`;
  return (
    <Link href={obsHref(o.obs_id)} className="ds-ref" data-sheet={slugify(o.obs_id)} aria-label={`Printed on page ${c.page_label ?? c.page}${doc ? ` of ${doc}` : ""}: see it on the page`}>
      <Num kind="page">{label}</Num>
    </Link>
  );
}

/**
 * The headline figure, big: the short form (DESIGN.md 6.3) split so the unit
 * words sit small beside the numeral. The same link and attributes as <V short>
 * (data-v, data-v-fmt="short"): check-build joins the parts and recomputes it.
 */
function BigFigure({ o, label }: { o: Observation; label: string }) {
  const text = shortText(o);
  const m = /^(−?(?:Rs )?)(\d[\d.,]*)(.*)$/.exec(text);
  const candidate = o.reader.key === "candidate";
  const link = (
    <Link href={obsHref(o.obs_id)} className="v-link ds-big" data-v="" data-v-fmt="short" data-sheet={slugify(o.obs_id)} {...(candidate ? { "data-candidate": "" } : {})} aria-label={`${text}, ${label}, see where it is printed${candidate ? ", not signed off" : ""}`}>
      {m ? (
        <>
          {m[1] ? <span className="ds-big-u">{m[1]}</span> : null}
          <span className="ds-big-n">{m[2]}</span>
          {m[3] ? <span className="ds-big-u">{m[3]}</span> : null}
        </>
      ) : (
        <span className="ds-big-n">{text}</span>
      )}
    </Link>
  );
  if (!candidate) return link;
  return (
    <span className="v-candidate">
      {link} <span className="v-mark">not signed off</span>
    </span>
  );
}

function shortText(o: Observation): string {
  return shortScale(o.value!, o.unit, o.scale_factor);
}

function sourceOf(o: Observation): { cell: Cell; source: Source } | null {
  const d = db();
  const cell = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : undefined;
  const source = cell ? d.sourceById.get(cell.source_id) : undefined;
  return cell && source ? { cell, source } : null;
}

/* ---------- 1. the sentence heading (starts with the plain title: scripts/checks/titles.mjs) ---------- */

export function TitleSentence({ series, latest }: { series: Series; latest: Observation | null }) {
  const title = seriesTitle(series);
  if (!latest) return <h1 className="ds-h1">{title}</h1>;
  const v = <V o={latest} short sheet />;
  const when = <Num kind="period">{periodWords(latest.period, series.frequency)}</Num>;
  const src = sourceOf(latest);
  let body: ReactNode;
  if (latest.kind === "be") body = <> is budgeted at {v} for {when}</>;
  else if (latest.kind === "re") body = <> is {v} in the revised estimate for {when}</>;
  else if (isStage(latest)) body = <> was {v} in {when} ({kindLong(latest)})</>;
  else if (series.frequency === "survey_round")
    body = (
      <>
        : {v} in the <Num kind="period">{latest.period}</Num> survey
      </>
    );
  else body = <>: {v} in {when}</>;
  return (
    <h1 className="ds-h1">
      {title}
      {body}
      {src ? (
        <span className="ds-h1-src">
          {" "}
          (<span>{src.source.title}</span>, <PageRef o={latest} doc={src.source.title} />)
        </span>
      ) : null}
      .
    </h1>
  );
}

/* ---------- 2. headline block and its facts ---------- */

function revisedOf(o: Observation): Observation | undefined {
  if (o.vintage !== "be") return undefined;
  const re = (db().obsBySeries.get(o.series_id) ?? []).find((x) => x.period === o.period && x.vintage === "re");
  return shows(re) ? re : undefined;
}

const CHECK_PLAIN: Record<string, string> = {
  column_total: "the column adds up to its printed total",
  row_total: "the row adds up to its printed total",
  hierarchy_sum: "its parts add up to it",
  cross_edition: "the next edition prints the same figure",
  cross_table: "another table of the same document prints the same figure",
  accounting_identity: "it adds up with the lines beside it to a printed total",
  cross_source: "another official publication prints the same figure",
  recompute: "it can be recomputed from other printed figures",
  weights_sum: "the weights add up",
  index_aggregation: "the group indices add up to the overall index",
  reference_value: "it matches a recorded reference value",
};

function checkedWords(o: Observation): string[] {
  const d = db();
  const types: string[] = [];
  for (const id of o.check_ids) {
    const c = d.checkById.get(id);
    if (!c || !(c.result === "pass" || c.result === "pass_within_rounding")) continue;
    if (!types.includes(c.check_type)) types.push(c.check_type);
  }
  return types.map((t) => CHECK_PLAIN[t] ?? (CHECK_TYPE_WORDS[t] ?? t.replaceAll("_", " ")).toLowerCase());
}

function andList(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join("; ")}; and ${xs[xs.length - 1]}`;
}

/** `part` (Home v3 pages set, 2026-11-24): "num" the figure only (main column), "facts" the facts only (side panel, "About this indicator"), "both" as before. */
export function HeadlineBlock({ series, answer, part = "both" }: { series: Series; answer: Answer; part?: "num" | "facts" | "both" }) {
  const d = db();
  const { latest, newer } = answer;
  const unit = unitLabel(series.unit, series.scale_factor);
  const title = seriesTitle(series);
  if (!latest) {
    if (part === "facts") return null;
    return (
      <section className="ds-head" aria-label="Latest figure">
        <div className="ds-num">
          <p className="ds-num-l">Latest figure</p>
          <p className="ds-none">No checked figure in this release.</p>
          {newer ? (
            <p className="ds-newer">
              <StatusMark k={visualKey(newer.reader)} /> The newest, <KindPeriodWords o={newer} series={series} />, is {newer.reader.word || "not shown"}: {newer.reader.reason}
            </p>
          ) : null}
          <p className="ds-small">Every figure is listed under Table with its reason.</p>
        </div>
      </section>
    );
  }
  const src = sourceOf(latest);
  const re = revisedOf(answer.change?.against ?? latest);
  const against = answer.change?.against;
  const againstRe = against ? revisedOf(against) : undefined;
  const words = checkedWords(latest);
  const checked = latest.reader.key === "checked" || latest.reader.key === "checked-note";
  const asOf = (d.release.created_at ?? "").slice(0, 10);
  const kindLine = kindLong(latest);
  const num = (
      <div className="ds-num">
        <p className="ds-num-l">
          {title}, <KindPeriodWords o={latest} series={series} />
        </p>
        <p className="ds-num-v">
          <BigFigure o={latest} label={`${kindLine ? `${kindLine} ` : ""}${periodWords(latest.period, series.frequency)}`} />
        </p>
        {src ? (
          <p className="ds-printed">
            Printed as <V o={latest} cell={{ cell_id: src.cell.cell_id, value_raw: src.cell.value_raw }} sheet className="v-link ds-printed-v" /> {unit}
            {latest.reader.key === "checked-note" ? "; the document attaches a note" : ""}
          </p>
        ) : null}
        {answer.change ? (
          <p className="ds-change">
            <Change series={series} answer={answer} />
            {against && shows(against) ? (
              <>
                , which was <V o={against} short sheet />
                {againstRe ? (
                  <>
                    , later revised to <V o={againstRe} short sheet />
                  </>
                ) : null}
              </>
            ) : null}
            .
          </p>
        ) : answer.noChange ? (
          <p className="ds-change">
            No change shown: <PeriodsIn text={answer.noChange} />
          </p>
        ) : null}
        {re && re.obs_id !== latest.obs_id && !answer.change ? (
          <p className="ds-change">
            Later revised to <V o={re} short sheet />.
          </p>
        ) : null}
        {newer ? (
          <p className="ds-newer">
            <StatusMark k={visualKey(newer.reader)} /> The newer <KindPeriodWords o={newer} series={series} /> is {newer.reader.word || "not shown"}. {newer.reader.reason}
          </p>
        ) : null}
      </div>
  );
  const facts = (
      <dl className="ds-facts">
        {KIND[latest.kind] && latest.kind !== "as_printed" ? (
          <>
            <dt>Figure type</dt>
            <dd>
              {cap(KIND[latest.kind].long)}: {KIND[latest.kind].explain.replace(/^./, (c) => c.toLowerCase())}
            </dd>
          </>
        ) : null}
        <dt>Period</dt>
        <dd>
          {series.frequency === "fiscal_year" ? (
            <>
              Fiscal year <Num kind="period">{latest.period}</Num>, July to June
            </>
          ) : series.frequency === "survey_round" ? (
            <>
              Survey <Num kind="period">{latest.period}</Num>
            </>
          ) : (
            <Num kind="period">{periodWords(latest.period, series.frequency)}</Num>
          )}
        </dd>
        <dt>Unit</dt>
        <dd>
          {cap(unit)}, the unit the document prints in{series.unit === "PKR" ? ", in rupees of each year (not adjusted for prices)" : ""}
        </dd>
        {src ? (
          <>
            <dt>Source</dt>
            <dd>
              <Link href={sourceHref(src.source.source_id)}>{src.source.title}</Link>, <PageRef o={latest} doc={src.source.title} />
              {src.cell.page_label && src.cell.page_label !== String(src.cell.page) ? (
                <>
                  {" "}
                  (<Num kind="page">{`PDF page ${src.cell.page}`}</Num>)
                </>
              ) : null}{" "}
              · {src.source.publisher}
            </dd>
          </>
        ) : null}
        <dt>Checked</dt>
        <dd className="ds-checked">
          <StatusMark k={visualKey(latest.reader)} />{" "}
          <span>
            {checked && words.length ? `Checked against the printed page: ${andList(words)}.` : checked ? "Checked against the printed page." : `${cap(latest.reader.word)}: ${latest.reader.reason}`}{" "}
            <Link href={obsHref(latest.obs_id)} data-sheet={slugify(latest.obs_id)}>
              See the checks
            </Link>{" "}
            · <Link href="/methods">What we check</Link>
          </span>
        </dd>
        <dt>Release</dt>
        <dd>
          <Num kind="version">{RELEASE_VERSION}</Num>
          {asOf ? (
            <>
              , <Num kind="date">{asOf}</Num>
            </>
          ) : null}
          .{d.info.isPrototype ? " A prototype: not yet for citation in publications." : ""}
        </dd>
      </dl>
  );
  if (part === "num")
    return (
      <section className="ds-head ds-head-num" aria-label="Latest figure">
        {num}
      </section>
    );
  if (part === "facts")
    return (
      <section className="ix-about" aria-labelledby="ix-about-h">
        <h2 id="ix-about-h" className="ix-side-h">
          About this indicator
        </h2>
        {facts}
      </section>
    );
  return (
    <section className="ds-head" aria-label="Latest figure">
      {num}
      {facts}
    </section>
  );
}

/* ---------- 3. Table: every period, with its page ---------- */

const COLS = ["be", "re", "provisional", "actual", "ac", "na"];

/** The edition a revised estimate is printed in: next year's budget (KIND.re). */
function nextFiscal(p: string): string | null {
  const m = /^(\d{4})-\d{2}$/.exec(p);
  if (!m) return null;
  const y = Number(m[1]) + 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

function YearCell({ o, series, missing }: { o: Observation | undefined; series: Series; missing: string }) {
  if (!o)
    return (
      <td className="num ds-yt-none">
        <span>{missing}</span>
      </td>
    );
  const info = statusOf(o);
  const what = `${periodWords(o.period, series.frequency)}, ${kindLong(o) || "figure"}`;
  if (showsValue(o)) {
    const src = sourceOf(o);
    return (
      <td className="num">
        <V o={o} sheet label={`${what}: see where it is printed`} />
        {o.reader.key === "checked-note" ? (
          <span className="kt-mark" title={o.reader.reason}>
            {" "}
            note
          </span>
        ) : null}{" "}
        {src ? <PageRef o={o} doc={src.source.title} /> : null}
      </td>
    );
  }
  return (
    <td className={`num kt-gap kt-${info.key}`} title={o.reader.reason}>
      <Link href={obsHref(o.obs_id)} data-sheet={slugify(o.obs_id)} className="kt-gaplink" aria-label={`${what}: ${o.reader.word}. ${o.reader.reason} See the receipt.`}>
        <StatusMark k={info.key} /> <span className="kt-word">{o.reader.word || info.label.toLowerCase()}</span>
      </Link>
    </td>
  );
}

export function YearTable({ series, model }: { series: Series; model: ChartModel }) {
  const d = db();
  const all = d.obsBySeries.get(series.series_id) ?? [];
  const kinds = COLS.filter((k) => all.some((o) => o.vintage === k));
  for (const o of all) if (!kinds.includes(o.vintage)) kinds.push(o.vintage);
  const budget = hasBudgetPair(series);
  const noActual = budget && !kinds.includes("actual") && !kinds.includes("ac");
  const held = [...new Set(all.map((o) => o.period))];
  // Periods inside the span with no figure of any kind: hatched rows (the chart's "not yet collected" bands).
  const missing = new Set<string>();
  const heldMonths = new Set(held.map((p) => p.slice(5)));
  for (const g of model.gaps ?? []) {
    // Monthly series: only the months of the year the series is read in (as missingRuns does).
    for (let x = g.from; x <= g.to; x++) {
      const p = periodOfOrdinal(x, series.frequency);
      if (series.frequency !== "month" || heldMonths.has(p.slice(5))) missing.add(p);
    }
  }
  const periods = [...held, ...missing].sort().reverse();
  const at = new Map(all.map((o) => [`${o.period}|${o.vintage}`, o]));
  const unit = unitLabel(series.unit, series.scale_factor);
  const latestPeriod = held.sort().at(-1);
  const absEditions = new Set(d.sources.filter((s) => s.doc_type === "abs").map((s) => s.period));
  const used = new Map<string, { k: StatusKey; word: string; reason: string }>();
  for (const o of all) {
    if (o.reader.key === "checked") continue;
    if (o.reader.key === "checked-note") used.set("note", { k: "checked", word: "note", reason: "The document attaches a note to this figure; its receipt quotes it." });
    else used.set(o.reader.key, { k: statusOf(o).key, word: o.reader.word, reason: READER_STATUS[o.reader.key]?.reason ?? o.reader.reason });
  }
  const head = (k: string) => {
    if (k === "na") return series.unit === "percent" ? "Per cent" : series.unit === "index" ? "Index" : "Figure";
    return cap(KIND[all.find((o) => o.vintage === k)?.kind ?? "as_printed"]?.long ?? k);
  };
  const missingWords = (p: string, k: string) => {
    if (series.dataset === "abs" && k === "re") {
      const ed = nextFiscal(p);
      if (p === latestPeriod) return "comes in next year's budget";
      if (ed && !absEditions.has(ed)) return "edition not collected";
    }
    return "not in this release";
  };
  const cols = kinds.length + 1 + (noActual ? 1 : 0);
  return (
    <section className="ds-sec" aria-labelledby="h-table" id="table">
      <div className="ds-sec-head">
        <h2 id="h-table" className="ds-h2">
          Every {series.frequency === "month" ? "period" : series.frequency === "survey_round" ? "survey" : "year"}, with its page
        </h2>
        <p className="ds-sub">
          {cap(unit)}, exactly as the document prints them, newest first. All figures checked unless marked. Tap a figure to see where it is printed, or its page to see the page.
        </p>
      </div>
      <div className="table-wrap ds-yt-wrap" role="region" aria-label={`${seriesTitle(series)}: every figure with its page`} tabIndex={0}>
        <table className="ds-yt">
          <caption className="sr-only">
            {seriesTitle(series)}, {unit}: every figure in this release by period and kind of figure, newest first, with the page each is printed on. Hatched rows: periods no document of this release covers.
          </caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              {kinds.map((k) => (
                <th key={k} scope="col" className="num">
                  {head(k)}
                </th>
              ))}
              {noActual ? (
                <th scope="col" className="num">
                  Actual
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {periods.map((p, i) => {
              const br = series.breaks.find((b) => b.at_period <= p && (periods[i + 1] === undefined ? false : periods[i + 1] < b.at_period));
              const gap = missing.has(p);
              return [
                gap ? (
                  <tr key={p} className="ds-yt-gap">
                    <th scope="row">
                      <Num kind="axis">{periodWords(p, series.frequency)}</Num>
                    </th>
                    <td colSpan={cols - 1}>Not yet collected: no document for this period has been read yet.</td>
                  </tr>
                ) : (
                  <tr key={p}>
                    <th scope="row">
                      <Num kind="period">{periodWords(p, series.frequency)}</Num>
                    </th>
                    {kinds.map((k) => (
                      <YearCell key={k} o={at.get(`${p}|${k}`)} series={series} missing={missingWords(p, k)} />
                    ))}
                    {noActual ? (
                      <td className="num ds-yt-none">
                        <span>not in this release</span>
                      </td>
                    ) : null}
                  </tr>
                ),
                br ? (
                  <tr key={`${p}-break`} className="kt-break">
                    <td colSpan={cols}>
                      Break in the series ({breakWords(br.kind, series.series_id).toLowerCase()}) from <Num kind="period">{periodWords(br.at_period, series.frequency)}</Num>: figures above and below are not comparable.
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="ds-note">
        {budget ? "A budget estimate comes from that year's budget; its revised estimate from the next year's budget. " : ""}
        {noActual ? "Actual figures come from the federal accounts, which this release does not hold yet. " : ""}
        {missing.size ? "Hatched rows: no document for that period has been read yet." : ""}
      </p>
      {used.size ? (
        <ul className="kt-legend" aria-label="Marks in this table">
          {[...used.entries()].map(([key, u]) => (
            <li key={key}>
              {key === "note" ? (
                <>
                  <span className="kt-mark">note</span>:
                </>
              ) : (
                <>
                  <StatusMark k={u.k} /> <strong>{u.word}</strong>:
                </>
              )}{" "}
              {u.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/* ---------- 4. Editions: one period, every printing ---------- */

type Printing = { o: Observation; cell: Cell; source: Source };

function printingsOf(o: Observation): Printing[] {
  const d = db();
  const by = new Map<string, Printing>();
  for (const id of [o.primary_cell_id, ...o.supporting_cell_ids]) {
    const c = id ? d.cellById.get(id) : undefined;
    const s = c ? d.sourceById.get(c.source_id) : undefined;
    if (c && s && !by.has(s.source_id)) by.set(s.source_id, { o, cell: c, source: s });
  }
  return [...by.values()];
}

/** Periods printed more than once (in several editions, or as several kinds of figure), newest first. */
export function editionPeriods(series: Series): string[] {
  const all = db().obsBySeries.get(series.series_id) ?? [];
  const n = new Map<string, number>();
  for (const o of all) n.set(o.period, (n.get(o.period) ?? 0) + printingsOf(o).length);
  return [...n.entries()]
    .filter(([, k]) => k > 1)
    .map(([p]) => p)
    .sort()
    .reverse();
}

function samePrinted(a: Cell, b: Cell): boolean {
  const x = decimalFraction(a.value_parsed ?? "");
  const y = decimalFraction(b.value_parsed ?? "");
  if (!x || !y) return (a.value_raw ?? "").trim() === (b.value_raw ?? "").trim();
  return x[0] * y[1] === y[0] * x[1];
}

function EditionsFor({ series, period }: { series: Series; period: string }) {
  const all = (db().obsBySeries.get(series.series_id) ?? []).filter((o) => o.period === period);
  const rows = all
    .flatMap((o) => printingsOf(o).map((p, i, list) => ({ ...p, first: i === 0, firstCell: list[0].cell })))
    .sort((a, b) => a.source.period.localeCompare(b.source.period) || (KIND_RANK[a.o.vintage] ?? 0) - (KIND_RANK[b.o.vintage] ?? 0));
  const be = all.find((o) => o.vintage === "be");
  const budget = hasBudgetPair(series);
  const hasActual = all.some((o) => o.vintage === "actual" || o.vintage === "ac");
  const unit = unitLabel(series.unit, series.scale_factor);
  return (
    <div className="table-wrap ds-yt-wrap" role="region" aria-label={`${periodWords(period, series.frequency)}: every printing`} tabIndex={0}>
      <table className="ds-yt ds-ed">
        <caption className="sr-only">
          {seriesTitle(series)}, <Num kind="period">{periodWords(period, series.frequency)}</Num>: each printing of the figure, the edition it is in, what changed from the printing before, and its page.
        </caption>
        <thead>
          <tr>
            <th scope="col">Edition</th>
            <th scope="col">Kind of figure</th>
            <th scope="col" className="num">
              {cap(unit)}
            </th>
            <th scope="col">Change from the printing before</th>
            <th scope="col">Page</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const showsIt = shows(r.o);
            let change: ReactNode;
            if (!r.first) change = samePrinted(r.cell, r.firstCell) ? "Reprinted, unchanged" : "Reprinted with a different figure; see the receipt";
            else if (r.o.vintage === "re" && usable(r.o) && usable(be) && (decimalFraction(be.value!)?.[0] ?? BigInt(0)) > BigInt(0)) {
              const v = decPctChange(r.o.value!, be.value!);
              if (v !== null) {
                const zero = /^[+-]?0*(\.0*)?$/.test(v);
                const text = zero ? "unchanged" : `${v.startsWith("-") ? "down" : "up"} ${derivedDisplay(v.replace(/^[+-]/, ""), false)}%`;
                change = (
                  <>
                    <span data-num="derived" data-derived="pct" data-fmt="words" data-inputs={`${be.obs_id} ${r.o.obs_id}`} className="d-val">
                      {text}
                    </span>{" "}
                    {zero ? "from" : "on"} the budget estimate
                  </>
                );
              } else change = "First printed";
            } else change = "First printed";
            return (
              <tr key={`${r.o.obs_id}|${r.source.source_id}`}>
                <th scope="row">
                  <Link href={sourceHref(r.source.source_id)}>{r.source.title}</Link>
                </th>
                <td>{cap(kindLong(r.o) || "figure")}</td>
                <td className="num">
                  {showsIt ? (
                    <V o={r.o} cell={{ cell_id: r.cell.cell_id, value_raw: r.cell.value_raw }} sheet label={`${kindLong(r.o) || "figure"}, as printed in ${r.source.title}: see where it is printed`} />
                  ) : (
                    <Link href={obsHref(r.o.obs_id)} data-sheet={slugify(r.o.obs_id)} className="kt-gaplink" title={r.o.reader.reason}>
                      <StatusMark k={statusOf(r.o).key} /> <span className="kt-word">{r.o.reader.word}</span>
                    </Link>
                  )}
                </td>
                <td>{change}</td>
                <td>{showsIt ? <PageRef o={r.o} cell={r.cell} doc={r.source.title} /> : null}</td>
              </tr>
            );
          })}
          {budget && !hasActual ? (
            <tr className="ds-ed-none">
              <th scope="row">Federal accounts</th>
              <td>Actual</td>
              <td className="num">not in this release</td>
              <td />
              <td />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function Editions({ series, periods }: { series: Series; periods: string[] }) {
  if (!periods.length) return null;
  return (
    <section className="ds-sec" aria-labelledby="h-editions" id="editions">
      <div className="ds-sec-head">
        <h2 id="h-editions" className="ds-h2">
          One {series.frequency === "fiscal_year" ? "year" : "period"}, every edition
        </h2>
        <p className="ds-sub">The same figure as it appears in each document that carries it, what changed between printings, and on which page.</p>
      </div>
      <SelectSwitch
        id={`ed-${slugify(series.series_id)}`}
        label={series.frequency === "fiscal_year" ? "Year" : "Period"}
        options={periods.map((p) => ({ key: p, label: periodWords(p, series.frequency) }))}
        panels={periods.map((p) => (
          <EditionsFor key={p} series={series} period={p} />
        ))}
      />
    </section>
  );
}

/* ---------- 5. Download ---------- */

const FILE_WORDS = {
  csv: { t: "Full series, CSV", m: "One row per figure: period, kind of figure, document and page, the printed text, value, unit, status and its reason." },
  xlsx: { t: "Full series, Excel", m: "The same, for spreadsheets, with a README sheet, a Sources sheet and the citation." },
  zip: { t: "Data package", m: "The CSV with datapackage.json, a README, the licence and CITATION.cff." },
} as const;

export function Downloads({ series }: { series: Series }) {
  const f = seriesFiles(series.series_id);
  const order = ["csv", "xlsx", "zip"] as const;
  const csvLatest = latestFileHref(`series/${f.slug}.csv`);
  return (
    <section className="ds-sec ds-narrow" aria-labelledby="h-download" id="download">
      <h2 id="h-download" className="ds-h2">
        Download
      </h2>
      <p className="ds-sub">Data: CC BY 4.0. Cite the government document first and this release second. The source documents are public government publications.</p>
      <ul className="ds-dl">
        {order.map((k) => {
          const m = f.main.find((x) => x.key === k);
          return (
            <li key={k}>
              <span className="ds-dl-what">
                <strong>{FILE_WORDS[k].t}</strong>
                <span>{FILE_WORDS[k].m}</span>
              </span>
              {m && m.size !== null ? (
                <a href={fileHref(m.rel)} download className="ds-btn">
                  {k === "xlsx" ? "Excel" : k === "zip" ? "ZIP" : "CSV"} <Num kind="ui">{sizeText(m.size)}</Num>
                </a>
              ) : (
                <span className="ds-dl-none">not in this release</span>
              )}
            </li>
          );
        })}
        {VERSION_FILES.map((v) => {
          const file = f.versions.find((x) => x.key === v.key);
          if (!file) return null;
          return (
            <li key={v.key}>
              <span className="ds-dl-what">
                <strong>{v.label}</strong>
                <span>{v.what}</span>
              </span>
              <a href={fileHref(file.rel)} download className="ds-btn">
                CSV <Num kind="ui">{sizeText(file.size)}</Num>
              </a>
            </li>
          );
        })}
        <li>
          <span className="ds-dl-what">
            <strong>Chart</strong>
            <span>As drawn under Chart, as an image.</span>
          </span>
          <span className="ds-dl-none">not in this release yet</span>
        </li>
        <li>
          <span className="ds-dl-what">
            <strong>The printed pages</strong>
            <span>Every page this series is read from, as images.</span>
          </span>
          <span className="ds-dl-none">not in this release yet</span>
        </li>
      </ul>
      <p className="ds-small">
        Stable address for code, always the latest release:{" "}
        <code className="ds-code">
          <Num kind="id">
            <OriginText text={absoluteUrl(csvLatest)} />
          </Num>
        </code>
      </p>
    </section>
  );
}

/* ---------- 6. Cite ---------- */

export function CitePanel({ series, latest, path }: { series: Series; latest: Observation | null; path: string }) {
  return (
    <section className="ds-sec ds-narrow" aria-labelledby="h-cite" id="cite">
      <h2 id="h-cite" className="ds-h2">
        Cite this {latest ? "figure" : "series"}
      </h2>
      {latest ? (
        <>
          <p className="ds-sub">
            The headline figure, <KindPeriodWords o={latest} series={series} />, with the page it is printed on.
          </p>
          <Cite path={obsHref(latest.obs_id)} heading={false} />
          <h3 className="ds-h3">The whole series</h3>
        </>
      ) : null}
      <Cite path={path} what={`Series ${series.series_id}, ${series.name}`} heading={false} />
    </section>
  );
}

/* ---------- 7. Related datasets and Read first ---------- */

function relatedOf(series: Series): Series[] {
  const d = db();
  const visible = (s: Series) => !s.derived && s.series_id !== series.series_id && (d.obsBySeries.get(s.series_id) ?? []).some(shows);
  const parent = ancestors(series)[0];
  const out: Series[] = [];
  const add = (s: Series | undefined) => s && visible(s) && !out.some((x) => x.series_id === s.series_id) && out.push(s);
  for (const c of d.childrenOf.get(series.series_id) ?? []) add(c);
  if (parent) for (const c of d.childrenOf.get(parent.series_id) ?? []) add(c);
  add(parent);
  return out.slice(0, 6);
}

export function Related({ series }: { series: Series }) {
  const items = relatedOf(series);
  if (!items.length) return null;
  return (
    <section className="ds-rel" aria-labelledby="h-rel">
      <h2 id="h-rel" className="ds-h2 ds-ruled">
        Related indicators
      </h2>
      <ul className="ds-rel-list">
        {items.map((s) => {
          const o = latestPublished(s.series_id);
          const k = o ? kindLong(o) : "";
          return (
            <li key={s.series_id}>
              <span className="ds-rel-name">
                <Link href={seriesHref(s.series_id)}>{seriesTitle(s)}</Link>{" "}
                {o ? (
                  <span className="ds-rel-k">
                    {k ? `${k} ` : ""}
                    <Num kind="period">{periodWords(o.period, s.frequency)}</Num>
                  </span>
                ) : null}
              </span>
              <span className="ds-rel-v">
                {o && shows(o) ? (
                  <>
                    <V o={o} short sheet label={`${seriesTitle(s)}: ${k ? `${k} ` : ""}${periodWords(o.period, s.frequency)}, see where it is printed`} /> {markerOf(o) ? <PageRef o={o} /> : null}
                  </>
                ) : (
                  <span className="ds-small">no checked figure</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The guide to read first: only for a budget series with budget and revised estimates. */
export function ReadFirst({ series }: { series: Series }) {
  if (series.dataset !== "abs" || !hasBudgetPair(series)) return null;
  return (
    <section className="ds-read" aria-labelledby="h-read">
      <h2 id="h-read" className="ds-h2 ds-ruled">
        Read first
      </h2>
      <Link href="/guides/revised-estimate" className="ds-read-link">
        <span className="ds-read-t">What is a revised estimate?</span>
        <span className="ds-read-d">Why one year has more than one figure, and why they are never joined into one line.</span>
      </Link>
    </section>
  );
}
