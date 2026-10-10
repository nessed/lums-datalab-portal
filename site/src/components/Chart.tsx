// Hand-rolled static SVG line chart. Server component: no JavaScript needed.
// Every point is a link to its receipt and carries a native tooltip.
import { canConnect, type ChartLine, type ChartModel } from "@/lib/chart";

const W = 680;
const H = 320;
const M = { top: 34, right: 20, bottom: 40, left: 72 };

function niceTicks(min: number, max: number, target = 5): number[] {
  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

function tickLabel(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 6 }).replace("-", "−");
}

function Marker({ line, cx, cy }: { line: ChartLine; cx: number; cy: number }) {
  const common = { fill: line.color, stroke: "#ffffff", strokeWidth: 2 };
  if (line.marker === "square") return <rect x={cx - 4.5} y={cy - 4.5} width={9} height={9} {...common} />;
  if (line.marker === "diamond") return <rect x={cx - 4.5} y={cy - 4.5} width={9} height={9} transform={`rotate(45 ${cx} ${cy})`} {...common} />;
  return <circle cx={cx} cy={cy} r={5} {...common} />;
}

export function LegendSwatch({ line }: { line: Pick<ChartLine, "color" | "dashed" | "marker"> }) {
  return (
    <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true" className="legend-swatch">
      <line x1="1" y1="6" x2="33" y2="6" stroke={line.color} strokeWidth="2" strokeDasharray={line.dashed ? "5 3" : undefined} />
      <Marker line={line as ChartLine} cx={17} cy={6} />
    </svg>
  );
}

export default function Chart({ model, caption }: { model: ChartModel; caption?: string }) {
  const points = model.lines.flatMap((l) => l.points);
  if (points.length === 0) {
    return (
      <div className="chart-empty">
        No checked values to chart yet for this series. Gaps are listed in the table with the reason for each.
      </div>
    );
  }
  const xsAll = [...model.ticks.map((t) => t.x), ...model.breaks.map((b) => b.x)];
  const xMin = Math.min(...xsAll) - model.step / 2;
  const xMax = Math.max(...xsAll) + model.step / 2;
  const ys = points.map((p) => p.y);
  const yLo = model.zeroBased ? Math.min(0, ...ys) : Math.min(...ys);
  const yHi = model.zeroBased ? Math.max(0, ...ys) : Math.max(...ys);
  const yTicks = niceTicks(yLo, yHi);
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];
  const sx = (x: number) => M.left + ((x - xMin) / (xMax - xMin || 1)) * (W - M.left - M.right);
  const sy = (y: number) => H - M.bottom - ((y - yMin) / (yMax - yMin || 1)) * (H - M.top - M.bottom);

  // Show a period label only where it will not collide with the previous one.
  const xLabels = model.ticks.reduce<{ x: number; label: string; px: number; show: boolean }[]>((acc, t) => {
    const px = sx(t.x);
    const lastShown = acc.findLast((a) => a.show);
    return [...acc, { ...t, px, show: !lastShown || px - lastShown.px >= 54 }];
  }, []);

  const multi = model.lines.length > 1;
  const summary = `${model.title}, ${model.unit}. ${model.lines
    .map((l) => `${l.label}: ${l.points.map((p) => `${p.period} ${p.valueText}`).join("; ")}`)
    .join(". ")}.`;

  return (
    <figure className="chart">
      {multi && (
        <div className="chart-legend">
          {model.lines.map((l) => (
            <span key={l.key} className="chart-legend-item">
              <LegendSwatch line={l} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <div className="chart-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="chart-svg">
          <text x={M.left} y={14} className="chart-unit">
            {model.unit}
          </text>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} className={t === 0 ? "chart-zero" : "chart-grid"} />
              <text x={M.left - 8} y={sy(t) + 4} textAnchor="end" className="chart-tick">
                {tickLabel(t)}
              </text>
            </g>
          ))}
          {xLabels.map((t) => (
            <g key={t.label}>
              <line x1={t.px} x2={t.px} y1={H - M.bottom} y2={H - M.bottom + 4} className="chart-axis" />
              {t.show && (
                <text x={t.px} y={H - M.bottom + 18} textAnchor="middle" className="chart-tick">
                  {t.label}
                </text>
              )}
            </g>
          ))}
          <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} className="chart-axis" />
          {model.breaks.map((b, i) => {
            const px = sx(b.x);
            const flip = px > W - M.right - 150;
            return (
              <g key={i} className="chart-break">
                <title>{`${b.label} at ${b.atPeriod}. ${b.note}`}</title>
                <line x1={px} x2={px} y1={M.top - 6} y2={H - M.bottom} />
                <text x={flip ? px - 5 : px + 5} y={M.top + 4} textAnchor={flip ? "end" : "start"}>
                  {b.label}
                </text>
              </g>
            );
          })}
          {model.lines.map((l) => (
            <g key={l.key}>
              {l.points.slice(1).map((p, i) => {
                const a = l.points[i];
                if (!canConnect(a, p, model)) return null;
                return (
                  <line
                    key={p.period}
                    x1={sx(a.x)}
                    y1={sy(a.y)}
                    x2={sx(p.x)}
                    y2={sy(p.y)}
                    stroke={l.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray={l.dashed ? "6 4" : undefined}
                  />
                );
              })}
            </g>
          ))}
          {model.lines.map((l) => (
            <g key={l.key}>
              {l.points.map((p) => (
                <a key={p.period} href={p.href} className="chart-point">
                  <title>{`${multi ? `${l.label}, ` : ""}${p.period}: ${p.valueText} (${model.unit}). Open the receipt.`}</title>
                  <circle cx={sx(p.x)} cy={sy(p.y)} r={12} fill="transparent" />
                  <Marker line={l} cx={sx(p.x)} cy={sy(p.y)} />
                </a>
              ))}
            </g>
          ))}
        </svg>
      </div>
      <figcaption>
        {caption ? `${caption} ` : ""}
        Each point links to its receipt. Lines join only neighbouring periods; they stop at missing periods and at breaks.
        {model.breaks.map((b, i) => (
          <span key={i} className="chart-break-note">
            <strong>
              {b.label} (from {b.atPeriod}).
            </strong>{" "}
            {b.note}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
