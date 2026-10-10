# Overnight report: first prototype, 2026-10-11

Append-only log of the unattended run that executes
`docs/plans/2026-10-11-overnight-prototype.md`. Times are Pakistan time (PKT).
Pull request: https://github.com/nessed/lums-datalab-portal/pull/1

## M0 Setup (started 01:12)

- Checked out `proto/v0` (already pushed, 3 commits, docs only). PR #1 already existed for this
  branch (opened by the planning session, not a draft). It is reused as the single PR for the
  run: converted to draft and retitled, instead of opening a second PR.
- `.env` created locally (not committed). `SOURCES_DIR` is a new folder `datalab-sources` beside the repo.
- Thresholds written and frozen at 01:20, before any extraction: `thresholds/thresholds.yaml`,
  hash in `thresholds/FROZEN.md`.
- Decisions D1-D24 from the plan appended to `DECISIONS.md` as provisional.
- Python 3.12 venv at `pipeline/.venv`; Docling 2.119.0 install started.
- 01:26 Docling 2.119.0 installed in the 3.12 venv (docling-core 2.101.1, docling-parse 7.22.2,
  docling-ibm-models 3.15.0, PyMuPDF 1.28.2, pydantic 2.14.0). `pipeline/requirements.lock` written
  (115 packages). Note: docling-core and docling-parse are newer than in the August venv
  (2.91.0 / 7.13.0); pip resolved them for docling 2.119.0 tonight and they are now pinned.
- M0 done 01:28. First push and draft PR at 01:25.

## M1 Sources (01:28 to 01:58)

**All 9 ABS files were downloaded from the official Finance Division site tonight and verified.**
Nothing was taken from the archive.

| Source | Pages | Verification | How the file was identified | Official budget page links to this file | Wayback snapshot with the same bytes |
|---|---|---|---|---|---|
| abs-fed-2010-11 | 29 | official, identical to archive copy | contents page + link (no cover page in the file) | yes | 2025-06-19 |
| abs-fed-2011-12 | 31 | official, identical to archive copy | cover text | yes | none found yet |
| abs-fed-2016-17 | 33 | official, identical to archive copy | cover text (page 2; page 1 is an image) | yes | none found yet |
| abs-fed-2017-18 | 33 | official, identical to archive copy | contents page + link (cover is an image) | yes | 2025-05-27 |
| abs-fed-2021-22 | 50 | official, identical to archive copy | cover text | yes | 2026-08-03 |
| abs-fed-2022-23 | 54 | official, identical to archive copy | cover text | yes | 2025-07-08 |
| abs-fed-2024-25 | 59 | official, identical to archive copy | cover text | yes | none found yet |
| abs-fed-2025-26 | 54 | official, **differs from the Arsalan archive copy** | cover text | yes | 2025-11-03 |
| abs-fed-2026-27 | 57 | official, identical to archive copy | cover text | yes | none found yet |

Things worth knowing:

- **ABS 2025-26: the official file (2,645,541 bytes) is not the file in the Arsalan archive
  (2,665,102 bytes).** The official file is used. It is byte-identical to the Wayback snapshot of
  2025-11-03 and to the copy in the pbs-corpus registry, so the Arsalan copy is the odd one out
  (probably an earlier upload). Flagged `official_differs_from_archive`.
- **The 2010-11 file has no cover page and the 2017-18 cover is an image**, so the plan's title
  test ("Annual Budget Statement" in the first three pages) cannot pass for them. They were
  accepted on a second route with more evidence, not less: contents-page markers, the fiscal year,
  and a verified link to that exact file from the official budget page for that year. Recorded in
  DECISIONS.md; shown as a caveat on the source. **Ali/Ahmad: confirm or overturn.**
- **Deviation: ABS 2017-18 has a text layer on 31 of 33 printed pages (93.9%)**, under the 95%
  inspection level, because its front and back covers are pictures. Used anyway (it is the only
  edition that prints the 2016-17 revised estimates); the threshold was not changed. Recorded in
  DECISIONS.md. Blank pages (2, 4, 6 in newer editions) are left out of the fraction because
  nothing is printed on them.
- The tiny 2010-11 (66 KB) and 2011-12 (113 KB) files are complete: 29 and 31 pages, contents
  page present, the Summary of Expenditure located and read at 100% coverage.
- The plan's Wayback "availability" API returned nothing for these PDFs. The CDX index works and
  carries a content digest, so each snapshot above is proven to hold the same bytes as our file.
  Four files have no snapshot yet; a save is attempted at the end of the run.
- The archive's 2026-27 copy under "Budget Statements" is a 60 MB file; the official 2.4 MB
  file is used and equals the pbs-corpus copy.
- `python -m datalab fetch` rebuilds the sources folder from `sources/manifest.csv` and checks
  every hash (official URL first, then the recorded Wayback snapshot).
- Track A (CPI, LFS, SBP, PES sources) was started at 01:22 as a background subagent.

## M2 Schema, normaliser, tests, CI (01:20 to 01:50, overlapping M1)

- `pipeline/datalab/schema.py`: Source, Series, Cell, Observation, Check, RunManifest, Release as
  pydantic v2 models; JSON Schema exported to `schema/`; `docs/SCHEMA.md`.
- `normalise.py`: every rule from the tested `compare_values.py`, plus scale detection, percent
  and footnote marks, and the two-numbers-in-one-cell trap. Decimal throughout.
- 100 tests pass (normaliser rules, bbox origin conversion, the Docling failure detectors, every
  check and tolerance, status tiers, release self-consistency, schema sync, frozen-threshold hash).
- CI is green on GitHub Actions (tests, `check-release`, no-PDF/no-secret/no-absolute-path guard,
  site build once `site/` exists). CI installs `requirements-ci.lock` (the full lock minus
  Docling and its model stack) because extraction needs the PDFs, which are never in git.

## M3 Extract, validate, coverage (started 01:29)

- **Fallback taken:** the first Docling run (ABS 2010-11 run-01) failed on every page with
  `InvalidCxxCompiler: cl is not found`: torch tries to compile and there is no MSVC compiler on
  this machine. Fixed by setting `TORCHDYNAMO_DISABLE=1` (speed only; now part of the hashed
  config). Run-01 is kept as the recorded failure; run-02 is the valid one. Added to AGENTS.md traps.
- Speed on this CPU: about 5 minutes per ABS edition (8 s per page), run one after another.
- Overlay QA viewed for 2010-11 p.9 and 2011-12 p.11: every box sits on its number
  (`docs/reports/qa/`). The coordinate conversion is right.
