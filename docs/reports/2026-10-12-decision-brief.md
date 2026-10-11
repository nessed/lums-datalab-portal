# Decision brief for Ali and Ahmad

Date: 2026-10-12. Purpose: the decisions that block further layer work (P10, P11, P13, P7) and new data (P1 to P3).
Each item: the question, what it changes, a recommendation, and what happens if it is not answered.
Evidence for each is in `STATUS.md` ("Open questions for humans"), `DECISIONS.md` and `docs/OPEN_WORK.md`.
Recommendations are the author's reading of the repo and are not decisions. Nothing here was verified by running the pipeline.

## Answer first (they change what is published)

| # | Question | Changes | Recommendation | If unanswered |
|---|---|---|---|---|
| 1 | **D26** (H1, H15): LFS publishes only because disputed pairs are counted apart from failures, a metric change made after results were seen. Confirm or overturn. | Whether LFS (1,347 values) is published at all. | Confirm, but keep it recorded as a deviation in the dataset card and methods page, and re-check the thresholds after every new edition. Overturning withholds the whole dataset for a rule that is arguably more honest (a restatement is not an arithmetic failure). | LFS stays "provisional"; nothing downstream (gold sample) can be final. |
| 2 | **H12 / P10**: should a passed sum count as evidence for a member smaller than the sum's rounding allowance? Today yes. | Which values keep "checked" (example: ABS 2021-22 p.20, 0.4 and 0.2 on a 2.5 allowance). Count to be reported by P10 before merge. | Adopt the proposal (a sum corroborates only members larger than its allowance). It closes a real hole in the evidence. | P10 cannot start; the gold sample would be redrawn after it. |
| 3 | **Strict rule**: a failed check withholds every figure in it. Visible cost: LFS 2020-21 employed males Pakistan (51.91) withheld because KP is misprinted (6.68 vs 7.68 in 2024-25). | Count of withheld figures; trust story. | Keep the strict rule. Do not let a later printing pick the "bad" figure automatically; at most, add a clearly separate human-resolved tier (tier E exists in AGENTS.md section 6) with the reviewer's reasoning recorded. | Strict rule stays; no change. |
| 4 | **Agreement within 1 unit of the last digit** (17 pairs): require exact equality when precision is equal? | Number of cross-edition agreements; some become disputed. | Keep the frozen tolerance, since changing it after results is itself a deviation like D26. Revisit only for the next release, with the threshold frozen first. | Unchanged. |
| 5 | **ABS dash**: a printed "-" means "not printed as a figure", never zero. Confirm. | Site wording; whether parent totals imply a nil. | Confirm as written. Never read a dash as zero (AGENTS.md rule 10: never guess). | Site keeps current wording. |

## Answer before the gold set (H9)

**Label now on the current release (5,490 values) or once after P1, P2, P10, P13?**
Recommendation: label once, after the layer fixes, so the sample reflects the final published set. Cost: no measured error rate for a few weeks.
Alternative if a number is needed sooner (a demo or grant): label a small pilot (about 100 cells) now, clearly marked as provisional, and do the full ~400 later. P7 redraws the sample either way.

## Smaller, can wait

- **H13** (P12): LFS 19th ICLS table 9.2 prints no unit. Recommendation: no. Do not infer percent from "rate" plus a "(%)" elsewhere; ask PBS or take the figure from the Economic Survey reprint where it exists.
- **H10** (P8): sign off excerpts of Docling output as test fixtures. Recommendation: yes for a few pages, kept small, so regression tests use real failures.
- **H11**: publication dates of source documents for citations. Needs a human lookup; unblocks "(n.d.)".
- **H16**: is `HOW_A_NUMBER_GETS_ON_THE_SITE.md` public or for the team? Recommendation: public (it is the core of the "check it yourself" pitch), after a wording pass.
- **H7**: SBP EasyData API key, and confirm the redistribution terms. Needed for P4.
- **H3, H6, H14**: Vercel project, LUMS name/logo and DOI sign-off, branch protection on `main`, deleting merged `proto/v0*` branches. Branch protection is worth doing now since `AGENTS.md` already forbids direct pushes.

## Needed for the layer plan

- `verify_both_report.txt` (Arsalan Archive, Budget Statements): required for the 56 Rule-5 failure reproduction gate. Ali to supply or point to the path.
- Whether Ali's machine runs the Docling extraction (P1 remaining editions, P2, P3), max two runs at once.
