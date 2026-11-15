// Server-side helpers for downloads, citations and links (DESIGN.md 13): the
// files written by scripts/prebuild/take.mjs and their sizes, release-pinned
// paths, and the citation of whatever a page path names (a figure, a series,
// a document or a view).
import fs from "node:fs";
import path from "node:path";
import { buildDate, DATA_BASE, db, RELEASE_VERSION, SITE_URL, slugify } from "./data";
import { formatCitation, longDate, type CiteDoc, type CiteOut } from "./cite-format";
import { DOC_TYPE_WORDS, periodWords } from "./format";
import { KIND, STAGE_KINDS } from "./words";

type Manifest = { release: string; generated: string; sizes: Record<string, number> };
let manifest: Manifest | null = null;

/** Sizes of the generated files, read once from public/data/<release>/files.json. */
export function takeManifest(): Manifest {
  if (manifest) return manifest;
  const p = path.join(process.cwd(), "public", "data", RELEASE_VERSION, "files.json");
  manifest = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as Manifest) : { release: RELEASE_VERSION, generated: "", sizes: {} };
  return manifest;
}

export const fileHref = (rel: string) => `${DATA_BASE}/${rel}`;
/** The same file at the address that always serves the latest release (a rewrite in next.config.ts). */
export const latestFileHref = (rel: string) => `/data/latest/${rel}`;
export const fileSize = (rel: string): number | null => takeManifest().sizes[rel] ?? null;

/** "13 KB", "1.0 MB": for the download lists. */
export function sizeText(n: number | null): string {
  if (n === null) return "";
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** A site path pinned to this release: /<release>/o/... (DESIGN.md 13.3). */
export const pinnedPath = (p: string) => `/${RELEASE_VERSION}${p.startsWith("/") ? p : `/${p}`}`;
/** Absolute when the site address is configured; otherwise "{{ORIGIN}}" for the browser to fill in. */
export const absoluteUrl = (p: string) => `${SITE_URL ? SITE_URL.replace(/\/$/, "") : "{{ORIGIN}}"}${p}`;

export type SeriesFiles = {
  slug: string;
  main: { key: "xlsx" | "csv" | "zip"; rel: string; size: number | null }[];
  versions: { key: string; rel: string; size: number | null }[];
};

export function seriesFiles(seriesId: string): SeriesFiles {
  const slug = slugify(seriesId);
  const main = (["xlsx", "csv", "zip"] as const).map((key) => ({ key, rel: `series/${slug}.${key}`, size: fileSize(`series/${slug}.${key}`) }));
  const versions = ["latest", "first", "printings", "vintages"]
    .map((key) => ({ key, rel: `series/${slug}.${key}.csv`, size: fileSize(`series/${slug}.${key}.csv`) }))
    .filter((v) => v.size !== null);
  return { slug, main, versions };
}

/* ---------------- citations ---------------- */

export type Cited = { kind: "figure" | "series" | "document" | "view"; title: string; out: CiteOut; pinned: string; latest: string };

function releaseInfo() {
  const d = db();
  return { id: RELEASE_VERSION, year: (d.release.created_at ?? "").slice(0, 4) || "n.d.", doi: d.release.doi ?? null, isPrototype: d.info.isPrototype };
}

const docUrl = (s: { file_url: string | null; landing_url: string | null; wayback_url: string | null }) => s.file_url ?? s.landing_url ?? s.wayback_url ?? null;

/** "budget estimate 2026-27", "June 2026, index", "2024-25". */
export function figureWhat(kind: keyof typeof KIND, period: string, frequency: string): string {
  const p = periodWords(period, frequency);
  if (kind === "as_printed") return p;
  return STAGE_KINDS.includes(kind) || kind === "survey_round" ? `${KIND[kind].long} ${p}` : `${p}, ${KIND[kind].long}`;
}

/** The citation of what a site path names. `fallbackTitle` names a page or a view. */
export function citationFor(pagePath: string, fallbackTitle?: string): Cited {
  const d = db();
  const [pathname] = pagePath.split(/[?#]/);
  const accessedIso = buildDate();
  const base = { release: releaseInfo(), accessed: longDate(accessedIso), accessedIso };
  const pinned = pinnedPath(pagePath);
  const url = absoluteUrl(pinned);
  let m = /^\/o\/([^/]+)$/.exec(pathname);
  if (m) {
    const o = d.obsBySlug.get(decodeURIComponent(m[1]));
    if (o) {
      const s = d.seriesById.get(o.series_id);
      const cell = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : undefined;
      const src = cell ? d.sourceById.get(cell.source_id) : undefined;
      const doc: CiteDoc | null = src
        ? { publisher: src.publisher, title: src.title, page: cell ? (cell.page_label ?? String(cell.page)) : null, pdfPage: cell?.page ?? null, label: cell?.row_label_raw ?? null, url: docUrl(src) }
        : null;
      const bracket = `${o.series_id}, ${figureWhat(o.kind, o.period, s?.frequency ?? "")}`;
      return { kind: "figure", title: s?.name ?? o.series_id, out: formatCitation({ ...base, url, bracket, doc, title: s?.name ?? null }), pinned, latest: pagePath };
    }
  }
  m = /^\/series\/([^/]+)$/.exec(pathname);
  if (m) {
    const s = d.seriesBySlug.get(decodeURIComponent(m[1]));
    if (s) {
      // The documents the series is read from: "Annual Budget Statement, editions 2010-11 to 2026-27".
      const srcs = [
        ...new Set(
          (d.obsBySeries.get(s.series_id) ?? [])
            .map((o) => (o.primary_cell_id ? d.cellById.get(o.primary_cell_id)?.source_id : undefined))
            .filter((x): x is string => !!x),
        ),
      ]
        .map((id) => d.sourceById.get(id)!)
        .filter(Boolean)
        .sort((a, b) => a.period.localeCompare(b.period));
      const first = srcs[0];
      const last = srcs.at(-1);
      const doc: CiteDoc | null = first
        ? {
            publisher: first.publisher,
            title: `${DOC_TYPE_WORDS[first.doc_type] ?? first.doc_type}, ${srcs.length > 1 ? `editions ${first.period} to ${last!.period}` : `edition ${first.period}`}`,
            label: null,
            url: null,
          }
        : null;
      return { kind: "series", title: s.name, out: formatCitation({ ...base, url, bracket: `${s.series_id}, ${s.name}`, doc, title: s.name }), pinned, latest: pagePath };
    }
  }
  m = /^\/sources\/([^/]+)$/.exec(pathname);
  if (m) {
    const src = d.sourceBySlug.get(decodeURIComponent(m[1]));
    if (src) {
      const doc: CiteDoc = { publisher: src.publisher, title: src.title, url: docUrl(src) };
      return { kind: "document", title: src.title, out: formatCitation({ ...base, url, bracket: null, doc, title: src.title }), pinned, latest: pagePath };
    }
  }
  const title = fallbackTitle ?? `${pathname === "/" ? "Home" : pathname.replace(/^\//, "")}`;
  return { kind: "view", title, out: formatCitation({ ...base, url, bracket: null, doc: null, title }), pinned, latest: pagePath };
}
