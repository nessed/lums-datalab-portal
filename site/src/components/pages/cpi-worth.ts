// The inflation calculator's one formula (2026-11-23), shared by the server
// (the default result in the HTML) and the browser (a reader's own amount):
//
//   worth = amount × index in the later month ÷ index in the earlier month
//
// in whole rupees, halves away from zero, with thousands separators. Exact
// decimal arithmetic in BigInt, never floating point, so the page and the
// browser can never round differently. scripts/checks/calc-inflation.mjs
// recomputes the server's figure independently and claims it
// (data-derived="cpi-worth"). Pure: no file access, safe in a client component.

const ZERO = BigInt(0);
const TEN = BigInt(10);

function pow10(k: number): bigint {
  let r = BigInt(1);
  for (let i = 0; i < k; i++) r *= TEN;
  return r;
}

/** A decimal string ("293.47") as an integer and a scale. Null if it is not a plain decimal. */
function dec(v: string): { n: bigint; s: number } | null {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(v.trim());
  if (!m) return null;
  const f = m[3] ?? "";
  const n = BigInt(m[2] + f);
  return { n: m[1] === "-" ? -n : n, s: f.length };
}

/** The most digits an amount may have (a trillion rupees and more is not a household sum). */
export const AMOUNT_MAX_DIGITS = 13;

/** A typed amount ("1,000", "25 000") as a whole number of rupees in digits, or null if it is not one. */
export function parseAmount(typed: string): string | null {
  const t = typed.replace(/[\s,]/g, "");
  if (!/^\d+$/.test(t)) return null;
  const d = t.replace(/^0+/, "");
  if (!d || d.length > AMOUNT_MAX_DIGITS) return null;
  return d;
}

/** Digits with thousands separators: "1000" -> "1,000". */
export function groupDigits(d: string): string {
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * amount × to ÷ from in whole rupees, halves away from zero, grouped ("2,222").
 * `amount` is a whole number of rupees in digits; `from` and `to` are the index
 * values as the release stores them. Null when an input is not usable (an index
 * at or below zero says nothing).
 */
export function worthText(amount: string, from: string, to: string): string | null {
  if (!/^\d+$/.test(amount)) return null;
  const a = dec(from);
  const b = dec(to);
  if (!a || !b || a.n <= ZERO || b.n < ZERO) return null;
  // to / from with both on one scale: (b.n / 10^b.s) / (a.n / 10^a.s)
  const num = BigInt(amount) * b.n * pow10(a.s);
  const den = a.n * pow10(b.s);
  let q = num / den;
  if ((num % den) * BigInt(2) >= den) q += BigInt(1);
  return groupDigits(q.toString());
}
