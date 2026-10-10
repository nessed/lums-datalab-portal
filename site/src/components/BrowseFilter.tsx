"use client";
// Narrows the server-rendered catalogue in place: text (every word must match
// the name, id, synonyms or dataset), dataset, and "only series with values".
// State lives in the URL (?q=&dataset=&values=1). Without JavaScript the whole
// catalogue is shown.
import { useEffect, useRef } from "react";
import { setQuery, useQuery } from "@/lib/url-state";
import { tokens } from "@/lib/search";

export default function BrowseFilter({ datasets }: { datasets: { key: string; name: string }[] }) {
  const q = useQuery();
  const text = q.get("q") ?? "";
  const dataset = q.get("dataset") ?? "";
  const onlyValues = q.get("values") === "1";
  const input = useRef<HTMLInputElement>(null);
  const status = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const ts = tokens(text);
    const root = document.getElementById("catalogue");
    if (!root) return;
    let shown = 0;
    const rows = root.querySelectorAll<HTMLElement>("[data-cat-row]");
    rows.forEach((r) => {
      const ok =
        (!dataset || r.dataset.dataset === dataset) &&
        (!onlyValues || r.dataset.values === "1") &&
        ts.every((t) => (r.dataset.search ?? "").includes(t));
      r.hidden = !ok;
      if (ok) shown++;
    });
    const filtering = ts.length > 0 || !!dataset || onlyValues;
    // Open every group that holds a match; hide groups and datasets with none.
    root.querySelectorAll<HTMLDetailsElement>("details").forEach((det) => {
      const any = det.querySelector("[data-cat-row]:not([hidden])");
      if (filtering && any) det.open = true;
    });
    root.querySelectorAll<HTMLElement>(".cat-measure, .cat-group, .cat-node, [data-cat-dataset]").forEach((g) => {
      const has = g.querySelector("[data-cat-row]:not([hidden])") || (!filtering && g.matches("[data-cat-dataset]"));
      g.hidden = !has;
    });
    const empty = root.querySelector<HTMLElement>("[data-cat-empty]");
    if (empty) empty.hidden = shown > 0;
    if (status.current) status.current.textContent = filtering ? `${shown} ${shown === 1 ? "series matches" : "series match"}.` : `${rows.length} series.`;
  }, [text, dataset, onlyValues]);

  return (
    <form className="cat-filter" role="search" aria-label="Filter the catalogue" onSubmit={(e) => e.preventDefault()}>
      <div className="field cat-q">
        <label htmlFor="cat-q">Filter series</label>
        <input
          ref={input}
          id="cat-q"
          className="input"
          type="search"
          placeholder="health, food, unemployment women…"
          value={text}
          onChange={(e) => setQuery({ q: e.target.value || null }, "replace")}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <span className="field-label" id="cat-ds-l">
          Dataset
        </span>
        <span className="seg" role="group" aria-labelledby="cat-ds-l">
          <button type="button" aria-pressed={!dataset} onClick={() => setQuery({ dataset: null }, "replace")}>
            All
          </button>
          {datasets.map((d) => (
            <button key={d.key} type="button" aria-pressed={dataset === d.key} onClick={() => setQuery({ dataset: d.key }, "replace")}>
              {d.key.toUpperCase()}
              <span className="sr-only"> ({d.name})</span>
            </button>
          ))}
        </span>
      </div>
      <label className="cat-check">
        <input type="checkbox" checked={onlyValues} onChange={(e) => setQuery({ values: e.target.checked ? "1" : null }, "replace")} /> Only series with checked
        values
      </label>
      <p className="small muted cat-status" ref={status} aria-live="polite" />
    </form>
  );
}
