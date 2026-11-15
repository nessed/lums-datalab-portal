// How a series is named for a reader (DESIGN.md 6.4, round 2). Every page names a
// series by its short plain title; the printed label (`name`, as the document prints
// it) is the small grey second line where there is room, and always in About and on
// the receipt. Titles come from site/editorial/titles.json through the adapter.
// Pure functions, no file access: safe in client components.

type Named = { name: string; title?: string | null; summary?: string | null; titleStatus?: string | null };

/** The short plain title ("Inflation"); the printed name when there is no title. */
export function seriesTitle(s: Named): string {
  return s.title && s.title.trim() ? s.title : s.name;
}

/** The printed label, when it says something the title does not (null when they are the same words). */
export function printedLine(s: Named): string | null {
  const t = seriesTitle(s);
  return t.trim().toLowerCase() === s.name.trim().toLowerCase() ? null : s.name;
}

/** The one-sentence plain summary, or null. */
export function seriesSummary(s: Named): string | null {
  return s.summary && s.summary.trim() ? s.summary : null;
}

/** True when the title is still a draft or there is no editorial title (the printed name stands in). */
export function titleIsDraft(s: Named): boolean {
  return s.titleStatus !== "approved";
}
