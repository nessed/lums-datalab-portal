## Purpose

First prototype of the LUMS DataLab Portal, built unattended overnight on 2026-10-11 against a written plan: federal Annual Budget Statement (ABS), CPI and Labour Force Survey, end to end: schema, source verification, extraction, deterministic checks, frozen release, static site with receipts.

- ClickUp task: https://app.clickup.com/t/86eyudf64
- Plan (the mandate for the run): `docs/plans/2026-10-11-overnight-prototype.md`
- Running report: `docs/reports/2026-10-11-overnight-report.md`
- Map of the repo: `STATUS.md`

This PR started life as "Add overnight prototype plan and autonomous-mode rules"; it is reused as the single draft PR for the whole run.

## Ready when (AGENTS.md section 8)

- [ ] Tests pass and CI checks pass
- [ ] No published value was produced or altered by an LLM
- [ ] Provenance fields are filled for every new value
- [ ] Coverage and accuracy are reported separately where relevant
- [ ] No source files, secrets or absolute paths committed
- [ ] `DECISIONS.md` / `AGENTS.md` updated if a rule or decision changed

## Changelog

- **M0 (01:30 PKT)** Thresholds frozen before any run (`thresholds/`), `STATUS.md`, running report, provisional decisions D1-D24 in `DECISIONS.md`.

## How to verify

Filled in as the pipeline lands. See `STATUS.md` "How to run".

## What is provisional

Every decision dated 2026-10-11 in `DECISIONS.md` (D1-D24 and any marked "provisional (unattended, 2026-10-11)"). Ali and Ahmad confirm or overturn.

## What is left

Everything after M0. Updated at each milestone.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
