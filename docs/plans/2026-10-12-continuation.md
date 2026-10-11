# Continuation run: harden, resolve the held-back data, extend

**Written:** 2026-10-12, 03:50 (Sunday, early morning), by Ali's planning session, after reading `STATUS.md`, `docs/reports/2026-10-11-overnight-report.md`, both track findings notes, `DECISIONS.md` and `thresholds/thresholds.yaml` as left by the first run.
**Executing agent:** the same unattended setup as `docs/plans/2026-10-11-overnight-prototype.md`. Everything in that plan's **section 0** (authority, limits, how to work, context hygiene), **section 11** (decision protocol) and `AGENTS.md` section 9 applies unchanged. Ali is authorising this run the same way. Nobody is available.
**Your job:** make the first run's output reviewable and trustworthy, resolve the two data types that are held back or incomplete on evidence (not by bending thresholds), and extend coverage where the sources are already verified. Leave `proto/v0` green, pushed, and documented.

Read this file, then re-read `STATUS.md` and the last 120 lines of the first run's report. Start at **C0**.

---

## 0. What the first run left (verified by the planning session)

- Branch `proto/v0` at `8a04e09`, 32 commits, clean tree, draft PR #1, CI green (199 tests).
- Release `releases/v0.0.1-prototype/`: ABS published (9 editions, 535 values), CPI published (June 2021, 2023–2026; 884 values), LFS **not published** (cross-edition 192/198 = 96.97% against frozen 98%).
- Held back or incomplete, with the evidence already in the repo:
  1. **LFS:** all 6 disagreements are 2018-19 industry shares that the 2020-21 report prints differently. Both tables add to 100 (`track_d_lfs_findings.md`). That is a publisher restatement, not an extraction error.
  2. **ABS:** 2 Budget 2021-22 lines are reprinted differently in the 2022-23 edition (Rs 1,042 million moved between two functions); currently published from the first edition with a note.
  3. **CPI 2007-08 base:** June 2016, 2018, 2019 verified; not processed because the table carries no national/urban label and the old-layout code never ran on real output. Under the aligned scanned-page definition all three pass (18.2%, 18.2%, 16.7%).
  4. **CPI June 2021 urban and rural tables:** Docling merged rows and lost a column; flagged and withheld. No second reader exists yet.
  5. **LFS 2014-15:** the PBS link `Annual_Report_of_LFS_2014-15.pdf` serves the Azad Jammu & Kashmir edition. The PBS page also lists `https://www.pbs.gov.pk/wp-content/uploads/2020/07/Annual_Report_of_LFS_2014-15-1.pdf` (not yet tried).
  6. **LFS full-document runs** for 2018-19, 2020-21, 2024-25 are queued (page-range runs used, D18).
  7. **Cross-source checks** implemented for CPI vs SBP EasyData but no `sbp_easydata` source is registered; PES chapters for CPI and LFS not registered.
  8. **CPI and LFS builders** were written by subagents and merged after tests and a read of headline series; less reviewed than ABS.
  9. ABS function lines are current expenditure on revenue account only; the ABS detail tables (sub-functions, development spending) are not processed. No new Docling runs are needed for them: the validated run JSON already holds every table in each edition.

---

## 1. Decisions for this run (provisional, unattended; Ali to confirm)

Append to `DECISIONS.md` in C0, dated 2026-10-12.

| # | Decision | Why |
|---|---|---|
| D25 | **`disputed` becomes a real status, assigned by code.** A cross-edition pair whose two readings differ is `disputed` (not `fail`) when **all** of: (a) each reading's own table passed at least one arithmetic check (`column_total`, `hierarchy_sum`, `weights_sum`, `index_aggregation`, `recompute`, `row_total`) that includes that cell; (b) neither table carries a structural flag; (c) the two readings are of the same observation. Otherwise the pair is `fail` as before. A disputed observation is shown on the site with status `disputed`, `value: null`, and `disputed_readings: [{source_id, page, value_raw, value_parsed}]` for every printing, with a receipt sentence of the form "Printed as X in <doc A> (p.N) and as Y in <doc B> (p.M). Each table adds up on its own page. We do not publish either figure as checked." It appears in CSV with a blank value and the status column; charts show no point. | Two official printings that each add up but differ is the case the public status `disputed` was created for (AGENTS.md §6). Publishing the first printing as `checked` while a later official document contradicts it overclaims. |
| D26 | **DEVIATION (metric definition changed after results exist):** cross-edition agreement is reported as `agree / (agree + fail)` with disputed pairs counted and shown separately; the frozen 98% applies to that ratio. Additional guard, added now and conservative: a data type with disputed pairs above 5% of all evaluable cross-edition pairs is not published. ABS: 112 agree, 2 disputed (1.75%); LFS: 192 agree, 6 disputed (3.0%). | The 98% threshold exists to catch extraction errors; a publisher restating a figure is not one. Separating the two keeps the threshold intact and makes the restatements visible instead of hidden inside a pass rate. Recorded as a deviation because it is a definition change after results. |
| D27 | **CPI 2007-08 base series are named by what the document prints, with no area segment:** `cpi.general.b2007_08`, `cpi.group.<slug>.b2007_08`, `cpi.weight.<slug>.b2007_08`, `dims.area_as_printed: "none stated"`, and a series note `definition_status: draft`: "The 2007-08 base CPI was compiled from urban centres only (to confirm against PBS methodology; not stated in the monthly issue)". They are never joined to `cpi.national.*` or `cpi.urban.*`; the site shows them as a separate segment with the 2019-08 rebase break marked. Supersedes the first run's `cpi.national.*.b2007_08` naming, which asserted an area the document does not print. | Rule 10 (never guess): the document does not say national or urban, so the series id must not either. |
| D28 | **Second reader (pdfplumber) is routed only to tables carrying `merged_rows` or `dropped_column` flags.** Its cells are recorded under `cell.second_reader` and become the primary reading **only if** the table's arithmetic checks pass on that reading. Maximum tier B unless a cross-edition or cross-source check also agrees. The Docling reading stays in the record. | AGENTS.md §5 step 7; a second extraction tool is evidence, an LLM is not. |
| D29 | **Release version stays `v0.0.1-prototype`** for this run; `CHANGELOG.md` records "rebuilt before first deployment". The version is frozen at the first public deployment or DOI, whichever comes first; after that every change is a new version. | Nothing is deployed or cited yet; a second 25 MB folder in git buys nothing. |
| D30 | **LFS 2014-15:** try the `-1` URL, then Wayback; accept only if the cover and table titles say Pakistan (not AJK) by the same marker check that rejected the first file. | A wrong document is worse than a missing one. |
| D31 | **ABS detail tables** (functional classification with current, development and total, with sub-functions) are processed from the existing validated runs if the locator finds them in at least 7 of 9 editions with coverage above threshold; series `fed.exp.development.function.*` and `fed.exp.total.function.*`, accounting identity current + development = total per function, sub-functions as children with hierarchy sums. The demo uses total health only if it passes; otherwise keeps the current-only figure with its label. Time-boxed (section 3, C7). | STATUS.md open question; the demo's health number is weak without development spending. |

The scanned-page definition change from the first run stays as recorded (a deviation awaiting confirmation). `thresholds/thresholds.yaml` is not edited; D26's guard is recorded as a deviation line and enforced in code with its own line in the dataset card.

---

## 2. Done means

### Must
1. CPI and LFS builders reviewed adversarially by fresh subagents against `AGENTS.md` §3–4 and their specs; every confirmed bug fixed with a test; an end-to-end test per builder on a generated PDF fixture (make the PDF in the test with PyMuPDF; never a source file).
2. D25/D26 implemented in `status.py`, `checks.py`, `release.py::check_release`, the schema, the dataset card, the methods page and the site (badge, receipt wording, CSV). Release rebuilt; LFS publication re-evaluated under the frozen thresholds with the D26 metric; the outcome, whichever it is, written down with the numbers.
3. CI green, `check-release` green, `npm run build` green, screenshots of a disputed receipt and the LFS series page in `docs/reports/qa/`.
4. `STATUS.md`, `docs/reports/2026-10-12-continuation-report.md` (new file; link it from STATUS and the first report), `DECISIONS.md`, `README.md`, `AGENTS.md` §7 traps, PR #1 description, "For Ahmad" reading order, morning checklist v2, ClickUp text. Pushed.

### Should
5. CPI 2007-08 base processed (D27): overlays viewed, checks, published if thresholds hold; site shows separate segments.
6. Second reader (D28) on the June 2021 urban and rural tables and any ABS table with the same flags; values published only through checks.
7. National LFS 2014-15 (D30) registered and processed (page-range per D18); 2014-15 ↔ 2017-18 cross-edition checks.
8. Cross-source: register the SBP EasyData CPI pull (request URL, time, hash; file under `SOURCES_DIR/sbp/`) and the PES 2024-25 inflation and labour chapters (ra-ship, verified per 6.1 of the first plan, fresh Docling runs); run the implemented `cross_source` checks; report tier changes.

### Could
9. ABS detail tables (D31).
10. Full-document Docling runs for LFS 2018-19, 2020-21, 2024-25 in the background, sequential, lowest priority: compare every mapped cell with the page-range run (`value_raw`, page, bbox); report agreement; if identical, switch provenance to the full-document run ids; if not, keep page-range and list the differences.
11. Hide the LFS "Total 100.0" share series from browse and series lists (keep it in the release); clean anything else in STATUS.md's "queued follow-ups" that takes under 15 minutes.

**Then keep going.** This is a multi-hour run; Ali is asleep. When Must, Should and Could are done, work through the **extended backlog in section 6, in order**, until it is exhausted, or everything left needs a human, or you have been running about 9 hours. Do not stop because the numbered steps are finished. Every two hours, regardless of where you are, write an interim handoff (report entry + `STATUS.md` + push) so a dead session leaves a clean state.

Stop rule for the numbered steps: if something goes badly wrong, finish Must, then C9/C10 below, then push, then continue with section 6 only if the branch is green.

---

## 3. Order and time budget (≈6 h of work, less with parallel tracks)

| # | Step | Budget | Notes |
|---|---|---|---|
| C0 | Re-orient | 0:15 | `git pull`; tree clean; new report file; D25–D31 appended; start the two review subagents (C1) immediately, they run while you do C2. |
| C1 | Review CPI and LFS builders | 1:00 (parallel) | Two subagents, one per builder, each gets: the builder, its spec and label map, `common.py`, `checks.py`, `status.py`, AGENTS.md §3–4 and §7, the findings note. Brief: find correctness bugs (wrong column/year/vintage mapping, label collisions, tolerance mistakes, off-by-one pages, bbox origin errors, anything that could put a wrong number under a checked badge), report each with file:line and a failing test; no fixes by the reviewer. Lead verifies each finding, fixes with the test, rejects false positives in writing in the report. |
| C2 | Disputed status (D25/D26) | 1:15 | Schema (`Check.result` gains `disputed`; `Observation.disputed_readings`; `status: disputed`), status function, check-release, agreement metric with the 5% guard, dataset card, METHODS, site badge and receipt. Apply to ABS (2 cases) and LFS (6). Rebuild release; evaluate LFS under thresholds; write the result. |
| C3 | CPI 2007-08 base (D27) | 1:00 | Runs for 2016-06 and 2019-06 exist but were marked not valid under the old rule: re-validate those runs under the aligned definition if the run JSON is intact; otherwise new runs. 2018-06 needs a run. Locator for the old layout; overlays viewed before mapping; publish through checks only. |
| C4 | Second reader (D28) | 1:00 | `pipeline/datalab/second_reader.py`: pdfplumber words inside the table bbox, cluster into rows by y and columns by x using the Docling column header positions; produce cells with the same provenance fields; route only flagged tables; checks decide. Tests on a generated PDF with a deliberately tricky table. |
| C5 | LFS 2014-15 (D30) | 0:45 | Fetch, verify, register, page-range run, map, rebuild. |
| C6 | Cross-source (SBP, PES) | 0:45 | Register, verify, run, check, report tier changes. |
| C7 | ABS detail tables (D31) | 1:30 max | From existing runs. If the locator is not solid in 7 of 9 editions within the box, stop, document what was found, leave the code behind a flag. |
| C8 | Full-document LFS runs | background | Start after C2 if CPU is free; never block on them. |
| C9 | Rebuild + site | 0:30 | `datalab release`, `check-release`, `npm run build`, screenshots, spot-check sheet redrawn, gold sample redrawn only if the published set changed materially (say so if you redraw; the humans have not started labelling). |
| C10 | Handoff | 0:30 | Report, STATUS, README, DECISIONS, AGENTS traps, PR body, ClickUp text, morning checklist v2. Push. |

Tracks (lead merges only; one worktree each; no shared `work/` subfolders, the first run's trap): review-cpi, review-lfs (C1); old-base-cpi (C3); second-reader (C4); sources (C5 + C6); abs-detail (C7). Lead: C0, C2, integration, C9, C10.

---

## 4. Rules specific to this run
- **No threshold edits.** Any metric definition change is a DEVIATION line and a dataset-card line.
- **No new Docling runs for the nine ABS editions already validated.** Their runs hold every table; locate in their JSON. New editions (section 6) need their own runs.
- **CPU discipline.** At most two Docling runs at a time (the first run measured 10–15 s/page with three in parallel). Queue background jobs (E1 runs, E4 issues, C8, E5) one after another and keep building while they run.
- **The branch is never left red.** Every extension lands only when tests, `check-release` and `npm run build` pass; if an extension breaks something and the fix is not obvious in 20 minutes, revert that extension's commits, note it, move on.
- **Rebuild from the pipeline, never hand-edit the release.** If a number on the site needs to change, the change is upstream (spec, code, status) and the release is regenerated.
- **A reviewer's finding is not a bug until a failing test shows it.** Then fix it. Record rejected findings with the reason.
- **Disputed is not a dumping ground.** If the D25 conditions do not all hold, the pair is `fail` and the values stay withheld. Count how many pairs each rule turned away.
- **Receipts must read correctly after every change:** open three (one checked, one disputed, one second-reader) and look at them before C10.
- **Keep the humans' work intact:** `gold/` labelling files, if any appear, are never overwritten.
- Context hygiene and commit cadence as in the first plan (push at every step boundary, at least hourly).

---

## 6. Extended backlog (after C10; in this order; each item lands green or is reverted)

Decisions these items need are listed inline as D32–D37; append them to `DECISIONS.md` when you reach the item, same provisional marking.

| # | Item | Why it is worth hours | How |
|---|---|---|---|
| E1 | **Every ABS edition on disk: 2012-13, 2013-14, 2014-15, 2015-16, 2018-19, 2019-20, 2020-21, 2023-24** (all under `RA_SHIP_DIR/Arsalan Archive/Archive/Budget Statements/budget_docs/<FY>/`; official URLs in the pbs-corpus manifest or Wayback). | Turns the demo into a continuous federal series 2009-10 → 2026-27 with a cross-edition check on every year. Sir asked for depth in years. | Plan 1 §6.1 verification for each file; one run each, sequential; `specs/abs.yaml` layout entry per edition; same checks; `role: core`. Expect layouts to drift around 2012–2015; locate by the ten function names, never by page number. |
| E2 | **ABS receipts side**: the "Summary of Receipts" table in every edition (tax revenue by head: income tax, sales tax, customs, federal excise; non-tax revenue; totals). **D32:** series `fed.rev.<head_slug>` with children, same vintages `be`/`re`, same checks (column totals, hierarchy sums, cross-edition). | Breadth inside documents already verified and extracted; no new sources. The old prototype lost Sales Tax in one year, so this is where errors hide. | Locator by the heads' names; label dictionary; checks; receipts. |
| E3 | **LFS depth: provincial rows and the 19th ICLS tables.** **D33:** provincial rows (Punjab, Sindh, KP, Balochistan, already recognised and unmapped) become series with `geo: pk-<province>` and the same dims. **D34:** 2024-25 19th ICLS tables become separate series with suffix `.icls19`, their own definitions, never joined to the 13th ICLS series; the site shows both with the definition stated. | Geography depth ("national → province") at near-zero extraction cost; the 19th ICLS headline is the one PBS leads with and is currently absent. | Mapping, series catalogue, checks (provincial shares sum; male+female totals), site. |
| E4 | **CPI monthly series, not just June.** **D35:** every Monthly Review obtainable from August 2019 (first 2015-16 base issue) to the latest, then the 2007-08 base backwards as far as obtainable. Discovery: the `Monthly-Review-<Month><Year>.pdf` pattern under `/wp-content/uploads/2020/07/`, the PBS price page data array, Wayback CDX by URL prefix. Verify each file (plan 1 §6.1), one run each in the background queue. | A complete monthly CPI is what researchers actually use; each issue prints the previous month and same-month-last-year, so consecutive issues cross-check each other on every index. | Same builder; period `YYYY-MM`; cross-edition pairs across consecutive issues; publish by the same thresholds. Report how many issues were obtainable and from where. |
| E5 | **Full reproduction from a clean clone** (background, after E1 runs are queued): fresh clone into a scratch folder outside the repo, fresh venv from `requirements.lock`, `datalab fetch` into a fresh `SOURCES_DIR` (hash-verified), `datalab all` for every dataset, `datalab release` to a scratch path, then a semantic diff against `releases/v0.0.1-prototype` (same cells, values, checks, statuses; run ids and timestamps may differ). **D36:** reproduction runs write new run ids and never touch the repo's `work/`. | "Anyone can rebuild it" is a promise on the site; this is the first time it is tested. It also catches nondeterminism before Ahmad hits it. | Script `pipeline/scripts/reproduce.ps1` + `datalab diff-release A B`; report the diff; fix any nondeterminism found. |
| E6 | **Sanity report for humans** (`docs/reports/sanity_<date>.md`): for every published series, year-over-year changes above 50% or sign changes, series present in some editions but not others, residuals near tolerance, cells whose `value_raw` needed many normalisation flags. **Report only; never changes a status.** | Puts the oddities in front of the humans before sir sees them. | `datalab sanity`. |
| E7 | **Source-change check** `datalab watch --dry-run`: for every manifest row with an official URL, HEAD request (Last-Modified, Content-Length) and, when changed, a download + hash compare; prints a table and exits. **Never scheduled from a session** (CLAUDE.md); it is the building block for the ClickUp "source-change monitor" task. | Maintenance roadmap item; cheap. | Polite rate limits; Wayback save on change. |
| E8 | **Site depth**: client-side search over series names and synonyms (prebuilt JSON index); compare up to three series on one chart; cite formats downloadable (BibTeX, RIS); `sitemap.xml`; an accessibility pass (contrast, focus order, alt text on page renders stating page and document); provincial and monthly series pages from E3/E4. | The site must carry the new depth, and researchers find series by searching. | Keep static; no client fetching beyond the prebuilt index. |
| E9 | **Economic Survey (PES) first tables** — only after E1–E4: register and verify the 2024-25 and 2025-26 complete volumes (ra-ship; official URLs), page-range runs per D18 for the fiscal chapter and the growth chapter, extract the consolidated fiscal operations summary (revenue − expenditure = deficit identity; cross-source against ABS totals) and the GDP growth table (recompute). **D37:** new doc type `pes`, series `fed.fiscal.*` and `na.gdp.*`, vintage from the column headers (`provisional`, `revised`, `final`). | Breadth into the document type that holds most of what sir listed (GDP, trade, external). Riskier layouts, so last. | Spec, locator, checks, receipts; stop at the time box. |
| E10 | **Hardening**: property-based tests for the normaliser (`hypothesis`), regression fixtures cut from real run JSON (small excerpts, no source files), `gold-score` written and tested on synthetic labels with inter-rater agreement, `docs/HOW_A_NUMBER_GETS_ON_THE_SITE.md` walking one real receipt from PDF to page, glossary. | What Ahmad and sir will read; what keeps the next agent honest. | — |

Each E item: its own track branch if a subagent does it, lead merges, push, STATUS row updated. Keep the extended-backlog ledger in the report: started / landed / reverted / skipped, with the reason.

## 5. Morning checklist v2 (write it with real numbers at C10, update it at every interim handoff)
1. Pull, read `STATUS.md`, then `docs/reports/2026-10-12-continuation-report.md`, then PR #1.
2. Vercel project (root directory `site`), then `siteUrl` in `site/release.config.json`.
3. Confirm D25–D31 and the two deviations (scanned-page definition; D26 metric). These decide whether LFS and the 2007-08 CPI stay published.
4. Gold set with Ahmad; `datalab gold-score`.
5. Spot-check 10 receipts, including one disputed and one second-reader value.
6. Remaining follow-ups from `STATUS.md`.
7. Updated paragraph for sir, every figure cited to a receipt path.
8. The extended-backlog ledger: what landed, what was reverted, what is still queued.

Go, and keep going.
