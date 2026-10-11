// Source documents: verification status in a few words, a mark, and the
// sentence that explains it (the sentences live in format.ts).
import { db, type Source } from "./data";
import { verificationWords } from "./format";

export type VerifKey = "ok" | "caveat" | "rejected";

export const VERIF_SHORT: Record<string, { label: string; key: VerifKey }> = {
  official_match_archive: { label: "Official file, matches archived copy", key: "ok" },
  official_only: { label: "Official file", key: "ok" },
  official_differs_from_archive: { label: "Official file, reissued", key: "ok" },
  wayback_match_archive: { label: "Internet Archive copy", key: "caveat" },
  wayback_only: { label: "Internet Archive copy", key: "caveat" },
  archive_copy_content_inspected: { label: "Research archive copy", key: "caveat" },
  failed: { label: "Rejected: not used", key: "rejected" },
};

export function verifShort(status: string | null | undefined): { label: string; key: VerifKey } {
  return VERIF_SHORT[status ?? ""] ?? { label: (status ?? "unknown").replaceAll("_", " "), key: "caveat" };
}

export function verifLong(status: string | null | undefined): string {
  if (status === "failed") return "The file failed inspection (for example its cover or table titles show it is a different document). It is not used for any figure.";
  const t = verificationWords(status).text.replace(/^Caveat: /, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Coverage of a source: numbers printed in the tables read vs numbers captured. */
export function sourceCoverage(s: Source): { printed: number; matched: number; ratio: number | null; tables: number } {
  const rows = db().coverage.filter((c) => c.source_id === s.source_id);
  const printed = rows.reduce((a, r) => a + (r.printed_numeric_tokens ?? 0), 0);
  const matched = rows.reduce((a, r) => a + (r.matched ?? 0), 0);
  return { printed, matched, ratio: printed > 0 ? matched / printed : null, tables: rows.length };
}

/** Published values whose main printing is in this source. */
export function valuesFromSource(sourceId: string): number {
  const d = db();
  let n = 0;
  for (const o of d.observations) {
    if (!o.published || !o.primary_cell_id) continue;
    if (d.cellById.get(o.primary_cell_id)?.source_id === sourceId) n++;
  }
  return n;
}

export const ROLE_SHORT: Record<string, string> = {
  core: "Core",
  corroboration: "Corroboration",
  cross_source: "Cross-source",
};
