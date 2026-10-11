# Track "e-tools": sanity report, source-change check, release diff, hardening (E5, E6, E7, E10)

Branch `proto/v0-e-tools`, cut from `proto/v0` at `9a4736b`. Plan: `docs/plans/2026-10-12-continuation.md`,
section 6, items E5, E6, E7 and E10. Nothing in `site/`, `releases/`, `thresholds/`, `gold/`, the dataset
builders, `status.py`, `checks.py` or `schema.py` was edited. No Docling run was started. No file was
written to `SOURCES_DIR` or the ra-ship archive.

No value, check result, tier or status was produced, changed or judged by a language model. Every
number in this note was printed by one of the commands below.

## 1. What was built

| Command | Module | What it does | Writes |
|---|---|---|---|
| `python -m datalab sanity [--version V]` | `pipeline/datalab/sanity.py` | A report for humans from a release folder only: large changes and changes of sign between periods (never across a series break), series that some documents print and others do not, checks that passed only just, normalisation flags behind published values, disputed figures, counts. | `docs/reports/sanity_<release date>.md` and nothing else |
| `python -m datalab watch --dry-run [--source ID] [--save-to-wayback]` | `pipeline/datalab/watch.py` | One HEAD request per official file. A download to a temporary folder and a hash compare only when the length differs or the server gives none. Prints a table, exits with 0. | nothing (the temporary file is deleted) |
| `python -m datalab diff-release A B` | `pipeline/datalab/diff_release.py` | Says whether two release folders hold the same sources, series, cells, checks and observations. Run ids, timestamps and the commit are listed apart. Exit code 1 if the data differ. | nothing |
| `pipeline/scripts/reproduce.ps1 -ScratchDir <folder outside the repo> -Version <V>` | the script | Clean clone, fresh environment, fresh sources, new runs, release, then `diff-release` against the committed release. **Written and parsed, not run** (hours of Docling time; the lead decides when). | only under the scratch folder |
| `python -m datalab gold-score A.csv B.csv [--out FILE]` | `pipeline/datalab/gold.py` | Reworked: see section 5. | `gold/score.json`, or the file given with `--out` |
| `python scripts/gen_walkthrough.py` (from `pipeline/`) | the script | Writes `docs/HOW_A_NUMBER_GETS_ON_THE_SITE.md` from the release files. | that one document |

All commands run from `pipeline/`. `A` and `B` of `diff-release` can be a path, a path relative to the
repository, or a version name under `releases/`.

Tests: 403 pass and 16 are expected failures (the 16 were there before). Before this track: 321 pass. New
test files: `test_sanity.py`, `test_watch.py`, `test_diff_release.py`, `test_cli_tools.py`,
`test_gold_score.py`, `test_normalise_properties.py`. The watch tests use a fake transport and never
touch the network. The gold tests write only to pytest's temporary folder.

## 2. Sanity report (E6)

`docs/reports/sanity_2026-10-10.md`, for `releases/v0.0.1-prototype` as built at commit `839584b`.
It is a list of places to look, not a list of errors.

Counts printed by the command: 2,488 period comparisons made; 126 skipped at a series break (75 ABS
pairs 2010-11 against 2011-12, 51 LFS pairs 2020-21 against 2024-25); 484 changes above 50% (298 ABS
rupee figures, 170 CPI percentage changes, 9 CPI indices, 3 ABS shares, 3 LFS shares, 1 LFS count);
48 changes of sign (all CPI percentage changes); 3 figures that follow a zero; 405 series absent from
at least one document of their data type; 865 checks passed within rounding, 84 of them above 80% of
what their rule allows and 16 whose allowance the record does not state; 10 cells behind published
values carry a normalisation flag (all `bracket_negative`, all the operational shortfall line of
2010-11 and 2011-12); 11 disputed figures.

How a comparison is chosen: fiscal years with the year before; months with the month before and with
the same month a year before; survey rounds with the round before. Always the same series and the same
vintage, and only when both figures are published. A gap year is not bridged.

The ten things most worth a human look (receipt paths are in the report):

1. **Two published rupee figures with a decimal point in a table of whole millions.**
   `fed.exp.current.function.recreation_culture_and_religion.recreational_and_sporting_services`, 2020-21:
   budget estimate `0.4` and revised estimate `0.2`, both from the Annual Budget Statement 2021-22 p.20,
   both tier B. They are the only two of the 2,111 published ABS rupee values that are not whole numbers.
   The next year's revised estimate is 1,042 (a change of 520,900%), and the 2021-22 budget estimate of the
   same line is one of the disputed figures (0.3 in one edition, 1,042 in the next). 1,042 is also the
   amount by which the two disputed function totals differ. Open p.20 and read the line.
2. **`...education_affairs_and_services.education_not_elsewhere_classified`**: revised estimate 1,426 for
   2024-25, then 55,973 for 2025-26 (ABS 2025-26 p.20 and ABS 2026-27 p.20).
3. **`fed.exp.current.function.housing_and_community_amenities.housing_development`**: budget estimate
   30,720 for 2021-22, then 969 for 2022-23; revised 5,353 for 2020-21, then 510; later 1,588, then 143.
4. **`...social_protection.social_protection_administration`**: current, budget estimate 21,763 for
   2020-21, then 2,018 for 2021-22 (same page, ABS 2021-22 p.20); development, 750 for 2022-23, then
   18,467 for 2023-24.
5. **`fed.exp.development.capital_account.function.general_public_services.research_and_development_general_public_services`**:
   25,256 for 2024-25, then 761 for 2025-26 (ABS 2025-26 p.24, both vintages).
6. **`fed.exp.current.function.environment_protection.pollution_abatement`**: 200 for 2023-24, then 6,290
   for 2024-25; and the PSDP environment protection line: 12, then 573 (revised), 40, then 1,027 (budget).
7. **Headline lines that more than doubled**: `fed.exp.current.capital_account`, budget estimate 1,601,211
   for 2021-22, then 4,036,273 for 2022-23; `fed.exp.current.revenue_account`, 8,707,970 for 2022-23, then
   13,344,395 for 2023-24. Large changes in totals are the first thing a reader will ask about.
8. **CPI alcohol and tobacco index, June 2022 to June 2023**: +109.5% national (170.27 to 356.77), +107.6%
   urban, +111.8% rural; and the transport year-on-year rate, 0.46 in June 2025, then 28.12 in June 2026
   (urban; 0.61 to 25.72 national).
9. **Series that drop out of single editions.** Only 22 of 205 ABS series are printed in all nine
   editions. The pattern worth a look is 15 sub-function series (defence administration, military defence,
   administration of general public services and others) absent from the 2010-11, 2017-18 and 2021-22
   editions only, and 9 LFS unemployment-rate series absent from the 2020-21 report only. Those read like
   a table that was not located or was withheld, not like a change by the publisher.
10. **Checks that used their whole allowance.** 36 of the 37 accounting identities that passed within
    rounding are at 100% of the allowance, as are all 6 row totals, 9 column totals and 16 hierarchy sums
    listed. Nearly all are two amounts that miss their total by exactly 1 (allowance 0.5 x 2 x 1 = 1), so
    for a two-item sum "within rounding" and "off by one" are the same thing. The LFS industry shares of
    2020-21 (p.39) add up 0.1 away from 100, the whole of their allowance, and two LFS unemployment rates
    recompute at 92% of theirs. The 7 cross-edition pairs one unit apart are the open question already in
    `STATUS.md`.

Also in the report and worth knowing: the two disputed CPI indices of June 2018 differ by 0.02 in
opposite directions (253.49 against 253.51; 236.58 against 236.56).

## 3. Source-change check (E7)

Run once, for real, on 2026-10-11 (machine clock), with `python -m datalab watch --dry-run`. 25 HEAD
requests, no download was needed, nothing was written. `--save-to-wayback` was not used.

| Source | HTTP | Result | Decided by | Last-Modified | Server length | Manifest size | Note |
|---|---|---|---|---|---|---|---|
| abs-fed-2010-11 | 200 | unchanged | same length (HEAD) | Mon, 08 Jun 2015 07:22:16 GMT | 66,238 | 66,238 |  |
| abs-fed-2011-12 | 200 | unchanged | same length (HEAD) | Sat, 04 Jun 2011 07:17:37 GMT | 112,873 | 112,873 |  |
| abs-fed-2016-17 | 200 | unchanged | same length (HEAD) | Fri, 03 Jun 2016 17:25:25 GMT | 1,032,138 | 1,032,138 |  |
| abs-fed-2017-18 | 200 | unchanged | same length (HEAD) | Mon, 29 May 2017 06:40:01 GMT | 1,087,862 | 1,087,862 |  |
| abs-fed-2021-22 | 200 | unchanged | same length (HEAD) | Fri, 11 Jun 2021 14:54:48 GMT | 724,184 | 724,184 |  |
| abs-fed-2022-23 | 200 | unchanged | same length (HEAD) | Thu, 30 Jun 2022 17:59:14 GMT | 4,313,224 | 4,313,224 |  |
| abs-fed-2024-25 | 200 | unchanged | same length (HEAD) | Tue, 25 Jun 2024 06:39:57 GMT | 3,111,490 | 3,111,490 |  |
| abs-fed-2025-26 | 200 | unchanged | same length (HEAD) | Tue, 10 Jun 2025 16:05:51 GMT | 2,645,541 | 2,645,541 |  |
| abs-fed-2026-27 | 200 | unchanged | same length (HEAD) | Fri, 12 Jun 2026 16:24:16 GMT | 2,380,926 | 2,380,926 |  |
| cpi-pbs-2016-06 | 404 | unreachable | HEAD |  |  | 575,248 | HTTP 404 |
| cpi-pbs-2018-06 | 404 | unreachable | HEAD |  |  | 1,217,333 | HTTP 404 |
| cpi-pbs-2019-06 | 404 | unreachable | HEAD |  |  | 1,270,182 | HTTP 404 |
| cpi-pbs-2021-06 | 404 | unreachable | HEAD |  |  | 741,266 | HTTP 404 |
| cpi-pbs-2023-06 | 200 | unchanged | same length (HEAD) | Wed, 24 Jan 2024 06:28:00 GMT | 1,342,112 | 1,342,112 |  |
| cpi-pbs-2024-06 | 200 | unchanged | same length (HEAD) | Fri, 18 Oct 2024 08:42:12 GMT | 1,014,978 | 1,014,978 |  |
| cpi-pbs-2025-06 | 200 | unchanged | same length (HEAD) | Wed, 09 Jul 2025 08:20:35 GMT | 954,049 | 954,049 |  |
| cpi-pbs-2026-06 | 200 | unchanged | same length (HEAD) | Wed, 01 Jul 2026 08:59:35 GMT | 1,627,486 | 1,627,486 |  |
| lfs-pbs-2014-15 | 200 | unchanged | same length (HEAD) | Fri, 01 Mar 2024 08:27:25 GMT | 874,842 | 874,842 |  |
| lfs-pbs-2014-15-national | 200 | unchanged | same length (HEAD) | Mon, 01 Apr 2024 08:44:23 GMT | 1,111,773 | 1,111,773 |  |
| lfs-pbs-2017-18 | 200 | unchanged | same length (HEAD) | Fri, 01 Mar 2024 08:26:34 GMT | 1,615,654 | 1,615,654 |  |
| lfs-pbs-2018-19 | 200 | unchanged | same length (HEAD) | Fri, 01 Mar 2024 08:21:49 GMT | 8,176,939 | 8,176,939 |  |
| lfs-pbs-2020-21 | 200 | unchanged | same length (HEAD) | Fri, 01 Mar 2024 08:20:37 GMT | 15,154,629 | 15,154,629 |  |
| lfs-pbs-2024-25 | 200 | unchanged | same length (HEAD) | Thu, 26 Mar 2026 16:47:10 GMT | 9,425,530 | 9,425,530 |  |
| pes-fed-2024-25-inflation | 200 | unchanged | same length (HEAD) | Mon, 09 Jun 2025 09:18:31 GMT | 1,420,442 | 1,420,442 |  |
| pes-fed-2024-25-labour | 200 | unchanged | same length (HEAD) | Mon, 09 Jun 2025 09:18:08 GMT | 1,411,414 | 1,411,414 |  |
| sbp-easydata-cpi-national-yoy |  | no official url | not requested |  |  | 16,278 | the recorded address is a data-service form, not a file that can be requested by URL |

Summary: 21 unchanged, 0 changed, 4 unreachable, 1 no official url (26 manifest rows).

Reading the table:

- The four unreachable files are the four CPI issues the manifest already records as taken from the
  Wayback Machine. Their official PBS addresses answer 404. That is the known state, not a new change.
- "Unchanged" by length is weaker than "unchanged" by hash: a file reissued with exactly the same number
  of bytes would not be noticed. The task set this rule (download only when the length differs or is
  missing); a `--always-hash` switch would be a small addition if the lead wants it.
- The file served for the 2010-11 budget statement was last modified in June 2015, five years after that
  budget. It still has the registered size; the date is only noted here.
- The tool sends a User-Agent that names the project and its repository. Both government servers answered
  it with 200. Rate: at least 2 seconds between two requests to one host (`www.` is treated as the same
  host), one HEAD and at most one GET per file, no retries.
- It runs once and exits. It is not scheduled and must not be scheduled from a session (CLAUDE.md).
  Without `--dry-run` it prints one line and exits with 2, because no writing mode exists.

## 4. Release diff and reproduction (E5)

`diff-release` matches cells by where they are (source, page, table, row, column, and the reader, because
a second reader's cell can sit on the same spot as the first reader's), checks by type, rule and the
positions of their cells, and observations by id. So new run ids, new cell order or new check ids do not
count as differences. Box coordinates may differ by up to 1e-4. It prints counts and the first 20
differences of each kind. Page-image hashes, tool versions, the settings hash and the thresholds hash
are listed under "other metadata" when they differ and do not change the verdict; the lead may want the
thresholds hash to count.

Checked here: the committed release against itself gives no differences and no expected differences.

`reproduce.ps1` was read through and parsed by PowerShell (0 parse errors) but **not run**. Things a
reader should know before running it:

- It clones the committed state of the current branch, sets `SOURCES_DIR` and `WORK_DIR` for its own
  process (values already set in the shell would otherwise win over the clone's `.env`), and stops if
  Python imports `datalab` from anywhere but the clone.
- `datalab all` alone cannot rebuild this release: it would make full-document runs of the 200 to 400
  page LFS reports, where the release used page-range runs (D18), and it does not extract the Economic
  Survey chapter. The script therefore first makes the page-range and cross-source runs listed in the
  release's own `runs/*.manifest.json`, then runs `datalab all` for `abs`, `cpi` and `lfs` (the last
  with `--reuse-runs`).
- **A bug found while writing it, fixed in `cli.py`:** `datalab all --dataset lfs` could never finish,
  because it handed `extract` the source that failed verification (the AJK edition filed as LFS 2014-15)
  and `extract` stops the command on such a file. `all` now skips a failed source and says so.
- What cannot be fetched by URL, and what the script does (also in its header): the SBP CSV is not
  fetched; without `-SbpCsv` the CPI-against-SBP checks are skipped and will appear in the diff, which
  then exits with 1 for that reason alone. With `-SbpCsv`, a copy is accepted only if its SHA-256 equals
  the manifest's. For the four Wayback-only CPI files, `datalab fetch` is tried up to three times, ten
  minutes apart; if a file still cannot be obtained with the right hash the script stops with exit code
  2 before any extraction.
- Expect about three hours of Docling time (the sum of the run durations stored in the release is
  about 10,700 seconds), plus the model download on the first run.

## 5. Hardening (E10)

**Property-based tests** (`hypothesis==6.168.5` and its one dependency `sortedcontainers==2.4.0`,
installed with pip into the venv and recorded in `requirements.lock` and `requirements-ci.lock`). They
run derandomised, so every machine tests the same inputs. Properties: a formatted decimal reads back as
itself, with thousands separators, brackets, a unicode minus, footnote marks or a percent sign; text
holding two numbers never yields a value; parsing never raises on arbitrary text.

**They found a real bug, which is fixed.** `parse_printed("2015 -16.3")` returned 0.3: a year and the
figure -16.3 merged into one cell were read as the fiscal-year label 2015-16 followed by ".3", and the
only flag was `fiscal_year_masked`, which does not block publication. The same happened with
"2015 -16,300" (read as 300). `parse_printed` now masks a year label only when it is not the front of a
longer number; such a cell gets `merged_cell_suspected` and no value. Proof that nothing in the release
moves, from a script run here: all 5,017 distinct printed texts in `cells.json` (values, row labels and
column labels) parse identically with the old and the new function, and a fresh parse of every
`value_raw` equals the stored `value_parsed` and `is_missing` (0 of 9,708 cells differ). `check-release`
is still ok.

Left alone on purpose, for the lead: `normalise.numeric_tokens`, which the coverage count uses, still
masks such a pair as a year label. Changing it could move a coverage figure, and coverage feeds a
threshold, so it is not this track's change to make.

**gold-score.** Read, tested on synthetic label files, and reworked:

- The error rate is computed only from cells that every labeller could read and on which all typed the
  same reading, and it needs at least two labellers (before, one label file made every cell "agreed").
- Everything else is counted apart under `not_scored` and never enters the rate: labelled by some
  labellers only, unreadable for all, unreadable for some, a label that is not one number, labellers who
  read different numbers, cell ids the release does not hold. The counts add up to the cells labelled.
- Inter-rater agreement per pair of labellers, on the outcome "my reading matches the extracted value":
  raw agreement and Cohen's kappa over the cells both could read, and again with "unreadable" as a third
  category. Kappa is reported as undefined when both used one category throughout.
- An agreed human reading of a cell for which the release holds no value still counts as an error, as
  before, and is also counted on its own (`errors_where_extraction_has_no_value`).
- The old keys of `score.json` are kept. `gold/` was not touched: `gold/README.md` step 7 still
  describes the old, shorter output and a human may want to add the new fields to it.

**`docs/HOW_A_NUMBER_GETS_ON_THE_SITE.md`** follows `fed.exp.current.function.health:2025-26:be`
through eleven steps. It is written by `pipeline/scripts/gen_walkthrough.py`, which reads every value
from the release files and prints it beside its file and field. One thing it surfaced: the run manifest
of ABS 2025-26 stores a scanned-page share of 0.0556, which is its three blank pages over 54 pages (the
run was profiled before blank pages were counted apart). The document says so.

**`docs/GLOSSARY.md`**: 83 entries, one or two sentences each.

## 6. Not done, and why

- **`reproduce.ps1` was not run**, as instructed. Until it is, "anyone can rebuild it" is still untested.
- **Regression fixtures cut from real run JSON** (named in the plan's E10 line, not in this track's
  brief): not made. They need a decision on which excerpts may be committed.
- **`STATUS.md`, `DECISIONS.md`, `AGENTS.md`, `README.md`**: not edited, to avoid colliding with the
  lead's and the other tracks' edits. Suggested lines are below.
- **Wayback save on change** exists behind `--save-to-wayback` and is tested with a fake; it was not
  used in the real run and has never made a real request.
- **The sanity report has no section for "a figure with decimals in a column of whole numbers"**, which
  is how item 1 above would best be caught. It was found here by a one-off script. A section would be a
  small addition.

## 7. For the lead to record

Provisional choices made here (unattended, 2026-10-12):

- `watch`: a data-service form address counts as "no official url"; a 200 answer whose body is not a PDF
  counts as "unreachable", not "changed"; a HEAD refused with 403, 405 or 501 is followed by one GET.
- `sanity`: comparison partners as in section 2; a cross-source rule that does not state its allowance
  as a number is listed by residual, not by share.
- `diff-release`: the reader is part of a cell's identity; page-image hashes and tool versions do not
  affect the verdict.
- `gold-score`: at least two labellers for an error rate; an unparseable label is its own bucket.
- `parse_printed`: a year label glued to a longer number is not masked.
- `datalab all` skips a source that failed verification.

Traps worth a line in `AGENTS.md` section 7:

- A year next to a negative decimal in one cell ("2015 -16.3") looks like a fiscal-year label to the
  mask. `parse_printed` now refuses it; `numeric_tokens` still masks it.
- `datalab all --dataset lfs` makes full-document runs and knows nothing of the page-range runs or the
  Economic Survey chapter; the runs a release was built from are in its `runs/*.manifest.json`.
- `config` reads `SOURCES_DIR` and `WORK_DIR` from the environment before `.env`, so a value left in the
  shell silently points a clone or a worktree at another folder.
- Git Bash heredocs also choke on Python source with apostrophes inside triple-quoted strings; write
  such files with a file tool.
- `pip install` into the shared venv took over 20 minutes and had to be restarted while other tracks'
  Docling runs held every core.
