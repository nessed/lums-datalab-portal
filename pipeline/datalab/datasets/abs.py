"""Federal Annual Budget Statement: locate the Summary of Expenditure, map rows, check, decide status.

Everything here is driven by `specs/abs.yaml` and `specs/abs_labels.yaml`.
"""
from __future__ import annotations

import csv
import re
from collections import defaultdict
from decimal import ROUND_HALF_EVEN, Decimal
from typing import Any

from .. import config
from ..checks import equality_check, evaluate_sum_rules, pass_rate
from ..normalise import clean_text, decimal_to_str, detect_scale, normalise_label
from ..schema import Cell, Check, Derivation, Observation, Series, SeriesBreak, check_id_for, obs_id_for
from ..sources import read_manifest, source_path
from ..status import build_observations
from ..tables import Table, page_words
from ..validate import BLOCKING_TABLE_FLAGS, detect_table_flags, render_overlay, table_coverage
from .common import (LabelMap, column_header_text, text_layer_row_label, fiscal_years_in, load_spec, make_cell, previous_fy, row_label,
                     save_dataset, score_table, validated_tables)

DATASET = "abs"
VINTAGE_NAMES = {"be": "Budget Estimates", "re": "Revised Estimates"}


def locate(tables: list[Table], spec: dict[str, Any]) -> tuple[Table | None, dict[str, Any]]:
    """Pick the table that carries the ten function names. Ties or a low score mean not found."""
    patterns = spec["locator"]["function_patterns"]
    scored = sorted(((score_table(t, patterns), t) for t in tables), key=lambda x: -x[0])
    info: dict[str, Any] = {"candidates": [{"page": t.page, "table_index": t.table_index, "score": s,
                                            "rows": t.num_rows, "cols": t.num_cols} for s, t in scored[:3]]}
    if not scored or scored[0][0] < spec["locator"]["min_matches"]:
        info["result"] = "not_found"
        return None, info
    if len(scored) > 1 and scored[1][0] == scored[0][0]:
        info["result"] = "tie"
        return None, info
    info["result"] = "found"
    return scored[0][1], info


def map_columns(table: Table, value_cols: list[int], words, edition: str, spec: dict[str, Any]) -> tuple[dict[int, tuple[str, str, str]], list[str]]:
    """Each value column -> (period, vintage, printed header). Must equal the edition's expected three columns."""
    problems: list[str] = []
    mapping: dict[int, tuple[str, str, str]] = {}
    for col in value_cols:
        header = column_header_text(table, col, words)
        years = sorted(set(fiscal_years_in(header)))
        vintages = [v for v, pattern in spec["columns"]["vintage_words"].items() if re.search(pattern, header)]
        if len(years) == 1 and len(vintages) == 1:
            mapping[col] = (years[0], vintages[0], header)
        else:
            problems.append(f"column {col}: header {header!r} does not give one year and one of Budget/Revised")
    expected = {(previous_fy(edition), "be"), (previous_fy(edition), "re"), (edition, "be")}
    got = {(p, v) for p, v, _ in mapping.values()}
    if got != expected or len(mapping) != len(value_cols):
        problems.append(f"columns found {sorted(got)} differ from the expected {sorted(expected)}")
    return mapping, problems


def build_cells(source, run, table: Table, spec: dict[str, Any], labels: LabelMap) -> tuple[list[Cell], dict[str, Any]]:
    pdf = source_path(source)
    words = page_words(pdf, table.page)
    value_cols = table.value_columns()
    flags = detect_table_flags(table, expected_value_columns=spec["expected_value_columns"])
    coverage = table_coverage(table, pdf)
    if coverage["coverage_row_band"] is not None and coverage["coverage_row_band"] < 0.90 <= (coverage["coverage"] or 0):
        flags.append("possible_dropped_column")
    if coverage["coverage"] is None or coverage["coverage"] < spec.get("min_table_coverage", 0.90):
        flags.append("low_coverage")
    col_map, col_problems = map_columns(table, value_cols, words, source.period, spec)
    if col_problems:
        flags.append("column_unmapped")
    page_text = clean_text(" ".join(w[4] for w in words))
    scale = detect_scale(page_text)
    scale_ok = scale == spec["scale_factor"] and re.search(spec["scale_marker"], page_text) is not None
    if not scale_ok:
        flags.append("scale_not_confirmed")

    grid = table.grid()
    cells: list[Cell] = []
    unmapped: list[str] = []
    ambiguous: list[str] = []
    relabelled: list[str] = []
    for r in range(table.num_rows):
        row_cells = [grid[r][k] for k in value_cols if grid[r][k] is not None and grid[r][k].row == r and grid[r][k].col == k]
        if not row_cells or all(c.column_header for c in row_cells) or not any(c.text.strip() for c in row_cells):
            continue
        label = row_label(table, grid, r, value_cols)
        series_id, how = labels.lookup(label)
        row_flags = list(flags)
        if series_id is None:
            # Docling sometimes merges two rows' label cells into one. Fall back to the label read
            # from the text layer on the amount's own line; the sum checks still validate the result.
            alt = text_layer_row_label(table, grid, r, value_cols, words)
            alt_series, alt_how = labels.lookup(alt)
            if alt_series is not None:
                series_id, how, label = alt_series, alt_how, alt
                row_flags.append("row_label_from_text_layer")
                relabelled.append(alt)
        if series_id is None:
            (ambiguous if how == "ambiguous" else unmapped).append(label or "(row with no label)")
        for tc in row_cells:
            if not tc.text.strip():
                continue
            period, vintage, header = col_map.get(tc.col, (None, None, ""))
            cell = make_cell(source=source, run=run, table=table, tcell=tc, row_label_raw=label, col_label_raw=header,
                             table_flags=row_flags)
            cell.unit = "PKR"
            cell.scale_factor = spec["scale_factor"] if scale_ok else None
            if series_id and period and not col_problems and scale_ok:
                cell.series_id, cell.period, cell.vintage, cell.mapping_method = series_id, period, vintage, "dictionary"
            cells.append(cell)
    info = {
        "source_id": source.source_id, "page": table.page, "table_index": table.table_index, "run_id": run.run_id,
        "rows": table.num_rows, "cols": table.num_cols, "value_columns": value_cols, "table_flags": flags,
        "columns": {str(k): {"period": v[0], "vintage": v[1], "header": v[2]} for k, v in col_map.items()},
        "column_problems": col_problems, "scale_factor_detected": scale, "scale_confirmed": bool(scale_ok),
        "unmapped_labels": unmapped, "ambiguous_labels": ambiguous,
        "labels_from_text_layer": relabelled, "coverage": coverage,
    }
    return cells, info


def series_catalogue(spec: dict[str, Any], labels_spec: dict[str, Any]) -> list[Series]:
    breaks = [SeriesBreak(**b) for b in spec.get("breaks", [])]
    out: list[Series] = []
    for s in list(spec["series"]) + list(labels_spec.get("extra_series") or []):
        out.append(Series(
            series_id=s["id"], name=s["name"], parent_id=s.get("parent"), dataset=DATASET, frequency="fiscal_year",
            unit="PKR", scale_factor=spec["scale_factor"], definition=s.get("definition", ""), definition_status="draft",
            synonyms=list(s.get("synonyms", [])), breaks=breaks, source_doc_types=["abs"], sort_key=int(s.get("sort", 500)),
            dims={"function": s["function"]} if s.get("function") else {},
        ))
    for d in spec.get("derived", []):
        out.append(Series(
            series_id=d["id"], name=d["name"], parent_id=d.get("parent"), dataset=DATASET, frequency="fiscal_year",
            unit=d["unit"], scale_factor=1, definition=d.get("definition", ""), definition_status="draft", breaks=breaks,
            source_doc_types=["abs"], derived=True, sort_key=900,
            derivation=Derivation(formula=d["formula"], inputs=[d["numerator"], d["denominator"]]),
        ))
    return out


def column_label(cell: Cell, titles: dict[str, str]) -> str:
    return f"the '{VINTAGE_NAMES.get(cell.vintage or '', cell.vintage)} {cell.period}' column of the {titles.get(cell.source_id, cell.source_id)}"


def cross_checks(cells: list[Cell], titles: dict[str, str], order: dict[str, str], series: dict[str, Series]) -> list[Check]:
    """The same figure printed twice: in a later edition (cross_edition) or twice on one page (cross_table)."""
    groups: dict[tuple[str, str, str], list[Cell]] = defaultdict(list)
    for c in cells:
        if c.series_id and c.period and c.vintage and not c.is_missing:
            groups[(c.series_id, c.period, c.vintage)].append(c)
    out: list[Check] = []
    for (sid, period, vintage), group in sorted(groups.items()):
        if len(group) < 2:
            continue
        group.sort(key=lambda c: (order.get(c.source_id, ""), c.page, c.row_index, c.col_index))
        first = group[0]
        name = series[sid].name if sid in series else sid
        what = f"{name}, {VINTAGE_NAMES.get(vintage, vintage)} {period}"
        for other in group[1:]:
            same = other.source_id == first.source_id
            out.append(equality_check(
                check_type="cross_table" if same else "cross_edition", dataset=DATASET,
                rule_id="abs.restated_on_same_page" if same else "abs.same_figure_in_next_edition",
                first=first, second=other, what=what,
                where_first=f"the {titles.get(first.source_id, first.source_id)} (row '{first.row_label_raw}')",
                where_second=f"the {titles.get(other.source_id, other.source_id)} (row '{other.row_label_raw}')",
            ))
    return out


def arslan_comparison(observations: list[Observation]) -> dict[str, Any]:
    """Comparison only (never a status input): the previous RA's dataset vs our published values."""
    ra = config.ra_ship_dir()
    path = ra / "Arsalan Archive/Archive/ABS Dataset/files/subcodes_long.csv" if ra else None
    if not path or not path.exists():
        return {"status": "not_available"}
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        return {"status": "not_compared", "columns": reader.fieldnames,
                "note": "Column layout recorded; a like-for-like comparison is a queued follow-up."}


def derive(spec: dict[str, Any], observations: list[Observation], series: dict[str, Series], release: str) -> list[Observation]:
    """Derived series, computed by code from published observations only (plan 6.12)."""
    by_id = {o.obs_id: o for o in observations}
    out: list[Observation] = []
    for d in spec.get("derived", []):
        keys = sorted({(o.period, o.vintage) for o in observations if o.series_id in (d["numerator"], d["denominator"])})
        for period, vintage in keys:
            num = by_id.get(obs_id_for(d["numerator"], period, vintage))
            den = by_id.get(obs_id_for(d["denominator"], period, vintage))
            oid = obs_id_for(d["id"], period, vintage)
            inputs = [o.obs_id for o in (num, den) if o is not None]
            if num and den and num.published and den.published and Decimal(den.value) != 0:
                value = (Decimal(num.value) / Decimal(den.value) * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
                tier = "A" if num.tier == den.tier == "A" else "B"
                out.append(Observation(
                    obs_id=oid, series_id=d["id"], period=period, vintage=vintage, value=decimal_to_str(value), unit="percent",
                    scale_factor=1, tier=tier, status="checked", published=True, derived_from=inputs,
                    evidence_summary=(f"Computed by code: {num.value} / {den.value} x 100, rounded to 2 decimals. "
                                      "Both inputs are checked values; open them for their own receipts."),
                    first_published_release=release, last_changed_release=release))
            else:
                out.append(Observation(
                    obs_id=oid, series_id=d["id"], period=period, vintage=vintage, unit="percent", scale_factor=1,
                    status="unchecked", published=False, gap_kind="not_yet_verified", derived_from=inputs,
                    gap_reason="An input figure is not published, so the share is not computed.",
                    evidence_summary="Not computed: an input figure is withheld."))
    return out


def gap_observations(spec: dict[str, Any], located: dict[str, dict[str, Any]], not_located: dict[str, str],
                     observations: list[Observation], series: dict[str, Series]) -> list[Observation]:
    """Expected figures that have no cell: a labelled gap, never a blank (decision D7)."""
    have = {o.obs_id for o in observations}
    out: list[Observation] = []
    sources = {s.source_id: s for s in read_manifest() if s.doc_type == "abs"}
    for sid, src in sorted(sources.items()):
        expected_cols = [(previous_fy(src.period), "be"), (previous_fy(src.period), "re"), (src.period, "be")]
        for series_id in spec["expected_every_edition"]:
            for period, vintage in expected_cols:
                oid = obs_id_for(series_id, period, vintage)
                if oid in have:
                    continue
                have.add(oid)
                if sid in not_located:
                    kind, reason = "not_yet_verified", f"{not_located[sid]} in the {src.title}."
                elif (located.get(sid, {}).get("table_flags") or located.get(sid, {}).get("column_problems")
                      or located.get(sid, {}).get("unmapped_labels") or located.get(sid, {}).get("ambiguous_labels")):
                    # We cannot claim the government did not print it while a row of the table is unmatched.
                    kind, reason = "not_yet_verified", (f"A row of the table in the {src.title} could not be matched to a line "
                                                        "with certainty, so this figure is not shown.")
                else:
                    kind, reason = "not_in_source", f"The Summary of Expenditure in the {src.title} does not print this line."
                s = series[series_id]
                out.append(Observation(obs_id=oid, series_id=series_id, period=period, vintage=vintage, unit=s.unit,
                                       scale_factor=s.scale_factor, status="unchecked", published=False, gap_kind=kind,
                                       gap_reason=reason, evidence_summary=reason))
    return out


def build(release: str = config.DEFAULT_RELEASE) -> dict[str, Any]:
    spec = load_spec("abs")
    labels_spec = load_spec("abs_labels")
    labels = LabelMap(labels_spec["labels"])
    sources = sorted((s for s in read_manifest() if s.doc_type == "abs"), key=lambda s: s.period)
    titles = {s.source_id: s.title for s in sources}
    order = {s.source_id: s.period for s in sources}
    catalogue = series_catalogue(spec, labels_spec)
    series = {s.series_id: s for s in catalogue}
    parents = {s.series_id: s.parent_id for s in catalogue}

    cells: list[Cell] = []
    located: dict[str, dict[str, Any]] = {}
    not_located: dict[str, str] = {}
    coverage: list[dict[str, Any]] = []
    blocked: dict[tuple[str, int, int], str] = {}
    for source in sources:
        got = validated_tables(source)
        if got is None:
            not_located[source.source_id] = "No validated extraction run exists"
            continue
        run, tables = got
        table, info = locate(tables, spec)
        if table is None:
            not_located[source.source_id] = f"The function-wise expenditure table could not be located ({info['result']})"
            located[source.source_id] = {"locator": info}
            continue
        table_cells, tinfo = build_cells(source, run, table, spec, labels)
        tinfo["locator"] = info
        located[source.source_id] = tinfo
        cells.extend(table_cells)
        coverage.append({"dataset": DATASET, "source_id": source.source_id, "table": "Summary of Expenditure", **tinfo["coverage"]})
        bad = sorted(set(tinfo["table_flags"]) & BLOCKING_TABLE_FLAGS)
        if bad:
            blocked[(source.source_id, table.page, table.table_index)] = f"the table is flagged {', '.join(bad)}"
        overlay = config.work_dir() / "qa" / f"overlay_{source.source_id}_p{table.page:03d}.png"
        render_overlay(source_path(source), table, overlay)

    checks = evaluate_sum_rules(cells, spec["rules"], DATASET, parents, blocked, lambda c: column_label(c, titles))
    checks += cross_checks(cells, titles, order, series)
    observations = build_observations(cells, checks, series, order, titles, release)
    observations += derive(spec, observations, series, release)
    observations += gap_observations(spec, located, not_located, observations, series)
    used = {o.series_id for o in observations}
    catalogue = [s for s in catalogue if s.series_id in used]

    info = {
        "dataset": DATASET, "built_at": config.now_iso(), "located": located, "not_located": not_located,
        "check_pass_rates": {
            "all": pass_rate(checks),
            "arithmetic": pass_rate(checks, ["column_total", "hierarchy_sum", "accounting_identity", "cross_table"]),
            "cross_edition": pass_rate(checks, ["cross_edition"]),
        },
        "comparison_arslan": arslan_comparison(observations),
    }
    save_dataset(DATASET, cells=cells, checks=checks, series=catalogue, observations=observations, coverage=coverage, info=info)
    return info
