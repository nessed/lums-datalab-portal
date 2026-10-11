# Mockup review (S16)

The mockups are a Design canvas: https://claude.ai/artifact/56YaTkbCupGdvYwP3gqah2 (private to Ali until shared from
its Share menu). The sources of every board are in `docs/mockups/project/`: one `.dc.html` file per board, laid out by
`project/canvas.json`. Page "v1 first draft" holds the first pass and page "v2 revised" the version the site is built
from. Each page has six screens (home, catalogue, series, compare, receipt, data type) at 1280 and 390 px; v2 adds a
seventh, "table as printed", asked for by Ali during the run (see the end of this file).

**No value on any board is real or sample data.** A `[slot]` stands for a value or count the build reads from the
release. Series names, definitions, break notes and the release version are copied word for word from
`releases/v0.0.1-prototype`. Charts are drawn as empty frames on purpose, because a drawn line would be an invented
shape. The dashed orange rule marks the first screen (1280x800 and 390x844).

## How the review was done

I went through v1 as a skeptical user from each of the four groups the site is for, with one task each, timing
nothing but counting clicks and asking at each step "would I trust this, and could I prove it to someone else?"

- **Researcher:** get federal health spending as a CSV with page references, cite it, and check one figure in the PDF.
- **Student:** find CPI inflation and work out what the number means.
- **Journalist:** get a single quotable number fast, with the kind of figure it is (budget, revised, actual).
- **Policy person:** compare health and education spending, and check that the comparison is fair.

Then each board against DESIGN.md: the first-screen rule, find → see → take → check, every number links to its source,
and the "things we do not do" list. Then the planned-feature slots against the brief: present, quiet, never crowding
the first screen.

## Findings and what changed

Severity: **H** breaks trust or the find → see → take → check path; **M** slows a task or invites a misreading;
**L** polish.

### Home

| # | Sev | Finding on v1 | Change in v2 |
|---|---|---|---|
| 1 | H | Headline values show the unit but the estimate type sits in small grey text beneath. "Total federal expenditure" will show a 2026-27 **budget estimate**, which a journalist can easily quote as money spent. | The kind of figure goes right after the value, in words, in body ink: "budget estimate 2026-27". The status mark sits beside the value. |
| 2 | M | The CPI headline is the index level (base 2015-16). A student cannot use an index level without a base, and a journalist wants inflation. | The headline is `cpi.national.yoy.general` ("change over the same month last year"). The choice stays in the editorial config file, not in code. |
| 3 | M | Nothing on the first screen says who publishes each data type, and an institutional reader asks that first. | Each data type tile names the publisher, read from `sources.json` (`publisher`). |
| 4 | M | "Take" is missing from the home page: no route to the full files. | The release line gains "Download the release" (to `/data`). |
| 5 | M | "More data types: Coming" sits on the first screen under the tiles. The brief says planned slots must not crowd the first screen or make the site look unfinished. | Moved below the fold into the footer of the data types section, and listed on the Releases page under "Planned". |
| 6a | M | On the phone, v1 put the three data type tiles before the headline figures, so the first value sat halfway down the first screen. | On the phone the latest figures come first (four of them, then "All latest figures"), then the data types. |
| 6 | L | Coverage and pass rate share one table row and could be read as one score. | Kept apart: the home quality block shows each as its own column with a one-line definition, and the error rate stays "Pending". |

### Catalogue

| # | Sev | Finding on v1 | Change in v2 |
|---|---|---|---|
| 7 | H | LFS has 13th and 19th ICLS series with near-identical names, and the list gives no sign of which is which. A researcher can download the wrong definition (AGENTS.md section 7). | A **Definition** facet (from `dims.definition`) and a "19th ICLS" tag on each such row. The same goes for CPI: a **Base year** tag ("base 2007-08") and the "no area stated" note. |
| 8 | M | No topic facet. DESIGN.md asks for one (function, CPI group, labour measure). | A **Topic** facet built from `dims.function`, `dims.group` and `dims.measure`, collapsed after six entries. |
| 9 | M | Fourteen facet groups are all open. The result list starts at the same height, but the facets run far below the fold and hide "Only series with checked values". | Data type, Topic, Geography and Values open. The rest are collapsed with a count of active choices. |
| 10 | M | "Latest" shows a value with no period or estimate type. | Under each latest value: period and estimate type ("BE 2026-27"). The value links to its receipt. |
| 11 | M | When the list is filtered, an indented child ("Health (current, revenue account)") loses its parent and reads as if it were a total. | A filtered row shows its parent path in small text ("in Current expenditure on revenue account"). |
| 12 | L | "Filter by words" looks like a second site search. | Relabelled "Filter this list". |

### Series

| # | Sev | Finding on v1 | Change in v2 |
|---|---|---|---|
| 13 | H | The break note is below the fold on desktop, but it changes how the chart reads: figures either side of 2011-12 are not comparable. A caveat must sit where it applies. | A one-line break note directly above the chart at both widths, with "details" opening the full note. |
| 14 | H | "Real terms" and "% of GDP" are drawn as buttons in the Show control, and the quiet line under the chart says the same again. Buttons that do nothing make the site look unfinished and invite clicks that fail. | Removed from the control. One muted line under the chart, only on rupee series: "Real terms · % of GDP: Coming: not in this release". |
| 15 | M | The table appears twice: in the Table tab and again below the fold. | One component. Tabs switch panels; without JavaScript every panel is shown in order (chart, table, sources, download, cite). Nothing is duplicated. |
| 16 | M | A researcher citing or scripting needs the series id, and it is missing from the first screen. | The series id is in the metadata strip, in monospace with a copy button. |
| 17 | M | Related series show a bare value with no period. | Each related row shows name, latest value (a link to its receipt) and period. |
| 18 | M | On the phone the line styles (budget solid, revised dashed) are explained nowhere near the chart. | A one-line key directly under the chart at both widths. |
| 19 | L | On the phone the definition sits under the chart and runs long. | Clamped to three lines with "more". |

### Compare

| # | Sev | Finding on v1 | Change in v2 |
|---|---|---|---|
| 20 | H | Nothing tells the user when two series are not comparable (different units, 13th vs 19th ICLS, different CPI base, a break inside the range). | A notice above the chart lists each reason, read from the series records. Different units switch the layout to small multiples automatically. |
| 21 | M | "Download combined CSV" does not say what is in it. | "Combined CSV, with source and page columns", with one line under it naming the columns. |
| 22 | M | The estimate type control appears even when no chosen series has estimate types (CPI, LFS). | It appears only when at least one budget series is chosen. |
| 23 | L | The six-series cap is invisible until hit. | "2 of 6" beside the picker. |

### Receipt

| # | Sev | Finding on v1 | Change in v2 |
|---|---|---|---|
| 24 | H | The official PDF link, the second step of "every number links to its source", is below the fold at both widths. | "Official PDF, page N" and "Archive copy" join the first-screen actions as secondary buttons, beside "Copy citation". |
| 25 | H | Only the checked case is drawn. Nobody can judge the design of a withheld or disputed receipt, which is where trust is won or lost. | Two insets on the receipt board: a withheld gap (no value, the reason, no page box) and a disputed figure (every printing with its page, none chosen). |
| 26 | M | Checks start at the bottom edge of the first screen on desktop. DESIGN.md wants the compact check list on it. | The check list moves into the right column under the crop, one line per check. "Show the arithmetic" stays one click away. |
| 27 | M | No way back to the chart with this point marked. | "See it on the chart" links to the series with this period highlighted. |
| 28 | L | The document fingerprint is not mentioned. | A "Provenance" disclosure below the fold (fingerprint, run, cell id), collapsed. |

### Data type

| # | Sev | Finding on v1 | Change in v2 |
|---|---|---|---|
| 29 | H | The ABS function lines are current expenditure on revenue account only (AGENTS.md section 7), and breaks such as devolution apply to the whole data type. The page does not warn about either. | A "Read before using" box built from the release: every distinct break in the data type with its note, and the series notes. No warning text is typed into the page. |
| 30 | M | No way to download a whole data type. | "Download this data type (CSV)": the release's observation rows for that data type, written by the prebuild script. Rows are copied, never recomputed. |
| 31 | M | The three quality numbers do not say whether they meet the frozen threshold. | Each shows the threshold and "meets the frozen threshold" or "below it", read from the release and the frozen thresholds file. |
| 32 | L | Planned features for the data type are invisible. | One muted line at the bottom, for example "Every month of CPI: Coming: not in this release". |

### Across all pages

| # | Sev | Finding on v1 | Change in v2 / build |
|---|---|---|---|
| 33 | H | Counts (series, checked values, gaps) appear on every page. If one is typed, it will drift from the release. | Every count is computed from the release at build time, and `check-build` recomputes each one from the release files and fails on a mismatch. |
| 34 | M | The header search is drawn as a label, not a control. | Built as a real button that opens the search dialog (keyboard: `/` and Ctrl/Cmd-K), with a visible box. |
| 35 | M | Catalogue rows on the phone have small targets. | The series name link gets a 44 px tall hit area. |

## Planned features: where each sits (v2)

Each sits behind one entry in `site/features.config.json`. While off, it shows "Coming: not in this release" in muted
text, never as a button that does nothing.

| Feature | Where it sits | First screen? |
|---|---|---|
| Real terms | One muted line under the chart, rupee series only | Under the chart, one line |
| % of GDP | The same line | Under the chart, one line |
| API page | `/api` page; footer link; Data access page | No |
| Maps | "Map" note in the series Sources tab for provincial series; LFS data type page | No |
| Provinces and districts | Catalogue Geography facet: the provinces are real (LFS); "Districts: Coming" under them | No (inside a facet) |
| More data types | Home, below the data type tiles (below the fold); Releases "Planned" | No |
| Monthly data | CPI data type page and CPI series metadata: "This release holds June issues. Every month: Coming" | No |
| Errata | Releases page shows the release's own `ERRATA.md` (that is real content); per-figure errata badges on receipts are the planned part | No |

## Added during the run: tables as printed

Ali asked for a way to open a data type, pick a year (an edition), pick a table, and see the table as the government
printed it, drawn as a site table, with each cell clickable to show where it sits on the PDF page. It works for every
table-type source (ABS, CPI, LFS), because every printed cell in the release carries its document, page, table, row,
column, printed labels and its box on the page (`cells.json`).

Boards: "v2 Table as printed" at 1280 and 390. Entry points: the data type page ("Tables as printed, by edition"), each
source document page, and the table title on every receipt.

How it keeps AGENTS.md sections 3 and 4:

- A cell shows a number **only if that cell backs a published (checked) figure**. The number links to its receipt.
- A cell behind a gap shows its status words and pattern ("not yet verified", "withheld", "printed as a dash"),
  linked to the gap's receipt. No number is shown for it, even though the printed page beside it shows one: the page
  is the government's document; the table is our claim.
- A printed cell that no series uses shows "·" and no number.
- Row and column labels are the printed labels from `cells.json`, verbatim (text, not values).
- Selecting a number boxes it on the page render beside the table, with the same CSS-over-the-original method as the
  receipt. The page image is never edited.
- Where a table was read twice (a flagged table re-read by the second tool), the reading whose cells back the published
  figures is the one drawn, and the page says which tool read it.

## What was not changed, and why

- **Header search on the home page is kept** next to the large search box. A visitor arriving on any page learns one
  place to search; FRED and ONS do the same.
- **The receipt keeps the serif figure.** It is the one place the site reads as a document, and DESIGN.md asks for it.
- **No sparklines on the series page's rail on the phone.** Space goes to the chart.
