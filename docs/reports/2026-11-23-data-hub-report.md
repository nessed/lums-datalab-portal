# Data hub run (2026-11-23): report

Plan: `docs/plans/2026-11-23-data-hub.md`. Prompt: `docs/plans/2026-11-23-data-hub-opus-prompt.md`. Authorised by Ali.
Branch `proto/hub-2026-11`, draft PR nessed/lums-datalab-portal#15 against `main` (never pushed to `main`).

**Preview:** https://lums-datalab-portal-git-p-f0ec1b-aliabid44444gmailcoms-projects.vercel.app
(Vercel preview of the branch. Vercel builds without `SOURCES_DIR`, so the preview has no served PDFs and
documents show their official link only. The local build serves them; see "Where the files come from".)

## What changed for a visitor

- **Home page** (`/`): a hub. Under the header:
  - a ticker of key figures, which pauses on hover, on focus and with its button, and stands still under reduced motion;
  - a large featured chart with a one-sentence headline, beside six key numbers;
  - "What moved": prices by group, where the budget goes by function, and the provinces;
  - a "Daily prices" placeholder (names only, "Not yet collected");
  - four story cards, a Library strip and theme tiles;
  - a slim footer that carries the release tag.

  Every figure is a receipt-linked value from the frozen release. Every change, share and ranking is recomputed
  by a check plug-in.
- **Navigation:** Indicators, Library, Chart builder, Stories, About. No address stopped working: `/sources` and
  `/datasets` redirect to `/library` and `/library/datasets`, and `/sources/<id>` stays the document's address.
- **Library** (`/library`): every source document, in plain names ("Federal Budget", "Monthly Price Review", ...),
  with the printed title on a grey second line. It can be filtered by kind, publisher, year and title words, and
  the filter is kept in the address.
  - Each verified PDF opens in an **on-site viewer** (pdf.js) at a given page, by range requests: the 15 MB,
    230-page LFS 2020-21 report opens at page 150 after fetching 2.8 MB. The viewer has search, zoom, thumbnails
    and full screen.
  - Every file also downloads, with the publisher, the official link and its SHA-256 fingerprint beside it.
- **Datasets** (`/library/datasets`): each dataset with its years covered, a preview of its figures, a link to the
  chart builder, and CSV, Excel and zip downloads.
- **"Open the full document at this page"** in every evidence sheet: from any number to its page in the full
  document.
- **Indicators and Stories** pages restyled with the same parts, and story pages name series breaks in plain words.
- **Defects from the 23 November review** fixed (plan section 9):
  - sparklines and charts;
  - the chart builder's unknown ids and its "Searching" state;
  - search counts and "Did you mean";
  - the credit line, "note note:", the double copy button and the axis unit;
  - "Next expected", and the disclaimer shown three times.
- **Colour:** a darker, more formal blue (Ali). **Type:** unchanged (Noto Sans); `/demo/type` shows the first
  screen in sixteen candidate faces for Ali to pick from.

Screenshots: `docs/reports/qa/hub/` (1440 px first screen and full page, and 360 px, of each page type).
Before: `docs/reports/qa/round2/look/home-1280-first.png` (home on `main`); `main` had no Library.

## Check results

- **Build:** passes. Prebuild served 25 of 26 source files, all from `SOURCES_DIR`; the AJK file is rejected.
- **Lint:** clean.
- **Tests:** contract 47 of 47, search 25 of 25, contrast 106 of 106.
- **First screen at 1440 x 900:** 118 words with a letter (173 tokens counting figures), 1 chart, 6 key numbers,
  the ticker.
- **Pages:** all 13 page types answer 200, with no horizontal overflow at 360 px (`docs/reports/qa/hub/index.json`).
- **Viewer:** the built site opens the 15 MB LFS 2020-21 report at page 150.
- **Number audit and full check-build:** see the PR (they were running at the time of this commit).
- **Type:** the site face is now Atkinson Hyperlegible Next (Ali's pick, after the screenshots above were taken).

## What was done, stage by stage

| Stage | Commits | What |
|---|---|---|
| 0 | 5919c5a, 79fb88a, 5b6b1cc | Plan and prompt committed; five-item nav; `/sources` and `/datasets` redirects; Library shapes in `contract.ts`; `library.json` (draft); darker blue; `routes-alive.mjs` (every address of the build of `main` still answers or redirects to a page) and `editorial-plain-words.mjs` plug-ins; per-track stylesheets |
| 1 | 95ce15f | Hub home page (`components/hub/`), `stories.json` (draft), `home-derived.mjs` and `home-stories.mjs` plug-ins |
| 2 (helper A) | f62b284 ... f04cd6b, merged 2866b5d | `prebuild/library.mjs` (serves verified files and pdf.js); `library-counts.mjs` plug-in; Library, Datasets, document page, PDF viewer, evidence-sheet link |
| 3 (helper B) | e13943e ... c5ecaa9, merged 342e8fc | Defect list; Indicators and Stories restyle; `/demo/type` |
| 3 (lead) | 5919a52, 7638618, 1b4ed5c, eb0ea48 | Daily prices placeholder; plain break words on story pages; type trial widened twice at Ali's request; helpers' decisions and traps recorded |
| 4 | this commit | One build, number audit, full check-build, one fix round, screenshots, 360 px pass, this report, `STATUS.md` |

Ali asked during the run for fewer repeated checks: the build, number audit and full check-build ran once, at
stage 4. Helpers checked their own work with lint, tests and a dev server. Helper A also ran check-build in a
scratch layout over its pages, with zero problems on them.

## Judgement calls

Every one is in `DECISIONS.md`, dated 2026-11-23: Ali's overrides and in-run instructions, and the agent's choices
marked "provisional (unattended, 2026-11-23)". The ones a reviewer should look at first:

- **Like with like.** A budget estimate is compared only with the previous budget estimate ("on last year's
  budget"). Where that earlier estimate was later revised, the revised figure is shown beside it ("revised to ...")
  and is not used in the change. `home-stories.mjs` fails the build if a compared budget estimate has a revised
  figure in the release that the page does not link.
- **First-screen word count.** The limit (120) is counted as words containing a letter. Figures, units and arrows
  are not counted as words. The header, ticker and screen-reader-only text are excluded. The featured chart's
  caption repeats its headline sentence, so it is kept for screen readers only.
- **Plain words.** The precise qualifiers AGENTS.md requires stay on the page one layer down: in the closed
  "What this covers" under the featured chart, in "How the changes on this page are computed", and on series and
  story pages ("current expenditure on revenue account" and the like).
- **Files.** The build reads PDFs from `SOURCES_DIR`, set at build time. Each file is SHA-256 checked against the
  manifest and served as `/data/<v>/sources/<source_id>.pdf`. The rejected AJK file (`lfs-pbs-2014-15`) is listed
  with its reason and is never served.
- **Viewer.** It does not read the PDF structure tree and fetches in 64 KB ranges (measurements in `DECISIONS.md`).
- **Chart axes** stay in the printed unit (ticks like 20,000,000 under "Rs million"), not rescaled.
- **Daily prices** is a placeholder with names only. No figure is shown, and the plain-words plug-in checks
  `daily.json` for digits.
- **Type trial.** Faces without aligned (tabular) figures in their text cut were left out (measured in the browser).
  So were the Fontshare faces (not open-licensed). Serif headings, which break DESIGN.md's "no serif" rule, are
  grouped and labelled so.

## Left undone or open

- **For Ali:**
  - **L1** mirroring government PDFs: the preview mirrors them, by default.
  - **L2** the whole corpus: the shared Drive folder was not read; above a few hundred MB the files need object
    storage, with Ahmad's bridge.
  - **L3** documents with no extracted data: the shape exists (`document-only`), and no such document is listed yet.
  - **The font:** a pick from `/demo/type`.
  - **Draft names** in `site/editorial/library.json`, `stories.json` and `daily.json`.
  - **Daily prices:** the collection itself (Ali builds it).
- **Pipeline or methods** (not front end, so left alone):
  - monthly inflation holds June figures only;
  - the June 2022 CPI issue is missing;
  - the default series view mixes budget and revised figures.
- **Front end, not done:**
  - `spark.json` (built by `prebuild/search.mjs`) does not yet mark series breaks, so home sparklines use the
    whole run of checked figures where the series page uses the latest unbroken run;
  - the Library's network routes (official address and archive copy) are written but untested, because every
    file was found locally;
  - viewer search loads the whole file.
- **Vercel preview:** it has no `SOURCES_DIR`, so it serves no PDFs. Only a human can decide where the files live
  for a deployed site (L1, L2).
- **Next.js 16.4.1 dev server:** it printed a "security upgrade" notice addressed to agents. It was not acted on;
  a human should read the advisory.

## For Ahmad: what the front end now expects from the bridge

All in `site/src/lib/adapter/contract.ts` (section "the Library"). A bridge fills the same shapes, and the pages
need no change.

- `LibraryDocument`:
  - `id`, `kind`, `kindName`, `printedTitle`, `period`;
  - `publisher`, `publisherFull`, `pages`, `bytes`, `format` (`pdf` or `csv`);
  - `officialUrl`, `officialPage`, `archiveUrl`, `sha256`;
  - `file` (`href`, `bytes`, `sha256`, `via`) or null;
  - `state` (`read`, `rejected` or `document-only`) and `rejectedReason`;
  - `pagesRead`, `seriesIds`, `datasets`.
- `LibraryDataset`:
  - `key`, `name`, `line`, `firstPeriod`, `lastPeriod`, `seriesCount`, `visible`;
  - `files` (`csv`, `xlsx`, `zip` or null), `documentIds`, `previewSeries`.
- `Library`: `documents`, `datasets`, `namesStatus` (`approved` or `draft`).
- **File location:** one setting, `LIBRARY_FILES_BASE` (default `/data/<release>/sources`), so served files can
  move to object storage without code changes. A file is listed only if its SHA-256 equals the registered one.
- **Page addresses:** the evidence-sheet link needs, for each served document, its page numbers as PDF page
  numbers (`#page=N` / `?page=N`), the same numbers the receipts carry.
