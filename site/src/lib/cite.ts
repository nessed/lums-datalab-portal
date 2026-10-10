// Two-part citations: (1) the original government document, which is the
// authority, and (2) this portal release, which says where and how we read it.
import { buildDate, REPO_URL, SITE_URL, type Release, type Source } from "./data";
import { dateOnly, DOC_TYPE_WORDS } from "./format";

export type Citation = { apa: string; bibtex: string; ris: string };

const PORTAL_AUTHOR = "LUMS Department of Economics DataLab";
const PORTAL_TITLE = "LUMS DataLab Portal";

function portalUrl(path: string): string {
  return SITE_URL ? `${SITE_URL.replace(/\/$/, "")}${path}` : REPO_URL;
}
const key = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
const bib = (s: string) => s.replace(/[{}]/g, "");

export function cite(opts: { release: Release; path: string; what?: string; source?: Source | null; page?: number | null }): Citation {
  const { release, path, what, source, page } = opts;
  const accessed = buildDate();
  const year = release.created_at ? release.created_at.slice(0, 4) : "n.d.";
  const url = portalUrl(path);
  const doiNote = release.doi ? `DOI ${release.doi}` : "prototype, no DOI";
  const note = `${what ? `${what}. ` : ""}${SITE_URL ? "" : `Page path: ${path}. `}${release.doi ? `DOI ${release.doi}` : "Prototype, no DOI"}`;

  const apa: string[] = [];
  const bibtex: string[] = [];
  const ris: string[] = [];

  if (source) {
    const srcUrl = source.file_url ?? source.landing_url ?? source.wayback_url ?? "";
    const pg = page ? ` (p. ${page} of the PDF file)` : "";
    const docType = DOC_TYPE_WORDS[source.doc_type] ?? source.doc_type;
    const retrieved = `Retrieved ${dateOnly(source.retrieved_at)}. SHA-256 ${source.sha256}`;
    apa.push(`${source.publisher}. (n.d.). ${source.title}${pg}. ${srcUrl} (${retrieved})`);
    bibtex.push(
      [
        `@misc{${key(source.source_id)},`,
        `  author = {{${bib(source.publisher)}}},`,
        `  title = {${bib(source.title)}},`,
        `  howpublished = {${bib(docType)}},`,
        `  url = {${srcUrl}},`,
        page ? `  pages = {${page}},` : "",
        `  note = {${retrieved}}`,
        `}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    ris.push(
      [
        "TY  - GOVDOC",
        `AU  - ${source.publisher}`,
        `TI  - ${source.title}`,
        `PB  - ${source.publisher}`,
        srcUrl ? `UR  - ${srcUrl}` : "",
        page ? `SP  - ${page}` : "",
        `N1  - ${retrieved}`,
        "ER  - ",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  apa.push(
    `${PORTAL_AUTHOR}. (${year}). ${PORTAL_TITLE} (Version ${release.version}) [Data set; ${doiNote}].${what ? ` ${what}.` : ""} ${url}${SITE_URL ? "" : ` (page path ${path})`}. Accessed ${accessed}.`,
  );
  bibtex.push(
    [
      `@misc{lums_datalab_${key(release.version)},`,
      `  author = {{${PORTAL_AUTHOR}}},`,
      `  title = {${PORTAL_TITLE}},`,
      `  year = {${year}},`,
      `  version = {${release.version}},`,
      `  url = {${url}},`,
      `  urldate = {${accessed}},`,
      `  note = {${bib(note)}}`,
      `}`,
    ].join("\n"),
  );
  ris.push(
    ["TY  - DATA", `AU  - ${PORTAL_AUTHOR}`, `TI  - ${PORTAL_TITLE}`, `PY  - ${year}`, `ET  - ${release.version}`, `UR  - ${url}`, `Y2  - ${accessed}`, `N1  - ${note}`, "ER  - "].join(
      "\n",
    ),
  );

  return { apa: apa.join("\n\n"), bibtex: bibtex.join("\n\n"), ris: ris.join("\n\n") };
}
