// Where a figure is printed: the document's own title (a release label) and the
// page, linked to the document viewer open at that page. Server only (Num).
import Link from "@/components/ui/Link";
import { Num } from "@/components/ui/Num";
import { db, docPageHref, pageShort, type Observation } from "@/lib/data";

/** "Annual Budget Statement 2026-27, p. 1": `doc={false}` gives the page link alone. */
export function PageRef({ o, doc = true, className = "pg-ref" }: { o: Observation; doc?: boolean; className?: string }) {
  const d = db();
  const cell = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : undefined;
  const src = cell ? d.sourceById.get(cell.source_id) : undefined;
  if (!cell || !src) return null;
  const page = (
    <Link href={docPageHref(src.source_id, cell.page)} className="pg-pl" aria-label={`${pageShort(cell)} of ${src.title}`}>
      <Num kind="page">{pageShort(cell)}</Num>
    </Link>
  );
  if (!doc) return <span className={className}>{page}</span>;
  return (
    <span className={className}>
      <span className="pg-doc">{src.title}</span>, {page}
    </span>
  );
}

/** The source document of a figure (for "from the same document" tests). */
export function sourceOf(o: Observation): string | null {
  const cell = o.primary_cell_id ? db().cellById.get(o.primary_cell_id) : undefined;
  return cell?.source_id ?? null;
}
