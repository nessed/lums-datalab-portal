# Open work

Everything left unfinished by the overnight runs of 2026-10-11/12, after `proto/v0` was merged into `main`.
This is the list a human or an agent picks the next job from. `STATUS.md` says where things are; this file
says what is not done yet and exactly how to finish it.

## Rules for this file

- One entry per item. Ids: `P` pipeline, `S` site, `H` needs a human. Ids are never reused.
- Each section is written and kept current by its owner: the pipeline agent owns `P` and its merge check, the
  site agent owns `S` and its merge check. Anyone may add to `H`. Do not edit another owner's section.
- An entry must be specific enough that an agent with no memory of the run can finish it: name the branch,
  commits, files and `work/` paths; say what already exists and what does not.
- When an item is finished, move it to "Done" at the bottom with the PR or commit. Do not delete it.
- Link to the reports for the story; do not copy it here.

## Entry template

```markdown
### P0 Short title
- **State:** not started | partial | blocked. What exists right now (commits, branch, files, runs in `work/`).
- **Where:** branch, paths, report section.
- **Left to do:** numbered concrete steps.
- **Done when:** a check anyone can run (command and expected result).
- **Effort:** agent hours; whether it needs Docling or long CPU time; whether it can run beside other work.
- **Needs from a human:** a decision or file, or "nothing".
- **Traps:** what went wrong or nearly did last time (link `AGENTS.md` section 7 entries).
```

## Pipeline (P)

Owner: the pipeline agent. Seed list from the morning summary; replace each line with a full entry.

- P1 E1: eight more ABS editions (branch `proto/v0-e1-abs-editions`, not merged).
- P2 E4: monthly CPI (branch `proto/v0-e4-cpi-monthly`, not merged).
- P3 C8: full-document LFS runs (2024-25 done; 2020-21 interrupted; 2018-19 not started).
- P4 E5: reproduction from a clean clone (tools landed; the run itself not done).
- P5 E9: Economic Survey tables (not started).
- P6 Final handoff of the continuation run: README and `AGENTS.md` section 11 numbers, morning checklist v2.
- P7 Redraw the gold sample and spot-check sheet for the current release.
- P8 Anything else left open in `docs/reports/2026-10-12-continuation-report.md` (pending review findings, regression
  fixtures from E10, …).

## Site (S)

Owner: the site agent. All site work so far is in `main` (PR #1, `bebff67`); the overnight branch was `proto/v0-ui`
(last site commit `23e670a`). Start any S item from a new branch off `main`. Story: `docs/reports/2026-10-12-ui-report.md`.
Design rules: `docs/DESIGN.md`. Plan the site was built to: `docs/plans/2026-10-12-ui.md` (sections 4 to 7).

**Recommended order:** S1, S2, S3, S4, S5, S6, S7, S8, then S9 to S15 as listed. S1 and S2 are correctness: a
receipt must never misstate a sum, and new release content must not mislead. S3 to S5 are the evidence the plan's
"done means" asks for and should come before any polish. S10 needs H3 first; S13 needs a second release.

### S1 Receipts: show subtracted members and honour `credits_members`
- **State:** not started. Found on 2026-10-12 while checking the merge. The release has 33 `accounting_identity`
  checks with a member sign of −1 (`Check.member_signs`, for example "gross federal resources less the provincial
  share") and 72 checks with `credits_members: false`. The site reads neither field.
- **Where:** `site/src/app/o/[id]/page.tsx` (`CheckItem`, `MemberRow`, `evidenceWords`); `site/src/lib/data.ts`
  (`Check` type lacks both fields). Schema: end of `docs/SCHEMA.md`.
- **Left to do:**
  1. Add `member_signs?: number[] | null` and `credits_members?: boolean | null` to the `Check` type.
  2. In the arithmetic table, print a "less" marker and a minus before each member whose sign is −1, and say
     "added" / "subtracted" in the row for screen readers.
  3. In `evidenceWords`, skip checks whose `credits_members` is false (they do not support the member's status);
     keep showing them in the list, labelled "does not count towards this figure's status".
  4. Extend `scripts/check-build.mjs`: for every published receipt whose checks include a −1 member, the HTML
     holds the minus marker for that member.
  5. Screenshot one receipt of each case (find ids with a short Python query over `checks.json`).
- **Done when:** `npm run build && node scripts/check-build.mjs` passes with the new rule, and the receipt for a
  net-federal-resources figure (2009-10 BE) shows the provincial share as subtracted.
- **Effort:** 1 to 2 agent hours; a full build is about 6 minutes; can run beside pipeline work.
- **Needs from a human:** nothing.
- **Traps:** the check `description` already says "less"; only the table is wrong. Do not recompute sums in the
  browser; display `residual` and the printed values only.

### S2 Look at the new release content on the site
- **State:** not started. Since the site pages were built, the release gained ABS receipts series (`fed.rev.*`,
  48), LFS provincial series (`lfs.<measure>.<pb|sd|kp|ba>.*`), 19th ICLS series (`*.icls19`), cross-source checks
  against SBP and Economic Survey files (5 with no member cell, `target_value` + `target_source` instead), and
  `pdfplumber` cells. The build passes on them; nobody has looked at the pages.
- **Where:** `site/src/app/browse/page.tsx` (LFS now has 12 root series mixing 13th and 19th ICLS with no label
  saying which), `site/src/components/Compare.tsx`, `site/src/app/demo/health-and-jobs/page.tsx` (DEMO ids),
  `site/src/app/o/[id]/page.tsx` (cross-source check rendering), `site/src/app/sources/page.tsx` and
  `site/src/app/sources/[id]/page.tsx` (cross-source files: `doc_type` `sbp_easydata`, `pes_chapter`).
- **Left to do:**
  1. Browse: group LFS by definition (13th ICLS, then 19th ICLS, labelled from `dims.definition`), then by measure;
     group ABS receipts (`dims.side: receipts`) apart from expenditure.
  2. Compare: when two chosen series differ in `dims.definition`, say so above the chart in one sentence.
  3. Receipt: a cross-source check with no member cell shows the other source's name, value and how it was
     retrieved, from `target_source` / `target_value` (the sentence is in `description`).
  4. Check the sources page and a source detail page for one SBP file and one Economic Survey chapter (the SBP
     file is a CSV with no pages; the detail page assumes a PDF).
  5. Screenshot browse (LFS and ABS open), one provincial series, one `.icls19` series, one `fed.rev.*` series,
     one receipt with an SBP check, and the two new source types, at 390 and 1280 px.
- **Done when:** the screenshots exist under `docs/reports/qa/ui/after/` and show every 19th ICLS series labelled
  as such wherever it is listed; `node scripts/a11y.mjs` clean on those routes.
- **Effort:** 3 to 4 agent hours.
- **Needs from a human:** nothing.
- **Traps:** AGENTS.md section 7 (LFS provincial layouts, `.icls19` never joined to 13th ICLS, a cross-source check
  never supplies a value).

### S3 Production screenshots of every route, after the fixes
- **State:** partial. `docs/reports/qa/ui/before/` holds the 51 baseline images (17 routes x 3 widths, release as of
  2026-10-11 03:50). `docs/reports/qa/ui/after/` holds only 9 receipt images (tier A, CPI, gap) from commit
  `bbc8e66`, which predate the critique fixes. No "after" images exist for home, browse, the three series, the
  disputed receipt, sources, source detail, methods, releases, demo, compare, data, about or 404.
- **Where:** `site/scripts/screenshot.mjs`, `site/scripts/qa-routes.mjs` (route list built from the release).
- **Left to do:**
  1. `npm run build`, then `npx next start -p 3100` (not `next dev`: on this machine Turbopack's dev cache serves
     stale CSS and modules after edits; see the UI report).
  2. `node scripts/screenshot.mjs --base http://localhost:3100 --out ../docs/reports/qa/ui/after` (all routes,
     390/820/1280).
  3. Look at every image; fix what is wrong; repeat.
  4. Add a before/after table to the UI report (route, before file, after file, what changed).
- **Done when:** `docs/reports/qa/ui/after/index.json` lists 18 routes x 3 widths with status 200 (404 page: 404),
  and the report has the table.
- **Effort:** 1 agent hour plus fixes; the images are about 15 MB, so replace the set rather than adding a second.
- **Needs from a human:** nothing.
- **Traps:** stop the server afterwards (`site/` plan section 2: no processes left running).

### S4 Accessibility pass on every route, and the keyboard walkthrough
- **State:** partial. The last full axe run (production build, 2026-10-11 about 04:55) was clean for receipts
  (4 kinds), series (3), browse, home and demo at 390 and 1280 px; source, methods and releases failed
  `scrollable-region-focusable` with the old markup, since rebuilt but not re-run. Compare, data, about, 404 never
  ran with their new markup. No keyboard walkthrough is recorded. Baseline: `docs/reports/qa/ui/a11y-before.json`;
  `a11y-after.json` does not exist.
- **Where:** `site/scripts/a11y.mjs`.
- **Left to do:**
  1. With a production build on port 3100: `node scripts/a11y.mjs --out ../docs/reports/qa/ui/a11y-after.json`.
  2. Fix every serious or critical finding.
  3. Keyboard only: search (Ctrl+K, type, Enter) to a series, chart point to a receipt, receipt to "JSON" and
     "Copy citation", browse filter, compare add/remove. Record each step and anything unreachable in the report.
  4. Check focus visibility, heading order, and contrast of `--ink-3` text on `--paper-2` panels.
- **Done when:** `node scripts/a11y.mjs` exits 0, `a11y-after.json` is committed, and the report has the
  walkthrough.
- **Effort:** 2 agent hours.
- **Needs from a human:** nothing.
- **Traps:** `waitUntil: "networkidle"` never settles because of link prefetching; the scripts wait for `load`.

### S5 Critique round 2 on every page built after the receipt
- **State:** not started. Only the receipt had a fresh-eyes critique (15 findings, report section "Critique round 1").
  Series, browse, home, sources, source detail, methods, demo, compare, data, releases, about and 404 were checked
  only by the agent that built them.
- **Where:** plan section 4 step 3 (the critique loop); screenshots from S3.
- **Left to do:**
  1. A fresh subagent gets the S3 screenshots, plan section 5 criteria and the "avoid" list, and returns ranked
     problems per page.
  2. Fix what is confirmed; record rejections with reasons in the report.
  3. Re-shoot the changed pages.
- **Done when:** the report has "Critique round 2" with every finding marked fixed, rejected (why) or moved to an
  S entry.
- **Effort:** 3 to 5 agent hours depending on findings.
- **Needs from a human:** nothing, unless a finding is a design-direction question (then H5).
- **Traps:** run it after S2, or the critique misses the new series.

### S6 Receipt findings deferred from critique round 1
- **State:** not started; listed in the report ("Rejected or deferred").
- **Where:** `site/src/app/o/[id]/page.tsx`, `site/src/components/ui/PageFrame.tsx`, `site/src/lib/cite.ts`.
- **Left to do:**
  1. CPI receipts have no "same column, other lines" block because the CPI general index has no parent; build the
     sibling set from `dims.group` within the same area, base and period.
  2. The heading strip of the magnified crop can end on a half-cut text line (seen on ABS 2025-26); end it at the
     last full line above the first row of numbers.
  3. Two checks with near-identical sentences (the same column total in two editions) read as duplicates; put the
     document and page first in bold (partly done: `check-where`), and consider grouping by document.
  4. On a phone the page render is small; open the enlarged view scrolled to the boxed cell.
  5. "(n.d.)" in APA stays until H7 supplies publication dates.
- **Done when:** each step is done or explicitly rejected in the report, with screenshots of a CPI and an ABS receipt.
- **Effort:** 2 to 3 agent hours.
- **Needs from a human:** H7 for step 5 only.
- **Traps:** a crop must never cut a number or a row in half (`cropGuides()` in `site/src/lib/data.ts`).

### S7 Handoff documents for the site
- **State:** partial. The UI report has the audit, handoff 1 and progress to 06:10 on 2026-10-11; it has no morning
  note and no final "done means" section. `README.md` still describes the site as of the first run (line 7 and
  the "The site" section near line 120); `site/README.md` describes the old components (`PageCell`, `Badges`,
  `ViewSwitch`, removed) and port 3000.
- **Where:** `docs/reports/2026-10-12-ui-report.md`, `README.md` (site/deploy paragraph only), `site/README.md`.
- **Left to do:**
  1. Rewrite `site/README.md`: layout of `src/` (design, components/ui, chrome, lib), the QA scripts, the URL-state
     convention, the dev-cache trap, port 3100.
  2. Update the README site paragraph (pages, how to build and check).
  3. Add the plan's section 7 "done means" to the report with evidence (links to S3, S4, S5 outputs).
- **Done when:** a reader with no context can build the site, run the four checks and find every page's code from
  `site/README.md` alone.
- **Effort:** 1 agent hour; best after S3 to S5.
- **Needs from a human:** nothing.
- **Traps:** `README.md` and `STATUS.md` are shared files: edit only the site paragraph and the `## Site` section.

### S8 "How to read a receipt" page
- **State:** not started on the site. The pipeline added `docs/HOW_A_NUMBER_GETS_ON_THE_SITE.md` (a generated
  walk-through of one receipt, `pipeline/scripts/gen_walkthrough.py`) and `docs/GLOSSARY.md` (83 terms). Receipts
  link to `/methods#statuses` and `/methods#checks` instead.
- **Where:** new route, for example `site/src/app/how-to-read/page.tsx`; receipt rail in `site/src/app/o/[id]/page.tsx`.
- **Left to do:**
  1. Read both documents; decide (or ask) whether the site renders the walk-through as is, or a short annotated
     receipt that links to it.
  2. Build the page; render the glossary terms the site uses (status names, vintage, coverage, tier) as anchors.
  3. Link it from every receipt's rail and from the footer.
- **Done when:** the page exists, every receipt links to it, and a11y passes on it.
- **Effort:** 2 agent hours.
- **Needs from a human:** whether the walk-through is meant for the public site or for the team.
- **Traps:** the walk-through's values come from the release by script; do not copy them into site code.

### S9 Share images for receipts and series
- **State:** not started. No `og:image` on any page.
- **Where:** an `opengraph-image.tsx` per route (`site/src/app/o/[id]/`, `site/src/app/series/[id]/`) using
  `next/og`; docs in `site/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`.
- **Left to do:**
  1. Card: figure with unit, series, kind and period, document and printed page, status mark, prototype label.
  2. Measure the build-time cost on 6,318 receipts; if it is more than about two minutes, generate cards for series
     and the home page only and give receipts the series card.
  3. Load the two site fonts from `site/src/fonts/` into the image renderer.
- **Done when:** a receipt's HTML has an `og:image` that returns a PNG, and build time is recorded in the report.
- **Effort:** 2 to 3 agent hours.
- **Needs from a human:** H3 (absolute URLs need `siteUrl`); can be built before, but links will be relative.
- **Traps:** a card must never show a value for an unpublished figure.

### S10 Sitemap, robots, canonical URLs, structured data
- **State:** not started.
- **Where:** `site/src/app/sitemap.ts`, `site/src/app/robots.ts`, `metadata.alternates.canonical` per route,
  `Dataset` JSON-LD on series pages.
- **Left to do:** 1. Write the four. 2. Validate the JSON-LD on one series with a schema validator.
- **Done when:** `/sitemap.xml` lists every route; `/robots.txt` allows everything; series HTML holds valid JSON-LD.
- **Effort:** 1 to 2 agent hours.
- **Needs from a human:** H3 (`siteUrl`); without it the sitemap cannot hold absolute URLs.
- **Traps:** 7,280 pages: split the sitemap if it passes 50,000 URLs (not yet).

### S11 Designed empty and error states
- **State:** partial. Exist: browse "no series matches", chart "no checked values", search "nothing matches",
  compare "not in this release", 404. Not designed: a dataset absent from the release, a series whose every figure
  is a gap (table only), the search index failing to load (message exists, unstyled), a receipt for an unknown
  status (falls back to the raw label).
- **Where:** components listed above; `site/src/lib/status.ts` (`unknown`).
- **Left to do:** build a test release folder with these cases (a copy of the release with a dataset removed and
  an invented status value, never committed), point `release.config.json` at it locally, screenshot each state, fix.
- **Done when:** screenshots of each state are in the report.
- **Effort:** 2 agent hours.
- **Needs from a human:** nothing.
- **Traps:** do not commit the test release or change the real `release.config.json` version.

### S12 Keyboard shortcuts sheet
- **State:** partial. Skip link and reduced-motion handling exist; Ctrl/Cmd-K and "/" open search. No `?` sheet.
- **Where:** `site/src/components/chrome/` (new dialog), `site/src/app/layout.tsx`.
- **Left to do:** a dialog listing the shortcuts, opened by `?` outside inputs, closed by Esc.
- **Done when:** `?` opens it; axe clean; listed in the S4 walkthrough.
- **Effort:** 1 agent hour.
- **Needs from a human:** nothing.
- **Traps:** none known.

### S13 "What changed since the previous release" and errata badges
- **State:** blocked: there is only one release (`v0.0.1-prototype`, rebuilt in place under D29).
- **Where:** series page, receipt, releases page.
- **Left to do:** when a second release folder exists, diff observations by `obs_id` and show changed values with
  both releases; mark figures listed in `ERRATA.md`.
- **Done when:** a figure that differs between two releases shows both, each linked to its release.
- **Effort:** 3 agent hours, after the second release.
- **Needs from a human:** the first frozen release (H6, DOI decision).
- **Traps:** the site reads one release folder today (`release.config.json`); reading two needs a design decision.

### S14 Print stylesheet check
- **State:** written (`site/src/app/globals.css`, section 11) but never tested.
- **Left to do:** print a tier-A receipt, a disputed receipt and a series page to PDF with Playwright
  (`page.pdf()`), look at them, fix page breaks.
- **Done when:** the three PDFs are in `docs/reports/qa/ui/print/` and each receipt fits two pages.
- **Effort:** 1 agent hour.
- **Needs from a human:** nothing.
- **Traps:** none known.

### S15 Development server: stale cache on Windows
- **State:** observed repeatedly on 2026-10-11: after edits to `globals.css` or shared `lib/` files, `next dev` on
  port 3100 served old CSS or old modules (for example "frozenThresholds is not a function") until `.next/dev` was
  deleted and the server restarted.
- **Where:** `site/next.config.ts` (the Tailwind turbopack loader rule), `.next/dev`.
- **Left to do:** reproduce on a clean clone; try without the custom CSS loader rule and with persistent dev
  caching disabled; document the fix or the workaround in `site/README.md`.
- **Done when:** an edit to `globals.css` shows on reload without a restart, or the README says exactly what to do.
- **Effort:** 1 agent hour.
- **Needs from a human:** nothing.
- **Traps:** never test against the other agent's checkout or port.

Not needed now: table virtualisation (plan section 6 item 5). The longest series has 22 rows; revisit if monthly
CPI (P2) lands.

## Human (H)

- H1 Confirm or overturn the provisional decisions in `DECISIONS.md` (D25 to D34 and the unattended lines), D26 first.
- H2 Label the gold set (two people), after P7.
- H3 Create the Vercel project (root directory `site`) and set `siteUrl` in `site/release.config.json`.
- H4 Ahmad reviews what was merged into `main` (PR #1); fixes go in as new PRs.
- H5 Site questions: a dash printed in an ABS table; the accent colour; light theme only.
- H6 Still open from the first run: LUMS name and logo sign-off, DOI, hosting PDFs, branch protection on `main`.
- H7 Publication dates of the source documents (or a decision to keep "(n.d.)"): the pipeline cannot establish them
  from the files (STATUS.md, answers of handoff 2); citations print "(n.d.)" until then. Unblocks S6 step 5.
- H8 Whether the generated walk-through `docs/HOW_A_NUMBER_GETS_ON_THE_SITE.md` is for the public site or for the
  team. Decides how S8 is built.

## Merge check

On 2026-10-12 Claude Code (at Ali's request) merged the site branch into `proto/v0`, committed the leftover
`pipeline/scripts/compare_full_document_run.py`, updated `STATUS.md` and `DECISIONS.md`, and merged PR #1
into `main`. Not merged on purpose: `proto/v0-e1-abs-editions` and `proto/v0-e4-cpi-monthly`. Each agent checks
that its own work arrived intact and records the result in its subsection.

### Pipeline agent's check
- [ ] Every commit of `proto/v0` (and of the track branches that were already merged into it) is in `main`.
- [ ] Nothing of mine was lost or changed in the merges (diff `main` against my last commit, outside `site/` and
      the files listed above).
- [ ] `python -m pytest` and `datalab check-release releases/v0.0.1-prototype` pass on `main`; CI on `main` green.
- [ ] The edits Claude Code made to `STATUS.md` and `DECISIONS.md` are accurate.
- Problems found and how they were fixed:

### Site agent's check
Done 2026-10-12 on branch `followup/open-work-site` from `origin/main` at `bebff67`.
- [x] Every commit of `proto/v0-ui` is in `main`: `git log origin/main..origin/proto/v0-ui` is empty, and so is
      `git log origin/main..23e670a` (my last site commit).
- [x] Nothing of mine was lost or changed: `git diff 23e670a origin/main -- site docs/DESIGN.md docs/reports/qa/ui`
      is empty. `docs/reports/2026-10-12-ui-report.md` differs only by the 38-line "Progress after handoff 1"
      section I had left uncommitted (commit `7b8cd0a`), unchanged.
- [x] On `main`: `npm run lint` clean; `npm run build` green, 7,280 static pages (prebuild: 6,318 receipts, 925
      series CSVs), 5 min 36 s while pipeline jobs ran; `node scripts/check-build.mjs` OK (5,490 value receipts,
      811 gap receipts, 17 disputed receipts).
- [x] The `## Site` section of `STATUS.md` is accurate after two fixes (below).
- Problems found and how they were fixed:
  - `STATUS.md` `## Site` still said the last six pages would "merge with the next green gate" and that the site
    lives on `proto/v0-ui`; rewritten to say everything is in `main`, with the check results above, and to point
    at the S list. The page count line now says 7,280.
  - Not a merge problem, found while checking: receipts ignore `Check.member_signs` and
    `Check.credits_members`, which the release gained overnight. Not fixed today; recorded as S1.

## Done

(Move finished entries here with the PR or commit.)
