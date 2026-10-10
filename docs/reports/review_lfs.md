# Adversarial review of the LFS builder (2026-10-11)

Branch `proto/v0-review-lfs`. Target: `pipeline/datalab/datasets/lfs.py` with `specs/lfs.yaml`,
`specs/lfs_labels.yaml` and the shared code it calls (`checks.py`, `status.py`, `tables.py`,
`normalise.py`, `datasets/common.py`). Nothing in the pipeline was changed. Every finding has a test in
`pipeline/tests/test_review_lfs.py` that fails on the current code and is marked `xfail(strict=True)`,
so the suite stays green (`200 passed, 16 xfailed`) and a fix makes the marker itself fail until it is removed.

## Result in one paragraph

No wrong value, round, sex, area or definition was found in the LFS part of `releases/v0.0.1-prototype`.
Eight defects were found in the code. One of them (REVIEW-LFS-1) weakens evidence that is in the release
today: 20 unemployment-rate observations are tier B on a check that would also have passed for a different
printed rate. The other seven are latent: they need a table layout, a Docling fault or a registry state
that the four registered reports do not have, and they affect 0 values in the release.

## What was checked against the real data (and found clean)

All counts below were produced by scripts over the release files and the source PDFs.

- **Page and box.** For all 570 mapped LFS cells, the words in the PDF text layer at the stored page and
  `cell_bbox_norm` (top-left, normalised) equal `value_raw`: 570 of 570. No page offset in the page-range
  runs, no bbox origin mix-up.
- **Columns.** In all 25 located tables the mapped columns read left to right as previous round then own
  round, each Total, Male, Female, and the last block is the report's own round. The Augmented columns
  (4, 5, 9, 10 of the 2017-18 and 2018-19 participation tables) are unmapped. Header geometry was read by
  hand for 2017-18 p.30 and 2024-25 pp.76, 144, 145.
- **Rows.** In every area table the mapped rows are the first three data rows, labelled
  Pakistan/Total, Rural, Urban; no provincial row is mapped. Industry labels map to the expected slug in
  all four industry tables.
- **Titles.** Every line of the four PDFs that starts a "Table N" reference was run through `classify`.
  Only the intended titles are accepted; the 19th ICLS tables on pp.57, 71, 76 of 2024-25 are rejected.
  On p.76 (both definitions on one page) the mapped table is Table 4.6, the 13th ICLS one.
  Table 9.3 (p.145) states "13th ICLS" in its header line, not in its title; Table 9.2 (p.144) is the 19th.
- **Evidence.** No count is published on the strength of the recompute check alone; no blocked table; no
  cell whose box fell back to the table box; one source per round.

## Findings

| Id | Severity | Could it publish a wrong value? | Values affected in the release |
|---|---|---|---|
| REVIEW-LFS-1 | high | Yes: a rate with a wrong last digit passes | 30 of 53 passing recompute checks; sole evidence for 20 observations |
| REVIEW-LFS-2 | medium | Yes: a count nothing else covers | 0 (70 counts are credited by it, all also have a sum) |
| REVIEW-LFS-3 | medium | Yes: a sub-population table as the headline | 0 |
| REVIEW-LFS-4 | medium | Yes: wrong definition (19th as 13th ICLS) in a later round | 0 |
| REVIEW-LFS-5 | low | No (boundary pages used, or data silently missing) | 0 |
| REVIEW-LFS-6 | low | Yes: wrong area, on a layout not yet seen | 0 |
| REVIEW-LFS-7 | low | No (headline row lost with no flag) | 0 |
| REVIEW-LFS-8 | medium | Yes: unchecked figures become checked | 0 |

### REVIEW-LFS-1: the recompute bound is wider than the printed precision of the rate

- Where: `pipeline/datalab/datasets/lfs.py:492-507` (`recompute_unemployment_rate`), bound described in
  `specs/lfs.yaml:50-55`.
- The bound `dR + 100 x (dU/L + U x dL/L^2)` is correct error propagation, but it grows with 1/L. For the
  female urban labour force (2.4 to 4.7 million, printed to 0.01) it is 0.24 to 0.37 percentage points for
  a rate printed to 0.1. The check then accepts four to six different printed rates and still returns
  `pass_within_rounding`, which `status.decide_tier` counts as arithmetic evidence: tier B, "checked".
- Measured: 53 recompute checks pass. For 30 of them at least one other printable value of the rate would
  also pass. 20 tier A/B observations have no other passing evidence. In 9 checks the bound is at least one
  full unit of the rate's last digit (7 observations with no other evidence: female urban 2014-15, 2018-19,
  2020-21, 2024-25; female rural 2020-21, 2024-25; female total 2020-21). Widest case: female urban
  2020-21, printed 16.4, recomputed 16.15, bound 0.3659.
- Test: `test_recompute_cannot_confirm_two_different_printed_rates` (two cases: from employed, from
  unemployed).
- Suggested fix: a recompute result counts as evidence for the rate only when the bound is small enough to
  single out the printed value (for example bound below one unit of the rate's last digit, or no other
  printable value inside the bound). Otherwise record `not_evaluable` with the reason "the printed counts
  are too coarse to test this rate", which leaves the observation tier C. The frozen formula itself does
  not need to change; this is a rule about when its result is evidence, and it should be recorded as a
  decision.

### REVIEW-LFS-2: a passing recompute check is credited to the counts it was computed from

- Where: `lfs.py:486-507` passes the counts as `members`; `status.py:174-177` files every check under its
  members as well as its target; `status.py:49-58` then counts it as arithmetic evidence for them.
- A rate of 5.8 with 3.79 million unemployed passes for any labour force between about 64.7 and 66.0
  million. The check does not test the labour-force cell to anything like its printed precision, yet that
  cell becomes tier B and is published with the sentence "One of 2 printed figures from which ... recomputes".
- Measured: 70 count observations carry a passing recompute check as a member; all 70 also have a sum
  check, so 0 depend on it. It becomes live for any count table whose sums cannot run (a missing Rural or
  Urban row, a blocked sibling table).
- Test: `test_recompute_does_not_make_an_input_count_checked` (labour force 64.80 and 65.90).
- Suggested fix: a recompute check is evidence for its target only. Keep the inputs on the receipt, but do
  not let them earn a tier from it.

### REVIEW-LFS-3: title patterns match anywhere in the title

- Where: `specs/lfs.yaml:66-124` (`captions`), applied by `re.search` in `lfs.py:129`.
- The leading `\b` stops "unemployed" matching "employed", but nothing ties the phrase to the start of the
  title. "Youth (15-24 years) unemployment rate by province, region & sex", "Long term unemployed -
  Pakistan and provinces", "Self employed - Pakistan and provinces", "Female civilian labour force -
  Pakistan and provinces" and "Non-agriculture employed - distribution by major industry divisions" are all
  classified as the headline table. The tie rule (`lfs.py:371-377`) only compares tables that were found,
  and page-range runs see part of a report, so one such table with the real one outside the range or
  missed by Docling is mapped to the headline series; its own sums pass.
- Measured: 0. No title in the four reports triggers it (every "Table N" line was classified).
- Test: `test_title_with_a_qualifier_is_not_the_headline_table` (five titles).
- Suggested fix: anchor each pattern to the table number ("table N", optional colon, then the phrase), and
  where the title has a fixed end (the unit, the ICLS tag) anchor that too.

### REVIEW-LFS-4: a round later than 2024-25 is assumed to be 13th ICLS without being told

- Where: `lfs.py:135-139`, `specs/lfs.yaml:36-39` (`required_in_rounds: ["2024-25"]`).
- The definition must be stated only for the one listed round. For any other round the title is accepted
  as it stands, and every series definition says "13th ICLS". PBS leads with the 19th ICLS from 2024-25;
  a 2025-26 report that prints one definition and does not name it would be mapped into the 13th ICLS
  series. `map_columns` does not stop it: with no `previous_round` entry it accepts a table that prints
  the report's own round alone (`lfs.py:186-189`), which is exactly how the 19th ICLS tables are laid out.
- Measured: 0 (no later round is registered). `datalab release` picks up every registered source.
- Test: `test_round_with_unknown_definition_is_not_assumed_13th_icls` (2025-26, 2026-27).
- Suggested fix: list the rounds known to use the 13th ICLS throughout (2014-15 to 2020-21) and refuse any
  round that is in neither list, instead of defaulting.

### REVIEW-LFS-5: two silent defaults in run selection

- Where: `lfs.py:56-60` (`usable_pages`), `lfs.py:69` (`source.page_count or 0`).
- (a) A page-range run whose manifest has no `page_range` is treated as a full-document run: its first and
  last pages are used (decision D18 forbids that) and it claims every page ahead of older runs.
  (b) A full-document run of a source whose `page_count` is empty supplies no table at all, with no error;
  the build then reports every kind as "not located". Empty page counts are a known registry trap
  (AGENTS.md section 7).
- Measured: 0. All LFS run manifests record their range and all four sources have a page count.
- Tests: `test_page_range_run_without_a_recorded_range_supplies_nothing`,
  `test_full_document_run_is_not_silently_emptied_by_a_missing_page_count`.
- Suggested fix: raise in both cases (or, for (b), take the page list from the run output).

### REVIEW-LFS-6: a "Pakistan" row is the national total whatever heading it sits under

- Where: `lfs.py:244-255` (`AreaRows.lookup`), called for label-only rows at `lfs.py:301-306`.
- A label-only "Rural" row before any block is looked up, found to be a bare area word with no open block
  and forgotten. The "Pakistan" row below it then opens the national block and its amounts are mapped to
  `lfs.<measure>.<sex>.total`, although they are rural Pakistan. Nothing repeats inside the table, so the
  duplicate guard (`lfs.py:330-339`) stays silent. This is the layout "grouped by area first" (heading
  Rural, then Pakistan and the provinces), for instance one Docling fragment of such a table.
- Measured: 0. None of the 25 located tables is laid out this way.
- Test: `test_pakistan_row_under_a_rural_heading_is_not_the_national_total` (end to end: generated PDF text
  layer plus Docling table, through `locate_tables` and `build_cells`).
- Suggested fix: a label-only Rural/Urban row with no open block sets a pending area; a "Pakistan" row
  under it is that area (or stays unmapped), never the total.

### REVIEW-LFS-7: a data row flagged as a column header is dropped on the flag alone

- Where: `lfs.py:294-295`.
- AGENTS.md section 7 records that Docling marks a first data row as a header row and says row meaning
  must never depend on the header flag alone. The LFS builder skips any row whose value cells are all
  flagged, before reading its label. If the row is "Pakistan" with its six amounts, no cell is emitted for
  it, the national block is never opened, Rural and Urban go out of scope, and the table carries no flag:
  coverage 100%, nothing mapped, and the headline gap is labelled "no located and mapped table prints this
  figure yet".
- Measured: 0 (every located table has its national block mapped). No wrong value can result, only a
  silent loss with a misleading reason.
- Test: `test_national_row_flagged_as_header_does_not_vanish_silently`.
- Suggested fix: as in `datasets/cpi.py`, accept a header-flagged row as data when every value column
  holds exactly one number; otherwise flag the table.

### REVIEW-LFS-8: two files of the same edition count as two editions

- Where: `lfs.py:569` (`same = other.source_id == first.source_id`).
- `cross_checks` is given the round of every source (`order`) but decides "another edition" by source id.
  If one report is registered twice (a re-issue, a mirror; the file names already carry "final_report-1"
  and "Report-3"), the two files agree by construction, the agreement is recorded as `cross_edition`, and
  figures printed once with no other check (the participation rates) become tier B and publish. It also
  inflates the cross-edition agreement rate that the 98% threshold is judged on.
- Measured: 0 (one source per round).
- Test: `test_two_files_of_one_edition_are_not_cross_edition_agreement`.
- Suggested fix: two sources with the same round are the same edition: no agreement evidence between them,
  and the build should say that a round is registered twice.

## Consequences of frozen rules (not filed as bugs; they need a recorded decision)

- **"Equal within 1 unit of the last printed digit" (D9, `cross_edition_units_of_last_digit: 1`).** Three
  observations are tier A because two reports print figures 0.1 apart at the same precision: agriculture
  female 2018-19 (69.8 vs 69.7), others female 2018-19 (0.3 vs 0.2), wholesale and retail trade both sexes
  2020-21 (14.4 vs 14.5). Their receipt says "Equal to the figure printed in ...". The first two are in the
  2018-19 industry table that the 2020-21 report restated (6 other rows of the same comparison fail), so
  these are restated figures that happen to land one unit away, not rounding. Rounding can explain a
  difference only when the two printings differ in precision.
- **Failed cross-edition, still tier B.** The 6 disagreeing 2018-19 industry shares carry tier B because
  the shares sum passes (already reported in `track_d_lfs_findings.md`).

## Unproven (suspected, no failing test that shows a wrong outcome)

1. **A sentence in running text can serve as the title.** `caption_and_header` starts the title at the
   last "Table N" above the table, wherever it is. In a scratch run, "As shown in table-11, civilian
   labour force - Pakistan and provinces (million) rose." above an untitled table was accepted and the
   table mapped. I could not build a realistic page where this picks the wrong table: PBS prose does not
   repeat the title phrases, and a real title below the sentence wins.
2. **A header-flagged block heading that is not full width is ignored** (`lfs.py:294-300`). Reproduced:
   the province's Total/Rural/Urban rows are then attributed to Pakistan. With a complete national block
   the duplicate guard unmaps the whole table (safe, data lost). A wrong mapping needed a second fault
   (the national block missing its own Rural and Urban rows).
3. **An unknown label-only row directly above "Pakistan" (for example "Augmented") is ignored** and the
   block is mapped. Reproduced, but a Docling stub header ("Province/Area") looks the same, so I could not
   state an expectation that is not a guess.
4. **The 13th ICLS statement is accepted from any text between the title and the first amount.** That is
   needed (Table 9.3 states it only in its header), but a note line would satisfy it too. No such page
   exists in the 2024-25 report; the notes that mention both definitions sit below the tables.
5. **`cross_checks` ignores blocked tables** while every sum and recompute check honours them, and
   `status.decide_tier` lets an agreeing second printing rescue a flagged cell. Consistent with the
   docstring in `status.py`, in tension with AGENTS.md section 6. No blocked LFS table exists.
6. **`shares_checks` leaves out an industry whose cell is absent** instead of recording `not_evaluable`;
   a lost share of 0.1 or less still passes. No wrong value results, the lost one is simply not there.
7. **Sums cannot see a permutation.** A male/female swap or a one-row label shift passes every sum. Sex
   and industry mapping rest on header position and the dictionary. For 42 industry shares (2014-15 and
   2024-25) the sum to 100 is the only evidence.
8. **`build` does not look at `verification_status`** or compare the run's file hash with the manifest; it
   relies on the gate in `extract.py` and on `skip_sources`.
9. **Coverage is measured inside Docling's own table box**, so a table Docling truncated still reports
   100%. Checked the one short table (2024-25 p.145, 7 rows): it continues on p.146, nothing was cut.
10. **Spec defaults that hide a missing key:** `kind.get("scale_factor", 1)`, `icls.get("forbidden_pattern", ...)`,
    `order.get(source_id, "")`, `spec.get("min_table_coverage", 0.90)`.

## How to run

```
cd pipeline
python -m pytest -q tests/test_review_lfs.py            # 1 passed (fixture baseline), 16 xfailed
python -m pytest -q tests/test_review_lfs.py --runxfail  # shows each failure and its message
```
