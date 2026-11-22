// Material that moved from the home page to Methods in round 2 (item 17): the
// "How we check" summary, the release and its newest documents, and the list of
// how each change on the home page's headline cards is computed (the cards'
// "how" links point here, /methods#home-drv-N). Nothing was dropped: the same
// words and the same derived figures, computed by the same code, now live on
// /methods. The home page keeps one link and the release tag.
import Link from "@/components/ui/Link";
import { Num } from "@/components/ui/Num";
import { db, isDatasetPublished, releaseMarkdown, sourceHref, type Source } from "@/lib/data";
import { dateOnly } from "@/lib/format";
import { DerivedList, DerivedNotes, PageWords } from "./Bits";
import { headlineCard } from "./Cards";
import { headlineCards } from "./editorial";

/** The home page's derived notes: id prefix and the page the list is printed on. */
export const HOME_NOTES = { prefix: "home-drv", page: "/methods" } as const;

/** The newest document of each visible data type that this release reads from. */
export function newestDocuments(): Source[] {
  const d = db();
  const best = new Map<string, Source>();
  for (const o of d.observations) {
    if (!o.published || !o.primary_cell_id) continue;
    const s = d.seriesById.get(o.series_id);
    if (!s || !isDatasetPublished(s.dataset)) continue;
    const src = d.sourceById.get(d.cellById.get(o.primary_cell_id)?.source_id ?? "");
    if (!src) continue;
    const cur = best.get(s.dataset);
    if (!cur || src.period > cur.period) best.set(s.dataset, src);
  }
  return [...best.values()];
}

export function hasErrata(): boolean {
  const errata = releaseMarkdown("ERRATA.md");
  return !!errata && !/\bNo errata\b/i.test(errata);
}

export function HowWeCheckShort() {
  return (
    <section id="how" aria-labelledby="how-h">
      <h2 id="how-h">How we check, in short</h2>
      <p className="measure">
        Every figure is read from the official document by a table-extraction tool, never by a language model, and published only if it passes fixed checks:
        sums, accounting identities, the same figure printed in another edition. Where a figure fails, you see a labelled gap that says why. The sections below
        give the numbers for this release, every check, and the thresholds they are held to.
      </p>
    </section>
  );
}

export function ThisRelease() {
  const r = db().release;
  const docs = newestDocuments();
  return (
    <section id="release" aria-labelledby="release-h">
      <h2 id="release-h">This release</h2>
      <p>
        <Link href="/releases">
          Release <Num kind="version">{r.version}</Num>
        </Link>
        , built <Num kind="date">{dateOnly(r.created_at)}</Num>. {hasErrata() ? <Link href="/releases#errata">See its corrections</Link> : "No corrections have been made to it."}{" "}
        <Link href="/data">Download the release</Link>.
      </p>
      <h3>Recently added</h3>
      <p className="small muted">The newest document of each kind that this release reads figures from.</p>
      <ul>
        {docs.map((s) => (
          <li key={s.source_id}>
            <Link href={sourceHref(s.source_id)}>
              <Num kind="text">{s.title}</Num>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The list of how the home page's changes are computed, built by the same code (and in the same order) as the home cards. */
export function HomeFormulas() {
  const words = new PageWords();
  const notes = new DerivedNotes(HOME_NOTES.prefix);
  for (const c of headlineCards()) headlineCard(c, words, notes);
  return (
    <DerivedList
      notes={notes}
      title="How the changes on the home page are computed"
      headingId="home-drv-h"
      intro={
        <p className="small">
          Each change on the <Link href="/">home page</Link>&rsquo;s headline figures, its formula and the checked figures it was computed from.
        </p>
      }
    />
  );
}
