// Turns a series' published observations into a chart model. Number() is used
// here only for geometry; every label shown comes from the original string.
import { db, obsHref, publishedObs, type Series } from "./data";
import { formatDecimalString, unitLabel, vintageWords } from "./format";

export type ChartPoint = {
  x: number;
  y: number;
  period: string;
  valueText: string;
  href: string;
};

export type ChartLine = {
  key: string;
  label: string;
  color: string;
  dashed: boolean;
  marker: "circle" | "square" | "diamond";
  points: ChartPoint[];
};

export type ChartBreak = { x: number; label: string; note: string; atPeriod: string };

export type ChartModel = {
  title: string;
  unit: string;
  zeroBased: boolean;
  step: number;
  ticks: { x: number; label: string }[];
  lines: ChartLine[];
  breaks: ChartBreak[];
};

/** Position of a period on the time axis. Fiscal years and plain years use the
 * start year, months use year*12+month. Anything else has no computable position. */
export function periodOrdinal(period: string, frequency: string): number | null {
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (frequency === "month" && month) return Number(month[1]) * 12 + (Number(month[2]) - 1);
  const year = /^(\d{4})/.exec(period);
  if (year) return Number(year[1]);
  return null;
}

// Fixed colour per estimate type, validated for colour-vision separation.
// Dash pattern and marker shape repeat the distinction so it is never colour alone.
const VINTAGE_STYLE: Record<string, Pick<ChartLine, "color" | "dashed" | "marker">> = {
  be: { color: "#1f5fa8", dashed: false, marker: "circle" },
  re: { color: "#c2570c", dashed: true, marker: "square" },
  na: { color: "#1f5fa8", dashed: false, marker: "circle" },
};
const OTHER_STYLE: Pick<ChartLine, "color" | "dashed" | "marker"> = { color: "#4b5563", dashed: true, marker: "diamond" };

export function buildChart(series: Series): ChartModel {
  const all = db().obsBySeries.get(series.series_id) ?? [];
  const periods = [...new Set(all.map((o) => o.period))].sort();
  const ord = new Map<string, number>();
  let computable = true;
  for (const p of periods) {
    const v = periodOrdinal(p, series.frequency);
    if (v === null) computable = false;
    else ord.set(p, v);
  }
  if (!computable || new Set(ord.values()).size !== periods.length) {
    ord.clear();
    periods.forEach((p, i) => ord.set(p, i));
    computable = false;
  }
  // The normal distance between neighbouring periods in this series (1 year,
  // 1 month, or 12 months if only one month a year is recorded).
  let step = Infinity;
  for (let i = 1; i < periods.length; i++) step = Math.min(step, ord.get(periods[i])! - ord.get(periods[i - 1])!);
  if (!Number.isFinite(step) || step <= 0) step = 1;

  const breaks: ChartBreak[] = [];
  for (const b of series.breaks) {
    let at = computable ? periodOrdinal(b.at_period, series.frequency) : null;
    if (at === null) {
      // Fall back to the first known period at or after the break.
      const next = periods.find((p) => p >= b.at_period);
      at = next !== undefined ? ord.get(next)! : null;
    }
    if (at === null) continue;
    breaks.push({ x: at - step / 2, label: `Break: ${b.kind.replaceAll("_", " ")}`, note: b.note, atPeriod: b.at_period });
  }

  const pub = publishedObs(series.series_id);
  const vintages = [...new Set(pub.map((o) => o.vintage))].sort();
  const single = vintages.length === 1;
  const lines: ChartLine[] = vintages.map((v) => ({
    key: v,
    label: single && v === "na" ? series.name : vintageWords(v),
    ...(VINTAGE_STYLE[v] ?? OTHER_STYLE),
    points: pub
      .filter((o) => o.vintage === v)
      .map((o) => ({
        x: ord.get(o.period)!,
        y: Number(o.value),
        period: o.period,
        valueText: formatDecimalString(o.value),
        href: obsHref(o.obs_id),
      }))
      .filter((p) => Number.isFinite(p.y) && p.x !== undefined)
      .sort((a, b) => a.x - b.x),
  }));

  return {
    title: series.name,
    unit: unitLabel(series.unit, series.scale_factor),
    zeroBased: series.unit !== "index",
    step,
    ticks: periods.map((p) => ({ x: ord.get(p)!, label: p })),
    lines,
    breaks,
  };
}

/** Two neighbouring points may be joined only if they are exactly one step
 * apart (no missing period between them) and no break lies between them. */
export function canConnect(a: ChartPoint, b: ChartPoint, model: Pick<ChartModel, "step" | "breaks">): boolean {
  if (Math.abs(b.x - a.x - model.step) > 1e-9) return false;
  return !model.breaks.some((br) => br.x > a.x && br.x < b.x);
}
