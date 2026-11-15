// Display helpers. Values are decimal strings and stay strings for display:
// thousands separators are inserted by string manipulation, never parseFloat.

export function formatDecimalString(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  const m = /^([+-]?)(\d+)(\.\d+)?$/.exec(s);
  if (!m) return s; // not a plain decimal: show exactly as stored
  const sign = m[1] === "-" ? "−" : "";
  const int = m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${int}${m[3] ?? ""}`;
}

const SCALE_WORDS: Record<string, string> = {
  "1": "",
  "1000": "thousand",
  "100000": "lakh",
  "1000000": "million",
  "10000000": "crore",
  "1000000000": "billion",
};

/** e.g. ("PKR", 1000000) -> "Rs million". */
export function unitLabel(unit: string | null | undefined, scale: number | null | undefined): string {
  const scaleWord = SCALE_WORDS[String(scale ?? 1)] ?? (scale && scale !== 1 ? `× ${formatDecimalString(String(scale))}` : "");
  switch (unit) {
    case "PKR":
      return scaleWord ? `Rs ${scaleWord}` : "Rs";
    case "percent":
      return "per cent";
    case "index":
      return "index points";
    case "persons":
      return scaleWord ? `${scaleWord} persons` : "persons";
    default:
      return [scaleWord, unit ?? ""].filter(Boolean).join(" ");
  }
}

/** e.g. "7,283 (Rs million)". */
export function valueWithUnit(value: string | null, unit: string | null | undefined, scale: number | null | undefined): string {
  return `${formatDecimalString(value)} (${unitLabel(unit, scale)})`;
}

const VINTAGE_WORDS: Record<string, string> = {
  be: "Budget estimate",
  re: "Revised estimate",
  na: "Not applicable",
  actual: "Actual",
  ac: "Actual",
  provisional: "Provisional",
  pe: "Provisional estimate",
  final: "Final",
  rebased: "Rebased",
};

export function vintageWords(v: string | null | undefined): string {
  if (!v) return "Not stated";
  return VINTAGE_WORDS[v] ?? v.toUpperCase();
}

export function vintageLong(v: string | null | undefined): string {
  if (v === "na") return "The value as printed (this kind of figure has no budget, revised or actual stage)";
  if (v === "be") return "Budget estimate: the amount planned when the budget was presented";
  if (v === "re") return "Revised estimate: the government's updated figure, printed in the following year's budget";
  return vintageWords(v);
}

export const GAP_WORDS: Record<string, string> = {
  not_in_source: "Not published by the government",
  not_yet_verified: "Not yet verified by us",
  failed_checks: "We could not verify this figure; it is withheld",
};

export const GAP_EXPLAIN: Record<string, string> = {
  not_in_source:
    "The government document prints no number for this figure (a dash or a blank), so there is no value here. We do not read a dash as zero.",
  not_yet_verified:
    "The figure may exist in the government document, but we have not yet read and checked it. Until it passes our checks we show a gap, not a number.",
  failed_checks:
    "We read a figure from the document, but it did not pass our checks and nothing independent tells us which number is wrong. We withhold it and do not guess.",
};

export function gapWords(kind: string | null | undefined): string {
  if (!kind) return "No value in this release";
  return GAP_WORDS[kind] ?? `No value (${kind.replaceAll("_", " ")})`;
}

export const CHECKED_HELP =
  "Checked: we read this figure from the government page and it passed at least one deterministic check, such as adding up to a printed total or matching the same figure printed elsewhere. It is not a guarantee that the figure is free of error.";

const STATUS_WORDS: Record<string, string> = {
  checked: "Checked",
  unchecked: "Not checked",
  disputed: "Disputed",
};
export const statusWords = (s: string) => STATUS_WORDS[s] ?? s;

export const TIER_WORDS: Record<string, string> = {
  A: "Tier A, verified: an arithmetic check passed and the same figure was found in a second official printing.",
  B: "Tier B, corroborated: either an arithmetic check passed, or the same figure was found in a second official printing (one of the two, not both).",
  C: "Tier C, single source: no check covers this figure yet, so it is not published.",
  D: "Tier D, quarantined: a check failed or the table looked damaged, so the figure is withheld.",
  E: "Tier E: not assessed.",
};

export const CHECK_RESULT_WORDS: Record<string, string> = {
  pass: "Pass",
  pass_within_rounding: "Pass, within rounding",
  fail: "Fail",
  not_evaluable: "Could not run",
};

export const CHECK_TYPE_WORDS: Record<string, string> = {
  column_total: "Column total",
  row_total: "Row total",
  hierarchy_sum: "Parts add to the whole",
  cross_edition: "Same figure in another edition",
  cross_table: "Same figure in another table",
  accounting_identity: "Accounting identity",
  cross_source: "Same figure in another official source",
  recompute: "Recomputed",
  weights_sum: "Weights add up",
  index_aggregation: "Index aggregation",
  reference_value: "Matches a recorded reference value",
};

export const VERIFICATION_WORDS: Record<string, { text: string; caveat: boolean }> = {
  official_match_archive: {
    text: "Downloaded from the official government website. The file is identical, byte for byte, to an independently archived copy.",
    caveat: false,
  },
  official_only: {
    text: "Downloaded from the official government website. No independent archived copy was available to compare it with.",
    caveat: false,
  },
  official_differs_from_archive: {
    text: "Downloaded from the official government website. It differs from an older archived copy, which suggests the file was reissued. We use the official download.",
    caveat: false,
  },
  wayback_only: {
    text: "Caveat: the official link did not work, so this file comes from an Internet Archive (Wayback Machine) snapshot of the official page.",
    caveat: true,
  },
  archive_copy_content_inspected: {
    text: "Caveat: the official link and the Internet Archive both failed. This file comes from a research archive copy; its contents were inspected by code but it could not be compared with an official download.",
    caveat: true,
  },
};

export function verificationWords(status: string | null | undefined): { text: string; caveat: boolean } {
  if (status && VERIFICATION_WORDS[status]) return VERIFICATION_WORDS[status];
  return {
    text: `Caveat: verification status "${(status ?? "unknown").replaceAll("_", " ")}". Treat this source with care.`,
    caveat: true,
  };
}

export const DOC_TYPE_WORDS: Record<string, string> = {
  abs: "Annual Budget Statement",
  cpi_monthly_review: "Monthly Review of Price Indices",
  lfs_annual_report: "Labour Force Survey annual report",
  pes_chapter: "Pakistan Economic Survey chapter",
  sbp_easydata: "State Bank of Pakistan EasyData",
};

export const ROLE_WORDS: Record<string, string> = {
  core: "Core source: values are read from this document.",
  corroboration: "Corroboration: used to confirm figures printed in other editions.",
  cross_source: "Cross-source: a different publication used to confirm figures.",
};

/** Ratio (0..1) -> "97.3%". Used only for rates stored in the release, never for data values. */
export function pct(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "not available";
  const v = ratio * 100;
  return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}%`;
}

export function count(n: number | null | undefined): string {
  return n === null || n === undefined ? "0" : formatDecimalString(String(n));
}

export function dateOnly(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "not recorded";
}

export function bytes(n: number | null | undefined): string {
  if (!n && n !== 0) return "not recorded";
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB (${formatDecimalString(String(n))} bytes)`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB (${formatDecimalString(String(n))} bytes)`;
  return `${formatDecimalString(String(n))} bytes`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-06" -> "June 2026" for monthly series. Fiscal years ("2025-26") and
 * survey rounds stay as printed. "2010-11" is a fiscal year or November 2010
 * depending on the series, so the frequency decides, never the string. */
export function periodWords(period: string | null | undefined, frequency?: string | null): string {
  if (!period) return "";
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (frequency === "month" && m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  return period;
}

/** Short month label for axes: "Jun 2026". */
export function periodShort(period: string, frequency?: string | null): string {
  const w = periodWords(period, frequency);
  return w === period ? period : `${w.slice(0, 3)} ${w.slice(-4)}`;
}

/** Full amount in words for a value in a scaled unit, for axes and summaries
 * only (never the published figure itself): (31975, "PKR", 1e6) -> "Rs 32.0 billion". */
export function humanAmount(value: number, unit: string | null | undefined, scale: number | null | undefined): string {
  const full = value * (scale ?? 1);
  if (unit !== "PKR") return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const abs = Math.abs(full);
  const sign = full < 0 ? "−" : "";
  const fmt = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.0+$/, "");
  if (abs >= 1e12) return `${sign}Rs ${fmt(abs / 1e12)} trillion`;
  if (abs >= 1e9) return `${sign}Rs ${fmt(abs / 1e9)} billion`;
  if (abs >= 1e6) return `${sign}Rs ${fmt(abs / 1e6)} million`;
  return `${sign}Rs ${abs.toLocaleString("en-US")}`;
}

/** The figure with its unit in words: "Rs 31,975 million", "293.47 index points", "12.3 per cent". */
export function figureWords(value: string | null | undefined, unit: string | null | undefined, scale: number | null | undefined): string {
  const v = formatDecimalString(value);
  const u = unitLabel(unit, scale);
  if (unit === "PKR") return u === "Rs" ? `Rs ${v}` : `Rs ${v} ${u.replace(/^Rs /, "")}`;
  if (unit === "percent") return `${v} per cent`;
  return u ? `${v} ${u}` : v;
}

const DATASET_UNIT_HINT: Record<string, string> = { index: "index", percent: "%", PKR: "Rs" };
export const unitShort = (unit: string | null | undefined) => (unit ? (DATASET_UNIT_HINT[unit] ?? unit) : "");

/* ---------- the one rounding rule for derived figures ---------- */
// DECISIONS.md (round 2, Ali to confirm): every derived percentage and every
// derived percentage-point change (changes, budget-to-revised revisions,
// shares, indexes, average revisions) is shown to one decimal place; a figure
// whose magnitude is below 1 to two decimal places, so a small share never
// reads as 0.0; and a figure that is not zero but would still read 0.00 to the
// first digit that is not zero (one significant figure), so it never reads as
// zero. Rounding is half away from zero on the exact value (BigInt, never
// floating point). Printed figures are never re-rounded, and downloaded files
// keep full precision. Every page, the JSON the browser draws and the check
// plug-ins (each with its own implementation) follow this one rule.

const B0 = BigInt(0);
const B1 = BigInt(1);
const B2 = BigInt(2);
const B10 = BigInt(10);
const B100 = BigInt(100);

/** a / b to the nearest integer, halves away from zero; a >= 0, b > 0. */
function nearest(a: bigint, b: bigint): bigint {
  return (a * B2 + b) / (b * B2);
}

/** A non-negative integer of units of 10^-dp as a decimal string: (171, 1) -> "17.1". */
function scaled(n: bigint, dp: number): string {
  const s = n.toString().padStart(dp + 1, "0");
  return dp ? `${s.slice(0, s.length - dp)}.${s.slice(s.length - dp)}` : s;
}

/**
 * The rule, on the exact figure num / den (already in per cent or percentage
 * points): "17.1", "-0.42", "0.00", "0.001". A plain decimal string with an
 * ASCII minus, for JSON and for derivedDisplay. Throws if den is zero.
 */
export function roundDerived(num: bigint, den: bigint): string {
  if (den === B0) throw new Error("roundDerived: division by zero");
  if (den < B0) {
    num = -num;
    den = -den;
  }
  if (num === B0) return "0.00";
  const neg = num < B0;
  const a = neg ? -num : num;
  const sign = neg ? "-" : "";
  const hundredths = nearest(a * B100, den);
  if (hundredths >= B100) return sign + scaled(nearest(a * B10, den), 1);
  if (hundredths > B0) return sign + scaled(hundredths, 2);
  // Not zero, but under 0.005: to its first significant digit.
  let k = 3;
  let p = BigInt(1000);
  while (a * p < den) {
    k++;
    p *= B10;
  }
  let d = nearest(a * p, den);
  if (d === B10) {
    d = B1;
    k--;
  }
  return sign + scaled(d, k);
}

/** A stored decimal string as an exact fraction [numerator, denominator]; null if it is not a plain decimal. */
export function decimalFraction(v: string): [bigint, bigint] | null {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(v).trim());
  if (!m) return null;
  const frac = m[3] ?? "";
  const n = BigInt(m[2] + frac);
  return [m[1] === "-" ? -n : n, B10 ** BigInt(frac.length)];
}

/**
 * A rounded derived figure as the reader sees it: thousands separators, the
 * true minus sign, and with `signed` (a change, never a share) a plus sign on a
 * figure above zero. "+17.1", "−0.42", "0.00", "1,234.5". Add the unit ("%",
 * " percentage points") after it.
 */
export function derivedDisplay(v: string, signed: boolean): string {
  const neg = v.startsWith("-");
  const abs = v.replace(/^[+-]/, "");
  const [i, f] = abs.split(".");
  const body = `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${f !== undefined ? `.${f}` : ""}`;
  if (/^0*(\.0*)?$/.test(abs)) return body;
  return `${neg ? "−" : signed ? "+" : ""}${body}`;
}
