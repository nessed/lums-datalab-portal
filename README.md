# LUMS DataLab Portal

An open research bank of Pakistan's economic and fiscal data, built by the DataLab at the LUMS Department of Economics.

> **Mission (draft).** To be the authoritative open record of Pakistan's economic and fiscal data: complete, verified, and traceable to the printed page, so that anyone can find a number, check it, and cite it.

**Status (2026-10-09):** planning done. Building the first prototype: federal budget (ABS), CPI and Labour Force Survey, 5 years each.

---

## What this is

A "World Bank DataBank for Pakistan". Researchers come to one place to find, chart, download and cite Pakistani economic data, instead of digging through hundreds of government PDFs and spreadsheets spread across a dozen websites.

It aims for both:

- **Breadth:** many kinds of data. Federal and provincial budgets, prices, labour, households, national accounts, trade, monetary and external-sector data.
- **Depth:** detail within each kind. Line items and their sub-items, national → province → district, long time series, and the full budget lifecycle (what was budgeted, what was revised, what was actually spent).

## Why it's different

Pakistan's economic data is public but scattered, inconsistently formatted, mostly locked in PDFs, and hard to cite reliably. Existing portals either cover only aggregate macro series (SBP EasyData) or have gone stale (Data4Pakistan stopped at 2018; Open Budgets India went offline in 2026).

This portal's distinguishing feature is **trust you can check**:

- **Every number links to its source.** Click any value and see a crop of the original government page with that number boxed.
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

## First prototype

| Type | Years | What | Checks |
|---|---|---|---|
| Federal budget (Annual Budget Statement) | 2010-11, 2016-17, 2021-22, 2024-25, 2025-26 | Expenditure by function (defence, health, education, interest…), budget / revised / actual | Lines sum to the printed total; adjacent editions agree; compared with an existing hand-built ABS dataset |
| Consumer Price Index (PBS) | June of 5 years, spanning the 2019 rebasing | National index, 12 groups, weights | Weights sum to 100; inflation recomputes from the index; compared with SBP |
| Labour Force Survey (PBS) | 5 most recent rounds | Participation, unemployment, employment by sector; by sex and urban/rural | Shares sum to 100%; rates recompute; compared with the Economic Survey |

The demo question: *How has real health spending changed since 2010, and what happened to jobs over the same period?*

## Roadmap

1. **Prototype:** the three types above, end to end, with source snippets and citations.
2. **v0.1:** pilot on 5 representative documents of each data type, gold set, measured error rates, first DOI release. Data types that meet the reliability thresholds go live; others are shown as "coming".
3. **Breadth:** Economic Survey, provincial budgets, household surveys (HIES, PSLM), national accounts, trade, SBP monetary and external data, actual-spending accounts.
4. **Depth:** all available years, sub-items, provinces and districts.
5. **Maintenance:** crawlers watch official sites for new and changed files; every change ships as a new versioned release.

## Repository layout

Planned. Folders are created as work reaches them.

```
schema/        the data format every number follows
sources/       manifest of source files (URL, hash, metadata). Not the files themselves
pipeline/      register → profile → extract → validate → normalise → check → tier → publish
specs/         one spec per document type: where its tables are, units, its own checks
checks/        deterministic check definitions and tests
gold/          hand-labelled cells used to measure the error rate
thresholds/    reliability thresholds, frozen before results are seen
releases/      frozen, versioned outputs
site/          the website
docs/          methods and design notes
work/          local processing output (git-ignored)
```

## Getting started

1. Clone the repo.
2. Copy `.env.example` to `.env` and set `SOURCES_DIR` to where the source documents live on your machine.
3. Read [`AGENTS.md`](AGENTS.md). It holds the rules every contributor and every coding agent follows.
4. Record any decision that changes direction in [`DECISIONS.md`](DECISIONS.md).

Source documents are **not** stored in this repo. They're referenced through the manifest and verified by file hash.

## Team

DataLab RAs at the LUMS Department of Economics: Ali and Ahmad. Planning and task tracking happen in ClickUp (DataLab list, task "Citizen-facing portal"). Code and review happen here.

## Licence

- **Data:** CC BY 4.0
- **Code:** MIT

**Disclaimer:** compiled from official government publications. This is not an official statistical release. Where a figure here differs from the printed government document, the government document prevails.
