// What's new (design set 2026-11-23, "Whats New") and the release itself.
// Top: a sentence on the latest update and on corrections, then a dated list
// of what the release added (data types, document editions, figures held
// back) with tabs All / Added / New editions / Corrections, and the official
// release dates expected next (editorial/calendar.json). Every entry comes from
// the release (release.json, sources, observations, ERRATA); the tabs only
// toggle `hidden` on what the server rendered (components/find/WhatsNewTabs).
// Below: what this release is, what is in it, how versions and citations work,
// the changelog, what is coming, the errata; the dataset card and the
// reproduction steps on request.
// Checked by scripts/checks/whatsnew-entries.mjs (entries and tab counts) and
// whatsnew-calendar.mjs (the dates from editorial/calendar.json).
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import Cite from "@/components/Cite";
import Markdown from "@/components/Markdown";
import WhatsNewTabs, { type RlTab } from "@/components/find/WhatsNewTabs";
import Upcoming from "@/components/find/Upcoming";
import Crumbs from "@/components/chrome/Crumbs";
import "@/styles/v4-releases.css";
import { Callout, Disclosure, TableWrap, Toc } from "@/components/ui/Basics";
import { ISSUES_URL, datasetKeys, db, isDatasetPublished, library, obsHref, releaseMarkdown, sourceHref } from "@/lib/data";
import { dateOnly, periodWords } from "@/lib/format";
import { Count, Num } from "@/components/ui/Num";
import { datasetStateWords } from "@/lib/status";
import { COMING, feature, type FeatureKey } from "@/lib/features";
import { seriesTitle } from "@/lib/titles";

export const metadata: Metadata = {
  title: "Releases: upcoming, added recently and corrections",
  description: "What the latest release added, every correction to a published figure, the official release dates expected next, and how versions and citations work.",
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
  dailyRates: "fuel prices and the dollar rate read once a day from official notices, on the home page.",
  insights: "short findings written from the latest figures, each sentence linked to the figures it uses and reviewed by a person before it is shown.",
  perPerson: "rupee series per person, once a checked population series is in the release.",
  actualSpending: "what the federal government actually spent, from the federal accounts.",
  provincialMap: "a map of the provinces shaded by the selected figure.",
  releaseAlerts: "an email when a publication you follow is added.",
  urdu: "the site in Urdu.",
};

/** A release Markdown file without its own first heading (the page gives one). */
function body(md: string | null): string | null {
  return md ? md.replace(/^# .*\r?\n/, "") : null;
}

/** A count of entries on this page: recomputed by scripts/checks/whatsnew-entries.mjs. */
function TabCount({ tab, n }: { tab: "all" | "added" | "editions" | "corrections"; n: number }) {
  return (
    <span data-num="derived" data-derived="whatsnew-tab" data-tab={tab}>
      {n}
    </span>
  );
}

type Entry = {
  key: string;
  kind: "added" | "editions" | "held" | "corrections";
  label: string;
  title: ReactNode;
  who?: ReactNode;
  line: ReactNode;
  link: { href: string; text: string };
  file?: { href: string; label: string } | null;
};

/** One row: added, publication, published by, what changed, get it. Matched by whatsnew-entries.mjs (li.wn-entry, data-wn-kind, data-wn-key, the date). */
function EntryRow({ e, date }: { e: Entry; date: string }) {
  return (
    <li className="wn-entry" data-wn-kind={e.kind} data-wn-key={e.key}>
      <span className="wn-date">
        <Num kind="date">{date}</Num>
      </span>
      <span className="wn-pub">
        <span className={`wn-kind wn-kind-${e.kind}`}>{e.label}</span>
        <Link href={e.link.href} className="wn-title">
          {e.title}
        </Link>
      </span>
      <span className="wn-who">{e.who ?? null}</span>
      <span className="wn-line">{e.line}</span>
      <span className="wn-get">
        {e.file ? (
          <a href={e.file.href} download>
            {e.file.label}
          </a>
        ) : null}
        <Link href={e.link.href}>{e.link.text}</Link>
      </span>
    </li>
  );
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
  const date = dateOnly(r.created_at);

  /* ------------------------- what's new: entries ------------------------- */
  const visible = keys.filter(isDatasetPublished);
  const isPub = (o: { published: boolean; value: string | null }) => o.published && o.value !== null;
  const dsOfObs = (seriesId: string) => d.seriesById.get(seriesId)?.dataset ?? "";
  // Checked figures whose main printing is in each document (all of them, as the count key counts),
  // and the documents that hold one of a visible data type (the "New edition" entries).
  const valuesBySource = new Map<string, number>();
  const visibleSources = new Set<string>();
  for (const o of d.observations) {
    if (!isPub(o) || !o.primary_cell_id) continue;
    const src = d.cellById.get(o.primary_cell_id)?.source_id;
    if (!src) continue;
    valuesBySource.set(src, (valuesBySource.get(src) ?? 0) + 1);
    if (isDatasetPublished(dsOfObs(o.series_id))) visibleSources.add(src);
  }
  const gapCount = (ds: string, kind: string) =>
    d.observations.filter((o) => dsOfObs(o.series_id) === ds && !isPub(o) && (kind === "disputed" ? o.status === "disputed" : o.status !== "disputed" && o.gap_kind === kind)).length;

  const added: Entry[] = visible.map((k) => {
    const p = r.scope?.periods?.[k] ?? [];
    const name = r.dataset_status[k]?.name ?? k;
    const freq = k === "cpi" ? "month" : undefined;
    return {
      key: `added:${k}`,
      kind: "added",
      label: "Added",
      title: name,
      line: (
        <>
          <Count k={`values:${k}`} n={d.observations.filter((o) => isPub(o) && dsOfObs(o.series_id) === k).length} /> checked figures in{" "}
          <Count k={`series:${k}`} n={d.series.filter((s) => s.dataset === k).length} /> series, read from{" "}
          <Count k={`docs:${k}`} n={new Set(d.observations.filter((o) => isPub(o) && dsOfObs(o.series_id) === k && o.primary_cell_id).map((o) => d.cellById.get(o.primary_cell_id!)?.source_id).filter(Boolean)).size} />{" "}
          documents
          {p.length ? (
            <>
              , <Num kind="period">{periodWords(p[0], freq)}</Num> to <Num kind="period">{periodWords(p[p.length - 1], freq)}</Num>
            </>
          ) : null}
          .
        </>
      ),
      link: { href: `/browse?dataset=${encodeURIComponent(k)}`, text: "Find the series" },
    };
  });

  const editions: Entry[] = d.sources
    .filter((s) => visibleSources.has(s.source_id))
    .sort((a, b) => b.period.localeCompare(a.period) || a.title.localeCompare(b.title))
    .map((s) => ({
      key: `edition:${s.source_id}`,
      kind: "editions",
      label: "New edition",
      title: s.title,
      who: <span>{s.publisher}</span>,
      file: (() => {
        const f = library().documents.find((x) => x.id === s.source_id)?.file;
        return f ? { href: f.href, label: "PDF" } : null;
      })(),
      line: (
        <>
          <Count k={`values:source:${s.source_id}`} n={valuesBySource.get(s.source_id)} /> checked figures from{" "}
          <Count k={`pages:source:${s.source_id}`} n={(s.pages_used ?? []).length} /> pages read.
        </>
      ),
      link: { href: sourceHref(s.source_id), text: "Open the document" },
    }));

  const held: Entry[] = visible
    .filter((k) => gapCount(k, "failed_checks") > 0)
    .map((k) => {
      const dis = gapCount(k, "disputed");
      return {
        key: `held:${k}`,
        kind: "held",
        label: "Held back",
        title: <>Figures held back from the {r.dataset_status[k]?.name ?? k}</>,
        line: (
          <>
            <Count k={`gaps:${k}:failed_checks`} n={gapCount(k, "failed_checks")} /> figures failed their checks, so they are not published
            {dis ? (
              <>
                , and <Count k={`gaps:${k}:disputed`} n={dis} /> are disputed because official printings disagree
              </>
            ) : null}
            . Each shows as a labelled gap that says why.
          </>
        ),
        link: { href: "/methods", text: "How we check" },
      };
    });

  // A correction: a published figure whose value changed in a later release than the one that first published it.
  const corrected = d.observations.filter(
    (o) => isPub(o) && isDatasetPublished(dsOfObs(o.series_id)) && !!o.last_changed_release && !!o.first_published_release && o.last_changed_release !== o.first_published_release,
  );
  const corrections: Entry[] = corrected.map((o) => {
    const s = d.seriesById.get(o.series_id);
    return {
      key: `correction:${o.obs_id}`,
      kind: "corrections",
      label: "Correction",
      title: (
        <>
          {s ? seriesTitle(s) : o.series_id}, <Num kind="period">{periodWords(o.period, s?.frequency)}</Num>
        </>
      ),
      line: (
        <>
          Corrected in release <Num kind="version">{o.last_changed_release}</Num>; the errata give the old value, the new value and the reason.
        </>
      ),
      link: { href: obsHref(o.obs_id), text: "See the figure and its page" },
    };
  });

  const list = [...added, ...editions, ...held];
  const tabs: { key: RlTab; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "added", label: "Added recently" },
    { key: "corrections", label: "Corrections" },
  ];

  return (
    <div className="rl4p">
      <Crumbs items={[{ label: "Releases" }]} />
      <header className="rl4p-head">
        <div>
          <h1>Releases</h1>
          <p className="rl4p-lede">What the government is due to publish, what we have added, and every correction we have made.</p>
          <p className="rl4p-sum">
            The latest update, on <Num kind="date">{date}</Num>, added <TabCount tab="added" n={added.length} /> data types and{" "}
            <TabCount tab="editions" n={editions.length} /> government documents (<TabCount tab="all" n={list.length + corrections.length} /> entries in all).{" "}
            {corrections.length ? (
              <>
                <TabCount tab="corrections" n={corrections.length} /> published figures have been corrected since they were first published.
              </>
            ) : (
              <>No published figure has been corrected.</>
            )}
          </p>
        </div>
        <div className="rl4p-acts">
          <span className="rl4p-soon">
            Add calendar to Outlook or Google <em>Coming soon</em>
          </span>
          <span className="rl4p-soon">
            Get release alerts <em>Coming soon</em>
          </span>
        </div>
      </header>

      <div id="whats-new">
        <WhatsNewTabs tabs={tabs} />
        <section id="rl-panel-upcoming" className="rl-panel" aria-label="Upcoming">
          <span id="upcoming" />
          <Upcoming />
        </section>
        <section id="rl-panel-added" className="rl-panel" aria-labelledby="wn-h">
          <span id="added" />
          <h2 id="wn-h" className="sr-only">
            Added recently
          </h2>
          <div className="wn-tbl">
            <p className="wn-thead" aria-hidden="true">
              <span>Added</span>
              <span>Publication</span>
              <span>Published by</span>
              <span>What changed</span>
              <span>Get it</span>
            </p>
            <ol className="wn-list" id="wn-list">
              {list.map((e) => (
                <EntryRow key={e.key} e={e} date={date} />
              ))}
            </ol>
          </div>
        </section>
        <section id="rl-panel-corrections" className="rl-panel" aria-label="Corrections">
          <section id="corrections" className="wn-corr" aria-labelledby="corrections-h" data-wn-has={corrections.length ? "1" : "0"}>
            <h2 id="corrections-h" className="sr-only">
              Corrections
            </h2>
            <p className="wn-corr-lede">
              When a figure on this site is found to be wrong, we correct it in a new version, keep the old one, and list it here. Links and citations to the
              old version keep working.
            </p>
            {corrections.length ? (
              <ol className="wn-list wn-list-corr">
                {corrections.map((e) => (
                  <EntryRow key={e.key} e={e} date={date} />
                ))}
              </ol>
            ) : (
              <div className="wn-empty" data-wn-empty="corrections">
                <p className="wn-empty-h">No corrections so far.</p>
                <p className="wn-empty-p">
                  When a published figure is corrected, it is listed here with the old value, the new value, the page, and the release that fixed it.
                </p>
                <a href={ISSUES_URL} className="wn-link">
                  Report an error
                </a>
              </div>
            )}
          </section>
        </section>
      </div>

      <h2 className="rl4p-about">About this release</h2>
      <Callout kind="caveat" title="A prototype">
        <p>
          This release is a prototype: it has no DOI, the series definitions are drafts, and the error rate has not been measured. Do not cite it in
          publications yet. Until the first public release, this version is rebuilt in place; from then on every change is a new version.
        </p>
      </Callout>
      <p className="lede">
        Data is published as frozen, versioned releases. A published figure is never changed silently: a correction makes a new release and an entry in
        the errata, and the old release stays available, so a citation never breaks.
      </p>
      <div className="action-row">
        <Link href="/data" className="btn btn-primary">
          Download this release
        </Link>
        <a href="#cite" className="btn btn-text">
          Cite the release
        </a>
      </div>

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
            {changelog ? (
              <div className="prose md-small" data-num="md" data-file="CHANGELOG.md">
                <Markdown source={changelog} headingOffset={1} />
              </div>
            ) : (
              <p className="muted">This release has no changelog file.</p>
            )}
          </section>

          <section id="coming" aria-labelledby="coming-h">
            <span id="planned" />
            <h2 id="coming-h">Coming</h2>
            <p className="small">
              Data and features that are planned but not in this release. Each has a place on the site and switches on only when it is built and its data
              has passed the same checks. No topic is shown for data that is not here yet; there are no dates, because no release calendar has been agreed.
            </p>
            <ul className="planned coming-list">
              {(Object.keys(PLANNED) as FeatureKey[]).map((k) => (
                <li key={k}>
                  <strong>{feature(k).label}</strong>: {PLANNED[k]} <span className="coming">{COMING}</span>
                </li>
              ))}
              <li>
                <strong>More topics</strong>: public debt, growth and others become topics when a checked source for them is in a release.{" "}
                <span className="coming">{COMING}</span>
              </li>
            </ul>
          </section>

          <section id="errata" aria-labelledby="errata-h">
            <h2 id="errata-h">Errata</h2>
            {errata ? (
              <div className="prose md-small" data-num="md" data-file="ERRATA.md">
                <Markdown source={errata} headingOffset={1} />
              </div>
            ) : (
              <p className="muted">This release has no errata file.</p>
            )}
            <p className="small">Found a figure that differs from the printed page? Use &ldquo;Report a problem with this figure&rdquo; on its receipt.</p>
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
              {card ? (
                <div className="prose md-small" data-num="md" data-file="dataset_card.md">
                  <Markdown source={card} headingOffset={2} />
                </div>
              ) : (
                <p className="muted">Not included in this release.</p>
              )}
            </Disclosure>
            <Disclosure summary="How to reproduce this release" meta="commands and expected fingerprints">
              <span id="reproduce" />
              {repro ? (
                <div className="prose md-small" data-num="md" data-file="HOW_TO_REPRODUCE.md">
                  <Markdown source={repro} headingOffset={2} />
                </div>
              ) : (
                <p className="muted">Not included in this release.</p>
              )}
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
              { id: "whats-new", label: "What’s new" },
              { id: "corrections", label: "Corrections" },
              { id: "contents", label: "What is in it" },
              { id: "changelog", label: "Changelog" },
              { id: "coming", label: "Coming" },
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
