"""Structure validation, failure detectors, coverage and overlay QA (plan 6.4).

Only `validate_run` may set `validated: true` in a run manifest.

Coverage ("how much of the printed table we captured") is computed here and
is never mixed with accuracy ("how much of what we captured is right"),
which comes from the checks and, later, the gold set.
"""
from __future__ import annotations

from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any

from . import config
from .extract import runs_dir
from .normalise import numeric_tokens, parse_printed
from .schema import RunManifest
from .sources import get_source, source_path
from .tables import MERGED_ROW, TITLE_TEXT, Table, doc_page_numbers, load_tables, page_words

# Table flags that make every sum on the table `not_evaluable` (AGENTS.md section 6).
BLOCKING_TABLE_FLAGS = frozenset({"dropped_column", "merged_rows", "possible_dropped_column", "low_coverage"})


def validate_run(run_id: str) -> RunManifest:
    """Check one run's structure and, if everything passes, mark it validated."""
    run_dir = runs_dir() / run_id
    manifest = RunManifest(**config.read_json(run_dir / "manifest.json"))
    source = get_source(manifest.source_id)
    pdf = source_path(source)
    report: dict[str, Any] = {"run_id": run_id, "validated_at": config.now_iso(), "checks": {}}
    checks = report["checks"]

    sha_now = config.sha256_file(pdf)
    checks["file_hash_unchanged"] = {
        "ok": sha_now == manifest.sha256_at_run == source.sha256, "sha256_now": sha_now,
        "sha256_at_run": manifest.sha256_at_run, "sha256_in_manifest": source.sha256,
    }
    error_log = run_dir / "errors.log"
    error_text = error_log.read_text(encoding="utf-8") if error_log.exists() else "missing errors.log"
    checks["error_log_empty"] = {"ok": error_text.strip() == "" and (manifest.errors or {}).get("count", 1) == 0}

    out_json = run_dir / "raw" / "output.json"
    checks["output_present"] = {"ok": out_json.exists()}
    if out_json.exists():
        pages = doc_page_numbers(out_json)
        if manifest.run_mode == "page-range" and manifest.page_range:
            expected = list(range(manifest.page_range[0], manifest.page_range[1] + 1))
        else:
            expected = list(range(1, (source.page_count or 0) + 1))
        counts = Counter(pages)
        checks["pages_accounted_for"] = {
            "ok": pages == expected, "expected": len(expected), "emitted": len(pages),
            "missing": [p for p in expected if p not in counts][:50],
            "duplicated": [p for p, n in counts.items() if n > 1][:50],
            "unexpected": [p for p in pages if p not in set(expected)][:50],
        }
        tables = load_tables(out_json)
        flagged = []
        for t in tables:
            flags = detect_table_flags(t)
            if flags:
                flagged.append({"page": t.page, "table_index": t.table_index, "flags": flags})
        report["tables"] = len(tables)
        report["tables_with_detector_flags"] = flagged
    thresholds = _thresholds()
    profile = manifest.profile or {}
    checks["text_layer"] = {
        "ok": profile.get("scanned_page_fraction", 1) <= thresholds["structure"]["max_scanned_page_fraction"],
        "text_layer_page_fraction": profile.get("text_layer_page_fraction"),
    }
    report["all_ok"] = all(c["ok"] for c in checks.values())
    config.write_json(run_dir / "validator_report.json", report)
    manifest.validated = bool(report["all_ok"])
    manifest.validator_report = "validator_report.json"
    config.write_json(run_dir / "manifest.json", manifest.model_dump())
    print(f"[validate] {run_id}: {'VALIDATED' if manifest.validated else 'NOT VALID'} "
          f"{ {k: v['ok'] for k, v in checks.items()} }")
    return manifest


def _thresholds() -> dict[str, Any]:
    import yaml

    return yaml.safe_load(config.THRESHOLDS_YAML.read_text(encoding="utf-8"))


def detect_table_flags(table: Table, expected_value_columns: int | None = None) -> list[str]:
    """Docling failure detectors that work from its own output (AGENTS.md section 7)."""
    flags: list[str] = []
    value_cols = set(table.value_columns())
    merged = title = 0
    for c in table.cells:
        if c.column_header:
            continue
        text = c.text.strip()
        if not text:
            continue
        if c.col in value_cols:
            if MERGED_ROW.search(text) or "merged_cell_suspected" in parse_printed(text).flags:
                merged += 1
            elif TITLE_TEXT.search(text):
                title += 1
    if merged:
        flags.append("merged_rows")
    if title:
        flags.append("title_text_as_data")
    if expected_value_columns is not None and len(value_cols) < expected_value_columns:
        flags.append("dropped_column")
    return flags


def _inside(word: tuple[float, float, float, float, str], box: list[float], margin: float = 0.004) -> bool:
    cx, cy = (word[0] + word[2]) / 2, (word[1] + word[3]) / 2
    return box[0] - margin <= cx <= box[2] + margin and box[1] - margin <= cy <= box[3] + margin


def _multiset_match(printed: list[Decimal], emitted: list[Decimal]) -> tuple[int, list[str]]:
    have = Counter(emitted)
    matched = 0
    missing: list[str] = []
    for value in printed:
        if have[value] > 0:
            have[value] -= 1
            matched += 1
        else:
            missing.append(format(value, "f"))
    return matched, missing


def table_coverage(table: Table, pdf_path: Path) -> dict[str, Any]:
    """D11: printed numeric tokens in the table's region vs numeric tokens Docling emitted.

    Two regions are measured. `coverage` uses the table box Docling reported.
    `coverage_row_band` widens the box to the full page width over the same
    rows, which catches a column that Docling left outside the table box.
    Fiscal-year labels are masked on both sides.
    """
    words = page_words(pdf_path, table.page)
    emitted: list[Decimal] = []
    for c in table.cells:
        emitted.extend(numeric_tokens(c.text))

    def measure(box: list[float]) -> tuple[int, int, list[str]]:
        printed: list[Decimal] = []
        for w in words:
            if _inside(w, box):
                printed.extend(numeric_tokens(w[4]))
        matched, missing = _multiset_match(printed, emitted)
        return len(printed), matched, missing

    printed_n, matched_n, missing = measure(table.bbox)
    band = [0.0, table.bbox[1], 1.0, table.bbox[3]]
    band_printed, band_matched, band_missing = measure(band)
    cov = round(matched_n / printed_n, 4) if printed_n else None
    band_cov = round(band_matched / band_printed, 4) if band_printed else None
    return {
        "page": table.page, "table_index": table.table_index, "printed_numeric_tokens": printed_n,
        "matched": matched_n, "coverage": cov, "missing_tokens_sample": missing[:15],
        "row_band_printed_numeric_tokens": band_printed, "row_band_matched": band_matched,
        "coverage_row_band": band_cov, "row_band_missing_sample": band_missing[:15],
        "emitted_numeric_tokens": len(emitted),
    }


def render_overlay(pdf_path: Path, table: Table, out_path: Path, dpi: int = 144,
                   highlight: list[list[float]] | None = None) -> Path:
    """Draw the table box (red) and every cell box (blue) on the rendered page for visual QA."""
    import pymupdf

    with pymupdf.open(pdf_path) as doc:
        page = doc[table.page - 1]
        w, h = page.rect.width, page.rect.height

        def rect(b: list[float]):
            return pymupdf.Rect(b[0] * w, b[1] * h, b[2] * w, b[3] * h)

        page.draw_rect(rect(table.bbox), color=(1, 0, 0), width=1.2)
        for c in table.cells:
            if c.bbox:
                page.draw_rect(rect(c.bbox), color=(0, 0.3, 1), width=0.5)
        for b in highlight or []:
            page.draw_rect(rect(b), color=(0, 0.6, 0), width=1.5)
        pix = page.get_pixmap(dpi=dpi)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        pix.save(out_path)  # the PDF itself is never saved
    return out_path
