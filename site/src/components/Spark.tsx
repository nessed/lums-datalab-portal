// Sparkline: checked values only, one kind of figure (the series' main one),
// no axes. The line breaks at gaps and at series breaks, exactly as the full
// chart does (canConnect). The whole sparkline links to the series; the
// printed last value beside it (rendered by the caller) links to its receipt.
import Link from "next/link";
import { canConnect, chartModelFrom } from "@/lib/chart-model";
import { db, seriesHref, type Series } from "@/lib/data";
import { mainVintage } from "@/lib/stats";

export default function Spark({ series, width = 96, height = 30, link = true }: { series: Series; width?: number; height?: number; link?: boolean }) {
  const v = mainVintage(series.series_id);
  const obs = (db().obsBySeries.get(series.series_id) ?? []).filter((o) => o.vintage === v);
  const model = chartModelFrom(series, obs);
  const pts = model.lines[0]?.points ?? [];
  if (pts.length < 2) return <span className="spark spark-none" style={{ width, height }} aria-hidden="true" />;
  const xs = model.periods.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const ys = pts.map((p) => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const px = (x: number) => 2 + ((x - x0) / (x1 - x0 || 1)) * (width - 6);
  const py = (y: number) => height - 3 - ((y - lo) / (hi - lo || 1)) * (height - 6);
  let d = "";
  pts.forEach((p, i) => {
    const join = i > 0 && canConnect(pts[i - 1], p, model);
    d += `${join ? "L" : "M"}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`;
  });
  // Lone points (neighbours missing on both sides) get a dot so they are seen.
  const lone = pts.filter((p, i) => !(i > 0 && canConnect(pts[i - 1], p, model)) && !(i < pts.length - 1 && canConnect(p, pts[i + 1], model)));
  const last = pts[pts.length - 1];
  const svg = (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <path d={d} />
      {pts.map((p) => (
        <circle key={p.period} cx={px(p.x)} cy={py(p.y)} r={lone.includes(p) ? 1.8 : 1.2} className={lone.includes(p) ? "spark-lone" : "spark-pt"} />
      ))}
      <circle cx={px(last.x)} cy={py(last.y)} r={2.4} />
    </svg>
  );
  if (!link) return svg;
  return (
    <Link href={seriesHref(series.series_id)} className="spark-link" aria-label={`Chart of ${series.name}`} tabIndex={-1}>
      {svg}
    </Link>
  );
}
