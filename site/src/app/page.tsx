// Home: what this is in one sentence, the release's own numbers, the datasets,
// and three ways in. No hero, no cards: the evidence is the pitch.
import Link from "next/link";
import SeriesChart from "@/components/SeriesChart";
import { TableWrap } from "@/components/ui/Basics";
import { DocCrop } from "@/components/ui/PageFrame";
import { StatusBadge } from "@/components/ui/Status";
import { buildChart } from "@/lib/chart";
import {
  cropGuides,
  datasetKeys,
  db,
  isDatasetPublished,
  obsHref,
  pageImage,
  publishedObs,
  releaseMarkdown,
  seriesHref,
  type Observation,
} from "@/lib/data";
import { count, dateOnly, formatDecimalString, pct, periodWords, unitLabel, vintageWords } from "@/lib/format";
import { statusOf } from "@/lib/status";

/** The featured series and receipt. Chosen by id from the release; if the
 * release names them differently the section is simply left out. */
const FEATURED_SERIES = "fed.exp.current.function.health";

function rateRange(values: (number | null | undefined)[]): string {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (v.length === 0) return "not available";
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  return lo === hi ? pct(lo) : `${pct(lo)} to ${pct(hi)}`;
}

export default function Home() {
  const d = db();
  const r = d.release;
  const keys = datasetKeys();
  const published = keys.filter(isDatasetPublished);
  const byDataset = r.counts?.observations_by_dataset ?? {};
  const values = Object.values(byDataset).reduce((a, m) => a + (m.published ?? 0), 0);
  const checksRun = Object.values(r.counts?.checks_by_result ?? {}).reduce((a, b) => a + b, 0);
  const docsUsed = d.sources.filter((s) => (s.pages_used ?? []).length > 0).length;
  const coverage = rateRange(published.map((k) => r.dataset_status[k]?.coverage?.coverage));
  const passRate = rateRange(published.map((k) => r.dataset_status[k]?.check_pass_rate?.pass_rate));

  const health = d.seriesById.get(FEATURED_SERIES);
  const healthVisible = health && isDatasetPublished(health.dataset) && publishedObs(health.series_id).length > 1;
  // Featured receipt: the latest budget estimate of the featured series that has a page render.
  let featured: Observation | undefined;
  if (healthVisible) {
    featured = [...publishedObs(health.series_id)]
      .filter((o) => o.tier === "A" && o.primary_cell_id && pageImage(d.cellById.get(o.primary_cell_id)!.source_id, d.cellById.get(o.primary_cell_id)!.page))
      .sort((a, b) => b.period.localeCompare(a.period))[0];
  }
  const fCell = featured?.primary_cell_id ? d.cellById.get(featured.primary_cell_id) : undefined;
  const fImg = fCell ? pageImage(fCell.source_id, fCell.page) : null;
  const fSrc = fCell ? d.sourceById.get(fCell.source_id) : undefined;

  const changelog = releaseMarkdown("CHANGELOG.md");
  const firstEntry = changelog?.split("\n").find((l) => l.startsWith("## "))?.replace(/^##\s*/, "");

  return (
    <>
      <header className="home-head">
        <h1>Pakistan&rsquo;s economic and fiscal statistics, every figure traceable to the page it was printed on.</h1>
        <p className="lede">
          A research bank built at the LUMS Department of Economics. Each value links to a receipt: the government page with the figure boxed,
          the arithmetic checks it passed, and a citation. Where we could not verify a figure, we show a labelled gap instead of a number.
        </p>
      </header>

      <section aria-labelledby="numbers-h" className="home-numbers">
        <h2 id="numbers-h" className="sr-only">
          This release in numbers
        </h2>
        <div className="stat-row">
          <Link href="/browse">
            <span className="stat-v">{count(values)}</span>
            <span className="stat-k">checked values published</span>
          </Link>
          <Link href="/sources">
            <span className="stat-v">{count(docsUsed)}</span>
            <span className="stat-k">government documents read</span>
          </Link>
          <Link href="/methods#checks">
            <span className="stat-v">{count(checksRun)}</span>
            <span className="stat-k">arithmetic checks run</span>
          </Link>
          <Link href="/methods#quality">
            <span className="stat-v">{coverage}</span>
            <span className="stat-k">of printed numbers captured (coverage)</span>
          </Link>
          <Link href="/methods#quality">
            <span className="stat-v">{passRate}</span>
            <span className="stat-k">of checks passed, by dataset</span>
          </Link>
          <Link href="/methods#error-rate">
            <span className="stat-v is-pending">Pending</span>
            <span className="stat-k">measured error rate: needs the hand-labelled gold set</span>
          </Link>
        </div>
        <p className="small muted measure">
          Release <Link href="/releases">{r.version}</Link>, built {dateOnly(r.created_at)}
          {firstEntry ? <>. Latest change: {firstEntry}</> : null}. Coverage and the check pass rate answer different questions and are never
          combined; <Link href="/methods#quality">see how each is measured</Link>.
        </p>
      </section>

      <div className="home-grid">
        <section aria-labelledby="start-h" className="home-start">
          <h2 id="start-h">Start here</h2>

          {healthVisible && health ? (
            <article className="start-item">
              <h3>
                <span className="start-n">1</span> A series: <Link href={seriesHref(health.series_id)}>{health.name}</Link>
              </h3>
              <p className="small measure">
                Federal spending on health as printed in each year&rsquo;s budget statement, budget and revised estimates. The dashed rule is the
                18th Amendment devolution: figures either side are not comparable, so the lines stop there.
              </p>
              <SeriesChart amount={buildChart(health)} amountLabel="Amount" />
            </article>
          ) : null}

          {featured && fCell && fImg ? (
            <article className="start-item">
              <h3>
                <span className="start-n">2</span> A receipt: how one number is verified
              </h3>
              <div className="start-receipt">
                <div>
                  <p className="small muted" style={{ margin: 0 }}>
                    {health?.name}, {vintageWords(featured.vintage).toLowerCase()} for {periodWords(featured.period)}
                  </p>
                  <p className="start-fig tnum">
                    {formatDecimalString(featured.value)} <span className="figure-u">{unitLabel(featured.unit, featured.scale_factor)}</span>
                  </p>
                  <StatusBadge info={statusOf(featured)} />
                  <p className="small">
                    Printed on page {fCell.page} of {fSrc?.title ?? fCell.source_id}. {featured.evidence_summary}
                  </p>
                  <p>
                    <Link href={obsHref(featured.obs_id)} className="btn">
                      Open the receipt
                    </Link>
                  </p>
                </div>
                <DocCrop image={fImg} cell={fCell} guides={cropGuides(fCell)} rows={2} alt={`Close-up of page ${fCell.page} of ${fSrc?.title ?? ""}: the row "${fCell.row_label_raw}" with ${fCell.value_raw} boxed.`} />
              </div>
            </article>
          ) : null}

          <article className="start-item">
            <h3>
              <span className="start-n">3</span> <Link href="/demo/health-and-jobs">A worked example: health and jobs</Link>
            </h3>
            <p className="small measure">A short piece of analysis in which every figure in the text links to its receipt, with the caveats stated where they apply.</p>
          </article>
        </section>

        <section aria-labelledby="ds-h" className="home-datasets">
          <h2 id="ds-h">Datasets in this release</h2>
          <TableWrap label="Datasets in this release">
            <table>
              <thead>
                <tr>
                  <th scope="col">Dataset</th>
                  <th scope="col">Periods</th>
                  <th scope="col" className="num">
                    Values
                  </th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const ds = r.dataset_status[k];
                  const periods = r.scope?.periods?.[k] ?? [];
                  const gaps = Object.entries(byDataset[k] ?? {})
                    .filter(([g]) => g !== "published")
                    .reduce((a, [, v]) => a + v, 0);
                  return (
                    <tr key={k}>
                      <th scope="row">
                        {isDatasetPublished(k) ? <Link href={`/browse?dataset=${k}`}>{ds?.name ?? k}</Link> : (ds?.name ?? k)}
                      </th>
                      <td className="small">{periods.length ? `${periods[0]} to ${periods[periods.length - 1]}` : "none yet"}</td>
                      <td className="num">
                        {count(byDataset[k]?.published ?? 0)}
                        <span className="cell-sub">{count(gaps)} gaps</span>
                      </td>
                      <td className="small">
                        {isDatasetPublished(k) ? "Published" : `Coming${ds?.reasons?.length ? `: ${ds.reasons.join("; ")}` : ""}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          <p className="small">
            <Link href="/browse">Browse every series</Link> · <Link href="/data">Download the files</Link> · <Link href="/sources">The documents</Link>
          </p>
          <h2>What the marks mean</h2>
          <ul className="home-marks small">
            {(["checked", "disputed", "gap-source", "gap-pending", "withheld"] as const).map((k) => {
              const info = statusOf(k === "checked" ? { status: "checked", published: true, value: "1" } : k === "disputed" ? { status: "disputed" } : { gap_kind: k === "gap-source" ? "not_in_source" : k === "gap-pending" ? "not_yet_verified" : "failed_checks" });
              return (
                <li key={k}>
                  <StatusBadge info={info} />
                  <span className="muted">{info.meaning}</span>
                </li>
              );
            })}
          </ul>
          <p className="small muted">No language model writes a published number or decides whether it passes a check.</p>
        </section>
      </div>
    </>
  );
}
