// Chart model types and pure helpers. No server imports: the client chart
// uses this module, so it must never pull in the data layer (node:fs).
import type { StatusKey } from "./status";

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
