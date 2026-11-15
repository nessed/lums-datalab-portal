# Brief for every build agent, round 2 (unattended, 2026-11-15)

You are one agent in a team building, in parallel, one area of round 2 of the portal redesign. The run plan is
`docs/plans/2026-11-15-redesign-round2.md`; read it first. Nobody will answer questions: when something is a
judgement call, make it, write it in your report with the reason, and keep going. If one thing is blocked, park it
with a note and move on.

## What round 2 is

Round 1 (report: `docs/reports/2026-11-15-redesign-preview-report.md`) built the structure, rules and evidence; the
numbers are right. Ali's verdict: it reads like a paper directory or a government index, not a tool people want to
use. Everything sits at one volume: one off-white for header, page and footer, one teal for links, numbers and
buttons alike, titles copied from printed labels ("CPI National: General (all groups), change over the same month
last year"), small headline numbers. Round 2 gives it a visual hierarchy and an identity:

- **LUMS skin, data-tool inside.** Brand layer is LUMS (navy `#002581`, LUMS blue `#2E3192`, gold `#FDB913`, Noto
  Sans and Noto Sans Display Bold). Inside the header it behaves like FRED, OWID, the World Bank, ONS: dense,
  compact, scannable, no hero photos, no welcome banners, no marketing whitespace. **The figures are the hero.**
  Charts are the biggest thing on a series page with their tools around them. Data furniture stays visible: series
  ids in monospace beside titles, release tags, "as of" dates, sparklines in lists.
- **Two tests for every page:** cover the header and it looks like a serious data tool; uncover it and it is
  obviously LUMS.
- Readers: economist (exact figure, kind, source page, file), teacher (clean chart on a phone or projector),
  student (plain or misspelt search words), citizen (one sentence they can trust). **Phone first: 360 px Android on
  slow 4G.** Every reader gets the answer in one glance; the economist finds every detail one layer down.

## Read first

- `AGENTS.md` sections 3 and 4 (non-negotiable) and section 7's site traps (the `next start` stale-CSS trap).
- `docs/DESIGN.md` sections 4, 6, 7, 11, 12, 14, 15, 16 and the sections your task names.
- `docs/plans/2026-11-15-agent-brief.md`, "How the code is organised" and "Rules that never bend": all of it still
  holds (adapter, `V`/`Count`/`Num`, `Link`, derived values recomputed by a check plug-in).
- The reference screenshots your task names, in `docs/design-reference/img/`. Look at them (they are images; open
  them with your file-reading tool). Before screenshots of our site are in `docs/reports/qa/round2/before/`.

## Rules that never bend

1. **Presentation only.** Every number comes from the frozen release through `@/lib/data` (`db()`). Never type a
   number, never invent data or sample values. A figure that has not passed its checks shows no number anywhere
   (HTML, JSON the browser draws, tooltips, alt text, files, images). Receipts and caveats may move to another
   layer; they never drop.
2. **`site/scripts/check-build.mjs` is not edited, and keeps passing.** Every digit on a page is accounted for: a
   value is `<V o={...}/>`, a count `<Count>`, other digits `<Num kind=...>`; a new kind of derived figure needs a
   check plug-in in `site/scripts/checks/<area>-*.mjs` that recomputes it. Editorial text (titles, summaries,
   labels) carries no digits.
3. **Never weaken, skip or delete a check or test to get a pass.** If one fails and you cannot fix the cause, leave
   it failing and say so.
4. Tokens only: colours, type sizes and spacing come from `site/src/design/tokens.css`. No raw hex in components or
   page CSS (except where a token is defined).
5. Gold (`--gold`) is never text on white. Contrast at least 4.5:1 for text and 3:1 for meaningful graphics and
   control borders; check every pair you introduce.
6. Up and down are arrows and words in neutral ink, never red and green.
7. No serif. No hero images, banners, gradients, carousels, three-up marketing cards, big radii, purple, pies.
8. No prefetching; `@/components/ui/Link` only. JavaScript only where it adds something; number, chart, table and
   CSV link work as plain HTML.

## Stay in your lane

- You own only the files your task lists. Shared files (`tokens.css`, `globals.css`, `base.css`, `layout.tsx`,
  `components/ui/*`, `lib/adapter/*`, `lib/format.ts`, `editorial/titles.json`) belong to the foundation agents; after
  the foundations are merged, page agents may **append** narrowly scoped rules to their own CSS file to override a
  shared rule, and must list in their report any shared-file change they needed but did not make.
- Work in your git worktree on your branch. Commit small, with messages that say why. Push your branch
  (`git push -u origin <branch>`) after each milestone. Never push to `main` or to `proto/redesign-2026-11`; the
  lead merges.
- Never run `rm -rf` on anything outside your worktree. Never touch `SOURCES_DIR`, `releases/` or `work/` data.
- Machine is shared by up to six agents. A full `npm run build` takes about ten minutes and the first
  `node scripts/check-build.mjs` after a build can take 20 to 40 minutes (disk). Develop with `npx next dev -p <your
  port>` on the pages you own; run the full build and check-build once at the end of your task. Stop every server you
  start (`AGENTS.md` trap: a `next start` left running across a rebuild serves stale CSS).
- Use your assigned port only.

## Done for your task

- `npm run lint`, `npm run test:contract`, `npm run test:search`, `npm run build`, `node scripts/check-build.mjs`
  pass in your worktree (run `node --no-warnings scripts/series-derive-test.mjs` too if you touched series code).
- Screenshots of your pages at 360 and 1280 px in `docs/reports/qa/round2/<area>/` (PNG, quantised if large).
- A short report at `docs/reports/qa/round2/<area>/REPORT.md`: what you did per item number, judgement calls with
  reasons, anything left undone and why, shared-file changes you needed.
- Your final message to the lead: the branch name, the last commit, check results (with numbers), and the list of
  judgement calls. Plain words, no selling.
