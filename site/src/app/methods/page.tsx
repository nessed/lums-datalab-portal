import type { Metadata } from "next";
import Link from "next/link";
import { DatasetBadge } from "@/components/Badges";
import Cite from "@/components/Cite";
import Markdown from "@/components/Markdown";
import { datasetKeys, db, methodsMarkdown, type PassRate } from "@/lib/data";
import { count, pct } from "@/lib/format";

export const metadata: Metadata = { title: "Methods" };

function passCells(p: PassRate | null | undefined) {
  if (!p) {
    return (
      <td colSpan={5} className="muted">
        Not available yet
      </td>
    );
  }
  return (
    <>
      <td className="num">{count(p.pass)}</td>
      <td className="num">{count(p.pass_within_rounding)}</td>
      <td className="num">{count(p.fail)}</td>
      <td className="num">{count(p.not_evaluable)}</td>
      <td className="num">{p.pass_rate === null || p.pass_rate === undefined ? "no checks of this kind yet" : pct(p.pass_rate)}</td>
    </>
  );
}

export default function MethodsPage() {
  const d = db();
  const r = d.release;
  const md = methodsMarkdown();
  const keys = datasetKeys();
  const tools = Object.entries(r.tool_versions ?? {});
  return (
    <>
      <h1>Methods</h1>
      <p className="lede">How figures get from a government PDF onto this site, and the live quality numbers for this release.</p>

      <h2>Quality numbers for release {r.version}</h2>
      <p>
        Two different questions are answered by two different numbers, and we never combine them. <strong>Coverage</strong> asks: of the numbers
        printed in the tables we read, how many did we capture? <strong>Check pass rate</strong> asks: of the checks we could run on what we
        captured, how many passed?
      </p>

      <h3>Coverage (how much of the printed tables we captured)</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Dataset</th>
              <th scope="col">State</th>
              <th scope="col" className="num">
                Tables measured
              </th>
              <th scope="col" className="num">
                Numbers printed
              </th>
              <th scope="col" className="num">
                Captured
              </th>
              <th scope="col" className="num">
                Coverage
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const ds = r.dataset_status[k];
              const c = ds?.coverage;
              return (
                <tr key={k}>
                  <th scope="row">{ds?.name ?? k}</th>
                  <td>
                    <DatasetBadge state={ds?.state ?? "coming"} />
                  </td>
                  {c ? (
                    <>
                      <td className="num">{c.tables !== undefined ? count(c.tables) : "not recorded"}</td>
                      <td className="num">{count(c.printed_numeric_tokens)}</td>
                      <td className="num">{count(c.matched)}</td>
                      <td className="num">{pct(c.coverage)}</td>
                    </>
                  ) : (
                    <td colSpan={4} className="muted">
                      Not measured yet
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Check pass rate (how much of what we captured passes its checks)</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Dataset</th>
              <th scope="col">Checks</th>
              <th scope="col" className="num">
                Pass
              </th>
              <th scope="col" className="num">
                Pass, within rounding
              </th>
              <th scope="col" className="num">
                Fail
              </th>
              <th scope="col" className="num">
                Could not run
              </th>
              <th scope="col" className="num">
                Pass rate
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.flatMap((k) => {
              const ds = r.dataset_status[k];
              return [
                <tr key={`${k}-all`}>
                  <th scope="row">{ds?.name ?? k}</th>
                  <td>All checks</td>
                  {passCells(ds?.check_pass_rate)}
                </tr>,
                <tr key={`${k}-x`}>
                  <th scope="row">{ds?.name ?? k}</th>
                  <td>Agreement between editions</td>
                  {passCells(ds?.cross_edition_agreement)}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>

      <h3>Measured error rate</h3>
      <div className="notice">
        <p>
          <strong>Measured error rate: pending gold-set labelling.</strong> Passing checks is not the same as being right. The error rate will be
          measured against a sample of figures that two people read from the pages by hand, without seeing our values. That labelling has not been
          done yet
          {r.gold_set?.status ? (
            <>
              {" "}
              (status in this release: <span className="mono">{r.gold_set.status}</span>)
            </>
          ) : null}
          .
        </p>
      </div>

      <h3>What this release was built with</h3>
      <dl className="facts">
        <dt>Release</dt>
        <dd>
          <span className="mono">{r.version}</span> ({r.label}), built {r.created_at}
        </dd>
        <dt>Code commit</dt>
        <dd className="mono small">{r.git_commit}</dd>
        {r.thresholds_sha256 && (
          <>
            <dt>Frozen thresholds fingerprint</dt>
            <dd className="mono small">{r.thresholds_sha256}</dd>
          </>
        )}
        {tools.length > 0 && (
          <>
            <dt>Tool versions</dt>
            <dd className="small">{tools.map(([k, v]) => `${k} ${v}`).join("; ")}</dd>
          </>
        )}
      </dl>
      <p className="small">
        To rebuild this release from the raw sources, see <Link href="/releases#reproduce">how to reproduce</Link>.
      </p>

      <h2>The method in full</h2>
      {md ? (
        <Markdown source={md} headingOffset={2} />
      ) : (
        <div className="notice notice-plain">
          <p>
            The full methods document is being written. Until it is published here, the <Link href="/releases#dataset-card">dataset card</Link>{" "}
            describes the scope, the status tiers and the known limitations of this release.
          </p>
        </div>
      )}

      <Cite path="/methods" />
    </>
  );
}
