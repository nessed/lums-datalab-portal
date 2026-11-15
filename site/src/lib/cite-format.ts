// Citation text (DESIGN.md 13.2), as pure functions with no imports, so the
// same code formats a citation on a server page, in the browser (compare: a
// view citation) and inside downloaded files (scripts/prebuild/take.mjs).
//
// Form: the government document first (it is the authority), then the release
// (it records how the figure was read and checked), then the access date:
//   Government of Pakistan, Finance Division, *Annual Budget Statement 2026-27*,
//   p. 11, "Health" [fed.exp.current.function.health, budget estimate 2026-27];
//   retrieved from LUMS DataLab, release v0.0.1-prototype,
//   https://.../v0.0.1-prototype/o/..., accessed 15 November 2026.

export const PORTAL = "LUMS DataLab";
export const PORTAL_AUTHOR = "LUMS Department of Economics DataLab";
export const PORTAL_TITLE = "LUMS DataLab Portal";
export const CITE_BOTH = "Cite both: the government document is the authority; the release records how it was read and checked.";

export type CiteDoc = {
  /** As the release stores it, e.g. "Finance Division, Government of Pakistan". */
  publisher: string;
  title: string;
  /** Page as the reader finds it: the printed page label, else the PDF page. */
  page?: string | null;
  /** PDF page, when it differs from the printed page label. */
  pdfPage?: number | null;
  /** The printed row label, e.g. "07 Health". */
  label?: string | null;
  url?: string | null;
};

export type CiteInput = {
  release: { id: string; year: string; doi: string | null; isPrototype: boolean };
  /** Absolute when the site address is known, else a site path. */
  url: string;
  /** "15 November 2026". */
  accessed: string;
  /** ISO date, for BibTeX and RIS. */
  accessedIso: string;
  /** What is cited, in brackets after the document: "fed.exp.current.function.health, budget estimate 2026-27". */
  bracket?: string | null;
  /** One document (a figure), several (a series: "Annual Budget Statement, editions 2010-11 to 2026-27"), or none (a view). */
  doc?: CiteDoc | null;
  /** Title of what is cited when there is no single document (a series or a view). */
  title?: string | null;
};

export type CiteOut = { sentence: string; apa: string; chicago: string; harvard: string; bibtex: string; ris: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-11-15" -> "15 November 2026". */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** "Finance Division, Government of Pakistan" -> "Government of Pakistan, Finance Division". */
export function publisherFirst(publisher: string): string {
  const m = /^(.*?),\s*(Government of [A-Za-z ]+)$/.exec(publisher.trim());
  return m ? `${m[2]}, ${m[1]}` : publisher.trim();
}

const key = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
const bib = (s: string) => s.replace(/[{}]/g, "");

function pageText(d: CiteDoc): string {
  if (!d.page) return "";
  return d.pdfPage && String(d.pdfPage) !== d.page ? `p. ${d.page} (PDF p. ${d.pdfPage})` : `p. ${d.page}`;
}

export function formatCitation(c: CiteInput): CiteOut {
  const r = c.release;
  const rel = `release ${r.id}${r.doi ? `, DOI ${r.doi}` : ""}`;
  const d = c.doc ?? null;
  const pg = d ? pageText(d) : "";
  const docBits = d ? [publisherFirst(d.publisher), d.title, pg, d.label ? `"${d.label}"` : ""].filter(Boolean).join(", ") : "";
  const what = c.title && !d ? `${PORTAL}, "${c.title}"` : docBits;
  const bracket = c.bracket ? ` [${c.bracket}]` : "";
  const sentence = `${what}${bracket}; retrieved from ${PORTAL}, ${rel}, ${c.url}, accessed ${c.accessed}.`;

  // The release as a data set: one entry in every style.
  const relTitle = `${PORTAL_TITLE} (Version ${r.id})`;
  const kindNote = r.doi ? `DOI ${r.doi}` : r.isPrototype ? "prototype release, no DOI" : "no DOI";
  const docPlain = d ? `${d.title}${pg ? `, ${pg}` : ""}${d.label ? `, "${d.label}"` : ""}` : "";
  const docUrl = d?.url ? ` ${d.url}` : "";
  const subject = c.bracket ? ` [${c.bracket}]` : c.title && !d ? ` ["${c.title}"]` : "";

  const apa = [
    d ? `${d.publisher}. (n.d.). ${docPlain}.${docUrl}` : "",
    `${PORTAL_AUTHOR}. (${r.year}). ${relTitle} [Data set; ${kindNote}]${subject}. ${c.url}. Accessed ${c.accessed}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const chicago = [
    d ? `${publisherFirst(d.publisher)}. ${docPlain}.${docUrl ? `${docUrl}.` : ""}` : "",
    `${PORTAL_AUTHOR}. ${relTitle}${subject}. Data set, ${kindNote}. ${r.year}. Accessed ${c.accessed}. ${c.url}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const harvard = [
    d ? `${d.publisher} (n.d.) ${docPlain}.${docUrl ? ` Available at:${docUrl}.` : ""}` : "",
    `${PORTAL_AUTHOR} (${r.year}) ${relTitle}${subject} [Data set; ${kindNote}]. Available at: ${c.url} (Accessed: ${c.accessed}).`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const bibtex = [
    d
      ? [
          `@misc{${key(d.title)},`,
          `  author = {{${bib(publisherFirst(d.publisher))}}},`,
          `  title = {${bib(d.title)}},`,
          d.page ? `  pages = {${d.page}},` : "",
          d.label ? `  note = {${bib(`Line "${d.label}"`)}},` : "",
          d.url ? `  url = {${d.url}},` : "",
          `}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    [
      `@misc{lums_datalab_${key(r.id)},`,
      `  author = {{${PORTAL_AUTHOR}}},`,
      `  title = {${bib(PORTAL_TITLE)}},`,
      `  year = {${r.year}},`,
      `  version = {${r.id}},`,
      `  url = {${c.url}},`,
      `  urldate = {${c.accessedIso}},`,
      `  note = {${bib(`${c.bracket ?? c.title ?? "Release"}; ${kindNote}`)}}`,
      `}`,
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  const ris = [
    d
      ? ["TY  - GOVDOC", `AU  - ${publisherFirst(d.publisher)}`, `TI  - ${d.title}`, `PB  - ${d.publisher}`, d.page ? `SP  - ${d.page}` : "", d.url ? `UR  - ${d.url}` : "", d.label ? `N1  - Line "${d.label}"` : "", "ER  - "]
          .filter(Boolean)
          .join("\n")
      : "",
    [
      "TY  - DATA",
      `AU  - ${PORTAL_AUTHOR}`,
      `TI  - ${PORTAL_TITLE}`,
      `PY  - ${r.year}`,
      `ET  - ${r.id}`,
      `UR  - ${c.url}`,
      `Y2  - ${c.accessedIso}`,
      `N1  - ${c.bracket ?? c.title ?? "Release"}; ${kindNote}`,
      "ER  - ",
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  return { sentence, apa, chicago, harvard, bibtex, ris };
}

/** The citation file (CITATION.cff) for a download. */
export function citationCff(c: { releaseId: string; date: string; url: string; title: string; isPrototype: boolean }): string {
  return [
    "cff-version: 1.2.0",
    `message: "${CITE_BOTH} Cite the government document named in each row as well."`,
    "type: dataset",
    `title: "${c.title.replaceAll('"', "'")}"`,
    "authors:",
    `  - name: "${PORTAL_AUTHOR}"`,
    `version: "${c.releaseId}"`,
    `date-released: "${c.date}"`,
    "license: CC-BY-4.0",
    `url: "${c.url}"`,
    ...(c.isPrototype ? ['abstract: "Prototype release: not yet for citation in publications; no DOI."'] : []),
    "",
  ].join("\n");
}
