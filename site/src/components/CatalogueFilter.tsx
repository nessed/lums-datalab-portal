"use client";
// Facets for the catalogue. The rows are server-rendered (each carries its
// facet values as data-f-* attributes); this narrows and sorts them in place.
// Within a facet the choices are OR, across facets AND. Each choice shows how
// many series it would leave given the other active filters. State lives in
// the URL (?q=&dataset=abs,cpi&topic=...&values=1&sort=name), so a link
// reproduces the view. Without JavaScript every row is shown.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { setQuery, useQuery } from "@/lib/url-state";
import { tokens } from "@/lib/search";

export type FacetGroup = {
  key: string;
  label: string;
  open: boolean;
  more?: number;
  note?: string;
  values: { value: string; label: string; count: number }[];
};

/** What the filter needs to know about each row (rendered by the server in the same order). */
export type RowData = { f: Record<string, string>; search: string; values: boolean; name: string; latest: string; n: number };

export default function CatalogueFilter({ groups, total, rows }: { groups: FacetGroup[]; total: number; rows: RowData[] }) {
  const q = useQuery();
  const text = q.get("q") ?? "";
  const onlyValues = q.get("values") === "1";
  const sort = q.get("sort") ?? "order";
  const qs = q.toString();
  const selected = useMemo(() => {
    const p = new URLSearchParams(qs);
    const m: Record<string, Set<string>> = {};
    for (const g of groups) m[g.key] = new Set((p.get(g.key) ?? "").split(",").filter(Boolean));
    return m;
  }, [qs, groups]);
  const [drawer, setDrawer] = useState(false);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<string | null>(null);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const ts = tokens(text);
  const passes = (r: RowData, except?: string) =>
    (!onlyValues || r.values) &&
    ts.every((t) => r.search.includes(t)) &&
    groups.every((g) => g.key === except || selected[g.key].size === 0 || selected[g.key].has(r.f[g.key] ?? ""));

  // Live counts per facet value, given every other active filter.
  const live: Record<string, Map<string, number>> | null = ready
    ? Object.fromEntries(
        groups.map((g) => {
          const m = new Map<string, number>();
          for (const r of rows) if (passes(r, g.key)) m.set(r.f[g.key] ?? "", (m.get(r.f[g.key] ?? "") ?? 0) + 1);
          return [g.key, m];
        }),
      )
    : null;
  const shown = rows.filter((r) => passes(r)).length;
  const filtering = ts.length > 0 || onlyValues || groups.some((g) => selected[g.key].size > 0);
  const visible = rows.map((r) => passes(r));
  const visibleKey = visible.map((v) => (v ? "1" : "0")).join("");

  // Apply to the server-rendered list: hide, then reorder. DOM only, no state.
  useEffect(() => {
    const list = document.getElementById("cat-list");
    const els = [...document.querySelectorAll<HTMLElement>("[data-cat-row]")];
    els.forEach((el) => {
      el.hidden = visibleKey[Number(el.dataset.order ?? 0)] !== "1";
    });
    const order = rows.map((r, i) => ({ r, i }));
    order.sort((a, b) =>
      sort === "name" ? a.r.name.localeCompare(b.r.name) : sort === "latest" ? b.r.latest.localeCompare(a.r.latest) || a.i - b.i : sort === "n" ? b.r.n - a.r.n || a.i - b.i : a.i - b.i,
    );
    const byOrder = new Map(els.map((el) => [Number(el.dataset.order ?? 0), el]));
    if (list) for (const { i } of order) list.appendChild(byOrder.get(i)!);
    const empty = document.querySelector<HTMLElement>("[data-cat-empty]");
    if (empty) empty.hidden = shown > 0;
    const status = document.getElementById("cat-status");
    if (status) status.textContent = filtering ? `${shown} of ${total} series match` : `${total} series`;
    const sel = document.getElementById("cat-sort") as HTMLSelectElement | null;
    if (sel) {
      sel.value = sort;
      sel.onchange = () => setQuery({ sort: sel.value === "order" ? null : sel.value }, "replace");
    }
  }, [visibleKey, sort, rows, shown, filtering, total]);

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
            Show <span data-count="series">{shown}</span> series
          </button>
        </div>
      </aside>
    </>
  );
}
