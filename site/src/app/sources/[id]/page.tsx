// One document (data hub plan, section 7.1; the address /sources/<id> is kept).
// It leads with the document itself, in the viewer, and its actions (download a
// verified copy, the official page). Below: what we read from it (the series,
// the tables as printed, the figures by status), the pages we read as
// thumbnails that jump the viewer, then the provenance facts folded away: how
// we know the file is genuine (each check as a sentence), its fingerprint, the
// tables located with their coverage, the extraction runs, and how to cite it.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Cite from "@/components/Cite";
import { Bar, Breadcrumbs, Callout, Disclosure, ExternalLink, TableWrap, Toc } from "@/components/ui/Basics";
import CopyButton from "@/components/ui/CopyButton";
import { VerifBadge } from "@/components/ui/Verif";
import PdfViewer from "@/components/library/PdfViewer";
import { DocActions, DocMeta, DocName, DocPeriod, FileSize } from "@/components/library/Bits";
import { DATA_BASE, db, isDatasetPublished, libraryDoc, obsHref, pageImage, runManifest, seriesHref, slugify, sourceHref } from "@/lib/data";
import { dateOnly, ROLE_WORDS } from "@/lib/format";
import { Count, Num } from "@/components/ui/Num";
import { tablesOfSource } from "@/lib/tables";
import { StatusMark } from "@/components/ui/Status";
import { STATUS, type StatusKey } from "@/lib/status";
import { sourceCoverage, valuesFromSource, verifLong } from "@/lib/sources";
import { SERIES_OF_SOURCE } from "@/lib/library-format";

export const dynamicParams = false;

export function generateStaticParams() {
  return db().sources.map((s) => ({ id: slugify(s.source_id) }));
}

type Props = { params: Promise<{ id: string }> };

function find(id: string) {
  const d = db();
  return d.sourceBySlug.get(id) ?? d.sourceBySlug.get(decodeURIComponent(id));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = find((await params).id);
  const doc = s ? libraryDoc(s.source_id) : undefined;
  return {
    title: s ? s.title : "Document",
    description: s ? `${s.title}, ${doc?.publisher ?? s.publisher}: read it here, download it, see what we read from it and how we know the file is genuine.` : undefined,
  };
}

type Rec = Record<string, unknown>;
const obj = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);

/** "D:20170526214737+05'00'" -> "2017-05-26" */
function pdfDate(v: unknown): string | null {
  const m = typeof v === "string" ? /D:(\d{4})(\d{2})(\d{2})/.exec(v) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
/** "20250527104257" -> "2025-05-27" */
function waybackDate(v: unknown): string | null {
  const m = typeof v === "string" ? /^(\d{4})(\d{2})(\d{2})/.exec(v) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Reader statuses in the per-document quality table (DESIGN.md 9.8), with the count key check-build recomputes. */
const QUALITY_ROWS: { bucket: string; k: StatusKey }[] = [
  { bucket: "checked", k: "checked" },
  { bucket: "held", k: "withheld" },
  { bucket: "disputed", k: "disputed" },
  { bucket: "not-printed", k: "gap-source" },
  { bucket: "not-checked", k: "gap-pending" },
];

function bucketOf(o: { published: boolean; status: string; gap_kind: string | null }): string {
  if (o.published) return "checked";
  if (o.status === "disputed") return "disputed";
  return { failed_checks: "held", not_in_source: "not-printed", not_yet_verified: "not-checked" }[o.gap_kind ?? ""] ?? "other";
}

function Item({ ok, children }: { ok: boolean | null; children: ReactNode }) {
  const cls = ok === true ? "verif--ok" : ok === false ? "verif--caveat" : "";
  return (
    <li className="vcheck">
      <span className={`st ${cls}`} aria-hidden="true">
        <svg className="st-mark" viewBox="0 0 10 10">
          {ok === true ? <circle cx="5" cy="5" r="4.2" fill="currentColor" /> : ok === false ? <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.5" /> : <path d="M1.5 5 L8.5 5" stroke="currentColor" strokeWidth="1.6" />}
        </svg>
      </span>
      <span className="sr-only">{ok === true ? "Passed: " : ok === false ? "Not met: " : "Not recorded: "}</span>
      <span>{children}</span>
    </li>
  );
}

const IDENTITY_WORDS: Record<string, string> = {
  cover_markers: "the document's title words were found on its first pages",
  contents_markers_plus_official_landing_link: "its contents page and fiscal year, plus a link to this exact file from the official page for that year",
};

/** How many series to list before the rest fold away. */
const SERIES_SHOWN = 12;

export default async function SourcePage({ params }: Props) {
  const { id } = await params;
  const source = find(id);
  if (!source) notFound();
  const doc = libraryDoc(source.source_id);
  if (!doc) notFound();
  const d = db();
  const v = obj(source.verification) ?? {};
  const archive = obj(v.archive_copy);
  const inspection = obj(v.inspection);
  const wayback = obj(v.wayback);
  const response = obj(v.response);
  const meta = obj(inspection?.pdf_metadata);
  const created = pdfDate(meta?.CreationDate);
  const cov = sourceCoverage(source);
  const coverage = d.coverage.filter((c) => c.source_id === source.source_id);
  const runs = (source.run_ids ?? []).map((r) => ({ id: r, m: runManifest(r) }));
  const pages = source.pages_used ?? [];
  const values = valuesFromSource(source.source_id);
  const rejected = source.verification_status === "failed";
  const viewer = !rejected && doc.file && doc.format === "pdf" ? doc.file : null;
  const tables = tablesOfSource(source.source_id);
  const firstObsOnPage = (p: number) =>
    d.observations.find((o) => o.published && o.primary_cell_id && d.cellById.get(o.primary_cell_id)?.source_id === source.source_id && d.cellById.get(o.primary_cell_id)?.page === p);
  const textFrac = typeof inspection?.text_layer_fraction === "number" ? (inspection.text_layer_fraction as number) : null;
  const identity = typeof v.identity_route === "string" ? v.identity_route : null;
  // Per-document quality (DESIGN.md 9.8): figures of visible datasets whose main printing is here.
  const quality: Record<string, number> = { all: 0 };
  for (const o of d.observations) {
    const s = d.seriesById.get(o.series_id);
    if (!s || !isDatasetPublished(s.dataset) || !o.primary_cell_id || d.cellById.get(o.primary_cell_id)?.source_id !== source.source_id) continue;
    quality.all++;
    const b = bucketOf(o);
    quality[b] = (quality[b] ?? 0) + 1;
  }
  // The series with a figure printed here (visible datasets), in catalogue order; the top of each family first.
  const seriesHere = doc.seriesIds
    .map((x) => d.seriesById.get(x)!)
    .filter((s) => s && isDatasetPublished(s.dataset))
    .sort((a, b) => a.dataset.localeCompare(b.dataset) || a.sort_key - b.sort_key || a.series_id.localeCompare(b.series_id));
  const here = new Set(seriesHere.map((s) => s.series_id));
  const tops = seriesHere.filter((s) => !s.parent_id || !here.has(s.parent_id));
  const shown = (tops.length ? tops : seriesHere).slice(0, SERIES_SHOWN);
  const downloadName = doc.file ? (doc.file.href.split("/").pop() ?? "document.pdf") : "document.pdf";

  return (
    <article className="lib-doc">
      <Breadcrumbs items={[{ href: "/library", label: "Library" }, { href: `/library#t-${source.doc_type}`, label: doc.kindName }, { label: <DocName doc={doc} /> }]} />
      <header className="page-head doc-head">
        <p className="kicker">{doc.publisher}</p>
        <h1>
          <DocName doc={doc} />
        </h1>
        <p className="lib-printed">{source.title}</p>
        <p className="doc-meta">
          <DocMeta doc={doc} publisher={false} />
        </p>
        <p className="doc-actions no-print">
          <DocActions doc={doc} read={false} primary />
        </p>
      </header>

      {rejected ? (
        <Callout kind="caveat" title="This file is not used">
          <p>{doc.rejectedReason}</p>
          <p>It failed inspection, so no figure on this site is read from it. It stays listed so the rejection is on the record.</p>
        </Callout>
      ) : null}

      {viewer ? (
        <PdfViewer src={viewer.href} title={source.title} downloadName={downloadName} />
      ) : !rejected && doc.format === "pdf" ? (
        <Callout kind="note" title="Not available to read here">
          <p>
            We could not get a copy of this file that matches the one we registered, so it is not shown here.{" "}
            {doc.officialUrl ? <ExternalLink href={doc.officialUrl}>Open it on the government site</ExternalLink> : null}
            {doc.archiveUrl ? (
              <>
                {" "}
                or <ExternalLink href={doc.archiveUrl}>the Internet Archive copy</ExternalLink>
              </>
            ) : null}
            .
          </p>
        </Callout>
      ) : null}

      <div className="with-rail doc-body">
        <div>
          <section id="read" aria-labelledby="read-h">
            <h2 id="read-h">What we read from it</h2>
            {seriesHere.length === 0 ? (
              <p className="measure">
                {doc.state === "document-only" || rejected
                  ? "No figure on this site is read from this document."
                  : "This document is used to confirm figures printed elsewhere; no series on this site has a figure printed in it."}
              </p>
            ) : (
              <>
                <p className="measure">
                  <span data-num="derived" data-derived={SERIES_OF_SOURCE} data-source={source.source_id}>
                    {seriesHere.length.toLocaleString("en-US")}
                  </span>{" "}
                  {seriesHere.length === 1 ? "series has" : "series have"} figures printed in it. The main ones:
                </p>
                <ul className="doc-series">
                  {shown.map((s) => (
                    <li key={s.series_id}>
                      <Link href={seriesHref(s.series_id)}>{s.title}</Link>
                    </li>
                  ))}
                </ul>
                {seriesHere.length > shown.length ? (
                  <Disclosure summary="Every series read from it">
                    <ul className="doc-series doc-series-all">
                      {seriesHere.map((s) => (
                        <li key={s.series_id}>
                          <Link href={seriesHref(s.series_id)}>{s.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </Disclosure>
                ) : null}
              </>
            )}
            {tables.length ? (
              <>
                <h3 id="printed">Tables as the document prints them</h3>
                <p className="small measure">Each table drawn as the government printed it. Select any checked number to see where it sits on the page.</p>
                <ul className="tp-links">
                  {tables.map((t) => (
                    <li key={t.slug}>
                      <Link href={`/tables/${t.slug}`}>
                        {t.title}, <Num kind="page">p. {t.pageLabel ?? t.page}</Num>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {quality.all > 0 ? (
              <Disclosure summary="Figures read from it, by what the site shows for them" id="quality">
                <p className="measure small">
                  Figures whose main printing is in this document. A figure printed in several documents is counted once, under the document it is read from.
                </p>
                <TableWrap label="Figures read from this document, by status">
                  <table className="dq-table">
                    <thead>
                      <tr>
                        <th scope="col">Status</th>
                        <th scope="col" className="num">
                          Figures
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {QUALITY_ROWS.map(({ bucket, k }) => (
                        <tr key={bucket}>
                          <th scope="row" style={{ fontWeight: 400 }}>
                            <StatusMark k={k} /> {STATUS[k as Exclude<StatusKey, "unknown">].label}
                          </th>
                          <td className="num">
                            <Count k={`obs:source:${source.source_id}:${bucket}`} n={quality[bucket] ?? 0} />
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <th scope="row">Figures read</th>
                        <td className="num">
                          <strong>
                            <Count k={`obs:source:${source.source_id}`} n={quality.all} />
                          </strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </TableWrap>
                <p className="small">
                  <Link href="/methods#statuses">What each status means</Link>
                </p>
              </Disclosure>
            ) : null}
          </section>

          <section id="pages" aria-labelledby="pages-h">
            <h2 id="pages-h">Pages we read</h2>
            {pages.length === 0 ? (
              <p className="measure">No values are read from this document in this release. Figures that depend on it are labelled gaps.</p>
            ) : (
              <>
                <p className="measure">
                  <Count k={`pages:source:${source.source_id}`} n={pages.length} /> {pages.length === 1 ? "page" : "pages"} read;{" "}
                  <Count k={`values:source:${source.source_id}`} n={values} /> published {values === 1 ? "value has" : "values have"} this document as their main printing.
                  {viewer ? " Select a page to open it in the viewer above." : " Select a page to see a receipt from it."}
                </p>
                <ul className="thumbs doc-thumbs">
                  {pages.map((p) => {
                    const img = pageImage(source.source_id, p);
                    const o = firstObsOnPage(p);
                    const href = viewer ? `${viewer.href}#page=${p}` : o ? obsHref(o.obs_id) : (img?.src ?? "#");
                    return (
                      <li key={p}>
                        <a href={href} {...(viewer ? { "data-viewer-page": String(p) } : {})} aria-label={`Page ${p}${viewer ? ", open in the viewer" : o ? ", a receipt from it" : ""}`}>
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img.src} alt="" width={img.width} height={img.height} loading="lazy" decoding="async" />
                          ) : (
                            <span className="chart-empty" style={{ display: "block", aspectRatio: "0.77" }} />
                          )}
                          <span className="t-cap">
                            <Num kind="page">Page {p}</Num>
                          </span>
                        </a>
                        {viewer && o ? (
                          <a className="t-sub small" href={obsHref(o.obs_id)}>
                            A figure from it
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section id="provenance" aria-labelledby="prov-h">
            <h2 id="prov-h">Where the file comes from</h2>
            <p className="measure small">
              Published by {source.publisher}. <VerifBadge status={source.verification_status} /> {verifLong(source.verification_status)}
            </p>
            {source.notes ? (
              <Callout kind="caveat" title="About this file">
                <p>{source.notes}</p>
              </Callout>
            ) : null}
            <Disclosure summary="How we know this is the genuine file" id="genuine">
              <ul className="vchecks">
                <Item ok={source.retrieved_via === "official"}>
                  Downloaded {source.retrieved_via === "official" ? "from the official address" : source.retrieved_via === "wayback" ? "from the Internet Archive, because the official address did not respond" : `via ${String(source.retrieved_via ?? "an unrecorded route").replaceAll("-", " ")}`} on{" "}
                  <Num kind="date">{dateOnly(source.retrieved_at)}</Num>
                  {response?.http_status ? (
                    <>
                      {" "}
                      (the server answered <Num kind="id">{String(response.http_status)}</Num>)
                    </>
                  ) : null}
                  .
                  {source.file_url ? (
                    <Num kind="id" className="vcheck-url mono">
                      {source.file_url}
                    </Num>
                  ) : null}
                </Item>
                {typeof v.landing_page_links_file === "boolean" ? (
                  <Item ok={v.landing_page_links_file as boolean}>
                    {v.landing_page_links_file ? "The government's own page for this document links to exactly this file." : "The government's page for this document does not link to this exact file."}
                  </Item>
                ) : null}
                {archive ? (
                  <Item ok={archive.identical === true ? true : archive.identical === false ? false : null}>
                    {archive.identical === true
                      ? "It is byte-for-byte identical to an independently archived copy held by the research team."
                      : archive.identical === false
                        ? "It differs from an older archived copy, which suggests the government reissued the file; the official download is used."
                        : "No independently archived copy was available to compare it with."}
                  </Item>
                ) : null}
                {wayback ? (
                  <Item ok={wayback.digest_matches_file === true ? true : wayback.digest_matches_file === false ? false : null}>
                    {wayback.digest_matches_file === true ? (
                      <>
                        An Internet Archive snapshot from <Num kind="date">{waybackDate(wayback.wayback_timestamp) ?? "not recorded"}</Num> holds exactly the same bytes (the
                        archive&rsquo;s own fingerprint matches).
                      </>
                    ) : wayback.wayback_url ? (
                      <>
                        An Internet Archive snapshot exists (<Num kind="date">{waybackDate(wayback.wayback_timestamp) ?? "not recorded"}</Num>), but its fingerprint was not
                        matched to this file.
                      </>
                    ) : (
                      "No Internet Archive snapshot was found."
                    )}
                  </Item>
                ) : null}
                {inspection ? (
                  <Item ok={inspection.markers_ok === true ? true : identity ? null : false}>
                    {inspection.markers_ok === true
                      ? "Its first pages print the expected title and period."
                      : `Its first pages do not print the expected title words as text${identity ? `; it was identified instead by ${IDENTITY_WORDS[identity] ?? identity.replaceAll("_", " ")}` : ""}.`}
                  </Item>
                ) : null}
                {textFrac !== null ? (
                  <Item ok={v.text_layer_ok === true}>
                    <Count k={`src:${source.source_id}:verification.inspection.text_layer_fraction`} n={textFrac} rate /> of its printed pages carry a text layer (
                    <Count k={`src:${source.source_id}:verification.inspection.pages_with_text_layer`} n={inspection?.pages_with_text_layer as number} /> of{" "}
                    <Count k={`src:${source.source_id}:verification.inspection.page_count`} n={inspection?.page_count as number} />
                    ), so tables are read from text, not from a scan.
                    {Array.isArray(inspection?.pages_without_text_layer) && (inspection!.pages_without_text_layer as unknown[]).length > 0 ? (
                      <>
                        {" "}
                        Pages without text: <Num kind="page">{(inspection!.pages_without_text_layer as number[]).join(", ")}</Num>.
                      </>
                    ) : null}
                  </Item>
                ) : null}
              </ul>
              <dl className="facts">
                <dt>File fingerprint (SHA-256)</dt>
                <dd>
                  <Num kind="id" className="hash">
                    {source.sha256}
                  </Num>{" "}
                  <CopyButton text={source.sha256} label="Copy" className="btn btn-text" />
                </dd>
                <dt>Size</dt>
                <dd>
                  <FileSize doc={doc} />
                  {doc.bytes !== null ? (
                    <>
                      {" "}
                      (<Count k={`src:${source.source_id}:size_bytes`} n={doc.bytes} /> bytes)
                    </>
                  ) : null}
                </dd>
                {created ? (
                  <>
                    <dt>Created (PDF metadata)</dt>
                    <dd>
                      <Num kind="date">{created}</Num>
                    </dd>
                  </>
                ) : null}
                <dt>Period</dt>
                <dd>
                  <DocPeriod doc={doc} />
                </dd>
                <dt>Role in this release</dt>
                <dd>{ROLE_WORDS[source.role] ?? source.role}</dd>
                <dt>The copy served here</dt>
                <dd>
                  {doc.file
                    ? {
                        local: "Copied at build time from the research team's registered file; its fingerprint matches the one above.",
                        cache: "Copied at build time from the build cache; its fingerprint matches the one above.",
                        official: "Downloaded at build time from the official address; its fingerprint matches the one above.",
                        archive: "Downloaded at build time from the Internet Archive copy; its fingerprint matches the one above.",
                      }[doc.file.via]
                    : rejected
                      ? "None: the file is not used."
                      : "None: no copy matching the fingerprint above could be obtained at build time."}
                </dd>
                <dt>Official file</dt>
                <dd>{source.file_url ? <ExternalLink href={source.file_url}>{source.verification_status.startsWith("wayback") ? "the official address (it no longer serves this file)" : "on the government site"}</ExternalLink> : "not recorded"}</dd>
                <dt>Internet Archive copy</dt>
                <dd>{source.wayback_url ? <ExternalLink href={source.wayback_url}>the archived copy</ExternalLink> : "none recorded"}</dd>
                {source.landing_url ? (
                  <>
                    <dt>Official page that lists it</dt>
                    <dd>
                      <ExternalLink href={source.landing_url}>the government page</ExternalLink>
                    </dd>
                  </>
                ) : null}
                <dt>Source id</dt>
                <dd className="mono">{source.source_id}</dd>
              </dl>
            </Disclosure>

            <Disclosure summary="Tables located and how much of each was captured" id="tables">
              {coverage.length === 0 ? (
                <p>No coverage has been measured for this document in this release.</p>
              ) : (
                <>
                  <p className="small measure">
                    Coverage counts the numbers printed in each table and how many our extraction captured. It says nothing about whether they are right; the
                    checks on each receipt do that. Overall: <Count k={`coverage:source:${source.source_id}`} n={cov.ratio} rate /> (
                    <Count k={`coverage:source:${source.source_id}:matched`} n={cov.matched} /> of <Count k={`coverage:source:${source.source_id}:printed`} n={cov.printed} />
                    ).
                  </p>
                  <TableWrap label="Coverage per table">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Table</th>
                          <th scope="col" className="num">
                            Page
                          </th>
                          <th scope="col">Coverage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverage.map((c, i) => (
                          <tr key={i}>
                            <th scope="row" style={{ fontWeight: 500 }}>
                              {c.table}
                            </th>
                            <td className="num">
                              <Num kind="page">{c.page}</Num>
                            </td>
                            <td>
                              <Bar
                                ratio={c.coverage}
                                label={
                                  <>
                                    <Count k={`covrow:${source.source_id}:${i}:coverage`} n={c.coverage} rate /> (<Count k={`covrow:${source.source_id}:${i}:matched`} n={c.matched} /> of{" "}
                                    <Count k={`covrow:${source.source_id}:${i}:printed_numeric_tokens`} n={c.printed_numeric_tokens} />)
                                  </>
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                </>
              )}
            </Disclosure>

            <Disclosure summary="Extraction runs" id="runs">
              {runs.length === 0 ? (
                <p>No validated extraction run exists for this document in this release.</p>
              ) : (
                <TableWrap label="Extraction runs">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Run</th>
                        <th scope="col">Tool</th>
                        <th scope="col">Mode</th>
                        <th scope="col" className="num">
                          Pages / tables
                        </th>
                        <th scope="col">Validated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map(({ id: r, m }) => (
                        <tr key={r}>
                          <th scope="row" className="mono" style={{ fontWeight: 400 }}>
                            <a href={`${DATA_BASE}/runs/${encodeURIComponent(r)}.manifest.json`}>
                              <Num kind="id">{r}</Num>
                            </a>
                          </th>
                          <td className="small">
                            {m ? <Num kind="id">{`${String(m.config?.extractor ?? "")} ${m.tool_versions?.[String(m.config?.extractor)] ?? ""}`}</Num> : "manifest not in release"}
                          </td>
                          <td className="small">{m?.run_mode ?? ""}</td>
                          <td className="num small">{m ? <Num kind="ui">{`${m.pages_emitted ?? "?"} / ${m.tables_emitted ?? "?"}`}</Num> : ""}</td>
                          <td className="small">{m ? m.validated ? <Num kind="ui">{`yes, ${m.errors?.count ?? 0} errors`}</Num> : "no" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Disclosure>
          </section>

          <section id="cite" aria-labelledby="cite-h">
            <h2 id="cite-h">Cite this document</h2>
            <Cite path={sourceHref(source.source_id)} source={source} heading={false} />
          </section>
        </div>
        <aside className="rail" aria-label="On this page">
          <Toc
            items={[
              ...(viewer ? [{ id: "viewer", label: "The document" }] : []),
              { id: "read", label: "What we read from it" },
              { id: "pages", label: <>Pages we read (<Count k={`pages:source:${source.source_id}`} n={pages.length} />)</> },
              { id: "provenance", label: "Where the file comes from" },
              { id: "cite", label: "Cite" },
            ]}
          />
          <section>
            <h2>Other {doc.kindName} documents</h2>
            <ul className="nb-list">
              {d.sources
                .filter((s) => s.doc_type === source.doc_type && s.source_id !== source.source_id)
                .map((s) => {
                  const o = libraryDoc(s.source_id);
                  return (
                    <li key={s.source_id}>
                      <Link href={sourceHref(s.source_id)} className="nb">
                        <span className="nb-k">{o ? <DocPeriod doc={o} /> : s.period}</span>
                        <span className="nb-v small">
                          {o?.state === "rejected" ? (
                            "not used"
                          ) : (s.pages_used ?? []).length ? (
                            <>
                              <Count k={`pages:source:${s.source_id}`} n={(s.pages_used ?? []).length} /> pp. read
                            </>
                          ) : (
                            "nothing read"
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </section>
        </aside>
      </div>
    </article>
  );
}
