"""Helpers shared by the dataset builders (abs, cpi, lfs)."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Callable, Iterable

import yaml

from .. import config
from ..extract import latest_run, run_output_json
from ..normalise import FISCAL_YEAR, clean_text, normalise_label, parse_printed
from ..schema import (ARITHMETIC_CHECKS, PASSING, Cell, Check, Observation, RunManifest, SecondReader, SecondReaderOf, Series,
                      Source, cell_id_for)
from ..tables import Table, load_tables, page_words

EXTRACTOR_NAME = "docling"


def load_spec(name: str) -> dict[str, Any]:
    return yaml.safe_load((config.SPECS_DIR / f"{name}.yaml").read_text(encoding="utf-8"))


def dataset_dir(dataset: str) -> Path:
    d = config.work_dir() / "datasets" / dataset
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_dataset(dataset: str, *, cells: list[Cell], checks: list[Check], series: list[Series],
                 observations: list[Observation], coverage: list[dict[str, Any]], info: dict[str, Any]) -> None:
    d = dataset_dir(dataset)
    config.write_json(d / "cells.json", [c.model_dump() for c in cells])
    config.write_json(d / "checks.json", [c.model_dump() for c in checks])
    config.write_json(d / "series.json", [s.model_dump() for s in series])
    config.write_json(d / "observations.json", [o.model_dump() for o in observations])
    config.write_json(d / "coverage.json", coverage)
    config.write_json(d / "info.json", info)


def load_dataset(dataset: str) -> dict[str, Any] | None:
    d = config.work_dir() / "datasets" / dataset
    if not (d / "cells.json").exists():
        return None
    return {
        "cells": [Cell(**c) for c in config.read_json(d / "cells.json")],
        "checks": [Check(**c) for c in config.read_json(d / "checks.json")],
        "series": [Series(**s) for s in config.read_json(d / "series.json")],
        "observations": [Observation(**o) for o in config.read_json(d / "observations.json")],
        "coverage": config.read_json(d / "coverage.json"),
        "info": config.read_json(d / "info.json"),
    }


def validated_tables(source: Source) -> tuple[RunManifest, list[Table]] | None:
    """Tables from the newest validated run of a source, or None if there is no validated run."""
    run = latest_run(source.source_id, validated_only=True)
    if run is None:
        return None
    return run, load_tables(run_output_json(run.run_id))


def score_table(table: Table, patterns: list[str]) -> int:
    text = normalise_label(table.text())
    return sum(1 for p in patterns if re.search(p, text, flags=re.I))


def previous_fy(fy: str) -> str:
    a = int(fy[:4]) - 1
    return f"{a}-{str(a + 1)[-2:]}"


def next_fy(fy: str) -> str:
    a = int(fy[:4]) + 1
    return f"{a}-{str(a + 1)[-2:]}"


def canonical_fy(a: str, b: str) -> str:
    return f"{a}-{b[-2:]}"


def column_header_text(table: Table, col: int, words: list[tuple[float, float, float, float, str]],
                       lookback: float = 0.16, pad: float = 0.012) -> str:
    """Text printed above a value column, read from the PDF text layer by position.

    Docling often merges or truncates multi-line column headers, so the header
    is taken from the words whose centre lies inside the column's horizontal
    band and above its first amount.
    """
    boxes = [c.bbox for c in table.cells if c.col == col and c.bbox and not c.column_header
             and parse_printed(c.text).value is not None]
    if not boxes:
        return ""
    x0 = min(b[0] for b in boxes) - pad
    x1 = max(b[2] for b in boxes) + pad
    first_y = min(b[1] for b in boxes)
    picked = [w for w in words if x0 <= (w[0] + w[2]) / 2 <= x1 and first_y - lookback <= (w[1] + w[3]) / 2 < first_y - 0.001]
    picked.sort(key=lambda w: (round(w[1], 3), w[0]))
    return clean_text(" ".join(w[4] for w in picked))


def fiscal_years_in(text: str) -> list[str]:
    return [canonical_fy(a, b) for a, b in FISCAL_YEAR.findall(clean_text(text))]


def row_label(table: Table, grid: list[list[Any]], row: int, value_cols: list[int]) -> str:
    """Printed label of a row: its non-value cells joined left to right."""
    seen: set[int] = set()
    parts: list[str] = []
    for k in range(table.num_cols):
        if k in value_cols:
            continue
        cell = grid[row][k]
        if cell is None or id(cell) in seen or cell.column_header:
            continue
        seen.add(id(cell))
        if cell.text.strip():
            parts.append(cell.text.strip())
    return clean_text(" ".join(parts))


def text_layer_row_label(table: Table, grid: list[list[Any]], row: int, value_cols: list[int],
                         words: list[tuple[float, float, float, float, str]]) -> str:
    """A row's label read from the PDF text layer by position (fallback when Docling merges label cells).

    Words whose centre lies in the vertical band of the row's amounts and left
    of the first amount column, in reading order. A label wrapped over two
    lines is returned for the amount's own line only.
    """
    boxes = [grid[row][k].bbox for k in value_cols if grid[row][k] is not None and grid[row][k].row == row and grid[row][k].bbox]
    if not boxes:
        return ""
    y0, y1 = min(b[1] for b in boxes), max(b[3] for b in boxes)
    pad = (y1 - y0) * 0.15
    left_edge = min(c.bbox[0] for c in table.cells if c.col in value_cols and c.bbox and not c.column_header)
    picked = [w for w in words if y0 - pad <= (w[1] + w[3]) / 2 <= y1 + pad and w[2] <= left_edge + 0.002
              and w[0] >= table.bbox[0] - 0.01]
    picked.sort(key=lambda w: w[0])
    return clean_text(" ".join(w[4] for w in picked))


def make_cell(*, source: Source, run: RunManifest, table: Table, tcell: Any, row_label_raw: str, col_label_raw: str,
              table_flags: list[str]) -> Cell:
    parsed = parse_printed(tcell.text)
    bbox = tcell.bbox or table.bbox
    return Cell(
        cell_id=cell_id_for(source.source_id, table.page, table.table_index, tcell.row, tcell.col),
        source_id=source.source_id, page=table.page, table_index=table.table_index, table_bbox_norm=table.bbox,
        cell_bbox_norm=bbox, row_index=tcell.row, col_index=tcell.col, row_span=tcell.row_span, col_span=tcell.col_span,
        row_label_raw=row_label_raw, row_label_path=[row_label_raw] if row_label_raw else [],
        col_label_raw=col_label_raw, col_label_path=[col_label_raw] if col_label_raw else [],
        value_raw=tcell.text, value_parsed=parsed.value_str, is_missing=parsed.is_missing,
        missing_marker=parsed.missing_marker, normalization_flags=list(parsed.flags),
        extractor_name=EXTRACTOR_NAME, extractor_version=run.tool_versions.get("docling", "unknown"), run_id=run.run_id,
        extract_config_sha256=run.config_sha256, structural_flags=list(table_flags),
    )


class LabelMap:
    """Hand-written dictionary from printed row labels to series (decision D20).

    Patterns are regular expressions matched against the WHOLE normalised
    label. A label that matches nothing, or matches two different series, is
    left unmapped and is never published.
    """

    def __init__(self, entries: list[dict[str, Any]]):
        self.entries = [(re.compile(e["pattern"], re.I), e["series"]) for e in entries]

    def lookup(self, raw_label: str) -> tuple[str | None, str]:
        label = normalise_label(raw_label)
        hits = {series for pattern, series in self.entries if pattern.fullmatch(label)}
        if len(hits) == 1:
            return hits.pop(), "dictionary"
        return None, "ambiguous" if hits else "unmapped"


# ----------------------------------------------------------------------------- second reader (decision D28)

SECOND_READER_ROUTING_FLAGS = frozenset({"merged_rows", "dropped_column"})
# Flags on the SECOND reading's own table that stop it from being used.
SECOND_READING_BLOCKING_FLAGS = frozenset({"dropped_column", "merged_rows", "possible_dropped_column", "low_coverage",
                                           "column_unmapped", "title_text_as_data"})


def try_second_reader(*, source: Source, table: Table, table_flags: list[str], first_cells: list[Cell],
                      expected_value_columns: int,
                      build: Callable[[Table], tuple[list[Cell], dict[str, Any], dict[str, Any]]],
                      checks: Callable[[list[Cell], dict[str, Any]], list[Check]],
                      required_checks: Iterable[str]) -> dict[str, Any] | None:
    """Route a structurally flagged table to the second reader and let the checks decide.

    Returns None when the table does not carry `merged_rows` or `dropped_column`. Otherwise
    {"promoted": bool, "record": ..., "cells": [...], "meta": {...}, "coverage": {...}}.

    `build(table)` is the dataset's own cell builder (returns cells, a table info dict with
    `table_flags` and `coverage`, and per-cell meaning keyed by cell id); `checks(cells, meta)`
    its arithmetic checks. The second reading is promoted only when ALL of these hold:
      - the reader says the structure is unambiguous;
      - the second reading's own table carries no blocking flag (detectors, coverage against
        the PDF text layer and column headers are re-run on it by `build`);
      - every arithmetic check on the table passes, none fails and none is not evaluable;
      - each check type in `required_checks` ran at least once.
    When promoted, `cells` are the second reader's cells (own ids, own flags, reader recorded)
    and the first reader's cells are kept, unmapped, with what the second reader read at the
    same spot under `second_reader`. When not promoted nothing changes: `cells` is empty.
    """
    from .. import second_reader as sr
    from ..normalise import numeric_tokens
    from ..sources import source_path
    from ..validate import render_overlay

    routed_by = sorted(set(table_flags) & SECOND_READER_ROUTING_FLAGS)
    if not routed_by:
        return None
    pdf = source_path(source)
    reading = sr.read_docling_table(pdf, table, expected_value_columns)
    record: dict[str, Any] = {"routed_by": routed_by, "reading": reading.summary(), "promoted": False}
    out: dict[str, Any] = {"promoted": False, "record": record, "cells": [], "meta": {}, "coverage": None}
    if not reading.usable or reading.table is None:
        record["decision"] = f"not used: {reading.reason}"
        return out
    overlay = config.work_dir() / "qa" / f"overlay_{source.source_id}_p{table.page:03d}_second_reader.png"
    render_overlay(pdf, reading.table, overlay)

    cells, info, meta = build(reading.table)
    first_reader = first_cells[0].extractor_name if first_cells else EXTRACTOR_NAME
    first_version = first_cells[0].extractor_version if first_cells else "unknown"

    def covering(cell: Cell) -> list[Cell]:
        cx = (cell.cell_bbox_norm[0] + cell.cell_bbox_norm[2]) / 2
        cy = (cell.cell_bbox_norm[1] + cell.cell_bbox_norm[3]) / 2
        return [f for f in first_cells if f.cell_bbox_norm[0] <= cx <= f.cell_bbox_norm[2]
                and f.cell_bbox_norm[1] <= cy <= f.cell_bbox_norm[3]]

    new_meta: dict[str, Any] = {}
    read_at: dict[str, list[Cell]] = {}
    for c in cells:
        old_id = c.cell_id
        over = covering(c)
        c.cell_id = cell_id_for(c.source_id, c.page, c.table_index, c.row_index, c.col_index, reader=reading.reader)
        c.extractor_name, c.extractor_version = reading.reader, reading.version
        c.extract_config_sha256 = reading.config_sha256
        c.second_reader_of = SecondReaderOf(first_reader=first_reader, first_reader_version=first_version,
                                            routed_by=routed_by, first_cell_ids=[f.cell_id for f in over])
        for f in over:
            read_at.setdefault(f.cell_id, []).append(c)
        if old_id in meta:
            new_meta[c.cell_id] = meta[old_id]

    arithmetic = [k for k in checks(cells, new_meta) if k.check_type in ARITHMETIC_CHECKS]
    counts: dict[str, dict[str, int]] = {}
    for k in arithmetic:
        counts.setdefault(k.check_type, {"pass": 0, "pass_within_rounding": 0, "fail": 0, "not_evaluable": 0})[k.result] += 1
    blocking = sorted(set(info.get("table_flags", [])) & SECOND_READING_BLOCKING_FLAGS)
    missing = sorted(set(required_checks) - set(counts))
    not_passed = [k for k in arithmetic if k.result not in PASSING]
    record.update({
        "table_flags": info.get("table_flags", []), "coverage": info.get("coverage"),
        "column_problems": info.get("column_problems", []), "unmapped_labels": info.get("unmapped_labels", []),
        "ambiguous_labels": info.get("ambiguous_labels", []),
        "cells_read": len(cells), "cells_with_a_number": sum(1 for c in cells if c.value_parsed is not None),
        "cells_mapped": sum(1 for c in cells if c.series_id), "checks": counts, "checks_run": len(arithmetic),
        "checks_passed": len(arithmetic) - len(not_passed),
        "checks_not_passed_sample": [k.description for k in not_passed[:10]],
        "numbers_also_read_by_first_reader": sr.token_agreement(table, reading.table),
        "overlay": overlay.name,
    })
    if blocking:
        record["decision"] = f"not used: the second reading is itself flagged {', '.join(blocking)}"
    elif missing:
        record["decision"] = f"not used: these checks could not be run on the second reading: {', '.join(missing)}"
    elif not_passed:
        record["decision"] = (f"not used: {len(not_passed)} of {len(arithmetic)} arithmetic checks did not pass "
                              "on the second reading")
    else:
        record["decision"] = f"used: all {len(arithmetic)} arithmetic checks pass on the second reading"
        record["promoted"] = out["promoted"] = True
        out.update(cells=cells, meta=new_meta, coverage=info.get("coverage"))
        for f in first_cells:
            got = sorted(read_at.get(f.cell_id, []), key=lambda c: (c.row_index, c.col_index))
            if got:
                raw = " ".join(c.value_raw for c in got)
                f.second_reader = SecondReader(name=reading.reader, version=reading.version, value_raw=raw,
                                               agreement=sorted(numeric_tokens(f.value_raw)) == sorted(numeric_tokens(raw)))
            if f.series_id:   # the second reading is now the primary one; the first stays as a record only
                f.series_id = f.period = f.vintage = None
                f.mapping_method = "unmapped"
            if "superseded_by_second_reader" not in f.structural_flags:
                f.structural_flags.append("superseded_by_second_reader")
    return out
