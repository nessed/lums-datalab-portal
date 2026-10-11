// Citation block: two parts (the government document, which is the authority,
// and the portal release, which says where and how the figure was read). APA
// is shown; BibTeX and RIS are one click away. Works without JavaScript; the
// copy buttons are an enhancement.
import { db, type Source } from "@/lib/data";
import { cite } from "@/lib/cite";
import CopyButton from "@/components/ui/CopyButton";
import { Disclosure } from "@/components/ui/Basics";
import { IconDownload } from "@/components/ui/Icons";

export default function Cite({
  path,
  what,
  source,
  page,
  pageLabel,
  open,
  heading = true,
}: {
  path: string;
  what?: string;
  source?: Source | null;
  page?: number | null;
  pageLabel?: string | null;
  open?: boolean;
  heading?: boolean;
}) {
  const release = db().release;
  const c = cite({ release, path, what, source, page, pageLabel });
  const ris = `data:application/x-research-info-systems;charset=utf-8,${encodeURIComponent(c.ris)}`;
  const body = (
    <>
      <p className="small measure">
        {source
          ? "Cite both parts: the government document, which is the authority for the figure, and this portal release, which records where it was read and how it was checked."
          : "Cite this portal release. For a single figure, open its receipt and cite the government document as well."}{" "}
        {release.doi ? `DOI ${release.doi}.` : "This prototype release has no DOI and is not yet for citation in publications."} The access date is the
        date this page was built; replace it with the date you used it.
      </p>
      <div className="cite-apa">
        <pre className="code" style={{ whiteSpace: "pre-wrap" }} data-num="cite">
          {c.apa}
        </pre>
      </div>
      <div className="action-row" style={{ marginTop: 0 }}>
        <CopyButton text={c.apa} label="Copy APA" />
        <CopyButton text={c.bibtex} label="Copy BibTeX" />
        <a className="btn" href={ris} download="citation.ris">
          <IconDownload />
          <span>RIS file</span>
        </a>
      </div>
      <Disclosure summary="Show BibTeX and RIS">
        <h4>BibTeX</h4>
        <pre className="code" data-num="cite">{c.bibtex}</pre>
        <h4>RIS</h4>
        <pre className="code" data-num="cite">{c.ris}</pre>
      </Disclosure>
    </>
  );
  if (!heading) return body;
  return (
    <Disclosure summary="Cite this" meta="APA · BibTeX · RIS" open={open}>
      {body}
    </Disclosure>
  );
}
