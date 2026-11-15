// The receipt: one figure, where it is printed, how it was checked, and how to
// take it away. The flagship page of the site, in three depths (DESIGN.md 7.1):
//   1. first screen: the figure (or the labelled gap), one verdict sentence,
//      the proof (a pre-cut crop for an exact box), the versions strip and the
//      action row (a sticky bar on phones);
//   2. collapsed sections, closed in the HTML and opened on wide screens by
//      ReceiptEnhance: where it is printed (the whole page, fetched only when
//      opened), how we know, notes and caveats, corrections and history, cite
//      and download;
//   3. the technical record, collapsed everywhere.
// Rules kept from the first receipt (and checked by scripts/check-build.mjs):
// a gap shows no number and no page box except the printed dash or blank of a
// "not printed" cell; check wording that quotes figures is shown only where
// every figure it names is checked (descriptionVisible); every subtracted
// member of a sum is marked; every printing of a disputed figure is listed.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Cite from "@/components/Cite";
import { ActionBar, CiteButton, ShareButton } from "@/components/actions/Actions";
import { Breadcrumbs, Callout, DownloadLink, ExternalLink, TableWrap } from "@/components/ui/Basics";
import CopyButton from "@/components/ui/CopyButton";
import { ReportLink } from "@/components/chrome/Chrome";
import { StatusBadge, StatusMark } from "@/components/ui/Status";
import { Count, Num } from "@/components/ui/Num";
import CorrectionBar from "@/components/evidence/CorrectionBar";
import ReceiptEnhance from "@/components/evidence/ReceiptEnhance";
import VersionsStrip from "@/components/evidence/Versions";
import { CropView, ProofView, WholePage } from "@/components/evidence/Proof";
import { cropPlan, kindWord, pageAllowed, passClause, pdfAtPage, officialWorks, printedEvidence, verdict, versionsOf, type CropPlan } from "@/components/evidence/model";
import { tableHrefOf, tableOfCell } from "@/lib/tables";
import {
  DATA_BASE,
  datasetName,
  db,
  disputedCells,
  ISSUES_URL,
  isDatasetPublished,
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
import { CHECK_TYPE_WORDS, dateOnly, formatDecimalString, humanAmount, periodWords, TIER_WORDS, unitLabel, verificationWords, vintageLong, vintageWords } from "@/lib/format";
import { statusOf } from "@/lib/status";
import { STAGE_KINDS } from "@/lib/words";

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

const shows = (o: Observation) => o.reader.showsValue && o.published && o.value !== null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const o = find((await params).id);
  if (!o) return { title: "Receipt" };
  const s = db().seriesById.get(o.series_id);
  const fig = shows(o) ? `${formatDecimalString(o.value)} ${unitLabel(o.unit, o.scale_factor)}` : statusOf(o).label;
  return {
    title: `${obsTitle(o, s)}: receipt`,
    description: `${fig}. ${verdict(db(), o)} Where it is printed in the government document, the checks it passed, and how to cite it.`,
  };
}

/* ------------------------------------------------------------------ */

const RESULT_WORDS: Record<string, string> = {
  pass: "Passed",
  pass_within_rounding: "Passed, allowing for rounding",
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

function srcShort(src: Source | undefined, id: string) {
  return src?.title ?? id;
}

/** One printed cell inside a check. Its printed value is shown only if that
 * figure is itself published, or if it is a printed number no series uses
 * (a printed total) inside a check that passed: a passing sum corroborates
 * every number in it. An unpublished figure never shows a number, and neither
 * does a printed total in a check that failed or could not run. */
function MemberRow({ cell, highlight, role, sign, corroborated, checkId }: { cell: Cell; highlight: boolean; role?: string; sign?: number; corroborated: boolean; checkId: string }) {
  const d = db();
  const o = obsForCell(cell.cell_id);
  const src = d.sourceById.get(cell.source_id);
  const showValue = o ? o.published && o.value !== null : corroborated;
  const info = o ? statusOf(o) : null;
  const minus = sign === -1;
  return (
    <tr className={highlight ? "is-this" : undefined}>
      <th scope="row" style={{ fontWeight: highlight ? 650 : 500 }}>
        {minus ? (
          <span className="less-mark" aria-hidden="true">
            less{" "}
          </span>
        ) : null}
        {cell.row_label_raw ?? "row label not recorded"}
        {minus ? <span className="sr-only"> (subtracted)</span> : null}
        {role ? <span className="break-tag">{role}</span> : null}
        {highlight ? <span className="break-tag">This figure</span> : null}
      </th>
      <td className="small muted">
        {srcShort(src, cell.source_id)}, <Num kind="page">{pageShort(cell)}</Num>
      </td>
      <td className="num" data-member-sign={minus ? "-1" : undefined}>
        {showValue ? (
          <>
            {minus ? (
              <span className="minus" aria-hidden="true">
                −{" "}
              </span>
            ) : null}
            {o && o.published ? (
              <Link href={obsHref(o.obs_id)} className="v-link" data-v="" data-v-cell={cell.cell_id}>
                {(cell.value_raw ?? "").trim()}
              </Link>
            ) : (
              <Num kind="printed" cell={cell.cell_id}>
                {(cell.value_raw ?? "").trim()}
              </Num>
            )}
          </>
        ) : info ? (
          <Link href={obsHref(o!.obs_id)}>
            <StatusBadge info={info} short />
          </Link>
        ) : (
          <span className="muted small" data-check-hidden={checkId}>
            printed; not shown
          </span>
        )}
      </td>
    </tr>
  );
}

/** May this check's description be shown on this receipt? Descriptions quote
 * printed figures. They are shown only where every number in them is a
 * checked figure: never on a gap receipt; on a value or disputed receipt when
 * the check passed (or is the dispute itself), or when every cell it names
 * backs a published figure. */
function descriptionVisible(check: Check, obs: Observation): boolean {
  const isGap = !(obs.published && obs.value !== null) && obs.status !== "disputed";
  if (isGap) return false;
  if (check.result === "pass" || check.result === "pass_within_rounding") return true;
  if (check.result === "disputed" && obs.status === "disputed") return true;
  const ids = [...check.member_cell_ids, ...(check.target_cell_id ? [check.target_cell_id] : [])];
  return ids.every((id) => {
    const o = obsForCell(id);
    return !!o && o.published && o.value !== null;
  });
}

/** The plain first sentence of a check card: what it showed, with no figure in it. */
function checkPlain(check: Check, obs: Observation): string {
  const d = db();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (check.result === "pass" || check.result === "pass_within_rounding") return `${cap(passClause(d, check, obs))}.`;
  if (check.result === "disputed") return "Two official printings of this line and year give different figures, and each adds up in its own table.";
  if (check.result === "not_evaluable") return "This check could not be run on the printed table, so it says nothing either way.";
  if (check.result === "fail") {
    switch (check.check_type) {
      case "cross_edition":
      case "cross_table":
      case "cross_source":
        return "The other printing gives a different figure.";
      case "recompute":
      case "index_aggregation":
        return "Recomputing it from its printed parts gives a different figure.";
      default:
        return "The printed parts do not add up to the printed total.";
    }
  }
  return "The result of this check is recorded below.";
}

/** A sentence that may name documents: each document title (a release label, digits and all) is marked as one. */
function withTitles(text: string): ReactNode {
  const titles = [...new Set(db().sources.map((s) => s.title).filter(Boolean))].sort((a, b) => b.length - a.length);
  const hit = titles.find((t) => text.includes(t));
  if (!hit) return text;
  const at = text.indexOf(hit);
  return (
    <>
      {text.slice(0, at)}
      <Num kind="text">{hit}</Num>
      {withTitles(text.slice(at + hit.length))}
    </>
  );
}

function CheckItem({ check, obs }: { check: Check; obs: Observation }) {
  const d = db();
  const showText = descriptionVisible(check, obs);
  const corroborated = check.result === "pass" || check.result === "pass_within_rounding";
  const own = new Set([obs.primary_cell_id, ...obs.supporting_cell_ids].filter(Boolean) as string[]);
  const members = check.member_cell_ids.map((id) => d.cellById.get(id)).filter((c): c is Cell => !!c);
  const target = check.target_cell_id ? d.cellById.get(check.target_cell_id) : undefined;
  const isEdition = check.check_type === "cross_edition" || check.check_type === "cross_source" || check.check_type === "cross_table";
  const where = target ?? members[0];
  const whereSrc = where ? d.sourceById.get(where.source_id) : undefined;
  return (
    <li className="check ev-check" id={`check-${slugify(check.check_id)}`} data-check-result={check.result} data-check={check.check_id}>
      <div className="check-head">
        <ResultMark result={check.result} />
        <span className="label">{CHECK_TYPE_WORDS[check.check_type] ?? check.check_type.replaceAll("_", " ")}</span>
        {check.official === false ? <span className="small muted">comparison only; does not affect the status</span> : null}
        {check.credits_members === false && check.official !== false ? <span className="small muted">does not count towards this figure&rsquo;s status</span> : null}
      </div>
      <p className="ev-check-plain">{withTitles(checkPlain(check, obs))}</p>
      {where && !isEdition ? (
        <p className="check-where">
          {srcShort(whereSrc, where.source_id)}, <Num kind="page">{pageShort(where)}</Num>
        </p>
      ) : null}
      <details className="disclosure">
        <summary>
          <span>{isEdition ? "Show both printings" : "Show the arithmetic"}</span>
          <span className="summary-meta">
            <Count k={`cells:check:${check.check_id}`} n={members.length + (target ? 1 : 0)} /> printed figures
          </span>
        </summary>
        <div className="disclosure-body">
          {showText ? (
            <p className="check-desc" data-num="evidence" data-check={check.check_id}>
              {check.description}
            </p>
          ) : (
            <p className="check-desc">
              {check.result === "fail"
                ? "This check failed. Its wording quotes printed figures that are not published, so it is not shown; the figures it used are listed below with their status."
                : check.result === "not_evaluable"
                  ? "This check could not be run on the printed figures. The figures it would use are listed below with their status."
                  : "The wording of this check quotes printed figures that are not published here, so it is not shown. The figures it used are listed below with their status."}
            </p>
          )}
          {showText && check.result === "pass_within_rounding" && check.tolerance_rule ? (
            <p className="check-tol" data-num="evidence" data-check={check.check_id}>
              Tolerance: {check.tolerance_rule}
            </p>
          ) : null}
          {showText && check.result === "not_evaluable" && check.not_evaluable_reason ? (
            <p className="small" data-num="evidence" data-check={check.check_id}>
              Why it could not run: {check.not_evaluable_reason}
            </p>
          ) : null}
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
                {members.map((c, i) => (
                  <MemberRow key={c.cell_id} cell={c} highlight={own.has(c.cell_id)} sign={check.member_signs?.[i] ?? 1} corroborated={corroborated} checkId={check.check_id} />
                ))}
                {target ? <MemberRow cell={target} highlight={own.has(target.cell_id)} role={isEdition ? undefined : "Printed total"} corroborated={corroborated} checkId={check.check_id} /> : null}
              </tbody>
            </table>
          </TableWrap>
          <dl className="facts">
            {showText && !isEdition && check.residual !== null ? (
              <>
                <dt>Difference</dt>
                <dd className="tnum">
                  <Num kind="printed" cell={`residual:${check.check_id}`}>
                    {formatDecimalString(check.residual)}
                  </Num>{" "}
                  {check.residual === "0" ? "(exact)" : ""}
                </dd>
              </>
            ) : null}
            {showText && check.target_value ? (
              <>
                <dt>Reference value</dt>
                <dd>
                  <Num kind="printed" cell={`target:${check.check_id}`} className="mono">
                    {check.target_value}
                  </Num>
                  {check.target_source ? (
                    <>
                      , from <Num kind="id">{check.target_source}</Num>
                    </>
                  ) : null}
                </dd>
              </>
            ) : null}
            {check.tolerance_rule ? (
              <>
                <dt>Rule, fixed before any result was seen</dt>
                <dd>
                  <Num kind="ui">{check.tolerance_rule}</Num>
                </dd>
              </>
            ) : null}
            <dt>Check id</dt>
            <dd className="mono">
              <Num kind="id">{check.check_id}</Num>
            </dd>
          </dl>
        </div>
      </details>
    </li>
  );
}

/** A collapsed section of the receipt. Closed in the HTML; `wide` opens it on wide screens (ReceiptEnhance). */
function Fold({ id, title, children, wide, meta }: { id: string; title: string; children: ReactNode; wide?: boolean; meta?: ReactNode }) {
  return (
    <details className="ev-fold" id={id} {...(wide ? { "data-open-wide": "" } : {})}>
      <summary>
        <h2 className="ev-fold-h">{title}</h2>
        {meta ? <span className="ev-fold-meta">{meta}</span> : null}
      </summary>
      <div className="ev-fold-body">{children}</div>
    </details>
  );
}

/** Crop plan of a cell, from the same model the prebuild cut the files with. */
function planFor(cell: Cell | undefined): CropPlan | null {
  if (!cell) return null;
  const img = pageImage(cell.source_id, cell.page);
  if (!img) return null;
  return cropPlan(cell, db().cellsBySource.get(cell.source_id) ?? [], img);
}

const CROP_BASE = `${DATA_BASE}/evidence/crops/`;

/** A printing of the figure in another place: caption + pre-cut crop (fetched only when its section opens, unless `lazy` is false). */
function Printing({ cell, label, lazy = true }: { cell: Cell; label: ReactNode; lazy?: boolean }) {
  const d = db();
  const src = d.sourceById.get(cell.source_id);
  const plan = planFor(cell);
  return (
    <div className="printing ev-printing">
      <p className="printing-head">
        {label}{" "}
        <span>
          <Link href={sourceHref(cell.source_id)}>{srcShort(src, cell.source_id)}</Link>, <Num kind="page">{pageWords(cell, src?.page_count)}</Num>. Row &ldquo;{cell.row_label_raw}&rdquo;, column &ldquo;{cell.col_label_raw}&rdquo;. Printed{" "}
          <span className="mono" data-printed data-num="printed" data-cell={cell.cell_id}>
            {cell.value_raw}
          </span>
          .
        </span>
      </p>
      {plan ? <CropView plan={plan} base={CROP_BASE} lazy={lazy} alt={`Close-up of page ${cell.page} of ${srcShort(src, cell.source_id)}, the figure ${cell.value_raw} boxed in its row.`} /> : null}
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
  const isValue = shows(obs);
  const isDisputed = obs.reader.key === "disputed";
  const isCandidate = obs.reader.key === "candidate";
  const cell = obs.primary_cell_id ? d.cellById.get(obs.primary_cell_id) : undefined;
  const source = cell ? d.sourceById.get(cell.source_id) : undefined;
  // A page is shown for a value, and for a gap the government did not print
  // (the page then shows the dash or blank that proves it). Never for a figure
  // that is held back, not checked yet, or of unknown status.
  const showPage = pageAllowed(obs, cell);
  const image = cell && showPage ? pageImage(cell.source_id, cell.page) : null;
  const ev = cell && showPage ? printedEvidence(cell, !!image) : null;
  const plan = ev?.boxState === "exact" ? planFor(cell) : null;
  const checks = obs.check_ids.map((c) => d.checkById.get(c)).filter((c): c is Check => !!c);
  const supporting = isValue ? obs.supporting_cell_ids.map((c) => d.cellById.get(c)).filter((c): c is Cell => !!c) : [];
  const readings = isDisputed ? disputedCells(obs) : [];
  const inputs = obs.derived_from.map((i) => d.obsById.get(i)).filter((o): o is Observation => !!o);
  const unit = unitLabel(obs.unit, obs.scale_factor);
  const path = obsHref(obs.obs_id);
  const verif = source ? verificationWords(source.verification_status) : null;
  const parent = series.parent_id ? d.seriesById.get(series.parent_id) : undefined;
  const nb = neighbours(obs);
  const parentObs = parent ? obsAt(parent.series_id, obs.period, obs.vintage) : undefined;
  const siblings = parent ? (d.childrenOf.get(parent.series_id) ?? []).filter((s) => !s.derived && s.series_id !== series.series_id) : [];
  const siblingObs = siblings.map((s) => ({ s, o: obsAt(s.series_id, obs.period, obs.vintage) })).filter((x) => x.o);
  const pWords = periodWords(obs.period, series.frequency);
  const kWord = kindWord(obs);
  const vintage = obs.vintage !== "na" ? vintageWords(obs.vintage).toLowerCase() : null;
  const apaPage = isValue ? cell?.page : null;
  const sentence = verdict(d, obs);
  const versions = versionsOf(d, obs);
  const works = officialWorks(source);
  const pdf = showPage ? pdfAtPage(source, cell?.page) : null;
  const tableTitle = cell ? d.coverage.find((c) => c.source_id === cell.source_id && c.page === cell.page)?.table : undefined;
  const breakBetween = (a: string, b: string) => series.breaks.some((br) => a < br.at_period && br.at_period <= b);
  const between = (a: string, b: string) => series.breaks.find((br) => a < br.at_period && br.at_period <= b);
  const breakNear = (nb.prev ? between(nb.prev.period, obs.period) : undefined) ?? (nb.next ? between(obs.period, nb.next.period) : undefined) ?? null;

  const caveats: ReactNode[] = [];
  if (obs.notes)
    caveats.push(
      <span key="obs" data-num="evidence" data-obs={obs.obs_id}>
        {obs.notes}
      </span>,
    );
  if (series.notes) caveats.push(<span key="ser">{series.notes}</span>);
  for (const b of series.breaks)
    caveats.push(
      <span key={`b${b.at_period}`}>
        <strong>
          Series break from <Num kind="period">{periodWords(b.at_period, series.frequency)}</Num>
        </strong>{" "}
        ({b.kind.replaceAll("_", " ")}): {b.note}
        {obs.period < b.at_period ? " This figure is before the break." : " This figure is from the break onwards."}
      </span>,
    );
  if (source?.notes) caveats.push(<span key="src">About the document: {source.notes}</span>);
  if (verif?.caveat) caveats.push(<span key="ver">{verif.text}</span>);
  if (series.definition_status && series.definition_status !== "reviewed") caveats.push(<span key="def">The series definition is a draft and has not yet been reviewed by a person.</span>);

  const kindLine = STAGE_KINDS.includes(obs.kind) ? (
    <>
      {kWord} for <Num kind="period">{pWords}</Num>
    </>
  ) : kWord === "As printed" ? (
    <Num kind="period">{pWords}</Num>
  ) : (
    <>
      {kWord}, <Num kind="period">{pWords}</Num>
    </>
  );
  const gapWord = isDisputed ? "Disputed" : obs.reader.word ? obs.reader.word.charAt(0).toUpperCase() + obs.reader.word.slice(1) : info.label;

  const proofCaption =
    cell && source ? (
      <>
        {isValue ? (
          <>
            Printed as{" "}
            <span className="mono ev-printed" data-printed data-num="printed" data-cell={cell.cell_id}>
              {cell.value_raw}
            </span>{" "}
            on{" "}
          </>
        ) : (
          <>An empty cell on </>
        )}
        <Num kind="page">{pageWords(cell)}</Num> of <Link href={sourceHref(cell.source_id)}>{srcShort(source, cell.source_id)}</Link>, row &ldquo;{cell.row_label_raw ?? "not recorded"}&rdquo;, column &ldquo;
        {cell.col_label_raw ?? "not recorded"}&rdquo;.{" "}
        <a href="#page" className="no-print">
          See the whole page
        </a>
        {tableOfCell(cell) ? (
          <>
            {" "}
            · <Link href={tableHrefOf(cell)}>the table as printed</Link>
          </>
        ) : null}
      </>
    ) : null;

  return (
    <article className="receipt rc" data-status={info.key} data-receipt>
      <ReceiptEnhance />
      <Breadcrumbs
        items={[
          { href: "/browse", label: "Data" },
          { href: `/datasets/${series.dataset}`, label: datasetName(series.dataset) },
          ...(parent ? [{ href: seriesHref(parent.series_id), label: parent.name }] : []),
          { href: seriesHref(series.series_id), label: series.name },
          {
            label: (
              <>
                <Num kind="period">{pWords}</Num>
                {vintage ? `, ${vintage}` : ""}
              </>
            ),
          },
        ]}
      />
      <p className="print-only small">
        Receipt printed from the LUMS DataLab Portal (prototype), release <Num kind="version">{RELEASE_VERSION}</Num>. Page <Num kind="id">{path}</Num>
      </p>
      <CorrectionBar corrections={[]} />

      <div className={`rc-top${ev || readings.length ? " has-proof" : ""}`}>
        {/* ---------------- the figure, its kind and period, the verdict ---------------- */}
        <header className="rc-id">
          <h1 className="receipt-title rc-title">{series.name}</h1>
          <p className="receipt-when">
            {datasetName(series.dataset)} · <Link href={seriesHref(series.series_id)}>the whole series</Link>
          </p>
          <p className="figure-kind">{kindLine}</p>
          {isValue ? (
            <div className="figure" data-receipt-value>
              <p className="figure-v tnum">
                <span data-v-self={obs.obs_id}>{formatDecimalString(obs.value)}</span>
                <span className="figure-u">{unit}</span>
              </p>
              {isCandidate ? <p className="v-mark">not signed off</p> : null}
              {obs.unit === "PKR" && (obs.scale_factor ?? 1) >= 1000000 && Number.isFinite(Number(obs.value)) ? (
                <p className="figure-human">
                  That is about <Num kind="approx">{humanAmount(Number(obs.value), obs.unit, obs.scale_factor)}</Num>.
                </p>
              ) : null}
            </div>
          ) : (
            <div
              className={`figure figure-gap ${info.key === "gap-source" ? "fill-gap-source" : info.key === "gap-pending" ? "fill-gap-pending" : info.key === "withheld" ? "fill-withheld" : info.key === "disputed" ? "fill-disputed" : ""}`}
              data-receipt-gap={obs.gap_kind ?? (isDisputed ? "disputed" : "unknown")}
              {...(isDisputed ? { "data-receipt-disputed": "" } : {})}
            >
              <p className="figure-none">
                <StatusMark k={info.key} /> {gapWord}
                {info.key === "gap-source" && cell && showPage ? (
                  <>
                    : printed as <span className="figure-glyph">{cell.value_raw?.trim() || "(blank)"}</span>, not as a number
                  </>
                ) : isDisputed ? (
                  ": the printings disagree"
                ) : (
                  ": no number is shown"
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
                          <Num kind="page">
                            {readings
                              .filter((r) => r.source_id === c.source_id && r.value_raw === c.value_raw)
                              .map((r) => pageShort(r))
                              .join(", ")}
                          </Num>
                        </td>
                        <td className="num">
                          <span className="mono" data-printed data-num="printed" data-cell={c.cell_id}>
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

          <p className="rc-verdict" {...(isValue || isDisputed ? { "data-num": "evidence", "data-obs": obs.obs_id } : {})}>
            {sentence}
          </p>
          {!isValue && obs.gap_reason ? (
            <p className="small rc-reason">
              <strong>Recorded reason:</strong> {obs.gap_reason}
            </p>
          ) : null}
          {breakNear ? (
            <p className="receipt-break small">
              <strong>
                Series break from <Num kind="period">{periodWords(breakNear.at_period, series.frequency)}</Num>
              </strong>{" "}
              ({breakNear.kind.replaceAll("_", " ")}): figures before and after it are not comparable. <a href="#caveats">Why</a>
            </p>
          ) : null}
        </header>

        {/* ---------------- the proof ---------------- */}
        {ev && cell ? (
          <div className="rc-proof">
            <ProofView
              ev={ev}
              plan={plan}
              image={image}
              cell={cell}
              base={CROP_BASE}
              alt={`Close-up of page ${cell.page} of ${srcShort(source, cell.source_id)}: the row "${cell.row_label_raw}" with ${isValue ? `the figure ${cell.value_raw}` : "the cell that prints no figure"} boxed.`}
              caption={proofCaption}
            />
          </div>
        ) : null}
        {isDisputed && readings.length > 0 ? (
          <div className="rc-proof">
            <p className="ev-proof-label">Printed here, differently</p>
            {readings.map((c, i) => (
              <Printing
                key={c.cell_id}
                cell={c}
                lazy={false}
                label={
                  <strong>
                    Printing <Num kind="ui">{i + 1}</Num>.
                  </strong>
                }
              />
            ))}
          </div>
        ) : null}

        <div className="rc-more">
          <VersionsStrip versions={versions} />
          {/* ---------------- action row: a sticky bar on phones ---------------- */}
          <div className="rc-actions no-print">
            <ActionBar label="Actions for this figure">
              <CiteButton path={path} primary />
              {pdf && cell ? (
                <a className="btn" href={pdf} rel="noopener" aria-label={`Official PDF at page ${cell.page}`}>
                  PDF <Num kind="page">p. {cell.page}</Num>
                </a>
              ) : null}
              {source && showPage && source.wayback_url ? (
                <a className="btn" href={source.wayback_url} rel="noopener" aria-label={works ? "Internet Archive copy of the document" : "Internet Archive copy of the document (the file used)"}>
                  Archive
                </a>
              ) : null}
              <ShareButton path={path} />
            </ActionBar>
          </div>
        </div>
      </div>

      <div className="with-rail rc-body">
        <div className="receipt-body rc-folds">
          {/* ---------------- where it is printed: the whole page, fetched only when opened ---------------- */}
          {cell && showPage ? (
            <Fold id="page" title="Where it is printed" meta={<Num kind="page">{pageShort(cell)}</Num>}>
              {image && ev && ev.boxState !== "no-image" ? (
                <figure className="ev-whole">
                  <WholePage
                    image={image}
                    cell={cell}
                    state={ev.boxState}
                    alt={`Page ${cell.page} of ${srcShort(source, cell.source_id)}${isValue ? `, with the figure ${cell.value_raw} boxed` : ", with the empty cell boxed"} in the row "${cell.row_label_raw}" and the column "${cell.col_label_raw}". The dashed outline marks the table it was read from.`}
                  />
                  <figcaption className="doc-caption">
                    <span>
                      What you are looking at: a picture of <Num kind="page">{pageWords(cell, source?.page_count)}</Num>, made from the copy whose fingerprint is in the technical record. The solid box marks{" "}
                      {isValue ? "the figure" : "the cell, which prints no figure"}; the dashed outline the table it was read from.
                    </span>
                    <span>
                      <a href={image.src}>Open the page image</a>
                    </span>
                  </figcaption>
                </figure>
              ) : (
                <p className="measure">The page image could not be checked against the official file, so it is not shown.</p>
              )}
              {source ? (
                <div className="source-line">
                  <p className="small measure">
                    <strong>Is this the genuine document?</strong> {verif?.text}
                  </p>
                  <div className="action-row">
                    {source.wayback_url && !works ? (
                      <ExternalLink className="btn" href={source.wayback_url}>
                        Internet Archive copy (the file used)
                      </ExternalLink>
                    ) : null}
                    {source.file_url && works ? (
                      <ExternalLink className="btn" href={pdfAtPage(source, cell.page) ?? source.file_url}>
                        Official PDF (go to <Num kind="page">page {cell.page}</Num>)
                      </ExternalLink>
                    ) : null}
                    {source.wayback_url && works ? (
                      <ExternalLink className="btn" href={source.wayback_url}>
                        Internet Archive copy
                      </ExternalLink>
                    ) : null}
                    {source.file_url && !works ? (
                      <span className="small muted">
                        Official address, not responding when retrieved: <Num kind="id" className="mono">{source.file_url}</Num>
                      </span>
                    ) : null}
                    <Link className="btn btn-text" href={sourceHref(source.source_id)}>
                      Our record of this document
                    </Link>
                  </div>
                </div>
              ) : null}
              {supporting.length > 0 ? (
                <div className="ev-also">
                  <h3>The same figure, printed again</h3>
                  <p className="small measure">As printed in another official document or table. The checks under &ldquo;How we know&rdquo; compare them.</p>
                  {supporting.map((c) => (
                    <Printing key={c.cell_id} cell={c} label={null} />
                  ))}
                </div>
              ) : null}
            </Fold>
          ) : null}

          {/* ---------------- how we know ---------------- */}
          <Fold id="checks" title="How we know" wide meta={<><Count k={`checks:obs:${obs.obs_id}`} n={checks.length} /> {checks.length === 1 ? "check" : "checks"}</>}>
            {isValue && series.derived ? (
              <div className="ev-computed">
                <h3>How it was computed</h3>
                <p className="measure">
                  The government does not print this figure. It is computed by code from checked figures
                  {series.derivation ? (
                    <>
                      {" "}
                      with the formula <code data-num="id">{series.derivation.formula}</code>
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
                              <th scope="row">
                                {s?.name ?? i.series_id}, <Num kind="period">{periodWords(i.period, s?.frequency)}</Num>
                                {i.vintage !== "na" ? `, ${vintageWords(i.vintage).toLowerCase()}` : ""}
                              </th>
                              <td className="num">
                                {i.published && i.value !== null ? (
                                  <>
                                    <Link href={obsHref(i.obs_id)} className="v-link" data-v="">
                                      {formatDecimalString(i.value)}
                                    </Link>{" "}
                                    {unitLabel(i.unit, i.scale_factor)}
                                  </>
                                ) : (
                                  <Link href={obsHref(i.obs_id)}>{statusOf(i).label}</Link>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </TableWrap>
                ) : null}
              </div>
            ) : null}
            <p className="measure small">
              {checks.length === 0 ? (
                isValue && series.derived ? (
                  "A computed figure has no checks of its own; each input has its own receipt and checks."
                ) : (
                  "No check covers this figure in this release."
                )
              ) : (
                <>
                  Each check is a fixed rule run by code over the printed figures; this figure took part in <Count k={`checks:obs:${obs.obs_id}`} n={checks.length} />. A passing sum confirms
                  every number in it at once. No language model wrote this figure or decided whether it passes.
                </>
              )}
            </p>
            {checks.length > 0 ? (
              <ol className="checks-list">
                {checks.map((c) => (
                  <CheckItem key={c.check_id} check={c} obs={obs} />
                ))}
              </ol>
            ) : null}
            {isValue && obs.tier ? <p className="small muted measure">{TIER_WORDS[obs.tier] ?? `Tier ${obs.tier}.`}</p> : null}
            {isValue || isDisputed ? (
              <p className="small muted measure" data-num="evidence" data-obs={obs.obs_id}>
                In one line, as recorded by the pipeline: {obs.evidence_summary ?? info.meaning}
              </p>
            ) : null}
          </Fold>

          {/* ---------------- notes and caveats ---------------- */}
          <Fold id="caveats" title="Notes and caveats" wide>
            {caveats.length > 0 ? (
              <Callout kind="caveat">
                <ul className="caveat-list">
                  {caveats.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </Callout>
            ) : (
              <p className="measure">No note, series break or caveat is recorded for this figure, its series or its document.</p>
            )}
            <p className="small">
              {vintageLong(obs.vintage)}. <Link href="/methods#statuses">What the statuses mean</Link> · <Link href="/methods#checks">How the checks work</Link>
            </p>
          </Fold>

          {/* ---------------- corrections and history ---------------- */}
          <Fold id="history" title="Corrections and history" wide>
            <p className="measure">
              No correction has been made to this figure.
              {obs.first_published_release ? (
                <>
                  {" "}
                  First in release <Num kind="version">{obs.first_published_release}</Num>
                  {obs.last_changed_release && obs.last_changed_release !== obs.first_published_release ? (
                    <>
                      ; last changed in <Num kind="version">{obs.last_changed_release}</Num>
                    </>
                  ) : (
                    "; not changed since"
                  )}
                  .
                </>
              ) : null}{" "}
              A routine revision (a budget estimate replaced by a revised estimate) is not a correction: it is listed under &ldquo;Versions of this figure&rdquo;.
            </p>
            <p className="small">
              <Link href="/releases">Releases, changelog and errata</Link> ·{" "}
              <ReportLink issuesUrl={ISSUES_URL} version={RELEASE_VERSION}>
                Report a problem with this figure
              </ReportLink>
            </p>
          </Fold>

          {/* ---------------- cite and download ---------------- */}
          <Fold id="cite" title="Cite and download" wide>
            <Cite path={path} what={`Observation ${obs.obs_id}`} source={isValue ? source : null} page={apaPage} pageLabel={isValue ? cell?.page_label : null} heading={false} />
            <div className="action-row">
              <CopyButton text={path} origin label="Copy link" />
              <DownloadLink href={receiptJsonHref(obs.obs_id)}>This receipt as JSON</DownloadLink>
              <DownloadLink href={receiptCsvHref(obs.obs_id)}>CSV row with provenance columns</DownloadLink>
              <Link className="btn btn-text" href="/data">
                How the files are laid out
              </Link>
            </div>
          </Fold>

          {/* ---------------- technical record: collapsed everywhere ---------------- */}
          <Fold id="technical" title="Technical record">
            <dl className="facts">
              <dt>Figure</dt>
              <dd>
                {series.name}, <Num kind="period">{pWords}</Num>
                {vintage ? `, ${vintage}` : ""}
                <br />
                <Num kind="id" className="mono">
                  {obs.obs_id}
                </Num>
              </dd>
              <dt>Kind of figure</dt>
              <dd>{vintageLong(obs.vintage)}</dd>
              <dt>Unit and scale</dt>
              <dd>
                {unit}
                {obs.scale_factor && obs.scale_factor !== 1 ? (
                  <>
                    {" "}
                    (multiply the printed number by <Num kind="ui">{formatDecimalString(String(obs.scale_factor))}</Num> for the full amount)
                  </>
                ) : null}
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
                    <Num kind="page">{pageWords(cell, source?.page_count)}</Num>; table <Num kind="page">{cell.table_index + 1}</Num> on the page
                    {tableOfCell(cell) ? (
                      <>
                        {" "}
                        · <Link href={tableHrefOf(cell)}>see the table as printed</Link>
                      </>
                    ) : null}
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
                  <dt>Proof</dt>
                  <dd>{ev ? (ev.boxState === "exact" ? "Solid box: the stored position holds the printed figure" : ev.boxState === "tentative" ? "Dashed box: not confirmed" : ev.boxState === "none" ? "No box" : "No page image") : "No page shown"}</dd>
                </>
              ) : null}
              {isValue && cell ? (
                <>
                  <dt>Printed text</dt>
                  <dd className="mono">
                    <Num kind="printed" cell={cell.cell_id}>
                      {cell.value_raw}
                    </Num>
                  </dd>
                  <dt>Stored value</dt>
                  <dd>
                    <span className="mono" data-v-self={obs.obs_id}>
                      {obs.value}
                    </span>
                    {cell.normalization_flags.length > 0 ? <span className="muted"> (parsing: {cell.normalization_flags.join(", ").replaceAll("_", " ")})</span> : null}
                  </dd>
                </>
              ) : null}
              {cell && (isValue || showPage) ? (
                <>
                  <dt>Read by</dt>
                  <dd>
                    <Num kind="id">
                      {cell.extractor_name} {cell.extractor_version}
                    </Num>
                    {cell.extractor_name === "pdfplumber"
                      ? ", a second table-reading tool, used because the first tool's reading of this table was flagged; its reading was kept only because every check of the table passed on it"
                      : ", a table-extraction tool (it reads printed text; it does not generate numbers)"}
                  </dd>
                  <dt>Extraction run</dt>
                  <dd className="mono">
                    <Num kind="id">{cell.run_id}</Num>
                  </dd>
                  <dt>Cell id</dt>
                  <dd className="mono">
                    <Num kind="id">{cell.cell_id}</Num>
                  </dd>
                </>
              ) : null}
              {source ? (
                <>
                  <dt>Document fingerprint</dt>
                  <dd>
                    <span className="hash" title={source.sha256}>
                      SHA-256 <Num kind="id">{source.sha256.slice(0, 16)}</Num>…
                    </span>{" "}
                    <CopyButton text={source.sha256} label="Copy" className="btn btn-text" />
                  </dd>
                  <dt>Retrieved</dt>
                  <dd>
                    <Num kind="date">{dateOnly(source.retrieved_at)}</Num>
                  </dd>
                </>
              ) : null}
              <dt>Release</dt>
              <dd>
                <Link href="/releases">
                  <Num kind="version">{RELEASE_VERSION}</Num>
                </Link>
                {obs.first_published_release ? (
                  <>
                    ; first published in <Num kind="version">{obs.first_published_release}</Num>
                  </>
                ) : null}
                {obs.last_changed_release && obs.last_changed_release !== obs.first_published_release ? (
                  <>
                    ; last changed in <Num kind="version">{obs.last_changed_release}</Num>
                  </>
                ) : null}
              </dd>
            </dl>
          </Fold>
        </div>

        {/* ---------------- related figures ---------------- */}
        <aside className="rail" aria-label="Related figures">
          <section>
            <h2>Same series</h2>
            <ul className="nb-list">
              {nb.prev ? <NbItem o={nb.prev} s={series} label={breakBetween(nb.prev.period, obs.period) ? "Previous (before the break)" : "Previous in this release"} /> : null}
              {nb.next ? <NbItem o={nb.next} s={series} label={breakBetween(obs.period, nb.next.period) ? "Next (after the break)" : "Next in this release"} /> : null}
              <li>
                <Link href={seriesHref(series.series_id)}>All of {series.name}</Link>
              </li>
            </ul>
          </section>
          {parentObs || siblingObs.length > 0 ? (
            <section>
              <h2>Same {obs.vintage !== "na" ? "column" : "period"}, other lines</h2>
              <ul className="nb-list">
                {parentObs && parent ? <NbItem o={parentObs} s={parent} label="Part of" name /> : null}
                {siblingObs.slice(0, 14).map(({ s, o }) => (
                  <NbItem key={s.series_id} o={o!} s={s} name />
                ))}
              </ul>
            </section>
          ) : null}
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
          {name ? (
            s.name
          ) : (
            <>
              <Num kind="period">{periodWords(o.period, s.frequency)}</Num>
              {o.vintage !== "na" ? `, ${vintageWords(o.vintage).toLowerCase()}` : ""}
            </>
          )}
        </span>
      </Link>
      <span className="nb-v tnum">
        {shows(o) ? (
          <Link href={obsHref(o.obs_id)} className="v-link" data-v="">
            {formatDecimalString(o.value)}
          </Link>
        ) : (
          <StatusMark k={info.key} title={info.label} />
        )}
      </span>
    </li>
  );
}
