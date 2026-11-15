# Redesign preview build: morning report

This was an unattended run on 15 November 2026, authorised by Ali; it finished in the early afternoon after a usage-limit pause. The plan was `docs/plans/2026-11-15-redesign-preview.md`.

The work is on branch `proto/redesign-2026-11`, in draft PR #13. Nothing is merged to `main`. The brief (`docs/DESIGN.md`, draft PR #12) is **still a draft**: this build exists so you can judge it.

## Five-minute summary

- **Stages 0 to 9 of DESIGN.md 18.1 are built.** Stage 10 (budgets enforced in the build) is only measured, not enforced.
  - The data still comes from release `v0.0.1-prototype`, now read only through the new adapter.
  - Ahmad's golden-release adapter is built and tested against tag `golden-2026.11.11`, but it is not switched on.
- **Checks:**
  - Lint, 40 contract tests, 20 search tests and 11 derive tests pass.
  - `check-build` passed on the integrated build except for 2 wording problems, which are now fixed; see "Final check" below for the last run.
  - Nine new check plug-ins recompute every derived number, every file value and every search answer against the release.
- **No unchecked figure shows a number.** The four reader testers looked for leaks. They crawled every receipt of an unpublished figure (828), every series page, and every xlsx and CSV file. They found none.
- **Fixed from the testers:** 8 problems. The worst three:
  - Compare computed changes across the 2011-12 devolution break (health showed −63.7%).
  - The default health chart joined a revised estimate to the next budget estimate, which read as a 38% fall.
  - Long ids pushed 330 series pages wider than a 360 px phone, and the action bar went off-screen.
- **Still over budget:**
  - JavaScript is 144–160 KB on every page, against a budget of 100 KB. Most of it is the Next.js and React framework itself.
  - The catalogue has 2,039 elements, against 1,500 (it had 27,425).
  - Fonts are now 28 KB and within budget; they were 148 KB.

## Preview link and what to look at first on your phone

- **Preview (branch alias, updates with every push):** https://lums-datalab-portal-git-p-82d16f-aliabid44444gmailcoms-projects.vercel.app
- It sits behind Vercel's login (deployment protection). Sign in to Vercel on your phone first. I did not change the project settings.

Look at these, in this order, on the phone:

1. **Home.** Check the headline cards. Health now says "up 17% on the 2025-26 BE" and also "The 2025-26 figure was later revised: Rs 60.2 billion (RE)". Does that read honestly?
2. **Tap any number.** The one-tap sheet opens, showing the boxed crop of the printed page, the verdict sentence and the versions line. Back closes it.
3. **Federal health series** (`/series/fed.exp.current.function.health`):
   - the answer line;
   - the three views (best per year, by kind, budget to revised);
   - the Units menu;
   - Present mode;
   - the sticky Download, Cite, Compare and Share bar.
4. **Search from the header.** Try "inflaton", "unemployment women", "health spending", "tax revenue 2023" and "GDP".
5. **A receipt:** `/o/fed.exp.current.function.health~2025-26~be` shows the +88% versions line. Then a held-back figure and a disputed figure, which show no number and give the reason.
6. **Answer page** `/answers/federal-health-spending` and **topic page** `/topics/spending`.
7. **Download** a series as Excel from its Download sheet, and open it.

## What is built (DESIGN.md 18.1)

| Stage | State |
|---|---|
| 0. Fix what is broken | Done. The phone search box is 239 px wide (it was 0). No background downloads: home stays at 203 KB after 30 s (it was 2,005 KB). The catalogue HTML lists the 79 top-level series, and all 925 load as JSON when you filter |
| 1. Adapter and contract tests | Done. `src/lib/adapter/`: the contract, the datalab adapter (on) and the golden adapter (tested, off). The adapter decides each figure's reader status and kind; pages only display it. Candidate ("not signed off") and dash-or-zero statuses have their own marks |
| 2. Words | Done across all pages: the statuses of 6.1, kinds of figure, short-scale headlines ("Rs 37.4 billion", traced by check-build) |
| 3. Receipt in three depths | Done. Verdict sentence, pre-cut crops (largest 24 KB), versions strip with BE → RE change, collapsed sections, page image loaded only when opened, one-tap sheet everywhere |
| 4. Series page | Done. Answer line, Units, range chips, source lines inside the chart, phone table, About, "Where it sits" trail, present mode |
| 5. Versions | Done. Best per year, by kind, budget-to-revised bars; version downloads (latest, first printed, every printing, vintage grid) |
| 6. Search | Done. Header field on every page; 102 curated concepts (27 are honest "not in this release" cards); typos, synonyms, years, province chips; answer cards |
| 7. Home, topics, answers | Done. Five topics, 23 answer pages, BE-to-RE revision statistics on budget topics |
| 8. Downloads, citation, links | Done. xlsx, long CSV, data package, version files; citation sheet in six styles; release-pinned links `/v0.0.1-prototype/...` with "This link will keep showing these numbers" |
| 9. Compare | Done. Search to add series, "Show as" (index, % change, share), small multiples, combined download, layout shift 0.00 (it was 0.50) |
| 10. Performance checks in the build | Not done. `scripts/perf.mjs` measures, but the build does not fail on budgets yet |

## Measurements

Phone at 360 px, 4× CPU slowdown, cold cache, compressed. The machine was also running agents, so times are pessimistic.

| Page | Baseline (DESIGN_REFERENCE) | Now | Budget |
|---|---|---|---|
| Home | 330 KB, then 2,005 KB after 30 s | 203 KB, still 203 KB after 30 s | 200 / 250 KB |
| Series | 381 KB; number visible in 1.4 s Fast 3G, 3.0 s at 400 kbps | 225 KB; 2.5 s, 2.7 s | 200 KB; 2 s, 4 s |
| Receipt | 751 KB | 238 KB (crop 18 KB) | 250 KB |
| Catalogue | 285 KB HTML, 27,425 elements | 22 KB HTML, 2,039 elements | 100 KB, 1,500 |
| Compare | 511 KB, layout shift 0.50 | 221 KB, layout shift 0.00 | 200 KB, 0.1 |
| JavaScript, any page | 142–161 KB | 144–160 KB | 100 KB |
| Fonts | 148 KB | 28 KB | 40 KB |

Nothing is heavier than the baseline. The series-page visible time is worse than the baseline figure, but that baseline was measured on an idle machine. These numbers should be re-measured on an idle machine.

## Judgement calls

| # | Call | Why |
|---|---|---|
| 1 | Built on `proto/redesign-2026-11` (agent branches `proto/redesign-*`) | AGENTS.md section 9 allows unattended work only on `proto/*` |
| 2 | The catalogue's HTML lists only the 79 top-level series; the other 846 come from a checked JSON file | Element and HTML budgets (14.1). Without JavaScript, every other series is reached from its parent |
| 3 | Links never prefetch, not even on hover | 14.2 rule 1. A phone has no hover |
| 4 | The adapter keeps our field names and adds `kind`, `reader`, `printed_text`, `signoff` | Pages were written against those names; the golden adapter fills the same shape |
| 5 | Candidate datasets are visible and always marked "not signed off" | Decision 17.1 as proposed. Our release has no candidates |
| 6 | Contract fixtures are cut from the real release at test time | "No data typed in by hand" |
| 7 | Source Serif 4 (122 KB) is dropped; the serif figures use Georgia or Noto Serif | Font budget. No subsetting tool was installed, and I did not download one unattended |
| 8 | Catalogue rows lost their sparklines, and "By document" moved to Sources | Element budget; 9.8 puts documents on Sources |
| 9 | Golden adapter: the tag has no page sizes, so boxes are unset and the state is "no-image" | "none" would wrongly say the figure was not found on the page |
| 10 | The tag holds 13 golden-layer datasets, not 14 (`budget_credibility` came after it) | Read from the tag itself |
| 11 | `/search?q=` is the search results page; `/browse?q=` uses the same ranking | Search returns documents, tables and answer cards, which the catalogue does not hold |
| 12 | No links out anywhere (honest cards name the publisher in words) | Nothing is link-checked at build yet (16) |
| 13 | Pinned links are Next.js rewrites, not duplicate pages | Duplicate pages would double a 10-minute build. A static mirror needs the same two rules |
| 14 | Files carry a citation and metadata on every row | Comment lines break pandas and R |
| 15 | Derived numbers round as follows: % change 1 decimal on the series page and compare; whole per cent above 10% on cards and receipts; shares 2 decimals | **Inconsistent across pages (a tester noticed). One rule should be chosen** |
| 16 | "Next expected" says "not stated in this release" | There is no release calendar; no date was invented |
| 17 | Every derived number must be claimed and recomputed by a check plug-in, or the build fails | The three areas had each written their own weaker version |
| 18 | Present mode keeps only the exit button and fits the chart to the screen | Tester: the source line fell below the fold |
| 19 | A chart line never joins two kinds of figure | Tester: a revised estimate joined to the next budget estimate read as a 38% fall |
| 20 | Budget cards also give the later revised figure of the year they compare with | Tester: "up 17%" hid that the revised estimate was 60.2 billion |
| 21 | The next-upgrade notice that Next.js printed during builds was ignored | It came from tool output, not from you. Upgrading Next.js is your call (see below) |

## Section 17 decisions: built to the brief's proposal, waiting on you and Ahmad

1. **Candidates** are shown, marked "not signed off", and kept out of home, answer pages and the headline layer of search. Nothing in our release is a candidate.
2. **Revised vs disputed:** "revised" only where a later printing replaces an earlier one; `misprint*` is shown as held back. Our pipeline's disputed figures stay disputed.
3. **A printed dash:** never 0. The golden adapter marks the federal ABS zeros as "dash or zero", with no number and never used in a sum. The tag has 456 such figures.
4. **Reliability tiers** are not shown anywhere yet.
5. **Topics:** the first five are built from `site/editorial/topics.json` (provisional). You still need to decide who maintains the editorial files.
6. **Permanence:** nothing done. Domain owner, mirror and DOIs are still open.
7. **Page proofs and when to switch:** not switched. The design note `docs/plans/2026-11-15-golden-adapter.md` lists what the golden release still lacks: proof images, page sizes, federal ABS printed text, publication dates and series ids.
8. **Survey figures PBS never printed** (`unpublished*`) are "not checked yet", with no number.
9. **Answer pages:** 23 questions drafted in `site/editorial/questions.json` (provisional, no numbers in them). They need your approval.

All editorial files (`site/editorial/*.json`: topics, headline cards, questions, 102 search concepts) were drafted by agents and need a person's review.

## What failed or is unfinished

- **JavaScript budget fails on every page** (144–160 KB against 100 KB). About 130 KB of it is the framework baseline. Meeting the budget means a lighter framework setup or static HTML plus small scripts; I left that decision to you.
- **The catalogue has 2,039 elements** against 1,500. The fix is lighter rows (fewer columns).
- **`scripts/keyboard.mjs` fails 5 of 10 steps.** It still looks for parts of the old pages (an old results list, "Copy citation" text, old tabs). I did not rewrite it to pass. The testers checked keyboard use by hand, and it works: the search dialog, chart points, the sheet, Escape and focus return all behave.
- **axe:** one serious issue, `nested-interactive` on `/compare` (1 at default, 3 with mixed units). Not fixed.
- **Without JavaScript,** shared series links lose their view (`?units=`, `?view=`), and catalogue filters do not work. Pages still show the default chart and table.
- **Smaller issues the testers found, not fixed:**
  - Answer cards show old figures without saying the series ends there (PSDP, petroleum levy: 2017-18).
  - The year chip ("FY24") does not change the result values.
  - BE and RE are not explained anywhere a citizen would look (no glossary entry, no `abbr`).
  - Derived share series in files carry an empty source and no formula column.
  - Links inside downloaded files are relative (`/v0.0.1-prototype/...`) because `siteUrl` is empty in `release.config.json`.
  - The compare table makes the page scroll sideways at 360 px.
  - The compare picker has no combobox roles.
  - Chart points are 24 px tap targets.
  - Present mode text is still small for a big room.
- **Stage 10** (budgets enforced in the build) is not done. `scripts/perf.mjs --budget` exists to wire in.
- **Build environment:**
  - The crops add 26,311 files (82.5 MB) to `public/data` and about 2 minutes to a build. Vercel built the merged commits successfully.
  - On this machine, the first `check-build` after a build waits on disk for every new file (20–40 minutes, CPU idle). Re-runs are fast.
- **Next.js notice:** builds printed that Next.js 16.4.0 "is affected by a known security vulnerability" and suggested `next upgrade`. **Upgrading is your decision;** I changed no dependency.
- **Agent worktrees** in `C:\Users\Ali\Desktop\Projects\Code\lums-wt\` (6 folders, each with a `node_modules` junction) can be removed with `git worktree remove`. A stray empty folder tree, `C:\c\Users\Ali\...`, made by one agent's screenshot script, can be deleted by hand.

## Final check

pending (written when the last build's check-build finishes)

## Where things are

- Screenshots: `docs/reports/qa/redesign/<area>/`, for areas stage0, evidence, series, search, home and take, at 360 and 1280 px. Accessibility, keyboard and perf results are under `docs/reports/qa/redesign/`.
- Agent brief: `docs/plans/2026-11-15-agent-brief.md`. Golden adapter note: `docs/plans/2026-11-15-golden-adapter.md`.
