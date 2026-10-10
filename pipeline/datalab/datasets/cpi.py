"""PBS Monthly Review of Price Indices: CPI by group tables (national, urban, rural).

Everything here is driven by `specs/cpi.yaml` and `specs/cpi_labels.yaml`.

Rules that matter (AGENTS.md sections 3, 4, 7):
- values are only ever read by `normalise.parse_printed` (inside `common.make_cell`);
- the meaning of a column (weight / index for which month / % change) is established from the
  PDF text layer by position and must equal what the issue is expected to print, or the whole
  table stays unmapped;
- index levels on the 2007-08 and 2015-16 bases are separate series, never spliced;
- the 2007-08 base table prints no national/urban/rural label, so its series carry no area
  segment (decision D27): `cpi.general.b2007_08`, never `cpi.national.*` or `cpi.urban.*`.
"""
from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from datetime import datetime
from decimal import ROUND_CEILING, Decimal
from typing import Any

from .. import config
from ..checks import classify_disputes, equality_check, fmt, pass_rate, sum_check, value_check
from ..normalise import clean_text, decimal_to_str, last_digit_unit, normalise_label, parse_printed
from ..schema import Cell, Check, Observation, Series, SeriesBreak, check_id_for, obs_id_for
from ..sources import read_manifest, source_path
from ..status import build_observations
from ..tables import Table, page_words
from ..validate import BLOCKING_TABLE_FLAGS, detect_table_flags, render_overlay, table_coverage
from .common import (LabelMap, column_header_text, load_spec, make_cell, row_label, save_dataset, score_table,
                     text_layer_row_label, try_second_reader, validated_tables)

DATASET = "cpi"
DOC_TYPE = "cpi_monthly_review"
Word = tuple[float, float, float, float, str]

MONTH_NUMBERS = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10,
                 "nov": 11, "dec": 12}
MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
               "November", "December"]
_MONTH_WORD = re.compile(r"(?i)^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?$")
_YEAR_WORD = re.compile(r"^'?(\d{4}|\d{2}),?$")
_MONTH_YEAR_ONE_WORD = re.compile(r"(?i)^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\.,\-']*(\d{4}|\d{2})$")


# ----------------------------------------------------------------------------- periods

HEADER_GROUP_NAMES = {"weight": "Group Weight (%)", "indices": "Indices", "change": "% Change over", "impact": "Impact (in % points) over"}


def month_add(period: str, k: int) -> str:
    """'2025-06' + (-12) -> '2024-06'."""
    y, m = int(period[:4]), int(period[5:7])
    n = y * 12 + (m - 1) + k
    return f"{n // 12:04d}-{n % 12 + 1:02d}"


def month_label(period: str) -> str:
    return f"{MONTH_NAMES[int(period[5:7]) - 1]} {period[:4]}"


def _year(text: str) -> int:
    n = int(text)
    return n if n >= 100 else 2000 + n


def rebase_side(period: str, spec: dict[str, Any]) -> dict[str, Any]:
    """Which base an issue is expected to print. Period strings compare correctly as text."""
    return spec["rebase"]["new"] if period >= spec["rebase"]["first_new_base_issue"] else spec["rebase"]["old"]


def base_tag(base_year: str) -> str:
    return "b" + base_year.replace("-", "_")


# ----------------------------------------------------------------------------- series ids

# Area key of a table whose caption names no area (the single CPI table of issues on the 2007-08
# base). It is a key for code only: it never appears in a series id (decision D27).
AREA_NOT_STATED = "not_stated"


def old_base_series_id(role: str, row: str, tag: str) -> str | None:
    """Series id for a cell of a table that states no area: named by what is printed, base always in the id."""
    if role == "index":
        return f"cpi.general.{tag}" if row == "general" else f"cpi.group.{row}.{tag}"
    if role == "weight":
        return None if row == "general" else f"cpi.weight.{row}.{tag}"
    if role in ("yoy", "mom"):
        return f"cpi.{role}.general.{tag}" if row == "general" else f"cpi.{role}.group.{row}.{tag}"
    return None


def table_words(area: str) -> str:
    """How a table is named in check descriptions and gap reasons."""
    return "CPI table (no area stated)" if area == AREA_NOT_STATED else f"{area} CPI table"


def series_id_for(area: str, role: str, row: str, tag: str) -> str | None:
    """Series id for one cell, or None when the cell is not a published measure."""
    if area == AREA_NOT_STATED:
        return old_base_series_id(role, row, tag)
    if role == "index":
        return f"cpi.{area}.general.{tag}" if row == "general" else f"cpi.{area}.group.{row}.{tag}"
    if role == "weight":
        return None if row == "general" else f"cpi.{area}.weight.{row}.{tag}"
    if role in ("yoy", "mom"):
        return f"cpi.{area}.{role}.general" if row == "general" else f"cpi.{area}.{role}.group.{row}"
    return None


def series_catalogue(spec: dict[str, Any]) -> list[Series]:
    breaks = [SeriesBreak(**b) for b in spec.get("breaks", [])]
    out: list[Series] = []
    rows = [{"slug": "general", "name": spec["general"]["name"], "definition": spec["general"]["definition"],
             "synonyms": spec["general"].get("synonyms", []), "sort": 0}] + list(spec["groups"])
    area_order = {"national": 0, "urban": 1, "rural": 2, AREA_NOT_STATED: 3}
    measure_order = {"index": 0, "yoy": 1, "mom": 2, "weight": 3}

    def add(area: str, role: str, row: dict[str, Any], side: dict[str, Any] | None) -> None:
        tag = side["tag"] if side else ""
        sid = series_id_for(area, role, row["slug"], tag)
        if sid is None:
            return
        a = spec["areas"][area]
        m = spec["measures"][role]
        base_year = side["base_year"] if side else None
        name = f"CPI {a['name']}: {row['name']}, {m['name']}" + (f" (base {base_year})" if base_year else "")
        definition = f"{row['definition'].strip()} {m['definition_suffix'].format(base_year=base_year or '')}".strip()
        notes = a.get("note", "")
        if area == AREA_NOT_STATED:
            # D27: the document prints no area, so no `area` dimension is asserted.
            dims = {"area_as_printed": a["area_as_printed"], "group": row["slug"], "measure": role}
        else:
            dims = {"area": area, "group": row["slug"], "measure": role}
        if base_year:
            dims["base_year"] = base_year
        general_id = series_id_for(area, role, "general", tag)
        out.append(Series(
            series_id=sid, name=name, parent_id=None if row["slug"] == "general" else general_id, dataset=DATASET,
            frequency="month", unit="index" if role == "index" else "percent", scale_factor=1, definition=definition,
            definition_status="draft", synonyms=list(row.get("synonyms", [])), breaks=breaks, source_doc_types=[DOC_TYPE],
            dims=dims, notes=notes,
            sort_key=area_order[area] * 10000 + measure_order[role] * 1000 + (0 if not side or side is spec["rebase"]["new"] else 500)
            + int(row.get("sort", 0)),
        ))

    for side in (spec["rebase"]["new"], spec["rebase"]["old"]):
        for area in side["areas"]:
            for row in rows:
                add(area, "index", row, side)
                add(area, "weight", row, side)
                if area == AREA_NOT_STATED:  # the change series of this table exist on its own base only
                    add(area, "yoy", row, side)
                    add(area, "mom", row, side)
    for area in spec["areas"]:
        if area == AREA_NOT_STATED:
            continue
        for row in rows:
            add(area, "yoy", row, None)
            add(area, "mom", row, None)
    return out


# ----------------------------------------------------------------------------- locate

def find_captions(page_texts: dict[int, str], spec: dict[str, Any]) -> list[dict[str, Any]]:
    """Pages whose text layer carries a 'Consumer Price Index ... by Group' caption: area and base year."""
    pattern = re.compile(spec["locator"]["caption_pattern"])
    out: list[dict[str, Any]] = []
    for page in sorted(page_texts):
        for m in pattern.finditer(page_texts[page]):
            out.append({"page": page, "area": (m.group(1) or AREA_NOT_STATED).lower(),
                        "base_year": re.sub(r"\s+", "", m.group(2)), "caption": clean_text(m.group(0))})
    return out


def locate(tables: list[Table], captions: list[dict[str, Any]], expected: dict[str, Any],
           spec: dict[str, Any]) -> tuple[dict[str, tuple[Table, dict[str, Any]]], dict[str, str], list[dict[str, Any]]]:
    """For each area the issue is expected to print: the one qualifying table on the captioned page.

    Returns (found[area] = (table, caption), problems[area] = reason, log).
    """
    patterns = spec["locator"]["row_patterns"]
    found: dict[str, tuple[Table, dict[str, Any]]] = {}
    problems: dict[str, str] = {}
    log: list[dict[str, Any]] = []
    for area in expected["areas"]:
        caps = [c for c in captions if c["area"] == area]
        if len(caps) != 1:
            problems[area] = (f"The caption of the {table_words(area)} was found {len(caps)} times in the text layer "
                              "(exactly one is needed)")
            log.append({"area": area, "result": "caption_not_unique", "captions": caps})
            continue
        cap = caps[0]
        scored = [(score_table(t, patterns), t) for t in tables if t.page == cap["page"]]
        good = [(s, t) for s, t in scored if s >= spec["locator"]["min_matches"]]
        entry = {"area": area, "page": cap["page"], "caption": cap["caption"],
                 "candidates": [{"table_index": t.table_index, "score": s, "rows": t.num_rows, "cols": t.num_cols}
                                for s, t in scored]}
        if len(good) != 1:
            problems[area] = (f"The {table_words(area)} could not be located on page {cap['page']} "
                              f"({len(good)} extracted tables qualify; exactly one is needed)")
            entry["result"] = "not_found" if not good else "tie"
        else:
            found[area] = (good[0][1], cap)
            entry["result"] = "found"
        log.append(entry)
    return found, problems, log


# ----------------------------------------------------------------------------- columns

def month_tokens(words: list[Word], line_tol: float = 0.006) -> list[dict[str, Any]]:
    """Month-year labels in the text layer ('June 25', 'June 2016', also 'June' printed above '2016').

    Each token: {period, x (centre), y (bottom-most centre), text}.
    """
    out: list[dict[str, Any]] = []
    for w in words:
        text = clean_text(w[4])
        one = _MONTH_YEAR_ONE_WORD.match(text)
        if one:
            out.append({"period": f"{_year(one.group(2)):04d}-{MONTH_NUMBERS[one.group(1).lower()]:02d}",
                        "x": (w[0] + w[2]) / 2, "y": (w[1] + w[3]) / 2, "text": text})
            continue
        m = _MONTH_WORD.match(text)
        if not m:
            continue
        cx, cy, height = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2, w[3] - w[1]
        best: tuple[float, Word] | None = None
        for v in words:
            if v is w or not _YEAR_WORD.match(clean_text(v[4])):
                continue
            vx, vy = (v[0] + v[2]) / 2, (v[1] + v[3]) / 2
            same_line = abs(vy - cy) <= line_tol and 0 <= v[0] - w[2] <= 0.02
            below = 0 < vy - cy <= 2.2 * height and w[0] - 0.01 <= vx <= w[2] + 0.01
            if same_line or below:
                rank = (0.0 if same_line else 1.0) + abs(vx - cx)
                if best is None or rank < best[0]:
                    best = (rank, v)
        if best is None:
            continue
        v = best[1]
        year = _YEAR_WORD.match(clean_text(v[4])).group(1)
        out.append({"period": f"{_year(year):04d}-{MONTH_NUMBERS[m.group(1).lower()]:02d}",
                    "x": (min(w[0], v[0]) + max(w[2], v[2])) / 2, "y": max(cy, (v[1] + v[3]) / 2),
                    "text": f"{text} {clean_text(v[4])}"})
    return out


def column_bands(table: Table, value_cols: list[int]) -> tuple[dict[int, tuple[float, float]], float | None]:
    """Horizontal band of each value column (from its numeric cells) and the top of the first data row."""
    bands: dict[int, tuple[float, float]] = {}
    tops: list[float] = []
    for col in value_cols:
        boxes = [c.bbox for c in table.cells if c.col == col and c.bbox and not c.column_header
                 and parse_printed(c.text).value is not None]
        if boxes:
            bands[col] = (min(b[0] for b in boxes), max(b[2] for b in boxes))
            tops.append(min(b[1] for b in boxes))
    return bands, (min(tops) if tops else None)


def map_columns(table: Table, value_cols: list[int], words: list[Word], issue: str,
                spec: dict[str, Any]) -> tuple[dict[int, dict[str, Any]], list[str]]:
    """Each value column -> {role, period, header}. Established from the text layer by position.

    Three things must all hold, otherwise the table is left unmapped:
    1. the table has exactly the expected number of value columns;
    2. the bottom header line names, above each column, exactly the month the layout expects
       (issue month, previous month, same month last year) and no month above the weight column;
    3. the spanning header words (Weight, Indices, Change, Impact) sit above the columns the
       layout assigns to them, in that order.
    """
    cfg = spec["columns"]
    layout = cfg["layout"]
    problems: list[str] = []
    if len(value_cols) != len(layout):
        return {}, [f"the table has {len(value_cols)} value columns; {len(layout)} are expected"]
    bands, first_y = column_bands(table, value_cols)
    if first_y is None or len(bands) != len(value_cols):
        return {}, ["a value column has no parsed number, so its position is unknown"]
    ordered = [bands[c] for c in value_cols]
    if any(ordered[i][1] > ordered[i + 1][0] + 0.004 for i in range(len(ordered) - 1)):
        return {}, ["value columns overlap horizontally, so headers cannot be assigned by position"]
    top = first_y - cfg["header_lookback"]
    header_words = [w for w in words if top <= (w[1] + w[3]) / 2 < first_y - 0.001]
    # Column edges: half way between neighbouring bands.
    edges = [ordered[0][0] - 0.03] + [(ordered[i][1] + ordered[i + 1][0]) / 2 for i in range(len(ordered) - 1)] + [ordered[-1][1] + 0.03]

    def column_at(x: float) -> int | None:
        for i in range(len(ordered)):
            if edges[i] <= x < edges[i + 1]:
                return i
        return None

    tokens = [t for t in month_tokens(header_words) if column_at(t["x"]) is not None]
    by_col: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for t in tokens:
        by_col[column_at(t["x"])].append(t)
    bottom = {i: max(ts, key=lambda t: t["y"]) for i, ts in by_col.items()}
    month_cols = [i for i, spec_col in enumerate(layout) if spec_col["month"] != "none"]
    line_y = max((bottom[i]["y"] for i in month_cols if i in bottom), default=None)
    mapping: dict[int, dict[str, Any]] = {}
    for i, (col, want) in enumerate(zip(value_cols, layout)):
        tok = bottom.get(i)
        on_line = tok is not None and line_y is not None and abs(tok["y"] - line_y) <= cfg["header_line_tolerance"]
        header = column_header_text(table, col, header_words, lookback=cfg["header_lookback"])
        if want["month"] == "none":
            if on_line:
                problems.append(f"column {col}: a month ({tok['text']}) is printed above the expected weight column")
            period = issue
        else:
            period = month_add(issue, int(want["month"]))
            if not on_line:
                problems.append(f"column {col}: no month is printed on the bottom header line (expected {month_label(period)})")
            elif tok["period"] != period:
                problems.append(f"column {col}: header says {tok['text']}, expected {month_label(period)}")
        # An index belongs to the month its header names; a weight, a % change or an impact
        # belongs to the issue month (the header month is only what it is compared with).
        # Label shown on receipts: the spanning header word (checked below to sit above these columns)
        # and the month printed on the bottom header line. The raw words collected by position are kept.
        month_printed = tok["text"] if on_line else None
        group_name = HEADER_GROUP_NAMES.get(want["group"], want["group"])
        label = group_name if want["month"] == "none" else f"{group_name}: {month_printed}" if month_printed else header
        mapping[col] = {"role": want["role"], "period": period if want["role"] == "index" else issue, "header": label,
                        "header_words_by_position": header, "month_printed": month_printed}

    # Spanning header words must sit above their columns.
    for group, pattern in cfg["group_words"].items():
        idxs = [i for i, c in enumerate(layout) if c["group"] == group]
        x0, x1 = edges[idxs[0]], edges[idxs[-1] + 1]
        hits = [w for w in header_words if re.search(pattern, clean_text(w[4]).strip("()%:"))]
        if line_y is not None:
            hits = [w for w in hits if (w[1] + w[3]) / 2 < line_y + cfg["header_line_tolerance"]]
        if not hits:
            problems.append(f"the header word for '{group}' is not printed above the table")
            continue
        lowest = max(hits, key=lambda w: (w[1] + w[3]) / 2)
        cx = (lowest[0] + lowest[2]) / 2
        if not x0 <= cx < x1:
            problems.append(f"the header word '{clean_text(lowest[4])}' does not sit above the expected '{group}' column(s)")
    return mapping, problems


# ----------------------------------------------------------------------------- cells

def header_flagged_row_label(table: Table, grid: list[list[Any]], row: int, value_cols: list[int]) -> str:
    """Label of a data row that Docling marked as a header row: its own non-value cells, left to right.

    Cells spanning down from the real header rows above (e.g. 'No', 'Group') start in an earlier
    row and are left out.
    """
    parts: list[str] = []
    for k in range(table.num_cols):
        cell = grid[row][k]
        if k in value_cols or cell is None or cell.row != row or cell.col != k:
            continue
        if cell.text.strip():
            parts.append(cell.text.strip())
    return clean_text(" ".join(parts))


def build_cells(source, run, table: Table, area: str, caption: dict[str, Any], spec: dict[str, Any], labels: LabelMap,
                not_targeted: list[str]) -> tuple[list[Cell], dict[str, Any], dict[str, dict[str, Any]]]:
    """Cells of one located table, the table's info record and per-cell meaning (`meta`)."""
    pdf = source_path(source)
    words = page_words(pdf, table.page)
    value_cols = table.value_columns()
    expected = rebase_side(source.period, spec)
    flags = detect_table_flags(table, expected_value_columns=spec["expected_value_columns"])
    coverage = table_coverage(table, pdf)
    if coverage["coverage_row_band"] is not None and coverage["coverage_row_band"] < 0.90 <= (coverage["coverage"] or 0):
        flags.append("possible_dropped_column")
    if coverage["coverage"] is None or coverage["coverage"] < spec.get("min_table_coverage", 0.90):
        flags.append("low_coverage")
    col_map, col_problems = map_columns(table, value_cols, words, source.period, spec)
    if col_problems:
        flags.append("column_unmapped")
    base_ok = caption["base_year"] == expected["base_year"]
    if not base_ok:
        flags.append("base_not_confirmed")
    tag = base_tag(caption["base_year"])

    grid = table.grid()
    rows: list[tuple[int, str, str | None, str, list[Any], list[str]]] = []
    unmapped: list[str] = []
    ambiguous: list[str] = []
    relabelled: list[str] = []
    skipped: list[str] = []
    header_rows_as_data: list[str] = []
    for r in range(table.num_rows):
        row_cells = [grid[r][k] for k in value_cols if grid[r][k] is not None and grid[r][k].row == r and grid[r][k].col == k]
        if not row_cells or not any(c.text.strip() for c in row_cells):
            continue
        if not any(parse_printed(c.text).value is not None or parse_printed(c.text).is_missing for c in row_cells if c.text.strip()):
            continue  # a header row (marked as one by Docling or not)
        row_flags = list(flags)
        if all(c.column_header for c in row_cells):
            # Docling sometimes marks the first data row ("General") as a header row. It is data
            # only when every value column holds exactly one number in this row.
            if len(row_cells) != len(value_cols) or any(parse_printed(c.text).value is None for c in row_cells):
                continue
            label = header_flagged_row_label(table, grid, r, value_cols)
            row_flags.append("header_row_as_data")
            header_rows_as_data.append(label)
        else:
            label = row_label(table, grid, r, value_cols)
        key, how = labels.lookup(label)
        if key is None:
            alt = text_layer_row_label(table, grid, r, value_cols, words)
            alt_key, alt_how = labels.lookup(alt)
            if alt_key is not None:
                key, how, label = alt_key, alt_how, alt
                row_flags.append("row_label_from_text_layer")
                relabelled.append(alt)
        if key is None:
            if normalise_label(label) in not_targeted:
                skipped.append(label)
            else:
                (ambiguous if how == "ambiguous" else unmapped).append(label or "(row with no label)")
        rows.append((r, label, key, how, row_cells, row_flags))

    # The same row key twice in one table is ambiguous: neither row is mapped.
    counts = Counter(key for _, _, key, _, _, _ in rows if key)
    duplicated = sorted(k for k, n in counts.items() if n > 1)
    cells: list[Cell] = []
    meta: dict[str, dict[str, Any]] = {}
    mappable = not col_problems and base_ok
    for r, label, key, how, row_cells, row_flags in rows:
        if key in duplicated:
            ambiguous.append(label)
            key = None
        for tc in row_cells:
            if not tc.text.strip():
                continue
            col = col_map.get(tc.col)
            cell = make_cell(source=source, run=run, table=table, tcell=tc, row_label_raw=label,
                             col_label_raw=col["header"] if col else "", table_flags=row_flags)
            if col:
                cell.unit = "index" if col["role"] == "index" else "percent"
                cell.scale_factor = 1
            if key and col and mappable:
                meta[cell.cell_id] = {"source_id": source.source_id, "issue": source.period, "area": area, "base_tag": tag,
                                      "base_year": caption["base_year"], "row": key, "role": col["role"],
                                      "period": col["period"], "page": table.page, "table_index": table.table_index}
                sid = series_id_for(area, col["role"], key, tag)
                if sid:
                    cell.series_id, cell.period, cell.vintage, cell.mapping_method = sid, col["period"], "na", "dictionary"
            cells.append(cell)
    info = {
        "source_id": source.source_id, "area": area, "base_year": caption["base_year"], "base_confirmed": base_ok,
        "caption": caption["caption"], "page": table.page, "table_index": table.table_index, "run_id": run.run_id,
        "rows": table.num_rows, "cols": table.num_cols, "value_columns": value_cols, "table_flags": flags,
        "columns": {str(k): {"role": v["role"], "period": v["period"], "header": v["header"],
                             "month_printed": v["month_printed"]} for k, v in col_map.items()},
        "column_problems": col_problems, "unmapped_labels": unmapped, "ambiguous_labels": ambiguous,
        "not_targeted_rows": skipped, "header_rows_as_data": header_rows_as_data, "labels_from_text_layer": relabelled,
        "rows_mapped": sorted(k for k in counts if k not in duplicated), "coverage": coverage,
    }
    return cells, info, meta


# ----------------------------------------------------------------------------- checks

def group_tables(cells: list[Cell], meta: dict[str, dict[str, Any]]) -> dict[tuple[str, str], dict[str, Any]]:
    """(source_id, area) -> {issue, base_year, rows: {row key: {('weight'|'mom'|'yoy'|('index', period)): Cell}}}."""
    out: dict[tuple[str, str], dict[str, Any]] = {}
    for c in cells:
        m = meta.get(c.cell_id)
        if not m:
            continue
        t = out.setdefault((m["source_id"], m["area"]), {"source_id": m["source_id"], "area": m["area"], "issue": m["issue"],
                                                        "base_year": m["base_year"], "page": m["page"],
                                                        "table_index": m["table_index"], "rows": defaultdict(dict)})
        key = ("index", m["period"]) if m["role"] == "index" else m["role"]
        t["rows"][m["row"]].setdefault(key, c)
    return out


def _dec(cell: Cell | None) -> Decimal | None:
    return Decimal(cell.value_parsed) if cell is not None and cell.value_parsed is not None else None


def _ceil(value: Decimal, places: int = 6) -> Decimal:
    return value.quantize(Decimal(1).scaleb(-places), rounding=ROUND_CEILING)


def aggregation_tolerance(general: str, indices: list[str], weights: list[str]) -> Decimal:
    """Largest difference rounding alone can produce between sum(w x I)/100 and the printed general index.

    0.5 u_I x sum(w)/100 (group index rounding) + sum(0.5 u_w x I)/100 (weight rounding) + 0.5 u_G.
    """
    half = Decimal("0.5")
    u_i = max(last_digit_unit(v) for v in indices)
    u_w = max(last_digit_unit(v) for v in weights)
    w_sum = sum((Decimal(w) for w in weights), Decimal(0))
    i_sum = sum((abs(Decimal(v)) for v in indices), Decimal(0))
    return _ceil(half * u_i * w_sum / 100 + half * u_w * i_sum / 100 + half * last_digit_unit(general))


def pct_change(a: Decimal, b: Decimal) -> Decimal:
    return (a / b - 1) * 100


def recompute_tolerance(pct: str, a: str, b: str) -> Decimal:
    """Largest difference rounding alone can produce between (a/b - 1) x 100 and the printed percentage.

    0.5 u_p (the percentage's own rounding) + 100 x (0.5 u_a + 0.5 u_b x a/b) / b (index rounding).
    """
    half = Decimal("0.5")
    da, db = Decimal(a), Decimal(b)
    return _ceil(half * last_digit_unit(pct)
                 + 100 * (half * last_digit_unit(a) + half * last_digit_unit(b) * abs(da / db)) / abs(db))


def table_name(t: dict[str, Any], titles: dict[str, str]) -> str:
    return f"the {table_words(t['area'])} of the {titles.get(t['source_id'], t['source_id'])}"


def weights_sum_check(t: dict[str, Any], group_slugs: list[str], spec: dict[str, Any], titles: dict[str, str],
                      blocked: str | None) -> Check | None:
    target = t["rows"].get("general", {}).get("weight")
    members = [t["rows"][g]["weight"] for g in group_slugs if "weight" in t["rows"].get(g, {})]
    if target is None or not members:
        return None
    missing = [g for g in group_slugs if "weight" not in t["rows"].get(g, {})]
    if missing:
        blocked = blocked or f"the table does not carry a mapped weight for: {', '.join(missing)}"
    elif _dec(target) is not None and _dec(target) != 100:
        blocked = blocked or "the general weight is not printed as 100"
    return sum_check(check_type="weights_sum", dataset=DATASET, rule_id="cpi.weights_add_to_100", target=target,
                     members=[(c, 1) for c in members], what_members="the group weights", what_target="general weight",
                     column_label=f"the weight column of {table_name(t, titles)}", blocked_reason=blocked,
                     abs_tolerance=Decimal(spec["checks"]["weights_sum"]["abs_tolerance"]))


def index_aggregation_checks(t: dict[str, Any], group_slugs: list[str], titles: dict[str, str],
                             blocked: str | None) -> list[Check]:
    out: list[Check] = []
    general_row = t["rows"].get("general", {})
    for key in sorted(k for k in general_row if isinstance(k, tuple)):
        period = key[1]
        target = general_row[key]
        idx = [t["rows"].get(g, {}).get(key) for g in group_slugs]
        wts = [t["rows"].get(g, {}).get("weight") for g in group_slugs]
        members = [c for c in idx + wts if c is not None]
        reason = blocked
        computed = tolerance = None
        if any(c is None for c in idx + wts):
            reason = reason or "a group's weight or index is not mapped in this table"
        elif any(_dec(c) is None for c in [target, *members]):
            reason = reason or "an input could not be parsed"
        else:
            raw = sum((_dec(w) * _dec(i) for w, i in zip(wts, idx)), Decimal(0)) / 100
            computed = raw.quantize(Decimal(1).scaleb(-6))
            tolerance = aggregation_tolerance(target.value_parsed, [c.value_parsed for c in idx], [c.value_parsed for c in wts])
        what = f"the general index for {month_label(period)} from the group weights and indices in {table_name(t, titles)}"
        out.append(value_check(
            check_type="index_aggregation", dataset=DATASET, rule_id="cpi.general_is_weighted_mean_of_groups", target=target,
            members=members, computed=computed, tolerance=tolerance or Decimal(0), what=what, blocked_reason=reason,
            description_ok=(f"In {table_name(t, titles)}, the {len(group_slugs)} group indices for {month_label(period)} "
                            "weighted by the printed group weights should give the printed general index."),
        ))
    return out


def recompute_checks(t: dict[str, Any], titles: dict[str, str], blocked: str | None) -> list[Check]:
    out: list[Check] = []
    issue = t["issue"]
    for row in sorted(t["rows"]):
        cells = t["rows"][row]
        for role, lag, words in (("yoy", -12, "the same month last year"), ("mom", -1, "the previous month")):
            target = cells.get(role)
            if target is None or target.is_missing:
                continue
            ref_period = month_add(issue, lag)
            a, b = cells.get(("index", issue)), cells.get(("index", ref_period))
            members = [c for c in (a, b) if c is not None]
            reason = blocked
            computed = tolerance = None
            if a is None or b is None:
                reason = reason or "an index needed for the recomputation is not mapped in this table"
            elif _dec(a) is None or _dec(b) is None or _dec(target) is None or _dec(b) == 0:
                reason = reason or "an input could not be parsed"
            else:
                computed = pct_change(_dec(a), _dec(b)).quantize(Decimal(1).scaleb(-6))
                tolerance = recompute_tolerance(target.value_parsed, a.value_parsed, b.value_parsed)
            label = target.row_label_raw or row
            what = f"the % change of '{label}' over {words} in {table_name(t, titles)}"
            out.append(value_check(
                check_type="recompute", dataset=DATASET, rule_id=f"cpi.{role}_recomputes_from_indices", target=target,
                members=members, computed=computed, tolerance=tolerance or Decimal(0), what=what, blocked_reason=reason,
                description_ok=(f"In {table_name(t, titles)}, row '{label}': the index for {month_label(issue)} "
                                f"({fmt(a.value_parsed) if a is not None and a.value_parsed else 'n/a'}) against {month_label(ref_period)} "
                                f"({fmt(b.value_parsed) if b is not None and b.value_parsed else 'n/a'}) should give the printed % change over {words}."),
            ))
    return out


def cross_edition_checks(cells: list[Cell], titles: dict[str, str], order: dict[str, str],
                         series: dict[str, Series], blocked: dict[tuple[str, int, int], str] | None = None) -> list[Check]:
    """The same index for the same month printed in two issues (this June vs next year's 'same month last year')."""
    groups: dict[tuple[str, str], list[Cell]] = defaultdict(list)
    for c in cells:
        if c.series_id and c.period and c.unit == "index" and not c.is_missing:
            groups[(c.series_id, c.period)].append(c)
    out: list[Check] = []
    for (sid, period), group in sorted(groups.items()):
        group.sort(key=lambda c: (order.get(c.source_id, ""), c.page, c.row_index, c.col_index))
        first = group[0]
        name = series[sid].name if sid in series else sid
        for other in group[1:]:
            if other.source_id == first.source_id:
                continue
            if order.get(other.source_id) is not None and order.get(other.source_id) == order.get(first.source_id):
                continue        # two copies of one issue are not a second printing
            reason = next((blocked[k] for c in (first, other)
                           if (k := (c.source_id, c.page, c.table_index)) in (blocked or {})), None)
            out.append(equality_check(
                blocked_reason=reason,
                check_type="cross_edition", dataset=DATASET, rule_id="cpi.same_index_in_later_issue", first=first, second=other,
                what=f"{name}, {month_label(period)}",
                where_first=f"the {titles.get(first.source_id, first.source_id)} (column '{first.col_label_raw}')",
                where_second=f"the {titles.get(other.source_id, other.source_id)} (column '{other.col_label_raw}')",
            ))
    return out


def read_sbp_yoy(path, cfg: dict[str, Any]) -> dict[str, str]:
    """SBP EasyData CSV -> {'YYYY-MM': printed YoY text}. Rows of other series are ignored."""
    out: dict[str, str] = {}
    with open(path, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            if row.get("Series Key") != cfg["series_key"] or not re.search(cfg["series_name_pattern"], row.get("Series", "")):
                continue
            try:
                period = datetime.strptime(row["Observation Date"].strip(), "%d-%b-%Y").strftime("%Y-%m")
            except ValueError:
                continue
            out.setdefault(period, row["Observation Value"].strip())
    return out


def cross_source_checks(cells: list[Cell], sbp: dict[str, str], sbp_source_id: str, cfg: dict[str, Any],
                        titles: dict[str, str]) -> list[Check]:
    """PBS national YoY (general) against SBP EasyData. A disagreement is a recorded fail, never hidden."""
    out: list[Check] = []
    for c in sorted(cells, key=lambda c: (c.source_id, c.page, c.row_index, c.col_index)):
        if c.series_id != cfg["applies_to_series"] or c.period is None or c.period < cfg["first_period"] or c.is_missing:
            continue
        theirs = parse_printed(sbp.get(c.period, ""))
        if c.period not in sbp:
            continue
        base = dict(check_id=check_id_for("cross_source", "cpi.yoy_matches_sbp_easydata", c.cell_id, sbp_source_id),
                    check_type="cross_source", dataset=DATASET, rule_id="cpi.yoy_matches_sbp_easydata",
                    source_ids=sorted({c.source_id, sbp_source_id}), target_cell_id=c.cell_id, target_source=sbp_source_id,
                    tolerance_rule=cfg["rule"])
        where = f"National CPI change over the same month last year, {month_label(c.period)}"
        if theirs.value is None or c.value_parsed is None:
            out.append(Check(**base, result="not_evaluable", not_evaluable_reason="one of the two figures could not be parsed",
                             description=f"Could not compare {where} with SBP EasyData."))
            continue
        ours = Decimal(c.value_parsed)
        tol = Decimal("0.5") * last_digit_unit(theirs.value_str) + Decimal("0.5") * last_digit_unit(c.value_parsed)
        residual = theirs.value - ours
        if residual == 0:
            result, verdict = "pass", "They are equal."
        elif abs(residual) <= tol:
            result, verdict = "pass_within_rounding", "They agree once the PBS figure is rounded the way SBP prints it."
        else:
            result, verdict = "fail", f"They differ by {fmt(abs(residual))}, more than rounding allows, so the two sources disagree."
        out.append(Check(**base, target_value=theirs.value_str, expected=c.value_parsed, observed=theirs.value_str,
                         residual=decimal_to_str(residual), result=result,
                         description=(f"{where}: the {titles.get(c.source_id, c.source_id)} prints {fmt(ours)}; "
                                      f"SBP EasyData gives {fmt(theirs.value)}. {verdict}")))
    return out


def flag_odd_precision(t: dict[str, Any]) -> set[str]:
    """Rows holding a figure whose decimals differ from its column (review finding CPI-3).

    Every tolerance here is derived from printed precision. A truncated reading ("271" for 271.10)
    would widen its own tolerances and pass, so precision is taken from the column: a cell that
    differs from the clear majority of its column is flagged (blocking) and its table's checks are
    not run.
    """
    columns: dict[Any, list[tuple[str, Cell]]] = defaultdict(list)
    for row, by_key in t["rows"].items():
        for key, c in by_key.items():
            if c.value_parsed is not None and not c.is_missing:
                columns[key].append((row, c))
    odd_rows: set[str] = set()
    for key, members in columns.items():
        if len(members) < 3:
            continue
        counts: dict[Decimal, int] = defaultdict(int)
        for _, c in members:
            counts[last_digit_unit(c.value_parsed)] += 1
        unit, n = max(counts.items(), key=lambda kv: kv[1])
        if n == len(members):
            continue
        for row, c in members:
            if last_digit_unit(c.value_parsed) != unit or n * 2 <= len(members):
                odd_rows.add(row)
                if "precision_differs_from_column" not in c.normalization_flags:
                    c.normalization_flags = [*c.normalization_flags, "precision_differs_from_column"]
    return odd_rows


_BASKET: dict[tuple[str, str, str], str] | None = None


def basket_weights() -> dict[tuple[str, str, str], str]:
    """(base year, area, group) -> basket weight, from specs/cpi_basket_weights.yaml (generated by code)."""
    global _BASKET
    if _BASKET is None:
        path = config.SPECS_DIR / "cpi_basket_weights.yaml"
        data = load_spec("cpi_basket_weights") if path.exists() else {"weights": []}
        _BASKET = {(w["base_year"], w["area"], w["group"]): str(w["weight"]) for w in data.get("weights", [])}
    return _BASKET


def basket_weight_checks(t: dict[str, Any], basket: dict[tuple[str, str, str], str], titles: dict[str, str],
                         blocked: str | None = None) -> tuple[list[Check], set[str]]:
    """The weight printed beside a group must be that group's basket weight (review finding CPI-4).

    Sums and weighted means do not change when two rows swap labels, so nothing else ties a row's
    figures to its name. A group's weight is fixed for a base year and differs between groups; a
    row whose printed weight is not its group's weight is not that group's row. Returns the checks
    and the rows that failed. A group with no recorded weight gets no check.
    """
    out: list[Check] = []
    mismatched: set[str] = set()
    for row in sorted(t["rows"]):
        cell = t["rows"][row].get("weight")
        expected = basket.get((t["base_year"], t["area"], row))
        if cell is None or expected is None or cell.is_missing:
            continue
        base = dict(check_id=check_id_for("reference_value", "cpi.weight_is_the_groups_basket_weight", cell.cell_id),
                    check_type="reference_value", dataset=DATASET, rule_id="cpi.weight_is_the_groups_basket_weight",
                    source_ids=[cell.source_id], target_cell_id=cell.cell_id, target_value=expected,
                    target_source="specs/cpi_basket_weights.yaml",
                    tolerance_rule="The printed weight must equal the group's basket weight exactly.")
        label = cell.row_label_raw or row
        if blocked:
            out.append(Check(**base, result="not_evaluable", not_evaluable_reason=blocked,
                             description=f"Could not compare the weight of '{label}' in {table_name(t, titles)} with its basket weight: {blocked}."))
            continue
        if cell.value_parsed is None:
            out.append(Check(**base, result="not_evaluable", not_evaluable_reason="the printed weight could not be parsed",
                             description=f"Could not compare the weight of '{label}' in {table_name(t, titles)} with its basket weight."))
            mismatched.add(row)
            continue
        residual = Decimal(cell.value_parsed) - Decimal(expected)
        ok = residual == 0
        if not ok:
            mismatched.add(row)
        out.append(Check(**base, expected=expected, observed=cell.value_parsed, residual=decimal_to_str(residual),
                         result="pass" if ok else "fail",
                         description=(f"In {table_name(t, titles)}, the row read as '{label}' prints weight {fmt(cell.value_parsed)}; "
                                      f"the basket weight recorded for this group is {fmt(expected)}. "
                                      + ("They are equal, so the row is the group it is labelled as."
                                         if ok else "They differ, so the row's figures are not attributed to this group."))))
    return out, mismatched


def run_checks(cells: list[Cell], meta: dict[str, dict[str, Any]], spec: dict[str, Any], titles: dict[str, str],
               order: dict[str, str], series: dict[str, Series], blocked: dict[tuple[str, int, int], str]) -> list[Check]:
    group_slugs = [g["slug"] for g in spec["groups"]]
    checks: list[Check] = []
    basket = basket_weights()
    for key, t in sorted(group_tables(cells, meta).items()):
        reason = blocked.get((t["source_id"], t["page"], t["table_index"]))
        odd = flag_odd_precision(t)
        if odd and not reason:
            reason = ("a figure's printed precision differs from the rest of its column, so a reading may be truncated "
                      f"(row(s): {', '.join(sorted(odd))})")
        weight_checks, mismatched = basket_weight_checks(t, basket, titles, reason)
        checks += weight_checks
        if mismatched and not reason:
            reason = ("the weight printed beside a group differs from that group's basket weight, so the row labels are "
                      f"not confirmed (row(s): {', '.join(sorted(mismatched))})")
        ws = weights_sum_check(t, group_slugs, spec, titles, reason)
        if ws is not None:
            checks.append(ws)
        checks += index_aggregation_checks(t, group_slugs, titles, reason)
        checks += recompute_checks(t, titles, reason)
    checks += cross_edition_checks(cells, titles, order, series, blocked)
    return checks


# ----------------------------------------------------------------------------- gaps

def expected_observations(source_period: str, spec: dict[str, Any]) -> list[tuple[str, str, str]]:
    """(area, series_id, period) an issue is expected to print for the targeted rows."""
    side = rebase_side(source_period, spec)
    rows = ["general"] + [g["slug"] for g in spec["groups"]]
    out: list[tuple[str, str, str]] = []
    for area in side["areas"]:
        for row in rows:
            for lag in (0, -1, -12):
                out.append((area, series_id_for(area, "index", row, side["tag"]), month_add(source_period, lag)))
            out.append((area, series_id_for(area, "yoy", row, side["tag"]), source_period))
            out.append((area, series_id_for(area, "mom", row, side["tag"]), source_period))
            if row != "general":
                out.append((area, series_id_for(area, "weight", row, side["tag"]), source_period))
    return out


def gap_observations(spec: dict[str, Any], sources: list[Any], located: dict[str, dict[str, Any]], not_located: dict[str, str],
                     observations: list[Observation], series: dict[str, Series]) -> list[Observation]:
    """Expected figures that have no cell: a labelled gap, never a blank.

    Always `not_yet_verified`: the tables print these rows in every issue we have seen, so a
    missing figure is our failure to capture or map it, not the government's omission.
    """
    have = {o.obs_id for o in observations}
    out: list[Observation] = []
    for src in sources:
        for area, series_id, period in expected_observations(src.period, spec):
            oid = obs_id_for(series_id, period, "na")
            if oid in have or series_id not in series:
                continue
            have.add(oid)
            key = f"{src.source_id}:{area}"
            if key in not_located:
                reason = f"{not_located[key]} in the {src.title}."
            elif located.get(key, {}).get("column_problems") or not located.get(key, {}).get("base_confirmed", True):
                reason = (f"The column headings of the {table_words(area)} in the {src.title} could not be confirmed by code, "
                          "so no figure from it is shown.")
            else:
                reason = (f"A row of the {table_words(area)} in the {src.title} could not be matched to a group with "
                          "certainty, so this figure is not shown.")
            s = series[series_id]
            out.append(Observation(obs_id=oid, series_id=series_id, period=period, vintage="na", unit=s.unit,
                                   scale_factor=s.scale_factor, status="unchecked", published=False,
                                   gap_kind="not_yet_verified", gap_reason=reason, evidence_summary=reason))
    return out


# ----------------------------------------------------------------------------- build

def build(release: str = config.DEFAULT_RELEASE) -> dict[str, Any]:
    spec = load_spec("cpi")
    labels_spec = load_spec("cpi_labels")
    labels = LabelMap(labels_spec["labels"])
    not_targeted = [normalise_label(x) for x in labels_spec.get("not_targeted", [])]
    manifest = read_manifest()
    sources = sorted((s for s in manifest if s.doc_type == DOC_TYPE), key=lambda s: s.period)
    titles = {s.source_id: s.title for s in sources}
    order = {s.source_id: s.period for s in sources}
    catalogue = series_catalogue(spec)
    series = {s.series_id: s for s in catalogue}

    cells: list[Cell] = []
    meta: dict[str, dict[str, Any]] = {}
    located: dict[str, dict[str, Any]] = {}
    not_located: dict[str, str] = {}
    locator_log: dict[str, Any] = {}
    coverage: list[dict[str, Any]] = []
    blocked: dict[tuple[str, int, int], str] = {}
    for source in sources:
        expected = rebase_side(source.period, spec)
        got = validated_tables(source)
        if got is None:
            for area in expected["areas"]:
                not_located[f"{source.source_id}:{area}"] = "No validated extraction run exists"
            continue
        run, tables = got
        pdf = source_path(source)
        page_texts = {p: clean_text(" ".join(w[4] for w in page_words(pdf, p))) for p in sorted({t.page for t in tables})}
        captions = find_captions(page_texts, spec)
        found, problems, log = locate(tables, captions, expected, spec)
        locator_log[source.source_id] = log
        for area, reason in problems.items():
            not_located[f"{source.source_id}:{area}"] = reason
        for area, (table, caption) in found.items():
            table_cells, tinfo, tmeta = build_cells(source, run, table, area, caption, spec, labels, not_targeted)
            located[f"{source.source_id}:{area}"] = tinfo
            # D28: a table with merged rows or a lost column goes to the second reader; its reading
            # replaces the first only if this table's arithmetic checks pass on it.
            second = try_second_reader(
                source=source, table=table, table_flags=tinfo["table_flags"], first_cells=table_cells,
                expected_value_columns=spec["expected_value_columns"],
                build=lambda t2, a=area, c=caption: build_cells(source, run, t2, a, c, spec, labels, not_targeted),
                checks=lambda c2, m2: run_checks(c2, m2, spec, titles, order, series, {}),
                required_checks=("weights_sum", "index_aggregation", "recompute"))
            promoted = second is not None and second["promoted"]
            table_cov = dict(tinfo["coverage"])
            if second is not None:
                tinfo["second_reader"] = second["record"]
            if promoted:
                table_cells, tmeta = table_cells + second["cells"], second["meta"]
                table_cov = {**second["coverage"], "reader": second["record"]["reading"]["reader"],
                             "first_reader_coverage": tinfo["coverage"]}
            cells.extend(table_cells)
            meta.update(tmeta)
            coverage.append({"dataset": DATASET, "source_id": source.source_id,
                             "table": f"CPI by group ({area}, base {caption['base_year']})", **table_cov})
            bad = sorted(set(tinfo["table_flags"]) & BLOCKING_TABLE_FLAGS)
            if bad and not promoted:
                blocked[(source.source_id, table.page, table.table_index)] = f"the table is flagged {', '.join(bad)}"
            overlay = config.work_dir() / "qa" / f"overlay_{source.source_id}_p{table.page:03d}.png"
            render_overlay(pdf, table, overlay)

    checks = run_checks(cells, meta, spec, titles, order, series, blocked)
    cfg = spec["checks"]["cross_source_sbp"]
    sbp_sources = [s for s in manifest if s.doc_type == cfg["doc_type"] and s.verification_status != "failed"]
    if sbp_sources:
        sbp_src = sorted(sbp_sources, key=lambda s: s.period)[-1]
        sbp_checks = cross_source_checks(cells, read_sbp_yoy(source_path(sbp_src), cfg), sbp_src.source_id, cfg, titles)
        checks += sbp_checks
        cross_source_info: dict[str, Any] = {"status": "compared", "source_id": sbp_src.source_id, "checks": len(sbp_checks)}
    else:
        cross_source_info = {"status": "skipped", "reason": "no sbp_easydata source is registered in sources/manifest.csv"}

    checks = classify_disputes(checks, cells)  # D25: a differing pair that each add up is `disputed`, by code
    observations = build_observations(cells, checks, series, order, titles, release)
    observations += gap_observations(spec, sources, located, not_located, observations, series)
    used = {o.series_id for o in observations}
    catalogue = [s for s in catalogue if s.series_id in used]

    info = {
        "dataset": DATASET, "built_at": config.now_iso(), "located": located, "not_located": not_located,
        "locator": locator_log,
        "check_pass_rates": {
            "all": pass_rate(checks),
            "arithmetic": pass_rate(checks, ["weights_sum", "index_aggregation", "recompute"]),
            "weights_sum": pass_rate(checks, ["weights_sum"]),
            "index_aggregation": pass_rate(checks, ["index_aggregation"]),
            "recompute": pass_rate(checks, ["recompute"]),
            "cross_edition": pass_rate(checks, ["cross_edition"]),
            "cross_source": pass_rate(checks, ["cross_source"]),
        },
        "cross_source_sbp": cross_source_info,
    }
    save_dataset(DATASET, cells=cells, checks=checks, series=catalogue, observations=observations, coverage=coverage, info=info)
    return info
