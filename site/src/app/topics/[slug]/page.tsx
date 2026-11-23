// A topic page, Home v3 pages set (design handoff, 2026-11-24; earlier DESIGN.md
// 9.3). Left: every topic (the ones without data as "Coming soon"). Main: the
// topic's name and one line, up to four headline tiles, its indicators grouped as
// in editorial/topics.json with a text filter and a frequency switch, then the
// documents that feed it and Insights (coming soon). The questions, known limits,
// gaps and (for budget topics) how much budget estimates change move one layer
// down, into a folded section. Every number from the release.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/Link";
import Crumbs from "@/components/chrome/Crumbs";
import { DerivedList, DerivedNotes, PageWords } from "@/components/home/Bits";
import { answerHref, questionBySlug, topicBySlug, topics } from "@/components/home/editorial";
import { revisionTable } from "@/components/home/Topic";
import IndicatorFilter from "@/components/topic/IndicatorFilter";
import { FREQ_WORDS, HeadTiles, headSeries, IndicatorRow, TopicDocs, TopicNav } from "@/components/topic/TopicV4";
import "@/styles/v4-topic.css";

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
  const rev = t.revisions && t.revisions.series.length ? revisionTable(t.revisions.series, words, notes) : null;
  const allSeries = t.groups.flatMap((g) => g.series);
  const freqs = [...new Set(allSeries.map((s) => FREQ_WORDS[s.frequency ?? ""]).filter((x): x is string => !!x))];
  const qs = t.questions.map(questionBySlug).filter((q) => !!q);

  return (
    <>
      <Crumbs items={[{ href: "/topics", label: "Data by topic" }, { label: t.name }]} />
      <div className="tp5">
        <TopicNav current={t.slug} />
        <article className="tp5-main">
          <h1>{t.name}</h1>
          <p className="tp5-lede">{t.short}</p>
          <HeadTiles series={headSeries(t)} />

          <section className="tp5-ind" aria-labelledby="tp5-ind-h">
            <IndicatorFilter freqs={freqs} heading={<h2 id="tp5-ind-h">Indicators</h2>}>
              {t.groups.map((g) => (
                <div key={g.heading} data-group="">
                  <h3>{g.heading}</h3>
                  <table className="tp5-tbl">
                    <tbody>
                      {g.series.map((s) => (
                        <IndicatorRow key={s.series_id} s={s} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </IndicatorFilter>
            <p className="src-hint">Click any value to see where it was printed.</p>
          </section>

          <div className="tp5-two">
            <section aria-labelledby="tp5-docs-h">
              <div className="tp5-h">
                <h2 id="tp5-docs-h">Documents</h2>
                <Link href="/library">All in the library</Link>
              </div>
              <TopicDocs series={allSeries} />
            </section>
            <section aria-labelledby="tp5-ins-h">
              <div className="tp5-h">
                <h2 id="tp5-ins-h">Insights</h2>
              </div>
              <p className="tp5-soon-box">
                <strong>Coming soon.</strong> Short findings on {t.name.toLowerCase()}, each linked to the figures it uses and reviewed by a person before it is shown.
              </p>
              {qs.length ? (
                <>
                  <h3 className="tp5-h3">Stories</h3>
                  <ul className="tp5-list">
                    {qs.map((q) => (
                      <li key={q!.slug}>
                        <Link href={answerHref(q!.slug)}>{q!.question}</Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          </div>

          <details className="tp5-notes">
            <summary>Notes on this topic: what it covers, known limits and gaps</summary>
            <p>{t.definition}</p>
            <h3>Known limits</h3>
            <ul>
              {t.limits.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h3>Gaps</h3>
            <ul>
              {t.gaps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p>
              Planned data is listed on the <Link href="/releases#coming">Releases page</Link>.
            </p>
          </details>

          {rev ? (
            <details className="tp5-notes">
              <summary>{t.revisions!.heading}</summary>
              {rev}
              <DerivedList notes={notes} />
            </details>
          ) : null}
        </article>
      </div>
    </>
  );
}
