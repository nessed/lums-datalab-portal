# Unattended run, round 2 (2026-11-15): visual hierarchy and a LUMS identity

Authorised by Ali on 15 November 2026 (AGENTS.md section 9). Continues `docs/plans/2026-11-15-redesign-preview.md`
on branch `proto/redesign-2026-11` (draft PR #13). Nothing merges to `main`. The brief `docs/DESIGN.md` stays a
draft; this round changes how the preview looks and reads, not what it holds.

## Goal

Same site, same content, same rules, with a real visual hierarchy and an identity. Two tests for every page:
cover the header and it reads as a serious data tool (FRED, OWID, World Bank, ONS); uncover it and it is
obviously LUMS. A teacher, a student and a citizen get the answer at a glance; an economist finds every detail one
layer down.

## Rules (unchanged from AGENTS.md; they win over everything below)

- Presentation only. Every number comes from the frozen release `v0.0.1-prototype` through the adapter. Nothing is
  typed into a page or invented. A figure that has not passed its checks shows no number anywhere.
- Receipts and caveats can move; they never drop.
- `site/scripts/check-build.mjs` keeps passing **and is not edited**. New checks go in new plug-ins under
  `site/scripts/checks/`. No check or test is weakened, skipped or deleted to get a pass.
- Plain titles and summaries are editorial text (AGENTS.md section 4 permits drafting them): they live in
  `site/editorial/titles.json`, carry no digits, are marked draft, and never touch the data.
- The nine DESIGN.md section 17 decisions stay assumptions. Judgement calls go to `DECISIONS.md` as
  "provisional (unattended, 2026-11-15, round 2)".
- Not allowed: merging to `main`, production or Vercel project settings, Ahmad's repository, secrets in commits.

## The identity (from Ali's brief; changes only where contrast or testing says so, logged)

| Token | Value | Used for |
|---|---|---|
| Navy | `#002581` | header bar, footer, big numbers, H1 |
| LUMS blue | `#2E3192` | links, buttons, chart line 1, focus ring on light ground |
| Gold | `#FDB913` | accent only, never text on white: header rule, answer highlight, active tab and chip edge, the "See it on the printed page" pill (navy text on gold), focus ring on navy |
| Amber | `#B07C00` | second chart series (a line, never text) |
| Page | `#F4F5F9` | page ground; cards and panels white |
| Ink / mid-grey | near-black / about `#5F6577` | text / metadata |

Type: Noto Sans (one variable font, Latin subset) for body, labels and metadata; Noto Sans Display Bold for titles
and big numbers; tabular figures wherever numbers sit in columns or charts; system monospace for series ids. No
serif. Target 50 to 70 KB of fonts in total.

Up and down: arrows and words in neutral ink, never red and green.

## Stages (each leaves the site working; commit and push after each)

1. **Foundations, in parallel worktrees** (`proto/r2-*`, merged one at a time with the full checks):
   - `look`: tokens, fonts, header and footer, base components (cards, buttons, chips, tabs, pills, the receipt
     mark on every value link, the series id with copy button, fact pills), teal replaced everywhere.
   - `titles`: the plain-title system: `site/editorial/titles.json` (title, one-sentence summary, draft flag) for
     every series, read through the adapter, with a check plug-in; nothing in the data changes.
   - `rounding`: one rounding rule for derived percentages across every page, file and check plug-in (item 26).
   - `next`: Next.js upgrade as its own branch and draft PR off `proto/redesign-2026-11`, full checks (item 27).
2. **Pages, in parallel worktrees**, on top of the merged foundations:
   - `series`: items 2 to 11, the evidence pill (19), view state without JavaScript (24).
   - `search`: items 12 to 15, the catalogue element budget (21) and catalogue filters without JavaScript (24).
   - `home`: items 17, 18, the evidence example on home (19), topics, answers and text pages.
   - `compare`: items 16, 23, compare legend titles, picker roles, 360 px overflow; the receipt page and the one-tap
     sheet in the new look.
   - `perf`: JavaScript budget (20), page budgets that fail the build (25).
3. **Integration:** keyboard script rewritten for the new pages (22), no-JavaScript check, 360 px on a throttled
   phone connection for every page type (28), contrast check over every colour pair in use, including gold.
4. **Cold testing:** fresh agents as economist, teacher, student, citizen (360 px and desktop) and one breaker; a
   separate design reviewer compares screenshots of every page with `docs/design-reference/img/`. Fix, retest.
5. **Report:** `docs/reports/<date>-redesign-round2-report.md`: preview link, before and after screenshots, the 28
   items, judgement calls, every plain title (appendix file), tester and reviewer findings, next steps.

## Done means

Lint, all tests, the number audit and check-build pass. Each page's reader tasks pass at 360 px and desktop, with
tap counts, times and screenshots saved. Page weight and load time no worse than the round-1 build apart from the
agreed font cost. Contrast passes everywhere, including every gold use.

## Change of plan (Ali, during the run, to save time; the goal is unchanged)

1. After each page merge: lint, the tests and the number audit only (`site/scripts/number-audit.mjs`: every check
   plug-in in `site/scripts/checks/` run against the built output, without the full HTML scan). The full
   `check-build.mjs` runs twice: once after the foundations merge, and once on the final branch before the report;
   if the final one fails, fix and rerun it.
2. Dropped from this round, parked in `docs/OPEN_WORK.md`: the keyboard script rewrite (item 22) and the
   no-JavaScript checks (item 24).
3. No design reviewer. Two reader testers: one at 360 px (citizen, student, teacher), one at desktop (economist,
   and tries to break it).
4. One fix round after the testers, no retest pass. Anything unfixed is listed in the report.
5. Earlier trims (Ali: avoid diminishing returns): three page agents (series with compare and the evidence sheet;
   search with the catalogue; home with topics); JavaScript budget reported rather than re-architected; long-tail
   titles generated by rule and flagged draft.
