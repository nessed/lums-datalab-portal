# How a number gets on the site

This page follows one real figure from a government PDF to a page on the site, step by step. It is meant for someone new to the project. Terms in use here are explained in `docs/GLOSSARY.md`, and the rules behind each step are in `docs/METHODS.md`.

The figure is `fed.exp.current.function.health:2025-26:be`: the budget estimate for Health (current, revenue account) in 2025-26, taken from the Annual Budget Statement 2025-26.

**Where the values on this page come from.** Every value in a table below was read from the release folder `releases/v0.0.1-prototype/` by the script `pipeline/scripts/gen_walkthrough.py`, which also wrote this page. Each row names the file and the field. No value was typed by a person or by a language model. If the release is rebuilt, run the script again.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Release | `v0.0.1-prototype` | `release.json` | `version` |
| Built at | `2026-10-10T23:26:08+00:00` | `release.json` | `created_at` |
| From commit | `839584b0e7c176be143273c52962fd30d6efb75e` | `release.json` | `git_commit` |

## The figure we are following

On the site this figure reads as Rs 31,975 million, with the badge "Checked". Its page is at `/o/fed.exp.current.function.health~2025-26~be` (the id with each colon replaced by `~`).

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Id of the figure | `fed.exp.current.function.health:2025-26:be` | `observations.json` | `obs_id` |
| What it measures | `Health (current, revenue account)` | `series.json` | `name` |
| Year | `2025-26` | `observations.json` | `period` |
| Kind of figure | `be (budget estimate)` | `observations.json` | `vintage` |
| Value | `31975` | `observations.json` | `value` |
| Unit | `PKR` | `observations.json` | `unit` |
| Scale | `1000000` | `observations.json` | `scale_factor` |
| Value in rupees (value times scale, computed by the script) | `31,975,000,000` | `observations.json` | `value, scale_factor` |

An id has three parts: what is measured, the period, and the kind of figure. The same line for the same year can exist as a budget estimate and as a revised estimate, and they are different figures with different ids.

## Step 1. Register: get the file and prove it is the right one

Nothing is read from a document until the file itself has been recorded. A program downloads it from the publisher's own address, measures it, takes its SHA-256 fingerprint (a short code that changes if a single byte of the file changes) and checks that the words on its first pages are the ones this document should carry.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Document | `Annual Budget Statement 2025-26` | `sources.json` | `title` |
| Publisher | `Finance Division, Government of Pakistan` | `sources.json` | `publisher` |
| Official address of the file | `https://www.finance.gov.pk/budget/budget_2025_26/abs_eng_10062025.pdf` | `sources.json` | `file_url` |
| Page that links to it | `https://www.finance.gov.pk/fb_2025_26.html` | `sources.json` | `landing_url` |
| Obtained from | `official` | `sources.json` | `retrieved_via` |
| Downloaded at | `2026-10-10T20:56:30+00:00` | `sources.json` | `retrieved_at` |
| Size in bytes | `2645541` | `sources.json` | `size_bytes` |
| Pages | `54` | `sources.json` | `page_count` |
| SHA-256 fingerprint | `7c212e5219304b9ead98dcb6320d8fe92dc87f6220adc8a789c0b83592f95f01` | `sources.json` | `sha256` |
| Verification result | `official_differs_from_archive` | `sources.json` | `verification_status` |
| How the document was identified | `cover_markers` | `sources.json` | `verification.identity_route` |
| The official page links to this exact file | `True` | `sources.json` | `verification.landing_page_links_file` |
| Internet Archive snapshot | `https://web.archive.org/web/20251103022823/https://finance.gov.pk/budget/budget_2025_26/abs_eng_10062025.pdf` | `sources.json` | `wayback_url` |
| Note on the source | `reissued_or_differs: official download differs from the archive copy.` | `sources.json` | `notes` |

The verification result `official_differs_from_archive` means: downloaded from the official address; it differs from the older archived copy we hold, which means the publisher has reissued the file, and the official file is the one used. A file whose result is `failed` is never used.

## Step 2. Profile: what kind of PDF is it

Before extraction, a program looks at every page: does it carry real text or only an image of text, and are the tables drawn with ruled lines? A document in which more than a fifth of the pages are images goes to a separate track and is not processed here.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Track | `born_digital` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `profile.track` |
| Share of pages with no text, as stored with the run | `0.0556` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `profile.scanned_page_fraction` |
| Table style | `ruled` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `profile.table_style_hint` |
| Pages with a text layer | `51` | `sources.json` | `verification.inspection.pages_with_text_layer` |
| Blank pages (nothing printed on them) | `[2, 4, 6]` | `sources.json` | `verification.inspection.blank_pages` |
| Pages that are images | `(none)` | `sources.json` | `verification.inspection.pages_without_text_layer` |

A page with no text is either blank or an image, and only image pages are a problem for reading numbers.

The share stored with this run equals the 3 blank pages divided by the 54 pages of the file (computed by the script from the two fields above): this run was profiled before blank pages were counted apart from image pages. Either way the document is far below the limit.

## Step 3. Extract: a table-reading tool reads the whole document

The tool is Docling. It reads the whole document in one go, because cutting a document into pieces breaks tables that run over several pages. Every run gets an id and is never overwritten. The tool's version and settings are stored with the run, so the same run can be repeated later.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Run id | `ABS_2025-26__docling__full-document__run-01` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `run_id` |
| Tool and version | `docling 2.119.0` | `cells.json` | `extractor_name, extractor_version` |
| How the document was run | `full-document` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `run_mode` |
| Table mode | `accurate` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `config.table_mode` |
| Optical character recognition used | `False` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `config.do_ocr` |
| Fingerprint of the settings | `87e850735882d161e3150af372f4d19341dba822eaf4fb34d96fd6d3c0b6badf` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `config_sha256` |
| Started | `2026-10-10T20:40:50+00:00` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `started_at` |
| Finished | `2026-10-10T20:45:34+00:00` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `finished_at` |
| Pages the tool returned | `54` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `pages_emitted` |
| Tables the tool returned | `39` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `tables_emitted` |
| Errors logged | `0` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `errors.count` |

## Step 4. Validate: the run is checked before anything is taken from it

The extraction step never declares its own run good. A separate validator does, and only when the file's fingerprint is still the registered one, every page is accounted for exactly once and the error log is empty.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Run marked valid by the validator | `True` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `validated` |
| File fingerprint when the run was made | `7c212e5219304b9ead98dcb6320d8fe92dc87f6220adc8a789c0b83592f95f01` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json` | `sha256_at_run` |
| Same as the registered fingerprint (compared by the script) | `True` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json, sources.json` | `sha256_at_run, sha256` |
| Pages returned equal pages in the file (compared by the script) | `True` | `runs/ABS_2025-26__docling__full-document__run-01.manifest.json, sources.json` | `pages_emitted, page_count` |

## Step 5. Find the cell: one printed number in one place

The tool's output is a set of tables. A program locates the table we want by the words printed in it, never by a page number, and turns each of its numbers into a cell: a record of one printed number, with its page, its position in the table, the exact printed text and a box around it. Boxes are fractions of the page, from the top-left corner, as left, top, right, bottom.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Cell id | `c_c9425296c01f` | `cells.json` | `cell_id` |
| Page (the first page is 1) | `17` | `cells.json` | `page` |
| Table on that page (the first is 0) | `0` | `cells.json` | `table_index` |
| Row and column in the table | `9, 4` | `cells.json` | `row_index, col_index` |
| Row label as printed | `07 Health` | `cells.json` | `row_label_raw` |
| Column heading | `Budget Estimates 2025-26` | `cells.json` | `col_label_raw` |
| Text printed in the cell | `31,975` | `cells.json` | `value_raw` |
| Box around the number | `[0.78987, 0.40362, 0.83715, 0.41435]` | `cells.json` | `cell_bbox_norm` |
| Image of the page in the release | `pages/abs-fed-2025-26/p017.png` | `cells.json` | `source_id, page` |
| That image file exists (checked by the script) | `True` | `(the folder itself)` | `pages/abs-fed-2025-26/p017.png` |
| Fingerprint of the page image | `16ecd37bfca5d3eb8324a0aaec8e43aad91719228aa5a68d66f5dc50dca41ec4` | `cells.json` | `page_render_sha256` |
| Flags on the table's structure | `(none)` | `cells.json` | `structural_flags` |

**Coverage** is a separate question from correctness: how much of the printed table did the tool capture? A program counts the numbers in the PDF's text inside the table's area and compares them with the numbers the tool returned for that table.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Table | `Summary of Expenditure` | `coverage.json` | `table` |
| Numbers printed in the table's area | `87` | `coverage.json` | `printed_numeric_tokens` |
| Of those, found in the tool's output | `87` | `coverage.json` | `matched` |
| Coverage | `1.0` | `coverage.json` | `coverage` |

## Step 6. Normalise: printed text becomes a number, by fixed rules

The printed text is kept exactly as printed. Next to it, a fixed set of rules produces the parsed value: commas are thousands separators, a number in brackets is negative, a dash means no figure, and a cell that holds two numbers is treated as a reading error. A flag is recorded whenever a rule had to do more than remove commas.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Printed text | `31,975` | `cells.json` | `value_raw` |
| Parsed value | `31975` | `cells.json` | `value_parsed` |
| Normalisation flags | `(none)` | `cells.json` | `normalization_flags` |
| Read as a blank marker | `False` | `cells.json` | `is_missing` |
| Unit | `PKR` | `cells.json` | `unit` |
| Scale stated by the table | `1000000` | `cells.json` | `scale_factor` |

## Step 7. Map: say what the number measures

The row label is looked up in a dictionary of known labels. That gives the series (what is measured). The column heading gives the year and the kind of figure. A label that is not in the dictionary stays unmapped, and an unmapped cell can never become a published value.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Series | `fed.exp.current.function.health` | `cells.json` | `series_id` |
| How it was mapped | `dictionary` | `cells.json` | `mapping_method` |
| Year | `2025-26` | `cells.json` | `period` |
| Kind of figure | `be` | `cells.json` | `vintage` |
| Name of the series | `Health (current, revenue account)` | `series.json` | `name` |
| Definition | `Function 07. Federal current expenditure on revenue account for health. It excludes development spending on health and all provincial health spending.` | `series.json` | `definition` |
| State of the definition | `draft` | `series.json` | `definition_status` |
| Parent series | `fed.exp.current.revenue_account` | `series.json` | `parent_id` |

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Series break at | `2011-12` | `series.json` | `breaks[].at_period` |
| Kind of break | `devolution` | `series.json` | `breaks[].kind` |
| Note on the break | `18th Amendment and 7th NFC Award: from 2011-12 many health, education and other functions moved largely to the provinces. Federal figures before and after are not comparable.` | `series.json` | `breaks[].note` |

## Step 8. Check: arithmetic decides whether the number can be trusted

This figure took part in 9 checks. Each one is plain arithmetic over printed numbers, and each is stored with its result. The sentence in the last column is the description stored with the check; it is quoted as stored.

| Check | Kind | Rule | Result | Expected | Found | Difference | Numbers added or compared | Documents | Stored description |
|---|---|---|---|---|---|---|---|---|---|
| `chk_27204268ceaa` | column_total | `abs.functions_add_to_current_revenue` | pass_within_rounding (passed within rounding) | `16286045` | `16286044` | `-1` | 10 | abs-fed-2025-26 | In the 'Budget Estimates 2025-26' column of the Annual Budget Statement 2025-26, the ten function amounts (10 amounts) add to 16,286,044; the printed Current expenditure on revenue account is 16,286,045. They differ by 1, which is within rounding for 10 printed amounts. |
| `chk_33b8ee211695` | column_total | `abs_detail.functions_add_to_part_total` | pass_within_rounding (passed within rounding) | `16286045` | `16286044` | `-1` | 10 | abs-fed-2026-27 | In the 'Budget Estimates 2025-26' column of the Annual Budget Statement 2026-27, the function lines printed above 'a.Current Expenditure on Revenue Account' (10 amounts) add to 16,286,044; the printed 'a.Current Expenditure on Revenue Account' is 16,286,045. They differ by 1, which is within rounding for 10 printed amounts. |
| `chk_4b5301cf1d1c` | cross_table | `abs_detail.detail_equals_summary` | pass (passed exactly) | `31975` | `31975` | `0` | 1 | abs-fed-2025-26 | Health (current, revenue account), Budget Estimates 2025-26: the Summary of Expenditure of the Annual Budget Statement 2025-26 (p.17, row '07 Health') prints 31,975; the function-wise detail table of the same document (p.19, row '07 Health') prints 31,975. They are equal. |
| `chk_4fcd3dd96e0b` | column_total | `abs_detail.functions_add_to_part_total` | pass_within_rounding (passed within rounding) | `16286045` | `16286044` | `-1` | 10 | abs-fed-2025-26 | In the 'Budget Estimates 2025-26' column of the Annual Budget Statement 2025-26, the function lines printed above 'a.Current Expenditure on Revenue Account' (10 amounts) add to 16,286,044; the printed 'a.Current Expenditure on Revenue Account' is 16,286,045. They differ by 1, which is within rounding for 10 printed amounts. |
| `chk_968d3e67fe44` | hierarchy_sum | `abs_detail.subfunctions_add_to_function` | pass_within_rounding (passed within rounding) | `31975` | `31974` | `-1` | 4 | abs-fed-2025-26 | In the 'Budget Estimates 2025-26' column of the Annual Budget Statement 2025-26, the sub-functions printed under '07 Health' (4 amounts) add to 31,974; the printed '07 Health' (current expenditure on revenue account) is 31,975. They differ by 1, which is within rounding for 4 printed amounts. |
| `chk_96a273ed2859` | cross_edition | `abs.same_figure_in_next_edition` | pass (passed exactly) | `31975` | `31975` | `0` | 1 | abs-fed-2025-26, abs-fed-2026-27 | Health (current, revenue account), Budget Estimates 2025-26: the Annual Budget Statement 2025-26 (row '07 Health') prints 31,975; the Annual Budget Statement 2026-27 (row '07 Health') prints 31,975. They are equal. |
| `chk_97e784506265` | column_total | `abs.functions_add_to_current_revenue` | pass_within_rounding (passed within rounding) | `16286045` | `16286044` | `-1` | 10 | abs-fed-2026-27 | In the 'Budget Estimates 2025-26' column of the Annual Budget Statement 2026-27, the ten function amounts (10 amounts) add to 16,286,044; the printed Current expenditure on revenue account is 16,286,045. They differ by 1, which is within rounding for 10 printed amounts. |
| `chk_e1bc28695874` | cross_table | `abs_detail.detail_equals_summary` | pass (passed exactly) | `31975` | `31975` | `0` | 1 | abs-fed-2026-27 | Health (current, revenue account), Budget Estimates 2025-26: the Summary of Expenditure of the Annual Budget Statement 2026-27 (p.17, row '07 Health') prints 31,975; the function-wise detail table of the same document (p.19, row '07 Health') prints 31,975. They are equal. |
| `chk_e1dd9d4a4daf` | hierarchy_sum | `abs_detail.subfunctions_add_to_function` | pass_within_rounding (passed within rounding) | `31975` | `31974` | `-1` | 4 | abs-fed-2026-27 | In the 'Budget Estimates 2025-26' column of the Annual Budget Statement 2026-27, the sub-functions printed under '07 Health' (4 amounts) add to 31,974; the printed '07 Health' (current expenditure on revenue account) is 31,975. They differ by 1, which is within rounding for 4 printed amounts. |

Every row above is read from `checks.json` (fields `check_id`, `check_type`, `rule_id`, `result`, `expected`, `observed`, `residual`, `member_cell_ids`, `source_ids`, `description`); the list of checks for this figure is `check_ids` in `observations.json`.

The rules these checks were held to, as stored in `checks.json`, field `tolerance_rule`:

- Exact match passes. A difference of at most half a unit of the last printed digit per item added passes as 'within rounding'. Anything larger fails.
- The two printed figures must be equal within 1 unit of the last printed digit.

The same figure is printed in other places. Each is a cell of its own, with its own page and box. They are listed in `observations.json`, field `supporting_cell_ids`.

| Cell | Document | Page | Row label as printed | Column heading | Printed text | Parsed value |
|---|---|---|---|---|---|---|
| `c_72d6fdcebc8f` | Annual Budget Statement 2025-26 | 19 | `07 Health` | `Budget Estimates 2025-26` | `31,975` | `31975` |
| `c_e046f6208fbe` | Annual Budget Statement 2026-27 | 17 | `07 Health` | `Budget Estimates 2025-26` | `31,975` | `31975` |
| `c_110f844dd92e` | Annual Budget Statement 2026-27 | 19 | `07 Health` | `Budget Estimates 2025-26` | `31,975` | `31975` |

Read from `cells.json` (fields `cell_id`, `source_id`, `page`, `row_label_raw`, `col_label_raw`, `value_raw`, `value_parsed`) and `sources.json` (field `title`).

## Step 9. Status: a program works out what may be shown

Status is computed from the stored check results. Nobody sets it by hand, and no language model takes part. Tier A means an arithmetic check passed and a second official printing agrees. Tier B means one of those two. Both are shown as "Checked". Anything else is shown as a labelled gap with no value.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Tier | `A` | `observations.json` | `tier` |
| Status | `checked` | `observations.json` | `status` |
| Published | `True` | `observations.json` | `published` |
| Kind of gap | `(none: the value is published)` | `observations.json` | `gap_kind` |
| Sentence shown on the receipt | `One of 10 amounts that add to the printed 'a. Current Exp. on Revenue Account' 16,286,045 (within rounding). Equal to the figure printed in the Annual Budget Statement 2026-27 (exactly). Equal to the figure printed in a second place in the same document (exactly).` | `observations.json` | `evidence_summary` |

A figure is published only if its whole data type also clears thresholds that were fixed before any result was seen (`thresholds/thresholds.yaml`; its fingerprint is stored in the release). Coverage and check results are kept as separate numbers.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Data type | `Federal Annual Budget Statement` | `release.json` | `dataset_status.abs.name` |
| Coverage of the data type | `0.9896` | `release.json` | `dataset_status.abs.coverage.coverage` |
| Checks that could be run | `1604` | `release.json` | `dataset_status.abs.check_pass_rate.evaluable` |
| Share of those that passed | `0.9863` | `release.json` | `dataset_status.abs.check_pass_rate.pass_rate` |
| Cross-edition agreement | `0.9957` | `release.json` | `dataset_status.abs.cross_edition_agreement.pass_rate` |
| Meets every threshold | `True` | `release.json` | `dataset_status.abs.meets_thresholds` |
| Fingerprint of the thresholds file | `85689c5c066fef50c825db8aab5a38595bf1c4d22d4515b7be22bdc5dd13e48b` | `release.json` | `thresholds_sha256` |

## Step 10. Publish: the figure goes into a frozen release

A release is a folder of files that is never changed silently once it is public. The site and the downloads are built from that folder and from nothing else. In the CSV download the figure is one row.

| What | Value read by the script | File in the release | Field |
|---|---|---|---|
| Value | `31975` | `observations.csv` | `value` |
| Value as printed | `31,975` | `observations.csv` | `value_as_printed` |
| Status | `checked` | `observations.csv` | `status` |
| Document | `Annual Budget Statement 2025-26` | `observations.csv` | `source_title` |
| Page | `17` | `observations.csv` | `page` |
| Fingerprint of the document | `7c212e5219304b9ead98dcb6320d8fe92dc87f6220adc8a789c0b83592f95f01` | `observations.csv` | `source_sha256` |
| Release | `v0.0.1-prototype` | `observations.csv` | `release` |
| First published in | `v0.0.1-prototype` | `observations.json` | `first_published_release` |

`python -m datalab check-release` repeats the arithmetic of every check from the release's own cells and confirms that every status follows from the stored evidence. It needs no PDF and runs on every change to the code.

## Step 11. The page

The site builds one page per figure. For this one the path is `/o/fed.exp.current.function.health~2025-26~be`. At the time of writing the page shows the value, the status badge, the sentence from `evidence_summary`, the image of the page with the box from `cell_bbox_norm` drawn on it, the checks, and links to the official file (`file_url`) and to the Internet Archive snapshot (`wayback_url`). A reader can open the official PDF, go to the page given above and see the same number in the same place.

## What did not happen

- No language model read the PDF, wrote the value, corrected it or decided its status. Language models were used to write the software.
- Nobody typed the value. It was read by the extraction tool, parsed by fixed rules and checked by arithmetic.
- The error rate has not been measured yet. Checks show that numbers agree with each other; only the hand-labelled gold set can say how often a published number is wrong, and it has not been labelled.
