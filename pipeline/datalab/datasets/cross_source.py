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
from decimal import Decimal
from pathlib import Path
from typing import Any

from .. import config
from ..checks import fmt
from ..normalise import clean_text, decimal_to_str, last_digit_unit, normalise_label, parse_printed
from ..schema import Cell, Check, Source, check_id_for


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


# ----------------------------------------------------------------------------- Economic Survey, labour chapter

ROUNDING_RULE = "|ours - theirs| <= half a unit of the last printed digit of each figure"


def cell_pair_check(*, dataset: str, rule_id: str, ours: Cell, theirs: Cell, what: str, where_ours: str,
                    where_theirs: str) -> Check:
    """A figure we hold against the same figure printed in another official publication (both are cells).

    Equal -> pass; within half a unit of the last printed digit of each -> pass_within_rounding;
    otherwise a recorded fail. `target` is our cell; the other publication's cell is the member.
    """
    base: dict[str, Any] = dict(
        check_id=check_id_for("cross_source", rule_id, ours.cell_id, theirs.cell_id), check_type="cross_source",
        dataset=dataset, rule_id=rule_id, source_ids=sorted({ours.source_id, theirs.source_id}),
        member_cell_ids=[theirs.cell_id], target_cell_id=ours.cell_id, target_source=theirs.source_id,
        tolerance_rule=ROUNDING_RULE)
    if ours.value_parsed is None or theirs.value_parsed is None:
        return Check(**base, result="not_evaluable", not_evaluable_reason="one of the two figures could not be parsed",
                     description=f"Could not compare {what} between {where_ours} and {where_theirs}.")
    a, b = Decimal(ours.value_parsed), Decimal(theirs.value_parsed)
    residual = b - a
    tolerance = Decimal("0.5") * last_digit_unit(ours.value_parsed) + Decimal("0.5") * last_digit_unit(theirs.value_parsed)
    if residual == 0:
        result, verdict = "pass", "They are equal."
    elif abs(residual) <= tolerance:
        result, verdict = "pass_within_rounding", f"They differ by {fmt(abs(residual))}, within rounding."
    else:
        result, verdict = "fail", f"They differ by {fmt(abs(residual))}, more than rounding allows, so the two sources disagree."
    return Check(**base, target_value=theirs.value_parsed, expected=decimal_to_str(a), observed=decimal_to_str(b),
                 residual=decimal_to_str(residual), result=result,
                 description=f"{what}: {where_ours} prints {fmt(a)}; {where_theirs} prints {fmt(b)}. {verdict}")


def header_key(text: str) -> str:
    """Header words collected by position, as one comparable string ('Unemp- loyed Labour Force' -> 'unemployed labour force')."""
    text = re.sub(r"-\s+", "", clean_text(text).lower())
    return re.sub(r"\s+", " ", text).strip()


def _one(patterns: list[dict[str, Any]], text: str) -> dict[str, Any] | None:
    """The single entry whose pattern matches the WHOLE text; None when none or several do."""
    hits = [e for e in patterns if re.fullmatch(e["pattern"], text)]
    return hits[0] if len(hits) == 1 else None


def read_measures_by_year(table, grid, value_cols: list[int], headers: dict[int, str], labels: dict[int, str],
                          kind: dict[str, Any]) -> tuple[dict[tuple[str, str, str], Any], list[str]]:
    """Rows are measures (each followed by its Rural and Urban rows), columns are survey years.

    Returns ({(measure, area, year): table cell}, problems). A column whose header does not print
    exactly one year, or two cells claiming one figure, leaves the whole table unread. A row
    whose label is not in the dictionary closes the block: the Rural/Urban rows under it mean nothing.
    """
    from .common import fiscal_years_in

    years: dict[int, str] = {}
    for col in value_cols:
        found = fiscal_years_in(headers.get(col, ""))
        if len(found) != 1:
            return {}, [f"column {col}: the header prints {found or 'no year'} (exactly one year is needed)"]
        years[col] = found[0]
    if len(set(years.values())) != len(years):
        return {}, ["two columns carry the same year"]
    out: dict[tuple[str, str, str], Any] = {}
    block: str | None = None
    for r in range(table.num_rows):
        row_cells = [grid[r][k] for k in value_cols if grid[r][k] is not None and grid[r][k].row == r and grid[r][k].col == k]
        if row_cells and all(c.column_header for c in row_cells):
            continue
        entry = _one(kind["rows"], header_key(normalise_label(labels.get(r, ""))))
        if entry is None:
            block = None
            continue
        if "area" not in entry:
            block = entry.get("measure")          # a measure row opens its block (None: a measure we do not compare)
        if block is None:
            continue
        for tc in row_cells:
            if not tc.text.strip():
                continue
            key = (block, entry.get("area", "total"), years[tc.col])
            if key in out:
                return {}, [f"two cells claim {key}"]
            out[key] = tc
    return out, []


def read_years_by_measure(table, grid, value_cols: list[int], headers: dict[int, str], labels: dict[int, str],
                          kind: dict[str, Any]) -> tuple[dict[tuple[str, str, str], Any], list[str]]:
    """Rows are survey years, columns are measures named by their header text (read by position).

    Every measure the spec lists must be the header of exactly one column, or nothing is read.
    """
    from .common import fiscal_years_in

    measures: dict[int, str] = {}
    for col in value_cols:
        entry = _one(kind["columns"], header_key(headers.get(col, "")))
        if entry is not None:
            measures[col] = entry["measure"]
    wanted = sorted({e["measure"] for e in kind["columns"]})
    if sorted(measures.values()) != wanted:
        return {}, [f"the column headers name {sorted(measures.values())}; each of {wanted} is needed exactly once"]
    out: dict[tuple[str, str, str], Any] = {}
    for r in range(table.num_rows):
        found = fiscal_years_in(labels.get(r, ""))
        if len(found) != 1:
            continue
        for col, measure in measures.items():
            tc = grid[r][col]
            if tc is None or tc.row != r or tc.col != col or tc.column_header or not tc.text.strip():
                continue
            key = (measure, "total", found[0])
            if key in out:
                return {}, [f"two cells claim {key}"]
            out[key] = tc
    return out, []


def identity_problem_years(figures: dict[tuple[str, str, str], Any]) -> dict[str, str]:
    """Years in which the other publication's own employed + unemployed does not give its labour force.

    Such a year is not used as evidence: either the table was misread or the publication is
    inconsistent, and in neither case does it confirm anything.
    """
    bad: dict[str, str] = {}
    for (measure, area, year) in sorted(figures):
        if measure != "labour_force":
            continue
        parts = [figures.get((m, area, year)) for m in ("employed", "unemployed")]
        if any(p is None for p in parts):
            continue
        values = [parse_printed(tc.text) for tc in (figures[(measure, area, year)], *parts)]
        if any(v.value is None for v in values):
            bad[year] = "a count in the other publication's table could not be parsed as one number"
            continue
        unit = max(last_digit_unit(v.value_str) for v in values)
        if abs(values[1].value + values[2].value - values[0].value) > unit:   # half a unit per item added
            bad[year] = "the other publication's employed plus unemployed does not give its labour force"
    return bad


def pair_checks(cells: list[Cell], theirs: list[tuple[Cell, str, str, str, str]], cfg: dict[str, Any], names: dict[str, str],
                titles: dict[str, str], their_title: str) -> tuple[list[Check], list[dict[str, Any]]]:
    """Every LFS cell of (measure, both sexes, area, round) against each Economic Survey cell of the same figure.

    `theirs`: (cell, measure, area, year, table title). A pair is formed only when unit and scale are the same.
    """
    ours_by_key: dict[tuple[str, str], list[Cell]] = {}
    for c in cells:
        if c.series_id and c.period and not c.is_missing:
            ours_by_key.setdefault((c.series_id, c.period), []).append(c)
    checks: list[Check] = []
    pairs: list[dict[str, Any]] = []
    for their_cell, measure, area, year, table_title in theirs:
        m = cfg["measures"][measure]
        sid = f"lfs.{measure}.total.{area}"
        if their_cell.unit != m["unit"] or int(their_cell.scale_factor or 0) != int(m.get("scale_factor", 1)):
            continue
        for ours in sorted(ours_by_key.get((sid, year), []), key=lambda c: (c.source_id, c.page, c.row_index, c.col_index)):
            if ours.unit != m["unit"] or int(ours.scale_factor or 0) != int(m.get("scale_factor", 1)):
                continue      # not the same unit: never compared
            chk = cell_pair_check(
                dataset="lfs", rule_id="lfs.matches_economic_survey", ours=ours, theirs=their_cell,
                what=f"{names.get(sid, sid)}, {year}",
                where_ours=f"the {titles.get(ours.source_id, ours.source_id)} (page {ours.page})",
                where_theirs=f"the {their_title} (page {their_cell.page}, table '{table_title}')")
            checks.append(chk)
            pairs.append({"series_id": sid, "period": year, "lfs_source_id": ours.source_id, "lfs_page": ours.page,
                          "lfs_value_raw": ours.value_raw, "pes_page": their_cell.page, "pes_table": table_title,
                          "pes_value_raw": their_cell.value_raw, "pes_cell_id": their_cell.cell_id, "result": chk.result,
                          "residual": chk.residual, "check_id": chk.check_id})
    return checks, pairs


def pes_labour_checks(cells: list[Cell], manifest: list[Source], cfg: dict[str, Any], names: dict[str, str],
                      titles: dict[str, str]) -> tuple[list[Check], list[Cell], dict[str, Any]]:
    """LFS figures against the Economic Survey labour chapter. Returns (checks, the chapter's cells, info).

    The chapter's cells are returned unmapped (no series id): they are evidence on a receipt and can
    never become a published value. Tables are found by their printed title; nothing is located by page.
    """
    from ..extract import latest_run, run_output_json
    from ..tables import load_tables, page_words
    from ..validate import BLOCKING_TABLE_FLAGS, detect_table_flags, render_overlay, table_coverage
    from . import lfs
    from .common import column_header_text, make_cell, row_label

    source = next((s for s in manifest if s.source_id == cfg["source_id"] and s.verification_status != "failed"), None)
    if source is None:
        return [], [], {"status": "skipped", "reason": f"{cfg['source_id']} is not registered (or failed verification)"}
    info: dict[str, Any] = {"source_id": source.source_id, "tables": [], "not_compared": cfg.get("not_compared", [])}
    pdf = config.sources_dir() / source.local_path
    run = latest_run(source.source_id, validated_only=True)
    if run is None or not pdf.exists():
        return [], [], {**info, "status": "skipped", "reason": "no validated extraction run (or the file is not in SOURCES_DIR)"}
    info["run_id"] = run.run_id
    by_page: dict[int, list[Any]] = {}
    for t in load_tables(run_output_json(run.run_id)):
        by_page.setdefault(t.page, []).append(t)

    found: dict[str, list[tuple[Any, str]]] = {}
    for page in sorted(by_page):
        words = page_words(pdf, page)
        zone_top = 0.0
        for t in sorted(by_page[page], key=lambda t: t.bbox[1]):
            caption, _ = lfs.caption_and_header(t, t.value_columns(), words, zone_top)
            zone_top = max(zone_top, t.bbox[3])
            for kind in cfg["tables"]:
                if caption and re.search(kind["caption"], caption):
                    found.setdefault(kind["kind"], []).append((t, caption))

    theirs: list[tuple[Cell, str, str, str, str]] = []
    for kind in cfg["tables"]:
        hits = found.get(kind["kind"], [])
        entry: dict[str, Any] = {"kind": kind["kind"], "title": kind["title"], "titles_found": len(hits)}
        info["tables"].append(entry)
        if len(hits) != 1:
            entry["result"] = "not_located" if not hits else "tie"
            continue
        table, caption = hits[0]
        words = page_words(pdf, table.page)
        value_cols = table.value_columns()
        grid = table.grid()
        flags = detect_table_flags(table)
        coverage = table_coverage(table, pdf)
        entry.update({"page": table.page, "table_index": table.table_index, "caption": caption[:160], "table_flags": flags,
                      "coverage": coverage["coverage"], "coverage_row_band": coverage["coverage_row_band"]})
        problems: list[str] = []
        if set(flags) & BLOCKING_TABLE_FLAGS:
            problems.append(f"the table is flagged {sorted(set(flags) & BLOCKING_TABLE_FLAGS)}")
        if coverage["coverage"] is None or coverage["coverage"] < 0.90:
            problems.append("coverage of the table is below 90%")
        if coverage["coverage_row_band"] is not None and coverage["coverage_row_band"] < 0.90:
            problems.append("a column may have been dropped (row-band coverage below 90%)")
        if not re.search(kind["unit_marker"], caption):
            problems.append("the unit is not printed where expected")
        # Header words: inside the table box only. The title and the unit line sit just above it and
        # would otherwise be collected into the columns they happen to stand over.
        boxed = [w for w in words if (w[1] + w[3]) / 2 >= table.bbox[1] - 0.002]
        headers = {col: column_header_text(table, col, boxed) for col in value_cols}
        labels = {r: row_label(table, grid, r, value_cols) for r in range(table.num_rows)}
        reader = read_measures_by_year if kind["layout"] == "measures_by_year" else read_years_by_measure
        figures, read_problems = reader(table, grid, value_cols, headers, labels, kind)
        problems += read_problems
        if problems:
            entry.update({"result": "not_read", "problems": problems})
            continue
        render_overlay(pdf, table, config.work_dir() / "qa" / f"overlay_{source.source_id}_p{table.page:03d}_t{table.table_index}.png")
        bad_years = identity_problem_years(figures)
        entry.update({"result": "read", "figures_read": len(figures), "years": sorted({k[2] for k in figures}),
                      "years_not_used": bad_years})
        for (measure, area, year), tc in sorted(figures.items()):
            if year in bad_years or year not in cfg["rounds"]:
                continue
            cell = make_cell(source=source, run=run, table=table, tcell=tc, row_label_raw=labels.get(tc.row, ""),
                             col_label_raw=clean_text(headers.get(tc.col, "")), table_flags=flags)
            cell.unit = cfg["measures"][measure]["unit"]
            cell.scale_factor = int(cfg["measures"][measure].get("scale_factor", 1))
            theirs.append((cell, measure, area, year, kind["title"]))

    checks, pairs = pair_checks(cells, theirs, cfg, names, titles, source.title)
    used = {p["pes_cell_id"] for p in pairs}
    info.update({"status": "compared", "checks": len(checks), "pairs": pairs})
    return checks, [c for c, *_ in theirs if c.cell_id in used], info
