// Chart model types and pure helpers. No server imports: the client chart
// uses this module, so it must never pull in the data layer (node:fs).
import { formatDecimalString, periodShort, periodWords, unitLabel, vintageWords } from "./format";
import { statusOf, type StatusKey } from "./status";
import { seriesTitle } from "./titles";

export type ChartPoint = {
  x: number;
  y: number;
  period: string;
  periodLabel: string;
  valueText: string;
  href: string;
  /** This point's own marker (best-available view: each point marks its kind of figure). */
  style?: LineStyle;
  /** Kind of figure in words, when the line mixes or names kinds. */
  kindLabel?: string;
  /** Slug for the one-tap evidence sheet (a[data-sheet]); set on receipt links. */
  sheet?: string;
  /** Extra tooltip lines: a derived point's inputs and formula. */
  note?: string[];
};

/** `hollow`: estimates are drawn hollow, actuals solid (DESIGN.md 11). */
export type LineStyle = { color: string; dash: string | null; marker: "circle" | "square" | "diamond"; hollow?: boolean };

export type ChartLine = { key: string; label: string; style: LineStyle; points: ChartPoint[] };

/** A period with no published value: drawn under the axis, never as a point. */
export type ChartMark = { x: number; period: string; periodLabel: string; vintage: string; vintageLabel: string; status: StatusKey; statusLabel: string; href: string; sheet?: string };

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
  /** Draw bars from zero instead of lines (a change, where zero means something). */
  bars?: boolean;
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
// Colours are the chart tokens of src/design/tokens.css (inline SVG resolves them).
export const VINTAGE_STYLE: Record<string, LineStyle> = {
  be: { color: "var(--chart-be)", dash: null, marker: "circle", hollow: true },
  na: { color: "var(--chart-be)", dash: null, marker: "circle" },
  re: { color: "var(--chart-re)", dash: "6 4", marker: "square", hollow: true },
  actual: { color: "var(--chart-actual)", dash: "2 3", marker: "diamond" },
  ac: { color: "var(--chart-actual)", dash: "2 3", marker: "diamond" },
  provisional: { color: "var(--chart-prov)", dash: "2 3", marker: "diamond", hollow: true },
};
const OTHER_STYLE: LineStyle = { color: "var(--chart-other)", dash: "2 3", marker: "diamond" };

/** Minimal shapes, so this runs in the browser too (compare page). */
export type ChartSeries = { series_id: string; name: string; title?: string | null; frequency: string; unit: string; scale_factor: number | null; breaks: { at_period: string; kind: string; note: string }[] };
export type ChartObs = { obs_id: string; period: string; vintage: string; value: string | null; published: boolean; status?: string | null; gap_kind?: string | null };

// Must match slugify() in data.ts.
export const obsSlug = (id: string) => id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");
const obsHref = (id: string) => `/o/${obsSlug(id)}`;

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
    label: single && v === "na" ? seriesTitle(series) : vintageWords(v),
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
        sheet: obsSlug(o.obs_id),
        kindLabel: v === "na" ? undefined : vintageWords(v),
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
        sheet: obsSlug(o.obs_id),
      };
    });

  return {
    title: seriesTitle(series),
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

/* ---------- series page views (DESIGN.md 8.2, 11) ---------- */

const RANK: Record<string, number> = { actual: 5, ac: 5, final: 4, re: 3, provisional: 2, be: 1 };
const NEUTRAL: LineStyle = { color: "var(--chart-neutral)", dash: null, marker: "circle" };

/**
 * "Best available figure per year": per period, the most final kind of figure
 * that shows a value (actual or accounts, else revised, else budget estimate).
 * One line, but every point carries the marker of its own kind, so the line
 * never mixes kinds unmarked. A period whose most final printing is a gap keeps
 * its gap mark under the axis even when an earlier kind is drawn.
 */
export function bestModelFrom(series: ChartSeries, all: ChartObs[]): ChartModel {
  const base = chartModelFrom(series, all);
  const by = new Map<string, ChartObs[]>();
  for (const o of all) by.set(o.period, [...(by.get(o.period) ?? []), o]);
  const ord = new Map(base.periods.map((p) => [p.p, p.x]));
  const points: ChartPoint[] = [];
  const marks: ChartMark[] = [];
  for (const [period, rs] of [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sorted = [...rs].sort((a, b) => (RANK[b.vintage] ?? 0) - (RANK[a.vintage] ?? 0));
    const top = sorted[0];
    const best = sorted.find((o) => o.published && o.value !== null && Number.isFinite(Number(o.value)));
    if (best && ord.has(period))
      points.push({
        x: ord.get(period)!,
        y: Number(best.value),
        period,
        periodLabel: periodWords(period, series.frequency),
        valueText: formatDecimalString(best.value),
        href: obsHref(best.obs_id),
        sheet: obsSlug(best.obs_id),
        style: VINTAGE_STYLE[best.vintage] ?? OTHER_STYLE,
        kindLabel: vintageWords(best.vintage),
      });
    if (top !== best) {
      const m = base.marks.find((x) => x.period === period && x.vintage === top.vintage);
      if (m) marks.push(m);
    }
  }
  return { ...base, lines: points.length ? [{ key: "best", label: "Best available figure", style: NEUTRAL, points }] : [], marks };
}

/** A derived view as the series page's views.json carries it (src/lib/series-derive.ts). */
export type DerivedPointJson = { p: string; k: string; v: string | null; in: string[]; iv?: string[]; gap?: string; why?: string; st?: string; bad?: string; diff?: string };
export type DerivedViewJson = { id: string; op: "pct" | "chg" | "idx" | "share" | "rev"; dp: number; base?: string; points: DerivedPointJson[] };

const periodOfId = (id: string) => id.split(":")[1] ?? "";
const signedText = (v: string) => {
  const neg = v.startsWith("-");
  const abs = neg ? v.slice(1) : v;
  const body = formatDecimalString(abs);
  return /^0*(\.0*)?$/.test(abs) ? body : `${neg ? "−" : "+"}${body}`;
};

/** Unit words of a derived view. */
export function derivedUnit(op: DerivedViewJson["op"], series: Pick<ChartSeries, "unit" | "scale_factor" | "frequency">, base?: string): string {
  if (op === "pct" || op === "rev") return "per cent";
  if (op === "share") return "per cent of the parent total";
  if (op === "idx") return `index, ${periodWords(base ?? "", series.frequency)} = 100`;
  return series.unit === "percent" ? "percentage points" : unitLabel(series.unit, series.scale_factor);
}

/** The text of one derived value as shown: "+17.1%", "−7.84", "416.1", "0.21%". */
export function derivedText(op: DerivedViewJson["op"], v: string): string {
  if (op === "pct" || op === "rev") return `${signedText(v)}%`;
  if (op === "chg") return signedText(v);
  if (op === "share") return `${formatDecimalString(v)}%`;
  return formatDecimalString(v);
}

/** Chart model of a derived view: one line per kind of figure (bars for the revision view); travelled gaps under the axis. */
export function derivedModelFrom(series: ChartSeries, base: ChartModel, view: DerivedViewJson, kindWords: Record<string, string>): ChartModel {
  const ord = new Map(base.periods.map((p) => [p.p, p.x]));
  const kinds = [...new Set(view.points.map((p) => p.k))].sort((a, b) => (a === "be" ? -1 : b === "be" ? 1 : a.localeCompare(b)));
  const bars = view.op === "rev";
  const fu = (v: string) => formatDecimalString(v);
  const lines: ChartLine[] = kinds
    .map((k) => ({
      key: k,
      label: bars ? "Budget to revised" : k === "na" ? seriesTitle(series) : (kindWords[k] ?? vintageWords(k)),
      style: bars ? { color: "var(--chart-be)", dash: null, marker: "square" as const } : (VINTAGE_STYLE[k] ?? OTHER_STYLE),
      points: view.points
        .filter((p) => p.k === k && p.v !== null && ord.has(p.p))
        .map((p) => {
          const pl = periodWords(p.p, series.frequency);
          const note: string[] = [];
          if (p.iv && p.iv.length === 2) {
            const bp = periodWords(periodOfId(p.in[1]), series.frequency);
            if (view.op === "rev") note.push(`Revised ${fu(p.iv[0])} against budget ${fu(p.iv[1])}`, `Difference ${signedText(p.diff ?? "")} ${unitLabel(series.unit, series.scale_factor)}`);
            else if (view.op === "share") note.push(`${fu(p.iv[0])} of ${fu(p.iv[1])}, ${unitLabel(series.unit, series.scale_factor)}`);
            else if (view.op === "idx") note.push(`${fu(p.iv[0])} against ${fu(p.iv[1])} in ${bp}`);
            else note.push(`${fu(p.iv[0])} in ${pl} against ${fu(p.iv[1])} in ${bp}`);
            note.push("Derived from checked figures");
          }
          return {
            x: ord.get(p.p)!,
            y: Number(p.v),
            period: p.p,
            periodLabel: pl,
            valueText: derivedText(view.op, p.v!),
            href: obsHref(p.in[0]),
            sheet: obsSlug(p.in[0]),
            kindLabel: kindWords[k],
            note,
          };
        })
        .sort((a, b) => a.x - b.x),
    }))
    .filter((l) => l.points.length > 0);
  const marks: ChartMark[] = view.points
    .filter((p) => p.v === null && p.gap === "travel" && ord.has(p.p))
    .map((p) => {
      const failed = p.bad ?? p.in[0];
      return {
        x: ord.get(p.p)!,
        period: p.p,
        periodLabel: periodWords(p.p, series.frequency),
        vintage: p.k,
        vintageLabel: kindWords[p.k] ?? vintageWords(p.k),
        status: (p.st as StatusKey) ?? "unknown",
        statusLabel: p.why ?? "No value",
        href: obsHref(failed),
        sheet: obsSlug(failed),
      };
    });
  return {
    ...base,
    unit: derivedUnit(view.op, series, view.base),
    unitCode: view.op === "chg" ? series.unit : "percent",
    zeroBased: view.op !== "idx",
    lines,
    marks,
    bars,
  };
}
