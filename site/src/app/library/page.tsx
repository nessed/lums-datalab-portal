// The Library (data hub plan, section 7.1; Home v3 pages set, 2026-11-24):
// every document our figures are read from, in plain words, newest first, with
// filters on the left (title words, publisher, kind, year). Each row: a cover,
// the plain name, the publisher and period, pages, file size and how many
// checked figures were read from it, and Read (the viewer), Download (only a
// copy whose fingerprint matches the registered file) and Official page.
// Internal names, roles, verification records and coverage are on each
// document's page. The datasets are the second tab (/library/datasets).
import type { Metadata } from "next";
import Crumbs from "@/components/chrome/Crumbs";
import { Count } from "@/components/ui/Num";
import Link from "@/components/ui/Link";
import LibraryFilter from "@/components/library/LibraryFilter";
import { DocActions, DocMeta, DocName, DocPeriod, LibraryTabs } from "@/components/library/Bits";
import { db, library, sourceHref } from "@/lib/data";
import type { LibraryDocument } from "@/lib/adapter/contract";
import { chapterOf, docPeriodKind, yearOfDoc } from "@/lib/library-format";
import { periodWords } from "@/lib/format";
import "@/styles/v4-library.css";

export const metadata: Metadata = {
  title: "Library",
  description: "Every government document behind the figures on this site: read it here, download it, or open the official page that publishes it.",
};

/** Lower-case words a reader may filter on: the plain name, the printed title, the period, the publisher. */
function searchText(d: LibraryDocument): string {
  const when = docPeriodKind(d.kind) === "month" ? periodWords(d.period, "month") : d.period;
  return [d.kindName, when, chapterOf(d.kind, d.printedTitle), d.printedTitle, d.publisher].filter(Boolean).join(" ").toLowerCase();
}

/** Checked figures whose main printing is in each document (the count key values:source:<id>). */
function figuresBySource(): Map<string, number> {
  const d = db();
  const m = new Map<string, number>();
  for (const o of d.observations) {
    if (!(o.published && o.value !== null) || !o.primary_cell_id) continue;
    const src = d.cellById.get(o.primary_cell_id)?.source_id;
    if (src) m.set(src, (m.get(src) ?? 0) + 1);
  }
  return m;
}

export default function LibraryPage() {
  const lib = library();
  const docs = lib.documents;
  const figs = figuresBySource();
  const kinds = [...new Set(docs.map((d) => d.kind))];
  const publishers = [...new Set(docs.map((d) => d.publisher))].sort();
  const years = [...new Set(docs.map((d) => yearOfDoc(d.period, d.kind)))].sort((a, b) => b.localeCompare(a));
  // Newest first; within one period a rejected file comes after the one used.
  const list = docs
    .map((d, i) => ({ d, i }))
    .sort(
      (a, b) =>
        yearOfDoc(b.d.period, b.d.kind).localeCompare(yearOfDoc(a.d.period, a.d.kind)) ||
        b.d.period.localeCompare(a.d.period) ||
        Number(a.d.state === "rejected") - Number(b.d.state === "rejected") ||
        a.i - b.i,
    )
    .map((x) => x.d);
  return (
    <div className="lib lib4">
      <Crumbs items={[{ label: "Library" }]} />
      <header className="lib4-head">
        <h1>Library</h1>
        <p className="lib4-lede">Every government document we read, to open on this site or download, and every dataset we built from them.</p>
      </header>
      <LibraryTabs current="docs" />

      <div className="lib4-grid">
        <aside className="lib4-side" aria-label="Filters">
          <LibraryFilter
            target="lib-docs"
            rows={docs.map((d) => ({ id: d.id, kind: d.kind, publisher: d.publisher, year: yearOfDoc(d.period, d.kind), text: searchText(d) }))}
            kinds={kinds.map((k) => ({ value: k, label: docs.find((d) => d.kind === k)!.kindName }))}
            publishers={publishers.map((p) => ({ value: p, label: p }))}
            years={years.map((y) => ({ value: y, label: y }))}
          />
        </aside>
        <div className="lib4-main">
          <p className="lib4-count" id="lib-docs-n">
            <Count k="sources:all" n={docs.length} /> documents · newest first
          </p>
          <ul className="lib4-list" id="lib-docs">
            {list.map((d) => (
              <li
                key={d.id}
                className={`lib4-row${d.state === "rejected" ? " is-rejected" : ""}`}
                data-lib-row={d.id}
                data-kind={d.kind}
                data-publisher={d.publisher}
                data-year={yearOfDoc(d.period, d.kind)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/cover-blank.png" alt="" width={72} height={98} className="lib4-cover" loading="lazy" />
                <div className="lib4-body">
                  <h2 className="lib4-name">
                    <Link href={sourceHref(d.id)}>
                      <DocName doc={d} />
                    </Link>
                  </h2>
                  <p className="lib4-by">
                    {d.publisher} · <DocPeriod doc={d} />
                    <span className="lib4-printed"> · {d.printedTitle}</span>
                  </p>
                  <p className="lib4-meta">
                    <DocMeta doc={d} publisher={false} />
                    {figs.get(d.id) ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <Count k={`values:source:${d.id}`} n={figs.get(d.id)} /> figures read
                      </>
                    ) : null}
                  </p>
                  {d.state === "rejected" ? (
                    <p className="lib4-rejected">
                      <strong>Not used.</strong> {d.rejectedReason}
                    </p>
                  ) : null}
                </div>
                <DocActions doc={d} primary />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
