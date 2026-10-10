# Dataset card: LUMS DataLab Portal v0.0.1-prototype

Built 2026-10-10T23:26:08+00:00 from commit `839584b0e7c1`. Label: **prototype**. DOI: none.

> Prototype. Not for citation in publications yet. Every published value passed deterministic checks;
> the absolute error rate has not been measured yet (it needs the human-labelled gold set).

## Scope

| Data type | State | Sources | Published values | Withheld / gaps |
|---|---|---|---|---|
| Federal Annual Budget Statement | published | 9 | 2111 | disputed: 3, failed_checks: 216, not_in_source: 78, not_yet_verified: 200 |
| Consumer Price Index | published | 8 | 1254 | disputed: 2 |
| Labour Force Survey | published | 5 | 406 | disputed: 6, failed_checks: 3, not_yet_verified: 35 |

A data type marked *coming* is below a frozen threshold or not processed yet; none of its values are published.


## Status mix (internal tiers)

A = arithmetic check passed and a second official printing agrees. B = one of the two. C = no check covers it (withheld). D = failed or flagged (withheld).

| Data type | A | B | C | D |
|---|---|---|---|---|
| abs | 436 | 1675 | 200 | 216 |
| cpi | 132 | 1122 | 0 | 0 |
| lfs | 216 | 190 | 35 | 3 |

## Coverage: how much of each printed table was captured

Measured by code: numbers found in the PDF text layer inside the table region versus numbers the extractor emitted for that table. This says nothing about whether the captured numbers are right; see the next section.

| Source | Page | Printed numbers | Captured | Coverage | Coverage, full-width row band |
|---|---|---|---|---|---|
| abs-fed-2010-11 | 9 | 92 | 92 | 100.0% | 100.0% |
| abs-fed-2011-12 | 11 | 90 | 90 | 100.0% | 100.0% |
| abs-fed-2016-17 | 12 | 90 | 90 | 100.0% | 100.0% |
| abs-fed-2017-18 | 11 | 89 | 86 | 96.6% | 96.6% |
| abs-fed-2021-22 | 17 | 75 | 75 | 100.0% | 100.0% |
| abs-fed-2022-23 | 15 | 84 | 84 | 100.0% | 100.0% |
| abs-fed-2024-25 | 17 | 87 | 85 | 97.7% | 97.7% |
| abs-fed-2025-26 | 17 | 87 | 87 | 100.0% | 100.0% |
| abs-fed-2026-27 | 17 | 87 | 84 | 96.5% | 96.5% |
| abs-fed-2010-11 | 10 | 119 | 115 | 96.6% | 96.6% |
| abs-fed-2010-11 | 11 | 72 | 72 | 100.0% | 100.0% |
| abs-fed-2010-11 | 12 | 71 | 68 | 95.8% | 95.8% |
| abs-fed-2010-11 | 13 | 36 | 36 | 100.0% | 100.0% |
| abs-fed-2010-11 | 14 | 100 | 100 | 100.0% | 100.0% |
| abs-fed-2010-11 | 15 | 101 | 101 | 100.0% | 100.0% |
| abs-fed-2010-11 | 16 | 53 | 53 | 100.0% | 100.0% |
| abs-fed-2011-12 | 12 | 119 | 119 | 100.0% | 100.0% |
| abs-fed-2011-12 | 13 | 70 | 70 | 100.0% | 100.0% |
| abs-fed-2011-12 | 14 | 71 | 71 | 100.0% | 100.0% |
| abs-fed-2011-12 | 15 | 35 | 35 | 100.0% | 100.0% |
| abs-fed-2011-12 | 16 | 100 | 96 | 96.0% | 96.0% |
| abs-fed-2011-12 | 17 | 94 | 94 | 100.0% | 100.0% |
| abs-fed-2011-12 | 18 | 54 | 54 | 100.0% | 100.0% |
| abs-fed-2016-17 | 13 | 119 | 110 | 92.4% | 92.4% |
| abs-fed-2016-17 | 14 | 72 | 72 | 100.0% | 100.0% |
| abs-fed-2016-17 | 15 | 71 | 71 | 100.0% | 100.0% |
| abs-fed-2016-17 | 16 | 30 | 30 | 100.0% | 100.0% |
| abs-fed-2016-17 | 17 | 104 | 104 | 100.0% | 100.0% |
| abs-fed-2016-17 | 18 | 102 | 102 | 100.0% | 100.0% |
| abs-fed-2016-17 | 19 | 65 | 64 | 98.5% | 98.5% |
| abs-fed-2017-18 | 12 | 119 | 106 | 89.1% | 89.1% |
| abs-fed-2017-18 | 13 | 72 | 72 | 100.0% | 100.0% |
| abs-fed-2017-18 | 14 | 71 | 71 | 100.0% | 100.0% |
| abs-fed-2017-18 | 15 | 30 | 30 | 100.0% | 100.0% |
| abs-fed-2017-18 | 16 | 104 | 104 | 100.0% | 100.0% |
| abs-fed-2017-18 | 17 | 104 | 104 | 100.0% | 100.0% |
| abs-fed-2017-18 | 18 | 65 | 65 | 100.0% | 100.0% |
| abs-fed-2021-22 | 18 | 113 | 111 | 98.2% | 98.2% |
| abs-fed-2021-22 | 19 | 75 | 74 | 98.7% | 98.7% |
| abs-fed-2021-22 | 20 | 71 | 71 | 100.0% | 100.0% |
| abs-fed-2021-22 | 21 | 25 | 25 | 100.0% | 100.0% |
| abs-fed-2021-22 | 22 | 104 | 104 | 100.0% | 100.0% |
| abs-fed-2021-22 | 23 | 77 | 77 | 100.0% | 100.0% |
| abs-fed-2021-22 | 24 | 55 | 55 | 100.0% | 100.0% |
| abs-fed-2022-23 | 16 | 113 | 100 | 88.5% | 88.5% |
| abs-fed-2022-23 | 17 | 77 | 77 | 100.0% | 100.0% |
| abs-fed-2022-23 | 18 | 73 | 73 | 100.0% | 100.0% |
| abs-fed-2022-23 | 19 | 25 | 25 | 100.0% | 100.0% |
| abs-fed-2022-23 | 20 | 103 | 103 | 100.0% | 100.0% |
| abs-fed-2022-23 | 21 | 75 | 75 | 100.0% | 100.0% |
| abs-fed-2022-23 | 22 | 53 | 53 | 100.0% | 100.0% |
| abs-fed-2024-25 | 18 | 113 | 113 | 100.0% | 100.0% |
| abs-fed-2024-25 | 19 | 83 | 83 | 100.0% | 100.0% |
| abs-fed-2024-25 | 20 | 75 | 75 | 100.0% | 100.0% |
| abs-fed-2024-25 | 21 | 25 | 25 | 100.0% | 100.0% |
| abs-fed-2024-25 | 22 | 114 | 114 | 100.0% | 100.0% |
| abs-fed-2024-25 | 23 | 64 | 64 | 100.0% | 100.0% |
| abs-fed-2024-25 | 24 | 54 | 54 | 100.0% | 100.0% |
| abs-fed-2025-26 | 18 | 113 | 113 | 100.0% | 100.0% |
| abs-fed-2025-26 | 19 | 95 | 95 | 100.0% | 100.0% |
| abs-fed-2025-26 | 20 | 59 | 59 | 100.0% | 100.0% |
| abs-fed-2025-26 | 21 | 25 | 25 | 100.0% | 100.0% |
| abs-fed-2025-26 | 22 | 111 | 111 | 100.0% | 100.0% |
| abs-fed-2025-26 | 23 | 61 | 61 | 100.0% | 100.0% |
| abs-fed-2025-26 | 24 | 51 | 51 | 100.0% | 100.0% |
| abs-fed-2026-27 | 18 | 113 | 113 | 100.0% | 100.0% |
| abs-fed-2026-27 | 19 | 80 | 80 | 100.0% | 100.0% |
| abs-fed-2026-27 | 20 | 73 | 73 | 100.0% | 100.0% |
| abs-fed-2026-27 | 21 | 25 | 25 | 100.0% | 100.0% |
| abs-fed-2026-27 | 22 | 110 | 110 | 100.0% | 100.0% |
| abs-fed-2026-27 | 23 | 63 | 63 | 100.0% | 100.0% |
| abs-fed-2026-27 | 24 | 43 | 43 | 100.0% | 100.0% |
| cpi-pbs-2016-06 | 5 | 142 | 142 | 100.0% | 100.0% |
| cpi-pbs-2018-06 | 5 | 142 | 142 | 100.0% | 100.0% |
| cpi-pbs-2019-06 | 5 | 142 | 142 | 100.0% | 100.0% |
| cpi-pbs-2021-06 | 8 | 142 | 142 | 100.0% | 100.0% |
| cpi-pbs-2021-06 | 9 | 142 | 142 | 100.0% | 100.0% |
| cpi-pbs-2021-06 | 10 | 142 | 142 | 100.0% | 100.0% |
| cpi-pbs-2023-06 | 8 | 141 | 141 | 100.0% | 100.0% |
| cpi-pbs-2023-06 | 9 | 141 | 141 | 100.0% | 100.0% |
| cpi-pbs-2023-06 | 10 | 141 | 141 | 100.0% | 100.0% |
| cpi-pbs-2024-06 | 8 | 141 | 141 | 100.0% | 100.0% |
| cpi-pbs-2024-06 | 9 | 141 | 141 | 100.0% | 100.0% |
| cpi-pbs-2024-06 | 10 | 141 | 141 | 100.0% | 100.0% |
| cpi-pbs-2025-06 | 8 | 142 | 142 | 100.0% | 100.0% |
| cpi-pbs-2025-06 | 9 | 141 | 141 | 100.0% | 100.0% |
| cpi-pbs-2025-06 | 10 | 142 | 142 | 100.0% | 100.0% |
| cpi-pbs-2026-06 | 8 | 141 | 141 | 100.0% | 100.0% |
| cpi-pbs-2026-06 | 9 | 141 | 141 | 100.0% | 100.0% |
| cpi-pbs-2026-06 | 10 | 142 | 142 | 100.0% | 100.0% |
| lfs-pbs-2014-15-national | 30 | 150 | 150 | 100.0% | 100.0% |
| lfs-pbs-2014-15-national | 32 | 150 | 150 | 100.0% | 100.0% |
| lfs-pbs-2014-15-national | 34 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2014-15-national | 35 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2014-15-national | 35 | 48 | 48 | 100.0% | 100.0% |
| lfs-pbs-2014-15-national | 44 | 18 | 18 | 100.0% | 100.0% |
| lfs-pbs-2014-15-national | 46 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2017-18 | 30 | 150 | 150 | 100.0% | 100.0% |
| lfs-pbs-2017-18 | 32 | 150 | 150 | 100.0% | 100.0% |
| lfs-pbs-2017-18 | 34 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2017-18 | 35 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2017-18 | 35 | 48 | 48 | 100.0% | 100.0% |
| lfs-pbs-2017-18 | 44 | 18 | 18 | 100.0% | 100.0% |
| lfs-pbs-2017-18 | 46 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2018-19 | 38 | 150 | 150 | 100.0% | 100.0% |
| lfs-pbs-2018-19 | 40 | 150 | 150 | 100.0% | 100.0% |
| lfs-pbs-2018-19 | 43 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2018-19 | 44 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2018-19 | 44 | 48 | 48 | 100.0% | 100.0% |
| lfs-pbs-2018-19 | 53 | 18 | 18 | 100.0% | 100.0% |
| lfs-pbs-2018-19 | 55 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2020-21 | 32 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2020-21 | 33 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2020-21 | 35 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2020-21 | 38 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2020-21 | 39 | 48 | 48 | 100.0% | 100.0% |
| lfs-pbs-2024-25 | 58 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2024-25 | 60 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2024-25 | 64 | 91 | 91 | 100.0% | 100.0% |
| lfs-pbs-2024-25 | 72 | 90 | 90 | 100.0% | 100.0% |
| lfs-pbs-2024-25 | 76 | 48 | 48 | 100.0% | 100.0% |
| lfs-pbs-2024-25 | 145 | 19 | 19 | 100.0% | 100.0% |

## Accuracy evidence: deterministic checks

| Data type | Passed exactly | Passed within rounding | Failed | Disputed | Not evaluable | Pass rate of evaluable checks | Cross-edition agreement | Disputed pairs |
|---|---|---|---|---|---|---|---|---|
| abs | 1365 | 217 | 19 | 3 | 123 | 98.6% | 99.6% (460 of 462 pairs) | 3 of 465 pairs (0.7%) |
| cpi | 348 | 540 | 1 | 2 | 0 | 99.7% | 100.0% (128 of 128 pairs) | 2 of 130 pairs (1.5%) |
| lfs | 599 | 108 | 1 | 6 | 0 | 99.0% | 100.0% (270 of 270 pairs) | 6 of 276 pairs (2.2%) |

**Disputed** means two official documents print different figures for the same thing and each printing adds up in its own table (a restatement by the publisher). A disputed figure is not published as checked: the site shows both printings and no value. A differing pair that does not meet those conditions is a failure and its value is withheld.

**Deviation (decision D26, definition changed after results existed):** cross-edition agreement is agree / (agree + fail), with disputed pairs counted separately in the last column; the frozen 98% applies to that ratio. In the pass rate of evaluable checks a disputed pair counts as not passed. A data type whose disputed pairs exceed 5% of its cross-edition pairs is not published. The thresholds file is unchanged.
- abs: differing pairs kept as failures: a table or cell carries an extraction flag: 1; a table or row carries a structural flag: 1.

**Measured error rate: pending gold-set labelling.** The gold-set kit is in `gold/`; until two humans have labelled it, no absolute error rate is claimed.

## Known limitations

- Budget figures are budget estimates (BE) and revised estimates (RE) only. The Annual Budget Statement prints no actuals.
- The ten function lines are current expenditure on revenue account. Development spending by function is not in this table.
- Federal figures before and after 2011-12 are not comparable (18th Amendment devolution); the break is marked, never smoothed.
- Source PDFs are not hosted by this project; receipts link to the official URL and a Wayback snapshot where one exists.
- Series definitions are drafts awaiting human review.

## Tools

| Tool | Version |
|---|---|
| python | 3.12.10 |
| docling | 2.119.0 |
| docling-core | 2.101.1 |
| docling-parse | 7.22.2 |
| docling-ibm-models | 3.15.0 |
| pymupdf | 1.28.2 |
| pdfplumber | 0.11.10 |
| pypdf | 6.20.0 |

Thresholds file SHA-256: `85689c5c066fef50c825db8aab5a38595bf1c4d22d4515b7be22bdc5dd13e48b` (frozen before any extraction run).
