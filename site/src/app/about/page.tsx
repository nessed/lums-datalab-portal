import type { Metadata } from "next";
import Link from "next/link";
import Cite from "@/components/Cite";
import { ISSUES_URL, REPO_URL } from "@/lib/data";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <h1>About</h1>
      <p className="lede">LUMS Department of Economics DataLab (prototype).</p>
      <p>
        The LUMS DataLab Portal is an open research bank of Pakistan&rsquo;s official statistics. Its aim is that a researcher can find a series,
        chart it, download it and cite it, and can check every number against the government page it came from.
      </p>

      <h2>Disclaimer</h2>
      <div className="notice">
        <p>
          This is an unofficial research prototype. It is not a government publication. The government documents are the authority: if a figure here differs from the source document, the source document is right. Do not cite this prototype
          release in publications. It has no DOI and its error rate has not been measured yet.
        </p>
      </div>

      <h2>Team</h2>
      <ul>
        <li>Ali, research assistant</li>
        <li>Ahmad, research assistant</li>
      </ul>
      <p>
        The pipeline and this site are built with coding agents under human direction. People decide the scope, write the specifications, review the
        output and check values against the source pages. No language model writes a published number or decides whether it passes a check; see{" "}
        <Link href="/methods">methods</Link>.
      </p>

      <h2>Licence</h2>
      <ul>
        <li>
          Data: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Please cite both the government document and the portal
          release; each receipt page gives the citation.
        </li>
        <li>
          Code: MIT. <a href={REPO_URL}>Source code on GitHub</a>.
        </li>
      </ul>
      <p>The original documents remain the work of their government publishers.</p>

      <h2>Report an error</h2>
      <p>
        If a figure looks wrong, a box is in the wrong place, or a label is unclear, please <a href={ISSUES_URL}>open an issue on GitHub</a> and
        include the address of the receipt page. Corrections are made in a new release and listed in the <Link href="/releases#errata">errata</Link>.
      </p>

      <Cite path="/about" />
    </>
  );
}
