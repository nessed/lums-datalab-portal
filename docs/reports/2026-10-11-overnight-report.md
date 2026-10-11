# Overnight report: first prototype, 2026-10-11

Append-only log of the unattended run that executes
`docs/plans/2026-10-11-overnight-prototype.md`. Times are Pakistan time (PKT).
Pull request: https://github.com/nessed/lums-datalab-portal/pull/1

## M0 Setup (started 01:12)

- Checked out `proto/v0` (already pushed, 3 commits, docs only). PR #1 already existed for this
  branch (opened by the planning session, not a draft). It is reused as the single PR for the
  run: converted to draft and retitled, instead of opening a second PR.
- `.env` created locally (not committed). `SOURCES_DIR` is a new folder `datalab-sources` beside the repo.
- Thresholds written and frozen at 01:20, before any extraction: `thresholds/thresholds.yaml`,
  hash in `thresholds/FROZEN.md`.
- Decisions D1-D24 from the plan appended to `DECISIONS.md` as provisional.
- Python 3.12 venv at `pipeline/.venv`; Docling 2.119.0 install started.
- 01:26 Docling 2.119.0 installed in the 3.12 venv (docling-core 2.101.1, docling-parse 7.22.2,
  docling-ibm-models 3.15.0, PyMuPDF 1.28.2, pydantic 2.14.0). `pipeline/requirements.lock` written
  (115 packages). Note: docling-core and docling-parse are newer than in the August venv
  (2.91.0 / 7.13.0); pip resolved them for docling 2.119.0 tonight and they are now pinned.
- M0 done 01:28. First push and draft PR at 01:25.

## M1 Sources (01:28 to 01:58)

**All 9 ABS files were downloaded from the official Finance Division site tonight and verified.**
Nothing was taken from the archive.

| Source | Pages | Verification | How the file was identified | Official budget page links to this file | Wayback snapshot with the same bytes |
|---|---|---|---|---|---|
| abs-fed-2010-11 | 29 | official, identical to archive copy | contents page + link (no cover page in the file) | yes | 2025-06-19 |
| abs-fed-2011-12 | 31 | official, identical to archive copy | cover text | yes | none found yet |
| abs-fed-2016-17 | 33 | official, identical to archive copy | cover text (page 2; page 1 is an image) | yes | none found yet |
| abs-fed-2017-18 | 33 | official, identical to archive copy | contents page + link (cover is an image) | yes | 2025-05-27 |
| abs-fed-2021-22 | 50 | official, identical to archive copy | cover text | yes | 2026-08-03 |
| abs-fed-2022-23 | 54 | official, identical to archive copy | cover text | yes | 2025-07-08 |
| abs-fed-2024-25 | 59 | official, identical to archive copy | cover text | yes | none found yet |
| abs-fed-2025-26 | 54 | official, **differs from the Arsalan archive copy** | cover text | yes | 2025-11-03 |
| abs-fed-2026-27 | 57 | official, identical to archive copy | cover text | yes | none found yet |

Things worth knowing:

- **ABS 2025-26: the official file (2,645,541 bytes) is not the file in the Arsalan archive
  (2,665,102 bytes).** The official file is used. It is byte-identical to the Wayback snapshot of
  2025-11-03 and to the copy in the pbs-corpus registry, so the Arsalan copy is the odd one out
  (probably an earlier upload). Flagged `official_differs_from_archive`.
- **The 2010-11 file has no cover page and the 2017-18 cover is an image**, so the plan's title
  test ("Annual Budget Statement" in the first three pages) cannot pass for them. They were
  accepted on a second route with more evidence, not less: contents-page markers, the fiscal year,
  and a verified link to that exact file from the official budget page for that year. Recorded in
  DECISIONS.md; shown as a caveat on the source. **Ali/Ahmad: confirm or overturn.**
- **Deviation: ABS 2017-18 has a text layer on 31 of 33 printed pages (93.9%)**, under the 95%
  inspection level, because its front and back covers are pictures. Used anyway (it is the only
  edition that prints the 2016-17 revised estimates); the threshold was not changed. Recorded in
  DECISIONS.md. Blank pages (2, 4, 6 in newer editions) are left out of the fraction because
  nothing is printed on them.
- The tiny 2010-11 (66 KB) and 2011-12 (113 KB) files are complete: 29 and 31 pages, contents
  page present, the Summary of Expenditure located and read at 100% coverage.
- The plan's Wayback "availability" API returned nothing for these PDFs. The CDX index works and
  carries a content digest, so each snapshot above is proven to hold the same bytes as our file.
  Four files have no snapshot yet; a save is attempted at the end of the run.
- The archive's 2026-27 copy under "Budget Statements" is a 60 MB file; the official 2.4 MB
  file is used and equals the pbs-corpus copy.
- `python -m datalab fetch` rebuilds the sources folder from `sources/manifest.csv` and checks
  every hash (official URL first, then the recorded Wayback snapshot).
- Track A (CPI, LFS, SBP, PES sources) was started at 01:22 as a background subagent.

## M2 Schema, normaliser, tests, CI (01:20 to 01:50, overlapping M1)

- `pipeline/datalab/schema.py`: Source, Series, Cell, Observation, Check, RunManifest, Release as
  pydantic v2 models; JSON Schema exported to `schema/`; `docs/SCHEMA.md`.
- `normalise.py`: every rule from the tested `compare_values.py`, plus scale detection, percent
  and footnote marks, and the two-numbers-in-one-cell trap. Decimal throughout.
- 100 tests pass (normaliser rules, bbox origin conversion, the Docling failure detectors, every
  check and tolerance, status tiers, release self-consistency, schema sync, frozen-threshold hash).
- CI is green on GitHub Actions (tests, `check-release`, no-PDF/no-secret/no-absolute-path guard,
  site build once `site/` exists). CI installs `requirements-ci.lock` (the full lock minus
  Docling and its model stack) because extraction needs the PDFs, which are never in git.

## M3 Extract, validate, coverage (started 01:29)

- **Fallback taken:** the first Docling run (ABS 2010-11 run-01) failed on every page with
  `InvalidCxxCompiler: cl is not found`: torch tries to compile and there is no MSVC compiler on
  this machine. Fixed by setting `TORCHDYNAMO_DISABLE=1` (speed only; now part of the hashed
  config). Run-01 is kept as the recorded failure; run-02 is the valid one. Added to AGENTS.md traps.
- Speed on this CPU: about 5 minutes per ABS edition (8 s per page), run one after another.
- Overlay QA viewed for 2010-11 p.9 and 2011-12 p.11: every box sits on its number
  (`docs/reports/qa/`). The coordinate conversion is right.

### M3 results (done 02:36)

Nine fresh Docling runs, all validated (file hash unchanged, every page present exactly once,
error log empty). Three Docling processes were running at once from about 02:10 (ABS plus the
CPI and LFS tracks), which is why the last two ABS runs took longer.

| Run | Pages | Tables emitted | Seconds | Summary of Expenditure on page | Printed numbers in the table | Captured | Coverage |
|---|---|---|---|---|---|---|---|
| ABS_2010-11 run-02 | 29 | 28 | 242 | 9 | 92 | 92 | 100% |
| ABS_2011-12 run-01 | 31 | 29 | 274 | 11 | 90 | 90 | 100% |
| ABS_2016-17 run-01 | 33 | 30 | 359 | 12 | 90 | 90 | 100% |
| ABS_2017-18 run-01 | 33 | 30 | 294 | 11 | 89 | 86 | 96.6% |
| ABS_2021-22 run-01 | 50 | 35 | 339 | 17 | 75 | 75 | 100% |
| ABS_2022-23 run-01 | 54 | 33 | 761 | 15 | 84 | 84 | 100% |
| ABS_2024-25 run-01 | 59 | 40 | 317 | 17 | 87 | 85 | 97.7% |
| ABS_2025-26 run-01 | 54 | 39 | 284 | 17 | 87 | 87 | 100% |
| ABS_2026-27 run-01 | 57 | 33 | 619 | 17 | 87 | 84 | 96.6% |

**Coverage for ABS: 773 of 781 printed numbers captured = 98.98%.** No table under 90%. This is
"how much of the page we captured" only.

What was missed (8 numbers): in 2017-18 the three amounts of the last row ("Total Expenditure",
which repeats the grand total already captured two rows above); in 2024-25 and 2026-27 the small
row-numbering digits "1", "2", "3" printed beside the total rows. No amount that feeds a
published value is missing. No table was flagged for a dropped column, merged rows or title
text as data. The detector for "missing code column compared with sibling tables" was replaced
by an expected-column-count test plus the full-width coverage measure, because the target is one
table per document.

### M4 Locate and map (done 02:36)

- The function table ("Summary of Expenditure") was located in all 9 editions: score 10 of 10
  function names each time, no ties.
- **What the table is, which matters for how the demo is worded:** its ten function lines are
  *current expenditure on revenue account*. Development spending by function is not printed
  there. Series are named `fed.exp.current.function.<name>` and described that way everywhere.
- Column meaning (year, budget or revised) is read from the PDF text layer by position and must
  equal the three columns the edition is expected to print. It did in all 9.
- 630 cells, **all 630 mapped** to 30 series (`specs/abs.yaml`, `specs/abs_labels.yaml`). No
  unmapped label remains.
- Label problems found and handled without guessing:
  - Docling glued wrapped headings onto the next row (`Account General Public Services`,
    `Development Expenditure c. Dev. Exp. on Revenue Account`): listed explicitly in the dictionary.
  - Docling merged two label cells in 2011-12, and similar in 2016-17, 2017-18 and 2026-27
    (5 rows in all). For those rows the label is read from the text layer on the amount's own
    line (flag `row_label_from_text_layer`). The sum checks then confirm the mapping.
  - `07 Health*` in 2021-22 carries a printed footnote: "*An amount of Rs 100 billion has been
    allocated for COVID related expenditure". It is read from the page by code and shown on the
    three affected values as a note.

### M5 Checks, status, release (done 02:40)

340 checks, all evaluable:

| Check | Passed exactly | Within rounding | Failed |
|---|---|---|---|
| Functions add to current expenditure on revenue account (column total) | 8 | 19 | 0 |
| Sub-items add to their parent (hierarchy sum) | 28 | 2 | 0 |
| Accounting identities (a+b, c+d, grand total, break-up, PSDP total) | 122 | 25 | 0 |
| Same total printed twice on the page | 22 | 0 | 0 |
| Same figure in the next edition (cross-edition) | 111 | 1 | **2** |

- **Check pass rate 338 of 340 = 99.4%. Cross-edition agreement 112 of 114 = 98.2%** (frozen
  thresholds: 95% and 98%). ABS is published. Note how close the second one is: with eight
  editions in, before 2026-27 finished, agreement was 89 of 91 = 97.8% and the gate withheld the
  whole data type, as designed.
- **The two failures are a real restatement, not a misreading.** Budget 2021-22, as printed in
  the 2021-22 edition and again in 2022-23: Economic Affairs 115,243 then 114,201; Recreation,
  Culture and Religion 10,372 then 11,414. The same Rs 1,042 million moved from one line to the
  other, and both columns add up in both editions. Published: the figure from the 2021-22
  edition, with the disagreement stated on the receipt. **Humans to confirm** (DECISIONS.md).
- Status, by code: **535 published values (118 tier A, 417 tier B), 0 tier C, 0 tier D,
  2 labelled gaps** (both are lines the document prints as "-").
  Tier A is rarer than B because only a budget estimate is printed twice (in its own edition and
  the next one); a revised estimate is printed once, so it can only reach B.
- The 535 include 44 derived values (health and education as a share of total expenditure),
  computed by code from two published values each.
- Release `releases/v0.0.1-prototype/`: 9 page renders at 144 DPI (4.1 MB in total), cells,
  checks, observations (JSON, CSV, Parquet), sources with verification, run manifests, dataset
  card, reproduction steps, changelog, errata. `check-release` re-runs every sum and every status
  decision from the release's own files and passes; it runs in CI.
- Comparison with Arslan's `subcodes_long.csv`: **not done** (cut). Queued.
- Things a human should look at in the numbers: Health revised estimate 2021-22 is 154,889
  against a budget of 28,352 (it passes its column sum, and the
  footnote about COVID spending is on the same line in the 2021-22 edition); Health budget
  2011-12 is 2,646 after 7,283 in 2010-11 (devolution; the break is marked).

## M6 Site (track B 01:44 to 02:05; wired to the full ABS release 02:40)

- Built by a subagent on `proto/v0-site`, merged by the lead. Next.js 16.4 (create-next-app's
  current version; the plan said 15), TypeScript, Tailwind, fully static, hand-rolled SVG charts,
  no chart or UI library, no analytics, no client-side data fetching.
- Routes: `/`, `/browse`, `/series/[id]`, `/o/[id]` (receipt), `/sources`, `/sources/[id]`,
  `/methods`, `/releases`, `/about`, `/demo/health-and-jobs`.
- `npm run lint` clean, `npm run build` green: 537 receipt pages (535 values, 2 gaps), 30 series.
  `site/scripts/check-build.mjs` confirms every value receipt shows the printed value and the
  box, and no gap receipt shows a value.
- Receipt URLs replace ":" with "~" (`/o/fed.exp.current.function.health~2025-26~be`) because
  colons break static file paths on Windows.
- Screenshots in `docs/reports/qa/`: `site_home.png`, `site_series_health.png`,
  `site_receipt_health_2025-26_be.png`, `site_receipt_mobile.png`, `site_demo.png`. Looked at the
  receipt and demo: the box sits on 31,975 on page 17, the checks read as sentences, the
  devolution break is drawn and lines stop at it.
- Not done on the site: copy-to-clipboard on cite (it is a no-JavaScript block with APA, BibTeX
  and RIS); `siteUrl` in `site/release.config.json` is empty until the Vercel URL is known.
- ClickUp: no ClickUp tools are available in this session, so no comment was posted. The text
  to post is at the end of this report.

## M7 CPI (track A sources 01:22 to 02:09; track C pipeline 02:10 to 02:55; merged 02:57)

**Sources.** Planned Junes: 2016, 2018, 2021, 2023, 2025. Obtained: 2016 and 2019 (Wayback, base
2007-08), 2023, 2024, 2025, 2026 (official PBS site, base 2015-16). **June 2018 and June 2021 were
not obtained:** they exist only in the Wayback Machine and every download returned HTTP 429 (rate
limit). June 2019 and June 2024 stand in; June 2026 is a spare. The PBS price page lists reviews
only from July 2022 onward. All six files passed content inspection (title words and "June
<year>" in the first pages).

**Extraction.** Four issues validated. **June 2016 and June 2019 were refused by the scanned-track
rule:** each has three chart pages that are images, which is 25% and 23% of a 12 or 13 page file,
over the frozen 20% limit. Their table pages are born-digital. The rule was not bent. So
**nothing on the 2007-08 base is published**; those 154 expected figures are labelled gaps ("not
yet verified by us"). This needs a human decision.

**Located:** national (p. 8), urban (p. 9) and rural (p. 10) group tables in each of the four
issues: 12 tables. **Coverage: 1,695 of 1,695 printed numbers, 100% on every table.**

**Checks: 477, all evaluable, 0 failed.** Tolerances were committed before any result existed.

| Check | Passed |
|---|---|
| 12 group weights sum to 100 | 12 of 12 |
| General index recomputes from group indices and weights | 36 of 36 (largest difference 0.031 against a bound of about 0.17) |
| Year-on-year and month-on-month % recompute from the printed indices | 312 of 312 |
| Same index in the next June issue ("same month last year" column) | 117 of 117 |

**Published: 807 values (117 tier A, 690 tier B) in 178 series.** Sanity read of the headline
series by code output: national general index June 2022 175.71, June 2023 227.37, June 2024
255.94, June 2025 264.22, June 2026 293.47; printed year-on-year change 29.40, 12.57, 3.23, 11.07
per cent. Overlay viewed for 2025-06 p. 8: boxes sit on the numbers.

Not done for CPI: cross-source against SBP EasyData (the CSV was downloaded without login and is
in the sources folder, but it is not registered, so no comparison was run); food sub-rows and
"impact" columns are not mapped; the printed column label shown on CPI receipts is untidy
(for example "June 2025 last year by June 25") because it is collected from header words by
position; the values and their meaning are right, the label text needs cleaning.

A claim that the 2007-08 CPI was "urban only" had been drafted into the spec from general
knowledge. It was removed before release: nothing in the documents processed supports it yet.

## M8 LFS (track D 02:10 to 02:52; merged 02:50)

**Sources.** Five files downloaded from the official PBS site. **The file PBS serves as "LFS
2014-15" is the Azad Jammu and Kashmir edition, not the national report** (found by the LFS track
from the cover text). It now fails verification by a content marker and is not used. Four reports
remain: 2017-18 (54 pages), 2018-19 (408), 2020-21 (230), 2024-25 (205).

**Extraction.** 2017-18 full document. The three long reports as page-range runs under decision
D18: 2018-19 pp. 35-58; 2020-21 pp. 26-45 and 65-73; 2024-25 pp. 48-79 and 140-150. All six runs
validated. Page-range runs keep the original page numbers. No table on the first or last page of
a range is used.

**Located: 25 tables** (crude and refined participation rates, labour force, employed, industry
shares in all four reports; unemployment rates in three). **Coverage: 2,108 of 2,108, 100%.**

**Checks: 432 evaluable, 425 passed (98.4%).**

| Check | Passed | Failed |
|---|---|---|
| Male + female = total (counts) | 60 | 0 |
| Rural + urban = total (counts) | 60 | 0 |
| Accounting identities | 36 | 0 |
| Industry shares sum to 100 | 24 | 0 |
| Rate recomputes from counts | 53 | 1 |
| Same figure in the next report's previous-round column | 192 | **6** |

**LFS is NOT published.** Cross-edition agreement is 192 of 198 = 96.97%, under the frozen 98%.
All six disagreements are 2018-19 industry shares that the 2020-21 report prints differently
(PBS appears to have regrouped industries; a human question). The one recompute failure is the
2018-19 urban unemployment rate, 0.08 away from the value recomputed from the printed counts
against a bound of 0.0736; the bound was fixed first, so the failure stands. By evidence alone
335 LFS values would be tier A or B; because the data type is below a threshold, **all 372 LFS
observations are gaps in the release and the site shows LFS as "coming".**

Also worth knowing: LFS 2024-25 prints most tables twice (13th and 19th ICLS definitions); only
the 13th ICLS tables are mapped so that series stay on one definition, which means PBS's own
headline (19th ICLS) is not in the data. Every LFS series carries a "check comparability" break
at 2024-25: a recorded text search found no statement that the round is comparable with earlier
ones. Cross-source against the Economic Survey labour chapter was not attempted.

Details: `docs/reports/track_c_cpi_findings.md`, `docs/reports/track_d_lfs_findings.md`.

## M9 Demo and derived series (done 03:00)

- Derived by code from published values only: health and education (current, revenue account)
  as a share of total federal expenditure, 22 values each, formula on every receipt.
- `/demo/health-and-jobs`: health budget and revised estimates, the share of total, and the
  national CPI general index (base 2015-16). LFS shows as "coming". Every chart point and every
  number in the paragraph links to its receipt. The devolution break is drawn at 2011-12 and
  lines stop there and at missing years.
- Real-terms (deflated) series: not built. It needs a splice across the 2019 rebasing, which is
  a methodological choice for humans, and the pre-2019 CPI issues are not processed.

## M10 Handoff (03:00, figures updated 03:45 after the June 2021 CPI issue was added)

**Final release `v0.0.1-prototype`:** 2,165 observations: **1,419 published** (ABS 535, CPI 884),
746 labelled gaps (ABS 2 not printed by the government; CPI 372 not yet verified; LFS 372 not yet
verified or failed). 47 page renders, 25 MB. 199 tests pass. CI green. Site: 2,032 static pages.

**Gold kit:** `gold/` holds a blind sample of 398 cells drawn across all three data types
(seed 20261011) and a labelling page that runs from disk. **Unlabelled.** `datalab gold-score`
is written and scores two labellers' files.

**Cut or not done, in one list:**
- CPI on the 2007-08 base (June 2016, 2018, 2019): files verified, not processed (see the addendum).
- LFS publication (below threshold); LFS 2014-15 national report (PBS link serves the AJK edition).
- Cross-source checks: SBP EasyData for CPI, Economic Survey chapters for CPI and LFS, Arslan's
  dataset for ABS (it is at sub-function level from other tables, so not like-for-like).
- Full-document Docling runs for the three long LFS reports.
- pdfplumber second reader (no table was flagged, so nothing was routed to it).
- Real-terms toggle, oEmbed share card, copy-to-clipboard on cite.
- Wayback save for ABS 2026-27 (the save request returned HTTP 520); the other 8 ABS files have
  a snapshot whose content digest equals our file.
- ClickUp comment (no ClickUp tools in this session). Text to paste is below.

## Morning checklist for Ali

1. **Pull and read.** `git pull` on `proto/v0`; read `STATUS.md`, then this report; open PR #1
   (https://github.com/nessed/lums-datalab-portal/pull/1). CI should be green.
2. **See it locally (2 minutes).** `cd site; npm ci; npm run build; npm run start`, then open
   `/o/fed.exp.current.function.health~2025-26~be` (the receipt), `/series/fed.exp.current.function.health`,
   `/demo/health-and-jobs`, `/sources`, `/methods`.
3. **Create the Vercel project.** Import `nessed/lums-datalab-portal`; Root Directory `site`;
   framework Next.js; build command `npm run build`; Node 24; no environment variables;
   production branch `main`, so `proto/v0` deploys as a preview. The build reads `../releases/`
   from the repository. Local build: about 1 minute, 2,032 static pages. Afterwards put the URL
   in `site/release.config.json` (`siteUrl`) so citations point at the site.
4. **Confirm or overturn the provisional decisions** in `DECISIONS.md` (everything dated
   2026-10-11). The ones that change what is published:
   - ABS function lines are labelled "current, revenue account". Is that the series you want to lead with?
   - Restated figures are published from the first edition with a note (2 cases in ABS).
   - ABS 2010-11 and 2017-18 are identified without a readable cover; 2017-18 is used under a
     recorded deviation from the 95% text-layer level.
   - The scanned-page fraction is now measured over printed pages (blank pages left out), which
     admitted the June 2021 CPI issue. Confirm that definition.
   - CPI on the 2007-08 base is not processed: its table carries no national/urban label, so how
     to name those series is your call.
   - LFS is unpublished because 6 of 198 cross-edition pairs disagree. Decide whether a
     restatement by the publisher should count against the 98% threshold, or whether those six
     shares should be `disputed`.
5. **Label the gold set with Ahmad** (`gold/README.md`; open `gold/label.html`; about an hour for
   398 cells between two people), then
   `python -m datalab gold-score gold/labels_ali.csv gold/labels_ahmad.csv`. That gives the first
   measured error rate.
6. **Spot-check 10 receipts against the PDFs.** A list of 30 random published values with their
   receipt paths is in `docs/reports/spot_check.md`.
7. **Queued follow-ups** (`STATUS.md`): CPI on the 2007-08 base; register the national LFS
   2014-15 report; full-document LFS runs; SBP and Economic Survey cross-source checks; DOI;
   hosting our own copies of the PDFs; moving the repo to an organisation; branch protection with
   required CI; public repo or a form for error reports; LUMS name and logo sign-off.
8. **What to tell sir** (every figure is in the release; receipt paths in brackets):

   > We have a working first prototype of the DataLab portal. It reads official PDFs, checks
   > every number by arithmetic, and shows each number boxed on the government page it came
   > from. So far it publishes 1,419 checked values: 535 from nine federal Annual Budget
   > Statements and 884 from five PBS Monthly Reviews of Price Indices. As an example, the
   > 2025-26 budget estimate for federal current spending on health is Rs 31,975 million
   > [`/o/fed.exp.current.function.health~2025-26~be`], which is 0.13 per cent of total federal
   > expenditure of Rs 23,848,112 million [`/o/fed.exp.current.function.health.share_of_total~2025-26~be`,
   > `/o/fed.exp.total~2025-26~be`]; the national CPI stood at 264.22 in June 2025
   > [`/o/cpi.national.general.b2015_16~2025-06~na`]. The Labour Force Survey has been processed
   > but is held back because six figures disagree between two PBS reports, which is the system
   > working as intended. The error rate is not measured yet: that needs Ali and Ahmad to
   > hand-label about 400 cells. It is a prototype, not yet for citation.

## For Ahmad (reviewing with a different agent)

- Start with `pipeline/datalab/status.py` (60 lines decide what "checked" means), then
  `checks.py`, `specs/abs.yaml`, `datasets/abs.py`, and `release.py::check_release`.
- `python -m datalab check-release releases/v0.0.1-prototype` recomputes every sum and every
  status from the release's own files; it and the 199 tests run without Docling or PDFs
  (`pipeline/requirements-ci.lock`).
- To reproduce from the official sources on your machine: `releases/v0.0.1-prototype/HOW_TO_REPRODUCE.md`.
  `datalab fetch` needs only `SOURCES_DIR`; `RA_SHIP_DIR` is optional. One known gap: the four
  Wayback-only CPI files may be rate-limited when fetched.
- Things I would look at hardest: the label dictionaries (`specs/*_labels.yaml`), the
  text-layer fallbacks for column headers and row labels (`datasets/common.py`), the CPI
  aggregation tolerance in `specs/cpi.yaml`, and the LFS locator's handling of 13th vs 19th ICLS
  tables.
- The CPI and LFS builders were written by subagents and merged by the lead after the tests,
  the release self-check and a read of the headline series; they have had less review than ABS.

## Text for the ClickUp task (not posted: no ClickUp tools in this session)

> Status as of 2026-10-12: first prototype built on branch `proto/v0`, draft PR
> https://github.com/nessed/lums-datalab-portal/pull/1.
> Published in release v0.0.1-prototype: ABS (9 editions, 535 checked values), CPI (June 2021 and
> 2023 to 2026, 884 checked values). LFS processed but not published (cross-edition agreement 96.97%,
> threshold 98%). Coverage: ABS 98.98%, CPI 100%, LFS 100%. Checks passed: ABS 338/340, CPI
> 507/507, LFS 425/432. Error rate not measured: gold set of 398 cells is ready to label.
> Site builds statically (2,032 pages); Vercel project still to create (root directory `site`).
> Decisions to confirm are listed in DECISIONS.md; report in docs/reports/.

## Addendum 03:20 to 03:45: June 2021 and June 2018 CPI issues, and a measurement alignment

- A retry of the Wayback Machine succeeded for both planned issues that were missing. They are
  registered through the normal path (official address is dead, snapshot downloaded and
  recorded): `cpi-pbs-2021-06` (18 pages, base 2015-16) and `cpi-pbs-2018-06` (12 pages, base
  2007-08). Both are `wayback_only`, shown as a caveat.
- **Why the first June 2021 run was refused, and what changed.** Run-01 was refused as "scanned":
  4 of 18 pages have no text (22%). One of the four is a blank page. Source inspection has
  left blank pages out of the text-layer fraction since M1 (recorded in DECISIONS.md then);
  the extraction profile had not been updated to match. It now uses the same definition: only
  image pages count as scanned, over printed pages. June 2021 is then 3 of 17 = 17.6% and is
  processed (run-02). **This was changed after seeing that it would admit the issue**, so it is
  listed for confirmation. The 20% threshold itself is unchanged.
- Under the same definition the pre-2019 issues would also pass (18.2%, 18.2%, 16.7%). **They
  were deliberately not processed tonight:** the old-layout code has never run on real output,
  and the 2007-08 table carries no "national/urban" label, so naming those series is a human
  decision. They stay as labelled gaps.
- **June 2021 result:** the national table is clean (coverage 100%, all checks pass) and adds
  77 published values, including the general index for June 2020 (132.08), May 2021 (145.24)
  and June 2021 (144.82) and a printed year-on-year change of 9.65 per cent. **The urban and rural
  tables of that issue were read badly by Docling (merged rows, one column lost: 7 value columns
  instead of 8). The detectors flagged both, their checks did not run, and all their values are
  withheld.** This is the Docling failure mode described in AGENTS.md section 7, caught by code.
  A second reader (pdfplumber) for those two tables is the obvious follow-up.
- CPI totals now: 5 issues, 15 tables located (2 of them flagged and withheld), coverage 2,121
  of 2,121, 507 checks all passed (weights 13, index aggregation 39, recompute 338, cross-edition
  117), **884 published values (117 tier A, 767 tier B), 372 labelled gaps.**
- Receipts for CPI now show a clean printed column label (for example "Indices: June 25").
- Release totals after this: 2,165 observations, 1,419 published, 47 page renders, 25 MB; site
  2,032 static pages; gold sample redrawn (398 cells); spot-check sheet redrawn.
- Housekeeping: the three subagent worktrees were removed (their branches `proto/v0-site`,
  `proto/v0-cpi`, `proto/v0-lfs` remain on GitHub, fully merged). No background processes left running.
