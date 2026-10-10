# Dataset card: LUMS DataLab Portal v0.0.1-prototype

Built 2026-10-10T23:02:14+00:00 from commit `0a5c434c7f0d`. Label: **prototype**. DOI: none.

> Prototype. Not for citation in publications yet. Every published value passed deterministic checks;
> the absolute error rate has not been measured yet (it needs the human-labelled gold set).

## Scope

| Data type | State | Sources | Published values | Withheld / gaps |
|---|---|---|---|---|
| Federal Annual Budget Statement | published | 9 | 533 | disputed: 2, not_in_source: 2 |
| Consumer Price Index | published | 5 | 1038 | not_yet_verified: 218 |
| Labour Force Survey | published | 4 | 328 | disputed: 6, failed_checks: 2, not_yet_verified: 36 |

A data type marked *coming* is below a frozen threshold or not processed yet; none of its values are published.


## Status mix (internal tiers)

A = arithmetic check passed and a second official printing agrees. B = one of the two. C = no check covers it (withheld). D = failed or flagged (withheld).

| Data type | A | B | C | D |
|---|---|---|---|---|
| abs | 118 | 415 | 0 | 0 |
| cpi | 117 | 921 | 0 | 0 |
| lfs | 138 | 190 | 36 | 2 |

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
| abs | 291 | 47 | 0 | 2 | 0 | 99.4% | 100.0% (112 of 112 pairs) | 2 of 114 pairs (1.8%) |
| cpi | 302 | 445 | 0 | 0 | 0 | 100.0% | 100.0% (117 of 117 pairs) | 0 of 117 pairs (0.0%) |
| lfs | 348 | 77 | 1 | 6 | 0 | 98.4% | 100.0% (192 of 192 pairs) | 6 of 198 pairs (3.0%) |

**Disputed** means two official documents print different figures for the same thing and each printing adds up in its own table (a restatement by the publisher). A disputed figure is not published as checked: the site shows both printings and no value. A differing pair that does not meet those conditions is a failure and its value is withheld.

**Deviation (decision D26, definition changed after results existed):** cross-edition agreement is agree / (agree + fail), with disputed pairs counted separately in the last column; the frozen 98% applies to that ratio. In the pass rate of evaluable checks a disputed pair counts as not passed. A data type whose disputed pairs exceed 5% of its cross-edition pairs is not published. The thresholds file is unchanged.

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
