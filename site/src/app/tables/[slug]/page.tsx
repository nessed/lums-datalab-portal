// A table as printed: one table of one government document, drawn as a site
// table with its printed labels, beside the page it was read from. Pick an
// edition, pick a table; select any number to see where it sits on the page.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TableView, { type TVCell } from "@/components/TableView";
import { Breadcrumbs, ExternalLink } from "@/components/ui/Basics";
import { Count, Num } from "@/components/ui/Num";
import { datasetName, db, obsHref, pageImage, pageWords, RELEASE_VERSION, seriesHref, sourceHref } from "@/lib/data";
import { unitLabel } from "@/lib/format";
import { statusOf } from "@/lib/status";
import { datasetStats } from "@/lib/stats";
import { cellObs, tableBySlug, tablesOfSource, visibleTables, type PrintedTable } from "@/lib/tables";

export const dynamicParams = false;

export function generateStaticParams() {
  return visibleTables().map((t) => ({ slug: t.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = tableBySlug((await params).slug);
  if (!t) return { title: "Table" };
  const src = db().sourceById.get(t.sourceId);
  return { title: `${t.title}, ${src?.title ?? t.sourceId}`, description: `${t.title} as printed in ${src?.title}: every checked figure links to its receipt and to its place on the page.` };
}

/** The nth table with this title in its document (to find "the same table" in another edition). */
function rankOf(t: PrintedTable): number {
  return tablesOfSource(t.sourceId)
    .filter((x) => x.title === t.title)
    .findIndex((x) => x.slug === t.slug);
}

function csvOf(t: PrintedTable, cells: TVCell[]): string {
  const esc = (v: string | null | undefined) => {
    const s = v ?? "";
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const head = ["row_as_printed", "column_as_printed", "value_as_printed", "obs_id", "receipt", "source_id", "page", "release"];
  const lines = cells
    .filter((c) => c.state === "v")
    .map((c) =>
      [
        t.rows.find((r) => r.index === c.r)?.label,
        t.cols.find((x) => x.index === c.c)?.label,
        c.text,
        cellObs(c.id)?.obs_id,
        c.href,
        t.sourceId,
        String(t.page),
        RELEASE_VERSION,
      ]
        .map(esc)
        .join(","),
    );
  return [head.join(","), ...lines].join("\n") + "\n";
}

export default async function TablePage({ params }: Props) {
  const { slug } = await params;
  const t = tableBySlug(slug);
  if (!t || !visibleTables().some((x) => x.slug === t.slug)) notFound();
  const d = db();
  const src = d.sourceById.get(t.sourceId);
  const dataset = t.dataset ?? "";
  const docs = datasetStats(dataset).docs;
  const siblings = tablesOfSource(t.sourceId);
  const rank = rankOf(t);
  const image = pageImage(t.sourceId, t.page);
  const first = t.cells[0];

  const cells: TVCell[] = t.cells.map((c) => {
    const o = cellObs(c.cell_id);
    const s = o ? d.seriesById.get(o.series_id) : undefined;
    if (!o) return { id: c.cell_id, r: c.row_index, c: c.col_index, state: "none", text: null, label: null, href: null, box: null, series: null, seriesHref: null, unit: null };
    const info = statusOf(o);
    const isValue = info.key === "checked";
    // A page box only for a checked figure, or where the government printed no
    // figure (the page then shows the dash). Never for an unverified or withheld reading.
    const boxOk = isValue || (info.key === "gap-source" && !c.value_parsed);
    return {
      id: c.cell_id,
      r: c.row_index,
      c: c.col_index,
      state: isValue ? "v" : (info.key as Exclude<TVCell["state"], "v" | "none">),
      text: isValue ? (c.value_raw ?? "").trim() : null,
      label: isValue ? null : info.label,
      href: obsHref(o.obs_id),
      box: boxOk ? c.cell_bbox_norm : null,
      series: s?.name ?? null,
      seriesHref: s ? seriesHref(s.series_id) : null,
      unit: s ? unitLabel(s.unit, s.scale_factor) : null,
    };
  });
  const units = [...new Set(cells.map((c) => c.unit).filter((u): u is string => !!u))];
  const nValues = cells.filter((c) => c.state === "v").length;
  const nGaps = cells.filter((c) => c.state !== "v" && c.state !== "none").length;
  const nNone = cells.filter((c) => c.state === "none").length;
  const csv = `data:text/csv;charset=utf-8,${encodeURIComponent(csvOf(t, cells))}`;

  // The same table in each other edition: same title, same position among tables with that title.
  const editions = docs.map((sid) => {
    const ts = tablesOfSource(sid);
    const same = ts.filter((x) => x.title === t.title);
    const target = same[Math.min(rank, same.length - 1)] ?? ts[0];
    return { sid, src: d.sourceById.get(sid), target };
  });

  return (
    <article className="table-page">
      <Breadcrumbs
        items={[
          { href: "/browse", label: "Data" },
          { href: `/datasets/${dataset}`, label: datasetName(dataset) },
          { href: `/datasets/${dataset}#tables`, label: "Tables as printed" },
          { href: sourceHref(t.sourceId), label: src?.title ?? t.sourceId },
          { label: t.title },
        ]}
      />
      <header className="tp-head">
        <h1>{t.title}</h1>
        <p className="muted">
          <Link href={sourceHref(t.sourceId)}>{src?.title ?? t.sourceId}</Link> · <Num kind="page">{pageWords(first, src?.page_count)}</Num>
          {t.onPage > 1 ? (
            <>
              {" "}
              · table <Num kind="page">{t.tableIndex + 1}</Num> on the page
            </>
          ) : null}
        </p>
      </header>

      <nav className="tp-editions" aria-label="The same table in other editions">
        <span className="label">Edition</span>
        <ul>
          {editions.map((e) =>
            e.target ? (
              <li key={e.sid}>
                <Link href={`/tables/${e.target.slug}`} aria-current={e.sid === t.sourceId ? "page" : undefined}>
                  <Num kind="period">{e.src?.period ?? e.sid}</Num>
                </Link>
              </li>
            ) : null,
          )}
        </ul>
      </nav>

      <div className="tp-layout">
        <details className="tp-list-m">
          <summary>
            Tables in this edition (<Count k={`tables:source:${t.sourceId}`} n={siblings.length} />)
          </summary>
          <ul>
            {siblings.map((x) => (
              <li key={x.slug}>
                <Link href={`/tables/${x.slug}`} aria-current={x.slug === t.slug ? "page" : undefined}>
                  {x.title} <span className="muted">p. <Num kind="page">{x.pageLabel ?? x.page}</Num></span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
        <nav className="tp-list" aria-label="Tables in this edition">
          <p className="label">Tables in this edition</p>
          <ul>
            {siblings.map((x) => (
              <li key={x.slug}>
                <Link href={`/tables/${x.slug}`} aria-current={x.slug === t.slug ? "page" : undefined}>
                  {x.title} <span className="muted">p. <Num kind="page">{x.pageLabel ?? x.page}</Num></span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="tp-main">
          <p className="tp-sum small">
            <Count k={`table:${t.slug}:values`} n={nValues} /> checked figures
            {nGaps ? (
              <>
                , <Count k={`table:${t.slug}:gaps`} n={nGaps} /> labelled gaps
              </>
            ) : null}
            {nNone ? (
              <>
                , <Count k={`table:${t.slug}:none`} n={nNone} /> printed cells no series uses (shown as ·)
              </>
            ) : null}
            .{units.length ? <> Values in {units.join(", ")}.</> : null} Read by <Num kind="id">{t.extractor}</Num>
            {t.extractor.startsWith("pdfplumber") ? ", the second table-reading tool, because the first reading of this table was flagged" : ""}.
          </p>
          <TableView rows={t.rows} cols={t.cols} cells={cells} image={image} tableBox={t.tableBox} caption={[t.title, src?.title ?? t.sourceId]} pageWords={pageWords(first, src?.page_count)} />
          <div className="action-row">
            <a className="btn btn-primary" href={csv} download={`${t.slug}.csv`}>
              Download this table (CSV, checked figures only)
            </a>
            {src?.file_url ? (
              <ExternalLink className="btn" href={src.file_url}>
                Official PDF, <Num kind="page">page {t.page}</Num>
              </ExternalLink>
            ) : null}
            <Link className="btn btn-text" href={sourceHref(t.sourceId)}>
              Our record of this document
            </Link>
          </div>
          <p className="small muted">
            A number is shown only where it is a checked figure. Gaps say why there is no number. Labels are printed text, as read from the page; they
            are not edited.
          </p>
        </div>
      </div>
    </article>
  );
}
