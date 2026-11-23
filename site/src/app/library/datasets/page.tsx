// Datasets (data hub plan, section 7.2; Home v3 pages set, 2026-11-24): the
// second tab of the Library. On top, "Everything in one download"; then one row
// per dataset in a table: plain name and what it measures, the years it covers,
// its number of series, and Preview, CSV, Excel and Chart. The previews (a few of
// its latest figures, each a link to its receipt) open below the table. Every
// file listed is written at build time from the release
// (scripts/prebuild/take.mjs); sizes are recomputed by scripts/checks/library-counts.mjs.
import type { Metadata } from "next";
import Crumbs from "@/components/chrome/Crumbs";
import Link from "@/components/ui/Link";
import { TableWrap } from "@/components/ui/Basics";
import { Count, Num, V } from "@/components/ui/Num";
import { LibraryTabs } from "@/components/library/Bits";
import { db, library, seriesHref, visibleSeries } from "@/lib/data";
import type { LibraryDataset } from "@/lib/adapter/contract";
import { dateOnly, periodWords, unitLabel } from "@/lib/format";
import { fileSizeText, SIZE_OF_DOWNLOAD } from "@/lib/library-format";
import { mainVintage } from "@/lib/stats";
import { seriesTitle } from "@/lib/titles";
import { fileHref, fileSize } from "@/lib/take";
import { KIND } from "@/lib/words";
import "@/styles/v4-library.css";

export const metadata: Metadata = {
  title: "Datasets",
  description: "Every dataset on the site: what it measures, the years it covers, a preview of its figures, and downloads as CSV or Excel.",
};

/** A built download with its size; nothing when the build has no such file. */
function Download({ rel, label, size = true }: { rel: string; label: string; size?: boolean }) {
  const n = fileSize(rel);
  if (n === null) return null;
  return (
    <a href={fileHref(rel)} download>
      {label}
      {size ? (
        <>
          {" "}
          (
          <span className="lib-size" data-num="derived" data-derived={SIZE_OF_DOWNLOAD} data-file={rel}>
            {fileSizeText(n)}
          </span>
          )
        </>
      ) : null}
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
    <details className="lib4-preview" id={`p-${ds.key}`}>
      <summary>Preview: {ds.name}</summary>
      <TableWrap label={`A few figures of ${ds.name}`}>
        <table className="lib4-tbl">
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
                  <Link href={seriesHref(s.series_id)}>{seriesTitle(s)}</Link>
                </th>
                <td>
                  <Num kind="period">{periodWords(o.period, s.frequency)}</Num>
                </td>
                <td>{o.kind === "as_printed" ? "" : (KIND[o.kind]?.long ?? "")}</td>
                <td className="num tnum">
                  <V o={o} sheet />
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
    <div className="lib lib4">
      <Crumbs items={[{ href: "/library", label: "Library" }, { label: "Datasets" }]} />
      <header className="lib4-head">
        <h1>Library</h1>
        <p className="lib4-lede">Every government document we read, to open on this site or download, and every dataset we built from them.</p>
      </header>
      <LibraryTabs current="sets" />

      <div className="lib4-all">
        <p>
          <strong>Everything in one download</strong>{" "}
          <span className="muted">
            · <Count k="series" n={visibleSeries().length} /> series · release of <Num kind="date">{dateOnly(d.release.created_at)}</Num>
          </span>
        </p>
        <p className="lib4-all-links">
          <Download rel="all.csv" label="all.csv" />
          <Download rel="all.xlsx" label="all.xlsx" />
          <Download rel="all.zip" label="all.zip with the sources list" />
          <Link href="/data">About the files and their columns</Link>
        </p>
      </div>

      <div className="tbl4-scroll">
        <table className="lib4-tbl lib4-sets">
          <thead>
            <tr>
              <th scope="col">Dataset</th>
              <th scope="col">Covers</th>
              <th scope="col" className="num">
                Series
              </th>
              <th scope="col" className="num">
                Get it
              </th>
            </tr>
          </thead>
          <tbody>
            {lib.datasets.map((ds) => {
              const freq = d.series.find((s) => s.dataset === ds.key)?.frequency ?? null;
              const compare = `/compare?s=${ds.previewSeries
                .slice(0, 4)
                .map((id) => encodeURIComponent(id))
                .join(",")}`;
              return (
                <tr key={ds.key} id={`d-${ds.key}`}>
                  <td>
                    {ds.visible ? (
                      <Link href={`/browse?dataset=${ds.key}`} className="strong">
                        {ds.name}
                      </Link>
                    ) : (
                      <strong>{ds.name}</strong>
                    )}
                    <span className="lib4-line">{ds.line}</span>
                    {ds.visible ? (
                      <span className="lib4-line">
                        <Link href={`/datasets/${ds.key}#tables`}>Tables as printed</Link> · <Link href={`/datasets/${ds.key}`}>How it is checked</Link>
                      </span>
                    ) : null}
                  </td>
                  <td className="nowrap muted">
                    {ds.visible && ds.firstPeriod && ds.lastPeriod ? (
                      <>
                        <Num kind="period">{periodWords(ds.firstPeriod, freq)}</Num> to <Num kind="period">{periodWords(ds.lastPeriod, freq)}</Num>
                      </>
                    ) : (
                      "Coming soon"
                    )}
                  </td>
                  <td className="num">{ds.visible ? <Count k={`series:${ds.key}`} n={ds.seriesCount} /> : null}</td>
                  <td className="num">
                    {ds.visible ? (
                      <span className="lib4-get">
                        {ds.previewSeries.length ? <a href={`#p-${ds.key}`}>Preview</a> : null}
                        <Download rel={`datasets/${ds.key}.csv`} label="CSV" size={false} />
                        <Download rel={`datasets/${ds.key}.xlsx`} label="Excel" size={false} />
                        {ds.previewSeries.length ? <Link href={compare}>Chart</Link> : null}
                      </span>
                    ) : (
                      <span className="muted">Its figures are still being checked</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="lib4-previews">
        {lib.datasets
          .filter((ds) => ds.visible)
          .map((ds) => (
            <Preview key={ds.key} ds={ds} />
          ))}
      </div>
    </div>
  );
}
