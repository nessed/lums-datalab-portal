// Words and figures of the Library pages (data hub run, stage 2). Every figure
// here is derived from a release field and recomputed, independently, by
// scripts/checks/library-counts.mjs; change a rule in both places or the check fails.

/**
 * File size, binary units (1 KB = 1,024 bytes, 1 MB = 1,048,576 bytes; the unit
 * Windows and the plan use, 60.5 MB for the release's PDFs):
 *   under 1 KB          "N bytes"
 *   under 1 MB          whole KB, halves up, at least 1 ("66 KB")
 *   from 1 MB           MB to one decimal, halves up ("14.5 MB")
 * Exact integer arithmetic, no floating point.
 */
export function fileSizeText(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return "";
  const n = Math.trunc(bytes);
  const KB = 1024;
  const MB = 1024 * 1024;
  if (n < KB) return `${n} bytes`;
  if (n < MB) return `${Math.max(1, Math.floor((2 * n + KB) / (2 * KB)))} KB`;
  const tenths = Math.floor((20 * n + MB) / (2 * MB));
  return `${Math.floor(tenths / 10)}.${tenths % 10} MB`;
}

/** The value of data-derived on a file size, and the attributes the check reads. */
export const SIZE_OF_SOURCE = "lib-source-size";
export const SIZE_OF_DOWNLOAD = "lib-download-size";
export const SERIES_OF_SOURCE = "lib-source-series";
export const SHOWN_OF_KIND = "lib-kind-docs";

/** The year a document belongs to in the year filter: its fiscal year, or the calendar year of a monthly issue. */
export function yearOfDoc(period: string, kind: string): string {
  if (kind === "cpi_monthly_review" && /^\d{4}-\d{2}$/.test(period)) return period.slice(0, 4);
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period.slice(0, 4);
  return period;
}

/** The subject of a chapter document, from its printed title ("..., Chapter 7: Inflation" -> "Inflation"); null for other kinds. */
export function chapterOf(kind: string, printedTitle: string): string | null {
  if (kind !== "pes_chapter") return null;
  const m = /:\s*([^:]+)$/.exec(printedTitle);
  return m && !/\d/.test(m[1]) ? m[1].trim() : null;
}

/** How the period of a document is said: a month for the price reviews, a date for a data download, else as recorded. */
export function docPeriodKind(kind: string): "month" | "date" | "plain" {
  return kind === "cpi_monthly_review" ? "month" : kind === "sbp_easydata" ? "date" : "plain";
}
