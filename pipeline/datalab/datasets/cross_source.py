"""Cross-source checks: a figure we hold against another official publication.

Rules (AGENTS.md sections 3, 4, 6):
- a cross-source file never supplies a published value; it only produces `cross_source` check
  records against cells we already hold;
- only like is compared with like: the other publication's own descriptive text must establish
  the same concept, period and unit. If it does not, nothing is compared and the reason is recorded;
- every figure is read by `normalise.parse_printed`; a disagreement is a recorded fail.

SBP EasyData (a CSV from a data service, no pages): provenance is the request URL plus the series
key and the row of the file, instead of page plus box.
"""
from __future__ import annotations

import csv
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from .. import config
from ..normalise import parse_printed
from ..schema import Cell, Check, Source


# ----------------------------------------------------------------------------- SBP EasyData

def read_easydata_series(path: Path, cfg: dict[str, Any]) -> dict[str, Any]:
    """Rows of one EasyData series, with where each came from.

    Returns {"problems": [...], "rows": {period: {value_raw, row, observation_date, series_key}},
    "description": {...}}. `problems` is non-empty when the file's own descriptive columns do not
    establish the series the spec expects (dataset name with its base year, series name, unit) or
    when a month is given twice with different text: then nothing may be compared.
    Row numbers count the header as row 1, as a spreadsheet shows them.
    """
    problems: list[str] = []
    rows: dict[str, dict[str, Any]] = {}
    seen: dict[str, set[str]] = {"Dataset": set(), "Series": set(), "Unit": set()}
    with open(path, encoding="utf-8-sig", newline="") as fh:
        for number, row in enumerate(csv.DictReader(fh), start=2):
            if (row.get("Series Key") or "").strip() != cfg["series_key"]:
                continue
            for column in seen:
                seen[column].add((row.get(column) or "").strip())
            try:
                period = datetime.strptime((row.get("Observation Date") or "").strip(), "%d-%b-%Y").strftime("%Y-%m")
            except ValueError:
                problems.append(f"row {number}: the observation date is not a date")
                continue
            raw = (row.get("Observation Value") or "").strip()
            if period in rows and rows[period]["value_raw"] != raw:
                problems.append(f"{period} is given twice with different figures (rows {rows[period]['row']} and {number})")
                continue
            rows.setdefault(period, {"value_raw": raw, "row": number, "series_key": cfg["series_key"],
                                     "observation_date": (row.get("Observation Date") or "").strip()})
    if not rows:
        problems.append(f"the file holds no row of series {cfg['series_key']}")
    for column, key in (("Dataset", "dataset_pattern"), ("Series", "series_name_pattern"), ("Unit", "unit_pattern")):
        bad = sorted(v for v in seen[column] if not re.search(cfg[key], v))
        if bad:
            problems.append(f"the file's '{column}' column says {bad}, which does not establish the series "
                            f"the check is defined for ({cfg[key]})")
    return {"problems": problems, "rows": rows, "description": {k: sorted(v) for k, v in seen.items()}}


def sbp_cpi_checks(cells: list[Cell], manifest: list[Source], cfg: dict[str, Any], titles: dict[str, str],
                   sources_dir: Path | None = None, verification_dir: Path | None = None) -> tuple[list[Check], dict[str, Any]]:
    """PBS national year-on-year CPI change against SBP EasyData. Returns (checks, info for info.json).

    Compared only when a registered, non-failed `sbp_easydata` file is on disk with the hash in the
    manifest AND its own descriptive columns establish the series (national CPI, year on year,
    percent, base 2015-16). Otherwise no check is produced and the reason is recorded.
    """
    from . import cpi  # the comparison itself lives with the CPI builder

    candidates = [s for s in manifest if s.doc_type == cfg["doc_type"] and s.verification_status != "failed"]
    if not candidates:
        return [], {"status": "skipped", "reason": "no sbp_easydata source is registered in sources/manifest.csv"}
    source = sorted(candidates, key=lambda s: s.period)[-1]
    path = (sources_dir or config.sources_dir()) / source.local_path
    info: dict[str, Any] = {"source_id": source.source_id, "request_url": source.file_url, "retrieved_at": source.retrieved_at,
                            "sha256": source.sha256, "series_key": cfg["series_key"]}
    if not path.exists():
        return [], {**info, "status": "skipped", "reason": "the registered SBP file is not in SOURCES_DIR"}
    if config.sha256_file(path) != source.sha256:
        return [], {**info, "status": "skipped", "reason": "the SBP file on disk does not have the hash in the manifest"}
    series = read_easydata_series(path, cfg)
    info["description_in_file"] = series["description"]
    if series["problems"]:
        return [], {**info, "status": "not_compared", "reason": "the SBP series definition could not be established "
                    "from the file's own descriptive columns", "problems": series["problems"]}

    record_path = (verification_dir or config.VERIFICATION_DIR) / f"{source.source_id}.json"
    request = (config.read_json(record_path).get("request") or {}) if record_path.exists() else {}
    method = request.get("method", "GET")
    values = {period: r["value_raw"] for period, r in series["rows"].items()}
    checks = cpi.cross_source_checks(cells, values, source.source_id, cfg, titles)
    by_cell = {c.cell_id: c for c in cells}
    compared: list[dict[str, Any]] = []
    for chk in checks:
        cell = by_cell[chk.target_cell_id]
        row = series["rows"][cell.period]
        # Provenance of the SBP figure: request + series key + row (it has no page and no box).
        chk.description += (f" SBP figure: series {row['series_key']}, observation date {row['observation_date']}, "
                            f"row {row['row']} of {Path(source.local_path).name} ({method} {source.file_url}, "
                            f"retrieved {source.retrieved_at}).")
        compared.append({"period": cell.period, "pbs_source_id": cell.source_id, "pbs_page": cell.page,
                         "pbs_value_raw": cell.value_raw, "pbs_value_parsed": cell.value_parsed,
                         "sbp_value_raw": row["value_raw"], "sbp_value_parsed": parse_printed(row["value_raw"]).value_str,
                         "sbp_row": row["row"], "sbp_series_key": row["series_key"],
                         "sbp_observation_date": row["observation_date"], "result": chk.result, "residual": chk.residual,
                         "check_id": chk.check_id})
    return checks, {**info, "status": "compared", "checks": len(checks), "request_method": method, "compared": compared}
