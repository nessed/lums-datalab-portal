// Data access: what a release contains, what each column means, how to load
// it, the permalink and receipt patterns, and how to cite.
import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { Breadcrumbs, Callout, TableWrap, Toc } from "@/components/ui/Basics";
import Code from "@/components/ui/Code";
import { DATA_BASE, db, publishedObs, RELEASE_VERSION, releaseFileExists, REPO_URL, slugify } from "@/lib/data";

export const metadata: Metadata = {
  title: "Data access",
  description: "Download a release: file layout, column meanings, Python and R snippets, permalinks, JSON receipts and how to cite.",
};

const FILES: { file: string; what: string }[] = [
  { file: "observations.csv", what: "Every figure: one row per series, period and estimate type, with status, gap reason and provenance columns. Start here." },
  { file: "observations.parquet", what: "The same as a Parquet file. Numeric columns named *_num are floats for convenience; the value column stays a decimal string." },
  { file: "observations.json", what: "The same as JSON, with the lists (check ids, supporting cells, disputed readings) as arrays." },
  { file: "series.json", what: "What each series measures: name, unit, scale, frequency, dimensions, definition, breaks, parent." },
  { file: "cells.csv", what: "Every printed number read from a page: document, page, box on the page, the text as printed, the row and column labels as printed." },
  { file: "cells.json", what: "The same as JSON." },
  { file: "checks.json", what: "Every arithmetic and cross-edition check: the rule, the cells it used, the result and the residual." },
  { file: "sources.json", what: "Every source document: where it came from, its SHA-256 fingerprint and its verification record." },
  { file: "coverage.json", what: "For each table read: how many printed numbers there were and how many were captured." },
  { file: "release.json", what: "The release record: version, counts, coverage and pass rates, thresholds fingerprint, tool versions." },
  { file: "dataset_card.md", what: "A short description of the release for people: scope, status mix, known limitations." },
  { file: "HOW_TO_REPRODUCE.md", what: "How to rebuild this release from the raw sources and confirm every fingerprint." },
  { file: "CHANGELOG.md", what: "What changed in each release." },
  { file: "ERRATA.md", what: "Corrections to published figures." },
];

const COLUMNS: [string, string][] = [
  ["obs_id", "Permanent id of the figure: series_id:period:vintage. Survives re-extraction."],
  ["series_id, series_name, dataset", "Which series it belongs to (see series.json)."],
  ["period", "Fiscal year (2025-26), month (2026-06) or survey round, as the document labels it."],
  ["vintage", "Kind of figure: be (budget estimate), re (revised estimate), actual, provisional, na (no such distinction)."],
  ["value", "The figure as a decimal string, present only when published. Multiply by scale_factor for the full amount."],
  ["unit, scale_factor", "PKR with 1000000 means rupees in millions; percent; index; persons."],
  ["status", "checked, unchecked or disputed. Only checked figures carry a value."],
  ["tier", "Internal evidence tier: A (a check and a second printing), B (one of the two)."],
  ["published", "true when the value is shown on the site."],
  ["gap_kind, gap_reason", "For a row without a value: not_in_source, not_yet_verified, failed_checks or disputed, and why."],
  ["source_id … page, cell_id", "Where the figure is printed: the document, its official address and fingerprint, the page of the PDF file, the cell."],
  ["value_as_printed", "The printed text exactly as it appears on the page (for example 7,283)."],
  ["disputed_readings", "For disputed rows: every printing, as value (source p.N), separated by |."],
  ["evidence_summary", "The checks behind the figure, in one sentence."],
  ["release", "The release the row comes from."],
];

function size(file: string): string {
  const p = path.resolve(process.cwd(), "..", "releases", RELEASE_VERSION, file);
  if (!fs.existsSync(p)) return "";
  const b = fs.statSync(p).size;
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export default function DataPage() {
  const d = db();
  const example = d.seriesById.get("fed.exp.current.function.health") ?? d.series.find((s) => publishedObs(s.series_id).length > 0);
  const exObs = example ? publishedObs(example.series_id)[0] : undefined;
  const csv = `{{ORIGIN}}${DATA_BASE}/observations.csv`;
  const sid = example?.series_id ?? "fed.exp.current.function.health";
  const py = `import pandas as pd
from decimal import Decimal

url = "${csv}"
# Keep values as text: they are exact decimals, not floats.
obs = pd.read_csv(url, dtype={"value": str, "period": str})

s = obs[(obs.series_id == "${sid}") & (obs.published == True)]
s = s.assign(value=s.value.map(Decimal))
print(s[["period", "vintage", "value", "unit", "scale_factor", "source_title", "page"]])`;
  const r = `library(readr)
library(dplyr)

url <- "${csv}"
# Keep values as text: they are exact decimals, not floats.
obs <- read_csv(url, col_types = cols(value = col_character(), period = col_character()))

s <- obs |>
  filter(series_id == "${sid}", published) |>
  mutate(value_num = as.numeric(value))
s |> select(period, vintage, value, unit, scale_factor, source_title, page)`;

  return (
    <>
      <Breadcrumbs items={[{ label: "Data access" }]} />
      <header className="page-head">
        <h1>Data access</h1>
        <p className="lede">
          Everything on this site comes from one frozen release, {RELEASE_VERSION}, and every file of it can be downloaded. The CSV is the place to
          start; the receipt of any figure is also a JSON file.
        </p>
      </header>
      <Callout kind="caveat" title="Prototype release">
        <p>
          {d.release.doi ? `DOI ${d.release.doi}.` : "No DOI yet."} Not yet for citation in publications. Data CC BY 4.0. Values are decimal strings:
          read them as text and convert deliberately, or rounding errors creep in.
        </p>
      </Callout>

      <div className="with-rail">
        <div className="measure-wide">
          <section id="files" aria-labelledby="files-h">
            <h2 id="files-h">The files of a release</h2>
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
                  {FILES.filter((f) => releaseFileExists(f.file)).map((f) => (
                    <tr key={f.file}>
                      <th scope="row">
                        <a href={`${DATA_BASE}/${f.file}`} download className="mono nowrap">
                          {f.file}
                        </a>
                      </th>
                      <td className="small">{f.what}</td>
                      <td className="num small">{size(f.file)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <p className="small">
              Also: one CSV and one JSON per series at <code>{DATA_BASE}/series/&lt;series_id&gt;.csv</code>, page images at{" "}
              <code>{DATA_BASE}/pages/&lt;source_id&gt;/p&lt;NNN&gt;.png</code>, and the extraction run records at <code>{DATA_BASE}/runs/</code>.
            </p>
          </section>

          <section id="columns" aria-labelledby="columns-h">
            <h2 id="columns-h">Columns of observations.csv</h2>
            <dl className="facts">
              {COLUMNS.map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt className="mono">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="small">
              The full data model is in <a href={`${REPO_URL}/blob/proto/v0/docs/SCHEMA.md`}>docs/SCHEMA.md</a> in the repository.
            </p>
          </section>

          <section id="load" aria-labelledby="load-h">
            <h2 id="load-h">Load it</h2>
            <Code label="Python (pandas)" code={py} />
            <Code label="R (readr, dplyr)" code={r} />
          </section>

          <section id="links" aria-labelledby="links-h">
            <h2 id="links-h">Permalinks and receipts</h2>
            <dl className="facts">
              <dt>A figure</dt>
              <dd>
                <code>/o/&lt;obs_id&gt;</code> with the colons written as <code>~</code>
                {exObs ? (
                  <>
                    , for example <Link href={`/o/${slugify(exObs.obs_id)}`}>/o/{slugify(exObs.obs_id)}</Link>
                  </>
                ) : null}
              </dd>
              <dt>Its receipt as data</dt>
              <dd>
                <code>{DATA_BASE}/receipts/&lt;same id&gt;.json</code>: the observation, its cells with page boxes, its checks and its source documents.
                One CSV row with provenance columns at the same address ending <code>.csv</code>.
              </dd>
              <dt>A series</dt>
              <dd>
                <code>/series/&lt;series_id&gt;</code>; chart settings stay in the address (<code>?scale=log&amp;from=2015-16</code>).
              </dd>
              <dt>A document</dt>
              <dd>
                <code>/sources/&lt;source_id&gt;</code>
              </dd>
            </dl>
            <p className="small measure">
              Links are to a release. A later release keeps the same ids; if a figure changes, the change is listed in the errata and the old release
              stays available, so a citation never breaks.
            </p>
          </section>

          <section id="cite" aria-labelledby="cite-h">
            <h2 id="cite-h">How to cite</h2>
            <p className="measure">
              Cite two things: the government document, which is the authority for the figure, and the portal release, which records where it was
              read and how it was checked. Every receipt gives both, in APA, BibTeX and RIS, with the page. This release has no DOI yet and is not for
              citation in publications.
            </p>
          </section>
        </div>
        <aside className="rail">
          <Toc
            items={[
              { id: "files", label: "Files" },
              { id: "columns", label: "Columns" },
              { id: "load", label: "Load it" },
              { id: "links", label: "Permalinks and receipts" },
              { id: "cite", label: "How to cite" },
            ]}
          />
        </aside>
      </div>
    </>
  );
}
