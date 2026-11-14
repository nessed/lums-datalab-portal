# Redesign preview build: morning report

Run of 15-16 November 2026, unattended, authorised by Ali. Plan: `docs/plans/2026-11-15-redesign-preview.md`.
Branch `proto/redesign-2026-11`, draft PR #13 (nothing merged to `main`). The brief (`docs/DESIGN.md`, draft PR #12)
is **still a draft**; this build is for judging it.

(Being written during the run. Sections marked "pending" are filled in at the end.)

## Five-minute summary

pending

## Preview link and what to look at first on your phone

pending

## What is built, stage by stage (DESIGN.md 18.1)

| Stage | State | Commit |
|---|---|---|
| 0. Fix what is broken now | built | `13f1261` |
| 1. Adapter and contract tests | built: datalab adapter on, golden adapter built and tested against tag `golden-2026.11.11` but not switched on; 40 contract tests pass | `8c29c9d`, golden merge `1bb7342` |
| 2. Words | pending | |
| 3. Receipt in three depths, one-tap sheet | pending | |
| 4. Series page, Units, touch sheet, phone table | pending | |
| 5. Versions | pending | |
| 6. Search | pending | |
| 7. Home, topics, answer pages | pending | |
| 8. Downloads, citation, links | pending | |
| 9. Compare with a common basis | pending | |
| 10. Performance checks in the build | pending | |

## Judgement calls

| # | Call | Why |
|---|---|---|
| 1 | Build branch is `proto/redesign-2026-11`, not `preview/...` | AGENTS.md section 9 allows unattended work only on a `proto/*` branch with a plan under `docs/plans/` |
| 2 | Stage 0 catalogue: the HTML lists the 79 top-level series; all 925 load as one JSON file (`/catalogue.json`) when the reader filters or taps "Show every series" | Budget of 1,500 elements and 100 KB HTML (14.1); without JavaScript every other series is reached from its parent's page. Every value in the JSON is checked by a new check-build plug-in |
| 3 | Links never prefetch (one `Link` wrapper with prefetch off) | 14.2 rule 1. Hover prefetch was not kept either: on a phone there is no hover, and on desktop a click is fast enough on a static site |
| 4 | The adapter keeps our record field names and adds the contract fields (`kind`, `reader`, `printed_text`, `signoff`) | Every page was written against those names; a golden adapter fills the same shape. The status decision moved from the pages into the adapter |
| 5 | Candidate datasets count as visible in the site and in check-build, always with the "not signed off" words on the value | Decision 17.1 as proposed; our release has none, so nothing visible changes tonight |
| 7 | Source Serif 4 (122 KB) is no longer downloaded; receipt figures and prose use the system serif (Georgia, Noto Serif) | Font budget 40 KB (14.1). No subsetting tool was installed and I did not download one unattended; the brief allows system fonts when the budget cannot be met |
| 8 | Catalogue rows lost their sparklines and the page lost its "By document" tables (documents live on Sources) | 3,032 elements against a budget of 1,500 after stage 0 |
| 9 | Golden adapter: no page size in the tag, so boxes stay unset and figures say the page image is not available ("no-image"), not "none" | "none" would say the figure could not be found on the page, which is untrue |
| 6 | Contract-test fixtures are cut from the real release at test time; two states the release lacks (a candidate dataset, an unknown status) are made by changing one field in a temporary copy | "No data typed in by hand": no fixture value is invented, and nothing in the temporary copy reaches the site |

## Section 17 decisions: built to the brief's proposal, waiting on you

pending

## What failed or is unfinished

pending

## Measurements

pending
