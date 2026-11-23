"use client";
// Search results, Home v3 pages set (design handoff, 2026-11-24): a quick-answer
// card, checkbox facets on the left (Type, Topic, Publisher, Frequency) whose
// counts come from the results themselves, one ranked list of series, documents
// and tables, a sort and pages of twenty. Drawn in the browser from the same
// index and ranking as the header search (lib/search.ts); nothing here is in the
// server HTML. "Insight" and "Dataset" types appear only when the index holds them.
import { useMemo, useState } from "react";
import type { Engine, Hit, SearchEntry, SearchResult, Sparks } from "@/lib/search";
import { AnswerCard, SearchSpark, SeriesAnswer } from "@/components/search/SearchView";

type Kind = "Indicator" | "Document" | "Table";
type Row = { h: Hit; kind: Kind; topic: string | null; publisher: string | null; freq: string | null; order: number };
type FacetName = "Type" | "Topic" | "Publisher" | "Frequency";
const FACETS: FacetName[] = ["Type", "Topic", "Publisher", "Frequency"];
const PER_PAGE = 20;

/** The data type of an entry: from the series id, or a document's type. */
function family(e: SearchEntry): "abs" | "cpi" | "lfs" | "pes" | "sbp" | null {
  if (e.k === "s") {
    const p = e.id.split(".")[0];
    if (p === "cpi" || p === "lfs") return p;
    if (p === "fed" || p === "abs") return "abs";
    return null;
  }
  const dt = e.dt ?? "";
  if (dt.startsWith("abs")) return "abs";
  if (dt.startsWith("cpi")) return "cpi";
  if (dt.startsWith("lfs")) return "lfs";
  if (dt.startsWith("pes")) return "pes";
  if (dt.startsWith("sbp")) return "sbp";
  return null;
}
const TOPIC: Record<string, string> = { abs: "Federal budget", cpi: "Prices and inflation", lfs: "Jobs and labour", pes: "Economic Survey", sbp: "Prices and inflation" };
const PUBLISHER: Record<string, string> = { abs: "Finance Division", cpi: "Pakistan Bureau of Statistics", lfs: "Pakistan Bureau of Statistics", pes: "Finance Division", sbp: "State Bank of Pakistan" };
const FREQ: Record<string, string> = { month: "Monthly", fiscal_year: "Yearly", year: "Yearly", survey_round: "Each survey", quarter: "Quarterly" };

function rowsOf(res: SearchResult): Row[] {
  const mk = (h: Hit, kind: Kind, i: number): Row => {
    const f = family(h.e);
    return { h, kind, topic: f ? TOPIC[f] : null, publisher: f ? PUBLISHER[f] : null, freq: kind === "Indicator" && h.e.f ? (FREQ[h.e.f] ?? null) : null, order: i };
  };
  const all = [...res.series.map((h) => mk(h, "Indicator", 0)), ...res.docs.map((h) => mk(h, "Document", 0)), ...res.tables.map((h) => mk(h, "Table", 0))];
  // Best match: by score; the engine's own order breaks ties (series first).
  return all.map((r, i) => ({ ...r, order: i })).sort((a, b) => b.h.score - a.h.score || a.order - b.order);
}

const valueOf = (r: Row, f: FacetName): string | null => (f === "Type" ? r.kind : f === "Topic" ? r.topic : f === "Publisher" ? r.publisher : r.freq);
const recent = (e: SearchEntry) => e.to ?? e.p ?? "";

export default function Results4({ res, eng, sparks, q, onQuery, onEverything }: { res: SearchResult; eng: Engine; sparks: Sparks | null; q: string; onQuery: (q: string) => void; onEverything: () => void }) {
  const rows = useMemo(() => rowsOf(res), [res]);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<"best" | "recent" | "name">("best");
  const [page, setPage] = useState(0);

  const chosen = (f: FacetName) => Object.keys(on).filter((k) => on[k] && k.startsWith(`${f}:`)).map((k) => k.slice(f.length + 1));
  const passes = (r: Row, skip?: FacetName) =>
    FACETS.every((f) => {
      if (f === skip) return true;
      const c = chosen(f);
      return !c.length || c.includes(valueOf(r, f) ?? "");
    });
  const shown = rows.filter((r) => passes(r));
  const sorted =
    sort === "best" ? shown : [...shown].sort((a, b) => (sort === "name" ? a.h.e.n.localeCompare(b.h.e.n) : recent(b.h.e).localeCompare(recent(a.h.e)) || a.order - b.order));
  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const pg = Math.min(page, pages - 1);
  const slice = sorted.slice(pg * PER_PAGE, pg * PER_PAGE + PER_PAGE);
  const facets = FACETS.map((f) => {
    const m = new Map<string, number>();
    for (const r of rows.filter((x) => passes(x, f))) {
      const v = valueOf(r, f);
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    // a chosen value stays listed even when nothing else matches it
    for (const v of chosen(f)) if (!m.has(v)) m.set(v, 0);
    return { f, opts: [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) };
  }).filter((x) => x.opts.length > 0);
  const toggle = (k: string) => {
    setOn((o) => ({ ...o, [k]: !o[k] }));
    setPage(0);
  };
  const anyOn = Object.values(on).some(Boolean);

  const concept = res.concept && !res.concept.miss && res.concept.a ? res.concept : res.concept?.miss ? res.concept : null;
  const top = !concept ? res.series.find((h) => h.e.lv)?.e : undefined;

  return (
    <>
      <div className="sr4-top">
        <h1>
          Results for &ldquo;{q.trim()}&rdquo;
        </h1>
        <p>
          {rows.length} {rows.length === 1 ? "result" : "results"}
          {res.suggestion ? (
            <>
              {" "}
              · Did you mean{" "}
              <button type="button" className="sr4-linkbtn" onClick={() => onQuery(res.suggestion!)}>
                {res.suggestion}
              </button>
              ?
            </>
          ) : null}
          {res.chips.length ? (
            <>
              {" "}
              · Narrowed by your words.{" "}
              <button type="button" className="sr4-linkbtn" onClick={onEverything}>
                Search everything instead
              </button>
            </>
          ) : null}
        </p>
      </div>
      <div className="sr4-grid">
        <aside className="sr4-facets" aria-label="Filters">
          {facets.map(({ f, opts }) => (
            <fieldset key={f}>
              <legend>{f}</legend>
              {opts.map(([v, n]) => {
                const k = `${f}:${v}`;
                return (
                  <label key={k}>
                    <input type="checkbox" checked={!!on[k]} onChange={() => toggle(k)} />
                    <span className="sr4-fv">{v}</span>
                    <span className="sr4-fn">{n}</span>
                  </label>
                );
              })}
            </fieldset>
          ))}
          {anyOn ? (
            <button
              type="button"
              className="sr4-linkbtn"
              onClick={() => {
                setOn({});
                setPage(0);
              }}
            >
              Clear all filters
            </button>
          ) : null}
        </aside>
        <div className="sr4-main">
          {concept ? (
            <div className="sr4-quick">
              <AnswerCard c={concept} res={res} eng={eng} spark={concept.a ? sparks?.s[concept.a.s] : undefined} />
            </div>
          ) : top ? (
            <section className="sr4-quick sr4-quick--series" aria-label="Quick answer">
              <div>
                <p className="sr4-qk">{top.n}</p>
                <p className="sr4-qv">
                  <SeriesAnswer e={top} link />
                </p>
                <p className="sr4-ql">
                  <a href={top.h} className="strong">
                    Open the indicator
                  </a>
                </p>
              </div>
              <a href={top.h} tabIndex={-1} aria-hidden="true" className="sr4-qspark">
                <SearchSpark row={sparks?.s[top.id]} w={300} h={90} />
              </a>
            </section>
          ) : null}
          <div className="sr4-bar">
            <p>
              Showing {slice.length} of {sorted.length}
            </p>
            <label>
              Sort by{" "}
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as typeof sort);
                  setPage(0);
                }}
              >
                <option value="best">Best match</option>
                <option value="recent">Most recent</option>
                <option value="name">Name, A to Z</option>
              </select>
            </label>
          </div>
          {sorted.length ? (
            <ol className="sr4-list">
              {slice.map((r) => (
                <ResultRow key={`${r.kind}:${r.h.e.id}`} r={r} sparks={sparks} />
              ))}
            </ol>
          ) : (
            <p className="sr4-none">Nothing matches every filter you chose. Clear a filter to see more.</p>
          )}
          {pages > 1 ? (
            <nav className="sr4-pages" aria-label="Pages">
              {Array.from({ length: pages }, (_, i) => i)
                .filter((i) => i === 0 || i === pages - 1 || Math.abs(i - pg) <= 2)
                .map((i, j, arr) => (
                  <span key={i} className="sr4-pg">
                    {j > 0 && i - arr[j - 1] > 1 ? <span className="sr4-gap">…</span> : null}
                    <button type="button" aria-current={i === pg ? "page" : undefined} onClick={() => setPage(i)}>
                      {i + 1}
                    </button>
                  </span>
                ))}
              {pg < pages - 1 ? (
                <button type="button" className="sr4-next" onClick={() => setPage(pg + 1)}>
                  Next
                </button>
              ) : null}
            </nav>
          ) : null}
          {res.series.length ? (
            <p className="sr4-foot">
              <a href={`/browse?q=${encodeURIComponent(q.trim())}`}>The matching indicators as a table</a>
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

function ResultRow({ r, sparks }: { r: Row; sparks: Sparks | null }) {
  const e = r.h.e;
  const desc = r.kind === "Indicator" ? [e.pn && e.pn !== e.n ? `Printed as ${e.pn}` : null, e.u].filter(Boolean).join(" · ") : (e.d ?? "");
  const meta = [r.kind === "Indicator" ? e.d : null, r.publisher, e.p, r.freq].filter(Boolean).join(" · ");
  return (
    <li className="sr4-row">
      <div className="sr4-body">
        <span className="sr4-type">{r.kind}</span>
        <h2>
          <a href={e.h}>{e.n}</a>
        </h2>
        {desc ? <p className="sr4-desc">{desc}</p> : null}
        {meta ? <p className="sr4-meta">{meta}</p> : null}
      </div>
      {r.kind === "Indicator" ? (
        <div className="sr4-val">
          <SearchSpark row={sparks?.s[e.id]} w={72} h={20} />
          <SeriesAnswer e={e} link />
        </div>
      ) : null}
    </li>
  );
}
