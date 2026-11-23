// Small server pieces of the Library (data hub run, stage 2): a document's plain
// name, its period, its file size and its three actions. Every digit is marked:
// periods and dates with Num, page counts with Count (check-build recomputes
// them), file sizes as derived figures recomputed by scripts/checks/library-counts.mjs.
import Link from "@/components/ui/Link";
import { ExternalLink } from "@/components/ui/Basics";
import { IconDownload } from "@/components/ui/Icons";
import { Count, Num } from "@/components/ui/Num";
import type { LibraryDocument } from "@/lib/adapter/contract";
import { sourceHref } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { chapterOf, docPeriodKind, fileSizeText, SIZE_OF_SOURCE } from "@/lib/library-format";

export function DocPeriod({ doc }: { doc: Pick<LibraryDocument, "kind" | "period"> }) {
  const k = docPeriodKind(doc.kind);
  if (k === "date")
    return (
      <>
        downloaded <Num kind="date">{doc.period}</Num>
      </>
    );
  return <Num kind="period">{k === "month" ? periodWords(doc.period, "month") : doc.period}</Num>;
}

/** "Federal Budget 2025-26", "Monthly Price Review, June 2026", "Pakistan Economic Survey 2024-25: Inflation". */
export function DocName({ doc }: { doc: LibraryDocument }) {
  const chapter = chapterOf(doc.kind, doc.printedTitle);
  const sep = docPeriodKind(doc.kind) === "plain" ? " " : ", ";
  return (
    <>
      {doc.kindName}
      {sep}
      <DocPeriod doc={doc} />
      {chapter ? `: ${chapter}` : null}
    </>
  );
}

export function FileSize({ doc }: { doc: Pick<LibraryDocument, "id" | "bytes"> }) {
  if (doc.bytes === null) return null;
  return (
    <span data-num="derived" data-derived={SIZE_OF_SOURCE} data-source={doc.id}>
      {fileSizeText(doc.bytes)}
    </span>
  );
}

/** "Finance Division · 54 pages · 2.5 MB" */
export function DocMeta({ doc, publisher = true }: { doc: LibraryDocument; publisher?: boolean }) {
  const parts = [
    publisher ? <span key="p">{doc.publisher}</span> : null,
    doc.pages ? (
      <span key="n">
        <Count k={`src:${doc.id}:page_count`} n={doc.pages} /> {doc.pages === 1 ? "page" : "pages"}
      </span>
    ) : null,
    doc.bytes !== null ? (
      <span key="s">
        {doc.format === "csv" ? "CSV file, " : null}
        <FileSize doc={doc} />
      </span>
    ) : null,
  ].filter(Boolean);
  return <>{parts.map((p, i) => [i ? <span key={`d${i}`} aria-hidden="true">{" · "}</span> : null, p])}</>;
}

/** Read (the viewer), Download (only a verified copy), Official page. */
export function DocActions({ doc, read = true, primary = false }: { doc: LibraryDocument; read?: boolean; primary?: boolean }) {
  const canRead = read && doc.file && doc.format === "pdf" && doc.state !== "rejected";
  const official = doc.officialPage ?? doc.officialUrl;
  return (
    <span className="lib-actions">
      {canRead ? (
        <Link className={`btn${primary ? " btn-primary" : ""} lib-act`} href={`${sourceHref(doc.id)}#viewer`}>
          Read
        </Link>
      ) : null}
      {doc.file && doc.state !== "rejected" ? (
        <a className="btn lib-act" href={doc.file.href} download={doc.file.href.split("/").pop()}>
          <IconDownload />
          <span>Download {doc.format === "csv" ? "CSV" : "PDF"}</span>
        </a>
      ) : null}
      {official ? (
        <ExternalLink className="btn btn-text lib-act" href={official}>
          Official page
        </ExternalLink>
      ) : null}
    </span>
  );
}

/** Documents | Datasets: the two tabs of the Library (Home v3 pages set), as links between /library and /library/datasets. */
export function LibraryTabs({ current }: { current: "docs" | "sets" }) {
  return (
    <nav className="lib4-tabs" aria-label="Library">
      <Link href="/library" className="lib4-tab" aria-current={current === "docs" ? "page" : undefined}>
        Documents
      </Link>
      <Link href="/library/datasets" className="lib4-tab" aria-current={current === "sets" ? "page" : undefined}>
        Datasets
      </Link>
    </nav>
  );
}
