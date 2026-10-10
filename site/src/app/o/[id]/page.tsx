// The receipt: one observation, where it is printed, and how it was checked.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckBadge, GapBadge, StatusBadge } from "@/components/Badges";
import Cite from "@/components/Cite";
import { PageWithBox, ZoomedCell } from "@/components/PageCell";
import {
  datasetName,
  db,
  isDatasetPublished,
  obsHref,
  pageImage,
  receiptJsonHref,
  seriesHref,
  slugify,
  sourceHref,
  type Cell,
  type Observation,
} from "@/lib/data";
import {
  CHECKED_HELP,
  CHECK_TYPE_WORDS,
  formatDecimalString,
  GAP_EXPLAIN,
  gapWords,
  TIER_WORDS,
  unitLabel,
  valueWithUnit,
  verificationWords,
  vintageLong,
  vintageWords,
} from "@/lib/format";

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const o = find((await params).id);
  if (!o) return { title: "Receipt" };
  const s = db().seriesById.get(o.series_id);
  return { title: `Receipt: ${s?.name ?? o.series_id}, ${o.period}, ${vintageWords(o.vintage)}` };
}

function PrintedCell({ cell, heading }: { cell: Cell; heading: string }) {
  const d = db();
  const source = d.sourceById.get(cell.source_id);
  const image = pageImage(cell.source_id, cell.page);
  const alt = `Page ${cell.page} of ${source?.title ?? cell.source_id}, with the figure ${cell.value_raw ?? ""} boxed`;
  return (
    <div className="support">
      <h3 style={{ marginTop: 0 }}>{heading}</h3>
      <dl className="facts">
        <dt>Document</dt>
        <dd>{source ? <Link href={sourceHref(source.source_id)}>{source.title}</Link> : cell.source_id}</dd>
        <dt>Page of the PDF file</dt>
        <dd>{cell.page}</dd>
        <dt>Printed text</dt>
        <dd>
          <span className="mono" data-printed>
            {cell.value_raw ?? "(blank)"}
          </span>
        </dd>
        <dt>Row label as printed</dt>
        <dd>{cell.row_label_raw ?? "not recorded"}</dd>
        <dt>Column label as printed</dt>
        <dd>{cell.col_label_raw ?? "not recorded"}</dd>
      </dl>
      {image ? (
        <>
          <p className="small">Close-up of the page. The red box marks the figure.</p>
          <ZoomedCell image={image} cell={cell} alt={`Close-up. ${alt}`} />
          <details className="plain">
            <summary>Show the whole page</summary>
            <PageWithBox image={image} cell={cell} alt={alt} />
          </details>
        </>
      ) : (
        <p className="small muted">No page image is included in this release for this page.</p>
      )}
    </div>
  );
}

export default async function ReceiptPage({ params }: Props) {
  const { id } = await params;
  const obs = find(id);
  if (!obs) notFound();
  const d = db();
  const series = d.seriesById.get(obs.series_id);
  if (!series) notFound();

  const isValue = obs.published && obs.value !== null;
  const cell = obs.primary_cell_id ? d.cellById.get(obs.primary_cell_id) : undefined;
  const source = cell ? d.sourceById.get(cell.source_id) : undefined;
  const image = cell && isValue ? pageImage(cell.source_id, cell.page) : null;
  const checks = obs.check_ids.map((c) => d.checkById.get(c)).filter((c) => c !== undefined);
  const supporting = isValue ? obs.supporting_cell_ids.map((c) => d.cellById.get(c)).filter((c) => c !== undefined) : [];
  const inputs = obs.derived_from.map((i) => d.obsById.get(i)).filter((o) => o !== undefined);
  const unit = unitLabel(obs.unit, obs.scale_factor);
  const path = obsHref(obs.obs_id);
  const verif = source ? verificationWords(source.verification_status) : null;
  const pageAlt = cell ? `Page ${cell.page} of ${source?.title ?? cell.source_id}, with the figure ${cell.value_raw ?? ""} boxed` : "";

  return (
    <>
      <p className="eyebrow">
        <Link href="/browse">Browse</Link> / {datasetName(series.dataset)} / <Link href={seriesHref(series.series_id)}>{series.name}</Link>
      </p>
      <h1>
        Receipt: {series.name}, {obs.period}
        {obs.vintage !== "na" ? `, ${vintageWords(obs.vintage).toLowerCase()}` : ""}
      </h1>

      {isValue ? (
        <div className="receipt-head">
          <p className="eyebrow">Published value</p>
          <p className="receipt-value" data-receipt-value>
            {formatDecimalString(obs.value)} <small>({unit})</small>
          </p>
          <p style={{ margin: "6px 0 0" }}>
            <StatusBadge status={obs.status} /> <span className="small">{obs.evidence_summary}</span>
          </p>
          {obs.notes && (
            <p className="small" data-receipt-note style={{ margin: "8px 0 0" }}>
              <strong>Note:</strong> {obs.notes}
            </p>
          )}
        </div>
      ) : (
        <div className="receipt-head is-gap" data-receipt-gap={obs.gap_kind ?? "unknown"}>
          <p className="eyebrow">No value is shown for this figure</p>
          <p className="receipt-gap">{gapWords(obs.gap_kind)}</p>
          <p>{obs.gap_kind ? GAP_EXPLAIN[obs.gap_kind] : "This release holds no value for this figure."}</p>
          {obs.gap_reason && (
            <p className="small">
              <strong>Reason recorded for this figure:</strong> {obs.gap_reason}
            </p>
          )}
          <p className="small" style={{ marginBottom: 0 }}>
            <GapBadge kind={obs.gap_kind} /> A missing figure shown as a labelled gap is acceptable to us. A wrong figure is not.
          </p>
        </div>
      )}

      <dl className="facts">
        <dt>Series</dt>
        <dd>
          <Link href={seriesHref(series.series_id)}>{series.name}</Link> <span className="mono small">({series.series_id})</span>
        </dd>
        <dt>Period</dt>
        <dd>{obs.period}</dd>
        <dt>Kind of figure</dt>
        <dd>{vintageLong(obs.vintage)}</dd>
        <dt>Unit and scale</dt>
        <dd>
          {unit}
          {obs.scale_factor && obs.scale_factor !== 1 ? ` (the printed number is multiplied by ${formatDecimalString(String(obs.scale_factor))} to get the full amount)` : ""}
        </dd>
        {isValue && cell && (
          <>
            <dt>As printed on the page</dt>
            <dd>
              <span className="mono" data-printed>
                {cell.value_raw}
              </span>
            </dd>
            <dt>As stored after parsing</dt>
            <dd>
              <span className="mono">{cell.value_parsed ?? obs.value}</span>
              {cell.normalization_flags.length > 0 ? <span className="small"> (changes made while parsing: {cell.normalization_flags.join(", ").replaceAll("_", " ")})</span> : null}
            </dd>
          </>
        )}
        {isValue && !cell && (
          <>
            <dt>Value</dt>
            <dd>{valueWithUnit(obs.value, obs.unit, obs.scale_factor)}</dd>
          </>
        )}
        <dt>Observation id</dt>
        <dd className="mono">{obs.obs_id}</dd>
      </dl>

      <div className="actions">
        <a className="button" href={receiptJsonHref(obs.obs_id)} download>
          Download this receipt (JSON)
        </a>
        <Link className="button" href={seriesHref(series.series_id)}>
          See the whole series
        </Link>
      </div>
      <Cite path={path} what={`Observation ${obs.obs_id}`} source={isValue ? source : null} page={isValue ? cell?.page : null} />

      {isValue && series.derived && (
        <>
          <h2>How this figure was computed</h2>
          <p>
            This figure is not printed by the government. It is computed by code from checked figures.
            {series.derivation ? (
              <>
                {" "}
                Formula: <span className="mono">{series.derivation.formula}</span>.
              </>
            ) : null}
          </p>
          {inputs.length > 0 && (
            <ul>
              {inputs.map((i) => {
                const s = d.seriesById.get(i.series_id);
                return (
                  <li key={i.obs_id}>
                    {s?.name ?? i.series_id}, {i.period}, {vintageWords(i.vintage).toLowerCase()}:{" "}
                    <Link href={obsHref(i.obs_id)} className="value">
                      {i.published && i.value !== null ? valueWithUnit(i.value, i.unit, i.scale_factor) : gapWords(i.gap_kind)}
                    </Link>{" "}
                    (open its receipt)
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {isValue && cell && (
        <>
          <h2>Where it is printed</h2>
          <p>
            {source ? <Link href={sourceHref(source.source_id)}>{source.title}</Link> : cell.source_id}, page {cell.page} of the PDF file. Row label as
            printed: &ldquo;{cell.row_label_raw}&rdquo;. Column label as printed: &ldquo;{cell.col_label_raw}&rdquo;.
          </p>
          {image ? (
            <>
              <h3>Close-up</h3>
              <ZoomedCell image={image} cell={cell} alt={`Close-up. ${pageAlt}`} />
              <h3>The whole page</h3>
              <p className="small">The red box marks the figure. The dashed blue outline marks the table it was read from.</p>
              <PageWithBox image={image} cell={cell} alt={pageAlt} />
            </>
          ) : (
            <p className="notice">No page image is included in this release for this page. Use the links to the official file below and go to page {cell.page}.</p>
          )}
        </>
      )}

      <h2>Checks this figure took part in</h2>
      {checks.length === 0 ? (
        <p>{isValue && series.derived ? "A computed figure has no checks of its own. Each input has its own receipt and checks." : "No checks have been run on this figure in this release."}</p>
      ) : (
        <ul className="checks">
          {checks.map((c) => (
            <li key={c.check_id}>
              <CheckBadge result={c.result} /> <span className="small muted">{CHECK_TYPE_WORDS[c.check_type] ?? c.check_type.replaceAll("_", " ")}</span>
              <p>{c.description}</p>
              {c.result === "not_evaluable" && c.not_evaluable_reason && <p className="small">Why it could not run: {c.not_evaluable_reason}</p>}
              <p className="small muted">
                <span className="mono">{c.check_id}</span>
                {c.tolerance_rule ? <> &middot; Rule: {c.tolerance_rule}</> : null}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2>What the status means</h2>
      <dl className="facts">
        <dt>Status</dt>
        <dd>
          {obs.status === "checked" ? (
            <>
              <StatusBadge status={obs.status} /> {CHECKED_HELP}
            </>
          ) : obs.status === "disputed" ? (
            <>
              <StatusBadge status={obs.status} /> Checks disagree about this figure, so it is not shown as a value.
            </>
          ) : (
            <>
              <StatusBadge status={obs.status} /> This figure has not passed a check, so it is not shown as a value.
            </>
          )}
        </dd>
        {obs.tier && (
          <>
            <dt>Evidence tier</dt>
            <dd>{TIER_WORDS[obs.tier] ?? `Tier ${obs.tier}`}</dd>
          </>
        )}
        {obs.evidence_summary && (
          <>
            <dt>Evidence in one sentence</dt>
            <dd>{obs.evidence_summary}</dd>
          </>
        )}
      </dl>
      <p className="small">No language model wrote this figure or decided whether it passes. The absolute error rate of this release has not been measured yet.</p>

      {supporting.length > 0 && (
        <>
          <h2>Other places that print the same figure</h2>
          {supporting.map((c) => (
            <PrintedCell key={c.cell_id} cell={c} heading={`${d.sourceById.get(c.source_id)?.title ?? c.source_id}, page ${c.page}`} />
          ))}
        </>
      )}

      {isValue && cell && source && verif && (
        <>
          <h2>Source document</h2>
          <dl className="facts">
            <dt>Title</dt>
            <dd>
              <Link href={sourceHref(source.source_id)}>{source.title}</Link>
            </dd>
            <dt>Publisher</dt>
            <dd>{source.publisher}</dd>
            <dt>Page of the PDF file</dt>
            <dd>{cell.page}</dd>
            <dt>How we know the file is genuine</dt>
            <dd>{verif.caveat ? <span className="notice" style={{ display: "block", margin: 0 }}>{verif.text}</span> : verif.text}</dd>
            {source.notes && (
              <>
                <dt>Notes and caveats</dt>
                <dd>{source.notes}</dd>
              </>
            )}
            <dt>File fingerprint (SHA-256)</dt>
            <dd className="mono small">{source.sha256}</dd>
            <dt>Extraction run</dt>
            <dd className="mono small">{cell.run_id}</dd>
            <dt>Read by</dt>
            <dd>
              {cell.extractor_name} {cell.extractor_version} <span className="small muted">(a table-extraction tool; it does not generate numbers)</span>
            </dd>
            <dt>Cell id</dt>
            <dd className="mono small">{cell.cell_id}</dd>
            <dt>Links</dt>
            <dd>
              {source.file_url && (
                <>
                  <a href={source.file_url}>Official file</a>
                  {" · "}
                </>
              )}
              {source.landing_url && (
                <>
                  <a href={source.landing_url}>Official landing page</a>
                  {" · "}
                </>
              )}
              {source.wayback_url && (
                <>
                  <a href={source.wayback_url}>Internet Archive snapshot</a>
                  {" · "}
                </>
              )}
              <Link href={sourceHref(source.source_id)}>Our source record</Link>
            </dd>
          </dl>
        </>
      )}
    </>
  );
}
