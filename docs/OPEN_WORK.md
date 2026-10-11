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

Owner: the site agent. Seed list from the morning summary; replace each line with a full entry.

- S1 Production screenshots of every route at 390, 820 and 1280 px into `docs/reports/qa/ui/after/`.
- S2 Accessibility: axe on every route; keyboard walkthrough recorded.
- S3 Critique round 2 on the pages built after the receipt.
- S4 Polish backlog (`docs/plans/2026-10-12-ui.md` section 6): share images, `?` shortcuts sheet, "what changed
  since the previous release", sitemap/robots/structured data, designed empty and error states, "how to read a
  receipt" (check against the pipeline's new walk-through first).
- S5 Handoff documents: morning note in the UI report, README site paragraph.

## Human (H)

- H1 Confirm or overturn the provisional decisions in `DECISIONS.md` (D25 to D34 and the unattended lines), D26 first.
- H2 Label the gold set (two people), after P7.
- H3 Create the Vercel project (root directory `site`) and set `siteUrl` in `site/release.config.json`.
- H4 Ahmad reviews what was merged into `main` (PR #1); fixes go in as new PRs.
- H5 Site questions: a dash printed in an ABS table; the accent colour; light theme only.
- H6 Still open from the first run: LUMS name and logo sign-off, DOI, hosting PDFs, branch protection on `main`.

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
- [ ] Every commit of `proto/v0-ui` is in `main`.
- [ ] Nothing of mine was lost or changed in the merges (diff `main:site/` against my last commit).
- [ ] `npm run lint`, `npm run build` and `node scripts/check-build.mjs` pass on `main`.
- [ ] The `## Site` section of `STATUS.md` is accurate.
- Problems found and how they were fixed:

## Done

(Move finished entries here with the PR or commit.)
