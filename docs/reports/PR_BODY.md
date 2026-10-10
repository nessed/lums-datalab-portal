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
| Federal Annual Budget Statement (9 editions: 2010-11, 2011-12, 2016-17, 2017-18, 2021-22, 2022-23, 2024-25, 2025-26, 2026-27) | **Published in the release**: 535 checked values, 2 labelled gaps |
| CPI (PBS Monthly Review, June issues) | see changelog |
| Labour Force Survey (PBS annual reports) | see changelog |
| Site (`site/`) | builds statically from the release; receipts, series, sources, methods, releases, demo |
| Gold set | kit only (400-cell blind sample, labelling page); **unlabelled, so no error rate is claimed** |

ABS numbers, kept separate on purpose:

- **Coverage** (how much of each printed table was captured): 773 of 781 printed numbers, 98.98%; no table under 96.6%.
- **Checks** (is what was captured consistent): 338 of 340 pass (99.4%). Cross-edition agreement 112 of 114 (98.2%); the two disagreements are a restatement by the Finance Division and are shown on the receipts.
- **Measured error rate:** pending human gold-set labelling.

## Ready when (AGENTS.md section 8)

- [x] Tests pass and CI checks pass (107 tests; CI runs tests, the release self-check and the site build)
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
- Sources: 6 CPI June issues and 5 LFS reports registered and content-inspected (June 2018 and June 2021 CPI could not be downloaded).

## What is provisional

Every decision dated 2026-10-11 in `DECISIONS.md`. The ones most worth a human look:

1. Two ABS editions have no readable cover page; they are identified by contents page plus a verified link from the official budget page.
2. ABS 2017-18 is used under a recorded deviation from the 95% text-layer inspection level (its covers are images).
3. A figure restated in a later edition is published from the first edition, with the disagreement stated.
4. The ABS function lines are current expenditure on revenue account only, and are labelled that way.
5. The release is a prototype: no DOI, draft series definitions, PDFs not hosted by us.

## What is left

See `STATUS.md` (open questions, queued follow-ups) and the morning checklist at the end of the report.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
