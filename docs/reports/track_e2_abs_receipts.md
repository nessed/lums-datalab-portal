# Track note: ABS receipts side (plan item E2, decision D32)

Branch `proto/v0-e2-abs-receipts`. Every number and every printed figure in sections 1 to 8 was written by a script from the
built dataset (`WORK_DIR/datasets/abs`); none was typed by hand. Source: the nine validated Docling runs already on disk; no new
run was made. No value was read, corrected or judged by a person or a model: cells carry what Docling emitted, code decides.

## 0. Short version

- **What the document prints.** Every edition opens with a one-page *Summary of Receipts* (older editions: "Receipts - Summary")
  and, on the next page, the statement of *Tax Revenue* by head. Both were found in 9 of 9 editions, by the names of the heads
  they print (never by page number).
- **Coverage:** 18 tables, 1527 printed numbers inside the table boxes, 1527 captured. No table carries a detector flag, so nothing was routed to the second reader.
- **Checks:** 725 checks, 719 evaluable, 655 pass exactly, 64 within rounding, 0 fail, 6 disputed, 0 not evaluable.
- **Cross-edition:** 188 pairs agree, 0 fail, 6 are disputed (two editions print different figures and each table adds up): section 6.
- **Observations:** 792 for 50 series; 778 published, 14 not (section 5).
- **Sales Tax** is mapped in all nine editions (section 7).
- **Expenditure side unchanged:** every cell, check, series and observation of the build made before this track is present and
  identical in the build made after it (section 8).

## 1. Survey: what each edition prints

| Edition | Summary of Receipts (page) | Amount rows | Tax revenue statement (page) | Amount rows | Columns read from the text layer |
|---|---|---|---|---|---|
| 2010-11 | 2 | 26 | 3 | 14 | BE 2009-10; RE 2009-10; BE 2010-11 |
| 2011-12 | 3 | 25 | 4 | 13 | BE 2010-11; RE 2010-11; BE 2011-12 |
| 2016-17 | 4 | 29 | 5 | 16 | BE 2015-16; RE 2015-16; BE 2016-17 |
| 2017-18 | 3 | 30 | 4 | 16 | BE 2016-17; RE 2016-17; BE 2017-18 |
| 2021-22 | 7 | 29 | 8 | 11 | BE 2020-21; RE 2020-21; BE 2021-22 |
| 2022-23 | 7 | 29 | 8 | 11 | BE 2021-22; RE 2021-22; BE 2022-23 |
| 2024-25 | 7 | 26 | 8 | 11 | BE 2023-24; RE 2023-24; BE 2024-25 |
| 2025-26 | 7 | 26 | 8 | 11 | BE 2024-25; RE 2024-25; BE 2025-26 |
| 2026-27 | 7 | 26 | 8 | 11 | BE 2025-26; RE 2025-26; BE 2026-27 |

Unit and scale: "(Rs in million)" is printed on every one of these pages and was confirmed from the page text for each table.

Rows printed, by series, and the editions that print them (from the mapped cells):

| Series | Printed label (first edition that prints it) | Editions |
|---|---|---|
| `fed.rev.total_resources` | 14 Total-Resources (10+11+12+13) | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.net_federal_resources` | 10 Net Federal Resources (8-9) | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.gross_federal_resources` | 8 Gross Federal Resources (5+6+7) | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.provincial_share` | 9 Less Provincial Share in Federal Taxes | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.internal_and_external` | 7 Total Internal and External Receipts (5+6) | 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.internal` | 5 Total Internal Receipts (3+4) | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.revenue` | 3 Total Revenue Receipts (1+2) | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax` | B 1 Tax Revenue Receipts | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax.fbr` | FBR Taxes | 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax.direct` | Direct Taxes | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax.direct.income` | B011 Taxes on Income | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax.direct.workers_welfare_fund` | B01501 Worker's Welfare Fund | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax.direct.workers_profit_participation_fund` | B01502 Worker's Participation Fund | 10-11, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax.direct.capital_value_tax` | B017-18 Capital Value Tax | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax.indirect` | Indirect Taxes | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax.indirect.customs` | B020-22 Customs Duties | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax.indirect.sales_tax` | B023 Sales Tax | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax.indirect.federal_excise` | B024-25 Federal Excise | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.tax.indirect.petroleum_levy` | Petroleum Levy | 10-11, 11-12 |
| `fed.rev.tax.indirect.ict_taxes` | B026-30 Islamabad Capital Territory Taxes | 10-11, 11-12 |
| `fed.rev.tax.indirect.airport_tax` | B03064 Airport Tax | 10-11, 11-12 |
| `fed.rev.tax.other` | Other Taxes | 16-17, 17-18 |
| `fed.rev.tax.other.other_indirect_taxes_ict` | B026-30 Other Indirect Taxes (ICT) | 16-17, 17-18 |
| `fed.rev.tax.other.airport_tax` | B03064 Airport Tax | 16-17, 17-18 |
| `fed.rev.tax.other.gas_infrastructure_development_cess` | B03083 Gas Infrastructure Development Cess | 16-17, 17-18 |
| `fed.rev.tax.other.natural_gas_development_surcharge` | B03084 Natural Gas Development Surcharge | 16-17, 17-18 |
| `fed.rev.tax.other.petroleum_levy` | B03085 Petroleum Levy | 16-17, 17-18 |
| `fed.rev.nontax` | C 2 Non-Tax Receipts | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.nontax.levies_and_fees` | B03 Levies and Fees | 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.nontax.property_and_enterprise` | C01 Income from Property and Enterprise | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.nontax.civil_administration` | C02 Receipts from Civil Administration etc. | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.nontax.miscellaneous` | C03 Miscellaneous Receipts | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.capital` | E 4 Capital Receipts | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.capital.recovery_of_loans_and_advances` | E02 Recovery of Loans and Advances | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.capital.domestic_debt_net` | E03 Domestic Debt Receipts (Net) | 10-11, 11-12, 16-17, 17-18 |
| `fed.rev.capital.domestic_debt_non_bank_net` | E03 Domestic Debt Receipts (Non Bank) - Net | 21-22, 22-23, 24-25, 25-26 |
| `fed.rev.capital.domestic_debt_bank_net` | E03 Domestic Debt Receipts (Bank) - Net | 26-27 |
| `fed.rev.external` | E033 6 External Receipts | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.external.loans` | Loans | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23 |
| `fed.rev.external.grants` | Grants | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23 |
| `fed.rev.external.project_loans_and_grants_outside_psdp` | Project Loans & Grants Outside PSDP | 17-18, 21-22, 22-23 |
| `fed.rev.public_account` | G03 7 Public Accounts Receipts (Net) | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.public_account.deferred_liabilities` | Deferred Liabilities (Net) | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.public_account.deposits_and_reserves` | Deposit and Reserves (Net) | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.provincial_cash_surplus` | 11 Cash Balance built up by the Provinces | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.privatization_proceeds` | 12 Privatization Proceeds | 10-11, 16-17, 17-18, 21-22, 22-23, 24-25, 25-26, 26-27 |
| `fed.rev.credit_from_banking_sector` | 13 Credit from Banking Sector | 10-11, 11-12, 16-17, 17-18, 21-22, 22-23, 24-25 |
| `fed.rev.domestic_debt_bank_net` | 14 Domestic Debt Receipts (Bank) - Net | 25-26, 26-27 |
| `fed.rev.consolidated_fund` | Federal Consolidated Fund (5+6) | 10-11, 11-12 |
| `fed.rev.consolidated_fund_net` | Federal Consolidated Fund (5+6-10) | 16-17, 17-18 |

What changes between editions (all visible in the table above):

- 2010-11 and 2011-12 print no "FBR Taxes" line; tax revenue is direct plus indirect taxes, and "Indirect Taxes" includes the
  petroleum levy, Islamabad Capital Territory taxes and airport tax. A footnote row "*Of which FBR" under the tax total is
  printed; it is not the sum of anything above it, is listed as `ignored` in the label file and is not a series.
- 2016-17 and 2017-18 print "FBR Taxes" (direct + indirect) and "Other Taxes" (ICT taxes, airport tax, gas infrastructure
  development cess, natural gas development surcharge, petroleum levy); tax revenue is the sum of the two.
- From 2021-22 tax revenue equals FBR taxes, and "Levies and Fees" appears under non-tax revenue receipts.
- The first line of the summary is "Federal Consolidated Fund (5+6)" in 2010-11 and 2011-12 and "(5+6-10)" in 2016-17 and
  2017-18: two different quantities, two series. Later editions print it as a heading without amounts.
- External receipts are split into loans and grants up to 2022-23 (plus "Project Loans & Grants Outside PSDP" in 2017-18,
  2021-22, 2022-23); 2024-25 onwards print one line.
- The last financing line is "Credit from Banking Sector" up to 2024-25 and "Domestic Debt Receipts (Bank) - Net" in 2025-26
  and 2026-27. They are kept as two series (open question 1).
- 2026-27 labels the E03 line under capital receipts "Domestic Debt Receipts (Bank) - Net"; every earlier edition from 2021-22
  says "(Non Bank)". Kept as printed, as its own series (open question 2).

Labels that needed care:

- 2010-11 p.3: 'I) Total Tax Revenue (a+b)*' - label taken from the PDF text layer because Docling's label matched nothing.
- 2010-11 p.3: '*Of which FBR' - printed row deliberately not modelled.
- 2011-12 p.4: '*Of which FBR taxes' - label taken from the PDF text layer because Docling's label matched nothing.
- 2011-12 p.4: '*Of which FBR taxes' - printed row deliberately not modelled.
- 2025-26 p.7: '11 Net Federal Resources (9-10)' - label taken from the PDF text layer because Docling's label matched nothing.
- 2025-26 p.7: '13 Privatization Proceeds' - label taken from the PDF text layer because Docling's label matched nothing.

In 2024-25 and 2025-26 the labels "10 Less Provincial Share in Federal / Taxes" and "12 Cash Balance Surplus by the / Provinces"
wrap onto a second line, and Docling glued the second line onto this row (2024-25: "10 Taxes Less Provincial Share in Federal")
or onto the next row (2025-26: "Taxes 11 Net Federal Resources (9-10)", "Provinces 13 Privatization Proceeds"). The cut forms
of the wrapped label are listed in the dictionary; the rows that received a stray word are read from the text layer. The checks
gross - provincial share = net and net + financing lines = total resources pass on all of them.

## 2. Coverage (how much of the printed tables was captured)

| Edition | Table | Page | Printed numbers in the table box | Captured | Coverage | Row-band coverage | Flags |
|---|---|---|---|---|---|---|---|
| 2010-11 | Summary of Receipts | 2 | 112 | 112 | 1.0 | 1.0 | - |
| 2010-11 | Statement of Tax Revenue | 3 | 54 | 54 | 1.0 | 1.0 | - |
| 2011-12 | Summary of Receipts | 3 | 109 | 109 | 1.0 | 1.0 | - |
| 2011-12 | Statement of Tax Revenue | 4 | 52 | 52 | 1.0 | 1.0 | - |
| 2016-17 | Summary of Receipts | 4 | 124 | 124 | 1.0 | 1.0 | - |
| 2016-17 | Statement of Tax Revenue | 5 | 66 | 66 | 1.0 | 1.0 | - |
| 2017-18 | Summary of Receipts | 3 | 127 | 127 | 1.0 | 1.0 | - |
| 2017-18 | Statement of Tax Revenue | 4 | 66 | 66 | 1.0 | 1.0 | - |
| 2021-22 | Summary of Receipts | 7 | 121 | 121 | 1.0 | 1.0 | - |
| 2021-22 | Statement of Tax Revenue | 8 | 46 | 46 | 1.0 | 1.0 | - |
| 2022-23 | Summary of Receipts | 7 | 121 | 121 | 1.0 | 1.0 | - |
| 2022-23 | Statement of Tax Revenue | 8 | 46 | 46 | 1.0 | 1.0 | - |
| 2024-25 | Summary of Receipts | 7 | 115 | 115 | 1.0 | 1.0 | - |
| 2024-25 | Statement of Tax Revenue | 8 | 46 | 46 | 1.0 | 1.0 | - |
| 2025-26 | Summary of Receipts | 7 | 115 | 115 | 1.0 | 1.0 | - |
| 2025-26 | Statement of Tax Revenue | 8 | 46 | 46 | 1.0 | 1.0 | - |
| 2026-27 | Summary of Receipts | 7 | 115 | 115 | 1.0 | 1.0 | - |
| 2026-27 | Statement of Tax Revenue | 8 | 46 | 46 | 1.0 | 1.0 | - |

Receipts tables: 18. Printed: 1527. Captured: 1527. Lowest table: 1.0. Blocked tables (merged_rows / dropped_column / low coverage): 0.

Coverage here means every number in the PDF text layer inside the table box is also in a Docling cell. It says nothing about
whether the numbers are right; that is section 3.

Amount cells read from the receipts tables: 1080; mapped to a series: 1074; left unmapped: 6 (the footnote row "*Of which FBR").

## 3. Checks (how much of what was captured is right)

| Check | Evaluable | Pass (exact) | Pass (within rounding) | Fail | Disputed | Not evaluable |
|---|---|---|---|---|---|---|
| Hierarchy sum: heads add to their line (direct, indirect, other, FBR, tax, non-tax, capital, external, public account) | 255 | 233 | 22 | 0 | 0 | 0 |
| Accounting identity: tax + non-tax = total revenue; revenue + capital = internal; + external; + public account = gross; gross - provincial share = net; net + financing = total resources; consolidated fund | 168 | 135 | 33 | 0 | 0 | 0 |
| Cross-table: a line printed in both receipts tables of one edition | 108 | 108 | 0 | 0 | 0 | 0 |
| Cross-edition: this edition's budget estimate = next edition's prior-year column | 188 | 179 | 9 | 0 | 6 | 0 |
| All receipts checks | 719 | 655 | 64 | 0 | 6 | 0 |

By rule:

| Rule | Evaluable | Pass | Within rounding | Fail | Disputed |
|---|---|---|---|---|---|
| `abs_receipts.capital_heads` | 27 | 25 | 2 | 0 | 0 |
| `abs_receipts.consolidated_fund` | 6 | 5 | 1 | 0 | 0 |
| `abs_receipts.consolidated_fund_net` | 6 | 4 | 2 | 0 | 0 |
| `abs_receipts.direct_tax_heads` | 27 | 27 | 0 | 0 | 0 |
| `abs_receipts.external_heads` | 18 | 11 | 7 | 0 | 0 |
| `abs_receipts.fbr_is_direct_plus_indirect` | 42 | 42 | 0 | 0 | 0 |
| `abs_receipts.gross_resources` | 21 | 14 | 7 | 0 | 0 |
| `abs_receipts.gross_resources_three_parts` | 6 | 5 | 1 | 0 | 0 |
| `abs_receipts.indirect_tax_heads` | 27 | 27 | 0 | 0 | 0 |
| `abs_receipts.internal_and_external_total` | 21 | 14 | 7 | 0 | 0 |
| `abs_receipts.internal_total` | 27 | 20 | 7 | 0 | 0 |
| `abs_receipts.net_resources` | 27 | 26 | 1 | 0 | 0 |
| `abs_receipts.nontax_heads` | 27 | 19 | 8 | 0 | 0 |
| `abs_receipts.other_tax_heads` | 6 | 6 | 0 | 0 | 0 |
| `abs_receipts.public_account_heads` | 27 | 22 | 5 | 0 | 0 |
| `abs_receipts.revenue_total` | 27 | 26 | 1 | 0 | 0 |
| `abs_receipts.same_figure_in_next_edition` | 188 | 179 | 9 | 0 | 6 |
| `abs_receipts.same_line_in_both_receipts_tables` | 108 | 108 | 0 | 0 | 0 |
| `abs_receipts.tax_is_direct_plus_indirect` | 12 | 12 | 0 | 0 | 0 |
| `abs_receipts.tax_is_fbr_plus_other` | 42 | 42 | 0 | 0 | 0 |
| `abs_receipts.total_resources` | 27 | 21 | 6 | 0 | 0 |

Tolerances are the frozen ones (`checks.sum_check`, `checks.equality_check`); the spec sets none. The largest residual among the
within-rounding passes is 1 (Rs million).

A caution on one rule: from 2021-22 the document prints "Tax Revenue Receipts" and "FBR Taxes" as the same amount, so
`abs_receipts.tax_is_fbr_plus_other` has a single member there. It is a printed identity, not a strong test; those figures also
sit in sums with several members.

## 4. Cross-edition agreement

| Earlier edition | Later edition | Pairs | Agree (exact) | Agree (within rounding) | Fail | Disputed |
|---|---|---|---|---|---|---|
| 2010-11 | 2011-12 | 37 | 35 | 2 | 0 | 0 |
| 2016-17 | 2017-18 | 45 | 43 | 0 | 0 | 2 |
| 2021-22 | 2022-23 | 40 | 33 | 3 | 0 | 4 |
| 2024-25 | 2025-26 | 36 | 34 | 2 | 0 | 0 |
| 2025-26 | 2026-27 | 36 | 34 | 2 | 0 | 0 |

Only adjacent editions share a column (the budget estimate of the earlier one), so 2011-12 to 2016-17, 2017-18 to 2021-22 and
2022-23 to 2024-25 have no pair. Editions are compared like with like (summary with summary, tax statement with tax
statement), so a figure printed in both tables is not counted as agreeing twice.

## 5. Observations

| Tier / state | Count | Published |
|---|---|---|
| A (verified: arithmetic and a second edition) | 168 | yes |
| B (corroborated: one kind of evidence) | 610 | yes |
| disputed (two editions print different figures; no value shown) | 6 | no |
| no figure: the document prints '-' or does not print the line | 8 | no |
| all | 792 | 778 |

Withheld or empty, one by one:

| Series | Period | Vintage | State | Reason |
|---|---|---|---|---|
| `fed.rev.external.grants` | 2016-17 | be | disputed | Printed as 22,826 in the Annual Budget Statement 2016-17 (p.4) and as 21,426 in the Annual Budget Statement 2017-18 (p.3). Each table adds up on its own page. We do not publish either figure as checked. |
| `fed.rev.external.loans` | 2016-17 | be | disputed | Printed as 796,784 in the Annual Budget Statement 2016-17 (p.4) and as 785,579 in the Annual Budget Statement 2017-18 (p.3). Each table adds up on its own page. We do not publish either figure as checked. |
| `fed.rev.tax.direct.capital_value_tax` | 2021-22 | be | disputed | Printed as 562 in the Annual Budget Statement 2021-22 (p.8) and as 445 in the Annual Budget Statement 2022-23 (p.8). Each table adds up on its own page. We do not publish either figure as checked. |
| `fed.rev.tax.direct.income` | 2021-22 | be | disputed | Printed as 2,171,839 in the Annual Budget Statement 2021-22 (p.8) and as 2,169,321 in the Annual Budget Statement 2022-23 (p.8). Each table adds up on its own page. We do not publish either figure as checked. |
| `fed.rev.tax.direct.workers_profit_participation_fund` | 2021-22 | be | disputed | Printed as 1,545 in the Annual Budget Statement 2021-22 (p.8) and as 6,366 in the Annual Budget Statement 2022-23 (p.8). Each table adds up on its own page. We do not publish either figure as checked. |
| `fed.rev.tax.direct.workers_welfare_fund` | 2021-22 | be | disputed | Printed as 8,054 in the Annual Budget Statement 2021-22 (p.8) and as 5,868 in the Annual Budget Statement 2022-23 (p.8). Each table adds up on its own page. We do not publish either figure as checked. |
| `fed.rev.privatization_proceeds` | 2009-10 | re | not_in_source | The document prints '-' instead of a figure. |
| `fed.rev.privatization_proceeds` | 2010-11 | be | not_in_source | The document prints '-' instead of a figure. |
| `fed.rev.privatization_proceeds` | 2020-21 | re | not_in_source | The document prints '-' instead of a figure. |
| `fed.rev.privatization_proceeds` | 2021-22 | re | not_in_source | The document prints '-' instead of a figure. |
| `fed.rev.tax.direct.capital_value_tax` | 2011-12 | be | not_in_source | The document prints '-' instead of a figure. |
| `fed.rev.tax.direct.workers_profit_participation_fund` | 2009-10 | re | not_in_source | The document prints '-' instead of a figure. |
| `fed.rev.tax.direct.workers_profit_participation_fund` | 2010-11 | be | not_in_source | The document prints '-' instead of a figure. |
| `fed.rev.tax.direct.workers_welfare_fund` | 2009-10 | be | not_in_source | The document prints '-' instead of a figure. |

Tier B is the larger group because a revised estimate, and the prior-year budget column of the first edition of each run of
adjacent editions, are printed in one edition only: they have arithmetic evidence and no second printing.

## 6. Every failing or disputed check

| # | Result | Check | Series | Column | First printing | Second printing | Difference | Why not a dispute (fails only) |
|---|---|---|---|---|---|---|---|---|
| 1 | disputed | cross_edition | `fed.rev.external.loans` | BE 2016-17 | '796,784' (2016-17 p.4, row 'Loans') | '785,579' (2017-18 p.3, row 'Loans') | -11205 | - |
| 2 | disputed | cross_edition | `fed.rev.external.grants` | BE 2016-17 | '22,826' (2016-17 p.4, row 'Grants') | '21,426' (2017-18 p.3, row 'Grants') | -1400 | - |
| 3 | disputed | cross_edition | `fed.rev.tax.direct.income` | BE 2021-22 | '2,171,839' (2021-22 p.8, row 'B011 Taxes on Income') | '2,169,321' (2022-23 p.8, row 'B011 Taxes on Income') | -2518 | - |
| 4 | disputed | cross_edition | `fed.rev.tax.direct.workers_welfare_fund` | BE 2021-22 | '8,054' (2021-22 p.8, row 'B015 Worker's Welfare Fund') | '5,868' (2022-23 p.8, row 'B01501 WWF (Ordinary Collection)') | -2186 | - |
| 5 | disputed | cross_edition | `fed.rev.tax.direct.workers_profit_participation_fund` | BE 2021-22 | '1,545' (2021-22 p.8, row 'B015 Worker's Profit Participation Fund') | '6,366' (2022-23 p.8, row 'B01502 WPPF(Contribution under Companies Profit)') | 4821 | - |
| 6 | disputed | cross_edition | `fed.rev.tax.direct.capital_value_tax` | BE 2021-22 | '562' (2021-22 p.8, row 'B017-18 Capital Value Tax (CVT)') | '445' (2022-23 p.8, row 'B017-18 Capital Value Tax (CVT)') | -117 | - |

What the table shows, and what it does not:

- 2016-17 to 2017-18, external receipts: the 2017-18 edition adds a third line, "Project Loans & Grants Outside PSDP", and
  prints smaller "Loans" and "Grants" for Budget 2016-17. The total (External Receipts) is the same in both editions and each
  edition's lines add to it.
- 2021-22 to 2022-23, direct taxes: the 2022-23 edition prints a different split of Budget 2021-22 direct taxes over its four
  heads. "Direct Taxes" itself is the same in both editions and each edition's four heads add to it. Two of the four heads
  keep their label unchanged between the editions and still differ, so this is not a mis-matched label.
- In every case the status code (`checks.classify_disputes`, decision D25) found both printings backed by a passing sum in
  their own table and no flag on either table: status `disputed`, no value shown, both printings listed on the receipt.
  Whether these are restatements is for a human to say; nothing was chosen.

## 7. Sales Tax, edition by edition

The previous prototype lost Sales Tax in one year (AGENTS.md section 7), so this line is tracked by name (`watch_series` in
`specs/abs_receipts.yaml`; the build writes `info.receipts.watch`). A missing row would show here with its reason and as a
labelled gap observation.

| Edition | Mapped | Page | Printed label | Columns | Printed text | Indirect-taxes sum on that page |
|---|---|---|---|---|---|---|
| 2010-11 | yes | 3 | B023 Sales Tax | BE 2009-10; RE 2009-10; BE 2010-11 | 499,400; 540,300; 674,900 | 3 pass |
| 2011-12 | yes | 4 | B023 Sales Tax | BE 2010-11; RE 2010-11; BE 2011-12 | 674,900; 654,600; 836,700 | 3 pass |
| 2016-17 | yes | 5 | B023 Sales Tax | BE 2015-16; RE 2015-16; BE 2016-17 | 1,250,272; 1,230,300; 1,437,000 | 3 pass |
| 2017-18 | yes | 4 | B023 Sales Tax | BE 2016-17; RE 2016-17; BE 2017-18 | 1,437,000; 1,444,962; 1,605,200 | 3 pass |
| 2021-22 | yes | 8 | B023 Sales Tax | BE 2020-21; RE 2020-21; BE 2021-22 | 1,919,000; 1,927,000; 2,506,000 | 3 pass |
| 2022-23 | yes | 8 | B023 Sales Tax | BE 2021-22; RE 2021-22; BE 2022-23 | 2,506,000; 2,655,000; 3,076,000 | 3 pass |
| 2024-25 | yes | 8 | B023 Sales Tax | BE 2023-24; RE 2023-24; BE 2024-25 | 3,411,000; 3,607,000; 4,919,000 | 3 pass |
| 2025-26 | yes | 8 | B023 Sales Tax | BE 2024-25; RE 2024-25; BE 2025-26 | 4,919,000; 3,984,000; 4,753,000 | 3 pass |
| 2026-27 | yes | 8 | B023 Sales Tax | BE 2025-26; RE 2025-26; BE 2026-27 | 4,753,000; 4,333,908; 4,927,000 | 3 pass |

Sales Tax observations: 22; published: 22 (tier A: 5, tier B: 17); gaps: 0.

## 8. The ABS dataset as a whole

Expenditure side, before and after (the build of the branch point, kept in `WORK_DIR/baseline`, against the build with receipts on):

| File | Records before | Records now, receipts left out | Identical |
|---|---|---|---|
| observations.json | 2608 | 2608 | yes |
| series.json | 209 | 209 | yes |
| checks.json | 1727 | 1727 | yes |
| cells.json | 4415 | 4415 | yes |
| coverage.json | 72 | 72 | yes |

Frozen thresholds (`release.gate_dataset`; `thresholds/` untouched):

| Scope | Tables | Coverage | Tables below 0.90 | Check pass rate (disputed counted as not passed) | Fail | Disputed | Cross-edition agreement | Disputed share of pairs | Meets thresholds |
|---|---|---|---|---|---|---|---|---|---|
| Before this track (summary + detail of expenditure) | 72 | 0.9896 | 2 | 0.9863 (1604 evaluable) | 19 | 3 | 0.9957 (2 fail of 462) | 0.0065 (limit 0.05) | True |
| Receipts tables alone | 18 | 1.0 | 0 | 0.9917 (725 evaluable) | 0 | 6 | 1.0 (0 fail of 188) | 0.0309 (limit 0.05) | True |
| Whole ABS dataset | 90 | 0.9919 | 2 | 0.988 (2329 evaluable) | 19 | 9 | 0.9969 (2 fail of 650) | 0.0137 (limit 0.05) | True |

The two expenditure detail tables below 0.90 are the ones already reported in `track_abs_detail.md`; the gate reports them and
does not fail on them, as before.

Whole dataset: 5495 cells, 2452 checks, 259 series, 3400 observations (2889 published).

## 9. How it works

- `specs/abs_receipts.yaml`: the `enabled` flag, the two tables with their locator patterns and expected lines, the sum rules,
  the series catalogue. `specs/abs_receipts_labels.yaml`: the label dictionary.
- `pipeline/datalab/datasets/abs_receipts.py`: locator, row reading, cells, checks, gap observations.
  `datasets/abs.py` calls `abs_receipts.build_receipts` once, after the detail tables and before disputes are classified, and
  appends the gap observations; with `enabled: false` the dataset is exactly what it was.
- A row is recognised by its whole label after the object code, line number and enumerator are stripped. A line listed under a
  head (direct, indirect, other taxes, non-tax, capital, external, public account) is recognised only in the rows that follow
  that head, so "Petroleum Levy" under indirect taxes and under other taxes are different series and a member of a lost head
  stays unmapped. Two rows of one table on the same series are both dropped.
- Column year and vintage come from the PDF text layer through `abs.map_columns`, unchanged: the three columns must be exactly
  Budget e-1, Revised e-1, Budget e, or nothing from the table is mapped. The same for "(Rs in million)".
- A new edition whose layout matches needs no code or spec change. A label not in the dictionary stays unmapped and the sum it
  belongs to fails, which withholds that block until a human adds the label.

Overlays viewed before trusting the mapping (`WORK_DIR/qa/overlay_receipts_*.png`): 2025-26 p.7 (summary; the two wrapped
labels: the label boxes of rows 10 and 12 run into the row below, the amounts sit in their own boxes on the right line), 2010-11
p.3 (tax statement; "(Rs in million)" inside the table box, the footnote row below a rule) and 2026-27 p.7 (summary; the E03
line under capital receipts does read "(Bank) - Net" on the page). In all three the red table box encloses the whole table and
every amount has its own cell box in one of three columns under "Budget / Revised / Budget" headers.

## 10. Not done, and open questions for a human

1. **"Credit from Banking Sector" and "Domestic Debt Receipts (Bank) - Net"** sit at the same place (line 14). The one
   shared column is Budget 2024-25: '3,924,002' (2024-25 p.7, row '14 Credit from Banking Sector') against
   '3,924,003' (2025-26 p.7, row '14 Domestic Debt Receipts (Bank) - Net'). They are two series here because the document changed the
   name; merging them is a definition decision, and no check compares them while they are separate.
2. **2026-27 "E03 Domestic Debt Receipts (Bank) - Net" under capital receipts** may be the "(Non Bank)" line of the earlier
   editions. Budget 2025-26: '2,663,924' (2025-26 p.7, row 'E03 Domestic Debt Receipts (Non Bank) - Net') against
   '2,663,924' (2026-27 p.7, row 'E03 Domestic Debt Receipts (Bank) - Net'). Kept as printed in its own series; a human should
   decide whether to treat the label as a misprint.
3. **Renamed lines mapped to one series** (each confirmed by the shared column agreeing across the rename): "Cash Balance built up
   by the Provinces" / "Cash Balance Surplus by the Provinces"; "Project Loans & Grants Outside PSDP" / "Project Loans & Grants";
   "Worker's Welfare Fund" / "WWF (Ordinary Collection)" (same object code B01501); "Worker's (Profit) Participation Fund" /
   "WPPF (Contribution under Companies Profit)" (B01502); "Federal Excise" / "Federal Excise Duty". The last WWF/WPPF pair is
   among the disputed figures of section 6, where the unchanged labels differ too.
4. **Series prefix.** D32 says `fed.rev.<head_slug>`. The summary also prints capital receipts, external loans and the financing
   lines, which are receipts but not revenue; they are under `fed.rev.*` as D32 says. Renaming is a human decision.
5. **Meaning drift is not smoothed.** `fed.rev.tax` and `fed.rev.tax.indirect` do not contain the same heads in every edition
   (section 1). The definitions say so; the site should show that text. No break record was added for it.
6. **Non-tax revenue detail** (the pages after the tax statement: income from property and enterprise, civil administration,
   miscellaneous receipts by item; capital and external receipts by item) is not processed. The summary's non-tax heads are.
7. **The footnote row "*Of which FBR"** (2010-11, 2011-12) is not a series: no identity covers it.
8. **Second reader:** not routed, because no receipts table is flagged.
9. **Release and site:** `releases/` and `site/` were not touched; the release has to be rebuilt by the lead after merge.
10. **Spot check by a human** of a sample of values against the pages (AGENTS.md section 8) is still to do.

