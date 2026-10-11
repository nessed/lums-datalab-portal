// Chart model types and pure helpers. No server imports: the client chart
// uses this module, so it must never pull in the data layer (node:fs).
import { formatDecimalString, periodShort, periodWords, unitLabel, vintageWords } from "./format";
import { statusOf, type StatusKey } from "./status";

export type ChartPoint = { x: number; y: number; period: string; periodLabel: string; valueText: string; href: string };

export type LineStyle = { color: string; dash: string | null; marker: "circle" | "square" | "diamond" };

export type ChartLine = { key: string; label: string; style: LineStyle; points: ChartPoint[] };

/** A period with no published value: drawn under the axis, never as a point. */
export type ChartMark = { x: number; period: string; periodLabel: string; vintage: string; vintageLabel: string; status: StatusKey; statusLabel: string; href: string };

export type ChartBreak = { x: number; label: string; note: string; atPeriod: string; atLabel: string; inView: boolean };

export type ChartModel = {
  title: string;
  unit: string; // in words, e.g. "Rs million"
  unitCode: string;
  scale: number;
  frequency: string;
  zeroBased: boolean;
  step: number;
  periods: { p: string; x: number; label: string }[];
  lines: ChartLine[];
  marks: ChartMark[];
  breaks: ChartBreak[];
};

/** Two neighbouring points are joined only if they are exactly one step apart
 * (no missing period between them) and no break lies between them. */
export function canConnect(a: { x: number }, b: { x: number }, model: Pick<ChartModel, "step" | "breaks">): boolean {
  if (Math.abs(b.x - a.x - model.step) > 1e-9) return false;
  return !model.breaks.some((br) => br.x > a.x && br.x < b.x);
}

/** Position of a period on the time axis. Fiscal years and survey rounds use
 * the start year; months use year*12+month. Anything else has no position. */
export function periodOrdinal(period: string, frequency: string): number | null {
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (frequency === "month" && month) return Number(month[1]) * 12 + (Number(month[2]) - 1);
  const year = /^(\d{4})/.exec(period);
  if (year) return Number(year[1]);
  return null;
}

// Fixed style per estimate type. Colour, dash and marker all differ, so the
// distinction never rests on colour alone. Unknown types get a neutral style.
export const VINTAGE_STYLE: Record<string, LineStyle> = {
  be: { color: "#0b5c78", dash: null, marker: "circle" },
  na: { color: "#0b5c78", dash: null, marker: "circle" },
  re: { color: "#a2470e", dash: "6 4", marker: "square" },
  actual: { color: "#2f6b4f", dash: "2 3", marker: "diamond" },
  provisional: { color: "#5d5146", dash: "2 3", marker: "diamond" },
};
const OTHER_STYLE: LineStyle = { color: "#4b5563", dash: "2 3", marker: "diamond" };

/** Minimal shapes, so this runs in the browser too (compare page). */
export type ChartSeries = { series_id: string; name: string; frequency: string; unit: string; scale_factor: number | null; breaks: { at_period: string; kind: string; note: string }[] };
export type ChartObs = { obs_id: string; period: string; vintage: string; value: string | null; published: boolean; status?: string | null; gap_kind?: string | null };

// Must match slugify() in data.ts.
const obsHref = (id: string) => `/o/${id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_")}`;

/** The chart model of one series from its observations. Pure: no data access. */
export function chartModelFrom(series: ChartSeries, all: ChartObs[]): ChartModel {
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
  // The normal distance between neighbouring periods (1 year, 1 month...).
  let step = Infinity;
  for (let i = 1; i < periods.length; i++) step = Math.min(step, ord.get(periods[i])! - ord.get(periods[i - 1])!);
  if (!Number.isFinite(step) || step <= 0) step = 1;

  const xs = [...ord.values()];
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const breaks: ChartBreak[] = [];
  for (const b of series.breaks) {
    let at = computable ? periodOrdinal(b.at_period, series.frequency) : null;
    if (at === null) {
      const next = periods.find((p) => p >= b.at_period);
      at = next !== undefined ? ord.get(next)! : null;
    }
    if (at === null) continue;
    const x = at - step / 2;
    breaks.push({
      x,
      label: b.kind.replaceAll("_", " "),
      note: b.note,
      atPeriod: b.at_period,
      atLabel: periodWords(b.at_period, series.frequency),
      // Draw the rule only where the series has periods on both sides of it.
      inView: x > lo && x < hi,
    });
  }

  const published = all.filter((o) => o.published && o.value !== null && Number.isFinite(Number(o.value)));
  const vintages = [...new Set(published.map((o) => o.vintage))].sort((a, b) => (a === "be" ? -1 : b === "be" ? 1 : a.localeCompare(b)));
  const single = vintages.length === 1;
  const lines: ChartLine[] = vintages.map((v) => ({
    key: v,
    label: single && v === "na" ? series.name : vintageWords(v),
    style: VINTAGE_STYLE[v] ?? OTHER_STYLE,
    points: published
      .filter((o) => o.vintage === v && ord.has(o.period))
      .map((o) => ({
        x: ord.get(o.period)!,
        y: Number(o.value),
        period: o.period,
        periodLabel: periodWords(o.period, series.frequency),
        valueText: formatDecimalString(o.value),
        href: obsHref(o.obs_id),
      }))
      .sort((a, b) => a.x - b.x),
  }));

  const marks: ChartMark[] = all
    .filter((o) => !(o.published && o.value !== null) && ord.has(o.period))
    .map((o) => {
      const info = statusOf(o);
      return {
        x: ord.get(o.period)!,
        period: o.period,
        periodLabel: periodWords(o.period, series.frequency),
        vintage: o.vintage,
        vintageLabel: vintageWords(o.vintage),
        status: info.key,
        statusLabel: info.label,
        href: obsHref(o.obs_id),
      };
    });

  return {
    title: series.name,
    unit: unitLabel(series.unit, series.scale_factor),
    unitCode: series.unit,
    scale: series.scale_factor ?? 1,
    frequency: series.frequency,
    zeroBased: series.unit !== "index",
    step,
    periods: periods.map((p) => ({ p, x: ord.get(p)!, label: series.frequency === "month" ? periodShort(p, "month") : p })),
    lines,
    marks,
    breaks,
  };
}

