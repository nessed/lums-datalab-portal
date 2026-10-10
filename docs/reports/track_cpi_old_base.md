# Track: CPI on the 2007-08 base (D27, step C3)

Branch `proto/v0-old-base-cpi`. Every number below was produced by
`python -m datalab build --dataset cpi` in this track's own `WORK_DIR` and read from
`datasets/cpi/{info,coverage,checks,observations,series,cells}.json` by a script. No value was
written, corrected or judged by an LLM. Coverage and accuracy are reported separately.

## 1. Runs

The two existing runs could not be re-validated: they were refused by the old scanned-page rule
before Docling ran, so their `raw/` folder is empty (no `output.json`). New runs were made, one
at a time. Nothing was overwritten.

| Issue | Pages | Profile (image pages over printed pages) | Run used | Validator |
|---|---|---|---|---|
| cpi-pbs-2016-06 | 12 | 2 of 11 = 18.18% | `CPI_2016-06__docling__full-document__run-02` (new; 9 tables, 340.7 s) | VALIDATED: hash unchanged, error log empty, output present, 12 of 12 pages, text layer ok |
| cpi-pbs-2018-06 | 12 | 2 of 11 = 18.18% | `CPI_2018-06__docling__full-document__run-01` (new; 10 tables, 553.1 s) | VALIDATED, same five checks |
| cpi-pbs-2019-06 | 13 | 2 of 12 = 16.67% | `CPI_2019-06__docling__full-document__run-02` (new; 12 tables, 414.2 s) | VALIDATED, same five checks; the validator report lists the CPI table under `tables_with_detector_flags` |

`CPI_2016-06 run-01` and `CPI_2019-06 run-01` stay on disk as the recorded refusals (not valid, not used).

## 2. What the old-base table prints

- One table per issue, on page 5, captioned "Table 2 : Consumer Price Index by Group of
  Commodities and Services (Base 2007-08)". **No national, urban or rural label anywhere in the
  caption or the header.**
- Rows: General, the same 12 group names the 2015-16 base prints, and the two food sub-rows
  (Non-perishable / Perishable Food Items, not targeted). The basket is a different one (the
  printed weights differ from the 2015-16 ones), so every
  group is a separate series on this base; none is joined to a 2015-16 series.
- Label spellings differ between issues ("Food & Non-alcoholic Bev." / "... Beverages",
  "Alcoholic Bev.& Tobacco" / "Alcoholic Bev. & Tobacco", "Furnishing & Household Equipment
  Maintenance" / "... Maint."). All were already full-match entries in `specs/cpi_labels.yaml`;
  no pattern was added or loosened. The two labels that wrap over two lines in 2016 and 2018
  came out of Docling as one full label.
- Columns: the same eight as the new layout, in the same order (weight; index for the issue
  month, previous month, same month last year; % change over the previous month and over the
  same month last year; two impact columns). Months are printed as "June" above "2016". The
  three issues print the columns identically, so one layout entry covers them; the existing
  rule (8 value columns, the expected month on the bottom header line above each column, the
  words Weight / Indices / Change / Impact above their columns) is applied unchanged.

## 3. Naming (D27) and what replaced what

- Area key in code and spec: `not_stated`. It never appears in a series id.
- Series ids: `cpi.general.b2007_08`, `cpi.group.<slug>.b2007_08`, `cpi.weight.<slug>.b2007_08`,
  and for the change series `cpi.yoy.general.b2007_08`, `cpi.yoy.group.<slug>.b2007_08`,
  `cpi.mom.general.b2007_08`, `cpi.mom.group.<slug>.b2007_08`.
  **Sub-decision taken here (for the lead to record or overturn):** the change series carry the
  base tag too. The existing pattern (`cpi.<area>.yoy.general`) has no base suffix; dropping only
  the area would give `cpi.yoy.general`, which reads like the headline series for all time. With
  the tag, every id of this table ends in `.b2007_08`.
- `dims`: `{"area_as_printed": "none stated", "group": ..., "measure": ..., "base_year": "2007-08"}`.
  There is **no `dims.area`** on these series.
- `definition_status: draft`; `notes`: "The 2007-08 base CPI was compiled from urban centres only
  (to confirm against PBS methodology; not stated in the monthly issue)".
- Every one of the 51 old-base series carries the break `{at_period: "2019-08", kind: "rebase"}`.
- The first run's `cpi.national.*.b2007_08` naming is removed from code, spec and tests. In the
  rebuilt dataset there are 0 series ids ending in `.b2007_08` with an area segment, and 0
  `cpi.national.*` observations for periods before 2019-08 (the first run carried 218 labelled
  gaps there, including year-on-year and month-on-month gaps filed under
  `cpi.national.yoy.*` / `cpi.national.mom.*`). They are replaced by 218 observations under the
  new ids, not duplicated.
- Cross-edition pairs are formed per series id, so an old-base cell can only ever be paired with
  another old-base cell. The SBP cross-source check applies to `cpi.national.yoy.general` only.

## 4. Overlays viewed before mapping

Rendered to `WORK_DIR/qa/overlay_<source_id>_p005.png` and opened.

| Issue | What I saw |
|---|---|
| 2016-06 | Table box encloses caption, header and all 15 data rows. All 8 value columns boxed in every row, one number per box. Rows aligned; the two wrapped labels (rows 4 and 5) are one label box each, with their numbers on the right line. |
| 2018-06 | Same: 8 value columns boxed in every row, rows aligned, wrapped labels intact. |
| 2019-06 | **Not clean.** The two % change columns ("May 2019", "June 2018") are one wide box per row holding both numbers. Weight, the three indices and the two impact columns are boxed singly. Docling reports 9 columns (7 value columns). Detectors: `merged_rows`, `dropped_column`. **Withheld.** |

## 5. Tables located

3 of 3 expected (one per issue), each by the caption in the text layer and the single Docling
table on that page with 13 of 13 row names.

| Issue | Page | Structural flags | Columns mapped | Rows mapped | Unmapped / ambiguous labels |
|---|---|---|---|---|---|
| 2016-06 | 5 | none | 8 of 8 | 13 (+2 not targeted) | 0 / 0 |
| 2018-06 | 5 | none | 8 of 8 | 13 (+2 not targeted) | 0 / 0 |
| 2019-06 | 5 | `merged_rows`, `dropped_column`, `column_unmapped` | 0 (7 value columns; 8 expected) | labels recognised, nothing mapped | 0 / 0 |

## 6. Coverage (how much of the printed table was captured)

| Issue | Printed numeric tokens in the table box | Matched | Coverage | Row-band coverage |
|---|---|---|---|---|
| 2016-06 | 142 | 142 | 100% | 100% |
| 2018-06 | 142 | 142 | 100% | 100% |
| 2019-06 | 142 | 142 | 100% | 100% |

The 2019-06 figure is the trap: every printed number is present in Docling's output, but two of
them share a cell in each row, so the column boundary is lost. Coverage does not see that; the
detectors do. Coverage is not a statement about correctness.

## 7. Checks (how much of what was captured is right), old-base issues only

| Check | Evaluable | Pass | Pass within rounding | Fail | Not evaluable |
|---|---|---|---|---|---|
| weights_sum | 2 | 0 | 2 | 0 | 0 |
| index_aggregation | 6 | 0 | 6 | 0 | 0 |
| recompute (% change from printed indices) | 52 | 0 | 52 | 0 | 0 |
| cross_edition | 0 | 0 | 0 | 0 | 0 |
| **All** | **60** | 0 | 60 | 0 | 0 |

Per issue: 2016-06 and 2018-06 each have 1 weights_sum, 3 index_aggregation, 26 recompute. The
2019-06 table has no checks at all: nothing from it is mapped, so there are no check records
(not "passed", and not counted as evaluable).

- **weights_sum:** the 12 printed weights add to 99.99 against a printed 100.00 in both issues
  (residual -0.01, tolerance 0.05 from the spec).
- **index_aggregation:** the general index is the weighted average of the 12 group indices
  within the unchanged spec tolerance. Residuals -0.019, -0.023, -0.022 (2016-06) and -0.025,
  -0.020, -0.023 (2018-06) against tolerances of 0.135 to 0.153. The tolerance rule was not
  touched.
- **recompute:** all 26 + 26 printed month-on-month and year-on-year changes recompute from the
  printed indices (within rounding by construction: the recomputed value is not rounded).
- **Failing checks: none.**

### Cross-edition agreement

**0 evaluable pairs for the 2007-08 base.**

- June 2019 prints June 2018 again, and June 2018 is published from the 2018-06 issue. The pair
  cannot be formed because the 2019-06 table is withheld (its index columns are probably fine,
  but a flagged table maps nothing; that is the rule).
- June 2018 prints June 2017 and May 2018; June 2016 prints June 2015 and May 2016. No other
  registered issue prints those months.

So every old-base value rests on arithmetic evidence inside one table only (tier B). The
dataset-level cross-edition figure is unchanged: 117 of 117, all from the 2015-16 base.

## 8. Observations

Old base (ids ending `.b2007_08`): 218 observations in 51 series.

| State | Count | Notes |
|---|---|---|
| Published, tier A | 0 | no cross-edition or cross-source agreement exists |
| Published, tier B | 154 | 77 from 2016-06 and 77 from 2018-06: 78 index values (6 general, 72 group), 26 month-on-month, 26 year-on-year, 24 weights |
| Withheld, `not_yet_verified` | 64 | every figure only the 2019-06 issue prints: 51 for 2019-06 and 13 for 2019-05 |
| Withheld, `failed_checks` | 0 | |
| Withheld, `not_in_source` | 0 | |

Published periods: 2015-06 (13), 2016-05 (13), 2016-06 (51), 2017-06 (13), 2018-05 (13),
2018-06 (51). June 2018 is published from the 2018-06 issue; the 2019-06 reprint would only have
added a second printing.

345 cells from the three tables are in `cells.json`; 154 are mapped. Unmapped by design: the
general weight, the two impact columns, the two food sub-rows, and all 105 cells of the 2019-06
table (120 + 120 + 105 = 345).

**Known wording flaw, left alone because the function is shared:** the gap reason for the
2019-06 figures reads "The column headings of the CPI table (no area stated) ... could not be
confirmed by code". The real cause is the merged column. The 2021 urban and rural gaps have the
same wording. A one-line fix in `gap_observations` (name the structural flags first) is for the
lead.

## 9. The 2015-16 base did not change

| | Before (first run) | After this track |
|---|---|---|
| Tables located | 15 (2 flagged) | 15 (2 flagged) |
| Coverage | 2,121 of 2,121 | 2,121 of 2,121 |
| Checks passing | 507 (13 weights, 39 aggregation, 338 recompute, 117 cross-edition) | 507, same split |
| Published | 884 (117 A, 767 B) | 884 (117 A, 767 B) |
| Gaps | 372 | 154 under 2015-16 ids + 218 under old-base ids, of which 154 are now published and 64 remain gaps |

Dataset totals now: 18 tables located (3 flagged and withheld), coverage 2,547 of 2,547, 567
checks all passing, 1,256 observations, **1,038 published** (117 A, 921 B), **218 gaps**, 204
series.

## 10. What the site needs to know (no site file was changed by this track)

A first attempt at site changes was reverted on instruction; `site/` is identical to `proto/v0`.
For whoever owns `site/`:

- **Which series form the segment:** every series with `dims.area_as_printed` present (value
  `"none stated"`). Equivalently, CPI series whose id ends in `.b2007_08`. 51 series: 13 index,
  12 weight, 13 year-on-year, 13 month-on-month.
- **`dims.area` is absent on these series.** Any site code that reads `dims.area` must tolerate
  that. `dims.base_year` is `"2007-08"`.
- **Roots** (no `parent_id`): `cpi.general.b2007_08`, `cpi.yoy.general.b2007_08`,
  `cpi.mom.general.b2007_08` and the 12 `cpi.weight.<slug>.b2007_08`. Group series have the
  matching general series as parent, always inside the segment.
- **Order:** `sort_key` 30,500 and above; the highest 2015-16 key is 23,012. So the segment
  sorts as one block after rural. A heading above the block is all the browse page needs.
- **Break marker:** `series.breaks = [{"at_period": "2019-08", "kind": "rebase", "note": "CPI
  rebased from 2007-08 to 2015-16; values on the two bases are not comparable"}]` on every CPI
  series, both bases. `site/src/lib/chart.ts` already draws a break at `at_period` even when it
  lies after the last point, and `canConnect` never joins across it; the old-base series end at
  2019-06, so the marker sits just right of their last period.
- **No line can join the two bases:** they are different series ids on different pages; there
  is no series that holds both.
- **Series note:** `series.notes` holds the "urban centres only (to confirm ...)" sentence and
  `definition_status` is `draft`. The series page does not show `series.notes` today (the site's
  `Series` type has no `notes` field); it should, next to the definition, with the draft marker.
- **Names** read "CPI (no area stated): General (all groups), index (base 2007-08)".
- **Charts will look sparse:** published periods are June and May of 2016 and 2018 plus June
  2015 and June 2017; `canConnect` joins only May to June.

## 11. Schema and release changes

None to `schema.py`, `status.py`, `release.py` or `checks.py`. Additive only, inside existing
free-form fields:

1. New `dims` key on old-base CPI series: `area_as_printed` (string, value `"none stated"`).
2. `dims.area` is not set on those series (it was `"national"` under the superseded naming).
3. New series ids as listed in section 3; the ids `cpi.national.*.b2007_08` no longer exist.
4. `Series.notes` is now filled for old-base series and empty for all others (the placeholder
   note on national series is gone).
5. `coverage.json` rows for these tables are labelled `CPI by group (not_stated, base 2007-08)`.
6. `info.json` keys for these tables are `<source_id>:not_stated`.

## 12. Files changed

- `pipeline/datalab/datasets/cpi.py`: `AREA_NOT_STATED`, `old_base_series_id`, `table_words`;
  `series_id_for`, `series_catalogue`, `find_captions` and five message strings.
- `specs/cpi.yaml`: `rebase.old.areas: [not_stated]`, `areas.not_stated`, comments.
- `pipeline/tests/test_cpi_old_base.py` (new, 23 tests, including four end-to-end builds on PDFs
  drawn with PyMuPDF in `tmp_path`); `pipeline/tests/test_cpi.py` (six assertions that named the
  old ids).
- `AGENTS.md` section 7 (four traps) and one line of section 11.
- This note.

Suite: 222 passed.

## 13. Not done

- **Site (step 7):** removed from this track's scope; see section 10.
- **June 2019 values:** withheld. The second reader (D28) is the route; when it lands, the
  June 2018 cross-edition pairs (13) become evaluable and would lift those 13 values to tier A.
- **Cross-edition for the old base:** none evaluable (section 7). More 2007-08 issues (E4)
  would supply pairs.
- **`STATUS.md`, `README.md`, `DECISIONS.md`, release rebuild:** left to the lead. Lines that are
  now out of date: STATUS.md lines 40, 72, 80; DECISIONS.md line 53; AGENTS.md section 11 was
  updated here.
- **Urban-only note:** not verified against PBS methodology; it is the D27 text, marked draft.
- No human spot check and no gold-set labels for these values yet.

## 14. Rebuild

```
cd pipeline
python -m datalab extract --source cpi-pbs-2016-06     # only if the runs are not copied over
python -m datalab extract --source cpi-pbs-2018-06
python -m datalab extract --source cpi-pbs-2019-06
python -m datalab validate --dataset cpi
python -m datalab build --dataset cpi
python -m pytest tests -q
```

To reuse this track's runs instead of extracting again, copy these three folders from this
track's `WORK_DIR/runs` into the main `WORK_DIR/runs`:
`CPI_2016-06__docling__full-document__run-02`, `CPI_2018-06__docling__full-document__run-01`,
`CPI_2019-06__docling__full-document__run-02`. None of these ids exists in the main folder (it holds
only the two refused run-01 folders), so nothing is overwritten.
