"""Synthetic fixtures. No PDFs and no real extraction output live in the test suite."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from datalab.schema import Cell, cell_id_for

PAGE_W, PAGE_H = 600.0, 800.0


def docling_table(rows: list[list[str]], *, page: int = 1, header_rows: int = 1, top: float = 100.0,
                  row_h: float = 20.0, col_x: list[float] | None = None) -> dict:
    """A DoclingDocument-shaped table: table bbox BOTTOMLEFT, cell bboxes TOPLEFT (as Docling emits them)."""
    ncols = len(rows[0])
    col_x = col_x or [50.0 + 100.0 * k for k in range(ncols + 1)]
    cells = []
    for r, row in enumerate(rows):
        for k, text in enumerate(row):
            if text is None:
                continue
            cells.append({
                "bbox": {"l": col_x[k] + 2, "t": top + r * row_h + 2, "r": col_x[k + 1] - 2, "b": top + (r + 1) * row_h - 2,
                         "coord_origin": "TOPLEFT"},
                "row_span": 1, "col_span": 1, "start_row_offset_idx": r, "end_row_offset_idx": r + 1,
                "start_col_offset_idx": k, "end_col_offset_idx": k + 1, "text": text,
                "column_header": r < header_rows, "row_header": False, "row_section": False,
            })
    bottom = top + len(rows) * row_h
    return {
        "label": "table",
        "prov": [{"page_no": page, "bbox": {"l": col_x[0], "t": PAGE_H - top, "r": col_x[-1], "b": PAGE_H - bottom,
                                            "coord_origin": "BOTTOMLEFT"}}],
        "data": {"num_rows": len(rows), "num_cols": ncols, "table_cells": cells},
    }


def docling_doc(tables: list[dict], pages: int = 1) -> dict:
    return {"schema_name": "DoclingDocument", "version": "test",
            "pages": {str(i): {"page_no": i, "size": {"width": PAGE_W, "height": PAGE_H}} for i in range(1, pages + 1)},
            "tables": tables, "texts": []}


@pytest.fixture
def write_doc(tmp_path: Path):
    def _write(tables: list[dict], pages: int = 1) -> Path:
        p = tmp_path / "output.json"
        p.write_text(json.dumps(docling_doc(tables, pages)), encoding="utf-8")
        return p
    return _write


def make_cell(source: str, row: int, col: int, raw: str, parsed: str | None, *, series: str | None = None,
              period: str | None = "2025-26", vintage: str | None = "be", label: str = "", page: int = 1,
              flags: list[str] | None = None, struct: list[str] | None = None, missing: bool = False) -> Cell:
    return Cell(
        cell_id=cell_id_for(source, page, 0, row, col), source_id=source, page=page, table_index=0,
        table_bbox_norm=[0.1, 0.1, 0.9, 0.9], cell_bbox_norm=[0.5, 0.2, 0.6, 0.22], row_index=row, col_index=col,
        row_label_raw=label, value_raw=raw, value_parsed=parsed, is_missing=missing, missing_marker=raw if missing else None,
        normalization_flags=flags or [], structural_flags=struct or [], series_id=series,
        period=period if series else None, vintage=vintage if series else None,
        mapping_method="dictionary" if series else "unmapped", extractor_name="docling", extractor_version="test",
        run_id="TEST__run-01", extract_config_sha256="0" * 64, unit="PKR", scale_factor=1000000,
    )
