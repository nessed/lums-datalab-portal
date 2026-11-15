"use client";
// What a search shows (DESIGN.md 10), drawn the same way in the header dialog
// and on /search: the answer card, the filters read from the words (removable),
// then series, documents and tables as their own groups, and never a dead end.
// Every number here comes from the search index, which
// scripts/checks/search-index.mjs checks against the release.
import type { ReactNode } from "react";
import { answerValues, seriesHrefOf, type Engine, type SearchEntry, type SearchResult } from "@/lib/search";

/** Concepts offered when nothing matches (ids from editorial/concepts.json). */
const STARTERS = ["inflation", "health-spending", "unemployment", "tax-revenue", "federal-spending", "labour-force"];

export const searchHref = (q: string, infer = true) => `/search?q=${encodeURIComponent(q)}${infer ? "" : "&infer=0"}`;

function Highlight({ text, words }: { text: string; words: string[] }) {
  const ts = words.filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!ts.length) return <>{text}</>;
  const parts = text.split(new RegExp(`\\b(${ts.join("|")}\\w*)`, "ig"));
  return <>{parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p))}</>;
}

/** The answer line of a series: latest checked value, kind, period, unit. */
export function SeriesAnswer({ e, link }: { e: SearchEntry; link?: boolean }) {
  if (!e.lv) return <span className="sr-none">No checked value yet</span>;
  const label = `${e.lv}, ${e.lk ? `${e.lk}, ` : ""}${e.lp}${e.cand ? ", not signed off" : ""}: see where it is printed`;
  return (
    <span className="sr-ans">
      {link && e.lo ? (
        <a href={e.lo} className="v-link sr-v" aria-label={label}>
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

export function AnswerCard({ c, res, eng, compact }: { c: SearchEntry; res: SearchResult; eng: Engine; compact?: boolean }) {
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
                <a href={e.h}>{e.n}</a> <SeriesAnswer e={e} />
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
  return (
    <section className="sr-card" aria-labelledby={`sr-card-${c.id}`}>
      <p className="sr-kicker">{c.t}</p>
      <h2 className="sr-card-h" id={`sr-card-${c.id}`}>
        <a href={seriesHrefOf(a.s)}>{a.n}</a>
      </h2>
      {asked && !forYears ? <p className="sr-card-note">No checked figure for the year you asked; the latest is shown.</p> : null}
      <ul className="sr-card-vals">
        {vals.slice(0, compact ? 3 : 6).map((v) => (
          <li key={v.o}>
            <a href={v.o} className="v-link sr-card-v" aria-label={`${v.v}, ${v.k}, ${v.pw}: see where it is printed`}>
              {v.v}
            </a>
            <span className="sr-card-kp">
              {v.k} · {v.pw}
            </span>
            <span className="sr-src" title="Where it is printed">
              {v.m}
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-card-series">
        {a.pn ?? a.n} · {a.u}
      </p>
      <p className="sr-card-links">
        <a href={seriesHrefOf(a.s)}>Open the series</a>
        {vals[0] ? <a href={vals[0].o}>See where it is printed</a> : null}
      </p>
    </section>
  );
}

export type Opt = { id: string; href: string };

/** Results as a listbox (dialog) or as plain lists (page). */
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
}) {
  const dialog = mode === "dialog";
  const groups: { key: string; title: string; hits: SearchEntry[]; total: number }[] = [
    { key: "s", title: "Series", hits: res.series.slice(0, limits.s).map((h) => h.e), total: res.series.length },
    { key: "d", title: "Documents", hits: res.docs.slice(0, limits.d).map((h) => h.e), total: res.docs.length },
    { key: "t", title: "Tables as printed", hits: res.tables.slice(0, limits.t).map((h) => h.e), total: res.tables.length },
  ].filter((g) => g.hits.length);
  const none = groups.length === 0;
  let n = -1;

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

  const row = (e: SearchEntry) => {
    const body =
      e.k === "s" ? (
        <>
          <span className="r-title">
            <Highlight text={e.n} words={res.words} />
          </span>
          {e.pn ? <span className="r-meta r-printed">{e.pn}</span> : null}
          {dialog ? <SeriesAnswer e={e} /> : null}
          <span className="r-meta">
            {e.u} · {e.d}
            {e.l ? ` · printed as “${e.l}”` : ""}
          </span>
        </>
      ) : (
        <>
          <span className="r-title">
            <Highlight text={e.n} words={res.words} />
          </span>
          <span className="r-meta">
            {e.k === "d" ? "Document" : "Table as printed"} · {e.d}
          </span>
        </>
      );
    return body;
  };

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

  return (
    <div className={`sr sr--${mode}`}>
      {chips}
      {suggestion}
      {res.concept ? <AnswerCard c={res.concept} res={res} eng={eng} compact={dialog} /> : null}
      {res.partial ? <p className="sr-note">No result has every word you typed; these match some of them.</p> : null}
      {none ? (
        <div className="sr-zero">
          <p>
            <strong>Nothing in this release matches “{res.q.trim()}”{res.chips.length ? " with these filters" : ""}.</strong>
          </p>
          {!res.concept ? (
            <p className="sr-card-p">
              This release holds the federal budget (Annual Budget Statement), consumer prices (the CPI in the Monthly Review of Price Indices) and the
              Labour Force Survey. What is not here yet is listed on the <a href="/releases">releases page</a>.
            </p>
          ) : null}
          {topics}
          <p>
            <a href="/browse">Browse the catalogue</a>
          </p>
        </div>
      ) : (
        <div {...(dialog ? { role: "listbox", id: listId, "aria-label": "Results" } : {})} className="sr-groups">
          {groups.map((g) => (
            <div key={g.key} className="sr-group" role={dialog ? "group" : undefined} aria-labelledby={`${listId}-g${g.key}`}>
              <h3 className="sr-group-h" id={`${listId}-g${g.key}`} role={dialog ? "presentation" : undefined}>
                {g.title}
                {!dialog && g.total > g.hits.length ? <span className="sr-group-n"> · first {g.hits.length} shown</span> : null}
              </h3>
              <ul className="sr-list" role={dialog ? "presentation" : undefined}>
                {g.hits.map((e) => {
                  n++;
                  const i = n;
                  return dialog ? (
                    <li
                      key={e.k + e.id}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      className="sr-opt"
                      onMouseMove={() => setActive?.(i)}
                    >
                      <a href={e.h} tabIndex={-1}>
                        {row(e)}
                      </a>
                    </li>
                  ) : (
                    <li key={e.k + e.id} className="sr-row">
                      <a href={e.h} className="sr-row-a">
                        {row(e)}
                      </a>
                      {e.k === "s" ? (
                        <span className="sr-row-ans">
                          <SeriesAnswer e={e} link />
                          {e.lv ? <span className="sr-u"> · {e.u}</span> : null}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {!none && (res.related.length || res.partial) ? topics : null}
      {footer}
    </div>
  );
}

/** The options of a result in the order the dialog lists them (for arrow keys and Enter). */
export function optionsOf(res: SearchResult, limits: { s: number; d: number; t: number }): string[] {
  return [...res.series.slice(0, limits.s), ...res.docs.slice(0, limits.d), ...res.tables.slice(0, limits.t)].map((h) => h.e.h);
}
