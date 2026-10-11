// One source document: how we know the file is genuine (each check as a
// sentence), the pages this release reads from it, the tables located on
// them with their coverage, and the extraction runs.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Cite from "@/components/Cite";
import { Bar, Breadcrumbs, Callout, ExternalLink, TableWrap, Toc } from "@/components/ui/Basics";
import CopyButton from "@/components/ui/CopyButton";
import { VerifBadge } from "@/components/ui/Verif";
import { DATA_BASE, db, obsHref, pageImage, runManifest, slugify, sourceHref } from "@/lib/data";
import { bytes, count, dateOnly, DOC_TYPE_WORDS, pct, ROLE_WORDS } from "@/lib/format";
import { sourceCoverage, valuesFromSource, verifLong } from "@/lib/sources";

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
  return { title: s ? s.title : "Source", description: s ? `${s.title}, ${s.publisher}: how the file was verified, the pages read and the tables captured.` : undefined };
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

export default async function SourcePage({ params }: Props) {
  const { id } = await params;
  const source = find(id);
  if (!source) notFound();
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
  const firstObsOnPage = (p: number) =>
    d.observations.find((o) => o.published && o.primary_cell_id && d.cellById.get(o.primary_cell_id)?.source_id === source.source_id && d.cellById.get(o.primary_cell_id)?.page === p);
  const textFrac = typeof inspection?.text_layer_fraction === "number" ? (inspection.text_layer_fraction as number) : null;
  const identity = typeof v.identity_route === "string" ? v.identity_route : null;

  return (
    <article>
      <Breadcrumbs items={[{ href: "/sources", label: "Sources" }, { href: `/sources#t-${source.doc_type}`, label: DOC_TYPE_WORDS[source.doc_type] ?? source.doc_type }, { label: source.title }]} />
      <header className="page-head">
        <p className="kicker">{DOC_TYPE_WORDS[source.doc_type] ?? source.doc_type} · source document</p>
        <h1>{source.title}</h1>
        <p className="series-meta">
          <span>{source.publisher}</span>
          <span>Period {source.period}</span>
          {source.page_count ? <span>{source.page_count} pages</span> : null}
          <span>{ROLE_WORDS[source.role]?.split(":")[0] ?? source.role}</span>
        </p>
        <p>
          <VerifBadge status={source.verification_status} />
        </p>
        <p className="measure">{verifLong(source.verification_status)}</p>
        <div className="action-row no-print">
          {source.file_url && !source.verification_status.startsWith("wayback") ? (
            <ExternalLink className="btn btn-primary" href={source.file_url}>
              Official file
            </ExternalLink>
          ) : null}
          {source.wayback_url ? (
            <ExternalLink className={`btn${source.verification_status.startsWith("wayback") ? " btn-primary" : ""}`} href={source.wayback_url}>
              Internet Archive copy
            </ExternalLink>
          ) : null}
          {source.landing_url ? (
            <ExternalLink className="btn" href={source.landing_url}>
              Official page that lists it
            </ExternalLink>
          ) : null}
        </div>
      </header>

      {rejected ? (
        <Callout kind="caveat" title="This file is not used">
          <p>It failed inspection, so no figure on this site is read from it. It stays listed so the rejection is on the record.</p>
        </Callout>
      ) : null}
      {source.notes ? (
        <Callout kind="caveat" title="About this file">
          <p>{source.notes}</p>
        </Callout>
      ) : null}

      <div className="with-rail">
        <div>
          <section id="genuine" aria-labelledby="genuine-h">
            <h2 id="genuine-h">How we know this is the genuine file</h2>
            <ul className="vchecks">
              <Item ok={source.retrieved_via === "official"}>
                Downloaded {source.retrieved_via === "official" ? "from the official address" : source.retrieved_via === "wayback" ? "from the Internet Archive, because the official address did not respond" : `via ${String(source.retrieved_via ?? "an unrecorded route").replaceAll("-", " ")}`} on{" "}
                {dateOnly(source.retrieved_at)}
                {response?.http_status ? ` (the server answered ${String(response.http_status)})` : ""}.
                {source.file_url ? (
                  <span className="vcheck-url mono">{source.file_url}</span>
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
                  {wayback.digest_matches_file === true
                    ? `An Internet Archive snapshot from ${waybackDate(wayback.wayback_timestamp) ?? "an unrecorded date"} holds exactly the same bytes (the archive's own fingerprint matches).`
                    : wayback.wayback_url
                      ? `An Internet Archive snapshot exists (${waybackDate(wayback.wayback_timestamp) ?? "date not recorded"}), but its fingerprint was not matched to this file.`
                      : "No Internet Archive snapshot was found."}
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
                  {pct(textFrac)} of its printed pages carry a text layer ({String(inspection?.pages_with_text_layer ?? "?")} of {String(inspection?.page_count ?? "?")}), so tables are read from text, not from a scan.
                  {Array.isArray(inspection?.pages_without_text_layer) && (inspection!.pages_without_text_layer as unknown[]).length > 0
                    ? ` Pages without text: ${(inspection!.pages_without_text_layer as number[]).join(", ")}.`
                    : ""}
                </Item>
              ) : null}
            </ul>
            <dl className="facts">
              <dt>File fingerprint (SHA-256)</dt>
              <dd>
                <span className="hash">{source.sha256}</span> <CopyButton text={source.sha256} label="Copy" className="btn btn-text" />
              </dd>
              <dt>Size</dt>
              <dd>{bytes(source.size_bytes)}</dd>
              {created ? (
                <>
                  <dt>Created (PDF metadata)</dt>
                  <dd>{created}</dd>
                </>
              ) : null}
              <dt>Source id</dt>
              <dd className="mono">{source.source_id}</dd>
            </dl>
          </section>

          <section id="pages" aria-labelledby="pages-h">
            <h2 id="pages-h">Pages read in this release</h2>
            {pages.length === 0 ? (
              <p className="measure">No values are read from this document in this release. Figures that depend on it are labelled gaps.</p>
            ) : (
              <>
                <p className="measure">
                  {count(pages.length)} {pages.length === 1 ? "page" : "pages"} read; {count(values)} published {values === 1 ? "value has" : "values have"} this document as
                  their main printing. Select a page to see a receipt from it.
                </p>
                <ul className="thumbs">
                  {pages.map((p) => {
                    const img = pageImage(source.source_id, p);
                    const o = firstObsOnPage(p);
                    const href = o ? obsHref(o.obs_id) : (img?.src ?? "#");
                    return (
                      <li key={p}>
                        <a href={href}>
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img.src} alt={`Page ${p} of ${source.title}`} width={img.width} height={img.height} loading="lazy" decoding="async" />
                          ) : (
                            <span className="chart-empty" style={{ display: "block", aspectRatio: "0.77" }} />
                          )}
                          <span className="t-cap">
                            Page {p}
                            {o ? " · a receipt" : img ? " · the image" : ""}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section id="tables" aria-labelledby="tables-h">
            <h2 id="tables-h">Tables located and how much of each was captured</h2>
            {coverage.length === 0 ? (
              <p>No coverage has been measured for this document in this release.</p>
            ) : (
              <>
                <p className="small measure">
                  Coverage counts the numbers printed in each table and how many our extraction captured. It says nothing about whether they are
                  right; the checks on each receipt do that. Overall: {pct(cov.ratio)} ({count(cov.matched)} of {count(cov.printed)}).
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
                          <td className="num">{c.page}</td>
                          <td>
                            <Bar ratio={c.coverage} label={`${pct(c.coverage)} (${count(c.matched)} of ${count(c.printed_numeric_tokens)})`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </>
            )}
          </section>

          <section id="runs" aria-labelledby="runs-h">
            <h2 id="runs-h">Extraction runs</h2>
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
                          <a href={`${DATA_BASE}/runs/${encodeURIComponent(r)}.manifest.json`}>{r}</a>
                        </th>
                        <td className="small">
                          {m ? `${String(m.config?.extractor ?? "")} ${m.tool_versions?.[String(m.config?.extractor)] ?? ""}` : "manifest not in release"}
                        </td>
                        <td className="small">{m?.run_mode ?? ""}</td>
                        <td className="num small">{m ? `${m.pages_emitted ?? "?"} / ${m.tables_emitted ?? "?"}` : ""}</td>
                        <td className="small">{m ? (m.validated ? `yes, ${m.errors?.count ?? 0} errors` : "no") : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </section>

          <section id="cite" aria-labelledby="cite-h">
            <h2 id="cite-h">Cite this document</h2>
            <Cite path={sourceHref(source.source_id)} source={source} heading={false} />
          </section>
        </div>
        <aside className="rail" aria-label="On this page">
          <Toc
            items={[
              { id: "genuine", label: "Is it genuine?" },
              { id: "pages", label: `Pages read (${pages.length})` },
              { id: "tables", label: "Tables and coverage" },
              { id: "runs", label: "Extraction runs" },
              { id: "cite", label: "Cite" },
            ]}
          />
          <section>
            <h2>Other {DOC_TYPE_WORDS[source.doc_type] ?? "documents"}</h2>
            <ul className="nb-list">
              {d.sources
                .filter((s) => s.doc_type === source.doc_type && s.source_id !== source.source_id)
                .map((s) => (
                  <li key={s.source_id}>
                    <Link href={sourceHref(s.source_id)} className="nb">
                      <span className="nb-k">{s.period}</span>
                      <span className="nb-v small">{(s.pages_used ?? []).length ? `${(s.pages_used ?? []).length} pp.` : "not read"}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        </aside>
      </div>
    </article>
  );
}
