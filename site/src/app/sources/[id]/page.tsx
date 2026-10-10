import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cite from "@/components/Cite";
import { DATA_BASE, db, obsHref, pageImage, runManifest, slugify, sourceHref } from "@/lib/data";
import { bytes, count, dateOnly, DOC_TYPE_WORDS, pct, ROLE_WORDS, verificationWords } from "@/lib/format";

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
  return { title: s ? s.title : "Source" };
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "not recorded";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default async function SourcePage({ params }: Props) {
  const { id } = await params;
  const source = find(id);
  if (!source) notFound();
  const d = db();
  const verif = verificationWords(source.verification_status);
  const v = (source.verification ?? {}) as Record<string, unknown>;
  const archive = (v.archive_copy ?? null) as Record<string, unknown> | null;
  const inspection = (v.inspection ?? null) as Record<string, unknown> | null;
  const response = (v.response ?? null) as Record<string, unknown> | null;
  const headers = (response?.headers ?? null) as Record<string, unknown> | null;
  const meta = (inspection?.pdf_metadata ?? null) as Record<string, unknown> | null;
  const coverage = d.coverage.filter((c) => c.source_id === source.source_id);
  const runs = (source.run_ids ?? []).map((r) => ({ id: r, manifest: runManifest(r) }));
  const pages = source.pages_used ?? [];
  const cells = d.cellsBySource.get(source.source_id) ?? [];
  const primaryObs = d.observations.filter((o) => o.published && o.primary_cell_id && d.cellById.get(o.primary_cell_id)?.source_id === source.source_id);

  return (
    <>
      <p className="eyebrow">
        <Link href="/sources">Sources</Link> / {DOC_TYPE_WORDS[source.doc_type] ?? source.doc_type}
      </p>
      <h1>{source.title}</h1>
      <p className="lede">
        {source.publisher}. Period {source.period}.
      </p>

      <div className={`notice ${verif.caveat ? "" : "notice-ok"}`} data-verification={source.verification_status}>
        <p>
          <strong>{verif.caveat ? "Caveat about this file." : "File verified."}</strong> {verif.text}
        </p>
      </div>
      {source.notes && (
        <div className="notice notice-plain">
          <p>
            <strong>Notes and caveats.</strong> {source.notes}
          </p>
        </div>
      )}

      <div className="actions">
        {source.file_url && (
          <a className="button" href={source.file_url}>
            Official file
          </a>
        )}
        {source.landing_url && (
          <a className="button" href={source.landing_url}>
            Official landing page
          </a>
        )}
        {source.wayback_url && (
          <a className="button" href={source.wayback_url}>
            Internet Archive snapshot
          </a>
        )}
      </div>
      <Cite path={sourceHref(source.source_id)} source={source} />

      <h2>The file</h2>
      <dl className="facts">
        <dt>Source id</dt>
        <dd className="mono">{source.source_id}</dd>
        <dt>Role in this release</dt>
        <dd>{ROLE_WORDS[source.role] ?? source.role}</dd>
        <dt>File fingerprint (SHA-256)</dt>
        <dd className="mono small">{source.sha256}</dd>
        <dt>Size</dt>
        <dd>{bytes(source.size_bytes)}</dd>
        <dt>Pages in the file</dt>
        <dd>{source.page_count ?? "not recorded"}</dd>
        <dt>Retrieved</dt>
        <dd>
          {dateOnly(source.retrieved_at)}
          {source.retrieved_via ? `, from: ${source.retrieved_via.replaceAll("-", " ")}` : ""}
        </dd>
        {source.wayback_timestamp && (
          <>
            <dt>Internet Archive snapshot time</dt>
            <dd>{source.wayback_timestamp}</dd>
          </>
        )}
      </dl>

      <h2>Verification details</h2>
      {source.verification ? (
        <dl className="facts">
          <dt>Verification status</dt>
          <dd className="mono small">{source.verification_status}</dd>
          {"identity_route" in v && (
            <>
              <dt>How the document was identified</dt>
              <dd>{show(v.identity_route).replaceAll("_", " ")}</dd>
            </>
          )}
          {"landing_page_links_file" in v && (
            <>
              <dt>Official landing page links to this file</dt>
              <dd>{show(v.landing_page_links_file)}</dd>
            </>
          )}
          {archive && (
            <>
              <dt>Independent archived copy</dt>
              <dd>
                {archive.identical === true ? "Identical to the official download." : archive.identical === false ? "Differs from the official download." : "Comparison not recorded."}{" "}
                {archive.sha256 ? <span className="mono small">SHA-256 {show(archive.sha256)}</span> : null}
              </dd>
            </>
          )}
          {response && (
            <>
              <dt>Download response</dt>
              <dd>
                HTTP status {show(response.http_status)}
                {headers?.["Last-Modified"] ? `; server says last modified ${show(headers["Last-Modified"])}` : ""}
              </dd>
            </>
          )}
          {inspection && (
            <>
              <dt>Text layer</dt>
              <dd>
                {show(inspection.pages_with_text_layer)} of {show(inspection.page_count)} pages have a text layer
              </dd>
              {"markers_ok" in inspection && (
                <>
                  <dt>Expected title words found on the first pages</dt>
                  <dd>{show(inspection.markers_ok)}</dd>
                </>
              )}
            </>
          )}
          {meta && (
            <>
              <dt>PDF metadata</dt>
              <dd className="small">
                {Object.entries(meta)
                  .map(([k, val]) => `${k}: ${show(val)}`)
                  .join("; ")}
              </dd>
            </>
          )}
        </dl>
      ) : (
        <p>No verification record is included in this release for this file.</p>
      )}

      <h2>Pages read</h2>
      {pages.length === 0 ? (
        <p>
          <span className="badge badge-gap-pending">Not yet read</span> No values have been read from this document in this release. Figures that
          depend on it are shown as gaps labelled &ldquo;Not yet verified by us&rdquo;.
        </p>
      ) : (
        <>
          <p>
            {count(pages.length)} {pages.length === 1 ? "page" : "pages"} read: {pages.join(", ")}. {count(cells.length)} printed cells recorded;{" "}
            {count(primaryObs.length)} published values use this document as their main source.
          </p>
          <ul>
            {pages.map((p) => {
              const img = pageImage(source.source_id, p);
              const first = primaryObs.find((o) => d.cellById.get(o.primary_cell_id!)?.page === p);
              return (
                <li key={p}>
                  Page {p}
                  {img ? (
                    <>
                      {" "}
                      &middot; <a href={img.src}>page image</a>
                    </>
                  ) : null}
                  {first ? (
                    <>
                      {" "}
                      &middot; <Link href={obsHref(first.obs_id)}>example receipt from this page</Link>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2>Coverage per table</h2>
      {coverage.length === 0 ? (
        <p>No coverage has been measured for this document in this release.</p>
      ) : (
        <>
          <p className="small">
            Coverage is how much of the printed table we captured: of the numbers printed in the table, how many appear in our extraction. It says
            nothing about whether they are right; that is what the checks are for.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Table</th>
                  <th scope="col">Page</th>
                  <th scope="col" className="num">
                    Numbers printed
                  </th>
                  <th scope="col" className="num">
                    Captured
                  </th>
                  <th scope="col" className="num">
                    Coverage
                  </th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((c, i) => (
                  <tr key={i}>
                    <th scope="row" style={{ whiteSpace: "normal" }}>
                      {c.table}
                    </th>
                    <td>{c.page}</td>
                    <td className="num">{count(c.printed_numeric_tokens)}</td>
                    <td className="num">{count(c.matched)}</td>
                    <td className="num">{pct(c.coverage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Extraction runs</h2>
      {runs.length === 0 ? (
        <p>No validated extraction run exists for this document in this release.</p>
      ) : (
        runs.map(({ id: runId, manifest: m }) => (
          <div key={runId} className="support">
            <h3 style={{ marginTop: 0 }} className="mono">
              {runId}
            </h3>
            {m ? (
              <dl className="facts">
                <dt>Tool</dt>
                <dd>
                  {show(m.config?.extractor)} {m.tool_versions?.[String(m.config?.extractor)] ?? ""}
                </dd>
                <dt>Mode</dt>
                <dd>{show(m.run_mode)}</dd>
                <dt>Started</dt>
                <dd>{show(m.started_at)}</dd>
                <dt>Duration</dt>
                <dd>{m.duration_s !== undefined ? `${m.duration_s} seconds` : "not recorded"}</dd>
                <dt>Pages and tables emitted</dt>
                <dd>
                  {show(m.pages_emitted)} pages, {show(m.tables_emitted)} tables
                </dd>
                <dt>Errors</dt>
                <dd>{show(m.errors?.count)}</dd>
                <dt>Passed structural validation</dt>
                <dd>{show(m.validated)}</dd>
                <dt>Configuration fingerprint</dt>
                <dd className="mono small">{show(m.config_sha256)}</dd>
                <dt>Full manifest</dt>
                <dd>
                  <a href={`${DATA_BASE}/runs/${encodeURIComponent(runId)}.manifest.json`}>Download JSON</a>
                </dd>
              </dl>
            ) : (
              <p className="small">The manifest file for this run is not included in this release.</p>
            )}
          </div>
        ))
      )}
    </>
  );
}
