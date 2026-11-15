// An answer page (DESIGN.md 9.4): titled with the question; the first sentence
// is the answer with its date and kind of figure, from a template and the
// release. Then the like-with-like comparison, the revision as its own
// sentence, the chart, the source marker, what the figure covers and does not
// (from the release's own series definitions, notes and breaks only), and
// links to the series and receipts. Where the release holds several parts of
// the answer, each is shown, labelled, and never added up. URL: /answers/<slug>.
import type { Metadata } from "next";
import { seriesTitle } from "@/lib/titles";
import { notFound } from "next/navigation";
import Link from "@/components/ui/Link";
import { Breadcrumbs } from "@/components/ui/Basics";
import { Num } from "@/components/ui/Num";
import { DerivedList, DerivedNotes, PageWords } from "@/components/home/Bits";
import { answerPart } from "@/components/home/Answer";
import { answerHref, questionBySlug, questions, topicBySlug, topicHref } from "@/components/home/editorial";
import { seriesHref, type Series } from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return questions().map((q) => ({ slug: q.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const q = questionBySlug((await params).slug);
  return q ? { title: q.question, description: q.title } : {};
}

export default async function AnswerPage({ params }: Props) {
  const q = questionBySlug((await params).slug);
  if (!q) notFound();
  const topic = topicBySlug(q.topic);
  const words = new PageWords();
  const notes = new DerivedNotes();
  const multi = q.parts.length > 1;
  const parts = q.parts.map((p, i) => answerPart(p, words, notes, { first: i === 0, multi }));
  const seen = new Set<string>();
  const covered: Series[] = q.parts.map((p) => p.series).filter((s) => (seen.has(s.series_id) ? false : (seen.add(s.series_id), true)));
  const others = topic ? topic.questions.filter((x) => x !== q.slug).map(questionBySlug).filter((x) => !!x) : [];

  return (
    <article className="answer">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, ...(topic ? [{ href: topicHref(topic.slug), label: topic.name }] : []), { label: "Answer" }]} />
      <header className="page-head ans-head">
        <h1>{q.question}</h1>
        <p className="kicker ans-title">{q.title}</p>
      </header>

      {parts[0]}

      {multi ? (
        <p className="ans-parts-note">
          This release holds {q.parts.length === 2 ? "two" : q.parts.length === 3 ? "three" : q.parts.length === 4 ? "four" : "several"} parts of the answer; the first is above. Each is shown
          on its own, labelled; the page never adds them up.
        </p>
      ) : null}

      {parts.slice(1)}

      <section className="ans-covers" aria-labelledby="covers-h">
        <h2 id="covers-h">What {covered.length > 1 ? "these figures cover" : "this figure covers"}, and what not</h2>
        {covered.map((s) => (
          <div key={s.series_id} className="ans-cover">
            {covered.length > 1 ? (
              <h3>
                <Link href={seriesHref(s.series_id)}>{seriesTitle(s)}</Link>
              </h3>
            ) : null}
            {s.definition ? (
              <p>
                <Num kind="text">{s.definition}</Num>
              </p>
            ) : null}
            {s.notes ? (
              <p>
                <Num kind="text">{s.notes}</Num>
              </p>
            ) : null}
            {s.breaks.map((b) => (
              <p key={b.at_period} className="ans-break">
                <strong>Series break</strong> at <Num kind="period">{b.at_period}</Num>: <Num kind="text">{b.note}</Num>
              </p>
            ))}
          </div>
        ))}
        <p className="small muted">This paragraph is the release&rsquo;s own description of each series, its notes and its breaks, quoted as they are.</p>
      </section>

      <section className="ans-links" aria-labelledby="links-h">
        <h2 id="links-h">Check it yourself</h2>
        <ul>
          {covered.map((s) => (
            <li key={s.series_id}>
              <Link href={seriesHref(s.series_id)}>{seriesTitle(s)}</Link>: chart, every figure with its status, and downloads
            </li>
          ))}
          <li>Every figure on this page links to its receipt: the government page it was printed on, with the figure boxed, and the checks it passed.</li>
        </ul>
        {others.length ? (
          <>
            <h3>Other questions{topic ? <> about {topic.name.toLowerCase()}</> : null}</h3>
            <ul>
              {others.map((x) => (
                <li key={x!.slug}>
                  <Link href={answerHref(x!.slug)}>{x!.question}</Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <DerivedList notes={notes} />
    </article>
  );
}
