# Track E3: LFS depth, provincial rows (D33) and 19th ICLS tables (D34), findings (2026-10-12, unattended)

Branch `proto/v0-e3-lfs-depth`. Code: `pipeline/datalab/datasets/lfs.py`, `specs/lfs.yaml`, `specs/lfs_labels.yaml`,
tests `pipeline/tests/test_lfs_depth.py` (new), small edits in `test_lfs.py` and `test_review_lfs.py`.
Output: this track's own work folder (`work/tracks/e3-lfs-depth/datasets/lfs`). No new Docling run was made: every
table used lies inside the existing validated runs. No value below was typed, corrected or judged by an LLM: Docling
or pdfplumber emitted the text, `normalise.parse_printed` parsed it, the checks ran in code and `status.py` decided.
`site/`, `releases/` and `thresholds/` are untouched; the release was not rebuilt (a dry run into a scratch folder
passed `check-release` with 0 problems).

## Read this first

1. **One national figure changes status.** `lfs.employed.male.total`, 2020-21 (printed 51.91, LFS 2020-21 p.38) goes
   from checked (tier A) to withheld (tier D, failed checks). Everything else national is identical to the build
   before this track. Reason: the new check "the four provinces add to Pakistan" fails for that column, because the
   2020-21 report prints employed males in KP as 6.68 on p.38 while the 2024-25 report prints 7.68 for the same
   figure on p.72 (and 6.68 also fails KP's own male + female and rural + urban sums on p.38). The strict rule in
   `status.py` withholds every figure in a failed check, including the Pakistan figure the sum targets. Nothing was
   tuned to avoid this. A human can decide: accept it; or turn `provinces.enabled` off (national goes back to
   387 / 6 / 54 / 3 exactly, verified); or change the strict rule (open question already in STATUS.md).
2. **The gate still passes** (frozen thresholds plus the D26 guard), see "Gate". Note that the 1,656 provincial
   cells add 648 cross-edition pairs, which lowers the disputed share from 6 of 276 (2.17%) to 6 of 924 (0.65%).
   That is arithmetic, not an improvement: the 6 disputed pairs are the same 6.
3. **19th ICLS unemployment rate (the headline 7.1%) is NOT published.** Its table (2024-25 p.144, table 9.2) prints
   no unit in its title, so the builder's existing rule (scale must be confirmed from the title) maps nothing from it.
   The table is located and counted in coverage, flagged `scale_not_confirmed`.
4. **Two 19th ICLS count tables are published from the second reader (pdfplumber), not Docling** (decision D28):
   Docling merged cells in 2024-25 p.57 and p.71. Each second reading was used only because all 39 sum checks of
   its table pass on it.

## What was built

### A. Provincial rows (D33)

- Series id: `lfs.<measure>.<province>.<sex>.<area>` with province keys `pb`, `sd`, `kp`, `ba`. National ids are
  unchanged (`lfs.<measure>.<sex>.<area>`).
- `geo`: `pk-pb` Punjab, `pk-sd` Sindh, `pk-kp` Khyber Pakhtunkhwa, `pk-ba` Balochistan. National series keep `pk`.
- `dims`: `sex`, `area` as for national, plus `definition`.
- `parent_id`: inside a province as for national; a province's both-sexes total points to the national both-sexes total.
- Block attribution is by the heading printed above the rows (`lfs.AreaRows`). Two layouts exist: 2014-15 to 2020-21
  print the province name on its total line ("KP 7.72 ...", then bare Rural, Urban); 2024-25 prints a heading line
  per block ("KP"), then Total, Rural, Urban. A label that is not in the dictionary closes the block, so the bare
  rows below it belong to nobody. The review's pending-area rule (a "Rural"/"Urban" heading with no block open maps
  nothing below it) still holds with provinces on; a test asserts it.
- "NWFP", "N.W.F.P." and "North West Frontier Province" are in the dictionary and map to the same `kp` series as
  "KP" / "Khyber Pakhtunkhwa"; the series definition says so. None of the five registered reports prints the old
  name (all print "KP"), so this path is covered by tests only.
- Checks: per block male + female = total (`row_total`), rural + urban = total (`column_total`), employed +
  unemployed = labour force (`accounting_identity`); new rule `lfs.provinces_add_to_pakistan` (`hierarchy_sum`,
  counts only, tolerance per D9: half a unit of the last digit per member); rate recompute under the current evidence
  rule where a provincial rate and counts exist (none in this build, see "Not done"); cross-edition between rounds
  through the same `cross_checks` as national.
- The provinces sum is `not_evaluable`, never forced, when (a) a province has no mapped row, or (b) the table prints
  a row or block heading that is neither Pakistan nor one of the four provinces (its Pakistan figure may cover that
  region). Case (b) did not occur: no located table prints any other region.

### B. 19th ICLS tables (D34)

- Series id: the 13th ICLS id plus `.icls19` (for example `lfs.labour_force.total.total.icls19`,
  `lfs.employed.pb.female.rural.icls19`, `lfs.employment_share.industry.agriculture.total.total.icls19`).
- `dims.definition`: "19th ICLS". Existing series gain `dims.definition`: "13th ICLS" (additive; ids unchanged).
- Never joined, never compared: every check pairs cells by series id and the ids differ; parents of `.icls19` series
  are `.icls19` series; a test asserts no check of any type mixes the two.
- The definition is taken from the tag the title or header prints (`lfs.definition_of`). Both tags on one caption:
  `definition_ambiguous`, nothing mapped. A 19th ICLS table must print the report's own round only.
- Draft definition text: the measure name, "as printed in the tables that the Labour Force Survey report labels
  19th ICLS", then what the report itself says, quoted, each quote verified by code on the page named in the spec
  (`icls19.definition_statement`; result stored in `info.json`). Both quotes were found:
  - p.45: "Under 19th ICLS, the definition of employment is narrower and more precise, it includes only work
    performed for pay or profit and mainly intended for others. Individuals engaged in subsistence agriculture
    (workers produced goods mainly for their own use) are excluded from employment under this definition."
  - p.48: "As per the 19th International Conference of Labour Statisticians (ICLS) framework, the LFS 2024-25
    excludes 2.48 million own-use producers from employment, aligning with the updated classification standards."
  If a quote is not found on its page the definition reads "Definition as stated in the report: not found."
  Page numbers are PDF page numbers, as on receipts.
- `.icls19` series carry no comparability break (they have one round) and a note that they are separate.

### Flags

`specs/lfs.yaml`: `provinces.enabled`, `icls19.enabled` (both true). Measured: both off reproduces the build before
this track exactly (2,818 cells, 714 checks, 450 observations, 78 series identical apart from `dims.definition`);
`icls19` on alone leaves every national observation identical.

## Numbers (build of this track's work folder)

### Tables located

Before: 32 tables in 5 reports (7, 7, 7, 5, 6), all 13th ICLS; 3 rejected as `other_definition`.
Now: the same 32, plus 6 tables on the 19th ICLS definitions in LFS 2024-25; none rejected.

| 19th ICLS table (LFS 2024-25) | Page | Result |
|---|---|---|
| 3.8 Civilian labour force | 57 | Docling flagged `merged_rows`; second reader used (39 of 39 sums pass); 45 cells mapped |
| 3.10 Crude participation rate | 59 | 45 cells mapped |
| 3.12 Refined participation rate | 62 | 45 cells mapped |
| 4.1 Employed population | 71 | Docling flagged `merged_rows`, columns unmapped; second reader used (39 of 39); 45 cells mapped |
| 4.5 Employed by major industry division | 76 | 24 cells mapped |
| 9.2 Unemployment rate | 144 | located, nothing mapped: the title prints no unit (`scale_not_confirmed`) |

19th ICLS kind not located: unemployed persons (the report prints no such table in this layout).

### New cells mapped

| Group | Mapped cells | Series |
|---|---|---|
| National (13th ICLS) | 726 (unchanged) | 78 (unchanged) |
| Provincial (13th ICLS) | 1,656 | 180 |
| 19th ICLS (36 national, 144 provincial, 24 industry) | 204 | 204 |

Rows previously "out of scope": 276 (23 area tables x 12 provincial rows). Now 0.

### Coverage (how much of the printed tables was captured; says nothing about correctness)

2,964 of 2,964 printed numeric tokens in 38 tables (1.0); lowest table 1.0. 13th ICLS tables: 2,744 of 2,744
(unchanged). 19th ICLS tables: 220 of 220. For the two second-reader tables the figure is the second reading's.

### Checks by type (total / evaluable / pass / within rounding / fail / disputed / not evaluable)

| Type | National (unchanged) | Provincial | 19th ICLS |
|---|---|---|---|
| row_total | 78 / 78 / 72 / 6 / 0 / 0 / 0 | 312 / 312 / 301 / 10 / 1 / 0 / 0 | 30 / 30 / 27 / 3 / 0 / 0 / 0 |
| column_total | 78 / 78 / 76 / 2 / 0 / 0 / 0 | 312 / 312 / 305 / 6 / 1 / 0 / 0 | 30 / 30 / 29 / 1 / 0 / 0 / 0 |
| accounting_identity | 54 / 54 / 42 / 12 / 0 / 0 / 0 | 216 / 216 / 157 / 55 / 4 / 0 / 0 | none (no unemployed table) |
| hierarchy_sum (provinces add to Pakistan) | n/a | 234 / 234 / 145 / 88 / 1 / 0 / 0 | 18 / 18 / 11 / 7 / 0 / 0 / 0 |
| recompute | 72 / 32 / 0 / 31 / 1 / 0 / 40 | none | none |
| weights_sum | 30 / 30 / 29 / 1 / 0 / 0 / 0 | n/a | 3 / 3 / 0 / 3 / 0 / 0 / 0 |
| cross_edition | 276 / 270 / 267 / 3 / 0 / 6 / 0 | 648 / 648 / 646 / 1 / 1 / 0 / 0 | none (one round) |
| cross_source (Economic Survey) | 126 / 126 / 113 / 13 / 0 / 0 / 0 | none | none |

The provinces-to-Pakistan checks are counted under "Provincial" although each also includes one national cell.

Cross-edition: national 270 agree, 0 fail, 6 disputed (unchanged). Provincial 647 agree, 1 fail, 0 disputed.
19th ICLS: no pair exists.

### Observations by status and tier

| Group | Checked A | Checked B | Disputed | Not yet verified (C) | Failed checks (D) | Total |
|---|---|---|---|---|---|---|
| National, before | 204 | 183 | 6 | 54 | 3 | 450 |
| National, now | 203 | 183 | 6 | 54 | 4 | 450 |
| Provincial | 345 | 502 | 0 | 144 | 17 | 1,008 |
| 19th ICLS | 0 | 114 | 0 | 90 | 0 | 204 |

- National: the one difference is item 1 of "Read this first".
- Provincial "not yet verified" (144): participation rates printed once, 2013-14 (72, from the 2014-15 report) and
  2024-25 (72). A rate has no sum, so nothing covers a single printing.
- 19th ICLS "not yet verified" (90): the crude and refined participation rates (45 each), same reason. Checked (114):
  labour force 45 and employed 45 (sums; second reader), industry shares 24 (shares add to the printed Total).
  Maximum tier is B: no second printing exists.

### Every failing or disputed check (both printed values, pages)

Provincial, failed:

| # | Check | Figures as printed | Difference |
|---|---|---|---|
| 1 | employed + unemployed = labour force, Punjab, female, 2017-18, in LFS 2017-18 | labour force 11.22 (p.34), employed 10.40 (p.35), unemployed 0.84 (p.46) | 0.02, limit 0.01 |
| 2 | the same three figures as reprinted in LFS 2018-19 | 11.22 (p.43), 10.40 (p.44), 0.84 (p.55) | 0.02 |
| 3 | employed + unemployed = labour force, Sindh, both sexes, 2018-19, in LFS 2018-19 | 15.40 (p.43), 14.77 (p.44), 0.61 (p.55) | -0.02 |
| 4 | the same, Sindh, male, 2018-19 | 12.88 (p.43), 12.44 (p.44), 0.42 (p.55) | -0.02 |
| 5 | male + female = total, employed, KP, 2020-21, in LFS 2020-21 p.38 | total 9.41, male 6.68, female 1.73 | -1.00 |
| 6 | rural + urban = total, employed, KP, male, 2020-21, LFS 2020-21 p.38 | total 6.68, rural 6.40, urban 1.28 | 1.00 |
| 7 | provinces add to Pakistan, employed, male, 2020-21, LFS 2020-21 p.38 | Pakistan 51.91; Punjab 28.41, Sindh 12.83, KP 6.68, Balochistan 3.00 | -0.99 |
| 8 | cross-edition, employed, KP, male, 2020-21 | 6.68 (LFS 2020-21 p.38) vs 7.68 (LFS 2024-25 p.72) | 1.00; kept as fail, not disputed: "an arithmetic check on one reading failed" |

Items 1 to 4 are 0.02 where the frozen tolerance allows 0.01 (two members at half a unit). The reports say "Total may
not tally due to rounding"; the tolerance was fixed first, so the fails stand and the 9 figures are withheld.
Items 5 to 8 are one printed figure: the overlay of LFS 2020-21 p.38 shows the box on "6.68", so this is what the page
prints, not a misread. Code does not pick a winner; the five KP figures, the three other provinces' male totals and the
Pakistan male total in checks 5 to 8 are withheld (17 provincial observations in all, 1 national).

National (all unchanged from before this track): recompute fail, unemployment rate, both sexes, urban, 2018-19:
printed 7.9 (LFS 2018-19 p.53), counts 1.79 / 22.89 (pp.55, 43) give 7.82, bound 0.0736. Six disputed cross-edition
pairs, 2018-19 industry shares, LFS 2018-19 p.44 vs LFS 2020-21 p.39: agriculture male 30.8 vs 30.0; community,
social and personal services female 14.9 vs 15.1, male 14.2 vs 15.6, both sexes 14.9 vs 15.5; others male 2.7 vs 2.1,
both sexes 2.2 vs 1.6.

19th ICLS: none.

### Gate (`datalab.release.gate_dataset`, frozen thresholds plus the D26 guard)

| Measure | Before | Now | Threshold |
|---|---|---|---|
| Coverage | 2,744 / 2,744 = 1.0 | 2,964 / 2,964 = 1.0 | >= 0.95; no table below 0.90 |
| Check pass rate (disputed counted as not passed) | 667 / 674 = 0.9896 | 2,462 / 2,477 = 0.9939 | >= 0.95 |
| Cross-edition agreement, agree / (agree + fail) | 270 / 270 = 1.0 | 917 / 918 = 0.9989 | >= 0.98 |
| Disputed share of cross-edition pairs | 6 / 276 = 0.0217 | 6 / 924 = 0.0065 | <= 0.05 (D26) |
| Result | published | **published** (`meets_thresholds: true`, no reasons) | |

Nothing was tuned. The flags are left on.

## Overlays viewed (step D), in `work/tracks/e3-lfs-depth/qa/`

- `overlay_lfs-pbs-2020-21_p038_t0.png` (employed, province name on its total line): every box on a number; the block
  names Pakistan, KP, Punjab, Sindh, Balochistan each head three rows; KP male 2020-21 reads 6.68 on the page.
- `overlay_lfs-pbs-2024-25_p058_t0.png` (labour force, 13th ICLS, heading line per block): centred headings
  Pakistan, KP, Punjab, Sindh, Balochistan, each followed by Total, Rural, Urban; boxes on the numbers; title says
  "(13th ICLS)".
- `overlay_lfs-pbs-2017-18_p046_t0.png` (unemployed): same block structure as the 2020-21 page; boxes on numbers.
- `overlay_lfs-pbs-2024-25_p057_second_reader.png` (labour force, 19th ICLS, second reader): three value columns, 15
  rows, one box per number including the row Docling had merged (Punjab rural 20.74 and 10.60 now separate); title
  says "(19th ICLS)".
- `overlay_lfs-pbs-2024-25_p071_second_reader.png` (employed, 19th ICLS, second reader): the same, one decimal.

## Things a human must know

1. The second reader attaches a label-only line to the nearest row of numbers, so its rows read "KP Total", "Punjab
   Total" (in the dictionary), and it leaves the first heading, "Pakistan", with the header lines. For that case only
   (the table's own rows give no label before the first amounts) the builder reads the block heading from the text
   line directly above the first amounts (`AreaRows.open_from_line_above`). It was used on the two second readings
   and on no Docling table. Without it the Pakistan block of those two tables stays unmapped (safe, but the headline
   is lost).
2. The 19th ICLS employed table prints one decimal (77.2) and the labour-force table two (83.13). No check joins
   them in this build (no 19th ICLS rate or unemployed table is mapped).
3. Definitions are drafts (`definition_status: draft`). The 19th ICLS text quotes the report and adds nothing.
4. The 13th ICLS unemployment-rate table of 2024-25 (table 9.3) continues on p.146 with the provincial blocks, as a
   table with no title. A table without a title is never identified, so those provincial rates are not mapped.

## Not done, and why

- 19th ICLS unemployment rate (table 9.2): title prints no unit; rule kept. A human could decide that "rate" implies
  percent; that is a spec decision.
- Provincial unemployment rates: earlier rounds print the rate for Pakistan only; 2024-25 prints the provinces on a
  title-less continuation page (above). So no provincial recompute check exists in this build.
- No Docling run was started; no needed table lies outside the existing page ranges.
- Site, release, STATUS.md, DECISIONS.md, docs/SCHEMA.md: not edited here (lead merges; additions listed below).

## Additive schema and release changes (for docs/SCHEMA.md)

| Where | Addition |
|---|---|
| `Series.geo` | new values `pk-pb`, `pk-sd`, `pk-kp`, `pk-ba` |
| `Series.dims` | new key `definition`: "13th ICLS" or "19th ICLS", on every LFS series |
| `Series.series_id` | new LFS patterns `lfs.<measure>.<pb|sd|kp|ba>.<sex>.<area>`, any LFS id + `.icls19` |
| `Series.notes` | filled on `.icls19` series |
| `Series.sort_key` (LFS) | within a measure: national 0-8, provinces 10-48, 19th ICLS the same plus 50 |
| `Check.rule_id` | new `lfs.provinces_add_to_pakistan` (`check_type: hierarchy_sum`, first use in LFS) |
| LFS cells | `extractor_name: pdfplumber` with `second_reader_of` now also occurs in LFS (2 tables) |
| `coverage.json` rows (LFS) | new key `definition`; `reader`, `first_reader_coverage` on second-reader rows |
| `info.json` (LFS, not a schema model) | `observations_by_group`, `depth`, `icls19_definition_statement`; per table `definition`, `mapped_cells_by_group`, `unknown_headings`, `block_heading_from_text_layer`, `second_reader`; per source `kinds_not_located_icls19` |
| classify results | new `definition_ambiguous` |

## Decisions to record (provisional, unattended)

- D33 as implemented: ids, geo codes, parent rule, provinces-to-Pakistan as `hierarchy_sum` under D9.
- D34 as implemented: `.icls19` suffix, definition from the printed tag, own round only, quotes verified by code.
- Flagged LFS count and industry tables go to the second reader under D28; rate tables never do (no sum of their own).
- A failed provinces sum withholds its Pakistan figure (existing strict rule, not changed).

## How to rerun

```
cd pipeline
python -m datalab build --dataset lfs
python -m pytest -q
```
