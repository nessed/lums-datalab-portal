# Home v3 pages set: what the release cannot supply

2026-11-24. Branch `proto/home-v3-pages-2026-11`. Built from the design handoff
"LUMS DataLab home page and inner pages (Home v3 set)". The mockups are pictures
with demo values: no number, date, name, count, article, release row or
correction was copied from them. Every figure on the built pages is read from the
release through `db()` and shown with `V`, `Count`, `Num` or a derived figure
that a plug-in under `site/scripts/checks/` recomputes.

## Built from the release

| Screen | Route | What is real |
|---|---|---|
| Header, footer | every page | Release date and version; the LUMS lockup (logo rights: open) |
| Source Panel | every value link (`data-sheet`) | Value, as printed, document and page, page close-up only where the box is exact, the checks that figure passed (new `checks` field) |
| Home | `/` | Series count, publisher count (`home-publishers`), the six headline figures with chart, table and change, ticker, Labour Force Survey figures by province with a province map, five topics, latest documents, calendar, inflation calculator (June index values), publishers |
| Indicator | `/series/[id]` | Headline, chart and table, by group of goods (CPI general), notes from `topics.json`, about, cite, related |
| Budget line | `/series/[id]` (budget series) | Budget and revised estimates, revised against budget (derived, `home-derived`) |
| Topic | `/topics`, `/topics/[slug]` | Topic list, headline tiles, grouped indicators with filter, next release where the calendar has it, documents |
| Search | `/search` | Results, quick answer, facets with counts from the results (drawn in the browser) |
| Releases | `/releases`, `/calendar` | Upcoming from `calendar.json`, added recently and corrections from the release |
| Library | `/library`, `/library/datasets` | 26 documents, filters, datasets with downloads |
| Receipt | `/o/[id]` | Restyled; evidence logic unchanged |

## Shown as "Coming soon" or "Not yet collected"

| Design slot | Screen | What would fill it |
|---|---|---|
| Today's rates (petrol, diesel, LPG, dollar, gold) | Home | A daily-prices collection (flag `dailyRates`) |
| Insights from the data | Home, Topic | A backend that writes findings and a human review step (flag `insights`) |
| GDP growth, exports, policy rate, rupee per dollar in Key indicators | Home | Left out: not in the release |
| Population, literacy, area, federal transfers by province; Islamabad column | Home: at a glance | Census and provincial data in the release |
| Seven topics (national accounts, trade, money, census, households, energy, agriculture) | Home, Topic | Listed, not linked |
| Release alerts, "Add calendar to Outlook or Google" | Home, Releases | An email provider (flag `releaseAlerts`); no form collects an email |
| Data API, Urdu | Header | `/api` notice page; Urdu hidden (flag `urdu`) |
| Real terms, % of GDP, per person | Budget line | A checked deflator, GDP or population series (flags `realTerms`, `percentOfGdp`, `perPerson`) |
| Actual spending | Budget line | Federal accounts (flag `actualSpending`) |
| Get alerts on a series | Indicator | Same as release alerts |
| Range buttons 1Y/2Y/5Y | Home, Indicator | Monthly CPI issues (the release holds June only) |
| Document cover thumbnails | Home, Library | A first-page render step; the neutral blank cover is shown |
| CSV and Excel per document | Home: latest releases | Only the PDF (or the official page) is offered |
| Topic counts ("{n} series") | Home | A count key for topic series in check-build; the latest period is shown instead |

## Differences from the mockups (judgement calls)

- "Indicators A to Z" points at `/browse` (the existing A to Z list); `/topics` stays "Data by topic".
- "Also show" on the indicator page opens the chart builder with both series rather than adding lines inside the chart.
- Search facet choices are no longer kept in the address; the old `?type=` and filter parameters are ignored (the address still answers).
- The province map is drawn on the server from the GeoJSON (plain Mercator), shaded by rank among the four provinces.

## Open for Ali

- LUMS logo usage rights, and whether the crest or the wordmark alone is used.
- Mirroring government PDFs (plan L1); AI insight backend and review; release-alert provider.
