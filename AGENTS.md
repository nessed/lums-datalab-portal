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
- `STATUS.md` at the repo root is the map: what exists, where it is, what state it is in, what is open. Read it first; update it in every PR.
- **When a decision is needed, ask a human.** Don't invent scope, thresholds, series definitions or check tolerances. The one exception is an authorised unattended run (section 9).

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

1. **Register:** download from the official URL (Wayback, then the archive copy, as fallbacks), inspect the content by code, compute SHA-256, write `sources/manifest.csv` and `sources/verification/<source_id>.json`. Source files are read-only forever. A file whose verification status is `failed` is never used.
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
- **Docling on Windows without MSVC:** every page fails with `InvalidCxxCompiler: cl is not found` because torch tries to compile. `datalab extract` sets `TORCHDYNAMO_DISABLE=1` (in the hashed config). Run 01 of ABS 2010-11 is the recorded failure.
- **Docling glues wrapped headings onto the next row.** In ABS 2025-26 the row label comes out as `Account General Public Services` and `Development Expenditure c. Dev. Exp. on Revenue Account`. Numbers are fine; labels are not. The label dictionary (`specs/abs_labels.yaml`) lists these prefixes explicitly, and the sum checks validate the mapping.
- **Docling column headers are unreliable** (`Estimates 2024-25` with "Budget"/"Revised" lost). Column year and vintage are read from the PDF text layer by position (`datasets/common.column_header_text`) and must match what the edition is expected to print.
- **The ABS function lines are current expenditure on revenue account only.** The Summary of Expenditure does not print development spending by function. Never label them "expenditure on health" without that qualifier.
- **ABS covers:** 2010-11 has no cover page in the file and 2017-18's cover is an image, so the title cannot be read from the text layer. Pages 2, 4, 6 of newer editions are blank. See the verification records.
- **Wayback:** the availability API (`archive.org/wayback/available`) returns nothing for most of these PDFs; the CDX index (`web.archive.org/cdx/search/cdx`) works and carries a SHA-1 digest that can be compared with the local file.
- **Git Bash heredocs** choke on some multi-byte characters; write long text files with a file tool or Python, not `cat <<EOF`.
- **"No text layer" is not "scanned", and a blank page is neither.** PBS monthly reviews carry chart pages that are images and a blank page. The scanned fraction is measured over printed pages and counts image pages only (`extract.profile_pdf`, same definition as `sources.inspect_pdf`). Counting the blank page had refused the June 2021 CPI issue.
- **Docling merged rows and lost a column in the June 2021 CPI urban and rural tables** (7 value columns instead of 8). The detectors flagged both and everything from them is withheld. This is the failure mode at the top of this section, seen for real.
- **CPI on the 2007-08 base prints one table with no national/urban/rural label.** Its series carry no area segment (D27): `cpi.general.b2007_08`, `cpi.group.<slug>.b2007_08`, `cpi.weight.<slug>.b2007_08`, `cpi.yoy.*.b2007_08`, `cpi.mom.*.b2007_08`, with `dims.area_as_printed: "none stated"` and no `dims.area`. Never file them under `cpi.national.*` or `cpi.urban.*`, and never pair them with a 2015-16 base issue. The table prints the same 12 group names as the 2015-16 base (weights differ) with three label spellings across issues; all are in `specs/cpi_labels.yaml`.
- **Docling merged the two % change columns of the June 2019 CPI table into one cell per row** (7 value columns instead of 8; `merged_rows` + `dropped_column`). Token coverage was still 142/142, because both numbers survive inside the merged cell: **coverage cannot see a lost column boundary, only the detectors can.** Everything from that table is withheld.
- **A run refused by the scanned-page rule has an empty `raw/` folder.** It cannot be re-validated after the rule changes; make a new run (CPI 2016-06 and 2019-06 are run-02 for this reason).
- **The session scratch folder is shared by parallel agents:** another track overwrote a probe script with the same file name. Use a per-track subfolder.
- **Docling marks a first data row as a header row** (CPI Rural "General" row; LFS full-width block heading "Pakistan"). Never let row meaning depend on the header flag alone; `datasets/cpi.py` accepts such a row only when every value column holds exactly one number, and the checks then validate it.
- **Header cells span down into data rows** (CPI "No"/"Group"); build a row label only from cells that start in that row.
- **CPI column headers:** the month is printed three ways ("June 25", "Jun 23", "June" above "2016"), and a % change column's header month is the comparison month, not the observation month.
- **The file PBS serves as "LFS 2014-15" is the Azad Jammu & Kashmir edition.** Verification now fails it by a content marker (`markers_none` in `sources/plan.yaml`). Check cover text, never a file name.
- **LFS 2024-25 prints nearly every table twice (13th and 19th ICLS definitions)**, sometimes on one page. Only 13th ICLS tables are mapped, to stay on one definition across rounds.
- **LFS title matching needs word boundaries:** "Unemployed - Pakistan and Provinces" contains "employed - Pakistan and Provinces"; bare "Rural"/"Urban" row labels repeat for every province and mean something only inside their block.
- **Docling page-range runs keep the original page numbers**, so receipts need no offset. A page-range run never supplies its first or last page.
- **Shared work folder:** tracks that share `work/` must not share log file names, and `datalab release` picks up every dataset found in `work/datasets/`; use `--dataset` to limit it.
- **Series breaks:** 18th Amendment / 7th NFC (FY2010-11), CPI rebased to 2015-16 (2019), GDP rebased to 2015-16 (2022). Mark them; never smooth across them.

## 8. Working conventions

- **Branch + pull request** for every change. No direct pushes to `main`. The other RA reviews.
- **CI runs the checks on every PR**; failing checks block merging.
- **Commits:** small and focused, with messages that say why. Put the ClickUp task link in the PR description.
- **No source files in git.** No PDFs, Excel source files or raw API dumps. They live under `SOURCES_DIR` and are referenced by the manifest. Tiny test fixtures need explicit sign-off.
- **Never write anywhere in the `ra-ship` archive.** Read only. `SOURCES_DIR` is a separate folder outside the repo; only `datalab register` and `datalab fetch` write to it (downloads recorded in the manifest). Never edit, rename or hand-place a file there: a source enters through `sources/plan.yaml` and `datalab register`, or not at all.
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

## 9. Autonomous mode (unattended runs authorised by a human)

A human may authorise an agent to work unattended against a written plan committed under `docs/plans/`. In that mode:

- Sections 3 and 4 do not bend. Ever. A value is still only ever produced by extraction tools and judged by code.
- The agent may settle open questions **outside** sections 3 and 4 by taking the smallest reversible option consistent with the plan. Each such decision goes into `DECISIONS.md` as "provisional (unattended, <date>)" and into `STATUS.md` under "Open questions for humans". Humans confirm or overturn them afterwards.
- Work happens only on a `proto/*` branch with a draft PR open against `main`. Never push to `main`.
- `STATUS.md` and the run report under `docs/reports/` are kept current at every milestone, so anyone can resume without the agent's conversation.
- Anything that needs credentials, accounts or policy is written down for a human, not worked around.
- New traps learned go into section 7 in the same PR.

Current authorised run: `docs/plans/2026-10-11-overnight-prototype.md` (authorised by Ali, 2026-10-11).

## 10. Reference material

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

## 11. Current focus

**First prototype (built 2026-10-11, branch `proto/v0`, release `v0.0.1-prototype`).** Read `STATUS.md` for the exact state.

- **ABS:** 9 editions (2010-11, 2011-12, 2016-17, 2017-18, 2021-22, 2022-23, 2024-25, 2025-26, 2026-27), the Summary of Expenditure table, published. The function lines are current expenditure on revenue account.
- **CPI:** June issues 2021 and 2023 to 2026 (base 2015-16), national, urban and rural group tables, published (two 2021 tables flagged and withheld). June 2016 and 2018 (base 2007-08) are processed as a separate, area-less set of series (D27); June 2019 is extracted but its table is flagged and withheld.
- **LFS:** 4 reports processed (2017-18, 2018-19, 2020-21, 2024-25, the long ones as page-range runs), **not published**: cross-edition agreement is below the frozen threshold. The site shows it as "coming".
- A new data type is a spec (`specs/<type>.yaml`, `specs/<type>_labels.yaml`) plus a builder in `pipeline/datalab/datasets/` that ends in `common.save_dataset`; `datasets/abs.py` is the model. Status, release and the site need no change.
- Next: human review of the provisional decisions, gold-set labelling, then the decisions listed under "Open questions" in `STATUS.md`.

Order matters: **schema, process, check, cite, site.** Don't build site features ahead of checked data.
