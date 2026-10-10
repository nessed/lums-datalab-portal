import Link from "next/link";
import { DatasetBadge } from "@/components/Badges";
import Cite from "@/components/Cite";
import { datasetKeys, db, ISSUES_URL } from "@/lib/data";
import { CHECKED_HELP, count, GAP_WORDS, pct } from "@/lib/format";

export default function Home() {
  const d = db();
  const r = d.release;
  const byDataset = r.counts?.observations_by_dataset ?? {};
  let published = 0;
  let gaps = 0;
  for (const m of Object.values(byDataset)) {
    for (const [k, v] of Object.entries(m)) {
      if (k === "published") published += v;
      else gaps += v;
    }
  }
  const checksRun = Object.values(r.counts?.checks_by_result ?? {}).reduce((a, b) => a + b, 0);

  return (
    <>
      <h1>Pakistan&rsquo;s official statistics, where every number can be checked</h1>
      <p className="lede">
        The LUMS DataLab Portal is an open research bank of Pakistan&rsquo;s official statistics. Each figure links to a receipt that shows the exact
        spot on the government page it was read from, the checks it passed, and how to cite it. If we have not verified a figure, we show a
        labelled gap instead of a number.
      </p>
      <div className="actions">
        <Link className="button button-primary" href="/demo/health-and-jobs">
          See the demo
        </Link>
        <Link className="button" href="/browse">
          Browse the series
        </Link>
        <Link className="button" href="/methods">
          How it works
        </Link>
      </div>

      <div className="notice">
        <p>
          <strong>Prototype.</strong> This is an unofficial research prototype from the LUMS Department of Economics DataLab. The government documents
          are the authority. Release <span className="mono">{r.version}</span> has no DOI and is not for citation in publications yet. The measured
          error rate is pending: it needs a human-labelled sample that has not been completed. Found a mistake?{" "}
          <a href={ISSUES_URL}>Report an error</a>.
        </p>
      </div>

      <h2>This release in numbers</h2>
      <div className="stats">
        <div className="stat">
          <b>{count(published)}</b>
          <span title={CHECKED_HELP}>checked values published</span>
        </div>
        <div className="stat">
          <b>{count(gaps)}</b>
          <span>labelled gaps (no value shown)</span>
        </div>
        <div className="stat">
          <b>{count(r.counts?.series ?? d.series.length)}</b>
          <span>series</span>
        </div>
        <div className="stat">
          <b>{count(r.counts?.sources ?? d.sources.length)}</b>
          <span>government documents registered</span>
        </div>
        <div className="stat">
          <b>{count(checksRun)}</b>
          <span>checks run</span>
        </div>
      </div>
      <p className="small">
        Counts are read from this release&rsquo;s <span className="mono">release.json</span>. Coverage and check pass rates are reported separately on
        the <Link href="/methods">methods page</Link>.
      </p>

      <h2>Datasets</h2>
      <div className="grid">
        {datasetKeys().map((key) => {
          const ds = r.dataset_status[key];
          const isPublished = ds?.state === "published";
          const obs = byDataset[key] ?? {};
          const gapCount = Object.entries(obs)
            .filter(([k]) => k !== "published")
            .reduce((a, [, v]) => a + v, 0);
          return (
            <div key={key} className={`card ${isPublished ? "" : "card-coming"}`}>
              <h3>
                {isPublished ? <Link href={`/browse#${key}`}>{ds?.name ?? key}</Link> : (ds?.name ?? key)} <DatasetBadge state={ds?.state ?? "coming"} />
              </h3>
              {isPublished ? (
                <>
                  <p className="small">
                    {count(obs.published ?? 0)} checked values, {count(gapCount)} labelled gaps.
                  </p>
                  <p className="small">
                    Coverage of the printed tables: {pct(ds?.coverage?.coverage)}. Check pass rate: {pct(ds?.check_pass_rate?.pass_rate)}. These are two
                    different measures.
                  </p>
                </>
              ) : (
                <p className="small">
                  Coming. No values from this dataset are published in this release.
                  {ds?.reasons && ds.reasons.length > 0 ? ` Reason: ${ds.reasons.join("; ")}.` : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <h2>How to read this site</h2>
      <ul>
        <li>
          <span className="badge badge-checked" title={CHECKED_HELP}>
            <span aria-hidden="true">&#10003;</span> Checked
          </span>{" "}
          means the figure was read from the government page and passed at least one deterministic check, such as adding up to a printed total. It
          does not mean the figure is guaranteed to be free of error.
        </li>
        <li>
          Gaps always say which kind they are: <span className="badge badge-gap-source">{GAP_WORDS.not_in_source}</span>,{" "}
          <span className="badge badge-gap-pending">{GAP_WORDS.not_yet_verified}</span>, or{" "}
          <span className="badge badge-gap-failed">{GAP_WORDS.failed_checks}</span>.
        </li>
        <li>Every figure says what it is: a budget estimate, a revised estimate, or another kind.</li>
        <li>No language model writes a published number or decides whether it passes a check.</li>
      </ul>

      <Cite path="/" />
    </>
  );
}
