"""Second reader (decision D28): pdfplumber word geometry for a table the first reader got structurally wrong.

Routed ONLY to tables that carry `merged_rows` or `dropped_column`. It re-reads the
table's rows and columns from the PDF text layer and returns them as an ordinary
`tables.Table`, so the dataset builder puts the second reading through exactly the
same detectors, coverage measure, header checks, label dictionary and arithmetic
checks as a first reading. Whether the reading is used is decided by those checks
(`datasets/common.second_reader_decision`), never here and never by a person.

What it does
  1. takes pdfplumber words whose centre lies inside the table box;
  2. clusters them into lines by vertical overlap;
  3. splits label from value words at the left edge of the first reader's value columns;
  4. forms value columns as groups of horizontally overlapping value words;
  5. confirms the columns against the first reader's column positions (the anchors);
  6. keeps a leading code column ("1.", "2." printed left of the names, clear of them on
     every line) apart from the names, so a name wrapped over two lines reads in order.

It refuses (`usable = False`, with a reason) instead of guessing whenever the
structure is not unambiguous: wrong number of columns, a number straddling two
columns, an anchor that matches no column or two, two words in one cell, a word
across two lines, a row of numbers without a label, a label line that could belong
to either neighbouring row, or a page whose size differs from the first reader's.

Coordinate trap (AGENTS.md section 7): every box taken and returned here is
`[x0, y0, x1, y1]` as fractions of the page with a TOP-LEFT origin. A raw Docling
table box is BOTTOMLEFT; convert it with `tables.norm_bbox` first (a `tables.Table`
already holds the converted box). pdfplumber's own `top`/`bottom` are top-left.

No value is produced here: cell text is the words verbatim, and numbers are only
ever parsed from it by `normalise.parse_printed`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import config
from .normalise import numeric_tokens, parse_printed
from .tables import Table, TCell

READER_NAME = "pdfplumber"

# Everything that shapes a reading. Hashed into `extract_config_sha256` of second-reader cells.
READER_CONFIG: dict[str, Any] = {
    "reader": READER_NAME,
    "extract_words": {"x_tolerance": 3, "y_tolerance": 3, "keep_blank_chars": False, "use_text_flow": False},
    "bbox_margin": 0.004,           # page fraction; same margin as the coverage measure
    "line_overlap": 0.5,            # a word joins a line when they overlap by this share of the smaller height
    "value_left_pad": 0.010,        # page fraction left of the first anchor that still counts as value area
    "min_column_gap": 0.0015,       # page fraction; value columns closer than this are not separable
    "label_attach_ratio": 0.75,     # a label-only line belongs to a row only if it is this much closer to it
    "page_size_tolerance_pt": 0.5,
}

Box = list[float]


def reader_version() -> str:
    import pdfplumber

    return str(pdfplumber.__version__)


def reader_config_sha256() -> str:
    return config.sha256_json(READER_CONFIG)


@dataclass
class Word:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2

    @property
    def box(self) -> Box:
        return [self.x0, self.y0, self.x1, self.y1]


@dataclass
class Anchors:
    """What the first reader's table tells the second reader about the layout."""

    body_top: float                          # top of the first data row (normalised, top-left)
    columns: list[tuple[float, float]]       # horizontal band of each value column the first reader kept
    source: str = "docling"


@dataclass
class SecondReading:
    usable: bool
    reason: str | None
    reader: str
    version: str
    config_sha256: str
    page: int
    table_bbox: Box
    column_bands: list[tuple[float, float]] = field(default_factory=list)
    table: Table | None = None
    stats: dict[str, Any] = field(default_factory=dict)

    def summary(self) -> dict[str, Any]:
        return {"usable": self.usable, "reason": self.reason, "reader": self.reader, "version": self.version,
                "config_sha256": self.config_sha256, "page": self.page,
                "column_bands": [[round(a, 5), round(b, 5)] for a, b in self.column_bands], **self.stats}


def _round_box(box: Box) -> Box:
    return [round(min(max(v, 0.0), 1.0), 5) for v in box]


def _union(boxes: list[Box]) -> Box:
    return _round_box([min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)])


def anchors_from_table(table: Table) -> Anchors | None:
    """Column positions and the top of the body from the first reader's own cells.

    A column's band comes only from body cells that hold exactly one number, so a
    merged cell (two numbers) never widens a band. Returns None when no value
    column has such a cell.
    """
    bands: list[tuple[float, float]] = []
    tops: list[float] = []
    for col in table.value_columns():
        boxes = [c.bbox for c in table.cells if c.col == col and c.bbox and not c.column_header
                 and parse_printed(c.text).value is not None]
        if boxes:
            bands.append((min(b[0] for b in boxes), max(b[2] for b in boxes)))
    for c in table.cells:
        if c.col in set(table.value_columns()) and c.bbox and not c.column_header:
            p = parse_printed(c.text)
            if p.value is not None or p.is_missing or "merged_cell_suspected" in p.flags:
                tops.append(c.bbox[1])
    if not bands or not tops:
        return None
    return Anchors(body_top=min(tops), columns=sorted(bands))


def pdf_words(pdf_path: Path, page: int) -> tuple[list[Word], tuple[float, float]]:
    """pdfplumber words of one page as normalised top-left boxes, and the page size in points."""
    import pdfplumber

    with pdfplumber.open(str(pdf_path)) as pdf:
        pg = pdf.pages[page - 1]
        left, top = float(pg.bbox[0]), float(pg.bbox[1])
        w, h = float(pg.width), float(pg.height)
        out = [Word(text=str(d["text"]), x0=(float(d["x0"]) - left) / w, y0=(float(d["top"]) - top) / h,
                    x1=(float(d["x1"]) - left) / w, y1=(float(d["bottom"]) - top) / h)
               for d in pg.extract_words(**READER_CONFIG["extract_words"])]
    return out, (w, h)


def cluster_lines(words: list[Word], overlap: float) -> tuple[list[list[Word]], Word | None]:
    """Group words into lines by vertical overlap. Second value: a word that fits two lines, if any."""
    lines: list[dict[str, Any]] = []
    for w in sorted(words, key=lambda w: (w.cy, w.x0)):
        hits = []
        for line in lines:
            shared = min(w.y1, line["y1"]) - max(w.y0, line["y0"])
            if shared >= overlap * min(w.y1 - w.y0, line["y1"] - line["y0"]):
                hits.append(line)
        if len(hits) > 1:
            return [], w
        if hits:
            line = hits[0]
            line["words"].append(w)
            n = len(line["words"])
            # running mean of the band, so one tall glyph does not stretch the line
            line["y0"] += (w.y0 - line["y0"]) / n
            line["y1"] += (w.y1 - line["y1"]) / n
        else:
            lines.append({"y0": w.y0, "y1": w.y1, "words": [w]})
    lines.sort(key=lambda line: line["y0"])
    return [sorted(line["words"], key=lambda w: w.x0) for line in lines], None


def _is_value_text(text: str) -> bool:
    p = parse_printed(text)
    return p.value is not None or p.is_missing or "merged_cell_suspected" in p.flags


def _components(words: list[Word], min_gap: float) -> list[list[Word]]:
    """Groups of words whose horizontal extents overlap (or come closer than `min_gap`)."""
    groups: list[list[Word]] = []
    right = None
    for w in sorted(words, key=lambda w: w.x0):
        if right is not None and w.x0 < right + min_gap:
            groups[-1].append(w)
            right = max(right, w.x1)
        else:
            groups.append([w])
            right = w.x1
    return groups


def _straddler(group: list[Word], min_gap: float) -> Word | None:
    """A word whose removal splits a column group in two: it sits across two columns."""
    for w in sorted(group, key=lambda w: w.x0 - w.x1):   # widest first
        rest = [v for v in group if v is not w]
        if rest and len(_components(rest, min_gap)) > 1:
            return w
    return None


def read_table(pdf_path: Path, page: int, table_bbox: Box, anchors: Anchors, expected_columns: int, *,
               table_index: int = 0, doc_table_index: int = -1,
               expected_page_size: tuple[float, float] | None = None) -> SecondReading:
    """Re-read one table from the PDF text layer. `table_bbox` is normalised with a top-left origin."""
    cfg = READER_CONFIG
    base = dict(reader=READER_NAME, version=reader_version(), config_sha256=reader_config_sha256(), page=page,
                table_bbox=list(table_bbox))

    def refuse(reason: str, **stats: Any) -> SecondReading:
        return SecondReading(usable=False, reason=reason, stats=stats, **base)

    if len(table_bbox) != 4 or not (0 <= table_bbox[0] < table_bbox[2] <= 1 and 0 <= table_bbox[1] < table_bbox[3] <= 1):
        return refuse("the table box is not a normalised top-left box")
    if expected_columns < 1 or not anchors.columns:
        return refuse("the number of value columns to expect, or their position, is not known")
    if not table_bbox[1] <= anchors.body_top <= table_bbox[3]:
        return refuse("the first data row reported by the first reader lies outside the table box")
    all_words, size = pdf_words(pdf_path, page)
    if expected_page_size is not None and any(abs(a - b) > cfg["page_size_tolerance_pt"] for a, b in zip(size, expected_page_size)):
        return refuse(f"the page size seen by {READER_NAME} ({size[0]:.1f} x {size[1]:.1f} pt) differs from the first reader's "
                      f"({expected_page_size[0]:.1f} x {expected_page_size[1]:.1f} pt), so positions cannot be compared")
    m = cfg["bbox_margin"]
    words = [w for w in all_words if table_bbox[0] - m <= w.cx <= table_bbox[2] + m and table_bbox[1] - m <= w.cy <= table_bbox[3] + m]
    if not words:
        return refuse("the text layer has no words inside the table box")

    lines, torn = cluster_lines(words, cfg["line_overlap"])
    if torn is not None:
        return refuse(f"the word '{torn.text}' sits across two lines, so rows cannot be separated")
    head = [ln for ln in lines if sum(w.cy for w in ln) / len(ln) < anchors.body_top - 0.001]
    body = [ln for ln in lines if ln not in head]
    value_left = min(a for a, _ in anchors.columns) - cfg["value_left_pad"]

    # Classify body lines: data (numbers in the value area), label-only, or other text.
    kinds: list[str] = []
    for ln in body:
        in_values = [w for w in ln if w.cx >= value_left]
        if any(_is_value_text(w.text) for w in in_values):
            kinds.append("data")
        elif not in_values:
            kinds.append("label")
        else:
            kinds.append("text")
    data_idx = [i for i, k in enumerate(kinds) if k == "data"]
    if not data_idx:
        return refuse("no row of numbers was found below the header")

    # Columns: groups of horizontally overlapping value words over all data rows.
    value_words = [w for i in data_idx for w in body[i] if w.cx >= value_left]
    groups = _components(value_words, cfg["min_column_gap"])
    if len(groups) != expected_columns:
        if len(groups) < expected_columns:
            for g in groups:
                s = _straddler(g, cfg["min_column_gap"])
                if s is not None:
                    return refuse(f"the text '{s.text}' straddles two column bands, so the columns cannot be separated",
                                  columns_found=len(groups), columns_expected=expected_columns)
        return refuse(f"{len(groups)} value columns were found by position; {expected_columns} are expected",
                      columns_found=len(groups), columns_expected=expected_columns)
    bands = [(min(w.x0 for w in g), max(w.x1 for w in g)) for g in groups]

    # Anchors: every column the first reader kept must be exactly one of these columns.
    taken: dict[int, tuple[float, float]] = {}
    for a in anchors.columns:
        hits = [i for i, b in enumerate(bands) if min(a[1], b[1]) - max(a[0], b[0]) > 0]
        if len(hits) != 1:
            return refuse(f"a column of the first reader (x {a[0]:.3f} to {a[1]:.3f}) matches {len(hits)} columns of the "
                          "second reading; exactly one is needed", columns_found=len(bands))
        if hits[0] in taken:
            return refuse("two columns of the first reader fall on one column of the second reading", columns_found=len(bands))
        taken[hits[0]] = a

    def column_of(w: Word) -> int:
        return next(i for i, b in enumerate(bands) if b[0] <= w.cx <= b[1])

    # Label-only lines belong to the nearest data row, and only when clearly nearer to one.
    extra_labels: dict[int, list[tuple[int, list[Word]]]] = {i: [] for i in data_idx}

    def centre(i: int) -> float:
        return sum(w.cy for w in body[i]) / len(body[i])

    for i, kind in enumerate(kinds):
        if kind != "label":
            continue
        above = max((j for j in data_idx if j < i), default=None)
        below = min((j for j in data_idx if j > i), default=None)
        # a line of other text between the label line and a row means the label is not that row's
        if above is not None and any(kinds[k] == "text" for k in range(above + 1, i)):
            above = None
        if below is not None and any(kinds[k] == "text" for k in range(i + 1, below)):
            below = None
        if above is None and below is None:
            return refuse("a line of label text cannot be assigned to any row of numbers")
        if above is None or below is None:
            owner = above if above is not None else below
        else:
            da, db = centre(i) - centre(above), centre(below) - centre(i)
            if da <= cfg["label_attach_ratio"] * db:
                owner = above
            elif db <= cfg["label_attach_ratio"] * da:
                owner = below
            else:
                text = " ".join(w.text for w in body[i])
                return refuse(f"the label line '{text}' lies between two rows of numbers and could belong to either")
        extra_labels[owner].append((i, body[i]))

    # A leading code column: the left-most group of label words, when a clear gutter separates it
    # from all other label words and no line has two words in it.
    label_pool = [(i, w) for i, k in enumerate(kinds) if k != "text" for w in body[i] if w.cx < value_left]
    label_groups = _components([w for _, w in label_pool], cfg["min_column_gap"])
    code_right: float | None = None
    if len(label_groups) > 1:
        first_ids = {id(w) for w in label_groups[0]}
        per_line: dict[int, int] = {}
        for i, w in label_pool:
            if id(w) in first_ids:
                per_line[i] = per_line.get(i, 0) + 1
        if max(per_line.values()) == 1:
            code_right = max(w.x1 for w in label_groups[0])
    label_cols = 2 if code_right is not None else 1

    cells: list[TCell] = []
    row_no = 0
    for ln in head:
        cells.append(TCell(row=row_no, col=0, row_span=1, col_span=1, text=" ".join(w.text for w in ln),
                           bbox=_union([w.box for w in ln]), column_header=True))
        row_no += 1
    data_rows = 0
    value_cells = 0
    for i, kind in enumerate(kinds):
        if kind == "label":
            continue
        ln = body[i]
        if kind == "text":
            cells.append(TCell(row=row_no, col=0, row_span=1, col_span=1, text=" ".join(w.text for w in ln),
                               bbox=_union([w.box for w in ln])))
            row_no += 1
            continue
        label_lines = sorted([(i, [w for w in ln if w.cx < value_left])] + extra_labels[i], key=lambda t: t[0])
        label_words = [w for _, ws in label_lines for w in ws]
        if not label_words:
            first = next(w for w in ln if w.cx >= value_left)
            return refuse(f"the row of numbers starting '{first.text}' has no label")
        codes = [w for w in label_words if code_right is not None and w.x1 <= code_right]
        names = [w for w in label_words if not any(w is c for c in codes)]
        if len(codes) > 1:
            return refuse(f"two entries of the leading code column ('{codes[0].text}' and '{codes[1].text}') fall in one row")
        for col, part in ((0, codes), (label_cols - 1, names)):   # `codes` is empty when there is one label column
            if part:
                cells.append(TCell(row=row_no, col=col, row_span=1, col_span=1, text=" ".join(w.text for w in part),
                                   bbox=_union([w.box for w in part])))
        seen: dict[int, Word] = {}
        for w in (w for w in ln if w.cx >= value_left):
            k = column_of(w)
            if k in seen:
                return refuse(f"two pieces of text ('{seen[k].text}' and '{w.text}') fall in one cell, "
                              "so the cell cannot be read as one printed figure")
            seen[k] = w
            cells.append(TCell(row=row_no, col=k + label_cols, row_span=1, col_span=1, text=w.text, bbox=_round_box(w.box)))
            value_cells += 1
        data_rows += 1
        row_no += 1

    table = Table(doc_table_index=doc_table_index, page=page, table_index=table_index, bbox=list(table_bbox),
                  num_rows=row_no, num_cols=expected_columns + label_cols, cells=cells, page_size=size)
    stats = {"words_in_box": len(words), "header_lines": len(head), "data_rows": data_rows, "value_cells": value_cells,
             "columns_found": len(bands), "columns_expected": expected_columns, "label_columns": label_cols,
             "anchors_matched": len(taken),
             "anchors_given": len(anchors.columns)}
    return SecondReading(usable=True, reason=None, column_bands=bands, table=table, stats=stats, **base)


def read_docling_table(pdf_path: Path, table: Table, expected_columns: int) -> SecondReading:
    """Second reading of a table the first reader produced, anchored on that table's own geometry."""
    anchors = anchors_from_table(table)
    if anchors is None:
        return SecondReading(usable=False, reason="the first reader's table has no column with a cleanly read number to anchor on",
                             reader=READER_NAME, version=reader_version(), config_sha256=reader_config_sha256(),
                             page=table.page, table_bbox=list(table.bbox))
    return read_table(pdf_path, table.page, table.bbox, anchors, expected_columns, table_index=table.table_index,
                      doc_table_index=table.doc_table_index, expected_page_size=table.page_size)


def token_agreement(first: Table, second: Table) -> dict[str, int]:
    """How many numbers the two readers both emitted (multiset). Reported, never used to decide."""
    from collections import Counter

    a = Counter(t for c in first.cells for t in numeric_tokens(c.text))
    b = Counter(t for c in second.cells for t in numeric_tokens(c.text))
    return {"first_reader_numeric_tokens": sum(a.values()), "second_reader_numeric_tokens": sum(b.values()),
            "numeric_tokens_in_both": sum((a & b).values())}
