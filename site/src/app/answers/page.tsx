// Every answer page, by topic (DESIGN.md 9.4).
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { Breadcrumbs } from "@/components/ui/Basics";
import { answerHref, questions, topicHref, topics } from "@/components/home/editorial";

export const metadata: Metadata = {
  title: "Questions and answers",
  description: "Short answers to the questions people ask about Pakistan's official economic numbers, each figure linked to the page it was printed on.",
};

export default function AnswersPage() {
  const qs = questions();
  return (
    <article className="answers-index">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Questions" }]} />
      <header className="page-head">
        <h1>Questions and answers</h1>
        <p className="lede measure">Each answer is one sentence written from the current release, with the kind of figure and its date, and a link to the page it was printed on.</p>
      </header>
      {topics().map((t) => {
        const mine = qs.filter((q) => q.topic === t.slug);
        if (!mine.length) return null;
        return (
          <section key={t.slug} aria-labelledby={`aq-${t.slug}`}>
            <h2 id={`aq-${t.slug}`}>
              <Link href={topicHref(t.slug)}>{t.name}</Link>
            </h2>
            <ul className="tp-questions">
              {mine.map((q) => (
                <li key={q.slug}>
                  <Link href={answerHref(q.slug)}>{q.question}</Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </article>
  );
}
