"""Federal Annual Budget Statement: the function-wise detail tables (decision D31).

After the Summary of Expenditure every edition prints, over about seven pages,
each function (codes 01-10) with its sub-functions (3-digit codes), in parts
that each END with their total line ("a. Current Expenditure on Revenue
Account", "c. Dev. Exp. on Revenue Account", ...). This module

1. finds that run of tables (it starts right after the located summary table),
2. recognises rows by printed code + name (`specs/abs_detail_labels.yaml`),
3. gives every function block to the part whose total line follows it,
4. tests the assignment by arithmetic: sub-functions add to their function,
   functions add to the part total, and every line that the summary table
   also prints must equal it.

It never adds development to current spending: the document prints no figure
per function for "development" or "total", so none is made here.

Driven by `specs/abs_detail.yaml`; switched on or off by its `enabled` flag.
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Callable

from .. import config
from ..checks import equality_check, sum_check
from ..normalise import clean_text, detect_scale, normalise_label, parse_printed
from ..schema import Cell, Check, Series, SeriesBreak
from ..tables import Table, TCell
from ..validate import BLOCKING_TABLE_FLAGS, detect_table_flags
from .common import make_cell, row_label, text_layer_row_label

DATASET = "abs"
VINTAGE_NAMES = {"be": "Budget Estimates", "re": "Revised Estimates"}
CODED = re.compile(r"^(\d{2,3})\s+(\S.*)$")
Words = list[tuple[float, float, float, float, str]]
TableKey = tuple[str, int, int]


# ---------------------------------------------------------------- labels

@dataclass(frozen=True)
class Resolved:
    kind: str                      # function | subfunction | closing | total | unknown_code
    code: str = ""                 # classification code (function "07", sub-function "073")
    slug: str = ""                 # function / sub-function slug
    part: str = ""                 # closing: part id
    series: str = ""               # closing / total: series of the line itself


class DetailLabels:
    """Printed label -> what the row is. Code and whole name must both match; no partial matches."""

    def __init__(self, spec: dict[str, Any], labels_spec: dict[str, Any]):
        self.functions = {f["code"]: (f, re.compile(f["pattern"], re.I)) for f in labels_spec["functions"]}
        self.subfunctions = [(s, tuple(s.get("printed_codes") or [s["code"]]), re.compile(s["pattern"], re.I))
                             for s in labels_spec["subfunctions"]]
        self.parts = {p["id"]: p for p in spec["parts"]}
        self.closings = [(p, re.compile(p["closing"], re.I)) for p in spec["parts"]]
        self.totals = [(t["series"], re.compile(t["pattern"], re.I)) for t in spec.get("totals", [])]

    def resolve(self, raw_label: str) -> Resolved | None:
        """None means: an uncoded row we do not recognise (detail below sub-function level, a heading, ...)."""
        label = clean_text(raw_label)
        m = CODED.match(label)
        if m:
            code, name = m.group(1), normalise_label(m.group(2))
            hits: set[Resolved] = set()
            if code in self.functions and self.functions[code][1].fullmatch(name):
                hits.add(Resolved("function", code=code, slug=self.functions[code][0]["slug"]))
            for entry, printed, pattern in self.subfunctions:
                if code in printed and pattern.fullmatch(name):
                    hits.add(Resolved("subfunction", code=entry["code"], slug=entry["slug"]))
            if len(hits) == 1:
                return hits.pop()
            return Resolved("unknown_code", code=code)
        name = normalise_label(label)
        hits = {Resolved("closing", part=p["id"], series=p["total_series"]) for p, pattern in self.closings if pattern.fullmatch(name)}
        hits |= {Resolved("total", series=series) for series, pattern in self.totals if pattern.fullmatch(name)}
        return hits.pop() if len(hits) == 1 else None


# ---------------------------------------------------------------- rows

@dataclass
class Row:
    table: Table
    row: int
    label: str
    resolved: Resolved | None
    label_source: str                               # docling | text_layer
    tcells: list[TCell]
    cells: dict[tuple[str, str], Cell] = field(default_factory=dict)   # (period, vintage) -> cell, once mapped
    series_id: str | None = None


def value_rows(table: Table) -> list[tuple[int, list[TCell]]]:
    """Rows that carry printed amounts. A row Docling flagged as a header still counts when every
    value column holds exactly one number (AGENTS.md section 7: first data rows marked as headers)."""
    grid = table.grid()
    value_cols = table.value_columns()
    out: list[tuple[int, list[TCell]]] = []
    for r in range(table.num_rows):
        cells = [grid[r][k] for k in value_cols if grid[r][k] is not None and grid[r][k].row == r and grid[r][k].col == k]
        if not cells or not any(c.text.strip() for c in cells):
            continue
        if all(c.column_header for c in cells):
            parsed = [parse_printed(c.text) for c in cells]
            if len(cells) != len(value_cols) or not all(p.value is not None or p.is_missing for p in parsed):
                continue
        out.append((r, cells))
    return out


def read_rows(table: Table, labels: DetailLabels, words: Words | None) -> list[Row]:
    """Recognise each amount row from Docling's label, falling back to the PDF text layer.

    If both readings are recognised but as different things, the row is treated as an
    unknown coded row: nothing is mapped and the sums around it become not evaluable.
    """
    grid = table.grid()
    value_cols = table.value_columns()
    out: list[Row] = []
    found = value_rows(table)
    amount_rows = {r for r, _ in found}
    for r, cells in found:
        label = row_label(table, grid, r, value_cols)
        if not label and all(c.column_header for c in cells):
            # a data row Docling flagged as a header: `row_label` skips header cells, so read them here
            label = clean_text(" ".join(grid[r][k].text.strip() for k in range(table.num_cols) if k not in value_cols
                                        and grid[r][k] is not None and grid[r][k].row == r and grid[r][k].col == k))
        got = labels.resolve(label)
        source = "docling"
        if words is not None and (got is None or got.kind == "unknown_code"):
            alt_label = text_layer_row_label(table, grid, r, value_cols, words)
            alt = labels.resolve(alt_label)
            if alt is not None and alt.kind != "unknown_code":
                got, label, source = alt, alt_label, "text_layer"
            elif got is None and alt is not None:
                got = alt                                 # an unknown code seen only in the text layer still counts
        if got is None or got.kind == "unknown_code":
            joined = _joined_with_line_above(table, grid, r, value_cols, amount_rows, label)
            alt = labels.resolve(joined) if joined else None
            if alt is not None and alt.kind != "unknown_code":
                got, label, source = alt, joined, "two_rows_joined"
        out.append(Row(table=table, row=r, label=label, resolved=got, label_source=source, tcells=cells))
    return out


def _joined_with_line_above(table: Table, grid, r: int, value_cols: list[int], amount_rows: set[int], label: str) -> str:
    """A label wrapped over two table rows: the row above carries text but no amounts.

    "097 Education Affairs & Services not" / "Elsewhere Classified  1,234" -> one label, code first.
    The joined text is only used if the dictionary then matches it in full.
    """
    if r == 0 or (r - 1) in amount_rows:
        return ""
    above = row_label(table, grid, r - 1, value_cols)
    if not above:
        return ""
    here, up = CODED.match(clean_text(label)), CODED.match(clean_text(above))
    if up and not here:
        return f"{above} {label}"
    if here and not up:
        return f"{here.group(1)} {above} {here.group(2)}"
    return ""


def locate_detail(tables: list[Table], summary: Table, labels: DetailLabels, min_rows: int) -> list[Table]:
    """The run of tables right after the Summary of Expenditure whose rows are function-wise lines.

    Located by content only: the summary table is found by the ten function names, and the run
    continues while tables keep carrying recognised function / sub-function / total rows.
    """
    start = next((i for i, t in enumerate(tables) if t is summary), None)
    if start is None:
        return []
    run: list[Table] = []
    for t in tables[start + 1:]:
        recognised = sum(1 for row in read_rows(t, labels, None) if row.resolved is not None and row.resolved.kind != "unknown_code")
        if recognised < min_rows:
            break
        run.append(t)
    return run


# ---------------------------------------------------------------- structure

@dataclass
class Block:
    function: Row
    subs: list[Row] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)


@dataclass
class Part:
    part_id: str
    closing: Row
    blocks: list[Block]
    problems: list[str]
    tables: list[Table]


@dataclass
class Structure:
    parts: list[Part] = field(default_factory=list)
    totals: list[Row] = field(default_factory=list)
    unassigned: list[str] = field(default_factory=list)       # function blocks that no total line closed
    notes: list[str] = field(default_factory=list)


def walk(rows: list[Row]) -> Structure:
    """Give every function block to the part whose total line follows it.

    Guards (each one leaves numbers unmapped or sums not evaluable, never guessed):
    - function codes must rise inside a part; a restart means a total line was missed, so the
      blocks collected so far are dropped;
    - a sub-function row must sit under the function its code starts with, otherwise the part's
      sum is not evaluable (a function line was probably lost);
    - a coded row the dictionary does not know makes its function's sum not evaluable;
    - a total line printed twice in one edition closes nothing: the label cannot say which of the two
      lines a block belongs to, so the blocks above both occurrences are dropped.
    """
    out = Structure()
    blocks: list[Block] = []
    current: Block | None = None
    problems: list[str] = []
    tables: list[Table] = []
    seen_parts: set[str] = set()

    def reset() -> None:
        nonlocal blocks, current, problems, tables
        blocks, current, problems, tables = [], None, [], []

    def drop(reason: str) -> None:
        for b in blocks:
            out.unassigned.append(f"p.{b.function.table.page} '{b.function.label}': {reason}")
        reset()

    for row in rows:
        got = row.resolved
        if not any(t is row.table for t in tables):
            tables.append(row.table)
        if got is None:
            continue
        if got.kind == "function":
            if blocks and got.code <= blocks[-1].function.resolved.code:
                drop("function codes restart with no total line in between")
                tables.append(row.table)          # this row starts the next collection
            current = Block(function=row)
            blocks.append(current)
        elif got.kind == "subfunction":
            if current is not None and got.code.startswith(current.function.resolved.code):
                if any(s.resolved.slug == got.slug for s in current.subs):
                    current.problems.append(f"the sub-function '{row.label}' is printed twice")
                else:
                    current.subs.append(row)
            else:
                problems.append(f"the sub-function row '{row.label}' (p.{row.table.page}) is not under its function line")
                if current is not None:
                    current.problems.append(problems[-1])
                current = None
        elif got.kind == "unknown_code":
            if current is not None and len(got.code) == 3 and got.code.startswith(current.function.resolved.code):
                current.problems.append(f"the row '{row.label}' (p.{row.table.page}) is not in the label dictionary")
            else:
                problems.append(f"the coded row '{row.label}' (p.{row.table.page}) is not in the label dictionary")
                if current is not None:
                    current.problems.append(problems[-1])
                current = None
        elif got.kind == "closing":
            if got.part in seen_parts:
                # One label, two different lines: ABS 2012-13 prints "d. Dev. Expenditure on Capital Account"
                # first for the PSDP part and again for the whole. Which one a block belongs to cannot be
                # told from the label, so neither occurrence closes a part and nothing above either is mapped.
                out.notes.append(f"p.{row.table.page} '{row.label}': this total line is printed twice in the edition; "
                                 "neither occurrence is used and the function lines above them are not mapped")
                for earlier in [p for p in out.parts if p.part_id == got.part]:
                    out.parts.remove(earlier)
                    for b in earlier.blocks:
                        out.unassigned.append(f"p.{b.function.table.page} '{b.function.label}': its total line is printed twice in the edition")
                drop("its total line is printed twice in the edition")
                continue
            seen_parts.add(got.part)
            out.parts.append(Part(part_id=got.part, closing=row, blocks=blocks, problems=problems, tables=tables))
            reset()
        elif got.kind == "total":
            if blocks:
                drop("followed by a total line that does not close a part")
            reset()
            out.totals.append(row)
    if blocks:
        drop("no total line follows")
    return out


# ---------------------------------------------------------------- series

def function_series_id(part: dict[str, Any], slug: str) -> str:
    return f"{part['function_prefix']}.{slug}"


def series_catalogue(spec: dict[str, Any], labels_spec: dict[str, Any], abs_spec: dict[str, Any],
                     existing: set[str]) -> list[Series]:
    """Every series the detail tables can yield (the caller keeps only those that got an observation)."""
    breaks = [SeriesBreak(**b) for b in abs_spec.get("breaks", [])]
    out: list[Series] = []

    def add(series_id: str, name: str, parent: str | None, definition: str, sort: int, dims: dict[str, str]) -> None:
        if series_id in existing or any(s.series_id == series_id for s in out):
            return
        out.append(Series(series_id=series_id, name=name, parent_id=parent, dataset=DATASET, frequency="fiscal_year", unit="PKR",
                          scale_factor=abs_spec["scale_factor"], definition=definition, definition_status="draft", breaks=breaks,
                          source_doc_types=["abs"], sort_key=sort, dims=dims))

    for part in spec["parts"]:
        add(part["total_series"], part["what"].capitalize(), None,
            f"Federal {part['what']}, as printed in the Annual Budget Statement.", part["sort"], {})
        for i, f in enumerate(labels_spec["functions"]):
            fid = function_series_id(part, f["slug"])
            add(fid, f"{f['name']} ({part['qualifier']})", part["total_series"],
                f"Function {f['code']}. Federal {part['what']} for {f['name'].lower()}, as printed in the function-wise detail "
                "tables of the Annual Budget Statement. It is one part of federal spending on this function, not the whole.",
                part["sort"] + 10 * (i + 1), {"function": f["name"], "part": part["id"]})
            subs = [s for s in labels_spec["subfunctions"] if s["code"].startswith(f["code"])]
            for j, s in enumerate(subs):
                add(f"{fid}.{s['slug']}", f"{s['name']} ({part['qualifier']})", fid,
                    f"Sub-function {s['code']} of function {f['code']} ({f['name']}). Federal {part['what']}, as printed in the "
                    "function-wise detail tables of the Annual Budget Statement.",
                    part["sort"] + 10 * (i + 1) + 1 + min(j, 8),
                    {"function": f["name"], "sub_function_code": s["code"], "part": part["id"]})
    return out


# ---------------------------------------------------------------- cells

def table_key(source_id: str, table: Table) -> TableKey:
    return (source_id, table.page, table.table_index)


def build_source(*, source, run, tables: list[Table], spec: dict[str, Any], abs_spec: dict[str, Any], labels: DetailLabels,
                 words_for: Callable[[Table], Words], coverage_for: Callable[[Table], dict[str, Any]],
                 map_columns: Callable[..., tuple[dict[int, tuple[str, str, str]], list[str]]]) -> dict[str, Any]:
    """Cells, structure and table facts for one edition's detail tables (PDF access is injected)."""
    rows: list[Row] = []
    blocked: dict[TableKey, str] = {}
    table_info: list[dict[str, Any]] = []
    cells: list[Cell] = []
    col_maps: dict[TableKey, dict[int, tuple[str, str, str]]] = {}
    row_flags: dict[TableKey, list[str]] = {}
    for table in tables:
        key = table_key(source.source_id, table)
        words = words_for(table)
        value_cols = table.value_columns()
        flags = detect_table_flags(table, expected_value_columns=spec["expected_value_columns"])
        coverage = coverage_for(table)
        if coverage.get("coverage_row_band") is not None and coverage["coverage_row_band"] < 0.90 <= (coverage.get("coverage") or 0):
            flags.append("possible_dropped_column")
        if coverage.get("coverage") is None or coverage["coverage"] < spec.get("min_table_coverage", 0.90):
            flags.append("low_coverage")
        col_map, col_problems = map_columns(table, value_cols, words, source.period, abs_spec)
        if col_problems:
            flags.append("column_unmapped")
        page_text = clean_text(" ".join(w[4] for w in words))
        scale = detect_scale(page_text)
        scale_ok = scale == abs_spec["scale_factor"] and re.search(abs_spec["scale_marker"], page_text) is not None
        if not scale_ok:
            flags.append("scale_not_confirmed")
        bad = sorted((set(flags) & BLOCKING_TABLE_FLAGS) | (set(flags) & {"column_unmapped", "scale_not_confirmed"}))
        if bad:
            blocked[key] = f"the table on p.{table.page} is flagged {', '.join(bad)}"
        col_maps[key] = col_map if not col_problems and scale_ok else {}
        row_flags[key] = flags
        table_rows = read_rows(table, labels, words)
        rows.extend(table_rows)
        table_info.append({
            "source_id": source.source_id, "page": table.page, "table_index": table.table_index, "rows": table.num_rows,
            "cols": table.num_cols, "value_columns": value_cols, "table_flags": flags, "column_problems": col_problems,
            "columns": {str(k): {"period": v[0], "vintage": v[1], "header": v[2]} for k, v in col_map.items()},
            "scale_confirmed": bool(scale_ok), "coverage": coverage, "amount_rows": len(table_rows),
            "rows_recognised": sum(1 for r in table_rows if r.resolved is not None and r.resolved.kind != "unknown_code"),
            "rows_with_unknown_code": [r.label for r in table_rows if r.resolved is not None and r.resolved.kind == "unknown_code"],
            "labels_from_text_layer": [r.label for r in table_rows if r.label_source == "text_layer"],
            "labels_joined_from_two_rows": [r.label for r in table_rows if r.label_source == "two_rows_joined"],
        })

    structure = walk(rows)
    # series for every row that the structure placed
    for part in structure.parts:
        pspec = labels.parts[part.part_id]
        part.closing.series_id = pspec["total_series"]
        for block in part.blocks:
            block.function.series_id = function_series_id(pspec, block.function.resolved.slug)
            for sub in block.subs:
                sub.series_id = f"{block.function.series_id}.{sub.resolved.slug}"
    for row in structure.totals:
        row.series_id = row.resolved.series

    for row in rows:
        key = table_key(source.source_id, row.table)
        col_map = col_maps[key]
        flags = list(row_flags[key])
        if row.label_source == "text_layer":
            flags.append("row_label_from_text_layer")
        if row.label_source == "two_rows_joined":
            flags.append("row_label_joined_from_two_rows")
        for tc in row.tcells:
            if not tc.text.strip():
                continue
            period, vintage, header = col_map.get(tc.col, (None, None, ""))
            cell = make_cell(source=source, run=run, table=row.table, tcell=tc, row_label_raw=row.label, col_label_raw=header,
                             table_flags=flags)
            cell.unit = "PKR"
            cell.scale_factor = abs_spec["scale_factor"] if col_map else None
            if row.series_id and period:
                cell.series_id, cell.period, cell.vintage, cell.mapping_method = row.series_id, period, vintage, "dictionary"
                row.cells[(period, vintage)] = cell
            cells.append(cell)

    closed = {p.part_id for p in structure.parts}
    missing_groups = [group for group in spec["locator"]["required_parts"] if not closed & set(group)]
    return {
        "cells": cells, "structure": structure, "blocked": blocked, "tables": table_info,
        "located": bool(tables) and not missing_groups,
        "parts_closed": [p.part_id for p in structure.parts], "parts_missing": missing_groups,
        "pages": [t.page for t in tables],
    }


# ---------------------------------------------------------------- checks

def _blocked_reason(source_id: str, tables: list[Table], blocked: dict[TableKey, str]) -> str | None:
    return next((blocked[table_key(source_id, t)] for t in tables if table_key(source_id, t) in blocked), None)


def structure_checks(source_id: str, structure: Structure, blocked: dict[TableKey, str], spec: dict[str, Any],
                     labels: DetailLabels, column_label_for: Callable[[Cell], str]) -> list[Check]:
    """Sub-functions add to their function; functions add to the total line of their part."""
    out: list[Check] = []
    sub_rule, fn_rule = spec["rules"]["subfunctions"], spec["rules"]["functions"]
    for part in structure.parts:
        pspec = labels.parts[part.part_id]
        for block in part.blocks:
            if not block.subs and not block.problems:
                continue                                  # the function is printed with no sub-function line
            tables = [block.function.table] + [s.table for s in block.subs]
            reason = (_blocked_reason(source_id, tables, blocked)
                      or ("; ".join(block.problems) if block.problems else None))
            for column, target in sorted(block.function.cells.items()):
                if target.is_missing:
                    continue
                members = [(s.cells[column], 1) for s in block.subs if column in s.cells and not s.cells[column].is_missing]
                if not members:
                    continue
                out.append(sum_check(
                    check_type=sub_rule["type"], dataset=DATASET, rule_id=sub_rule["id"], target=target, members=members,
                    what_members=f"the sub-functions printed under '{block.function.label}'",
                    what_target=f"'{block.function.label}' ({pspec['what']})", column_label=column_label_for(target),
                    blocked_reason=reason))
        reason = _blocked_reason(source_id, part.tables, blocked) or ("; ".join(part.problems) if part.problems else None)
        for column, target in sorted(part.closing.cells.items()):
            if target.is_missing:
                continue
            members = [(b.function.cells[column], 1) for b in part.blocks if column in b.function.cells
                       and not b.function.cells[column].is_missing]
            if not members:
                continue
            out.append(sum_check(
                check_type=fn_rule["type"], dataset=DATASET, rule_id=fn_rule["id"], target=target, members=members,
                what_members=f"the function lines printed above '{part.closing.label}'",
                what_target=f"'{part.closing.label}'", column_label=column_label_for(target), blocked_reason=reason))
    return out


def agreement_checks(summary_cells: list[Cell], detail_cells: list[Cell], spec: dict[str, Any], titles: dict[str, str],
                     order: dict[str, str], names: dict[str, str]) -> list[Check]:
    """The same figure printed twice: in the summary table of the same edition, or in the next edition's detail tables."""
    out: list[Check] = []
    same, nxt = spec["rules"]["same_as_summary"], spec["rules"]["next_edition"]
    summary: dict[tuple[str, str, str, str], Cell] = {}
    for c in summary_cells:
        if c.series_id and c.period and c.vintage and not c.is_missing:
            summary.setdefault((c.source_id, c.series_id, c.period, c.vintage), c)
    summary_series = {key[1] for key in summary}
    groups: dict[tuple[str, str, str], list[Cell]] = defaultdict(list)
    for c in detail_cells:
        if not (c.series_id and c.period and c.vintage) or c.is_missing:
            continue
        if set(c.structural_flags) & BLOCKING_TABLE_FLAGS:
            continue          # a table flagged for lost or merged data proves nothing either way
        what = f"{names.get(c.series_id, c.series_id)}, {VINTAGE_NAMES.get(c.vintage, c.vintage)} {c.period}"
        first = summary.get((c.source_id, c.series_id, c.period, c.vintage))
        if first is not None:
            title = titles.get(c.source_id, c.source_id)
            out.append(equality_check(
                check_type=same["type"], dataset=DATASET, rule_id=same["id"], first=first, second=c, what=what,
                where_first=f"the Summary of Expenditure of the {title} (p.{first.page}, row '{first.row_label_raw}')",
                where_second=f"the function-wise detail table of the same document (p.{c.page}, row '{c.row_label_raw}')"))
        if c.series_id not in summary_series:
            # Lines the summary also prints already have their cross-edition check there.
            groups[(c.series_id, c.period, c.vintage)].append(c)
    for (sid, period, vintage), group in sorted(groups.items()):
        group.sort(key=lambda c: (order.get(c.source_id, ""), c.page, c.row_index, c.col_index))
        first = group[0]
        what = f"{names.get(sid, sid)}, {VINTAGE_NAMES.get(vintage, vintage)} {period}"
        for other in group[1:]:
            if other.source_id == first.source_id:
                continue
            out.append(equality_check(
                check_type=nxt["type"], dataset=DATASET, rule_id=nxt["id"], first=first, second=other, what=what,
                where_first=f"the {titles.get(first.source_id, first.source_id)} (p.{first.page}, row '{first.row_label_raw}')",
                where_second=f"the {titles.get(other.source_id, other.source_id)} (p.{other.page}, row '{other.row_label_raw}')"))
    return out


def withhold_where_a_check_failed(observations, checks: list[Check], detail_cell_ids: set[str]) -> int:
    """Detail-table figures only: a failed check on the figure's own cell withholds it, whatever else passed.

    The general status rule publishes a figure with one failed and one passed check, with a note.
    That is too generous here: a sub-function line whose function does not add up can still be
    reprinted unchanged in the next edition, and "printed twice" does not repair "does not add up"
    (the usual cause is a printed line we do not model, e.g. "Less Recoveries"). Deterministic, and
    it only ever removes figures. Figures whose primary printing is the Summary of Expenditure are
    not touched, nor is anything that is not currently `checked`.
    """
    failed: dict[str, list[Check]] = defaultdict(list)
    for chk in checks:
        if chk.result == "fail" and chk.official:
            for cid in {chk.target_cell_id, *chk.member_cell_ids} - {None}:
                failed[cid].append(chk)
    count = 0
    for o in observations:
        own = failed.get(o.primary_cell_id or "")
        if not (own and o.published and o.status == "checked" and o.primary_cell_id in detail_cell_ids):
            continue
        kinds = ", ".join(sorted({c.check_type.replace("_", " ") for c in own}))
        o.value, o.published, o.tier, o.status, o.gap_kind = None, False, "D", "unchecked", "failed_checks"
        o.gap_reason = (f"{len(own)} check(s) on this figure failed ({kinds}). A figure from the function-wise detail tables "
                        "is withheld whenever one of its own checks fails, even if another check passed.")
        o.first_published_release = o.last_changed_release = None
        count += 1
    return count


# ---------------------------------------------------------------- entry point used by datasets/abs.py

def enabled() -> bool:
    path = config.SPECS_DIR / "abs_detail.yaml"
    if not path.exists():
        return False
    from .common import load_spec

    return bool(load_spec("abs_detail").get("enabled"))


def build_detail(*, sources, summary_tables: dict[str, tuple[Any, list[Table], Table]], summary_cells: list[Cell],
                 abs_spec: dict[str, Any], existing_series: dict[str, Series], titles: dict[str, str], order: dict[str, str],
                 column_label_for: Callable[[Cell], str], map_columns) -> dict[str, Any]:
    """Read the detail tables of every edition whose summary table was located.

    `summary_tables` is {source_id: (run, all tables of the run, located summary table)}.
    Returns cells, checks, series, coverage rows and an info block; the caller merges them
    into the ABS dataset.
    """
    from ..sources import source_path
    from ..tables import page_words
    from ..validate import render_overlay, table_coverage
    from .common import load_spec

    spec = load_spec("abs_detail")
    labels_spec = load_spec("abs_detail_labels")
    labels = DetailLabels(spec, labels_spec)
    catalogue = series_catalogue(spec, labels_spec, abs_spec, set(existing_series))
    names = {s.series_id: s.name for s in [*existing_series.values(), *catalogue]}

    cells: list[Cell] = []
    checks: list[Check] = []
    coverage: list[dict[str, Any]] = []
    info: dict[str, Any] = {}
    for source in sources:
        if source.source_id not in summary_tables:
            info[source.source_id] = {"located": False, "reason": "the Summary of Expenditure was not located"}
            continue
        run, tables, summary = summary_tables[source.source_id]
        detail = locate_detail(tables, summary, labels, spec["locator"]["min_recognised_rows"])
        pdf = source_path(source)
        got = build_source(source=source, run=run, tables=detail, spec=spec, abs_spec=abs_spec, labels=labels,
                           words_for=lambda t: page_words(pdf, t.page), coverage_for=lambda t: table_coverage(t, pdf),
                           map_columns=map_columns)
        cells.extend(got["cells"])
        checks.extend(structure_checks(source.source_id, got["structure"], got["blocked"], spec, labels, column_label_for))
        for t in got["tables"]:
            coverage.append({"dataset": DATASET, "source_id": source.source_id, "table": "Function-wise detail", **t["coverage"]})
        for table in detail:
            render_overlay(pdf, table, config.work_dir() / "qa" / f"overlay_detail_{source.source_id}_p{table.page:03d}.png")
        structure: Structure = got["structure"]
        info[source.source_id] = {
            "located": got["located"], "pages": got["pages"], "parts_closed": got["parts_closed"],
            "parts_missing": got["parts_missing"], "tables": got["tables"], "blocked_tables": sorted(got["blocked"].values()),
            "function_blocks": sum(len(p.blocks) for p in structure.parts),
            "blocks_unassigned": structure.unassigned, "notes": structure.notes,
            "part_problems": {p.part_id: p.problems for p in structure.parts if p.problems},
            "block_problems": [pr for p in structure.parts for b in p.blocks for pr in b.problems],
        }
    checks.extend(agreement_checks(summary_cells, cells, spec, titles, order, names))
    return {"cells": cells, "checks": checks, "series": catalogue, "coverage": coverage, "info": info}
