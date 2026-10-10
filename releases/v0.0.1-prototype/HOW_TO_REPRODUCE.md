# How to reproduce v0.0.1-prototype

From a clean clone, on any machine with Python 3.12 and network access. Commands are for PowerShell; on
Linux or macOS replace `pipeline\.venv\Scripts\python` with `pipeline/.venv/bin/python`.

```powershell
py -3.12 -m venv pipeline\.venv
pipeline\.venv\Scripts\python -m pip install -r pipeline\requirements.lock
pipeline\.venv\Scripts\python -m pip install -e pipeline --no-deps
copy .env.example .env      # then set SOURCES_DIR to an empty folder outside the repo
pipeline\.venv\Scripts\python -m datalab fetch                 # network: downloads every source in sources/manifest.csv and verifies SHA-256
pipeline\.venv\Scripts\python -m datalab all --dataset abs     # fresh Docling runs, validation, checks (CPU: about 5 minutes per document)
pipeline\.venv\Scripts\python -m datalab all --dataset cpi     # if CPI is in this release
pipeline\.venv\Scripts\python -m datalab all --dataset lfs     # if LFS is in this release
pipeline\.venv\Scripts\python -m datalab release --version v0.0.1-prototype
pipeline\.venv\Scripts\python -m datalab check-release releases/v0.0.1-prototype
```

Steps that need the network: `pip install`, `datalab fetch`, and the first Docling run (it downloads its models once).
`RA_SHIP_DIR` is optional: it is only used to compare downloads with the previous RAs' archive copies.

`datalab fetch` refuses a file whose SHA-256 differs from the manifest. If an official file has been reissued,
it falls back to the recorded Wayback snapshot; if that also differs, the release cannot be reproduced bit for bit
and the difference should be recorded as an erratum.

Re-extraction is deterministic for a fixed Docling version and configuration; each run records both. A fresh run
gets a new run id (runs are never overwritten), so `cells.json` differs only in `run_id` if nothing else changed.

## Expected input hashes

| Source | Pages | Bytes | SHA-256 | Official URL |
|---|---|---|---|---|
| abs-fed-2010-11 | 29 | 66238 | `fd3d328c2db79dd43d3ae337570701f4c541bd0a0ad233812cc4a5194fb5cddb` | https://www.finance.gov.pk/budget/abs_10_11.pdf |
| abs-fed-2011-12 | 31 | 112873 | `1ac18e5f6464e2ad48d34d3600aaff64cd77d8913d6ec1eb3df1e10b42442cc7` | https://www.finance.gov.pk/budget/abs_11_12.pdf |
| abs-fed-2016-17 | 33 | 1032138 | `a663de0aebf8e5ae8f6bb0b415803ace13ceb73bc00e079f2547ed5c4581da0d` | https://www.finance.gov.pk/budget/abs_2016_17.pdf |
| abs-fed-2017-18 | 33 | 1087862 | `1b97719696b2e2a20e2f5ef1666d936566a97e3435bfdc540121706f7bec550b` | https://www.finance.gov.pk/budget/Annual Budget Statement 2017-18.pdf |
| abs-fed-2021-22 | 50 | 724184 | `616f82badaed3a380502c9263c0748573442459acf384ba3d5896d296962ad90` | https://www.finance.gov.pk/budget/Budget_2021_22/1_ABS-English_2021_22.pdf |
| abs-fed-2022-23 | 54 | 4313224 | `53ba6de55ba4d44933b3cc11dbefde70aa35a21f262ffefc45a66d70118ea5d4` | https://www.finance.gov.pk/budget/Budget_2022_23/Annual_Budget_Statement_English.pdf |
| abs-fed-2024-25 | 59 | 3111490 | `e0ec918e5b82314652e49235a7431f904b6d97c7a3864b684b70394b806561ce` | https://www.finance.gov.pk/budget/Budget_2024_25/Annual_Budget_Statement.pdf |
| abs-fed-2025-26 | 54 | 2645541 | `7c212e5219304b9ead98dcb6320d8fe92dc87f6220adc8a789c0b83592f95f01` | https://www.finance.gov.pk/budget/budget_2025_26/abs_eng_10062025.pdf |
| abs-fed-2026-27 | 57 | 2380926 | `4e64990527af61beff6b7a51bba3cdf1de5b426ceab371d5180cf599153048b0` | https://www.finance.gov.pk/budget/budget_2026_27/Annual_Budget_Statement.pdf |

## Extraction configuration

Config SHA-256 values used by the runs in this release: `87e850735882d161e3150af372f4d19341dba822eaf4fb34d96fd6d3c0b6badf`.
The full configuration of every run is in `runs/<run_id>.manifest.json`.
