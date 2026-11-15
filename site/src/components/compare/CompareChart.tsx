// A line chart for the compare page, drawn without measuring the screen: the
// SVG stretches to its box (preserveAspectRatio="none") and every stroke and
// marker keeps its size (vector-effect="non-scaling-stroke"; markers are
// zero-length strokes with round or square caps), while the axis labels are
// HTML placed in per cent. The box has a fixed height, so nothing moves when
// the page hydrates (DESIGN.md 14.1: layout shift ≤ 0.1). Pure: no hooks, so
// the server renders the default view and the browser every other.
//
// Lines stop at gaps, at missing periods and at breaks; each line has its own
// colour, dash and marker cap; every marker links to a receipt.
import type { ShowAs } from "./transform";
import { niceTicks, tickText } from "./transform";

export type LineStyle = { color: string; dash: string | null; cap: "round" | "square" };

export type ChartPoint = { t: number; y: number | null; label: string; text: string; href: string };

export type ChartLine = { id: string; name: string; style: LineStyle; pts: ChartPoint[]; step: number | null };

export type ChartSpec = {
  lines: ChartLine[];
  xDomain: [number, number];
  xTicks: { t: number; label: string }[];
  breaks: { t: number; label: string }[];
  /** Runs of periods no chosen series has in this release: drawn as labelled bands. */
  gaps?: { from: number; to: number; fromLabel: string; toLabel: string; years: number }[];
  show: ShowAs;
  unit: string;
  scale: number;
  height: number;
  label: string;
};

const W = 1000;
const H = 1000;

export default function CompareChart({ spec }: { spec: ChartSpec }) {
  const ys = spec.lines.flatMap((l) => l.pts.map((p) => p.y).filter((y): y is number => y !== null && Number.isFinite(y)));
  let lo = ys.length ? Math.min(...ys) : 0;
  let hi = ys.length ? Math.max(...ys) : 1;
  // Amounts start at zero; changes always show zero; an index shows 100.
  if (spec.show === "printed" && spec.unit !== "index" && lo > 0) lo = 0;
  if (spec.show === "share" && lo > 0) lo = 0;
  if (spec.show === "change") {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (spec.show === "index") {
    lo = Math.min(lo, 100);
    hi = Math.max(hi, 100);
  }
  const ticks = niceTicks(lo, hi, 4);
  const y0 = ticks.length ? Math.min(ticks[0], lo) : lo;
  const y1 = ticks.length ? Math.max(ticks[ticks.length - 1], hi) : hi;
  const [x0, x1] = spec.xDomain;
  const sx = (t: number) => ((t - x0) / (x1 - x0 || 1)) * W;
  const sy = (v: number) => (1 - (v - y0) / (y1 - y0 || 1)) * H;
  const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(3)}%`;
  const refLine = spec.show === "index" ? 100 : spec.show === "change" || (y0 < 0 && y1 > 0) ? 0 : null;

  const paths = spec.lines.map((l) => {
    const segs: string[] = [];
    let cur: string[] = [];
    let prev: ChartPoint | null = null;
    for (const p of l.pts) {
      if (p.y === null || !Number.isFinite(p.y)) {
        if (cur.length > 1) segs.push(cur.join(" "));
        cur = [];
        prev = null;
        continue;
      }
      const joined =
        prev !== null &&
        (l.step === null || Math.abs(p.t - prev.t - l.step) < l.step * 0.25) &&
        !spec.breaks.some((b) => b.t > prev!.t && b.t < p.t);
      if (!joined && cur.length) {
        if (cur.length > 1) segs.push(cur.join(" "));
        cur = [];
      }
      cur.push(`${cur.length ? "L" : "M"}${sx(p.t).toFixed(1)} ${sy(p.y).toFixed(1)}`);
      prev = p;
    }
    if (cur.length > 1) segs.push(cur.join(" "));
    return segs.join(" ");
  });

  return (
    <div className="cc" style={{ height: spec.height }}>
      <div className="cc-area" role="group" aria-label={spec.label}>
        {(spec.gaps ?? []).map((g) => (
          <div
            key={`gap${g.from}`}
            className={`cc-gap${g.years <= 2 ? " cc-gap--narrow" : ""}`}
            style={{ left: pct(sx(g.from - 0.5), W), width: pct(sx(g.to + 0.5) - sx(g.from - 0.5), W) }}
          >
            <span className="cc-gaptext">
              <span data-num="period">{g.fromLabel}</span>
              {g.from === g.to ? null : (
                <>
                  {" "}to <span data-num="period">{g.toLabel}</span>
                </>
              )}
              : not in this release
            </span>
          </div>
        ))}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="cc-svg" aria-hidden="true" focusable="false">
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={sy(t)} y2={sy(t)} className={t === refLine ? "cc-ref" : "cc-grid"} vectorEffect="non-scaling-stroke" />
          ))}
          {spec.breaks.map((b) => (
            <line key={`b${b.t}`} x1={sx(b.t)} x2={sx(b.t)} y1={0} y2={H} className="cc-break" vectorEffect="non-scaling-stroke" />
          ))}
          {spec.lines.map((l, i) => (
            <path
              key={l.id}
              d={paths[i]}
              fill="none"
              stroke={l.style.color}
              strokeWidth={2}
              strokeDasharray={l.style.dash ?? undefined}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {/* Markers: links to receipts, in HTML so that they stay round and tappable at any width. */}
        {spec.lines.map((l) =>
          l.pts
            .filter((p) => p.y !== null && Number.isFinite(p.y))
            .map((p) => (
              <a
                key={`${l.id}-${p.t}`}
                href={p.href}
                className={`cc-pt cc-pt--${l.style.cap}`}
                style={{ left: pct(sx(p.t), W), top: pct(sy(p.y as number), H), background: l.style.color }}
                aria-label={`${l.name}, ${p.label}: ${p.text}. See where it comes from.`}
                title={`${l.name}, ${p.label}: ${p.text}`}
              />
            )),
        )}
        {[...new Map(spec.lines.flatMap((l) => l.pts.filter((p) => p.y === null && Number.isFinite(p.t)).map((p) => [p.t, p] as const))).values()].map((p) => {
          const words = [...new Set(spec.lines.flatMap((l) => l.pts.filter((q) => q.t === p.t && q.y === null).map((q) => q.text)))].join(", ");
          return (
            <span key={`gw${p.t}`} className="cc-gapw" style={{ left: pct(sx(p.t), W) }}>
              {words}
            </span>
          );
        })}
        {ticks.map((t) => (
          <span key={t} className="cc-yt" style={{ top: pct(sy(t), H) }} data-num="axis">
            {tickText(t, spec.show, spec.unit, spec.scale)}
          </span>
        ))}
        {spec.breaks.map((b) => (
          <span key={`bl${b.t}`} className="cc-bl" style={{ left: pct(sx(b.t), W) }} data-num="axis">
            {b.label}
          </span>
        ))}
      </div>
      <div className="cc-x" aria-hidden="true">
        {spec.xTicks.map((t) => (
          <span key={t.t} className="cc-xt" style={{ left: pct(sx(t.t), W) }} data-num="axis">
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
