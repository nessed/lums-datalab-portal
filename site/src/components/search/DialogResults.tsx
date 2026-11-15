"use client";
// The results half of the header search dialog. Loaded on first open (a
// separate chunk), so pages that never search do not carry the search code.
// It tells the dialog which options it lists, in order, so the arrow keys and
// Enter in the dialog's input work (combobox pattern).
import { useEffect, useMemo, useState } from "react";
import { loadEngine, runSearch, engineIfLoaded, type Engine } from "@/lib/search";
import { optionsOf, searchHref, SearchView } from "@/components/search/SearchView";

const LIMITS = { s: 8, d: 3, t: 3 };
const STARTERS = ["inflation", "health spending", "unemployment women", "tax revenue 2023", "GDP"];

export default function DialogResults({
  indexUrl,
  q,
  infer,
  listId,
  active,
  setActive,
  onOptions,
  onQuery,
}: {
  indexUrl: string;
  q: string;
  infer: boolean;
  listId: string;
  active: number;
  setActive: (i: number) => void;
  onOptions: (hrefs: string[]) => void;
  onQuery: (q: string, infer?: boolean) => void;
}) {
  const [eng, setEng] = useState<Engine | null>(engineIfLoaded());
  const [failed, setFailed] = useState(false);
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
  const res = useMemo(() => (eng && q.trim() ? runSearch(eng, q, { infer, typing: true }) : null), [eng, q, infer]);
  const opts = useMemo(() => (res ? optionsOf(res, LIMITS) : []), [res]);
  useEffect(() => onOptions(opts), [opts, onOptions]);

  const all = searchHref(q.trim(), infer);
  if (failed)
    return (
      <p className="search-msg">
        The search index could not be loaded. <a href="/browse">Browse the catalogue instead</a>.
      </p>
    );
  if (!eng) return <p className="search-msg muted">Loading the index…</p>;
  if (!res)
    return (
      <div className="search-msg">
        <p className="muted">Search series, documents and tables by topic, plain words or official names. Typos are forgiven.</p>
        <p className="sr-related">
          <span className="sr-related-h">Try</span>
          {STARTERS.map((s) => (
            <a
              key={s}
              href={searchHref(s)}
              className="sr-topic"
              onClick={(e) => {
                e.preventDefault();
                onQuery(s);
              }}
            >
              {s}
            </a>
          ))}
        </p>
      </div>
    );
  return (
    <SearchView
      res={res}
      eng={eng}
      mode="dialog"
      listId={listId}
      active={active}
      setActive={setActive}
      limits={LIMITS}
      onQuery={onQuery}
      onEverything={() => onQuery(q, false)}
      footer={
        <p className="search-all">
          <a href={all}>
            All results for “{q.trim()}”
            {res.series.length + res.docs.length + res.tables.length > opts.length ? ` (${res.series.length} series, ${res.docs.length} documents, ${res.tables.length} tables)` : ""}
          </a>
        </p>
      }
    />
  );
}
