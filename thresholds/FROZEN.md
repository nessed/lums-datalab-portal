# Thresholds are frozen

`thresholds/thresholds.yaml` was written and frozen on 2026-10-11 at 01:13 PKT, before any
extraction run existed (decision D10).

| File | SHA-256 |
|---|---|
| `thresholds/thresholds.yaml` | `85689c5c066fef50c825db8aab5a38595bf1c4d22d4515b7be22bdc5dd13e48b` |

Rules:

- Never edit the thresholds after results have been seen. If a threshold has to change, add a new
  version with a new hash here, keep the old line, and record the reason in `DECISIONS.md`.
- Every release records this hash in `release.json` (`thresholds_sha256`). The release
  self-consistency test fails if they differ.
- `.gitattributes` forces LF line endings, so the hash is the same on every machine.
