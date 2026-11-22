// Derived values for the home, topic and answer pages (DESIGN.md 6.1 "Gaps
// travel", 6.3, 8.2): changes against a comparable figure and the average
// revision from budget to revised estimate. Computed at build time, exactly
// (decimal strings and BigInt, never floating point), rounded by the site's one
// rule for derived figures (roundDerived in lib/format.ts), and only from figures
// whose reader status says usableInDerived. Every result names its formula and
// its inputs; scripts/checks/home-derived.mjs recomputes each one from the
// release files, independently of this code, and fails the build if a page
// shows a different text or used an input that is not checked.
import type { Observation, Series } from "@/lib/data";
import { derivedDisplay, roundDerived } from "@/lib/format";
import type { KindKey } from "@/lib/adapter/contract";

export type DerivedFormula = "pct" | "pp" | "mean-rev" | "mean-abs-rev" | "n-pairs" | "share";
export type DerivedFmt = "words" | "signed" | "plain";

/** A derived figure ready to print: its text, how it was made, and from what. */
export type Derived = { formula: DerivedFormula; fmt: DerivedFmt; text: string; inputs: Observation[] };

/** A figure that may feed a derived value: shown, checked and signed off (rule 3 of the agent brief; decision 17.1). */
export function usable(o: Observation | undefined | null): o is Observation & { value: string } {
  return !!o && o.published && o.value !== null && o.reader.usableInDerived && o.reader.key !== "candidate" && o.signoff !== "candidate";
}

/** A figure that may appear on the home page, an answer page or a headline card: shown, and not a candidate (decision 17.1). */
export function showable(o: Observation | undefined | null): o is Observation & { value: string } {
  return !!o && o.published && o.value !== null && o.reader.showsValue && o.reader.key !== "candidate" && o.signoff !== "candidate";
}

/* ---------- exact decimals ---------- */

const TEN = BigInt(10);
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

type Dec = { n: bigint; s: number };

function dec(v: string): Dec {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(v.trim());
  if (!m) throw new Error(`derive: not a decimal: ${v}`);
  const frac = m[3] ?? "";
  const n = BigInt(m[2] + frac);
  return { n: m[1] === "-" ? -n : n, s: frac.length };
}

function pow10(k: number): bigint {
  let r = BigInt(1);
  for (let i = 0; i < k; i++) r *= TEN;
  return r;
}

/** Two decimals on a common scale. */
function align(a: Dec, b: Dec): [bigint, bigint, number] {
  const s = Math.max(a.s, b.s);
  return [a.n * pow10(s - a.s), b.n * pow10(s - b.s), s];
}

const abs = (x: bigint) => (x < ZERO ? -x : x);

/** A ratio num/den as a percentage, under the site's rounding rule (roundDerived): "17.1%", "0.42%". */
function pctText(num: bigint, den: bigint): { mag: string; sign: number } {
  const mag = `${derivedDisplay(roundDerived(abs(num) * HUNDRED, abs(den)), false)}%`;
  const sign = num === ZERO ? 0 : (num < ZERO) !== (den < ZERO) ? -1 : 1;
  return { mag, sign };
}

/** An exact difference n / 10^s in percentage points, under the rounding rule, unsigned: "7.8", "0.42". */
function ppText(n: bigint, s: number): string {
  return derivedDisplay(roundDerived(abs(n), pow10(s)), false);
}

function signed(mag: string, sign: number, fmt: DerivedFmt, unitWords = ""): string {
  if (fmt === "plain") return `${mag}${unitWords}`;
  if (fmt === "signed") return sign === 0 ? `${mag}${unitWords}` : `${sign < 0 ? "−" : "+"}${mag}${unitWords}`;
  return sign === 0 ? "unchanged" : `${sign < 0 ? "down" : "up"} ${mag}${unitWords}`;
}

/* ---------- formulas ---------- */

/** The change from `from` to `to`: percentage points for rates, per cent for everything else. Null if either input may not be used. */
export function change(from: Observation | undefined, to: Observation | undefined, fmt: DerivedFmt = "words"): Derived | null {
  if (!usable(from) || !usable(to)) return null;
  if (from.unit === "percent") {
    const [a, b, s] = align(dec(from.value!), dec(to.value!));
    const d = b - a;
    const sign = d === ZERO ? 0 : d < ZERO ? -1 : 1;
    const text = signed(ppText(d, s), sign, fmt, " percentage points");
    return { formula: "pp", fmt, text: sign === 0 && fmt === "words" ? "unchanged" : text, inputs: [from, to] };
  }
  const [a, b] = align(dec(from.value!), dec(to.value!));
  if (a <= ZERO) return null; // a change from zero or a negative base says nothing in per cent
  const { mag, sign } = pctText(b - a, a);
  return { formula: "pct", fmt, text: signed(mag, sign, fmt), inputs: [from, to] };
}

export type RevisionPair = { be: Observation; re: Observation };

/** Budget estimate and revised estimate of the same year, both usable, with a positive budget estimate. */
export function revisionPairs(obs: Observation[]): RevisionPair[] {
  const out: RevisionPair[] = [];
  const be = new Map(obs.filter((o) => o.vintage === "be").map((o) => [o.period, o]));
  for (const re of obs.filter((o) => o.vintage === "re")) {
    const b = be.get(re.period);
    if (usable(b) && usable(re) && dec(b.value!).n > ZERO) out.push({ be: b, re });
  }
  return out.sort((x, y) => x.be.period.localeCompare(y.be.period));
}

/** Average revision (signed) and average absolute revision, BE to RE, over the pairs. */
export function revisionStats(pairs: RevisionPair[]): { mean: Derived; meanAbs: Derived; n: Derived } | null {
  if (pairs.length === 0) return null;
  // Sum of fractions (re - be) / be, kept exact.
  let num = ZERO;
  let numAbs = ZERO;
  let den = BigInt(1);
  for (const { be, re } of pairs) {
    const [a, b] = align(dec(be.value!), dec(re.value!));
    const d = b - a;
    num = num * a + d * den;
    numAbs = numAbs * a + abs(d) * den;
    den = den * a;
  }
  const n = BigInt(pairs.length);
  const inputs = pairs.flatMap((p) => [p.be, p.re]);
  const m = pctText(num, den * n);
  const ma = pctText(numAbs, den * n);
  return {
    mean: { formula: "mean-rev", fmt: "signed", text: signed(m.mag, m.sign, "signed"), inputs },
    meanAbs: { formula: "mean-abs-rev", fmt: "plain", text: ma.mag, inputs },
    n: { formula: "n-pairs", fmt: "plain", text: String(pairs.length), inputs },
  };
}

/** A part as a share of its total (data hub stories): part / total in per cent, unsigned. Only where a check that the parts add up to the total passed; the caller names that check, and scripts/checks/home-stories.mjs recomputes it. */
export function share(part: Observation | undefined, total: Observation | undefined): Derived | null {
  if (!usable(part) || !usable(total)) return null;
  if (part.series_id === total.series_id || part.period !== total.period || part.vintage !== total.vintage) return null;
  const [a, b] = align(dec(part.value!), dec(total.value!));
  if (a < ZERO || b <= ZERO) return null;
  return { formula: "share", fmt: "plain", text: pctText(a, b).mag, inputs: [part, total] };
}

/* ---------- comparable figures ---------- */

export type Comparison =
  | { kind: "change"; base: Observation; derived: Derived }
  | { kind: "break"; base: Observation; note: string; at: string }
  | { kind: "not-usable"; base: Observation; reason: string }
  | { kind: "none" };

/** Same series, same kind of figure, earlier period (and for monthly series the same month): like with like (DESIGN.md 9.4). */
export function comparable(series: Series, o: Observation, all: Observation[]): Observation | undefined {
  const sameMonth = series.frequency === "month" ? o.period.slice(4) : null;
  return all
    .filter((x) => x.vintage === o.vintage && x.period < o.period && x.reader.key !== "candidate" && (!sameMonth || x.period.slice(4) === sameMonth))
    .sort((a, b) => b.period.localeCompare(a.period))[0];
}

/** The change against the comparable figure, or why there is none. A break between the two periods stops the comparison. */
export function compare(series: Series, o: Observation, all: Observation[], fmt: DerivedFmt = "words"): Comparison {
  const base = comparable(series, o, all);
  if (!base) return { kind: "none" };
  const brk = series.breaks.find((b) => base.period < b.at_period && b.at_period <= o.period);
  if (brk) return { kind: "break", base, note: brk.note, at: brk.at_period };
  const d = change(base, o, fmt);
  if (!d) return { kind: "not-usable", base, reason: usable(o) ? base.reader.reason : o.reader.reason };
  return { kind: "change", base, derived: d };
}

/* ---------- picking the figure to show ---------- */

/** Figures of one kind of a series, oldest first, candidates left out. */
export function ofKind(all: Observation[], kind: KindKey | string): Observation[] {
  return all.filter((o) => (o.kind === kind || o.vintage === kind) && o.reader.key !== "candidate").sort((a, b) => a.period.localeCompare(b.period));
}

/** The latest showable figure of a kind, and the newer figures of that kind that are not shown (with their reasons). */
export function latestShown(all: Observation[], kind: KindKey | string): { latest?: Observation; newer: Observation[] } {
  const list = ofKind(all, kind);
  const shown = list.filter(showable);
  const latest = shown[shown.length - 1];
  const newer = latest ? list.filter((o) => o.period > latest.period) : list;
  return { latest, newer };
}

/** The latest year with both a budget and a revised estimate in the release (shown or not). */
export function latestRevision(all: Observation[]): { be?: Observation; re: Observation } | null {
  const re = ofKind(all, "re");
  const last = re[re.length - 1];
  if (!last) return null;
  return { be: ofKind(all, "be").find((o) => o.period === last.period), re: last };
}
