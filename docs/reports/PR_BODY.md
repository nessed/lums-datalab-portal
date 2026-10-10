## Purpose

First prototype of the LUMS DataLab Portal, built unattended overnight on 2026-10-11 against a written plan: source verification, extraction, deterministic checks, a frozen release and a static site with a receipt page for every number.

- ClickUp task: https://app.clickup.com/t/86eyudf64
- Plan (the mandate for the run): `docs/plans/2026-10-11-overnight-prototype.md`
- What happened, with numbers: `docs/reports/2026-10-11-overnight-report.md`
- Map of the repo: `STATUS.md`
- Decisions to confirm or overturn: `DECISIONS.md` (everything dated 2026-10-11)

This PR started life as "Add overnight prototype plan and autonomous-mode rules"; it is reused as the single draft PR for the whole run.

## What is in it

| Area | State |
|---|---|
| Federal Annual Budget Statement (9 editions: 2010-11, 2011-12, 2016-17, 2017-18, 2021-22, 2022-23, 2024-25, 2025-26, 2026-27) | **Published**: 535 checked values, 2 labelled gaps |
| CPI (PBS Monthly Review, June 2021, 2023, 2024, 2025, 2026; base 2015-16; national, urban, rural) | **Published**: 884 checked values; 372 labelled gaps (the 2007-08 base, and two 2021 tables that Docling read badly and the detectors withheld) |
| Labour Force Survey (4 PBS annual reports) | Processed and checked, **not published**: cross-edition agreement 96.97% is under the frozen 98% threshold. Shown as "coming" |
| Site (`site/`) | builds statically from the release (2,032 pages): receipts, series, sources, methods, releases, demo |
| Gold set | kit only (398-cell blind sample, labelling page, scorer); **unlabelled, so no error rate is claimed** |

Kept separate on purpose:

| | Coverage (how much of each printed table was captured) | Checks passed (evaluable) | Cross-edition agreement |
|---|---|---|---|
| ABS | 773 of 781 printed numbers, 98.98% | 338 of 340 | 112 of 114 |
| CPI | 2,121 of 2,121, 100% | 507 of 507 | 117 of 117 |
| LFS | 2,108 of 2,108, 100% | 425 of 432 | 192 of 198 |

**Measured error rate:** pending human gold-set labelling.

## Ready when (AGENTS.md section 8)

- [x] Tests pass and CI checks pass (199 tests; CI runs tests, the release self-check and the site build)
- [x] No published value was produced or altered by an LLM (values come from Docling output through `normalise.parse_printed`; status comes from `status.py`; `check-release` recomputes both in CI)
- [x] Provenance fields are filled for every new value (source, page, box, printed text, run id, tool version, config hash)
- [x] Coverage and accuracy are reported separately where relevant
- [x] No source files, secrets or absolute paths committed (guard in CI)
- [x] `DECISIONS.md` / `AGENTS.md` updated (24 plan decisions and the unattended ones; new traps in section 7)
- [ ] Human review: provisional decisions, 10 spot-checked receipts, gold-set labelling

## How to verify

```powershell
py -3.12 -m venv pipeline\.venv
pipeline\.venv\Scripts\python -m pip install -r pipeline\requirements-ci.lock   # light: no Docling
pipeline\.venv\Scripts\python -m pip install -e pipeline --no-deps
cd pipeline; .venv\Scripts\python -m pytest; cd ..
pipeline\.venv\Scripts\python -m datalab check-release releases/v0.0.1-prototype
cd site; npm ci; npm run build; npm run start     # then open /o/fed.exp.current.function.health~2025-26~be
```

To rebuild from the official sources (needs the full `requirements.lock`, about 5 minutes per document on CPU): `releases/v0.0.1-prototype/HOW_TO_REPRODUCE.md`.

Good places to start reading: `pipeline/datalab/status.py` (how a value earns "checked"), `pipeline/datalab/checks.py`, `specs/abs.yaml`, `pipeline/datalab/datasets/abs.py`, `pipeline/datalab/release.py::check_release`.

## Changelog

- **M0 (01:30 PKT)** Thresholds frozen before any run (`thresholds/`), `STATUS.md`, running report, provisional decisions D1-D24.
- **M1 (01:58)** 9 ABS files downloaded from the official Finance Division site and verified; 8 identical to the archived copies, 2025-26 differs from one archive copy (official file used). CPI/LFS collection started.
- **M2 (01:50)** Schema, normaliser, tests, CI green.
- **M3-M5 (02:40)** 9 fresh Docling runs validated; Summary of Expenditure located in all 9; 630 cells mapped; 340 checks; release `v0.0.1-prototype` with 535 published values.
- **M6 (02:40)** Site merged from `proto/v0-site` and built against the release; screenshots in `docs/reports/qa/`.
- **Sources (02:10)** 6 CPI June issues and 5 LFS reports registered and content-inspected. June 2018 and June 2021 CPI could not be downloaded. The file PBS serves as "LFS 2014-15" turned out to be the Azad Jammu and Kashmir edition and now fails verification.
- **M7 CPI (02:57)** merged from `proto/v0-cpi`: 4 issues, 12 tables, 477 checks, 807 published values. The two pre-2019 issues are refused by the scanned-track rule (chart pages) and left as gaps.
- **M8 LFS (02:50)** merged from `proto/v0-lfs`: 4 reports (3 as page-range runs), 25 tables, 432 checks. Below the cross-edition threshold, so unpublished.
- **Addendum (03:45)** June 2021 CPI issue obtained from the Wayback Machine and added (77 more values; its urban and rural tables were flagged for merged rows and a lost column and are withheld). The scanned-page measure now leaves out blank pages; this was changed after seeing its effect and is listed for confirmation.
- **M9-M10 (03:10)** demo page with health, share of total and CPI; gold sample across all data types; spot-check sheet; final report with the morning checklist.

## What is provisional

Every decision dated 2026-10-11 in `DECISIONS.md`. The ones most worth a human look:

1. Two ABS editions have no readable cover page; they are identified by contents page plus a verified link from the official budget page.
2. ABS 2017-18 is used under a recorded deviation from the 95% text-layer inspection level (its covers are images).
3. A figure restated in a later edition is published from the first edition, with the disagreement stated.
4. The ABS function lines are current expenditure on revenue account only, and are labelled that way.
5. The scanned-page fraction is measured over printed pages (blank pages left out); changed after it had refused the June 2021 CPI issue. CPI on the 2007-08 base is verified but not processed.
6. LFS is withheld by the cross-edition threshold; whether a restatement by the publisher should count against it is a human call.
7. The release is a prototype: no DOI, draft series definitions, PDFs not hosted by us.

The CPI and LFS builders were written by subagents and merged after the tests, the release self-check and a read of the headline series. They have had less review than ABS.

## What is left

See `STATUS.md` (open questions, queued follow-ups) and the morning checklist at the end of the report.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
