# Overnight report: first prototype, 2026-10-11

Append-only log of the unattended run that executes
`docs/plans/2026-10-11-overnight-prototype.md`. Times are Pakistan time (PKT).
Pull request: https://github.com/nessed/lums-datalab-portal/pull/1

## M0 Setup (started 01:12)

- Checked out `proto/v0` (already pushed, 3 commits, docs only). PR #1 already existed for this
  branch (opened by the planning session, not a draft). It is reused as the single PR for the
  run: converted to draft and retitled, instead of opening a second PR.
- `.env` created locally (not committed). `SOURCES_DIR` is a new folder `datalab-sources` beside the repo.
- Thresholds written and frozen at 01:20, before any extraction: `thresholds/thresholds.yaml`,
  hash in `thresholds/FROZEN.md`.
- Decisions D1-D24 from the plan appended to `DECISIONS.md` as provisional.
- Python 3.12 venv at `pipeline/.venv`; Docling 2.119.0 install started.
