# Golden-data repository as the site's back end: fit report

2026-11-24. Written by Claude Code at Ali's request, after D-BE-1.

**Basis.** This session has no access to `ahm3d-karim/pak-econ-golden-data`. Everything about that repository below comes from answers given by an agent working in it, at commit `ffcd01c` (release tag `golden-2026.11.23`, `6b5c10c`), and pasted here by Ali. Nothing here was read from that repository's code by this session. The hash comparison in section 1 is the only part checked here, against this repo's `sources/manifest.csv`. No code, data or release in either repository was changed.

## 1. Source files: hash comparison

This repo's `sources/manifest.csv` (26 files) against the registries listed for that repo (`abs_pdfs_used.csv`, `cpi_reviews_used.csv`, `survey_inputs.csv`, `pes_prices_fiscal_inputs.csv`, `cpi_reviews_used.csv` comparison files).

| This repo | Files | Same SHA-256 in the golden-data registries |
|---|---|---|
| ABS federal 2010-11, 2011-12, 2016-17, 2017-18, 2021-22, 2022-23, 2024-25, 2025-26, 2026-27 | 9 | 9 of 9 |
| CPI June 2016, 2018, 2019, 2021, 2023, 2024, 2025, 2026 | 8 | 8 of 8 |
| LFS 2014-15 national, 2017-18, 2018-19, 2024-25 | 4 | 4 of 4 |
| LFS 2020-21 (`ca9b1d70...`) | 1 | yes: it is `LFS_2020-21_Report-3.pdf` there; that repo also holds `LFS-2020-21-Final.pdf` (`c7672751...`) |
| LFS 2014-15 AJK edition (`56e5681b...`, verification failed here) | 1 | not in their list (correct: it is the wrong file) |
| PES 2024-25 Inflation chapter | 1 | yes (`pes_prices_fiscal` 2024-25) |
| PES 2024-25 Labour chapter (`8cce28da...`) | 1 | not in the registries quoted (none for that chapter were asked for) |
| SBP EasyData CPI extract (`6afbf22e...`) | 1 | yes, as a comparison file |

**Every file both repos hold is byte-identical.** ABS 2025-26 and 2026-27 here are the Finance Division originals that repo switched to in November, not the superseded copies in the shared pilot folder.

## 2. What the site needs per figure, and what the golden tables carry

| Site / AGENTS.md rule | Golden tables at `ffcd01c` | Fit |
|---|---|---|
| Rule 1: file + page + position | ABS and most document datasets: file, SHA-256, URL, 1-based PDF page, bbox in PDF points, top-left origin (pdfplumber); drawing it needs the crop-box offset in `core/pagegeom.py`. Six document datasets have a page and no box. Excel tables: sheet + cell | **Fits for ABS.** Gaps for the six page-only datasets |
| Rule 1 for survey indicators | `lfs_indicators`, `pslm_indicators`, `hies_indicators`: microdata archive + free-text `method`, no page, no variable list | **Does not fit rule 1 as written.** Needs a new provenance kind, a human decision |
| Section 5: printed text kept beside the value | Kept in most datasets; **not kept** in the ABS tables built on `abs_pdf_lib`, `abs_federal_functional`, `abs_schedule_i`, `abs_tax_expenditure`, `hies_income_printed`. "(140)" survives only as -140 | Gap for ABS |
| Checks a figure passed (Source Panel, receipts) | Per figure only for survey datasets (`check_status`). Document datasets keep batch counts and a list of failures; a passed check leaves no record on the figure. Cross-dataset pairs are recorded in full | **Gap.** The Source Panel cannot list checks for ABS figures |
| Rule 2: nothing publishes without passing | A batch with a failure listed in `known_exceptions.csv` is published with the printed value and `misprint*` | **Conflicts** with the strict rule here |
| Rule 3: two gap kinds | "Not published" is a missing row (ABS, KP DFG), `0` plus a dash flag (budget books), or a computed value tagged `unpublished*` (surveys). Federal ABS stores a printed "-" as 0 with no flag | **Gap.** A printed dash cannot be told from a printed 0 in federal ABS |
| Rule 4: figure type | `estimate_type` on budget rows (BE, RE, ACTUAL / AC / AC_PROV, BE_Q1, projection, MT, EST, REPORT). The legend is in `query/series.py`, outside `golden/`. Provisional flags (F/R/P) on PES and SBP rows | Mostly fits; the legend and `query/series_breaks.csv` must be copied into the release |
| Series breaks | `query/series_breaks.csv`, 11 rows, outside `golden/`; no CPI rebase entry; 18th Amendment not marked (series start 2010-11) | Gap |
| Rule 5: frozen releases, citations never break | Annotated git tags + `RELEASE.json` (row counts and fingerprints). No per-figure id; key is six columns and `row_instance` is positional. Changes logged per batch with a cell diff | Pin a tag. A citable figure id has to be built, and `row_instance` can move |
| Rule 7 / section 4: no LLM writes a value or decides a pass | No runtime LLM call. **But** `reference/published.csv` for the three survey indicator datasets was transcribed by two LLM agents; a mismatch against it fails a check and holds a round. One sign-off (ABS K005/K006) accepted figures "as reported by the checking agent". Many second readings are Haiku readings of page images, reported only | **Conflicts with section 4** for the survey indicators. The image readings are reports and change nothing |
| Thresholds frozen before results | Tolerances are hard-coded per dataset and first appear in the same commit as their first results; none was loosened afterwards | Cannot be shown either way |
| Gold set / human sign-off | Every sign-off is Ahmad's own, on datasets he built; the reviewer field is free text and not checked | Ali has signed off nothing |
| Source URLs on receipts | ABS: on every row. PES: blank in most datasets. LFS: all `.../wp-content/uploads/2020/07/<file>`, which that repo itself calls suspect | PES and LFS links need fixing before the site shows them |

## 3. Misprint excusing is coarser than it looks

A listed misprint excuses a failure only by batch and check id. For ABS functional the check id is `table|function|column`, so K001 (one item, code 042) excuses every failure of the function-04 sum in that column and batch. A second, unlisted error in function 04 in the same column and edition would be excused too; nothing compares the size of the gap with the listed misprint. A stale entry is never reported. Worth fixing in that repo whatever the misprint policy ends up being.

## 4. Decisions for Ali and Ahmad

1. **Misprints:** publish the printed value with a caveat (theirs) or withhold it (rule 2 and 10 here). The site follows one rule.
2. **Survey indicators:** a provenance kind for figures computed from microdata (rule 1), and what to do about LLM-transcribed reference figures deciding pass or fail (section 4). Re-transcribing `published.csv` by code from the text layer, as their newer survey datasets already do, would remove the section 4 conflict.
3. **Candidates:** `RELEASE.json` lists 67 datasets, of which 4 are signed golden. Does the site show candidates, and as what (here: unchecked)?
4. **Sign-off:** who signs, and can a builder sign their own dataset.
5. **`pipeline/` here:** retire, or keep as an independent reader of ABS, CPI and LFS to compare with the golden tables (same files, section 1).

## 5. What that repo would need to emit for the site

- Per figure: the list of checks it is a member of, each with type, result, tolerance and the other members.
- A printed-text column on every PDF table, ABS included; a printed dash kept as a dash, not 0.
- One encoding for "not published by the government" and one for "not yet verified".
- A stable figure id that does not depend on row position.
- The figure-type legend and the series-break register inside `golden/` (or the release).
- Verified source URLs for PES and LFS rows.

Once that repository is attached to a session here, the next step is an adapter from a pinned tag into `schema/*.json`, starting with `abs_federal_functional`, plus a figure-by-figure comparison with this repo's ABS release on the 9 shared editions.
