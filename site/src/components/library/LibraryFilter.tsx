"use client";
// Filters of the Library index: publisher, kind, year and words of the title.
// The server renders every document as a plain list; this only hides rows
// (and groups left empty) in the browser. Without JavaScript the controls are
// not shown and the whole list is there. The filter lives in the address
// (?kind=&publisher=&year=&q=), read as an external store, so a filtered view
// can be linked and the back button works.
import { useEffect, useSyncExternalStore } from "react";

type Opt = { value: string; label: string };
export type FilterRow = { id: string; kind: string; publisher: string; year: string; text: string };
type F = { kind: string; publisher: string; year: string; q: string };
const KEYS = ["kind", "publisher", "year", "q"] as const;
const EVENT = "lib-filter";

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function parse(search: string): F {
  const p = new URLSearchParams(search);
  return { kind: p.get("kind") ?? "", publisher: p.get("publisher") ?? "", year: p.get("year") ?? "", q: p.get("q") ?? "" };
}

function write(f: F) {
  try {
    const u = new URL(window.location.href);
    for (const k of KEYS) {
      if (f[k]) u.searchParams.set(k, f[k]);
      else u.searchParams.delete(k);
    }
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  } catch {
    /* the address is only a convenience */
  }
  window.dispatchEvent(new Event(EVENT));
}

function passes(r: FilterRow, f: F, words: string[]): boolean {
  return (!f.kind || r.kind === f.kind) && (!f.publisher || r.publisher === f.publisher) && (!f.year || r.year === f.year) && words.every((w) => r.text.includes(w));
}

export default function LibraryFilter({ target, rows, kinds, publishers, years }: { target: string; rows: FilterRow[]; kinds: Opt[]; publishers: Opt[]; years: Opt[] }) {
  // The search part of the address in the browser; null in the server HTML (no controls there).
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => null,
  );
  const js = search !== null;
  const f = parse(search ?? "");
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const ok = new Set(rows.filter((r) => passes(r, f, words)).map((r) => r.id));
  const active = Boolean(f.kind || f.publisher || f.year || f.q);
  const key = [...ok].join("|");

  // Apply the filter to the server-rendered list (the DOM is the external system here).
  useEffect(() => {
    if (!js) return;
    const root = document.getElementById(target);
    if (!root) return;
    const show = new Set(key ? key.split("|") : []);
    for (const r of root.querySelectorAll<HTMLElement>("[data-lib-row]")) r.hidden = !show.has(r.dataset.libRow ?? "");
    for (const g of root.querySelectorAll<HTMLElement>("[data-lib-group]")) g.hidden = !g.querySelector("[data-lib-row]:not([hidden])");
  }, [js, key, target]);

  const set = (k: keyof F) => (e: { target: { value: string } }) => write({ ...f, [k]: e.target.value });

  return (
    <form className="lib-filter" role="search" aria-label="Filter the documents" hidden={!js} onSubmit={(e) => e.preventDefault()}>
      <label className="lib-f lib-f-q">
        <span className="lib-f-label">Title</span>
        <input type="search" value={f.q} onChange={set("q")} placeholder="Words in the title" autoComplete="off" />
      </label>
      <label className="lib-f">
        <span className="lib-f-label">Publisher</span>
        <select value={f.publisher} onChange={set("publisher")}>
          <option value="">Any</option>
          {publishers.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="lib-f">
        <span className="lib-f-label">Kind</span>
        <select value={f.kind} onChange={set("kind")}>
          <option value="">Any</option>
          {kinds.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="lib-f">
        <span className="lib-f-label">Year</span>
        <select value={f.year} onChange={set("year")}>
          <option value="">Any</option>
          {years.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {active ? (
        <button type="button" className="btn btn-text lib-f-clear" onClick={() => write({ kind: "", publisher: "", year: "", q: "" })}>
          Clear
        </button>
      ) : null}
      <p className="lib-f-count small" role="status" aria-live="polite">
        {active ? (ok.size ? `${ok.size} of ${rows.length} documents` : "No document matches") : ""}
      </p>
    </form>
  );
}
