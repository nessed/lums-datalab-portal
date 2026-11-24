# What data the site shows, by kind

Written 2026-11-24 at Ali's request, as a companion to `docs/SITE_FOR_THE_BRIDGE.md`. Every slot on the site that
shows or will show data, grouped by what kind of data it is, where it comes from today, and what in Ahmad's golden
repository would fill it.

**How sure is the golden column?** The dataset names come from his agent's answers about `golden-2026.11.23` (see
`docs/reports/2026-11-24-golden-data-backend-fit.md`); the full catalogue (113 rows, 78 golden-layer) has not been
read from this session. "Signed" means signed off in his `registry/signoffs.csv` (only 4 are); everything else is a
candidate. A match is by subject, not yet checked figure by figure.

Today every released figure is a **demo value** (D-BE-1).

---

## A. Printed figures from a release (the core)

Figures read off a government document, each with a page and a receipt (`/o/<id>`). Shown with a reader status
(checked, held back, not printed ...). This is the only kind of number the site shows without recomputing it.

### A1. Budget figures (federal)

- **Nature:** yearly, by fiscal year; each figure is a *budget estimate* or a *revised estimate*, and the same figure
  is printed again in the next year's book (two printings, told apart by the document). Rupees, Rs million in print.
- **Today (demo):** Annual Budget Statement, 9 editions: Summary of Expenditure (totals, current, development, current
  spending by function), function-wise detail tables, Summary of Receipts. Ids `fed.exp.*`, `fed.rev.*`.
- **Where on the site:** topics `spending` and `revenue`; home headline cards (total spending, health, tax revenue),
  ticker (spending, tax, defence, health, provinces' share), featured chart; budget line page; `/compare/[category]`
  (education, health, police, development); `/guides/revised-estimate`; questions `federal-*`, `provincial-share`,
  `direct-and-indirect-taxes`; topic "How much do budget estimates change?" blocks.
- **Golden:** `abs_federal_functional` (**signed**, 17 editions, all four account parts by function and sub-function),
  `abs_federal_receipts`, `abs_federal_economic`, `abs_schedule_i`, `abs_capital_expenditure`,
  `abs_external_receipts`, `abs_public_account`, `fed_budget_in_brief`, `fed_receipts_memorandum`, `fed_dfg`
  (Demands for Grants, has **actuals**). Notes: his functional table splits by account (`current_revenue`,
  `current_capital`, `development_revenue`, `development_capital`); our "current spending by function" is his
  `current_revenue` part. Federal ABS rows keep no printed text, so a 0 may be a printed dash (DESIGN.md 17.3).

### A2. Other budget documents (federal, not tables of one year)

- **Nature:** mixed: medium-term projections, tax expenditure estimates, stocks at a date (contingent liabilities),
  fiscal risks, climate and gender tagging printed as sentences.
- **Today:** nothing.
- **Golden:** `abs_medium_term` (kinds `projection`), `abs_tax_expenditure` (`EST`, `REPORT`, Rs billion),
  `abs_contingent_liabilities` (as-at date, no estimate type), `abs_fiscal_risks`, `abs_climate_gender` (`MT`).
  **The contract has no kind for a projection, a stock at a date or a printed sentence yet.**

### A3. Provincial budgets

- **Nature:** like A1, per province, plus **accounts** (`AC`, a past year's provincial accounts, not audited) and
  provisional actuals.
- **Today:** none. Flag `provincialBudgets` off; `/compare/*` shows each province as "Not collected yet"; home
  "Pakistan at a glance" row "Federal transfers" is "Coming soon".
- **Golden:** `kp_abs_summary`, `sindh_abs_summary`, `punjab_budget_summary` (White Papers), `balochistan_budget_summary`,
  `gb_budget_summary` (`BE_Q1`), `kp_dfg`, `kp_white_paper` (`AC_PROV`).

### A4. Price indices (CPI)

- **Nature:** monthly; index level on a base year, change over a year, change over a month, basket weights; national,
  urban, rural; 12 groups. **Two base years never joined** (2007-08 and 2015-16).
- **Today (demo):** June issues only (2016, 2018, 2019, 2021, 2023 to 2026). Ids `cpi.*`.
- **Where on the site:** topic `prices`; home headline "Inflation", ticker (inflation, food, towns, villages),
  featured chart; Indicator page CPI breakdown (`Indicator.tsx`); **inflation calculator** (index levels);
  questions `inflation-now`, `food-inflation`, `inflation-towns-villages`, `consumer-price-index`, `food-weight`.
  Flag `monthlyData` ("Every month of CPI") off.
- **Golden:** `sbp_monthly` (from 63 PBS Monthly Reviews, 2016-06 to 2026-09, `base` and `series` columns: this
  would switch `monthlyData` on), `pes_prices_fiscal` (annual CPI, WPI, SPI, GDP deflator from the Economic Survey,
  no source URLs).

### A5. Labour force survey (printed tables)

- **Nature:** one figure per survey round; rates (%) and counts (millions); by sex, area (rural/urban), province.
  Two definitions in 2024-25 (13th and 19th ICLS), never mixed.
- **Today (demo):** 5 reports, national and provincial tables. Ids `lfs.*`.
- **Where on the site:** topics `jobs` and `provinces`; home headline (unemployment, labour force), ticker; **Pakistan
  at a glance** (province table and map, the only provincial data today); questions `unemployment-*`,
  `labour-force-*`, `people-employed`, `women-labour-force-participation`.
- **Golden:** `lfs_printed_tables` (1999-00 to 2024-25 from five report PDFs), `lfs_2024_25_report_tables`. These are
  the same nature as ours.

### A6. Economic Survey tables

- **Nature:** yearly, printed with column flags F / R / P (final, revised, provisional) and part-year columns
  (July-March); some figures change base year (GDP 2005-06 to 2015-16).
- **Today:** only used as a cross-source check (PES 2024-25 Inflation and Labour chapters); never shown.
- **Golden:** `pes_headline_indicators` (growth, % of GDP, current account ...), `pes_gdp_levels` (`base_year`),
  `pes_money_credit`, `pes_trade_payments`, `pes_debt_external`, `pes_agriculture`, `pes_energy_transport`,
  `pes_manufacturing_mining`, `pes_social_sectors`, `pes_prices_fiscal`. Fill the home "Coming soon" topics National
  accounts, Trade, Money and banking, Energy, Agriculture, and flag `percentOfGdp`.

### A7. Other printed statistics

- **Nature:** printed tables, often from Excel (sheet + cell, no page), some district-level.
- **Today:** none. Topic "Census and population" and "Households" are "Coming soon"; glance rows "Population",
  "Literacy rate", "Area" are "Coming soon"; flags `maps`, `districts` off.
- **Golden:** `fbr_yearbook` (tax collection, no estimate type), census (`census_district_population`,
  `census_2017_district_tables`, `census_2017_urban_localities`, `census_2023_district_profile`), economic and
  agricultural census tables, `pds_demographic_indicators`, PBS printed HIES and PSLM tables (`hies_2013_14`,
  `hies_household_budget`, `hies_food_insecurity`, `hies_income_printed`, `hies_printed_tables_2018_2024`,
  `pslm_published_tables`, `pslm_2024_25` ...). **Sheet + cell evidence has no shape in the contract yet.**

## B. Figures computed from microdata (a nature the site has never shown)

- **Nature:** indicators Ahmad computes from PBS survey microdata (weighted), compared with the printed PBS figure
  where one exists. No page: provenance is the microdata file, a method sentence and, where checked, the printed table
  and page. Many cells were never printed by PBS (`unpublished*`).
- **Today:** none. The contract has a `recomputed` evidence shape for this, unused.
- **Golden:** `lfs_indicators`, `pslm_indicators`, `hies_indicators` (**all three signed**), plus `lfs_informality`,
  `lfs_migration`, `lfs_occupation`, `lfs_underemployment`, `lfs_employment_status`, `lfs_education_attainment`,
  `lfs_occupational_injury`, `pslm_*`, `hies_*` topic tables. Would fill "Households", "Literacy rate".
- **Open:** rule 1 of AGENTS.md (file + page + position) does not cover them; their reference figures were transcribed
  by LLM agents (fit report). DESIGN.md 17.8: unprinted cells show as "not checked yet", no number.

## C. Figures the site computes from released figures (derived)

Never stored in a release; computed at build from checked figures only, each recomputed independently by a check
plug-in. They disappear (become gaps) when their inputs are gaps.

| Slot | Inputs | Plug-in |
|---|---|---|
| Change between two years, budget vs revised, "What moved" | A1, A4, A5 | `home-derived`, `series-derived` |
| Inflation calculator (amount x later index / earlier index) | A4 index levels | `calc-inflation` |
| What it costs you, Where Rs 100 goes (Home v2 components, reached from Tools) | A4 weights and changes, A1 shares | `home-costs`, `home-per100` |
| Compare page transforms (index to 100, share) | any | `take-transforms` |
| Stories and the ticker ("latest vs previous") | A1, A4, A5 | `home-stories` |
| Budget credibility (actual or revised against budget) | A1 | not on the site; golden has it as `budget_credibility` (derived) |
| Real terms, % of GDP, per person | A1 + A4 / A6 / census | flags `realTerms`, `percentOfGdp`, `perPerson` off |

## D. Counts about the data

Numbers that describe the release, not the economy: series counts, publisher counts ("N series from N official
publishers"), documents, figures by status, What's new tab counts. Recomputed by `check-build` (`data-count`) and
plug-ins (`home-publishers`, `library-counts`, `find-list`, `whatsnew-entries`). Golden source: `catalogue.json`,
`RELEASE.json`.

## E. Evidence and provenance (per figure)

- **Page close-up and box:** today from our page renders (`pages/<source>/pNNN.png`) and `cell_bbox_norm`. Golden:
  page + bbox in PDF points, **no page images and no page sizes** (DESIGN.md 17.7 asks for proof images).
- **Checks the figure passed** (Source Panel): today from `checks.json`. Golden: per figure only for surveys;
  document datasets keep batch counts and failures only.
- **Citation, release id, document link.**
- **Corrections:** `/releases#corrections`, flag `errataBadges` off. Golden: `reports/errata/errata.csv` (errors in
  the source documents) and per-batch `CHANGELOG.csv` / `changes/*.csv`.

## F. Documents (the Library)

Every source document, with an on-site viewer when the build holds a verified copy. Today 26 files from
`sources/manifest.csv` (one rejected). Golden: per-dataset registries (`abs_pdfs_used.csv`,
`prov_abs_pdfs_used.csv`, `cpi_reviews_used.csv`, `survey_inputs.csv`, `*_inputs.csv`); microdata archives would be
listed, not viewed. Every file both repositories hold is byte-identical (fit report section 1).

## G. Dates

- **Release calendar** (`editorial/calendar.json`: next CPI issues, Budget 2027-28; home "Coming up", `/calendar`,
  What's new "Official release dates"). Typed by people, checked by `home-calendar`, `whatsnew-calendar`.
- **Golden:** the catalogue's `update_schedule` per dataset (crawler schedule, e.g. "annual; every 24 h from 06-01 to
  07-15"). A schedule, not a publication date. Flag `releaseAlerts` off; no form collects an email.

## H. Daily rates (not collected anywhere)

- **Nature:** prices set or announced daily or fortnightly by notice: petrol, high-speed diesel, kerosene, cooking gas
  (LPG), rupee to US dollar (`editorial/daily.json`).
- **Today:** names only. Home "Today's rates" says "Not yet collected"; flag `dailyRates` off.
- **Golden:** **none known.** His SBP rows are monthly; exchange-rate keys appear only in his catalogue as SBP EasyData
  source-layer rows (not queryable). This needs its own source, crawler and check before any number shows; the SBP
  EasyData API needs a key a human must supply (AGENTS.md section 7).

## I. Editorial text (written by people, no numbers)

Titles and summaries (`titles.json`), topics and their definitions, limits and gaps (`topics.json`), questions
(`questions.json`), search synonyms including Urdu transliterations (`synonyms.json`, `concepts.json`), headline and
ticker picks (`headline.json`, `stories.json`), Library names (`library.json`), example searches and compare default
(`editorial.config.json`), guides. All marked provisional. **All picks name demo series ids** and need new ids under
golden (`SITE_FOR_THE_BRIDGE.md` section 8). Checked by `titles`, `home-editorial`, `editorial-plain-words`.

## J. Planned features (`features.config.json`, all off)

| Flag | Kind | What would fill it |
|---|---|---|
| `dailyRates` | H | nothing yet |
| `monthlyData` | A4 | golden `sbp_monthly` |
| `provincialBudgets`, `provincialMap` | A3 | golden provincial budgets |
| `actualSpending` | A1/A3 | golden `fed_dfg` (ACTUAL), provincial `AC` |
| `percentOfGdp`, `realTerms`, `perPerson` | C | A6 GDP levels, A4 deflator, census population |
| `maps`, `districts` | A7 | census district tables |
| `moreDataTypes` | A2, A6, A7, B | the rest of the golden catalogue |
| `insights` | C | nothing yet (editorial) |
| `errataBadges` | E | golden errata and changelogs |
| `releaseAlerts`, `api`, `urdu` | site features | no data dependency |

## K. Topics as shown today

| Topic | State | Kinds |
|---|---|---|
| Prices and inflation | demo | A4 |
| Jobs and labour | demo | A5 |
| Government spending | demo | A1 |
| Government revenue | demo | A1 |
| Provinces | demo (LFS only) | A5, later A3 |
| National accounts | Coming soon | A6 |
| Trade | Coming soon | A6 |
| Money and banking | Coming soon | A6, A4 (SBP) |
| Census and population | Coming soon | A7 |
| Households | Coming soon | A7, B |
| Energy | Coming soon | A6 |
| Agriculture | Coming soon | A6, A7 |

Topics are hard-coded in two places: `editorial/topics.json` (the five live ones) and
`src/components/topic/soon.ts` (`SOON_TOPICS`); the glance rows in `src/components/hub/HomeV4.tsx` (`GLANCE_SOON`).
