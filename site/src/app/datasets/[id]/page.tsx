// One page per data type: what it covers, its main series, the caveats that
// apply to all of it, its quality as three separate numbers against their
// frozen thresholds, its gaps and disputes, and its tables as printed.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KindAndPeriod } from "@/components/Figure";
import Spark from "@/components/Spark";
import { Breadcrumbs, DownloadLink } from "@/components/ui/Basics";
import { Count, Num, V } from "@/components/ui/Num";
import { DATA_BASE, datasetName, db, frozenThresholds, isDatasetPublished, obsHref, publishedObs, seriesCsvHref, seriesHref, sourceHref } from "@/lib/data";
import { COMING, isOn } from "@/lib/features";
import { GAP_WORDS, pct, periodWords } from "@/lib/format";
import { datasetStats, latestPublished, publishedDatasets } from "@/lib/stats";
import { tablesOfSource } from "@/lib/tables";

export const dynamicParams = false;

export function generateStaticParams() {
  return publishedDatasets().map((id) => ({ id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: datasetName(id), description: `${datasetName(id)}: series, quality numbers, gaps and the tables as printed, from the current release.` };
}

const DOC_WORD: Record<string, string> = { fiscal_year: "editions", month: "issues", survey_round: "reports" };
const PERIOD_WORD: Record<string, string> = { fiscal_year: "fiscal years", month: "months", survey_round: "survey rounds" };
const GAP_ORDER = ["not_in_source", "not_yet_verified", "failed_checks", "disputed"];

function threshold(section: string, key: string): number | null {
  const t = frozenThresholds();
  const row = t?.rows.find((r) => r.section === section && r.key === key);
  return row && Number.isFinite(Number(row.value)) ? Number(row.value) : null;
}

function Quality({ title, what, ratio, k, detail, th }: { title: string; what: string; ratio: number | null | undefined; k: string; detail: React.ReactNode; th: number | null }) {
  const meets = th !== null && ratio !== null && ratio !== undefined ? ratio >= th : null;
  return (
    <div className="q-box">
      <h3>{title}</h3>
      <p className="q-what">{what}</p>
      <p className="q-v">
        <Count k={k} n={ratio} rate />
      </p>
      <p className="q-detail">{detail}</p>
      <p className="q-th">
        {th !== null ? (
          <>
            Frozen minimum <Num kind="threshold">{pct(th)}</Num>: {meets ? "meets it" : "below it"}
          </>
        ) : (
          "Threshold not available for this release"
        )}
      </p>
    </div>
  );
}

export default async function DatasetPage({ params }: Props) {
  const { id } = await params;
  if (!isDatasetPublished(id)) notFound();
  const d = db();
  const ds = d.release.dataset_status[id];
  const st = datasetStats(id);
  const all = d.series.filter((s) => s.dataset === id);
  const roots = (d.childrenOf.get("") ?? []).filter((s) => s.dataset === id && !s.derived && publishedObs(s.series_id).length > 0);
  const main = roots.slice(0, 10);
  const docWord = DOC_WORD[st.frequency ?? ""] ?? "documents";
  const first = st.periods[0];
  const last = st.periods[st.periods.length - 1];
  const breaks = [...new Map(all.flatMap((s) => s.breaks.map((b) => [`${b.at_period}|${b.kind}|${b.note}`, { ...b, freq: s.frequency }]))).values()];
  const notes = [...new Set(all.map((s) => s.notes).filter((n): n is string => !!n && !!n.trim()))];
  const disputed = d.observations.filter((o) => o.status === "disputed" && d.seriesById.get(o.series_id)?.dataset === id);
  const cov = ds?.coverage;
  const pr = ds?.check_pass_rate;
  const ce = ds?.cross_edition_agreement;
  const disputes = (ds as unknown as { disputes?: { cross_edition_pairs?: number; disputed?: number } })?.disputes;

  return (
    <article className="dataset-page">
      <Breadcrumbs items={[{ href: "/browse", label: "Data" }, { href: "/datasets", label: "Data types" }, { label: datasetName(id) }]} />
      <header className="ds-head">
        <div>
          <h1>{datasetName(id)}</h1>
          <p className="muted">
            {st.publisher ? `Published by ${st.publisher}` : null} · <Count k={`docs:${id}`} n={st.docs.length} /> {docWord}
            {first ? (
              <>
                , {PERIOD_WORD[st.frequency ?? ""] ?? "periods"} <Num kind="period">{periodWords(first, st.frequency)}</Num> to{" "}
                <Num kind="period">{periodWords(last, st.frequency)}</Num>
              </>
            ) : null}{" "}
            · <a href="#tables">the tables as printed</a>
          </p>
        </div>
        <div className="ds-actions">
          <DownloadLink href={`${DATA_BASE}/datasets/${id}.csv`} className="btn btn-primary">
            Download this data type (CSV)
          </DownloadLink>
          <Link className="btn" href={`/browse?dataset=${id}`}>
            Browse its series
          </Link>
        </div>
      </header>

      <dl className="stat-strip">
        <div>
          <dt>series</dt>
          <dd>
            <Count k={`series:${id}`} n={st.series} />
          </dd>
        </div>
        <div>
          <dt>checked values</dt>
          <dd>
            <Count k={`values:${id}`} n={st.values} />
          </dd>
        </div>
        <div>
          <dt>labelled gaps (by kind below)</dt>
          <dd>
            <Count k={`gaps:${id}`} n={st.gapTotal} />
          </dd>
        </div>
        <div>
          <dt>disputed figures</dt>
          <dd>
            <Count k={`gaps:${id}:disputed`} n={st.disputed} />
          </dd>
        </div>
      </dl>

      <div className="ds-grid">
        <section aria-labelledby="main-h">
          <h2 id="main-h">Main series</h2>
          <ul className="ds-series">
            {main.map((s) => {
              const o = latestPublished(s.series_id);
              return (
                <li key={s.series_id}>
                  <Link href={seriesHref(s.series_id)} className="ds-s-name">
                    {s.name}
                  </Link>
                  <span className="ds-s-v">
                    {o ? (
                      <>
                        <V o={o} />
                        <span className="rel-k">
                          <KindAndPeriod o={o} series={s} short />
                        </span>
                      </>
                    ) : null}
                  </span>
                  <Spark series={s} width={84} height={26} />
                  <a href={seriesCsvHref(s.series_id)} download className="ds-s-dl" aria-label={`Download ${s.name} as CSV`}>
                    CSV
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="small">
            <Link href={`/browse?dataset=${id}`}>
              All <Count k={`series:${id}`} n={st.series} /> series of this data type
            </Link>
          </p>
        </section>
        {breaks.length || notes.length ? (
          <aside className="callout callout--caveat ds-read" aria-labelledby="read-h">
            <p className="callout-title" id="read-h">
              Read before using
            </p>
            <ul className="caveat-list">
              {breaks.map((b) => (
                <li key={`${b.at_period}${b.kind}`}>
                  <strong>
                    Series break from <Num kind="period">{periodWords(b.at_period, b.freq)}</Num> ({b.kind.replaceAll("_", " ")}):
                  </strong>{" "}
                  {b.note}
                </li>
              ))}
              {notes.slice(0, 6).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="small muted">Every distinct break and series note in this data type, read from the release.</p>
          </aside>
        ) : null}
      </div>

      <section id="quality" aria-labelledby="quality-h">
        <h2 id="quality-h">Quality, measured separately</h2>
        <p className="small muted">Three different questions, never combined into one score. The thresholds were frozen before any result was seen.</p>
        <div className="q-grid">
          <Quality
            title="Coverage"
            what="How much of each printed table was captured"
            ratio={cov?.coverage}
            k={`release:dataset_status.${id}.coverage.coverage`}
            th={threshold("coverage", "min_per_data_type")}
            detail={
              <>
                <Count k={`release:dataset_status.${id}.coverage.matched`} n={cov?.matched} /> of{" "}
                <Count k={`release:dataset_status.${id}.coverage.printed_numeric_tokens`} n={cov?.printed_numeric_tokens} /> printed numbers, over{" "}
                <Count k={`release:dataset_status.${id}.coverage.tables`} n={cov?.tables} /> tables
              </>
            }
          />
          <Quality
            title="Checks passed"
            what="Evidence that what was captured is right"
            ratio={pr?.pass_rate}
            k={`release:dataset_status.${id}.check_pass_rate.pass_rate`}
            th={threshold("checks", "min_evaluable_pass_rate_per_data_type")}
            detail={
              <>
                of <Count k={`release:dataset_status.${id}.check_pass_rate.evaluable`} n={pr?.evaluable} /> checks that could run
              </>
            }
          />
          <Quality
            title="Cross-edition agreement"
            what="The same figure printed in two editions"
            ratio={ce?.pass_rate}
            k={`release:dataset_status.${id}.cross_edition_agreement.pass_rate`}
            th={threshold("checks", "min_cross_edition_agreement")}
            detail={
              <>
                <Count k={`release:dataset_status.${id}.cross_edition_agreement.evaluable`} n={ce?.evaluable} /> pairs compared
                {disputes?.disputed !== undefined ? (
                  <>
                    , <Count k={`release:dataset_status.${id}.disputes.disputed`} n={disputes.disputed} /> disputed
                  </>
                ) : null}
              </>
            }
          />
        </div>
        <p>
          Measured error rate: <strong>Pending</strong>. It needs the hand-labelled gold set. <Link href="/methods#quality">How each number is measured</Link>
        </p>
      </section>

      <div className="ds-two">
        <section aria-labelledby="gaps-h">
          <h2 id="gaps-h">Gaps and disputes</h2>
          <div className="table-wrap" role="region" aria-label="Gaps by kind" tabIndex={0}>
            <table>
              <tbody>
                {GAP_ORDER.filter((k) => st.gaps[k]).map((k) => (
                  <tr key={k}>
                    <th scope="row">{k === "disputed" ? "Disputed: official printings disagree" : (GAP_WORDS[k] ?? k)}</th>
                    <td className="num">
                      <Count k={`gaps:${id}:${k}`} n={st.gaps[k]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {disputed.length ? (
            <>
              <h3>Every disputed figure</h3>
              <ul className="ds-disputed">
                {disputed.map((o) => {
                  const s = d.seriesById.get(o.series_id)!;
                  return (
                    <li key={o.obs_id}>
                      <Link href={obsHref(o.obs_id)}>
                        {s.name}, <KindAndPeriod o={o} series={s} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </section>
        <section id="tables" aria-labelledby="tables-h">
          <h2 id="tables-h">Tables as printed, by {docWord.replace(/s$/, "")}</h2>
          <p className="small muted">Each table drawn as the government printed it. Select any number to see where it sits on the page.</p>
          <ul className="ds-docs">
            {st.docs.map((sid) => {
              const src = d.sourceById.get(sid);
              const ts = tablesOfSource(sid);
              return (
                <li key={sid}>
                  <Link href={sourceHref(sid)} className="ds-doc">
                    {src?.title ?? sid}
                  </Link>
                  <span className="ds-tables">
                    {ts.map((t, i) => (
                      <span key={t.slug}>
                        {i ? " · " : ""}
                        <Link href={`/tables/${t.slug}`}>
                          {t.title}, <Num kind="page">p. {t.pageLabel ?? t.page}</Num>
                        </Link>
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <p className="coming ds-coming">
        {id === "abs" ? `Provincial budgets and district figures: ${COMING}` : null}
        {id === "cpi" && !isOn("monthlyData") ? `This release holds the June issue of each year. Every month: ${COMING}` : null}
        {id === "lfs" ? `Maps of the provinces and district figures: ${COMING}` : null}
      </p>
    </article>
  );
}
