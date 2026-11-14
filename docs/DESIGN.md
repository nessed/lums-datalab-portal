# Site design brief

> **Status: DRAFT for approval, 15 November 2026.** Ali and Ahmad approve it, or ask for changes, with one line in
> `DECISIONS.md` ("Design brief 2026-11-15 approved", plus any changes). **No site code changes until then.**
> It replaces the S16 draft of 12 October 2026, which the current site was built to (in git history:
> `git show d5897ca:docs/DESIGN.md`). The decisions it needs from you are in section 17.
>
> **Confirmed by Ali, 15 November 2026:** this portal is the project's single public site. Ahmad's verified
> repository (`ahm3d-karim/pak-econ-golden-data`) will become its **only** data source, through tagged golden
> releases. His local wiki generator will not be hosted; its useful parts move into this portal (section 5.5). The
> site always shows which release it is built from.
>
> The evidence behind it is `docs/DESIGN_REFERENCE.md`: about forty sites studied on 14 and 15 November 2026, with
> screenshots and measurements. Section and pattern references below (for example "ref 2.5") point there.

How the portal should work, look and behave, and why. It says **what** to build and **what not to build**. It does
not prescribe code, except where a rule must be enforced by the build.

Contents: [1 What we are building](#1-what-we-are-building) ·
[2 What the research found](#2-what-the-research-found) ·
[3 Why the site still reads like a yearbook](#3-why-the-site-still-reads-like-a-yearbook) ·
[4 Principles](#4-principles) · [5 The data contract](#5-the-data-contract-a-swappable-source) ·
[6 Words on the page](#6-words-on-the-page) · [7 Evidence](#7-evidence-three-depths) ·
[8 Versions and corrections](#8-versions-and-corrections) · [9 Pages](#9-pages) · [10 Search](#10-search) ·
[11 Charts](#11-charts) · [12 Tables](#12-tables) · [13 Downloads, citation, links](#13-downloads-citation-and-links) ·
[14 Phones, speed and staying alive](#14-phones-speed-and-staying-alive) · [15 Look](#15-look) ·
[16 What we do not do](#16-what-we-deliberately-do-not-do) · [17 Decisions needed](#17-decisions-needed-from-ali-and-ahmad) ·
[18 Order of work and how we know it worked](#18-order-of-work-and-how-we-will-know-it-worked)

---

## 1. What we are building

**A data tool for Pakistan's official economic and fiscal numbers that people use to find, chart, compare, download
and cite a figure, and that can show, for every figure, the printed page it came from.** The receipt is what nobody
else has (ref 2.3, 3.6). It stays, and it moves one layer down: available under every number, never in the way of
the answer.

Four kinds of reader, one site. Each has a job and a test the design must pass (section 18 turns these into
acceptance tasks):

| Reader | What they come for | The design passes when... |
|---|---|---|
| Economist, finance or policy analyst | The exact figure, its kind (budget estimate, revised, actual, provisional), its document and page, all versions, a file for Stata/R/Excel, a citation that will still resolve | they get a figure, its versions and a release-pinned citation in two taps from the series page, and a file whose rows carry status, kind and source |
| Economics teacher | A clean chart in class, on a phone or projector, without fuss | from search, a full-screen chart with its source printed inside it in two taps and under 30 seconds on a phone |
| Student | Find a number without knowing its official name; understand what it means; get it into Excel | plain and misspelt queries ("inflaton", "unemployment women", "health spending", "tax revenue 2023") lead to the right series or to an honest "not published yet" |
| Interested citizen | One sentence: how much, when, what kind of figure, can I trust it | the first phone screen answers in a sentence with the period and the kind of figure, and a held-back figure says why in one sentence |

**English only. Phone first.** Most readers in Pakistan are on Android Chrome on a budget phone, often 360 px wide,
on 4G that behaves like 3G at peak hours (ref "Pakistani users").

**Constraints that no design choice can bend** (from `AGENTS.md` section 3 and the user's brief for this redesign):

- Every number on the site comes only from the frozen release. Nothing is typed into a page, computed in the
  browser from unchecked inputs, or fetched live.
- Receipts and caveats are never dropped. A design may move them to a deeper layer; it may not remove them.
- A figure that has not passed its checks never shows a number: not in charts, sparklines, tooltips, search
  answers, exports or crops (the existing exceptions for disputed and "printed as a dash" stay, enforced by
  `scripts/check-build.mjs`).
- The data source must be swappable. Ahmad's verified repository (`ahm3d-karim/pak-econ-golden-data`) will become
  the only source, through its tagged releases; until then the site reads our own release. Section 5 is the contract
  that lets the switch happen without redesigning a page.
- The site always says which release it is built from: in the header, on every receipt, in every citation and in
  every downloaded file.

## 2. What the research found

The ten findings that drive this brief. Details and screenshots are in `docs/DESIGN_REFERENCE.md`.

1. **Answer first wins everywhere.** The pages that work on phones put the measure, the period, the number and the
   change on the first screen and the metadata under it (Stats NZ, ONS cards, Census instant answers, BEA). The ones
   that put metadata first fail (ref 2.1).
2. **One series page, one skeleton.** FRED is the economists' default because every series page is the same: the ID
   beside the title, a fixed band with latest value, units, frequency, updated and next release, then the chart
   (ref 2.2).
3. **Evidence works in three depths**: a one-line source at the number, a drawer one tap away, a full page for
   checking. Our payload (document, page, the boxed cell) is better than anyone's; our delivery (everything at one
   depth, ten phone screens) is worse than OWID's or Wikipedia's (ref 2.3).
4. **Status needs a grammar**: a value plus at most one word, or a labelled gap in place of the value; the legend
   lists only the marks present; reasons are specific and travel into anything computed from the figure (Statistics
   Canada, BLS, Eurostat; ref 2.4). Specific caveats cost no trust; vague ones cost trust in the number and the
   source (van der Bles 2020, Kerr 2023).
5. **Nobody shows revisions well, and budgets are our chance.** No statistics office shows old and new values side
   by side. South Africa's vulekamali shows the change between original and adjusted budgets as its own number and
   names the phase of each year's bar. Our 2025-26 federal health figures (budget estimate Rs 31,975 million, revised
   Rs 60,245 million) are exactly the story none of our pages tells (ref 2.5).
6. **Corrections are loud, revisions are quiet** (ONS); a correction belongs on the affected figure, and in the file
   (Crossmark), not only on a changelog page (ref 2.6).
7. **Search must know the hundred things people ask for**, forgive spelling, never dead-end, and say "we do not
   publish this; here is who does". Eight years after its first beta, the US Census Bureau's search works only for its
   curated concepts (ref 2.7). Ours finds
   nothing for "GDP", "unemployment women" or any typo, and the header search is broken on the live site.
8. **Draw a sensible chart at once; make the first control "Units"** (FRED: level, change, % change from a year ago,
   index to 100). Tools that make you configure first lose casual users (ref 2.8).
9. **Downloads and citations must say what they are and pin a version**: use-described formats with sizes, flags in
   their own column, a citation sentence with the publisher first and the release in it, a frozen link and a live
   link (OWID, ABS, Statistics Canada, Zenodo; ref 2.9, 2.10).
10. **Our speed is a real advantage; keep it.** On a slow phone connection our series page shows its number and chart
    in about 3 seconds; FRED, OWID, the World Bank, IMF and Census take 37 to 56; PBS over 90. The simple layer is the
    mobile product everywhere (ref 2.11, Measurements). Open Budgets India's domain now serves a casino: permanence
    needs a plan (ref 2.13).

## 3. Why the site still reads like a yearbook

The October rebuild added the parts of a data tool (search, facets, tabs, compare). It still reads like a yearbook
because:

1. **It is organised by document, not by question.** Data types (ABS, CPI, LFS) are the main entry; series carry
   their printed row labels as names. A reader must know which publication holds the answer before they can find it.
2. **It explains its process at the same depth as its answer.** The phone receipt is about ten screens; the home page
   spends half its length on method and quality tables.
3. **Its tool verbs are thin.** No transforms, no touch tooltip, compare without a common basis, search without
   synonyms or typo tolerance.
4. **Its best facts are buried.** The near-doubling of federal health spending from budget to revised estimate has
   no sentence anywhere.
5. **Numbers are shown as printed, not as read.** "25,164,008 Rs million" is the exact figure and the wrong headline.

None of these is about typefaces or colour. The fix is structure, words and verbs, which is what sections 6 to 13
specify.

## 4. Principles

In order. When two conflict, the earlier one wins.

1. **Right or absent.** A wrong number is the worst outcome; a labelled gap is acceptable. No design choice trades
   this away.
2. **Answer first.** Every data page opens with the answer to its question: what, when, how much, what kind of
   figure. Method, metadata and caveats follow, except a caveat that changes how the number reads, which goes next to
   it.
3. **Evidence one tap away, in layers.** Glance, one tap, full receipt (section 7). Specific words, never vague
   hedges.
4. **Questions before documents.** Readers arrive with topics ("inflation", "health spending"), not publication
   names. Documents are how we prove things, not how we organise them.
5. **Every view is a link, and every link lasts.** View state lives in the URL. Citations pin a release. Nothing
   depends on a session, a login or a server that might not be there in ten years.
6. **Fast on a bad phone.** Number and chart visible in under 2 seconds on Fast 3G and under 4 seconds at 400 kbps,
   with JavaScript off if need be (section 14).
7. **Plain words first, codes second.** "Budget estimate", "held back: the parts do not add up to the printed total",
   not "tier B" or "COLUMN TOTAL". The local abbreviations BE and RE are fine after the full words have appeared once
   on the page (6.2). Codes and ids stay available to experts in the second layer and in files.
8. **One skeleton.** Every series looks the same and every receipt looks the same. Learn one page, use all of them.

## 5. The data contract: a swappable source

Today the site reads our release's files directly through `site/src/lib/data.ts`. The plan is now fixed: **the
site's only data source will be Ahmad's tagged golden releases** (`golden-YYYY.MM.DD`: the golden CSVs,
`golden/catalogue.json` with a fingerprint per file, `golden/RELEASE.json` with a fingerprint per dataset, `exceptions.csv` per dataset, and the
sign-off log), and our own release serves until the switch. So **every page reads data only through one adapter that
produces the contract below**. The site knows nothing else about where the data came from. There are two adapters
during the transition (ours, then his) and one after it; the build reads exactly one release.

The build **pins a release by its tag** and checks it before using it: every file's fingerprint must equal the one
recorded for it (`catalogue.json` per file, `RELEASE.json` per dataset), as his query tool already does. A file that does not match stops the build. The release id
(`golden-2026.11.11`, or ours, `v0.0.1-prototype`) is part of every page, receipt, citation, file and link (13.3).

### 5.1 What the adapter must provide

| Thing | Fields the site relies on |
|---|---|
| **Release** | id, frozen date, licence, citation text, errata entries, the source it was built from, whether it is the latest |
| **Source document** | id, publisher, title, edition, publication date or "not known", official URL, archive URL, file fingerprint, page count, reliability note (if the source provides one) |
| **Series** | stable id; a reader name and a one-line plain definition; the printed label(s); unit and scale as printed; frequency and period convention (fiscal year July-June, month); geography; topic tags; parent in a hierarchy; breaks (period, kind, note); notes; the kinds of figure it can carry; whether it is in the headline layer |
| **Observation** (one printed or computed figure) | series; period; **kind of figure** (section 6.2); **the printing**: which document and edition it comes from; value as printed (text) and as a decimal; **status** and a one-sentence **reason**; **evidence** (below); links to the other printings of the same series, period and kind |
| **Evidence** | one or more of: *printed cell* (document, page, printed page number, box on the page, printed text, whether the box is exact or tentative); *recomputed* (our value, the published value it was checked against, that table's document and page, the method); *derived* (formula and the observations it uses); and the checks with their result and a plain sentence |
| **Correction** | date, release, the observation, old value, new value, cause, link to the superseded receipt |

Rules for the adapter:

- **It never invents.** A field the source does not have is "not known" or absent, never guessed. Pages show "not in
  this release" for a missing field, as they do now.
- **It keeps the printed text.** A value always carries the string as printed. A source that stores a printed dash as
  0 must say so per value, or the site cannot honour "a dash is not a zero" (decision 17.3).
- **It decides status; the site only displays it.** The mapping from the source's own vocabulary to the reader
  statuses in 6.1 lives in the adapter, is written down, and is tested.
- **Only deterministic evidence counts as a check.** Arithmetic, cross-document agreement, agreement with a published
  figure and recomputation from microdata count. **A reading by a language model never does**, even as a "second
  reader" (`AGENTS.md` sections 3 and 4). Ahmad's Economic Survey dataset records a Haiku second reader that agreed
  with all 6,080 values; the adapter ignores that for status and the site never cites it as evidence.
- **Gaps can be whole batches.** In a golden release a held batch or round (a budget year, a survey round) has no rows
  at all. The contract therefore has a *batch gap* (dataset, batch, reason) as well as a gap for a single figure, and
  pages and files show both: a series chart marks the held round as a labelled gap; a file carries one row per held
  batch with its status and reason.
- **One contract test suite** of fixtures: a checked value, a value with a tentative box, a recomputed survey figure,
  a derived share, a held-back value, a disputed pair, a revised pair, a not-printed dash, a candidate, a correction.
  Both adapters must pass it, and `check-build.mjs` runs on whichever release is built.

### 5.2 How the two sources map

| Reader status (6.1) | Our pipeline (`releases/v0.0.1-prototype`) | Ahmad's repository (`golden/`, `registry/signoffs.csv`) |
|---|---|---|
| Checked | `checked` (tiers A and B) | a row in a **golden** dataset, no asterisk |
| Checked, with a note | checked, with a series or observation note | `restated*`, `memo*` (with the text from `exceptions.csv`) |
| Not yet signed off | (not used today) | a row in a **candidate** dataset (decision 17.1) |
| Revised (a later printing replaced it) | a cross-edition pair that differs and is explained by edition | "genuine revision" between two documents (both rows kept as vintages) |
| Disputed | `disputed` | a cross-document difference not classified as a revision (decision 17.2) |
| Held back | `withheld` | a **held** batch or round; and `misprint*` rows (decision 17.2) |
| Checked, with a note (surveys) | (not used today) | `assumption*`, `small_sample*`; `unpublished*` needs a decision (17.8) |
| Not yet checked | `unverified` | "source" rows in the catalogue (held, not verified); never a number |
| Not printed | `not published` (printed dash or blank) | no row for an unprinted code; **a printed dash is stored as 0** (decision 17.3) |

Evidence kinds map the same way: our cells and Ahmad's PDF-backed rows both carry a page and a box (his are in PDF
points; ours are fractions of the page; the adapter converts). His "tentative" (dashed) boxes become *printed cell,
box tentative*. His survey indicators recomputed from PBS microdata have **no page box**: they become *recomputed*
evidence, showing our value, PBS's printed value and the table it was checked against. His reliability tiers (A to D,
provisional) are a property of the source document, not of the figure (decision 17.4).

### 5.3 What a golden release holds today, and what the site must add

Read from the repository at commit `7559585` (13 November 2026); latest tag `golden-2026.11.11`.

- **Fourteen datasets in the catalogue's golden layer: four signed off** (`abs_federal_functional`, `lfs_indicators`,
  `pslm_indicators`, `hies_indicators`) **and ten candidates** (`abs_federal_economic`, `abs_federal_receipts`,
  `budget_credibility`, `fed_dfg`, `kp_abs_summary`, `sindh_abs_summary`, `pes_headline_indicators`,
  `pes_debt_external`, `pslm_education_health`, `lfs_informality`). The other 34 catalogue rows are sources held but not
  verified (names only, never a number).
- **Four shapes of row**, which the adapter turns into the one contract of 5.1:
  - *Budget documents* (federal ABS, Demands for Grants, KP and Sindh summaries): one row per printed figure, keyed by
    the document (`doc_fy`), the year it is about (`ref_fy`), the kind of figure, the table and the line; with the
    source file, its fingerprint, its URL, the page and the box on the page.
  - *Economic Survey tables*: one row per figure per edition, with the printed text, a column flag (F final, R revised,
    P provisional) and partial periods (July to March).
  - *Survey indicators* (LFS, PSLM, HIES) recomputed from PBS microdata: our value, PBS's published value where one
    exists, the difference, the published table and page, a check status (`matched`, `not_published`), the method in
    words, sample sizes.
  - *Derived*: `budget_credibility` pairs each budget estimate with the next year's revised estimate and gives the
    deviation, with the source page of both. **The versions strip (8.1) and the change view (8.2) read these rows**
    instead of computing in the site, so the numbers come from the release.
- **Rich metadata already exists per dataset** in `catalogue.json`: name, publisher, level, status and sign-off,
  coverage, unit, grain, checks run and passed, caveat notes, held batches, update schedule (the source of "next
  edition expected"), reliability class. Each dataset's `SCHEMA.md` and `exceptions.csv` hold definitions and the
  evidence for every asterisk.
- **His series rule** (`query/series.py`): one figure per reference year, chosen by a fixed rule (actual or accounts
  beat revised, which beats budget estimate; within one kind, the latest document), with the other printings listed
  and **breaks from `query/series_breaks.csv` never joined**. The site uses the same rule (8.2), so the portal and his
  query tool can never give different "latest" figures.

**What the site must add, because a golden release does not carry it** (the portal's own editorial layer, reviewed
by a person, kept in this repository, keyed to his dataset and item keys, never containing a number):

- **Series ids.** His rows have keys, not series ids. The portal defines a stable id for each series (one item in one
  group, as his series rule defines it) and keeps the mapping; an id never changes meaning once published.
- **Reader names, one-line definitions, topic tags and the headline layer** (section 6.4, 9.1). His printed names and
  indicator codes (`gdp_growth_real`, `employment_share_pbs_agriculture_forestry_fishing`) stay as the printed or
  technical names.
- **Page dimensions and boxes as fractions** for drawing proofs come from the proof index (5.4, decision 17.7); the
  CSVs hold boxes in PDF points only.

**What the switch would lose today**, because the golden releases do not have it yet:

- **CPI.** No CPI dataset; his open task T11 ("CPI from PBS") has not started.
- **Recent LFS.** His golden LFS covers rounds 2005-06 to 2018-19, with 2014-15, 2020-21 and 2024-25 held; our release
  publishes LFS figures read from the reports up to 2024-25, including the 19th ICLS series.
- **Every candidate dataset**, if decision 17.1 shows nothing from candidates: at today's release that leaves only
  federal expenditure by function and the three survey indicator sets.

Decision 17.7 covers when to switch.

### 5.4 Page proofs power the receipts

Ahmad's repository now produces a **page proof** for any document figure: an image of the printed PDF page with that
figure boxed, and an honest label when the box cannot be placed confidently. This is the same evidence our receipts
show, so after the switch **the receipts are built from his proofs**, not from our own page renders. What the site
needs from each proof, and how it shows it:

| Proof state (his wording) | What it means | What the reader sees |
|---|---|---|
| Solid box, "full proof" | the stored position holds the printed value, and the row and column headings were confirmed | the boxed crop and the page, as our receipts show today: "Printed here" |
| Solid box | the stored position holds the printed value (headings not both confirmed) | the same, without the "row and column confirmed" line |
| Dashed box | not confirmed, or several places on the page could match; every candidate is outlined, none is asserted | dashed outlines and the words: "We could not pin this figure to one place on the page. It is printed on this page; the dashed boxes show where it could be." No magnified crop, because a crop would assert a position |
| No box | the figure is not in the page's text layer | the page without a box: "This page is the source. We could not locate the figure on it automatically." |
| No image | the source PDF was missing or did not match its fingerprint when the proofs were made | no page image: "The page image could not be checked against the official file, so it is not shown." The document, page and official link remain |
| Survey figure | recomputed from microdata; no printed page of its own | our value, PBS's printed value, the difference, and the report, table and page it was checked against |

Rules for using proofs:

- **The format already fits.** His proof builder (`wiki/proofs.py`) renders one image per cited page
  (`proof/pages/<file fingerprint>/p<page>.webp`, 144 dpi, greyscale) and stores each row's solid and dashed boxes as
  fractions of that image; it checks every PDF against the row's fingerprint first. The labels come from the same code
  as his `show_source` tool, so the site and his tool can never disagree about a box.
- **The box is drawn by the site over an untouched page image**, from fractions of the page, exactly as our receipts
  do now and as his wiki does. The image file is never edited.
- **A crop is only ever cut around a solid box.** Dashed or missing boxes never produce a magnified crop.
- **Proofs must be part of the frozen release**, with fingerprints, or produced reproducibly from it, so that "every
  number comes only from the frozen release" holds for the evidence too (decision 17.7). Today the images are made
  by his local build from raw PDFs that are not in git.
- **Weight:** his proofs are one greyscale WebP per cited page (about 1,760 pages, about 130 MB, so roughly 75 KB a
  page). The receipt loads the page only when opened (7.1); the first screen uses a pre-cut crop of at most 40 KB
  (14.1). Neither is ever prefetched.
- Budget-credibility rows (a budget estimate and the next year's revised estimate) open **both pages**, as two tabs in
  the receipt, which is the versions strip of 8.1 with its evidence.

### 5.5 What moves over from the wiki

His wiki generator will not be hosted. Its useful parts become parts of this portal:

| Wiki part | Where it goes here |
|---|---|
| Home: golden datasets, then candidates, then sources held but not verified (names only, no numbers) | Sources (9.8) and Data (13.1); the "held, not verified" list as names only, never a number |
| "How to read this": golden, candidate, held, each asterisk, reliability tiers (marked provisional) | Methods, in the reader vocabulary of section 6, with the asterisk names given once as the source's own terms |
| Dataset page: description, coverage, rows, unit, grain ("what one row is"), checks run and passed, **sign-off status and the sign-off log rows (who signed, when, on what evidence)**, held batches with reasons, caveats, the schema, the full exceptions table, source files with fingerprints and download links | Source and dataset pages (9.8). The sign-off log is public: it is how a reader sees that a person, not only a program, stood behind a dataset |
| Candidate banner: "Candidate: not yet signed off. Do not cite." | the "not signed off" status of 6.1, on every value, page and file from a candidate dataset (decision 17.1) |
| Data browser by batch (a budget year, a Survey edition, a survey round) with an "asterisk and reason" column and "open source at page N" | Tables as printed (9.7) and the series table (12), with the reason in the one-tap sheet |
| Indicator index for surveys (each indicator, unit, rounds) | the survey topic pages (9.3) |
| Page proof panel: zoom and drag, "go to the figure", next and previous row with the arrow keys, Escape to close, a link that opens one figure | the one-tap sheet and the receipt (section 7); keyboard moves keep working; every figure has its own URL (13.3) |
| "What's next": datasets waiting for sign-off, proposed datasets | a public "Coming" list on the Releases page, generated from the sign-off log; internal task lists stay internal |

## 6. Words on the page

### 6.1 Statuses: a value plus one word, or a labelled gap

Following Statistics Canada's grammar (ref 2.4): **accompanying** words sit beside a shown value; **replacement**
words stand in place of a value that is not shown. Every status has a shape as well as a colour, as today, so it
survives greyscale and colour-blindness.

| Status | Shown how | Words at a glance | Example of the one-sentence reason |
|---|---|---|---|
| Checked | the value, **unmarked** | none (a table says once: "All figures checked unless marked") | "Checked twice: it adds up with the other lines in its table, and the next year's budget prints the same figure." |
| Checked, with a note | value + small note mark | "note" | the source's own caveat, verbatim where it is ours to quote |
| Not yet signed off | value + mark (if decision 17.1 shows values) | "not signed off" | "A person has not yet approved this dataset." Followed by this figure's own check result, stated separately (a candidate dataset can contain figures that failed a check and are kept as printed) |
| Revised | value + "revised" for one release cycle | "revised" | "Printed as Rs 31,975 million in the 2025-26 budget; revised to Rs 60,245 million in the 2026-27 budget." |
| Disputed | **no single value**; both printings on the receipt | "disputed" | "Two official documents print different figures for the same line and year, and each adds up in its own table." |
| Held back | **no value** | "held back" | specific: "The ten function lines add up to a different total from the one printed. We do not know which line is wrong." (Only figures that are themselves checked may be quoted in a reason, as now.) |
| Not yet checked | **no value** | "not checked yet" | "We have read this figure but no check covers it yet." |
| Not printed | **no value**; the printed dash on the receipt | "not printed" | "The document prints a dash here, not a number. We do not read a dash as zero." |

Rules:

- **Mark only what is not the default.** Checked is the default and is unmarked. A legend under each table and chart
  lists only the marks that appear in it (Eurostat, BLS).
- **Reasons are specific.** Never "may be unreliable" or "subject to revision". Name the check, the document, the
  difference (ref 2.3, OSR guidance).
- **Gaps travel.** A change, share or growth rate computed from a held-back figure is itself held back, with the same
  reason (BLS, ref 3.2).
- **Retire internal words from the first layer:** "tier A/B", "passed within the stated tolerance", "COLUMN TOTAL",
  "evaluable". They stay in the technical record and in files.

### 6.2 Kinds of figure and printings

- The golden releases already use: **BE** (budget estimate), **RE** (revised estimate), **ACTUAL** (as printed in the
  Demands for Grants book, which is not the final outturn) and **AC** (provincial accounts for a past year, not an
  audited actual); Economic Survey figures carry the printed column flag **F** (final), **R** (revised), **P**
  (provisional) and can be **part-year** (July to March). Each of these gets a reader word and its own chart mark, with
  the explanation his series tool already gives ("actual as printed in the DFG book (not final outturn)").
- The kinds in general: **budget estimate**, **revised estimate**, **provisional actual**, **actual** (fiscal); **as printed in
  the Economic Survey 2025-26** (compiled publications that revise the same year edition after edition); **survey
  round** (LFS, PSLM, HIES); **index** and **change over the same month last year** (prices). The list is
  extensible: supplementary grants, a missed edition or a rebasing must fit without redesign (BEA had to add
  "Initial" and "Updated" for the third quarter of 2025, released in December 2025 and January 2026; ref 2.5).
- **Say the kind beside the number, every time and everywhere**: on cards, in tooltips, in table headers, in search
  answers, in exported images and in file rows. BEA drops it in its interactive tables and the figures become
  indistinguishable (ref 3.2).
- Use the full words the first time on a page and **BE**, **RE**, **(P)**, **(R)** after that and in tables: local
  readers know these abbreviations from the budget and the Economic Survey (ref 3.5).

### 6.3 Numbers, units and periods

- **Headlines in short scale, exact figure one tap away**: "Rs 37.4 billion" on a card, "37,438 Rs million, as
  printed" on the receipt and in tables. The short-scale figure is formatted from the stored value by a fixed rule
  and never re-rounded in a table or a file.
- **Tables show values exactly as printed**, with thousands separators, right-aligned, tabular figures.
- **Units in every label**: "Rs million", "per cent", "index, 2015-16 = 100", "million persons".
- **Fiscal years as 2025-26**; months as "June 2026". Accept "FY26", "FY2025-26" and "2026" in search. Never crore or
  lakh (Indian usage), never calendar-year labels on fiscal data (FRED, IMF and the World Bank all mislabel Pakistan
  this way; ref 3.1).
- **Change with its unit**: "+17% on the 2025-26 budget estimate", "up 0.4 percentage points". Changes are derived
  figures: computed by the build from checked values only, marked as derived, with formula and inputs one tap away.

### 6.4 Names

Every series has a **reader name** ("Federal health spending (current, revenue account)", "Inflation, national, year
on year") and
keeps its **printed label** ("07 Health", "CPI National: General (all groups)") as a second line and in the receipt.
Reader names and one-line definitions are drafted by an agent, edited and approved by a person (`AGENTS.md`
section 4 allows this), kept in a reviewed file, never generated at build time.

## 7. Evidence: three depths

| Depth | Where | What it holds |
|---|---|---|
| **Glance** | under or beside every number: cards, chart tooltips, table cells, search answers | the value, its unit, kind and period; a status word only if not checked; a small **source marker** ("ABS 2026-27, p. 11"); an arrow if a later printing exists ("→ revised Rs 60.2 bn") |
| **One tap** | a bottom sheet on phones, a popover on desktop; the reader stays on the page, and the sheet has its own URL (a query parameter), so it can be linked and the back button closes it | the boxed crop; document, printed page and PDF page, row and column as printed; the verdict sentence; the versions strip (8.1); any note or correction, dated; three actions: **Full receipt**, **Cite**, **Official PDF at this page** |
| **Full receipt** | its own page, `/o/<id>` (unchanged URL) | everything, in collapsible sections (below) |

### 7.1 The receipt page

Keep its first screen: it is the best in the study (ref 1). Change everything under it. After the switch to golden
releases, the page image and box come from the page proofs (5.4), with their confidence label shown in words.

1. **First screen (unchanged in substance):** the figure in the large serif, unit, kind and period, then the boxed
   crop of the printed page. Add one **verdict sentence** above the crop ("Checked twice: ..."). Move "Copy citation"
   from the first line into the action row. **When the box is not solid** (dashed, none, or no image; 5.4) there is
   no crop: the first screen shows the page itself, scaled to the screen, with the dashed outlines if any and the
   honest label of 5.4. This will be common for some sources: Ahmad's own measurement (`docs/SHOW_SOURCE_COVERAGE.md`)
   found 62% of sampled Demands for Grants rows and 67% of Economic Survey headline rows dashed, against none for the
   federal ABS.
2. **Versions of this figure** (8.1), directly under the crop.
3. **Action row:** Cite · Official PDF, p. N · Archive copy · Share. On phones, a sticky bottom bar.
4. **Collapsed sections**, closed on phones, open on wide screens where there is room:
   - *Where it is printed*: the whole page image, **loaded only when opened**.
   - *How we know*: one card per check, a plain sentence first, then "Show the arithmetic".
   - *Notes and caveats*: breaks, definitions, source notes.
   - *Corrections and history*: dated notes; links to superseded receipts.
   - *Technical record* (collapsed even on desktop): extraction run and tool, cell id, printed text against stored
     value, file fingerprint, retrieved date, release.
5. **Target:** two to three phone screens before the first collapsed section (today about ten).

The receipt also serves **recomputed** figures (survey indicators from microdata): our value beside the value PBS
printed, with that report, table and page, and the printed page and box when the published figure has one (for
example, illustratively: "Our value 6.9; PBS prints 6.9 in the LFS 2024-25 report, Table N, p. M"); and the proof
states of 5.4, with exactly the wording given there.

## 8. Versions and corrections

### 8.1 The versions strip

On every receipt and in every one-tap sheet, one line per printing, oldest first, each linked to its receipt:

> Budget estimate (printed in Budget 2025-26): Rs 31,975 million → Revised estimate (printed in Budget 2026-27):
> Rs 60,245 million, **+88%** → Actual: not yet in this release

- **The change is written as a number and in words**, computed by the build from two checked values (derived, with
  its inputs). It is the most newsworthy and most teachable thing we have (ref 2.5, vulekamali).
- **Dates are publication dates** where the source provides them; otherwise the edition ("Budget 2026-27") and no
  date (the site does not guess dates; `Source.published_on` is still a pipeline request).
- For compiled publications (Economic Survey), the strip lists every edition that printed the figure.

### 8.2 Versions on series pages

- **Two views of a budget series, one switch:**
  - **Best available figure per year** (default): the series rule of 5.3 (actual or accounts, else revised, else
    budget estimate; the latest document within a kind). Because this line mixes kinds, **every point carries the mark
    of its kind and the legend names the kind per year**, as vulekamali does (ref 2.5). It matches Ahmad's query tool
    and answers a citizen's question.
  - **By kind of figure**: one line per kind (budget estimate, revised estimate, actual), as the site draws now, each
    with its own mark: hollow for estimates, solid for actuals. This is the view that shows the gap between budget and
    outturn, and the one economists will want.
  - Never one unmarked line that mixes kinds (Statista and Visual Capitalist show what that does; ref 3.3).
- A **"Change from budget to revised" view**: per year, the revision as a percentage, as a bar from zero (it is a
  change, so zero is meaningful), with the size in rupees in the tooltip and the table.
- **Multi-edition series (Economic Survey):** a "Show" switch: **Latest printing** (default) | **As first printed** |
  **Every edition**. The default line carries a mark per point saying which edition it comes from.
- **"How much do budget estimates change?"**: on topic pages for budgets, the average and average absolute revision
  from budget to revised estimate, by function, across our editions (BLS and BEA publish revision statistics; ref
  3.2). Derived, from checked values only.
- **Downloads** offer "latest only", "as first printed", "every printing" (long, with a `printed_in` column) and the
  **vintage grid** (rows = period, columns = edition), the format economists know (ref 3.6).

### 8.3 Revised is not disputed

- **Revised:** a later document replaced the figure. Both are kept, the later is "latest", nothing is wrong.
- **Disputed:** two documents print the same line, year and kind differently, and nothing says which is the
  replacement. No single value is shown.
- Our pipeline and Ahmad's classify these differently today (decision 17.2). The site shows whatever the adapter
  says, using these two words consistently.

### 8.4 Corrections (our own errors)

- **A correction is loud** (ONS, PubMed; ref 2.6): a dated bar on the affected receipt and series page, above the
  fold: "Corrected 3 December 2026 (release golden-2026.12.03, illustrative): we had X; the printed figure is Y. Cause: ..." with a link to the
  superseded receipt. It stays for one release cycle and remains in the history section after that.
- **The old receipt stays live** at its release-pinned URL with a banner "This is not the current value".
- **Each release page lists the values that changed**, generated from the two releases, not only a prose summary.
- **Every downloaded file carries an "Is this file still current?" link** to its release page, which says whether
  any value in it was later corrected (Crossmark; ref 2.6).
- Routine revisions (BE to RE) are not corrections and never use the correction bar.

## 9. Pages

### 9.1 Navigation

Header on every page: wordmark; a **real search field** (not only an icon; `/` and Ctrl/Cmd-K focus it); **Topics**,
**Compare**, **Sources**, **Methods**, **About**; the release on the right. On phones: wordmark, search field, Menu.
The prototype notice is one line, dismissible, and repeated in the footer.

**Topics replace data types as the way in.** A first set, each defined in an editorial file and filled only from the
release: Prices and inflation; Jobs and labour; Government spending; Government revenue; Provinces. Debt, growth and
others appear when a checked source exists. Until then, a topic is not in the navigation; planned data is listed only
on the Releases page's "Coming" list (5.5) and in the existing S16 "Coming: not in this release" slots, never as an
empty topic. Documents and data types
remain under **Sources**, which is where a researcher who thinks in publications will look.

### 9.2 Home

First phone screen, in order:

1. One line saying what the site is and what makes it different: "Pakistan's official economic numbers, each linked
   to the government page it was printed on."
2. The search field with three example searches.
3. **Headline cards** (four to six, chosen by a person in the editorial file, values from the release), each answer
   first (ONS card, ref 2.1): reader name; period and kind of figure in words; the value in short scale; the change
   against the comparable figure ("+17% on the 2025-26 budget estimate"); a source marker; the whole card links to
   the series, the value to its receipt (or sheet). No sparkline on phones if it costs the number its space.

Below: topic tiles; **Recently added and next expected** (from the release and a human-maintained release calendar,
for example "Next: Budget 2027-28, expected June 2027"); a short "How we check" line linking to Methods; the latest
release and any correction. **The quality table and the method summary move to Methods and Releases.**

### 9.3 Topic pages (new)

A topic page is the overview for one area: its headline cards; **questions people ask** (each a link to an answer
page, 9.4); the series in that topic as a short tree, each row with a sparkline and its latest value; the sources that
feed it; its known limits and gaps (Fiscal Data's "Notes & known limitations"; ref 3.4); for budget topics, the
revision statistics (8.2). It replaces the data type page as the place a newcomer lands.

### 9.4 Answer pages (new)

For the twenty or so questions people actually ask ("How much does the federal government spend on health?", "What is
inflation in Pakistan right now?", "What is unemployment among women?"), a page titled with the question whose first
sentence is the answer with its date and kind (USAFacts; ref 3.3), generated from a template and the release:

> The federal budget estimate for 2026-27 for current spending on health (revenue account) is **Rs 37.4 billion**.

The answer compares only like with like: a budget estimate with the previous budget estimate ("Rs 32.0 billion in the
2025-26 budget"), never with a revised estimate, which would read as "spending fell". The revision (8.1) is a separate,
labelled sentence. Then the chart, the source marker, a one-paragraph explanation of what the figure covers and does
not, written from the release's own series notes and breaks only (here: current spending on revenue account only,
not development spending on health, and federal only; the 2011-12 devolution break), and links to the series and
receipts. Where the release holds more than one part of the answer (current and development spending), the page shows
each, labelled, and never adds them unless the release has a checked total. The
questions and wording are editorial (a reviewed file); every number in them comes from the release. These pages are
what a citizen finds from Google and what a teacher sends to a class.

### 9.5 Series page

The workhorse. One skeleton for every series (ref 2.2). **Phone order:**

1. **Title** (reader name) and the printed label in small type; one-line definition, clamped to two lines with "more".
2. **The answer line**: latest value (short scale) · kind · period · change against the comparable figure · source
   marker. If the latest value is not checked, the line says what the latest checked one is and why the newer is
   missing.
3. **The chart** (section 11), within the first 300 px on a 360 px phone, with **Units** and range chips above it,
   the source line and key caveat inside its frame, and a break note directly above it when a break falls in range.
4. **Sticky action bar**: Download · Cite · Compare · Share.
5. **Table** (section 12): wide by kind of figure, newest first.
6. **Versions** (8.2) for multi-printing series.
7. **About this series**: definition, printed labels, unit and scale, period convention, notes, breaks, the documents
   it is printed in; the decoded series id with a copy button (ECB; ref 3.1).
8. **Where it sits**: a trail with the value at each level ("Total expenditure Rs 25.2 tn > Total current expenditure
   Rs 23.6 tn > Current expenditure on revenue account Rs 17.5 tn > Health Rs 37.4 bn", all budget estimates 2026-27;
   USAspending, ref 3.4), parent, children and siblings.

**Wide screens:** the same order in two columns: the answer line and chart across the top; About and Where it sits
in a side column. The fixed band (FRED) holds: latest value and kind, unit, frequency, updated, next edition expected,
range.

### 9.6 Compare: the chart builder

- Add series by search from the page itself (FRED's "Add line": one search box), or from "Compare" on any series.
  Up to six series.
- **Common basis, not second axes.** A "Show as" control: As printed (one chart per unit, as small multiples with a
  shared period axis) | Index, chosen year = 100 | % change from a year earlier | Share of a chosen total. The
  transform is a derived view of checked values, says so in the subtitle, and goes into the URL and the download.
- A sentence above the chart says when series are not comparable and why (different definitions, a break, a base
  change), as now.
- Combined download with provenance columns; the whole view in the URL.

### 9.7 Tables as printed

Keep (`/tables/[slug]`): it is the bridge between our series and the government's documents. Add **what changed**:
where a table prints a budget estimate and a revised estimate for the same year, a column or note gives the change
with its percentage. Make it work on phones (sticky label column, newest columns visible).

### 9.8 Sources (documents)

The list of documents we read, grouped by publisher and kind. Each **source page**: the document's facts (publisher,
edition, date if known, official and archive links, fingerprint), what we read from it, and a **per-document quality
table** (figures read, checked, held back, disputed, not printed; USAspending's public quality table, ref 3.4), plus
its tables as printed. Data type pages fold into this and into Methods.

### 9.9 Search results (section 10), Methods, Releases and corrections, Data and API, About

Text pages are the only place for long prose. **Methods** gains the quality numbers from the home page (coverage,
check pass rate and cross-edition agreement as separate numbers against their frozen thresholds, as now) and a
diagram of the steps a figure goes through. **Releases** lists every release with its changed values and errata.
**Data and API** is the downloads hub (section 13). **About** says who runs the site, who to contact, the licence
and how long it will be kept (section 14.4).

## 10. Search

Search is the main door. The rules:

1. **Curated concepts first.** A reviewed list of about a hundred concepts people ask for (health spending,
   inflation, petrol prices, unemployment among women, tax revenue, defence, debt interest, salaries, PSDP...), each
   mapped to its headline series and synonyms. Many of our 951 index entries already carry synonyms; extend and review
   them. Use the official names users know as synonyms too ("CPI National", "Monthly Review", "Annual Budget
   Statement", "Demands for Grants", "PSDP", "SPI", "LFS").
2. **An answer card** at the top when a query matches a concept: the reader name, the latest value in short scale,
   its kind and period, a source marker, and links to the series and receipt (Census instant answer; ref 2.7). This is
   something no peer does in its own search.
3. **Forgiveness:** typos (edit distance), stemming and synonyms ("women" ↔ "female", "spending" ↔ "expenditure"),
   stopwords ("on", "of"), years ("2023" matches 2022-23 and 2023-24), prefixes as you type.
4. **Visible inference.** If a word becomes a filter ("Punjab" → province), show it as a removable chip with "search
   everything instead". Never silently (Census; ref 2.7).
5. **Never a dead end.** Zero results offer a spelling suggestion, related topics, and for things we do not publish,
   an honest card: "GDP is not in this release. PBS publishes national accounts at ...; it is planned here once
   checked." (A link out is shown only if it was health-checked at build.)
6. **Results show the answer:** each series result shows its latest value, kind, period and unit; documents and
   tables appear as their own groups.
7. **Ranking:** concept match, then headline layer, then reader name, then printed label, then document text. The
   inflation *rate* outranks the index *level* for "inflation".
8. **One search everywhere.** The header field and the results page use the same index and ranking; `/browse?q=` sorts
   by relevance when there is a query.
9. **Budget:** index loaded on first focus, at most 40 KB compressed, results in under 100 ms on a slow phone. A small
   library with fuzzy matching over a prebuilt index is enough at our size (ref Measurements; the mobile research
   names MiniSearch as the best fit).

## 11. Charts

What stays from today: hand-drawn SVG rendered on the server (no client chart library; it is why we are fast), one
line per kind of figure with its own mark, lines that stop at gaps and breaks, gaps marked under the axis with their
status shape, every point a link to its receipt, view state in the URL, the table as the chart's text alternative.

What changes:

- **Units first.** Above the chart: **Units** (as printed; % change from a year earlier; change; index, chosen year =
  100; share of parent total; later real terms, % of GDP and per person when a checked deflator, GDP and population
  exist) and **range chips** (5Y, 10Y, All, plus a custom range). The subtitle always states the treatment ("Nominal
  rupees, Rs million, as printed", "Change over the same month last year, per cent, derived").
- **The source travels.** Inside the chart frame: a one-line source ("Annual Budget Statement 2026-27, p. 11 and
  earlier editions"), the key caveat if any ("Budget estimates, not actual spending"; "Break: devolution, 2011-12"),
  the release, the site address and the licence. The same lines are drawn into every exported PNG and SVG (OWID;
  ref 2.12).
- **Touch:** tapping a point opens the one-tap sheet (7) pinned to the bottom of the screen, not a box under the
  thumb (OWID; ref 2.11). Keyboard users get the same sheet.
- **Titles state the takeaway; subtitles define the measure** (USAFacts, ONS chart rules; ref 3.2, 3.3). Takeaway
  titles for headline and answer pages are editorial (reviewed file); series pages use the reader name.
- **Not-final figures look not final:** estimates hollow, actuals solid; a figure from a candidate dataset (if shown)
  with its own mark; a legend in words, listing only marks present.
- **Mixed units are never on one axis** (no dual axes): small multiples or a common basis.
- **Present mode:** one button hides the site chrome, enlarges type and keeps the source lines, for projectors
  (Gapminder; ref 3.3).
- **Breaks:** keep the labelled rule and the stop; offer "from the break onward" as a range preset where a break
  falls inside the series.

## 12. Tables

- **Wide by kind of figure on series pages**: Period | Budget estimate | Revised estimate | (Actual), newest first;
  status as a mark in the cell and a word only when not default; legend under the table listing only marks used;
  "All figures checked unless marked".
- **Phones at 360 px:** sticky first (period or label) column, newest period visible without scrolling (never off the
  right edge, as at Statistics Canada; ref 2.11), compact rows (aim for 15 rows a screen), no status column that falls
  off-screen.
- Hairlines, sticky header, tabular figures, right-aligned numbers, no zebra stripes, no card shadows (as now).
- Every number in a table links to its receipt (as now); tapping opens the sheet.

## 13. Downloads, citation and links

### 13.1 Downloads

- **One Download button** opens a sheet that says, before the click, what each file is for and how big it is
  (Statistics Canada, Census; ref 2.9):
  - **Excel (.xlsx)**, first, because it is what most Pakistani users open: a Data sheet, a README sheet, a Sources
    sheet, and the citation.
  - **CSV, long**: one row per figure with series id, reader name, period, kind of figure, printed in (document and
    edition), page, value as printed, value, unit, **status**, status reason, release, receipt URL. Status is always
    its own column, never glued to the value (Eurostat; ref 3.2). Held-back and unprinted figures are rows with an
    empty value and their status, never missing rows.
  - **Data package (.zip)**: the CSV, `datapackage.json`, a human README, the licence and `CITATION.cff`.
  - Scope in words: **this series (all years)** or **what is on screen** (the current view, transforms included).
  - Version formats where relevant (8.2): latest only, as first printed, every printing, vintage grid.
- **Every file carries** the release id, the date generated, the licence, the citation and the "Is this file still
  current?" link (8.4).
- **Whole release as one file**, with its size, on the Data page (Bangladesh Bank; ref 3.5), plus per topic and per
  source.
- Stable CSV URLs with an `=IMPORTDATA()` line for spreadsheet users. A documented query API stays "later" (the
  static files are the interface), as decided for S16.

### 13.2 Citation

- **Cite** opens a sheet with a **default sentence**, publisher first, then the release (FRED's form plus what FRED
  lacks; ref 2.10):

  > Government of Pakistan, Finance Division, *Annual Budget Statement 2026-27*, p. 11, "Health"
  > [fed.exp.current.function.health, budget estimate 2026-27]; retrieved from LUMS DataLab, release
  > golden-2026.11.11, https://.../golden-2026.11.11/o/..., accessed 15 November 2026.

  (Illustrative: the release id is whichever release the site is built from; the form matches the citation Ahmad's
  repository already recommends, "release id plus dataset and source reference".)

  Then APA, Chicago and Harvard, BibTeX and RIS, each with a Copy button and the access date filled in (ABS; ref
  3.2), and one line: "Cite both: the government document is the authority; the release records how it was read and
  checked."
- **Cite a figure, a series or a view.** A view citation pins the URL with its state and the release.
- **While the release is a prototype**, the sheet says so above the citation, as now.
- **DOIs** for releases once there is a home for them (decision 17.6): one for each release and one "concept" DOI
  that always means the latest (Zenodo; ref 2.10).

### 13.3 Links

- **Two links for everything citable**: a **release-pinned** link (`/golden-2026.11.11/...`, numbers frozen, never changes
  meaning) and a **latest** link (the current URLs). "Cite" uses the pinned link; "Share" offers both, worded "this
  release" and "always the latest" (OECD's snapshot vs live; ref 3.1).
- **Permanence is stated on the page**, not just true: "This link will keep showing these numbers" (OWID's teaching
  lesson; ref 2.10).
- **Readable URLs** (IMF DataMapper): series ids, observation ids (`~2026-27~be`), and view state in the query
  string. No session state, ever.
- **Retirements** (a rebasing, a reclassification, a series that stops): the old page stays, with a dated notice
  and a link to its continuation (ECB; ref 2.13).

## 14. Phones, speed and staying alive

### 14.1 Budgets

Measured on an emulated mid-range phone, 4× CPU slowdown, cold cache. Today's values are from the research (ref
Measurements). A page over budget fails the build once the performance check exists.

| Page | Budget (compressed, first load) | Today |
|---|---|---|
| Series page | ≤ 200 KB total; number and chart visible ≤ 2.0 s on Fast 3G, ≤ 4 s at 400 kbps | 381 KB (758 KB after 30 s); 1.4 s; 3.0 s |
| Home | ≤ 200 KB, and ≤ 250 KB after a minute on the page | 330 KB, then 2,005 KB |
| Receipt | ≤ 250 KB; crop ≤ 40 KB; the whole page image only when opened | 751 KB |
| Catalogue and search results | ≤ 100 KB of HTML, ≤ 1,500 elements | 593 KB in total, of which 285 KB HTML (5.3 MB uncompressed), 27,425 elements |
| Compare | ≤ 200 KB; layout shift ≤ 0.1 | 511 KB; 0.50 |
| JavaScript, any page | ≤ 100 KB, and none needed to read a number, a chart, a table or get a CSV | 142 to 161 KB |
| Web fonts | ≤ 40 KB in total, or system fonts | 148 KB |
| Search index | ≤ 40 KB, loaded on first focus | 16 KB |

### 14.2 Rules

1. **No prefetching of linked pages as they scroll into view**; prefetch on hover or touch at most, never when the
   browser asks to save data, and never images.
2. **Images only on request.** Page crops are pre-cut small files with set dimensions; whole pages load when opened.
3. **Number, chart, table and CSV link work as plain HTML.** JavaScript adds the tooltip sheet, search and the
   compare picker. A build check loads key pages with JavaScript off.
4. **Design at 360 px, test at 320 px.**
5. **No banner over the first screen.** The site sets no non-essential cookies, so it needs no consent banner; keep
   it that way.
6. **No gate.** No login, no form, no CAPTCHA, no bot wall that blocks scripts, R, Python or screen readers fetching
   our pages and files.
7. **Measure every deploy** against 14.1 on the key pages.
8. Later, cheap and unique: honour the browser's save-data request; a small offline cache of the shell, search index
   and recently viewed series and receipts, showing the release on every cached page (nobody in the study does this;
   ref Measurements).

### 14.3 Accessibility

Keep what the S16 build checks (axe on every route type, a keyboard walkthrough, contrast at least 4.5:1 for text and
3:1 for meaningful borders). Add: every number link has a name that includes value, kind, period and "see where it is
printed"; the bottom sheet traps focus and closes with Escape; charts are never the only carrier of a number.

### 14.4 Staying alive

Open Budgets India's links now lead to a casino (ref 2.13). Before the site is announced:

- a written owner for the domain and its renewal;
- a static mirror (the site must work served as plain files, and a build check proves it);
- releases deposited with DOIs (decision 17.6);
- source PDFs linked at the official URL and an archive copy, as now.

## 15. Look

The look stays restrained; the redesign is structural. Keep the current tokens, the single petrol accent, the status
shapes and the warm paper ground around document images.

- **Type:** Source Sans 3 for the interface, data pages and headings; Source Serif 4 only for the figure on a receipt
  and for long-form prose. **Subset both** to Latin and figures and drop the optical-size axis to meet the 40 KB font
  budget, or use system fonts for the interface if that cannot be met.
- **Colour:** near-black ink, hairline rules, one accent; a categorical palette of six for multi-series charts, safe
  for colour-blind readers, each line also with its own dash and marker (as decided in S16). Light theme only.
- **Density:** data pages are dense and calm. One sentence of lede at most. Metadata as key-value pairs, never
  sentences.
- **Buttons:** outlined; one filled primary action per view (Download on a series, Cite on a receipt). Icons only
  with a text label.
- **Print:** chrome hidden, collapsed sections opened, page images with a thin border, as now.

## 16. What we deliberately do not do

- **Gates of any kind**: logins, sign-up pop-ups, forms that ask who you are, CAPTCHAs, email-for-a-link (PBS, OECD,
  Karandaaz, SBP; ref 2.14).
- **Configure-first tools**: an empty chart until three things are chosen, chart-type menus, .Stat-style dimension
  panels (OECD, DataBank; ref 2.8).
- **Client-side chart libraries, tag managers, icon fonts, analytics that need a consent banner.**
- **Treemaps** as a main view (they truncate labels, fail on phones and say nothing about time; ref 3.4).
- **Estimates drawn like actuals**, headlines that drop "budget estimate", generated sentences that state forecasts
  as facts (Statista, Visual Capitalist; ref 3.3).
- **Real terms, % of GDP or per person** until a checked deflator, GDP and population series are in the release.
- **Interpolating or filling gaps**, even disclosed (USAFacts did; ref 3.3).
- **Hand-maintained numbers**: no headline table, count or value typed into a page (ABS's stale indicators; ref 3.2).
- **One app per year or per document** (Open Budgets India; ref 3.4).
- **A generic "upload any budget" platform** (OpenSpending; ref 3.4).
- **Duplicating SBP's monetary and external data**: link to EasyData series instead.
- **Letters or codes alone as status** (Statistics Canada on a phone; ref 2.4); vague hedges stamped on everything.
- **Gradient heroes, illustrations, carousels, stock photos, three-up feature cards, marketing words**, default
  dashboard looks, purple, glassmorphism, big radii, pies, 3D, legend-only charts (kept from S16).
- **Linking out to something not health-checked at build** (Finance Division's dashboard was down; ref 3.5).
- **Shipping a page nobody has looked at on a 360 px phone.**

## 17. Decisions needed from Ali and Ahmad

1. **Candidate figures.** Ahmad's repository publishes "candidate" datasets: checks passed, not yet signed off by a
   person. Our rule 2 says nothing publishes without passing its checks; it says nothing about sign-off.
   **Proposal:** candidate values may be shown, always marked "not signed off" (in the value's label, the legend,
   tooltips and files), excluded from the home page, answer pages and the headline layer of search, and visible in
   the "everything" layer and on their own series pages. Alternative: show nothing from candidates until signed off.
   The choice matters: at `golden-2026.11.11`, ten of the fourteen datasets are candidates, including federal
   receipts, the economic classification, Demands for Grants, the KP and Sindh budgets and the Economic Survey tables.
2. **Revised vs disputed, and misprints.** Our pipeline calls two differing printings "disputed" unless explained;
   Ahmad's classifies 21 of 22 such differences in the ABS as "genuine revisions" and keeps `misprint*` rows as
   printed although a check fails. **Proposal:** the site shows "revised" only where the adapter can say which
   printing replaced which (a later edition of the same series); otherwise "disputed". `misprint*` rows are shown as
   "held back" with the source's explanation as the reason, because a failed check withholds under our rule 2.
3. **A printed dash.** Ahmad's federal ABS datasets store a printed "-" as 0 (functional and receipts say so in their
   schemas; the functional table stores a printed "0" as 0 too) and keep no printed text; his KP, Sindh, Demands for
   Grants and Economic Survey datasets do keep the printed text (`printed_value`, `value_printed`). Ours never reads a
   dash as zero. **Proposal:** the federal ABS datasets gain a printed-text column in a future golden release; until
   then a 0 from them is shown with no number, as "printed as a dash or a zero; this release does not say which",
   with the page proof as evidence, and the site never uses it in a sum, change or share. (This is also the open question in `STATUS.md` about whether a dash
   means nil.)
4. **Reliability tiers.** Ahmad's sources carry provisional tiers A to D (official primary, official compiled, ...).
   **Proposal:** show them only on source pages, in words ("Compiled publication: re-reports figures first printed
   elsewhere"), never as letters on figures, and only once Prof. Hasnain approves the tiers.
5. **Topics.** Approve the first set (9.1) and who maintains the editorial files (topics, headline cards, questions,
   reader names, takeaway titles, search concepts).
6. **Permanence.** Who owns the domain; where the static mirror lives; Zenodo or Harvard Dataverse for release DOIs.
7. **Page proofs in the release, and when to switch.** The receipts will be built from Ahmad's page proofs (5.4), but his tagged
   releases do not yet include the proof images or their boxes; his local build renders them from raw PDFs that are not
   in git. **Proposal:** each golden release ships its proof images and a proof index (figure, page, box, confidence
   state) as release assets, fingerprinted in `RELEASE.json` like the data files. The portal never renders pages from
   raw PDFs itself. **When to switch:** the switch drops CPI and LFS after 2018-19 unless his releases have them by
   then (5.3). **Proposal:** switch at the first golden release that includes proofs and covers what the site publishes
   now (federal budget, CPI, LFS), or switch earlier and keep those series visibly "not in this release" until they
   arrive. Never show two releases' figures side by side on one site. Before any receipt uses his proofs, a person
   spot-checks a sample of them by eye, including ABS 2021-22, 2024-25 and 2025-26, whose pages have unusual crop
   boxes (his `WIKI.md` records that older line images for those years were drawn off the row; the page proofs use
   the corrected geometry, which a spot-check should confirm).
8. **Survey figures PBS never printed.** His `unpublished*` asterisk marks survey indicators computed from microdata
   that PBS did not print, so no published figure checks them. **Proposal:** show them only as "not checked yet" (no
   number) until there is a check, because rule 2 of `AGENTS.md` withholds what has not passed one.
9. **Answer pages.** Approve the idea and the first twenty questions.

(Stated by Ali on 15 November 2026, to be recorded in `DECISIONS.md` with the approval of this brief: the portal is
the single public site, and Ahmad's tagged
releases will be its only data source.)

## 18. Order of work and how we will know it worked

### 18.1 Order

Each step is a pull request with screenshots at 360, 820 and 1280 px.

0. **Fix what is broken now** (small, can go before approval of the rest if you agree): the header search dialog
   (the input is 0 px wide); link prefetching that downloads page images in the background; the catalogue rendering
   all 925 series at once.
1. **The adapter and the contract tests** (section 5), with our release behind it, plus a second adapter for a tagged
   golden release, built against a pinned tag. The release id appears in the header. No other visible change.
2. **Words**: statuses, kinds of figure, reader names, short-scale headlines (section 6), across existing pages.
3. **Receipt in three depths** and the one-tap sheet (section 7), with pre-cut crops.
4. **Series page skeleton**, Units and range chips, the touch sheet, the source line in charts and exports, the
   phone table (sections 9.5, 11, 12).
5. **Versions**: the strip, the change view, the version downloads (section 8).
6. **Search** (section 10).
7. **Home, topics and answer pages** (sections 9.2 to 9.4).
8. **Downloads, citation and links** (section 13).
9. **Compare with a common basis** (section 9.6).
10. **Performance checks in the build** (section 14).

### 18.2 Acceptance tasks

Run by a person on a real budget Android phone, and by script on an emulated phone (Fast 3G), before the redesign is
called done. Each passes or fails; failures are fixed or recorded in `docs/OPEN_WORK.md`.

| # | Task | Pass |
|---|---|---|
| A1 | From the home page, find the federal health budget estimate for 2026-27 and see where it is printed | ≤ 3 taps; the printed page visible; ≤ 10 s on Fast 3G |
| A2 | Teacher: inflation over five years, full screen, with its source visible | ≤ 2 taps from search; the source line inside the chart |
| A3 | Download a series into Excel | 2 taps; the file has a README, status and source for every row, and the release |
| A4 | Cite one figure | 2 taps; the citation contains the document, page, kind of figure and release, and its link opens the same numbers |
| A5 | See how the 2025-26 health figure changed between budget and revised estimate | 1 tap from the series page; the change in words and as a percentage |
| A6 | Search "inflaton", "unemployment women", "health spending", "tax revenue 2023", "GDP" | each lands on the right series or an honest "not published yet" card |
| A7 | Open a held-back and a disputed figure | no number shown for either; one specific sentence says why; disputed shows both printings |
| A8 | Switch the data source | the site builds from a tagged golden release through its adapter, refuses a file whose fingerprint differs from `RELEASE.json`, shows the release id everywhere, and passes `check-build.mjs` |
| A10 | Open a figure whose page proof is dashed, one with no box, and one with no image | each says honestly what could not be placed; no magnified crop is shown for any of them |
| A9 | Every page in section 14.1 | within budget; number and chart readable with JavaScript off |

### 18.3 Checks that stay or are added to the build

- `check-build.mjs` keeps proving every visible digit (a checked value linked to its receipt, a recomputed count, or a
  typed non-value) and extends to: derived values (changes, transforms) carry their formula and inputs; no derived
  value uses a non-checked input; a held-back input makes the derived value held back; the kind of figure is present on
  every value link, tooltip and file row; exported images carry the source lines. Short-scale headlines ("Rs 37.4
  billion"), trail values, revision averages and every value in an answer sentence are each traced to the stored
  value(s) they were formatted or computed from.
- Contract tests for each adapter (5.1).
- A no-JavaScript check and the performance budgets (14).
- Screenshots at 360, 820 and 1280 px, looked at by a person, for every page type.

## Glossary

| Term | Meaning here |
|---|---|
| Adapter | The one piece of site code that reads a release and turns it into the contract of 5.1. Pages read only from it |
| Contract tests, fixtures | Small hand-made example releases (one checked figure, one held back, one disputed...) that every adapter must turn into the right result |
| Release | A frozen, numbered snapshot of the data (ours: `v0.0.1-prototype`; Ahmad's: `golden-YYYY.MM.DD`, a git tag) |
| Golden, candidate, held | Ahmad's statuses: a dataset approved by a person in the sign-off log; one not yet approved; a batch or round kept out because a check failed |
| Asterisk caveats | Ahmad's per-row marks: `restated*` printed differently in two documents, `memo*` a line printed but not part of its total, `misprint*` a printing error kept as printed, `unpublished*` a survey figure PBS never printed, `assumption*`, `small_sample*` |
| Page proof | An image of the printed page with the figure boxed (solid when confirmed, dashed when not) |
| Headline layer, everything layer | The catalogue's default view (signed-off, most-used series) and its full view (everything, including candidates) |
| Kind of figure | Budget estimate, revised estimate, actual, accounts, provisional and so on (6.2) |
| Vintage grid | A table with one row per year and one column per document that printed it |
| Short scale | Writing Rs 37,438 million as "Rs 37.4 billion" |
| Fast 3G, 400 kbps | The two emulated slow connections used for the speed budgets (1.6 Mbps with 150 ms delay; 400 kbps with 400 ms) |
| Layout shift | Content jumping after the page first appears; measured as a score where 0.1 or less is acceptable |
| Concept DOI | A permanent identifier that always points to the latest version, as opposed to one per version |
| Crossmark | A publishing convention: a "check for updates" link carried inside a downloaded file |

---

Approval: record "Design brief 2026-11-15 approved" (or the changes asked for) and the answers to section 17 as lines
in `DECISIONS.md`, then start at 18.1 step 0 or 1.
