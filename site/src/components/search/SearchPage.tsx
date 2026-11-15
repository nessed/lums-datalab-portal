"use client";
// The results page, /search?q= (DESIGN.md 9.9, 10). A static page that draws
// its results in the browser from the same index and the same ranking as the
// header search. The query lives in the URL (?q=, and ?infer=0 for "search
// everything instead"), so a search is a link. Without JavaScript the form
// still submits here, and the page says where to look instead.
import { useEffect, useMemo, useState } from "react";
import { setQuery, useQuery } from "@/lib/url-state";
import { loadEngine, runSearch, engineIfLoaded, type Engine } from "@/lib/search";
import { SearchView } from "@/components/search/SearchView";
import { IconSearch } from "@/components/ui/Icons";
import Link from "@/components/ui/Link";

export default function SearchPage({ indexUrl }: { indexUrl: string }) {
  const url = useQuery();
  const q = url.get("q") ?? "";
  const infer = url.get("infer") !== "0";
  const [draft, setDraft] = useState<string | null>(null);
  const [eng, setEng] = useState<Engine | null>(engineIfLoaded());
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(1);
  useEffect(() => {
    if (eng) return;
    let live = true;
    loadEngine(indexUrl).then(
      (e) => live && setEng(e),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [eng, indexUrl]);
  const res = useMemo(() => (eng && q.trim() ? runSearch(eng, q, { infer }) : null), [eng, q, infer]);
  const [seen, setSeen] = useState(q);
  if (seen !== q) {
    setSeen(q);
    setMore(1);
  }
  const limits = { s: 30 * more, d: 30, t: 10 * more };
  const set = (next: string, nextInfer = true) => {
    setDraft(null);
    setQuery({ q: next.trim() || null, infer: nextInfer ? null : "0" }, "replace");
  };
  const total = res ? res.series.length + res.docs.length + res.tables.length : 0;
  const shown = res ? Math.min(res.series.length, limits.s) + Math.min(res.docs.length, limits.d) + Math.min(res.tables.length, limits.t) : 0;

  return (
    <div className="search-page">
      <h1>Search</h1>
      <form
        action="/search"
        method="get"
        role="search"
        className="sp-form"
        onSubmit={(e) => {
          e.preventDefault();
          set(draft ?? q, infer);
        }}
      >
        <label htmlFor="sp-q" className="sp-label">
          Search series, documents and tables
        </label>
        <div className="sp-box">
          <IconSearch />
          <input
            id="sp-q"
            name="q"
            type="search"
            className="sp-input"
            value={draft ?? q}
            placeholder="Inflation, health spending, unemployment women…"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            onChange={(e) => {
              setDraft(e.target.value);
              setQuery({ q: e.target.value || null, infer: null }, "replace");
            }}
          />
          <button type="submit" className="btn btn-primary sp-go">
            Search
          </button>
        </div>
      </form>
      <noscript>
        <p className="sp-nojs">
          Search runs in your browser and needs JavaScript. Without it, <Link href="/browse">the catalogue</Link> lists every top-level series with its latest
          checked value, and <Link href="/sources">Sources</Link> lists every document.
        </p>
      </noscript>
      <p className="sp-status" aria-live="polite">
        {failed ? (
          <>
            The search index could not be loaded. <a href="/browse">Browse the catalogue instead</a>.
          </>
        ) : !q.trim() ? (
          "Type a topic, plain words or an official name. Typos are forgiven."
        ) : !eng ? (
          "Loading the index…"
        ) : res ? (
          `${res.series.length} series, ${res.docs.length} documents and ${res.tables.length} tables match.`
        ) : null}
      </p>
      {res && eng ? (
        <SearchView
          res={res}
          eng={eng}
          mode="page"
          listId="sp"
          limits={limits}
          onQuery={(next, i) => set(next, i !== false)}
          onEverything={() => set(q, false)}
          footer={
            <div className="sp-foot">
              {shown < total ? (
                <button type="button" className="btn" onClick={() => setMore((m) => m + 1)}>
                  Show more results
                </button>
              ) : null}
              {res.series.length ? <a href={`/browse?q=${encodeURIComponent(q.trim())}`}>The matching series in the catalogue, with filters</a> : null}
            </div>
          }
        />
      ) : null}
      {!q.trim() ? (
        <p className="sp-browse">
          Or <a href="/browse">browse the catalogue</a>.
        </p>
      ) : null}
    </div>
  );
}
