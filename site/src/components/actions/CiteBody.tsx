// The insides of the Cite and Share sheets. Pure markup with no data imports, so
// the compare page can render them in the browser for a view (DESIGN.md 13.2:
// "cite a figure, a series or a view"). Digits are annotated for check-build:
// citations are data-num="cite", links data-num="id", the release data-num="version".
import type { CiteOut } from "@/lib/cite-format";
import { CITE_BOTH } from "@/lib/cite-format";
import { OriginCopy, OriginText } from "./OriginText";

export type CitedLike = { kind: "figure" | "series" | "document" | "view"; title: string; out: CiteOut; pinned: string };

export function PrototypeNote({ release, isPrototype, doi }: { release: string; isPrototype: boolean; doi: string | null }) {
  if (!isPrototype && doi) return null;
  return (
    <p className="cite-proto">
      {isPrototype ? (
        <>
          <strong>Prototype release</strong> <span data-num="version">{release}</span>: not yet for citation in publications, and it has no DOI.
        </>
      ) : (
        "This release has no DOI yet."
      )}
    </p>
  );
}

const STYLES: { key: keyof Omit<CiteOut, "sentence">; label: string }[] = [
  { key: "apa", label: "APA" },
  { key: "chicago", label: "Chicago" },
  { key: "harvard", label: "Harvard" },
  { key: "bibtex", label: "BibTeX" },
  { key: "ris", label: "RIS" },
];

export function CiteFormats({ cited, accessedNote = true }: { cited: CitedLike; accessedNote?: boolean }) {
  const o = cited.out;
  return (
    <>
      <div className="cite-main">
        <p className="cite-sentence" data-num="cite">
          <OriginText text={o.sentence} />
        </p>
        <OriginCopy text={o.sentence} label="Copy citation" className="btn btn-primary" />
      </div>
      <p className="cite-both">{CITE_BOTH}</p>
      <p className="small">
        The link in it is pinned to this release:{" "}
        <a href={cited.pinned} data-num="id">
          <OriginText text={cited.pinned} />
        </a>
        . This link will keep showing these numbers.
        {accessedNote ? " The access date is the day this page was built; change it to the day you used it." : ""}
      </p>
      <div className="cite-styles">
        {STYLES.map((s) => (
          <details key={s.key} className="cite-style">
            <summary>
              <span>{s.label}</span>
            </summary>
            <pre className="code" data-num="cite" tabIndex={0}>
              <OriginText text={o[s.key]} />
            </pre>
            <OriginCopy text={o[s.key]} label={`Copy ${s.label}`} className="btn btn-text" />
          </details>
        ))}
      </div>
    </>
  );
}

/** "This release" and "always the latest", each with a copy button. */
export function ShareLinks({ pinned, latest, release }: { pinned: string; latest: string; release: string }) {
  return (
    <dl className="share-links">
      <div>
        <dt>This release</dt>
        <dd>
          <p className="small">
            This link will keep showing these numbers: it is pinned to release <span data-num="version">{release}</span>.
          </p>
          <code className="share-url" data-num="id">
            <OriginText text={pinned} />
          </code>
          <OriginCopy text={pinned} label="Copy this-release link" className="btn btn-text" />
        </dd>
      </div>
      <div>
        <dt>Always the latest</dt>
        <dd>
          <p className="small">Shows the newest release. A figure can change there when a later document revises it or we correct an error.</p>
          <code className="share-url" data-num="id">
            <OriginText text={latest} />
          </code>
          <OriginCopy text={latest} label="Copy latest link" className="btn btn-text" />
        </dd>
      </div>
    </dl>
  );
}
