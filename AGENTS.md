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
- **The ABS never prints development or total spending per function.** The seven pages after the Summary of Expenditure list each function with its sub-functions four times (current/revenue, current/capital, development/revenue, development/capital), each part ENDING with its total line. Development by function exists only split by account, and in 2010-11 to 2017-18 the function lines are the PSDP part only. `fed.exp.development.function.*` and `fed.exp.total.function.*` would be constructed numbers; `specs/abs_detail.yaml` names series for what is printed (`...revenue_account.function.health`, `...revenue_account.psdp.function.health`). See `docs/reports/track_abs_detail.md`.
- **ABS detail tables: the part a row belongs to is known only from the total line that follows it**, sometimes pages later. If Docling loses that line (2010-11 "a.", 2024-25 "d.") the rows must be dropped, never carried into the next part; `datasets/abs_detail.walk` drops them when function codes restart.
- **Printed codes are not unique and not always sub-functions.** Code 011 heads three different lines; "Administration" is 096 and 107; a two-digit "19 Gen. Public Services not elsewhere defined" line under current expenditure on capital account is NOT sub-function 019 (the sum check contradicted that reading). Match code and whole name; leave the rest unmapped.
- **Uncoded lines can still belong to a sum:** "Less Recoveries from Health Services" sits under `07 Health` in ABS 2016-17 and 2017-18, while in 2010-11 a "Less Recoveries" line sits one level lower under defence. They are not modelled; the affected sums fail and the figures are withheld.
- **Wrapped labels in the ABS detail tables** put the code on the first line and the amounts on the second ("097 Education Affairs & Services not" / "Elsewhere Classified"), and Docling returns them as two rows or scrambled into one. Two rows are joined and must then match the dictionary in full; scrambled labels stay unmapped.
- **A "-" (nil) cell merged with its neighbour reads as a negative number.** ABS 2025-26 p.22 "063 Water Supply": Docling emitted `- 6` for one cell and only two amounts for the row; the normaliser parses it as -6 and no detector flags it. The hierarchy sum and the next edition (which prints 6) both failed, so it is withheld. `normalise.parse_printed` should flag dash-space-digit.
- **A figure reprinted unchanged in the next edition is not thereby right.** Sub-functions whose function does not add up were still tier B through cross-edition agreement; for the ABS detail tables a failed check on the figure's own cell now withholds it (`abs_detail.withhold_where_a_check_failed`).
- **ABS covers:** 2010-11 has no cover page in the file and 2017-18's cover is an image, so the title cannot be read from the text layer. Pages 2, 4, 6 of newer editions are blank. See the verification records.
- **Wayback:** the availability API (`archive.org/wayback/available`) returns nothing for most of these PDFs; the CDX index (`web.archive.org/cdx/search/cdx`) works and carries a SHA-1 digest that can be compared with the local file.
- **Git Bash heredocs** choke on some multi-byte characters; write long text files with a file tool or Python, not `cat <<EOF`.
- **"No text layer" is not "scanned", and a blank page is neither.** PBS monthly reviews carry chart pages that are images and a blank page. The scanned fraction is measured over printed pages and counts image pages only (`extract.profile_pdf`, same definition as `sources.inspect_pdf`). Counting the blank page had refused the June 2021 CPI issue.
- **Docling merged rows and lost a column in the June 2021 CPI urban and rural tables** (7 value columns instead of 8). The detectors flagged both; Docling's own reading of them is never published. This is the failure mode at the top of this section, seen for real.
- **Second reader (pdfplumber, `second_reader.py`, D28):** routed only to tables flagged `merged_rows` or `dropped_column`; its reading is used only when every arithmetic check of that table passes on it (`datasets/common.try_second_reader`), otherwise nothing changes. Things to know before touching it: (1) it reads the same text layer PyMuPDF does, so its coverage figure says every printed number landed in a cell, not that the text layer matches the ink; (2) pdfplumber joins characters closer than 3 pt into one word, so two numbers printed that close come out as one string, which only the parser or a check can catch; (3) arithmetic cannot see two row labels swapped, so a label line that could belong to either neighbouring row is a refusal, never a nearest guess; (4) serial numbers sit in their own column and can be on the second line of a wrapped name ("Furnishing & Household Equip. &" / "5. Maintenance"), so the code column is kept apart from the names; (5) header lines hold numbers too ("2021"), so header and body are split at the first reader's first data row, never by "is it a number".
- **A scratch script run from outside `pipeline/` imports the main checkout's `datalab`** (the venv has an editable install), not the worktree's. Run it from `pipeline/` with `PYTHONPATH=.` or as `python -m`.
- **Docling merged rows and lost a column in the June 2021 CPI urban and rural tables** (7 value columns instead of 8). The detectors flagged both and everything from them is withheld. This is the failure mode at the top of this section, seen for real.
- **CPI on the 2007-08 base prints one table with no national/urban/rural label.** Its series carry no area segment (D27): `cpi.general.b2007_08`, `cpi.group.<slug>.b2007_08`, `cpi.weight.<slug>.b2007_08`, `cpi.yoy.*.b2007_08`, `cpi.mom.*.b2007_08`, with `dims.area_as_printed: "none stated"` and no `dims.area`. Never file them under `cpi.national.*` or `cpi.urban.*`, and never pair them with a 2015-16 base issue. The table prints the same 12 group names as the 2015-16 base (weights differ) with three label spellings across issues; all are in `specs/cpi_labels.yaml`.
- **Docling merged the two % change columns of the June 2019 CPI table into one cell per row** (7 value columns instead of 8; `merged_rows` + `dropped_column`). Token coverage was still 142/142, because both numbers survive inside the merged cell: **coverage cannot see a lost column boundary, only the detectors can.** Everything from that table is withheld.
- **A run refused by the scanned-page rule has an empty `raw/` folder.** It cannot be re-validated after the rule changes; make a new run (CPI 2016-06 and 2019-06 are run-02 for this reason).
- **The session scratch folder is shared by parallel agents:** another track overwrote a probe script with the same file name. Use a per-track subfolder.
- **Docling marks a first data row as a header row** (CPI Rural "General" row; LFS full-width block heading "Pakistan"). Never let row meaning depend on the header flag alone; `datasets/cpi.py` accepts such a row only when every value column holds exactly one number, and the checks then validate it.
- **Header cells span down into data rows** (CPI "No"/"Group"); build a row label only from cells that start in that row.
- **CPI column headers:** the month is printed three ways ("June 25", "Jun 23", "June" above "2016"), and a % change column's header month is the comparison month, not the observation month.
- **The first file PBS serves as "LFS 2014-15" is the Azad Jammu & Kashmir edition.** Verification now fails it by a content marker (`markers_none` in `sources/plan.yaml`). Check cover text, never a file name.
- **LFS 2024-25 prints nearly every table twice (13th and 19th ICLS definitions)**, sometimes on one page. Only 13th ICLS tables are mapped, to stay on one definition across rounds.
- **LFS title matching needs word boundaries:** "Unemployed - Pakistan and Provinces" contains "employed - Pakistan and Provinces"; bare "Rural"/"Urban" row labels repeat for every province and mean something only inside their block.
- **Docling page-range runs keep the original page numbers**, so receipts need no offset. A page-range run never supplies its first or last page.
- **Shared work folder:** tracks that share `work/` must not share log file names, and `datalab release` picks up every dataset found in `work/datasets/`; use `--dataset` to limit it.
- **PBS lists two files for LFS 2014-15;** the one ending `-1.pdf` is the national report (`lfs-pbs-2014-15-national`). A cover check cannot tell a regional edition from the national one, so that source is also tested over the whole document (`body_markers_all` / `body_markers_none` in `sources/plan.yaml`: table titles must say "Pakistan and Provinces", no page may say "Azad Jammu").
- **SBP EasyData:** the public download is a form POST bound to a browser session and the documented API answers 401 without a key (a human must supply one; never work around it). So the registered CSV cannot be re-fetched by URL: `datalab fetch` reports it and writes nothing, and a missing cross-source file skips the check instead of failing the build. Some months carry an unrounded figure (June 2021: nine decimals), which the frozen rounding rule fails against the two-decimal PBS figure by 0.0007; that is a recorded fail, not a reason to loosen the rule.
- **A cross-source check against a data file has no member cell** (`member_cell_ids` is empty, the other side is `target_source` + `target_value`). The first real SBP disagreement crashed `status.disagreement_note` on `member_cell_ids[0]`.
- **Cross-source means same concept, period and unit, established from the other publication's own text.** The Economic Survey labour table prints "Labour Force Participation Rates (%)" without saying crude or refined, and its "Monthly percentage changes in CPI" table does not say over which period: neither is compared. Its inflation tables are fiscal-year or July-April averages, never comparable with a June figure. The cross-source file never supplies a value: its cells carry no series id.
- **Economic Survey chapters:** the chapter title is only a running head (first on page 4; page 1 is an infographic), so `marker_pages: 4`. The table title and the "In million" line sit just above the table box and leak into column headers collected by position (the word "Labour" from the title landed in the "Crude Activity Rate" header) unless the words are limited to the table box. Two chapters of one survey get run ids that differ only in the run number (`PES_2024-25__...run-01`, `run-02`); the chapter is the `source_id` in the run manifest.
- **A scratch script run from outside `pipeline/` imports the main checkout's `datalab`** (the venv has an editable install) and so reads the main `.env` and work folder, not the worktree's. Run it from `pipeline/` with `PYTHONPATH=.` or as `python -m`.
- **Series breaks:** 18th Amendment / 7th NFC (FY2010-11), CPI rebased to 2015-16 (2019), GDP rebased to 2015-16 (2022). Mark them; never smooth across them.
- **ABS receipts: the same printed name is a different line under a different head.** "Petroleum Levy" and "Airport Tax" sit under "Indirect Taxes" in 2010-11 and 2011-12 and under "Other Taxes" in 2016-17 and 2017-18; "Domestic Debt Receipts (Bank) - Net" is printed twice on one page in 2026-27 (under capital receipts with object code E03, and as financing line 14). `datasets/abs_receipts.ReceiptLabels` recognises a member line only in the rows that follow its head and drops two rows that land on one series. Never map these by name alone.
- **ABS receipts lines do not mean the same thing in every edition.** "Tax Revenue Receipts" is FBR taxes plus "Other Taxes" in 2016-17 and 2017-18 and FBR taxes only from 2021-22 (the levies move to non-tax receipts); "Indirect Taxes" includes the petroleum levy in 2010-11 and 2011-12; "Federal Consolidated Fund (5+6)" and "(5+6-10)" are two quantities. The series are as printed and the definitions say so; never smooth or re-add across editions.
- **The Summary of Receipts first column holds object codes that are not always on their own line** ("E033 6 External Receipts", "G03 7 Public Accounts Receipts (Net)"), so the code is stripped and never used to identify a row there. Wrapped labels ("10 Less Provincial Share in Federal" / "Taxes", "12 Cash Balance Surplus by the" / "Provinces") lose their second line to this row's front (2024-25) or to the next row (2025-26); the cut forms are in `specs/abs_receipts_labels.yaml`, the rows that received the stray word are read from the text layer, and `gross - provincial share = net` validates both.
- **A later ABS edition can re-split a budget column without changing the total.** Budget 2021-22 direct taxes are split differently over the four heads in the 2022-23 edition, and Budget 2016-17 external loans and grants differently in 2017-18 (a third line appears). Both printings add up, so the code marks them `disputed` (D25) and shows no value. A unit test with a difference of 1 "fails" nothing: sums allow half a unit per member, so use a difference above that.
- **The "*Of which FBR" row under the 2010-11 and 2011-12 tax total is a footnote row**, not the sum of the direct and indirect lines above it. It is listed under `ignored` in the label file and is not a series.
- **LFS provincial blocks come in two layouts** (D33): 2014-15 to 2020-21 print the province on its total line ("KP 7.72 ...", then bare Rural, Urban); 2024-25 prints a heading line per block, then Total, Rural, Urban. A bare row belongs to the block whose heading is printed last above it and to nobody after a label that is not in the dictionary (`lfs.AreaRows`). If Docling loses one heading the next block repeats the previous one; the duplicate guard then unmaps the whole table. Series: `lfs.<measure>.<pb|sd|kp|ba>.<sex>.<area>`, geo `pk-pb|pk-sd|pk-kp|pk-ba`; "NWFP" maps to `kp` by dictionary. This supersedes "provincial rows stay unmapped" above.
- **LFS 2024-25 19th ICLS tables are separate `.icls19` series** (D34), never joined to or checked against the 13th ICLS ones; the definition comes from the tag the title or header prints and a caption with both tags maps nothing. This supersedes "only 13th ICLS tables are mapped" above. Their definition text quotes the report, each quote verified by code on its page (`icls19.definition_statement`); never write that definition from memory.
- **A misprint in a provincial row withholds the Pakistan figure of the same column.** LFS 2020-21 p.38 prints employed males in KP as 6.68 (the 2024-25 report prints 7.68; 6.68 fails KP's own sums). `lfs.provinces_add_to_pakistan` then fails and, by the strict rule, the Pakistan male total 51.91 is withheld with it. Do not special-case it; it is a human decision (STATUS.md, "a failed check withholds every figure in it").
- **LFS provincial identities fail by 0.02 where 0.01 is allowed** in four places (Punjab female 2017-18, Sindh 2018-19): the reports say totals may not tally due to rounding. The tolerance was frozen first; the figures stay withheld.
- **The second reader glues a label-only line to the nearest row of numbers and leaves the first one with the header.** On LFS 2024-25 pp.57 and 71 its rows read "KP Total", "Punjab Total" and the "Pakistan" heading is gone from the body, so the first block would belong to nobody. `AreaRows.open_from_line_above` reads the block heading from the text line directly above the first amounts, only when the table's own rows gave no label first. A flagged table of rates is never sent to the second reader: it has no sum to validate a second reading.
- **A table title can print no unit.** LFS 2024-25 table 9.2 (19th ICLS unemployment rate, p.144) has no "(%)"; it is located and nothing is mapped (`scale_not_confirmed`). Its 13th ICLS sibling (table 9.3) continues on p.146 as a title-less table holding the provincial blocks; a table without a title is never identified.
- **Adding many agreeing pairs dilutes the disputed share.** Provincial rows took LFS from 6 of 276 to 6 of 924 cross-edition pairs disputed; report the count, not only the share.

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

Current authorised run: `docs/plans/2026-10-12-continuation.md` (authorised by Ali; continues `docs/plans/2026-10-11-overnight-prototype.md`, whose sections 0 and 11 still apply).

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
