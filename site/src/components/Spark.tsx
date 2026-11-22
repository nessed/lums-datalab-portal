// Sparkline: checked values only, one kind of figure (the series' main one),
// no axes. Round 2 look: a thin LUMS-blue line (--chart-be), the last point
// marked; styles .spark in globals.css. It draws the latest unbroken run of
// figures only (latestRun: never joined across a gap or a series break, as on
// the full chart), scaled to the full width, so a figure cut off by a gap is
// never a stray dot beside the line. A monthly series is drawn on the month it
// is read in (the month of its latest figure), one point a year, as the CPI
// June issues are. The whole sparkline links to the series; the printed last
// value beside it (rendered by the caller) links to its receipt.
import Link from "@/components/ui/Link";
import { seriesTitle } from "@/lib/titles";
import { chartModelFrom, latestRun } from "@/lib/chart-model";
import { db, seriesHref, type Series } from "@/lib/data";
import { mainVintage } from "@/lib/stats";

export default function Spark({ series, width = 96, height = 30, link = true }: { series: Series; width?: number; height?: number; link?: boolean }) {
  const v = mainVintage(series.series_id);
  const obs = (db().obsBySeries.get(series.series_id) ?? []).filter((o) => o.vintage === v);
  const model = chartModelFrom(series, obs);
  let all = model.lines[0]?.points ?? [];
  let join = model;
  if (model.frequency === "month" && all.length) {
    const lastX = all[all.length - 1].x;
    all = all.filter((p) => (lastX - p.x) % 12 === 0);
    join = { ...model, step: 12 };
  }
  const pts = latestRun(all, join);
  if (pts.length < 2) return <span className="spark spark-none" style={{ width, height }} aria-hidden="true" />;
  const x0 = pts[0].x;
  const x1 = pts[pts.length - 1].x;
  const ys = pts.map((p) => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const px = (x: number) => 2 + ((x - x0) / (x1 - x0 || 1)) * (width - 6);
  const py = (y: number) => height - 3 - ((y - lo) / (hi - lo || 1)) * (height - 6);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`).join("");
  const last = pts[pts.length - 1];
  const svg = (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <path d={d} />
      <circle cx={px(last.x)} cy={py(last.y)} r={2.6} className="spark-last" />
    </svg>
  );
  if (!link) return svg;
  return (
    <Link href={seriesHref(series.series_id)} className="spark-link" aria-label={`Chart of ${seriesTitle(series)}`} tabIndex={-1}>
      {svg}
    </Link>
  );
}
