// Home (DESIGN.md 9.2; round 2 items 17 to 19). The home page is search,
// headline figures and topics. First phone screen, in order: one line on what
// the site is, the search field with three example searches, then the headline
// figures chosen by people (editorial/headline.json), each answer first with
// values read from the release. Beside them on a wide screen (below them on a
// phone): one figure next to the crop of the page it was printed on, the thing
// no other site does. Then the topics, each with its headline figure and a
// sparkline. "How we check", the release details and the formulas behind the
// cards moved to /methods (the cards' "how" links go there); the home page keeps
// one link and the release tag.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import editorial from "../../editorial.config.json";
import { Num } from "@/components/ui/Num";
import { DerivedNotes, PageWords } from "@/components/home/Bits";
import { headlineCard, topicCard } from "@/components/home/Cards";
import EvidenceExample from "@/components/home/Evidence";
import { HOME_NOTES, hasErrata } from "@/components/home/Moved";
import { evidenceExample, headlineCards, topics } from "@/components/home/editorial";
import { db } from "@/lib/data";
import { dateOnly } from "@/lib/format";

export const metadata: Metadata = {
  title: { absolute: "LUMS DataLab: Pakistan's official economic numbers, each linked to its printed page (prototype)" },
};

export default function Home() {
  const r = db().release;
  const words = new PageWords();
  const notes = new DerivedNotes(HOME_NOTES.prefix, HOME_NOTES.page);
  const hc = headlineCards();
  const cards = hc.map((c) => headlineCard(c, words, notes));
  const ex = evidenceExample();
  const proof = ex ? <EvidenceExample series={ex.series} kind={ex.kind} words={words} /> : null;
  const onCards = new Set(hc.map((c) => c.series.series_id));
  const tps = topics().map((t) => topicCard(t, words, onCards));

  return (
    <div className="home2">
      <section className="h2-find" aria-labelledby="home-h">
        <h1 id="home-h">Pakistan&rsquo;s official economic numbers, each linked to the government page it was printed on.</h1>
        <form action="/search" method="get" role="search" className="h2-search" aria-label="Search the figures">
          <label htmlFor="home-q" className="sr-only">
            Search for a figure
          </label>
          <input id="home-q" name="q" type="search" placeholder="Inflation, health spending…" autoComplete="off" enterKeyHint="search" />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
        <p className="h2-try">
          <span className="h2-try-k">Try</span>
          {editorial.exampleSearches.slice(0, 3).map((q) => (
            <Link key={q} href={`/search?q=${encodeURIComponent(q)}`} className="h2-chip">
              {q}
            </Link>
          ))}
        </p>
      </section>

      <div className="h2-main">
        <section className="h2-cards" aria-labelledby="cards-h">
          <div className="h2-sechead">
            <h2 id="cards-h">Headline figures</h2>
            <p className="h2-asof">
              As of release{" "}
              <Link href="/releases">
                <Num kind="version">{r.version}</Num>
              </Link>
              , built <Num kind="date">{dateOnly(r.created_at)}</Num>
              {hasErrata() ? (
                <>
                  {" "}
                  · <Link href="/releases#errata">corrections</Link>
                </>
              ) : null}
            </p>
          </div>
          <ul className="hc-grid">{cards}</ul>
        </section>

        {proof ? <aside className="h2-proof">{proof}</aside> : null}
      </div>

      <section className="h2-topics" aria-labelledby="topics-h">
        <div className="h2-sechead">
          <h2 id="topics-h">Topics</h2>
          <p className="h2-asof">
            <Link href="/topics">All topics</Link> · <Link href="/library">Browse by source document</Link>
          </p>
        </div>
        <ul className="tc-grid">{tps}</ul>
      </section>

      <p className="h2-method">
        Every figure is read by a table-extraction tool and published only if it passes fixed checks. <Link href="/methods">How we check every figure</Link>
      </p>
    </div>
  );
}
