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
