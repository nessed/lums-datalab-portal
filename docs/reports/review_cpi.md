# Adversarial review of the CPI dataset builder (2026-10-11)

Branch `proto/v0-review-cpi`. Scope: `pipeline/datalab/datasets/cpi.py` and what it relies on
(`datasets/common.py`, `checks.py`, `status.py`, `tables.py`, `normalise.py`, `specs/cpi*.yaml`).
Question asked: what could put a wrong number, period, area, base year or vintage under a "checked" badge?

**No pipeline code was changed.** Every finding below has a test in `pipeline/tests/test_review_cpi.py`
that fails on the reviewed code and is marked `xfail(strict=True)`; the suite stays green (199 passed,
16 xfailed, exit code 0). When a finding is fixed its test passes, the strict xfail turns red, and the marker is removed.
Inputs are synthetic. No LLM read, wrote or judged a data value.

## Headline

- **Nothing in the released CPI data shows a symptom of any finding.** All counts of "released values
  affected" below are 0, measured by script on `releases/v0.0.1-prototype/` (884 published CPI values:
  117 tier A, 767 tier B; 507 checks, 0 failed).
- **But the release is clean because the extraction happened to be clean, not because the checks would
  have caught an error.** Findings 1 to 4 show that the checks let specific, plausible misreads through to
  a checked badge. The most important measured fact: the `index_aggregation` check, which is credited as
  evidence for 360 published group indices, would still pass if 304 of them were wrong by one whole index
  point or more, and 53 of them by ten points or more.
- Coverage and accuracy are not mixed anywhere in this note: everything here is about accuracy of what was
  captured. Coverage was not re-measured.

## Findings

Severity: **high** = a wrong value can be published as checked through a plausible extraction error;
**medium** = same, but needs a less likely input or affects the tier rather than the value;
**low** = a rule 10 violation (guess / silent default / swallowed error) with no route to a wrong published
value found today.

| Id | Severity | Released values affected | Where |
|---|---|---|---|
| REVIEW-CPI-1 | high | 0 (no check failed in the release) | `status.py:59-66` |
| REVIEW-CPI-2 | high | 0 wrong; 360 values carry this check as evidence, 0 rely on it alone | `cpi.py:513-515` |
| REVIEW-CPI-3 | high | 0 (no column has mixed decimals) | `cpi.py:463-464`, `cpi.py:481-482` |
| REVIEW-CPI-4 | high | 0 found (labels and weights consistent across all issues) | `cpi.py:489-566`, `specs/cpi_labels.yaml:8-10` |
| REVIEW-CPI-5 | medium | 0 (one caption and one table per page) | `cpi.py:156-176` |
| REVIEW-CPI-6 | medium | 0 (all 117 cross-edition checks are exact) | `checks.py:98`, `cpi.py:584` |
| REVIEW-CPI-7 | medium | 0 (the flagged 2021 tables were unmapped) | `cpi.py:569-590`, `cpi.py:654` |
| REVIEW-CPI-8 | medium | 0 (one manifest entry per issue) | `cpi.py:582` |
| REVIEW-CPI-9 | medium | 0 (cross-source skipped: no SBP source) | `cpi.py:628` |
| REVIEW-CPI-10 | low | 0 (same) | `cpi.py:600-604` |
| REVIEW-CPI-11 | low | 0 | `cpi.py:140` |
| REVIEW-CPI-12 | low | 0 (no cell starts with a dot) | `normalise.py:28`, `normalise.py:143-152` |
| REVIEW-CPI-13 | low | 0 | `tables.py:22` |

### REVIEW-CPI-1: a failed check is overridden by any passing check (high)

`status.decide_tier` withholds a value only when `failed and not passed`. If one check on the cell fails
and another passes, the value is published as tier B with the remark "failed but an independent check
passed". For CPI the passing check is nearly always `index_aggregation`, which is far less sensitive than
the check that failed (finding 2), so it is not independent evidence about that cell at all.

- Group index, weight 1.02, previous-month index read 5 points low (198 to 193): the MoM recompute fails
  by 2.6 points, aggregation passes (the error moves the mean by 0.051; tolerance 0.13). Published, tier B.
- General index read as 200.10 for 200.00 (one digit): both recomputes fail, aggregation passes (tolerance
  0.13 to 0.19 in the release). Published, tier B.
- With a later issue present, the cross-edition check also fails and the value is still published; the
  note then says "the publisher restated the figure", which is false.

Tests: `test_review_cpi_1_misread_index_with_failed_recompute_is_not_published`,
`test_review_cpi_1_misread_general_index_is_not_published`.
Suggested fix: a cell that takes part in a failed check is withheld (tier D) unless the passing check is at
least as sensitive to that cell as the failed one; simplest safe rule for now: any failed arithmetic check
on the primary cell withholds it. Rule 10 already says this ("hold back the whole set").

### REVIEW-CPI-2: index_aggregation credits 24 cells it cannot test (high)

`index_aggregation_checks` lists all 12 group indices and all 12 weights as members, and `status` counts a
passing check as arithmetic evidence for every member. The tolerance (0.09 to 0.19 index points in the
release) is right for the general index, but an error `e` in a group index moves the result by only
`w x e / 100`. Measured on the release, the misread each published group index could carry while this check
still passes:

| Group | Largest tolerated misread (index points) |
|---|---|
| Food | 0.27 to 0.71 |
| Housing | 0.40 to 1.12 |
| Clothing | 1.10 to 2.70 |
| Health, Education, Communication | 2.5 to 10.4 |
| Recreation and culture | 5.95 to 15.04 |
| Alcoholic beverages and tobacco | 9.15 to 25.48 |

304 of 360 tolerate at least 1 point, 130 at least 5, 53 at least 10. In the release every one of these
cells also has a recompute check, so none relies on aggregation alone; it becomes the only evidence as soon
as a row's YoY or MoM cell is missing, unparsed or failed (then finding 1 applies).
Test: `test_review_cpi_2_aggregation_alone_does_not_check_a_low_weight_group_index` (index 8 points off,
all checks pass, published tier B).
Suggested fix: the aggregation check is evidence for its target (the general index) only; members get
credit only from checks whose tolerance, expressed in units of that member, is about its printed precision.

### REVIEW-CPI-3: tolerances grow with the precision of the value as read (high)

`aggregation_tolerance` and `recompute_tolerance` take `last_digit_unit` from each parsed value and use the
largest. If extraction loses the decimals of one index (`271.10` read as `271` or `271.`), the unit becomes
1 and the tolerances that should catch the error widen instead: MoM/YoY from 0.009 to 0.19, aggregation
from 0.17 to 0.67. All checks pass and `271` is published as checked. Coverage does not catch it either
(1 token of about 141 is missing, coverage 0.99).
Test: `test_review_cpi_3_truncated_index_is_not_published`.
Suggested fix: precision is a property of the column, not of the cell. Require every value in an index or
percentage column to carry the same number of decimals; a cell that differs is flagged and withheld, and
tolerances use the column's precision.

### REVIEW-CPI-4: no check validates the label to series mapping (high)

`specs/cpi_labels.yaml` says "a wrong row makes the weights sum, the index aggregation or the percentage
recomputation fail". That is not so. The weights sum and `sum(w x I)` are unchanged under any permutation of
the group rows, and each recompute stays inside its own row. If two labels end up on each other's rows
(Docling gluing a wrapped label onto the next row is a known trap, and Housing and Furnishing both wrap),
every check passes and one group's weight, index, YoY and MoM are published under the other group's name.
If the shift leaves one row unlabelled, weights and aggregation become not evaluable but the per-row
recomputes still pass and publish the shifted rows.
Released data: no sign of it. Printed serial numbers agree with the mapped group in all 884 published
values, and all 36 weight series are constant across the issues.
Test: `test_review_cpi_4_two_rows_with_swapped_labels_are_noticed`.
Suggested fix: add evidence that depends on the row identity. The cheapest is a weight check: the group
weights are fixed for a base, so each row's printed weight must equal the weight recorded for that group
(from one issue, entered and confirmed by a human), or at least equal the same group's weight in every other
issue. Also correct the comment in the labels spec.

### REVIEW-CPI-5: one table can be located for two areas (medium)

`locate` takes "the qualifying table on the page where the caption text occurs". It never compares positions
and never checks that a table is used once. If the Urban caption sits at the foot of the page that carries
the National table, both areas are "found" in the same table, and the national figures are published a
second time as `cpi.urban.*` with all internal checks passing (duplicate `cell_id`s as a side effect).
Test: `test_review_cpi_5_one_table_is_never_located_for_two_areas`.
Suggested fix: use the caption's position (it must be the nearest caption above the table), and refuse to
hand one table to two areas.

### REVIEW-CPI-6: figures that differ by one unit count as agreement (medium)

`equality_check` passes when two printings differ by up to 1 unit of the last digit. Both issues print the
index to two decimals, so nothing is rounded between them: 200.00 against 200.01 is either a revision or a
misread, yet it is recorded as "pass within rounding", lifts the earlier figure to tier A (verified) and
leaves no note. Recompute cannot see a 0.01 error (it moves the percentage by 0.004 against a tolerance of
0.009), so cross-edition is the only check that could.
Test: `test_review_cpi_6_two_printings_that_differ_are_not_agreement`.
Suggested fix: for two printings at the same precision require equality; anything else is a recorded
disagreement. The 1-unit rule is a frozen threshold (`cross_edition_units_of_last_digit`), so this needs a
recorded deviation, not a quiet edit.

### REVIEW-CPI-7: cells of a blocked table still earn passing checks (medium)

`run_checks` passes the blocked-table reason to the three in-table checks but not to
`cross_edition_checks`. A table flagged `merged_rows`, `dropped_column` or `low_coverage` therefore still
gets passing cross-edition checks, and `decide_tier` then publishes its cells at tier A, borrowing the
arithmetic evidence of the other issue. AGENTS.md section 6: such tables get `not_evaluable`, not `passed`.
Test: `test_review_cpi_7_cells_of_a_blocked_table_earn_no_passing_check`.
Suggested fix: give `cross_edition_checks` the blocked list and return `not_evaluable` when either cell is
in a blocked table (the clean issue's own printing can still be published on its own evidence).

### REVIEW-CPI-8: two copies of one issue count as cross-edition evidence (medium)

The only guard is `other.source_id == first.source_id`. Two manifest entries for the same issue (a second
download, a mirror, a reissued file) are paired on all three index columns, 39 checks per table, and every
index becomes tier A by agreeing with itself.
Test: `test_review_cpi_8_two_copies_of_one_issue_are_not_cross_edition_evidence`.
Suggested fix: pair only cells from issues of different months (and refuse two CPI sources with one period
or one SHA-256 unless a human has recorded why).

### REVIEW-CPI-9: SBP precision is inferred from the CSV text (medium)

`cross_source_checks` uses `last_digit_unit` of the SBP string. A CSV drops trailing zeros, so 25.0 arrives
as `25` (the builder's own test uses that form), the unit becomes 1 and the tolerance 0.505 instead of
0.055. PBS 24.60 against SBP 25.0 is recorded as agreement and the YoY figure becomes tier A.
Test: `test_review_cpi_9_sbp_value_without_trailing_zero_keeps_one_decimal_tolerance`.
Suggested fix: state the SBP precision in `specs/cpi.yaml` (the spec comment already says "1 decimal") and
use it; never infer it from the text.

### REVIEW-CPI-10: the SBP reader resolves conflicts and errors silently (low)

`read_sbp_yoy` keeps the first of two different values for one month (`setdefault`) and skips a row of the
target series whose date it cannot read (`except ValueError: continue`). Both are rule 10 violations.
Tests: `test_review_cpi_10_sbp_csv_with_two_values_for_one_month_is_not_silently_resolved`,
`test_review_cpi_10_sbp_row_with_unreadable_date_is_not_swallowed`.
Suggested fix: raise on an unreadable date of the target series; on conflicting values for a month, raise or
leave the month out and report it.

### REVIEW-CPI-11: a caption without an area is taken as national (low)

`find_captions` uses `(m.group(1) or "national")`. That is right for the 2007-08 base, where the single
table names no area, but on the 2015-16 base it is a guess. A fourth "by Group" table without an area would
be a second national candidate (refused today as "caption found 2 times"), or the only one if the real
National caption fails to match.
Test: `test_review_cpi_11_new_base_caption_without_area_is_not_assumed_national`.
Suggested fix: return no area when none is printed and let `locate` accept that only for old-base issues.

### REVIEW-CPI-12: `.37` is parsed as 37 and `-.37` as +37 (low)

The number pattern needs a leading digit, so the dot and the minus sign are left as residue and ignored.
For CPI the recompute check would fail and withhold the value, but together with finding 1 a weight or index
parsed this way is not safely stopped, and the sign loss is silent.
Test: `test_review_cpi_12_leading_dot_decimal_is_not_read_as_a_whole_number` (two cases).
Suggested fix: accept a leading-dot decimal in the pattern, or return no value when the residue holds a dot.

### REVIEW-CPI-13: a box without `coord_origin` is assumed TOPLEFT (low)

`norm_bbox` defaults a missing origin to TOPLEFT. The module's own docstring says it "never assumes", and
Docling table boxes are BOTTOMLEFT.
Test: `test_review_cpi_13_bbox_without_origin_is_refused`.
Suggested fix: raise when the key is absent.

## Looked at and found sound

- Column to month mapping: the three month spellings, the stacked "June" above "2016", the spanning
  "June 2025 Over" line, the comparison-month rule for % change columns and the year rollover all behave as
  documented; a shifted cell widens its column band and trips the overlap test; any mismatch leaves the
  table unmapped (a gap, not a wrong value).
- Base year comes from the caption and must equal the base expected for the issue; bases are never spliced.
- All 117 released cross-edition pairs join two different issues on the same series and month.
- Released data: no duplicate cell ids, no published value from a flagged table (the 8 published
  `header_row_as_data` values are the Rural "General" rows, and their checks pass).

## Unproven (no failing test; not counted as findings)

1. A value cell with `col_span` or `row_span` above 1 is credited to its first column / row
   (`cpi.py:361`). CPI prints every cell, so I could not build a realistic case.
2. `common.make_cell` uses the whole table box when a cell has no box (`common.py:144`): a silent default
   for provenance. Docling appears always to emit a cell box.
3. `_MONTH_WORD` matches any word that starts with a month abbreviation ("Decrease", "Marginal", "Mayor").
   Every case I tried only produced a column problem (safe side).
4. `text_layer_row_label` picks a label by vertical band. A tall or displaced value box could pick up the
   neighbouring line's label, and by finding 4 nothing would notice. Not reproduced.
5. `page_words` normalises by `page.rect`, Docling by its own page size; a rotated page or a crop box that
   differs from the media box could misalign the header band. The released overlays were reported fine.
6. A weight misread by 0.05 or less passes `weights_sum` (absolute tolerance 0.05) and the aggregation check.
   This is close to the limit of the printed precision; the weight check proposed under finding 4 closes it.
7. A last-digit misread of an index (0.01) is invisible to recompute and aggregation. Only the 117 tier A
   values have a check that could see it; the 767 tier B values do not.
8. `first_new_base_issue: "2019-08"` was not verified against a July or August 2019 issue.
9. `title_text_as_data` is detected but is not a blocking flag.
10. `detect_table_flags` skips header-flagged cells, so a merged cell inside a header-flagged data row does
    not flag the table (the cell itself still parses to no value).

## How the numbers were measured

Scripts read `releases/v0.0.1-prototype/{observations,cells,checks}.json` only. Tolerated misread per
member of an aggregation check: `max(|tol - r|, |tol + r|) x 100 / w`, with `tol` from the check's
tolerance rule, `r` its residual and `w` the weight printed in the same row. Run the tests with
`python -m pytest -q` from `pipeline/`; add `--runxfail` to see each failure message.
