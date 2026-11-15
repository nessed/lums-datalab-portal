# Round 2, rounding foundation (item 26)

Branch `proto/r2-rounding` (code `23d62a9`), 2026-11-15, unattended. Saved by the lead from the agent's hand-back.
Supersedes round 1 judgement call 15; logged in `DECISIONS.md` as provisional for Ali to confirm.

**The rule** (`roundDerived` / `derivedDisplay` in `site/src/lib/format.ts`, exact BigInt arithmetic): every derived
percentage and percentage-point figure is shown to **one decimal place**; a figure below 1 in size gets **two
decimals**; a non-zero figure that would read 0.00 shows its first significant digit (real shares this small exist:
Rs 1 million of Rs 68,557 million is 0.001%). Halves round away from zero. True minus; plus only on changes. Covers
% changes, percentage-point changes of rates, BE-to-RE revisions, average revisions, shares, indexes, tooltips and
the `views.json` the browser draws. Not covered: printed or stored values (never re-rounded), changes in rupees,
index points or persons (exact), coverage and threshold rates (format fixed by check-build), axis ticks, download
value columns (full precision).

| Place | Before | After |
|---|---|---|
| Home card, health BE 2026-27 on 2025-26 | up 17% | up 17.1% |
| Home/topic card, CPI y/y June 2026 | up 7.84 percentage points | up 7.8 percentage points |
| Answer page, direct taxes BE | up 10% | up 10.3% |
| Receipt versions strip, health 2025-26 BE to RE | +88% | +88.4% |
| Receipt versions strip, capital account 2015-16 | −0.5% | −0.49% |
| Compare % change, recreational services RE 2024-25 (exact −56.25) | −56.2% (floating point) | −56.3% |
| Compare share, education BE 2022-23 | 1.04% | 1.0% |
| Series share, health BE 2026-27 | 0.21% | 0.21% |

Checks: each plug-in keeps its own implementation of the rule. lint and tsc clean; contract 40; search 20;
series-derive 14 (was 11); take-transforms 13 unit tests, 9,939 compare texts recomputed exactly (before: positions
only); build 8,381 pages; check-build OK, 2,996 derived figures recomputed (same as round 1), 172,089 value links.
1,761 of 3,002 derived texts changed between builds.

Judgement calls: first significant digit below 0.005; zero reads 0.00 with no sign; "below 1" decided on the
2-decimal result; indexes follow the rule; changes in units stay exact; compare chart positions and CSV stay
unrounded; the unused `dp` field dropped from `views.json`; one footnote sentence on the series page states the rule.
