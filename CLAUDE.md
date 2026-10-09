# CLAUDE.md

All project rules, context and conventions are in `AGENTS.md`, shared with every other coding agent on this repo. Follow it exactly.

@AGENTS.md

## Claude Code specifics

- Read `AGENTS.md` sections 3, 4 and 7 before any change to extraction, normalisation, checks or publishing.
- Don't run unattended or scheduled jobs from this session. Anything that should run on a schedule (crawlers, monitors) is built to run on API keys.
- If a task would need an LLM to produce or judge a data value, stop and say so instead of finding a workaround.
- This repo's PRs are reviewed by a teammate using a different agent. Write PR descriptions that a reviewer with no context can follow: what changed, why, how it was verified.
