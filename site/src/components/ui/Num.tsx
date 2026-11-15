// Every digit the site shows is wrapped in one of these, so that
// scripts/check-build.mjs can prove where it came from:
//   <V>       a checked value: always a link to its receipt (data-v)
//   <Count>   a count or rate: recomputed from the release by check-build (data-count)
//   <Num>     anything else with digits: a period, a date, a page number, an id,
//             an axis tick, a printed reading on a receipt (data-num="kind")
// A digit outside all three fails the build check.
import Link from "@/components/ui/Link";
import type { ReactNode } from "react";
import { obsHref, slugify, type Observation } from "@/lib/data";
import { count, formatDecimalString, pct, periodWords, unitLabel } from "@/lib/format";
import { KIND, shortScale } from "@/lib/words";

const MONTHLY = ["index", "change_yoy", "change_mom", "weight"];

/** Accessible name of a value link (DESIGN.md 14.3): value, unit, kind, period and "see where it is printed". */
function valueName(text: string, o: Partial<Pick<Observation, "unit" | "scale_factor" | "kind" | "period">>, short: boolean | undefined): string {
  const unit = !short && o.unit ? ` ${unitLabel(o.unit, o.scale_factor)}` : "";
  const k = o.kind && o.kind !== "as_printed" ? KIND[o.kind]?.long : null;
  const when = o.period ? periodWords(o.period, o.kind && MONTHLY.includes(o.kind) ? "month" : undefined) : "";
  const what = [k, when].filter(Boolean).join(" ");
  return `${text}${unit}${what ? `, ${what}` : ""}, see where it is printed`;
}

/**
 * A shown value, linked to its receipt. Never call it for a figure whose status
 * shows no value. `short` gives the headline form ("Rs 37.4 billion",
 * DESIGN.md 6.3), marked data-v-fmt="short" so check-build recomputes it.
 * A figure from a dataset nobody has signed off carries the words
 * "not signed off" beside it, always (decision 17.1).
 */
export function V({
  o,
  className = "v-link",
  label,
  cell,
  short,
  sheet,
}: {
  o: Pick<Observation, "obs_id" | "value" | "published"> & Partial<Pick<Observation, "reader" | "unit" | "scale_factor" | "kind" | "period">>;
  className?: string;
  label?: string;
  cell?: { cell_id: string; value_raw: string | null };
  short?: boolean;
  /** Tapping opens the one-tap evidence sheet (components/evidence/EvidenceSheet) instead of leaving the page; without JavaScript it is a plain link to the receipt. */
  sheet?: boolean;
}) {
  if (!o.published || o.value === null) throw new Error(`V: ${o.obs_id} is not a published value`);
  if (o.reader && !o.reader.showsValue) throw new Error(`V: ${o.obs_id} has status ${o.reader.key}, which shows no value`);
  // In a table as printed the printed text is shown (data-v-cell names the cell);
  // everywhere else the stored value with thousands separators, or its short form.
  const text = cell ? (cell.value_raw ?? "").trim() : short ? shortScale(o.value, o.unit, o.scale_factor) : formatDecimalString(o.value);
  const candidate = o.reader?.key === "candidate";
  const link = (
    <Link
      href={obsHref(o.obs_id)}
      className={className}
      data-v=""
      {...(cell ? { "data-v-cell": cell.cell_id } : {})}
      {...(short && !cell ? { "data-v-fmt": "short" } : {})}
      {...(candidate ? { "data-candidate": "" } : {})}
      {...(sheet ? { "data-sheet": slugify(o.obs_id) } : {})}
      aria-label={label ?? `${valueName(text, o, short && !cell)}${candidate ? ", not signed off" : ""}`}
    >
      {text}
    </Link>
  );
  if (!candidate) return link;
  return (
    <span className="v-candidate">
      {link} <span className="v-mark">not signed off</span>
    </span>
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
