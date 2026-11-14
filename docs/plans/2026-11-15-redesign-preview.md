# Unattended run, 2026-11-15: preview build of the draft design brief

Authorised by Ali on 15 November 2026 for one overnight run (AGENTS.md section 9). Branch `proto/redesign-2026-11`,
cut from `docs/design-research-2026-11` (draft PR #12). Nothing merges to `main`.

## Goal

By morning, the redesign in `docs/DESIGN.md` is built on this branch and deployed as a Vercel branch preview, good
enough for Ali to judge on a phone. **The brief stays a DRAFT.** Building a preview does not approve it.

## Readers (they decide every trade-off)

Economists and finance people (the exact figure, its kind, its source page, a file); economics teachers (a chart on a
phone or projector); students (plain or misspelt search words); citizens (one sentence they can trust). English
only. Phone first: a 360 px Android on slow 4G.

## Rules for this run

- AGENTS.md sections 3 and 4 hold. Every number comes from the frozen release `v0.0.1-prototype`; receipts and caveats
  are never dropped; a figure that has not passed its checks shows no number anywhere.
- Data is read through the adapter of DESIGN.md section 5 only. Our release stays the source; the golden adapter is
  not switched on tonight.
- The adapter and the pages handle "candidate, not signed off" and a printed dash. A printed dash is never shown or
  used as 0.
- The nine decisions in DESIGN.md section 17 are built to the brief's own proposal and listed in the morning report
  as assumptions for Ali and Ahmad to confirm. Other judgement calls go in `DECISIONS.md` as "provisional
  (unattended, 2026-11-15)".
- Order: DESIGN.md section 18.1. Each stage leaves the site working and is committed and pushed.
- No check or test is weakened, skipped or deleted to get a pass. A check that fails for a reason that cannot be
  fixed stays failing and is reported.
- Not allowed: merging to `main`, touching production or the Vercel project settings, changing Ahmad's repository,
  typing in data by hand, committing secrets.

## A stage is done when

1. `npm run lint`, `npm run build` and `node scripts/check-build.mjs` pass.
2. The section 18.2 reader tasks were run in a real browser at 360 px and at desktop width, with screenshots saved.
3. Page weight and load time on a throttled connection are measured and no worse than the baseline in
   `docs/DESIGN_REFERENCE.md`.
4. Keyboard use, contrast and tap targets pass an accessibility check.
5. A fresh subagent that has not seen the work has used the stage as each of the four readers and tried to break it;
   what it found is fixed or logged in `docs/OPEN_WORK.md`.

## Report

`docs/reports/2026-11-16-redesign-preview-report.md`: what is built, the preview link, what to look at first on a
phone, every judgement call, what failed or is unfinished, and the section 17 assumptions.
