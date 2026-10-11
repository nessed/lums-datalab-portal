"use client";
// The chart builder: up to six series. The choice lives in the URL
// (?s=id,id&v=re&layout=multiples). Each series' release file
// (public/data/<v>/series/<id>.json, written by the prebuild) is fetched once;
// the default view arrives with the page. Nothing is computed: values are the
// release's own, joined by period.
//
// Rules (docs/DESIGN.md): different units, frequencies, labour-force
// definitions or CPI base years never share an axis; they become small
// multiples on one period axis. Lines stop at gaps and breaks. Each line has
// its own colour, dash and marker.
import { useEffect, useRef, useState } from "react";
import Chart, { LineKey } from "@/components/Chart";
import { chartModelFrom, periodOrdinal, type ChartModel, type ChartObs, type ChartSeries, type LineStyle } from "@/lib/chart-model";
import { formatDecimalString, periodWords, unitLabel, vintageWords } from "@/lib/format";
import { search, type SearchEntry } from "@/lib/search";
import { statusOf } from "@/lib/status";
import { setQuery, useQuery } from "@/lib/url-state";

export type SeriesFile = {
  series: ChartSeries & { dataset: string; derived?: boolean; dims?: Record<string, string>; parent_id?: string | null };
  observations: (ChartObs & { unit: string; scale_factor: number })[];
};

export const MAX = 6;
// Categorical palette: the same hexes as tokens --cat-1..6 (SVG attributes
// cannot read CSS variables), plus a dash and a marker per slot.
const STYLES: LineStyle[] = [
  { color: "#2a78d6", dash: null, marker: "circle" },
  { color: "#d4561f", dash: "6 4", marker: "square" },
  { color: "#16936a", dash: "2 3", marker: "diamond" },
  { color: "#b07800", dash: "8 3 2 3", marker: "circle" },
  { color: "#cc4f86", dash: "10 4", marker: "square" },
  { color: "#2f7d1a", dash: null, marker: "diamond" },
];
const slug = (id: string) => id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");
const baseOf = (f: SeriesFile) => f.series.dims?.base_year ?? (/b(\d{4})_(\d{2})$/.exec(f.series.series_id) ? f.series.series_id.slice(-7).replace("_", "-").replace("b", "") : null);

/** The kind of figure shown for a series: the one asked for if it has it, else budget estimate, else its most common. */
function vintageFor(f: SeriesFile, asked: string | null): string {
  const pub = f.observations.filter((o) => o.published && o.value !== null);
  if (asked && pub.some((o) => o.vintage === asked)) return asked;
  if (pub.some((o) => o.vintage === "be")) return "be";
  const n = new Map<string, number>();
  for (const o of pub) n.set(o.vintage, (n.get(o.vintage) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "na";
}

function merged(files: SeriesFile[], vintage: string | null, styleOf: (id: string) => LineStyle): ChartModel {
  const models = files.map((f) => {
    const v = vintageFor(f, vintage);
    return { f, v, m: chartModelFrom(f.series, f.observations.filter((o) => o.vintage === v)) };
  });
  const freq = files[0].series.frequency;
  const periods = [...new Set(files.flatMap((f) => f.observations.map((o) => o.period)))].sort();
  const ord = new Map(periods.map((p, i) => [p, periodOrdinal(p, freq) ?? i]));
  let step = Infinity;
  for (let i = 1; i < periods.length; i++) step = Math.min(step, ord.get(periods[i])! - ord.get(periods[i - 1])!);
  if (!Number.isFinite(step) || step <= 0) step = 1;
  const breaks = models.flatMap(({ m }) => m.breaks).filter((b, i, all) => all.findIndex((x) => x.atPeriod === b.atPeriod) === i);
  const xs = [...ord.values()];
  return {
    title: files.map((f) => f.series.name).join("; "),
    unit: unitLabel(files[0].series.unit, files[0].series.scale_factor),
    unitCode: files[0].series.unit,
    scale: files[0].series.scale_factor ?? 1,
    frequency: freq,
    zeroBased: files[0].series.unit !== "index",
    step,
    periods: periods.map((p) => ({ p, x: ord.get(p)!, label: models[0].m.periods.find((q) => q.p === p)?.label ?? p })),
    lines: models.map(({ f, v, m }) => ({
      key: f.series.series_id,
      label: `${f.series.name}${v !== "na" ? ` (${vintageWords(v).toLowerCase()})` : ""}`,
      style: styleOf(f.series.series_id),
      points: (m.lines[0]?.points ?? []).map((p) => ({ ...p, x: ord.get(p.period)! })),
    })),
    marks: [],
    breaks: breaks.map((b) => ({ ...b, inView: b.x > Math.min(...xs) && b.x < Math.max(...xs) })),
  };
}

/** Why the chosen series cannot share one axis, in words. Empty when they can. */
type BreakNote = { name: string; period: string; kind: string };

function reasons(files: SeriesFile[]): { split: string[]; notes: BreakNote[] } {
  const split: string[] = [];
  const notes: BreakNote[] = [];
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  if (uniq(files.map((f) => `${f.series.unit}|${f.series.scale_factor}`)).length > 1) split.push("they are in different units");
  if (uniq(files.map((f) => f.series.frequency)).length > 1) split.push("they are at different frequencies, so their periods do not line up");
  const defs = uniq(files.map((f) => f.series.dims?.definition).filter(Boolean));
  if (defs.length > 1) split.push(`they use different labour-force definitions (${defs.join(" and ")}), which are never drawn as one line or on one axis`);
  const bases = uniq(files.filter((f) => f.series.dataset === "cpi").map(baseOf).filter(Boolean));
  if (bases.length > 1) split.push("they are on different CPI base years");
  for (const f of files) for (const b of f.series.breaks) notes.push({ name: f.series.name, period: periodWords(b.at_period, f.series.frequency), kind: b.kind.replaceAll("_", " ") });
  return { split, notes };
}

export default function Compare({ dataBase, initial, initialFiles }: { dataBase: string; initial: string[]; initialFiles: Record<string, SeriesFile> }) {
  const q = useQuery();
  const sParam = q.get("s");
  const ids = (sParam === null ? initial : sParam === "none" ? [] : sParam.split(",").filter(Boolean)).slice(0, MAX);
  const askedVintage = q.get("v");
  const layoutAsked = q.get("layout");
  const [files, setFiles] = useState<Record<string, SeriesFile | "error">>(initialFiles);
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [text, setText] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const key = ids.join(",");
  useEffect(() => {
    let live = true;
    for (const id of key.split(",").filter(Boolean)) {
      if (files[id]) continue;
      fetch(`${dataBase}/series/${slug(id)}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j: SeriesFile) => live && setFiles((f) => ({ ...f, [id]: j })))
        .catch(() => live && setFiles((f) => ({ ...f, [id]: "error" })));
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dataBase]);

  const loadIndex = () => {
    if (index) return;
    fetch(`${dataBase}/search.json`)
      .then((r) => r.json())
      .then((j: SearchEntry[]) => setIndex(j.filter((e) => e.k === "s")))
      .catch(() => setIndex([]));
  };
  const results = index && text.trim() ? search(index, text, 8).filter((e) => !ids.includes(e.id)) : [];
  const setIds = (next: string[]) => setQuery({ s: next.length ? next.join(",") : "none" });

  // Colour follows the series, never its position after a removal.
  const styleOf = (id: string) => STYLES[Math.max(0, ids.indexOf(id)) % STYLES.length];
  const loaded = ids.map((id) => files[id]).filter((f): f is SeriesFile => !!f && f !== "error");
  const failed = ids.filter((id) => files[id] === "error");
  const ready = loaded.length === ids.length && ids.length > 0;
  const why = ready ? reasons(loaded) : { split: [], notes: [] };
  const mustSplit = why.split.length > 0;
  const multiples = ready && (mustSplit || layoutAsked === "multiples");
  const hasStages = loaded.some((f) => f.observations.some((o) => o.vintage === "be" || o.vintage === "re"));
  const sameFreq = ready && new Set(loaded.map((f) => f.series.frequency)).size === 1;
  const periods = [...new Set(loaded.flatMap((f) => f.observations.map((o) => o.period)))].sort();
  const freq0 = loaded[0]?.series.frequency ?? "fiscal_year";
  const domain: [number, number] | null =
    sameFreq && periods.length ? [Math.min(...periods.map((p, i) => periodOrdinal(p, freq0) ?? i)), Math.max(...periods.map((p, i) => periodOrdinal(p, freq0) ?? i))] : null;

  const downloadCsv = async () => {
    setCsvBusy(true);
    try {
      const texts = await Promise.all(loaded.map((f) => fetch(`${dataBase}/series/${slug(f.series.series_id)}.csv`).then((r) => r.text())));
      const [head, ...rest] = texts;
      const body = [head.trimEnd(), ...rest.map((t) => t.trimEnd().split("\n").slice(1).join("\n"))].filter(Boolean).join("\n") + "\n";
      const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `compare-${loaded.length}-series.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCsvBusy(false);
    }
  };

  return (
    <div className="compare">
      <div className="cmp-pick">
        <ol className="cmp-chips">
          {ids.map((id) => {
            const f = files[id];
            return (
              <li key={id}>
                <LineKey line={{ style: styleOf(id), label: "" }} />
                {f && f !== "error" ? <a href={`/series/${slug(id)}`}>{f.series.name}</a> : <span>{f === "error" ? `${id} (not in this release)` : id}</span>}
                <button type="button" className="btn btn-tiny" onClick={() => setIds(ids.filter((x) => x !== id))}>
                  Remove<span className="sr-only"> {f && f !== "error" ? f.series.name : id}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {ids.length < MAX ? (
          <div className="cmp-add">
            <label htmlFor="cmp-q" className="sr-only">
              {ids.length ? "Add a series" : "Choose a series"}
            </label>
            <input
              ref={input}
              id="cmp-q"
              className="input"
              type="search"
              value={text}
              autoComplete="off"
              placeholder={ids.length ? "Add a series…" : "Choose a series…"}
              onFocus={loadIndex}
              onChange={(e) => {
                loadIndex();
                setText(e.target.value);
              }}
            />
            {results.length > 0 ? (
              <ul className="cmp-results">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setIds([...ids, r.id]);
                        setText("");
                        input.current?.focus();
                      }}
                    >
                      <span className="r-title">{r.n}</span>
                      <span className="r-meta">
                        {r.d} · {r.u}
                        {r.c ? ` · ${r.p}` : " · no checked values"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <span className="cmp-n" data-num="ui">
          {ids.length} of {MAX}
        </span>
      </div>

      {ready ? (
        <div className="cmp-controls">
          <span className="ctl">
            <span className="label">Layout</span>
            <span className="seg">
              <button type="button" aria-pressed={!multiples} disabled={mustSplit} onClick={() => setQuery({ layout: null }, "replace")}>
                One chart
              </button>
              <button type="button" aria-pressed={multiples} onClick={() => setQuery({ layout: "multiples" }, "replace")}>
                Small multiples
              </button>
            </span>
          </span>
          {hasStages ? (
            <span className="ctl">
              <span className="label">Kind of figure</span>
              <span className="seg">
                <button type="button" aria-pressed={askedVintage !== "re"} onClick={() => setQuery({ v: null }, "replace")}>
                  Budget estimate
                </button>
                <button type="button" aria-pressed={askedVintage === "re"} onClick={() => setQuery({ v: "re" }, "replace")}>
                  Revised estimate
                </button>
              </span>
            </span>
          ) : null}
          <span className="cmp-take">
            <button type="button" className="btn btn-primary" onClick={downloadCsv} disabled={csvBusy}>
              {csvBusy ? "Preparing…" : "Combined CSV, with source and page columns"}
            </button>
            <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
              Copy link
            </button>
          </span>
        </div>
      ) : null}

      {failed.length ? <p className="small">Not in this release: {failed.join(", ")}.</p> : null}
      {ids.length === 0 ? <p className="measure">Choose up to six series to chart them together, with every figure linked to its receipt.</p> : null}
      {ids.length > 0 && !ready && failed.length === 0 ? <p className="small muted">Loading the series files…</p> : null}

      {ready && (why.split.length || why.notes.length) ? (
        <div className="callout callout--caveat cmp-why">
          <p className="callout-title">Read with care</p>
          <ul>
            {why.split.length ? <li>Each series has its own chart and value axis because {why.split.join("; ")}. Read across them by period, not by height.</li> : null}
            {why.notes.map((n) => (
              <li key={n.name + n.period}>
                {n.name} has a series break from <span data-num="period">{n.period}</span> ({n.kind}); its line stops there.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ready && !multiples ? (
        <>
          <Chart model={merged(loaded, askedVintage, styleOf)} idBase="cmp" />
          <ul className="line-key" aria-label="Lines">
            {loaded.map((f) => {
              const v = vintageFor(f, askedVintage);
              return (
                <li key={f.series.series_id}>
                  <LineKey line={{ style: styleOf(f.series.series_id), label: "" }} /> {f.series.name}
                  {v !== "na" ? `, ${vintageWords(v).toLowerCase()}` : ""}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {ready && multiples ? (
        <div className="cmp-multiples">
          {loaded.map((f, i) => {
            const v = vintageFor(f, askedVintage);
            const m = chartModelFrom(f.series, f.observations.filter((o) => o.vintage === v));
            const model = { ...m, lines: m.lines.map((l) => ({ ...l, style: styleOf(f.series.series_id), label: f.series.name })) };
            return (
              <section key={f.series.series_id} className="cmp-small">
                <h3>
                  <LineKey line={{ style: styleOf(f.series.series_id), label: "" }} /> {f.series.name}
                  <span className="muted">
                    {" "}
                    · {unitLabel(f.series.unit, f.series.scale_factor)}
                    {v !== "na" ? `, ${vintageWords(v).toLowerCase()}` : ""}
                  </span>
                </h3>
                <Chart model={model} idBase={`cmp-${i}`} options={{ xDomain: domain, height: 220 }} />
              </section>
            );
          })}
        </div>
      ) : null}

      {ready && loaded.length > 0 ? (
        <section className="cmp-table">
          <h2>Every figure, aligned by period</h2>
          <div className="table-wrap dt-sticky" role="region" aria-label="Figures of the compared series" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  {loaded.map((f) => {
                    const v = vintageFor(f, askedVintage);
                    return (
                      <th key={f.series.series_id} scope="col" className="num">
                        {f.series.name}
                        <span className="cell-sub">
                          {unitLabel(f.series.unit, f.series.scale_factor)}
                          {v !== "na" ? `, ${vintageWords(v).toLowerCase()}` : ""}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p}>
                    <th scope="row">
                      <span data-num="period">{periodWords(p, loaded.find((f) => f.observations.some((o) => o.period === p))?.series.frequency ?? freq0)}</span>
                    </th>
                    {loaded.map((f) => {
                      const v = vintageFor(f, askedVintage);
                      const o = f.observations.find((x) => x.period === p && x.vintage === v);
                      if (!o)
                        return (
                          <td key={f.series.series_id} className="num muted">
                            <span aria-label="no figure for this period">·</span>
                          </td>
                        );
                      const info = statusOf(o);
                      const fill = info.key === "checked" ? "" : `cell-${info.key}`;
                      return (
                        <td key={f.series.series_id} className={`num ${fill}`}>
                          {info.key === "checked" ? (
                            <a href={`/o/${slug(o.obs_id)}`} className="v-link" data-v="">
                              {formatDecimalString(o.value)}
                            </a>
                          ) : (
                            <a href={`/o/${slug(o.obs_id)}`} className="gap-link">
                              {info.label}
                            </a>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            The combined CSV holds every figure of the chosen series, one row each, with <code>obs_id</code>, period, kind of figure, the value (checked
            figures only), status, the document and its official address, the SHA-256 fingerprint, the page and the printed text.
          </p>
        </section>
      ) : null}
    </div>
  );
}
