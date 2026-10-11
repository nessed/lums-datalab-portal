# Track: second reader (decision D28, plan step C4), 2026-10-12, unattended

Branch `proto/v0-second-reader`. Every number below was produced by `python -m datalab build --dataset cpi`
in this track's own `WORK_DIR` and read from `datasets/cpi/{info,cells,checks,observations,coverage}.json`.
No value was written, corrected or judged by an LLM: pdfplumber reads the words, `normalise.parse_printed`
parses them, the checks decide. Coverage and accuracy are reported separately. No Docling run was started
and nothing under `releases/` or `site/` was touched.

## 1. What was built

| File | What |
|---|---|
| `pipeline/datalab/second_reader.py` | pdfplumber reader. Words inside the table box, lines by vertical overlap, value columns by horizontal overlap, columns confirmed against the first reader's column positions. Returns an ordinary `tables.Table` or "not usable" with a reason. |
| `pipeline/datalab/datasets/common.py` | `try_second_reader(...)`: the generic routing and decision hook (about 100 lines, appended at the end of the file). |
| `pipeline/datalab/datasets/cpi.py` | About 20 lines in `build()` that call the hook for each located table, plus the import. Nothing else in the file changed. |
| `pipeline/datalab/schema.py` | Additive only, see section 5. |
| `pipeline/datalab/status.py` | `second_reader_sentence()` and two lines in `evidence_sentence()`. |
| `pipeline/tests/test_second_reader.py` | 20 tests on PDFs generated in `tmp_path`. |
| `pipeline/requirements-ci.lock`, `pyproject.toml` | pdfplumber and its dependencies pinned for CI at the versions in `requirements.lock`. |

### How the reader works

1. pdfplumber words whose centre is inside the table box (normalised, top-left; a `tables.Table` already holds
   the converted box, a raw Docling box must go through `tables.norm_bbox` first).
2. Lines: words that overlap vertically by at least half the smaller height.
3. Header and body are split at the top of the first reader's first data row. Header words are kept as header
   text (they count for coverage) and are never read as data.
4. Label and value words are split at the left edge of the first reader's first value column.
5. Value columns: groups of value words whose horizontal extents overlap. The number of groups must equal the
   number of columns the spec expects, and every column the first reader read cleanly (cells holding exactly
   one number) must fall on exactly one group.
6. A leading code column ("1.", "2.") is kept apart from the names when a clear gutter separates it from them
   on every line. Without this, "Furnishing & Household Equip. &" / "5. Maintenance" reads as one scrambled label.
7. Cell text is the word verbatim; its box is the word's box. Nothing is parsed in the reader.

### When it refuses (returns `usable = False` and a reason, never a best guess)

- the number of columns found by position is not the expected number;
- a piece of text straddles two column bands;
- a first-reader column matches no column or two columns of the second reading;
- two pieces of text fall in one cell;
- a word sits across two lines;
- a row of numbers has no label;
- a label-only line could belong to either neighbouring row (it is attached only when it is at most 0.75 times
  as far from one row as from the other);
- the page size pdfplumber sees differs from the first reader's by more than 0.5 pt;
- the first reader's table has no cleanly read number to anchor on, or its first data row lies outside the
  table box (this is what an unconverted bottom-left box produces).

### How the decision is made (`common.try_second_reader`)

Routed only when the first reader's table carries `merged_rows` or `dropped_column`. The second reading is
turned into a `Table` and goes through the dataset's own `build_cells`, so the detectors, the coverage measure
against the PDF text layer, the header checks and the label dictionary are all re-run on it. It becomes the
primary reading only when all of these hold:

- the reader says the structure is unambiguous;
- the second reading's own table carries no blocking flag;
- every arithmetic check on the table passes: none fails and none is not evaluable;
- every required check type ran at least once (CPI: `weights_sum`, `index_aggregation`, `recompute`).

Otherwise nothing changes: no second-reader cell is stored, the first reader's cells keep their flags and the
figures stay withheld. The reason is written to `info.json` under `located[...].second_reader.decision`.

When promoted:

- second-reader cells are stored as ordinary cells with their own ids, their own flags (the first reader's
  blocking flags do not carry over), `extractor_name = "pdfplumber"`, `extractor_version`, their own
  `extract_config_sha256`, and `second_reader_of` linking back to the first reader;
- the first reader's cells stay in `cells.json`, unmapped, with their original flags plus
  `superseded_by_second_reader`, and with `second_reader` filled (what pdfplumber read at the same spot);
- the table's coverage row is the second reading's, with `reader: pdfplumber` and the first reader's
  measurement kept under `first_reader_coverage`;
- tiers come from `status.decide_tier` unchanged: arithmetic alone gives B; A needs a cross-edition or
  cross-source agreement as well.

## 2. Result on the two real flagged tables

Source `cpi-pbs-2021-06`, run `CPI_2021-06__docling__full-document__run-02`, pdfplumber 0.11.10.

| | Urban (p. 9) | Rural (p. 10) |
|---|---|---|
| First reader's flags | merged_rows, dropped_column, column_unmapped | merged_rows, dropped_column, column_unmapped |
| What the first reader did | 7 value columns instead of 8: the two "% change" columns in one cell (`-0.44 9.60`) | the same |
| Second reading usable | yes | yes |
| Value columns found / expected | 8 / 8 | 8 / 8 |
| First-reader columns matched | 6 of 6 | 6 of 6 |
| Data rows | 15 | 15 |
| Value cells read | 120, all parse as one number | 120, all parse as one number |
| Flags on the second reading | none | none |
| Column headers confirmed from the text layer | yes, no problems | yes, no problems |
| Unmapped or ambiguous labels | none | none |
| Cells mapped to a series | 77 | 77 |
| **Coverage** (printed numeric tokens matched) | 142 / 142 in the box, 142 / 142 in the row band | 142 / 142, 142 / 142 |
| Numbers also emitted by Docling (multiset) | 142 of 142 | 142 of 142 |
| **Checks**: weights_sum | 1 run, 1 passed (within rounding) | 1 run, 1 passed (exact) |
| index_aggregation | 3 run, 3 passed (within rounding) | 3 run, 3 passed (within rounding) |
| recompute (YoY and MoM) | 26 run, 26 passed (within rounding) | 26 run, 26 passed (within rounding) |
| Decision by code | used: all 30 arithmetic checks pass | used: all 30 arithmetic checks pass |
| Observations that become publishable | 77, all tier B | 77, all tier B |

The 77 per table are 13 rows (General and 12 groups) times index for June 2021, May 2021 and June 2020,
YoY and MoM, plus 12 group weights. The 43 unmapped cells per table are the two food sub-rows, the two impact
columns and the general weight, as in every other issue.

The two readers agree on every number (142 of 142 in each table). Docling read the digits correctly and got
the structure wrong; pdfplumber supplies the structure. Every one of Docling's 210 body cells in the two
tables has `second_reader.agreement = true`.

### Dataset totals, before and after (this track's WORK_DIR)

| | Before | After |
|---|---|---|
| Published observations | 884 (117 A, 767 B) | 1,038 (117 A, 921 B) |
| Withheld, not yet verified | 372 | 218 |
| Evaluable checks | 507, all pass | 567, all pass |
| Cells | 1,770 | 2,010 (240 read by pdfplumber) |
| Urban and rural gaps for the June 2021 issue | 154 | 0 |

### Cross-edition agreement

None is possible with the issues in hand, and none is claimed. The June 2021 issue prints indices for
2021-06, 2021-05 and 2020-06. The next issue processed is June 2023, which prints 2023-06, 2023-05 and
2022-06. For all 154 promoted observations, the number of printings of the same series and month in another
issue is 0 (counted by code). So all 154 are tier B and none is tier A. The June 2022 issue would give 26
cross-edition pairs (urban and rural, General and 12 groups, June 2021) and the June 2020 or May 2021 issues
more; plan item E4 (monthly issues) would supply them.

## 3. ABS and LFS scan

Both datasets were built in this track's WORK_DIR and every located table's flags were read from `info.json`.

| Dataset | Located tables | With `merged_rows` or `dropped_column` |
|---|---|---|
| ABS | 9 | 0 |
| LFS | 25 | 0 |
| CPI | 15 | 2 (the two above) |

Nothing to route in ABS or LFS, so the hook was not wired into those builders. It is generic: a builder passes
its own `build_cells` and its own arithmetic checks, as `cpi.py` does. Note that the scan covers the tables
the builders locate; tables Docling emitted that no builder maps were not scanned for this report.

## 4. Overlays looked at

`WORK_DIR/qa/overlay_cpi-pbs-2021-06_p009_second_reader.png` and `..._p010_second_reader.png`, both viewed.
On each page: one box per printed number, sitting on the number; eight separate value columns, with the two
"% change" columns (which Docling merged) boxed separately; fifteen data rows; the serial numbers boxed on
their own in the "No" column; the wrapped label "Furnishing & Household Equip. & / Maintenance" in one box
spanning both lines; header words boxed line by line above the first data row and none of them inside the
body. Nothing boxed outside the red table box. The tables are ruled, not borderless; word geometry does not
use the rules.

## 5. Schema additions (additive only; nothing renamed, removed or repurposed)

| Where | Addition |
|---|---|
| `Cell.second_reader_of` | New optional field, default `null`. Set only on a cell read by the second reader. |
| `SecondReaderOf` (new model) | `first_reader` (str), `first_reader_version` (str), `routed_by` (list of the first reader's structural flags that routed the table), `first_cell_ids` (first-reader cells covering the same spot; may be one merged cell). |
| `cell_id_for(..., reader="")` | New optional argument. Empty for the first reader, so every existing id is unchanged; second-reader ids add `|pdfplumber` to the hashed key. |
| `Cell.second_reader` (existing, unchanged shape) | Now filled on first-reader cells of a promoted table: `name`, `version`, `value_raw` (the second reader's text at that spot, joined by a space when the first reader's cell was merged), `agreement` (same multiset of numbers). |
| `Cell.structural_flags` value | `superseded_by_second_reader` on first-reader cells of a promoted table (not a blocking flag; those cells are unmapped). |
| `Cell.extractor_name` value | `pdfplumber` for second-reader cells. `run_id` on those cells is the Docling run that routed the table (its manifest carries the verified file hash); `extract_config_sha256` is the hash of `second_reader.READER_CONFIG`. |
| `coverage.json` rows | Two extra keys on a promoted table's row: `reader`, `first_reader_coverage`. |
| `info.json` | `located[<table>].second_reader`: the full decision record. |

`schema/cell.schema.json` is regenerated; the sync test passes.

## 6. Receipt wording

Generated from stored fields (`extractor_name`, `second_reader_of.first_reader`, `second_reader_of.routed_by`).
Example, `cpi.rural.yoy.general:2021-06:na`, value 9.73:

> Read by a second tool (pdfplumber) because the first tool (docling) lost a column and merged rows in this
> table; the second reading is used only because the table's own arithmetic checks pass on it. Matches the
> recomputation from the printed figures it is derived from (2 printed figures; within rounding).

## 7. Decisions taken in this track (provisional, unattended; for the lead to copy into DECISIONS.md)

1. Second-reader cells are separate `Cell` records linked by `second_reader_of`, not values nested inside the
   Docling cell. A merged Docling cell has no one-to-one partner, and each second-reader value needs its own
   box for the receipt. The plan's "recorded under cell.second_reader" is kept as well, on the Docling cells.
2. Promotion is all-or-nothing per table: one failed or not-evaluable arithmetic check on the table keeps the
   whole table withheld.
3. When a reading is not promoted its cells are not stored; only the decision record is.
4. The reader requires the expected number of value columns from the spec. Without it there is no way to
   tell a lost first column from a label.

## 8. Limits and what the checks do not cover

- **Coverage of the second reading is weaker evidence than for Docling.** pdfplumber and PyMuPDF both read
  the same text layer, so 142 / 142 says the reader placed every printed number in a cell; it cannot say the
  text layer matches the ink.
- **Arithmetic cannot see two row labels swapped.** Every CPI check is internal to a row or symmetric across
  rows. A label is taken from the same printed line as its numbers, which is why an ambiguous label line is a
  refusal. The same is true of the Docling path.
- **pdfplumber joins characters closer than 3 pt into one word.** Two numbers printed that close in adjacent
  columns would come out as one string; the reader cannot detect it. It would fail to parse as one number or
  fail a check, and the table would stay withheld.
- Tested on one real layout (PBS CPI, ruled) and one generated borderless table. No human spot check yet.
- Tier A for these values needs another issue that prints the same months.

## 9. Not done

- `DECISIONS.md`, `STATUS.md`, `README.md`, the release and the site were not edited (owned by the lead and
  other tracks). `AGENTS.md` section 11 still says the two 2021 tables are withheld; that becomes untrue once
  the lead rebuilds the release from this branch.
- `datalab release` and `check-release` were not run on the new cells (no rebuild under `releases/` in this
  track). `release.extract_config_sha256s` lists run configs only, so the second reader's config hash
  appears on cells but not in that list.
- The hook is not wired into `abs.py` or `lfs.py` (no flagged table there).
- No Camelot reader for ruled tables (AGENTS.md section 5 step 7 names it; D28 asks for pdfplumber only).

## 10. How to re-run

From `pipeline/` in this worktree, with the project venv:

```
python -m pytest -q                         # 219 tests, 20 of them in tests/test_second_reader.py
python -m datalab export-schema             # no diff expected
python -m datalab build --dataset cpi       # writes WORK_DIR/datasets/cpi and WORK_DIR/qa/overlay_*_second_reader.png
```

The decision records are in `WORK_DIR/datasets/cpi/info.json` under
`located["cpi-pbs-2021-06:urban"].second_reader` and `located["cpi-pbs-2021-06:rural"].second_reader`.
A one-off script outside `pipeline/` imports the main checkout's `datalab` (the venv's editable install), not
this worktree's: run it with `PYTHONPATH=.` from `pipeline/`.
