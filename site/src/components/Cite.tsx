// Citation block (DESIGN.md 13.2), in the page rather than in a sheet: the
// default sentence (the government document first, then the release), then
// APA, Chicago, Harvard, BibTeX and RIS, each with a copy button, the
// release-pinned link and the access date. Works without JavaScript; copying is
// an enhancement. The same body as the Cite sheet (components/actions).
import { db, RELEASE_VERSION, type Source } from "@/lib/data";
import { citationFor } from "@/lib/take";
import { Disclosure } from "@/components/ui/Basics";
import { CiteFormats, PrototypeNote } from "@/components/actions/CiteBody";

export default function Cite({
  path,
  what,
  open,
  heading = true,
}: {
  path: string;
  what?: string;
  /** Kept for the pages that pass them; the document and page are read from the path. */
  source?: Source | null;
  page?: number | null;
  pageLabel?: string | null;
  open?: boolean;
  heading?: boolean;
}) {
  const d = db();
  const c = citationFor(path, what);
  const body = (
    <div className="cite-block">
      <PrototypeNote release={RELEASE_VERSION} isPrototype={d.info.isPrototype} doi={d.release.doi ?? null} />
      <CiteFormats cited={c} />
    </div>
  );
  if (!heading) return body;
  return (
    <Disclosure summary="Cite this" meta="Sentence · APA · Chicago · Harvard · BibTeX · RIS" open={open}>
      {body}
    </Disclosure>
  );
}
