// About: who makes this, what it is not, the licence, how to report an error.
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, Callout } from "@/components/ui/Basics";
import { db, ISSUES_URL, REPO_URL } from "@/lib/data";

export const metadata: Metadata = {
  title: "About",
  description: "Who makes the LUMS DataLab Portal, the disclaimer, the licence, and how to report an error.",
};

export default function AboutPage() {
  const r = db().release;
  return (
    <>
      <Breadcrumbs items={[{ label: "About" }]} />
      <header className="page-head">
        <h1>About the portal</h1>
        <p className="lede">
          An open research bank of Pakistan&rsquo;s economic and fiscal statistics, built at the DataLab of the LUMS Department of Economics. The aim:
          a researcher can find a series, chart it, download it and cite it, and can check every number against the government page it came from.
        </p>
      </header>

      <div className="prose about">
        <section id="disclaimer" aria-labelledby="disclaimer-h">
          <h2 id="disclaimer-h">Disclaimer</h2>
          <Callout kind="caveat">
            <p>
              This is an unofficial research prototype, not a government publication. Figures are compiled from official publications; where a figure
              here differs from the printed document, the document prevails. Release {r.version} has {r.doi ? `DOI ${r.doi}` : "no DOI"}, its series
              definitions are drafts, and its error rate has not been measured. Do not cite it in publications yet.
            </p>
          </Callout>
        </section>

        <section aria-labelledby="who-h">
          <h2 id="who-h">Who makes it</h2>
          <p>
            The DataLab at the LUMS Department of Economics. Two research assistants direct the work: they decide the scope, write the specifications,
            review the output and check values against the source pages. Coding agents write the pipeline and this site under their direction, and the
            two review each other&rsquo;s work.
          </p>
          <p>
            No language model reads a number for the dataset, writes a published value, or decides whether a value passes a check. Every value is read
            by a table-extraction tool and judged by code. <Link href="/methods#llm">What models did and did not do</Link>.
          </p>
        </section>

        <section aria-labelledby="licence-h">
          <h2 id="licence-h">Licence</h2>
          <ul>
            <li>
              Data: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Cite both the government document and the portal release; every
              receipt gives the citation.
            </li>
            <li>
              Code: MIT, in the <a href={REPO_URL}>project repository</a>.
            </li>
            <li>The original documents remain the work of their government publishers. This site links to them and does not host them.</li>
            <li>Typefaces: Source Serif 4 and Source Sans 3, SIL Open Font License.</li>
          </ul>
        </section>

        <section aria-labelledby="report-h">
          <h2 id="report-h">Report an error</h2>
          <p>
            If a figure looks wrong, a box is in the wrong place, or a label is unclear, use &ldquo;Report a problem with this figure&rdquo; on its receipt,
            or <a href={ISSUES_URL}>open an issue</a> with the address of the page. Corrections are made in a new release and listed in the{" "}
            <Link href="/releases#errata">errata</Link>; the old figure stays citable in the old release.
          </p>
        </section>

        <section aria-labelledby="more-h">
          <h2 id="more-h">More</h2>
          <ul>
            <li>
              <Link href="/methods">Methods</Link>: how a figure gets from a PDF to a receipt, and the quality numbers of this release.
            </li>
            <li>
              <Link href="/sources">Sources</Link>: every document, and how each file was verified.
            </li>
            <li>
              <Link href="/data">Data access</Link>: the files, their columns, and code to load them.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
