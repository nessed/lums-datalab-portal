// Citations for server pages (DESIGN.md 13.2). The text is formatted by
// cite-format.ts (pure, shared with the browser and the file generator); what is
// cited is read from the page path by citationFor() in take.ts. This keeps the
// older call shape, cite({ release, path, ... }), for the pages that use it.
import { type Release, type Source } from "./data";
import { citationFor } from "./take";

export type Citation = { apa: string; bibtex: string; ris: string; sentence: string; chicago: string; harvard: string };

/** Formats for the page at `path`. Links are site paths when the site address is not configured. */
export function cite(opts: { release: Release; path: string; what?: string; source?: Source | null; page?: number | null; pageLabel?: string | null }): Citation {
  const out = citationFor(opts.path, opts.what).out;
  const strip = (s: string) => s.replaceAll("{{ORIGIN}}", "");
  return { apa: strip(out.apa), bibtex: strip(out.bibtex), ris: strip(out.ris), sentence: strip(out.sentence), chicago: strip(out.chicago), harvard: strip(out.harvard) };
}
