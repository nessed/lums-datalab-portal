// Every digit the site shows is wrapped in one of these, so that
// scripts/check-build.mjs can prove where it came from:
//   <V>       a checked value: always a link to its receipt (data-v)
//   <Count>   a count or rate: recomputed from the release by check-build (data-count)
//   <Num>     anything else with digits: a period, a date, a page number, an id,
//             an axis tick, a printed reading on a receipt (data-num="kind")
// A digit outside all three fails the build check.
import Link from "next/link";
import type { ReactNode } from "react";
import { obsHref, type Observation } from "@/lib/data";
import { count, formatDecimalString, pct } from "@/lib/format";

/** A checked value, linked to its receipt. Never call it for an unpublished figure. */
export function V({ o, className = "v-link", label, cell }: { o: Pick<Observation, "obs_id" | "value" | "published">; className?: string; label?: string; cell?: { cell_id: string; value_raw: string | null } }) {
  if (!o.published || o.value === null) throw new Error(`V: ${o.obs_id} is not a published value`);
  // In a table as printed the printed text is shown (data-v-cell names the cell);
  // everywhere else the stored value with thousands separators.
  const text = cell ? (cell.value_raw ?? "").trim() : formatDecimalString(o.value);
  return (
    <Link href={obsHref(o.obs_id)} className={className} data-v="" {...(cell ? { "data-v-cell": cell.cell_id } : {})} aria-label={label}>
      {text}
    </Link>
  );
}

/** A count read from the release. `k` names how check-build recomputes it. */
export function Count({ k, n, rate }: { k: string; n: number | null | undefined; rate?: boolean }) {
  return (
    <span data-count={k} {...(rate ? { "data-fmt": "pct" } : {})}>
      {rate ? pct(n) : count(n)}
    </span>
  );
}

export type NumKind = "period" | "date" | "page" | "id" | "version" | "ui" | "printed" | "axis" | "approx" | "threshold" | "cite" | "text" | "evidence";

/** Digits that are not a data value or a count. `cell` is required for "printed". */
export function Num({ kind, children, cell, className }: { kind: NumKind; children: ReactNode; cell?: string; className?: string }) {
  return (
    <span data-num={kind} {...(cell ? { "data-cell": cell } : {})} className={className}>
      {children}
    </span>
  );
}
