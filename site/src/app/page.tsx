// Home (DESIGN.md 9.2). First phone screen, in order: one line on what the
// site is, the search field with three example searches, and four to six
// headline cards chosen by people (editorial/headline.json), each answer first
// with values read from the release. Below: topic tiles, the newest documents
// in the release, a line on how we check, and the release itself. The quality
// table and method summary live on Methods and Releases now.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import editorial from "../../editorial.config.json";
import { Num } from "@/components/ui/Num";
import { DerivedList, DerivedNotes, PageWords } from "@/components/home/Bits";
import { headlineCard } from "@/components/home/Cards";
import { headlineCards, topicHref, topics } from "@/components/home/editorial";
import { db, isDatasetPublished, releaseMarkdown, sourceHref, type Source } from "@/lib/data";
import { dateOnly } from "@/lib/format";

export const metadata: Metadata = {
  title: { absolute: "LUMS DataLab: Pakistan's official economic numbers, each linked to its printed page (prototype)" },
};

/** The newest document of each visible data type that this release reads from. */
function newestDocuments(): Source[] {
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

export default function Home() {
  const r = db().release;
  const words = new PageWords();
  const notes = new DerivedNotes("home-drv");
  const cards = headlineCards().map((c) => headlineCard(c, words, notes));
  const tps = topics();
  const docs = newestDocuments();
  const errata = releaseMarkdown("ERRATA.md");
  const noErrata = !errata || /\bNo errata\b/i.test(errata);

  return (
    <div className="home2">
      <section className="h2-find" aria-labelledby="home-h">
        <h1 id="home-h">Pakistan&rsquo;s official economic numbers, each linked to the government page it was printed on.</h1>
        <form action="/search" method="get" role="search" className="h2-search" aria-label="Search the figures">
          <label htmlFor="home-q" className="sr-only">
            Search for a figure
          </label>
          <input id="home-q" name="q" type="search" placeholder="Try inflation, health spending…" autoComplete="off" enterKeyHint="search" />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
        <p className="h2-try">
          Try:{" "}
          {editorial.exampleSearches.slice(0, 3).map((q, i) => (
            <span key={q}>
              {i > 0 ? " · " : ""}
              <Link href={`/search?q=${encodeURIComponent(q)}`}>{q}</Link>
            </span>
          ))}
        </p>
      </section>

      <section className="h2-cards" aria-labelledby="cards-h">
        <h2 id="cards-h" className="sr-only">
          Headline figures
        </h2>
        <ul className="hc-grid">{cards}</ul>
        <p className="h2-cards-note small muted">
          Each figure is checked against the page it was printed on. Tap a figure to see that page; tap a card for the whole series.
        </p>
      </section>

      <section className="h2-topics" aria-labelledby="topics-h">
        <h2 id="topics-h">Topics</h2>
        <ul className="tp-grid">
          {tps.map((t) => (
            <li key={t.slug} className="tp-tile">
              <Link href={topicHref(t.slug)} className="tp-link">
                {t.name}
              </Link>
              <p>{t.short}</p>
            </li>
          ))}
        </ul>
        <p className="small">
          Looking for a particular publication? <Link href="/sources">Browse by source document</Link>.
        </p>
      </section>

      <div className="h2-foot">
        <section aria-labelledby="recent-h">
          <h2 id="recent-h">Recently added</h2>
          <p className="small muted">The newest document of each kind that this release reads figures from.</p>
          <ul className="h2-recent">
            {docs.map((s) => (
              <li key={s.source_id}>
                <Link href={sourceHref(s.source_id)}>
                  <Num kind="text">{s.title}</Num>
                </Link>
              </li>
            ))}
          </ul>
          <p className="small">Next expected: not stated in this release.</p>
        </section>

        <section aria-labelledby="how-h">
          <h2 id="how-h">How we check</h2>
          <p>
            Every figure is read from the official document by a table-extraction tool, never by a language model, and published only if it passes fixed
            checks: sums, accounting identities, the same figure printed in another edition. Where a figure fails, you see a labelled gap that says why.{" "}
            <Link href="/methods">How we check, in full</Link>
          </p>
        </section>

        <section aria-labelledby="rel-h">
          <h2 id="rel-h">This release</h2>
          <p>
            <Link href="/releases">
              Release <Num kind="version">{r.version}</Num>
            </Link>
            , built <Num kind="date">{dateOnly(r.created_at)}</Num>. {noErrata ? "No corrections have been made to it." : <Link href="/releases#errata">See its corrections</Link>}{" "}
            <Link href="/data">Download the release</Link>
          </p>
        </section>
      </div>

      <DerivedList notes={notes} title="How the changes on the cards are computed" />
    </div>
  );
}
