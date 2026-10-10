"""Read a DoclingDocument JSON into plain table objects with normalised boxes.

Coordinate trap (AGENTS.md section 7): Docling's table box uses a BOTTOMLEFT
origin while per-cell boxes use TOPLEFT. This module never assumes: it reads
`coord_origin` on every box and converts to one convention:

    [x0, y0, x1, y1], fractions of the page, origin at the top-left corner.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import config
from .normalise import parse_printed


def norm_bbox(bbox: dict[str, Any], page_w: float, page_h: float) -> list[float]:
    """Convert a Docling bbox dict to normalised top-left [x0, y0, x1, y1]."""
    origin = str(bbox.get("coord_origin", "TOPLEFT")).upper()
    left, right = float(bbox["l"]), float(bbox["r"])
    t, b = float(bbox["t"]), float(bbox["b"])
    if origin.endswith("BOTTOMLEFT"):
        y0, y1 = page_h - t, page_h - b
    elif origin.endswith("TOPLEFT"):
        y0, y1 = t, b
    else:
        raise ValueError(f"unknown coord_origin {origin!r}")
    x0, x1 = sorted((left, right))
    y0, y1 = sorted((y0, y1))
    clamp = lambda v: round(min(max(v, 0.0), 1.0), 5)  # noqa: E731
    return [clamp(x0 / page_w), clamp(y0 / page_h), clamp(x1 / page_w), clamp(y1 / page_h)]


@dataclass
class TCell:
    row: int
    col: int
    row_span: int
    col_span: int
    text: str
    bbox: list[float] | None
    column_header: bool = False
    row_header: bool = False
    row_section: bool = False


@dataclass
class Table:
    doc_table_index: int          # position in the document's table list
    page: int                     # 1-based
    table_index: int              # position among the tables on its page, Docling order
    bbox: list[float]
    num_rows: int
    num_cols: int
    cells: list[TCell]
    page_size: tuple[float, float]
    flags: list[str] = field(default_factory=list)

    def grid(self) -> list[list[TCell | None]]:
        g: list[list[TCell | None]] = [[None] * self.num_cols for _ in range(self.num_rows)]
        for c in self.cells:
            for r in range(c.row, min(c.row + c.row_span, self.num_rows)):
                for k in range(c.col, min(c.col + c.col_span, self.num_cols)):
                    if g[r][k] is None:
                        g[r][k] = c
        return g

    def text(self) -> str:
        return " ".join(c.text for c in self.cells)

    def value_columns(self) -> list[int]:
        """Columns that hold printed amounts: everything right of the last text column.

        A column is a text column when most of its non-empty body cells are not
        numbers. Leading code columns ("01", "02") sit left of the description
        column, so they are never counted as value columns.
        """
        g = self.grid()
        is_text = []
        for k in range(self.num_cols):
            texts = [g[r][k].text.strip() for r in range(self.num_rows)
                     if g[r][k] is not None and g[r][k].col == k and not g[r][k].column_header and g[r][k].text.strip()]
            if not texts:
                is_text.append(False)
                continue
            non_numeric = sum(1 for t in texts if parse_printed(t).value is None and not parse_printed(t).is_missing
                              and "merged_cell_suspected" not in parse_printed(t).flags)
            is_text.append(non_numeric > len(texts) / 2)
        last_text = max((k for k, flag in enumerate(is_text) if flag), default=-1)
        return [k for k in range(last_text + 1, self.num_cols)]


def load_tables(docling_json: Path) -> list[Table]:
    doc = config.read_json(docling_json)
    pages = {int(k): (float(v["size"]["width"]), float(v["size"]["height"])) for k, v in doc["pages"].items()}
    per_page_count: dict[int, int] = {}
    out: list[Table] = []
    for doc_index, t in enumerate(doc.get("tables", [])):
        prov = t.get("prov") or []
        if not prov:
            continue
        page = int(prov[0]["page_no"])
        w, h = pages[page]
        idx = per_page_count.get(page, 0)
        per_page_count[page] = idx + 1
        data = t.get("data") or {}
        cells = []
        for c in data.get("table_cells", []):
            cells.append(TCell(
                row=int(c["start_row_offset_idx"]), col=int(c["start_col_offset_idx"]),
                row_span=int(c.get("row_span", 1)), col_span=int(c.get("col_span", 1)),
                text=str(c.get("text", "")), bbox=norm_bbox(c["bbox"], w, h) if c.get("bbox") else None,
                column_header=bool(c.get("column_header")), row_header=bool(c.get("row_header")),
                row_section=bool(c.get("row_section")),
            ))
        out.append(Table(doc_table_index=doc_index, page=page, table_index=idx, bbox=norm_bbox(prov[0]["bbox"], w, h),
                         num_rows=int(data.get("num_rows", 0)), num_cols=int(data.get("num_cols", 0)), cells=cells,
                         page_size=(w, h)))
    return out


def doc_page_numbers(docling_json: Path) -> list[int]:
    doc = config.read_json(docling_json)
    return sorted(int(k) for k in doc["pages"].keys())


def page_words(pdf_path: Path, page: int) -> list[tuple[float, float, float, float, str]]:
    """Words on a page from the PDF text layer, as normalised top-left boxes."""
    import pymupdf

    with pymupdf.open(pdf_path) as doc:
        pg = doc[page - 1]
        w, h = pg.rect.width, pg.rect.height
        return [(x0 / w, y0 / h, x1 / w, y1 / h, text) for x0, y0, x1, y1, text, *_ in pg.get_text("words")]


# Title or caption text that Docling sometimes emits as a data value (AGENTS.md section 7).
TITLE_TEXT = re.compile(r"(?i)\bTable\s*\d+|\bC-\d+\b|\bFY ?\d{2}\b|\bQ[1-4]\b|\b20\d\d-\d\d\b")
MERGED_ROW = re.compile(r"\d[\d,]*\s{2,}\d[\d,]*")
