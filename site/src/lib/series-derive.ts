// Derived views of one series (DESIGN.md 6.1 "Gaps travel", 6.3, 8.2, 11
// "Units first"). Pure functions whose only import is the site's rounding rule
// (lib/format.ts, itself import-free), so the build, the browser and
// scripts/series-derive-test.mjs all run the same code.
//
// Rules, each enforced here and re-checked independently by
// scripts/checks/series-derived.mjs:
//   - a derived figure is computed only from figures whose reader status says
//     usableInDerived; otherwise it is a gap carrying that input's reason;
//   - like with like: a change compares the same kind of figure (a budget
//     estimate with the previous budget estimate, never with a revised one);
//   - never across a series break;
//   - exact decimal arithmetic on the stored strings (BigInt), rounded by the
//     site's one rule for derived figures (roundDerived in lib/format.ts: one
//     decimal, two below 1, half away from zero). A change in the series' own
//     unit is exact, except a change of a rate, which is in percentage points
//     and follows the rule.
import { decimalFraction, roundDerived } from "./format.ts";

/* ---------- exact decimals ---------- */

type Dec = { n: bigint; s: number };

function parseDec(v: string): Dec | null {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(v).trim());
  if (!m) return null;
  const frac = m[3] ?? "";
  const n = BigInt(m[2] + frac);
  return { n: m[1] === "-" ? -n : n, s: frac.length };
}

const TEN = BigInt(10);
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

function align(a: Dec, b: Dec): [bigint, bigint, number] {
  const s = Math.max(a.s, b.s);
  return [a.n * TEN ** BigInt(s - a.s), b.n * TEN ** BigInt(s - b.s), s];
}

function fmtScaled(n: bigint, s: number): string {
  const neg = n < ZERO;
  let digits = (neg ? -n : n).toString();
  if (s > 0) {
    digits = digits.padStart(s + 1, "0");
    digits = `${digits.slice(0, -s)}.${digits.slice(-s)}`;
  }
  return `${neg ? "-" : ""}${digits}`;
}

/** a - b, exactly, as a decimal string ("5463", "-0.50"). */
export function decSub(a: string, b: string): string | null {
  const x = parseDec(a);
  const y = parseDec(b);
  if (!x || !y) return null;
  const [p, q, s] = align(x, y);
  return fmtScaled(p - q, s);
}

/** num / den * 100 under the rounding rule. Null when den is zero or either is not a decimal. */
export function decPercent(num: string, den: string): string | null {
  const x = decimalFraction(num);
  const y = decimalFraction(den);
  if (!x || !y || y[0] === ZERO) return null;
  return roundDerived(x[0] * y[1] * HUNDRED, x[1] * y[0]);
}

/** (a - b) / b * 100 under the rounding rule. */
export function decPctChange(a: string, b: string): string | null {
  const d = decSub(a, b);
  if (d === null) return null;
  return decPercent(d, b);
}

/** An exact decimal (a change in percentage points) under the rounding rule. */
export function decRule(v: string): string | null {
  const x = decimalFraction(v);
  return x ? roundDerived(x[0], x[1]) : null;
}

/* ---------- periods ---------- */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function periodLabel(p: string, frequency: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (frequency === "month" && m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  return p;
}

/** The comparable earlier period: a year earlier for fiscal years and months; the previous round for surveys. */
export function previousPeriod(p: string, frequency: string, periods: string[]): string | null {
  if (frequency === "survey_round") {
    const earlier = periods.filter((x) => x < p).sort();
    return earlier.length ? earlier[earlier.length - 1] : null;
  }
  const mon = /^(\d{4})-(\d{2})$/.exec(p);
  if (frequency === "month" && mon) return `${Number(mon[1]) - 1}-${mon[2]}`;
  const fy = /^(\d{4})-(\d{2})$/.exec(p);
  if (fy) {
    const y = Number(fy[1]);
    return `${y - 1}-${String(y % 100).padStart(2, "0")}`;
  }
  const yr = /^(\d{4})$/.exec(p);
  if (yr) return String(Number(yr[1]) - 1);
  return null;
}

/** The break that falls after `earlier` and on or before `later`, if any. */
export function breakBetween<B extends { at_period: string }>(earlier: string, later: string, breaks: B[]): B | null {
  const [lo, hi] = earlier < later ? [earlier, later] : [later, earlier];
  return breaks.find((b) => b.at_period > lo && b.at_period <= hi) ?? null;
}

/* ---------- inputs and outputs ---------- */

/** One figure as the derivation sees it. `value` is set only where the figure shows one. */
export type DInput = {
  id: string;
  period: string;
  /** The kind code of our release ("be", "re", "na"...). */
  kind: string;
  value: string | null;
  usable: boolean;
  /** The reader status word and reason ("held back", "...") and the visual status key. */
  word: string;
  reason: string;
  st: string;
};

export type DGap = "travel" | "none" | "break" | "zero";

export type DPoint = {
  p: string;
  k: string;
  /** The derived value as an unsigned-or-signed decimal string; null for a gap. */
  v: string | null;
  /** Input figure ids, the figure itself first. */
  in: string[];
  /** Input values (stored strings), only when every input is usable. */
  iv?: string[];
  gap?: DGap;
  /** Why there is no value, in words (no figures quoted). */
  why?: string;
  /** Visual status and id of the input that stopped it (travelled gaps only). */
  st?: string;
  bad?: string;
  /** Revision view: the exact difference in the series unit. */
  diff?: string;
};

export type DOp = "pct" | "chg" | "idx" | "share" | "rev";

export type DView = {
  id: string;
  op: DOp;
  base?: string;
  points: DPoint[];
};

export type DMeta = {
  frequency: string;
  unit: string;
  breaks: { at_period: string; kind: string }[];
  kindWords: Record<string, string>;
};

/** A derived value: per cent (pct, rev, share, idx) and changes of a rate (percentage points) under the rounding rule; other changes exact. */
function compute(op: DOp, a: string, b: string, unit: string): string | null {
  if (op === "chg") {
    const d = decSub(a, b);
    return d !== null && unit === "percent" ? decRule(d) : d;
  }
  if (op === "pct" || op === "rev") return decPctChange(a, b);
  return decPercent(a, b);
}

function kw(meta: DMeta, k: string): string {
  return meta.kindWords[k] ?? "figure";
}

/** One derived point from its inputs (the figure itself first), with the gap rules. */
export function derivePoint(op: DOp, meta: DMeta, a: DInput, b: DInput | undefined, missing: string, breakAt?: { at_period: string; kind: string } | null): DPoint {
  const ids = b ? [a.id, b.id] : [a.id];
  const base: DPoint = { p: a.period, k: a.kind, v: null, in: ids };
  for (const x of b ? [a, b] : [a]) {
    if (!x.usable || x.value === null) {
      return { ...base, gap: "travel", st: x.st, bad: x.id, why: `The ${kw(meta, x.kind)} for ${periodLabel(x.period, meta.frequency)} is ${x.word || "not usable"}. ${x.reason}` };
    }
  }
  if (!b) return { ...base, gap: "none", why: missing };
  if (breakAt) return { ...base, gap: "break", why: `Not compared across the series break (${breakAt.kind.replaceAll("_", " ")}) at ${periodLabel(breakAt.at_period, meta.frequency)}.` };
  const v = compute(op, a.value!, b.value!, meta.unit);
  if (v === null) return { ...base, gap: "zero", why: "The figure it is compared with is zero, so no percentage can be computed." };
  const out: DPoint = { ...base, v, iv: [a.value!, b.value!] };
  if (op === "rev") out.diff = decSub(a.value!, b.value!) ?? undefined;
  return out;
}

const byPeriod = (xs: DInput[]) => [...xs].sort((x, y) => x.period.localeCompare(y.period) || x.kind.localeCompare(y.kind));

/** % change (or change) from the comparable earlier figure of the same kind. */
export function changeView(op: "pct" | "chg", meta: DMeta, recs: DInput[]): DView {
  const periods = [...new Set(recs.map((r) => r.period))].sort();
  const at = new Map(recs.map((r) => [`${r.period}|${r.kind}`, r]));
  const points: DPoint[] = [];
  for (const a of byPeriod(recs)) {
    const pp = previousPeriod(a.period, meta.frequency, periods);
    const b = pp ? at.get(`${pp}|${a.kind}`) : undefined;
    const br = pp && b ? breakBetween(pp, a.period, meta.breaks) : null;
    // The earlier period is named only when the release holds it (check-build allows
    // only periods of the release); otherwise "the period before".
    const missing = pp
      ? `No ${kw(meta, a.kind)} for ${periods.includes(pp) ? periodLabel(pp, meta.frequency) : "the period before"} in this release to compare with.`
      : "This is the first figure of the series.";
    points.push(derivePoint(op, meta, a, b, missing, br));
  }
  return { id: op, op, points };
}

/** Index, chosen period = 100, per kind of figure (each kind against its own figure in the base period). */
export function indexView(meta: DMeta, recs: DInput[], basePeriod: string): DView {
  const at = new Map(recs.map((r) => [`${r.period}|${r.kind}`, r]));
  const points: DPoint[] = [];
  for (const a of byPeriod(recs)) {
    const b = at.get(`${basePeriod}|${a.kind}`);
    const br = b ? breakBetween(basePeriod, a.period, meta.breaks) : null;
    points.push(derivePoint("idx", meta, a, b, `No ${kw(meta, a.kind)} for the base period ${periodLabel(basePeriod, meta.frequency)}.`, br));
  }
  return { id: `idx:${basePeriod}`, op: "idx", base: basePeriod, points };
}

/** Share of the parent total: same period, same kind. */
export function shareView(meta: DMeta, recs: DInput[], parent: DInput[], parentName: string): DView {
  const at = new Map(parent.map((r) => [`${r.period}|${r.kind}`, r]));
  const points = byPeriod(recs).map((a) =>
    derivePoint("share", meta, a, at.get(`${a.period}|${a.kind}`), `No ${kw(meta, a.kind)} of ${parentName} for ${periodLabel(a.period, meta.frequency)} in this release.`),
  );
  return { id: "share", op: "share", points };
}

/** Change from budget estimate to revised estimate, per year, as a percentage of the budget estimate. */
export function revisionView(meta: DMeta, recs: DInput[]): DView {
  const be = new Map(recs.filter((r) => r.kind === "be").map((r) => [r.period, r]));
  const re = new Map(recs.filter((r) => r.kind === "re").map((r) => [r.period, r]));
  const periods = [...new Set([...be.keys(), ...re.keys()])].sort();
  const points: DPoint[] = [];
  for (const p of periods) {
    const r = re.get(p);
    const b = be.get(p);
    if (r) points.push({ ...derivePoint("rev", meta, r, b, `No budget estimate for ${periodLabel(p, meta.frequency)} in this release.`), k: "rev" });
    else if (b) {
      const pt = derivePoint("rev", meta, b, undefined, `No revised estimate for ${periodLabel(p, meta.frequency)} in this release yet.`);
      points.push({ ...pt, k: "rev", in: [b.id] });
    }
  }
  return { id: "rev", op: "rev", points };
}

/* ---------- best available figure per year (DESIGN.md 5.3, 8.2) ---------- */

/** Ahmad's series rule: actual or accounts, else revised, else budget estimate. */
export const KIND_RANK: Record<string, number> = { actual: 5, ac: 5, final: 4, re: 3, es_revised: 3, provisional: 2, es_provisional: 2, be: 1 };

/** Per period: the most final kind that shows a value, and the most final kind recorded at all. */
export function bestPerPeriod<T extends { period: string; vintage: string; published: boolean; value: string | null }>(recs: T[]): { period: string; best: T | null; top: T }[] {
  const by = new Map<string, T[]>();
  for (const r of recs) by.set(r.period, [...(by.get(r.period) ?? []), r]);
  const rank = (r: T) => KIND_RANK[r.vintage] ?? 0;
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, rs]) => {
      const sorted = [...rs].sort((a, b) => rank(b) - rank(a));
      return { period, top: sorted[0], best: sorted.find((r) => r.published && r.value !== null) ?? null };
    });
}
