# LFS builder: the eight review findings fixed (2026-10-11)

Branch `proto/v0-fix-lfs`. Fixes the findings of `docs/reports/review_lfs.md` in
`pipeline/datalab/datasets/lfs.py`, `specs/lfs.yaml`, and three small generic changes in
`schema.py`, `status.py`, `checks.py`. All tests of `pipeline/tests/test_review_lfs.py` pass with no
xfail marker left. The dataset was rebuilt in this track's own work folder from the same validated
Docling runs (no new extraction run). Every number below was produced by a script over the two builds.

## What changed, per finding

| Finding | Where | Change |
|---|---|---|
| REVIEW-LFS-1 | `lfs.recompute_unemployment_rate`, new `lfs.printable_values_within` | A recompute result inside the bound is evidence only when exactly one value printable at the rate's precision lies within the bound of the recomputed value. Otherwise `not_evaluable`, reason "the printed counts are too coarse to confirm this rate" followed by the count, the bound and the recomputed value. The bound formula is unchanged. A printed rate OUTSIDE the bound still fails. |
| REVIEW-LFS-2 | `schema.Check.credits_members`, `status.credits`, `checks.dispute_test`, `checks.value_check` | New optional field, default true. The LFS rate recompute sets it false: a pass is evidence for the rate only. The counts stay on the receipt as members; a FAILED recompute still withholds them. CPI checks are untouched (they do not pass the argument). |
| REVIEW-LFS-3 | `lfs.classify`, `specs/lfs.yaml` (`title_start`, every `captions` entry) | A pattern must follow the table number directly and run to the end of the title (the printed unit, with the ICLS tag where the 2024-25 report prints one). |
| REVIEW-LFS-4 | `lfs.classify`, `specs/lfs.yaml` (`icls.rounds_13th_icls_throughout`) | Rounds 2014-15, 2017-18, 2018-19, 2020-21 are listed as 13th ICLS throughout. A round in neither list is refused with the recorded result `definition_unknown_for_round`. |
| REVIEW-LFS-5 | `lfs.usable_pages`, `lfs.tables_for_source` | `ValueError` for a page-range run with no recorded range and for a full-document run of a source with an empty page count. The build stops instead of reporting "not located". |
| REVIEW-LFS-6 | `lfs.AreaRows.lookup` (`pending_area`), `lfs.build_cells` | A label-only Rural/Urban row with no open block sets a pending area. Nothing below it is mapped (this layout is not modelled); the rows are listed in `unmapped_labels` with the reason. |
| REVIEW-LFS-7 | `lfs.build_cells` | A header-flagged row is data when every value column holds exactly one number (row flag `header_row_as_data`, listed in the table info as `header_rows_as_data`). A header-flagged row with some numbers but not one per column is left out and the table gets the flag `header_row_with_numbers`. A header-flagged row with no number is a header, as before. |
| REVIEW-LFS-8 | `lfs.cross_checks`, `lfs.build` | Two sources of the same round produce no check between them. The build info has a new key `rounds_registered_twice` (sources listed in `skip_sources` are left out of it). |
| Unproven 5 | `lfs.cross_checks` (new `blocked` argument) | A pair with either cell in a blocked table is `not_evaluable`. |
| Unproven 6 | `lfs.shares_checks` | An industry with no mapped cell makes the shares sum `not_evaluable` ("the table does not carry a mapped row for: ..."). A share printed as nil is still left out of the sum, as before. |

## Schema additions

- `Check.credits_members: bool = True` (`schema/check.schema.json` regenerated). Stored checks without the
  field read as true, so the frozen release is judged exactly as before.
- Build info (`info.json`, not a schema model): `rounds_registered_twice`; per table `header_rows_as_data`.
- New values in existing free-text fields: classify result `definition_unknown_for_round`; table flag
  `header_row_with_numbers`; row flag `header_row_as_data` (already used by CPI).

## Before and after

Before = branch point `c85ae0a` (proto/v0 when this branch was cut), after = this branch, same work folder, same runs.
proto/v0 as of `a8036c3` was merged into the branch afterwards (release, STATUS, decisions; no pipeline or spec file), so the numbers hold for it too. Suite after the merge: 298 passed, 3 xfailed (the 3 are REVIEW-CPI-9 and 10 in test_review_cpi.py).

### Extraction (unchanged)

| | Before | After |
|---|---|---|
| Tables located | 25 (7, 7, 5, 6 for 2017-18, 2018-19, 2020-21, 2024-25) | 25, the same 25 (source, kind, page, table index) |
| Tables rejected | 3, all `other_definition` (2024-25 pp. 57, 71, 76) | the same 3 |
| Table flags | none | none |
| Cells / mapped cells | 2106 / 570 | 2106 / 570, identical (id, series, round, printed text, parsed value, flags) |
| Coverage: printed numeric tokens matched | 2108 of 2108 (1.0); lowest table 1.0 | 2108 of 2108 (1.0); lowest table 1.0 |
| Rounds registered twice | not reported | none |

Coverage says how much of the page was captured. It says nothing about whether a value is right; that is the next table.

### Checks by type

Counts are total / evaluable / pass / within rounding / fail / disputed / not evaluable.

| Type | Before | After |
|---|---|---|
| accounting_identity | 36 / 36 / 24 / 12 / 0 / 0 / 0 | unchanged |
| column_total | 60 / 60 / 58 / 2 / 0 / 0 / 0 | unchanged |
| row_total | 60 / 60 / 54 / 6 / 0 / 0 / 0 | unchanged |
| weights_sum | 24 / 24 / 23 / 1 / 0 / 0 / 0 | unchanged |
| recompute | 54 / 54 / 0 / 53 / 1 / 0 / 0 | 54 / 24 / 0 / 23 / 1 / 0 / 30 |
| cross_edition | 198 / 192 / 189 / 3 / 0 / 6 / 0 | unchanged |
| All | 432 / 426 / 348 / 77 / 1 / 6 / 0 | 432 / 396 / 348 / 47 / 1 / 6 / 30 |

The same 432 checks exist in both builds. 30 recompute checks moved from "within rounding" to "not evaluable",
all with the reason "the printed counts are too coarse to confirm this rate". No other result changed.
All 54 recompute checks now carry `credits_members: false`.

### Cross-edition agreement (D26)

| | Before | After |
|---|---|---|
| Agree | 192 | 192 |
| Fail | 0 | 0 |
| Disputed | 6 | 6 |

### Observations

| Status | Tier | Before | After |
|---|---|---|---|
| checked (published) | A | 137 | 132 |
| checked (published) | B | 190 | 175 |
| checked, total | | 327 | 307 |
| disputed | none | 6 | 6 |
| not yet verified | C | 36 | 56 |
| failed checks | D | 3 | 3 |
| Total | | 372 | 372 |

Of the 20 observations whose only evidence was the coarse recompute, all 20 are now withheld
(tier B to tier C, "not yet verified"). No count observation changed: every count also has a sum check,
so removing the credit from the recompute's inputs changed nothing in this build.

## Every observation whose status or tier changed (25: 20 withheld, 5 still published at a lower tier)

"Printable rates within the bound" is the number of values at the rate's printed precision (0.1) that lie
within the bound of the recomputed rate; the check counts as evidence only when it is 1.

| Series | Round | Printed | Before | After | Recomputed | Bound | Printable rates within the bound | Reason |
|---|---|---|---|---|---|---|---|---|
| `lfs.unemployment_rate.female.rural` | 2017-18 | 5.9 | checked, tier A | checked, tier B (published) | 5.8120 | 0.0952 | 2 | Recompute no longer counts (in either report that prints it); the agreeing second printing remains. |
| `lfs.unemployment_rate.female.rural` | 2018-19 | 8.5 | checked, tier B | not yet verified, tier C (withheld) | 8.5185 | 0.0902 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.female.rural` | 2020-21 | 7.4 | checked, tier B | not yet verified, tier C (withheld) | 7.3941 | 0.1191 | 3 | The recompute was its only passing check. |
| `lfs.unemployment_rate.female.rural` | 2024-25 | 7.6 | checked, tier B | not yet verified, tier C (withheld) | 7.6002 | 0.1076 | 3 | The recompute was its only passing check. |
| `lfs.unemployment_rate.female.total` | 2014-15 | 9.0 | checked, tier B | not yet verified, tier C (withheld) | 8.9359 | 0.0872 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.female.total` | 2017-18 | 8.3 | checked, tier A | checked, tier B (published) | 8.2656 | 0.0867 | 2 | Recompute no longer counts (in either report that prints it); the agreeing second printing remains. |
| `lfs.unemployment_rate.female.total` | 2018-19 | 10.0 | checked, tier B | not yet verified, tier C (withheld) | 9.9755 | 0.0837 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.female.total` | 2020-21 | 8.9 | checked, tier B | not yet verified, tier C (withheld) | 8.9074 | 0.1067 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.female.total` | 2024-25 | 9.7 | checked, tier B | not yet verified, tier C (withheld) | 9.7151 | 0.0944 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.female.urban` | 2014-15 | 20.4 | checked, tier B | not yet verified, tier C (withheld) | 20.3320 | 0.2997 | 6 | The recompute was its only passing check. |
| `lfs.unemployment_rate.female.urban` | 2017-18 | 17.5 | checked, tier A | checked, tier B (published) | 17.6471 | 0.2422 | 4 | Recompute no longer counts (in either report that prints it); the agreeing second printing remains. |
| `lfs.unemployment_rate.female.urban` | 2018-19 | 17.1 | checked, tier B | not yet verified, tier C (withheld) | 16.9014 | 0.2558 | 5 | The recompute was its only passing check. |
| `lfs.unemployment_rate.female.urban` | 2020-21 | 16.4 | checked, tier B | not yet verified, tier C (withheld) | 16.1512 | 0.3659 | 8 | The recompute was its only passing check. |
| `lfs.unemployment_rate.female.urban` | 2024-25 | 17.3 | checked, tier B | not yet verified, tier C (withheld) | 17.2340 | 0.2444 | 5 | The recompute was its only passing check. |
| `lfs.unemployment_rate.male.rural` | 2020-21 | 5.1 | checked, tier B | not yet verified, tier C (withheld) | 5.1490 | 0.0782 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.male.urban` | 2014-15 | 6.2 | checked, tier B | not yet verified, tier C (withheld) | 6.1751 | 0.0818 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.male.urban` | 2017-18 | 5.6 | checked, tier A | checked, tier B (published) | 5.6324 | 0.0770 | 2 | Recompute no longer counts (in either report that prints it); the agreeing second printing remains. |
| `lfs.unemployment_rate.male.urban` | 2018-19 | 6.5 | checked, tier B | not yet verified, tier C (withheld) | 6.5337 | 0.0766 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.male.urban` | 2024-25 | 6.3 | checked, tier B | not yet verified, tier C (withheld) | 6.3132 | 0.0892 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.total.rural` | 2024-25 | 6.3 | checked, tier B | not yet verified, tier C (withheld) | 6.2622 | 0.0672 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.total.total` | 2018-19 | 6.9 | checked, tier B | not yet verified, tier C (withheld) | 6.8509 | 0.0578 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.total.urban` | 2014-15 | 8.0 | checked, tier B | not yet verified, tier C (withheld) | 7.9623 | 0.0783 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.total.urban` | 2017-18 | 7.2 | checked, tier A | checked, tier B (published) | 7.2598 | 0.0737 | 2 | Recompute no longer counts (in either report that prints it); the agreeing second printing remains. |
| `lfs.unemployment_rate.total.urban` | 2020-21 | 7.3 | checked, tier B | not yet verified, tier C (withheld) | 7.3517 | 0.0914 | 2 | The recompute was its only passing check. |
| `lfs.unemployment_rate.total.urban` | 2024-25 | 8.0 | checked, tier B | not yet verified, tier C (withheld) | 8.0585 | 0.0826 | 2 | The recompute was its only passing check. |

Among the withheld figures is one headline rate: the unemployment rate for both sexes, Pakistan, 2018-19 (6.9).
Its recomputed value 6.8509 with bound 0.0578 admits 6.8 as well as 6.9, and it is printed once
in the located tables (the 2020-21 report's unemployment-rate table is not located), so no second printing exists.

## Tests

- `pipeline/tests/test_review_lfs.py`: the 9 xfail markers (16 parametrised cases) are removed; all pass. Added:
  a rate outside a coarse bound still fails; the count of printable values; the refused round records its reason;
  a header-flagged row with some numbers flags the table; a real second edition still agrees beside a duplicate
  file; the two tests for the unproven items 5 and 6.
- One reviewer test was changed and this needs a second pair of eyes:
  `test_recompute_does_not_make_an_input_count_checked` used labour force 64.80 and 65.90 and asserted that the
  recompute passes. With the REVIEW-LFS-1 rule those two values no longer pass (two printable rates lie within
  the bound), so the parameters are now 64.90 and 65.80, where the rate is singled out and the count is still
  0.9 million apart. The original two values are kept in a new test that asserts `not_evaluable`.
- `pipeline/tests/test_lfs.py`: two title strings were shortened forms that no report prints
  ("... pakistan and provinces" with no unit; "... (19th icls)" with nothing after). They now carry the
  title as printed, because every pattern runs to the unit.

## To record as decisions (not written into DECISIONS.md here, to avoid colliding with parallel tracks)

1. A recompute result is evidence for a rate only when the rounding bound singles out the printed value
   (REVIEW-LFS-1). The frozen bound formula is unchanged; this is a rule about when its result is evidence.
2. A passing rate recompute is evidence for the rate, not for the counts it was computed from (REVIEW-LFS-2).
3. Two registered files of one round are one edition (REVIEW-LFS-8).

## Limits and things to know

- **A rate outside a coarse bound still fails.** The task text reads "otherwise the check is not_evaluable";
  that is applied to results inside the bound only. Turning a fail into "not evaluable" would let an agreeing
  second printing publish a rate that the counts contradict. No check in this build is affected (the one
  recompute fail was a fail before and after).
- **Title patterns are now exact to the titles seen in the four reports.** A report that prints a title in
  another form (for instance the national 2014-15 report being added on another branch) will have that table
  "not located" until its form is added to `captions`. That is the safe direction.
- **2014-15 is listed as 13th ICLS throughout** on the strength of the review (section REVIEW-LFS-4) and the
  spec's own comment that every round before 2024-25 uses the 13th ICLS definitions. The registered 2014-15
  file is still skipped (AJK edition), so the entry has no effect until a national 2014-15 report is registered.
- **REVIEW-LFS-5 raises.** One LFS source with an empty page count or a page-range manifest without its range
  now stops the LFS build with a message naming the run, instead of building without that source.
- **REVIEW-LFS-6 maps nothing below a Rural/Urban heading** for the rest of the table. Mapping "Pakistan"
  under "Rural" to the rural series would be correct for that layout, but no report in the registry prints it,
  so there is nothing to test the mapping against.
- `header_row_with_numbers` is recorded on the table and its cells but is not a blocking flag: the rows that
  remain are read as before, and the lost row's figures are simply absent.
- `STATUS.md`, `DECISIONS.md` and `AGENTS.md` were not edited on this branch (other tracks are editing them).
- The remaining "unproven" items of the review (1 to 4, 7 to 10) were not touched.
