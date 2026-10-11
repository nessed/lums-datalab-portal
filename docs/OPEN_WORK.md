# Open work

Everything left unfinished by the overnight runs of 2026-10-11/12, after `proto/v0` was merged into `main`.
This is the list a human or an agent picks the next job from. `STATUS.md` says where things are; this file
says what is not done yet and exactly how to finish it.

## Rules for this file

- One entry per item. Ids: `P` pipeline, `S` site, `H` needs a human. Ids are never reused.
- Each section is written and kept current by its owner: the pipeline agent owns `P` and its merge check, the
  site agent owns `S` and its merge check. Anyone may add to `H`. Do not edit another owner's section.
- An entry must be specific enough that an agent with no memory of the run can finish it: name the branch,
  commits, files and `work/` paths; say what already exists and what does not.
- When an item is finished, move it to "Done" at the bottom with the PR or commit. Do not delete it.
- Link to the reports for the story; do not copy it here.

## Entry template

```markdown
### P0 Short title
- **State:** not started | partial | blocked. What exists right now (commits, branch, files, runs in `work/`).
- **Where:** branch, paths, report section.
- **Left to do:** numbered concrete steps.
- **Done when:** a check anyone can run (command and expected result).
- **Effort:** agent hours; whether it needs Docling or long CPU time; whether it can run beside other work.
- **Needs from a human:** a decision or file, or "nothing".
- **Traps:** what went wrong or nearly did last time (link `AGENTS.md` section 7 entries).
```

## Pipeline (P)

Owner: the pipeline agent. Written 2026-10-12 after the merge of PR #1, from the run report
(`docs/reports/2026-10-12-continuation-report.md`) and the state of the branches and of `work/` at that time.

Read this first:

- `work/` is git-ignored and exists only on Ali's machine. The paths below are relative to the repo root there. If
  `work/` is gone, every run named here can be made again with `datalab extract` (it costs CPU time, nothing else).
- Each parallel track had its own git worktree under `../datalab-worktrees/<name>` and its own work folder
  `work/tracks/<name>` (set as `WORK_DIR` in that worktree's `.env`). Scratch scripts in a worktree need
  `PYTHONPATH=.` from its `pipeline/` folder, or the venv imports the main checkout (`AGENTS.md` section 7).
- Never more than two Docling extractions at once on this machine; runs inside one item are strictly one after another.
- Every item that changes data ends the same way: `datalab build --dataset <type>`, `datalab release`,
  `datalab check-release releases/v0.0.1-prototype`, `python -m pytest` in `pipeline/`, and in `site/`
  `npm run build`, `npm run lint`, `node scripts/check-build.mjs`. The release is rebuilt in place (D29) until the first
  deployment or DOI.
- The status rule is strict: any failed check withholds every figure in it. Do not tune a tolerance, a pattern or a
  dictionary entry to make a check pass. If adding data pushes a data type below a frozen threshold or above the
  5% disputed guard (D26), stop and ask Ali.

### Recommended order, and what can run in parallel

1. **P6** first (documents only, no CPU): it removes stale numbers and stale "current run" pointers from `main`.
2. **P1** next: most of it exists, and it is the largest gain in years covered. Three Docling runs of about 15 to 30 minutes each.
3. **P2** and **P3** are long Docling queues. They can run beside each other (one extraction each, two in all) and
   beside any item that needs no Docling. P2 changes CPI only and P3 changes LFS provenance only, so they do not conflict.
4. **P10**, **P13** and **P9** need no Docling and touch shared code (`checks.py`, `status.py`, `normalise.py`,
   `release.py`, `schema.py`). Do them one at a time, not beside P1 or P2 merges, and rebuild the release after each.
5. **P11** and **P12** (more ABS and LFS depth) after P1, because P1 changes the same ABS spec files.
6. **P7** (gold sample and spot-check sheet) once P1, P2, P10 and P13 are merged, because each of them changes the set
   of published values. If Ali wants a measured error rate sooner, P7 can be done now on the current release and
   redone later; that is his call (H9).
7. **P4** (reproduction from a clean clone) after P7, on a quiet machine: it needs about three hours of CPU and is
   only worth running once the data set has stopped moving.
8. **P5** (Economic Survey tables) last: new document type, the riskiest layouts.
9. **P8**, **P14**, **P15** are small and can be done whenever; P8 is blocked on a human decision.

### P1 E1: eight more ABS editions (2012-13 to 2015-16, 2018-19 to 2020-21, 2023-24)
- **State:** partial. Branch `proto/v0-e1-abs-editions` at `639aa32`, four commits ahead of `main`, pushed, clean
  worktree at `../datalab-worktrees/e1-abs-editions`. It was cut from `9a4736b`, before the receipts side (E2), the LFS
  depth work (E3) and the tools were merged, so it must take `main` in before anything else.
  - Registered and verified (commit `88702ed`): all eight files, in `sources/plan.yaml`, `sources/manifest.csv` and
    `sources/verification/abs-fed-<FY>.json` on the branch. Seven are `official_match_archive`; 2015-16 was accepted on
    the second identity route (contents markers plus the link from the official budget page; see its verification
    record). The PDFs are in `SOURCES_DIR/abs/`.
  - Validated Docling runs in `work/tracks/e1-abs-editions/runs/`: `ABS_2012-13__docling__full-document__run-01`,
    `ABS_2013-14__…__run-01`, `ABS_2014-15__…__run-01`, `ABS_2015-16__…__run-01`, `ABS_2018-19__…__run-01`.
  - `ABS_2019-20__docling__full-document__run-01` was interrupted (manifest says `validated: false`). It is a recorded
    failed run; do not reuse or overwrite it. No run exists for 2020-21 or 2023-24.
  - A partial build is in `work/tracks/e1-abs-editions/datasets/abs/` (built 2026-10-11 05:40 PKT, without the receipts
    side): the Summary of Expenditure is located in all five extracted editions with coverage 100%, no flags, no
    unmapped labels. Whole ABS on that build: 3,347 published, 3 disputed; checks 2,920 pass, 33 fail, 148 could not be
    run; cross-edition 1,055 agree, 3 fail, 3 disputed. These numbers are a snapshot of unfinished work, not a result.
  - Three label and structure fixes for the detail tables are committed (`61f35a3`, `44c6ddf`, `639aa32`).
  - Not done: the three remaining runs; the receipts side for the new editions (the receipts code was not on the
    branch); viewing the overlays; the gate check; the track note `docs/reports/track_e1_abs_editions.md` (never
    written; working notes are in `work/tracks/e1-abs-editions/logs/e1_report.md`, `e1_runs.log`, `baseline_9.md`,
    `gate_baseline_9.json`); new traps in `AGENTS.md`.
- **Where:** the branch and worktree above; `specs/abs.yaml`, `specs/abs_labels.yaml`, `specs/abs_detail*.yaml`,
  `specs/abs_receipts*.yaml`; `pipeline/datalab/datasets/abs.py`, `abs_detail.py`, `abs_receipts.py`; plan section 6
  item E1 in `docs/plans/2026-10-12-continuation.md`.
- **Left to do:**
  1. In the worktree: `git merge origin/main`. Expect conflicts in `AGENTS.md` section 7 (both sides appended traps:
     keep both) and possibly `pipeline/datalab/datasets/abs.py`; `sources/manifest.csv` should merge cleanly (main did
     not add ABS rows). Run the suite.
  2. `python -m datalab verify` (re-hash the eight files against the manifest).
  3. One at a time: `python -m datalab extract --source abs-fed-2019-20` (this makes `run-02`), then
     `abs-fed-2020-21`, then `abs-fed-2023-24`; `python -m datalab validate --source <id>` after each.
  4. `python -m datalab build --dataset abs`. For each of the eight editions open the validation overlay of the summary
     table (`<WORK_DIR>/qa/overlay_<source>_p<NNN>.png`) and look at it before trusting the mapping. Do the same for
     one receipts table and one detail table per layout family (2012 to 2015, 2018 to 2020, 2023).
  5. Work through unmapped labels, column problems and failed checks edition by edition. The receipts spec says a new
     edition with a matching layout needs no change; confirm that by the checks, not by assumption. A mapping that a
     sum contradicts is removed.
  6. Check the gate: `datalab.release.gate_dataset("abs", coverage, checks)` on the built dataset. Expect many new
     cross-edition pairs (every year from 2009-10 to 2026-27 now has two printings) and therefore new disputes; the
     5% guard applies.
  7. Write `docs/reports/track_e1_abs_editions.md` (per edition: where the file came from, run id, pages, coverage,
     checks by type, cross-edition result, published by tier, withheld by reason; every failing or disputed check with
     both printed values and pages). Add traps to `AGENTS.md` section 7.
  8. Copy the eight new run folders into `work/runs/`, merge into a branch off `main`, rebuild the release, run the
     common end steps, open a PR.
- **Done when:** `sources/manifest.csv` on `main` has 17 `abs-fed-*` rows; `release.json` lists 17 ABS sources in
  `scope.sources`; `datalab check-release releases/v0.0.1-prototype` prints `ok`;
  `dataset_status.abs.state` is `published` with empty `reasons`; the track note exists; CI is green.
- **Effort:** about 2 to 3 agent hours. Docling: three runs, about 15 to 30 minutes each on this machine when nothing
  else is extracting. Can run beside P2 or P3 (two extractions at most in total), not beside P11.
- **Needs from a human:** nothing to start. A decision only if the gate fails or the disputed share nears 5%.
- **Traps:** layouts drift around 2012 to 2015 (labels, part headings); locate by the ten function names, never by page.
  2015-16 has no readable cover (same as 2010-11 and 2017-18). "Less Recoveries" lines make blocks fail (see P11).
  `AGENTS.md` section 7: Docling glues wrapped headings onto the next row; column headers are read from the text layer.

### P2 E4: monthly CPI, not just June (decision D35)
- **State:** partial, early. Branch `proto/v0-e4-cpi-monthly` at `69b03f7`, one commit ahead of `main`, pushed. The
  worktree `../datalab-worktrees/e4-cpi-monthly` has **uncommitted** work: `sources/manifest.csv` modified and nine
  untracked verification records (`sources/verification/cpi-pbs-2020-09.json` to `cpi-pbs-2021-05.json`).
  - `sources/plan.yaml` on the branch declares 84 `cpi-pbs-*` issues (8 were already on `main`).
  - Registered so far (manifest in the worktree): 63 issues, 38 `official_only` and 25 `wayback_only`. Months held:
    2016-06, 2018-06, 2019-06, 2020-09 to 2022-05, 2023-03 to 2025-08, 2026-01 to 2026-09. The committed manifest has
    54 of these; the last 9 are the uncommitted ones.
  - Declared but not yet registered: 21 issues. Whether each was tried and refused or simply not reached is not
    recorded; re-running `register` settles it.
  - Not in the plan at all: 2019-08 to 2020-08, 2022-06 to 2023-02, 2025-09 to 2025-12, and the 2007-08 base before
    2019-06 other than the three June issues. No discovery table was written, so it is not known which of these were
    looked for and not found.
  - The commit also changes registration so that an issue is identified by a pattern on its cover line, not by a month
    name, and adds five lines to `specs/cpi.yaml`.
  - No Docling run was started. `work/tracks/e4-cpi-monthly/runs/` holds only copies of the runs already on `main`.
  - The downloaded PDFs are in `SOURCES_DIR/cpi_monthly_review/` (70 folders).
  - No track note exists.
- **Where:** the branch and worktree above; `sources/plan.yaml`; `pipeline/datalab/sources.py`;
  `pipeline/datalab/datasets/cpi.py`; `specs/cpi.yaml`; `specs/cpi_basket_weights.yaml` (generated);
  `pipeline/scripts/gen_basket_weights.py`; plan section 6 item E4.
- **Left to do:**
  1. In the worktree: look at `git diff sources/manifest.csv`, then commit the manifest and the nine verification
     records. `git merge origin/main` (expect `AGENTS.md` and possibly `sources/manifest.csv` conflicts; main added no
     CPI rows). Run the suite.
  2. `python -m datalab register` for the declared issues that have no manifest row; record for each whether it
     registered, and if not, why. Then `python -m datalab verify`.
  3. Write the discovery table month by month from 2019-08 to the latest issue, then the 2007-08 base backwards:
     official address found, Wayback snapshot found, obtainable. Routes: the PBS price statistics pages, the
     `wp-content/uploads` naming seen in the manifest, and the Wayback CDX index by URL prefix. A file is accepted by
     what its own text says (month, year, base), never by its file name.
  4. Extract newest to oldest on the 2015-16 base, one run at a time (`datalab extract --source <id>`, then
     `validate`). About 3 to 8 minutes per issue (12 to 18 pages).
  5. After every six issues or so: `datalab build --dataset cpi`; `python scripts/gen_basket_weights.py`; build again;
     check `gate_dataset`; commit and push. Tables flagged `merged_rows` or `dropped_column` go to the second reader
     automatically (D28).
  6. Count cross-issue pairs honestly at every batch: agree, one unit apart, disputed, fail. PBS reprints indices with
     small revisions (2 of the first 13 pairs on the old base were disputed). **If disputed pairs approach 5% of pairs,
     or agreement falls under 98%, stop adding issues**, leave the later ones registered and extracted but excluded
     through a documented list in the spec, and ask Ali.
  7. View one overlay per distinct layout (2019 to 2020 issues may print columns differently from 2021 onwards).
  8. Write `docs/reports/track_e4_cpi_monthly.md`; add traps to `AGENTS.md`; copy run folders to `work/runs/`; merge
     through a PR; rebuild the release; common end steps.
- **Done when:** the track note states, month by month, obtainable or not and from where; `release.json` lists the
  processed issues; the national general index (`cpi.national.general.b2015_16`) has a published or disputed value for
  every month the note calls obtainable; `dataset_status.cpi.state` is `published`; `check-release` prints `ok`; CI green.
- **Effort:** the longest item. About 4 to 6 hours of Docling time for 55 to 75 issues, run in the background, plus 2
  to 3 agent hours. Can run beside P1 or P3 (two extractions in all) and beside anything that needs no Docling.
- **Needs from a human:** nothing to start. A decision if the disputed share approaches the guard (step 6), which is
  likely enough that Ali should expect the question. Network access to pbs.gov.pk and web.archive.org.
- **Traps:** a % change column's header month is the comparison month; the month is printed three ways; chart pages
  are images, not scans; Wayback rate limits (2 seconds between requests, back off on 429); the availability API
  returns nothing, use CDX (`AGENTS.md` section 7). The site grows by about four pages per published value: the
  build was 7,278 pages and 4 minutes before this item.

### P3 C8: full-document Docling runs for the three long LFS reports
- **State:** partial. One of three done.
  - 2024-25 (205 pages): `work/tracks/c8/runs/LFS_2024-25__docling__full-document__run-01`, validated. Compared with the
    page-range runs on 2026-10-11: all 629 Docling cells the release takes from this report (540 mapped, 89 unmapped)
    have the same text at the same box. Command used:
    `PYTHONPATH=. python scripts/compare_full_document_run.py ../releases/v0.0.1-prototype lfs-pbs-2024-25 <run>/raw/output.json`.
  - 2020-21 (230 pages): `work/tracks/c8/runs/LFS_2020-21__docling__full-document__run-01` was interrupted (`raw/` is
    empty, `validated: false`). A recorded failed run; the next attempt is `run-02`.
  - 2018-19 (408 pages): not started.
  - The release still uses the page-range runs (`LFS_2018-19__docling__page-range__run-01`,
    `LFS_2020-21__docling__page-range__run-01`, `LFS_2024-25__docling__page-range__run-01` and `run-02`).
- **Where:** `work/tracks/c8/` (its own `WORK_DIR`, so the main build does not pick these runs up by accident);
  `pipeline/scripts/compare_full_document_run.py`; `pipeline/datalab/datasets/lfs.py::tables_for_source` (each page
  comes from the newest validated run that holds it); decision D18; plan step C8.
- **Left to do:**
  1. With `WORK_DIR` set to `work/tracks/c8`: `python -m datalab extract --source lfs-pbs-2020-21`, then `validate`;
     then the same for `lfs-pbs-2018-19`. One at a time.
  2. Run the compare script for each against the release. Record per report: cells compared, same text at the same
     box, different text, no cell at the same box.
  3. If all three match on every mapped cell: copy the three full-document run folders into `work/runs/`, rebuild LFS
     and the release, and confirm with `python -m datalab diff-release <copy of the release before> releases/v0.0.1-prototype`
     that only run ids (and the expected differences it lists) changed. Then the release's provenance points at
     full-document runs and D18's follow-up is closed.
  4. If any mapped cell differs: keep the page-range runs, do not copy anything, and list every difference with page
     and both texts in the report. That is a finding about Docling, not something to fix by choosing a winner.
  5. Note the result in `STATUS.md` and `DECISIONS.md` (D18).
- **Done when:** either `releases/v0.0.1-prototype/runs/` holds no `page-range` manifest for LFS and `check-release`
  prints `ok`, or the report lists the differences and says the page-range runs are kept.
- **Effort:** about 1 agent hour. Docling: about 1 hour for 2020-21 and 1.5 to 2 hours for 2018-19 when the machine is
  otherwise idle (measured 10 to 15 seconds per page with three jobs running). Runs in the background beside P1 or P2.
- **Needs from a human:** nothing.
- **Traps:** do not run these in the main `work/` before the comparison; `tables_for_source` would start using them at
  once. The second reader reads two 2024-25 tables (pp. 57 and 71); the compare script covers Docling cells only.

### P4 E5: reproduction from a clean clone
- **State:** not run. The tools are on `main`: `python -m datalab diff-release A B` (tested; the committed release
  diffed against itself is clean) and `pipeline/scripts/reproduce.ps1` (written, parsed, never executed).
- **Where:** `pipeline/scripts/reproduce.ps1` (read its header first); `pipeline/datalab/diff_release.py` (see
  `docs/reports/track_e_tools.md` section 4 for what counts as a difference); decision D36 in the plan.
- **Left to do:**
  1. Do P6 first, and ideally P1 to P3, so the thing reproduced is the thing that will be deployed.
  2. On a quiet machine: `powershell -File pipeline\scripts\reproduce.ps1 -ScratchDir <folder outside the repo> -Version v0.0.1-prototype -SbpCsv <SOURCES_DIR>\sbp_easydata\2026-10-10\data_series.csv`.
     Without `-SbpCsv` the CPI against SBP checks are skipped and the diff fails for that reason alone.
  3. Exit code 0: same data. 1: read the differences `diff-release` prints and find the cause of each (a
     nondeterministic step is a bug to fix; a file that could not be fetched is a source problem to record).
     2: a step could not be carried out (usually a Wayback-only CPI file under rate limits); retry later.
  4. Write the result into `docs/reports/` and into `releases/v0.0.1-prototype/HOW_TO_REPRODUCE.md` (through
     `pipeline/datalab/release_docs.py`, never by hand).
- **Done when:** the script exits 0 and the report says so with the commit it ran on; or every difference is listed
  with its cause.
- **Effort:** about 3 hours of CPU with nothing else extracting (more after P1 and P2 add documents), half an agent
  hour to start and read it. It writes new run ids in its own scratch folder and never touches the repo's `work/`.
- **Needs from a human:** nothing, unless the SBP file has to be re-obtained (H7).
- **Traps:** `config` reads environment variables before `.env`; the script sets `SOURCES_DIR` and `WORK_DIR` itself.
  The three long LFS reports are reproduced as page-range runs read from the release's own run manifests, so after
  P3 switches provenance the script's run list changes with it.

### P5 E9: first tables from the Pakistan Economic Survey
- **State:** not started. Two chapters of the 2024-25 survey are already registered and extracted as cross-source
  files (`pes-fed-2024-25-inflation`, `pes-fed-2024-25-labour`; runs `PES_2024-25__docling__full-document__run-01`
  and `run-02`), used only to cross-check LFS. No `pes` data type, spec or builder exists.
- **Where:** plan section 6 item E9 and decision D37; `pipeline/datalab/datasets/cross_source.py` (how a survey table
  is located by title and read today); `docs/reports/track_sources.md`.
- **Left to do:**
  1. Register and verify the complete 2024-25 and 2025-26 volumes or their fiscal and growth chapters (official
     addresses on finance.gov.pk; archive copies in ra-ship; plan 1 section 6.1).
  2. Page-range runs per D18 for the fiscal chapter and the growth chapter.
  3. New data type `pes`: `specs/pes.yaml`, `specs/pes_labels.yaml`, `pipeline/datalab/datasets/pes.py` ending in
     `common.save_dataset`; add `"pes"` to the `Dataset` literal and to `release.py` (additive).
  4. Consolidated fiscal operations summary: series `fed.fiscal.*`; check revenue minus expenditure equals deficit;
     cross-source against ABS totals only where the concept, year and kind of figure are the same.
  5. GDP growth table: series `na.gdp.*`; recompute growth from levels where both are printed; vintage from the column
     headers (`provisional`, `revised`, `final`).
  6. Overlays viewed, checks, gate, track note, tests, PR.
- **Done when:** `release.json` has a `pes` entry in `dataset_status` (published, or "coming" with the reasons),
  `check-release` prints `ok`, and the track note lists what was located and what was not.
- **Effort:** 4 to 6 agent hours; about 1 hour of Docling. Time-box it: the plan says stop at the box and document.
- **Needs from a human:** nothing to start; the series definitions will need review like all the others.
- **Traps:** `AGENTS.md` section 7: PES 2025-26 p.135 is an unresolved sign or column question; do not pick a winner.
  Data grids under charts are tables and should be extracted; chart marks are never read. Survey tables mix fiscal-year
  totals and July to March figures; a part-year figure is a different concept.

### P6 Final handoff of the continuation run (documents only)
- **State:** not done. The run stopped at interim handoff 2. `STATUS.md` was brought up to date at the merge;
  these were not: `README.md` (line 7 and the table from line 55 still say 535 budget values, 884 CPI values and LFS
  unpublished); `AGENTS.md` section 11 "Current focus" (same first-run state) and section 9 "Current authorised run"
  (still names the continuation plan as running); `CLAUDE.md` (same pointer); `docs/reports/PR_BODY.md` (describes PR #1
  as of the first run); the continuation report has no "morning checklist v2", no "For Ahmad" reading order, no
  paragraph for sir and no ClickUp text; the first report does not link to the continuation report;
  `releases/v0.0.1-prototype/dataset_card.md` "Known limitations" still describes the first run (it is generated by
  `pipeline/datalab/release_docs.py`; the text lives there).
- **Where:** the files named above; plan section 5 (morning checklist v2) and section 2 item 4.
- **Left to do:**
  1. `README.md`: status paragraph and the data table from `releases/v0.0.1-prototype/release.json`.
  2. `AGENTS.md` section 11 rewritten for the current state; section 9 and `CLAUDE.md`: no run is authorised now.
  3. Continuation report: closing section with the final numbers, morning checklist v2 (plan section 5), reading
     order for Ahmad, an updated paragraph for sir with every figure cited to a receipt path, ClickUp text, and the
     final backlog ledger pointing here. Link it from the first report.
  4. `release_docs.py`: bring "Known limitations" in line with what the release now holds (detail tables, receipts,
     second reader, provinces, 19th ICLS, disputed), then rebuild the release so the card is regenerated.
  5. The release on `main` was built at commit `9e674a3`, before the tools branch (a normaliser fix and a change to
     `datalab all`) was merged. The tools track showed that every stored text parses the same before and after. Confirm
     it: keep a copy of the release, rebuild, and run `python -m datalab diff-release <copy> releases/v0.0.1-prototype`;
     expect no data differences.
  6. `STATUS.md`: drop "Queued follow-ups" in favour of a pointer to this file, so there is one list.
  7. `AGENTS.md` section 7 has entries the run itself superseded, left in when branches were merged: the June 2021
     CPI trap appears twice (one copy says everything from those tables is withheld; the second reader now reads
     them); "only 13th ICLS tables are mapped" and "June 2019 ... everything is withheld" are no longer true;
     the rule credited to `abs_detail.withhold_where_a_check_failed` now lives in `status.decide_tier`; the
     scratch-script trap appears twice. Correct them in place; do not delete the lesson.
- **Done when:** `grep -n "535\|884" README.md AGENTS.md` finds nothing; `diff-release` reports no data differences;
  CI green.
- **Effort:** about 1 agent hour. No Docling. A release rebuild takes a few minutes. Do it before anything else.
- **Needs from a human:** nothing. The ClickUp comment has to be posted by a human (H8).
- **Traps:** never hand-edit files under `releases/`; every figure quoted for sir is read from the release by a script.

### P7 Redraw the gold sample and the spot-check sheet
- **State:** stale. `gold/sample.csv`, `gold/sample.js`, `gold/sample_meta.json` (398 cells) and
  `docs/reports/spot_check.md` (30 values) were drawn from the first run's release (1,419 published values; ABS and
  CPI only). The release now publishes 5,490 values in three data types. No label file exists in `gold/`, so nothing a
  human did is lost by redrawing. `gold/README.md` step 7 describes the old, shorter output of `gold-score`.
- **Where:** `pipeline/datalab/gold.py` (`datalab gold-sample --n 400 --seed <seed> --version v0.0.1-prototype`,
  `datalab gold-score`); `work/make_spot_check.py` (local scratch; move it to `pipeline/scripts/` when redoing it).
- **Left to do:**
  1. Check `gold/` holds no `labels_*.csv`. If it does, stop: never overwrite a human's labels.
  2. `python -m datalab gold-sample`; check the sample covers all three data types, both readers (Docling and
     pdfplumber) and includes disputed and withheld cells, since those are where errors would hide; say in
     `gold/sample_meta.json` and in the report that it was redrawn and why.
  3. Redraw the spot-check sheet: 10 per data type, and add one disputed and one second-reader value (plan section 5
     item 5). Commit the script under `pipeline/scripts/`.
  4. Update `gold/README.md` step 7 to the reworked `gold-score` output (two labellers needed; agreement and kappa).
- **Done when:** `gold/sample_meta.json` names the release's `created_at` it was drawn from; the labelling page
  `gold/label.html` opens and shows crops for all three data types; `spot_check.md` lists receipts that exist in the
  release.
- **Effort:** half an agent hour. No Docling. Best done after P1, P2, P10 and P13 (see the order above).
- **Needs from a human:** H9 (label now on the current release, or wait); then H2 (the labelling itself).
- **Traps:** an LLM never labels the gold set (`AGENTS.md` section 4). The sample must stay blind: the labelling page
  must not show the extracted value.

### P8 Regression fixtures cut from real extraction output
- **State:** blocked on a decision. Named in the plan's E10 line; not built. Today every test uses synthetic input
  (cells built in the test, or PDFs drawn with PyMuPDF), so no test would notice if a Docling upgrade changed how a
  real page is read.
- **Where:** `pipeline/tests/`; run output in `work/runs/<run_id>/raw/output.json`; `AGENTS.md` section 8 ("tiny test
  fixtures need explicit sign-off").
- **Left to do:** once H10 is answered: cut the table objects for a handful of hard pages (ABS 2025-26 summary with the
  glued headings; the June 2021 CPI urban table Docling misread; LFS 2024-25 p.76 with both ICLS definitions; one
  receipts page) into `pipeline/tests/fixtures/`, a few kilobytes each; add tests that run the builders' locate and
  map steps on them and compare with the cells in the release.
- **Done when:** the new tests pass in CI without Docling and fail if a fixture's mapped values are changed.
- **Effort:** 1 to 2 agent hours. No Docling.
- **Needs from a human:** H10.
- **Traps:** an excerpt of Docling JSON is derived data, not a source file, but it is still a copy of part of a
  government document; that is why it needs sign-off.

### P9 Fields the site asked for
- **State:** one of five done (`Cell.page_label`). Open requests, from `STATUS.md` "Requests for the pipeline":
  (a) the table title as printed, per cell; (b) the threshold values copied into `release.json`, so the release is
  self-contained; (c) `verification.inspection.pdf_metadata` holds double-encoded text ("MicrosoftÂ® Excel");
  (d) a publication date per source.
- **Where:** `pipeline/datalab/schema.py`, `release.py`, `sources.py` (`inspect_pdf`), the builders; `docs/SCHEMA.md`.
- **Left to do:**
  1. (a) `Cell.table_title_raw` (optional). CPI and LFS builders already hold the caption they located the table by;
     pass it through `common.make_cell`. ABS tables are located by content: read the title from the text-layer lines
     directly above the table box and store it only if a line is found, else null.
  2. (b) Add `thresholds` (the parsed `thresholds/thresholds.yaml`) to `release.json` beside `thresholds_sha256`;
     `check-release` compares the copy with the file.
  3. (c) Find where the metadata strings are decoded in `inspect_pdf` and fix the decoding; re-running `register` rewrites
     verification records, so check that nothing else in them changes.
  4. (d) Leave out unless a human supplies dates (H11): nothing the pipeline reads establishes a publication date.
  5. All additive; document each in `docs/SCHEMA.md`; rebuild the release; tell the site agent in `STATUS.md`.
- **Done when:** `cells.json` has `table_title_raw` on every CPI and LFS cell; `release.json` has `thresholds`;
  `grep -c "Â" releases/v0.0.1-prototype/sources.json` is 0; `check-release` prints `ok`.
- **Effort:** 2 agent hours. No Docling. Touches shared files: not beside P10 or P13.
- **Needs from a human:** nothing for (a) to (c).
- **Traps:** keep every schema change additive; the site reads these files at build time.

### P10 Sums credit figures smaller than their own rounding allowance
- **State:** not started. Found by the sanity report, not by a review. A sum check passes "within rounding" when the
  difference is at most half a unit per item. A member smaller than that allowance could be anything and the sum would
  still pass, yet the member is credited as checked. Real case: ABS 2021-22 p.20 prints `0.4`, `0.2` and `0.3` for
  "081 Recreational and Sporting Services" in a table of whole millions; the first two are published at tier B on the
  strength of a five-item sum whose allowance is 2.5. (The page does print those figures; the lead looked. The weakness
  is in the evidence, not in the reading.) Same idea as review finding CPI-2, which was fixed for the CPI weighted
  average only.
- **Where:** `pipeline/datalab/checks.py::sum_check`, `pipeline/datalab/status.py::credits`,
  `pipeline/datalab/schema.py` (`Check.credits_members`, `TARGET_ONLY_CHECKS`); `docs/reports/sanity_2026-10-11.md`.
- **Left to do:**
  1. Decide the rule with Ali (H12). Proposal: a passed sum is evidence for a member only if the member's absolute value
     is larger than the sum's allowance; smaller members stay in the check record but earn nothing from it.
  2. Implement it where status is decided (per member, so `check-release` recomputes it), with tests.
  3. Add to `datalab sanity` a section for decimals in a column of whole numbers.
  4. Rebuild; report how many published values lose their only evidence, by data type, before merging.
- **Done when:** a test shows a member smaller than the allowance is not published on the sum alone; the report states
  the count of values withheld by the change.
- **Effort:** 2 agent hours. No Docling. Shared files: one at a time with P9 and P13.
- **Needs from a human:** H12.
- **Traps:** this changes what "checked" means, like the other status-rule changes of this run; it is a decision, not a
  bug fix.

### P11 ABS detail tables: flagged tables and "Less Recoveries" lines
- **State:** not started. From `docs/reports/track_abs_detail.md`:
  - Seven detail tables are flagged and publish nothing: `merged_rows` on 2010-11 p.10, 2011-12 p.16, 2024-25 pp.22
    and 24; four value columns where three are expected on 2016-17 p.19, 2017-18 p.12, 2021-22 p.18. Two more are below
    90% coverage (2017-18 p.12 at 89.1%, 2022-23 p.16 at 88.5%). The second reader is not routed to ABS tables.
  - "Less Recoveries" lines are not modelled, so the blocks that contain them fail their sums and are withheld
    (2010-11 and 2011-12 Economic Affairs part d; 2016-17 and 2017-18 Health PSDP).
  - 2016-17 p.13: sub-function 011's label could not be read, so General Public Service part a fails.
  - 2022-23 p.21: Education part c prints 48,327 against sub-functions adding to 46,541; cause not established.
  - 200 detail figures have no check at all (tier C) and 216 are withheld for failed checks.
- **Where:** `pipeline/datalab/datasets/abs_detail.py`, `specs/abs_detail.yaml`, `specs/abs_detail_labels.yaml`,
  `pipeline/datalab/datasets/common.py::try_second_reader`, `pipeline/datalab/second_reader.py`.
- **Left to do:**
  1. Route the flagged detail tables to the second reader through the generic hook (as `cpi.py` does); promotion only
     if every sum of the table passes on the second reading.
  2. Look at the overlays of the pages with "Less Recoveries" in each edition and write down at which level the line
     sits. Model it as a signed member only where the label and level are unambiguous; otherwise leave the block
     withheld and say so.
  3. Open the page render for 2016-17 p.13 and 2022-23 p.21 and record what the page prints; do not fix by guessing.
- **Done when:** the track note is updated with, per flagged table, promoted or not and why; the count of ABS values
  withheld for failed checks is reported before and after.
- **Effort:** 3 agent hours. No Docling. After P1 (same spec files).
- **Needs from a human:** possibly a call on how to model "Less Recoveries" (H1 covers the general question).
- **Traps:** both tools read the same text layer: the second reader corrects structure, not digits.

### P12 LFS: figures located but not published
- **State:** not started. From `docs/reports/track_e3_lfs_depth.md` and `fix_lfs.md`:
  - The 19th ICLS unemployment rate for 2024-25 (the headline PBS leads with) is not published: table 9.2 on p.144
    prints no unit in its title, so the spec's rule maps nothing (`scale_not_confirmed`).
  - Provincial unemployment rates are not mapped: earlier rounds print the rate for Pakistan only, and in 2024-25 the
    provincial blocks are on p.146 in a continuation of table 9.3 that has no title of its own.
  - 20 national unemployment rates are withheld because the printed counts are too coarse to single out the rate
    (review finding LFS-1), among them the 2018-19 headline rate (6.9).
  - 288 LFS figures have no check (participation rates printed once: 2013-14, 2024-25 and the 19th ICLS ones).
  - The "key indicators" layout of LFS 2020-21 is not processed (it would add a second printing of several rates).
- **Where:** `pipeline/datalab/datasets/lfs.py`, `specs/lfs.yaml`; `pipeline/datalab/datasets/cross_source.py`.
- **Left to do:**
  1. With H13 answered: allow a table whose title says "rate" and whose header or body prints "(%)" to be taken as
     percent, only where that text is found on the page.
  2. A continuation table (no title, same columns, directly following a located table across a page break) may be
     attached to the table it continues; write the rule, test it on a generated PDF, apply it to 2024-25 p.146.
  3. Look for a second printing of the withheld rates: the Economic Survey labour chapter already supplies some; the
     2020-21 key indicators table and the next survey edition are the other candidates.
- **Done when:** the track note lists, for each of the four groups above, published now or still withheld and why.
- **Effort:** 3 agent hours. No Docling unless the 2020-21 key indicators pages lie outside the existing page ranges
  (P3 would cover that).
- **Needs from a human:** H13.
- **Traps:** 13th and 19th ICLS series are never joined or paired; bare "Rural" and "Urban" rows mean something only
  inside their block (`AGENTS.md` section 7).

### P13 The coverage tokeniser hides a year glued to a negative number
- **State:** not started. The property tests found that `parse_printed("2015 -16.3")` read the text as the fiscal-year
  label 2015-16 followed by ".3". That is fixed for values (the cell is now flagged as merged and gives no value).
  `normalise.numeric_tokens`, which the coverage count uses, still masks such a pair as a fiscal-year label, so one
  printed number would be missing from both sides of the coverage ratio. It was left alone on purpose because coverage
  feeds a frozen threshold.
- **Where:** `pipeline/datalab/normalise.py::numeric_tokens`; `pipeline/datalab/validate.py::table_coverage`;
  `docs/reports/track_e_tools.md` section 5.
- **Left to do:** fix the masking so a negative number after a year is counted; rebuild all three data types; report
  every table whose coverage changes (expected: none, since no such text exists in the released cells); record the
  change in `DECISIONS.md` as a correction to the measure, not to the threshold.
- **Done when:** a test covers the case and the coverage table in `dataset_card.md` is unchanged, or every change is listed.
- **Effort:** 1 agent hour. No Docling. Shared file: one at a time with P9 and P10.
- **Needs from a human:** nothing.
- **Traps:** a change to a measure after results exist is a recorded deviation if any number moves.

### P14 Triage the reviewers' unproven suspicions
- **State:** not started. The two reviews listed suspicions they could not demonstrate with a failing test:
  ten for CPI (`docs/reports/review_cpi.md`, "Unproven") and ten for LFS (`docs/reports/review_lfs.md`); LFS items 5
  and 6 were fixed, the rest were not acted on. The ones most worth a test: a value cell that spans two rows or columns
  is credited to its first; `common.make_cell` falls back to the whole table box when a cell has no box;
  `text_layer_row_label` could pick a neighbouring line's label for a tall value box; coverage is measured inside
  Docling's own table box, so a truncated table still reports 100%; a last-digit misread of a CPI index is invisible
  to recomputation (only the tier A values have a check that could see it); `lfs.build` relies on `extract.py` to
  refuse a failed source. Also: `info.detail_tables` pass rates in `abs.py` are computed before disputes are
  classified (a reporting detail; the gate uses the right numbers).
- **Where:** the two review notes; `pipeline/tests/test_review_cpi.py`, `test_review_lfs.py`.
- **Left to do:** for each item, write the failing test or write down why it cannot fail; fix what fails; the rule
  stays "a finding is not a bug until a failing test shows it".
- **Done when:** each of the 18 open items has a test or a written reason in the review note.
- **Effort:** 3 to 4 agent hours; a fresh reviewing agent is better than the one that wrote the code. No Docling.
- **Needs from a human:** nothing.
- **Traps:** the last-digit question is exactly what the gold set measures; do not try to answer it with more code.

### P15 Housekeeping
- **State:** not started.
  - Five worktrees remain under `../datalab-worktrees/`: `e-tools`, `e2-abs-receipts`, `e3-lfs-depth` (merged; can be
    removed) and `e1-abs-editions`, `e4-cpi-monthly` (in use by P1 and P2; e4 has uncommitted work).
  - Remote branches fully contained in `main` and no longer needed: `proto/v0`, `proto/v0-ui`, `proto/v0-site`,
    `proto/v0-cpi`, `proto/v0-lfs`, `proto/v0-review-cpi`, `proto/v0-review-lfs`, `proto/v0-second-reader`,
    `proto/v0-abs-detail`, `proto/v0-old-base-cpi`, `proto/v0-sources`, `proto/v0-fix-lfs`,
    `proto/v0-e2-abs-receipts`, `proto/v0-e3-lfs-depth`, `proto/v0-e-tools`.
  - `work/` is 1.5 GB; `work/tracks/<name>/runs` are copies of `work/runs` plus each track's own new runs.
  - The Wayback save for ABS 2026-27 failed in the first run (HTTP 520); it is the only ABS file without a snapshot.
    `datalab watch --save-to-wayback` exists and has never made a real request.
  - Scratch scripts from the run live in `work/` (`p*.py`, `docs*.py`); nothing in them is needed again.
- **Where:** as listed.
- **Left to do:** remove the three merged worktrees (`git worktree remove`); delete the merged remote branches once Ali
  agrees (H14); after P1 and P2 are merged, remove their worktrees and delete `work/tracks/`; retry the Wayback save for
  ABS 2026-27 once (`datalab register --source abs-fed-2026-27` without `--no-wayback-save`) and record the result.
- **Done when:** `git worktree list` shows only the working checkouts; `git branch -r` shows `main` and branches with
  open work.
- **Effort:** a quarter of an agent hour. No Docling.
- **Needs from a human:** H14.
- **Traps:** before deleting anything under `work/tracks/`, copy new run folders to `work/runs/` (P1, P3); a run that
  is deleted has to be extracted again.

## Site (S)

Owner: the site agent. All site work so far is in `main` (PR #1, `bebff67`); the overnight branch was `proto/v0-ui`
(last site commit `23e670a`). Start any S item from a new branch off `main`. Story: `docs/reports/2026-10-12-ui-report.md`.
Design rules: `docs/DESIGN.md`. Plan the site was built to: `docs/plans/2026-10-12-ui.md` (sections 4 to 7).

**Recommended order:** S1, S2, S3, S4, S5, S6, S7, S8, then S9 to S15 as listed. S1 and S2 are correctness: a
receipt must never misstate a sum, and new release content must not mislead. S3 to S5 are the evidence the plan's
"done means" asks for and should come before any polish. S10 needs H3 first; S13 needs a second release.

### S1 Receipts: show subtracted members and honour `credits_members`
- **State:** not started. Found on 2026-10-12 while checking the merge. The release has 33 `accounting_identity`
  checks with a member sign of −1 (`Check.member_signs`, for example "gross federal resources less the provincial
  share") and 72 checks with `credits_members: false`. The site reads neither field.
- **Where:** `site/src/app/o/[id]/page.tsx` (`CheckItem`, `MemberRow`, `evidenceWords`); `site/src/lib/data.ts`
  (`Check` type lacks both fields). Schema: end of `docs/SCHEMA.md`.
- **Left to do:**
  1. Add `member_signs?: number[] | null` and `credits_members?: boolean | null` to the `Check` type.
  2. In the arithmetic table, print a "less" marker and a minus before each member whose sign is −1, and say
     "added" / "subtracted" in the row for screen readers.
  3. In `evidenceWords`, skip checks whose `credits_members` is false (they do not support the member's status);
     keep showing them in the list, labelled "does not count towards this figure's status".
  4. Extend `scripts/check-build.mjs`: for every published receipt whose checks include a −1 member, the HTML
     holds the minus marker for that member.
  5. Screenshot one receipt of each case (find ids with a short Python query over `checks.json`).
- **Done when:** `npm run build && node scripts/check-build.mjs` passes with the new rule, and the receipt for a
  net-federal-resources figure (2009-10 BE) shows the provincial share as subtracted.
- **Effort:** 1 to 2 agent hours; a full build is about 6 minutes; can run beside pipeline work.
- **Needs from a human:** nothing.
- **Traps:** the check `description` already says "less"; only the table is wrong. Do not recompute sums in the
  browser; display `residual` and the printed values only.

### S2 Look at the new release content on the site
- **State:** not started. Since the site pages were built, the release gained ABS receipts series (`fed.rev.*`,
  48), LFS provincial series (`lfs.<measure>.<pb|sd|kp|ba>.*`), 19th ICLS series (`*.icls19`), cross-source checks
  against SBP and Economic Survey files (5 with no member cell, `target_value` + `target_source` instead), and
  `pdfplumber` cells. The build passes on them; nobody has looked at the pages.
- **Where:** `site/src/app/browse/page.tsx` (LFS now has 12 root series mixing 13th and 19th ICLS with no label
  saying which), `site/src/components/Compare.tsx`, `site/src/app/demo/health-and-jobs/page.tsx` (DEMO ids),
  `site/src/app/o/[id]/page.tsx` (cross-source check rendering), `site/src/app/sources/page.tsx` and
  `site/src/app/sources/[id]/page.tsx` (cross-source files: `doc_type` `sbp_easydata`, `pes_chapter`).
- **Left to do:**
  1. Browse: group LFS by definition (13th ICLS, then 19th ICLS, labelled from `dims.definition`), then by measure;
     group ABS receipts (`dims.side: receipts`) apart from expenditure.
  2. Compare: when two chosen series differ in `dims.definition`, say so above the chart in one sentence.
  3. Receipt: a cross-source check with no member cell shows the other source's name, value and how it was
     retrieved, from `target_source` / `target_value` (the sentence is in `description`).
  4. Check the sources page and a source detail page for one SBP file and one Economic Survey chapter (the SBP
     file is a CSV with no pages; the detail page assumes a PDF).
  5. Screenshot browse (LFS and ABS open), one provincial series, one `.icls19` series, one `fed.rev.*` series,
     one receipt with an SBP check, and the two new source types, at 390 and 1280 px.
- **Done when:** the screenshots exist under `docs/reports/qa/ui/after/` and show every 19th ICLS series labelled
  as such wherever it is listed; `node scripts/a11y.mjs` clean on those routes.
- **Effort:** 3 to 4 agent hours.
- **Needs from a human:** nothing.
- **Traps:** AGENTS.md section 7 (LFS provincial layouts, `.icls19` never joined to 13th ICLS, a cross-source check
  never supplies a value).

### S3 Production screenshots of every route, after the fixes
- **State:** partial. `docs/reports/qa/ui/before/` holds the 51 baseline images (17 routes x 3 widths, release as of
  2026-10-11 03:50). `docs/reports/qa/ui/after/` holds only 9 receipt images (tier A, CPI, gap) from commit
  `bbc8e66`, which predate the critique fixes. No "after" images exist for home, browse, the three series, the
  disputed receipt, sources, source detail, methods, releases, demo, compare, data, about or 404.
- **Where:** `site/scripts/screenshot.mjs`, `site/scripts/qa-routes.mjs` (route list built from the release).
- **Left to do:**
  1. `npm run build`, then `npx next start -p 3100` (not `next dev`: on this machine Turbopack's dev cache serves
     stale CSS and modules after edits; see the UI report).
  2. `node scripts/screenshot.mjs --base http://localhost:3100 --out ../docs/reports/qa/ui/after` (all routes,
     390/820/1280).
  3. Look at every image; fix what is wrong; repeat.
  4. Add a before/after table to the UI report (route, before file, after file, what changed).
- **Done when:** `docs/reports/qa/ui/after/index.json` lists 18 routes x 3 widths with status 200 (404 page: 404),
  and the report has the table.
- **Effort:** 1 agent hour plus fixes; the images are about 15 MB, so replace the set rather than adding a second.
- **Needs from a human:** nothing.
- **Traps:** stop the server afterwards (`site/` plan section 2: no processes left running).

### S4 Accessibility pass on every route, and the keyboard walkthrough
- **State:** partial. The last full axe run (production build, 2026-10-11 about 04:55) was clean for receipts
  (4 kinds), series (3), browse, home and demo at 390 and 1280 px; source, methods and releases failed
  `scrollable-region-focusable` with the old markup, since rebuilt but not re-run. Compare, data, about, 404 never
  ran with their new markup. No keyboard walkthrough is recorded. Baseline: `docs/reports/qa/ui/a11y-before.json`;
  `a11y-after.json` does not exist.
- **Where:** `site/scripts/a11y.mjs`.
- **Left to do:**
  1. With a production build on port 3100: `node scripts/a11y.mjs --out ../docs/reports/qa/ui/a11y-after.json`.
  2. Fix every serious or critical finding.
  3. Keyboard only: search (Ctrl+K, type, Enter) to a series, chart point to a receipt, receipt to "JSON" and
     "Copy citation", browse filter, compare add/remove. Record each step and anything unreachable in the report.
  4. Check focus visibility, heading order, and contrast of `--ink-3` text on `--paper-2` panels.
- **Done when:** `node scripts/a11y.mjs` exits 0, `a11y-after.json` is committed, and the report has the
  walkthrough.
- **Effort:** 2 agent hours.
- **Needs from a human:** nothing.
- **Traps:** `waitUntil: "networkidle"` never settles because of link prefetching; the scripts wait for `load`.

### S5 Critique round 2 on every page built after the receipt
- **State:** not started. Only the receipt had a fresh-eyes critique (15 findings, report section "Critique round 1").
  Series, browse, home, sources, source detail, methods, demo, compare, data, releases, about and 404 were checked
  only by the agent that built them.
- **Where:** plan section 4 step 3 (the critique loop); screenshots from S3.
- **Left to do:**
  1. A fresh subagent gets the S3 screenshots, plan section 5 criteria and the "avoid" list, and returns ranked
     problems per page.
  2. Fix what is confirmed; record rejections with reasons in the report.
  3. Re-shoot the changed pages.
- **Done when:** the report has "Critique round 2" with every finding marked fixed, rejected (why) or moved to an
  S entry.
- **Effort:** 3 to 5 agent hours depending on findings.
- **Needs from a human:** nothing, unless a finding is a design-direction question (then H5).
- **Traps:** run it after S2, or the critique misses the new series.

### S6 Receipt findings deferred from critique round 1
- **State:** not started; listed in the report ("Rejected or deferred").
- **Where:** `site/src/app/o/[id]/page.tsx`, `site/src/components/ui/PageFrame.tsx`, `site/src/lib/cite.ts`.
- **Left to do:**
  1. CPI receipts have no "same column, other lines" block because the CPI general index has no parent; build the
     sibling set from `dims.group` within the same area, base and period.
  2. The heading strip of the magnified crop can end on a half-cut text line (seen on ABS 2025-26); end it at the
     last full line above the first row of numbers.
  3. Two checks with near-identical sentences (the same column total in two editions) read as duplicates; put the
     document and page first in bold (partly done: `check-where`), and consider grouping by document.
  4. On a phone the page render is small; open the enlarged view scrolled to the boxed cell.
  5. "(n.d.)" in APA stays until H7 supplies publication dates.
- **Done when:** each step is done or explicitly rejected in the report, with screenshots of a CPI and an ABS receipt.
- **Effort:** 2 to 3 agent hours.
- **Needs from a human:** H7 for step 5 only.
- **Traps:** a crop must never cut a number or a row in half (`cropGuides()` in `site/src/lib/data.ts`).

### S7 Handoff documents for the site
- **State:** partial. The UI report has the audit, handoff 1 and progress to 06:10 on 2026-10-11; it has no morning
  note and no final "done means" section. `README.md` still describes the site as of the first run (line 7 and
  the "The site" section near line 120); `site/README.md` describes the old components (`PageCell`, `Badges`,
  `ViewSwitch`, removed) and port 3000.
- **Where:** `docs/reports/2026-10-12-ui-report.md`, `README.md` (site/deploy paragraph only), `site/README.md`.
- **Left to do:**
  1. Rewrite `site/README.md`: layout of `src/` (design, components/ui, chrome, lib), the QA scripts, the URL-state
     convention, the dev-cache trap, port 3100.
  2. Update the README site paragraph (pages, how to build and check).
  3. Add the plan's section 7 "done means" to the report with evidence (links to S3, S4, S5 outputs).
- **Done when:** a reader with no context can build the site, run the four checks and find every page's code from
  `site/README.md` alone.
- **Effort:** 1 agent hour; best after S3 to S5.
- **Needs from a human:** nothing.
- **Traps:** `README.md` and `STATUS.md` are shared files: edit only the site paragraph and the `## Site` section.

### S8 "How to read a receipt" page
- **State:** not started on the site. The pipeline added `docs/HOW_A_NUMBER_GETS_ON_THE_SITE.md` (a generated
  walk-through of one receipt, `pipeline/scripts/gen_walkthrough.py`) and `docs/GLOSSARY.md` (83 terms). Receipts
  link to `/methods#statuses` and `/methods#checks` instead.
- **Where:** new route, for example `site/src/app/how-to-read/page.tsx`; receipt rail in `site/src/app/o/[id]/page.tsx`.
- **Left to do:**
  1. Read both documents; decide (or ask) whether the site renders the walk-through as is, or a short annotated
     receipt that links to it.
  2. Build the page; render the glossary terms the site uses (status names, vintage, coverage, tier) as anchors.
  3. Link it from every receipt's rail and from the footer.
- **Done when:** the page exists, every receipt links to it, and a11y passes on it.
- **Effort:** 2 agent hours.
- **Needs from a human:** whether the walk-through is meant for the public site or for the team.
- **Traps:** the walk-through's values come from the release by script; do not copy them into site code.

### S9 Share images for receipts and series
- **State:** not started. No `og:image` on any page.
- **Where:** an `opengraph-image.tsx` per route (`site/src/app/o/[id]/`, `site/src/app/series/[id]/`) using
  `next/og`; docs in `site/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`.
- **Left to do:**
  1. Card: figure with unit, series, kind and period, document and printed page, status mark, prototype label.
  2. Measure the build-time cost on 6,318 receipts; if it is more than about two minutes, generate cards for series
     and the home page only and give receipts the series card.
  3. Load the two site fonts from `site/src/fonts/` into the image renderer.
- **Done when:** a receipt's HTML has an `og:image` that returns a PNG, and build time is recorded in the report.
- **Effort:** 2 to 3 agent hours.
- **Needs from a human:** H3 (absolute URLs need `siteUrl`); can be built before, but links will be relative.
- **Traps:** a card must never show a value for an unpublished figure.

### S10 Sitemap, robots, canonical URLs, structured data
- **State:** not started.
- **Where:** `site/src/app/sitemap.ts`, `site/src/app/robots.ts`, `metadata.alternates.canonical` per route,
  `Dataset` JSON-LD on series pages.
- **Left to do:** 1. Write the four. 2. Validate the JSON-LD on one series with a schema validator.
- **Done when:** `/sitemap.xml` lists every route; `/robots.txt` allows everything; series HTML holds valid JSON-LD.
- **Effort:** 1 to 2 agent hours.
- **Needs from a human:** H3 (`siteUrl`); without it the sitemap cannot hold absolute URLs.
- **Traps:** 7,280 pages: split the sitemap if it passes 50,000 URLs (not yet).

### S11 Designed empty and error states
- **State:** partial. Exist: browse "no series matches", chart "no checked values", search "nothing matches",
  compare "not in this release", 404. Not designed: a dataset absent from the release, a series whose every figure
  is a gap (table only), the search index failing to load (message exists, unstyled), a receipt for an unknown
  status (falls back to the raw label).
- **Where:** components listed above; `site/src/lib/status.ts` (`unknown`).
- **Left to do:** build a test release folder with these cases (a copy of the release with a dataset removed and
  an invented status value, never committed), point `release.config.json` at it locally, screenshot each state, fix.
- **Done when:** screenshots of each state are in the report.
- **Effort:** 2 agent hours.
- **Needs from a human:** nothing.
- **Traps:** do not commit the test release or change the real `release.config.json` version.

### S12 Keyboard shortcuts sheet
- **State:** partial. Skip link and reduced-motion handling exist; Ctrl/Cmd-K and "/" open search. No `?` sheet.
- **Where:** `site/src/components/chrome/` (new dialog), `site/src/app/layout.tsx`.
- **Left to do:** a dialog listing the shortcuts, opened by `?` outside inputs, closed by Esc.
- **Done when:** `?` opens it; axe clean; listed in the S4 walkthrough.
- **Effort:** 1 agent hour.
- **Needs from a human:** nothing.
- **Traps:** none known.

### S13 "What changed since the previous release" and errata badges
- **State:** blocked: there is only one release (`v0.0.1-prototype`, rebuilt in place under D29).
- **Where:** series page, receipt, releases page.
- **Left to do:** when a second release folder exists, diff observations by `obs_id` and show changed values with
  both releases; mark figures listed in `ERRATA.md`.
- **Done when:** a figure that differs between two releases shows both, each linked to its release.
- **Effort:** 3 agent hours, after the second release.
- **Needs from a human:** the first frozen release (H6, DOI decision).
- **Traps:** the site reads one release folder today (`release.config.json`); reading two needs a design decision.

### S14 Print stylesheet check
- **State:** written (`site/src/app/globals.css`, section 11) but never tested.
- **Left to do:** print a tier-A receipt, a disputed receipt and a series page to PDF with Playwright
  (`page.pdf()`), look at them, fix page breaks.
- **Done when:** the three PDFs are in `docs/reports/qa/ui/print/` and each receipt fits two pages.
- **Effort:** 1 agent hour.
- **Needs from a human:** nothing.
- **Traps:** none known.

### S15 Development server: stale cache on Windows
- **State:** observed repeatedly on 2026-10-11: after edits to `globals.css` or shared `lib/` files, `next dev` on
  port 3100 served old CSS or old modules (for example "frozenThresholds is not a function") until `.next/dev` was
  deleted and the server restarted.
- **Where:** `site/next.config.ts` (the Tailwind turbopack loader rule), `.next/dev`.
- **Left to do:** reproduce on a clean clone; try without the custom CSS loader rule and with persistent dev
  caching disabled; document the fix or the workaround in `site/README.md`.
- **Done when:** an edit to `globals.css` shows on reload without a restart, or the README says exactly what to do.
- **Effort:** 1 agent hour.
- **Needs from a human:** nothing.
- **Traps:** never test against the other agent's checkout or port.

Not needed now: table virtualisation (plan section 6 item 5). The longest series has 22 rows; revisit if monthly
CPI (P2) lands.

## Human (H)

- H1 Confirm or overturn the provisional decisions in `DECISIONS.md` (D25 to D34 and the unattended lines), D26 first.
- H2 Label the gold set (two people), after P7.
- H3 Create the Vercel project (root directory `site`) and set `siteUrl` in `site/release.config.json`.
- H4 Ahmad reviews what was merged into `main` (PR #1); fixes go in as new PRs.
- H5 Site questions: a dash printed in an ABS table; the accent colour; light theme only.
- H6 Still open from the first run: LUMS name and logo sign-off, DOI, hosting PDFs, branch protection on `main`.
- H7 Publication dates of the source documents (or a decision to keep "(n.d.)"): the pipeline cannot establish them
  from the files (STATUS.md, answers of handoff 2); citations print "(n.d.)" until then. Unblocks S6 step 5.
- H8 Whether the generated walk-through `docs/HOW_A_NUMBER_GETS_ON_THE_SITE.md` is for the public site or for the
  team. Decides how S8 is built.

Added by the pipeline agent (2026-10-12):

- H7 SBP EasyData: supply an API key so the CPI cross-check file can be pulled again by a documented request (the
  API answers 401 without one; the registered CSV came from the public guest form and cannot be re-fetched by URL), and
  read SBP's disclaimer to confirm the series may be redistributed. Needed by P4; see `docs/reports/track_sources.md`.
- H8 Post the status comment on the ClickUp task (the agents have no ClickUp access). The text will be at the end of
  the continuation report once P6 is done.
- H9 Gold set timing: label now on the current release (5,490 values) to get a first measured error rate, or wait
  until P1, P2, P10 and P13 have changed the published set and label once. P7 redraws the sample either way.
- H10 Sign off (or refuse) committing small excerpts of Docling output for real pages as test fixtures (P8). `AGENTS.md`
  section 8 requires explicit sign-off.
- H11 Publication dates of the source documents, if citations should carry them (P9 d). Nothing the pipeline reads
  establishes one.
- H12 Should a passed sum count as evidence for a member smaller than the sum's rounding allowance? (P10.) Today it
  does; the proposal is that it should not.
- H13 LFS 2024-25 table 9.2 (19th ICLS unemployment rate) prints no unit in its title. May "rate" plus a "(%)" found
  on the page be taken as percent? And may a title-less table be attached to the table it continues? (P12.)
- H14 Delete the merged `proto/v0*` remote branches? (P15.) They are all contained in `main`.
- H15 Within H1, the questions that change what is published, in the order they matter: D26 (LFS is published only
  because of it); the strict rule (a failed check withholds every figure in it; it withholds the Pakistan total for
  employed males 2020-21 because of one misprinted provincial figure); whether two printings one unit of the last digit
  apart count as agreement (17 pairs); the CPI basket weights taken from the issues themselves; the note that the
  2007-08 CPI base covered urban centres only. All are listed with their evidence under "Open questions" in `STATUS.md`.

## Merge check

On 2026-10-12 Claude Code (at Ali's request) merged the site branch into `proto/v0`, committed the leftover
`pipeline/scripts/compare_full_document_run.py`, updated `STATUS.md` and `DECISIONS.md`, and merged PR #1
into `main`. Not merged on purpose: `proto/v0-e1-abs-editions` and `proto/v0-e4-cpi-monthly`. Each agent checks
that its own work arrived intact and records the result in its subsection.

### Pipeline agent's check
Done 2026-10-12 on branch `followup/open-work-pipeline`, cut from `main` at `bebff67`.

- [x] Every commit of `proto/v0` (and of the track branches that were already merged into it) is in `main`.
      Checked with `git merge-base --is-ancestor <branch> origin/main` for my last commit `6580078` and for
      `proto/v0`, `proto/v0-ui`, `-site`, `-cpi`, `-lfs`, `-review-cpi`, `-review-lfs`, `-second-reader`, `-abs-detail`,
      `-old-base-cpi`, `-sources`, `-fix-lfs`, `-e2-abs-receipts`, `-e3-lfs-depth`, `-e-tools`: all contained.
      Not contained, as intended: `proto/v0-e1-abs-editions` (4 commits ahead) and `proto/v0-e4-cpi-monthly` (1 ahead).
- [x] Nothing of mine was lost or changed in the merges. `git diff 6580078 origin/main` outside `site/` touches five
      files only: `DECISIONS.md` (one line added), `STATUS.md`, `docs/OPEN_WORK.md` (new),
      `docs/reports/2026-10-12-ui-report.md` (the site agent's) and `pipeline/scripts/compare_full_document_run.py`
      (my leftover file, committed byte for byte as I left it). Nothing under `pipeline/datalab`, `pipeline/tests`,
      `specs`, `sources`, `schema`, `thresholds`, `gold`, `releases` or `.github` differs.
- [x] `python -m pytest` passes on `main` (whole suite, no failures, no expected failures left) and
      `datalab check-release releases/v0.0.1-prototype` prints `ok`. CI on `main` at `bebff67`: success.
- [x] The edits Claude Code made to `STATUS.md` and `DECISIONS.md` are accurate. The new `DECISIONS.md` line (merge
      into `main` on Ali's instruction, without the usual teammate review) matches what happened and agrees with the
      earlier line recording Ali's instruction during the run. In `STATUS.md` the header, the state paragraph, the new
      "Open work" row and the "Unfinished work" section are correct; the data table and counts are unchanged and still
      match `releases/v0.0.1-prototype/release.json` (ABS 2,889, CPI 1,254, LFS 1,347 published; 17 disputed).
- Problems found and how they were fixed: none that needed a fix in this branch. Three things noted, all now entries
  above rather than fixes, because Ali asked that no open work be started today:
  1. Files outside `STATUS.md` still describe the first run or name the continuation run as current (`README.md`,
     `AGENTS.md` sections 9 and 11, `CLAUDE.md`, the dataset card's "Known limitations"): P6.
  2. The release on `main` was built at `9e674a3`, before the tools branch (a normaliser fix) was merged. The
     self-check passes and the tools track showed no stored value parses differently, but a rebuild followed by
     `datalab diff-release` has not been run: P6 step 5.
  3. `STATUS.md` under "Site" still says "This branch does not edit `site/`" and "in its own branch", which read oddly
     on `main`. Left for the site agent, who owns that section.

### Site agent's check
Done 2026-10-12 on branch `followup/open-work-site` from `origin/main` at `bebff67`.
- [x] Every commit of `proto/v0-ui` is in `main`: `git log origin/main..origin/proto/v0-ui` is empty, and so is
      `git log origin/main..23e670a` (my last site commit).
- [x] Nothing of mine was lost or changed: `git diff 23e670a origin/main -- site docs/DESIGN.md docs/reports/qa/ui`
      is empty. `docs/reports/2026-10-12-ui-report.md` differs only by the 38-line "Progress after handoff 1"
      section I had left uncommitted (commit `7b8cd0a`), unchanged.
- [x] On `main`: `npm run lint` clean; `npm run build` green, 7,280 static pages (prebuild: 6,318 receipts, 925
      series CSVs), 5 min 36 s while pipeline jobs ran; `node scripts/check-build.mjs` OK (5,490 value receipts,
      811 gap receipts, 17 disputed receipts).
- [x] The `## Site` section of `STATUS.md` is accurate after two fixes (below).
- Problems found and how they were fixed:
  - `STATUS.md` `## Site` still said the last six pages would "merge with the next green gate" and that the site
    lives on `proto/v0-ui`; rewritten to say everything is in `main`, with the check results above, and to point
    at the S list. The page count line now says 7,280.
  - Not a merge problem, found while checking: receipts ignore `Check.member_signs` and
    `Check.credits_members`, which the release gained overnight. Not fixed today; recorded as S1.

## Done

(Move finished entries here with the PR or commit.)
