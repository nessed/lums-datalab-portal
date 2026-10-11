"use client";
// Chart controls whose state lives in the URL (?view=share&scale=log&from=2015-16&to=2024-25),
// so a link reproduces exactly what was on screen and the back button works.
// The page is static: the server renders the default view; the browser applies
// the URL after it loads. Nothing is fetched.
import Chart from "@/components/Chart";
import type { ChartModel } from "@/lib/chart-model";
import { setQuery, useQuery } from "@/lib/url-state";

type State = { view: "amount" | "share"; log: boolean; from: string | null; to: string | null };

export default function SeriesChart({ amount, share, shareLabel, amountLabel }: { amount: ChartModel; share?: ChartModel | null; shareLabel?: string; amountLabel: string }) {
  const q = useQuery();
  const s: State = { view: q.get("view") === "share" && share ? "share" : "amount", log: q.get("scale") === "log", from: q.get("from"), to: q.get("to") };
  const highlight = q.get("hl");
  const update = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setQuery({ view: next.view === "share" ? "share" : null, scale: next.log ? "log" : null, from: next.from, to: next.to });
  };
  const model = s.view === "share" && share ? share : amount;
  const periods = model.periods.map((p) => p.p);
  const canLog = model.lines.every((l) => l.points.every((p) => p.y > 0)) && model.lines.length > 0;
  const fromIdx = s.from ? Math.max(0, periods.indexOf(s.from)) : 0;
  const toIdx = s.to ? periods.indexOf(s.to) : periods.length - 1;

  return (
    <div className="series-chart">
      <div className="chart-controls" role="group" aria-label="Chart options">
        {share ? (
          <span className="ctl">
            <span className="label">Show</span>
            <span className="seg">
              <button type="button" aria-pressed={s.view === "amount"} onClick={() => update({ view: "amount" })}>
                {amountLabel}
              </button>
              <button type="button" aria-pressed={s.view === "share"} onClick={() => update({ view: "share", log: false })}>
                {shareLabel ?? "Share of total"}
              </button>
            </span>
          </span>
        ) : null}
        <span className="ctl">
          <span className="label">Scale</span>
          <span className="seg">
            <button type="button" aria-pressed={!s.log} onClick={() => update({ log: false })}>
              Linear
            </button>
            <button type="button" aria-pressed={s.log} disabled={!canLog} title={canLog ? "Equal distances show equal percentage changes" : "Not available: the series has values at or below zero"} onClick={() => update({ log: true })}>
              Log
            </button>
          </span>
        </span>
        {periods.length > 2 ? (
          <span className="ctl">
            <label className="label" htmlFor="rng-from">
              From
            </label>
            <select id="rng-from" className="input" data-num="period" value={periods[fromIdx]} onChange={(e) => update({ from: e.target.value === periods[0] ? null : e.target.value })}>
              {periods.map((p, i) => (
                <option key={p} value={p} disabled={i > toIdx}>
                  {model.periods[i].label}
                </option>
              ))}
            </select>
            <label className="label" htmlFor="rng-to">
              to
            </label>
            <select id="rng-to" className="input" data-num="period" value={periods[toIdx] ?? periods[periods.length - 1]} onChange={(e) => update({ to: e.target.value === periods[periods.length - 1] ? null : e.target.value })}>
              {periods.map((p, i) => (
                <option key={p} value={p} disabled={i < fromIdx}>
                  {model.periods[i].label}
                </option>
              ))}
            </select>
            {s.from || s.to ? (
              <button type="button" className="btn btn-text" onClick={() => update({ from: null, to: null })}>
                All periods
              </button>
            ) : null}
          </span>
        ) : null}
        <button type="button" className="btn btn-text ctl-copy" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
          Copy link to this view
        </button>
      </div>
      <Chart model={model} options={{ log: s.log, from: s.from, to: s.to, highlight, noKey: true }} idBase={`chart-${s.view}`} />
    </div>
  );
}
