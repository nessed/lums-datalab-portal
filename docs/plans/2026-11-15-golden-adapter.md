# Golden adapter (DESIGN.md stage 1, second half): design note

2026-11-15. Code: `site/src/lib/adapter/golden.ts`. Tests: the golden section of `site/scripts/contract-test.mjs`.
**Not switched on.** `data.ts` still refuses every adapter but `datalab`; one commented line there shows where
`golden` would plug in.

`loadGolden(dir, { tag })` reads the extracted `golden/` folder of one tag of Ahmad's repository and returns the same
`Db` as `loadDatalab`, plus a few extras (`GoldenDb`): evidence per observation, the printing (dataset, document,
source) of each, row and key indexes, datasets not in the release, held-but-unverified source names and the sign-off
log. Built and tested against `golden-2026.11.11` (commit `2da27bc`).

## What the tag holds (it differs from DESIGN.md 5.3)

- **13 golden-layer datasets, not 14.** `budget_credibility` is not in `golden-2026.11.11`: it was added in the next
  commit (`7559585`), and its own `SCHEMA.md` says "Not in any release". The adapter maps its shape (derived
  evidence, gaps travel) but only reads it when a release lists it; the test runs the mapping on the clone's HEAD rows
  against the tagged functional table.
- **No `wiki/proofs.py` in the tag** (also added in `7559585`). The tag has no page proofs, page images or page sizes.
- 4 signed off (`abs_federal_functional`, `lfs_indicators`, `pslm_indicators`, `hies_indicators`), 9 candidates;
  34 more catalogue rows are sources held but not verified (names only).
- 37,856 rows. Through the adapter: checked 6,980; checked with a note 81; not signed off 28,333; held back 29;
  not checked yet 1,802; not printed 175; dash or zero 456. 16 held batches.

## What maps how

**Fingerprints first (A8).** Every file in `catalogue.json` `fingerprints` is hashed as his `core/fingerprint.py`
does (SHA-256 after CRLF to LF) and compared; then each dataset's combined hash (SHA-256 of the sorted `name:hash`
lines) is compared with `RELEASE.json`. Any difference throws, naming the file or dataset. `RELEASE.json` must name
the pinned tag. Row counts must equal `RELEASE.json`. A golden dataset in the catalogue but not in `RELEASE.json` is
not read.

**Four row shapes**, recognised by their columns:

| Shape | Datasets | Period | Kind | Evidence |
|---|---|---|---|---|
| Budget documents | federal ABS economic, functional, receipts; DFG; KP and Sindh ABS | `ref_fy` | `estimate_type` BE, RE, ACTUAL, AC | printed cell: document, PDF page, box in points |
| Economic Survey tables | `pes_headline_indicators`, `pes_debt_external` | `ref_period` | `partial_period` gives part-year, else `col_flag` F, R, P; else as printed | printed cell: document, PDF page, no box |
| Survey indicators | LFS, PSLM, HIES (and LFS informality, PSLM education and health) | `round` | survey round | recomputed: our value, PBS's value, report table and page, method |
| Derived | `budget_credibility` (not in this tag) | `ref_fy` | as printed (no kind for a revision yet) | derived: formula and the two printed figures |

**Statuses** (first rule that applies wins; written at the top of `golden.ts` and tested):

| His row | Reader status | Reason |
|---|---|---|
| `misprint*`, or survey `check_status` `differs` | held back | the `exceptions.csv` evidence text (17.2) |
| `unpublished*`, or `not_published` | not checked yet | PBS did not print it, so nothing checks it (17.8) |
| an asterisk not known here | unknown (no value) | names the asterisk |
| federal ABS (no printed-text column) and value 0 | dash or zero (17.3) | never shown, never used in a derived value |
| printed text is a dash (KP, Sindh) | not printed | the dash is kept as text |
| any row of a candidate dataset | not signed off (17.1) | plus the note text if it has one |
| `restated*`, `memo*`, `assumption*`, `small_sample*` | checked, with a note | the `exceptions.csv` text |
| other row of a signed-off dataset | checked | the catalogue's `verification` words, or "matches PBS's printed figure" |
| a held batch (catalogue `held_batches`) | a `BatchGap`, held | the catalogue's reason |

Only deterministic evidence counts. His Economic Survey second reading (a Haiku transcription) is not read by any
field; a test checks no reason cites it. Where a figure shows no value, the adapter also empties its printed text,
its cell, and its recomputed values, so nothing downstream can leak the number.

`exceptions.csv` lines are found by the row's key; then as the "other document" of a restatement; then with his `#2`
item suffix dropped and the value matched. Four `abs_federal_receipts` asterisks still find no line; their reason
says so plainly.

**Series ids.** `golden.<dataset>.<his series GROUP values, "_" if empty>.<item key>`, his `query/series.py` rule
("one item in one group"); the surveys, which his series tool does not cover, group by geography, area and sex. An
observation is one printing: `<series>:<period>:<vintage>:<document>[:<extra grain>]`. `chooseByPeriod()` applies his
selection rule (accounts or actual over revised over budget estimate, then the latest document), tested against the
raw rows. Breaks from `query/series_breaks.csv` are attached to their series; `at_period` holds the first **edition**
on the new basis, not a reference year.

**Boxes.** His boxes are PDF points. With a page size (`opts.pageSize`) they become fractions, marked tentative (only
his proof index can confirm a box). Without one, which is always the case with this tag, the box is null,
`boxState` is `no-image`, and the points are kept with a sentence saying why.

## What the golden release lacks that the site needs

- **Page sizes and proofs.** No page size, page image or proof index in the release, so no box can be drawn and no
  crop cut (decision 17.7). Every receipt would show "page image not checked".
- **Printed text for the federal ABS.** The three federal ABS datasets store a printed dash or zero as 0 with no
  printed text: 456 figures are "dash or zero" and cannot be shown or summed (decision 17.3).
- **Publication dates**, landing pages, page counts and file sizes of documents. Sources carry only file name,
  fingerprint and download URL; PBS report files named as check targets have no fingerprint at all.
- **Series ids, reader names, definitions, topics, headline layer.** None in the release; the id rule above is ours.
  Series names are the printed names of the latest printing, or the indicator code.
- **Licence and citation text** for the release (the adapter says "not stated in this release").
- **Per-figure checks.** Checks are reported per dataset (`validation_report.md`), so a reason can say what kind of
  check the dataset passed, not which check covered this figure. `Db.checks` is empty.
- **A fingerprint on `catalogue.json` itself and on `registry/signoffs.csv`.** `RELEASE.json` covers the data files;
  a change to a dataset's status or held batches in the catalogue would not be caught.
- **Restatements as "revised".** `restated*` is mapped to "checked, with a note" as asked; decision 17.2 would show
  "revised" where the later printing is known (the exceptions line names both documents, so this is possible later).
- **Held-back reasons quote printed figures.** `misprint*` explanations contain the printed numbers. Rule 6.1 allows
  only checked figures in a reason; the receipt pages and `check-build.mjs` must decide how to account for them.

## What A8 still needs before a switch

1. Wiring: a `goldenTag` and folder in `release.config.json`; a prebuild step that extracts the pinned tag (and
   checks the tag's commit), then the commented line in `data.ts`.
2. Pages: anything that looks up `<series>:<period>:<vintage>` (`obsAt`, the receipt's neighbours, Compare) must use
   the chosen printing (`chooseByPeriod`), since each golden printing is its own observation. `Observation` has no
   evidence field; the contract should carry `GoldenDb.evidence` and the printing.
3. Page proofs and their index in the release (17.7), and a person's spot-check of them.
4. A kind for a revision (budget to revised) so `budget_credibility` deviations are labelled, once a release has it.
5. Editorial layer keyed to these series ids: reader names, definitions, topics, headline layer (17.1 keeps
   candidates out of it).
6. `npm run build` and `check-build.mjs` on the golden release, with the release id on every page and file.
