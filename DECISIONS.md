# Decisions

One line per decision that sets direction, with the reason. Newest at the bottom. Change a decision by adding a new line that supersedes the old one; don't edit history.

| Date | Decision | Why |
|---|---|---|
| 2026-10-09 | Audience is researchers first; the same pages serve citizens and journalists | One product done well beats two half-built ones; researchers set the reliability bar |
| 2026-10-09 | Published as a LUMS Econ department research bank; sir's OK before the LUMS name or logo goes public | Institutional name on the line |
| 2026-10-09 | Reliability bar: every published value passes deterministic checks; failures show as labelled gaps; measured error rate published | A wrong number under the LUMS name is worse than a missing one |
| 2026-10-09 | No LLM writes or judges a published value | LLMs can fabricate plausible numbers; extraction tools only misread, which checks can catch |
| 2026-10-09 | Docling is the primary PDF extractor; pdfplumber and Camelot as routed second readers; GMFT coverage-only; MinerU excluded | August 2026 tool tests (`EXTRACTION_TOOLSTACK_REPORT.md`, `FINAL_TOOL_RECOMMENDATION.md`) |
| 2026-10-09 | Arslan's pdftotext pipeline and ABS dataset are used only for comparison | Audit found structural defects (dropped Health lines, merged rows, wrong page numbers) |
| 2026-10-09 | Data model: Source → Series → Observation → Check → Release, one schema for PDFs and spreadsheets | Supports breadth (new data types plug in) and depth (hierarchy, geography, vintage) without rebuilds |
| 2026-10-09 | Hosting on Vercel; the site reads frozen release files, not the live database; Supabase `datalab` is the working database | Citations must point at fixed data; static hosting is simple and durable |
| 2026-10-09 | DOI per frozen release (Zenodo) | Citations survive any change of domain or host |
| 2026-10-09 | Licence: CC BY 4.0 for data, MIT for code | Open reuse with attribution |
| 2026-10-09 | First prototype: federal ABS, CPI, LFS, 5 years each | Three different data kinds, three different checking styles; they combine into one demo (real health spending vs jobs) |
| 2026-10-09 | Source files are never committed; referenced by manifest with SHA-256 | Repo stays small; sources stay read-only and verifiable |
| 2026-10-09 | Unattended jobs run on API keys, not subscriptions | Subscription terms cover interactive use only |
