# Round 2, titles foundation

Branch `proto/r2-titles` (last commit `27c4534`), 2026-11-15, unattended. Saved by the lead from the agent's
hand-back (subagents could not write report files). Every title and summary is in `TITLES.md` beside this file
(grouped by data type and topic, with the printed name; 120 rows marked REVIEW).

- `site/editorial/titles.json`: all 925 series (`title`, `summary`, `status: "draft"`), provisional. 92 written by
  hand (headline and root series, budget summary lines, every receipts line, national CPI and LFS headline series);
  833 composed by `site/scripts/draft-titles.mjs` from dims and printed names, then reviewed. No data file touched.
- Adapter: `title`, `summary`, `titleStatus` on every series; `name` (the printed name) unchanged. Golden adapter
  keeps printed names (`titleStatus: "printed"`). Helpers in `lib/titles.ts`. 7 new contract tests.
- Check plug-in `scripts/checks/titles.mjs`: fails on a missing title or summary, a digit, a duplicate, a title over
  72 or summary over 130 characters, more than one sentence, an unknown series id, a missing provisional flag; and
  checks each series page's h1 is its title and the printed name is on the page.
- Titles used everywhere a series is named for a reader (series h1 and `<title>`, breadcrumbs, catalogue, search,
  compare, "Made up of" and "Where it sits", topics, home cards, answer pages, receipts, the evidence sheet, chart
  legends). "Printed as" moved into About. Citations and downloaded files keep the printed name.

Checks: lint pass; contract 47/0; search 20/0 (index 38.1 KB gzip); series-derive 11/11; build 8,381 pages;
`titles.mjs` and `evidence-sheet.mjs` on their own 0 problems.

Judgement calls: "Federal health spending (current)", not the bare form (AGENTS.md section 7); 430 long-tail titles
exceed 40 characters (hard limit 72); "(new definition)" for 19th ICLS series; "KP" in titles; CPI group renamings
("Health care", "Household goods"); some titles say less than the printed name, never more; no title column in files
(`take-files.mjs` could not verify it without being edited); search typo rule also compares the word as written; the
search index drops printed row labels that add no word; `evidence-sheet.mjs` takes the expected sheet title from the
editorial file; home card names set to the titles.

Left undone: no title column in downloaded files; the catalogue's measure filter still uses printed names
(`lib/facets.mjs`, imported by check-build).
