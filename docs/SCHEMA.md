# Data model

The models live in `pipeline/datalab/schema.py` (pydantic v2). `python -m datalab export-schema`
writes the JSON Schema files in `schema/`; a test fails if they drift apart.

```
Source ──< Cell >── Series
            │          │
            └──< Observation >── Check
                       │
                    Release (frozen set of all of the above)
```

## The idea in three sentences

A **Cell** is one printed number in one file: a reading, with its page, its box and the exact
printed text. An **Observation** is the fact that one or more cells support, identified by
`series_id : period : vintage` (for example `fed.exp.current.function.health:2025-26:be`). A
**Check** records one deterministic test over cells; an observation's status is computed from
the checks its cells took part in.

This split is why links survive re-extraction: a new Docling run produces new cells, but the
observation's ID does not change.

## Conventions

- **Numbers are decimal strings** in JSON and CSV (`"2550000"`, `"12.34"`), never floats, so
  nothing is lost to binary rounding. Floats appear only in Parquet columns named `*_num`.
- **Boxes** are `[x0, y0, x1, y1]`, fractions of the page (0 to 1), origin at the **top-left**.
  Docling's table boxes use a bottom-left origin and its cell boxes a top-left origin;
  `tables.norm_bbox` converts both and is the only place that does.
- **Pages are 1-based.**
- `value_raw` is the printed text, verbatim, always kept. `value_parsed` is produced only by
  `normalise.parse_printed`.
- IDs: `cell_id` = `c_` + 12 hex of SHA-256 over `source_id|page|table_index|row_index|col_index`;
  `check_id` = `chk_` + 12 hex over the check type, rule and member cell IDs;
  `obs_id` = `{series_id}:{period}:{vintage}`.

## Source: one original file

`source_id` (`abs-fed-2025-26`), `doc_type`, `publisher`, `jurisdiction`, `title`, `period`,
`role` (`core`, `corroboration`, `cross_source`), `landing_url`, `file_url`, `wayback_url`,
`wayback_timestamp`, `retrieved_at`, `retrieved_via` (`official`, `wayback`, `ra-ship-archive`),
`sha256`, `size_bytes`, `format`, `page_count`, `is_born_digital`, `language`, `local_path`
(relative to `SOURCES_DIR`), `verification_status`, `verification_record`, `notes`.

`verification_status`:

| Value | Meaning |
|---|---|
| `official_match_archive` | Downloaded from the official URL; identical to the archived copy. |
| `official_only` | Downloaded from the official URL; no archived copy to compare with. |
| `official_differs_from_archive` | Official download differs from the archived copy (reissued); the official file is used. |
| `wayback_match_archive` / `wayback_only` | Official URL failed; taken from a Wayback snapshot. Shown as a caveat. |
| `archive_copy_content_inspected` | Only the archived copy could be obtained. Shown as a caveat. |
| `failed` | Content inspection failed. The file is not used. |

## Series: what a number measures

`series_id` (dotted slug), `name`, `parent_id`, `dataset` (`abs`, `cpi`, `lfs`), `geo`, `dims`
(for example `{sex: female, area: rural}`), `frequency`, `unit`, `scale_factor` (1000000 for
"Rs in million"), `definition`, `definition_status` (`draft` until a human edits it),
`synonyms`, `breaks` (`{at_period, kind, note}`), `source_doc_types`, `derived`, `derivation`
(formula and input series, derived series only), `sort_key`.

Breakdowns live in the series, not the observation: health and education are different series
with the same parent.

## Cell: one printed number in one file

Where it is: `source_id`, `page`, `table_index` (among the tables on that page), `row_index`,
`col_index`, `row_span`, `col_span`, `table_bbox_norm`, `cell_bbox_norm`, `page_render_sha256`.
What is printed: `row_label_raw`, `row_label_path`, `col_label_raw`, `col_label_path`,
`value_raw`. What the parser made of it: `value_parsed`, `is_missing`, `missing_marker`,
`normalization_flags`, `unit`, `scale_factor`. What it means: `series_id`, `period`, `vintage`,
`mapping_method` (`dictionary` or `unmapped`). How it was produced: `extractor_name`,
`extractor_version`, `run_id`, `extract_config_sha256`, `structural_flags`, `second_reader`.

Cells whose row label is not in the label dictionary keep `series_id: null`. They are in the
release (so coverage can be audited) but never become a published value.

## Observation: the fact

`obs_id`, `series_id`, `period`, `vintage` (`be`, `re`, `actual`, `provisional`, `final`,
`rebased`, `na`), `value` (decimal string, present only when `published`), `unit`,
`scale_factor`, `primary_cell_id` (the earliest document that prints the figure),
`supporting_cell_ids` (other printings of the same figure), `check_ids`, `tier`, `status`,
`published`, `gap_kind`, `gap_reason`, `evidence_summary` (sentence generated from the checks),
`derived_from` (input observations of a derived value), `first_published_release`,
`last_changed_release`.

| Tier | Evidence | Public status | Published |
|---|---|---|---|
| A | an arithmetic check passed and a second official printing agrees | checked | yes |
| B | one of those two | checked | yes |
| C | no check covers it | unchecked: "not yet verified by us" | no |
| D | a check failed with no independent pass, or the reading is flagged | "could not verify; withheld" | no |
| E | resolved by a human (not used yet) | | |

`gap_kind`: `not_in_source` (the government did not publish it), `not_yet_verified` (we have not
verified it), `failed_checks`. An unpublished observation never carries a value.

## Check

`check_id`, `check_type` (`column_total`, `row_total`, `hierarchy_sum`, `cross_edition`,
`cross_table`, `accounting_identity`, `cross_source`, `recompute`, `weights_sum`,
`index_aggregation`), `dataset`, `rule_id`, `source_ids`, `member_cell_ids`, `target_cell_id`
(or `target_value` and `target_source` for an outside source), `expected`, `observed`,
`residual` (= observed minus expected), `tolerance_rule`, `result` (`pass`,
`pass_within_rounding`, `fail`, `not_evaluable`), `not_evaluable_reason`, `description` (plain
words), `official` (false for comparison-only sources, which never feed status).

## Run manifest: one extraction run

`run_id` (`ABS_2025-26__docling__full-document__run-01`), `source_id`, `sha256_at_run`,
`run_mode`, `page_range`, `tool_versions`, `config`, `config_sha256`, `started_at`,
`finished_at`, `duration_s`, `pages_emitted`, `tables_emitted`, `errors`, `profile`,
`validated` (set only by the validator), `validator_report`.

## Release

`version`, `created_at`, `git_commit`, `label`, `doi`, `scope`, `thresholds_sha256`,
`tool_versions`, `extract_config_sha256s`, `source_sha256s`, `counts`, `coverage_summary`,
`check_pass_rates`, `dataset_status`, `gold_set`, `measured_error_rate`, `notes`.

A release folder holds `release.json`, `sources.json`, `series.json`, `observations.json|csv|parquet`,
`cells.json|csv`, `checks.json`, `coverage.json`, `pages/<source_id>/p<NNN>.png`,
`runs/<run_id>.manifest.json`, `dataset_card.md`, `HOW_TO_REPRODUCE.md`, `CHANGELOG.md`,
`ERRATA.md`. `python -m datalab check-release releases/<version>` re-runs the arithmetic of
every check from the release's own cells and confirms that every status follows from the
evidence; it needs no PDFs and runs in CI.
