# Brief for each build agent (unattended run, 2026-11-15)

You are one of several agents building, in parallel, one area of the redesign described in `docs/DESIGN.md` (a
DRAFT brief; the build is a preview so humans can judge it). The run plan is `docs/plans/2026-11-15-redesign-preview.md`.
Nobody will answer questions tonight: when something is a judgement call, make it, write it down in your report,
and keep going. If one thing is blocked, park it with a note and move on.

## Read first

- `docs/DESIGN.md`: sections 1, 4, 6, 7, 14, 15, 16, then the sections named in your task.
- `AGENTS.md` sections 3 and 4 (non-negotiable) and 7 (traps).
- `docs/DESIGN_REFERENCE.md` only where your task points to it.

## Who the site is for (decides every trade-off)

Economists and finance people (the exact figure, its kind, its source page, a file); economics teachers (a chart on
a phone or a projector); students (plain or misspelt search words); citizens (one sentence they can trust). English
only. **Phone first: a 360 px Android on slow 4G.** Restrained look: no bright colours, no animated type, no
gradients, no marketing words (DESIGN.md 15, 16).

## Rules that never bend

1. **Every number comes from the frozen release**, through `@/lib/data` (`db()`), which reads it through the adapter
   (`src/lib/adapter/`). Never type a number, never invent sample data. Editorial text (reader names, topics,
   questions, search concepts) may be drafted by you, must contain **no numbers**, lives in a reviewed JSON file
   under `site/editorial/`, and is marked `"provisional": true`.
2. **A figure that has not passed its checks shows no number anywhere**: not in HTML, JSON the browser draws, chart
   tooltips, alt text, files or exported images. `o.reader.showsValue` is the adapter's decision; use it. A printed
   dash is never shown or used as 0. A "candidate" (not signed off) value is always marked with those words and kept
   out of the home page, answer pages and the headline layer of search (decision 17.1).
3. **Derived values** (changes, percentages, transforms) are computed at build time **only from figures whose
   `o.reader.usableInDerived` is true**; a derived value from anything else is itself held back with the same reason
   (DESIGN.md 6.1 "Gaps travel"). Each carries its formula and inputs one tap away.
4. **Every digit on a page is accounted for** (`scripts/check-build.mjs`): a value is `<V o={...}/>` (a link to its
   receipt; `short` for the headline form, `sheet` to open the one-tap sheet), a count is `<Count>`, anything else
   with digits is `<Num kind=...>`. A derived value needs a new annotation **and** a check that recomputes it. If you
   add a kind of digit, add the check for it in a new file `site/scripts/checks/<your-area>-*.mjs` (a default-exported
   function; see `catalogue-json.mjs`). JSON that the browser draws numbers from is checked the same way.
5. **Never weaken, skip or delete a check or test to get a pass.** If a check fails and you cannot fix the cause,
   leave it failing and say so in your report.
6. Receipts and caveats are never dropped: a page may move them, never remove them.

## How the code is organised now (stage 1 is done)

- `src/lib/adapter/contract.ts`: the contract. `Observation` now has `kind` (KindKey), `reader` (ReaderStatus:
  `key`, `word`, `reason`, `showsValue`, `usableInDerived`), `printed_text`, `signoff`.
- `src/lib/words.ts`: reader status words (`READER_STATUS`), kinds of figure (`KIND`, `STAGE_KINDS`), and
  `shortScale()` for headlines.
- `src/lib/status.ts`: how a status looks (`statusOf`, `visualKey`); `components/ui/Status.tsx` draws it.
- `components/ui/Num.tsx`: `V` (value link, with `short`, `sheet`, candidate mark), `Count`, `Num`.
- `components/ui/Link.tsx`: the only link component (never prefetches). Do not import `next/link`.
- `components/actions/Actions.tsx`: Download / Cite / Compare / Share buttons and `ActionBar`, stubs with fixed
  props; `components/evidence/EvidenceSheet.tsx`: the one-tap sheet, a stub. Their owners replace the bodies; other
  agents only place them.
- Styles: put yours in `src/styles/<area>.css` (already imported by the layout). Leave `globals.css` alone unless a
  rule there is wrong for your area; then change only that rule.
- Pages are static (prerendered). View state lives in the URL query and is applied in the browser.

## Stay in your lane

Edit only the files your task lists, plus new files you create. If you must change a shared file (`layout.tsx`,
`data.ts`, `Num.tsx`, `check-build.mjs`, `globals.css`, `prebuild.mjs`), keep the change small and say exactly what
and why in your report; the integrator merges five branches.

## Budgets (DESIGN.md 14.1)

Series page ≤ 200 KB compressed first load; receipt ≤ 250 KB with the crop ≤ 40 KB; catalogue and search results
≤ 100 KB of HTML and ≤ 1,500 elements; JavaScript ≤ 100 KB on any page and none needed to read a number, chart, table
or get a CSV; no new web fonts; no client chart library; no new runtime dependency over 15 KB compressed.

## Working

- Your worktree has its own `site/.next`. `site/node_modules` is shared (a junction): **do not run `npm install`**.
  If you truly need a package, say so in your report instead.
- Iterate with `npx next dev -p <your port>` from `site/` and the pages you are changing.
- Before you finish, all of these must pass in your worktree, in this order: `npm run lint`,
  `npm run test:contract`, `npm run build` (about 10 minutes; run it at most twice), `node scripts/check-build.mjs`.
- Look at your pages in a real browser (Playwright from `site/node_modules`) at **360 px** and **1280 px**, including
  with JavaScript off for anything that must work without it. Save screenshots (PNG, ≤ 6,000 px high) to
  `docs/reports/qa/redesign/<your-area>/`.
- Commit to your own branch in small commits with messages that say why. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push your branch. **Never** push to
  `proto/redesign-2026-11` or `main`, never merge, never touch Vercel settings or Ahmad's repository.

## Your report (your final message)

1. What you built, page by page, and how a reader uses it.
2. Files changed, with any shared file called out.
3. Every judgement call, with the reason.
4. What is unfinished or failing, with the exact output.
5. The output lines of lint, contract tests, build and check-build.
6. Screenshot paths.
