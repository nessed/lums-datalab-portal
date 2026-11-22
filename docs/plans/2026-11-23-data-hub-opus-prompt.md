# Prompt for the agent that runs the data-hub plan

Paste everything below the line into a new session opened in
`C:\Users\Ali\Desktop\Projects\Code\lums-datalab-portal`.

---

I'm Ali, one of the two RAs on the LUMS DataLab Portal (this repo; the site is in `site/`, live at
https://lums-datalab-portal.vercel.app/). I'm authorising you to run `docs/plans/2026-11-23-data-hub.md` as an
unattended run under AGENTS.md section 9. Read that plan first, then `AGENTS.md` (all of it),
`docs/plans/2026-11-15-agent-brief.md` ("How the code is organised" and "Rules that never bend") and
`docs/DESIGN.md` sections 5, 6, 9, 15 and 16.

**The problem.** The site is correct but it reads like an index of what our pipeline extracted. I want it to read as
the place to see, read and download Pakistan's official economic data. A visitor who knows nothing about us should
land on a chart, a moving ticker and a handful of key numbers; should be able to open any of our source documents in
a proper PDF viewer on the site; and should be able to preview and download any dataset. Today the first screen is
about 250 words at one volume, the site keeps explaining its own checking, and the menu words ("Topics", "Sources",
"Annual Budget Statement", "BE", "RE") mean nothing to a visitor. The plan says what replaces each of these.

**What stays fixed.** The numbers are right and the receipt behind every number works. Don't touch either. This is
front-end work only: Ahmad is building the bridge between his data and this front end, so read data only through
`db()`, and when a page needs something new, add it to `site/src/lib/adapter/contract.ts` and fill it in the datalab
adapter so his bridge can fill the same shape. No changes to `pipeline/`, `releases/`, `sources/`, `schema/`,
Ahmad's repository, production, or the Vercel project settings.

**Rules that don't bend** (the plan's section 10 has the full list):
- Every number on a page comes from the frozen release and is shown with `V`, `Count` or `Num`. Nothing typed,
  invented or sampled. A figure that hasn't passed its checks shows no number anywhere.
- Don't edit `site/scripts/check-build.mjs`. A new derived figure (ticker, stories, rankings, library counts) gets
  its own plug-in in `site/scripts/checks/` that recomputes it from the release. Never weaken, skip or delete a
  check or test to get a pass; if one fails and you can't fix the cause, leave it failing and tell me.
- Compare like with like: a budget estimate only against a budget estimate, and say so in four words or fewer.
- No address that works today may stop working.
- Editorial files (`library.json`, `stories.json`) carry no digits and are marked draft for me to confirm.

**How to work.**
- Branch `proto/hub-2026-11` off `main`, a draft PR against `main`, never push to `main`. First commit: the plan and
  this prompt (both are untracked in the working tree now), the `DECISIONS.md` entries the plan lists as my
  overrides, and the "Current authorised run" line in AGENTS.md section 9.
- Follow the plan's five stages in order. Push after each one with lint, the tests and the number audit passing.
  Run the full `check-build` once, at the end.
- Lead it yourself. At most two helper agents, only for stages 1 and 2 after stage 0 is pushed. No tester or
  reviewer agents and one fix round: I'll read the preview myself. Earlier runs spent too long on parallel agents
  and repeated verification, and I had to cut them short.
- Desktop first (1440 px). On a 360 px phone the pages only need to work without sideways scrolling.
- A build takes about ten minutes and the first `check-build` after it 20 to 40. Develop on `npx next dev` and
  build once per stage. Stop any `next start` before rebuilding or it serves stale CSS.
- Set `SOURCES_DIR` from the repo's `.env` for the Library's file step; the PDFs are on this machine. For the
  viewer, read the installed `pdfjs-dist` package's own examples and types instead of working from memory, since
  its API changes between versions. For the archive addresses, reuse what `datalab fetch` in `pipeline/` already
  does.
- I won't be answering questions. For anything outside AGENTS.md sections 3 and 4, take the smallest reversible
  option, log it in `DECISIONS.md` as "provisional (unattended, 2026-11-23)" and keep going. Three calls are mine
  and have defaults in the plan's section 7.3 (L1 mirroring the PDFs, L2 the wider corpus, L3 documents with no
  data): build to the defaults and list them as open. If the file step can't get a verified copy of a document,
  show it with its official link and no viewer; don't commit PDFs to git.
- The font is my call, by eye: build the `/demo/type` page the plan describes and leave Noto Sans as the default.

**Done** is the plan's section 12. Finish with `docs/reports/2026-11-23-data-hub-report.md` and an updated
`STATUS.md`, then send me a final message that leads with the preview link and what changed for a visitor, then
gives the check results with their numbers, every judgement call you made, anything that failed or was left undone,
and the list of fields the front end now expects from Ahmad's bridge. Plain words; say what you didn't verify.
