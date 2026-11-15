# Round 2, LOOK foundation

Branch `proto/r2-look` (last commit `ef81cbb`), 2026-11-15, unattended. Presentation only: no adapter, format,
editorial, derive or check code touched. (Saved by the lead from the agent's hand-back; subagents could not write
report files.)

1. **Tokens.** The four brand colours are defined once in `tokens.css`; pages use semantic names only.
   Navy `#002581`: `--header-bg`, `--footer-bg`, `--h1`, `--num`, `--chip-active-bg`, `--tab-active-rule`,
   `--link-hover`, `--pill-ink`. LUMS blue `#2E3192`: `--link`, `--btn-bg`, `--focus`, `--select-rule`,
   `--evidence-box`, `--chart-be`, `--cat-a`. Gold `#FDB913` (never text): `--header-rule`, `--focus-on-dark`,
   `--chip-active-edge`, `--answer-edge`, `--pill-bg`. Amber `#B07C00` (a line, never text): `--chart-re`, `--cat-b`.
   Page `#F4F5F9`, card `#FFF`, ink `#14161C` / `#3B4050` / `#5F6577`, answer wash `#FFF2CC`.
   Status colours retuned cooler (checked `#1F6A4A`, disputed `#9A4F00`, gap `#646A7A`, withheld `#6A4B3A`); shapes
   unchanged. Compare palette `#2E3192`, `#B07C00`, `#1A7FC4`, `#C2410C`, `#0E7C5A`, `#D14D8A`. Body 16 px,
   metadata 13 px, h1 26-32 px, headline figure 44-56 px. All teal removed.
2. **Fonts.** Noto Sans variable (wght 400-700) 18,988 B + Noto Sans Display Bold 10,848 B = **29.1 KB** (round 1:
   28 KB). From google/fonts (OFL), subset by `site/scripts/subset-fonts.py` (byte-identical output). Kept kern,
   liga, tnum, pnum, case, locl; tabular figures verified after subsetting. No serif anywhere. Noto Sans has no arrow
   glyphs, so arrows are SVG (`Arrow`); Noto Sans Display has no minus sign, so a minus falls back to Noto Sans Bold.
3. **Header and footer.** Navy bar, text wordmark, white search, 3 px gold rule, about 56 px tall; one row at 360 px.
   Prototype notice is a slim grey line above the bar. Footer navy.
4. **Components** (`site/src/components/ui/`, styles in `base.css`; specimen at `/demo/look`): Card, Panel,
   ButtonLink, Chips, SegTabs, FactPills, SeriesId, NumberBlock, Arrow, PrintedPagePill, the CSS receipt mark on
   every `a[data-v]` (no layout shift), restyled Spark.
5. **Contrast.** `npm run test:contrast`: 106/106 (90 colour pairs, a guard that gold on white stays below 4.5:1,
   15 compare-palette pairs). Lowest: amber line on white 3.67:1, control borders on page 3.33:1.

Checks: lint pass; test:contract 40/0; test:search 20/0; test:contrast 106/106; build pass; check-build left to the
lead. Page weight vs round 1: home 207 KB (203), series 229 KB (225), fonts 30 KB (28).

Judgement calls: fonts from google/fonts (fontsource subsets lacked lnum, case, the rupee sign); weight axis cut to
400-700; body text proportional figures, number places tabular; SVG arrows; compare palette searched with LUMS blue
and amber fixed first; chart end labels in ink (amber text would be 3.67:1); underline tabs use a navy rule (gold is
1.6:1 on white); status colours retuned; slim prototype notice; "Prototype" badge hidden under 480 px; `/demo/look`
specimen page added; footer pinned to the window bottom on short pages; top of the spacing scale tightened; `--paper`
tokens renamed to `--page`/`--card`/`--surface-*`.

Not done: home and series headline figures keep round 1's size (page agents restyle them with NumberBlock).
