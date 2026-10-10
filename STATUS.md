# STATUS

Last updated: 2026-10-11T03:10+05:00 by Claude Code (unattended overnight run) on branch proto/v0

## State in one paragraph
The pipeline works end to end for three data types and the release `releases/v0.0.1-prototype/`
publishes two of them: the federal Annual Budget Statement (9 editions, 535 checked values) and
the Consumer Price Index (June issues 2023 to 2026, 807 checked values). The Labour Force Survey
is processed and checked but **not published**: it is below the frozen cross-edition threshold,
so the site shows it as "coming". The static site in `site/` builds from the release (1,735
pages) with a receipt page for every value. 199 tests and CI are green. The error rate has not
been measured: the gold set (399 cells) is ready but unlabelled. Nothing is deployed; the Vercel
project has to be created by a human. Every decision taken overnight is provisional.

## Where things are
| What | Path | Notes |
|---|---|---|
| Plan for the overnight run | `docs/plans/2026-10-11-overnight-prototype.md` | authorised by Ali |
| Report of the run | `docs/reports/2026-10-11-overnight-report.md` | ends with the morning checklist |
| Track findings | `docs/reports/track_c_cpi_findings.md`, `track_d_lfs_findings.md` | CPI and LFS detail |
| QA images | `docs/reports/qa/` | overlays and site screenshots |
| Spot-check sheet | `docs/reports/spot_check.md` | 30 random published values |
| Decisions | `DECISIONS.md` | everything dated 2026-10-11 is provisional |
| Thresholds | `thresholds/` | frozen before any run; hash in `FROZEN.md` |
| Pipeline package | `pipeline/datalab/` | CLI: `python -m datalab <command>` |
| Dataset builders | `pipeline/datalab/datasets/abs.py`, `cpi.py`, `lfs.py` | `abs.py` is the model |
| Specs | `specs/<type>.yaml`, `specs/<type>_labels.yaml` | locator, columns, rules, label dictionary |
| Sources | `sources/plan.yaml` (input), `sources/manifest.csv`, `sources/verification/` | 20 files; 1 failed (LFS 2014-15) |
| Source files | `SOURCES_DIR` (outside the repo) | rebuilt by `datalab fetch` |
| Release | `releases/v0.0.1-prototype/` | 23 MB incl. 44 page renders |
| Site | `site/` | Next.js, static; reads `../releases/<version>` (`site/release.config.json`) |
| Gold kit | `gold/` | blind sample and labelling page; unlabelled |
| Docs | `docs/METHODS.md`, `docs/SCHEMA.md` | METHODS is rendered on the site |
| Local output | `work/` | git-ignored: runs, datasets, QA overlays |

## Datasets
| Dataset | Sources verified | Extracted | Tables located | Checks (evaluable) | Published | Coverage | Check pass rate | Cross-edition | Notes |
|---|---|---|---|---|---|---|---|---|---|
| ABS | 9/9 | 9/9 | 9/9 | 340 | 535 values, 2 gaps | 98.98% | 99.4% | 98.2% (112/114) | published |
| CPI | 6/6 obtained (2 planned Junes missing) | 4/6 | 12/14 | 477 | 807 values, 154 gaps | 100% | 100% | 100% (117/117) | published; pre-2019 issues blocked |
| LFS | 4/5 (2014-15 file is the AJK edition) | 4/4 | 25 | 432 | 0 values, 372 gaps | 100% | 98.4% | **96.97% (192/198)** | coming: below the 98% threshold |

Coverage is how much of each printed table was captured. Check pass rate is evidence about
whether what was captured is right. Measured error rate: pending gold-set labelling.

## How to run (short)
```powershell
py -3.12 -m venv pipeline\.venv
pipeline\.venv\Scripts\python -m pip install -r pipeline\requirements.lock
pipeline\.venv\Scripts\python -m pip install -e pipeline --no-deps
copy .env.example .env                  # set SOURCES_DIR
pipeline\.venv\Scripts\python -m datalab fetch
pipeline\.venv\Scripts\python -m datalab all --dataset abs     # cpi likewise; lfs: see the findings note for page ranges
pipeline\.venv\Scripts\python -m datalab release
pipeline\.venv\Scripts\python -m datalab check-release releases/v0.0.1-prototype
cd site; npm ci; npm run build
```
Tests only (no Docling, no PDFs): install `pipeline\requirements-ci.lock`, then `python -m pytest` in `pipeline`.

## Open questions for humans
- Confirm or overturn every provisional decision dated 2026-10-11 in `DECISIONS.md`.
- ABS: the function lines are current expenditure on revenue account only. Is that the series to
  lead with? (The detail tables elsewhere in the ABS carry sub-functions and development spending.)
- ABS: 2010-11 and 2017-18 identified without a readable cover; 2017-18 used under a recorded
  deviation (text layer on 93.9% of printed pages). Accept?
- ABS: two restated Budget 2021-22 figures are published from the first edition with a note.
  Prefer status `disputed`, or the later figure?
- Thresholds: should a restatement by the publisher count against cross-edition agreement? It
  nearly withheld ABS (98.2%) and does withhold LFS (96.97%).
- CPI: chart pages without a text layer make the two pre-2019 issues "scanned" (25% and 23%,
  limit 20%). Measure only table pages, record a deviation, or leave them out?
- LFS: 2024-25 is mapped on 13th ICLS tables only; the 19th ICLS headline is not in the data.
- DOI; hosting our own copies of the PDFs; public repo or a form for error reports; LUMS name
  and logo sign-off; moving the repo to an organisation; branch protection with required CI.

## Queued follow-ups
- Label the gold set (two people, about an hour), then `datalab gold-score`.
- Create the Vercel project (root directory `site`), then set `siteUrl` in `site/release.config.json`.
- CPI June 2018 and June 2021 (Wayback rate limit tonight; snapshot addresses are in the report).
- Register the national LFS 2014-15 report (the PBS link serves the AJK edition).
- Full-document Docling runs for LFS 2018-19, 2020-21, 2024-25 (page-range runs used, D18).
- Cross-source checks: SBP EasyData CSV for CPI (downloaded, not registered); Economic Survey
  chapters for CPI and LFS; Arslan's dataset once the ABS detail tables are processed.
- Clean the printed column label on CPI receipts; hide the LFS "Total 100.0" share series.
- LFS 2020-21 "key indicators" layout (would add unemployment rates and a second printing of
  participation rates).
- pdfplumber second reader for flagged tables (none were flagged).
- Wayback save for ABS 2026-27 (the only ABS file without a snapshot).

## Known traps learned tonight
All in `AGENTS.md` section 7: Docling on Windows without MSVC; glued and merged row labels;
unreliable column headers; cover pages without text; "no text layer" is not "scanned"; header
flags on data rows; the mislabelled LFS 2014-15 file; two ICLS definitions in LFS 2024-25;
Wayback CDX vs availability API; a shared `work/` folder between tracks.
