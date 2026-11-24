# The site as it is: a handover for the bridge

Written 2026-11-24 at Ali's request, for the agents that will connect the site (`site/`) to Ahmad's repository
`ahm3d-karim/pak-econ-golden-data`. Read this before changing anything in `site/`, then `AGENTS.md` (sections 3, 4 and
7) and `STATUS.md`. Everything here was read from the code on branch `claude/dreamy-edison-8uakez` at the time of
writing; where it says "today", check the code again.

Related: `docs/DESIGN.md` (sections 5 and 17 are the contract and the open decisions),
`docs/reports/2026-11-24-golden-data-backend-fit.md` (what his output carries and what it lacks),
`DECISIONS.md` D-BE-1.

---

## 1. The situation in four lines

- Every figure on the site today is a **demo value** from our own prototype release `releases/v0.0.1-prototype/`
  (D-BE-1). They will all be removed.
- The real data will come from Ahmad's **golden releases** (git tags such as `golden-2026.11.23`). The bridge is what
  turns one tag into something the site can build from.
- The site was built for this swap: pages read data only through a **contract** (section 4), and a **golden adapter**
  already exists (section 6). It is switched off and was written against the old tag `golden-2026.11.11`.
- **The catch (section 7):** the build scripts (prebuild, check-build and the 23 check plug-ins) read our release's
  JSON files directly, not through the adapter. The bridge must either write our release format or move those scripts
  onto the adapter.

## 2. Stack and how to run

- Next.js 16.4.1 (App Router), React 19.3, Tailwind 4, TypeScript; pdf.js 6.4.299 for the document viewer. No chart
  library (charts are hand-written SVG, `src/components/Chart.tsx`, `CompareChart.tsx`, `Spark.tsx`).
- Fully static. No database, no API, no client-side data fetching, no analytics. Everything is read from disk at build
  time. The one exception to "never compute on the client" is the inflation calculator (D-HV3 entry in `DECISIONS.md`).
- Node 20+; the contract tests need Node 22.18+ (TypeScript type stripping).

```
cd site
npm install
npm run dev               # runs prebuild first, then http://localhost:3000
npm run build             # prebuild, then static generation of every page
npm run check             # scripts/check-build.mjs, after a build: proves every visible digit
npm run test:contract     # adapter contract tests (scripts/contract-test.mjs)
npm run test:search
npm run lint
```

A `next start` left running across a rebuild serves unstyled pages (AGENTS.md section 7): stop it and start again.

## 3. Where things are

| What | Path |
|---|---|
| Which release the site builds from | `site/release.config.json` (`version`, `siteUrl`, `repoUrl`; an `adapter` key is read but only `"datalab"` is accepted) |
| The one module that loads data | `site/src/lib/data.ts` (`db()`), types `Series`, `Observation`, `Cell`, `Check`, `Source`, `Release`, `Db` |
| The contract | `site/src/lib/adapter/contract.ts` |
| Our adapter | `site/src/lib/adapter/datalab.ts` |
| Golden adapter (off) | `site/src/lib/adapter/golden.ts` |
| Library (documents and datasets) | `site/src/lib/adapter/library.ts`, names in `site/editorial/library.json` |
| Plain titles | `site/src/lib/adapter/titles.ts`, `site/editorial/titles.json` |
| Status and kind words | `site/src/lib/words.ts` (`READER_STATUS`, `KIND`), `site/src/lib/status.ts` (visual keys) |
| Ids and slugs | `site/src/lib/ids.ts` (`slugify`), copies in `scripts/prebuild.mjs` and `scripts/check-build.mjs` |
| Prebuild (copies the release into `public/data/<version>/`) | `site/scripts/prebuild.mjs`, `site/scripts/prebuild/{evidence,library,search,take}.mjs` |
| Build checks | `site/scripts/check-build.mjs` and `site/scripts/checks/*.mjs` (23 plug-ins) |
| Every address that must keep working | `site/scripts/checks/routes-baseline.txt` |
| Editorial choices (made by people) | `site/editorial/*.json`, `site/editorial.config.json` |
| Planned features (all off) | `site/features.config.json` |
| Our release format | `docs/SCHEMA.md`, `schema/*.json`, `releases/v0.0.1-prototype/` |

## 4. The data contract

Every page gets data from `db()` in `src/lib/data.ts`, which calls one adapter and returns a `Db`:

```
Db = { release, info, batchGaps, series[], observations[], cells[], checks[], sources[], coverage[],
       seriesById, obsById, cellById, checkById, sourceById, obsBySeries, childrenOf,
       obsBySlug, seriesBySlug, sourceBySlug, cellsBySource }
```

The record shapes keep our release's field names (`series_id`, `obs_id`, `vintage`, `published`, `gap_kind` ...).
On top of them the **adapter** sets four fields per observation, and pages only display them:

- `reader`: the reader status, one of
  `checked`, `checked-note`, `candidate`, `revised`, `disputed`, `held`, `not-checked`, `not-printed`,
  `dash-or-zero`, `unknown`. Each carries a word, a one-sentence reason, `showsValue` and `usableInDerived`. Wording is
  in `words.ts`.
- `kind`: the kind of figure (`be`, `re`, `actual`, `ac`, `provisional`, `final`, `es_revised`, `es_provisional`,
  `part_year`, `index`, `change_yoy`, `change_mom`, `weight`, `survey_round`, `as_printed`).
- `printed_text`: the value as printed, when the source keeps it.
- `signoff`: `signed`, `candidate` or `not-applicable`.

Series also get `title`, `summary`, `titleStatus` from `editorial/titles.json` (never from the data).

**Rule built into both adapters:** a value travels only where `reader.showsValue` is true. Everything else is emptied
inside the adapter, so no page can show a withheld number by mistake. Only `usableInDerived` figures may feed a change,
share or sum ("gaps travel").

Evidence shapes (`contract.ts`, `Evidence`): `printed-cell` (source, PDF page, box as fractions of the page, box state
`exact | tentative | none | no-image`, printed text), `recomputed` (our value, the published value, table, page,
method) and `derived` (formula and inputs). **There is no shape for a spreadsheet cell (sheet + cell) yet**, which his
Excel-based datasets need.

## 5. Our release format (what the demo values sit in)

`releases/v0.0.1-prototype/` holds `release.json`, `series.json` (925), `observations.json` (6,318), `cells.json`
(11,081), `checks.json` (5,860), `sources.json` (26), `coverage.json`, CSV and Parquet copies, `pages/<source_id>/pNNN.png`
(page renders the receipts draw boxes on), `runs/`, the dataset card, CHANGELOG and ERRATA. Field definitions:
`docs/SCHEMA.md` and `schema/*.json`.

Points that matter for a converter:

- Ids: `series_id` like `fed.exp.current.function.health`; `obs_id` = `series_id:period:vintage`. URLs use
  `slugify(id)`: `:` becomes `~`, anything outside `[A-Za-z0-9._~-]` becomes `_` (`/o/fed.exp.total~2010-11~be`).
- Values are decimal **strings**, never floats. `scale_factor` says what one unit means (1000000 for Rs million).
- A cell box is `cell_bbox_norm`, fractions of the page `[x0, y0, x1, y1]` with the origin at the top left.
- A dataset shows only if `release.json.dataset_status[<dataset>].state` is `"published"` (or `"candidate"`);
  otherwise it is "coming" and none of its figures render.
- Checks carry `member_cell_ids`, `target_cell_id`, `result` (`pass`, `pass_within_rounding`, `fail`,
  `not_evaluable`), `description`. The Source Panel lists the checks a figure passed from these.

## 6. The two adapters

**datalab** (`datalab.ts`, on). Maps our pipeline's words: checked + published → `checked` (`checked-note` with a
note); disputed → `disputed`; gap `not_in_source` → `not-printed`; `not_yet_verified` → `not-checked`;
`failed_checks` → `held`; anything else → `unknown`.

**golden** (`golden.ts`, off; `data.ts` throws for any adapter but `"datalab"`). Written against `golden-2026.11.11`
(14 datasets). What it already does, from its header comment:

- Verifies every golden file against `catalogue.json` and `RELEASE.json` fingerprints (SHA-256 after CRLF→LF;
  dataset hash over sorted `name:hash` lines) and refuses the load on any difference; the release id must equal the
  pinned tag; datasets added after the release are not read.
- Status rules, first match wins: `misprint*` or survey `differs` → `held`; `unpublished*` or `not_published` →
  `not-checked`; an unknown asterisk → `unknown`; a 0 in a federal ABS table with no printed text → `dash-or-zero`;
  printed dash → `not-printed`; a row of an unsigned dataset → `candidate`; `restated*`, `memo*`, `assumption*`,
  `small_sample*` → `checked-note`; else `checked`. A held batch becomes a `BatchGap`. His Haiku "second readings"
  are never read.
- Kinds: `BE/RE/ACTUAL/AC` → `be/re/actual/ac`; Economic Survey `partial_period` → `part_year`, flag `F/R/P` →
  `final/es_revised/es_provisional`; surveys → `survey_round`.
- Series ids: `golden.<dataset>.<group values>.<item key>`, e.g.
  `golden.abs_federal_functional.current_capital.total.1.01`. **These are not our ids** (section 8).
- Evidence: printed-cell from his `page` + bbox (PDF points, top-left). His release has no page sizes or page images,
  so the box is `no-image` unless a page size is supplied. Surveys get `recomputed` evidence; `budget_credibility`
  gets `derived`.
- Returns a `GoldenDb` (a `Db` plus `evidence`, `printing`, `keyObs`, `notInRelease`, `heldSources`, `signoffs`).

**Out of date for `golden-2026.11.23`** (67 datasets). From the answers in the fit report, it has not seen:
tags `revised*`, `islamabad_excluded*`, `label_defect*`, `inconsistent*`, `does_not_add_up*`, `printed_differently*`,
`reprint_differs*`, `printings_differ*`, `below_one*`, `clipped_in_print*`; `check_status` values `matched_nil`,
`matched_printed_form`, `matched_incl_islamabad`, `unchecked (...)`, `not_published (...)`, `below_one`,
`misprint (K00n ...)`; estimate types `AC_PROV`, `BE_Q1`, `projection`, `MT`, `EST`, `REPORT`; sheet + cell
provenance; page without a box; datasets with no `exception` column (`budget_credibility`). It fails safe (unknown →
no value), so the result of not updating it is gaps, not wrong numbers.

`scripts/contract-test.mjs` has a golden section pinned to `golden-2026.11.11` with a hard-coded Windows clone path;
set `GOLDEN_REPO` to a clone.

## 7. What does not go through the adapter (read before choosing the bridge's shape)

These read `../releases/<version>/*.json` themselves:

- `scripts/prebuild.mjs` and `scripts/prebuild/*.mjs`: copy page renders and downloads into `public/data/<version>/`,
  write one receipt JSON per observation and one CSV per series, build the search index, the Library file list and the
  download files.
- `scripts/check-build.mjs`: after the build, proves every digit on every page against the release files.
- `scripts/checks/whatsnew-entries.mjs`, `whatsnew-calendar.mjs`, and the plug-ins check-build loads.
- `scripts/number-audit.mjs`, `search-test.mjs`, `qa-routes.mjs`, `perf.mjs`, `draft-titles.mjs`, `hub-shots.mjs`.

So there are two ways to build the bridge:

- **A. The bridge writes our release format** (`releases/<golden-tag>/` with `release.json`, `series.json`,
  `observations.json`, `cells.json`, `checks.json`, `sources.json`, `pages/`) from a golden tag, using the rules
  already in `golden.ts`. The site, prebuild and every check work unchanged; `release.config.json` just names the new
  folder. The converter is where his vocabulary is interpreted.
- **B. The site reads the golden tag directly** through `golden.ts`, and prebuild, check-build and the plug-ins are
  moved onto `db()` first.

A is less work on the site and keeps check-build independent of the adapter it checks. Either way, it is Ali's and
Ahmad's call; record it in `DECISIONS.md`.

What his release cannot fill in our format today (fit report section 2): per-figure check records for document
datasets (our `checks.json` needs member cells), printed text for the federal ABS tables, page renders (`pages/`) and
page sizes (needed to turn his points into fractions), a stable figure id, and a sheet + cell shape.

## 8. What is wired to the demo series ids

Pages and editorial files name our series ids. Under golden ids none of them match.

- **Editorial files** (`site/editorial/headline.json`, `topics.json`, `titles.json`, `questions.json`,
  `concepts.json`, `stories.json`, `synonyms.json`, `site/editorial.config.json` `compareDefault`). They are written to
  leave out an id the release does not hold, never to fill it in.
- **Components and pages that hard-code ids:**
  - `src/components/hub/HomeV4.tsx:593` `CPI_INDEX = "cpi.national.general.b2015_16"`
  - `src/app/inflation-calculator/page.tsx:31-32` the CPI index and rate series
  - `src/components/series/Indicator.tsx:85,103-108` CPI urban, rural, food and the `cpi.national.yoy.group.` prefix
  - `src/components/series/Parts.tsx:48` `series_id.startsWith("fed.exp")`
  - `src/app/data/page.tsx:73-77` the example series
  - `src/app/compare/[category]/page.tsx`, `src/app/guides/revised-estimate/page.tsx`,
    `src/app/demo/health-and-jobs/page.tsx`
- **Dataset keys** `abs`, `cpi`, `lfs` are assumed in places (topics, Library, CPI-only views). His datasets are
  named `abs_federal_functional`, `lfs_indicators`, `sbp_monthly` and so on.

The ids most used across the site: `fed.exp.current.function.health` (18 places), `cpi.national.yoy.general` (17),
`fed.rev.tax` (12), `fed.exp.total` (12), `lfs.unemployment_rate.total.total` (10), `cpi.national.general.b2015_16`
(10), `lfs.labour_force.total.total` (9).

## 9. The build checks (they will fight a near-empty release)

`check-build.mjs` fails the build if any visible digit is not one of: a value linked to its receipt (`data-v`), a
count it recomputes independently (`data-count`), or a typed non-value such as a period or page label (`data-num`).
Every derived formula needs a plug-in that recomputes it. The plug-ins in `scripts/checks/`:

`calc-inflation`, `catalogue-json`, `editorial-plain-words`, `evidence-sheet`, `find-list`,
`guides-revised-estimate`, `home-calendar`, `home-costs`, `home-derived`, `home-editorial`, `home-per100`,
`home-publishers`, `home-stories`, `library-counts`, `routes-alive`, `search-index`, `series-derived`, `take-files`,
`take-transforms`, `titles`, `whatsnew-calendar`, `whatsnew-entries`.

Several fail when an expected element is missing (for example `home-stories.mjs` fails with "no ticker"), and
`routes-alive.mjs` fails if any address in `routes-baseline.txt` disappears, which removing the demo series ids will
do (every `/series/<id>` and `/o/<id>` of the demo release is in the baseline). **Changing a check needs Ali's
approval** (AGENTS.md section 7). Plan for: a release where most slots are gaps must build and say so; demo addresses
need a decision (redirect, or a "this demo figure was removed" page).

## 10. Pages

`/` home; `/browse` (Indicators A to Z); `/search`; `/topics`, `/topics/[slug]`; `/series/[id]` (tabs Chart, Table,
Editions, Download, Cite via `?tab=`); `/o/[id]` receipt of one figure; `/sources/[id]` a document; `/tables/[slug]`
tables as printed; `/datasets/[id]`; `/library`, `/library/datasets` (on-site pdf.js viewer); `/releases` (What's new,
`#corrections`); `/compare`, `/compare/[category]`; `/inflation-calculator`; `/guides`, `/guides/revised-estimate`;
`/answers`, `/answers/[slug]`; `/calendar`; `/data`; `/api`; `/methods`; `/about`; `/catalogue.json`,
`/series/[id]/views.json`; demo pages under `/demo/`.

The Source Panel (`src/components/evidence/`) is a right-hand drawer on every figure: page close-up (only when the box
is exact), the checks the figure passed, open the page in the document, copy citation, report a problem.

## 11. Decisions already written down that the bridge must respect

From `docs/DESIGN.md` section 17 (proposals, not all confirmed; check `DECISIONS.md`):

- Candidate figures are shown but always marked "not signed off" and kept off the home page, answers and headline
  search (17.1).
- A `misprint*` figure is shown as **held back**, with the source's explanation as the reason (17.2). His promoter
  publishes it; the site does not, because a failed check withholds under rule 2.
- A 0 from a table that keeps no printed text is shown as "printed as a dash or a zero; this release does not say
  which", never used in a sum, change or share (17.3).
- Reliability tiers only on source pages, in words, after Prof. Hasnain approves them (17.4).
- Page proofs: each golden release should ship proof images and a proof index; the site never renders pages from raw
  PDFs itself; never show two releases' figures side by side (17.7).
- Survey figures PBS never printed (`unpublished*`) are "not checked yet", no number (17.8).
- Never let an LLM produce or judge a value (AGENTS.md sections 3 and 4). His survey reference figures were
  transcribed by LLM agents; see the fit report.

## 12. A sensible first sequence for the bridge

1. Decide A or B (section 7) and record it.
2. Move the hard-coded ids (section 8) into one editorial map that names concepts ("headline inflation") with one
   series per adapter; no visible change.
3. Build once with a release where no editorial id matches, and make every page and check survive it (with Ali's
   approval for check changes).
4. Bring the golden rules up to `golden-2026.11.23` (section 6) and add a sheet + cell evidence shape.
5. Pin the tag, run the contract tests against a real clone (`GOLDEN_REPO`), switch on a branch, and run
   `npm run build && npm run check`.
6. Remove the demo release only when the switched build passes.
