# AGENTS.md

Instructions for every coding agent (Claude Code, OpenCode, or any other) and every human working in this repo. Read the whole file before making changes. If something here conflicts with a request, stop and say so instead of guessing.

---

## 1. What this project is

The **LUMS DataLab Portal** is an open research bank of Pakistan's economic and fiscal data, published under the LUMS Department of Economics. Think "World Bank DataBank for Pakistan": researchers find a series, chart it, download it and cite it.

What makes it different is that **every number can be checked**: it links to the exact spot on the government page it came from, it has passed deterministic checks, and it can be cited permanently. Because it carries the LUMS name, **a wrong number on the site is the worst possible outcome**. A missing number shown as a labelled gap is acceptable; a wrong number is not.

See `README.md` for the full project description.

## 2. Who works here and how

- Two RAs, **Ali** and **Ahmad**, direct the work. **Agents write the code and build the site.** Humans decide, write specs, review output, check values against source pages, and sign off.
- Ali works with Claude Code; Ahmad works with OpenCode. Each side's agents and humans review the other side's pull requests. Different models make different mistakes, so cross-review is deliberate.
- Planning lives in ClickUp (DataLab list, "Citizen-facing portal"). That task description is the planning baseline. Code and review live here.
- **When a decision is needed, ask a human.** Don't invent scope, thresholds, series definitions or check tolerances.

## 3. Non-negotiable rules

1. **Every number traces to its source** (file + page + position on the page, or file + sheet + cell), or it doesn't publish.
2. **Nothing publishes without passing its checks.** Unchecked or failed values show on the site as labelled gaps.
3. **Every gap says which kind:** "not published by the government" vs "not yet verified by us". Never the same symbol for both.
4. **Every figure says what it is:** budget estimate / revised estimate / actual / provisional / rebased.
5. **Corrections are public and citations never break.** Frozen versioned releases, an errata page, never a silent change.
6. **Anyone can rebuild it from the raw sources** using the manifest and the code.
7. **No LLM ever writes a published number or decides whether it passes.** (Section 4.)
8. **Never read a value off a chart** (bar, line, pie). A data table printed under or beside a chart is an ordinary table and *should* be extracted.
9. **Never report coverage and accuracy as one number.** "How much of the page we captured" and "how much of what we captured is right" are always separate.
10. **Never guess.** If a sum fails and nothing independently points to one bad value, hold back the whole set. If a label is ambiguous, flag it.

## 4. Where LLMs may and may not be used

Extraction tools (Docling, pdfplumber, Camelot) misread silently but don't invent numbers. LLMs can invent numbers. So the boundary is structural.

**Prohibited**

- Sending a page or table to an LLM to "read the numbers" for the dataset.
- An LLM writing any `value_parsed` / normalised value, or any published value.
- An LLM assigning or upgrading a check status or confidence tier.
- Reading values off plotted chart marks.
- An LLM labelling the gold set.

**Permitted**

- Writing and reviewing code (that's your job here).
- Mapping raw row labels to series / categories. The output is categorical and is then validated by the arithmetic checks.
- Drafting plain-language series definitions and search synonyms, edited by a human.
- Choosing between candidate values that the extraction tools *already produced*, as multiple choice only (`candidate A`, `candidate B`, `neither`, `unreadable`). The choice must then pass the failing check, or it goes to a human.
- An out-of-pipeline blind audit of rendered pages to *measure* what extraction missed. Its output is a report. It never writes into the dataset.

## 5. Data flow

```
register → profile → extract → validate structure → normalise → arithmetic checks → second reader (if needed) → status → publish
```

Based on the extraction procedure tested in August 2026 (`TEST2_PROTOCOL_AND_SOP.md`, section 4). In short:

1. **Register:** compute SHA-256, record the file in `sources/manifest.csv`. Source files are read-only forever.
2. **Profile:** born-digital or scanned, ruled or borderless tables, Urdu or English. Scanned documents go to a separate track. Don't continue on the normal track if more than 20% of pages are scanned.
3. **Extract:** Docling on the **full document, never chunked** (chunking breaks multi-page tables). Accurate table mode. Record the config hash. Run IDs look like `{DOC}_{FY}__docling__full-document__run-{NN}`; **never overwrite a run, increment NN.**
4. **Validate structure:** file hash unchanged, every page accounted for exactly once, error log empty, plus the Docling failure detectors in section 7. **The extraction step never marks its own run complete; only the validator does, after every check passes.**
5. **Normalise:** Decimal-based. Keep the printed text verbatim beside the parsed value, always.
6. **Arithmetic checks:** the main correctness signal (section 6).
7. **Second reader**, only where routed: pdfplumber word geometry for borderless tables, Camelot for ruled tables. GMFT only to ask "did Docling miss a table here?", never as evidence for a value.
8. **Status:** a pure function of stored evidence. Deterministic and reproducible. Never assigned by an LLM.
9. **Publish:** Parquet + CSV + provenance sidecar, plus a dataset card stating the status mix and measured error rate.

Spreadsheets and API data skip profile/extract/structure/second-reader but go through normalise, checks, status and publish with the same provenance (sheet + cell or request URL instead of page + box).

## 6. Checks

| Check | What it tests |
|---|---|
| Column total | Rows labelled Total / Sub-total equal their members |
| Row total | A Total column equals the sum of its sibling columns |
| Hierarchy sum | Sub-items add to their parent |
| Cross-edition | The same figure printed in two editions agrees (this year's budget estimate = next year's "prior year" column) |
| Cross-table | A summary-table value matches the detail table |
| Accounting identity | Current + development = total; revenue − expenditure = deficit |
| Cross-source | Agrees with another official publication; disagreements explained, not hidden |
| Recompute | Rates and percentages recompute from their parts |

- A passing sum corroborates every number in it at once.
- **A passing sum on a table that lost a column is not reassurance.** Coverage is measured separately for this reason.
- Values flagged as title text are excluded from sums rather than allowed to break them. Tables flagged for dropped columns or merged rows get `not_evaluable`, not `passed`.
- Public statuses: **checked / unchecked / disputed.** Internally keep the tiers A verified, B corroborated, C single source, D quarantined (never published), E human-resolved.
- **Gold set:** about 400 cells hand-labelled by the RAs against page crops. The only source of an absolute error rate.
- **Thresholds** live in `thresholds/` and are frozen before results are seen. Never edit a threshold after seeing results; record a deviation instead.

## 7. Known traps (read before touching extraction)

- **Docling's real failure mode is missing data, not misread digits.** In August tests it read about 98% of emitted values correctly, but on one ABS page it dropped a whole column (only 67% of values captured). Detect these from its own output:
  1. a missing leading serial/code column that sibling pages have;
  2. merged rows: one cell holding two numbers (`"852  251,130"`);
  3. title text parsed as data (values matching `Table \d+`, `C-\d+`, `FY ?\d{2}`, `Q[1-4]`, `20\d\d-\d\d`, or text in the caption);
  4. data grids printed under charts that weren't extracted.
- **Coordinate trap:** Docling's table bbox uses a BOTTOMLEFT origin; per-cell bboxes in `data.table_cells` use TOPLEFT. Page height is at `pages[<page_no>].size.height`. Mixing them silently produces garbage.
- **Normalisation:** reuse and generalise the tested `compare_values.py` (path in section 9), don't rewrite it. It handles unicode minus, en/em dashes, bracketed negatives, typed missing markers (`n.a.`, `nil`, `—`), `5.0` vs `5`, and fiscal-year masking. Still to add: scale factors from headers ("Rs. in million") and `%` / footnote marks.
- **Arslan's old ABS pipeline** used pdftotext, not Docling, and has known defects: Health dropped in 16 of 17 years (`extract_text_tables.py:79`), merged rows for FY2024-27, missing Sales Tax in FY2023-24, wrong page numbers. Use its outputs **only to compare against**, never as a source.
- **Registry page counts are empty** because of a bug in the old manifest script: `len(PdfReader(path))` must be `len(PdfReader(path).pages)`.
- **PES 2025-26 p.135** is an unresolved sign/column question from the August tests. Don't pick a winner; it belongs in the gold set.
- **Series breaks:** 18th Amendment / 7th NFC (FY2010-11), CPI rebased to 2015-16 (2019), GDP rebased to 2015-16 (2022). Mark them; never smooth across them.

## 8. Working conventions

- **Branch + pull request** for every change. No direct pushes to `main`. The other RA reviews.
- **CI runs the checks on every PR**; failing checks block merging.
- **Commits:** small and focused, with messages that say why. Put the ClickUp task link in the PR description.
- **No source files in git.** No PDFs, Excel source files or raw API dumps. They live under `SOURCES_DIR` and are referenced by the manifest. Tiny test fixtures need explicit sign-off.
- **Never write to `SOURCES_DIR`** or anywhere in the `ra-ship` archive. Read only.
- **Local processing output goes in `work/`** (git-ignored). Only frozen releases leave it.
- **Secrets only in `.env`**, never committed, never printed in logs or PR descriptions.
- **Paths:** use `pathlib` and read locations from environment variables. The RAs are on different machines; no hard-coded absolute paths, no backslash string paths.
- **Python:** pin dependencies; record the environment choice in `DECISIONS.md`.
- **Tests:** every check, normaliser rule and detector gets tests, including the known hard cases above.
- **Spot checks:** after any extraction change, pull random values and have a human compare them to the PDF page before trusting the output.
- **Decisions:** anything that changes direction gets one line in `DECISIONS.md` with the reason.
- **Keep this file current.** If you learn a new trap or a rule changes, update this file in the same PR.

### A PR is ready when

- [ ] Tests pass and CI checks pass
- [ ] No published value was produced or altered by an LLM
- [ ] Provenance fields are filled for every new value
- [ ] Coverage and accuracy are reported separately where relevant
- [ ] No source files, secrets or absolute paths committed
- [ ] `DECISIONS.md` / `AGENTS.md` updated if a rule or decision changed

## 9. Reference material

The previous RAs' work and the source corpus live in the `ra-ship` archive (`RA_SHIP_DIR` in `.env`). Paths below are relative to it. Read-only.

| What | Path |
|---|---|
| Corpus index (363 fiscal documents) | `04_Research_Outputs/Deliverables/SOURCE_CORPUS_CATALOGUE.md` |
| Registry / manifest of fetched documents | `Agent Files/RA_WORKSPACE/02_sources/pbs-corpus/manifest.csv` |
| Where each kind of official data is published | `Agent Files/notes/OFFICIAL_GOVERNMENT_SOURCE_MAP.md` |
| **Extraction procedure (the SOP this pipeline implements)** | `04_Research_Outputs/Deliverables/TEST2_PROTOCOL_AND_SOP.md` |
| Extraction tool test results | `04_Research_Outputs/Deliverables/EXTRACTION_TOOLSTACK_REPORT.md`, `ABS_PES_PBS_Extraction_Test/04_verification/FINAL_TOOL_RECOMMENDATION.md` |
| Tested normaliser to reuse | `ABS_PES_PBS_Extraction_Test/04_verification/vision_baseline_key/compare_values.py` |
| pdfplumber second-reader logic to reuse | `Arsalan Archive/Archive/Budget Statements/verify_both.py` |
| Existing Docling run script | `ABS_PES_PBS_Extraction_Test/02_tool_runs/scripts/run_docling_full_pdf.ps1` |
| Portal design ideas | `04_Research_Outputs/Deliverables/PORTAL_DESIGN_BRIEF.md` |
| Audit of Arslan's old ABS prototype | `04_Research_Outputs/Deliverables/PORTAL_AUDIT_FINDINGS.md` |
| Arslan's ABS dataset (13,248 rows, comparison only) | `Arsalan Archive/Archive/ABS Dataset/files/subcodes_long.csv` |
| ABS PDFs | `Arsalan Archive/Archive/Budget Statements/budget_docs/<FY>/abs_fy_<FY>.pdf` |

## 10. Current focus

**First prototype:** federal ABS (2010-11, 2016-17, 2021-22, 2024-25, 2025-26), CPI and Labour Force Survey, 5 years each, end to end: schema → process → check → cite → source snippet → site.

- ABS PDFs are all born-digital (text layer present). Page counts: 29, 33, 50, 59, 54. The function-wise expenditure table sits on a different page each year; locate it per edition.
- CPI and LFS source files are being collected; they'll appear in the manifest.
- Open decisions (ask before assuming): function level only or one level down; how to display a line present in some years but not others.

Order matters: **schema → process → check → cite → site.** Don't build site features ahead of checked data; use sample data in the schema format if the UI needs something to render.
