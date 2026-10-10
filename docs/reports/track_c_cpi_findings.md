# Track C: CPI pipeline findings (2026-10-11, unattended)

Branch `proto/v0-cpi`. Every number below was produced by `python -m datalab build --dataset cpi`
and read from `work/datasets/cpi/{info,coverage,checks,observations}.json`. No value was written,
corrected or judged by an LLM. Coverage and accuracy are reported separately.

## 1. Issues processed

| Issue | Pages | Base | Docling run | Result |
|---|---|---|---|---|
| cpi-pbs-2016-06 | 12 | 2007-08 | `CPI_2016-06__docling__full-document__run-01` | **NOT VALID**: refused by the extractor's scanned-track rule |
| cpi-pbs-2019-06 | 13 | 2007-08 | `CPI_2019-06__docling__full-document__run-01` | **NOT VALID**: same rule |
| cpi-pbs-2023-06 | 18 | 2015-16 | `CPI_2023-06__docling__full-document__run-01` | validated |
| cpi-pbs-2024-06 | 18 | 2015-16 | `CPI_2024-06__docling__full-document__run-01` | validated |
| cpi-pbs-2025-06 | 18 | 2015-16 | `CPI_2025-06__docling__full-document__run-01` | validated |
| cpi-pbs-2026-06 | 18 | 2015-16 | `CPI_2026-06__docling__full-document__run-01` | validated |

**Why the two old-base issues were refused.** `extract.profile` counts a page without a text layer as
scanned and stops when more than 20% of pages are (frozen threshold `max_scanned_page_fraction: 0.20`).
The June 2016 and June 2019 issues each have three chart-only image pages (pp. 2, 4, 8): 3/12 = 25% and
3/13 = 23%. The table pages themselves have a clean text layer. The newer issues also have three image
pages (pp. 5, 6, 7) but 3/18 = 16.7% passes. I did not touch the rule or the threshold. Consequence:
**nothing on the 2007-08 base is published**; all 154 expected old-base figures are labelled gaps.
This needs a human decision (section 8).

## 2. Tables located

Located by the caption in the PDF text layer ("Table N: Consumer Price Index (National|Urban|Rural) by
Group of Commodities and Services (Base ...)"), then the single Docling table on that page that carries
at least 10 of the 13 row names. 12 of 14 expected tables located; the 2 missing are the old-base issues.

| Issue | National | Urban | Rural |
|---|---|---|---|
| 2023-06 | p. 8 | p. 9 | p. 10 |
| 2024-06 | p. 8 | p. 9 | p. 10 |
| 2025-06 | p. 8 | p. 9 | p. 10 |
| 2026-06 | p. 8 | p. 9 | p. 10 |

Urban and Rural are included (same code, no extra cost): series `cpi.urban.*`, `cpi.rural.*`.

## 3. Coverage (how much of the printed table was captured)

All 12 located tables: coverage 1.0000 and row-band coverage 1.0000 (141 or 142 printed numeric tokens
each, all matched). Data type total: 1,695 of 1,695 printed numeric tokens matched (100%), for the
located tables only. No detector flags on any table. Coverage of the two unprocessed issues is not
measured (no run), not zero and not 100%.

## 4. Checks (how much of what was captured is right)

| Check | Evaluable | Pass | Pass within rounding | Fail | Not evaluable |
|---|---|---|---|---|---|
| weights_sum | 12 | 4 | 8 | 0 | 0 |
| index_aggregation | 36 | 0 | 36 | 0 | 0 |
| recompute (YoY and MoM) | 312 | 0 | 312 | 0 | 0 |
| cross_edition | 117 | 117 | 0 | 0 | 0 |
| cross_source (SBP) | 0 | - | - | - | skipped: source not registered |
| **All** | **477** | 121 | 356 | 0 | 0 |

- Evaluable pass rate 100% (threshold 95%). Cross-edition agreement 100% (threshold 98%): the June 2023,
  2024 and 2025 indices each equal the "same month last year" column of the next issue, for general and
  the 12 groups in all three areas (3 x 3 x 13 = 117). PBS did not revise any of them.
- index_aggregation: the national general index does recompute from the 12 national group indices and
  weights. Largest residual 0.031 index points against a tolerance of about 0.16 to 0.18. The feared
  systematic failure (national aggregated from urban and rural at a lower level) did not show.
- recompute is "within rounding" rather than exact by construction: the recomputed value is not rounded
  before comparison.
- Tolerances were written into `specs/cpi.yaml` and committed (33a8a2b) before the first extraction result
  existed, and were not changed afterwards.

Tolerance rules (u = one unit of the last printed digit):
- weights_sum: absolute 0.05 (thresholds.yaml).
- index_aggregation: `0.5 u_I x sum(w)/100 + sum_i(0.5 u_w x I_i)/100 + 0.5 u_G`. This is wider than the
  "0.5 + 0.5 unit" in the brief because the printed weights are rounded too, and with indices near 270
  that term dominates (12 x 0.005 x 2.7). It is the first-principles bound, fixed before results.
- recompute: `0.5 u_p + 100 x 0.5 u_I x (1 + a/b) / b`.
- cross_edition: 1 unit of the last digit. cross_source: `0.5 u_SBP + 0.5 u_PBS`.

## 5. Observations and tiers

961 observations, 178 series.

| State | Count | Notes |
|---|---|---|
| Published, tier A | 117 | index for June 2023/2024/2025: arithmetic check and cross-edition agreement |
| Published, tier B | 690 | arithmetic evidence only (other indices, YoY, MoM, weights) |
| Withheld, `not_yet_verified` | 154 | every expected figure of the 2016-06 and 2019-06 issues |
| Withheld, `failed_checks` | 0 | |
| Withheld, `not_in_source` | 0 | |

1,440 cells in total, 924 mapped to a series. Unmapped by design: the general weight (100.00; used as the
target of the weights check), the two "impact" columns, and the two food sub-rows.

## 6. Labels

No unmapped and no ambiguous labels in any located table. Rows deliberately not targeted (listed under
`not_targeted` in `specs/cpi_labels.yaml`): "Non-perishable Food Items" and "Perishable Food Items"
(12 tables each). The old-base label variants ("Alcoholic Bev.& Tobacco", "Furnishing & Household
Equipment Maint.", "Food & Non-alcoholic Beverages") are in the dictionary from the text layer but are
untested against Docling output.

## 7. Traps learned (for AGENTS.md section 7)

- **Chart pages trip the scanned-track rule on short documents.** A born-digital PBS review with three
  chart-image pages is refused when it has fewer than 15 pages. "No text layer" is not the same as
  "scanned".
- **Docling marks the first data row as a header row.** In the Rural table of 2025-06 and 2026-06 the
  "General" row comes out with `column_header: true`. `cpi.py` accepts a header-flagged row as data only
  when every value column holds exactly one number in it, flags it `header_row_as_data`, and the checks
  then validate it. `common.row_label` returns an empty label for such a row.
- **Header cells span down into data rows.** "No" / "Group" header cells have a row span that reaches the
  General row, so a label built from the grid picks up header text; use only cells that start in the row.
- **The CPI column headers print the month three ways:** "June 25", "Jun 23", and "June" above "2016".
  A spanning line "June 2025 Over" sits above the % change columns; only the bottom header line names a
  column's own month.
- **A % change column's header month is the comparison month, not the observation month.** The value
  belongs to the issue month.
- **A shared scratch log file is shared between tracks**; the LFS track's lines appeared in my extract log.

## 8. Decisions taken (provisional, unattended) and open questions

1. Old-base issues left unprocessed rather than bending the profile rule or using `--pages`. A human must
   decide whether chart-only pages count as scanned (for example, measure the text layer on pages that
   carry tables, or raise a recorded deviation). Until then the 2007-08 base is a labelled gap.
2. Old-base CPI is filed under `cpi.national.*.b2007_08` as the brief says, with a note on the series that
   the 2007-08 CPI was collected in urban centres only. That note is from general knowledge, not from the
   documents; a human should confirm it.
3. MoM series added (`cpi.<area>.mom.general`, `.mom.group.<slug>`) because the MoM recompute check needs
   those cells anyway. Drop them from the catalogue if not wanted.
4. YoY and MoM series are not split by base (per the brief); they carry the 2019-08 rebase break.
5. Food sub-rows not targeted; impact columns never mapped.
6. Column meaning is accepted only when three things agree: 8 value columns; the bottom header line names
   exactly the expected month above each column; the words Weight / Indices / Change / Impact sit above
   their columns.

## 9. Not done

- **cross_source vs SBP EasyData**: implemented and tested (`cpi.cross_source_checks`), skipped at build
  because no `sbp_easydata` source is in the manifest. It would compare 4 figures (national YoY general,
  June 2023 to 2026) and lift them to tier A if they agree.
- Old-layout overlay not looked at (no run exists). New-layout overlay checked:
  `work/qa/overlay_cpi-pbs-2025-06_p008.png`, boxes sit on the numbers.
- No gold-set sample and no human spot check yet.
- `AGENTS.md`, `STATUS.md`, `DECISIONS.md` not edited (outside this track's files).
