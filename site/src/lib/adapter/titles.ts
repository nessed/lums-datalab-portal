// Reads site/editorial/titles.json (plain titles and summaries, DESIGN.md 6.4) for
// the adapters. Editorial text only: it never changes a series' data, its id or its
// printed name. A series without an entry keeps its printed name as its title, with
// titleStatus "printed", so a page can say the title is the printed label.
// scripts/checks/titles.mjs checks the file itself.
import fs from "node:fs";
import path from "node:path";
import type { SeriesTitleFields, TitleStatus } from "./contract";

export type TitleEntry = { title: string; summary: string; status: TitleStatus };

/** The editorial file next to a release folder (releases/<version> -> site/editorial/titles.json). */
export function defaultTitlesFile(releaseDir: string): string {
  return path.resolve(releaseDir, "..", "..", "site", "editorial", "titles.json");
}

/** Entries by series id; an empty map when the file does not exist. */
export function readTitles(file: string | null | undefined): Map<string, TitleEntry> {
  const out = new Map<string, TitleEntry>();
  if (!file || !fs.existsSync(file)) return out;
  const j = JSON.parse(fs.readFileSync(file, "utf8")) as { series?: Record<string, { title?: unknown; summary?: unknown; status?: unknown }> };
  for (const [id, e] of Object.entries(j.series ?? {})) {
    if (typeof e?.title !== "string" || !e.title.trim()) continue;
    const status: TitleStatus = e.status === "approved" ? "approved" : "draft";
    out.set(id, { title: e.title.trim(), summary: typeof e.summary === "string" && e.summary.trim() ? e.summary.trim() : "", status });
  }
  return out;
}

/** The title fields of one series: its entry, or its printed name. */
export function titleFields(seriesId: string, printedName: string, entries: Map<string, TitleEntry>): SeriesTitleFields {
  const e = entries.get(seriesId);
  if (!e) return { title: printedName, summary: null, titleStatus: "printed" };
  return { title: e.title, summary: e.summary || null, titleStatus: e.status };
}
