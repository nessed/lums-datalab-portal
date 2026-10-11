# Track "sources": national LFS 2014-15 (C5) and cross-source checks (C6), findings (continuation run, unattended)

Branch `proto/v0-sources`. Plan: `docs/plans/2026-10-12-continuation.md`, steps C5 and C6, decision D30.
Code: `pipeline/datalab/sources.py` (body markers, data-file registration), `pipeline/datalab/datasets/cross_source.py`
(new), small edits in `datasets/cpi.py`, `datasets/lfs.py`, `status.py`; specs `specs/lfs.yaml`, `specs/cpi.yaml`;
tests `pipeline/tests/test_sources.py`, `test_cross_source.py`, `test_cross_source_pes.py`, additions to `test_lfs.py`.
Output of this track is in its own work folder (`WORK_DIR` = `work/tracks/sources`): three new runs and the CPI and LFS
datasets rebuilt there. Nothing under `releases/` was rebuilt or committed.

No value below was typed, corrected or judged by an LLM. Docling emitted the text, `normalise.parse_printed` parsed it,
the SBP figures were parsed by the same function from the CSV, the checks ran in code and `status.build_observations`
decided. Every number in this note was printed by a script from the datasets; the "before" columns are copied from
the first run's findings notes.

## 1. What was registered

All four through `sources/plan.yaml` and `python -m datalab register`.

| source_id | status | from | file | pages | SHA-256 (first 12) |
|---|---|---|---|---|---|
| `lfs-pbs-2014-15-national` | `official_only` | official PBS URL, HTTP 200, retrieved 2026-10-10T22:40:56Z | `Annual_Report_of_LFS_2014-15-1.pdf` (1,111,773 bytes) | 55 | `0d7e7e145f8f` |
| `sbp-easydata-cpi-national-yoy` | `official_only` | SBP EasyData public "Download Series" form (POST), retrieved 2026-10-10T20:25:49Z by the first run | `data_series.csv` (16,278 bytes, 123 rows) | n/a | `6afbf22e8c88` |
| `pes-fed-2024-25-inflation` | `official_match_archive` | official finance.gov.pk URL, HTTP 200; identical to the ra-ship copy | `7_Inflation.pdf` (1,420,442 bytes) | 28 | `420ba088b018` |
| `pes-fed-2024-25-labour` | `official_match_archive` | official finance.gov.pk URL, HTTP 200; identical to the ra-ship copy | `12_Population.pdf` (1,411,414 bytes) | 29 | `8cce28da939c` |
| `lfs-pbs-2014-15` (unchanged) | `failed`, kept | the first PBS link: the Azad Jammu & Kashmir edition | `Annual_Report_of_LFS_2014-15.pdf` | 30 | `56e5681bde6d` |

Roles: the LFS report is `core`; the other three are `cross_source`. For the three PDFs the official landing page was
fetched and links the exact file (`landing_page_links_file: true`), and a Wayback CDX snapshot exists whose SHA-1 digest
equals the local file (`digest_matches_file: true`; timestamps 20260314052958, 20260316032644, 20260207173405).

### 1.1 National LFS 2014-15 (D30): what was tried

1. `https://www.pbs.gov.pk/wp-content/uploads/2020/07/Annual_Report_of_LFS_2014-15-1.pdf`: HTTP 200, a PDF. This was the
   first thing tried and it is the national report, so the PBS landing page was not searched for other links and Wayback
   was not needed as a source (it was only queried for the digest).
2. Acceptance, by code, in the verification record:
   - cover markers in the first 4 pages: "labour force survey" yes, "government of pakistan" yes, "2014-15" yes;
   - `markers_none: ["azad jammu"]` in the first pages (the check that rejected the first file): not found;
   - new whole-document check `body_markers_none: ["azad jammu"]`: found on no page of 55;
   - new whole-document check `body_markers_all: ["pakistan and provinces"]`: found on pages 5, 6, 7, 25, 30, 32, 34, 35, 46
     (the contents list and the table titles);
   - text layer on 55 of 55 pages.
   The whole-document checks were added because a regional edition can carry a national-looking cover; a test builds
   exactly that PDF and shows the cover check passing and the body check failing it.
3. `retrieved_at` is stamped by the machine clock; the folder holds both 2014-15 files side by side under
   `lfs_annual_report/2014-15/` (different file names).

### 1.2 SBP EasyData CSV: how the first run obtained it

Found by reading the first run's scratch scripts and request log (`work/track_a/scripts/07_sbp_cpi.py`,
`work/track_a/attempts.jsonl`, not in git) and the sidecar the download step wrote next to the file
(`data_series.csv.request.json`); the CSV itself was looked at only through scripts (column names, distinct descriptive
values, row count).

- The script opened `https://easydata.sbp.org.pk` as a guest (no login), followed the public page of series
  `TS_GP_PT_CPI_M.P00011516`, opened its "Download Available Series" form (APEX page 222) and submitted it the way the
  page's own button does: `POST https://easydata.sbp.org.pk/apex/wwv_flow.accept` with `p_request=DOWNLOAD`.
  HTTP 200, `Content-Disposition: attachment; filename="data_series.csv"`, 16,278 bytes.
- The documented API (`https://easydata.sbp.org.pk/api/v1/series`) answered **HTTP 401** without a key. It was not used
  and nothing was done to get around it. **A human must register for an API key** if the project wants a repeatable
  API pull; the key belongs in `.env`.
- The file sat at `SOURCES_DIR/sbp_easydata/2026-10-10/data_series.csv` (not `sbp/`), which is exactly where `register`
  puts a `sbp_easydata` source with period `2026-10-10`, so it was registered in place through the plan's `prefetched`
  block (the same route the first run's CPI and LFS downloads took). `register` compared the recorded hash with the file
  (equal) and wrote the request (method, URL, form page URL, series page URL, form items), the terms note and the
  credentials note into `sources/verification/sbp-easydata-cpi-national-yoy.json`.
- **Terms:** the saved EasyData pages carry "Copyright (c) 2026, All Rights Reserved. State Bank of Pakistan" and link a
  Disclaimer page; no open-data licence is stated on them. The file is used only to compare. **A human must read the
  Disclaimer and confirm** that this use, and showing the SBP figure on a receipt, is allowed.
- **Not reproducible by URL.** The download is a form submission bound to a browser session, and a later download would
  hold later months (different hash). `datalab fetch` now prints `NOT FETCHABLE BY URL` for it, writes nothing, and does
  not count a missing cross-source file as a failure; the CPI build then records "skipped" instead of comparing.

### 1.3 Economic Survey 2024-25 chapters

File URLs are the ones in the ra-ship registry (`pbs-corpus/manifest.csv`): `.../survey/chapter_25/7_Inflation.pdf` and
`.../survey/chapter_25/12_Population.pdf`. Landing page `https://www.finance.gov.pk/survey_2025.html` was fetched (HTTP
200) and links both. Both downloads are byte-identical to the archive copies. Markers: "pakistan economic survey",
"2024-25" and the chapter word ("inflation"; "labour force"). The labour chapter failed its first registration on the
"labour force" marker with 3 marker pages: the chapter title is printed only as a running head, first on page 4
(page 1 is an infographic). `marker_pages: 4` for that source; the failed first attempt is noted in the plan file.

## 2. New extraction runs (to copy from this track's `WORK_DIR/runs` to the main one)

| Run id | Source | Mode | Pages | Tables | Docling time | Validated |
|---|---|---|---|---|---|---|
| `LFS_2014-15__docling__full-document__run-01` | `lfs-pbs-2014-15-national` | full document | 55 | 45 | 764 s | yes |
| `PES_2024-25__docling__full-document__run-01` | `pes-fed-2024-25-labour` | full document | 29 | 15 | 500 s | yes |
| `PES_2024-25__docling__full-document__run-02` | `pes-fed-2024-25-inflation` | full document | 28 | 27 | 451 s | yes |

All three: file hash unchanged, every page accounted for, empty error log. One Docling run at a time in this track.

**Deviation from the brief, on purpose:** the brief asked for a page-range run for LFS 2014-15 "per D18". D18 is the
exception for reports over 150 pages; this report has 55, so the rule (AGENTS.md section 5: full document, never
chunked) applies and a full-document run was made, as for the 54-page 2017-18 report.

Both Economic Survey runs share the prefix `PES_2024-25` because the run id is built from document type and period;
which chapter a run belongs to is the `source_id` in its `manifest.json`.

## 3. LFS with the national 2014-15 report (C5)

Spec change: one line, `previous_round: "2014-15": "2013-14"`. The report prints the same seven tables as 2017-18
(same table numbers and titles), so no other layout entry was needed. A header showing any round other than 2013-14
beside 2014-15 leaves the table unmapped (tested).

Overlay viewed before trusting the mapping: `work/tracks/sources/qa/overlay_lfs-pbs-2014-15-national_p044_t0.png`
(Table 21, unemployment rates): the boxes sit on the numbers and the header rounds are 2013-14 and 2014-15.

| Table kind | Page | Coverage | Flags | Mapped cells |
|---|---|---|---|---|
| Crude participation rates | 30 | 1.0 | none | 18 (the two "Augmented" columns recognised, unmapped) |
| Refined participation rates | 32 | 1.0 | none | 18 |
| Civilian labour force (million) | 34 | 1.0 | none | 18 |
| Employed (million) | 35 | 1.0 | none | 18 |
| Employed by major industry division (%) | 35 | 1.0 | none | 48 |
| Unemployment rates by area and sex | 44 | 1.0 | none | 18 |
| Unemployed (million) | 46 | 1.0 | none | 18 |

7 of 7 kinds located, no unmapped labels, no column problems. Coverage over all LFS reports is now 2,744 of 2,744
printed numeric tokens in 32 tables (was 2,108 in 25).

### 3.1 Cross-edition, 2014-15 report against the 2017-18 report

The 2017-18 report prints 2014-15 in its previous-round columns.

| Pairs | Agree | of which exact | Differ |
|---|---|---|---|
| **78** | **78** | 78 | **0** |

Nothing to list: every one of the 78 figures (27 counts, 9 unemployment rates, 18 participation rates, 24 industry
shares) is printed identically in the two reports.

All cross-edition pairs after this change:

| Pair of reports | Pairs | Pass | Within rounding | Fail |
|---|---|---|---|---|
| 2014-15 and 2017-18 | 78 | 78 | 0 | 0 |
| 2017-18 and 2018-19 | 78 | 78 | 0 | 0 |
| 2018-19 and 2020-21 | 60 | 52 | 2 | 6 |
| 2020-21 and 2024-25 | 60 | 59 | 1 | 0 |
| All | 276 | 267 | 3 | 6 |

The six failures are the same six 2018-19 industry shares as before (the restatement in the 2020-21 report; D25).
Counted the old way that is 270/276 = 97.83%; with the six counted as disputed (D26) it is 270/270 and the disputed
share is 6/276 = 2.2%. Which of these applies is the lead's D25/D26 code, not this track's.

### 3.2 What changes in the LFS dataset (this track's work folder, cross-source included, section 5)

| Round | Before (first run) | Now |
|---|---|---|
| 2013-14 | not present | 78 figures from the previous-round columns of the 2014-15 report: 61 published (12 A, 49 B), 17 withheld `not_yet_verified` |
| 2014-15 | 60 published (all B), 18 participation rates withheld | 78 published (60 A, 18 B) |
| 2017-18 | 78 published (60 A, 18 B) | unchanged |
| 2018-19 | 77 published (36 A, 41 B), 1 `failed_checks` | 78 published (41 A, 37 B) |
| 2020-21 | 69 published (42 A, 27 B) | 69 published (45 A, 24 B) |
| 2024-25 | 51 published (B), 18 withheld | unchanged |
| All | 372 observations: 335 published (138 A, 197 B), 36 `not_yet_verified`, 1 `failed_checks` | 450 observations: 415 published (218 A, 197 B), 35 `not_yet_verified` |

Checks: 714 evaluable, 707 passed (599 exact, 108 within rounding), 7 failed = 99.02%. The seven failures are the six
restated shares and the one recompute failure below.

**Two things the lead should decide, not this track:**

1. **A new round, 2013-14, now appears**, taken only from the previous-round columns of the 2014-15 report (the way
   2014-15 itself was taken from the 2017-18 report before). It is not in `expected_every_round`, so no gap rows are
   generated for it. Nothing was done to hide or keep it; whether a round known only from another report's
   previous-round columns should be shown is the same question the first run left open for 2014-15.
2. **The 2018-19 urban unemployment rate (both sexes) moves from withheld (tier D) to published (tier B).** Its recompute
   check still fails (printed 7.9; 1.79 / 22.89 x 100 = 7.82; bound 0.0736), but the Economic Survey prints the same
   figure (7.90), and `status.decide_tier` publishes at tier B when a check failed and an independent one passed. The
   receipt sentence says both. That is the existing rule working as written; whether a figure with a failed recompute
   should publish on a cross-source agreement is a policy question.

## 4. CPI against SBP EasyData (C6 a)

How `datasets/cpi.py` expects the data: a CSV with columns `Series Key`, `Series`, `Observation Date`
(`30-Jun-2025`), `Observation Value`; one check per PBS cell of `cpi.national.yoy.general` from 2019-08 on, tolerance
`0.5 u_SBP + 0.5 u_PBS` (written in `specs/cpi.yaml` by the first run, before any comparison).

**Like with like, established from the file's own columns, in every row (code, not reading):** `Dataset` =
"Inflation Snapshot (New Base: 2015-16)", `Series Key` = `TS_GP_PT_CPI_M.P00011516`, `Series` = "CPI National -YoY",
`Unit` = "Percent"; the download form named the series "National CPI, an Inflation Measure (Year-on-Year basis)".
So: national, year-on-year change, percent, base 2015-16. The same four things are required again at build time
(`cross_source.read_easydata_series`); if a row of the series says another base, unit or name, or a month appears twice
with different text, nothing is compared and the reason is written to `info.json`. Caveat that stays: SBP's text says
"National CPI", not "General"; the comparison treats the headline national CPI as the all-items index.

Provenance of each SBP figure is in the check's description and in `info.json` (`cross_source_sbp.compared`): series
key, observation date, row of the CSV, request method and URL, retrieval time.

| Pairs compared | Agree | of which exact | within rounding | Differ |
|---|---|---|---|---|
| **5** | **4** | 1 | 3 | **1** |

| Month | PBS prints (issue, page) | SBP gives (CSV row) | Result |
|---|---|---|---|
| 2021-06 | 9.65 (June 2021 issue, p.8) | 9.655669291 | **fail**: differs by 0.005669291; the bound is 0.005 + 0.0000000005 |
| 2023-06 | 29.40 (June 2023 issue, p.8) | 29.4 | pass |
| 2024-06 | 12.57 (June 2024 issue, p.8) | 12.6 | pass within rounding |
| 2025-06 | 3.23 (June 2025 issue, p.8) | 3.2 | pass within rounding |
| 2026-06 | 11.07 (June 2026 issue, p.8) | 11.1 | pass within rounding |

The one disagreement, in words: for June 2021 SBP carries an unrounded figure (nine decimals) that rounds to 9.66,
while PBS prints 9.65. The difference is 0.0007 beyond what rounding the PBS figure allows. The tolerance was fixed
before the result and is not touched; the check is a recorded fail. The PBS figure still passes its own recomputation
from the printed indices, so it stays published at tier B with a note on the observation ("SBP EasyData: National
CPI, year-on-year change (series TS_GP_PT_CPI_M.P00011516) gives a different figure for this (9.655669291). The value
shown is the one printed in the Monthly Review of Price Indices, June 2021."). Humans may want to look at whether PBS
truncated here. Under D25 this is a cross-source disagreement, not a cross-edition one; whether it should carry the
public status `disputed` is the lead's rule to write.

**Published CPI observations that move from tier B to A** (computed by running `status.build_observations` with and
without the cross-source checks): four, all `cpi.national.yoy.general`:
`2023-06`, `2024-06`, `2025-06`, `2026-06`. `2021-06` stays B. No other observation changes.

CPI checks in this track's build: 512 evaluable, 511 passed, 1 failed (the June 2021 SBP pair).

**Bug found and fixed on the way:** the first real SBP run crashed the build. `status.disagreement_note` indexed
`member_cell_ids[0]` of a failed check, and a cross-source check against a data file has no member cell. It now writes
the note from `target_source` and `target_value`. Test: `test_sbp_disagreement_is_a_recorded_fail_with_a_note_and_no_crash`.

## 5. LFS against the Economic Survey 2024-25 labour chapter (C6 b)

Spec: `specs/lfs.yaml`, block `cross_source_pes`, written before the first comparison. Tables are found by printed
title, rows by a label dictionary, column years and column measures from the PDF text layer by position
(`common.column_header_text`, restricted to words inside the table box). Nothing is located by page number.

| Chapter table (title) | Found on | Coverage | Read as | Compared |
|---|---|---|---|---|
| "Labour Force and Employment" (in million) | p.24, title found once | 1.0 / 1.0 | rows = measures with Rural and Urban under each, columns = survey years | labour force, employed, unemployed (million) and unemployment rate (%), Pakistan / rural / urban |
| "Population and Labour Force" (in million) | p.25, title found once | 1.0 / 1.0 | rows = survey years, columns = measures by header | crude activity rate (%), labour force, unemployed, employed, Pakistan |

Same concept, period, unit: both tables state "Source: Pakistan Bureau of Statistics (Labour Force Survey)"; the periods
are the survey rounds; counts are in million on both sides (the chapter's unit line and our `scale_factor`), rates in
percent. Compared rounds: 2013-14, 2014-15, 2017-18, 2018-19, 2020-21 (the chapter predates LFS 2024-25). Each LFS
printing of a figure is compared with each chapter printing of it. Tolerance: half a unit of the last printed digit of
each figure.

A year of a chapter table is used only if the chapter's own employed + unemployed gives its labour force; 2012-13
fails that in the first table (not a round we hold, so it changes nothing; recorded in `info.json`).

Overlay viewed: `overlay_pes-fed-2024-25-labour_p025_t0.png`: boxes on the numbers.

| Pairs compared | Agree | of which exact | within rounding | Differ |
|---|---|---|---|---|
| **126** | **126** | 113 | 13 | **0** |

By table: "Labour Force and Employment" 93 pairs (81 exact, 12 within rounding); "Population and Labour Force" 33 pairs
(32 exact, 1 within rounding). The 13 within-rounding pairs are cases where the two publications print different
precision or a last digit one apart (for example unemployed, urban, 2018-19: 1.79 in the LFS report, 1.80 in the
chapter; unemployment rate, urban, 2013-14: 8.0 against 8.02).

**Tier changes from these checks: 22 observations.** 20 move from B to A (counts and unemployment rates for 2013-14,
2018-19 and 2020-21 that had arithmetic evidence only); `lfs.lfpr_crude.total.total` 2013-14 moves from C (withheld) to
B (published); `lfs.unemployment_rate.total.urban` 2018-19 moves from D to B (see 3.2, point 2).

### 5.1 Not compared, and why (never guessed)

- **"Labour Force Participation Rates (%)" row of the first table:** the table does not say crude or refined, and we hold
  both. Not compared. (The crude rate is compared from the second table, which names it.)
- **Sector columns of "Population and Labour Force" and the table "Distribution of employed persons by major
  industries":** seven groups with mining and manufacturing together; not the grouping of the LFS industry shares, and
  the first is in million, not percent.
- **"Percentage distribution of employed persons by major industry 2020-21":** 21 ISIC sections by province; a different
  classification.
- Population, working-age population, age-specific participation rates: no such series is held.
- 2024-25: the chapter was published before the LFS 2024-25 report; it cannot lift the 18 withheld 2024-25
  participation rates. The Economic Survey 2025-26 labour chapter would.

## 6. CPI against the Economic Survey 2024-25 inflation chapter: no check implemented

The chapter is registered, extracted (28 pages, 27 tables) and validated. No table in it prints a figure that is the same
concept, period and unit as a series we hold, so no check was written:

- Body tables ("Disaggregated CPI-National/Urban/Rural Inflation (July-April)"): percent change **on average basis for
  July-April**; we hold June year-on-year and month-on-month changes. Not the same concept.
- Annex "Price Indices" by groups and "Headline & Core Inflation": **fiscal-year** indices and rates, the latest row
  "July-April". We hold monthly indices. Not the same concept (the brief's own example).
- Annex "Monthly percentage changes in CPI, WPI and SPI" (p.18), months by fiscal year, the only table with June values:
  (1) nothing on the page says whether the change is over the previous month or over the same month last year (a code
  search of the page text for year-on-year, YoY, month-on-month, "same month", "previous month", "corresponding" finds
  nothing), so the concept cannot be established; and (2) the extraction detectors flag the table `merged_rows` and
  `title_text_as_data` (57 rows x 18 columns with rotated side labels), so it would not be usable as evidence anyway.
- One candidate left for a human decision: the "Group Weights" column of the disaggregated tables is the 2015-16 base
  weight of each CPI group, which is what our `cpi.<area>.weight.*` series hold. It was not compared because our weight
  observations carry the issue month as their period and the chapter's table is a July-April table; whether a base
  weight "has" a period is a definition question.

## 7. Code changes, in short

- `sources.py`: `body_markers_all` / `body_markers_none` (whole-document markers); `inspect_data_file` and
  `register_data_file` for a CSV from a data service (hash against the recorded one, descriptive columns must match in
  every row, request / terms / credentials notes in the record); a non-PDF is never requested by GET; `fetch` does not
  write anything for a data file and does not fail the rebuild for a missing cross-source file.
- `datasets/cross_source.py` (new): SBP definition gate and provenance (`read_easydata_series`, `sbp_cpi_checks`);
  Economic Survey labour tables (`read_measures_by_year`, `read_years_by_measure`, `identity_problem_years`,
  `cell_pair_check`, `pair_checks`, `pes_labour_checks`).
- `datasets/cpi.py`: the 8-line SBP block in `build` replaced by one call. `read_sbp_yoy` and `cross_source_checks`
  are unchanged (`read_sbp_yoy` is no longer called by the build; its test remains).
- `datasets/lfs.py`: `unread_gap_reasons` (the skipped AJK file no longer explains 2014-15 gaps once the national
  report is read) and the call to `pes_labour_checks` in `build`. The chapter's cells are appended to the dataset's
  cells with no series id, so receipts can show them and they can never become an observation (tested).
- `status.py`: `disagreement_note` no longer crashes on a failed check with no member cell (one block).
- Tests: 244 pass (199 before; this track added 45).
- Release step, dry run only: `build_release` for CPI and LFS was run into a scratch folder outside the repo (never
  `releases/`) to see that the new sources and the chapter's cells do not break it. It completed and `check_release`
  reported 0 problems; the Economic Survey pages 24 and 25 are rendered as receipt pages. With the gate as it stands on
  this branch (before D25/D26) LFS is still "coming": cross-edition 270/276 = 0.9783 against 0.98.
  Note for the lead: `check_release` re-runs sums and cross-edition equalities but not `cross_source` results (it only
  tests that residual = observed - expected for them).

## 8. Not done, and why

- **PBS landing page search and Wayback as a source for LFS 2014-15:** not needed, the first URL was the national report.
- **A page-range run for LFS 2014-15:** not made, on purpose (55 pages; section 2).
- **A repeatable SBP pull:** needs an API key (HTTP 401). Written down for a human; not worked around. The registered
  CSV cannot be re-downloaded by URL.
- **SBP terms of use:** not confirmed; a human must read the Disclaimer page.
- **CPI vs Economic Survey inflation chapter:** no same-concept figure (section 6).
- **LFS participation rates for 2024-25 and the refined rate for any round:** no cross-source evidence in this chapter.
- **`DECISIONS.md`, `STATUS.md`, `README.md`, the release and the site:** not edited (the lead's files). The two
  decisions in 3.2 and the provisional choices below need a line in `DECISIONS.md` from the lead.
- **No gold-set or human spot check** of the new values.

Provisional choices made here (unattended, continuation run), for the lead to record:
full-document run for the 55-page LFS 2014-15; cross-source tolerance for LFS vs Economic Survey = half a unit of the
last printed digit of each figure (same form as the frozen CPI vs SBP rule); a chapter year is used only if the
chapter's own employed + unemployed = labour force; a missing cross-source data file does not fail `datalab fetch`.

## 9. Commands to rebuild

From `<repo>/pipeline`, with `.env` pointing `WORK_DIR` at the folder that holds the runs:

```
python -m datalab register --source lfs-pbs-2014-15-national --source pes-fed-2024-25-inflation --source pes-fed-2024-25-labour
python -m datalab register --source sbp-easydata-cpi-national-yoy     # needs the CSV already in SOURCES_DIR (see 1.2)
python -m datalab fetch                                               # PDFs by URL; the SBP CSV is reported, not fetched
python -m datalab extract --source lfs-pbs-2014-15-national           # only if the run is not copied; one at a time
python -m datalab extract --source pes-fed-2024-25-labour
python -m datalab extract --source pes-fed-2024-25-inflation
python -m datalab validate --source lfs-pbs-2014-15-national --source pes-fed-2024-25-labour --source pes-fed-2024-25-inflation
python -m datalab build --dataset cpi
python -m datalab build --dataset lfs
python -m pytest -q
```

Instead of the three `extract` lines, copy the three run folders named in section 2 from `work/tracks/sources/runs/`
into the main `work/runs/` (they are validated; the validator's mark is in each `manifest.json`).

## 10. Traps learned (also added to AGENTS.md section 7)

- PBS lists two files for LFS 2014-15; the one ending `-1.pdf` is the national report. A cover check is not enough to
  tell a regional edition from the national one; test the table titles too.
- SBP EasyData: the public download is a session-bound form POST, the API needs a key, and some months carry an
  unrounded figure (nine decimals) that a rounding rule can fail against a PBS figure printed to two.
- A cross-source check against a data file has no member cell; anything that walks `member_cell_ids[0]` must allow for it.
- Economic Survey chapters: the chapter title is only a running head (first on page 4); the title and the unit line
  sit just above the table box and leak into column headers collected by position unless the words are limited to the
  table box; the labour table's participation-rate row does not say crude or refined; the monthly percentage-change
  table does not say over which period.
- Two chapters of one Economic Survey get run ids that differ only in the run number.
- A scratch script run from outside `pipeline/` imports the main checkout's `datalab` and reads the main `.env`
  (seen here: a report script quietly read the main work folder). Run with `PYTHONPATH=.` from `pipeline/`.
