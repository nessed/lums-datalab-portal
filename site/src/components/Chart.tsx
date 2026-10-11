"use client";
// Hand-rolled SVG line chart. Rules (docs/DESIGN.md, "Charts"):
// - one line per estimate type, labelled directly at its end (no legend box);
// - lines join only neighbouring periods; they stop at gaps and at breaks;
// - periods with no published value are marked under the axis with their
//   status shape (hatched, dotted, crossed, ring), never interpolated;
// - a break is a labelled vertical rule, drawn only with data on both sides;
// - hover or focus shows the exact printed value, its period and estimate
//   type; every point is a link to its receipt;
// - axis ticks are humanised (Rs 150 billion), the tooltip is exact.
// The server renders it at a default width; on the client it measures its
// container so text stays 12px on a phone.
import { useEffect, useMemo, useRef, useState } from "react";
import { canConnect, type ChartLine, type ChartMark, type ChartModel, type LineStyle } from "@/lib/chart-model";
import type { StatusKey } from "@/lib/status";

export type ChartOptions = { log?: boolean; from?: string | null; to?: string | null; highlight?: string | null; xDomain?: [number, number] | null; height?: number; noKey?: boolean };

const DEFAULT_H = 340;

function niceStep(raw: number) {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag;
}
function linearTicks(min: number, max: number, target: number): number[] {
  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    min -= pad;
    max += pad;
  }
  const step = niceStep((max - min) / target);
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}
function logTicks(min: number, max: number): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, e);
      if (v >= min / 1.0001 && v <= max * 1.0001) out.push(v);
    }
  }
  if (out.length < 2) return [min, max];
  return out;
}

/** Axis label: amounts in words ("Rs 150 bn"), other units as plain numbers. */
function tickText(v: number, unitCode: string, scale: number): string {
  if (unitCode === "PKR") {
    const full = v * scale;
    const a = Math.abs(full);
    const s = full < 0 ? "−" : "";
    const f = (n: number) => String(Number(n.toPrecision(3)));
    if (a >= 1e12) return `${s}Rs ${f(a / 1e12)} tn`;
    if (a >= 1e9) return `${s}Rs ${f(a / 1e9)} bn`;
    if (a >= 1e6) return `${s}Rs ${f(a / 1e6)} m`;
    if (a === 0) return "0";
    return `${s}Rs ${a.toLocaleString("en-US")}`;
  }
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 }).replace("-", "−");
}

function Marker({ style, cx, cy, r = 4.5 }: { style: LineStyle; cx: number; cy: number; r?: number }) {
  const common = { fill: style.color, stroke: "#fff", strokeWidth: 1.5 };
  if (style.marker === "square") return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} {...common} />;
  if (style.marker === "diamond") return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} transform={`rotate(45 ${cx} ${cy})`} {...common} />;
  return <circle cx={cx} cy={cy} r={r} {...common} />;
}

/** The status shape for a period with no value, under the axis. */
function GapMark({ status, cx, cy }: { status: StatusKey; cx: number; cy: number }) {
  const s = 4.5;
  const col = status === "disputed" ? "var(--st-disputed)" : status === "withheld" ? "var(--st-withheld)" : "var(--st-gap)";
  if (status === "disputed") return <circle cx={cx} cy={cy} r={s - 0.6} fill="var(--paper)" stroke={col} strokeWidth={1.8} />;
  return (
    <g stroke={col} strokeWidth={1.1} fill="var(--paper)">
      <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} strokeDasharray={status === "gap-pending" ? "1.3 1.5" : undefined} />
      {status === "gap-source" ? <path d={`M${cx - s} ${cy + s - 3} L${cx - s + 3} ${cy + s} M${cx - s} ${cy} L${cx} ${cy + s} M${cx - s} ${cy - s + 1} L${cx + s - 1} ${cy + s} M${cx - s + 3} ${cy - s} L${cx + s} ${cy + s - 3} M${cx} ${cy - s} L${cx + s} ${cy}`} /> : null}
      {status === "withheld" ? <path d={`M${cx - 2.6} ${cy - 2.6} L${cx + 2.6} ${cy + 2.6} M${cx + 2.6} ${cy - 2.6} L${cx - 2.6} ${cy + 2.6}`} /> : null}
    </g>
  );
}

export function LineKey({ line }: { line: Pick<ChartLine, "style" | "label"> }) {
  return (
    <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden="true">
      <line x1="1" y1="6" x2="29" y2="6" stroke={line.style.color} strokeWidth="2" strokeDasharray={line.style.dash ?? undefined} />
      <Marker style={line.style} cx={15} cy={6} r={3.5} />
    </svg>
  );
}

type Tip = { x: number; px: number; period: string; rows: { label: string; value: string; color: string }[]; marks: ChartMark[] };

export default function Chart({ model, options = {}, idBase = "chart", caption }: { model: ChartModel; options?: ChartOptions; idBase?: string; caption?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = W < 520;
  const H = options.height ?? (narrow ? 280 : DEFAULT_H);
  const view = useMemo(() => {
    const inRange = (p: string) => (!options.from || p >= options.from) && (!options.to || p <= options.to);
    const periods = model.periods.filter((p) => inRange(p.p));
    const lines = model.lines.map((l) => ({ ...l, points: l.points.filter((p) => inRange(p.period)) })).filter((l) => l.points.length > 0);
    const marks = model.marks.filter((m) => inRange(m.period));
    return { periods, lines, marks };
  }, [model, options.from, options.to]);

  const points = view.lines.flatMap((l) => l.points);
  if (points.length === 0) {
    return (
      <div className="chart-empty" ref={wrap}>
        <p>
          No checked values to chart {options.from || options.to ? "in this period range" : "yet for this series"}. Every gap is listed in the table below
          with the reason for it.
        </p>
      </div>
    );
  }

  const canLog = points.every((p) => p.y > 0);
  const log = !!options.log && canLog;
  // A single line needs no label: the page title names it.
  const labelled = view.lines.length > 1;
  // Long labels (series names on the compare page) go in a key above the chart.
  const keyAbove = labelled && (narrow || Math.max(...view.lines.map((l) => l.label.length)) > 24);
  const showKey = keyAbove && !options.noKey;
  const longest = labelled ? Math.max(...view.lines.map((l) => l.label.length)) : 0;
  const M = { top: 30, right: keyAbove || !labelled ? 16 : Math.min(150, 14 + longest * 6.6), bottom: view.marks.length ? 62 : 40, left: model.unitCode === "PKR" ? (narrow ? 62 : 74) : narrow ? 44 : 54 };
  const xs = [...view.periods.map((p) => p.x)];
  // Small multiples share one period axis: the caller passes the common domain.
  const xMin = (options.xDomain ? options.xDomain[0] : Math.min(...xs)) - model.step * 0.6;
  const xMax = (options.xDomain ? options.xDomain[1] : Math.max(...xs)) + model.step * 0.6;
  const ys = points.map((p) => p.y);
  const tf = (v: number) => (log ? Math.log10(v) : v);
  let yTicks: number[];
  if (log) yTicks = logTicks(Math.min(...ys), Math.max(...ys));
  else yTicks = linearTicks(model.zeroBased ? Math.min(0, ...ys) : Math.min(...ys), model.zeroBased ? Math.max(0, ...ys) : Math.max(...ys), narrow ? 4 : 5);
  const yLo = tf(log ? Math.min(yTicks[0], ...ys) : yTicks[0]);
  const yHi = tf(log ? Math.max(yTicks[yTicks.length - 1], ...ys) : yTicks[yTicks.length - 1]);
  const plotW = W - M.left - M.right;
  const sx = (x: number) => M.left + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const sy = (y: number) => H - M.bottom - ((tf(y) - yLo) / (yHi - yLo || 1)) * (H - M.top - M.bottom);
  const baseY = H - M.bottom;

  // x labels: years for monthly series, otherwise every period that fits.
  const xl: { px: number; label: string }[] = [];
  if (model.frequency === "month") {
    const seen = new Set<string>();
    for (const p of view.periods) {
      const yr = p.p.slice(0, 4);
      if (seen.has(yr)) continue;
      seen.add(yr);
      xl.push({ px: sx(p.x), label: yr });
    }
  } else for (const p of view.periods) xl.push({ px: sx(p.x), label: p.label });
  const minGap = narrow ? 52 : 58;
  const shown = xl.reduce<typeof xl>((acc, t) => (acc.length === 0 || t.px - acc[acc.length - 1].px >= minGap ? [...acc, t] : acc), []);

  // Direct labels at line ends, nudged apart so they never overlap.
  const ends = view.lines
    .map((l) => {
      const last = l.points[l.points.length - 1];
      return { key: l.key, label: l.label, style: l.style, x: sx(last.x), y: sy(last.y) };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;

  const breaks = model.breaks.filter((b) => b.inView && b.x > xMin && b.x < xMax);
  const markRow = baseY + 34;
  const multi = view.lines.length > 1;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best: (typeof view.periods)[number] | null = null;
    for (const p of view.periods) if (!best || Math.abs(sx(p.x) - px) < Math.abs(sx(best.x) - px)) best = p;
    if (!best) return;
    const bp = best;
    const rows = view.lines
      .map((l) => {
        const pt = l.points.find((q) => q.period === bp.p);
        return pt ? { label: l.label, value: pt.valueText, color: l.style.color } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const marks = view.marks.filter((m) => m.period === bp.p);
    setTip({ x: bp.x, px: sx(bp.x), period: model.frequency === "month" ? (view.lines[0]?.points.find((q) => q.period === bp.p)?.periodLabel ?? bp.label) : bp.p, rows, marks });
  };

  const titleId = `${idBase}-title`;
  const descId = `${idBase}-desc`;
  return (
    <figure className="chart">
      {showKey ? (
        <ul className="chart-key" aria-hidden="true">
          {view.lines.map((l) => (
            <li key={l.key}>
              <LineKey line={l} />
              {l.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="chart-wrap" ref={wrap}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="chart-svg"
          role="group"
          aria-labelledby={titleId}
          aria-describedby={descId}
          onPointerMove={onMove}
          onPointerLeave={() => setTip(null)}
        >
          <title id={titleId}>{`${model.title}, ${model.unit}`}</title>
          <desc id={descId}>
            {`Line chart of ${view.lines.length === 1 ? "one line" : `${view.lines.length} lines (${view.lines.map((l) => l.label).join(", ")})`}. Each point is a link to its receipt. The table below the chart lists every value.`}
          </desc>
          <text x={M.left - 6} y={14} textAnchor="end" className="c-unit">
            {model.unitCode === "PKR" ? "Rupees" : model.unit}
            {log ? " (log scale)" : ""}
          </text>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} className={t === 0 && !log ? "c-zero" : "c-grid"} />
              <text x={M.left - 8} y={sy(t) + 4} textAnchor="end" className="c-tick" data-num="axis">
                {tickText(t, model.unitCode, model.scale)}
              </text>
            </g>
          ))}
          <line x1={M.left} x2={W - M.right} y1={baseY} y2={baseY} className="c-axis" />
          {shown.map((t) => (
            <g key={`${t.label}-${t.px}`}>
              <line x1={t.px} x2={t.px} y1={baseY} y2={baseY + 4} className="c-axis" />
              <text x={t.px} y={baseY + 17} textAnchor="middle" className="c-tick" data-num="period">
                {t.label}
              </text>
            </g>
          ))}
          {breaks.map((b) => {
            const px = sx(b.x);
            const flip = px > W - M.right - 140;
            const label = `Break: ${b.label}`;
            return (
              <g key={b.atPeriod} className="c-break">
                <title>{`${label} from ${b.atLabel}. ${b.note}`}</title>
                <line x1={px} x2={px} y1={M.top - 10} y2={baseY} />
                <rect x={flip ? px - 6 - label.length * 6.2 : px + 3} y={M.top - 22} width={label.length * 6.2 + 4} height={15} />
                <text x={flip ? px - 5 : px + 5} y={M.top - 11} textAnchor={flip ? "end" : "start"}>
                  {label}
                </text>
              </g>
            );
          })}
          {tip ? <line x1={tip.px} x2={tip.px} y1={M.top} y2={baseY} className="c-hover-rule" /> : null}
          {view.lines.map((l) => (
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
                    stroke={l.style.color}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeDasharray={l.style.dash ?? undefined}
                  />
                );
              })}
            </g>
          ))}
          {view.lines.map((l) => (
            <g key={l.key}>
              {l.points.map((p) => (
                <a key={p.period} href={p.href} className="c-pt" aria-label={`${multi ? `${l.label}, ` : ""}${p.periodLabel}: ${p.valueText} ${model.unit}. Open the receipt.`}>
                  <circle cx={sx(p.x)} cy={sy(p.y)} r={11} className="c-hit" fill="transparent" />
                  {options.highlight === p.period ? <circle cx={sx(p.x)} cy={sy(p.y)} r={9} className="c-hl" /> : null}
                  <Marker style={l.style} cx={sx(p.x)} cy={sy(p.y)} r={tip && tip.x === p.x ? 5.5 : options.highlight === p.period ? 5.5 : 4} />
                </a>
              ))}
            </g>
          ))}
          {labelled &&
            !keyAbove &&
            ends.map((e) => (
              <text key={e.key} x={e.x + 9} y={e.y + 4} className="c-label" fill={e.style.color} style={{ fill: e.style.color }}>
                {e.label}
              </text>
            ))}
          {view.marks.length > 0 ? (
            <g>
              <text x={M.left - 8} y={markRow + 4} textAnchor="end" className="c-tick">
                no value
              </text>
              {view.marks.map((m) => (
                <a key={`${m.period}-${m.vintage}`} href={m.href} className="c-pt" aria-label={`${m.periodLabel}, ${m.vintageLabel}: ${m.statusLabel}. Open the receipt.`}>
                  <circle cx={sx(m.x)} cy={markRow} r={9} className="c-hit" fill="transparent" />
                  <GapMark status={m.status} cx={sx(m.x) + (multi ? (m.vintage === "re" ? 5 : m.vintage === "be" ? -5 : 0) : 0)} cy={markRow} />
                </a>
              ))}
            </g>
          ) : null}
        </svg>
        {tip ? (
          <div className="chart-tip" style={{ left: `${(tip.px / W) * 100}%`, top: M.top }} role="status">
            <div className="tip-m">{tip.period}</div>
            {tip.rows.map((r) => (
              <div key={r.label}>
                <span className="tip-v">{r.value}</span> <span className="tip-m">{multi ? r.label : model.unit}</span>
              </div>
            ))}
            {tip.marks.map((m) => (
              <div key={m.vintage} className="tip-m">
                {multi ? `${m.vintageLabel}: ` : ""}
                {m.statusLabel}
              </div>
            ))}
            <div className="tip-m">Click a point for its receipt</div>
          </div>
        ) : null}
      </div>
      {caption ? <figcaption className="chart-notes">{caption}</figcaption> : null}
    </figure>
  );
}
