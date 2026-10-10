# LUMS DataLab Portal: site

A fully static Next.js site (App Router) that reads one frozen data release from disk at build time. There is no database, no API, no
client-side data fetching, no analytics and no chart library.

## How data is loaded

- The release version is set in one place: `release.config.json` (`version`). The same file holds `repoUrl` and `siteUrl`.
- `src/lib/data.ts` reads `../releases/<version>/*.json` with `fs` (relative to `site/`, which is `process.cwd()` during `next build`),
  builds lookup maps, and is the only module that touches the release folder. `docs/METHODS.md` is read from `../docs/` if it exists.
- `scripts/prebuild.mjs` runs automatically before `npm run build` and `npm run dev`. It copies into `public/data/<version>/` (git-ignored):
  the page renders (`pages/`), the run manifests (`runs/`), the release's JSON/CSV/Markdown files, and it writes
  `receipts/<slug>.json` (observation + cells + checks + sources) and `series/<slug>.csv` (one CSV per series, with provenance columns).
- Nothing is hard-coded: series, periods, counts, datasets and statuses all come from the release files. A dataset is shown as "coming"
  unless `release.json.dataset_status[dataset].state` is `"published"`; its series, receipts and values are then not rendered at all.
- Values are decimal strings. They are displayed as strings with thousands separators inserted by string manipulation
  (`src/lib/format.ts`). `Number()` is used only for chart geometry (`src/lib/chart.ts`).

## URL scheme

Observation ids contain colons (`series:period:vintage`), which are not safe in file names on Windows. `slugify()` in `src/lib/data.ts`
(duplicated in `scripts/prebuild.mjs` and `scripts/check-build.mjs`) replaces `:` with `~`, so
`fed.exp.total:2010-11:be` is served at `/o/fed.exp.total~2010-11~be`. Series and source ids are used as they are.

## Charts

`src/components/Chart.tsx` is a hand-rolled static SVG. Each estimate type (vintage) is its own line with its own colour, dash pattern and
marker shape. Points are joined only when they are exactly one step apart, where the step is the smallest distance between any two periods
of the series; lines never cross a missing period or a break. A break from `series.breaks` is drawn as a dashed rule between the period
before `at_period` and `at_period`. Every point links to its receipt.

## Demo page

`src/app/demo/health-and-jobs/page.tsx` has a small `DEMO` config object at the top that decides which series fill each chart slot
(by substrings of the series id). Adjust it there if the final release names series differently. A slot with no published series shows
a "coming" card.

## Change the release version

1. Put the new release folder at `../releases/<new-version>/`.
2. Set `"version"` in `release.config.json`.
3. Optionally set `"siteUrl"` (for example `https://example.org`) so citations use the deployed address; while it is empty, citations
   point to the repository and give the page path.
4. `npm run build`.

## Run

```
npm install
npm run dev          # http://localhost:3000 (copies the release first)
npm run lint
npm run build        # prebuild copy, then static generation of every page
node scripts/check-build.mjs   # after a build: checks every receipt's HTML (values boxed, gaps show no value)
npm run start        # serve the build
```

## Vercel settings

- Root directory: `site`
- Framework preset: Next.js
- Build command: `npm run build`
- Node.js version: 24
- Environment variables: none
- The build reads `../releases/<version>/`, so the repository must be cloned in full (the default); keep
  "Include files outside the root directory in the build step" enabled.

## Layout

- `src/app/` routes: `/`, `/browse`, `/series/[id]`, `/o/[id]` (the receipt), `/sources`, `/sources/[id]`, `/methods`, `/releases`,
  `/about`, `/demo/health-and-jobs`.
- `src/components/`: `Chart`, `SeriesView` (chart + table + CSV link), `PageCell` (page render with the cell boxed, and the CSS close-up),
  `Cite` (APA / BibTeX / RIS, two-part), `Badges`, `Markdown` (tiny renderer for the release's own `.md` files), `ViewSwitch`
  (the only client component: the amount / share-of-total toggle, state in `?view=share`).
- `src/lib/`: `data.ts`, `format.ts` (all plain-language wording for statuses, gaps, tiers and verification), `chart.ts`, `cite.ts`.
