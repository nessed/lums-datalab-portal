# STATUS

Last updated: 2026-10-11T02:45+05:00 by Claude Code (unattended overnight run) on branch proto/v0

## State in one paragraph
The federal Annual Budget Statement (ABS) works end to end: 9 editions downloaded from the
official site and verified, freshly extracted with Docling, checked by code, released as
`releases/v0.0.1-prototype/` (535 checked values, 2 labelled gaps) and shown on a static site
with a receipt page for every value. Tests and CI are green. CPI and LFS sources are collected
and verified; their pipelines are being built on `proto/v0-cpi` and `proto/v0-lfs` and are not
in the release yet (the site shows them as "coming"). The error rate has not been measured:
the gold set is unlabelled.

## Where things are
| What | Path | Notes |
|---|---|---|
| Plan for the overnight run | `docs/plans/2026-10-11-overnight-prototype.md` | authorised by Ali |
| Running report | `docs/reports/2026-10-11-overnight-report.md` | append-only; QA images in `docs/reports/qa/` |
| Decisions | `DECISIONS.md` | everything dated 2026-10-11 is provisional |
| Thresholds | `thresholds/` | frozen before any run; hash in `FROZEN.md` |
| Pipeline package | `pipeline/datalab/` | CLI: `python -m datalab <command>` |
| Dataset builders | `pipeline/datalab/datasets/` | `abs.py` is the model for new data types |
| Specs | `specs/abs.yaml`, `specs/abs_labels.yaml` | locator, columns, sum rules, label dictionary |
| Sources | `sources/plan.yaml` (input), `sources/manifest.csv`, `sources/verification/` | 20 files registered |
| Source files | `SOURCES_DIR` (outside the repo) | rebuilt by `datalab fetch` |
| Release | `releases/v0.0.1-prototype/` | ABS only so far |
| Site | `site/` | Next.js, static; reads `../releases/<version>` (`site/release.config.json`) |
| Gold kit | `gold/` | blind sample and labelling page; unlabelled |
| Docs | `docs/METHODS.md`, `docs/SCHEMA.md` | METHODS is rendered on the site |
| Local output | `work/` | git-ignored: runs, datasets, QA overlays |

## Datasets
| Dataset | Sources verified | Extracted | Located | Checked | Published | Coverage | Check pass rate | Notes |
|---|---|---|---|---|---|---|---|---|
| ABS | 9/9 | 9/9 | 9/9 | 340 checks | 535 values, 2 gaps | 98.98% | 99.4% (cross-edition 98.2%) | published |
| CPI | 6 June issues | in progress | - | - | - | - | - | track C; June 2018 and 2021 not obtained |
| LFS | 5/5 | in progress | - | - | - | - | - | track D; page-range runs (D18) |

## How to run (short)
```powershell
py -3.12 -m venv pipeline\.venv
pipeline\.venv\Scripts\python -m pip install -r pipeline\requirements.lock
pipeline\.venv\Scripts\python -m pip install -e pipeline --no-deps
copy .env.example .env                  # set SOURCES_DIR
pipeline\.venv\Scripts\python -m datalab fetch
pipeline\.venv\Scripts\python -m datalab all --dataset abs
pipeline\.venv\Scripts\python -m datalab release
cd site; npm ci; npm run build
```

## Open questions for humans
- Confirm or overturn every provisional decision dated 2026-10-11 in `DECISIONS.md` (D1-D24 and
  the unattended ones below them).
- Two ABS files are identified without a readable cover (2010-11, 2017-18). Accept that route?
- ABS 2017-18 is used under a recorded deviation (text layer on 93.9% of printed pages; covers
  are images). Accept?
- Restated figures (Budget 2021-22: Economic Affairs, Recreation): we publish the first
  printing with a note. Prefer status `disputed`, or the later figure?
- The ABS function lines are current expenditure on revenue account only. Is that the series
  the demo should lead with, or should development spending by function be found elsewhere?
- Cross-edition agreement is 98.2% against a 98% threshold: two restated figures nearly kept the
  whole data type unpublished. Should restatements count against that threshold?
- DOI, hosting our own copies of the PDFs, public repo vs form for error reports, LUMS name
  and logo sign-off, moving the repo to an organisation, branch protection with required CI.

## Queued follow-ups
- Label the gold set (two people, about an hour), then `datalab gold-score`.
- CPI June 2018 and June 2021 issues (Wayback rate limit tonight).
- Full-document LFS runs if page-range runs were used.
- Comparison with Arslan's `subcodes_long.csv` (comparison only).
- pdfplumber second reader for flagged tables (none were flagged tonight).
- Wayback saves for the 4 ABS files with no snapshot.
- Set `siteUrl` in `site/release.config.json` once the Vercel URL exists.

## Known traps learned tonight
See `AGENTS.md` section 7 (Docling on Windows without MSVC, glued and merged row labels,
unreliable column headers, cover pages without text, Wayback CDX vs availability API).
