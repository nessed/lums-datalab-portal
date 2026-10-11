# P10 impact: the member floor (H12)

Rule (confirmed by Ahmad, 2026-10-12): a passed sum is evidence for a member only if the member's absolute value is
larger than the sum's rounding allowance. The allowance is 0.5 x members x the coarsest last printed digit, or the
absolute tolerance the rule states. The sum's target is not held to the floor. Plain sums only.

Measured by `pipeline/scripts/p10_impact.py` on `releases/v0.0.1-prototype`, from the release's own cells and checks.
Nothing was rebuilt; no number in the release changed.

| Data type | Published before | Lose publication | Tier A to B |
|---|---|---|---|
| ABS | 2,845 | 22 | 2 |
| CPI | 1,254 | 0 | 0 |
| LFS | 1,347 | 7 | 2 |
| **Total** | 5,446 | **29** | 4 |

(Counts are observations with a primary cell; the release totals in `STATUS.md` also count derived series.)

Every value lost moves B to C: still printed, now "not yet verified by us" instead of checked.

- ABS (22): small members of the function detail tables, mostly 0 to 2 million rupees. Examples: recreational and
  sporting services in 2020-21 (0.4 and 0.2, the case that raised P10), fire protection 2009-10 (2), housing development
  2009-10 (1), and several 0 values.
- LFS (7): decimal shares and rates of 0.01 to 0.1 inside sums with a 0.01 to 0.1 allowance (female urban and rural
  unemployment 2013-14 and 2018-19, industry shares 2024-25).
- Disputes: one of the 17 disputed figures no longer qualifies (ABS Budget 2021-22 recreational and sporting services,
  check `chk_39e9c4f48d14`: one reading has no sum left that counts as evidence for it). It would become a failed
  cross-edition pair and be withheld. 16 disputed remain.

## Not yet done
- The release has not been rebuilt. `check-release` on it now reports 63 problems (tiers, published flags and the one
  dispute), as expected, because it was built under the old rule. Rebuild with `datalab build` and `datalab release` on a
  machine with `work/`, then check the thresholds again (the 5% disputed guard and the LFS and ABS check pass rates).
- Which of the 29 are probably correct is not known. The floor says the sum cannot tell; it does not say they are wrong.
  The gold set (P7) is what will say.
- The receipt text still lists a sum as evidence for a small member. The site (`site/src/app/o/[id]/page.tsx`) should
  mark these like it marks `credits_members: false`. Not done here.
