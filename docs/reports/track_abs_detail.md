# Track note: ABS function-wise detail tables (decision D31, step C7)

Branch `proto/v0-abs-detail`. Written 2026-10-12. Every number in sections 1 and 3 to 8 was printed by a script from the built
dataset (`WORK_DIR/datasets/abs`); none was typed by hand. Source: the nine validated Docling runs already on disk; no new run was made.

## 0. Short version

- **What the document prints.** In all nine editions the Summary of Expenditure is followed by seven pages of function-wise
  detail: each function (01-10) with its sub-functions (3-digit codes), in four parts, each ending with its own total line:
  (a) current expenditure on revenue account, (b) current expenditure on capital account, (c) development expenditure on
  revenue account, (d) development expenditure on capital account. In 2010-11, 2011-12, 2016-17 and 2017-18 the function
  lines of part (c) are the PSDP part only ("i. Dev. Exp. on Revenue Account (PSDP)"), followed by "ii. Other Dev. Exp."
  listed by sub-function code without function lines; 2016-17 and 2017-18 do the same in part (d).
- **What it does not print.** No edition prints one development figure per function, and no edition prints a total
  (current + development) per function. Development spending by function is printed separately on revenue account and on
  capital account and is never added up per function. So `fed.exp.development.function.*` and `fed.exp.total.function.*`
  **do not exist in the document and were not constructed**, and there is no per-function identity "current + development = total" to test.
  The series built are named for what is printed:
  `fed.exp.current.function.<f>.<sub>` (sub-functions of the lines already published),
  `fed.exp.current.capital_account.function.<f>[.<sub>]`,
  `fed.exp.development.revenue_account.function.<f>[.<sub>]`, `fed.exp.development.revenue_account.psdp.function.<f>[.<sub>]`,
  `fed.exp.development.capital_account.function.<f>[.<sub>]`, `fed.exp.development.capital_account.psdp.function.<f>[.<sub>]`.
- **Go, narrowly.** See section 2.
- **Health.** Development expenditure on health is printed, on revenue account only, in every edition (PSDP part in the four
  older editions). 19 of its 22 columns publish; 3 are withheld (section 7). A total-health figure does not exist in the document.

## 1. Survey: what each edition prints

| Edition | Summary of Expenditure (page) | Detail tables found (pages) | Parts closed by their total line | All four parts closed | Lowest table coverage | Every table at or above 0.90 |
|---|---|---|---|---|---|---|
| 2010-11 | 9 | 7 (pp. 10-16) | b, c-i (PSDP), d | no | 0.9577 | yes |
| 2011-12 | 11 | 7 (pp. 12-18) | a, b, c-i (PSDP), d | yes | 0.96 | yes |
| 2016-17 | 12 | 7 (pp. 13-19) | a, b, c-i (PSDP), d-i (PSDP) | yes | 0.9244 | yes |
| 2017-18 | 11 | 7 (pp. 12-18) | a, b, c-i (PSDP), d-i (PSDP) | yes | 0.8908 | no |
| 2021-22 | 17 | 7 (pp. 18-24) | a, b, c, d | yes | 0.9823 | yes |
| 2022-23 | 15 | 7 (pp. 16-22) | a, b, c, d | yes | 0.885 | no |
| 2024-25 | 17 | 7 (pp. 18-24) | a, b, c | no | 1.0 | yes |
| 2025-26 | 17 | 7 (pp. 18-24) | a, b, c, d | yes | 1.0 | yes |
| 2026-27 | 17 | 7 (pp. 18-24) | a, b, c, d | yes | 1.0 | yes |

Counts: detail tables found in **9 of 9** editions; every table at or above the frozen per-table coverage minimum (0.90) in **7 of 9**; all four parts closed by their total line in **7 of 9**; both at once in **5 of 9**.

## 2. Go / no-go

The plan's rule: proceed only if the locator finds the target tables in at least 7 of 9 editions with table coverage above the
frozen thresholds.

- Tables found: 9 of 9 (always the seven tables that follow the located summary table; located by content, never by page number).
- Coverage of the detail tables as a whole is above the frozen per-data-type minimum of 0.95 (section 3).
- Every table at or above the frozen per-table minimum of 0.90: 7 of 9 editions. The two exceptions are one page each
  (2017-18 p.12, 2022-23 p.16); both tables are flagged `low_coverage` and nothing from them publishes.
- Strictest reading (every table at or above 0.90 **and** all four total lines recognised): 5 of 9. 2010-11 lacks the "a." line
  (Docling did not put it in the table on p.12) and 2024-25 lacks the "d." line (glued into another row on p.24, table flagged
  `merged_rows`). In those two editions the affected part is simply not mapped; the other parts are.

Decision: **go**, on the rule as written (7 of 9), and stated as marginal because the strictest reading gives 5 of 9. The code is
on (`enabled: true` in `specs/abs_detail.yaml`); setting it to `false` returns the ABS dataset to exactly the summary table. This
is the lead's call at merge: what the flag changes is listed in section 9.

## 3. Coverage (how much of the printed tables was captured)

Detail tables: 63. Printed numeric tokens inside the table boxes: 4812. Captured by Docling: 4762. Coverage: **0.9896** (frozen minimum per data type 0.95).

| Edition | Tables | Printed | Captured | Coverage | Tables below 0.90 | Tables with a blocking flag |
|---|---|---|---|---|---|---|
| 2010-11 | 7 | 552 | 545 | 0.9873 | - | p.10 (merged_rows) |
| 2011-12 | 7 | 543 | 539 | 0.9926 | - | p.16 (merged_rows) |
| 2016-17 | 7 | 563 | 553 | 0.9822 | - | p.19 (column_unmapped) |
| 2017-18 | 7 | 565 | 552 | 0.977 | p.12 (0.8908) | p.12 (low_coverage, column_unmapped) |
| 2021-22 | 7 | 520 | 517 | 0.9942 | - | p.18 (column_unmapped) |
| 2022-23 | 7 | 519 | 506 | 0.975 | p.16 (0.885) | p.16 (low_coverage) |
| 2024-25 | 7 | 528 | 528 | 1.0 | - | p.22 (merged_rows); p.24 (merged_rows) |
| 2025-26 | 7 | 515 | 515 | 1.0 | - | - |
| 2026-27 | 7 | 507 | 507 | 1.0 | - | - |

Amount cells read from the detail tables: 3785; mapped to a series: 2868; left unmapped: 917 (rows below sub-function level such as the debt-servicing and defence object lines, rows whose label did not match the dictionary, and every row of a table whose columns or scale could not be confirmed).

Row labels taken from the PDF text layer because Docling's label did not match: 41. Labels joined from two table rows (wrapped label): 5.

## 4. Checks (how much of what was captured is right)

| Check | Evaluable | Pass (exact) | Pass (within rounding) | Fail | Not evaluable | Pass rate of evaluable |
|---|---|---|---|---|---|---|
| Hierarchy sum: sub-functions add to their function line | 467 | 313 | 137 | 17 | 93 | 0.9636 |
| Column total: function lines add to the part's total line | 68 | 38 | 30 | 0 | 30 | 1.0 |
| Cross-table: detail line equals the same line of the Summary of Expenditure | 378 | 375 | 3 | 0 | 0 | 1.0 |
| Cross-edition: same figure in the next edition's detail tables | 351 | 348 | 0 | 3 | 0 | 0.9915 |
| All detail-table checks | 1264 | 1074 | 170 | 20 | 123 | 0.9842 |

Why checks were not evaluable: 69 - a coded row in the block did not match the label dictionary; 51 - a table involved is flagged (merged rows, low coverage, columns not confirmed); 3 - a sub-function is printed twice in the block.

Frozen thresholds (`release.gate_dataset`, thresholds file untouched):

| Scope | Coverage | Check pass rate | Cross-edition agreement | Meets thresholds |
|---|---|---|---|---|
| Detail tables alone | 0.9896 | 0.9842 (20 fail of 1264) | 0.9915 (3 fail of 351) | True |
| Whole ABS dataset (summary + detail) | 0.9896 | 0.9863 (22 fail of 1604) | 0.9892 (5 fail of 465) | True |

## 5. Observations by tier

Observations whose primary printing is a detail table (the function lines of part a and the totals stay with the summary table):

| Kind | A (published) | B (published) | C (withheld, no check) | D (withheld, failed or flagged) | printed as '-' (no figure) | Total |
|---|---|---|---|---|---|---|
| function line | 44 | 190 | 16 | 33 | 9 | 292 |
| sub-function | 274 | 1070 | 184 | 184 | 67 | 1779 |
| all | 318 | 1260 | 200 | 217 | 76 | 2071 |

Of the D tier, 18 were withheld by the detail-only rule "a failed check on the figure's own cell withholds it" (the general status rule would have published them because a second check passed).

Summary-table observations are unchanged by this track: {'A published=True': 108, 'B published=True': 383, 'None published=False': 2}.

## 6. Every failing check

| # | Check | Edition, page | Column | What | Printed total / first printing | Sum of members / second printing | Difference |
|---|---|---|---|---|---|---|---|
| 1 | hierarchy_sum | 2010-11 p.16 | BE 2009-10 | sub-functions under '04 Economic Affairs' (development.capital_account.function.economic_affairs): 041='443', 044='11,566', 045='9,800' | '18,779' | 21,809 | 3,030 |
| 2 | hierarchy_sum | 2010-11 p.16 | RE 2009-10 | sub-functions under '04 Economic Affairs' (development.capital_account.function.economic_affairs): 041='76', 044='3,525', 045='10,567' | '8,374' | 14,168 | 5,794 |
| 3 | hierarchy_sum | 2010-11 p.16 | BE 2010-11 | sub-functions under '04 Economic Affairs' (development.capital_account.function.economic_affairs): 041='468', 044='4,220', 045='8,394' | '9,236' | 13,082 | 3,846 |
| 4 | hierarchy_sum | 2011-12 p.18 | BE 2010-11 | sub-functions under '04 Economic Affairs' (development.capital_account.function.economic_affairs): 041='468', 044='4,220', 045='8,394' | '9,236' | 13,082 | 3,846 |
| 5 | hierarchy_sum | 2011-12 p.18 | RE 2010-11 | sub-functions under '04 Economic Affairs' (development.capital_account.function.economic_affairs): 041='40', 044='1,567', 045='3,673' | '4,007' | 5,280 | 1,273 |
| 6 | hierarchy_sum | 2011-12 p.18 | BE 2011-12 | sub-functions under '04 Economic Affairs' (development.capital_account.function.economic_affairs): 041='106', 042='17', 044='2,138', 045='5,147' | '4,820' | 7,408 | 2,588 |
| 7 | hierarchy_sum | 2016-17 p.13 | BE 2015-16 | sub-functions under '01 General Public Service' (current.function.general_public_services): 012='100', 014='409,875', 015='6,415', 016='3,559', 017='10,683', 018='2,150', 019='9,920' | '2,446,604' | 442,702 | -2,003,902 |
| 8 | hierarchy_sum | 2016-17 p.13 | RE 2015-16 | sub-functions under '01 General Public Service' (current.function.general_public_services): 012='5,005', 014='418,245', 015='8,385', 016='3,619', 017='11,103', 018='5,896', 019='7,053' | '2,558,881' | 459,306 | -2,099,575 |
| 9 | hierarchy_sum | 2016-17 p.13 | BE 2016-17 | sub-functions under '01 General Public Service' (current.function.general_public_services): 012='752', 014='441,616', 015='6,607', 016='3,653', 017='11,334', 018='2,253', 019='11,160' | '2,707,213' | 477,375 | -2,229,838 |
| 10 | hierarchy_sum | 2016-17 p.18 | BE 2016-17 | sub-functions under '07 Health' (development.revenue_account.psdp.function.health): 073='763', 074='7,497', 075='7', 076='23,307' | '25,874' | 31,574 | 5,700 |
| 11 | hierarchy_sum | 2017-18 p.17 | BE 2016-17 | sub-functions under '07 Health' (development.revenue_account.psdp.function.health): 073='763', 074='7,497', 075='7', 076='23,307' | '25,874' | 31,574 | 5,700 |
| 12 | hierarchy_sum | 2017-18 p.17 | RE 2016-17 | sub-functions under '07 Health' (development.revenue_account.psdp.function.health): 073='613', 074='7,136', 075='7', 076='23,267' | '25,324' | 31,023 | 5,699 |
| 13 | hierarchy_sum | 2017-18 p.17 | BE 2017-18 | sub-functions under '07 Health' (development.revenue_account.psdp.function.health): 073='2,249', 074='17,704', 075='7', 076='36,790' | '51,051' | 56,750 | 5,699 |
| 14 | cross_edition | 2021-22 p.19 | BE 2021-22 | '047 Other Industries' (current.function.economic_affairs.other_industries) | '1,426' (2021-22 p.19) | '384' (2022-23 p.17) | -1,042 |
| 15 | cross_edition | 2021-22 p.20 | BE 2021-22 | '081 Recreational and Sporting Services' (current.function.recreation_culture_and_religion.recreational_and_sporting_services) | '0.3' (2021-22 p.20) | '1,042' (2022-23 p.18) | 1,041.7 |
| 16 | hierarchy_sum | 2022-23 p.21 | BE 2021-22 | sub-functions under '09 Education Affairs and Services' (development.revenue_account.function.education_affairs_and_services): 091='18', 092='475', 093='44,619', 095='721' | '47,570' | 45,833 | -1,737 |
| 17 | hierarchy_sum | 2022-23 p.21 | RE 2021-22 | sub-functions under '09 Education Affairs and Services' (development.revenue_account.function.education_affairs_and_services): 091='5', 092='4', 093='81,907', 095='262' | '83,667' | 82,178 | -1,489 |
| 18 | hierarchy_sum | 2022-23 p.21 | BE 2022-23 | sub-functions under '09 Education Affairs and Services' (development.revenue_account.function.education_affairs_and_services): 091='9', 092='7', 093='45,779', 095='746' | '48,327' | 46,541 | -1,786 |
| 19 | cross_edition | 2025-26 p.22 | BE 2025-26 | '063 Water Supply' (development.revenue_account.function.housing_and_community_amenities.water_supply) | '- 6' (2025-26 p.22) | '6' (2026-27 p.22) | 12 |
| 20 | hierarchy_sum | 2025-26 p.22 | BE 2025-26 | sub-functions under '06 Housing and Community Amenities' (development.revenue_account.function.housing_and_community_amenities): 062='7,971', 063='- 6' | '7,977' | 7,965 | -12 |

## 7. Health: what exists

| Series | Period | Vintage | Tier | Published | Primary printing | Printed text |
|---|---|---|---|---|---|---|
| fed.exp.development.revenue_account.function.health | 2020-21 | be | B | yes | 2021-22 p.23 | '14,533' |
| fed.exp.development.revenue_account.function.health | 2020-21 | re | B | yes | 2021-22 p.23 | '8,437' |
| fed.exp.development.revenue_account.function.health | 2021-22 | be | A | yes | 2021-22 p.23 | '21,748' |
| fed.exp.development.revenue_account.function.health | 2021-22 | re | B | yes | 2022-23 p.21 | '13,321' |
| fed.exp.development.revenue_account.function.health | 2022-23 | be | B | yes | 2022-23 p.21 | '12,701' |
| fed.exp.development.revenue_account.function.health | 2023-24 | be | B | yes | 2024-25 p.23 | '13,270' |
| fed.exp.development.revenue_account.function.health | 2023-24 | re | B | yes | 2024-25 p.23 | '13,254' |
| fed.exp.development.revenue_account.function.health | 2024-25 | be | A | yes | 2024-25 p.23 | '28,185' |
| fed.exp.development.revenue_account.function.health | 2024-25 | re | B | yes | 2025-26 p.23 | '22,194' |
| fed.exp.development.revenue_account.function.health | 2025-26 | be | A | yes | 2025-26 p.23 | '15,102' |
| fed.exp.development.revenue_account.function.health | 2025-26 | re | B | yes | 2026-27 p.23 | '13,691' |
| fed.exp.development.revenue_account.function.health | 2026-27 | be | B | yes | 2026-27 p.23 | '18,217' |
| fed.exp.development.revenue_account.psdp.function.health | 2009-10 | be | B | yes | 2010-11 p.15 | '23,746' |
| fed.exp.development.revenue_account.psdp.function.health | 2009-10 | re | B | yes | 2010-11 p.15 | '19,127' |
| fed.exp.development.revenue_account.psdp.function.health | 2010-11 | be | A | yes | 2010-11 p.15 | '17,344' |
| fed.exp.development.revenue_account.psdp.function.health | 2010-11 | re | B | yes | 2011-12 p.17 | '16,152' |
| fed.exp.development.revenue_account.psdp.function.health | 2011-12 | be | B | yes | 2011-12 p.17 | '634' |
| fed.exp.development.revenue_account.psdp.function.health | 2015-16 | be | B | yes | 2016-17 p.18 | '21,283' |
| fed.exp.development.revenue_account.psdp.function.health | 2015-16 | re | B | yes | 2016-17 p.18 | '19,400' |
| fed.exp.development.revenue_account.psdp.function.health | 2016-17 | be | D | no | 2016-17 p.18 | '25,874' |
| fed.exp.development.revenue_account.psdp.function.health | 2016-17 | re | D | no | 2017-18 p.17 | '25,324' |
| fed.exp.development.revenue_account.psdp.function.health | 2017-18 | be | D | no | 2017-18 p.17 | '51,051' |

Health lines found under current or development expenditure on capital account, in any edition: none.

## 8. Per-edition notes from the builder

- **2010-11**: total line(s) not recognised for: a; 10 function block(s) left unassigned (function codes restart with no total line in between); 2 coded row(s) not matched by the dictionary, e.g. `011 Financial Executive & Legislative Organs, & Fiscal Affairs, External Affairs`; `034 035 R&D Public Order and Safety`.
- **2011-12**: 4 coded row(s) not matched by the dictionary, e.g. `011 Executive & Legislative Organs, & Fiscal Affairs, External Affairs`; `091 and Services Pre-Primary and Primary Education Affair`; `097 Elsewhere Education Affairs & Services not Classified`.
- **2016-17**: 5 coded row(s) not matched by the dictionary, e.g. `19 Gen. Public Services not Elsewhere Defined`; `097 Elsewhere Classified`; `011 & Fiscal Affairs, External Affairs Executive & Legislative Organs, Financial`; p.19: Docling produced 4 value columns, column meaning not confirmed, nothing mapped.
- **2017-18**: 17 coded row(s) not matched by the dictionary, e.g. `011 Executive & Legislative Organs,`; `Foreign Economic Aid`; `General Services`; p.12: Docling produced 4 value columns, column meaning not confirmed, nothing mapped.
- **2021-22**: 8 coded row(s) not matched by the dictionary, e.g. `011 Executive & Legislative Organs,`; `Defence Administration`; `48 Economic Affairs`; p.18: Docling produced 4 value columns, column meaning not confirmed, nothing mapped.
- **2022-23**: 3 coded row(s) not matched by the dictionary, e.g. `097 Elsewhere Classified Education Affairs & Services not`; `019 defined General Public Services not elsewhere`; `83 Broadcasting and Publishing`.
- **2024-25**: total line(s) not recognised for: d or d-i (PSDP); 1 function block(s) left unassigned (followed by a total line that does not close a part); 4 coded row(s) not matched by the dictionary, e.g. `062 063 Community Development Water Supply`; `01 014 017 General Public Service Transfers Research and Dev. General Public`; `04 Economic Affairs Gen. Eco., Commercial and Labour Affairs`.
- **2025-26**: clean.
- **2026-27**: clean.

## 9. How it works, and what switching it on changes

- `specs/abs_detail.yaml` (parts, their closing total lines, the `enabled` flag), `specs/abs_detail_labels.yaml` (hand-written
  dictionary: printed code **and** whole normalised name must match), `pipeline/datalab/datasets/abs_detail.py`,
  `pipeline/tests/test_abs_detail.py`. `datasets/abs.py` gained one call site; the summary table's own sum rules never see detail cells.
- A function block belongs to the part whose total line follows it. Guards: function codes must rise inside a part (a restart means
  a total line was missed and the collected blocks are dropped, never moved into the next part); a sub-function must sit under the
  function its code starts with; a coded row the dictionary does not know makes its function's sum and its part's sum not evaluable.
- Column year and vintage come from the PDF text layer by position (`abs.map_columns`) and must equal the edition's expected three
  columns; the page must print "(Rs in million)". Otherwise nothing from that table is mapped.
- Checks: `hierarchy_sum` (sub-functions add to the function line), `column_total` (function lines add to the part's total line),
  `cross_table` (every detail line that the Summary of Expenditure also prints must equal it: the ten function lines of part a and
  the totals a, b, I, c, d, II and the PSDP/other splits), `cross_edition` (same sub-function or function figure in the next edition).
  Cells from a table flagged for lost or merged data take no part in the two agreement checks.
- One rule stricter than `status.py`, for detail-table figures only: a failed check on the figure's own cell withholds it even when
  another check passed (`abs_detail.withhold_where_a_check_failed`). Reason: a sub-function whose function does not add up can
  still be reprinted unchanged next year. It only removes figures and does not touch anything that is not `checked`.
- With the flag on, the ABS dataset gains the detail cells, checks, coverage rows and about 180 series; the ABS gate still passes
  (section 4). The `not evaluable` and `fail` counts of ABS rise accordingly, and the two known restated 2021-22 lines get company:
  the detail tables show where the Rs 1,042 million moved (the two cross-edition failures on sub-functions 047 and 081 in section 6).

## 10. Overlays looked at (WORK_DIR/qa/overlay_detail_<source>_p<page>.png, one per detail table, 63 files)

- **2025-26 p.23** (part c, second page): title "Development Expenditure on Revenue Account", "(Rs in million)", three columns
  Budget 2024-25 / Revised 2024-25 / Budget 2025-26; one box per printed amount, none missing; `07 Health` with 073, 074, 076
  under it; the page ends with "c. Dev. Exp. on Revenue Account". Matches the mapping.
- **2010-11 p.15**: the function blocks end at "i. Dev. Exp. on Revenue Account (PSDP)"; then "ii. Other Dev. Exp on Revenue
  Account" carries its own total and is followed by four sub-function codes with no function line; then "c. ... (i+ii)". So the
  function lines of this edition are PSDP only, which is why they have their own series ids. Also visible: the label
  "097 Education Affairs & Services not / Elsewhere Classified" is wrapped, with the code on the first line and the amounts on
  the second; the reader now joins the two rows (and the dictionary must then match the joined label in full).
- **2016-17 p.18**: under `07 Health` there is an uncoded line "Less Recoveries from Health Services" with a bracketed amount in
  the Budget 2016-17 column. The sum rule does not model that line, which is what the Health PSDP failures in section 6 are.
  The figures stay withheld.

## 11. What the failing checks are (causes seen, not fixed by tuning)

- 2010-11 and 2011-12, part d, Economic Affairs (6 checks): the table prints a "Less Recoveries" line after sub-function 045
  that the rule does not model. Not verified beyond the row list; withheld.
- 2016-17 p.13, General Public Service (3 checks): sub-function 011 is not among the members; its label reached us unreadable on
  a page with coverage 0.9244. Withheld.
- 2016-17 and 2017-18, Health PSDP (4 checks): "Less Recoveries from Health Services", seen on the overlay. Withheld.
- 2021-22 budget lines 047 and 081 (2 cross-edition checks): printed differently in the 2022-23 edition (the known restatement; D25 material).
- 2022-23 p.21, Education, part c (3 checks): cause not established. Withheld.
- 2025-26 p.22, 063 Water Supply (2 checks): Docling emitted the text "- 6" for the Budget 2025-26 cell and only two amounts for
  the row; the next edition prints the same line as "6". Looks like a "-" (nil) cell merged with the next column's amount and
  then parsed as minus six. Both checks failed and the cell is withheld. New trap, in AGENTS.md.
- A mapping that a check contradicted was removed, not kept: the two-digit line "19 Gen. Public Services not elsewhere defined"
  under current expenditure on capital account was first read as sub-function 019; the function line equals its other
  sub-functions without it, so it is now unmapped and its block is not evaluable.

## 12. Not done

- No `fed.exp.development.function.*`, no `fed.exp.total.function.*`, no per-function accounting identity: not printed (section 0).
  A code-computed "current + development on revenue account" series for health would be a derived series with its own definition
  (and, for the older editions, PSDP only). That is a decision for a human; nothing was built for it.
- "Less Recoveries" lines are not modelled. Their level differs by edition (under a sub-function in 2010-11 p.10, under the
  function in 2016-17 p.18), so mapping them by label would be a guess.
- Rows below sub-function level (debt servicing, defence object heads A01-A12, "Others") are read but not mapped.
- "III. Total Exp. (Current+Development)" is not mapped: some editions print the operational shortfall after it.
- No gap observations for detail lines an edition lacks (there is no "expected in every edition" list for sub-functions), so a
  missing sub-function shows as an absent point, not a labelled gap.
- Second reader not routed to the detail tables flagged `merged_rows` (2010-11 p.10, 2011-12 p.16, 2024-25 pp.22 and 24) or
  `column_unmapped` (four value columns: 2016-17 p.19, 2017-18 p.12, 2021-22 p.18).
- `datalab release`, the site and `releases/` were not touched. No gold-sample or spot-check redraw. `STATUS.md` and
  `DECISIONS.md` are left to the lead (shared files).
- The normaliser still parses "- 6" as -6 without a flag (`normalise.py` is shared; left for the lead).

## 13. Rebuild

```
cd pipeline
<venv python> -m pytest -q
<venv python> -m datalab build --dataset abs          # writes WORK_DIR/datasets/abs and WORK_DIR/qa/overlay_detail_*.png
```

Switch off: `enabled: false` in `specs/abs_detail.yaml`, then rebuild.
