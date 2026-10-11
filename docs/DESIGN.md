# Site design

How the portal looks and why. Code: `site/src/design/tokens.css` (every colour, size and space),
`site/src/app/globals.css` (rules, by section), `site/src/components/ui/` (building blocks),
`site/src/lib/status.ts` (the status system). Plan this follows: `docs/plans/2026-10-12-ui.md`.

## What it should feel like

A statistical yearbook brought online. The reader is a researcher who will check our work, so
the page earns trust by showing its evidence plainly: the printed page, the box around the
figure, the arithmetic, the caveats in the flow of the text. Useful first, then clear, then
handsome. Nothing on the page is decoration.

## Type

- **Source Serif 4** for headings and for the large figures (the number on a receipt, stat rows).
  **Source Sans 3** for everything else. Both self-hosted from `site/src/fonts/` with
  `next/font/local` (OFL licences beside them): no network at build, no layout shift.
- System monospace for ids, hashes and printed text (`7,283` exactly as printed).
- **Tabular figures wherever a number appears** (`.tnum`, `.num`, all tables, chart text).
  Numeric columns are right-aligned. Values are shown exactly as the release stores them,
  with thousands separators added by string manipulation (`lib/format.ts`), never re-rounded.
- Scale from a 17px body, ratio about 1.2 (`--step--2` … `--step-5`). Long-form text keeps a
  68-character measure (`.measure`, `.prose`).

## Colour

Near-black ink on warm off-white paper (`--paper`), hairline rules (`--rule`). **One accent**,
a dark petrol blue (`--accent`), for links, focus and the box around a figure. No other
decorative colour. Light theme only, done completely (no dark mode yet: half a dark mode would
be worse than none).

## The status system (`lib/status.ts`, `components/ui/Status.tsx`)

One function, `statusOf(observation)`, decides how a figure is shown; every badge, table cell,
chart mark and legend reads from it. Each status has a colour **and** a shape, so it survives
greyscale printing and colour-blindness:

| Status | Mark | Cell fill | Meaning |
|---|---|---|---|
| Checked | solid disc, green | none (a plain number is checked) | read from the page and confirmed by at least one check |
| Disputed | hollow ring, amber | amber wash | two official printings disagree; both shown, neither chosen |
| Not published by the government | hatched square, grey | hatched | the document prints a dash or a blank |
| Not yet verified by us | dotted square, grey | dotted | may be printed; not yet through our checks |
| Withheld | crossed square, grey-brown | grey wash | read, failed its checks, not shown |
| Unknown (newer release) | short dash, neutral | none | raw label shown; never a crash, never "checked" |

The evidence behind "checked" is said in words built from the checks that actually passed
("verified by a sum and a second printing in another edition"), never from the internal tier
letter. A figure that is not checked never shows a number anywhere: not in tables, charts,
CSVs, tooltips or crops. The exceptions are deliberate and enforced by
`scripts/check-build.mjs`: a disputed receipt lists every printing (that is what disputed
means), and a "not published" gap may show the printed dash that proves it.

## Document renders (`components/ui/PageFrame.tsx`)

- The page image file is never edited. Boxes and crops are CSS over the original render, from
  `cell_bbox_norm` (fractions of the page, top-left origin).
- **The box**: 2px accent outline, a faint accent tint, a white halo. A faint band runs along
  the row and the column, crossing at the figure.
- **The magnified crop** (receipt head) must let a reader confirm "right row, right column"
  without opening the page: whole rows only (never half a row), the column headings as a strip
  above when they are further up the page, and the printed row label. When the table is too
  wide to keep label and figure magnified in one window, two windows at the same scale are
  shown, joined by a dashed cut, and the caption says how many columns are not shown.
  Geometry comes from the table's own cells (`cropGuides()` in `lib/data.ts`).
- **The page**: framed to the table on a recessed ground (most pages are half empty); select it
  to see the whole page enlarged. The caption names the document, "page N of M of the PDF
  file", and says what the reader is looking at.

## Charts (`components/Chart.tsx`, model in `lib/chart.ts`)

- Hand-rolled SVG; no chart library. A small client component so it can size itself to its
  container (12px text on a phone) and show hover values.
- One line per estimate type: budget estimate solid petrol with circles, revised estimate
  dashed rust with squares, others dotted with diamonds. Colour, dash and marker all differ.
  Lines are labelled at their end; a single line is not labelled (the title names it).
- Lines join neighbouring periods only. They stop at gaps and at breaks. Nothing is
  interpolated.
- Periods without a value are marked in a row under the axis with their status shape, and link
  to their receipt.
- A break is a dashed vertical rule labelled "Break: devolution", drawn only where the series
  has data on both sides; otherwise the break is stated above the chart.
- Axis ticks are humanised ("Rs 150 bn"); the tooltip gives the exact printed value, its period
  and estimate type. Every point is a link to its receipt (keyboard-focusable, with a name).
- Toggles (amount / share of total, linear / log, period range) live in the URL via
  `lib/url-state.ts`, so a link reproduces the view and the back button works.
- The table under the chart lists every figure and is the chart's text alternative.

## Layout

- Page width up to 76rem; a 17rem side rail on wide screens (contents, related figures), which
  drops below the content on narrow screens. Receipts put previous/next directly under the
  figure so phones get them without scrolling.
- Tables: hairlines, sticky header, sticky first column when they scroll sideways, focusable
  scroll region with a name. No zebra stripes, no card shadows.
- Buttons: outlined; **one** filled primary action per view (Copy citation on a receipt,
  Download CSV on a series). Icons only for download, copy, external link and search, always
  with a text label.
- The prototype notice is one line, the same words everywhere, dismissible per release, and
  repeated in the footer. Caveats sit in the text where they apply, as callouts with a left
  rule, never only in the footer.
- Print: chrome, rails and buttons are hidden; disclosures open; pages and crops keep a thin
  border.

## Things we do not do

Gradient heroes, blobs, illustrations, taglines; three-up feature cards with icons; emoji;
marketing words ("seamless", "powerful", "empower"); default Tailwind looks (indigo buttons,
`rounded-2xl shadow-lg` cards, grey page with white cards); purple, glassmorphism, big radii;
legend-only charts, pies, 3D; caveats only in the footer; any number, date or title not read
from the release; shipping a page nobody has looked at.

## Adding a page

1. Read data only through `lib/data.ts`. If a field is missing from the release, show "not in
   this release" and ask for it under `STATUS.md → ## Site → Requests for the pipeline`.
2. Start with `<Breadcrumbs>`, a `.page-head` (kicker, `h1`, one line of meta, `.lede`), then
   content. Use `.with-rail` + `<aside className="rail">` if there is related material.
3. Show any figure's status with `<StatusBadge info={statusOf(o)} />`; use `cellFillClass()` in
   tables. Never write a new colour; add a token if one is truly missing.
4. Give citable things a `<Cite>`, data a `<DownloadLink>`, and the page a copy-link button.
5. Screenshot it at 390, 820 and 1280 px (`node scripts/screenshot.mjs`), look at every image,
   run `node scripts/a11y.mjs`, then build, lint and `node scripts/check-build.mjs`.
