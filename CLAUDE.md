# CLAUDE.md

All project rules, context and conventions are in `AGENTS.md`, shared with every other coding agent on this repo. Follow it exactly.

@AGENTS.md

## Claude Code specifics

- Read `STATUS.md` first if it exists: it is the map of what is where and what state things are in. Keep it current in every PR.
- Read `AGENTS.md` sections 3, 4 and 7 before any change to extraction, normalisation, checks or publishing.
- Don't set up scheduled jobs (crawlers, monitors) from an interactive session; those are built to run on API keys. A human-authorised unattended build session is different and is governed by `AGENTS.md` section 9 ("Autonomous mode"). The current one is `docs/plans/2026-10-12-continuation.md` (it continues `docs/plans/2026-10-11-overnight-prototype.md`).
- If a task would need an LLM to produce or judge a data value, stop and say so instead of finding a workaround.
- This repo's PRs are reviewed by a teammate using a different agent. Write PR descriptions that a reviewer with no context can follow: what changed, why, how it was verified.
