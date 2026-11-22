// Stories (DESIGN.md 9.4; data hub plan, section 8): every answer page, by
// subject. Each card is the question, the latest checked figure it is answered
// with (kind and period in full words) and a line of that series' checked
// values. Every figure is read from the release; the wording of the questions
// is editorial (editorial/questions.json). URL stays /answers.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import Spark from "@/components/Spark";
import { Breadcrumbs } from "@/components/ui/Basics";
import { ShortValue } from "@/components/home/Bits";
import { latestShown } from "@/components/home/derive";
import { answerHref, questions, topicHref, topics, type Question } from "@/components/home/editorial";
import { basis } from "@/components/indicators/Basis";
import { db } from "@/lib/data";

export const metadata: Metadata = {
  title: "Stories",
  description: "Short answers to the questions people ask about Pakistan's official economic numbers, each figure linked to the page it was printed on.",
};

function StoryCard({ q }: { q: Question }) {
  const part = q.parts[0];
  const { latest } = part ? latestShown(db().obsBySeries.get(part.series.series_id) ?? [], part.kind) : { latest: undefined };
  return (
    <li className="sx-card">
      <h3 className="sx-q">
        <Link href={answerHref(q.slug)}>{q.question}</Link>
      </h3>
      {part && latest ? (
        <p className="sx-fig">
          <ShortValue o={latest} series={part.series} className="sx-value" />
          <span className="sx-basis">
            {part.subject ? <>{part.subject}, </> : null}
            {basis(latest, part.series)}
          </span>
          <span className="sx-spark" aria-hidden="true">
            <Spark series={part.series} width={96} height={26} link={false} />
          </span>
        </p>
      ) : null}
    </li>
  );
}

export default function AnswersPage() {
  const qs = questions();
  return (
    <article className="sx">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Stories" }]} />
      <header className="ix-head">
        <h1>Stories</h1>
        <p className="ix-lede">Short answers to the questions people ask, each written from the current release.</p>
        <p className="ix-meta">Every answer gives the kind of figure and its date, compares like with like, and links each number to the page it was printed on.</p>
      </header>
      {topics().map((t) => {
        const mine = qs.filter((q) => q.topic === t.slug);
        if (!mine.length) return null;
        return (
          <section key={t.slug} className="sx-theme" aria-labelledby={`aq-${t.slug}`}>
            <h2 id={`aq-${t.slug}`}>
              <Link href={topicHref(t.slug)}>{t.name}</Link>
            </h2>
            <ul className="sx-grid">
              {mine.map((q) => (
                <StoryCard key={q.slug} q={q} />
              ))}
            </ul>
          </section>
        );
      })}
    </article>
  );
}
