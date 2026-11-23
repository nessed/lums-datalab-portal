"use client";
// Filters of the Library index (Home v3 pages set, 2026-11-24): words of the
// title, and checkbox facets for publisher, kind and year, each option with the
// number of documents it would show. The server renders every document as a
// plain list; this only hides rows in the browser. The controls (and their
// counts) are drawn only in the browser: without JavaScript the whole list is
// there and the server HTML holds no count. The filter lives in the address
// (?kind=&publisher=&year=&q=, several values joined by commas), read as an
// external store, so a filtered view can be linked and the back button works.
import { useEffect, useSyncExternalStore } from "react";

type Opt = { value: string; label: string };
export type FilterRow = { id: string; kind: string; publisher: string; year: string; text: string };
type Facet = "kind" | "publisher" | "year";
type F = { kind: string[]; publisher: string[]; year: string[]; q: string };
const FACETS: Facet[] = ["publisher", "kind", "year"];
const EVENT = "lib-filter";

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT, cb);
  };
}

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
function parse(search: string): F {
  const p = new URLSearchParams(search);
  return { kind: list(p.get("kind")), publisher: list(p.get("publisher")), year: list(p.get("year")), q: p.get("q") ?? "" };
}

function write(f: F) {
  try {
    const u = new URL(window.location.href);
    for (const k of FACETS) {
      if (f[k].length) u.searchParams.set(k, f[k].join(","));
      else u.searchParams.delete(k);
    }
    if (f.q) u.searchParams.set("q", f.q);
    else u.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  } catch {
    /* the address is only a convenience */
  }
  window.dispatchEvent(new Event(EVENT));
}

function passes(r: FilterRow, f: F, words: string[], skip?: Facet): boolean {
  return FACETS.every((k) => k === skip || !f[k].length || f[k].includes(r[k])) && words.every((w) => r.text.includes(w));
}

const TITLES: Record<Facet, string> = { publisher: "Publisher", kind: "Kind of document", year: "Year" };

export default function LibraryFilter({ target, rows, kinds, publishers, years }: { target: string; rows: FilterRow[]; kinds: Opt[]; publishers: Opt[]; years: Opt[] }) {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => null,
  );
  const js = search !== null;
  const f = parse(search ?? "");
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const ok = new Set(rows.filter((r) => passes(r, f, words)).map((r) => r.id));
  const active = Boolean(f.kind.length || f.publisher.length || f.year.length || f.q);
  const key = [...ok].join("|");

  useEffect(() => {
    if (!js) return;
    const root = document.getElementById(target);
    if (!root) return;
    const show = new Set(key ? key.split("|") : []);
    for (const r of root.querySelectorAll<HTMLElement>("[data-lib-row]")) r.hidden = !show.has(r.dataset.libRow ?? "");
    const n = document.getElementById(`${target}-n`);
    if (n) n.hidden = active;
  }, [js, key, target, active]);

  if (!js) return null;
  const opts: Record<Facet, Opt[]> = { publisher: publishers, kind: kinds, year: years };
  const toggle = (k: Facet, v: string) => write({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });

  return (
    <form className="lib4-filter" role="search" aria-label="Filter the documents" onSubmit={(e) => e.preventDefault()}>
      <input type="search" value={f.q} onChange={(e) => write({ ...f, q: e.target.value })} placeholder="Filter by title" aria-label="Filter by title" autoComplete="off" />
      {FACETS.map((k) => (
        <fieldset key={k}>
          <legend>{TITLES[k]}</legend>
          {opts[k].map((o) => {
            const n = rows.filter((r) => r[k] === o.value && passes(r, f, words, k)).length;
            return (
              <label key={o.value}>
                <input type="checkbox" checked={f[k].includes(o.value)} onChange={() => toggle(k, o.value)} />
                <span className="lib4-opt">{o.label}</span>
                <span className="lib4-n">{n}</span>
              </label>
            );
          })}
        </fieldset>
      ))}
      {active ? (
        <button type="button" className="lib4-clear" onClick={() => write({ kind: [], publisher: [], year: [], q: "" })}>
          Clear filters
        </button>
      ) : null}
      <p className="lib4-status" role="status" aria-live="polite">
        {active ? (ok.size ? `${ok.size} of ${rows.length} documents` : "No document matches") : ""}
      </p>
    </form>
  );
}
