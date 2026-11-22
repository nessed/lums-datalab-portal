// Indicators (DESIGN.md 9.1; data hub plan, section 8): the way in by subject
// rather than by document. One block per theme with checked data in this
// release: its headline figures (latest checked value, what kind of figure it
// is and its period in full words, a line of its checked values), and the
// stories that explain it. A first-layer page: editorial-plain-words.mjs keeps
// codes and jargon off it. Only themes with checked data are listed.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import Spark from "@/components/Spark";
import { Breadcrumbs } from "@/components/ui/Basics";
import { ShortValue } from "@/components/home/Bits";
import { mainKind } from "@/components/home/Topic";
import { latestShown } from "@/components/home/derive";
import { answerHref, questionBySlug, topicHref, topics } from "@/components/home/editorial";
import { basis } from "@/components/indicators/Basis";
import { db, seriesHref, type Series } from "@/lib/data";
import { seriesTitle } from "@/lib/titles";

export const metadata: Metadata = {
  title: "Indicators",
  description: "Prices and inflation, government spending and revenue, jobs and the provinces: the latest checked figures and the stories behind them.",
};

function Headline({ s }: { s: Series }) {
  const { latest } = latestShown(db().obsBySeries.get(s.series_id) ?? [], mainKind(s));
  return (
    <li className="ix-fig">
      <Link href={seriesHref(s.series_id)} className="ix-name">
        {seriesTitle(s)}
      </Link>
      {latest ? (
        <>
          <ShortValue o={latest} series={s} className="ix-value" />
          <span className="ix-basis">{basis(latest, s)}</span>
        </>
      ) : (
        <span className="ix-basis">No checked figure yet</span>
      )}
      <span className="ix-spark" aria-hidden="true">
        <Spark series={s} width={120} height={30} link={false} />
      </span>
    </li>
  );
}

export default function TopicsPage() {
  return (
    <article className="ix">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Indicators" }]} />
      <header className="ix-head">
        <h1>Indicators</h1>
        <p className="ix-lede">The latest checked figure on each subject, what kind of figure it is, and the stories that explain it.</p>
        <p className="ix-meta">
          A subject appears only when this release holds checked figures for it; planned data is on the <Link href="/releases#coming">Releases page</Link>. To
          browse by publication instead, see the <Link href="/library">Library</Link>.
        </p>
      </header>
      <div className="ix-list">
        {topics().map((t) => {
          const stories = t.questions.slice(0, 3).map((slug) => ({ slug, q: questionBySlug(slug) }));
          return (
            <section key={t.slug} className="ix-theme" aria-labelledby={`ix-${t.slug}`}>
              <div className="ix-themehead">
                <h2 id={`ix-${t.slug}`}>
                  <Link href={topicHref(t.slug)}>{t.name}</Link>
                </h2>
                <p className="ix-short">{t.short}</p>
              </div>
              {t.headline.length ? (
                <ul className="ix-figs">
                  {t.headline.map((s) => (
                    <Headline key={s.series_id} s={s} />
                  ))}
                </ul>
              ) : null}
              <div className="ix-foot">
                {stories.some((x) => x.q) ? (
                  <div className="ix-stories">
                    <h3>Stories</h3>
                    <ul>
                      {stories.map(({ slug, q }) =>
                        q ? (
                          <li key={slug}>
                            <Link href={answerHref(slug)}>{q.question}</Link>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  </div>
                ) : null}
                <p className="ix-all">
                  <Link href={topicHref(t.slug)}>Every figure on {t.name.toLowerCase()}</Link>
                </p>
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
