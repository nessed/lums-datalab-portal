"use client";
// What a search shows (DESIGN.md 10), drawn in the header dialog and on /search
// from the same index and ranking.
//   dialog  the answer card, then one compact list (plain title, latest figure,
//           kind and period) the arrow keys move through;
//   page    the answer card (big number, one sentence, the printed page), tabs
//           for series, documents and tables, filters that matter (topic, area,
//           kind of figure, women and men, province) on the left, and series
//           grouped in families ("Prices, all of Pakistan", "Prices by group of
//           goods", "Earlier base or older figures"), the top few of each with
//           "Show all". Each series card shows its plain title, its latest
//           checked figure (a receipt link), kind and period, and a sparkline.
// Inferred filters stay visible chips with "search everything instead"; zero
// results are never a dead end. Every number here comes from the search index
// or the sparkline file, which scripts/checks/search-index.mjs checks against
// the release.
import { useState, type ReactNode } from "react";
import {
  answerValues,
  applyFacets,
  datedOf,
  facetChoices,
  facetWords,
  families,
  FACET_LABEL,
  seriesHrefOf,
  sparkPath,
  type Engine,
  type FacetKey,
  type FacetPick,
  type SearchEntry,
  type SearchResult,
  type SparkRow,
  type Sparks,
} from "@/lib/search";
import NumberBlock from "@/components/ui/NumberBlock";
import PrintedPagePill from "@/components/ui/PrintedPagePill";

/** Concepts offered when nothing matches (ids from editorial/concepts.json). */
const STARTERS = ["inflation", "health-spending", "unemployment", "tax-revenue", "federal-spending", "labour-force"];

export const searchHref = (q: string, infer = true) => `/search?q=${encodeURIComponent(q)}${infer ? "" : "&infer=0"}`;

/** Results shown per family before "Show all", and per documents / tables group. */
const PER_FAMILY = 4;
const PER_OTHER = 5;

function Highlight({ text, words }: { text: string; words: string[] }) {
  const ts = words.filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!ts.length) return <>{text}</>;
  const parts = text.split(new RegExp(`\\b(${ts.join("|")}\\w*)`, "ig"));
  return <>{parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p))}</>;
}

const slugOf = (href: string) => href.replace(/^\/o\//, "");

/** A sparkline from spark.json: checked values of the main kind, never joined across a gap or a break. */
export function SearchSpark({ row, w = 112, h = 32, className }: { row: SparkRow | undefined; w?: number; h?: number; className?: string }) {
  const g = row ? sparkPath(row, w, h) : null;
  if (!g || !g.last) return <span className={`spark spark-none${className ? ` ${className}` : ""}`} style={{ width: w, height: h }} aria-hidden="true" />;
  return (
    <svg className={`spark${className ? ` ${className}` : ""}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
      <path d={g.d} />
      {g.dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.6} className="spark-lone" />
      ))}
      <circle cx={g.last[0]} cy={g.last[1]} r={2.6} className="spark-last" />
    </svg>
  );
}

/** "ends June 2019", "checked to 2017-18", "earlier base". */
function DatedTags({ eng, e }: { eng: Engine; e: SearchEntry }) {
  const d = datedOf(eng, e);
  if (!d) return null;
  return (
    <>
      {d.ended ? <span className="tag rc-tag">{d.withheld ? `checked to ${d.ended}` : `ends ${d.ended}`}</span> : null}
      {d.earlier ? <span className="tag rc-tag">earlier base</span> : null}
    </>
  );
}

/** The answer line of a series: latest checked value, kind, period. */
export function SeriesAnswer({ e, link }: { e: SearchEntry; link?: boolean }) {
  if (!e.lv) return <span className="sr-none">No checked value yet</span>;
  const label = `${e.lv}, ${e.lk ? `${e.lk}, ` : ""}${e.lp}${e.cand ? ", not signed off" : ""}: see where it is printed`;
  return (
    <span className="sr-ans">
      {link && e.lo ? (
        <a href={e.lo} className="v-link sr-v" data-v="" aria-label={label}>
          {e.lv}
        </a>
      ) : (
        <b className="sr-v">{e.lv}</b>
      )}
      {e.cand ? <span className="v-mark"> not signed off</span> : null}
      <span className="sr-k">
        {" "}
        {e.lk ? `${e.lk} · ` : ""}
        {e.lp}
      </span>
    </span>
  );
}

export function AnswerCard({ c, res, eng, compact, spark }: { c: SearchEntry; res: SearchResult; eng: Engine; compact?: boolean; spark?: SparkRow }) {
  const rel = [...(c.rel ?? [])].map((id) => eng.seriesById.get(id)).filter((e): e is SearchEntry => !!e);
  if (c.miss) {
    return (
      <section className="sr-card sr-card--miss" aria-label={`${c.n}: not in this release`}>
        <p className="sr-kicker">Not in this release</p>
        <h2 className="sr-card-h">{c.n}</h2>
        <p className="sr-card-p">{c.miss}</p>
        {rel.length ? (
          <ul className="sr-card-rel">
            {rel.map((e) => (
              <li key={e.id}>
                <a href={e.h}>{e.n}</a> <SeriesAnswer e={e} link={!compact} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }
  const head = c.s?.[0] ? eng.seriesById.get(c.s[0]) : undefined;
  if (!c.a) {
    return (
      <section className="sr-card" aria-label={c.n}>
        <p className="sr-kicker">{c.t}</p>
        <h2 className="sr-card-h">{head ? <a href={head.h}>{head.n}</a> : c.n}</h2>
        <p className="sr-card-p">
          {head?.cand ? "Its figures are not yet signed off, so no figure is shown here." : "No checked figure of this series yet."}{" "}
          {head ? <a href={head.h}>Open the series</a> : null}
        </p>
      </section>
    );
  }
  const a = c.a;
  const { vals, forYears } = answerValues(a, res.years);
  const asked = res.years.length > 0;
  const v = vals[vals.length - 1];
  const others = vals.slice(0, -1).reverse().slice(0, compact ? 2 : 5);
  const headEntry = eng.seriesById.get(a.s);
  return (
    <section className={`sr-card ans${compact ? " ans--compact" : ""}`} aria-labelledby={`sr-card-${c.id}`}>
      <div className="ans-main">
        <p className="sr-kicker">{c.t}</p>
        <h2 className="sr-card-h ans-h" id={`sr-card-${c.id}`}>
          <a href={seriesHrefOf(a.s)}>{a.n}</a>
        </h2>
        {asked && !forYears ? <p className="sr-card-note">No checked figure for the year you asked; the latest is shown.</p> : null}
        {v ? (
          <NumberBlock
            size={compact ? "l" : "xl"}
            label={
              <>
                {v.k} · {v.pw}
              </>
            }
            value={
              <a href={v.o} className="v-link" data-v="" data-sheet={slugOf(v.o)} aria-label={`${v.v}, ${v.k}, ${v.pw}: see where it is printed`}>
                {v.v}
              </a>
            }
            answer={!compact && a.sm ? a.sm : undefined}
          >
            <p className="ans-src">
              <PrintedPagePill href={v.o} sheet={slugOf(v.o)} />
              <span className="sr-src">Printed in {v.m}</span>
            </p>
          </NumberBlock>
        ) : null}
        {others.length ? (
          <ul className="sr-card-vals">
            {others.map((o) => (
              <li key={o.o}>
                <a href={o.o} className="v-link sr-card-v" data-v="" data-sheet={slugOf(o.o)} aria-label={`${o.v}, ${o.k}, ${o.pw}: see where it is printed`}>
                  {o.v}
                </a>
                <span className="sr-card-kp">
                  {o.k} · {o.pw}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {compact ? null : (
        <div className="ans-side">
          <a href={seriesHrefOf(a.s)} className="ans-spark" tabIndex={-1} aria-hidden="true">
            <SearchSpark row={spark} w={232} h={64} />
          </a>
          <p className="ans-meta">
            <code className="rc-id">{a.s}</code>
            {headEntry?.p ? <span>{headEntry.p}</span> : null}
            <span>{a.u}</span>
          </p>
          <p className="sr-card-links">
            <a href={seriesHrefOf(a.s)}>Open the series</a>
          </p>
        </div>
      )}
    </section>
  );
}

/** One series result on the page: plain title, latest figure (receipt link), kind and period, sparkline. */
function ResultCard({ e, eng, words, spark }: { e: SearchEntry; eng: Engine; words: string[]; spark: SparkRow | undefined }) {
  return (
    <li className="rc">
      <a href={e.h} className="rc-title">
        <Highlight text={e.n} words={words} />
      </a>
      <div className="rc-fig">
        {e.lv && e.lo ? (
          <>
            <a
              href={e.lo}
              className="v-link rc-v"
              data-v=""
              data-sheet={slugOf(e.lo)}
              aria-label={`${e.lv}, ${e.lk ? `${e.lk}, ` : ""}${e.lp}${e.cand ? ", not signed off" : ""}: see where it is printed`}
            >
              {e.lv}
            </a>
            {e.cand ? <span className="v-mark"> not signed off</span> : null}
            <span className="rc-kp">
              {e.lk ? `${e.lk} · ` : ""}
              {e.lp}
            </span>
          </>
        ) : (
          <span className="sr-none">No checked value yet</span>
        )}
      </div>
      <span className="rc-spark">
        <SearchSpark row={spark} />
      </span>
      <p className="rc-meta">
        <code className="rc-id">{e.id}</code>
        <DatedTags eng={eng} e={e} />
      </p>
    </li>
  );
}

export type PageView = {
  /** "s" series, "d" documents, "t" tables, or null for all. */
  type: string | null;
  pick: FacetPick;
  onType: (t: string | null) => void;
  onPick: (patch: Partial<Record<FacetKey, string | null>>) => void;
  sparks: Sparks | null;
};

/** Results as a listbox (dialog) or as cards in families (page). */
export function SearchView({
  res,
  eng,
  mode,
  listId,
  active = -1,
  setActive,
  limits,
  onQuery,
  onEverything,
  footer,
  view,
}: {
  res: SearchResult;
  eng: Engine;
  mode: "dialog" | "page";
  listId: string;
  active?: number;
  setActive?: (i: number) => void;
  limits: { s: number; d: number; t: number };
  onQuery: (q: string, infer?: boolean) => void;
  onEverything: () => void;
  footer?: ReactNode;
  view?: PageView;
}) {
  const chips = res.chips.length ? (
    <div className="sr-chips" role="group" aria-label="Filters read from your words">
      {res.chips.map((c) => (
        <span key={c.kind + c.said} className="sr-chip">
          {c.label}
          <button
            type="button"
            className="sr-chip-x"
            aria-label={`Remove the filter ${c.label}`}
            onClick={() => onQuery(res.q.replace(new RegExp(`\\b${c.said.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), " ").replace(/\s+/g, " ").trim())}
          >
            ×
          </button>
        </span>
      ))}
      <button type="button" className="btn btn-text sr-every" onClick={onEverything}>
        Search everything instead
      </button>
    </div>
  ) : null;

  const suggestion =
    res.suggestion && res.suggestion !== res.q.trim().toLowerCase() ? (
      <p className="sr-did">
        Did you mean{" "}
        <a
          href={searchHref(res.suggestion)}
          onClick={(ev) => {
            ev.preventDefault();
            onQuery(res.suggestion ?? "");
          }}
        >
          {res.suggestion}
        </a>
        ?
      </p>
    ) : null;

  const related = (res.related.length ? res.related : STARTERS.map((id) => eng.conceptById.get(id)).filter((c): c is SearchEntry => !!c)).slice(0, 6);
  const topics = (
    <div className="sr-related">
      <span className="sr-related-h">{res.related.length ? "Related topics" : "Try"}</span>
      {related.map((c) => (
        <a
          key={c.id}
          className="sr-topic"
          href={searchHref(c.ys?.[0] ?? c.n)}
          onClick={(ev) => {
            ev.preventDefault();
            onQuery(c.ys?.[0] ?? c.n);
          }}
        >
          {c.ys?.[0] ?? c.n}
        </a>
      ))}
    </div>
  );

  const total = res.series.length + res.docs.length + res.tables.length;
  const zero = (
    <div className="sr-zero">
      <p>
        <strong>
          Nothing in this release matches “{res.q.trim()}”{res.chips.length ? " with these filters" : ""}.
        </strong>
      </p>
      {!res.concept ? (
        <p className="sr-card-p">
          This release holds the federal budget (Annual Budget Statement), consumer prices (the CPI in the Monthly Review of Price Indices) and the Labour
          Force Survey. What is not here yet is listed on the <a href="/releases">releases page</a>.
        </p>
      ) : null}
      {topics}
      <p>
        <a href="/browse">Browse the catalogue</a>
      </p>
    </div>
  );

  if (mode === "page") return <PageResults res={res} eng={eng} view={view} chips={chips} suggestion={suggestion} topics={topics} zero={zero} footer={footer} />;

  /* ---------- the header dialog ---------- */
  const groups: { key: string; title: string; hits: SearchEntry[] }[] = [
    { key: "s", title: "Series", hits: res.series.slice(0, limits.s).map((h) => h.e) },
    { key: "d", title: "Documents", hits: res.docs.slice(0, limits.d).map((h) => h.e) },
    { key: "t", title: "Tables as printed", hits: res.tables.slice(0, limits.t).map((h) => h.e) },
  ].filter((g) => g.hits.length);
  let n = -1;
  return (
    <div className="sr sr--dialog">
      {chips}
      {suggestion}
      {res.concept ? <AnswerCard c={res.concept} res={res} eng={eng} compact /> : null}
      {res.partial ? <p className="sr-note">No result has every word you typed; these match some of them.</p> : null}
      {total === 0 ? (
        zero
      ) : (
        <div role="listbox" id={listId} aria-label="Results" className="sr-groups">
          {groups.map((g) => (
            <div key={g.key} className="sr-group" role="group" aria-labelledby={`${listId}-g${g.key}`}>
              <h3 className="sr-group-h" id={`${listId}-g${g.key}`} role="presentation">
                {g.title}
              </h3>
              <ul className="sr-list" role="presentation">
                {g.hits.map((e) => {
                  n++;
                  const i = n;
                  return (
                    <li key={e.k + e.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className="sr-opt" onMouseMove={() => setActive?.(i)}>
                      <a href={e.h} tabIndex={-1}>
                        <span className="r-title">
                          <Highlight text={e.n} words={res.words} />
                        </span>
                        {e.k === "s" ? (
                          <SeriesAnswer e={e} />
                        ) : (
                          <span className="r-meta">
                            {e.k === "d" ? "Document" : "Table as printed"} · {e.d}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {total > 0 && (res.related.length || res.partial) ? topics : null}
      {footer}
    </div>
  );
}

function PageResults({
  res,
  eng,
  view,
  chips,
  suggestion,
  topics,
  zero,
  footer,
}: {
  res: SearchResult;
  eng: Engine;
  view?: PageView;
  chips: ReactNode;
  suggestion: ReactNode;
  topics: ReactNode;
  zero: ReactNode;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [seen, setSeen] = useState(res.q);
  if (seen !== res.q) {
    setSeen(res.q);
    setOpen({});
  }
  const type = view?.type ?? null;
  const pick = view?.pick ?? {};
  const sparks = view?.sparks ?? null;
  const series = applyFacets(res.series, pick);
  const fams = families(series);
  const choices = facetChoices(res.series, pick);
  const picked = (Object.keys(pick) as FacetKey[]).filter((k) => pick[k]);
  const clearAll = () => view?.onPick(Object.fromEntries(picked.map((k) => [k, null])));
  const total = res.series.length + res.docs.length + res.tables.length;
  const showS = type === null || type === "s";
  const showD = type === null || type === "d";
  const showT = type === null || type === "t";
  const tab = (t: string | null, label: string, n?: number) => (
    <a
      key={t ?? "all"}
      href={`?${new URLSearchParams({ q: res.q, ...(t ? { type: t } : {}) }).toString()}`}
      className="segtab"
      aria-current={type === t ? "true" : undefined}
      onClick={(ev) => {
        ev.preventDefault();
        view?.onType(t);
      }}
    >
      {label}
      {n !== undefined ? <span className="segtab-n">{n}</span> : null}
    </a>
  );
  const spark = (id: string) => (sparks ? sparks.s[id] : undefined);
  const answerSpark = res.concept?.a ? spark(res.concept.a.s) : undefined;

  const filters =
    showS && choices.length ? (
      <aside className="sp-filters" data-open={filtersOpen ? "true" : undefined} aria-label="Filters">
        <button type="button" className="btn sp-ftoggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
          Filters{picked.length ? ` · ${picked.length}` : ""}
        </button>
        <div className="sp-fbody">
          {choices.map((ch) => {
            // The release is a regular grid (each area holds the same groups and measures), so every choice of a
            // filter often has the same count. Then the count is said once, beside the heading, not on each chip.
            const each = ch.values.length > 1 && ch.values.every((x) => x.n === ch.values[0].n) ? ch.values[0].n : null;
            return (
            <div key={ch.key} className="sp-facet" role="group" aria-labelledby={`sp-f-${ch.key}`}>
              <h3 className="sp-facet-h" id={`sp-f-${ch.key}`}>
                {FACET_LABEL[ch.key]}
                {each !== null ? <span className="sp-facet-each"> · {each} each</span> : null}
              </h3>
              <ul className="sp-facet-list">
                {ch.values.map(({ v, n }) => {
                  const on = pick[ch.key] === v;
                  return (
                    <li key={v}>
                      <a
                        href={`?${new URLSearchParams({ q: res.q, [ch.key]: v }).toString()}`}
                        className="chip sp-chip"
                        aria-current={on ? "true" : undefined}
                        onClick={(ev) => {
                          ev.preventDefault();
                          view?.onPick({ [ch.key]: on ? null : v });
                        }}
                      >
                        {facetWords(ch.key, v)}
                        {each === null ? <span className="chip-n">{n}</span> : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
            );
          })}
          {picked.length ? (
            <button type="button" className="btn btn-text sp-fclear" onClick={clearAll}>
              Clear filters
            </button>
          ) : null}
        </div>
      </aside>
    ) : null;

  const other = (key: "d" | "t", title: string) => {
    const hits = key === "d" ? res.docs : res.tables;
    if (!hits.length) return null;
    const all = open[key] || type === key;
    const shown = all ? hits : hits.slice(0, PER_OTHER);
    return (
      <section className="sp-fam" aria-labelledby={`sp-g-${key}`}>
        <h2 className="sp-fam-h" id={`sp-g-${key}`}>
          {title} <span className="sp-fam-n">{hits.length}</span>
        </h2>
        <ul className="sp-docs">
          {shown.map(({ e }) => (
            <li key={e.id}>
              <a href={e.h} className="sp-doc-t">
                <Highlight text={e.n} words={res.words} />
              </a>
              <span className="sp-doc-m">{e.d}</span>
            </li>
          ))}
        </ul>
        {hits.length > shown.length ? (
          <button type="button" className="btn btn-text sp-more" onClick={() => setOpen((o) => ({ ...o, [key]: true }))}>
            Show all {hits.length}
          </button>
        ) : null}
      </section>
    );
  };

  return (
    <div className="sr sr--page">
      <div className="sp-top">
        {chips}
        {suggestion}
        {res.concept ? <AnswerCard c={res.concept} res={res} eng={eng} spark={answerSpark} /> : null}
        {res.partial ? <p className="sr-note">No result has every word you typed; these match some of them.</p> : null}
      </div>
      {total === 0 ? (
        <div className="sp-zero">{zero}</div>
      ) : (
        <>
          <nav className="segtabs sp-tabs" aria-label="Kind of result">
            {tab(null, "All")}
            {res.series.length ? tab("s", "Series", res.series.length) : null}
            {res.docs.length ? tab("d", "Documents", res.docs.length) : null}
            {res.tables.length ? tab("t", "Tables", res.tables.length) : null}
          </nav>
          {filters}
          <div className="sp-results">
            {showS && res.series.length && !series.length ? (
              <p className="sr-note">
                No series matches these filters.{" "}
                <button type="button" className="btn btn-text" onClick={clearAll}>
                  Clear filters
                </button>
              </p>
            ) : null}
            {showS
              ? fams.map((f) => {
                  const all = open[f.key] || (fams.length === 1 && type === "s");
                  const shown = all ? f.hits : f.hits.slice(0, PER_FAMILY);
                  return (
                    <section key={f.key} className={`sp-fam${f.key === "z-dated" ? " sp-fam--dated" : ""}`} aria-labelledby={`sp-g-${f.key}`}>
                      <h2 className="sp-fam-h" id={`sp-g-${f.key}`}>
                        {f.label} <span className="sp-fam-n">{f.hits.length}</span>
                      </h2>
                      <ul className="rc-grid">
                        {shown.map((h) => (
                          <ResultCard key={h.e.id} e={h.e} eng={eng} words={res.words} spark={spark(h.e.id)} />
                        ))}
                      </ul>
                      {f.hits.length > shown.length ? (
                        <button type="button" className="btn btn-text sp-more" onClick={() => setOpen((o) => ({ ...o, [f.key]: true }))}>
                          Show all {f.hits.length}
                        </button>
                      ) : null}
                    </section>
                  );
                })
              : null}
            {showD ? other("d", "Documents") : null}
            {showT ? other("t", "Tables as printed") : null}
            {res.related.length || res.partial ? topics : null}
            {footer}
          </div>
        </>
      )}
    </div>
  );
}

/** The options of a result in the order the dialog lists them (for arrow keys and Enter). */
export function optionsOf(res: SearchResult, limits: { s: number; d: number; t: number }): string[] {
  return [...res.series.slice(0, limits.s), ...res.docs.slice(0, limits.d), ...res.tables.slice(0, limits.t)].map((h) => h.e.h);
}
