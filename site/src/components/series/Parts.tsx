// Server parts of the series page (DESIGN.md 9.5): the answer line, the source
// lines inside the chart frame, the table by kind of figure, About this
// series and Where it sits. Every digit is a <V> (a checked value linked to
// its receipt), a <Count>, a <Num>, or a <D> (a derived figure, recomputed by
// scripts/checks/series-derived.mjs).
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import { StatusMark } from "@/components/ui/Status";
import { Num, V } from "@/components/ui/Num";
import { OriginText } from "@/components/actions/OriginText";
import { db, obsAt, RELEASE_VERSION, seriesHref, SITE_URL, slugify, sourceHref, DATA_BASE, type Observation, type Series } from "@/lib/data";
import { periodWords, unitLabel } from "@/lib/format";
import { statusOf, visualKey, type StatusKey } from "@/lib/status";
import { latestPublished, ancestors } from "@/lib/stats";
import { KIND, READER_STATUS, breakWords } from "@/lib/words";
import type { ReaderStatusKey } from "@/lib/adapter/contract";
import { decodeId, documentsOf, kindLong, printedLabels } from "./model";
import { seriesTitle, titleIsDraft } from "@/lib/titles";

/** A derived figure: data-op names the operation, data-in its inputs (the figure itself first). */
export function D({ op, inputs, children }: { op: string; inputs: string[]; children: ReactNode }) {
  return (
    <span data-num="derived" data-op={op} data-in={inputs.join(",")} className="d-val">
      {children}
    </span>
  );
}

const FREQ: Record<string, string> = { fiscal_year: "fiscal year, July to June", month: "month", survey_round: "survey round", year: "calendar year", quarter: "quarter" };

/* ---------- source lines inside the chart frame (11, "The source travels") ---------- */

export function SourceLines({ series, path }: { series: Series; path: string }) {
  const docs = documentsOf(series);
  const used = docs.some((d) => d.n > 0) ? docs.filter((d) => d.n > 0) : docs;
  // Group editions of one publication: "Annual Budget Statement, 2010-11 to 2026-27".
  const groups = new Map<string, { name: string; publisher: string; periods: string[]; freq: string }>();
  for (const d of used) {
    const freq = /^\d{4}-\d{2}$/.test(d.period) && /Monthly Review/.test(d.title) ? "month" : "fiscal_year";
    const pw = periodWords(d.period, freq);
    const name = d.title.replace(pw, "").replace(d.period, "").replace(/\s+,/g, ",").replace(/[,\s]+$/, "").replace(/\s{2,}/g, " ").trim();
    const g = groups.get(name) ?? { name, publisher: d.publisher, periods: [], freq };
    g.periods.push(d.period);
    groups.set(name, g);
  }
  const kinds = new Set((db().obsBySeries.get(series.series_id) ?? []).map((o) => o.vintage));
  const estimates = (kinds.has("be") || kinds.has("re")) && !kinds.has("actual") && !kinds.has("ac");
  const spending = series.series_id.startsWith("fed.exp");
  const all = db().obsBySeries.get(series.series_id) ?? [];
  const periods = [...new Set(all.map((o) => o.period))].sort();
  const breaks = series.breaks.filter((b) => periods.some((p) => p < b.at_period) && periods.some((p) => p >= b.at_period));
  // The credit carries the full address: the configured site address, or (when none is configured) the
  // address the browser was served from, filled in by OriginText; without JavaScript, the site path.
  const site = SITE_URL ? SITE_URL.replace(/\/$/, "") : "{{ORIGIN}}";
  return (
    <div className="sv-src">
      <p>
        <span className="sv-src-h">Source:</span>{" "}
        {[...groups.values()].map((g, i) => {
          const ps = [...g.periods].sort();
          return (
            <span key={g.name}>
              {i ? "; " : ""}
              {g.name}, {ps.length === 1 ? <Num kind="period">{periodWords(ps[0], g.freq)}</Num> : <>
                  editions <Num kind="period">{periodWords(ps[0], g.freq)}</Num> to <Num kind="period">{periodWords(ps[ps.length - 1], g.freq)}</Num>
                </>}{" "}
              ({g.publisher})
            </span>
          );
        })}
        {groups.size === 0 ? "no document in this release holds a checked figure of this series" : ""}.
      </p>
      {estimates || breaks.length ? (
        <p className="sv-caveat">
          {estimates ? (spending ? "Budget and revised estimates, not actual spending." : "Budget and revised estimates, not actual outturn.") : ""}
          {breaks.map((b) => (
            <span key={b.at_period + b.kind}>
              {" "}
              Break: {breakWords(b.kind, series.series_id)}, <Num kind="period">{periodWords(b.at_period, series.frequency)}</Num>; the lines stop there.
            </span>
          ))}
        </p>
      ) : null}
      <p className="sv-src-rel">
        LUMS DataLab, release <Num kind="version">{RELEASE_VERSION}</Num> ·{" "}
        <Num kind="id">
          <OriginText text={`${site}${path}`} />
        </Num>{" "}
        · CC BY 4.0
      </p>
    </div>
  );
}

/* ---------- 7. table by kind of figure (DESIGN.md 12) ---------- */

const COLS = ["be", "re", "provisional", "actual", "ac", "na"];

const MARK_WORD: Partial<Record<ReaderStatusKey, string>> = {};
for (const [k, v] of Object.entries(READER_STATUS)) MARK_WORD[k as ReaderStatusKey] = v.word;

function Cell({ o, series }: { o: Observation | undefined; series: Series }) {
  if (!o) return <td className="num kt-none"><span className="sr-only">no figure in this release</span></td>;
  const info = statusOf(o);
  if (o.reader.showsValue && o.published && o.value !== null) {
    return (
      <td className="num">
        <V o={o} sheet label={`${periodWords(o.period, series.frequency)}, ${kindLong(o) || "figure"}: see where it is printed`} />
        {o.reader.key === "checked-note" ? (
          <span className="kt-mark" title={o.reader.reason}>
            {" "}
            note
          </span>
        ) : null}
      </td>
    );
  }
  return (
    <td className={`num kt-gap kt-${info.key}`} title={o.reader.reason}>
      <Link href={`/o/${slugify(o.obs_id)}`} data-sheet={slugify(o.obs_id)} className="kt-gaplink" aria-label={`${periodWords(o.period, series.frequency)}, ${kindLong(o) || "figure"}: ${o.reader.word}. ${o.reader.reason} See the receipt.`}>
        <StatusMark k={info.key} /> <span className="kt-word">{o.reader.word || info.label.toLowerCase()}</span>
      </Link>
    </td>
  );
}

export function KindTable({ series }: { series: Series }) {
  const all = db().obsBySeries.get(series.series_id) ?? [];
  const kinds = COLS.filter((k) => all.some((o) => o.vintage === k));
  for (const o of all) if (!kinds.includes(o.vintage)) kinds.push(o.vintage);
  const periods = [...new Set(all.map((o) => o.period))].sort().reverse();
  const at = new Map(all.map((o) => [`${o.period}|${o.vintage}`, o]));
  const unit = unitLabel(series.unit, series.scale_factor);
  // Marks used in this table only (DESIGN.md 6.1: the legend lists only marks present).
  const used = new Map<string, { k: StatusKey; word: string; reason: string }>();
  for (const o of all) {
    if (o.reader.key === "checked") continue;
    if (o.reader.key === "checked-note") used.set("note", { k: "checked", word: "note", reason: "The document attaches a note to this figure; its receipt quotes it." });
    else used.set(o.reader.key, { k: statusOf(o).key, word: o.reader.word, reason: READER_STATUS[o.reader.key]?.reason ?? o.reader.reason });
  }
  const head = (k: string) => {
    if (k === "na") return series.unit === "percent" ? "Per cent" : series.unit === "index" ? "Index" : "Value";
    const w = KIND[all.find((o) => o.vintage === k)?.kind ?? "as_printed"]?.long ?? k;
    return w[0].toUpperCase() + w.slice(1);
  };
  return (
    <section className="kt-section" aria-labelledby="h-table" id="table">
      <h2 id="h-table">Table</h2>
      <p className="kt-intro small">
        {unit[0].toUpperCase() + unit.slice(1)}, exactly as printed, newest first. <strong>All figures checked unless marked.</strong> Tap a figure to see where it is printed.
      </p>
      <div className="table-wrap kt-wrap" role="region" aria-label={`${seriesTitle(series)}: every figure by kind`} tabIndex={0}>
        <table className="kt">
          <caption className="sr-only">
            {seriesTitle(series)}, {unit}: every figure in this release by period and kind of figure, newest first. Figures are checked unless marked.
          </caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              {kinds.map((k) => (
                <th key={k} scope="col" className="num">
                  {head(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p, i) => {
              const br = series.breaks.find((b) => b.at_period <= p && (periods[i + 1] === undefined ? false : periods[i + 1] < b.at_period));
              return [
                <tr key={p}>
                  <th scope="row">
                    <Num kind="period">{periodWords(p, series.frequency)}</Num>
                  </th>
                  {kinds.map((k) => (
                    <Cell key={k} o={at.get(`${p}|${k}`)} series={series} />
                  ))}
                </tr>,
                br ? (
                  <tr key={`${p}-break`} className="kt-break">
                    <td colSpan={kinds.length + 1}>
                      Series break ({breakWords(br.kind, series.series_id).toLowerCase()}) from <Num kind="period">{periodWords(br.at_period, series.frequency)}</Num>: figures above and below are not
                      comparable.
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>
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

/* ---------- 8. About this series ---------- */

export function About({ series, csv }: { series: Series; csv: string }) {
  const labels = printedLabels(series);
  const docs = documentsOf(series);
  const unit = unitLabel(series.unit, series.scale_factor);
  const notes = [...new Set((db().obsBySeries.get(series.series_id) ?? []).filter((o) => o.reader.key === "checked-note").map((o) => o.period))];
  return (
    <section className="about" aria-labelledby="h-about" id="about">
      <h2 id="h-about">About this series</h2>
      <dl className="facts about-facts">
        <dt>Printed name</dt>
        <dd>
          <span>{series.name}</span>
          {series.titleStatus === "printed" ? (
            <span className="draft-mark"> The site has no plain title for this series yet, so it uses the printed name.</span>
          ) : titleIsDraft(series) ? (
            <span className="draft-mark"> The title above is a plain-words draft, not yet reviewed by a person.</span>
          ) : null}
        </dd>
        {series.definition ? (
          <>
            <dt>Definition</dt>
            <dd>
              <span>{series.definition}</span>
              {series.definition_status && series.definition_status !== "reviewed" ? <span className="draft-mark"> Draft, not yet reviewed by a person.</span> : null}
            </dd>
          </>
        ) : null}
        {labels.length ? (
          <>
            <dt>Printed as</dt>
            <dd>
              {labels.map((l, i) => (
                <span key={l}>
                  {i ? <span aria-hidden="true"> · </span> : null}
                  <q>
                    <span>{l}</span>
                  </q>
                </span>
              ))}
            </dd>
          </>
        ) : null}
        <dt>Unit and scale</dt>
        <dd>
          {unit}
          {series.unit === "PKR" ? ", as printed; headlines round to tenths of a billion or trillion" : ", as printed"}
        </dd>
        <dt>Period</dt>
        <dd>{FREQ[series.frequency] ?? series.frequency.replaceAll("_", " ")}</dd>
        {series.notes || notes.length ? (
          <>
            <dt>Notes</dt>
            <dd>
              {series.notes ? <span>{series.notes}</span> : null}
              {notes.length ? (
                <span>
                  {" "}
                  The document attaches a note to the figure for{" "}
                  {notes.map((p, i) => (
                    <span key={p}>
                      {i ? ", " : ""}
                      <Num kind="period">{periodWords(p, series.frequency)}</Num>
                    </span>
                  ))}
                  ; its receipt quotes it.
                </span>
              ) : null}
            </dd>
          </>
        ) : null}
        {series.breaks.length ? (
          <>
            <dt>Breaks</dt>
            <dd>
              <ul className="about-list">
                {series.breaks.map((b) => (
                  <li key={b.at_period + b.kind}>
                    <strong>
                      From <Num kind="period">{periodWords(b.at_period, series.frequency)}</Num> ({breakWords(b.kind, series.series_id).toLowerCase()}).
                    </strong>{" "}
                    <span>{b.note}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </>
        ) : null}
        <dt>Printed in</dt>
        <dd>
          <ul className="about-list">
            {docs.map((d) => (
              <li key={d.sourceId}>
                <Link href={sourceHref(d.sourceId)}>{d.title}</Link>,{" "}
                {d.pages.map((p, i) => (
                  <span key={p.page}>
                    {i ? ", " : ""}
                    <Num kind="page">{p.label}</Num>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </dd>
        <dt>Series id</dt>
        <dd>
          <code className="mono">
            <Num kind="id">{series.series_id}</Num>
          </code>
          <ul className="about-id" aria-label="The id, part by part">
            {decodeId(series.series_id).map((s, i) => (
              <li key={`${s.part}-${i}`}>
                <code>
                  <Num kind="id">{s.part}</Num>
                </code>{" "}
                {/\d/.test(s.meaning) && !/ICLS/.test(s.meaning) ? <Num kind="period">{s.meaning}</Num> : s.meaning}
              </li>
            ))}
          </ul>
        </dd>
        <dt>Files</dt>
        <dd>
          <a href={csv} download>
            CSV, one row per figure
          </a>{" "}
          ·{" "}
          <a href={`${DATA_BASE}/series/${slugify(series.series_id)}.json`} download>
            JSON with the definition
          </a>
        </dd>
      </dl>
    </section>
  );
}

/* ---------- 9. Where it sits ---------- */

function LevelValue({ s, o, ref0, series }: { s: Series; o: Observation | undefined; ref0: Observation; series: Series }) {
  const kind = kindLong(ref0) || "figure";
  if (!o) {
    return (
      <span className="trail-why">
        no {kind} for <Num kind="period">{periodWords(ref0.period, series.frequency)}</Num> in this release
      </span>
    );
  }
  if (o.reader.key === "candidate") return <span className="trail-why">not signed off; see its page</span>;
  if (!(o.reader.showsValue && o.published && o.value !== null))
    return (
      <span className="trail-why" title={o.reader.reason}>
        <StatusMark k={visualKey(o.reader)} /> {o.reader.word}
      </span>
    );
  return <V o={o} short sheet label={`${seriesTitle(s)}: ${kind} ${periodWords(ref0.period, series.frequency)}`} />;
}

export function WhereItSits({ series }: { series: Series }) {
  const ref0 = latestPublished(series.series_id);
  const up = ancestors(series).reverse();
  if (!up.length) return null;
  const at = (s: Series) => (ref0 ? obsAt(s.series_id, ref0.period, ref0.vintage) : undefined);
  return (
    <section className="trail" aria-labelledby="h-trail" id="where">
      <h2 id="h-trail">Where it sits</h2>
      {ref0 ? (
        <p className="small muted">
          Each level&rsquo;s {kindLong(ref0) || "figure"} for <Num kind="period">{periodWords(ref0.period, series.frequency)}</Num>, checked figures only.
        </p>
      ) : null}
      <ol className="trail-list">
        {up.map((s) => (
          <li key={s.series_id}>
            <Link href={seriesHref(s.series_id)}>{seriesTitle(s)}</Link> {ref0 ? <LevelValue s={s} o={at(s)} ref0={ref0} series={series} /> : null}
          </li>
        ))}
        <li aria-current="page">
          <strong>{seriesTitle(series)}</strong> {ref0 ? <LevelValue s={series} o={ref0} ref0={ref0} series={series} /> : null}
        </li>
      </ol>
      <p className="small muted">The lines it is made up of and the lines beside it are under Related series.</p>
    </section>
  );
}

/** A sentence with the periods in it marked (each "2019-20", "June 2025" is a period of the release; the words around it are not). */
export function PeriodsIn({ text }: { text: string }) {
  const parts = text.split(/((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}|\d{4}-\d{2}|\d{4})/);
  return <>{parts.map((x, i) => (i % 2 === 1 ? <Num key={i} kind="period">{x}</Num> : x))}</>;
}
