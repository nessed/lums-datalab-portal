# Overnight build: LUMS DataLab Portal, first prototype

**Written:** 2026-10-11 (Saturday night), by Ali's planning session, for the agent that executes tonight.
**Executing agent:** Claude Opus (Claude Code) with subagents, unattended. Ali is studying, then asleep. Ahmad is unavailable until tomorrow.
**Your job:** carry the first prototype as far as it will go tonight, end to end, without waiting for anyone. Leave the repo in a state Ali can review, deploy and demo in the morning, with a written record of everything you did and decided.

Read this whole file once before you start. Then read `AGENTS.md`. Then begin at **M0**. Don't spend more than 15 minutes reading before your first commit.

---

## 0. Authority, limits, and how to behave tonight

### What you may do without asking
- Everything in this plan. Ali has authorised it explicitly.
- Make any decision this plan leaves open **if** it is reversible, small, and consistent with this plan and `AGENTS.md`. Log it (section 11). Don't stop to ask; nobody will answer. Don't stall on any single blocker for more than 20 minutes: take the fallback listed in section 12, note it, move on.
- Install packages into a project virtual environment, download files from official government sites and the Wayback Machine, run Docling, run the site build, create branches, commit, push to the `proto/v0` branch, open and edit one draft pull request, post comments on the ClickUp task if ClickUp tools are available.
- Edit `AGENTS.md`, `CLAUDE.md`, `README.md`, `DECISIONS.md`, and create `STATUS.md`. Section 10 says exactly how.
- Spawn subagents (worktrees) for the parallel tracks in section 9.

### What you must never do (these do not bend, even to finish)
1. Everything in `AGENTS.md` section 3 (non-negotiable rules) and section 4 (where LLMs may and may not be used). In particular: **no LLM, including you, ever writes a published number, parses a value, labels the gold set, or assigns or upgrades a check status.** You write code. Code reads numbers. Code decides.
2. Never push to `main`. All work goes on `proto/v0` (and short-lived sub-branches that merge into it).
3. Never write into `C:\Users\Ali\Desktop\ra-ship` or any file in it. Read only.
4. Never commit a PDF, Excel, raw API dump, `.env`, secret, or absolute path in code. Page-render PNGs and derived JSON/CSV/Parquet are fine.
5. Never reuse August's Docling outputs as data. Every conversion tonight is a **fresh run** with recorded version and config. (You may read the old outputs to learn the JSON structure.)
6. Never publish a value whose source file has not been through the verification procedure in section 6.1.
7. Never present a "coverage" number and an "accuracy" number as one number.
8. Never smooth across a series break. Mark it.
9. Never guess a value, a label mapping that a check then contradicts, or a URL. If something cannot be established, it is a labelled gap.
10. Don't mention anyone's personal subscription or billing details anywhere in the repo, PR, or ClickUp.

### How to work
- **Order:** schema → sources → extract → check → release → site → CPI → LFS → demo → handoff. ABS end to end first; everything else is layered on a working pipeline.
- **Commit at the end of every step, push at every milestone and at least once an hour.** The repo must always be in a state where a human could pick it up.
- **Time-box.** Rough budget in section 8. If a milestone overruns by 50%, cut its "should" items, write what you cut into the report, continue.
- **Prefer boring, deterministic, tested code** over clever code. The reviewer tomorrow is a different agent plus two humans with no context from tonight.
- **Look at your own output.** After any extraction or render, view the overlay images (section 6.4) and sanity-read a few rows. Viewing is permitted; it is QA of the code. It never changes a value or a status.
- **Write things down as you go**, not at the end: `STATUS.md`, the report, `DECISIONS.md`. If you run out of time, the record is more valuable than one more feature.

---

## 1. Ground truth, verified tonight

Everything here was checked on this machine on 2026-10-11. Trust it; re-verify only if something fails.

### Repo and accounts
- Repo: `https://github.com/nessed/lums-datalab-portal` (private). Collaborators: `nessed` (Ali, owner), `ahm3d-karim` (Ahmad).
- Local clone: `C:\Users\Ali\Desktop\lums-datalab-portal`, on `main`, one commit (`47c2546`), docs only. No code yet.
- `gh` CLI is authenticated as `nessed`. Git identity is set (`nessed` / Ali's email).
- `main` has no branch protection. Don't rely on it; just don't push there.
- ClickUp planning task: **Citizen-facing portal**, id `86eyudf64`, list "DataLab", `https://app.clickup.com/t/86eyudf64`. Its description is the baseline plan this file builds on.

### Machine
- Windows 11. Shell: PowerShell by default; Git Bash also available. Use `python -m ...` forms and `pathlib`; never backslash string paths in code.
- Python: `py -3.12` and `py -3.13` available (also 3.10, 3.11 default on PATH, 3.14). No `uv`. Use `venv` + `pip`.
- Docling: **not** in 3.11/3.12/3.13. Installed in system 3.14 as 2.102.2 (`C:\Users\Ali\AppData\Local\Python\pythoncore-3.14-64\Scripts\docling.exe`, used for the August runs) and in a venv `ra-ship\ABS_PES_PBS_Extraction_Test\02_tool_runs\.envs\docling\` (Python 3.13.15, docling 2.119.0, docling_core 2.91.0, docling_ibm_models 3.14.0, docling_parse 7.13.0). Models are therefore probably cached in `~/.cache/docling`. Nothing is pinned anywhere.
- Installed in 3.11: pymupdf 1.28.2, pandas 3.0.6, pypdf 6.18.1. Not installed: pdfplumber, camelot, pydantic, pyarrow.
- Node v24.15.0, npm 11.12.1. No pnpm. CPU only, no NVIDIA GPU. 357 GB free.

### Reference archive (read-only): `C:\Users\Ali\Desktop\ra-ship`
| What | Path (relative to ra-ship) |
|---|---|
| ABS PDFs, one per edition, **2010-11 through 2025-26 and 2026-27** | `Arsalan Archive/Archive/Budget Statements/budget_docs/<FY>/abs_fy_<FY>.pdf` (2026-27 folder is named `2026-2027`) |
| Sizes | 2010-11: 66 KB, 2011-12: 113 KB (small; verify completeness), 2016-17: 1.0 MB, 2017-18: 1.1 MB, 2021-22: 724 KB, 2022-23: 4.3 MB, 2024-25: 3.1 MB, 2025-26: 2.7 MB |
| Registry with official URLs for ABS/PES etc. (363 rows; `page_count` blank in every row because of the `len(PdfReader(path))` bug) | `Agent Files/RA_WORKSPACE/02_sources/pbs-corpus/manifest.csv` |
| PES complete volumes and chapters (inflation + labour chapters for 2019-20, 2020-21, 2024-25) | `Agent Files/RA_WORKSPACE/02_sources/pbs-corpus/raw/federal/<FY>/` |
| PES library 2015-16 → 2024-25 with inflation + population/labour chapters | `Budget EDA/Budget EDA/data/pakistan_economic_survey/<FY>/` |
| Extraction SOP (read Steps 2, 4, 8 and section 4) | `04_Research_Outputs/Deliverables/TEST2_PROTOCOL_AND_SOP.md` |
| Tested normaliser to port (rules listed in 6.5) | `ABS_PES_PBS_Extraction_Test/04_verification/vision_baseline_key/compare_values.py` |
| August Docling run script and manifests (learn the output structure; don't reuse data) | `ABS_PES_PBS_Extraction_Test/02_tool_runs/scripts/run_docling_full_pdf.ps1`, outputs under `ABS_PES_PBS_Extraction_Test/03_outputs/<DOC>/docling/<run_id>/` |
| Portal design brief (receipt page, three-vintage view) | `04_Research_Outputs/Deliverables/PORTAL_DESIGN_BRIEF.md` |
| Arslan's old ABS dataset, comparison only | `Arsalan Archive/Archive/ABS Dataset/files/subcodes_long.csv` |
| Audit of the old prototype | `04_Research_Outputs/Deliverables/PORTAL_AUDIT_FINDINGS.md` |

No CPI or LFS files exist anywhere in the archive. They must be collected tonight (section 7).

### Official sources, checked live tonight
- Finance Division budget pages: `https://www.finance.gov.pk/fb_2025_26.html`, `https://www.finance.gov.pk/fb_2024_25.html` (pattern `fb_<yyyy>_<yy>.html`).
  - ABS 2025-26: `https://www.finance.gov.pk/budget/budget_2025_26/abs_eng_10062025.pdf`
  - ABS 2024-25: `https://www.finance.gov.pk/budget/Budget_2024_25/Annual_Budget_Statement.pdf`
  - ABS 2026-27: `https://www.finance.gov.pk/budget/budget_2026_27/Annual_Budget_Statement.pdf`
  - ABS 2022-23: `https://www.finance.gov.pk/budget/Budget_2022_23/Annual_Budget_Statement_English.pdf`
  - ABS 2018-19: `https://www.finance.gov.pk/budget/Annual_Budget_Statement_2018_19.pdf`
  - Older editions: take the URL from the pbs-corpus `manifest.csv` ABS rows; many will be dead → Wayback.
- PBS Labour Force page: `https://www.pbs.gov.pk/content/labour-force-statistics` (HTTP 200). Rounds PBS lists: 2009-10, 2010-11, 2012-13, 2013-14, 2014-15, 2017-18, 2018-19, 2020-21, 2024-25. **Five most recent: 2014-15, 2017-18, 2018-19, 2020-21, 2024-25.**
  - 2024-25: `https://www.pbs.gov.pk/wp-content/uploads/2020/07/LFS-2024-25-Annual-Report.pdf`
  - 2020-21: `https://www.pbs.gov.pk/wp-content/uploads/2020/07/LFS_2020-21_Report-3.pdf`
  - 2018-19: `https://www.pbs.gov.pk/wp-content/uploads/2020/07/lfs_2018_19_final_report-1.pdf`
  - 2017-18: `https://www.pbs.gov.pk/wp-content/uploads/2020/07/Annual-Report-of-LFS-2017-18.pdf`
  - 2014-15: `https://www.pbs.gov.pk/wp-content/uploads/2020/07/Annual_Report_of_LFS_2014-15.pdf`
- PBS Price page: `https://www.pbs.gov.pk/?page_id=7291`. It is JavaScript-driven (the monthly-review list is rendered from a data array in the page source: look for `item1.review`). Found tonight: `https://www.pbs.gov.pk/wp-content/uploads/2020/07/Monthly-Review-September2026.pdf` (the current "Monthly Review of Price Indices"), `.../CpI-Urban-Groupwise-Cumulative-Indices.pdf` (check it: may hold multi-year group indices in one file), `.../methodology_of_price_statistics_base_year_2015-16.pdf`, `.../manual_of_cpi_2015-16.pdf`.
- Wayback Machine reachable: availability API `https://archive.org/wayback/available?url=<url>&timestamp=<yyyymmdd>`, save API `https://web.archive.org/save/<url>`.
- SBP EasyData `https://easydata.sbp.org.pk` for CPI cross-source (CSV/API). Cross-source only, never a primary source for a published number.

---

## 2. What "done" looks like in the morning

Three tiers. Finish **Must** before touching **Should**. Pursue **Stretch** only if Must and Should are green.

### Must
1. `proto/v0` branch pushed, draft PR open against `main` with a reviewer-grade description, ClickUp link, and a running changelog.
2. Python package `datalab` with a CLI that reproduces the whole pipeline from the manifest, pinned dependencies, tests passing, CI workflow green on GitHub Actions.
3. Schema (section 5) implemented as pydantic models, exported JSON Schema in `schema/`, with docs.
4. All 9 ABS editions (5 core + 4 neighbours) registered, **verified** (6.1), freshly Docling-converted (6.3), structurally validated with per-table coverage (6.4), normalised (6.5), function-wise expenditure table located and mapped to series (6.6), checks run (6.7), statuses assigned by code (6.8).
5. Frozen release `releases/v0.0.1-prototype/` (6.10) containing only values that passed, with page renders, cells, checks, sources, series, release metadata, `HOW_TO_REPRODUCE.md`, `dataset_card.md`, changelog and errata stubs.
6. Next.js site in `site/` that builds locally from the release files: home, browse, series page with BE/RE lines and break markers, receipt page with the page render + boxed cell + the checks in plain words + cite button, sources page, methods page, releases/errata page. Mobile works. Ready for Ali to connect to Vercel (root directory `site`).
7. `STATUS.md`, `docs/reports/2026-10-11-overnight-report.md`, `DECISIONS.md`, `AGENTS.md`, `README.md` updated (section 10). ClickUp comment posted if tools exist.

### Should
8. CPI: 5 June issues (2 before the 2019 rebasing, 3 after) collected from PBS or Wayback, verified, converted, checked (weights sum to 100; general index recomputes from group indices and weights; YoY inflation recomputes), cross-checked against SBP EasyData, added to the release and site.
9. LFS: 5 rounds collected, verified, converted, key indicators + employment by industry extracted and checked (shares sum to 100; rates recompute where counts are printed), cross-checked against PES labour chapter, added to release and site.
10. Demo page "Health and jobs since 2010" (6.12).
11. Gold-set labelling kit for the humans (6.11): stratified sample of ~400 cells, page renders with boxes, a local labelling page, protocol. **Unlabelled.**
12. Cross-edition corroboration for every core year via the neighbour editions; neighbour editions' own values published if they pass.

### Stretch
13. Real-terms toggle on the series page using CPI with a documented splice (6.12).
14. Spot-check sheet (30 random published values with crops) for Ali.
15. oEmbed-style share card for receipts; RIS/BibTeX downloads.
16. Second reader (pdfplumber) routed only for tables flagged by the detectors.

If at any point only one thing can be finished, finish **the ABS receipt page working on real checked data**. That is the demo.

---

## 3. Decisions made for tonight

Each of these is provisional, made by the planning session under Ali's instruction, and must appear as a line in `DECISIONS.md` (append them in M0, dated 2026-10-11, marked "provisional (overnight); Ali/Ahmad to confirm"). They settle the open questions in the ClickUp task and the repo docs.

| # | Decision | Why |
|---|---|---|
| D1 | **Work on branch `proto/v0`, one draft PR to `main`.** Subagents use `proto/v0-<track>` and merge into `proto/v0`. No one pushes to `main` tonight. | Satisfies "no direct pushes to main" and gives Ahmad one place to review tomorrow; Vercel can deploy the branch as a preview. |
| D2 | **Observation identity = (series_id, period, vintage).** A printed number is a **Cell** (one reading in one file at one page/box). An **Observation** is the fact the cells support. Cross-edition checks compare cells of the same observation. | Stable permanent IDs that survive re-extraction; the baseline schema conflated reading and fact. |
| D3 | **Breakdowns live in the series, not the observation.** `fed.exp.function.health` and `lfs.unemployment_rate.female.rural` are different series with `parent_id` and `dims`. | Keeps observation IDs simple and URLs readable; hierarchy supports depth later. |
| D4 | **Vintages:** `be` (budget estimate), `re` (revised estimate), `actual`, `provisional`, `final`, `rebased`, `na` (for statistics without vintages, e.g. a CPI index value). ABS gives only `be` and `re`; **actuals are out of scope tonight** and the site says so. | ABS prints no actuals; claiming "actual" would be false labelling. |
| D5 | **ABS scope per edition:** the function-wise expenditure table(s) as printed, all rows, including sub-functions if printed in the same table; publish function level as primary series and sub-functions as child series. Also capture the Total row and, if present on a located table, current/development/total split for the accounting identity. | Sub-items give the hierarchy-sum check for free; the demo needs only function level. |
| D6 | **Neighbour editions 2011-12, 2017-18, 2022-23, 2026-27 are processed too**, as `role: corroboration`. Their cells corroborate the core years' values (this year's BE = next edition's "prior year" column). | With the baseline's 5 years only one pair was adjacent; this gives every core year a cross-edition check at near-zero cost since the PDFs are on disk. |
| D7 | **A line missing in some editions is a labelled gap** with `gap_kind: not_in_source` (the edition doesn't print it) or `not_yet_verified` (we have a cell but it failed or is unchecked). Never an empty cell with no reason. | Rule 3 in AGENTS.md. |
| D8 | **Public status is a pure function of evidence:** A/B → `checked` (published), C → `unchecked` (shown as a gap "not yet verified"; value not shown), D → never shown. E not used tonight. Exact definition in 6.8. | "Every published value passes its checks." |
| D9 | **Sum tolerance:** residual 0 → `pass`; 0 < residual ≤ 0.5 × (number of members) units of the last printed digit → `pass_within_rounding`; else `fail`. Cross-edition: equal within 1 unit of the last printed digit (Rs 1 mn for ABS) → pass. Both count as passed for status; receipts say which. | Printed tables are rounded; honest wording on the receipt. |
| D10 | **Thresholds frozen before any run** in `thresholds/thresholds.yaml` with its SHA-256 in `thresholds/FROZEN.md`: every page accounted for; ≥95% of printed numeric values in each target table captured, no table under 90%; ≥95% of evaluable checks pass per data type; ≥98% of cross-edition pairs agree; gold-set error ≤2% (pending humans). A data type below threshold is not published; the site marks it "coming". | ClickUp baseline; must be frozen before results exist. |
| D11 | **Coverage is measured by code**, per target table: numeric tokens found by PyMuPDF/pdfplumber inside the table's region on the page versus numeric cells Docling emitted for that table (multiset match after normalisation). | Gives the coverage number tonight without humans; accuracy comes from checks and later the gold set. |
| D12 | **Receipts show a full page render with the cell boxed by an overlay**, not pre-cut crops. One PNG per used page at 144 DPI, bbox stored normalised (0–1, top-left origin). | Far fewer artifacts, the box is drawn from data (reproducible), the user sees context. |
| D13 | **Source PDFs are not hosted by us tonight.** Receipts link to the official URL and the Wayback snapshot. Hosting our own copies is a follow-up (Supabase Storage or Vercel Blob). | PDFs stay out of git; nobody is available to set up a bucket. |
| D14 | **No DOI tonight.** Release `v0.0.1-prototype` is labelled "prototype, no DOI, not for citation in publications yet". Zenodo needs an account decision. | Cannot be done unattended. |
| D15 | **Supabase is not used tonight.** The site reads release files only. | Nothing in the prototype needs a live database. |
| D16 | **Stack:** Python 3.12 venv in `pipeline/`, `docling==2.119.0` pinned (proven to install on this machine), pydantic v2, pymupdf, pdfplumber, pyarrow, pandas, pytest; `pip freeze` → `pipeline/requirements.lock`. Site: Next.js 15 (App Router), TypeScript, Tailwind, fully static generation, a small chart component (Recharts or hand-rolled SVG). Node 24. | Known to work on this machine; simplest thing Vercel builds. |
| D17 | **Docling config:** full document, table mode `accurate`, OCR off (all ABS are born-digital), backend `docling_parse` (matches the August runs; the SOP text says pdfium — record the discrepancy), CPU, 8 threads. Config dict hashed (SHA-256) and stored with every run. Run id `{DOC}_{FY}__docling__full-document__run-{NN}`, never overwritten. | Reproducibility; consistency with tested settings. |
| D18 | **Exception for very long reports (LFS, >150 pages):** a page-range Docling run covering the whole section that holds the target tables plus a 3-page margin is permitted tonight, recorded as `run_mode: page-range` with the range, provided the located table does not touch the range boundary. The full-document run is queued as a follow-up in STATUS.md. | A 400-page report on CPU could take hours; the rule's purpose (don't cut tables) is preserved. |
| D19 | **Downloaded sources go to `C:\Users\Ali\Desktop\datalab-sources\<doc_type>\<period>\`** (`SOURCES_DIR`), a new folder outside the repo and outside ra-ship. Verified ra-ship files are copied there only when the official download fails, with origin recorded. The pipeline reads only from `SOURCES_DIR`. | ra-ship is read-only; shared storage isn't set up; `datalab fetch` re-creates this folder from the manifest on any machine. |
| D20 | **Label → series mapping is a hand-written dictionary** in `specs/<type>_labels.yaml`, written by the agent (permitted: categorical mapping) and validated by the sum checks. Unmapped rows stay as cells, never published. | AGENTS.md section 4. |
| D21 | **Series definitions and synonyms are drafted by the agent** and flagged `definition_status: draft` for human editing. | Permitted use. |
| D22 | **Demo metric:** nominal federal health expenditure (BE and RE) and **health as a share of total federal expenditure** (derived by code from checked values, formula recorded). Real terms only as Stretch with a documented splice across the 2019 CPI rebasing. The FY2010-11 → 2011-12 devolution break (18th Amendment) is marked on every ABS series. | Shares need no deflator; the splice is a methodological choice humans should confirm. |
| D23 | **The "report an error" link points to GitHub issues** on this repo (private for now; noted as an open question). | Placeholder until humans decide on public repo vs form. |
| D24 | **Page-level verification of every source file** (6.1) is mandatory before use; the site's source page shows the verification status. | Ali's explicit instruction: files must be real, official, accurate. |

---

## 4. Repository layout to create

```
AGENTS.md  CLAUDE.md  README.md  DECISIONS.md  STATUS.md  .env.example  .gitignore  .gitattributes
.github/workflows/ci.yml
docs/
  plans/2026-10-11-overnight-prototype.md     (this file)
  reports/2026-10-11-overnight-report.md      (running report, section 10.2)
  METHODS.md                                  (source for the site's methods page)
  SCHEMA.md                                   (human-readable data model)
schema/*.schema.json                          (exported from pydantic; test keeps in sync)
sources/
  manifest.csv                                (one row per source file; section 6.1)
  verification/<source_id>.json               (verification record per file)
  README.md
specs/
  abs.yaml  abs_labels.yaml                   (table locators, column layouts per edition, units, checks, label map)
  cpi.yaml  cpi_labels.yaml
  lfs.yaml  lfs_labels.yaml
thresholds/thresholds.yaml  thresholds/FROZEN.md
pipeline/
  pyproject.toml  requirements.lock  README.md
  datalab/  (package: schema.py register.py verify.py fetch.py profile.py extract.py validate.py coverage.py
             normalise.py locate.py map_series.py checks.py status.py render.py release.py gold.py cli.py)
  tests/    (pytest; fixtures/ with small synthetic Docling-shaped JSON, no PDFs)
gold/
  README.md  sample.csv (unlabelled)  label.html (local labelling page)  renders/ (copied page PNGs)
releases/
  v0.0.1-prototype/
    release.json  sources.json  series.json  observations.json  observations.csv  observations.parquet
    cells.json  cells.csv  checks.json  coverage.json
    pages/<source_id>/p<NNN>.png
    runs/<run_id>.manifest.json
    dataset_card.md  HOW_TO_REPRODUCE.md  CHANGELOG.md  ERRATA.md
site/   (Next.js app; reads ../releases at build time; see 6.13)
work/   (git-ignored: runs, renders, QA overlays, scratch)
```

Adjust names if you must, but then update `README.md`'s layout section and `STATUS.md` in the same commit.

---

## 5. Data model

Implement in `pipeline/datalab/schema.py` (pydantic v2), export JSON Schema to `schema/`, document in `docs/SCHEMA.md`. Values that are numbers are stored as **decimal strings** in JSON/CSV (`"2550000"`, `"12.34"`), never floats. Floats only in Parquet columns explicitly named `*_num`.

### Source (one row per original file)
`source_id` (`abs-fed-2025-26`, `cpi-pbs-2025-06`, `lfs-pbs-2024-25`), `doc_type` (`abs|cpi_monthly_review|lfs_annual_report|pes_chapter|sbp_easydata`), `publisher`, `jurisdiction` (`federal|pbs|sbp|...`), `title`, `period` (fiscal year or month), `role` (`core|corroboration|cross_source`), `landing_url`, `file_url`, `wayback_url`, `wayback_timestamp`, `retrieved_at`, `retrieved_via` (`official|wayback|ra-ship-archive`), `sha256`, `size_bytes`, `format`, `page_count`, `is_born_digital`, `language`, `verification_status` (6.1), `verification_record` (path), `notes`.

### Series (what a number measures)
`series_id` (dotted slug, e.g. `fed.exp.function.health`, `fed.exp.function.health.hospital_services`, `fed.exp.total`, `cpi.national.general`, `cpi.national.group.food`, `cpi.national.weight.food`, `lfs.lfpr.total.total`, `lfs.unemployment_rate.female.rural`, `lfs.employment_share.industry.agriculture.total.total`), `name`, `parent_id`, `dataset` (`abs|cpi|lfs`), `geo` (`pk`), `dims` (dict, e.g. `{sex: female, area: rural}`), `frequency` (`fiscal_year|month|survey_round`), `unit` (`PKR|index|percent`), `scale_factor` (e.g. `1000000` for "Rs. in million"), `definition` (plain language), `definition_status` (`draft|reviewed`), `synonyms[]`, `breaks[]` (list of `{at_period, kind, note}`), `source_doc_types[]`, `derived` (bool), `derivation` (formula + input series, only for derived series).

### Cell (one printed number in one file)
`cell_id` (`c_` + 12 hex of SHA-256 over `source_id|page|table_index|row_index|col_index`), `source_id`, `page` (1-based), `page_render_sha256`, `table_index` (within the page, Docling order), `table_bbox_norm` `[x0,y0,x1,y1]` top-left origin, 0–1, `cell_bbox_norm`, `row_index`, `col_index`, `row_span`, `col_span`, `row_label_raw`, `row_label_path[]`, `col_label_raw`, `col_label_path[]`, `value_raw` (verbatim text, never discarded), `value_parsed` (decimal string or null), `is_missing`, `missing_marker`, `normalization_flags[]` (`bracket_negative`, `unicode_minus`, `footnote_mark_stripped`, `percent_sign`, `merged_cell_suspected`, `title_text_suspected`, ...), `unit`, `scale_factor`, `series_id` (null if unmapped), `period`, `vintage`, `mapping_method` (`dictionary|unmapped`), `extractor_name`, `extractor_version`, `run_id`, `extract_config_sha256`, `structural_flags[]` (from 6.4), `second_reader` (null or `{name, version, value_raw, agreement}`).

### Observation (the fact)
`obs_id` = `{series_id}:{period}:{vintage}`, `series_id`, `period`, `vintage`, `value` (decimal string; the published value; from the core cell), `unit`, `scale_factor`, `primary_cell_id`, `supporting_cell_ids[]` (other readings of the same fact, e.g. the next edition's prior-year column), `check_ids[]`, `tier` (`A|B|C|D|E`), `status` (`checked|unchecked|disputed`), `published` (bool), `gap_kind` (null | `not_in_source` | `not_yet_verified` | `failed_checks`), `evidence_summary` (plain sentence generated by code from the checks, e.g. "One of 10 amounts that add to the printed total 17,573,000 for Current expenditure 2025-26 (BE), and they add exactly. Also equal to the figure printed in the 2026-27 edition."), `first_published_release`, `last_changed_release`.

### Check
`check_id` (`chk_` + 12 hex), `check_type` (`column_total|row_total|hierarchy_sum|cross_edition|cross_table|accounting_identity|cross_source|recompute|weights_sum|index_aggregation`), `dataset`, `source_ids[]`, `member_cell_ids[]`, `target_cell_id` (or `target_value` + `target_source` for cross-source), `expected` (decimal string), `observed`, `residual`, `tolerance_rule` (D9 text), `result` (`pass|pass_within_rounding|fail|not_evaluable`), `not_evaluable_reason`, `description` (plain words).

### Release
`version`, `created_at`, `git_commit`, `label` (`prototype`), `doi` (null), `scope` (datasets, sources, periods), `thresholds_sha256`, `tool_versions` (python, docling, docling_core, docling_parse, pymupdf, pdfplumber), `extract_config_sha256s`, `source_sha256s`, `counts` (sources, cells, observations published/unpublished by gap kind, checks by result), `coverage_summary`, `check_pass_rates` per dataset, `gold_set` (`status: pending_human_labelling`), `measured_error_rate` (null), `notes`.

### Run manifest (per Docling run)
`run_id`, `source_id`, `sha256_at_run`, `run_mode` (`full-document|page-range`), `page_range`, `tool_versions`, `config` (full dict), `config_sha256`, `started_at`, `finished_at`, `duration_s`, `pages_emitted`, `tables_emitted`, `errors` (count + path), `validated` (bool; set only by the validator), `validator_report` (path).

---

## 6. Pipeline, step by step

Build the CLI as `python -m datalab <command>` with these commands: `register`, `fetch`, `verify`, `profile`, `extract`, `validate`, `normalise`, `locate`, `map`, `check`, `status`, `render`, `release`, `coverage`, `gold-sample`, `all --dataset abs`. Each command reads/writes `work/` and `releases/` only, takes paths from `.env` (`RA_SHIP_DIR`, `SOURCES_DIR`, `WORK_DIR`), logs to `work/logs/`. Every command is idempotent except `extract`, which always creates a new run.

### 6.1 Register and verify sources (D24; Ali's instruction)
For every file you intend to use (9 ABS, 5 CPI, 5 LFS, plus cross-source PES chapters):
1. **Fetch from the official URL first** into `SOURCES_DIR/<doc_type>/<period>/<original filename>`. Record `landing_url`, `file_url`, `retrieved_at`, response headers (`Last-Modified`, `Content-Length`) in the verification record. Use a browser-like User-Agent, 60 s timeout, 3 retries with backoff. Be polite to PBS (one download at a time, 2 s pause).
2. **If the official URL fails**, query Wayback availability for the URL; download the snapshot; record `retrieved_via: wayback` and the snapshot timestamp.
3. **If both fail and a copy exists in ra-ship**, copy it to `SOURCES_DIR` with `retrieved_via: ra-ship-archive` and the ra-ship path in the record.
4. **For ABS, do both:** download the official file *and* hash the ra-ship copy; record whether they are identical. If they differ, use the official download, keep both hashes, and flag `reissued_or_differs` in the record and in the report.
5. **Content inspection, by code:** SHA-256, size, page count (`len(PdfReader(path).pages)`), PDF metadata (title, producer, creation date), text layer present on ≥95% of pages, and that the first three pages' text contains the expected markers from the spec (ABS: "Annual Budget Statement" and the fiscal year, "Government of Pakistan" or "Finance Division"; CPI: "Monthly Review" / "Price Indices" and the month-year; LFS: "Labour Force Survey" and the round). A marker miss is a hard failure: do not use the file; record why.
6. **Wayback save** of landing page and file URL (`https://web.archive.org/save/<url>`), best effort, record the resulting snapshot URL. Failures are noted, not fatal.
7. Write `sources/verification/<source_id>.json` and the row in `sources/manifest.csv`. `verification_status` is one of: `official_match_archive` (official download identical to ra-ship copy), `official_only`, `official_differs_from_archive`, `wayback_only`, `archive_copy_content_inspected`. Anything other than the first three is shown on the site's source page as a caveat.
8. The tiny 2010-11 and 2011-12 ABS files: confirm they are complete documents (contents page lists sections that all exist; the function table is present). If not complete, try the official/Wayback copy; if still incomplete, keep the edition as `role: corroboration` only and note it.

`datalab fetch` must be able to rebuild `SOURCES_DIR` on Ahmad's machine from `sources/manifest.csv` alone, verifying hashes. Test that path mentally; write `HOW_TO_REPRODUCE.md` from it.

### 6.2 Profile
Per PDF: born-digital vs scanned (fraction of pages with a text layer), ruled vs borderless tables (heuristic from PyMuPDF drawings on the target pages), language (ASCII ratio). Scanned > 20% → separate track = not processed tonight, gap `not_yet_verified` with reason `scanned`. Record in the run manifest.

### 6.3 Extract (Docling, fresh)
- Use the project venv's Docling (D16/D17). Record `docling --version` components and the Python version.
- Run via the Python API or the CLI, full document, JSON output (DoclingDocument) + markdown, into `work/runs/<run_id>/raw/`. Write the run manifest. **Do not create a completion marker; the validator does.**
- Run ABS editions sequentially in the background while you build the next steps. Expected: 2–6 minutes per ABS on CPU. If a run exceeds 25 minutes, note it and continue with the others.
- Learn the JSON structure from one August output first (table `prov[0].bbox` is **BOTTOMLEFT** origin; `data.table_cells[*].bbox` is **TOPLEFT**; page size at `pages[<n>].size`). Write the conversion once, test it with the overlay (6.4), never mix origins.

### 6.4 Validate structure and measure coverage
Per run: file hash unchanged; every page 1..N present exactly once; error log empty; pages with text layer. Detectors (flags on tables, from AGENTS.md section 7): missing leading serial/code column where sibling tables have one; merged rows (`\d[\d,]*\s{2,}\d[\d,]*` inside one cell); title text as data (`Table \d+`, `C-\d+`, `FY ?\d{2}`, `Q[1-4]`, `20\d\d-\d\d`, caption text); possible chart grid (page has a figure and numeric text outside any table). A table with `dropped_column` or `merged_rows` flags makes its sums `not_evaluable`, never `passed`.

**Coverage (D11):** for each located target table, take its bbox, list numeric tokens in that region from the page's text layer (PyMuPDF `get_text("words")`, filtered through the normaliser; exclude the header rows' year labels), and compare as a multiset against the normalised numeric cells Docling emitted for the table. `coverage = matched / printed`. Store per table in `coverage.json`. Threshold per D10.

**Overlay QA:** render the page at 144 DPI, draw every cell bbox and the table bbox, save to `work/qa/overlay_<source_id>_p<NNN>.png`, **look at it** (Read the image) for at least one page per document before trusting bboxes. Copy two representative overlays into `docs/reports/qa/` for the humans.

Only the validator writes `validated: true` into the run manifest.

### 6.5 Normalise
Port `compare_values.py` rules into `datalab/normalise.py` as `parse_printed(text) -> Parsed` and generalise:
1. U+2212, U+2013, U+2014, U+2015, U+00AD → `-`; NBSP → space; strip.
2. Typed missing markers (case-insensitive): `n.a.`, `na`, `n/a`, `nil`, `-`, `--`, `---`, `...`, `…`, `*`, `**`, empty, `not available`, lone dash → `is_missing=True`, `missing_marker` kept.
3. Fiscal-year labels (`19xx|20xx-yy`, `-yyyy`) masked before number parsing; flagged if a "value" is only a year.
4. `(1,234)` → `-1234`, flag `bracket_negative`.
5. Thousands commas and trailing `.` removed; `%` stripped with flag `percent_sign`; footnote marks (`*`, superscript digits, `(a)`, `†`) stripped with flag.
6. Two numbers in one cell → `value_parsed=None`, flag `merged_cell_suspected`.
7. Scale from table header or caption (`Rs. in million`, `Rs. in billion`, `(Million Rupees)`) → `scale_factor`; `%` columns → unit `percent`.
8. `Decimal` everywhere. `value_raw` always kept.
Tests: every rule, every known trap, `5.0 == 5`, the `"852  251,130"` case.

### 6.6 Locate tables and map labels
`specs/abs.yaml` per edition (fill as you go; one entry per FY, with a `default`):
- `table_locators`: heading regexes (e.g. `(?i)(current\s+)?expenditure.*(by\s+)?function|functional\s+classification`), the list of the ten COFOG-style function names with alternates (General Public Service(s); Defence Affairs (and|&) Services; Public Order (and|&) Safety Affairs; Economic Affairs; Environment Protection; Housing (and|&) Community Amenities; Health (Affairs (and|&) Services)?; Recreation(, Culture)? (and|&) Religion; Education Affairs (and|&) Services; Social Protection), minimum matches to accept (8 of 10), unit regex, column header patterns (`Budget\s+20\d\d-\d\d`, `Revised\s+20\d\d-\d\d`) → `(vintage, period)` per column.
- The locator scores every Docling table in the document and picks the best; ties or score below minimum → `not_found` → every series for that edition gets `gap_kind: not_in_source`? No: `not_yet_verified` with reason `table_not_located` (the government did publish it; we failed to find it). Log it.
- If the function table spans two pages, Docling full-document mode should merge it; if not, treat as two tables and join by header match; flag `multi_page_join`.
- `specs/abs_labels.yaml`: raw label (normalised: lowercase, collapse spaces, strip numbering like `01` / `(i)`) → `series_id`, with `level` (function or sub-function) and `parent`. Build it by reading the located tables' labels (that is a categorical mapping, permitted). Unmapped labels stay cells with `series_id: null`; list them in the report.
- Expected row-label hierarchy: ABS prints sub-functions indented under functions in most editions; use indentation/numbering or the spec's parent map to build `row_label_path`.

### 6.7 Checks (all deterministic, all in `datalab/checks.py`, all with tests)
| Check | ABS | CPI | LFS |
|---|---|---|---|
| column_total | each printed Total/Sub-total row equals the sum of its members, per column | — | employment by industry: total = sum |
| hierarchy_sum | sub-functions add to their function | — | — |
| row_total | if a Total column exists, equals the sum of sibling columns | — | male + female = total where printed as counts |
| cross_edition | BE(e) in edition e equals the "Budget e" column in edition e+1 | June index in issue Y equals "same month last year" in issue Y+1 | — |
| accounting_identity | current + development = total where both located | — | — |
| weights_sum | — | 12 group weights sum to 100 (tolerance 0.05) | industry shares sum to 100 (tolerance 0.1) |
| index_aggregation | — | general index = Σ(weight_i × index_i)/100 within rounding | — |
| recompute | — | YoY % = index_t/index_{t-12} − 1 within rounding | unemployment rate = unemployed/labour force when counts are printed |
| cross_source | vs Arslan's `subcodes_long.csv` (comparison only; disagreement is a note, never a fail) | vs SBP EasyData CPI (general, national); vs PES inflation chapter | vs PES labour chapter key indicators |
Tolerances per D9. Each check produces one `Check` record with a plain-language `description`. A failing sum makes every member `fail`-touched; a member is blamed only if an independent check isolates it; otherwise the whole set is held (AGENTS.md rule 10).

### 6.8 Status (pure function of evidence; `datalab/status.py`)
For each observation (from its primary cell and supporting cells):
- **D quarantined:** primary cell has `merged_cell_suspected`, `title_text_suspected`, or its table has `dropped_column`/`merged_rows` flags and no supporting cell agrees; **or** any check it belongs to is `fail` and no independent check passes for it.
- **A verified:** ≥1 arithmetic check (`column_total|hierarchy_sum|row_total|accounting_identity|weights_sum|index_aggregation|recompute`) passed **and** ≥1 `cross_edition` or `cross_source` (official) agreement.
- **B corroborated:** exactly one of those two kinds of evidence.
- **C single source:** no check covers it and no flags.
- Public: A, B → `checked`, `published: true`. C → `unchecked`, not published, `gap_kind: not_yet_verified`. D → not published, `gap_kind: failed_checks` (site wording: "we could not verify this figure; it is withheld").
Write the `evidence_summary` sentence from the checks.

### 6.9 Render pages
`datalab render`: for every page that holds a published or gap-explaining cell, render at 144 DPI with PyMuPDF to `releases/<v>/pages/<source_id>/p<NNN>.png`, store `page_render_sha256`. Keep total under ~40 MB; if larger, drop to 120 DPI.

### 6.10 Release
`datalab release --version v0.0.1-prototype` writes the folder in section 4 from `work/`. Rules: only `published: true` observations carry a `value`; unpublished ones are present with `value: null` and `gap_kind`. `release.json` holds everything in section 5. `dataset_card.md`: scope, counts, tier mix, coverage per table, check pass rates per dataset, "measured error rate: pending gold-set labelling", known limitations. `HOW_TO_REPRODUCE.md`: exact commands from a clean clone (`py -3.12 -m venv`, `pip install -r requirements.lock`, `.env`, `datalab fetch`, `datalab all --dataset abs`, `datalab release`), expected hashes of inputs, note which steps need the network. `CHANGELOG.md` and `ERRATA.md` with the first entries. A test asserts a release folder is self-consistent (every `obs.primary_cell_id` exists, every `check.member_cell_ids` exist, every page PNG referenced exists, thresholds hash matches `FROZEN.md`).

Also copy each run manifest into `releases/<v>/runs/` and the thresholds file hash into `release.json`.

### 6.11 Gold-set kit (for humans; you do not label)
`datalab gold-sample --n 400`: stratified over dataset × edition × table × (functions vs sub-functions vs totals), seeded (record the seed). Output `gold/sample.csv` (cell_id, source_id, page, bbox, row/col labels, `value_raw` **hidden**: don't include the extracted value, so labelling is blind), `gold/renders/` (page PNGs; reuse release renders), and `gold/label.html`: a static page that shows each cell boxed on its page, has an input for the human's reading, and exports a CSV. `gold/README.md`: the protocol (two labellers, blind, disagreements resolved against the page, never an LLM), and the freeze procedure (`gold_manifest.json` with SHA-256 after labelling).

### 6.12 Demo page and derived series
`derived` series are computed by code from **published** observations only, with `derivation` recorded: `fed.exp.function.health.share_of_total = health / fed.exp.total × 100` per period and vintage. Break marker on all ABS series at `2010-11→2011-12` (`kind: devolution`, note: 18th Amendment moved health and education functions largely to provinces; federal figures before and after are not comparable). CPI series carry `2019-08` rebase break (base 2007-08 → 2015-16). LFS 2024-25 is marked `check_comparability` unless the report states it is comparable.

Demo page `/demo/health-and-jobs`: health BE/RE nominal; health share of total; CPI June general index points (if done); LFS unemployment rate and participation rate by round (if done). Each chart point links to its receipt. One paragraph of plain words, every number in it from the release, with citations.

### 6.13 Site (`site/`)
- `npx create-next-app@latest site --ts --tailwind --app --eslint --src-dir --import-alias "@/*"`, no Turbopack flags that break build; commit `package-lock.json`.
- Data: `src/lib/data.ts` loads `../releases/<v>/*.json` at build time (`fs` in server components / `generateStaticParams`). A `prebuild` script copies `releases/<v>/pages` into `public/data/<v>/pages` (git-ignore `public/data`). Vercel builds from repo root with **root directory `site`**; `../releases` is available in the build container.
- Routes: `/` (what this is, the three datasets with status badges, demo link, disclaimer), `/browse` (by dataset → series tree; by document), `/series/[id]` (chart over periods, BE and RE as separate lines, break markers as vertical rules with a label, toggle nominal / share-of-total (/ real if Stretch), table of values with status badges and gap labels, CSV download with provenance columns, cite button, settings in the URL), `/o/[id]` (receipt: value as printed and parsed, unit and scale, vintage, series, period, the page render with the cell boxed via an absolutely positioned overlay from `cell_bbox_norm` plus a zoomed crop (CSS), the checks it took part in as sentences, status, source document details with hash, page, run id, extractor version; links to official URL and Wayback; cite in APA/BibTeX/RIS (two-part: original document + portal release); JSON receipt download), `/sources` and `/sources/[id]` (verification status and record, pages used, coverage per table, run manifest), `/methods` (rendered from `docs/METHODS.md` + live numbers from `release.json`), `/releases` (changelog, errata, "no DOI yet"), `/demo/health-and-jobs`, `/about` (team, licence CC BY 4.0 data / MIT code, disclaimer, report-an-error link).
- Every page: cite button, "checked" badge semantics explained on hover, labelled gaps, mobile layout (16 px gutters, no horizontal scroll), no client-side data fetching.
- Keep dependencies minimal. No analytics. No LUMS logo files (name in text only, pending sir's OK — say "LUMS Department of Economics DataLab (prototype)").
- `npm run build` must pass before you commit the site; run `npm run lint`.

### 6.14 CI (`.github/workflows/ci.yml`)
On push and PR: `ubuntu-latest`, Python 3.12, `pip install -r pipeline/requirements.lock` (if Docling makes CI too heavy, split a `requirements-ci.lock` without Docling and skip extraction tests in CI, note it), `pytest`, `python -m datalab check-release releases/v0.0.1-prototype` (re-runs checks over the release's cells, verifies thresholds and self-consistency; no PDFs needed), then `cd site && npm ci && npm run build`. Make it green before morning.

---

## 7. Source playbooks

### 7.1 ABS (federal Annual Budget Statement)
- Editions: core 2010-11, 2016-17, 2021-22, 2024-25, 2025-26; corroboration 2011-12, 2017-18, 2022-23, 2026-27.
- Each edition prints, for its function table, three columns: Budget (e−1), Revised (e−1), Budget (e). So edition e yields observations `(series, e−1, be)`, `(series, e−1, re)`, `(series, e, be)`. The `(series, e−1, be)` reading is a **supporting cell** of the observation whose primary cell is in edition e−1 (if we have that edition), else it is the primary.
- Primary cell rule: the earliest edition that prints the figure is primary for `be`; `re` is only printed once (in edition e+1).
- Units "Rs. in million" (confirm per edition from the header). Integers.
- Series: `fed.exp.function.<function_slug>` with children `.<subfunction_slug>`; `fed.exp.function.total` (the printed total row); if the table is split current/development, keep `fed.exp.current.function.*` and `fed.exp.development.function.*` and derive nothing across them unless the identity check passes.
- Comparison: Arslan's `subcodes_long.csv` (comparison only; report agreement rate, never a status input).

### 7.2 CPI (PBS Monthly Review of Price Indices)
- Target issues: June 2016, June 2018 (base 2007-08), June 2021, June 2023, June 2025 (base 2015-16). If an issue is unobtainable, take the nearest June that is; keep ≥2 pre-rebase and ≥2 post-rebase.
- Discovery: parse the PBS price page source for the monthly review data array (`item1.review`), or request `https://www.pbs.gov.pk/?page_id=7291` and search for `Monthly-Review-June2025.pdf`-style names under `/wp-content/uploads/2020/07/`; else Wayback snapshots of the old PBS CPI pages (`pbs.gov.pk/cpi`, `pbs.gov.pk/content/monthly-price-indices`); else the old-site file pattern via Wayback (`.../price_statistics/cpi/CPI_Review_June_2025.pdf` and variants). Record what you tried.
- Tables: national (and urban/rural post-2019) general index and the 12 COICOP group indices with weights, current month / previous month / same month last year, MoM and YoY %. Series: `cpi.national.general`, `cpi.national.group.<slug>`, `cpi.national.weight.<slug>`, plus `cpi.urban.*` / `cpi.rural.*` if printed. Period = `YYYY-MM`. Vintage `na`. Unit `index` (base recorded in `dims.base_year`) or `percent`.
- Checks: `weights_sum`, `index_aggregation`, `recompute` (YoY), `cross_edition` (same-month-last-year columns between issues 12 months apart, when both are in scope), `cross_source` vs SBP EasyData (fetch the CPI series CSV; record request URL, time, hash of the response under `SOURCES_DIR/sbp/`).
- Fallback if fewer than 3 issues are obtainable: PES inflation chapter tables (annual-average CPI by group) from ra-ship, registered as `pes_chapter` sources, published as a **different series** `cpi.national.general.fy_avg` with its own period type. Never mix June values and FY averages in one series.
- Check `CpI-Urban-Groupwise-Cumulative-Indices.pdf` early: if it carries multi-year group indices it is a strong cross-source.

### 7.3 LFS (PBS Labour Force Survey annual reports)
- Rounds and URLs in section 1. Expect 200–400 pages; apply D18 if needed: locate the "Key indicators" / "Labour force participation" and "Employed persons by major industry division" tables by text search first (PyMuPDF), then run Docling on that section ±3 pages, verifying the table does not touch the boundary.
- Series: `lfs.lfpr.<sex>.<area>`, `lfs.unemployment_rate.<sex>.<area>`, `lfs.employment_share.industry.<industry_slug>.<sex>.<area>` (sex ∈ total/male/female; area ∈ total/rural/urban). Period = survey round `2024-25`. Vintage `na`. Unit `percent`. Where the report prints counts (thousands), capture them too (`lfs.labour_force.<sex>.<area>` etc.) so the recompute check works.
- Checks: `weights_sum` on industry shares (100 ± 0.1), `recompute` where counts exist, `row_total` male+female=total for counts, `cross_source` vs PES labour chapter (2024-25 chapter on disk) and vs the preceding LFS report's "comparison with previous round" table if present.
- Mark 2024-25 `check_comparability` (new sampling frame after the 2023 census) unless the report says otherwise; never adjust.

### 7.4 Cross-source files on disk (register as `role: cross_source`)
PES 2024-25 `PES_inflation.pdf` and `PES_population_labor_force_and_employment.pdf` under `pbs-corpus/raw/federal/2024-25/`; PES library chapters under `Budget EDA/Budget EDA/data/pakistan_economic_survey/<FY>/`. Verify like any other file (6.1 steps 3, 5). Fresh Docling runs for the specific chapter PDFs are fine (they are small).

---

## 8. Milestones, order, time budget (≈10 h total; adjust, don't skip the order)

| # | Milestone | Budget | Done when |
|---|---|---|---|
| M0 | Setup | 0:30 | Check out `proto/v0` (exists); `.env` created locally (not committed) with `RA_SHIP_DIR=C:/Users/Ali/Desktop/ra-ship`, `SOURCES_DIR=C:/Users/Ali/Desktop/datalab-sources`, `WORK_DIR=./work`; this plan committed at `docs/plans/`; `STATUS.md` created (template 10.1); `docs/reports/2026-10-11-overnight-report.md` started; `DECISIONS.md` appended with D1–D24; `AGENTS.md`/`CLAUDE.md` amended (10.4); `thresholds/thresholds.yaml` + `FROZEN.md` written **now**, before any extraction; `pipeline/` venv created, Docling installed and `docling --version` recorded; draft PR opened (10.3); first push. |
| M1 | Sources | 1:00 | 9 ABS files fetched/verified per 6.1 with records; manifest rows; `datalab fetch` works from the manifest. Start CPI/LFS discovery in a subagent (track A) now. Kick off ABS Docling runs in the background as soon as the files are verified. |
| M2 | Schema + normaliser | 1:00 | Models, JSON Schema export, `docs/SCHEMA.md`, normaliser with tests, synthetic fixtures, pytest green, CI workflow committed. |
| M3 | Extract + validate + coverage | 1:00 | All 9 ABS runs finished and validated; overlays viewed; coverage per target table computed; failure detectors run. |
| M4 | Locate + map | 1:30 | `specs/abs.yaml`, `specs/abs_labels.yaml`; function tables found in every edition (or gap recorded); cells with series ids; unmapped labels listed. |
| M5 | Checks + status + release | 1:00 | All ABS checks run; statuses; renders; `releases/v0.0.1-prototype/` written and self-consistency test passes; `check-release` passes in CI. **README updated.** |
| M6 | Site | 1:30 | All routes in 6.13 on real release data; `npm run build` green; screenshots of home, a series page, a receipt page saved to `docs/reports/qa/`; **README updated with Vercel setup for Ali.** Site track (B) can start at M2 with fixture data and wire to the release here. |
| M7 | CPI | 1:00 | Issues collected and verified; spec; run; checks; added to release (new release build, same version, since nothing was published yet) and site. |
| M8 | LFS | 1:00 | Same for LFS. |
| M9 | Demo + derived | 0:30 | Derived share series; demo page; break markers verified visually. |
| M10 | Handoff | 0:30 | Gold kit; final report with morning checklist; `STATUS.md` final; PR description final; ClickUp comment; last push. |

Push at the end of every milestone and at least hourly in between. If you are at M5 with less than 2 hours left, go straight to M6 then M10.

---

## 9. Parallel tracks with subagents

Use git worktrees (`git worktree add ../lums-datalab-portal-<track> proto/v0-<track>`), one subagent per track, each with a written brief that includes the relevant sections of this plan and AGENTS.md. **Only the lead merges into `proto/v0`**, after running `pytest` and (if site touched) `npm run build`. Small, frequent merges. Subagents never push to `proto/v0` directly and never touch files outside their track without telling the lead.

- **Track A, sources (start at M1):** CPI and LFS discovery and download per 7.2/7.3 and 6.1; SBP EasyData CPI pull; PES chapter registration; verification records; Wayback saves. Deliverable: manifest rows + verification JSONs + files in `SOURCES_DIR` + a short findings note (what was unobtainable and what was tried).
- **Track B, site (start after M2's schema is committed):** scaffold the Next.js app against fixture data in the schema format (generate a tiny fake release under `site/fixtures/` from the schema; mark it clearly as fake and never deploy it), build all routes, then switch to `releases/v0.0.1-prototype` at M6. Deliverable: building site, lint clean.
- **Track C, CPI pipeline (after M5):** spec, locator, checks for CPI using Track A's files.
- **Track D, LFS pipeline (after M5):** same for LFS.
- **Lead:** M0, M2 pipeline core, M3–M5, integration, releases, reporting, merges.

If subagent tooling is unavailable, do the tracks sequentially in the milestone order.

---

## 10. Recording and reporting (do these as you go)

### 10.1 `STATUS.md` (repo root; the self-updating map for every future agent)
Create in M0; update at every milestone and whenever a path or state changes. Keep under 120 lines. Template:

```markdown
# STATUS

Last updated: <ISO timestamp> by <agent/human> on branch <branch>

## State in one paragraph
<what works end to end right now, what is in progress, what is broken>

## Where things are
| What | Path | Notes |
(pipeline, specs, sources manifest, releases, site, docs, reports, work/)

## Datasets
| Dataset | Sources verified | Extracted | Located | Checked | Published | Coverage | Check pass rate | Notes |

## How to run (short)
<3–6 commands>

## Open questions for humans
- ...

## Queued follow-ups
- ...

## Known traps learned tonight
- ...
```
Add to `AGENTS.md` section 1 and `CLAUDE.md`: "Read `STATUS.md` first; keep it current in every PR."

### 10.2 `docs/reports/2026-10-11-overnight-report.md` (for Ali and Ahmad)
Append-only log with timestamps per milestone: what was done, the numbers (sources verified by status, runs and durations, coverage per table, cells, observations by tier, checks by result, unmapped labels, what was withheld and why), decisions made beyond section 3, blockers and fallbacks taken, what was cut. Final section **"Morning checklist for Ali"** (10.6) and **"For Ahmad"**. Include links to the PR, the QA overlays and screenshots. Plain language; no hedging; if something failed, say it failed and show the error.

### 10.3 Pull request
Open in M0: `gh pr create --draft --base main --head proto/v0 --title "Prototype v0: ABS, CPI, LFS pipeline, release and site" --body-file <file>`. Body: purpose, link to the ClickUp task `https://app.clickup.com/t/86eyudf64`, link to this plan, the "ready when" checklist from AGENTS.md section 8 with boxes ticked as you go, a changelog you update at each milestone (`gh pr edit --body-file`), how to verify (commands), what is provisional, what is left. End with the attribution lines your session instructions require.

### 10.4 `AGENTS.md` and `CLAUDE.md`
The planning session already amended both and committed them on `proto/v0` together with this plan: `AGENTS.md` has a new section 9 "Autonomous mode" (Reference material is now 10, Current focus 11) and a `STATUS.md` pointer in section 2; `CLAUDE.md` points to `STATUS.md` and this plan. During the night:
- Add any new trap you learn to `AGENTS.md` section 7 (coordinates, Docling quirks, PBS site behaviour, Windows path issues).
- Update section 11 "Current focus" and the layout/commands wherever they drift from what you actually built. Keep `CLAUDE.md` consistent.

### 10.5 `README.md`
Update after M5 (release exists), M6 (site exists; add "Deploying on Vercel: root directory `site`, framework Next.js, build `npm run build`, Node 24"), M7/M8 (data types status table), M10 (status line at the top, quick start, how to reproduce). Keep the mission and the trust features; fix the layout section to match reality.

### 10.6 ClickUp (if `clickup_*` tools are available; otherwise skip and say so in the report)
Post a comment on task `86eyudf64` at M5, M6 and M10 with a 10-line summary and the PR link. At M10, also update only the first line of the description ("Status as of 2026-10-12: …") if your tools allow editing the description without risking the rest; otherwise leave it and put the line in the comment. Don't create new ClickUp tasks.

### 10.7 Commits
Small, focused, messages say why. Group by milestone. Never commit `.env`, `work/`, PDFs. End each message with the attribution lines your session gives you. Push `proto/v0` after each milestone; `git push -u origin proto/v0` the first time.

---

## 11. Decision protocol during the night
1. Is it covered by AGENTS.md sections 3–4? Then there is no decision; follow the rule.
2. Is it in section 3 of this plan? Apply it.
3. Otherwise pick the option that is reversible, smallest, and closest to the plan; implement; append a line to `DECISIONS.md` ("provisional (unattended, 2026-10-11)") and to `STATUS.md` → Open questions; mention in the report.
4. Never spend more than 20 minutes stuck. Take the fallback from section 12 or mark a gap and continue.

---

## 12. Risks and fallbacks

| Risk | Signal | Do this |
|---|---|---|
| Docling install fails in the 3.12 venv | pip errors, torch wheels | Try `py -3.13 -m venv` with `docling==2.119.0`; else use the existing venv's interpreter at `ra-ship\ABS_PES_PBS_Extraction_Test\02_tool_runs\.envs\docling\Scripts\python.exe` **read-only** (don't install into it); record versions; note in DECISIONS. |
| Docling model download needed and slow | first run stalls >15 min | Let it finish once; it caches. Meanwhile build the normaliser and schema. |
| Coordinate origins wrong | overlay boxes don't sit on numbers | Fix the conversion (table bbox BOTTOMLEFT → flip with page height; cell bbox TOPLEFT). Re-view the overlay. Don't render receipts until the overlay is right. |
| Function table not located in an edition | locator score < minimum | Try alternates: search markdown output for headings; inspect the page list for the ten function names; adjust the spec for that edition. If still not found in 20 min, record `table_not_located` gap, continue. |
| Docling dropped a column | coverage < 90% or detector flag | Table → `not_evaluable`; values from it unpublished; note it; if time, route pdfplumber second reader (Stretch). |
| PBS site blocks or times out | 403/timeouts | Wayback availability API → snapshot. Then PES fallback (7.2/7.3). Record all attempts in the verification record. |
| Older ABS official URLs dead | 404 | Wayback; else ra-ship copy with `archive_copy_content_inspected`. |
| LFS reports huge | page count > 150 | D18 page-range run; queue full run in STATUS.md. |
| Next build fails on Vercel-specific things | local build fine, lint errors | Keep to defaults; no experimental flags; `next.config` minimal. Local `npm run build` green is the bar. |
| Git worktree merge conflicts | conflicts in shared files | Lead merges only; subagents avoid editing `STATUS.md`/`README.md` (they report to the lead instead). |
| Running out of time | < 2 h left and not at M6 | Finish M5 → M6 minimal (home, series, receipt, methods) → M10. Cut CPI/LFS to "sources collected and verified" only, documented. |
| Something needs a human | credentials, account, policy | Don't work around it. Write it in STATUS.md → Open questions and the morning checklist. Continue with the rest. |

---

## 13. Morning checklist you must write for Ali (fill with real values at M10)
1. Pull `proto/v0`; read `STATUS.md` and the report; open the PR.
2. Create the Vercel project: import repo, root directory `site`, framework Next.js, production branch `main`, preview on `proto/v0`. Expected build time and any env vars (none expected).
3. Review and confirm/overturn each provisional decision (D-list in `DECISIONS.md`).
4. Label the gold set with Ahmad (`gold/README.md`, ~1 h for 400 cells between two people), then run `datalab gold-score` (write it if time; else leave the stub) to get the error rate.
5. Spot-check 10 receipts against the PDFs.
6. Queued follow-ups from `STATUS.md` (full-document LFS runs if D18 was used; DOI; PDF hosting; repo org move; branch protection + required CI; public repo decision for the error link).
7. What to tell sir (one paragraph the agent drafts from the release numbers, every figure cited to a receipt URL).

---

## 14. Improvements over the baseline plan, and why (for the record)
- Cell/Observation split with semantic observation IDs (D2–D3): permanent links that survive re-extraction; the cross-edition check becomes a first-class relation.
- Neighbour editions as corroboration (D6): every core year gets an independent cross-edition check instead of one pair.
- Deterministic coverage per table (D11): "how much we captured" reported tonight, separately from "how much is right".
- Page render + overlay instead of pre-cut crops (D12): fewer, reproducible artifacts; the site draws the box from data.
- Share-of-total as the demo's second axis (D22): answers the demo question without a deflator decision nobody can make tonight.
- Gold-set kit (6.11): turns tomorrow's human hour into a measured error rate.
- Frozen thresholds in M0 (D10): the integrity promise is kept even under time pressure.
- `STATUS.md` + append-only report + PR changelog: any agent or human can resume without this conversation.
- `datalab fetch` from the manifest: Ahmad's machine reproduces the sources without shared storage.
- Source verification records (6.1): every file's authenticity is evidenced, not assumed, and shown on the site.

---

## 15. Start here (M0, literal first steps)
```powershell
cd C:\Users\Ali\Desktop\lums-datalab-portal
git checkout proto/v0        # branch already exists and is pushed; this plan and the AGENTS/CLAUDE amendments are its first commit
git pull
# .env (not committed)
# RA_SHIP_DIR=C:/Users/Ali/Desktop/ra-ship
# SOURCES_DIR=C:/Users/Ali/Desktop/datalab-sources
# WORK_DIR=./work
mkdir C:\Users\Ali\Desktop\datalab-sources
py -3.12 -m venv pipeline\.venv
pipeline\.venv\Scripts\python -m pip install --upgrade pip
pipeline\.venv\Scripts\python -m pip install "docling==2.119.0" pydantic pymupdf pdfplumber pyarrow pandas pytest pyyaml python-dotenv requests
pipeline\.venv\Scripts\python -m pip freeze > pipeline\requirements.lock
pipeline\.venv\Scripts\docling --version
```
Then: thresholds + FROZEN.md → STATUS.md → report file → DECISIONS.md lines → AGENTS/CLAUDE amendments → commit → `git push -u origin proto/v0` → draft PR → M1.

Go.
