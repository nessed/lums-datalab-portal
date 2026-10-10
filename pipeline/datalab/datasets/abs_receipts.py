"""Federal Annual Budget Statement: the receipts side (plan item E2, decision D32).

Every edition prints, near the front, a one-page "Summary of Receipts" and,
on the next page, the statement of tax revenue by head. This module

1. finds both tables by the names of the heads they print (never by page),
2. recognises rows with a hand-written dictionary (`specs/abs_receipts_labels.yaml`);
   a line listed under a head is recognised only inside that head's block,
3. takes column meaning from the PDF text layer (`abs.map_columns`, injected),
4. tests the mapping by arithmetic: heads add to their line, tax + non-tax =
   total revenue, gross - provincial share = net, and so on as printed; a line
   printed in both tables must agree; this edition's budget estimate must equal
   the next edition's prior-year column.

Nothing here writes or corrects a value: cells carry what the extraction tool
read, and the checks decide. Driven by `specs/abs_receipts.yaml`; switched on
or off by its `enabled` flag. `datasets/abs.py` merges the result into the
`abs` dataset.
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Callable

from .. import config
from ..checks import equality_check, evaluate_sum_rules, pass_rate
from ..normalise import clean_text, detect_scale, normalise_label, parse_printed
from ..schema import Cell, Check, Observation, Series, SeriesBreak, obs_id_for
from ..tables import Table, TCell
from ..validate import BLOCKING_TABLE_FLAGS, detect_table_flags
from .common import make_cell, previous_fy, row_label, score_table, text_layer_row_label

DATASET = "abs"
VINTAGE_NAMES = {"be": "Budget Estimates", "re": "Revised Estimates"}
FOOTNOTE_MARK = re.compile(r"[\*†]")
Words = list[tuple[float, float, float, float, str]]
TableKey = tuple[str, int, int]


# ---------------------------------------------------------------- labels

class ReceiptLabels:
    """Printed label -> series, given the block the row sits in (rules in specs/abs_receipts_labels.yaml)."""

    def __init__(self, labels_spec: dict[str, Any], parents: dict[str, str | None]):
        self.strip = [re.compile(p) for p in labels_spec.get("strip_prefixes", [])]
        self.entries = [(re.compile(e["pattern"], re.I), e["series"]) for e in labels_spec["labels"]]
        self.ignored = [re.compile(e["pattern"], re.I) for e in labels_spec.get("ignored") or []]
        self.heads = frozenset(labels_spec.get("block_heads", []))
        self.parents = parents
        unknown = sorted(({s for _, s in self.entries} | set(self.heads)) - set(parents))
        if unknown:
            raise ValueError(f"label dictionary names series that are not in the catalogue: {unknown}")

    def normalise(self, raw_label: str) -> str:
        label = normalise_label(raw_label)
        for pattern in self.strip:
            label = pattern.sub("", label, count=1)
        return label.strip()

    def lookup(self, raw_label: str, context: str | None) -> tuple[str | None, str]:
        """(series, how). how: dictionary | unmapped | ambiguous | ignored | outside_its_block."""
        label = self.normalise(raw_label)
        if any(p.fullmatch(label) for p in self.ignored):
            return None, "ignored"
        hits = {series for pattern, series in self.entries if pattern.fullmatch(label)}
        if not hits:
            return None, "unmapped"
        # A line listed under a block head exists only inside that head's block.
        usable = {s for s in hits if self.parents.get(s) not in self.heads or self.parents.get(s) == context}
        if not usable:
            return None, "outside_its_block"
        members = {s for s in usable if context is not None and self.parents.get(s) == context}
        if members:
            usable = members          # inside an open block, a label naming one of its lines is that line
        if len(usable) == 1:
            return usable.pop(), "dictionary"
        return None, "ambiguous"

    def next_context(self, series_id: str, context: str | None) -> str | None:
        if series_id in self.heads:
            return series_id
        return context if self.parents.get(series_id) == context else None


# ---------------------------------------------------------------- locate

def locate(tables: list[Table], spec: dict[str, Any]) -> tuple[dict[str, Table], dict[str, Any]]:
    """{table id: table} for the receipts tables found, by head names only. Ties mean not found."""
    found: dict[str, Table] = {}
    info: dict[str, Any] = {}
    for tspec in spec["tables"]:
        patterns = tspec["locator"]["patterns"]
        scored = sorted(((score_table(t, patterns), t) for t in tables), key=lambda x: -x[0])
        entry: dict[str, Any] = {"candidates": [{"page": t.page, "table_index": t.table_index, "score": s, "rows": t.num_rows,
                                                 "cols": t.num_cols} for s, t in scored[:3]]}
        if not scored or scored[0][0] < tspec["locator"]["min_matches"]:
            entry["result"] = "not_found"
        elif len(scored) > 1 and scored[1][0] == scored[0][0]:
            entry["result"] = "tie"
        else:
            entry["result"] = "found"
            found[tspec["id"]] = scored[0][1]
        info[tspec["id"]] = entry
    # one table cannot be both
    ids = list(found)
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if a in found and b in found and found[a] is found[b]:
                info[a]["result"] = info[b]["result"] = "same_table_for_two_roles"
                del found[a], found[b]
    return found, info


# ---------------------------------------------------------------- rows

@dataclass
class Row:
    row: int
    label: str
    series_id: str | None
    how: str                                   # dictionary | unmapped | ambiguous | ignored | outside_its_block | duplicate
    label_source: str                          # docling | text_layer
    tcells: list[TCell] = field(default_factory=list)


def value_rows(table: Table) -> list[tuple[int, list[TCell]]]:
    """Rows that carry at least one printed amount (or a nil marker) in a value column.

    A row Docling flagged as a header still counts when every value column holds exactly one
    number (AGENTS.md section 7: first data rows marked as headers).
    """
    grid = table.grid()
    value_cols = table.value_columns()
    out: list[tuple[int, list[TCell]]] = []
    for r in range(table.num_rows):
        cells = [grid[r][k] for k in value_cols if grid[r][k] is not None and grid[r][k].row == r and grid[r][k].col == k
                 and grid[r][k].text.strip()]
        if not cells:
            continue
        parsed = [parse_printed(c.text) for c in cells]
        amounts = [p for p in parsed if p.value is not None or p.is_missing or "merged_cell_suspected" in p.flags]
        if not amounts:
            continue                                # header text or a unit line such as "(Rs in million)"
        if all(c.column_header for c in cells) and (len(cells) != len(value_cols) or len(amounts) != len(cells)):
            continue
        out.append((r, cells))
    return out


def read_rows(table: Table, labels: ReceiptLabels, words: Words | None) -> list[Row]:
    """Recognise each amount row, top to bottom, keeping track of the open block.

    Docling's label is tried first; when it matches nothing, the label read from the PDF text
    layer on the amount's own line is tried. Two rows that land on the same series are both
    left unmapped.
    """
    grid = table.grid()
    value_cols = table.value_columns()
    out: list[Row] = []
    context: str | None = None
    for r, tcells in value_rows(table):
        label = row_label(table, grid, r, value_cols)
        if not label and all(c.column_header for c in tcells):
            label = clean_text(" ".join(grid[r][k].text.strip() for k in range(table.num_cols) if k not in value_cols
                                        and grid[r][k] is not None and grid[r][k].row == r and grid[r][k].col == k))
        series_id, how = labels.lookup(label, context)
        source = "docling"
        if series_id is None and how != "ignored" and words is not None:
            alt = text_layer_row_label(table, grid, r, value_cols, words)
            alt_series, alt_how = labels.lookup(alt, context)
            if alt_series is not None or alt_how == "ignored":
                series_id, how, label, source = alt_series, alt_how, alt, "text_layer"
        if series_id is not None:
            context = labels.next_context(series_id, context)
        out.append(Row(row=r, label=label, series_id=series_id, how=how, label_source=source, tcells=tcells))
    seen: dict[str, list[Row]] = defaultdict(list)
    for row in out:
        if row.series_id:
            seen[row.series_id].append(row)
    for rows in seen.values():
        if len(rows) > 1:
            for row in rows:
                row.series_id, row.how = None, "duplicate"
    return out


# ---------------------------------------------------------------- cells

def table_key(source_id: str, table: Table) -> TableKey:
    return (source_id, table.page, table.table_index)


def build_table(*, source, run, table: Table, tspec: dict[str, Any], spec: dict[str, Any], abs_spec: dict[str, Any],
                labels: ReceiptLabels, words: Words, coverage: dict[str, Any],
                map_columns: Callable[..., tuple[dict[int, tuple[str, str, str]], list[str]]]) -> tuple[list[Cell], dict[str, Any]]:
    """Cells and table facts for one located receipts table (PDF access is injected by the caller)."""
    value_cols = table.value_columns()
    flags = detect_table_flags(table, expected_value_columns=spec["expected_value_columns"])
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
    mappable = not col_problems and scale_ok

    rows = read_rows(table, labels, words)
    cells: list[Cell] = []
    for row in rows:
        row_flags = list(flags)
        if row.label_source == "text_layer":
            row_flags.append("row_label_from_text_layer")
        if FOOTNOTE_MARK.search(row.label):
            row_flags.append("receipts_row_has_footnote_mark")
        for tc in row.tcells:
            period, vintage, header = col_map.get(tc.col, (None, None, ""))
            cell = make_cell(source=source, run=run, table=table, tcell=tc, row_label_raw=row.label, col_label_raw=header,
                             table_flags=row_flags)
            cell.unit = "PKR"
            cell.scale_factor = abs_spec["scale_factor"] if scale_ok else None
            if row.series_id and period and mappable:
                cell.series_id, cell.period, cell.vintage, cell.mapping_method = row.series_id, period, vintage, "dictionary"
            cells.append(cell)

    def labelled(how: str) -> list[str]:
        return [r.label or "(row with no label)" for r in rows if r.how == how]

    info = {
        "source_id": source.source_id, "table": tspec["id"], "table_name": tspec["name"], "page": table.page,
        "table_index": table.table_index, "run_id": run.run_id, "rows": table.num_rows, "cols": table.num_cols,
        "value_columns": value_cols, "table_flags": flags,
        "columns": {str(k): {"period": v[0], "vintage": v[1], "header": v[2]} for k, v in col_map.items()},
        "column_problems": col_problems, "scale_factor_detected": scale, "scale_confirmed": bool(scale_ok),
        "amount_rows": len(rows), "rows_mapped": sum(1 for r in rows if r.series_id),
        "series_mapped": sorted(r.series_id for r in rows if r.series_id) if mappable else [],
        "unmapped_labels": labelled("unmapped"), "ambiguous_labels": labelled("ambiguous"),
        "labels_outside_their_block": labelled("outside_its_block"), "duplicate_labels": labelled("duplicate"),
        "ignored_labels": labelled("ignored"),
        "labels_from_text_layer": [r.label for r in rows if r.label_source == "text_layer"],
        "labels_with_footnote_mark": [r.label for r in rows if FOOTNOTE_MARK.search(r.label)],
        "coverage": coverage,
    }
    return cells, info


# ---------------------------------------------------------------- checks

def sum_checks(cells_by_table: dict[TableKey, list[Cell]], spec: dict[str, Any], parents: dict[str, str | None],
               blocked: dict[TableKey, str], column_label_for: Callable[[Cell], str]) -> list[Check]:
    """The spec's sum rules, on each located table by itself."""
    out: list[Check] = []
    for key in sorted(cells_by_table):
        out += evaluate_sum_rules(cells_by_table[key], spec["rules"], DATASET, parents, blocked, column_label_for)
    return out


def _usable(c: Cell) -> bool:
    return bool(c.series_id and c.period and c.vintage) and not c.is_missing


def agreement_checks(cells_by_kind: dict[str, list[Cell]], spec: dict[str, Any], table_names: dict[str, str],
                     titles: dict[str, str], order: dict[str, str], names: dict[str, str]) -> list[Check]:
    """The same figure printed twice: in the other receipts table of the edition, or in the next edition.

    Editions are compared like with like (summary with summary, tax statement with tax statement),
    so one figure is never counted as agreeing twice. A table flagged for lost or merged data
    proves nothing either way and is left out.
    """
    out: list[Check] = []
    same, nxt = spec["agreement"]["same_in_other_table"], spec["agreement"]["next_edition"]
    kinds = list(cells_by_kind)

    def what(c: Cell) -> str:
        return f"{names.get(c.series_id, c.series_id)}, {VINTAGE_NAMES.get(c.vintage, c.vintage)} {c.period}"

    def good(cells: list[Cell]) -> list[Cell]:
        return [c for c in cells if _usable(c) and not set(c.structural_flags) & BLOCKING_TABLE_FLAGS]

    first_kind: dict[tuple[str, str, str, str], tuple[str, Cell]] = {}
    for kind in kinds:
        for c in good(cells_by_kind[kind]):
            key = (c.source_id, c.series_id, c.period, c.vintage)
            if key not in first_kind:
                first_kind[key] = (kind, c)
            elif first_kind[key][0] != kind:
                other_kind, first = first_kind[key]
                title = titles.get(c.source_id, c.source_id)
                out.append(equality_check(
                    check_type=same["type"], dataset=DATASET, rule_id=same["id"], first=first, second=c, what=what(c),
                    where_first=f"the {table_names[other_kind]} of the {title} (p.{first.page}, row '{first.row_label_raw}')",
                    where_second=f"the {table_names[kind]} of the same document (p.{c.page}, row '{c.row_label_raw}')"))
    for kind in kinds:
        groups: dict[tuple[str, str, str], list[Cell]] = defaultdict(list)
        for c in good(cells_by_kind[kind]):
            groups[(c.series_id, c.period, c.vintage)].append(c)
        for _, group in sorted(groups.items()):
            group.sort(key=lambda c: (order.get(c.source_id, ""), c.page, c.row_index, c.col_index))
            first = group[0]
            for other in group[1:]:
                if other.source_id == first.source_id:
                    continue
                out.append(equality_check(
                    check_type=nxt["type"], dataset=DATASET, rule_id=nxt["id"], first=first, second=other, what=what(first),
                    where_first=(f"the {table_names[kind]} of the {titles.get(first.source_id, first.source_id)} "
                                 f"(p.{first.page}, row '{first.row_label_raw}')"),
                    where_second=(f"the {table_names[kind]} of the {titles.get(other.source_id, other.source_id)} "
                                  f"(p.{other.page}, row '{other.row_label_raw}')")))
    return out


# ---------------------------------------------------------------- series, gaps

def series_catalogue(spec: dict[str, Any], abs_spec: dict[str, Any]) -> list[Series]:
    breaks = [SeriesBreak(**b) for b in spec.get("breaks", [])]
    return [Series(series_id=s["id"], name=s["name"], parent_id=s.get("parent"), dataset=DATASET, frequency="fiscal_year",
                   unit="PKR", scale_factor=abs_spec["scale_factor"], definition=s.get("definition", ""),
                   definition_status="draft", synonyms=list(s.get("synonyms", [])), breaks=breaks, source_doc_types=["abs"],
                   sort_key=int(s.get("sort", 5900)), dims={"side": "receipts"})
            for s in spec["series"]]


def gap_reason(tspec: dict[str, Any], title: str, tinfo: dict[str, Any] | None, why_not_located: str | None) -> tuple[str, str]:
    """(gap kind, sentence) for an expected line that has no mapped cell in one edition."""
    name = tspec["name"]
    if tinfo is None:
        return "not_yet_verified", f"{why_not_located or 'The table could not be located'} in the {title}."
    bad = sorted(set(tinfo["table_flags"]) & (BLOCKING_TABLE_FLAGS | {"column_unmapped", "scale_not_confirmed"}))
    if bad:
        return "not_yet_verified", (f"The {name} in the {title} (p.{tinfo['page']}) is flagged {', '.join(bad)}, "
                                    "so nothing from it is shown.")
    loose = [*tinfo["unmapped_labels"], *tinfo["ambiguous_labels"], *tinfo["labels_outside_their_block"], *tinfo["duplicate_labels"]]
    if loose:
        # We cannot claim the government did not print it while a row of the table is unmatched.
        return "not_yet_verified", (f"A row of the {name} in the {title} (p.{tinfo['page']}) could not be matched to a line "
                                    "with certainty, so this figure is not shown.")
    if (tinfo["coverage"].get("coverage") or 0) < 1:
        return "not_yet_verified", (f"Not every printed number in the {name} of the {title} (p.{tinfo['page']}) was captured, "
                                    "so we cannot say whether this line is printed.")
    return "not_in_source", f"The {name} in the {title} (p.{tinfo['page']}) does not print this line."


def gap_observations(sources, spec: dict[str, Any], tables_info: dict[tuple[str, str], dict[str, Any]],
                     not_located: dict[tuple[str, str], str], cells: list[Cell], series: dict[str, Series],
                     titles: dict[str, str]) -> list[Observation]:
    """Expected receipts figures that have no cell: a labelled gap, never a blank (decision D7)."""
    have = {obs_id_for(c.series_id, c.period, c.vintage) for c in cells if c.series_id and c.period and c.vintage}
    out: list[Observation] = []
    for source in sources:
        columns = [(previous_fy(source.period), "be"), (previous_fy(source.period), "re"), (source.period, "be")]
        for tspec in spec["tables"]:
            key = (source.source_id, tspec["id"])
            for series_id in tspec.get("expected", []):
                for period, vintage in columns:
                    oid = obs_id_for(series_id, period, vintage)
                    if oid in have:
                        continue
                    have.add(oid)
                    kind, reason = gap_reason(tspec, titles.get(source.source_id, source.source_id), tables_info.get(key),
                                              not_located.get(key))
                    s = series[series_id]
                    out.append(Observation(obs_id=oid, series_id=series_id, period=period, vintage=vintage, unit=s.unit,
                                           scale_factor=s.scale_factor, status="unchecked", published=False, gap_kind=kind,
                                           gap_reason=reason, evidence_summary=reason))
    return out


def watch_report(sources, spec: dict[str, Any], tables_info: dict[tuple[str, str], dict[str, Any]],
                 not_located: dict[tuple[str, str], str], cells: list[Cell], titles: dict[str, str]) -> dict[str, Any]:
    """Per edition: is each watched line (Sales Tax) mapped, and if not, why. Never silent."""
    home = {sid: t for t in spec["tables"] for sid in t.get("expected", [])}
    out: dict[str, Any] = {}
    for series_id in spec.get("watch_series", []):
        tspec = home[series_id]
        per_edition: dict[str, Any] = {}
        for source in sources:
            mine = [c for c in cells if c.series_id == series_id and c.source_id == source.source_id]
            if mine:
                per_edition[source.source_id] = {"mapped": True, "page": mine[0].page, "row_label": mine[0].row_label_raw,
                                                 "columns": sorted(f"{c.period} {c.vintage}" for c in mine)}
            else:
                key = (source.source_id, tspec["id"])
                kind, reason = gap_reason(tspec, titles.get(source.source_id, source.source_id), tables_info.get(key),
                                          not_located.get(key))
                per_edition[source.source_id] = {"mapped": False, "gap_kind": kind, "reason": reason}
        out[series_id] = per_edition
    return out


# ---------------------------------------------------------------- entry point used by datasets/abs.py

def pass_rates(checks: list[Check]) -> dict[str, Any]:
    """Receipts checks only. Call it after `classify_disputes`, so disputed pairs are counted as such."""
    mine = [c for c in checks if c.rule_id.startswith("abs_receipts.")]
    return {"sums": pass_rate(mine, ["column_total", "hierarchy_sum", "accounting_identity"]),
            "same_in_both_tables": pass_rate(mine, ["cross_table"]),
            "cross_edition": pass_rate(mine, ["cross_edition"])}


def enabled() -> bool:
    path = config.SPECS_DIR / "abs_receipts.yaml"
    if not path.exists():
        return False
    from .common import load_spec

    return bool(load_spec("abs_receipts").get("enabled"))


def build_receipts(*, sources, loaded: dict[str, tuple[Any, list[Table]]], abs_spec: dict[str, Any], titles: dict[str, str],
                   order: dict[str, str], column_label_for: Callable[[Cell], str], map_columns) -> dict[str, Any]:
    """Read the receipts tables of every edition that has a validated run.

    `loaded` is {source_id: (run, all tables of the run)} for runs the caller already has in
    memory; the others are loaded here. Returns cells, checks, series, coverage rows, gap
    observations and an info block; the caller merges them into the ABS dataset.
    """
    from ..sources import source_path
    from ..tables import page_words
    from ..validate import render_overlay, table_coverage
    from .common import load_spec, validated_tables

    spec = load_spec("abs_receipts")
    labels_spec = load_spec("abs_receipts_labels")
    catalogue = series_catalogue(spec, abs_spec)
    series = {s.series_id: s for s in catalogue}
    parents = {s.series_id: s.parent_id for s in catalogue}
    names = {s.series_id: s.name for s in catalogue}
    labels = ReceiptLabels(labels_spec, parents)
    table_names = {t["id"]: t["name"] for t in spec["tables"]}

    cells: list[Cell] = []
    coverage: list[dict[str, Any]] = []
    cells_by_table: dict[TableKey, list[Cell]] = {}
    cells_by_kind: dict[str, list[Cell]] = {t["id"]: [] for t in spec["tables"]}
    blocked: dict[TableKey, str] = {}
    tables_info: dict[tuple[str, str], dict[str, Any]] = {}
    not_located: dict[tuple[str, str], str] = {}
    editions: dict[str, Any] = {}
    for source in sources:
        got = loaded.get(source.source_id) or validated_tables(source)
        if got is None:
            for tspec in spec["tables"]:
                not_located[(source.source_id, tspec["id"])] = "No validated extraction run exists"
            editions[source.source_id] = {"located": [], "reason": "no validated extraction run"}
            continue
        run, tables = got[0], got[1]
        found, locator = locate(tables, spec)
        pdf = source_path(source)
        edition: dict[str, Any] = {"located": sorted(found), "locator": locator, "tables": {}}
        for tspec in spec["tables"]:
            table = found.get(tspec["id"])
            if table is None:
                not_located[(source.source_id, tspec["id"])] = (f"The {tspec['name']} could not be located "
                                                                f"({locator[tspec['id']]['result']})")
                continue
            table_cells, tinfo = build_table(
                source=source, run=run, table=table, tspec=tspec, spec=spec, abs_spec=abs_spec, labels=labels,
                words=page_words(pdf, table.page), coverage=table_coverage(table, pdf), map_columns=map_columns)
            key = table_key(source.source_id, table)
            bad = sorted(set(tinfo["table_flags"]) & BLOCKING_TABLE_FLAGS)
            if bad:
                blocked[key] = f"the table on p.{table.page} is flagged {', '.join(bad)}"
            cells.extend(table_cells)
            cells_by_table[key] = table_cells
            cells_by_kind[tspec["id"]].extend(table_cells)
            tables_info[(source.source_id, tspec["id"])] = tinfo
            edition["tables"][tspec["id"]] = tinfo
            coverage.append({"dataset": DATASET, "source_id": source.source_id, "table": tspec["name"], **tinfo["coverage"]})
            render_overlay(pdf, table, config.work_dir() / "qa" / f"overlay_receipts_{source.source_id}_p{table.page:03d}.png")
        editions[source.source_id] = edition

    checks = sum_checks(cells_by_table, spec, parents, blocked, column_label_for)
    checks += agreement_checks(cells_by_kind, spec, table_names, titles, order, names)
    info = {
        "editions": editions,
        "blocked_tables": {f"{k[0]} p.{k[1]}": v for k, v in sorted(blocked.items())},
        "watch": watch_report(sources, spec, tables_info, not_located, cells, titles),
    }
    return {"cells": cells, "checks": checks, "series": catalogue, "coverage": coverage, "info": info,
            "gap_observations": gap_observations(sources, spec, tables_info, not_located, cells, series, titles)}
