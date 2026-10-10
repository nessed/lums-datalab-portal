# LUMS DataLab Portal

An open research bank of Pakistan's economic and fiscal data, built by the DataLab at the LUMS Department of Economics.

> **Mission (draft).** To be the authoritative open record of Pakistan's economic and fiscal data: complete, verified, and traceable to the printed page, so that anyone can find a number, check it, and cite it.

**Status (2026-10-11):** first prototype built on branch `proto/v0` (draft PR #1). A working pipeline, a frozen prototype release under `releases/v0.0.1-prototype/` and a static site under `site/`. See [`STATUS.md`](STATUS.md) for exactly what works, and [`docs/reports/2026-10-11-overnight-report.md`](docs/reports/2026-10-11-overnight-report.md) for how it was built. The release is a prototype: no DOI, error rate not yet measured, not for citation in publications.

---

## What this is

A "World Bank DataBank for Pakistan". Researchers come to one place to find, chart, download and cite Pakistani economic data, instead of digging through hundreds of government PDFs and spreadsheets spread across a dozen websites.

It aims for both:

- **Breadth:** many kinds of data. Federal and provincial budgets, prices, labour, households, national accounts, trade, monetary and external-sector data.
- **Depth:** detail within each kind. Line items and their sub-items, national → province → district, long time series, and the full budget lifecycle (what was budgeted, what was revised, what was actually spent).

## Why it's different

Pakistan's economic data is public but scattered, inconsistently formatted, mostly locked in PDFs, and hard to cite reliably. Existing portals either cover only aggregate macro series (SBP EasyData) or have gone stale (Data4Pakistan stopped at 2018; Open Budgets India went offline in 2026).

This portal's distinguishing feature is **trust you can check**:

- **Every number links to its source.** Click any value and see the original government page with that number boxed.
- **Every number is checked by code before it's published.** Totals must add up, the same figure printed in two editions must agree, and figures must match other official sources. Numbers that fail don't appear.
- **Every number is citable.** Each has a permanent link and a cite button. Each data release has a DOI.
- **Gaps are honest.** Missing data says whether the government didn't publish it or we haven't verified it yet. Every figure says whether it's a budget estimate, a revised estimate, an actual, provisional or rebased.
- **Errors are corrected in public.** Frozen, versioned releases and a public errata page. Old citations keep working.
- **Anyone can rebuild it.** Source files are recorded with URLs and file hashes; the code that turns them into data is open.

Because it carries the LUMS name, reliability comes before speed and before coverage.

## How it works

```
 official sources            processing                     checks                    release                site
 ───────────────     ──────────────────────────     ─────────────────────     ─────────────────     ────────────────
 PDFs, Excel, APIs ─▶ register (hash) ─▶ extract ─▶ structural checks     ─▶ frozen version    ─▶ browse, series,
 from Finance Div,    profile            (Docling   arithmetic identities     + DOI                  receipt pages,
 PBS, SBP, provinces                     for PDFs)  cross-edition / source                         cite, download
                                         normalise  gold-set error rate
```

1. **Schema.** One format for every number: what it measures, its value (as printed and parsed), where it came from (file, page, position on the page, or sheet and cell), and which checks it passed.
2. **Process.** Docling converts PDFs into that format, keeping page numbers and positions. Spreadsheets and API data are read directly.
3. **Check.** Deterministic code (never an LLM) runs arithmetic and consistency checks. Anything that fails is held back.
4. **Cite.** Permanent IDs per number, a DOI per release.
5. **Source snippet.** The site shows the source page crop for any number.
6. **Site.** Static site on Vercel, reading frozen release files.

Data model: **Source → Series → Observation → Check → Release.**

## First prototype (release `v0.0.1-prototype`, 2026-10-11)

| Type | What is in the release | State | Checks |
|---|---|---|---|
| Federal budget (Annual Budget Statement) | 9 editions (2010-11, 2011-12, 2016-17, 2017-18, 2021-22, 2022-23, 2024-25, 2025-26, 2026-27): the Summary of Expenditure. Ten function lines (current expenditure on revenue account), current and development totals, grand total. Budget and revised estimates; the ABS prints no actuals | **Published**: 535 checked values, 2 labelled gaps | Lines sum to printed totals; accounting identities; the same figure in the next edition agrees |
| Consumer Price Index (PBS Monthly Review) | June issues 2023, 2024, 2025, 2026 (base 2015-16): general index, 12 groups and weights; national, urban and rural; month-on-month and year-on-year change | **Published**: 807 checked values. Issues before the 2019 rebasing are labelled gaps (154) | Weights sum to 100; the general index recomputes from groups and weights; % changes recompute; consecutive issues agree |
| Labour Force Survey (PBS annual reports) | 4 reports (2017-18, 2018-19, 2020-21, 2024-25): participation and unemployment rates, labour force and employment counts, employment by industry; by sex and urban/rural | **Coming**: processed and checked, but below the frozen cross-edition threshold, so nothing is published | Shares sum to 100; parts add to totals; rates recompute from counts; the next report's previous-round column agrees |

Numbers above are from `releases/v0.0.1-prototype/release.json`. The error rate is not measured yet (the gold set is unlabelled).

The demo question: *How has federal health spending changed since 2010, and what happened to prices and jobs over the same period?* The demo page answers the part the checked data supports and labels the rest as gaps.

## Roadmap

1. **Prototype:** the three types above, end to end, with source snippets and citations.
2. **v0.1:** pilot on 5 representative documents of each data type, gold set, measured error rates, first DOI release. Data types that meet the reliability thresholds go live; others are shown as "coming".
3. **Breadth:** Economic Survey, provincial budgets, household surveys (HIES, PSLM), national accounts, trade, SBP monetary and external data, actual-spending accounts.
4. **Depth:** all available years, sub-items, provinces and districts.
5. **Maintenance:** crawlers watch official sites for new and changed files; every change ships as a new versioned release.

## Repository layout

```
STATUS.md      the map: what exists, where, in what state. Read it first
AGENTS.md      rules for every agent and human (CLAUDE.md points to it)
DECISIONS.md   one line per decision, with the reason
schema/        JSON Schema for every record type (exported from pipeline/datalab/schema.py)
sources/       plan.yaml (what we intend to use), manifest.csv (what was fetched, with hashes),
               verification/<source_id>.json (how each file was checked). Not the files themselves
specs/         one spec per document type: how to find its table, what the columns mean,
               the label dictionary and the sum rules
thresholds/    publication thresholds, frozen before results were seen
pipeline/      the `datalab` Python package and its tests
gold/          blind gold-set labelling kit (unlabelled until two humans label it)
releases/      frozen, versioned outputs; the site reads only these
site/          the website (Next.js, fully static)
docs/          METHODS.md, SCHEMA.md, plans/, reports/
work/          local processing output (git-ignored)
```

## Quick start

Windows PowerShell, Python 3.12, Node 24.

```powershell
py -3.12 -m venv pipeline\.venv
pipeline\.venv\Scripts\python -m pip install -r pipeline
equirements.lock
pipeline\.venv\Scripts\python -m pip install -e pipeline --no-deps
copy .env.example .env                                   # set SOURCES_DIR to a folder outside the repo
pipeline\.venv\Scripts\python -m datalab fetch          # download every source in the manifest, verify hashes
pipeline\.venv\Scripts\python -m datalab all --dataset abs   # fresh Docling runs, validate, check (about 5 min per document on CPU)
pipeline\.venv\Scripts\python -m datalab release        # write releases/v0.0.1-prototype
pipeline\.venv\Scripts\python -m datalab check-release releases/v0.0.1-prototype
cd pipeline; .venv\Scripts\python -m pytest
```

To only run the tests and the release self-check (no Docling, no PDFs), install
`pipeline/requirements-ci.lock` instead of `requirements.lock`. That is what CI does.

Commands: `register`, `fetch`, `verify`, `profile`, `extract`, `validate`, `build` (normalise, locate,
map, check and status in one pass; `normalise`, `locate`, `map`, `check`, `status`, `coverage` are aliases),
`release` (includes page renders; `render` is an alias), `check-release`, `export-schema`, `gold-sample`,
`gold-score`, `all --dataset <abs|cpi|lfs>`.

The site:

```powershell
cd site
npm ci
npm run build      # reads ../releases/v0.0.1-prototype at build time
npm run start
```

### Deploying on Vercel

Import the repository, set **Root Directory** to `site`, framework **Next.js**, build command
`npm run build`, Node 24, no environment variables. Production branch `main`; `proto/v0` deploys as
a preview. The build reads `../releases/`, which is in the repository, so no storage is needed.

## Getting started

1. Clone the repo and read [`STATUS.md`](STATUS.md).
2. Copy `.env.example` to `.env` and set `SOURCES_DIR` to an empty folder outside the repo; `datalab fetch` fills it.
3. Read [`AGENTS.md`](AGENTS.md). It holds the rules every contributor and every coding agent follows.
4. Record any decision that changes direction in [`DECISIONS.md`](DECISIONS.md).

Source documents are **not** stored in this repo. They're referenced through the manifest and verified by file hash.

## Team

DataLab RAs at the LUMS Department of Economics: Ali and Ahmad. Planning and task tracking happen in ClickUp (DataLab list, task "Citizen-facing portal"). Code and review happen here.

## Licence

- **Data:** CC BY 4.0
- **Code:** MIT

**Disclaimer:** compiled from official government publications. This is not an official statistical release. Where a figure here differs from the printed government document, the government document prevails.
