"use client";
// The results page, /search?q= (DESIGN.md 9.9, 10). A static page that draws
// its results in the browser from the same index and the same ranking as the
// header search. Everything lives in the URL, so a search is a link: ?q=,
// ?infer=0 for "search everything instead", ?type=s|d|t for the tab, and the
// filters ?topic= &area= &measure= &sex= &prov=. Sparklines come from a second
// small file fetched once the results show. Without JavaScript the form still
// submits here, and the page says where to look instead.
import { useEffect, useMemo, useState } from "react";
import { setQuery, useQuery } from "@/lib/url-state";
import { FACET_KEYS, loadEngine, loadSparks, runSearch, engineIfLoaded, sparksIfLoaded, type Engine, type FacetPick, type Sparks } from "@/lib/search";
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
  const [sparks, setSparks] = useState<Sparks | null>(sparksIfLoaded());
  const type = ["s", "d", "t"].includes(url.get("type") ?? "") ? url.get("type") : null;
  const pickKey = FACET_KEYS.map((k) => url.get(k) ?? "").join("|");
  const pick = useMemo<FacetPick>(() => {
    const vals = pickKey.split("|");
    return Object.fromEntries(FACET_KEYS.map((k, i) => [k, vals[i]]).filter(([, v]) => v));
  }, [pickKey]);
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
  // Sparklines: fetched once, after the first results are on screen.
  const hasResults = !!res && res.series.length > 0;
  useEffect(() => {
    if (!hasResults || sparks) return;
    let live = true;
    loadSparks(indexUrl.replace(/search\.json$/, "spark.json")).then(
      (s) => live && setSparks(s),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [hasResults, sparks, indexUrl]);
  const limits = { s: 500, d: 500, t: 500 };
  // A new query starts on every tab and with no filters chosen.
  const reset = Object.fromEntries(["type", ...FACET_KEYS].map((k) => [k, null]));
  const set = (next: string, nextInfer = true) => {
    setDraft(null);
    setQuery({ q: next.trim() || null, infer: nextInfer ? null : "0", ...reset }, "replace");
  };

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
              setQuery({ q: e.target.value || null, infer: null, ...reset }, "replace");
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
          checked value, and the <Link href="/library">Library</Link> lists every document.
        </p>
      </noscript>
      <p className={`sp-status${res && res.series.length + res.docs.length + res.tables.length ? " sr-only" : ""}`} aria-live="polite">
        {failed ? (
          <>
            The search index could not be loaded. <a href="/browse">Browse the catalogue instead</a>.
          </>
        ) : !q.trim() ? (
          "Type a topic, plain words or an official name. Typos are forgiven."
        ) : !eng ? (
          "Loading the index…"
        ) : res ? (
          `${res.series.length} series, ${res.docs.length} documents and ${res.tables.length} tables match “${q.trim()}”.`
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
          view={{
            type,
            pick,
            sparks,
            onType: (t) => setQuery({ type: t }, "push"),
            onPick: (patch) => setQuery(patch, "push"),
          }}
          footer={
            res.series.length ? (
              <p className="sp-foot">
                <a href={`/browse?q=${encodeURIComponent(q.trim())}`}>The matching series in the catalogue, as a table</a>
              </p>
            ) : null
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
