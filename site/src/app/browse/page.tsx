// The catalogue: every series of every published dataset, arranged the way the
// documents arrange them, with what each one holds at a glance; and every
// source document with what it contributes. A client filter (text, dataset,
// "has values") narrows it; the state lives in the URL.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import BrowseFilter from "@/components/BrowseFilter";
import { Breadcrumbs, Callout } from "@/components/ui/Basics";
import { datasetKeys, datasetName, db, isDatasetPublished, obsHref, publishedObs, seriesHref, sourceHref, type Series } from "@/lib/data";
import { count, DOC_TYPE_WORDS, formatDecimalString, periodWords, unitLabel } from "@/lib/format";
import { datasetStateWords } from "@/lib/status";

export const metadata: Metadata = {
  title: "Browse the catalogue",
  description: "Every series in the current release, by dataset, with the periods covered, checked values and latest figure; and every source document.",
};

/* ---------- one series row ---------- */

function Spark({ s }: { s: Series }) {
  const pub = publishedObs(s.series_id);
  if (pub.length < 2) return <span className="spark-none" aria-hidden="true" />;
  const counts = new Map<string, number>();
  for (const o of pub) counts.set(o.vintage, (counts.get(o.vintage) ?? 0) + 1);
  const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const pts = pub.filter((o) => o.vintage === main).sort((a, b) => a.period.localeCompare(b.period));
  if (pts.length < 2) return <span className="spark-none" aria-hidden="true" />;
  const ys = pts.map((o) => Number(o.value));
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const W = 64;
  const H = 18;
  const x = (i: number) => 1 + (i / (pts.length - 1)) * (W - 2);
  const y = (v: number) => H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4);
  const d = ys.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={d} />
      <circle cx={x(ys.length - 1)} cy={y(ys[ys.length - 1])} r={1.8} />
    </svg>
  );
}

function shortName(s: Series): string {
  // "CPI National: Food and non-alcoholic beverages, index (base 2015-16)" -> the part after the colon
  return s.dataset === "cpi" ? s.name.replace(/^CPI [^:]+:\s*/, "") : s.name;
}

function Row({ s, depth, label }: { s: Series; depth: number; label?: string }) {
  const d = db();
  const all = d.obsBySeries.get(s.series_id) ?? [];
  const pub = all.filter((o) => o.published && o.value !== null);
  const periods = [...new Set(all.map((o) => o.period))].sort();
  const latest = [...pub].sort((a, b) => b.period.localeCompare(a.period) || (a.vintage === "re" ? -1 : 1))[0];
  const hay = [s.name, s.series_id, ...(s.synonyms ?? []), datasetName(s.dataset)].join(" ").toLowerCase();
  return (
    <div className={`cat-row${depth === 0 ? " is-top" : ""}`} data-cat-row data-search={hay} data-dataset={s.dataset} data-values={pub.length > 0 ? "1" : "0"} style={{ ["--depth" as string]: depth }}>
      <span className="cat-name">
        <Link href={seriesHref(s.series_id)}>{label ?? shortName(s)}</Link>
        {s.derived ? <span className="cat-tag">computed</span> : null}
      </span>
      <span className="cat-periods small">
        <span className="cat-unit">{unitLabel(s.unit, s.scale_factor)}</span>
        {periods.length ? `${periodWords(periods[0], s.frequency)} to ${periodWords(periods[periods.length - 1], s.frequency)}` : "no periods"}
      </span>
      <span className="cat-count small num">
        {pub.length}/{all.length}
      </span>
      <span className="cat-latest small num">
        {latest ? (
          <Link href={obsHref(latest.obs_id)} className="v-link" title={`${periodWords(latest.period, s.frequency)}, ${unitLabel(s.unit, s.scale_factor)}`}>
            {formatDecimalString(latest.value)}
          </Link>
        ) : (
          <span className="muted">no value</span>
        )}
      </span>
      <span className="cat-spark">
        <Spark s={s} />
      </span>
    </div>
  );
}

/** A series and its parts, collapsible below the first two levels. */
function Tree({ s, depth }: { s: Series; depth: number }): ReactNode {
  const kids = (db().childrenOf.get(s.series_id) ?? []).filter((c) => c.dataset === s.dataset);
  if (kids.length === 0) return <Row s={s} depth={depth} />;
  return (
    <div className="cat-node">
      <Row s={s} depth={depth} />
      <details className="cat-kids" open={depth < 1} style={{ ["--depth" as string]: depth }}>
        <summary>
          {kids.length} {kids.length === 1 ? "part" : "parts"}
          <span className="sr-only"> of {s.name}</span>
        </summary>
        {kids.map((k) => (
          <Tree key={k.series_id} s={k} depth={depth + 1} />
        ))}
      </details>
    </div>
  );
}

const MEASURE_WORDS: Record<string, string> = {
  index: "Index level",
  yoy: "Change over the same month of the previous year (per cent)",
  mom: "Change over the previous month (per cent)",
  weight: "Weight in the basket (per cent)",
};

function HeadRow() {
  return (
    <div className="cat-row cat-head" aria-hidden="true">
      <span>Series</span>
      <span>Unit and periods</span>
      <span className="num">Checked</span>
      <span className="num">Latest</span>
      <span>Trend</span>
    </div>
  );
}

function DatasetBlock({ k }: { k: string }) {
  const d = db();
  const ds = d.release.dataset_status[k];
  const all = d.series.filter((s) => s.dataset === k);
  const roots = (d.childrenOf.get("") ?? []).filter((s) => s.dataset === k);
  const values = all.reduce((a, s) => a + publishedObs(s.series_id).length, 0);
  const head = (
    <header className="cat-ds-head">
      <h2 id={`ds-${k}`}>{ds?.name ?? k}</h2>
      <p className="small muted">
        {isDatasetPublished(k) ? `${count(all.length)} series · ${count(values)} checked values` : datasetStateWords(ds?.state)}
      </p>
    </header>
  );
  if (!isDatasetPublished(k)) {
    return (
      <section className="cat-ds" data-cat-dataset={k}>
        {head}
        <Callout kind="caveat" title="Not published in this release">
          <p>{ds?.reasons?.length ? ds.reasons.join("; ") : "No values from this dataset are published in this release."}</p>
        </Callout>
      </section>
    );
  }
  // Datasets with many flat roots (CPI) are arranged by their dimensions:
  // area as printed, then measure. Others follow their hierarchy.
  let body: ReactNode;
  if (roots.length > 12) {
    const areaOf = (s: Series) => s.dims?.area ?? (s.dims?.area_as_printed ? "area not stated" : "other");
    const areas = [...new Set(all.map(areaOf))];
    body = areas.map((a) => {
      const inArea = all.filter((s) => areaOf(s) === a);
      const measures = [...new Set(inArea.map((s) => `${s.dims?.measure ?? "other"}|${s.dims?.base_year ?? ""}`))];
      return (
        <details key={a} className="cat-group" open={a === "national"}>
          <summary>
            <span className="cat-group-title">{a === "area not stated" ? "Area not stated in the document (2007-08 base)" : a.charAt(0).toUpperCase() + a.slice(1)}</span>
            <span className="small muted"> {inArea.length} series</span>
          </summary>
          {measures.map((m) => {
            const [measure, base] = m.split("|");
            const rows = inArea.filter((s) => (s.dims?.measure ?? "other") === measure && (s.dims?.base_year ?? "") === base).sort((x, y) => x.sort_key - y.sort_key);
            return (
              <div key={m} className="cat-measure">
                <h3>
                  {MEASURE_WORDS[measure] ?? measure.replaceAll("_", " ")}
                  {base ? <span className="muted">, base {base}</span> : null}
                </h3>
                <HeadRow />
                {rows.map((s) => (
                  <Row key={s.series_id} s={s} depth={s.dims?.group === "general" ? 0 : 1} />
                ))}
              </div>
            );
          })}
        </details>
      );
    });
  } else {
    body = (
      <>
        <HeadRow />
        {roots.map((r) => (
          <Tree key={r.series_id} s={r} depth={0} />
        ))}
      </>
    );
  }
  return (
    <section className="cat-ds" data-cat-dataset={k} aria-labelledby={`ds-${k}`}>
      {head}
      {body}
    </section>
  );
}

export default function BrowsePage() {
  const d = db();
  const keys = datasetKeys();
  const docTypes = [...new Set(d.sources.map((s) => s.doc_type))];
  const primaryCount = new Map<string, number>();
  for (const o of d.observations) {
    if (!o.published || !o.primary_cell_id) continue;
    const src = d.cellById.get(o.primary_cell_id)?.source_id;
    if (src) primaryCount.set(src, (primaryCount.get(src) ?? 0) + 1);
  }
  return (
    <>
      <Breadcrumbs items={[{ label: "Browse" }]} />
      <header className="page-head">
        <h1>Browse the catalogue</h1>
        <p className="lede">
          Every series in release {d.release.version}, arranged as the government documents arrange them. Open a series for its chart and table;
          open any figure for its receipt.
        </p>
      </header>

      <BrowseFilter datasets={keys.filter(isDatasetPublished).map((k) => ({ key: k, name: datasetName(k) }))} />

      <div className="cat-legend small muted">
        <span>
          <strong>Checked</strong>: checked values out of all figures in the series (the rest are labelled gaps).
        </span>
        <span>
          <strong>Latest</strong>: the most recent checked value, linked to its receipt.
        </span>
      </div>

      <div id="catalogue">
        {keys.map((k) => (
          <DatasetBlock key={k} k={k} />
        ))}
        <p className="cat-empty" data-cat-empty hidden>
          No series matches. Try fewer words, another dataset, or <a href="/browse">clear the filters</a>.
        </p>
      </div>

      <section className="cat-docs" aria-labelledby="by-document">
        <h2 id="by-document">By document</h2>
        <p className="measure">Each government document, and how many checked values in this release are read from it.</p>
        {docTypes.map((t) => (
          <div key={t} className="cat-measure">
            <h3>{DOC_TYPE_WORDS[t] ?? t}</h3>
            <div className="table-wrap" role="region" aria-label={`${DOC_TYPE_WORDS[t] ?? t} documents`} tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Period</th>
                    <th scope="col" className="num">
                      Pages read
                    </th>
                    <th scope="col" className="num">
                      Values from it
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.sources
                    .filter((s) => s.doc_type === t)
                    .map((s) => (
                      <tr key={s.source_id}>
                        <th scope="row">
                          <Link href={sourceHref(s.source_id)}>{s.title}</Link>
                          {s.verification_status === "failed" ? <span className="cat-tag">not used</span> : null}
                        </th>
                        <td>{s.period}</td>
                        <td className="num">{(s.pages_used ?? []).length || "none"}</td>
                        <td className="num">{count(primaryCount.get(s.source_id) ?? 0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
