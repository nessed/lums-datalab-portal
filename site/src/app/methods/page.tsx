// Methods: the live quality numbers of this release, the pipeline, the
// statuses, the checks, the frozen thresholds, what language models did and
// did not do, then docs/METHODS.md in full.
import type { Metadata } from "next";
import Link from "next/link";
import Cite from "@/components/Cite";
import Markdown, { markdownHeadings } from "@/components/Markdown";
import { Bar, Breadcrumbs, Callout, TableWrap, Toc } from "@/components/ui/Basics";
import { StatusLegend } from "@/components/ui/Status";
import { datasetKeys, db, frozenThresholds, isDatasetPublished, methodsMarkdown, type PassRate } from "@/lib/data";
import { CHECK_TYPE_WORDS, pct } from "@/lib/format";
import { Count, Num } from "@/components/ui/Num";
import { datasetStateWords } from "@/lib/status";

export const metadata: Metadata = {
  title: "Methods",
  description: "How a figure gets from a government PDF onto this site: verification, extraction, arithmetic checks, statuses, thresholds, and the quality numbers of the current release.",
};

const STEPS = [
  { k: "Register", d: "Download from the official address; fingerprint; prove it is the right document" },
  { k: "Profile", d: "Text layer or scan; ruled or borderless tables" },
  { k: "Extract", d: "Docling reads the whole document; every run kept" },
  { k: "Validate", d: "Every page accounted for; damaged tables flagged" },
  { k: "Normalise", d: "Printed text kept verbatim beside the parsed value" },
  { k: "Check", d: "Sums, totals, second printings, recomputed rates" },
  { k: "Second reader", d: "Only for flagged tables, and only if every check passes on it" },
  { k: "Status", d: "Computed from the stored evidence, never assigned by hand or by a model" },
  { k: "Publish", d: "Frozen, versioned release; a receipt for every figure" },
];

const THRESHOLD_WORDS: Record<string, { label: string; fmt?: "pct" | "atLeastPct" | "atMostPct" }> = {
  "structure.pages_accounted_for": { label: "Pages accounted for in an extraction run", fmt: "pct" },
  "structure.min_text_layer_page_fraction": { label: "Printed pages with a text layer (file verification), at least", fmt: "atLeastPct" },
  "structure.max_scanned_page_fraction": { label: "Scanned pages, above which a file leaves the normal track", fmt: "atMostPct" },
  "coverage.min_per_data_type": { label: "Printed numbers captured, per dataset, at least", fmt: "atLeastPct" },
  "coverage.min_per_table": { label: "Printed numbers captured, any one table, at least", fmt: "atLeastPct" },
  "checks.min_evaluable_pass_rate_per_data_type": { label: "Checks passed, per dataset, at least", fmt: "atLeastPct" },
  "checks.min_cross_edition_agreement": { label: "Agreement between editions, per dataset, at least", fmt: "atLeastPct" },
  "gold_set.max_error_rate": { label: "Measured error rate on the hand-labelled gold set, at most (pending)", fmt: "atMostPct" },
  "gold_set.target_cells": { label: "Gold set size (cells labelled by hand)" },
  "tolerances.sum.exact": { label: "Sums: an exact match passes" },
  "tolerances.sum.rounding_units_per_member": { label: "Sums: allowed difference per item added, in units of the last printed digit (passes “within tolerance”)" },
  "tolerances.cross_edition_units_of_last_digit": { label: "Same figure in two editions: allowed difference, in units of the last printed digit" },
  "tolerances.cpi_weights_sum_abs": { label: "CPI basket weights: allowed difference of their sum from the printed total" },
  "tolerances.lfs_shares_sum_abs": { label: "LFS shares: allowed difference of their sum from the printed total" },
};

function fmtThreshold(v: string, fmt?: string): string {
  const n = Number(v);
  if (!fmt || !Number.isFinite(n)) return v;
  return `${fmt === "atLeastPct" ? "≥ " : fmt === "atMostPct" ? "≤ " : ""}${pct(n)}`;
}

function PassRow({ label, p, path }: { label: string; p: (PassRate & { disputed?: number }) | null | undefined; path: string }) {
  if (!p) {
    return (
      <tr>
        <th scope="row">{label}</th>
        <td colSpan={5} className="muted">
          Not measured
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="num">
        <Count k={`release:${path}.pass`} n={p.pass} />
      </td>
      <td className="num">
        <Count k={`release:${path}.pass_within_rounding`} n={p.pass_within_rounding} />
      </td>
      <td className="num">
        <Count k={`release:${path}.fail`} n={p.fail} />
      </td>
      <td className="num">{p.disputed !== undefined ? <Count k={`release:${path}.disputed`} n={p.disputed} /> : "none"}</td>
      <td>
        {p.pass_rate === null || p.pass_rate === undefined ? (
          <span className="muted">no checks of this kind</span>
        ) : (
          <Bar ratio={p.pass_rate} label={<Count k={`release:${path}.pass_rate`} n={p.pass_rate} rate />} />
        )}
      </td>
    </tr>
  );
}

export default function MethodsPage() {
  const d = db();
  const r = d.release;
  const keys = datasetKeys();
  const md = methodsMarkdown();
  const mdHeads = md ? markdownHeadings(md, 2) : [];
  const thresholds = frozenThresholds();
  const byType = (r.counts as { checks_by_type?: Record<string, Record<string, number>> } | undefined)?.checks_by_type ?? {};
  const tools = Object.entries(r.tool_versions ?? {});

  return (
    <div className="is-prose">
      <Breadcrumbs items={[{ label: "Methods" }]} />
      <header className="page-head">
        <h1>Methods</h1>
        <p className="lede">
          How a figure gets from a government PDF to a receipt on this site, what the checks are, and how well release <Num kind="version">{r.version}</Num> does by its own
          measures. Coverage and accuracy are separate questions with separate numbers; we never combine them.
        </p>
      </header>

      <div className="with-rail">
        <div className="prose-wide">
          <section id="quality" aria-labelledby="quality-h">
            <h2 id="quality-h">Quality numbers for this release</h2>
            <h3>Coverage: how much of the printed tables we captured</h3>
            <TableWrap label="Coverage by dataset">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Dataset</th>
                    <th scope="col">State</th>
                    <th scope="col" className="num">
                      Tables
                    </th>
                    <th scope="col" className="num">
                      Numbers printed
                    </th>
                    <th scope="col" className="num">
                      Captured
                    </th>
                    <th scope="col">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => {
                    const ds = r.dataset_status[k];
                    const c = ds?.coverage;
                    return (
                      <tr key={k}>
                        <th scope="row">{ds?.name ?? k}</th>
                        <td className="small">{datasetStateWords(ds?.state)}</td>
                        {c ? (
                          <>
                            <td className="num">{c.tables !== undefined ? <Count k={`release:dataset_status.${k}.coverage.tables`} n={c.tables} /> : ""}</td>
                            <td className="num">
                              <Count k={`release:dataset_status.${k}.coverage.printed_numeric_tokens`} n={c.printed_numeric_tokens} />
                            </td>
                            <td className="num">
                              <Count k={`release:dataset_status.${k}.coverage.matched`} n={c.matched} />
                            </td>
                            <td>
                              <Bar ratio={c.coverage} label={<Count k={`release:dataset_status.${k}.coverage.coverage`} n={c.coverage} rate />} />
                            </td>
                          </>
                        ) : (
                          <td colSpan={4} className="muted">
                            Not measured
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <h3>Checks: how much of what we captured is consistent</h3>
            <TableWrap label="Check results by dataset">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Dataset and checks</th>
                    <th scope="col" className="num">
                      Pass
                    </th>
                    <th scope="col" className="num">
                      Within tolerance
                    </th>
                    <th scope="col" className="num">
                      Fail
                    </th>
                    <th scope="col" className="num">
                      Printings disagree
                    </th>
                    <th scope="col">Pass rate</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.flatMap((k) => {
                    const ds = r.dataset_status[k];
                    return [
                      <PassRow key={`${k}-a`} label={`${ds?.name ?? k}: all checks`} p={ds?.check_pass_rate} path={`dataset_status.${k}.check_pass_rate`} />,
                      <PassRow key={`${k}-x`} label={`${ds?.name ?? k}: agreement between editions`} p={ds?.cross_edition_agreement} path={`dataset_status.${k}.cross_edition_agreement`} />,
                    ];
                  })}
                </tbody>
              </table>
            </TableWrap>
            <p className="small measure">
              &ldquo;Printings disagree&rdquo; counts pairs of official printings that differ while each adds up in its own table; those figures are shown
              as disputed. The agreement rate leaves them out; the overall pass rate counts them as not passed.
            </p>
            <div id="error-rate">
              <Callout kind="caveat" title="Measured error rate: pending">
                <p>
                  Passing checks is not the same as being right. The error rate will be measured on a sample of about <Num kind="threshold">{thresholds?.rows.find((t) => t.key === "target_cells")?.value ?? "400"}</Num> figures that two people
                  read from the page images by hand without seeing our values. That labelling has not been done
                  {r.gold_set?.status ? ` (status: ${r.gold_set.status.replaceAll("_", " ")})` : ""}, so no error rate is claimed for this release.
                </p>
              </Callout>
            </div>
          </section>

          <section id="pipeline" aria-labelledby="pipeline-h">
            <h2 id="pipeline-h">From the PDF to a receipt</h2>
            <ol className="pipeline">
              {STEPS.map((s, i) => (
                <li key={s.k}>
                  <span className="pl-n" data-num="ui">
                    {i + 1}
                  </span>
                  <span className="pl-k">{s.k}</span>
                  <span className="pl-d">{s.d}</span>
                </li>
              ))}
            </ol>
          </section>

          <section id="statuses" aria-labelledby="statuses-h">
            <h2 id="statuses-h">What the statuses mean</h2>
            <StatusLegend full />
            <p className="small measure">
              Behind &ldquo;checked&rdquo;, a receipt says which evidence it has: an arithmetic check (a sum, a total, a recomputed rate), a second
              official printing of the same figure, or both. Every status is computed by code from the stored evidence.
            </p>
          </section>

          <section id="checks" aria-labelledby="checks-h">
            <h2 id="checks-h">Checks run in this release</h2>
            <TableWrap label="Checks by type">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Check</th>
                    <th scope="col" className="num">
                      Run
                    </th>
                    <th scope="col" className="num">
                      Pass
                    </th>
                    <th scope="col" className="num">
                      Within tolerance
                    </th>
                    <th scope="col" className="num">
                      Other results
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byType).map(([t, res]) => {
                    const total = Object.values(res).reduce((a, b) => a + b, 0);
                    const other = Object.entries(res).filter(([k]) => k !== "pass" && k !== "pass_within_rounding");
                    return (
                      <tr key={t}>
                        <th scope="row">{CHECK_TYPE_WORDS[t] ?? t.replaceAll("_", " ")}</th>
                        <td className="num">
                          <Count k={`checktype:${t}:total`} n={total} />
                        </td>
                        <td className="num">{res.pass !== undefined ? <Count k={`release:counts.checks_by_type.${t}.pass`} n={res.pass} /> : "none"}</td>
                        <td className="num">
                          {res.pass_within_rounding !== undefined ? <Count k={`release:counts.checks_by_type.${t}.pass_within_rounding`} n={res.pass_within_rounding} /> : "none"}
                        </td>
                        <td className="small">
                          {other.length
                            ? other.map(([k2, n], i) => (
                                <span key={k2}>
                                  {i ? ", " : ""}
                                  <Count k={`release:counts.checks_by_type.${t}.${k2}`} n={n} /> {k2.replaceAll("_", " ")}
                                </span>
                              ))
                            : "none"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </section>

          <section id="thresholds" aria-labelledby="thresholds-h">
            <h2 id="thresholds-h">Thresholds, frozen before any result was seen</h2>
            {thresholds ? (
              <>
                <p className="small measure">
                  A dataset below any of these is not published (the site marks it &ldquo;coming&rdquo;). The file&rsquo;s fingerprint matches the
                  one recorded in this release (<Num kind="id" className="hash">{thresholds.sha256.slice(0, 16)}</Num>…). Changes after results are seen are
                  recorded as deviations, never made silently.
                </p>
                <TableWrap label="Frozen thresholds">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Threshold</th>
                        <th scope="col" className="num">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {thresholds.rows
                        .filter((t) => t.section && t.section !== "publication" && !["version", "frozen_on"].includes(t.key))
                        .map((t) => {
                          const w = THRESHOLD_WORDS[`${t.section}.${t.key}`];
                          return (
                            <tr key={`${t.section}.${t.key}`}>
                              <th scope="row" style={{ fontWeight: 500 }}>
                                {w?.label ?? `${t.section.replaceAll("_", " ")}: ${t.key.replaceAll("_", " ")}`}
                                {!w && t.comment ? (
                                  <span className="cell-sub" data-num="md" data-file="repo:thresholds/thresholds.yaml">
                                    {t.comment}
                                  </span>
                                ) : null}
                              </th>
                              <td className="num">
                                <Num kind="threshold">{t.key === "exact" ? "residual 0" : fmtThreshold(t.value, w?.fmt)}</Num>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </TableWrap>
              </>
            ) : (
              <p className="measure">The threshold values are not available for this release (their fingerprint is <Num kind="id">{r.thresholds_sha256 ?? "not recorded"}</Num>).</p>
            )}
          </section>

          <section id="llm" aria-labelledby="llm-h">
            <h2 id="llm-h">What language models did, and did not do</h2>
            <div className="two-col measure-wide">
              <div>
                <h3>Never</h3>
                <ul>
                  <li>Read a number from a page or table for the dataset.</li>
                  <li>Write or change any published value.</li>
                  <li>Decide whether a figure passes a check, or assign a status.</li>
                  <li>Read values off a chart.</li>
                  <li>Label the gold set used to measure the error rate.</li>
                </ul>
              </div>
              <div>
                <h3>Did, under review</h3>
                <ul>
                  <li>Wrote and reviewed the pipeline and site code, under human direction.</li>
                  <li>Drafted plain-language series definitions and search synonyms, marked &ldquo;draft&rdquo; until a person edits them.</li>
                  <li>Wrote the dictionary that maps printed row labels to series (a choice of category, never a number); every mapping is then tested by the arithmetic checks.</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="built" aria-labelledby="built-h">
            <h2 id="built-h">What this release was built with</h2>
            <dl className="facts">
              <dt>Release</dt>
              <dd>
                <Link href="/releases">
                  <Num kind="version">{r.version}</Num>
                </Link>{" "}
                ({r.label}), built <Num kind="id">{r.created_at}</Num>
              </dd>
              <dt>Code commit</dt>
              <dd className="mono">
                <Num kind="id">{r.git_commit}</Num>
              </dd>
              {tools.length > 0 ? (
                <>
                  <dt>Tool versions</dt>
                  <dd className="small">
                    <Num kind="id">{tools.map(([k, v]) => `${k} ${v}`).join(" · ")}</Num>
                  </dd>
                </>
              ) : null}
              <dt>Reproduce it</dt>
              <dd>
                <Link href="/releases#reproduce">Step-by-step instructions</Link> rebuild this release from the raw sources and confirm every file
                fingerprint.
              </dd>
            </dl>
          </section>

          <section id="full" aria-labelledby="full-h" className="prose">
            <h2 id="full-h">The method in full</h2>
            {md ? (
              <div data-num="md" data-file="repo:docs/METHODS.md">
                <Markdown source={md.replace(/^# .*\n/, "")} headingOffset={1} />
              </div>
            ) : (
              <p>The full methods document is not included in this build.</p>
            )}
          </section>

          <section id="cite" aria-labelledby="cite-h">
            <h2 id="cite-h">Cite this page</h2>
            <Cite path="/methods" heading={false} />
          </section>
        </div>
        <aside className="rail">
          <Toc
            items={[
              { id: "quality", label: "Quality numbers" },
              { id: "pipeline", label: "From the PDF to a receipt" },
              { id: "statuses", label: "Statuses" },
              { id: "checks", label: "Checks run" },
              { id: "thresholds", label: "Thresholds" },
              { id: "llm", label: "Language models" },
              { id: "built", label: "Built with" },
              { id: "full", label: "The method in full" },
              ...mdHeads.map((h) => ({ id: h.id, label: h.label, sub: true })),
            ]}
          />
          <p className="small muted" style={{ marginTop: 16 }}>
            <Count k="datasets:published" n={keys.filter(isDatasetPublished).length} /> of <Count k="datasets:all" n={keys.length} /> datasets published in this
            release.
          </p>
        </aside>
      </div>
    </div>
  );
}
