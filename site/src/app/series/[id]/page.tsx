import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cite from "@/components/Cite";
import SeriesView from "@/components/SeriesView";
import ViewSwitch, { ViewTabs } from "@/components/ViewSwitch";
import { datasetName, db, seriesHref, slugify, visibleSeries } from "@/lib/data";
import { CHECKED_HELP, unitLabel } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return visibleSeries().map((s) => ({ id: slugify(s.series_id) }));
}

type Props = { params: Promise<{ id: string }> };

function find(id: string) {
  const d = db();
  return d.seriesBySlug.get(id) ?? d.seriesBySlug.get(decodeURIComponent(id));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = find((await params).id);
  return { title: s ? s.name : "Series" };
}

export default async function SeriesPage({ params }: Props) {
  const { id } = await params;
  const series = find(id);
  if (!series) notFound();
  const d = db();
  const parent = series.parent_id ? d.seriesById.get(series.parent_id) : undefined;
  const children = (d.childrenOf.get(series.series_id) ?? []).filter((c) => !c.derived);
  const share = d.seriesById.get(`${series.series_id}.share_of_total`);
  const shareUsable = share && share.unit === "percent" && share.derived;
  const path = seriesHref(series.series_id);
  const labels = { nominal: `Amount (${unitLabel(series.unit, series.scale_factor)})`, share: "Share of total (per cent)" };

  const nominalView = <SeriesView series={series} />;

  return (
    <>
      <p className="eyebrow">
        <Link href="/browse">Browse</Link> / {datasetName(series.dataset)}
        {parent ? (
          <>
            {" "}
            / <Link href={seriesHref(parent.series_id)}>{parent.name}</Link>
          </>
        ) : null}
      </p>
      <h1>{series.name}</h1>
      <p className="small mono">{series.series_id}</p>
      {series.definition && (
        <p className="lede">
          {series.definition}
          {series.definition_status && series.definition_status !== "reviewed" ? (
            <span className="small muted"> (Definition status: {series.definition_status}; not yet reviewed by a human.)</span>
          ) : null}
        </p>
      )}
      {series.derived && series.derivation && (
        <div className="notice notice-plain">
          <p>
            <strong>Computed series.</strong> These figures are not printed by the government. They are computed by code from checked values:{" "}
            <span className="mono">{series.derivation.formula}</span>.
          </p>
          <p>
            Inputs:{" "}
            {series.derivation.inputs.map((i, n) => (
              <span key={i}>
                {n > 0 ? ", " : ""}
                {d.seriesById.has(i) ? <Link href={seriesHref(i)}>{d.seriesById.get(i)!.name}</Link> : <span className="mono">{i}</span>}
              </span>
            ))}
            .
          </p>
        </div>
      )}
      <p className="small">
        A figure appears here only if it is <abbr title={CHECKED_HELP}>checked</abbr>. Everything else is shown as a labelled gap that says why. Click
        any figure for its receipt.
      </p>

      {shareUsable ? (
        <Suspense
          fallback={
            <>
              <ViewTabs active="nominal" labels={labels} path={path} />
              {nominalView}
            </>
          }
        >
          <ViewSwitch
            labels={labels}
            nominal={nominalView}
            share={
              <>
                <p className="small">
                  {share.name}. <span className="mono">{share.derivation?.formula}</span>. <Link href={seriesHref(share.series_id)}>Open this computed series</Link>.
                </p>
                <SeriesView series={share} />
              </>
            }
          />
        </Suspense>
      ) : (
        nominalView
      )}

      <Cite path={path} what={`Series ${series.series_id}, ${series.name}`} />

      {series.breaks.length > 0 && (
        <>
          <h2>Breaks in this series</h2>
          <ul>
            {series.breaks.map((b) => (
              <li key={b.at_period + b.kind}>
                <strong>
                  From {b.at_period} ({b.kind.replaceAll("_", " ")}).
                </strong>{" "}
                {b.note}
              </li>
            ))}
          </ul>
        </>
      )}

      {children.length > 0 && (
        <>
          <h2>Parts of this series</h2>
          <ul>
            {children.map((c) => (
              <li key={c.series_id}>
                <Link href={seriesHref(c.series_id)}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {series.synonyms && series.synonyms.length > 0 && <p className="small muted">Also known as: {series.synonyms.join(", ")}.</p>}
    </>
  );
}
