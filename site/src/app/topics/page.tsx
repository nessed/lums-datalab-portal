// All topics (DESIGN.md 9.1): the way in by question rather than by document.
// Only topics with checked data in this release are listed.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { Breadcrumbs } from "@/components/ui/Basics";
import { answerHref, questionBySlug, topicHref, topics } from "@/components/home/editorial";

export const metadata: Metadata = {
  title: "Topics",
  description: "Prices and inflation, jobs and labour, government spending and revenue, and the provinces: the figures and the questions people ask.",
};

export default function TopicsPage() {
  return (
    <article className="topics-index">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Topics" }]} />
      <header className="page-head">
        <h1>Topics</h1>
        <p className="lede measure">
          Each topic gathers the figures on one subject and the questions people ask about it. A topic appears only when this release holds checked figures
          for it; planned data is on the <Link href="/releases#coming">Releases page</Link>. To browse by publication instead, see{" "}
          <Link href="/library">Library</Link>.
        </p>
      </header>
      <ul className="ti-list">
        {topics().map((t) => (
          <li key={t.slug} className="ti-item">
            <h2>
              <Link href={topicHref(t.slug)}>{t.name}</Link>
            </h2>
            <p>{t.short}</p>
            {t.questions.length ? (
              <ul className="ti-q small">
                {t.questions.slice(0, 3).map((slug) => {
                  const q = questionBySlug(slug);
                  return q ? (
                    <li key={slug}>
                      <Link href={answerHref(slug)}>{q.question}</Link>
                    </li>
                  ) : null;
                })}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </article>
  );
}
