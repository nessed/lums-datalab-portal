# Dataset card: LUMS DataLab Portal v0.0.1-prototype

Built 2026-10-10T21:40:36+00:00 from commit `0cb5b11f50c4`. Label: **prototype**. DOI: none.

> Prototype. Not for citation in publications yet. Every published value passed deterministic checks;
> the absolute error rate has not been measured yet (it needs the human-labelled gold set).

## Scope

| Data type | State | Sources | Published values | Withheld / gaps |
|---|---|---|---|---|
| Federal Annual Budget Statement | published | 9 | 535 | not_in_source: 2 |
| Consumer Price Index | coming | 0 | 0 | none |
| Labour Force Survey | coming | 0 | 0 | none |

A data type marked *coming* is below a frozen threshold or not processed yet; none of its values are published.

- Consumer Price Index: not processed yet
- Labour Force Survey: not processed yet

## Status mix (internal tiers)

A = arithmetic check passed and a second official printing agrees. B = one of the two. C = no check covers it (withheld). D = failed or flagged (withheld).

| Data type | A | B | C | D |
|---|---|---|---|---|
| abs | 118 | 417 | 0 | 0 |
| cpi | 0 | 0 | 0 | 0 |
| lfs | 0 | 0 | 0 | 0 |

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

## Accuracy evidence: deterministic checks

| Data type | Passed exactly | Passed within rounding | Failed | Not evaluable | Pass rate of evaluable checks | Cross-edition agreement |
|---|---|---|---|---|---|---|
| abs | 291 | 47 | 2 | 0 | 99.4% | 98.2% (114 pairs) |

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
