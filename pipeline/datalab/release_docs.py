"""Human-readable files that travel with a release: dataset card, reproduction steps, changelog, errata."""
from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

from . import config
from .schema import Observation, Release, Series


def _pct(x: float | None) -> str:
    return "n/a" if x is None else f"{x * 100:.1f}%"


def write_release_docs(out: Path, release: Release, sources: list[dict[str, Any]], coverage: list[dict[str, Any]],
                       observations: list[Observation], series: dict[str, Series]) -> None:
    v = release.version
    lines = [f"# Dataset card: LUMS DataLab Portal {v}", "",
             f"Built {release.created_at} from commit `{release.git_commit[:12]}`. Label: **{release.label}**. DOI: none.",
             "", "> Prototype. Not for citation in publications yet. Every published value passed deterministic checks;",
             "> the absolute error rate has not been measured yet (it needs the human-labelled gold set).", "",
             "## Scope", ""]
    lines += ["| Data type | State | Sources | Published values | Withheld / gaps |", "|---|---|---|---|---|"]
    for ds, gate in release.dataset_status.items():
        by = release.counts["observations_by_dataset"].get(ds, {})
        gaps = ", ".join(f"{k.replace('gap:', '')}: {n}" for k, n in by.items() if k != "published") or "none"
        n_sources = len({s["source_id"] for s in sources if s["source_id"] in release.scope["sources"] and s["source_id"].startswith(ds[:3])})
        lines.append(f"| {gate.get('name', ds)} | {gate['state']} | {n_sources} | {by.get('published', 0)} | {gaps} |")
    lines += ["", "A data type marked *coming* is below a frozen threshold or not processed yet; none of its values are published.", ""]
    for ds, gate in release.dataset_status.items():
        if gate.get("reasons"):
            lines.append(f"- {gate.get('name', ds)}: {'; '.join(gate['reasons'])}")
    lines += ["", "## Status mix (internal tiers)", "",
              "A = arithmetic check passed and a second official printing agrees. B = one of the two. "
              "C = no check covers it (withheld). D = failed or flagged (withheld).", "",
              "| Data type | A | B | C | D |", "|---|---|---|---|---|"]
    for ds in release.dataset_status:
        t = release.counts["tiers_by_dataset"].get(ds, {})
        lines.append(f"| {ds} | {t.get('A', 0)} | {t.get('B', 0)} | {t.get('C', 0)} | {t.get('D', 0)} |")
    lines += ["", "## Coverage: how much of each printed table was captured", "",
              "Measured by code: numbers found in the PDF text layer inside the table region versus numbers the extractor "
              "emitted for that table. This says nothing about whether the captured numbers are right; see the next section.", "",
              "| Source | Page | Printed numbers | Captured | Coverage | Coverage, full-width row band |", "|---|---|---|---|---|---|"]
    for c in coverage:
        lines.append(f"| {c['source_id']} | {c['page']} | {c['printed_numeric_tokens']} | {c['matched']} | "
                     f"{_pct(c['coverage'])} | {_pct(c.get('coverage_row_band'))} |")
    lines += ["", "## Accuracy evidence: deterministic checks", "",
              "| Data type | Passed exactly | Passed within rounding | Failed | Disputed | Not evaluable | Pass rate of evaluable checks | Cross-edition agreement | Disputed pairs |",
              "|---|---|---|---|---|---|---|---|---|"]
    for ds, gate in release.dataset_status.items():
        r = gate.get("check_pass_rate")
        if not r:
            continue
        x = gate.get("cross_edition_agreement") or {}
        dsp = gate.get("disputes") or {}
        lines.append(f"| {ds} | {r['pass']} | {r['pass_within_rounding']} | {r['fail']} | {r.get('disputed', 0)} | {r['not_evaluable']} | "
                     f"{_pct(r['pass_rate'])} | {_pct(x.get('pass_rate'))} ({x.get('pass', 0) + x.get('pass_within_rounding', 0)} of "
                     f"{x.get('evaluable', 0)} pairs) | {dsp.get('disputed', 0)} of {dsp.get('cross_edition_pairs', 0)} pairs "
                     f"({_pct(dsp.get('disputed_share'))}) |")
    lines += ["",
              "**Disputed** means two official documents print different figures for the same thing and each printing adds up "
              "in its own table (a restatement by the publisher). A disputed figure is not published as checked: the site shows "
              "both printings and no value. A differing pair that does not meet those conditions is a failure and its value is withheld.", "",
              "**Deviation (decision D26, definition changed after results existed):** cross-edition agreement is "
              "agree / (agree + fail), with disputed pairs counted separately in the last column; the frozen 98% applies to that "
              "ratio. In the pass rate of evaluable checks a disputed pair counts as not passed. A data type whose disputed pairs "
              "exceed 5% of its cross-edition pairs is not published. The thresholds file is unchanged."]
    for ds, gate in release.dataset_status.items():
        away = (gate.get("disputes") or {}).get("kept_as_fail") or {}
        if away:
            lines.append(f"- {ds}: differing pairs kept as failures: " + "; ".join(f"{k}: {n}" for k, n in away.items()) + ".")
    lines += ["", "**Measured error rate: pending gold-set labelling.** The gold-set kit is in `gold/`; until two humans "
              "have labelled it, no absolute error rate is claimed.", "",
              "## Known limitations", "",
              "- Budget figures are budget estimates (BE) and revised estimates (RE) only. The Annual Budget Statement prints no actuals.",
              "- The ten function lines are current expenditure on revenue account. Development spending by function is not in this table.",
              "- Federal figures before and after 2011-12 are not comparable (18th Amendment devolution); the break is marked, never smoothed.",
              "- Source PDFs are not hosted by this project; receipts link to the official URL and a Wayback snapshot where one exists.",
              "- Series definitions are drafts awaiting human review.", "",
              "## Tools", "", "| Tool | Version |", "|---|---|"]
    lines += [f"| {k} | {val} |" for k, val in release.tool_versions.items()]
    lines += ["", f"Thresholds file SHA-256: `{release.thresholds_sha256}` (frozen before any extraction run).", ""]
    config.write_text(out / "dataset_card.md", "\n".join(lines))

    repro = [f"# How to reproduce {v}", "",
             "From a clean clone, on any machine with Python 3.12 and network access. Commands are for PowerShell; on",
             "Linux or macOS replace `pipeline\\.venv\\Scripts\\python` with `pipeline/.venv/bin/python`.", "",
             "```powershell", "py -3.12 -m venv pipeline\\.venv",
             "pipeline\\.venv\\Scripts\\python -m pip install -r pipeline\\requirements.lock",
             "pipeline\\.venv\\Scripts\\python -m pip install -e pipeline --no-deps",
             "copy .env.example .env      # then set SOURCES_DIR to an empty folder outside the repo",
             "pipeline\\.venv\\Scripts\\python -m datalab fetch                 # network: downloads every source in sources/manifest.csv and verifies SHA-256",
             "pipeline\\.venv\\Scripts\\python -m datalab all --dataset abs     # fresh Docling runs, validation, checks (CPU: about 5 minutes per document)",
             "pipeline\\.venv\\Scripts\\python -m datalab all --dataset cpi     # if CPI is in this release",
             "pipeline\\.venv\\Scripts\\python -m datalab all --dataset lfs     # if LFS is in this release",
             f"pipeline\\.venv\\Scripts\\python -m datalab release --version {v}",
             f"pipeline\\.venv\\Scripts\\python -m datalab check-release releases/{v}", "```", "",
             "Steps that need the network: `pip install`, `datalab fetch`, and the first Docling run (it downloads its models once).",
             "`RA_SHIP_DIR` is optional: it is only used to compare downloads with the previous RAs' archive copies.", "",
             "`datalab fetch` refuses a file whose SHA-256 differs from the manifest. If an official file has been reissued,",
             "it falls back to the recorded Wayback snapshot; if that also differs, the release cannot be reproduced bit for bit",
             "and the difference should be recorded as an erratum.", "",
             "Re-extraction is deterministic for a fixed Docling version and configuration; each run records both. A fresh run",
             "gets a new run id (runs are never overwritten), so `cells.json` differs only in `run_id` if nothing else changed.", "",
             "## Expected input hashes", "", "| Source | Pages | Bytes | SHA-256 | Official URL |", "|---|---|---|---|---|"]
    for s in sources:
        repro.append(f"| {s['source_id']} | {s['page_count']} | {s['size_bytes']} | `{s['sha256']}` | {s['file_url'] or ''} |")
    repro += ["", "## Extraction configuration", "",
              f"Config SHA-256 values used by the runs in this release: {', '.join('`' + h + '`' for h in release.extract_config_sha256s)}.",
              "The full configuration of every run is in `runs/<run_id>.manifest.json`.", ""]
    config.write_text(out / "HOW_TO_REPRODUCE.md", "\n".join(repro))

    published = sum(1 for o in observations if o.published)
    gaps = Counter(o.gap_kind for o in observations if not o.published)
    changelog = ["# Changelog", "", f"## {v} ({release.created_at[:10]})", "",
                 "First prototype release. Nothing was published before this, so there are no changes to earlier values.",
                 "This folder is rebuilt in place until the first public deployment or DOI (decision D29); from then on every "
                 "change is a new version.", "",
                 f"- {published} published values across: {', '.join(release.scope['datasets']) or 'none'}.",
                 f"- {sum(gaps.values())} labelled gaps: " + ", ".join(f"{k}: {n}" for k, n in sorted(gaps.items(), key=lambda kv: str(kv[0]))) + ".",
                 "- Prototype label, no DOI.", ""]
    config.write_text(out / "CHANGELOG.md", "\n".join(changelog))
    errata_path = out / "ERRATA.md"
    if not errata_path.exists():
        config.write_text(errata_path, "\n".join([
            "# Errata", "",
            "Corrections to published values are listed here, newest first. A published value is never changed silently:",
            "a correction creates a new release and an entry on this page naming the observation, the old value, the new",
            "value and the reason.", "", f"## {v}", "", "No errata. This is the first release.", ""]))
