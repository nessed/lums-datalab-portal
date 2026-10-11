// Home: find, see, take, check on the first screen. One line on what this is,
// a search box, one tile per data type and the latest checked figure of a few
// headline series (chosen by people in editorial.config.json; every value is
// read from the release and links to its receipt). Text goes below the fold.
import Link from "next/link";
import editorial from "../../editorial.config.json";
import { FigureLine, KindAndPeriod } from "@/components/Figure";
import Spark from "@/components/Spark";
import DataTypeTile from "@/components/DataTypeTile";
import { Count, Num } from "@/components/ui/Num";
import { StatusLegend } from "@/components/ui/Status";
import { datasetName, db, isDatasetPublished, seriesHref } from "@/lib/data";
import { COMING } from "@/lib/features";
import { dateOnly } from "@/lib/format";
import { latestPublished, publishedDatasets, totalVisible } from "@/lib/stats";

function Headline({ id }: { id: string }) {
  const d = db();
  const s = d.seriesById.get(id);
  if (!s || !isDatasetPublished(s.dataset)) return null;
  const o = latestPublished(id);
  if (!o) return null;
  return (
    <li className="hl">
      <div className="hl-text">
        <Link href={seriesHref(id)} className="hl-name">
          {s.name}
        </Link>
        <FigureLine o={o} series={s} />
        <span className="hl-kind">
          <KindAndPeriod o={o} series={s} />
        </span>
      </div>
      <Spark series={s} width={104} height={38} />
    </li>
  );
}

export default function Home() {
  const r = db().release;
  const keys = publishedDatasets();
  const total = totalVisible();
  const headline = editorial.headline.filter((id) => {
    const s = db().seriesById.get(id);
    return s && isDatasetPublished(s.dataset) && latestPublished(id);
  });

  return (
    <div className="home">
      <section className="home-find" aria-labelledby="home-h">
        <h1 id="home-h">Pakistan&rsquo;s economic and fiscal statistics, every figure linked to the government page it was printed on.</h1>
        <form action="/browse" method="get" role="search" className="home-search" aria-label="Search the catalogue">
          <label htmlFor="home-q" className="sr-only">
            Search series
          </label>
          <input id="home-q" name="q" type="search" placeholder="Search series, e.g. health spending" autoComplete="off" />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
        <p className="home-try">
          Try:{" "}
          {editorial.exampleSearches.map((q, i) => (
            <span key={q}>
              {i > 0 ? " · " : ""}
              <Link href={`/browse?q=${encodeURIComponent(q)}`}>{q}</Link>
            </span>
          ))}{" "}
          · or <Link href="/browse">browse all <Count k="series" n={total.series} /> series</Link>
        </p>
      </section>

      <section className="home-latest" aria-labelledby="latest-h">
        <h2 id="latest-h" className="eyebrow">
          Latest checked figures
        </h2>
        <ul className="hl-grid">
          {headline.map((id) => (
            <Headline key={id} id={id} />
          ))}
        </ul>
      </section>

      <section className="home-types" aria-labelledby="types-h">
        <h2 id="types-h" className="eyebrow">
          Data types
        </h2>
        <ul className="dt-grid">
          {keys.map((k) => (
            <DataTypeTile key={k} k={k} />
          ))}
        </ul>
      </section>

      <p className="home-release">
        Release <Link href="/releases"><Num kind="version">{r.version}</Num></Link>, built <Num kind="date">{dateOnly(r.created_at)}</Num> ·{" "}
        <Link href="/data">Download the release</Link> · <Link href="/methods#statuses">What the marks mean</Link>
      </p>
      <StatusLegend label="Status marks used on this site" />

      <div className="home-more">
        <section aria-labelledby="how-h">
          <h2 id="how-h">How a figure gets on this site</h2>
          <ol>
            <li>Read from the official PDF by a table-extraction tool. No language model writes a number or decides whether it passes.</li>
            <li>Checked by fixed rules: sums, accounting identities, the same figure printed in another edition.</li>
            <li>Published only if it passes. Otherwise the site shows a labelled gap that says why.</li>
          </ol>
          <p>
            Every number is a link to its <strong>receipt</strong>: the printed page with the figure boxed, the checks it passed, and the official PDF.{" "}
            <Link href="/methods">Methods</Link> · <Link href="/demo/health-and-jobs">A worked example</Link>
          </p>
        </section>
        <section aria-labelledby="quality-h">
          <h2 id="quality-h">Quality of this release</h2>
          <div className="table-wrap" role="region" aria-label="Quality of this release" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Data type</th>
                  <th scope="col" className="num">
                    Coverage
                  </th>
                  <th scope="col" className="num">
                    Checks passed
                  </th>
                  <th scope="col" className="num">
                    Measured error rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k}>
                    <th scope="row">
                      <Link href={`/datasets/${k}#quality`}>{datasetName(k)}</Link>
                    </th>
                    <td className="num">
                      <Count k={`release:dataset_status.${k}.coverage.coverage`} n={r.dataset_status[k]?.coverage?.coverage} rate />
                    </td>
                    <td className="num">
                      <Count k={`release:dataset_status.${k}.check_pass_rate.pass_rate`} n={r.dataset_status[k]?.check_pass_rate?.pass_rate} rate />
                    </td>
                    <td className="num">Pending</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            Coverage: how much of each printed table was captured. Checks passed: evidence that what was captured is right. They answer different
            questions and are never combined. The error rate needs the hand-labelled gold set.
          </p>
        </section>
      </div>
      <p className="coming home-coming">
        More data types: {COMING}. <Link href="/releases#planned">What is planned</Link>
      </p>
    </div>
  );
}
