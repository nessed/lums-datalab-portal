# Site design

How the portal looks and why. Code: `site/src/design/tokens.css` (every colour, size and space),
`site/src/app/globals.css` (rules, by section), `site/src/components/ui/` (building blocks),
`site/src/lib/status.ts` (the status system).

> **Status of this brief: DRAFT, 2026-10-12 (open-work item S16). Not approved yet.**
> It replaces the first brief, which asked for "a statistical yearbook brought online"; the site
> built from it reads like a report. Ali and Ahmad approve this brief (one line in `DECISIONS.md`)
> before any site code changes. Until then the site follows the first brief, which is in git
> history (`git show 9f0e6ad:docs/DESIGN.md`). Questions to settle are at the end of this file.

## What it should feel like

A data tool, not a document. People arrive with a question ("what did the federal government
budget for health in 2025-26?", "how has food inflation moved since 2021?") and leave with a
number, a chart, a file and a citation. Every data page follows the same order:

1. **Find.** Search is on every page. The catalogue has filters.
2. **See.** The chart and the table are the page. A data page shows data on its first screen.
3. **Take.** Download and cite are one click away and visible without scrolling.
4. **Check.** Any value opens its receipt: the printed page with the figure boxed, and the
   arithmetic it passed. This is what no other Pakistani portal has. It is a layer under the
   data that the reader can open, not prose the reader has to get through first.

Trust is still earned by evidence, and the evidence stays one click away. Text supports the data:
a one-line definition, compact metadata, a caveat where it applies. Long explanations live on the
Methods page. Researchers come first (downloads, ids, estimate types, sources); the same pages
must give a journalist or a citizen a clear number, a chart and one plain sentence.

## What we take from other portals

Patterns only. We copy no visual identity, logos or wording.

| Portal | What we take | What we leave |
|---|---|---|
| **FRED** (St. Louis Fed) | The series page: a large chart first, a short metadata line (units, frequency, source, last updated), download above the chart, "add a line" to compare. ALFRED's vintages map onto our budget / revised / actual. | Long lists of loosely related series. |
| **Our World in Data** | One chart component with **Chart / Table / Sources / Download** tabs; every view has a shareable link; a citation block under each chart. | Article-length pages around the chart. |
| **World Bank DataBank** | Building a table yourself: pick series, periods and layout, then see a table or chart and export it. This becomes our Compare page. | The multi-step form. Ours is one page. |
| **ONS** (UK) | Headline figures on the home page: value, period and a sparkline, each linking to its series. A time-series explorer with filters. | Release-calendar machinery we do not need yet. |
| **Eurostat / IMF Data** | A data browser with filters on the left, result counts, sparklines in the results and dataset codes for researchers. | Code-heavy labels as the only name. |

## Pages

### Header (every page)

Wordmark, a **visible search box** (not only an icon; `/` and Ctrl/Cmd-K focus it), and the main
links: **Data** (catalogue), **Compare**, **Sources**, **Methods**, **About**. The release
version appears on the right. The header is sticky on data pages.

### Home

The first screen shows data, not paragraphs:

- one line saying what the site is, then the search box with three example searches;
- **one tile per data type** (budget, prices, labour): series count, checked values and years
  covered, all read from the release, each linking to its catalogue filter;
- a **headline strip** of 4 to 6 series. Each shows the latest checked value, its period and
  estimate type, a sparkline and a link to the series. **Humans choose the series** in a config
  file; the values come from the release;
- the latest release with its date, and a compact key to the status marks.

The demo analysis and the "how it works" text go below the first screen.

### Catalogue (`/browse`, labelled "Data")

- **Filters** in a left column (a drawer on phones): data type, topic (function, CPI group,
  labour measure), geography (Pakistan, province), sex, urban/rural, frequency, estimate type,
  years. Each filter shows its result count. Filters live in the URL.
- **Results** in rows: series name, data type, unit, years covered, checked and gap counts, a
  sparkline, and a quick download link. Results can be sorted by name, coverage or latest period.
- "By document" stays as a second view, behind a tab.

### Series (`/series/[id]`)

On the first screen at 1280×800, and with the chart on the first screen at 390×844:

- the title, a one-line definition, and a **metadata strip** as key/value pairs: unit and scale,
  frequency, geography, estimate types, source documents, checked and gap counts, release;
- the **chart component** with tabs **Chart | Table | Sources | Download | Cite**;
  **Download CSV** is the one filled button;
- controls (estimate type, period range, linear/log, share of total where the release supports
  it), held in the URL;
- **Add to compare**.

Below the first screen:

- breaks and caveats as callouts;
- related series from the hierarchy (parent, children, siblings), each with a sparkline;
- "About this series", collapsed: the full definition, notes and method links.

Hovering any point gives the exact printed value, its status and a link to its receipt.

### Compare (`/compare`): the chart builder

- Pick up to six series by search or from "Add to compare". They are charted together, with a
  table aligned by period and a combined CSV that has the provenance columns.
- **Different units are never drawn on one axis.** They become small multiples with a shared
  period axis. Series across a break or a CPI base change are never joined.
- The whole view (series, range, layout) is in the URL, so a link reproduces it.

### Receipt (`/o/[id]`)

Same substance. The receipt is the evidence layer. The layout is tightened so that the first screen
holds:

- the value, its status, its estimate type and the magnified crop;
- the checks as a compact list, each opening to its arithmetic;
- Cite and previous/next.

"Back to the series" returns to the chart with this point highlighted.

### Data type pages (new: `/datasets/[id]`)

One page per data type:

- what it covers, its documents and its series tree;
- its publication status, with coverage, check pass rate and cross-edition agreement as
  **separate numbers** against their frozen thresholds;
- its gaps and disputes.

### Sources, Methods, About, Releases, Data access

These stay text pages and are the only place for long prose. Methods gets a diagram of the
steps a figure goes through: register, extract, validate, check, status, release.

## Layout and density

- **The first-screen rule:** every data page (home, catalogue, series, compare, receipt, data
  type) shows a number, chart or table on its first screen at 1280×800 and at 390×844.
  `scripts/screenshot.mjs` captures both; a page that fails is not done.
- **Width:** data pages use up to 90rem (charts and tables want width); prose keeps a
  68-character measure.
- **The text budget on data pages:** at most one sentence of lede. Definitions and notes collapse
  after three lines. Metadata is key/value pairs or chips, never sentences.
- **The side rail** on series pages holds related series and quick facts, not a table of contents.
- **Tables:** hairlines, sticky header, sticky first column, a focusable scroll region with a
  name, no zebra stripes, no card shadows. Add a compact row height for long tables.
- **Buttons:** outlined, with **one** filled primary action per view (Download CSV on a series,
  Copy citation on a receipt). Icons only for download, copy, external link, search and filter,
  always with a text label.
- **Phones:** chart first. Tabs scroll sideways, filters sit in a drawer, and Download and Cite
  sit in a bar at the bottom of the screen.
- **The prototype notice** stays one line, with the same words everywhere, dismissible per release
  and repeated in the footer. **Caveats** sit where they apply, as callouts with a left rule.
- **Print:** chrome, rails and buttons hidden; disclosures open; pages and crops keep a thin
  border.

## Type

- **Source Sans 3** for the interface and for headings on data pages. **Source Serif 4** for the
  large figure on a receipt and for headings on prose pages (Methods, About). Serif headings
  everywhere were part of the report feel. Both fonts are self-hosted from `site/src/fonts/`
  with `next/font/local` (OFL licences beside them).
- System monospace for ids, hashes and printed text (`7,283` exactly as printed).
- **Tabular figures wherever a number appears.** Numeric columns are right-aligned. Values
  are shown exactly as the release stores them, with thousands separators added by string
  manipulation (`lib/format.ts`), never re-rounded.
- The type scale stays (`--step--2` … `--step-5`), from a 17px body (15px in dense tables).

## Colour

- **Background:** a neutral near-white ground for the site. The warm "paper" tone is kept only
  for the frames around page images, where it reads as a document.
- **Text and accent:** near-black ink, hairline rules, and **one accent** (dark petrol blue) for
  links, focus, the selected state and the box around a figure. Light theme only.
- **New: a categorical palette of six colours for Compare and multi-line charts.** It must be safe
  for colour-blind readers and contain no purple. The colours are defined as tokens. Each line
  also gets its own dash and marker and an end label, so colour is never the only cue.
- The status colours below are unchanged.

## The status system (`lib/status.ts`, `components/ui/Status.tsx`)

Unchanged. One function, `statusOf(observation)`, decides how a figure is shown; every badge,
table cell, chart mark, sparkline, headline tile and legend reads from it. Each status has a
colour **and** a shape, so it survives greyscale printing and colour-blindness:

| Status | Mark | Cell fill | Meaning |
|---|---|---|---|
| Checked | solid disc, green | none (a plain number is checked) | read from the page and confirmed by at least one check |
| Disputed | hollow ring, amber | amber wash | two official printings disagree; both shown, neither chosen |
| Not published by the government | hatched square, grey | hatched | the document prints a dash or a blank |
| Not yet verified by us | dotted square, grey | dotted | may be printed; not yet through our checks |
| Withheld | crossed square, grey-brown | grey wash | read, failed its checks, not shown |
| Unknown (newer release) | short dash, neutral | none | raw label shown; never a crash, never "checked" |

The evidence behind "checked" is put in words built from the checks that actually passed, never
from the internal tier letter. The exceptions to "no number unless checked" stay as they are and
are enforced by `scripts/check-build.mjs`: a disputed receipt lists every printing, and a "not
published" gap may show the printed dash that proves it.

## Data rules the design never bends

These come from `AGENTS.md` sections 3 and 4. A new layout changes none of them.

- **Every number, date and title is read from the release.** Nothing is typed into a page.
- **A figure that is not checked never shows a number:** not in charts, sparklines, headline
  tiles, compare views, CSVs, tooltips or crops.
- **Derived values** (share of total, change over a period) are computed by a program from
  checked values only, labelled as derived, and never presented as printed. Their formula and
  inputs are shown, as `docs/METHODS.md` requires.
- **No real-terms or share-of-GDP views until the release carries** a deflator or GDP series that
  has been through the same checks.
- **Breaks and base changes are never joined**, in any chart or sparkline.
- **Coverage and accuracy are never shown as one number.**
- The choice of headline series and example searches is a human editorial choice, kept in a
  config file. It is not generated.

## Document renders (`components/ui/PageFrame.tsx`)

Unchanged.

- The page image file is never edited. Boxes and crops are CSS over the original render, from
  `cell_bbox_norm` (fractions of the page, top-left origin).
- **The box**: 2px accent outline, a faint accent tint, a white halo. A faint band runs along
  the row and the column, crossing at the figure.
- **The magnified crop**:
  - it lets a reader confirm "right row, right column" without opening the page;
  - it shows whole rows only, the column headings as a strip above, and the printed row label;
  - for tables too wide to fit, it shows two windows at the same scale joined by a dashed cut,
    and the caption says how many columns are not shown.

  Geometry comes from the table's own cells (`cropGuides()` in `lib/data.ts`).
- **The page**: framed to the table, on the warm paper ground. Select it to see the whole page
  enlarged. The caption names the document and says "page N of M of the PDF file".

## Charts (`components/Chart.tsx`, model in `lib/chart.ts`)

What stays:

- Hand-rolled SVG; no chart library. A small client component that sizes itself to its
  container and shows hover values.
- One line per estimate type. Budget estimate: solid with circles. Revised estimate: dashed with
  squares. Others: dotted with diamonds. Lines are labelled at their end.
- Lines join neighbouring periods only, and stop at gaps and at breaks. Nothing is interpolated.
  Periods without a value are marked under the axis with their status shape and link to their
  receipt.
- A break is a labelled dashed vertical rule.
- Axis ticks are humanised ("Rs 150 bn"); the tooltip gives the exact printed value. Every point
  links to its receipt, is reachable by keyboard and has a name.
- View state lives in the URL (`lib/url-state.ts`). The table is the chart's text alternative.

What is new:

- **The chart component has tabs** (Chart, Table, Sources, Download, Cite). The same component
  is used on series, compare and data type pages.
- **Multi-series charts:**
  - the categorical palette, plus a dash and marker per line and end labels;
  - at most six lines;
  - one unit per axis; otherwise small multiples.
- **Sparklines:**
  - no axes, with the last checked value and its period printed beside the line;
  - gaps and breaks shown as breaks in the line;
  - checked values only;
  - the whole sparkline links to the series.
- **Share and embed:** "copy link to this view". An embeddable version is a later step.

## What changes from the current site

| Area | Now | After this brief |
|---|---|---|
| Home | Headline sentence, lede, "Start here" text blocks, dataset list | Search, data type tiles with counts, headline series with sparklines |
| Catalogue | Long grouped list with a text filter | Filters with counts, rows with sparklines and quick download |
| Series | Title, lede and latest value, then chart, then sections down the page | Metadata strip and tabbed chart on the first screen; text collapsed |
| Compare | Up to three series; one chart if units match, else one chart each; choice in the URL | Chart builder: up to six series, small multiples on a shared period axis, combined CSV, reached from every series page |
| Receipt | Evidence page | Same evidence; first screen tightened; link back to the highlighted point |
| Data types | Sections inside Browse | Own pages with status, thresholds and the series tree |
| Look | Serif headings, warm paper, narrow measure | Sans headings on data pages, neutral ground, wider data pages |

## Things we do not do

- Gradient heroes, blobs, illustrations, taglines; three-up feature cards with icons; emoji;
  marketing words.
- Default dashboard looks:
  - indigo buttons;
  - `rounded-2xl shadow-lg` cards;
  - a grey page with white cards;
  - KPI cards with no source or period.
- Purple, glassmorphism, big radii.
- Legend-only charts, pies, 3D.
- Data pages that open with paragraphs; a number reachable only by scrolling past text.
- A chart without its table and download.
- Caveats only in the footer.
- Any number, date or title not read from the release.
- Shipping a page nobody has looked at.

## Adding a page

1. Read data only through `lib/data.ts`. If a field is missing from the release, show "not in
   this release" and ask for it under `STATUS.md → ## Site → Requests for the pipeline`.
2. On a data page, start with the data: title, metadata strip, then the chart component or
   the results. Prose pages use `.page-head` and `.prose`.
3. Show any figure's status with `<StatusBadge info={statusOf(o)} />`; use `cellFillClass()` in
   tables. Never write a new colour; add a token if one is truly missing.
4. Give citable things a `<Cite>`, data a `<DownloadLink>`, and the view a copy-link button.
5. Screenshot it at 390, 820 and 1280 px (`node scripts/screenshot.mjs`) and check the
   first-screen rule on each. Run `node scripts/a11y.mjs`, then build, lint and
   `node scripts/check-build.mjs`.

## Questions for Ali and Ahmad before approval

1. Which portal should it feel closest to? (The draft leans on FRED for series pages and Our
   World in Data for the chart component.)
2. Which 4 to 6 series go in the home headline strip?
3. Neutral ground instead of warm paper, and sans headings on data pages: yes or no?
4. Separate data type pages (`/datasets/[id]`): yes, or keep them inside the catalogue?
5. Compare limit of six series: right?
6. A documented JSON "API" page (the release files are already static JSON): now, or later?

**Approval:** record "Design brief 2026-10-12 approved" (or the changes asked for) as one line in
`DECISIONS.md`, then start S16 step 3 in `docs/OPEN_WORK.md`.
