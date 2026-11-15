// A topic page (DESIGN.md 9.3): the overview for one area. Its headline cards;
// the questions people ask, each linking to an answer page; the series as a
// short tree with a sparkline and latest value per row; the documents that
// feed it; its known limits and gaps; and for budget topics how much budget
// estimates change. Topics and wording come from editorial/topics.json; every
// number from the release.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/Link";
import { Breadcrumbs } from "@/components/ui/Basics";
import { DerivedList, DerivedNotes, PageWords } from "@/components/home/Bits";
import { headlineCard } from "@/components/home/Cards";
import { answerHref, questionBySlug, topicBySlug, topics } from "@/components/home/editorial";
import { mainKind, revisionTable, seriesTree, SourcesList } from "@/components/home/Topic";

export const dynamicParams = false;

export function generateStaticParams() {
  return topics().map((t) => ({ slug: t.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = topicBySlug((await params).slug);
  return t ? { title: t.name, description: t.short } : {};
}

export default async function TopicPage({ params }: Props) {
  const t = topicBySlug((await params).slug);
  if (!t) notFound();
  const words = new PageWords();
  const notes = new DerivedNotes();
  const cards = t.headline.map((s) => headlineCard({ series: s, kind: mainKind(s), name: s.name }, words, notes));
  const tree = seriesTree(t.groups, words);
  const rev = t.revisions && t.revisions.series.length ? revisionTable(t.revisions.series, words, notes) : null;
  const allSeries = t.groups.flatMap((g) => g.series);
  const qs = t.questions.map(questionBySlug).filter((q) => !!q);

  return (
    <article className="topic">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/topics", label: "Topics" }, { label: t.name }]} />
      <header className="page-head">
        <p className="kicker">Topic</p>
        <h1>{t.name}</h1>
        <p className="lede measure">{t.definition}</p>
      </header>

      <section aria-labelledby="t-cards" className="tp-cards">
        <h2 id="t-cards" className="sr-only">
          Latest figures
        </h2>
        <ul className="hc-grid">{cards}</ul>
      </section>

      {qs.length ? (
        <section aria-labelledby="t-q" className="tp-section">
          <h2 id="t-q">Questions people ask</h2>
          <ul className="tp-questions">
            {qs.map((q) => (
              <li key={q!.slug}>
                <Link href={answerHref(q!.slug)}>{q!.question}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="t-series" className="tp-section">
        <h2 id="t-series">The series in this topic</h2>
        <p className="small muted">Latest checked figure of each, with its kind and period. Tap a name for the chart, the table and the downloads.</p>
        {tree}
      </section>

      {rev ? (
        <section aria-labelledby="t-rev" className="tp-section">
          <h2 id="t-rev">{t.revisions!.heading}</h2>
          {rev}
        </section>
      ) : null}

      <section aria-labelledby="t-limits" className="tp-section">
        <h2 id="t-limits">Known limits</h2>
        <ul className="tp-notes">
          {t.limits.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <h3>Gaps</h3>
        <ul className="tp-notes">
          {t.gaps.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className="small">
          Planned data is listed on the <Link href="/releases#coming">Releases page</Link>.
        </p>
      </section>

      <section aria-labelledby="t-src" className="tp-section">
        <h2 id="t-src">Where these figures come from</h2>
        <SourcesList series={allSeries} />
      </section>

      <DerivedList notes={notes} />
    </article>
  );
}
