// The receipt: one figure, where it is printed, how it was checked, and how to
// take it away. The flagship page of the site.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Cite from "@/components/Cite";
import { Breadcrumbs, Callout, Disclosure, DownloadLink, ExternalLink, TableWrap, Toc, type TocItem } from "@/components/ui/Basics";
import CopyButton from "@/components/ui/CopyButton";
import { ReportLink } from "@/components/chrome/Chrome";
import { DocCrop, DocPage } from "@/components/ui/PageFrame";
import { StatusBadge, StatusMark } from "@/components/ui/Status";
import { cite } from "@/lib/cite";
import {
  datasetName,
  db,
  disputedCells,
  ISSUES_URL,
  isDatasetPublished,
  cropGuides,
  neighbours,
  obsAt,
  obsForCell,
  obsHref,
  pageImage,
  pageShort,
  pageWords,
  receiptCsvHref,
  receiptJsonHref,
  RELEASE_VERSION,
  seriesHref,
  slugify,
  sourceHref,
  type Cell,
  type Check,
  type Observation,
  type Series,
  type Source,
} from "@/lib/data";
import {
  CHECK_TYPE_WORDS,
  dateOnly,
  formatDecimalString,
  GAP_EXPLAIN,
  humanAmount,
  periodWords,
  TIER_WORDS,
  unitLabel,
  verificationWords,
  vintageLong,
  vintageWords,
} from "@/lib/format";
import { statusOf } from "@/lib/status";

export const dynamicParams = false;

export function generateStaticParams() {
  const d = db();
  return d.observations
    .filter((o) => {
      const s = d.seriesById.get(o.series_id);
      return s && isDatasetPublished(s.dataset);
    })
    .map((o) => ({ id: slugify(o.obs_id) }));
}

type Props = { params: Promise<{ id: string }> };

function find(id: string): Observation | undefined {
  const d = db();
  return d.obsBySlug.get(id) ?? d.obsBySlug.get(decodeURIComponent(id));
}

/** "Health (current, revenue account), 2025-26, budget estimate" */
function obsTitle(o: Observation, s: Series | undefined): string {
  return `${s?.name ?? o.series_id}, ${periodWords(o.period, s?.frequency)}${o.vintage !== "na" ? `, ${vintageWords(o.vintage).toLowerCase()}` : ""}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const o = find((await params).id);
  if (!o) return { title: "Receipt" };
  const s = db().seriesById.get(o.series_id);
  const info = statusOf(o);
  const fig = o.published && o.value !== null ? `${formatDecimalString(o.value)} ${unitLabel(o.unit, o.scale_factor)}` : info.label;
  return {
    title: `${obsTitle(o, s)}: receipt`,
    description: `${fig}. ${o.evidence_summary ?? info.meaning} Where it is printed in the government document, the checks it passed, and how to cite it.`,
  };
}

/* ------------------------------------------------------------------ */

const RESULT_WORDS: Record<string, string> = {
  pass: "Passed",
  pass_within_rounding: "Passed within the stated tolerance",
  fail: "Failed",
  not_evaluable: "Could not be run",
  disputed: "Printings disagree",
};

function ResultMark({ result }: { result: string }) {
  const k = result === "pass" || result === "pass_within_rounding" ? "checked" : result === "fail" ? "withheld" : result === "disputed" ? "disputed" : "unknown";
  const cls = k === "checked" ? "st--checked" : k === "disputed" ? "st--disputed" : k === "withheld" ? "st--withheld" : "st--unknown";
  return (
    <span className={`st ${cls}`}>
      <StatusMark k={k} />
      <span className="st-label">{RESULT_WORDS[result] ?? result.replaceAll("_", " ")}</span>
    </span>
  );
}

/** "a sum and a second printing": built from the checks that passed, so the
 * headline never claims a kind of evidence the figure does not have. */
function evidenceWords(checks: Check[]): string | null {
  const kinds: string[] = [];
  const add = (k: string) => {
    if (!kinds.includes(k)) kinds.push(k);
  };
  for (const c of checks) {
    if (c.official === false || (c.result !== "pass" && c.result !== "pass_within_rounding")) continue;
    if (["column_total", "row_total", "hierarchy_sum", "accounting_identity"].includes(c.check_type)) add("a sum");
    else if (c.check_type === "cross_edition") add("a second printing in another edition");
    else if (c.check_type === "cross_table") add("a second printing in another table");
    else if (c.check_type === "cross_source") add("another official source");
    else if (c.check_type === "index_aggregation") add("recomputing the weighted average");
    else if (c.check_type === "recompute") add("a recomputed rate");
    else if (c.check_type === "weights_sum") add("weights that add up");
    else if (c.check_type === "reference_value") continue; // earns no status by itself
    else add(c.check_type.replaceAll("_", " "));
  }
  if (kinds.length === 0) return null;
  kinds.sort((a, b) => (a === "a sum" ? -1 : b === "a sum" ? 1 : 0));
  return kinds.length === 1 ? kinds[0] : `${kinds.slice(0, -1).join(", ")} and ${kinds[kinds.length - 1]}`;
}

function srcShort(src: Source | undefined, id: string) {
  return src?.title ?? id;
}

/** One printed cell inside a check: its value only if that figure is itself
 * published (or it is not a series figure at all, such as a printed total
 * used only by the check). An unpublished figure never shows a number. */
function MemberRow({ cell, highlight, role }: { cell: Cell; highlight: boolean; role?: string }) {
  const d = db();
  const o = obsForCell(cell.cell_id);
  const src = d.sourceById.get(cell.source_id);
  const showValue = !o || (o.published && o.value !== null);
  const info = o ? statusOf(o) : null;
  return (
    <tr className={highlight ? "is-this" : undefined}>
      <th scope="row" style={{ fontWeight: highlight ? 650 : 500 }}>
        {cell.row_label_raw ?? "row label not recorded"}
        {role ? <span className="break-tag">{role}</span> : null}
        {highlight ? <span className="break-tag">This figure</span> : null}
      </th>
      <td className="small muted">
        {srcShort(src, cell.source_id)}, {pageShort(cell)}
      </td>
      <td className="num">
        {showValue ? (
          o && o.published ? (
            <Link href={obsHref(o.obs_id)} className="v-link">
              {cell.value_raw}
            </Link>
          ) : (
            cell.value_raw
          )
        ) : info ? (
          <Link href={obsHref(o!.obs_id)}>
            <StatusBadge info={info} short />
          </Link>
        ) : null}
      </td>
    </tr>
  );
}

function CheckItem({ check, obs }: { check: Check; obs: Observation }) {
  const d = db();
  const own = new Set([obs.primary_cell_id, ...obs.supporting_cell_ids].filter(Boolean) as string[]);
  const members = check.member_cell_ids.map((id) => d.cellById.get(id)).filter((c): c is Cell => !!c);
  const target = check.target_cell_id ? d.cellById.get(check.target_cell_id) : undefined;
  const isEdition = check.check_type === "cross_edition" || check.check_type === "cross_source" || check.check_type === "cross_table";
  const where = target ?? members[0];
  const whereSrc = where ? d.sourceById.get(where.source_id) : undefined;
  return (
    <li className="check" data-check-result={check.result}>
      <div className="check-head">
        <ResultMark result={check.result} />
        <span className="label">{CHECK_TYPE_WORDS[check.check_type] ?? check.check_type.replaceAll("_", " ")}</span>
        {check.official === false ? <span className="small muted">comparison only; does not affect the status</span> : null}
      </div>
      {where && !isEdition ? (
        <p className="check-where">
          {srcShort(whereSrc, where.source_id)}, page {where.page}
        </p>
      ) : null}
      <p className="check-desc">{check.description}</p>
      {check.result === "pass_within_rounding" && check.tolerance_rule ? <p className="check-tol">Tolerance: {check.tolerance_rule}</p> : null}
      {check.result === "not_evaluable" && check.not_evaluable_reason ? <p className="small">Why it could not run: {check.not_evaluable_reason}</p> : null}
      <Disclosure summary={isEdition ? "Show both printings" : "Show the arithmetic"} meta={`${members.length + (target ? 1 : 0)} printed figures`}>
        <TableWrap label={`Figures used by check ${check.check_id}`}>
          <table>
            <thead>
              <tr>
                <th scope="col">{isEdition ? "Printing" : "Row as printed"}</th>
                <th scope="col">Where</th>
                <th scope="col" className="num">
                  Printed
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((c) => (
                <MemberRow key={c.cell_id} cell={c} highlight={own.has(c.cell_id)} role={isEdition ? undefined : undefined} />
              ))}
              {target ? <MemberRow cell={target} highlight={own.has(target.cell_id)} role={isEdition ? undefined : "Printed total"} /> : null}
            </tbody>
          </table>
        </TableWrap>
        <dl className="facts">
          {!isEdition && check.residual !== null ? (
            <>
              <dt>Difference</dt>
              <dd className="tnum">
                {formatDecimalString(check.residual)} {check.residual === "0" ? "(exact)" : ""}
              </dd>
            </>
          ) : null}
          {check.target_value ? (
            <>
              <dt>Reference value</dt>
              <dd>
                <span className="mono">{check.target_value}</span>
                {check.target_source ? `, from ${check.target_source}` : ""}
              </dd>
            </>
          ) : null}
          {check.tolerance_rule ? (
            <>
              <dt>Rule, fixed before any result was seen</dt>
              <dd>{check.tolerance_rule}</dd>
            </>
          ) : null}
          <dt>Check id</dt>
          <dd className="mono">{check.check_id}</dd>
        </dl>
      </Disclosure>
    </li>
  );
}

function Section({ id, title, children, lead }: { id: string; title: string; children: ReactNode; lead?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      {lead ? <p className="measure">{lead}</p> : null}
      {children}
    </section>
  );
}

/** A printing of the figure in another document: caption + crop. */
function Printing({ cell, label }: { cell: Cell; label: ReactNode }) {
  const d = db();
  const src = d.sourceById.get(cell.source_id);
  const img = pageImage(cell.source_id, cell.page);
  return (
    <div className="printing">
      <p className="printing-head">
        {label}{" "}
        <span>
          <Link href={sourceHref(cell.source_id)}>{srcShort(src, cell.source_id)}</Link>, {pageWords(cell, src?.page_count)}. Row &ldquo;{cell.row_label_raw}&rdquo;, column &ldquo;{cell.col_label_raw}&rdquo;. Printed{" "}
          <span className="mono" data-printed>
            {cell.value_raw}
          </span>
          .
        </span>
      </p>
      {img ? <DocCrop image={img} cell={cell} guides={cropGuides(cell)} alt={`Close-up of page ${cell.page} of ${srcShort(src, cell.source_id)}, the figure ${cell.value_raw} boxed in its row.`} rows={2} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default async function ReceiptPage({ params }: Props) {
  const { id } = await params;
  const obs = find(id);
  if (!obs) notFound();
  const d = db();
  const series = d.seriesById.get(obs.series_id);
  if (!series) notFound();

  const info = statusOf(obs);
  const isValue = info.key === "checked";
  const isDisputed = info.key === "disputed";
  const cell = obs.primary_cell_id ? d.cellById.get(obs.primary_cell_id) : undefined;
  const source = cell ? d.sourceById.get(cell.source_id) : undefined;
  // A page render is shown for a value, and for a gap the government did not
  // publish (the page then shows the dash or blank that proves it). Never for
  // a figure that is unverified or withheld: its reading is not published.
  const showPage = !!cell && (isValue || (info.key === "gap-source" && !cell.value_parsed));
  const image = cell && showPage ? pageImage(cell.source_id, cell.page) : null;
  const checks = obs.check_ids.map((c) => d.checkById.get(c)).filter((c): c is Check => !!c);
  const supporting = isValue ? obs.supporting_cell_ids.map((c) => d.cellById.get(c)).filter((c): c is Cell => !!c) : [];
  const readings = isDisputed ? disputedCells(obs) : [];
  const inputs = obs.derived_from.map((i) => d.obsById.get(i)).filter((o): o is Observation => !!o);
  const unit = unitLabel(obs.unit, obs.scale_factor);
  const path = obsHref(obs.obs_id);
  const verif = source ? verificationWords(source.verification_status) : null;
  const parent = series.parent_id ? d.seriesById.get(series.parent_id) : undefined;
  const nb = neighbours(obs);
  const otherVintages = (d.obsBySeries.get(series.series_id) ?? []).filter((o) => o.period === obs.period && o.vintage !== obs.vintage);
  const parentObs = parent ? obsAt(parent.series_id, obs.period, obs.vintage) : undefined;
  const siblings = parent ? (d.childrenOf.get(parent.series_id) ?? []).filter((s) => !s.derived && s.series_id !== series.series_id) : [];
  const siblingObs = siblings.map((s) => ({ s, o: obsAt(s.series_id, obs.period, obs.vintage) })).filter((x) => x.o);
  const pWords = periodWords(obs.period, series.frequency);
  const vintage = obs.vintage !== "na" ? vintageWords(obs.vintage).toLowerCase() : null;
  const title = obsTitle(obs, series);
  const apa = cite({ release: d.release, path, what: `Observation ${obs.obs_id}`, source: isValue ? source : null, page: isValue ? cell?.page : null, pageLabel: isValue ? cell?.page_label : null }).apa;

  const evidence = evidenceWords(checks);
  const officialWorks = !(source?.verification_status ?? "").startsWith("wayback") && source?.verification_status !== "archive_copy_content_inspected";
  const tableTitle = cell ? d.coverage.find((c) => c.source_id === cell.source_id && c.page === cell.page)?.table : undefined;
  const ordOf = (p: string) => p;
  const breakBetween = (a: string, b: string) => series.breaks.some((br) => ordOf(a) < br.at_period && br.at_period <= ordOf(b));
  const between = (a: string, b: string) => series.breaks.find((br) => a < br.at_period && br.at_period <= b);
  const breakNear = (nb.prev ? between(nb.prev.period, obs.period) : undefined) ?? (nb.next ? between(obs.period, nb.next.period) : undefined) ?? null;
  const caveats: ReactNode[] = [];
  if (obs.notes) caveats.push(<span key="obs">{obs.notes}</span>);
  if (series.notes) caveats.push(<span key="ser">{series.notes}</span>);
  for (const b of series.breaks)
    caveats.push(
      <span key={`b${b.at_period}`}>
        <strong>Series break from {periodWords(b.at_period, series.frequency)}</strong> ({b.kind.replaceAll("_", " ")}): {b.note}
        {obs.period < b.at_period ? " This figure is before the break." : " This figure is from the break onwards."}
      </span>,
    );
  if (source?.notes) caveats.push(<span key="src">About the document: {source.notes}</span>);
  if (verif?.caveat) caveats.push(<span key="ver">{verif.text}</span>);
  if (series.definition_status && series.definition_status !== "reviewed")
    caveats.push(<span key="def">The series definition is a draft and has not yet been reviewed by a person.</span>);

  const toc: TocItem[] = [
    ...(showPage && image ? [{ id: "page", label: "Where it is printed" }] : []),
    ...(isDisputed ? [{ id: "printings", label: "The printings that disagree" }] : []),
    ...(isValue && series.derived ? [{ id: "computed", label: "How it was computed" }] : []),
    { id: "checks", label: `Checks (${checks.length})` },
    ...(supporting.length ? [{ id: "also", label: "The other printing" }] : []),
    ...(caveats.length ? [{ id: "caveats", label: "Caveats" }] : []),
    { id: "provenance", label: "Provenance" },
    { id: "cite", label: "Cite and download" },
  ];

  return (
    <article className="receipt" data-status={info.key}>
      <Breadcrumbs
        items={[
          { href: "/browse", label: "Browse" },
          { href: `/browse?dataset=${series.dataset}`, label: datasetName(series.dataset) },
          ...(parent ? [{ href: seriesHref(parent.series_id), label: parent.name }] : []),
          { href: seriesHref(series.series_id), label: series.name },
          { label: `${pWords}${vintage ? `, ${vintage}` : ""}` },
        ]}
      />
      <p className="print-only small">
        Receipt printed from the LUMS DataLab Portal (prototype), release {RELEASE_VERSION}. Page {path}
      </p>

      {/* ---------------- head: the figure, its status, the close-up ---------------- */}
      <header className={`receipt-top${image ? " has-crop" : ""}`}>
        <div className="receipt-id">
          <p className="kicker">Receipt for one {isValue ? "published figure" : "figure"}</p>
          <h1 className="receipt-title">{series.name}</h1>
          <p className="receipt-when">
            {datasetName(series.dataset)} · <Link href={seriesHref(series.series_id)}>the whole series</Link>
          </p>
          <p className="figure-kind">
            {vintage ? `${vintageWords(obs.vintage)} for ${pWords}` : pWords}
            {cell && source && source.period && !source.period.startsWith(obs.period.slice(0, 7)) && isValue ? (
              <span className="muted"> · as printed in {srcShort(source, cell.source_id)}</span>
            ) : null}
          </p>

          {isValue ? (
            <div className="figure" data-receipt-value>
              <p className="figure-v tnum">
                {formatDecimalString(obs.value)}
                <span className="figure-u">{unit}</span>
              </p>
              {obs.unit === "PKR" && (obs.scale_factor ?? 1) >= 1000000 && Number.isFinite(Number(obs.value)) ? (
                <p className="figure-human">That is about {humanAmount(Number(obs.value), obs.unit, obs.scale_factor)}.</p>
              ) : null}
            </div>
          ) : (
            <div className={`figure figure-gap ${info.key === "gap-source" ? "fill-gap-source" : info.key === "gap-pending" ? "fill-gap-pending" : info.key === "withheld" ? "fill-withheld" : info.key === "disputed" ? "fill-disputed" : ""}`} data-receipt-gap={obs.gap_kind ?? (isDisputed ? "disputed" : "unknown")} {...(isDisputed ? { "data-receipt-disputed": "" } : {})}>
              <p className="figure-none">
                {isDisputed ? (
                  "Official printings disagree"
                ) : info.key === "gap-source" && cell && showPage ? (
                  <>
                    Printed as <span className="figure-glyph">{cell.value_raw?.trim() || "(blank)"}</span>, not as a number
                  </>
                ) : (
                  "No value in this release"
                )}
              </p>
              {isDisputed && readings.length > 0 ? (
                <table className="disputed-table">
                  <caption className="sr-only">Every printing of this figure</caption>
                  <thead>
                    <tr>
                      <th scope="col">Document</th>
                      <th scope="col">Pages</th>
                      <th scope="col" className="num">
                        Printed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...new Map(readings.map((c) => [`${c.source_id}|${c.value_raw}`, c])).values()].map((c) => (
                      <tr key={`${c.source_id}|${c.value_raw}`}>
                        <th scope="row">{srcShort(d.sourceById.get(c.source_id), c.source_id)}</th>
                        <td>
                          {readings
                            .filter((r) => r.source_id === c.source_id && r.value_raw === c.value_raw)
                            .map((r) => r.page)
                            .join(", ")}
                        </td>
                        <td className="num">
                          <span className="mono" data-printed>
                            {c.value_raw}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          )}

        </div>

        {image && cell ? (
          <div className="receipt-crop">
            <DocCrop image={image} cell={cell} rows={3} guides={cropGuides(cell)} alt={`Close-up of page ${cell.page} of ${srcShort(source, cell.source_id)}: the row "${cell.row_label_raw}" with the figure ${cell.value_raw} boxed.`} />
            <p className="small muted" style={{ marginTop: 4 }}>
              Close-up of page {cell.page}, magnified. <a href="#page">See the page</a>.
            </p>
          </div>
        ) : null}

        <div className="receipt-more">
          <div className="receipt-status">
            <StatusBadge info={info} detail={isValue && evidence ? `verified by ${evidence}` : null} />
            <p>
              {isValue || isDisputed
                ? (obs.evidence_summary ?? info.meaning)
                : info.key === "gap-source" && cell && showPage
                  ? "The document prints a dash (or nothing) in this cell. We show no value rather than reading the dash as zero; where a printed total depends on it, the total's own receipt says how it was checked."
                  : obs.gap_kind && GAP_EXPLAIN[obs.gap_kind]
                    ? GAP_EXPLAIN[obs.gap_kind]
                    : info.meaning}
            </p>
            {!isValue && obs.gap_reason ? (
              <p className="small">
                <strong>Recorded reason:</strong> {obs.gap_reason}
              </p>
            ) : null}
          </div>

          {breakNear ? (
            <p className="receipt-break small">
              <strong>Series break from {periodWords(breakNear.at_period, series.frequency)}</strong> ({breakNear.kind.replaceAll("_", " ")}): figures before and after it are not comparable.{" "}
              <a href="#caveats">Why</a>
            </p>
          ) : null}

          {isValue && cell ? (
            <p className="receipt-printed small">
              Printed as{" "}
              <span className="mono" data-printed>
                {cell.value_raw}
              </span>{" "}
              on {pageWords(cell)} of <Link href={sourceHref(cell.source_id)}>{srcShort(source, cell.source_id)}</Link>, row &ldquo;{cell.row_label_raw}&rdquo;,
              column &ldquo;{cell.col_label_raw}&rdquo;.
            </p>
          ) : null}

          <div className="action-row no-print">
            <CopyButton text={apa} label="Copy citation (APA)" className="btn btn-primary" />
            <CopyButton text={path} origin label="Copy link" />
            <DownloadLink href={receiptJsonHref(obs.obs_id)}>JSON</DownloadLink>
            <DownloadLink href={receiptCsvHref(obs.obs_id)}>CSV row</DownloadLink>
          </div>
          <nav className="receipt-steps no-print" aria-label="Neighbouring figures">
            {nb.prev ? (
              <Link href={obsHref(nb.prev.obs_id)} rel="prev">
                ‹ {periodWords(nb.prev.period, series.frequency)}
                {breakBetween(nb.prev.period, obs.period) ? <span className="step-break"> (before the break)</span> : null}
              </Link>
            ) : (
              <span className="muted">No earlier figure in this release</span>
            )}
            {nb.next ? (
              <Link href={obsHref(nb.next.obs_id)} rel="next">
                {periodWords(nb.next.period, series.frequency)}
                {breakBetween(obs.period, nb.next.period) ? <span className="step-break"> (after the break)</span> : null} ›
              </Link>
            ) : (
              <span className="muted">No later figure in this release</span>
            )}
            <ReportLink issuesUrl={ISSUES_URL} version={RELEASE_VERSION}>
              Report a problem with this figure
            </ReportLink>
          </nav>
                </div>
      </header>

      <div className="with-rail">
        <div className="receipt-body">
          {/* ---------------- the page ---------------- */}
          {image && cell ? (
            <Section id="page" title="Where it is printed">
              <DocPage
                image={image}
                cell={cell}
                eager={false}
                title={srcShort(source, cell.source_id)}
                pageCount={source?.page_count}
                alt={`Page ${cell.page} of ${srcShort(source, cell.source_id)}${isValue ? `, with the figure ${cell.value_raw} boxed` : ", with the empty cell boxed"} in the row "${cell.row_label_raw}" and the column "${cell.col_label_raw}". The dashed outline marks the table it was read from.`}
                caption={
                  <>
                    What you are looking at: a picture of {pageWords(cell)}, made from the copy whose fingerprint is recorded below. The solid box marks{" "}
                    {isValue ? "the figure" : "the cell, which prints no figure"}; the dashed outline the table it was read from. Select the page to see all of it, enlarged.
                  </>
                }
              />
              {source ? (
                <div className="source-line">
                  <p className="small measure">
                    <strong>Is this the genuine document?</strong> {verif?.text}
                  </p>
                  <div className="action-row">
                    {source.wayback_url && !officialWorks ? (
                      <ExternalLink className="btn" href={source.wayback_url}>
                        Internet Archive copy (the file used)
                      </ExternalLink>
                    ) : null}
                    {source.file_url && officialWorks ? (
                      <ExternalLink className="btn" href={source.file_url}>
                        Official PDF (go to page {cell.page})
                      </ExternalLink>
                    ) : null}
                    {source.wayback_url && officialWorks ? (
                      <ExternalLink className="btn" href={source.wayback_url}>
                        Internet Archive copy
                      </ExternalLink>
                    ) : null}
                    {source.file_url && !officialWorks ? (
                      <span className="small muted">
                        Official address, not responding when retrieved: <span className="mono">{source.file_url}</span>
                      </span>
                    ) : null}
                    <Link className="btn btn-text" href={sourceHref(source.source_id)}>
                      Our record of this document
                    </Link>
                  </div>
                </div>
              ) : null}
            </Section>
          ) : null}

          {/* ---------------- disputed: every printing, none as the answer ---------------- */}
          {isDisputed ? (
            <Section
              id="printings"
              title="The printings that disagree"
              lead="Each of these official printings adds up in its own table, and they do not agree with each other. We list every one and do not choose between them. The government's own errata, if any, decide."
            >
              {readings.length > 0 ? (
                readings.map((c, i) => <Printing key={c.cell_id} cell={c} label={<strong>Printing {i + 1}.</strong>} />)
              ) : (
                <p>The printings are not listed in this release.</p>
              )}
            </Section>
          ) : null}

          {/* ---------------- computed ---------------- */}
          {isValue && series.derived ? (
            <Section id="computed" title="How it was computed">
              <p className="measure">
                The government does not print this figure. It is computed by code from checked figures
                {series.derivation ? (
                  <>
                    {" "}
                    with the formula <code>{series.derivation.formula}</code>
                  </>
                ) : null}
                . Each input has its own receipt.
              </p>
              {inputs.length > 0 ? (
                <TableWrap label="Inputs of this computed figure">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Input</th>
                        <th scope="col" className="num">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inputs.map((i) => {
                        const s = d.seriesById.get(i.series_id);
                        return (
                          <tr key={i.obs_id}>
                            <th scope="row">{obsTitle(i, s)}</th>
                            <td className="num">
                              <Link href={obsHref(i.obs_id)} className="v-link">
                                {i.published && i.value !== null ? `${formatDecimalString(i.value)} ${unitLabel(i.unit, i.scale_factor)}` : statusOf(i).label}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              ) : null}
            </Section>
          ) : null}

          {/* ---------------- checks ---------------- */}
          <Section
            id="checks"
            title="The checks it took part in"
            lead={
              checks.length === 0
                ? isValue && series.derived
                  ? "A computed figure has no checks of its own; each input has its own receipt and checks."
                  : "No check covers this figure in this release."
                : `Each check is a fixed rule run by code over the printed figures. ${checks.length === 1 ? "This figure took part in one check." : `This figure took part in ${checks.length} checks.`} A passing sum confirms every number in it at once.`
            }
          >
            {checks.length > 0 ? (
              <ol className="checks-list">
                {checks.map((c) => (
                  <CheckItem key={c.check_id} check={c} obs={obs} />
                ))}
              </ol>
            ) : null}
            {isValue && obs.tier ? <p className="small muted measure">{TIER_WORDS[obs.tier] ?? `Tier ${obs.tier}.`} No language model wrote this figure or decided whether it passes.</p> : null}
          </Section>

          {/* ---------------- other printings ---------------- */}
          {supporting.length > 0 ? (
            <Section id="also" title="The other printing, close up" lead="The same figure as printed in another official document or table. The check above compares the two.">
              {supporting.map((c) => (
                <Printing key={c.cell_id} cell={c} label={null} />
              ))}
            </Section>
          ) : null}

          {/* ---------------- caveats ---------------- */}
          {caveats.length > 0 ? (
            <Section id="caveats" title="Caveats">
              <Callout kind="caveat">
                <ul className="caveat-list">
                  {caveats.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </Callout>
            </Section>
          ) : null}

          {/* ---------------- provenance ---------------- */}
          <Section id="provenance" title="Provenance">
            <dl className="facts">
              <dt>Figure</dt>
              <dd>
                {title}
                <br />
                <span className="mono">{obs.obs_id}</span>
              </dd>
              <dt>Kind of figure</dt>
              <dd>{vintageLong(obs.vintage)}</dd>
              <dt>Unit and scale</dt>
              <dd>
                {unit}
                {obs.scale_factor && obs.scale_factor !== 1 ? ` (multiply the printed number by ${formatDecimalString(String(obs.scale_factor))} for the full amount)` : ""}
              </dd>
              {cell && (isValue || showPage) ? (
                <>
                  <dt>Document</dt>
                  <dd>
                    <Link href={sourceHref(cell.source_id)}>{srcShort(source, cell.source_id)}</Link>
                    {source ? `, ${source.publisher}` : ""}
                  </dd>
                  <dt>Page</dt>
                  <dd>
                    {pageWords(cell, source?.page_count)}; table {cell.table_index + 1} on the page
                  </dd>
                  {tableTitle ? (
                    <>
                      <dt>Table as printed</dt>
                      <dd>{tableTitle}</dd>
                    </>
                  ) : null}
                  <dt>Row as printed</dt>
                  <dd>{cell.row_label_raw ?? "not recorded"}</dd>
                  <dt>Column as printed</dt>
                  <dd>{cell.col_label_raw ?? "not recorded"}</dd>
                </>
              ) : null}
              {isValue && cell ? (
                <>
                  <dt>Printed text</dt>
                  <dd className="mono">{cell.value_raw}</dd>
                  <dt>Stored value</dt>
                  <dd>
                    <span className="mono">{obs.value}</span>
                    {cell.normalization_flags.length > 0 ? <span className="muted"> (parsing: {cell.normalization_flags.join(", ").replaceAll("_", " ")})</span> : null}
                  </dd>
                </>
              ) : null}
              {cell && (isValue || showPage) ? (
                <>
                  <dt>Read by</dt>
                  <dd>
                    {cell.extractor_name} {cell.extractor_version}
                    {cell.extractor_name === "pdfplumber"
                      ? ", a second table-reading tool, used because the first tool's reading of this table was flagged; its reading was kept only because every check of the table passed on it"
                      : ", a table-extraction tool (it reads printed text; it does not generate numbers)"}
                  </dd>
                  <dt>Extraction run</dt>
                  <dd className="mono">{cell.run_id}</dd>
                  <dt>Cell id</dt>
                  <dd className="mono">{cell.cell_id}</dd>
                </>
              ) : null}
              {source ? (
                <>
                  <dt>Document fingerprint</dt>
                  <dd>
                    <span className="hash" title={source.sha256}>
                      SHA-256 {source.sha256.slice(0, 16)}…
                    </span>{" "}
                    <CopyButton text={source.sha256} label="Copy" className="btn btn-text" />
                  </dd>
                  <dt>Retrieved</dt>
                  <dd>{dateOnly(source.retrieved_at)}</dd>
                </>
              ) : null}
              <dt>Release</dt>
              <dd>
                <Link href="/releases">{RELEASE_VERSION}</Link>
                {obs.first_published_release ? `; first published in ${obs.first_published_release}` : ""}
                {obs.last_changed_release && obs.last_changed_release !== obs.first_published_release ? `; last changed in ${obs.last_changed_release}` : ""}
              </dd>
            </dl>
          </Section>

          {/* ---------------- cite and download ---------------- */}
          <Section id="cite" title="Cite and download">
            <Cite path={path} what={`Observation ${obs.obs_id}`} source={isValue ? source : null} page={isValue ? cell?.page : null} pageLabel={isValue ? cell?.page_label : null} heading={false} />
            <div className="action-row">
              <DownloadLink href={receiptJsonHref(obs.obs_id)}>This receipt as JSON</DownloadLink>
              <DownloadLink href={receiptCsvHref(obs.obs_id)}>CSV row with provenance columns</DownloadLink>
              <Link className="btn btn-text" href="/data">
                How the files are laid out
              </Link>
            </div>
          </Section>
        </div>

        {/* ---------------- rail ---------------- */}
        <aside className="rail" aria-label="Related figures">
          <Toc items={toc} />
          <section>
            <h2>Same series</h2>
            <ul className="nb-list">
              {nb.prev ? <NbItem o={nb.prev} s={series} label={breakBetween(nb.prev.period, obs.period) ? "Previous (before the break)" : "Previous in this release"} /> : null}
              {nb.next ? <NbItem o={nb.next} s={series} label={breakBetween(obs.period, nb.next.period) ? "Next (after the break)" : "Next in this release"} /> : null}
              {otherVintages.map((o) => (
                <NbItem key={o.obs_id} o={o} s={series} label={vintageWords(o.vintage)} />
              ))}
              <li>
                <Link href={seriesHref(series.series_id)}>All of {series.name}</Link>
              </li>
            </ul>
          </section>
          {parentObs || siblingObs.length > 0 ? (
            <section>
              <h2>
                Same {obs.vintage !== "na" ? "column" : "period"}, other lines
              </h2>
              <ul className="nb-list">
                {parentObs && parent ? <NbItem o={parentObs} s={parent} label="Part of" name /> : null}
                {siblingObs.slice(0, 14).map(({ s, o }) => (
                  <NbItem key={s.series_id} o={o!} s={s} name />
                ))}
              </ul>
            </section>
          ) : null}
          <section>
            <h2>Reading a receipt</h2>
            <p className="small">
              <Link href="/methods#statuses">What the statuses mean</Link> · <Link href="/methods#checks">How the checks work</Link>
            </p>
          </section>
        </aside>
      </div>
    </article>
  );
}

function NbItem({ o, s, label, name }: { o: Observation; s: Series; label?: string; name?: boolean }) {
  const info = statusOf(o);
  return (
    <li>
      <Link href={obsHref(o.obs_id)} className="nb">
        <span className="nb-k">
          {label ? <span className="muted">{label}: </span> : null}
          {name ? s.name : `${periodWords(o.period, s.frequency)}${o.vintage !== "na" ? `, ${vintageWords(o.vintage).toLowerCase()}` : ""}`}
        </span>
        <span className="nb-v tnum">{info.key === "checked" ? formatDecimalString(o.value) : <StatusMark k={info.key} title={info.label} />}</span>
      </Link>
    </li>
  );
}
