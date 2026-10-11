"use client";
// Up to three series on one chart. The choice lives in the URL
// (?s=id,id,id). Each series' release file (public/data/<v>/series/<id>.json,
// written by the prebuild) is fetched once; nothing else is fetched and no
// number is computed. Series in the same unit share one chart; otherwise each
// gets its own chart, and the page says so.
import { useEffect, useRef, useState } from "react";
import Chart from "@/components/Chart";
import { chartModelFrom, periodOrdinal, type ChartModel, type ChartObs, type ChartSeries, type LineStyle } from "@/lib/chart-model";
import { formatDecimalString, periodWords, unitLabel, vintageWords } from "@/lib/format";
import { search, type SearchEntry } from "@/lib/search";
import { statusOf } from "@/lib/status";
import { setQuery, useQuery } from "@/lib/url-state";

type SeriesFile = { series: ChartSeries & { dataset: string; derived?: boolean }; observations: (ChartObs & { unit: string; scale_factor: number })[] };

const STYLES: LineStyle[] = [
  { color: "#0b5c78", dash: null, marker: "circle" },
  { color: "#a2470e", dash: "6 4", marker: "square" },
  { color: "#2f6b4f", dash: "2 3", marker: "diamond" },
];
const MAX = 3;
const slug = (id: string) => id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");

/** The estimate type each series is compared on: budget estimate if it has one, else its most common. */
function mainVintage(f: SeriesFile): string {
  const pub = f.observations.filter((o) => o.published && o.value !== null);
  if (pub.some((o) => o.vintage === "be")) return "be";
  const n = new Map<string, number>();
  for (const o of pub) n.set(o.vintage, (n.get(o.vintage) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "na";
}

/** One chart with one line per series (same unit and frequency). */
function merged(files: SeriesFile[]): ChartModel {
  const models = files.map((f) => {
    const v = mainVintage(f);
    return { f, v, m: chartModelFrom(f.series, f.observations.filter((o) => o.vintage === v)) };
  });
  const freq = files[0].series.frequency;
  const periods = [...new Set(files.flatMap((f) => f.observations.map((o) => o.period)))].sort();
  const ord = new Map(periods.map((p) => [p, periodOrdinal(p, freq) ?? periods.indexOf(p)]));
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
    lines: models.map(({ f, v, m }, i) => ({
      key: f.series.series_id,
      label: `${f.series.name}${v !== "na" ? ` (${vintageWords(v).toLowerCase()})` : ""}`,
      style: STYLES[i],
      points: (m.lines[0]?.points ?? []).map((p) => ({ ...p, x: ord.get(p.period)! })),
    })),
    marks: [],
    breaks: breaks.map((b) => ({ ...b, inView: b.x > Math.min(...xs) && b.x < Math.max(...xs) })),
  };
}

export default function Compare({ dataBase, initial }: { dataBase: string; initial: string[] }) {
  const q = useQuery();
  const sParam = q.get("s");
  const ids = (sParam === null ? initial : sParam === "none" ? [] : sParam.split(",").filter(Boolean)).slice(0, MAX);
  const [files, setFiles] = useState<Record<string, SeriesFile | "error">>({});
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const key = ids.join(",");
  useEffect(() => {
    let live = true;
    for (const id of key.split(",").filter(Boolean)) {
      fetch(`${dataBase}/series/${slug(id)}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j: SeriesFile) => live && setFiles((f) => ({ ...f, [id]: j })))
        .catch(() => live && setFiles((f) => ({ ...f, [id]: "error" })));
    }
    return () => {
      live = false;
    };
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

  const loaded = ids.map((id) => files[id]).filter((f): f is SeriesFile => !!f && f !== "error");
  const failed = ids.filter((id) => files[id] === "error");
  const ready = loaded.length === ids.length && ids.length > 0;
  const sameUnit = ready && loaded.every((f) => f.series.unit === loaded[0].series.unit && f.series.scale_factor === loaded[0].series.scale_factor && f.series.frequency === loaded[0].series.frequency);
  const model = ready && sameUnit && loaded.length > 0 ? merged(loaded) : null;

  const periods = [...new Set(loaded.flatMap((f) => f.observations.map((o) => o.period)))].sort();

  return (
    <div className="compare">
      <div className="compare-pick">
        <ol className="compare-chips">
          {ids.map((id, i) => {
            const f = files[id];
            return (
              <li key={id} style={{ borderLeftColor: STYLES[i].color }}>
                <span>{f && f !== "error" ? f.series.name : f === "error" ? `${id} (not in this release)` : id}</span>
                <button type="button" className="btn btn-text" onClick={() => setIds(ids.filter((x) => x !== id))}>
                  Remove<span className="sr-only"> {id}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {ids.length < MAX ? (
          <div className="field compare-add">
            <label htmlFor="cmp-q">{ids.length ? "Add a series" : "Choose a series"}</label>
            <input
              ref={input}
              id="cmp-q"
              className="input"
              type="search"
              value={text}
              autoComplete="off"
              placeholder="Type a series name…"
              onFocus={loadIndex}
              onChange={(e) => {
                loadIndex();
                setText(e.target.value);
              }}
            />
            {results.length > 0 ? (
              <ul className="compare-results">
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
        ) : (
          <p className="small muted">Three series at most. Remove one to add another.</p>
        )}
      </div>

      {failed.length ? <p className="small">Not in this release: {failed.join(", ")}.</p> : null}
      {ids.length === 0 ? <p className="measure">Choose up to three series to see them on one chart, with every figure linked to its receipt.</p> : null}
      {ids.length > 0 && !ready && failed.length === 0 ? <p className="small muted">Loading the series files…</p> : null}

      {ready && model ? (
        <>
          <p className="small measure">
            All in {unitLabel(loaded[0].series.unit, loaded[0].series.scale_factor)}, on one axis.
            {loaded.some((f) => f.observations.some((o) => o.vintage === "re")) ? " Each series is shown with its budget estimates; revised estimates are on each series page." : ""}
          </p>
          <Chart model={model} idBase="cmp" />
        </>
      ) : null}
      {ready && !sameUnit ? (
        <>
          <p className="callout callout--note">These series are in different units or at different frequencies, so each has its own chart and value axis. Read across them by period, not by height.</p>
          {loaded.map((f, i) => {
            const v = mainVintage(f);
            return (
              <section key={f.series.series_id}>
                <h3 style={{ borderLeft: `3px solid ${STYLES[i].color}`, paddingLeft: 8 }}>{f.series.name}</h3>
                <Chart model={chartModelFrom(f.series, f.observations.filter((o) => o.vintage === v))} idBase={`cmp-${i}`} />
              </section>
            );
          })}
        </>
      ) : null}

      {ready && loaded.length > 0 ? (
        <>
          <h2>Every figure</h2>
          <div className="table-wrap dt-sticky" role="region" aria-label="Figures of the compared series" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  {loaded.map((f) => (
                    <th key={f.series.series_id} scope="col" className="num">
                      {f.series.name}
                      <span className="cell-sub">
                        {unitLabel(f.series.unit, f.series.scale_factor)}
                        {mainVintage(f) !== "na" ? `, ${vintageWords(mainVintage(f)).toLowerCase()}` : ""}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p}>
                    <th scope="row">{periodWords(p, loaded[0].series.frequency)}</th>
                    {loaded.map((f) => {
                      const o = f.observations.find((x) => x.period === p && x.vintage === mainVintage(f));
                      if (!o) return <td key={f.series.series_id} className="num muted">·</td>;
                      const info = statusOf(o);
                      return (
                        <td key={f.series.series_id} className={`num ${info.key === "checked" ? "" : `cell-${info.key === "gap-source" ? "gap-source" : info.key === "gap-pending" ? "gap-pending" : info.key === "withheld" ? "withheld" : info.key === "disputed" ? "disputed" : "none"}`}`}>
                          <a href={`/o/${slug(o.obs_id)}`} className={info.key === "checked" ? "v-link" : "gap-link"}>
                            {info.key === "checked" ? formatDecimalString(o.value) : info.label}
                          </a>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small">
            Downloads:{" "}
            {loaded.map((f, i) => (
              <span key={f.series.series_id}>
                {i ? " · " : ""}
                <a href={`${dataBase}/series/${slug(f.series.series_id)}.csv`} download>
                  {f.series.name} (CSV)
                </a>
              </span>
            ))}
          </p>
        </>
      ) : null}
    </div>
  );
}
