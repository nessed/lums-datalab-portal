// Data and downloads (DESIGN.md 13): the whole release and each data type as
// Excel, CSV and a data package, with their sizes; what every column means;
// stable addresses for scripts and spreadsheets; release-pinned and latest
// links; the raw release files; how to load and cite. Every file listed here is
// written at build time from the release (scripts/prebuild/take.mjs).
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import fs from "node:fs";
import path from "node:path";
import { Breadcrumbs, TableWrap, Toc } from "@/components/ui/Basics";
import Code from "@/components/ui/Code";
import Cite from "@/components/Cite";
import { Num } from "@/components/ui/Num";
import { ActionBar, CiteButton, CompareButton, DownloadButton, PinnedLine, ShareButton } from "@/components/actions/Actions";
import { DATA_BASE, datasetName, db, isDatasetPublished, obsHref, publishedObs, RELEASE_VERSION, releaseFileExists, REPO_URL, seriesHref, slugify } from "@/lib/data";
import { LONG_COLUMNS, VERSION_FILES } from "@/lib/take-columns";
import { fileHref, fileSize, latestFileHref, pinnedPath, sizeText } from "@/lib/take";

export const metadata: Metadata = {
  title: "Data and downloads",
  description: "The whole release, each data type and each series as Excel, CSV or a data package, with sizes; column meanings; stable addresses; how to load and cite.",
};

const RAW: { file: string; what: string }[] = [
  { file: "observations.csv", what: "Every figure in the pipeline's own layout, with tier and gap codes." },
  { file: "observations.parquet", what: "The same as a Parquet file." },
  { file: "series.json", what: "What each series measures: name, unit, scale, frequency, dimensions, definition, breaks, parent." },
  { file: "cells.csv", what: "Every printed number read from a page: document, page, box on the page, the text as printed, the row and column labels as printed." },
  { file: "checks.json", what: "Every arithmetic and cross-edition check: the rule, the cells it used, the result and the residual." },
  { file: "sources.json", what: "Every source document: where it came from, its SHA-256 fingerprint and its verification record." },
  { file: "coverage.json", what: "For each table read: how many printed numbers there were and how many were captured." },
  { file: "release.json", what: "The release record: version, counts, coverage and pass rates, thresholds fingerprint, tool versions." },
  { file: "dataset_card.md", what: "A short description of the release for people: scope, status mix, known limitations." },
  { file: "HOW_TO_REPRODUCE.md", what: "How to rebuild this release from the raw sources and confirm every fingerprint." },
  { file: "CHANGELOG.md", what: "What changed in each release." },
  { file: "ERRATA.md", what: "Corrections to published figures." },
];

const FORMATS = [
  { ext: "xlsx", label: "Excel (.xlsx)" },
  { ext: "csv", label: "CSV, long" },
  { ext: "zip", label: "Data package (.zip)" },
] as const;

function rawSize(file: string): number | null {
  const p = path.resolve(process.cwd(), "..", "releases", RELEASE_VERSION, file);
  return fs.existsSync(p) ? fs.statSync(p).size : null;
}

function FileRow({ stem }: { stem: string }) {
  return (
    <div className="take-row">
      {FORMATS.map((f) => {
        const rel = `${stem}.${f.ext}`;
        const n = fileSize(rel);
        if (n === null) return null;
        return (
          <a key={f.ext} href={fileHref(rel)} download>
            {f.label}{" "}
            <span className="dl-size">
              <Num kind="ui">{sizeText(n)}</Num>
            </span>
          </a>
        );
      })}
    </div>
  );
}

export default function DataPage() {
  const d = db();
  const datasets = Object.keys(d.release.dataset_status ?? {}).filter(isDatasetPublished);
  const example = d.seriesById.get("fed.exp.current.function.health") ?? d.series.find((s) => publishedObs(s.series_id).length > 0);
  const exSlug = example ? slugify(example.series_id) : "fed.exp.current.function.health";
  const exObs = example ? publishedObs(example.series_id)[0] : undefined;
  const exLatest = example ? publishedObs(example.series_id).at(-1) : undefined;
  const sid = example?.series_id ?? "fed.exp.current.function.health";
  const latestAll = `{{ORIGIN}}${latestFileHref("all.csv")}`;
  const latestSeries = `{{ORIGIN}}${latestFileHref(`series/${exSlug}.csv`)}`;
  const py = `import pandas as pd

url = "${latestAll}"
# Keep values as text: they are exact decimals. A figure without a value
# (held back, disputed, not printed...) has an empty value and its status.
obs = pd.read_csv(url, dtype={"value": str, "value_as_printed": str, "period": str})

s = obs[obs.series_id == "${sid}"]
print(s[["period", "kind", "value", "unit", "status", "printed_in", "page"]])`;
  const r = `library(readr)
library(dplyr)

url <- "${latestAll}"
# Keep values as text: they are exact decimals. A figure without a value
# (held back, disputed, not printed...) has an empty value and its status.
obs <- read_csv(url, col_types = cols(.default = col_character()))

s <- obs |>
  filter(series_id == "${sid}") |>
  mutate(value_num = as.numeric(value))
s |> select(period, kind, value, unit, status, printed_in, page)`;
  const sheets = `=IMPORTDATA("${latestSeries}")`;

  return (
    <div className="is-prose">
      <Breadcrumbs items={[{ label: "Data and downloads" }]} />
      <PinnedLine />
      <header className="page-head">
        <h1>Data and downloads</h1>
        <p className="lede">
          Every figure on this site, as Excel, CSV or a data package, from release <Num kind="version">{RELEASE_VERSION}</Num>. Each file says what it is, which release it
          comes from, how to cite it and where to check that it is still current.
        </p>
      </header>
      {d.info.isPrototype ? (
        <p className="cite-proto">
          <strong>Prototype release.</strong> Not yet for citation in publications; no DOI. Data CC BY 4.0. Values are exact decimals: read them as text and convert
          deliberately.
        </p>
      ) : null}

      <div className="with-rail">
        <div className="measure-wide">
          <section id="files" aria-labelledby="files-h">
            <h2 id="files-h">Download</h2>
            <div className="take-files">
              <div className="take-group take-group--wide">
                <h3>The whole release</h3>
                <p className="small muted">Every series of every published data type, every period and kind of figure, one row each.</p>
                <FileRow stem="all" />
              </div>
              {datasets.map((ds) => (
                <div key={ds} className="take-group">
                  <h3>{datasetName(ds)}</h3>
                  <FileRow stem={`datasets/${ds}`} />
                </div>
              ))}
            </div>
            <dl className="facts">
              <dt>Excel (.xlsx)</dt>
              <dd>A Data sheet (one row per figure), a README sheet (what the file is, the release, the date it was made, the licence, the statuses and every column), a Sources sheet (each document, its official address and fingerprint) and a Citation sheet.</dd>
              <dt>CSV, long</dt>
              <dd>One row per figure. Status is always its own column. A figure that has not passed its checks is a row with an empty value and its status, never a missing row and never a zero.</dd>
              <dt>Data package (.zip)</dt>
              <dd>
                The CSV with <code>datapackage.json</code> (a Frictionless Data description of every column), a README, the licence and <code>CITATION.cff</code>.
              </dd>
              <dt>One series</dt>
              <dd>
                The Download button on every series page gives the same three files for that series, and, where its figures are printed in more than one edition, four more:{" "}
                {VERSION_FILES.map((v) => v.label.toLowerCase()).join(", ")}.
              </dd>
            </dl>
            <p className="small">
              Every file carries the release id, the date it was generated, the licence (CC BY 4.0), the citation and an &ldquo;Is this file still current?&rdquo; link to the{" "}
              <Link href="/releases">releases page</Link>, which lists every correction made since.
            </p>
          </section>

          {example ? (
            <section id="one" aria-labelledby="one-h">
              <h2 id="one-h">One series or one figure</h2>
              <p className="measure">
                Every series page and every receipt has these buttons. For example, <Link href={seriesHref(example.series_id)}>{example.name}</Link>:
              </p>
              <ActionBar label="Actions for one series">
                <DownloadButton seriesId={example.series_id} />
                <CiteButton path={seriesHref(example.series_id)} />
                <CompareButton seriesId={example.series_id} />
                <ShareButton path={seriesHref(example.series_id)} />
              </ActionBar>
              {exLatest ? (
                <>
                  <p className="small">
                    And one figure of it, <Link href={obsHref(exLatest.obs_id)}>its newest checked figure</Link>, cited with its document, page and kind of figure:
                  </p>
                  <ActionBar label="Actions for one figure">
                    <CiteButton path={obsHref(exLatest.obs_id)} />
                    <ShareButton path={obsHref(exLatest.obs_id)} />
                  </ActionBar>
                </>
              ) : null}
            </section>
          ) : null}

          <section id="stable" aria-labelledby="stable-h">
            <h2 id="stable-h">Stable addresses for scripts and spreadsheets</h2>
            <dl className="facts">
              <dt>Always the latest</dt>
              <dd>
                <code data-num="id">{latestFileHref("<file>")}</code>, for example <code data-num="id">{latestFileHref(`series/${exSlug}.csv`)}</code>. A script or spreadsheet
                that reads it gets the newest release.
              </dd>
              <dt>This release only</dt>
              <dd>
                <code data-num="id">{fileHref("<file>")}</code>. Its numbers never change.
              </dd>
            </dl>
            <p className="small">In Google Sheets, paste this into a cell to load a series and keep it up to date:</p>
            <Code label="Google Sheets" code={sheets} />
          </section>

          <section id="columns" aria-labelledby="columns-h">
            <h2 id="columns-h">Columns of the CSV and the Data sheet</h2>
            <dl className="facts">
              {LONG_COLUMNS.map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt className="mono">
                    <Num kind="id">{k}</Num>
                  </dt>
                  {/* Typed explanations with example digits (a period format, a scale), not figures. */}
                  <dd>{/\d/.test(v) ? <Num kind="ui">{v}</Num> : v}</dd>
                </div>
              ))}
            </dl>
            <p className="small">The version files of a multi-printing series:</p>
            <dl className="facts">
              {VERSION_FILES.map((v) => (
                <div key={v.key} style={{ display: "contents" }}>
                  <dt>{v.label}</dt>
                  <dd>{v.what}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="load" aria-labelledby="load-h">
            <h2 id="load-h">Load it</h2>
            <Code label="Python (pandas)" code={py} />
            <Code label="R (readr, dplyr)" code={r} />
          </section>

          <section id="links" aria-labelledby="links-h">
            <h2 id="links-h">Links</h2>
            <p className="measure">
              Everything citable has two addresses. <strong>This release</strong> starts with the release id and will keep showing these numbers; <strong>always the latest</strong>{" "}
              is the ordinary address and follows new releases. Cite uses the first; Share offers both.
            </p>
            <dl className="facts">
              <dt>A figure</dt>
              <dd>
                <code data-num="id">{pinnedPath("/o/<obs_id>")}</code> (this release) or <code>/o/&lt;obs_id&gt;</code> (latest), with the colons written as <code>~</code>
                {exObs ? (
                  <>
                    , for example{" "}
                    <a href={pinnedPath(`/o/${slugify(exObs.obs_id)}`)}>
                      <Num kind="id">{pinnedPath(`/o/${slugify(exObs.obs_id)}`)}</Num>
                    </a>
                  </>
                ) : null}
              </dd>
              <dt>A series</dt>
              <dd>
                <code data-num="id">{pinnedPath("/series/<series_id>")}</code>; chart settings stay in the address.
              </dd>
              <dt>A comparison</dt>
              <dd>
                <code data-num="id">{pinnedPath("/compare?s=<id>,<id>&show=index&base=<period>")}</code>
              </dd>
              <dt>A figure as data</dt>
              <dd>
                <code data-num="id">{`${DATA_BASE}/receipts/<obs_id>.json`}</code>: the figure, its cells with page boxes, its checks and its documents.
              </dd>
            </dl>
            <p className="small measure">
              Only this release&rsquo;s id is served; any other release id in an address answers &ldquo;not found&rdquo;. When a later release ships, this one&rsquo;s build stays
              online under its id.
            </p>
          </section>

          <section id="raw" aria-labelledby="raw-h">
            <h2 id="raw-h">The release as the pipeline wrote it</h2>
            <TableWrap label="Release files">
              <table>
                <thead>
                  <tr>
                    <th scope="col">File</th>
                    <th scope="col">What it holds</th>
                    <th scope="col" className="num">
                      Size
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {RAW.filter((f) => releaseFileExists(f.file)).map((f) => (
                    <tr key={f.file}>
                      <th scope="row">
                        <a href={`${DATA_BASE}/${f.file}`} download className="mono nowrap">
                          {f.file}
                        </a>
                      </th>
                      <td className="small">{f.what}</td>
                      <td className="num small">
                        <Num kind="ui">{sizeText(rawSize(f.file))}</Num>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <p className="small">
              The full data model is in <a href={`${REPO_URL}/blob/proto/v0/docs/SCHEMA.md`}>docs/SCHEMA.md</a> in the repository.
            </p>
          </section>

          <section id="cite" aria-labelledby="cite-h">
            <h2 id="cite-h">How to cite</h2>
            <p className="measure">
              Cite the government document named in each row as well as the release: every receipt and series page has a Cite button that gives both, with the page and the
              kind of figure. For the whole release:
            </p>
            <Cite path="/data" what={`Release ${RELEASE_VERSION}`} heading={false} />
          </section>
        </div>
        <aside className="rail">
          <Toc
            items={[
              { id: "files", label: "Download" },
              { id: "one", label: "One series or figure" },
              { id: "stable", label: "Stable addresses" },
              { id: "columns", label: "Columns" },
              { id: "load", label: "Load it" },
              { id: "links", label: "Links" },
              { id: "raw", label: "Pipeline files" },
              { id: "cite", label: "How to cite" },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
