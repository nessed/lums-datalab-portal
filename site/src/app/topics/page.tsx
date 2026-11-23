// Data by topic (Home v3 pages set, 2026-11-24; earlier "Indicators", DESIGN.md
// 9.1): the way in by subject rather than by document. The same left list of
// topics as a topic page; then one block per topic with checked data in this
// release: its name, one line, up to four headline figures with a line of their
// checked values, and its stories. A first-layer page: editorial-plain-words.mjs
// keeps codes and jargon off it.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import Crumbs from "@/components/chrome/Crumbs";
import { answerHref, questionBySlug, topicHref, topics } from "@/components/home/editorial";
import { HeadTiles, headSeries, TopicNav } from "@/components/topic/TopicV4";
import "@/styles/v4-topic.css";

export const metadata: Metadata = {
  title: "Data by topic",
  description: "Prices and inflation, government spending and revenue, jobs and the provinces: the latest checked figures and the stories behind them.",
};

export default function TopicsPage() {
  return (
    <>
      <Crumbs items={[{ label: "Data by topic" }]} />
      <div className="tp5">
        <TopicNav />
        <article className="tp5-main">
          <h1>Data by topic</h1>
          <p className="tp5-lede">
            The latest checked figures on each subject. Topics without data yet are listed as coming soon. To browse by publication instead, see the{" "}
            <Link href="/library">Library</Link>.
          </p>
          {topics().map((t) => {
            const stories = t.questions
              .slice(0, 3)
              .map((slug) => ({ slug, q: questionBySlug(slug) }))
              .filter((x) => x.q);
            return (
              <section key={t.slug} className="tp5-block" aria-labelledby={`tp5-${t.slug}`}>
                <div className="tp5-h">
                  <h2 id={`tp5-${t.slug}`}>
                    <Link href={topicHref(t.slug)}>{t.name}</Link>
                  </h2>
                  <Link href={topicHref(t.slug)}>Every indicator</Link>
                </div>
                <p className="tp5-short">{t.short}</p>
                <HeadTiles series={headSeries(t)} />
                {stories.length ? (
                  <p className="tp5-stories">
                    <span className="strong">Stories: </span>
                    {stories.map(({ slug, q }, i) => (
                      <span key={slug}>
                        {i ? " · " : ""}
                        <Link href={answerHref(slug)}>{q!.question}</Link>
                      </span>
                    ))}
                  </p>
                ) : null}
              </section>
            );
          })}
        </article>
      </div>
    </>
  );
}
