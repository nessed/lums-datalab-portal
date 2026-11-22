// Words on the page (DESIGN.md section 6), in one place. Reader statuses,
// kinds of figure and the short-scale headline format. Pages import from here;
// adapters map their own vocabulary onto these keys.
import type { KindKey, ReaderStatus, ReaderStatusKey } from "./adapter/contract";

/* ---------- statuses (6.1) ---------- */

type StatusWords = { word: string; reason: string; showsValue: boolean; usableInDerived: boolean };

export const READER_STATUS: Record<ReaderStatusKey, StatusWords> = {
  checked: { word: "", reason: "Checked against the government page and at least one independent check.", showsValue: true, usableInDerived: true },
  "checked-note": { word: "note", reason: "Checked. The document attaches a note to this figure; the receipt quotes it.", showsValue: true, usableInDerived: true },
  candidate: {
    word: "not signed off",
    reason: "A person has not yet approved the dataset this figure belongs to.",
    showsValue: true,
    usableInDerived: false,
  },
  revised: { word: "revised", reason: "A later printing replaced this figure.", showsValue: true, usableInDerived: true },
  disputed: {
    word: "disputed",
    reason: "Two official documents print different figures for the same line and year, and each adds up in its own table.",
    showsValue: false,
    usableInDerived: false,
  },
  held: {
    word: "held back",
    reason: "This figure did not pass its checks, and nothing independent says which number is wrong, so we do not show it.",
    showsValue: false,
    usableInDerived: false,
  },
  "not-checked": {
    word: "not checked yet",
    reason: "We have read this figure but no check covers it yet, so we do not show it.",
    showsValue: false,
    usableInDerived: false,
  },
  "not-printed": {
    word: "not printed",
    reason: "The document prints a dash or a blank here, not a number. We do not read a dash as zero.",
    showsValue: false,
    usableInDerived: false,
  },
  "dash-or-zero": {
    word: "dash or zero",
    reason: "Printed as a dash or a zero; this release does not say which, so no number is shown and it is never used in a sum.",
    showsValue: false,
    usableInDerived: false,
  },
  unknown: { word: "no value", reason: "This release uses a status this site does not describe yet. No value is shown.", showsValue: false, usableInDerived: false },
};

export function readerStatus(key: ReaderStatusKey, reason?: string | null): ReaderStatus {
  const w = READER_STATUS[key];
  return { key, word: w.word, reason: reason?.trim() || w.reason, showsValue: w.showsValue, usableInDerived: w.usableInDerived };
}

/** Marks a legend may list, in order. Checked is the default and is never marked. */
export const MARKED_STATUSES: ReaderStatusKey[] = ["checked-note", "candidate", "revised", "disputed", "held", "not-checked", "not-printed", "dash-or-zero", "unknown"];

/* ---------- kinds of figure (6.2) ---------- */

type KindWords = { long: string; short: string; explain: string; estimate: boolean };

export const KIND: Record<KindKey, KindWords> = {
  be: { long: "budget estimate", short: "BE", explain: "The amount planned when the budget was presented.", estimate: true },
  re: { long: "revised estimate", short: "RE", explain: "The government's updated figure for the year, printed in the following year's budget.", estimate: true },
  actual: { long: "actual", short: "Actual", explain: "Actual as printed in the Demands for Grants book (not the final audited outturn).", estimate: false },
  ac: { long: "accounts", short: "Accounts", explain: "Provincial accounts for a past year, not an audited actual.", estimate: false },
  provisional: { long: "provisional", short: "(P)", explain: "A provisional figure that may be revised.", estimate: true },
  final: { long: "final", short: "(F)", explain: "Printed as final in the Economic Survey.", estimate: false },
  es_revised: { long: "revised", short: "(R)", explain: "Printed as revised in the Economic Survey.", estimate: true },
  es_provisional: { long: "provisional", short: "(P)", explain: "Printed as provisional in the Economic Survey.", estimate: true },
  part_year: { long: "part of the year", short: "part-year", explain: "Covers only part of the year (for example July to March).", estimate: true },
  index: { long: "index", short: "index", explain: "A price index level.", estimate: false },
  change_yoy: { long: "change over a year", short: "y/y", explain: "Change over the same month a year earlier.", estimate: false },
  change_mom: { long: "change over a month", short: "m/m", explain: "Change over the previous month.", estimate: false },
  weight: { long: "weight", short: "weight", explain: "Weight in the price basket.", estimate: false },
  survey_round: { long: "survey round", short: "round", explain: "A survey round.", estimate: false },
  as_printed: { long: "as printed", short: "", explain: "The figure as printed; it has no budget, revised or actual stage.", estimate: false },
};

/** Fiscal stages are written before the period ("budget estimate 2026-27"); other kinds are not. */
export const STAGE_KINDS: KindKey[] = ["be", "re", "actual", "ac", "provisional", "final", "es_revised", "es_provisional", "part_year"];

/* ---------- short scale (6.3) ---------- */

const POW = [
  { exp: 12, word: "trillion" },
  { exp: 9, word: "billion" },
  { exp: 6, word: "million" },
];

/** Decimal string times a power of ten, as a decimal string (no floating point). */
function shiftDecimal(v: string, exp: number): { int: string; frac: string; neg: boolean } {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(v.trim());
  if (!m) throw new Error(`not a decimal: ${v}`);
  let digits = m[2] + (m[3] ?? "");
  let point = m[2].length + exp;
  if (point < 0) {
    digits = "0".repeat(-point) + digits;
    point = 0;
  }
  if (point > digits.length) digits = digits + "0".repeat(point - digits.length);
  const int = digits.slice(0, point).replace(/^0+(?=\d)/, "") || "0";
  return { int, frac: digits.slice(point), neg: m[1] === "-" };
}

/** Round a non-negative decimal (int, frac) to one decimal place, half up. */
function roundOne(int: string, frac: string): string {
  const f = (frac + "00").slice(0, 2);
  const TEN = BigInt(10);
  let tenths = BigInt(int) * TEN + BigInt(f[0]);
  if (Number(f[1]) >= 5) tenths += BigInt(1);
  const whole = tenths / TEN;
  const d = tenths % TEN;
  return d === BigInt(0) ? whole.toString() : `${whole}.${d}`;
}

/**
 * The headline form of a stored value (DESIGN.md 6.3): "Rs 37.4 billion",
 * "71.8 million persons", "6.9%", "312.6". A fixed rule from the stored decimal
 * string, never re-rounded elsewhere. scripts/check-build.mjs recomputes it.
 */
export function shortScale(value: string, unit: string | null | undefined, scale: number | null | undefined): string {
  if (unit === "PKR" || unit === "persons") {
    const sf = Number(scale ?? 1);
    const exp0 = Math.round(Math.log10(sf));
    if (10 ** exp0 !== sf) return value;
    const whole = shiftDecimal(value, exp0);
    const size = whole.int.length;
    const pick = POW.find((p) => size > p.exp) ?? null;
    let text: string;
    if (pick) {
      const s = shiftDecimal(`${whole.int}.${whole.frac || "0"}`, -pick.exp);
      text = `${roundOne(s.int, s.frac)} ${pick.word}`;
    } else {
      text = whole.int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    const sign = whole.neg ? "−" : "";
    return unit === "PKR" ? `${sign}Rs ${text}` : `${sign}${text} persons`;
  }
  const m = /^([+-]?)(\d+)(\.\d+)?$/.exec(value.trim());
  const plain = m ? `${m[1] === "-" ? "−" : ""}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${m[3] ?? ""}` : value;
  return unit === "percent" ? `${plain}%` : plain;
}

/**
 * A series break in plain words, read by every chart and sentence that names one (Chart via chart-model,
 * the series page, the series table, Compare). The release stores the break as a code ("nfc_award",
 * "rebase") with a printed note ("7th NFC Award: from 2010-11 ..."); the note stays in the tooltip and the
 * text beside the chart, these words are the label. A rebase is named by what was rebased, read from the
 * series id; a kind not listed here falls back to its code in words.
 */
const BREAK_WORDS: Record<string, string> = {
  nfc_award: "New tax-sharing award",
  devolution: "Functions moved to the provinces",
  check_comparability: "New survey sample",
};
export function breakWords(kind: string, seriesId: string): string {
  if (kind === "rebase") return /^(gdp|nad|na)\./.test(seriesId) ? "New GDP base" : seriesId.startsWith("cpi.") ? "New price base" : "New base year";
  const w = BREAK_WORDS[kind] ?? kind.replaceAll("_", " ");
  return w.charAt(0).toUpperCase() + w.slice(1);
}
