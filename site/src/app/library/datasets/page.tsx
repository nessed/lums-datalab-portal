// Datasets (data hub plan, section 7.2): one card per dataset, in plain words,
// with the years it covers, its number of series, a preview of a few of its
// figures (each a link to its receipt), downloads (CSV, Excel, data package)
// and a way into the chart builder. The whole release as one file sits at the
// top. Every file listed is written at build time from the release
// (scripts/prebuild/take.mjs); sizes are recomputed by scripts/checks/library-counts.mjs.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { Breadcrumbs, TableWrap } from "@/components/ui/Basics";
import { IconDownload } from "@/components/ui/Icons";
import { Count, Num, V } from "@/components/ui/Num";
import { db, library, seriesHref } from "@/lib/data";
import type { LibraryDataset } from "@/lib/adapter/contract";
import { periodWords, unitLabel } from "@/lib/format";
import { fileSizeText, SIZE_OF_DOWNLOAD } from "@/lib/library-format";
import { datasetStats, mainVintage } from "@/lib/stats";
import { fileHref, fileSize } from "@/lib/take";
import { KIND } from "@/lib/words";

export const metadata: Metadata = {
  title: "Datasets",
  description: "Every dataset on the site: what it measures, the years it covers, a preview of its figures, and downloads as CSV or Excel.",
};

const FORMATS = [
  { ext: "xlsx", label: "Excel" },
  { ext: "csv", label: "CSV" },
  { ext: "zip", label: "Data package" },
] as const;

/** A built download with its size; nothing when the build has no such file. */
function Download({ rel, label, primary }: { rel: string; label: string; primary?: boolean }) {
  const n = fileSize(rel);
  if (n === null) return null;
  return (
    <a className={`btn${primary ? " btn-primary" : ""} lib-act`} href={fileHref(rel)} download>
      <IconDownload />
      <span>
        {label}{" "}
        <span className="lib-size" data-num="derived" data-derived={SIZE_OF_DOWNLOAD} data-file={rel}>
          {fileSizeText(n)}
        </span>
      </span>
    </a>
  );
}

function Preview({ ds }: { ds: LibraryDataset }) {
  const d = db();
  const rows = ds.previewSeries.slice(0, 4).flatMap((id) => {
    const s = d.seriesById.get(id);
    if (!s) return [];
    const kind = mainVintage(id);
    const obs = (d.obsBySeries.get(id) ?? [])
      .filter((o) => o.published && o.value !== null && o.reader.showsValue && o.vintage === kind)
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, 3);
    return obs.map((o) => ({ s, o }));
  });
  if (!rows.length) return null;
  return (
    <details className="lib-preview">
      <summary>Preview</summary>
      <TableWrap label={`A few figures of ${ds.name}`}>
        <table className="lib-preview-table">
          <thead>
            <tr>
              <th scope="col">Series</th>
              <th scope="col">Period</th>
              <th scope="col">Kind of figure</th>
              <th scope="col" className="num">
                Value
              </th>
              <th scope="col">Unit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, o }) => (
              <tr key={o.obs_id}>
                <th scope="row">
                  <Link href={seriesHref(s.series_id)}>{s.title}</Link>
                </th>
                <td>
                  <Num kind="period">{periodWords(o.period, s.frequency)}</Num>
                </td>
                <td>{o.kind === "as_printed" ? "" : (KIND[o.kind]?.long ?? "")}</td>
                <td className="num tnum">
                  <V o={o} />
                </td>
                <td className="small">{unitLabel(o.unit, o.scale_factor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <p className="small muted">The most recent figures of a few series. The download holds every figure, with where each one is printed.</p>
    </details>
  );
}

export default function DatasetsPage() {
  const lib = library();
  const d = db();
  return (
    <div className="lib">
      <Breadcrumbs items={[{ href: "/library", label: "Library" }, { label: "Datasets" }]} />
      <header className="page-head lib-head">
        <h1>Datasets</h1>
        <p className="lede">The figures we read from the documents in the Library, by subject. Preview them, download them, or put them on a chart.</p>
        <div className="lib-all">
          <p className="lib-all-label">Everything in one file</p>
          <span className="lib-actions">
            <Download rel="all.xlsx" label="Excel" primary />
            <Download rel="all.csv" label="CSV" />
            <Download rel="all.zip" label="Data package" />
          </span>
          <p className="small muted">
            Every figure of every dataset, one row each, with the document and page it is printed on. <Link href="/data">About the files and their columns</Link>
          </p>
        </div>
      </header>

      <ul className="lib-cards">
        {lib.datasets.map((ds) => {
          const st = datasetStats(ds.key);
          const freq = d.series.find((s) => s.dataset === ds.key)?.frequency ?? null;
          const compare = `/compare?s=${ds.previewSeries
            .slice(0, 4)
            .map((id) => encodeURIComponent(id))
            .join(",")}`;
          return (
            <li key={ds.key} className="lib-card" id={`d-${ds.key}`}>
              <h2 className="lib-card-name">{ds.name}</h2>
              <p className="lib-card-line">{ds.line}</p>
              {ds.visible ? (
                <>
                  <p className="lib-card-facts">
                    {ds.firstPeriod && ds.lastPeriod ? (
                      <span>
                        <Num kind="period">{periodWords(ds.firstPeriod, freq)}</Num> to <Num kind="period">{periodWords(ds.lastPeriod, freq)}</Num>
                      </span>
                    ) : null}
                    <span aria-hidden="true"> · </span>
                    <span>
                      <Count k={`series:${ds.key}`} n={ds.seriesCount} /> series
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>
                      from <Count k={`docs:${ds.key}`} n={st.docs.length} /> {st.docs.length === 1 ? "document" : "documents"}
                    </span>
                  </p>
                  <span className="lib-actions">
                    {FORMATS.map((f) => (
                      <Download key={f.ext} rel={`datasets/${ds.key}.${f.ext}`} label={f.label} primary={f.ext === "xlsx"} />
                    ))}
                    {ds.previewSeries.length ? (
                      <Link className="btn btn-secondary lib-act" href={compare}>
                        Open in chart builder
                      </Link>
                    ) : null}
                  </span>
                  <Preview ds={ds} />
                  <p className="lib-card-links small">
                    <Link href={`/browse?dataset=${ds.key}`}>Every series</Link> · <Link href={`/datasets/${ds.key}#tables`}>Tables as the documents print them</Link> ·{" "}
                    <Link href={`/datasets/${ds.key}`}>How it is checked</Link> · <Link href={`/library?kind=${encodeURIComponent(lib.documents.find((x) => ds.documentIds.includes(x.id))?.kind ?? "")}`}>The documents</Link>
                  </p>
                </>
              ) : (
                <p className="lib-card-facts">Coming soon: its figures are still being checked.</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
