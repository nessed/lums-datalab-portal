# Track D: Labour Force Survey pipeline, findings (2026-10-11, unattended)

Branch `proto/v0-lfs`. Code: `pipeline/datalab/datasets/lfs.py`, `specs/lfs.yaml`, `specs/lfs_labels.yaml`,
`pipeline/tests/test_lfs.py`. Output: `work/datasets/lfs/` (cells, checks, series, observations, coverage, info).
No value below was typed, corrected or judged by an LLM: Docling emitted the text, `normalise.parse_printed` parsed it,
the checks ran in code and `status.build_observations` decided.

## Headline result

| Measure | Number |
|---|---|
| Coverage (how much of the printed tables was captured) | 2,108 of 2,108 printed numeric tokens across 25 located tables = 100%; lowest single table 100% |
| Checks (how much of what was captured is right) | 432 evaluable, 425 passed (348 exact, 77 within rounding), 7 failed = 98.38% |
| of which cross-edition agreement | 198 evaluable, 192 agree, 6 disagree = **96.97%, below the frozen 98% threshold** |
| Observations | 372: 335 published (138 tier A, 197 tier B), 36 withheld `not_yet_verified` (tier C), 1 withheld `failed_checks` (tier D) |

Under the frozen thresholds LFS passes coverage (>= 95% / >= 90% per table) and the evaluable pass rate (>= 95%) but
**misses cross-edition agreement (96.97% < 98%)**. By the publication rule the data type is therefore "coming", not
published. Nothing was bent to change that. The six disagreements are all in one place (see "Disagreements").

## Runs

| Report | Run id | Mode | Pages | Docling time |
|---|---|---|---|---|
| 2014-15 | none | not extracted | | |
| 2017-18 | `LFS_2017-18__docling__full-document__run-01` | full document | 1-54 | 812 s |
| 2018-19 | `LFS_2018-19__docling__page-range__run-01` | page range (D18) | 35-58 | 333 s |
| 2020-21 | `LFS_2020-21__docling__page-range__run-01` | page range (D18) | 26-45 | 208 s |
| 2020-21 | `LFS_2020-21__docling__page-range__run-02` | page range (D18) | 65-73 | 189 s |
| 2024-25 | `LFS_2024-25__docling__page-range__run-01` | page range (D18) | 48-79 | 315 s |
| 2024-25 | `LFS_2024-25__docling__page-range__run-02` | page range (D18) | 140-150 | 99 s |

All six runs validated (hash unchanged, pages accounted for, empty error log). Page numbers in page-range output are
the ORIGINAL page numbers (checked by code against the range and by eye on overlays), so no offset is applied.
Every located table sits at least 3 pages inside its range; the builder refuses any table on the first or last page
of a range (`lfs.usable_pages`). `2020-21 run-02` (pp. 65-73) holds no target table (see below).

**Follow-ups to queue in STATUS.md:** full-document runs for 2018-19 (408 pp), 2020-21 (230 pp) and 2024-25 (205 pp).
When they exist the builder uses them automatically (newest validated run per page).

## Tables located (page, coverage)

All located tables: coverage 1.0, row-band coverage 1.0, no detector flags, no unmapped labels, columns mapped.

| Table kind | 2017-18 | 2018-19 | 2020-21 | 2024-25 (13th ICLS) |
|---|---|---|---|---|
| Crude participation rates | p.30 | p.38 | p.33 | p.60 |
| Refined participation rates | p.32 | p.40 | p.35 | p.64 |
| Civilian labour force (million) | p.34 | p.43 | p.32 | p.58 |
| Employed (million) | p.35 | p.44 | p.38 | p.72 |
| Employed by major industry division (%) | p.35 | p.44 | p.39 | p.76 |
| Unemployment rates by area and sex | p.44 | p.53 | not printed in this layout | p.145 |
| Unemployed (million) | p.46 | p.55 | not located | not located |

Each table prints the previous round beside its own, so 2014-15 figures come from the 2017-18 report and each of
2017-18, 2018-19 and 2020-21 is printed twice (cross-edition check). Only the Pakistan / Rural / Urban rows are
mapped; the provincial rows (12 per table) are recognised and left unmapped (out of scope). The "Augmented" columns
of the 2017-18 and 2018-19 participation tables are recognised from the header and left unmapped.

Overlays: `work/qa/overlay_lfs-pbs-<round>_p<page>_t<n>.png` (25 files). Looked at 2017-18 p.44, 2018-19 p.53,
2020-21 p.33, 2024-25 p.145: boxes sit on the numbers.

## Checks by type

| Check | Evaluable | Pass | Within rounding | Fail |
|---|---|---|---|---|
| row_total (male + female = total, counts) | 60 | 54 | 6 | 0 |
| column_total (rural + urban = total, counts) | 60 | 58 | 2 | 0 |
| accounting_identity (employed + unemployed = labour force) | 36 | 24 | 12 | 0 |
| recompute (unemployment rate from printed counts) | 54 | 0 | 53 | 1 |
| weights_sum (industry shares add to the printed Total 100.0, tolerance 0.1) | 24 | 23 | 1 | 0 |
| cross_edition (same round printed in the next report) | 198 | 189 | 3 | 6 |

No check was `not_evaluable`. Tolerances were written into `specs/lfs.yaml` before the first build:
sums per D9; equality within 1 unit of the last digit; shares 0.1 (frozen threshold); recompute bound
`dR + 100 x (dU/L + U x dL/L^2)` where dR, dU, dL are half a unit of the last printed digit of the rate and the two
counts (when the unemployed count is not printed, `U = L - E` and the same formula with E).

### Disagreements (recorded, not hidden)

- **cross_edition, 6 fails, all 2018-19 industry shares.** The 2018-19 report (p.44) and the 2020-21 report (p.39,
  "2018-19" columns) print different shares for agriculture (male), community/social/personal services (total, male,
  female) and "Others" (total, male). Differences 0.2 to 1.4 points. The footnote defining "Others" differs between
  the two reports, which suggests PBS regrouped industries; this is a human question. The six observations are
  currently still published at tier B with the 2018-19 report's value, because `status.decide_tier` publishes when
  another check (the shares sum) passes. **The lead should decide whether such figures should carry the public status
  `disputed`**; that is a rule in `status.py`, not changed here.
- **recompute, 1 fail.** Unemployment rate, both sexes, urban, 2018-19: the printed counts give 1.79 / 22.89 x 100 =
  7.82, the table prints a figure 0.08 away, the bound is 0.0736. Withheld (tier D, `failed_checks`). The two counts
  involved stay published because their own sums pass. Likely rounding of the published counts, but the bound was
  fixed first, so the fail stands.

## What is published and what is withheld

| Round | Published | Withheld |
|---|---|---|
| 2014-15 (from the 2017-18 report only) | counts 27, unemployment rate 9, industry shares 24 (tier B) | 18 participation rates: printed once, no check covers them (`not_yet_verified`) |
| 2017-18 | all 78 (60 tier A, 18 tier B) | none |
| 2018-19 | 77 (36 A, 41 B) | 1 unemployment rate (urban, both sexes): `failed_checks` |
| 2020-21 | 69 (42 A, 27 B); unemployment rates come from the 2024-25 report's "2020-21" columns | no unemployed counts located |
| 2024-25 | counts 18, unemployment rate 9, industry shares 24 (tier B) | 18 participation rates: printed once, no check (`not_yet_verified`) |

All withheld headline figures are labelled `not_yet_verified`; none is claimed `not_in_source`.

## Things a human must know

1. **The registered 2014-15 file is the Azad Jammu & Kashmir edition** (cover and table titles say "AZAD JAMMU &
   KASHMIR", found by text search). It is not extracted and nothing is mapped from it. Pakistan 2014-15 figures come
   only from the previous-round columns of the 2017-18 report. The Pakistan 2014-15 report should be registered.
2. **2024-25 prints most tables twice: 19th ICLS and 13th ICLS.** Only tables whose title or header says "13th ICLS"
   are mapped, so the series stay on one definition across rounds. The 19th ICLS tables (pp. 57, 71, 76 and others)
   are rejected by code (`other_definition`). The 19th ICLS headline (the one PBS leads with) is therefore NOT in this
   dataset; adding it needs separate series, a human decision.
3. **Comparability text search (2024-25 report).** Pattern `comparab` occurs on pp. 7, 9, 17, 48, 52, 58, 60, 64, 69,
   72, 74, 75, 76, 78. No sentence matches the "is comparable with earlier rounds" pattern and none matches "not
   comparable". The mentions say the 13th ICLS figures are given "for comparability with LFS 2020-21". That is about
   definitions, not the sampling frame, so the `check_comparability` break at 2024-25 is KEPT on every series. Patterns
   and snippets are stored in `info.json` under `comparability_text_search`.
4. The 2014-15 and 2020-21 unemployment rates are published on arithmetic evidence only (recomputed from counts in the
   same report), each from a later report's previous-round column.
5. "Agriculture, forestry & fishing" (2024-25) and "Agriculture/forestry/hunting & fishing" (earlier) are mapped to one
   series by the label dictionary. The composition of "Others" changes between reports (footnotes).
6. The "Total 100.0" row of the industry table is a series (`lfs.employment_share.industry.all.*`); the site may want
   to hide it.

## Not done

- 2020-21 unemployment-rate and unemployed tables in the 2020-21 report itself: that report prints them in a
  different layout ("Key labour market indicators", p.29; "Profile of the unemployed", p.68) which the builder does
  not parse. Parsing the key-indicator tables (2020-21 p.29, 2024-25 p.52) would also give a second printing of the
  refined participation rate and so a cross-table check for the 2024-25 participation rates now withheld.
- cross_source vs the Economic Survey labour chapter: not attempted. Needed: the PES chapter registered with
  `role: cross_source`, a Docling run, a locator for its labour-force table and a mapping to the same series ids;
  then `equality_check(check_type="cross_source", ...)`. It would lift 2014-15 and 2024-25 participation rates out
  of `not_yet_verified`.
- No test drives `build_cells` end to end (it needs a PDF text layer); its parts are tested separately.
- Provincial rows, age-specific tables, occupation tables, the statistical appendix: out of scope.

## Traps learned (for AGENTS.md section 7)

- **LFS 2014-15 on the PBS page is the AJK edition**; check the cover text before trusting a file name.
- **LFS 2024-25 has two definitions (13th and 19th ICLS) of nearly every table**, sometimes on the same page (p.76).
  A locator that matches on the title alone picks up both.
- **"Unemployed - Pakistan and Provinces" contains "employed - Pakistan and Provinces"**; title patterns need a word
  boundary. The occupational-injuries and informal-sector tables also say "by major industry divisions".
- **Docling marks a full-width block heading ("Pakistan") as a column header** in one table (2024-25 p.145) and as a
  body row in its siblings. Row context must not depend on the header flag.
- **Bare "Rural"/"Urban" labels repeat for every province.** They are attributable only through the block they sit
  in; an unknown row must break the block.
- **Docling page-range runs keep original page numbers** (docling 2.x `page_range`), so receipts need no offset.
- **Two agents sharing one scratch folder overwrite each other's logs** (`extract.log` collided with the CPI track).
- Docling ran at about 10-15 s/page with three extractions in parallel on this CPU.

## Decisions taken (provisional, unattended, 2026-10-11)

- Participation rate is kept as two measures, `lfs.lfpr_crude.*` and `lfs.lfpr_refined.*`, because both are printed.
- 2024-25 is mapped on the 13th ICLS tables only.
- 2014-15 source skipped as the wrong edition; its headline gaps are `not_yet_verified`.
- Gaps for missing headline figures are always `not_yet_verified`.
- A page-range run never supplies its first or last page.
- Core change: `status.evidence_sentence` gained a branch for `recompute` checks so receipts say "recomputed from"
  instead of "sum of" (additive; other check types unchanged).
