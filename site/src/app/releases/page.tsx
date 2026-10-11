// Releases: what this release is, what is in it, how versions and citations
// work, the changelog and errata; the dataset card and the reproduction steps
// on request.
import type { Metadata } from "next";
import Link from "next/link";
import Cite from "@/components/Cite";
import Markdown from "@/components/Markdown";
import { Breadcrumbs, Callout, Disclosure, TableWrap, Toc } from "@/components/ui/Basics";
import { datasetKeys, db, releaseMarkdown } from "@/lib/data";
import { dateOnly } from "@/lib/format";
import { Count, Num } from "@/components/ui/Num";
import { datasetStateWords } from "@/lib/status";
import { COMING, feature, type FeatureKey } from "@/lib/features";

export const metadata: Metadata = {
  title: "Releases, changelog and errata",
  description: "The current data release: scope, counts, changelog, errata, and how versions and citations work.",
};

const GAP_LABEL: Record<string, string> = {
  published: "Checked",
  "gap:not_in_source": "Not printed",
  "gap:not_yet_verified": "Not yet verified",
  "gap:failed_checks": "Withheld",
  "gap:disputed": "Disputed",
};
const GAP_TITLE: Record<string, string> = {
  published: "Checked values, published",
  "gap:not_in_source": "Gaps: not published by the government (the document prints a dash or a blank)",
  "gap:not_yet_verified": "Gaps: not yet verified by us",
  "gap:failed_checks": "Withheld: failed their checks",
  "gap:disputed": "Disputed: official printings disagree",
};

const PLANNED: Record<FeatureKey, string> = {
  realTerms: "rupee series in constant prices, using a deflator that has been through the same checks.",
  percentOfGdp: "rupee series as a share of GDP, once a checked GDP series is in the release.",
  api: "a documented query API; every release file is already a static download.",
  maps: "provincial series on a map.",
  districts: "district figures.",
  provincialBudgets: "the provincial budget statements.",
  moreDataTypes: "further publications, starting with tables from the Pakistan Economic Survey.",
  monthlyData: "every monthly CPI issue, not only June.",
  errataBadges: "a note on each corrected figure, linking to its errata entry.",
};

/** A release Markdown file without its own first heading (the page gives one). */
function body(md: string | null): string | null {
  return md ? md.replace(/^# .*\r?\n/, "") : null;
}

export default function ReleasesPage() {
  const d = db();
  const r = d.release;
  const keys = datasetKeys();
  const byDataset = r.counts?.observations_by_dataset ?? {};
  const kinds = [...new Set(Object.values(byDataset).flatMap((m) => Object.keys(m)))].sort((a, b) => (a === "published" ? -1 : b === "published" ? 1 : a.localeCompare(b)));
  const changelog = body(releaseMarkdown("CHANGELOG.md"));
  const errata = body(releaseMarkdown("ERRATA.md"));
  const card = body(releaseMarkdown("dataset_card.md"));
  const repro = body(releaseMarkdown("HOW_TO_REPRODUCE.md"));
  const sourcesRead = d.sources.filter((s) => (s.pages_used ?? []).length > 0).length;

  return (
    <div className="is-prose">
      <Breadcrumbs items={[{ label: "Releases" }]} />
      <header className="page-head">
        <p className="kicker">Current release</p>
        <h1 className="mono-title">
          <Num kind="version">{r.version}</Num>
        </h1>
        <p className="series-meta">
          <span>
            Built <Num kind="date">{dateOnly(r.created_at)}</Num>
          </span>
          <span>{r.label}</span>
          <span>{r.doi ? <Num kind="id">{`DOI ${r.doi}`}</Num> : "No DOI yet"}</span>
          <span>
            Code commit <Num kind="id" className="mono">{r.git_commit.slice(0, 10)}</Num>
          </span>
        </p>
        <p className="lede">
          Data is published as frozen, versioned releases. A published figure is never changed silently: a correction makes a new release and an entry
          in the errata, and the old release stays available, so a citation never breaks.
        </p>
        <div className="action-row">
          <Link href="/data" className="btn btn-primary">
            Download this release
          </Link>
          <a href="#cite" className="btn btn-text">
            Cite the release
          </a>
        </div>
      </header>

      <Callout kind="caveat" title="A prototype">
        <p>
          This release is a prototype: it has no DOI, the series definitions are drafts, and the error rate has not been measured. Do not cite it in
          publications yet. Until the first public release, this version is rebuilt in place; from then on every change is a new version.
        </p>
      </Callout>

      <div className="with-rail">
        <div className="measure-wide">
          <section id="contents" aria-labelledby="contents-h" className="wide">
            <h2 id="contents-h">What is in it</h2>
            <p>
              <Count k="release:counts.series" n={r.counts?.series} /> series from <Count k="sources:read" n={sourcesRead} /> government documents (
              <Count k="release:counts.sources" n={r.counts?.sources} /> registered), <Count k="release:counts.cells" n={r.counts?.cells} /> printed numbers read,{" "}
              <Count k="release:counts.page_renders" n={r.counts?.page_renders} /> page images.
            </p>
            <TableWrap label="Figures by dataset and status">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Dataset</th>
                    <th scope="col">State</th>
                    {kinds.map((k) => (
                      <th key={k} scope="col" className="num" title={GAP_TITLE[k]}>
                        {GAP_LABEL[k] ?? k.replace(/^gap:/, "").replaceAll("_", " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k}>
                      <th scope="row">{r.dataset_status[k]?.name ?? k}</th>
                      <td className="small">{datasetStateWords(r.dataset_status[k]?.state)}</td>
                      {kinds.map((g) => (
                        <td key={g} className="num">
                          {byDataset[k]?.[g] ? (
                            <Count k={`release:counts.observations_by_dataset.${k}.${g}`} n={byDataset[k][g]} />
                          ) : (
                            <span className="muted">none</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <p className="small">
              Periods covered:{" "}
              {keys.map((k, i) => {
                const p = r.scope?.periods?.[k] ?? [];
                return (
                  <span key={k}>
                    {i ? "; " : ""}
                    {r.dataset_status[k]?.name ?? k}{" "}
                    {p.length ? (
                      <>
                        <Num kind="period">{p[0]}</Num> to <Num kind="period">{p[p.length - 1]}</Num>
                      </>
                    ) : (
                      "none"
                    )}
                  </span>
                );
              })}
              . Quality numbers are on the <Link href="/methods#quality">methods page</Link>.
            </p>
          </section>

          <section id="changelog" aria-labelledby="changelog-h">
            <h2 id="changelog-h">Changelog</h2>
            {changelog ? <div className="prose md-small" data-num="md" data-file="CHANGELOG.md"><Markdown source={changelog} headingOffset={1} /></div> : <p className="muted">This release has no changelog file.</p>}
          </section>

          <section id="planned" aria-labelledby="planned-h">
            <h2 id="planned-h">Planned, not in this release</h2>
            <p className="small">Each of these has a place on the site and switches on only when it is built and its data has passed the same checks.</p>
            <ul className="planned">
              {(Object.keys(PLANNED) as FeatureKey[]).map((k) => (
                <li key={k}>
                  <strong>{feature(k).label}</strong>: {PLANNED[k]} <span className="coming">{COMING}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="errata" aria-labelledby="errata-h">
            <h2 id="errata-h">Errata</h2>
            {errata ? <div className="prose md-small" data-num="md" data-file="ERRATA.md"><Markdown source={errata} headingOffset={1} /></div> : <p className="muted">This release has no errata file.</p>}
            <p className="small">
              Found a figure that differs from the printed page? Use &ldquo;Report a problem with this figure&rdquo; on its receipt.
            </p>
          </section>

          <section id="versions" aria-labelledby="versions-h">
            <h2 id="versions-h">How versions and citations work</h2>
            <ul className="measure">
              <li>A release is a frozen folder of files. Its version is part of every citation and every download.</li>
              <li>Ids are stable: a figure keeps its id across releases, so a link or a script keeps working.</li>
              <li>A change to a published figure makes a new release, with the old and new values in the errata.</li>
              <li>Citations have two parts: the government document (the authority) and the portal release (where and how it was read).</li>
              <li>Once the project is out of prototype, releases will carry a DOI.</li>
            </ul>
          </section>

          <section id="reference" aria-labelledby="reference-h">
            <h2 id="reference-h">Reference documents</h2>
            <Disclosure summary="Dataset card" meta="scope, status mix, limitations">
              <span id="dataset-card" />
              {card ? <div className="prose md-small" data-num="md" data-file="dataset_card.md"><Markdown source={card} headingOffset={2} /></div> : <p className="muted">Not included in this release.</p>}
            </Disclosure>
            <Disclosure summary="How to reproduce this release" meta="commands and expected fingerprints">
              <span id="reproduce" />
              {repro ? <div className="prose md-small" data-num="md" data-file="HOW_TO_REPRODUCE.md"><Markdown source={repro} headingOffset={2} /></div> : <p className="muted">Not included in this release.</p>}
            </Disclosure>
          </section>

          <section id="cite" aria-labelledby="cite-h">
            <h2 id="cite-h">Cite the release</h2>
            <Cite path="/releases" heading={false} />
          </section>
        </div>
        <aside className="rail">
          <Toc
            items={[
              { id: "contents", label: "What is in it" },
              { id: "changelog", label: "Changelog" },
              { id: "planned", label: "Planned" },
              { id: "errata", label: "Errata" },
              { id: "versions", label: "Versions and citations" },
              { id: "reference", label: "Dataset card, reproduction" },
              { id: "cite", label: "Cite" },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
