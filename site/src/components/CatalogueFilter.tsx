"use client";
// Find data (/browse): the search field, the facets and the matching rows. The
// server renders only the top-level series, A to Z (DESIGN.md 14.1: at most
// 1,500 elements); that list is the page without JavaScript. The full list of
// rows is one static JSON file (/catalogue.json), fetched the first time a
// reader filters or asks for every series; matching rows are then drawn here,
// 50 at a time, and the server list is hidden.
// Within a facet the choices are OR, across facets AND; the years range keeps
// series with any figure in it. Each choice shows how many series it would
// leave given the other active filters. State lives in the URL
// (?q=&topic=...&dataset=abs,cpi&geo=...&from=2015&to=2020&values=1&sort=name&all=1),
// so a link reproduces the view.
// A text query (?q=) uses the site search's index and ranking (src/lib/search.ts,
// DESIGN.md 10.8): typos, synonyms and concepts are forgiven the same way, and
// rows are sorted by relevance unless another order is chosen. The catalogue
// infers no filter from the words (its filters are the facets on the left).
// Client code only filters: every figure it draws comes from /catalogue.json,
// which scripts/checks/catalogue-json.mjs checks against the release.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "@/components/ui/Link";
import { setQuery, useQuery } from "@/lib/url-state";
import { loadEngine, runSearch, tokens } from "@/lib/search";
import type { CatalogueRow } from "@/app/catalogue.json/route";

export type FacetGroup = {
  key: string;
  label: string;
  open: boolean;
  more?: number;
  note?: string;
  values: { value: string; label: string; count: number }[];
};

let rowsPromise: Promise<CatalogueRow[]> | null = null;
function loadRows(): Promise<CatalogueRow[]> {
  rowsPromise ??= fetch("/catalogue.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((j: { rows: CatalogueRow[] }) => j.rows)
    .catch((e) => {
      rowsPromise = null;
      throw e;
    });
  return rowsPromise;
}

/** First four-digit year in a period text ("June 2015", "2009-10"), or null. */
const yearOf = (t: string | null | undefined): number | null => {
  const m = /(\d{4})/.exec(t ?? "");
  return m ? Number(m[1]) : null;
};

type Filter = {
  ts: string[];
  rank: Map<string, number> | null;
  onlyValues: boolean;
  yFrom: number | null;
  yTo: number | null;
  selected: Record<string, Set<string>>;
  groups: FacetGroup[];
};
const inYears = (r: CatalogueRow, x: Filter) => {
  if (x.yFrom === null && x.yTo === null) return true;
  const a = yearOf(r.from);
  const b = yearOf(r.to);
  if (a === null || b === null) return false;
  return (x.yTo === null || a <= x.yTo) && (x.yFrom === null || b >= x.yFrom);
};
const passes = (r: CatalogueRow, x: Filter, except?: string) =>
  (!x.onlyValues || r.n > 0) &&
  inYears(r, x) &&
  (x.rank ? x.rank.has(r.id) : x.ts.every((t) => r.search.includes(t))) &&
  x.groups.every((g) => g.key === except || x.selected[g.key].size === 0 || x.selected[g.key].has(r.f[g.key] ?? ""));

/** Series ids in search order for a query, from the site search; null until loaded or if it fails (plain word match then). */
function useRank(text: string, indexUrl: string): Map<string, number> | null {
  const [got, setGot] = useState<{ text: string; rank: Map<string, number> } | null>(null);
  useEffect(() => {
    if (!text.trim()) return;
    let live = true;
    loadEngine(indexUrl).then(
      (eng) => {
        if (!live) return;
        const r = runSearch(eng, text, { infer: false });
        setGot({ text, rank: new Map(r.series.map((h, i) => [h.e.id, i])) });
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [text, indexUrl]);
  return text.trim() && got?.text === text ? got.rank : null;
}

const yearParam = (v: string | null): number | null => (v && /^\d{4}$/.test(v) ? Number(v) : null);

function useCatalogue(groups: FacetGroup[], indexUrl: string) {
  const q = useQuery();
  const text = q.get("q") ?? "";
  const onlyValues = q.get("values") === "1";
  const yFrom = yearParam(q.get("from"));
  const yTo = yearParam(q.get("to"));
  const wantAll = q.get("all") === "1";
  const qs = q.toString();
  const selected = useMemo(() => {
    const p = new URLSearchParams(qs);
    const m: Record<string, Set<string>> = {};
    for (const g of groups) m[g.key] = new Set((p.get(g.key) ?? "").split(",").filter(Boolean));
    return m;
  }, [qs, groups]);
  const ts = useMemo(() => tokens(text), [text]);
  const rank = useRank(text, indexUrl);
  // A to Z unless the reader chose another order; by relevance while searching.
  const sort = q.get("sort") ?? (ts.length ? "order" : "name");
  const filtering = ts.length > 0 || onlyValues || yFrom !== null || yTo !== null || groups.some((g) => selected[g.key].size > 0);
  const [rows, setRows] = useState<CatalogueRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if ((filtering || wantAll) && !rows) loadRows().then(setRows, () => setFailed(true));
  }, [filtering, wantAll, rows]);
  const filter = useMemo<Filter>(() => ({ ts, rank, onlyValues, yFrom, yTo, selected, groups }), [ts, rank, onlyValues, yFrom, yTo, selected, groups]);
  return { text, onlyValues, yFrom, yTo, sort, wantAll, selected, ts, filtering, rows, failed, filter };
}

/** The search field over the list: filters as you type (the words go in ?q=). Without JavaScript it submits to the site search. */
export function CatalogueSearch({ groups, indexUrl }: { groups: FacetGroup[]; indexUrl: string }) {
  const c = useCatalogue(groups, indexUrl);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <form
      role="search"
      aria-label="Filter the list of series"
      action="/search"
      method="get"
      className="fd-search"
      onSubmit={(e) => {
        // With JavaScript the list is already filtered: Enter stays on this page.
        e.preventDefault();
      }}
    >
      <label htmlFor="cat-q" className="sr-only">
        Filter the series
      </label>
      <svg className="fd-search-icon" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" />
        <path d="m10.5 10.5 3 3" />
      </svg>
      <input
        id="cat-q"
        name="q"
        type="search"
        className="fd-search-input"
        placeholder="Filter the series: inflation, defence, Punjab"
        value={draft ?? c.text}
        autoComplete="off"
        onChange={(e) => {
          setDraft(e.target.value);
          setQuery({ q: e.target.value || null }, "replace");
        }}
      />
      {c.text ? (
        <Link href={`/search?q=${encodeURIComponent(c.text)}`} className="fd-search-all">
          Search the whole site
        </Link>
      ) : null}
    </form>
  );
}

/** Rows that match, drawn in the browser. Shows nothing (the server list stays) while nothing is filtered. */
export function CatalogueResults({ groups, total, indexUrl }: { groups: FacetGroup[]; total: number; indexUrl: string }) {
  const c = useCatalogue(groups, indexUrl);
  const [limit, setLimit] = useState(50);
  const active = c.filtering || c.wantAll;
  const resetKey = `${c.text}|${c.filtering}|${c.wantAll}`;
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setLimit(50);
  }
  const matches = useMemo(() => {
    if (!c.rows) return [];
    const m = c.rows.filter((r) => passes(r, c.filter));
    const s = c.sort;
    const rank = c.filter.rank;
    m.sort((a, b) =>
      rank && s === "order"
        ? (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)
        : s === "name"
          ? a.name.localeCompare(b.name)
          : s === "latest"
            ? (b.latest?.latestPeriod ?? "").localeCompare(a.latest?.latestPeriod ?? "") || a.order - b.order
            : s === "n"
              ? b.n - a.n || a.order - b.order
              : a.order - b.order,
    );
    return m;
  }, [c.rows, c.filter, c.sort]);
  useEffect(() => {
    const server = document.getElementById("cat-list");
    if (server) server.hidden = active;
    const more = document.getElementById("cat-roots-note");
    if (more) more.hidden = active;
    const status = document.getElementById("cat-status");
    if (status && active && c.rows) status.textContent = c.filtering ? `${matches.length} of ${total} series match` : `All ${total} series`;
    const sel = document.getElementById("cat-sort") as HTMLSelectElement | null;
    if (sel) {
      sel.value = c.sort;
      sel.onchange = () => setQuery({ sort: sel.value }, "replace");
    }
  }, [active, c.rows, c.filtering, matches.length, total, c.sort]);
  if (!active) return null;
  if (c.failed) return <p className="cat-empty fd-empty">The list of series could not be loaded. Reload the page, or open a series from the list.</p>;
  if (!c.rows) return <p className="cat-status fd-loading">Loading every series…</p>;
  return (
    <>
      <ul className="cat-list fd-list" aria-label="Matching series">
        {matches.slice(0, limit).map((r) => (
          <li key={r.id} className="cat-row fd-row">
            <div className="fd-name">
              <Link href={r.href}>{r.name}</Link>
              <span className="fd-sub">
                {r.printed ? <>{r.printed} · </> : null}
                {r.unit}
                {r.parent ? <> · in {r.parent}</> : null}
              </span>
              {r.tags.length ? (
                <span className="fd-tags">
                  {r.tags.map((t) => (
                    <span key={t} className={`fd-tag${t === "19th ICLS" ? " fd-tag-warn" : ""}`}>
                      {t}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
            <div className="fd-years">{r.from ? `${r.from} to ${r.to}` : "no periods"}</div>
            <div className="fd-latest">
              {r.latest ? (
                <>
                  <Link
                    href={r.latest.href}
                    className="v-link fd-v"
                    aria-label={`${r.latest.v}, ${r.latest.kind ? `${r.latest.kind} ` : ""}${r.latest.period}: see where it is printed`}
                  >
                    {r.latest.v}
                  </Link>
                  <span className="fd-when">
                    {r.latest.kind ? `${r.latest.kind} ` : ""}
                    {r.latest.period}
                  </span>
                </>
              ) : (
                <span className="fd-none">no checked value</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {matches.length === 0 ? (
        <p className="cat-empty fd-empty">
          No series match. Try fewer filters, or another word for it, or <a href="/browse">clear them all</a>.
        </p>
      ) : null}
      {matches.length > limit ? (
        <button type="button" className="btn cat-more fd-more" onClick={() => setLimit((l) => l + 50)}>
          Show {Math.min(50, matches.length - limit)} more of {matches.length - limit}
        </button>
      ) : null}
    </>
  );
}

export default function CatalogueFilter({ groups, indexUrl, years }: { groups: FacetGroup[]; indexUrl: string; years: string[] }) {
  const c = useCatalogue(groups, indexUrl);
  const { onlyValues, selected, ts, filtering, rows, yFrom, yTo } = c;
  const [drawer, setDrawer] = useState(false);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Live counts per facet value, given every other active filter (once the rows are loaded).
  const live: Record<string, Map<string, number>> | null =
    ready && rows
      ? Object.fromEntries(
          groups.map((g) => {
            const m = new Map<string, number>();
            for (const r of rows) if (passes(r, c.filter, g.key)) m.set(r.f[g.key] ?? "", (m.get(r.f[g.key] ?? "") ?? 0) + 1);
            return [g.key, m];
          }),
        )
      : null;
  const shown = rows ? rows.filter((r) => passes(r, c.filter)).length : null;

  const toggle = (key: string, value: string) => {
    const next = new Set(selected[key]);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setQuery({ [key]: next.size ? [...next].join(",") : null }, "replace");
  };
  const clearAll = () => {
    const patch: Record<string, null> = { q: null, values: null, from: null, to: null };
    for (const g of groups) patch[g.key] = null;
    setQuery(patch, "replace");
  };
  const yearsOn = yFrom !== null || yTo !== null;
  const activeCount = groups.reduce((a, g) => a + selected[g.key].size, 0) + (onlyValues ? 1 : 0) + (ts.length ? 1 : 0) + (yearsOn ? 1 : 0);
  const first = years[0] ?? "";
  const last = years[years.length - 1] ?? "";

  return (
    <>
      <button type="button" className="btn cat-drawer-btn fd-drawer-btn" aria-expanded={drawer} aria-controls="cat-facets" onClick={() => setDrawer(true)}>
        Filters{activeCount ? ` · ${activeCount} active` : ""}
      </button>
      <aside id="cat-facets" className={`cat-facets fd-facets${drawer ? " is-open" : ""}`} aria-label="Filters">
        <div className="cat-drawer-head">
          <strong>Filters</strong>
          <button type="button" className="btn" onClick={() => setDrawer(false)}>
            Close
          </button>
        </div>
        <p className="fd-facets-head" aria-hidden="true">
          Filters
        </p>
        <form aria-label="Filters for the list" onSubmit={(e) => e.preventDefault()}>
          {groups.map((g) => {
            const limit = g.more && !showAll[g.key] ? g.more : Infinity;
            const vals = g.values.filter((v, i) => i < limit || selected[g.key].has(v.value));
            const nSel = selected[g.key].size;
            return (
              <details key={g.key} className="facet fd-facet" open={g.open || nSel > 0}>
                <summary>
                  {g.label}
                  {nSel ? <span className="facet-n">{nSel} chosen</span> : null}
                </summary>
                <fieldset>
                  <legend className="sr-only">{g.label}</legend>
                  {vals.map((v) => {
                    const n = live ? (live[g.key].get(v.value) ?? 0) : v.count;
                    const id = `f-${g.key}-${v.value}`.replace(/[^A-Za-z0-9_-]/g, "_");
                    return (
                      <label key={v.value} className="facet-opt fd-opt" htmlFor={id} data-zero={n === 0 && !selected[g.key].has(v.value) ? "true" : undefined}>
                        <input id={id} type="checkbox" checked={selected[g.key].has(v.value)} onChange={() => toggle(g.key, v.value)} />
                        <span>{v.label}</span>
                        <span className="facet-count" data-count={`facet:${g.key}:${v.value}`}>
                          {n}
                        </span>
                      </label>
                    );
                  })}
                  {g.more && g.values.length > g.more ? (
                    <button type="button" className="btn btn-text facet-more" onClick={() => setShowAll((s) => ({ ...s, [g.key]: !s[g.key] }))}>
                      {showAll[g.key] ? (
                        "Show fewer"
                      ) : (
                        <>
                          Show all <span data-count={`facetvalues:${g.key}`}>{g.values.length}</span>
                        </>
                      )}
                    </button>
                  ) : null}
                  {g.note ? <p className="coming facet-note">{g.note}</p> : null}
                </fieldset>
              </details>
            );
          })}
          {years.length > 1 ? (
            <fieldset className="fd-years-f">
              <legend>Years</legend>
              <div className="fd-years-row">
                <label className="sr-only" htmlFor="f-from">
                  From
                </label>
                <select
                  id="f-from"
                  className="fd-select"
                  value={yFrom !== null ? String(yFrom) : first}
                  onChange={(e) => setQuery({ from: e.target.value === first ? null : e.target.value }, "replace")}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <span>to</span>
                <label className="sr-only" htmlFor="f-to">
                  To
                </label>
                <select
                  id="f-to"
                  className="fd-select"
                  value={yTo !== null ? String(yTo) : last}
                  onChange={(e) => setQuery({ to: e.target.value === last ? null : e.target.value }, "replace")}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <p className="fd-years-note">Keeps series with any figure in these years. A fiscal year counts from the year it starts.</p>
            </fieldset>
          ) : null}
          <label className="facet-opt fd-opt facet-values">
            <input type="checkbox" checked={onlyValues} onChange={(e) => setQuery({ values: e.target.checked ? "1" : null }, "replace")} />
            <span>Only series with checked figures</span>
          </label>
          {filtering ? (
            <button type="button" className="btn facet-clear fd-clear" onClick={clearAll}>
              Clear all filters
            </button>
          ) : null}
        </form>
        <div className="cat-drawer-foot">
          <button type="button" className="btn btn-primary" onClick={() => setDrawer(false)}>
            {shown === null ? "Show series" : `Show ${shown} series`}
          </button>
        </div>
      </aside>
    </>
  );
}
