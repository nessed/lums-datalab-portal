# STATUS

Last updated: 2026-11-24, by Claude Code at Ali's request: Home v3 pages set from the design handoff (branch `proto/home-v3-pages-2026-11`): new header and footer with the LUMS lockup, the evidence sheet as a right-hand Source Panel listing the checks each figure passed, a new home page (featured chart with auto-cycling key indicators, Pakistan at a glance with a province map, topics, releases, calculator, publishers), and restyled indicator, budget line, topic, search, releases, library and receipt pages. What the release cannot supply: `docs/reports/2026-11-24-home-v3-pages-gaps.md`; decisions D-HV4-1 to D-HV4-3. Before that, 2026-11-23: Home v2 and v3 design (branch `proto/home-v2-2026-11`, PR #17): new header and footer, home page, Dataset page, Find data, What's new, Guides, the inflation calculator and Compare provinces (gap state). Front end only; every figure from the release. What the design shows that the release cannot supply: `docs/reports/2026-11-23-home-v3-gaps.md`. Before that, the same day, in the authorised unattended data hub run (`docs/plans/2026-11-23-data-hub.md`, branch `proto/hub-2026-11`, draft PR #15, not merged): hub home page, Library with an on-site PDF viewer, dataset pages, plain navigation, the 23 November defect list. Report: `docs/reports/2026-11-23-data-hub-report.md`. Before that, 2026-11-15, by Claude Code at Ali's request: new design brief (`docs/DESIGN.md`, DRAFT for approval) and design research (`docs/DESIGN_REFERENCE.md`) on branch `docs/design-research-2026-11`; no code changed. Before that, 2026-10-12: S16 site rebuild as a data lab on `claude/epic-mccarthy-ose3yj` (PR open, not merged). Earlier the same day: both overnight runs stopped; `proto/v0` merged into `main`

> **2026-11-24, Ali (D-BE-1):** every figure on the site and in `releases/v0.0.1-prototype/` is a demo value and will be removed. The site's data will come from Ahmad's `ahm3d-karim/pak-econ-golden-data`. The counts below describe the prototype release, not data meant for publication. Open points are in D-BE-1 in `DECISIONS.md`; how its output fits the site: `docs/reports/2026-11-24-golden-data-backend-fit.md`; the site as it is, for the bridge agents: `docs/SITE_FOR_THE_BRIDGE.md`.

## State in one paragraph
The pipeline works end to end for three data types and the release `releases/v0.0.1-prototype/`
publishes all three: the federal Annual Budget Statement (9 editions: Summary of Expenditure,
function-wise detail tables and the receipts side; 2,889 checked values), the Consumer Price Index
(June issues 2016, 2018, 2019, 2021, 2023 to 2026, both base years; 1,254 checked values) and the
Labour Force Survey (5 reports; national and provincial series, 13th and 19th ICLS; 1,347 checked
values). The status **disputed** marks 17 figures that two official documents print differently
although each adds up; they carry no value. LFS is published only because of a recorded change to
how cross-edition agreement is counted (decision D26), which a human must confirm. Two adversarial
reviews found 21 code defects and no wrong released value; all are fixed or decided. The error rate
has not been measured: the gold set is unlabelled. Nothing is deployed. Both overnight runs (pipeline and
site) stopped early; their work is merged into `main`. What they left unfinished is in `docs/OPEN_WORK.md`.

## Where things are
| What | Path | Notes |
|---|---|---|
| Plan for this run | `docs/plans/2026-10-12-continuation.md` | authorised by Ali; continues the first plan |
| Report of this run | `docs/reports/2026-10-12-continuation-report.md` | written as the run goes; ends with the backlog ledger |
| Site plan and report | `docs/plans/2026-10-12-ui.md`, `docs/reports/2026-10-12-ui-report.md`, `docs/DESIGN.md` | the UI agent's |
| Site mockups (S16) | `docs/mockups/project/`, `docs/mockups/REVIEW.md` | Design canvas boards and the self-review the build follows |
| Design brief and research (2026-11-15) | `docs/DESIGN.md`, `docs/DESIGN_REFERENCE.md`, `docs/design-reference/img/` | DRAFT brief replacing the S16 draft; needs approval in `DECISIONS.md` and answers to its section 17 before any site code changes. The research covers about forty peer sites, with screenshots and speed measurements |
| Data hub run (2026-11-23) | `docs/plans/2026-11-23-data-hub.md`, `docs/reports/2026-11-23-data-hub-report.md`, `docs/reports/qa/hub/` | front end only; branch `proto/hub-2026-11`, draft PR #15; screenshots at 1440 and 360 px |
| Home v2 and v3 (2026-11-23) | `DECISIONS.md` D-HV2-1 to D-HV3-2, `docs/reports/2026-11-23-home-v3-gaps.md`, `docs/reports/qa/home-v3/` | front end only; screenshots at 1440 and 360 px |
| Site editorial files | `site/editorial/library.json`, `stories.json`, `daily.json` | plain names, story choices, daily-price names; DRAFT, no digits; Ali and Ahmad confirm |
| Site config | `site/features.config.json`, `site/editorial.config.json` | planned-feature flags (all off); human-chosen headline series |
| First run | `docs/plans/2026-10-11-overnight-prototype.md`, `docs/reports/2026-10-11-overnight-report.md` | |
| Review notes | `docs/reports/review_cpi.md`, `review_lfs.md`, `fix_lfs.md` | adversarial reviews with failing tests |
| Track notes | `docs/reports/track_*.md` | one per parallel track |
| Sanity report | `docs/reports/sanity_2026-10-11.md` | oddities for a human to look at; changes nothing |
| How a number gets on the site | `docs/HOW_A_NUMBER_GETS_ON_THE_SITE.md`, `docs/GLOSSARY.md` | generated from the release |
| Open work | `docs/OPEN_WORK.md` | what is left, item by item; pick the next job here |
| Decisions | `DECISIONS.md` | everything dated 2026-10-11 and 2026-10-12 is provisional |
| Thresholds | `thresholds/` | frozen before any run; not edited; one metric deviation recorded (D26) |
| Pipeline package | `pipeline/datalab/` | CLI: `python -m datalab <command>` |
| Dataset builders | `pipeline/datalab/datasets/` | `abs.py`, `abs_detail.py`, `abs_receipts.py`, `cpi.py`, `lfs.py`, `cross_source.py` |
| Second reader | `pipeline/datalab/second_reader.py` | pdfplumber; routed only to flagged tables |
| Tools | `datalab sanity`, `watch --dry-run`, `diff-release`, `gold-score`; `pipeline/scripts/reproduce.ps1` | `reproduce.ps1` has not been run |
| Specs | `specs/` | per type: locator, columns, rules, label dictionary; `cpi_basket_weights.yaml` is generated by code |
| Sources | `sources/plan.yaml` (input), `sources/manifest.csv`, `sources/verification/` | 26 files; 1 failed (the AJK LFS file) |
| Release | `releases/v0.0.1-prototype/` | rebuilt in place until first deployment (D29); 65 MB, 144 page renders |
| Schema | `docs/SCHEMA.md`, `schema/*.json` | additions of 2026-10-12 are listed at the end of SCHEMA.md |
| Gold kit | `gold/` | blind sample and labelling page; unlabelled; sample to be redrawn at the end of this run |
| Local output | `work/` | git-ignored: runs, datasets, QA overlays; `work/tracks/<name>` per track |

## Datasets
| Dataset | Published | Disputed | Withheld or gaps | Coverage | Checks passed (evaluable) | Cross-edition: agree / one unit apart / fail / disputed |
|---|---|---|---|---|---|---|
| ABS | 2,889 (604 A, 2,285 B) | 9 | 216 failed checks, 200 no check, 86 not printed | 99.19% (90 tables) | 98.8% of 2,329 | 638 / 10 / 2 / 9 |
| CPI | 1,254 (132 A, 1,122 B) | 2 | 0 | 100% (18 tables) | 99.7% of 891 | 125 / 3 / 0 / 2 |
| LFS | 1,347 (548 A, 799 B) | 6 | 288 no check, 21 failed checks | 100% (38 tables) | 99.4% of 2,477 | 913 / 4 / 1 / 6 |

Coverage is how much of each printed table was captured. Check pass rate is evidence about whether
what was captured is right. Measured error rate: pending gold-set labelling.

## Site
Owned by the UI agent. The overnight work (branch `proto/v0-ui`, plan `docs/plans/2026-10-12-ui.md`) is merged
into `main` (PR #1, `bebff67`). Open site work: `docs/OPEN_WORK.md`, section "Site (S)".

**Data hub, 2026-11-23 (unattended, authorised by Ali; branch `proto/hub-2026-11`, draft PR #15, not merged).** The site
becomes the place to see, read and download the data:
- **Home page:** a hub with a ticker, a featured chart, six key numbers, "What moved", a "Daily prices" placeholder
  (names only), stories, a Library strip and theme tiles.
- **Navigation:** Indicators, Library, Chart builder, Stories, About.
- **Library:** `/library` lists every document in plain names. Each of the 25 verified files is served from the
  site and opens in an on-site pdf.js viewer at any page. The rejected AJK file is listed and not served.
- **Datasets:** `/library/datasets`, with previews and downloads.
- **Evidence sheet:** a link that opens the full document at the figure's page.
- **Also:** the 23 November defects are fixed, the blue is darker, and `/demo/type` shows sixteen candidate faces
  (the site stays Noto Sans until Ali picks).

Five plug-ins under `site/scripts/checks/` recompute every new derived figure: `home-derived`, `home-stories`,
`library-counts`, `routes-alive` and `editorial-plain-words`. Results are in the report.

**For the files to be served,** the build needs `SOURCES_DIR` set to the folder holding the registered files. The
Vercel preview has none, so it serves no PDFs (decisions L1 and L2 below).

**Next.js 16.4.1 (2026-11-15, branch `proto/redesign-next-upgrade`, separate draft PR).** Security fix for three advisories against Next 16.0.0 to 16.4.0 (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r). Only `next` and `eslint-config-next` changed; all checks as before; report `docs/reports/qa/next-upgrade/REPORT.md`.

**Redesign preview build, 2026-11-15 (unattended; the brief is still a draft).** Branch `proto/redesign-2026-11`, draft
PR #13, not merged. DESIGN.md stages 0-9 built; the site reads release `v0.0.1-prototype` through `site/src/lib/adapter/`
(datalab adapter on; golden adapter tested against `golden-2026.11.11`, off). Report:
`docs/reports/2026-11-15-redesign-preview-report.md`; what is left: `docs/OPEN_WORK.md` S18.

**Redesign brief, 2026-11-15: DRAFT, not approved.** `docs/DESIGN.md` now holds a new brief (the S16 draft is in git
history at `d5897ca`). It plans for Ahmad's tagged golden releases (`ahm3d-karim/pak-econ-golden-data`) to become the
site's only data source through one adapter, with receipts built from his page proofs; section 5.3 lists what a switch
would lose today (CPI; LFS after 2018-19). Found while researching, not fixed: the header search dialog on the live
site has a 0 px wide input (nothing can be typed); link prefetching downloads about 1.7 MB of page images in the
background on the home page; the catalogue renders all 925 series at once (brief section 18.1, step 0).

**S16 data lab rebuild: merged into `main` (PR #6, `d5897ca`).** The notes below are from that build.
`docs/DESIGN.md` is still marked DRAFT; the build follows it, with the answers to its questions recorded as
provisional decisions in `DECISIONS.md` (UI, 2026-10-12, S16). Ali and Ahmad confirm or overturn them in review.

### State (S16 rebuild, 2026-10-12)
- **Mockups and review:** `docs/mockups/project/` (Design canvas sources, v1 and v2 boards at 1280 and 390 px,
  values are `[slot]` placeholders only), `docs/mockups/REVIEW.md` (35 findings from a skeptical-researcher pass,
  what changed in v2). The canvas itself is a private claude.ai artifact; Ali shares it if wanted.
- **Pages, all in `site/src/app/`:** home (search, headline series with sparklines, data type tiles, status key);
  catalogue `/browse` (facets with live counts in a left column or a phone drawer, rows with sparkline, latest
  checked value and CSV, filters in the URL, "By document" view); series `/series/[id]` (metadata strip, tabs
  Chart | Table | Sources | Download | Cite, Download CSV primary, related series rail, About collapsed, sticky
  actions on phones); compare `/compare` (up to six series, one chart when units agree, small multiples with a
  shared period axis otherwise, a sentence saying why, aligned table, combined CSV, all in the URL); receipt
  `/o/[id]` (value, status, crop, Official PDF and archive first; compact checks; subtracted members marked;
  "see it on the chart"); data type pages `/datasets` and `/datasets/[id]` (coverage, check pass rate and
  cross-edition agreement as separate numbers against the frozen thresholds; gaps by kind; disputes; tables as
  printed); **tables as printed** `/tables/[slug]` (139 tables: the printed table redrawn as a site table, edition
  switcher, click or Enter on a number boxes it on the page image, receipt link; only checked figures carry a
  number); `/api` (Coming, plus the static file addresses). Sources, methods, releases, data access, about stay
  text pages.
- **Planned features** are one flag each in `site/features.config.json`, all off, each showing "Coming: not in
  this release" in its slot. Turning a flag on before the feature exists fails the build (`src/lib/features.ts`).
  What each needs is in the placeholder list below and in `docs/OPEN_WORK.md` S16.
- **Editorial choices** (headline series, example searches, compare default) are in `site/editorial.config.json`;
  values always come from the release.
- **`scripts/check-build.mjs` now proves every digit on every page:** each one is a checked value linked to its
  receipt (`data-v`), a count recomputed independently from the release (`data-count`), or a typed non-value
  (`data-num`: period, date, page, id, axis, a printed reading on a receipt, a release label, a frozen threshold,
  ...). A bare digit, a link to an unpublished value, a wrong count, a printed reading of an unpublished figure
  outside its receipt, a broken internal link, or a subtracted member not marked as such fails the build.
- **Checked on this branch (2026-10-12):** `npm run lint` clean; `npm run build` 7,423 pages (139 tables as
  printed, 3 data type pages); `node scripts/check-build.mjs` OK (164,162 value links, 38,916 counts
  recomputed, 6,318 receipts); `node scripts/a11y.mjs` no serious or critical violations on 28 routes at 390 and
  1280 px (`docs/reports/qa/ui/a11y-after.json`); `node scripts/keyboard.mjs` every step of a 10-step
  keyboard-only walkthrough works with visible focus (`docs/reports/qa/ui/keyboard.json`); 84 screenshots (28
  routes x 390/820/1280) in `docs/reports/qa/ui/after/`, quantized to 256 colours to keep the repo small. Text
  contrast: every text token on every ground is at least 4.5:1, borders that carry meaning at least 3:1.
- **Found and fixed during the rebuild:** 108 withheld receipts printed unpublished figures inside failed-check
  descriptions; not-evaluable reasons quoted recomputed rates. Descriptions now show only where every figure they
  quote is checked, and check-build enforces it (AGENTS.md section 7).

### Placeholders and what each needs before it can go live
| Flag / item | Where it shows now | Needs |
|---|---|---|
| `realTerms` | series and compare chart controls (PKR series) | a checked deflator series in the release (CPI annual average or GDP deflator) and a human decision on base year and method |
| `percentOfGdp` | series and compare chart controls (PKR series) | a checked nominal GDP series (PBS national accounts, both bases, break at the 2015-16 rebasing) |
| `api` | `/api`, footer | a documented, versioned query API; until then the static JSON/CSV files under `/data/<version>/` are the interface |
| `maps` | provincial LFS series ("Map") | province boundaries with a licence that allows reuse, and a human decision on how gaps and disputed figures show on a map |
| `districts` | data type pages, catalogue geography facet | a district-level source registered and checked (none is in the corpus yet) |
| `provincialBudgets` | budget data type page | provincial budget statements registered, a spec and builder (P items) |
| `moreDataTypes` | home, data type list | the next data type built end to end, e.g. Pakistan Economic Survey tables (OPEN_WORK P5) |
| `monthlyData` | CPI series and data type page | every monthly CPI issue processed (OPEN_WORK P2, decision D35) |
| `errataBadges` | releases page | a second release and an errata entry format (S13) |
| Headline series, example searches, compare default | home, compare | Ali confirms or replaces the list in `site/editorial.config.json` |
| Design canvas | private artifact | Ali shares it if the team wants to look at the boards |

### What changed in the release that the site should handle (details: end of `docs/SCHEMA.md`)
- `status: disputed` with `value: null`, `gap_kind: disputed`, `disputed_readings[]` (one boxed page per reading); `evidence_summary` carries the sentence.
- Cells with `extractor_name: pdfplumber` (second tool); `evidence_summary` begins with a sentence saying so. Now also on two LFS tables.
- **New: `Cell.page_label`**: the page number printed on the page, verbatim, or null (111 of 144 pages have one).
- CPI 2007-08 base series have no area: ids `cpi.general.b2007_08`, `cpi.group.<slug>.b2007_08`, `cpi.weight.<slug>.b2007_08`, `cpi.yoy|mom.*.b2007_08`; `dims.area_as_printed: "none stated"`, no `dims.area`; `series.notes` carries a caveat; `sort_key` from 30,500. Every CPI series has a `rebase` break at 2019-08.
- ABS detail series: `fed.exp.current.function.<f>.<sub>`, `fed.exp.current.capital_account.function.*`, `fed.exp.development.revenue_account[.psdp].function.*`, `fed.exp.development.capital_account[.psdp].function.*`, with `parent_id` set.
- **New: ABS receipts series** `fed.rev.*` (48 series, `dims.side: receipts`, `parent_id` set; list in `docs/reports/track_e2_abs_receipts.md`).
- **New: LFS provincial series** `lfs.<measure>.<pb|sd|kp|ba>.<sex>.<area>` with `geo: pk-pb|pk-sd|pk-kp|pk-ba`; **19th ICLS series** end in `.icls19`. Every LFS series has `dims.definition` ("13th ICLS" or "19th ICLS"); the two must never share a chart line. LFS `sort_key` within a measure: national 0 to 8, provinces 10 to 48, 19th ICLS the same plus 50.
- Cross-source files (`doc_type: sbp_easydata`, `pes_chapter`) appear in `sources.json`; a check against the SBP file has `target_source` and `target_value` and no member cell.
- New check type `reference_value`; new check result `disputed`; `Check.member_signs` for sums with subtracted members; `Check.credits_members`.
- The site now builds 7,280 static pages (about 5.5 minutes on this machine while other jobs run).

### Requests for the pipeline
(The UI agent writes requests here, in its own branch; this run reads them at each handoff.)
- ~~Printed page number (folio)~~: done in the release (`Cell.page_label`); the site uses it.
- **Table title as printed.** The receipt takes it from `coverage.json` (`table`) by source and
  page. A `Cell.table_title_raw` (or a table record) would be exact where a page has two tables.
- **Dash means nil?** "Not published by the government" is used where the ABS prints "-". In ABS
  tables a dash often means nil, and the parent totals are consistent with zero. The site says
  "printed as a dash; we do not read it as zero". A human decision; see the UI report questions.
- **Publication date of each source** (`Source.published_on`, or null): citations print "(n.d.)".
- **Threshold values in the release.** The methods page reads `thresholds/thresholds.yaml` and shows it
  only if its SHA-256 equals `release.json` `thresholds_sha256`. Copying the values into
  `release.json` would make the release self-contained.
- **(S16) `evidence_summary` calls a difference a sum.** Net federal resources 2009-10 BE: "Equals the sum of 2
  printed amounts (exactly)", where the check is gross resources less the provincial share (`member_signs` -1).
  The receipt's arithmetic table marks the subtraction; the sentence (also used as the page description) should
  say "difference" when a sign is -1.
- **(S16) Check wording that quotes only checked figures.** `Check.description` and `not_evaluable_reason` quote
  printed or recomputed figures, some unpublished. The site now hides them unless every figure they name is
  checked. A number-free variant of each sentence in the release would let the site say more on withheld receipts.
- **PDF metadata encoding.** `verification.inspection.pdf_metadata` holds double-encoded text
  ("MicrosoftÂ® Excel"); the site shows only the creation date from it.

#### Answers from the pipeline run (2026-10-12, handoff 2)
- **Printed page number:** done. `Cell.page_label` is in `cells.json` and `cells.csv`. It is read from the text layer:
  a line in the top or bottom margin that is only a page number; exactly one such line gives the label, otherwise null.
  ABS 2017-18 PDF p.11 gives "9".
- **Table title as printed:** not done. Titles are known to the CPI and LFS builders but not stored per cell; ABS tables
  are located by content. Queued (see the report ledger).
- **Dash means nil:** left as it is: a printed dash is "not printed as a figure" and is never read as zero. A human decision.
- **Publication date of each source:** not established by anything the pipeline reads (a PDF's creation date is not a
  publication date). `Source.published_on` is not added; citations should keep "(n.d.)" until a human supplies dates.

## How to run (short)
```powershell
py -3.12 -m venv pipeline\.venv
pipeline\.venv\Scripts\python -m pip install -r pipeline\requirements.lock
pipeline\.venv\Scripts\python -m pip install -e pipeline --no-deps
copy .env.example .env                  # set SOURCES_DIR
pipeline\.venv\Scripts\python -m datalab fetch
pipeline\.venv\Scripts\python -m datalab all --dataset abs     # cpi likewise; lfs: see pipeline\scripts\reproduce.ps1 for the page-range runs
pipeline\.venv\Scripts\python -m datalab release
pipeline\.venv\Scripts\python -m datalab check-release releases/v0.0.1-prototype
cd site; npm ci; npm run build
```
Tests only (no Docling, no PDFs): install `pipeline\requirements-ci.lock`, then `python -m pytest` in `pipeline`.

## Open questions for humans
- **D-BE-1:** golden only or candidates too; what `pipeline/` becomes; one misprint policy for both repos; can the golden-data output fill `schema/*.json` per figure.
- Confirm or overturn every provisional decision dated 2026-10-11 and 2026-10-12 in `DECISIONS.md`.
- **D26 (deviation):** counting restatements separately from failures is what lets LFS publish. Confirm or overturn.
- **D25:** disputed figures carry no value. 17 so far: 9 ABS (the Rs 1,042 million moved between two functions in
  Budget 2021-22; four direct-tax heads and two external-receipt lines whose split changed between editions while the
  parent total did not), 2 CPI (June 2018 indices reprinted 0.02 apart), 6 LFS (2018-19 industry shares).
- **Strict rule:** a failed check withholds every figure in it. One visible cost: LFS 2020-21 prints employed males in
  KP as 6.68 where the 2024-25 report prints 7.68 (6.68 fails three sums), so the Pakistan total for employed males
  2020-21 (51.91) is withheld with it. Too strict? Should a later printing be allowed to identify the one bad figure?
- Two printings one unit of the last digit apart still count as agreement (frozen tolerance); the receipt says so.
  Should equal precision require exact equality? (17 pairs.)
- LFS unemployment rates: 20 are withheld because the printed counts (millions, two decimals) are too coarse to confirm
  a rate printed to one decimal, among them the 2018-19 headline rate. Is another check available (for example the
  Economic Survey reprint, which is used where it exists)?
- LFS 19th ICLS headline unemployment rate (2024-25) is not published: its table prints no unit in the title.
- CPI basket weights used to validate row labels are taken by code from the issues themselves. Confirm against PBS.
- CPI 2007-08 base: series carry no area and a draft note that the base covered urban centres only. Confirm.
- ABS detail tables: no development or total figure per function is printed; "Less Recoveries" lines are not modelled,
  so the blocks containing them fail and are withheld. Is a derived "current + development" health series wanted?
- ABS receipts: capital, external and financing lines sit under `fed.rev.*` although they are receipts, not revenue;
  "Credit from Banking Sector" and "Domestic Debt Receipts (Bank) - Net" are kept as two series; the 2026-27 edition
  labels one capital-receipts line "(Bank) - Net" where earlier editions say "(Non Bank)" (probably a misprint; kept as printed).
- A printed dash: "not printed as a figure", never zero. Confirm (raised by the UI agent).
- SBP EasyData: reuse terms unconfirmed; a repeatable pull needs an API key from a human.
- Still open from the first run: cover-less ABS editions; the 2017-18 text-layer deviation; the scanned-page
  definition; DOI; hosting PDFs; repo organisation; branch protection; LUMS name and logo sign-off.

- **Data hub run (2026-11-23):** confirm or overturn every decision dated 2026-11-23 in `DECISIONS.md` marked
  "provisional (unattended, 2026-11-23)". Also:
  - **L1:** may the site serve whole government PDFs from its own address? The preview does, with the publisher,
    the official link and the fingerprint beside each file.
  - **L2:** the whole corpus. The shared Drive folder was not read. Above a few hundred MB the files need object
    storage, which goes with Ahmad's bridge (one setting, `LIBRARY_FILES_BASE`).
  - **L3:** list documents with no extracted data? The shape exists; none are listed.
  - **The font:** pick one from `/demo/type`. Overpass alone, or Besley headings over Overpass, are the suggestions.
    Once picked, the face is self-hosted and switched in one change.
  - **Draft names** in `site/editorial/library.json`, `stories.json` and `daily.json`.
  - **Daily prices** (fuel and similar, collected once a day): only a placeholder exists; Ali builds the collection.
  - **Chart axes** stay in the printed unit, so large series show ticks like 20,000,000. Keep, or rescale with the
    label changed to match?
  - **Pipeline or methods, not front end:**
    - monthly inflation holds June figures only;
    - June 2022 CPI is missing;
    - the default series view mixes budget and revised figures.
  - **Front end, left:**
    - `spark.json` does not mark series breaks;
    - the Library's network fetch routes (official address and archive copy) are untested;
    - viewer search loads the whole file.
  - **A human should read the advisory** behind the Next.js 16.4.1 dev server's "security upgrade" notice. It was
    not acted on.

## Unfinished work from the overnight runs
Listed item by item, with what exists and how to finish it, in `docs/OPEN_WORK.md` (each agent keeps its own
section). Merged into `main` on Ali's instruction without the usual teammate review (see `DECISIONS.md`); Ahmad reviews
afterwards. Not merged on purpose: branches `proto/v0-e1-abs-editions` and `proto/v0-e4-cpi-monthly` (work in progress).

## Queued follow-ups
- Label the gold set (two people), then `datalab gold-score`.
- Create the Vercel project (root directory `site`).
- Run `pipeline/scripts/reproduce.ps1` (about three hours of CPU) to test "anyone can rebuild it".
- June 2022 CPI issue; second reader on the flagged ABS detail tables (7 tables); table titles per cell.
- The rest of the extended backlog: see the ledger at the end of the report.

## Known traps
All in `AGENTS.md` section 7.
