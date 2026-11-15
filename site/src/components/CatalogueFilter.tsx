"use client";
// Facets and results for the catalogue. The server renders only the top-level
// series (DESIGN.md 14.1: at most 1,500 elements). The full list of rows is one
// static JSON file (/catalogue.json), fetched the first time a reader filters
// or asks for every series; matching rows are then drawn here, 50 at a time.
// Within a facet the choices are OR, across facets AND. Each choice shows how
// many series it would leave given the other active filters. State lives in
// the URL (?q=&dataset=abs,cpi&topic=...&values=1&sort=name&all=1), so a link
// reproduces the view. Without JavaScript the top-level series are listed and
// every other series is reached from its parent's page.
// A text query (?q=) uses the site search's index and ranking (src/lib/search.ts,
// DESIGN.md 10.8): typos, synonyms and concepts are forgiven the same way, and
// rows are sorted by relevance unless another order is chosen. The catalogue
// infers no filter from the words (its filters are the facets on the left).
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

type Filter = { ts: string[]; rank: Map<string, number> | null; onlyValues: boolean; selected: Record<string, Set<string>>; groups: FacetGroup[] };
const passes = (r: CatalogueRow, x: Filter, except?: string) =>
  (!x.onlyValues || r.n > 0) &&
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

function useCatalogue(groups: FacetGroup[], indexUrl: string) {
  const q = useQuery();
  const text = q.get("q") ?? "";
  const onlyValues = q.get("values") === "1";
  const sort = q.get("sort") ?? "order";
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
  const filtering = ts.length > 0 || onlyValues || groups.some((g) => selected[g.key].size > 0);
  const [rows, setRows] = useState<CatalogueRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if ((filtering || wantAll) && !rows) loadRows().then(setRows, () => setFailed(true));
  }, [filtering, wantAll, rows]);
  const filter = useMemo<Filter>(() => ({ ts, rank, onlyValues, selected, groups }), [ts, rank, onlyValues, selected, groups]);
  return { text, onlyValues, sort, wantAll, selected, ts, filtering, rows, failed, filter };
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
      sel.onchange = () => setQuery({ sort: sel.value === "order" ? null : sel.value }, "replace");
    }
  }, [active, c.rows, c.filtering, matches.length, total, c.sort]);
  if (!active) return null;
  if (c.failed) return <p className="cat-empty">The list of series could not be loaded. Reload the page, or open a series from the list.</p>;
  if (!c.rows) return <p className="cat-status">Loading every series…</p>;
  return (
    <>
      <ul className="cat-list" aria-label="Matching series">
        {matches.slice(0, limit).map((r) => (
          <li key={r.id} className="cat-row">
            <div className="cat-name">
              <Link href={r.href}>{r.name}</Link>
              {r.tags.map((t) => (
                <span key={t} className={`tag${t === "19th ICLS" ? " tag-warn" : ""}`}>
                  {t}
                </span>
              ))}
              {r.parent ? <span className="cat-path">in {r.parent}</span> : null}
            </div>
            <div className="cat-unit">{r.unit}</div>
            <div className="cat-periods">{r.from ? `${r.from} to ${r.to}` : "no periods"}</div>
            <div className="cat-count num">
              {r.n} <span className="muted">of</span> {r.all}
              <span className="cat-count-w"> checked</span>
            </div>
            <div className="cat-latest num">
              {r.latest ? (
                <>
                  <Link
                    href={r.latest.href}
                    className="v-link"
                    aria-label={`${r.latest.v}, ${r.latest.kind ? `${r.latest.kind} ` : ""}${r.latest.period}: see where it is printed`}
                  >
                    {r.latest.v}
                  </Link>
                  <span className="cat-kind">
                    {r.latest.kind ? `${r.latest.kind} ` : ""}
                    {r.latest.period}
                  </span>
                </>
              ) : (
                <span className="muted">no checked value</span>
              )}
            </div>
            <div className="cat-spark" />
            <div className="cat-dl">
              <a href={r.csv} download aria-label={`Download ${r.name} as CSV`}>
                CSV
              </a>
            </div>
          </li>
        ))}
      </ul>
      {matches.length === 0 ? (
        <p className="cat-empty">
          No series matches. Try fewer words or fewer filters, or <a href="/browse">clear them all</a>.
        </p>
      ) : null}
      {matches.length > limit ? (
        <button type="button" className="btn cat-more" onClick={() => setLimit((l) => l + 50)}>
          Show {Math.min(50, matches.length - limit)} more of {matches.length - limit}
        </button>
      ) : null}
    </>
  );
}

export default function CatalogueFilter({ groups, indexUrl }: { groups: FacetGroup[]; indexUrl: string }) {
  const c = useCatalogue(groups, indexUrl);
  const { text, onlyValues, selected, ts, filtering, rows } = c;
  const [drawer, setDrawer] = useState(false);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<string | null>(null);
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
    const patch: Record<string, null> = { q: null, values: null };
    for (const g of groups) patch[g.key] = null;
    setDraft(null);
    setQuery(patch, "replace");
  };
  const activeCount = groups.reduce((a, g) => a + selected[g.key].size, 0) + (onlyValues ? 1 : 0) + (ts.length ? 1 : 0);

  return (
    <>
      <button type="button" className="btn cat-drawer-btn" aria-expanded={drawer} aria-controls="cat-facets" onClick={() => setDrawer(true)}>
        Filters{activeCount ? ` · ${activeCount} active` : ""}
      </button>
      <aside id="cat-facets" className={`cat-facets${drawer ? " is-open" : ""}`} aria-label="Filters">
        <div className="cat-drawer-head">
          <strong>Filters</strong>
          <button type="button" className="btn" onClick={() => setDrawer(false)}>
            Close
          </button>
        </div>
        <form role="search" aria-label="Filter the catalogue" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="cat-q">Filter this list</label>
            <input
              id="cat-q"
              className="input"
              type="search"
              placeholder="health, food, female…"
              value={draft ?? text}
              autoComplete="off"
              onChange={(e) => {
                setDraft(e.target.value);
                setQuery({ q: e.target.value || null }, "replace");
              }}
            />
          </div>
          <label className="facet-opt facet-values">
            <input type="checkbox" checked={onlyValues} onChange={(e) => setQuery({ values: e.target.checked ? "1" : null }, "replace")} />
            <span>Only series with checked values</span>
          </label>
          {groups.map((g) => {
            const limit = g.more && !showAll[g.key] ? g.more : Infinity;
            const vals = g.values.filter((v, i) => i < limit || selected[g.key].has(v.value));
            const nSel = selected[g.key].size;
            return (
              <details key={g.key} className="facet" open={g.open || nSel > 0}>
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
                      <label key={v.value} className="facet-opt" htmlFor={id} data-zero={n === 0 && !selected[g.key].has(v.value) ? "true" : undefined}>
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
          {filtering ? (
            <button type="button" className="btn facet-clear" onClick={clearAll}>
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
