// "Cite" control. A <details> element, so it works without JavaScript.
import { db, type Source } from "@/lib/data";
import { cite } from "@/lib/cite";

export default function Cite({ path, what, source, page }: { path: string; what?: string; source?: Source | null; page?: number | null }) {
  const release = db().release;
  const c = cite({ release, path, what, source, page });
  const ris = `data:application/x-research-info-systems;charset=utf-8,${encodeURIComponent(c.ris)}`;
  return (
    <details className="cite">
      <summary>Cite this</summary>
      <div className="cite-body">
        <p className="small">
          {source
            ? "Cite both parts: the government document (the authority for the figure) and this portal release (where we read it and how it was checked)."
            : "Cite this portal release. For a specific figure, open its receipt and cite the government document as well."}{" "}
          This is a prototype release with {release.doi ? `DOI ${release.doi}` : "no DOI"}. The access date shown is the date this page was built;
          replace it with the date you used it.
        </p>
        <h3>APA</h3>
        <pre className="code">{c.apa}</pre>
        <h3>BibTeX</h3>
        <pre className="code">{c.bibtex}</pre>
        <h3>RIS</h3>
        <pre className="code">{c.ris}</pre>
        <p className="small">
          <a href={ris} download="citation.ris">
            Download RIS file
          </a>
        </p>
      </div>
    </details>
  );
}
