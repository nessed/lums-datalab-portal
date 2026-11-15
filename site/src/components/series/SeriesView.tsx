"use client";
// The chart block of a series page (DESIGN.md 8.2, 9.5 item 3, 11): the view
// switch for budget series, Units, range chips, the subtitle that states the
// treatment, the chart, its legend, and the source lines inside its frame.
//
// The server renders the default view ("best available figure per year" for a
// budget series, otherwise as printed, all periods) and it works without
// JavaScript. The controls appear only when JavaScript runs; their state lives
// in the URL (?view=&units=&base=&range=&present=), so a link reproduces the
// view and Back works. Derived views are never computed here: they are read
// from /series/<id>/views.json, written at build time and checked by
// scripts/checks/series-derived.mjs.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Chart, { LineKey } from "@/components/Chart";
import { derivedModelFrom, derivedText, derivedUnit, type ChartModel, type ChartSeries, type DerivedViewJson } from "@/lib/chart-model";
import { setQuery, useQuery } from "@/lib/url-state";
import { formatDecimalString as fd } from "@/lib/format";
import { STATUS, type StatusKey } from "@/lib/status";
import { StatusMark } from "@/components/ui/Status";
import type { UnitOption } from "./model";

type ViewKey = "best" | "kind" | "rev";
type UnitKey = UnitOption["id"];

export type SeriesViewProps = {
  slug: string;
  series: ChartSeries;
  printed: { best: ChartModel | null; kind: ChartModel };
  units: UnitOption[];
  coming: string[];
  kindWords: Record<string, string>;
  unitWords: string;
  parentName: string | null;
  breakFrom: { at: string; label: string } | null;
  /** Source lines inside the chart frame, rendered on the server. */
  frame: ReactNode;
};

const PERIOD_UNIT = (f: string) => (f === "month" ? 12 : 1);

function treatment(units: UnitKey, view: ViewKey, p: SeriesViewProps, base: string | null): ReactNode {
  const u = p.series.unit;
  const round = p.series.frequency === "survey_round";
  const since = round ? "the previous round" : "a year earlier";
  if (view === "rev") return "Change from budget estimate to revised estimate for the same year, per cent of the budget estimate, derived";
  if (units === "pct") return `% change from ${since}, same kind of figure, per cent, derived`;
  if (units === "chg") return `Change from ${since}, same kind of figure, ${u === "percent" ? "percentage points" : p.unitWords}, derived`;
  if (units === "idx")
    return (
      <>
        Index, <span data-num="period">{base}</span> = <span data-num="ui">100</span>, each kind of figure against its own figure for that period, derived
      </>
    );
  if (units === "share") return `Share of ${p.parentName ?? "the parent total"}, same year and kind of figure, per cent, derived`;
  const head = u === "PKR" ? `Nominal rupees, ${p.unitWords}, as printed` : u === "percent" ? "Per cent, as printed" : u === "index" ? "Index points, as printed" : `${p.unitWords[0].toUpperCase()}${p.unitWords.slice(1)}, as printed`;
  if (p.printed.best && view === "best") return `${head}; the best available figure per year, each point marked with its kind`;
  if (p.printed.best) return `${head}; one line per kind of figure`;
  return head;
}

export default function SeriesView(p: SeriesViewProps) {
  const q = useQuery();
  const budget = !!p.printed.best;
  const view: ViewKey = budget && (q.get("view") === "kind" || q.get("view") === "rev") ? (q.get("view") as ViewKey) : budget ? "best" : "kind";
  const unitsAsked = q.get("units") as UnitKey | null;
  const units: UnitKey = view !== "rev" && unitsAsked && p.units.some((u) => u.id === unitsAsked && u.available) ? unitsAsked : "printed";
  const range = q.get("range") ?? "all";
  const present = q.get("present") === "1";
  const highlight = q.get("hl");
  const [data, setData] = useState<DerivedViewJson[] | null>(null);
  const [failed, setFailed] = useState(false);
  const needData = units !== "printed" || view === "rev";

  useEffect(() => {
    if (!needData || data || failed) return;
    let live = true;
    fetch(`/series/${p.slug}/views.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { views: DerivedViewJson[] }) => live && setData(j.views))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [needData, data, failed, p.slug]);

  useEffect(() => {
    document.documentElement.classList.toggle("present", present);
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQuery({ present: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present]);

  const bases = useMemo(() => [...new Set((data ?? []).filter((v) => v.op === "idx").map((v) => v.base!))], [data]);
  // Default base: the first period at or after the latest break, so the default index view is not empty (tester finding).
  const lastBreak = [...p.series.breaks.map((b) => b.at_period)].sort().at(-1);
  const defaultBase = (lastBreak ? bases.find((b) => b >= lastBreak) : undefined) ?? bases[0] ?? null;
  const base = units === "idx" ? (q.get("base") && bases.includes(q.get("base")!) ? q.get("base")! : defaultBase) : null;

  const derived: DerivedViewJson | null = !needData || !data ? null : view === "rev" ? (data.find((v) => v.op === "rev") ?? null) : units === "idx" ? (data.find((v) => v.id === `idx:${base}`) ?? null) : (data.find((v) => v.op === units) ?? null);
  const model: ChartModel | null = derived ? derivedModelFrom(p.series, p.printed.kind, derived, p.kindWords) : needData ? null : view === "best" && p.printed.best ? p.printed.best : p.printed.kind;

  // Range chips: last 5 and 10 years, everything, and from the break onward.
  const periods = p.printed.kind.periods;
  const maxX = periods.length ? periods[periods.length - 1].x : 0;
  const span = periods.length ? maxX - periods[0].x : 0;
  const yu = PERIOD_UNIT(p.series.frequency);
  const fromYears = (n: number) => periods.find((x) => x.x >= maxX - (n - 1) * yu)?.p ?? null;
  const ranges = [
    ...(span >= 5 * yu ? [{ id: "5y", label: "5Y", aria: "Last 5 years", from: fromYears(5) }] : []),
    ...(span >= 10 * yu ? [{ id: "10y", label: "10Y", aria: "Last 10 years", from: fromYears(10) }] : []),
    { id: "all", label: "All", aria: "All periods", from: null as string | null },
    ...(p.breakFrom && periods.filter((x) => x.p >= p.breakFrom!.at).length >= 2 ? [{ id: "break", label: `From ${p.breakFrom.label}`, aria: `From the break onward, ${p.breakFrom.label}`, from: p.breakFrom.at }] : []),
  ];
  const r = ranges.find((x) => x.id === range) ?? ranges.find((x) => x.id === "all")!;
  const height = present && typeof window !== "undefined" ? Math.max(200, Math.min(760, window.innerHeight - 420)) : undefined;

  const statuses = model ? ([...new Set(model.marks.map((m) => m.status))] as StatusKey[]) : [];
  const kindYears = useMemo(() => {
    if (view !== "best" || units !== "printed" || !p.printed.best) return [];
    const by = new Map<string, { style: NonNullable<ChartModel["lines"][number]["points"][number]["style"]>; periods: string[] }>();
    for (const pt of p.printed.best.lines[0]?.points ?? []) {
      const k = pt.kindLabel ?? "";
      const e = by.get(k) ?? { style: pt.style!, periods: [] };
      e.periods.push(pt.periodLabel);
      by.set(k, e);
    }
    return [...by.entries()];
  }, [view, units, p.printed.best]);

  return (
    <div className="sv">
      {p.printed.kind.lines.length === 0 ? null : (
      <div className="sv-controls" role="group" aria-label="Chart options">
        {budget ? (
          <div className="sv-row">
            <span className="sv-label" id="sv-show">
              Show
            </span>
            <span className="seg sv-seg" role="group" aria-labelledby="sv-show">
              <button type="button" aria-pressed={view === "best"} onClick={() => setQuery({ view: null })}>
                <span className="w-wide">Best figure per year</span>
                <span className="w-narrow">
                  Best per year
                </span>
              </button>
              <button type="button" aria-pressed={view === "kind"} onClick={() => setQuery({ view: "kind" })}>
                <span className="w-wide">By kind of figure</span>
                <span className="w-narrow">
                  By kind
                </span>
              </button>
              <button type="button" aria-pressed={view === "rev"} onClick={() => setQuery({ view: "rev", units: null, base: null })}>
                <span className="w-wide">Change from budget to revised</span>
                <span className="w-narrow">
                  BE to RE
                </span>
              </button>
            </span>
          </div>
        ) : null}
        <div className="sv-row">
          <label className="sv-label" htmlFor="sv-units">
            Units
          </label>
          <select id="sv-units" className="input sv-select" value={units} disabled={view === "rev"} onChange={(e) => setQuery({ units: e.target.value === "printed" ? null : e.target.value, base: null })}>
            {p.units.map((u) => (
              <option key={u.id} value={u.id} disabled={!u.available} data-num="ui">
                {u.available ? u.label : `${u.label} (${u.why})`}
              </option>
            ))}
            {p.coming.map((c) => (
              <option key={c} value={`coming-${c}`} disabled>
                {`${c} (Coming: not in this release)`}
              </option>
            ))}
          </select>
          {units === "idx" && bases.length ? (
            <>
              <label className="sv-label" htmlFor="sv-base">
                Base period
              </label>
              <select id="sv-base" className="input sv-select" value={base ?? ""} onChange={(e) => setQuery({ base: e.target.value })}>
                {bases.map((b) => (
                  <option key={b} value={b} data-num="period">
                    {p.printed.kind.periods.find((x) => x.p === b)?.label ?? b}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <button type="button" className="btn sv-present" aria-pressed={present} onClick={() => setQuery({ present: present ? null : "1" })}>
            {present ? "Exit present mode" : "Present"}
          </button>
        </div>
        <div className="sv-row">
          <span className="sv-label" id="sv-range">
            Range
          </span>
          <span className="seg sv-seg" role="group" aria-labelledby="sv-range">
            {ranges.map((x) => (
              <button key={x.id} type="button" aria-pressed={r.id === x.id} aria-label={x.aria} onClick={() => setQuery({ range: x.id === "all" ? null : x.id })}>
                {x.id === "break" ? (
                  <>
                    From <span data-num="period">{p.breakFrom!.label}</span>
                  </>
                ) : (
                  <span data-num="ui">{x.label}</span>
                )}
              </button>
            ))}
          </span>
        </div>
        {view !== "rev" && units !== "printed" && budget ? <p className="sv-note">A derived view compares like with like, so it is drawn by kind of figure.</p> : null}
      </div>
      )}

      <figure className="sv-frame">
        <figcaption className="sv-sub">{treatment(units, view, p, base)}</figcaption>
        {model ? (
          <Chart model={model} options={{ from: r.from, to: null, highlight, noKey: true, height }} idBase={`chart-${view}-${units}`} />
        ) : (
          <div className="chart-empty">
            <p>{failed ? "This view could not be loaded. The figures as printed are in the table below." : "Loading this view…"}</p>
          </div>
        )}
        <div className="sv-legend">
          {model && view === "best" && units === "printed" && kindYears.length ? (
            <ul className="sv-kinds" aria-label="Kind of figure per year">
              {kindYears.map(([k, e]) => (
                <li key={k}>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <LegendMarker style={e.style} />
                  </svg>{" "}
                  <strong>{k}:</strong>{" "}
                  {e.periods.map((x, i) => (
                    <span key={x}>
                      {i ? ", " : ""}
                      <span data-num="period">{x}</span>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          ) : null}
          {model && (view !== "best" || units !== "printed") && model.lines.length > 1 ? (
            <ul className="line-key" aria-label="Lines">
              {model.lines.map((l) => (
                <li key={l.key}>
                  <LineKey line={l} /> {l.label}
                </li>
              ))}
            </ul>
          ) : null}
          {statuses.length ? (
            <p className="sv-gapkey">
              Under the axis, periods with no value:{" "}
              {statuses.map((k) => (
                <span key={k} className={`st st--${k}`}>
                  <StatusMark k={k} /> <span className="st-label">{k === "unknown" ? "no value" : STATUS[k as Exclude<StatusKey, "unknown">].label.toLowerCase()}</span>
                </span>
              ))}
            </p>
          ) : null}
        </div>
        {p.frame}
      </figure>

      {derived && model ? <DerivedTable view={derived} p={p} /> : null}
    </div>
  );
}

function LegendMarker({ style }: { style: { color: string; marker: string; hollow?: boolean } }) {
  const c = style.hollow ? { fill: "#fff", stroke: style.color, strokeWidth: 2 } : { fill: style.color };
  if (style.marker === "square") return <rect x="3" y="3" width="8" height="8" {...c} />;
  if (style.marker === "diamond") return <rect x="3" y="3" width="8" height="8" transform="rotate(45 7 7)" {...c} />;
  return <circle cx="7" cy="7" r="4.5" {...c} />;
}

const GAP_SHORT: Record<string, string> = { none: "nothing to compare with", break: "across a break", zero: "zero base" };

/** The derived view as a table: the chart's text alternative for a derived view, with each value's inputs. */
function DerivedTable({ view, p }: { view: DerivedViewJson; p: SeriesViewProps }) {
  const kinds = [...new Set(view.points.map((x) => x.k))];
  const periods = [...new Set(view.points.map((x) => x.p))].sort().reverse();
  const unit = derivedUnit(view.op, p.series, view.base);
  const label = (per: string) => p.printed.kind.periods.find((x) => x.p === per)?.label ?? per;
  return (
    <details className="sv-dtable" open>
      <summary>Figures in this view ({unit}), with their inputs</summary>
      <div className="table-wrap kt-wrap" role="region" aria-label="Figures in this view" tabIndex={0}>
        <table className="kt">
          <thead>
            <tr>
              <th scope="col">Period</th>
              {kinds.map((k) => (
                <th key={k} scope="col" className="num">
                  {view.op === "rev" ? "Budget to revised" : (p.kindWords[k] ?? k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((per) => (
              <tr key={per}>
                <th scope="row">
                  <span data-num="period">{label(per)}</span>
                </th>
                {kinds.map((k) => {
                  const pt = view.points.find((x) => x.p === per && x.k === k);
                  if (!pt) return <td key={k} className="num kt-none" />;
                  if (pt.v === null)
                    return (
                      <td key={k} className="num kt-gap" title={pt.why}>
                        {pt.gap === "travel" ? <StatusMark k={(pt.st as StatusKey) ?? "unknown"} /> : null}{" "}
                        <span className="kt-word">{pt.gap === "travel" ? "held with its input" : view.op === "rev" && pt.gap === "none" ? (pt.in[0]?.endsWith(":be") ? "no revised estimate yet" : "no budget estimate") : (GAP_SHORT[pt.gap ?? ""] ?? "no value")}</span>
                      </td>
                    );
                  return (
                    <td key={k} className="num">
                      <span className="kt-v">{derivedText(view.op, pt.v)}</span>
                      {pt.iv ? (
                        <span className="kt-in">
                          {view.op === "rev" ? `${fd(pt.iv[1])} → ${fd(pt.iv[0])}` : `${fd(pt.iv[0])} against ${fd(pt.iv[1])}`}
                        </span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        Derived by the build from checked figures only. A gap in an input stays a gap here, with the same reason; hover or focus a gap for it. Change and %
        change compare the same kind of figure with {p.series.frequency === "survey_round" ? "the previous round" : "a year earlier"}, never across a series break. Percentages and percentage points are rounded to one decimal place; below one, to two places (or to
        the first digit that is not zero); halves away from zero.
      </p>
    </details>
  );
}
