// The Library (data hub plan, section 7.1): every document our figures are read
// from, in plain words, grouped by kind, newest first. Each opens in the viewer
// on its own page, downloads (only a copy whose fingerprint matches the
// registered file) and links to the government page that publishes it. The
// datasets are one click away (/library/datasets). Internal names, roles,
// verification records and coverage are on each document's page, folded away.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { Breadcrumbs } from "@/components/ui/Basics";
import { Count } from "@/components/ui/Num";
import LibraryFilter from "@/components/library/LibraryFilter";
import { DocActions, DocMeta, DocName } from "@/components/library/Bits";
import { library, sourceHref } from "@/lib/data";
import type { LibraryDocument } from "@/lib/adapter/contract";
import { chapterOf, docPeriodKind, yearOfDoc } from "@/lib/library-format";
import { periodWords } from "@/lib/format";
import libraryNames from "../../../editorial/library.json";

export const metadata: Metadata = {
  title: "Library",
  description: "Every government document behind the figures on this site: read it here, download it, or open the official page that publishes it.",
};

const KIND_LINES = libraryNames.kinds as Record<string, { name: string; line: string; order: number }>;

/** Lower-case words a reader may filter on: the plain name, the printed title, the period, the publisher. */
function searchText(d: LibraryDocument): string {
  const when = docPeriodKind(d.kind) === "month" ? periodWords(d.period, "month") : d.period;
  return [d.kindName, when, chapterOf(d.kind, d.printedTitle), d.printedTitle, d.publisher].filter(Boolean).join(" ").toLowerCase();
}

export default function LibraryPage() {
  const lib = library();
  const docs = lib.documents;
  const kinds = [...new Set(docs.map((d) => d.kind))];
  const publishers = [...new Set(docs.map((d) => d.publisher))].sort();
  const years = [...new Set(docs.map((d) => yearOfDoc(d.period, d.kind)))].sort((a, b) => b.localeCompare(a));
  return (
    <div className="lib">
      <Breadcrumbs items={[{ label: "Library" }]} />
      <header className="page-head lib-head">
        <h1>Library</h1>
        <p className="lede">The government documents our figures come from. Read any of them here, download it, or open the page that publishes it.</p>
        <p className="lib-head-links">
          <Link href="/library/datasets" className="lib-go">
            Datasets: preview and download the figures
          </Link>
        </p>
      </header>

      <LibraryFilter
        target="lib-docs"
        rows={docs.map((d) => ({ id: d.id, kind: d.kind, publisher: d.publisher, year: yearOfDoc(d.period, d.kind), text: searchText(d) }))}
        kinds={kinds.map((k) => ({ value: k, label: docs.find((d) => d.kind === k)!.kindName }))}
        publishers={publishers.map((p) => ({ value: p, label: p }))}
        years={years.map((y) => ({ value: y, label: y }))}
      />

      <div id="lib-docs">
        {kinds.map((k) => {
          // Newest first (the Library's order); within one period a rejected file comes after the one used.
          const inKind = docs.filter((d) => d.kind === k);
          const firstOfPeriod = (d: LibraryDocument) => inKind.findIndex((x) => x.period === d.period);
          const list = inKind
            .map((d, i) => ({ d, i }))
            .sort((a, b) => firstOfPeriod(a.d) - firstOfPeriod(b.d) || Number(a.d.state === "rejected") - Number(b.d.state === "rejected") || a.i - b.i)
            .map((x) => x.d);
          const name = list[0].kindName;
          return (
            <section key={k} id={`t-${k}`} className="lib-group" aria-labelledby={`h-${k}`} data-lib-group="">
              <div className="lib-group-head">
                <h2 id={`h-${k}`}>{name}</h2>
                <p className="lib-group-line">
                  {KIND_LINES[k]?.line ?? null}{" "}
                  <span className="lib-group-n">
                    <Count k={`sources:type:${k}`} n={list.length} /> {list.length === 1 ? "document" : "documents"}
                  </span>
                </p>
              </div>
              <ul className="lib-list">
                {list.map((d) => (
                  <li
                    key={d.id}
                    className={`lib-row${d.state === "rejected" ? " is-rejected" : ""}`}
                    data-lib-row={d.id}
                    data-kind={d.kind}
                    data-publisher={d.publisher}
                    data-year={yearOfDoc(d.period, d.kind)}
                    data-text={searchText(d)}
                  >
                    <div className="lib-row-main">
                      <h3 className="lib-name">
                        <Link href={sourceHref(d.id)}>
                          <DocName doc={d} />
                        </Link>
                      </h3>
                      <p className="lib-printed">{d.printedTitle}</p>
                      {d.state === "rejected" ? (
                        <p className="lib-rejected">
                          <strong>Not used.</strong> {d.rejectedReason}
                        </p>
                      ) : null}
                    </div>
                    <p className="lib-meta">
                      <DocMeta doc={d} />
                    </p>
                    <DocActions doc={d} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="lib-next" aria-labelledby="ds-h">
        <h2 id="ds-h">The figures, ready to use</h2>
        <p>
          Every figure we read from these documents, by dataset, to preview and download as CSV or Excel. <Link href="/library/datasets">Go to the datasets</Link>
        </p>
      </section>
    </div>
  );
}
