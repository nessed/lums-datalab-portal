// The compare page's numbers (DESIGN.md 9.6): pure functions, no imports, so
// they run on the server, in the browser and in the unit tests
// (scripts/checks/take-transforms.mjs, run by check-build).
//
// Inputs are the release's own values as written to public/data/<release>/
// compare/<id>.json (checked against the release by scripts/checks/take-files.mjs):
// v is the stored value, present only for a figure that shows one; d is 1 only
// when the figure may feed a derived value (checked). A transform uses only
// d = 1 inputs; anything computed from another figure is itself held back, with
// that figure's reason (DESIGN.md 6.1 "Gaps travel").

export type Pt = {
  p: string; // period
  k: string; // kind of figure
  v: string | null; // stored value, only where the figure shows one
  d: 0 | 1; // usable in a derived value
  s: string; // reader status key
  r?: string; // reason, when not checked
  o: string; // receipt slug
  doc?: string;
  src?: string;
  pg?: string;
};

export type SeriesData = {
  release: string;
  id: string;
  n: string;
  ds: string;
  dk: string;
  u: string;
  sf: number;
  uw: string;
  f: string;
  def: string | null;
  base: string | null;
  parent: string | null;
  br: { p: string; k: string; note: string }[];
  pts: Pt[];
};

export type ShowAs = "printed" | "index" | "change" | "share";

export const SHOW_AS: { key: ShowAs; label: string }[] = [
  { key: "printed", label: "As printed" },
  { key: "index", label: "Index" },
  { key: "change", label: "% change from a year earlier" },
  { key: "share", label: "Share of a total" },
];

export function parseShow(s: string | null): ShowAs {
  return s === "index" || s === "change" || s === "share" ? s : "printed";
}

/** One shown point: a position (y), its text, and where it came from. y is null for a gap. */
export type Shown = {
  p: string;
  k: string;
  y: number | null;
  text: string;
  /** Receipt of the figure the point stands on. */
  o: string;
  /** For a derived point: the formula in words and the receipts of its inputs. */
  formula: string | null;
  inputs: { o: string; p: string; v: string }[];
  /** Why there is no value (status word and reason), when y is null. */
  held: string | null;
  status: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Position of a period on a common time axis, in years: a fiscal year or survey round at its middle, a month at its middle. */
export function timeOf(period: string, frequency: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (frequency === "month" && m) return Number(m[1]) + (Number(m[2]) - 0.5) / 12;
  if (m && (frequency === "fiscal_year" || frequency === "survey_round")) return Number(m[1]) + 1; // July to June: its middle is 1 January
  const y = /^(\d{4})$/.exec(period);
  if (y) return Number(y[1]) + 0.5;
  if (m) return Number(m[1]) + 1;
  return null;
}

/** "2026-06" -> "June 2026" for months; fiscal years stay "2025-26". */
export function periodLabel(period: string, frequency: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (frequency === "month" && m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  return period;
}

/** The period a year earlier: 2025-26 -> 2024-25; 2026-06 -> 2025-06. */
export function yearEarlier(period: string, frequency: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return /^\d{4}$/.test(period) ? String(Number(period) - 1) : null;
  if (frequency === "month") return `${Number(m[1]) - 1}-${m[2]}`;
  const a = Number(m[1]) - 1;
  return `${a}-${String((a + 1) % 100).padStart(2, "0")}`;
}

/** Thousands separators on a decimal string, never through floating point. */
export function fmtDecimal(v: string): string {
  const m = /^([+-]?)(\d+)(\.\d+)?$/.exec(v.trim());
  if (!m) return v;
  return `${m[1] === "-" ? "−" : ""}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${m[3] ?? ""}`;
}

/** A derived number to one decimal place, with a true minus sign. */
export function fmtDerived(y: number, digits = 1): string {
  const f = 10 ** digits;
  const r = Math.round(y * f) / f;
  const s = Math.abs(r).toFixed(digits);
  return `${r < 0 ? "−" : ""}${s.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** The kind of figure drawn for a series: the one asked for if it has checked figures of it, else budget estimate, else its most common. */
export function kindFor(sd: SeriesData, asked: string | null): string {
  const shown = sd.pts.filter((x) => x.v !== null);
  if (asked && shown.some((x) => x.k === asked)) return asked;
  if (shown.some((x) => x.k === "be")) return "be";
  const n = new Map<string, number>();
  for (const x of shown.length ? shown : sd.pts) n.set(x.k, (n.get(x.k) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "as_printed";
}

export const pointsOf = (sd: SeriesData, kind: string): Pt[] => sd.pts.filter((x) => x.k === kind).sort((a, b) => a.p.localeCompare(b.p));

const STATUS_WORD: Record<string, string> = {
  checked: "checked",
  "checked-note": "checked, with a note",
  candidate: "not signed off",
  revised: "revised",
  disputed: "disputed",
  held: "held back",
  "not-checked": "not checked yet",
  "not-printed": "not printed",
  "dash-or-zero": "dash or zero",
  unknown: "no value",
};
export const statusWord = (s: string) => STATUS_WORD[s] ?? s;

const gapOf = (x: Pt): Shown => ({
  p: x.p,
  k: x.k,
  y: null,
  text: statusWord(x.s),
  o: x.o,
  formula: null,
  inputs: [],
  held: `${statusWord(x.s)}${x.r ? `: ${x.r}` : ""}`,
  status: x.s,
});

/** As printed: the stored values, unchanged. Figures that show no value are gaps. */
export function asPrinted(pts: Pt[]): Shown[] {
  return pts.map((x) => (x.v === null ? gapOf(x) : { p: x.p, k: x.k, y: Number(x.v), text: fmtDecimal(x.v), o: x.o, formula: null, inputs: [], held: null, status: x.s }));
}

/** Why a derived point is held: the input that may not be used, and its reason. */
function heldBy(x: Pt, input: Pt, role: string, frequency: string): Shown {
  return {
    p: x.p,
    k: x.k,
    y: null,
    text: "held back",
    o: x.o,
    formula: null,
    inputs: [],
    held: `held back: it would use ${role} (${periodLabel(input.p, frequency)}), which is ${statusWord(input.s)}${input.r ? `. ${input.r}` : "."}`,
    status: "held",
  };
}

/** Index, chosen period = 100: value / base value × 100. Only checked inputs. */
export function indexTo(pts: Pt[], basePeriod: string, frequency: string): Shown[] {
  const base = pts.find((x) => x.p === basePeriod);
  return pts.map((x) => {
    if (!base) return { ...gapOf(x), text: "no base", held: `no figure for ${periodLabel(basePeriod, frequency)}, the base period, in this series`, status: "held" };
    if (x.d !== 1 || x.v === null) return heldBy(x, x, "this figure", frequency);
    if (base.d !== 1 || base.v === null) return heldBy(x, base, "the base figure", frequency);
    const b = Number(base.v);
    if (!(b > 0)) return { ...gapOf(x), text: "no index", held: "the base figure is zero or negative, so an index cannot be formed", status: "held" };
    const y = (Number(x.v) / b) * 100;
    return {
      p: x.p,
      k: x.k,
      y,
      text: fmtDerived(y),
      o: x.o,
      formula: `${fmtDecimal(x.v)} ÷ ${fmtDecimal(base.v)} × 100`,
      inputs: [
        { o: x.o, p: x.p, v: x.v },
        ...(x.o === base.o ? [] : [{ o: base.o, p: base.p, v: base.v }]),
      ],
      held: null,
      status: "derived",
    };
  });
}

/** % change from a year earlier: (value / value a year earlier − 1) × 100. Only checked inputs. */
export function pctChange(pts: Pt[], frequency: string): Shown[] {
  const byP = new Map(pts.map((x) => [x.p, x]));
  return pts.map((x) => {
    const pe = yearEarlier(x.p, frequency);
    const prev = pe ? byP.get(pe) : undefined;
    if (x.d !== 1 || x.v === null) return heldBy(x, x, "this figure", frequency);
    if (!prev) return { ...gapOf(x), text: "no earlier figure", held: `no figure a year earlier${pe ? ` (${periodLabel(pe, frequency)})` : ""} in this series`, status: "none" };
    if (prev.d !== 1 || prev.v === null) return heldBy(x, prev, "the figure a year earlier", frequency);
    const b = Number(prev.v);
    if (!(b > 0)) return { ...gapOf(x), text: "no change", held: "the figure a year earlier is zero or negative, so a percentage change cannot be formed", status: "held" };
    const y = (Number(x.v) / b - 1) * 100;
    return {
      p: x.p,
      k: x.k,
      y,
      text: `${y > 0 ? "+" : ""}${fmtDerived(y)}%`,
      o: x.o,
      formula: `(${fmtDecimal(x.v)} ÷ ${fmtDecimal(prev.v)} − 1) × 100`,
      inputs: [
        { o: x.o, p: x.p, v: x.v },
        { o: prev.o, p: prev.p, v: prev.v },
      ],
      held: null,
      status: "derived",
    };
  });
}

/** Share of a chosen total: value / total of the same period and kind × 100. Only checked inputs. */
export function shareOf(pts: Pt[], total: Pt[], totalName: string, frequency: string): Shown[] {
  const byP = new Map(total.map((x) => [x.p, x]));
  return pts.map((x) => {
    const t = byP.get(x.p);
    if (x.d !== 1 || x.v === null) return heldBy(x, x, "this figure", frequency);
    if (!t) return { ...gapOf(x), text: "no total", held: `no figure of ${totalName} for ${periodLabel(x.p, frequency)}`, status: "none" };
    if (t.d !== 1 || t.v === null) return heldBy(x, t, `the total, ${totalName},`, frequency);
    const b = Number(t.v);
    if (!(b > 0)) return { ...gapOf(x), text: "no share", held: "the total is zero or negative, so a share cannot be formed", status: "held" };
    const y = (Number(x.v) / b) * 100;
    return {
      p: x.p,
      k: x.k,
      y,
      text: `${fmtDerived(y, 2)}%`, // shares are often under 1%: two decimals
      o: x.o,
      formula: `${fmtDecimal(x.v)} ÷ ${fmtDecimal(t.v)} × 100`,
      inputs: [
        { o: x.o, p: x.p, v: x.v },
        { o: t.o, p: t.p, v: t.v },
      ],
      held: null,
      status: "derived",
    };
  });
}

/** Series that a transform cannot be applied to, and why (in words). */
export function excluded(sd: SeriesData, show: ShowAs, total: SeriesData | null): string | null {
  if (show === "printed") return null;
  if (show !== "share" && sd.u === "percent") return "it is already a rate in per cent; an index or a percentage change of a rate would mislead";
  if (show === "share") {
    if (sd.u !== "PKR" && sd.u !== "persons") return "it is not an amount, so it cannot be a share of a total";
    if (!total) return "no total is chosen";
    if (total.u !== sd.u || total.sf !== sd.sf) return `it is in ${sd.uw} and the total, ${total.n}, is in ${total.uw}`;
    if (total.f !== sd.f) return "its periods do not line up with the total's";
  }
  return null;
}

/** Why the chosen series are not comparable, as short clauses. Empty when nothing needs saying. */
export function notComparable(list: SeriesData[], kinds: Map<string, string>, show: ShowAs): string[] {
  const out: string[] = [];
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  if (list.length < 2) return out;
  if (show === "printed" && uniq(list.map((s) => `${s.u}|${s.sf}`)).length > 1) out.push("they are in different units, so each unit has its own chart");
  if (uniq(list.map((s) => s.f)).length > 1) out.push("they are at different frequencies (a fiscal year, a month or a survey round), so a period on one is not a period on another");
  const defs = uniq(list.map((s) => s.def).filter((x): x is string => !!x));
  if (defs.length > 1) out.push(`they use different labour-force definitions (${defs.join(" and ")})`);
  const bases = uniq(list.map((s) => s.base).filter((x): x is string => !!x));
  if (bases.length > 1) out.push(`they are on different index base years (${bases.join(" and ")})`);
  const ks = uniq(list.map((s) => kinds.get(s.id) ?? ""));
  if (ks.length > 1) out.push("they show different kinds of figure");
  return out;
}

/** Default base period for an index: the earliest period at which every series has a checked figure, else the first series' first. */
export function defaultBase(list: { sd: SeriesData; pts: Pt[] }[]): string | null {
  if (!list.length) return null;
  const sets = list.map((l) => new Set(l.pts.filter((x) => x.d === 1).map((x) => x.p)));
  const common = [...sets[0]].filter((p) => sets.every((s) => s.has(p))).sort();
  // Never index across a break by default: start at or after the latest break of any series.
  const lastBreak = list.flatMap((l) => l.sd.br.map((b) => b.p)).sort().at(-1);
  const after = lastBreak ? common.filter((p) => p >= lastBreak) : common;
  if (after.length) return after[0];
  if (common.length) return common[0];
  return list[0].pts.find((x) => x.d === 1)?.p ?? null;
}

/** "Rs 150 bn", "12.5%", "112": axis labels only, never a figure. */
export function tickText(v: number, show: ShowAs, unit: string, scale: number): string {
  if (show === "change") return `${v > 0 ? "+" : v < 0 ? "−" : ""}${String(Math.abs(Number(v.toPrecision(6))))}%`;
  if (show === "share") return `${String(Number(v.toPrecision(6)))}%`;
  if (show === "index") return String(Number(v.toPrecision(6)));
  if (unit === "PKR") {
    const full = v * scale;
    const a = Math.abs(full);
    const s = full < 0 ? "−" : "";
    const f = (n: number) => String(Number(n.toPrecision(3)));
    if (a >= 1e12) return `${s}Rs ${f(a / 1e12)} tn`;
    if (a >= 1e9) return `${s}Rs ${f(a / 1e9)} bn`;
    if (a >= 1e6) return `${s}Rs ${f(a / 1e6)} m`;
    return a === 0 ? "0" : `${s}Rs ${a.toLocaleString("en-US")}`;
  }
  if (unit === "persons" && scale >= 1e6) return `${String(Number((v * scale / 1e6).toPrecision(4)))} m`;
  if (unit === "percent") return `${String(Number(v.toPrecision(6)))}%`;
  return String(Number(v.toPrecision(6)));
}

function niceStep(raw: number) {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag;
}

/** Axis ticks covering [min, max], about `target` of them. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
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

/** CSV text from rows of strings (RFC 4180 quoting). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
