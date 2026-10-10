"""PBS Labour Force Survey annual reports: locate the summary tables, map rows and columns, check, decide status.

Everything here is driven by `specs/lfs.yaml` and `specs/lfs_labels.yaml`.

How a number gets a meaning (never by guessing):
- the table KIND comes from its printed title, read from the PDF text layer above the table;
- a COLUMN's survey round and sex come from the printed header words by position, and the
  result must be exactly the layout the report is expected to print (previous round then own
  round, each Total / Male / Female), otherwise the whole table stays unmapped;
- a ROW's area or industry comes from the hand-written label dictionary; a bare "Rural" or
  "Urban" row counts as Pakistan's only when the block it sits in was opened by a "Pakistan" row.

The long reports are extracted in page ranges (decision D18), so a source can have several
validated runs; `validated_runs` lists all of them and each page is taken from the newest run
that holds it strictly inside its range.
"""
from __future__ import annotations

import re
import statistics
from collections import defaultdict
from decimal import Decimal
from typing import Any

from .. import config
from ..checks import classify_disputes, equality_check, fmt, pass_rate, sum_check, value_check
from ..extract import run_output_json, runs_dir
from ..normalise import clean_text, last_digit_unit, normalise_label, parse_printed
from ..schema import Cell, Check, Observation, RunManifest, Series, SeriesBreak, obs_id_for
from ..sources import read_manifest, source_path
from ..status import build_observations
from ..tables import Table, load_tables, page_words
from ..validate import BLOCKING_TABLE_FLAGS, detect_table_flags, render_overlay, table_coverage
from .common import LabelMap, fiscal_years_in, load_spec, make_cell, row_label, save_dataset

DATASET = "lfs"
DOC_TYPE = "lfs_annual_report"
Word = tuple[float, float, float, float, str]
COUNT_MEASURES = ("labour_force", "employed", "unemployed")
SEX_WORDS = {"total": "total", "male": "male", "female": "female"}
TABLE_NO = re.compile(r"\btable[\s\-]*\d+(?:\.\d+)?\b", re.I)


# --------------------------------------------------------------------------- runs

def validated_runs(source_id: str) -> list[RunManifest]:
    """Every validated run of a source, newest first (core helpers return only the newest one)."""
    out = []
    for path in sorted(runs_dir().glob("*/manifest.json")):
        m = RunManifest(**config.read_json(path))
        if m.source_id == source_id and m.validated:
            out.append(m)
    return sorted(out, key=lambda m: m.started_at, reverse=True)


def usable_pages(run: RunManifest, page_count: int) -> set[int]:
    """Pages a run may supply. A page-range run never supplies its first or last page (D18)."""
    if run.run_mode == "page-range" and run.page_range:
        return set(range(int(run.page_range[0]) + 1, int(run.page_range[1])))
    return set(range(1, page_count + 1))


def tables_for_source(source) -> tuple[list[tuple[RunManifest, Table]], list[dict[str, Any]]]:
    """Tables from all validated runs; each page comes from the newest run that holds it inside its range."""
    claimed: set[int] = set()
    out: list[tuple[RunManifest, Table]] = []
    runs_info: list[dict[str, Any]] = []
    for run in validated_runs(source.source_id):
        pages = usable_pages(run, source.page_count or 0) - claimed
        tables = [t for t in load_tables(run_output_json(run.run_id)) if t.page in pages]
        out.extend((run, t) for t in tables)
        claimed |= pages
        runs_info.append({"run_id": run.run_id, "run_mode": run.run_mode, "page_range": run.page_range,
                          "pages_used": len(pages), "tables_used": len(tables)})
    return out, runs_info


# --------------------------------------------------------------------------- reading the page around a table

def text_lines(words: list[Word], tol: float = 0.005) -> list[list[Word]]:
    """Words grouped into printed lines (top to bottom, left to right)."""
    lines: list[list[Word]] = []
    for w in sorted(words, key=lambda w: ((w[1] + w[3]) / 2, w[0])):
        cy = (w[1] + w[3]) / 2
        if lines and abs(cy - statistics.fmean((x[1] + x[3]) / 2 for x in lines[-1])) <= tol:
            lines[-1].append(w)
        else:
            lines.append([w])
    return [sorted(line, key=lambda w: w[0]) for line in lines]


def numeric_body_cells(table: Table, value_cols: list[int]):
    return [c for c in table.cells if c.col in value_cols and c.bbox and not c.column_header
            and parse_printed(c.text).value is not None]


def caption_and_header(table: Table, value_cols: list[int], words: list[Word], zone_top: float) -> tuple[str, list[Word]]:
    """The printed title above a table and the header words between the title and the first amount.

    Looks only between `zone_top` (the bottom of the previous table on the page, or the top of the
    page) and the first printed amount. The title starts at the LAST "Table N" found there.
    Returns ("", []) when there is no title, in which case the table cannot be identified.
    """
    body = numeric_body_cells(table, value_cols)
    if not body:
        return "", []
    first_y = min(c.bbox[1] for c in body)
    zone = [w for w in words if zone_top - 0.001 <= (w[1] + w[3]) / 2 < first_y - 0.001]
    lines = text_lines(zone)
    start = None
    for i, line in enumerate(lines):
        if TABLE_NO.search(clean_text(" ".join(w[4] for w in line))):
            start = i
    if start is None:
        return "", []
    kept = lines[start:]
    first = clean_text(" ".join(w[4] for w in kept[0]))
    first = first[list(TABLE_NO.finditer(first))[-1].start():]
    text = " ".join([first] + [clean_text(" ".join(w[4] for w in line)) for line in kept[1:]])
    text = re.sub(r"\s+", " ", text).lower()
    header_words = [w for line in kept[1:] for w in line]
    return text, header_words


def classify(caption: str, source_round: str, spec: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    """Which kind of table a printed title names. Exactly one kind must match."""
    if not caption:
        return None, "no_title"
    hits = [k for k in spec["tables"] if any(re.search(p, caption) for p in k["captions"])
            and not (k.get("exclude") and re.search(k["exclude"], caption))]
    if not hits:
        return None, "not_a_target"
    if len(hits) > 1:
        return None, "ambiguous_title"
    icls = spec.get("icls") or {}
    if re.search(icls.get("forbidden_pattern", r"$^"), caption):
        return None, "other_definition"
    if source_round in icls.get("required_in_rounds", []) and not re.search(icls["required_pattern"], caption):
        return None, "definition_not_stated"
    return hits[0], "found"


# --------------------------------------------------------------------------- columns

def column_centres(table: Table, value_cols: list[int]) -> dict[int, float]:
    out: dict[int, float] = {}
    for col in value_cols:
        xs = [(c.bbox[0] + c.bbox[2]) / 2 for c in numeric_body_cells(table, [col])]
        if xs:
            out[col] = statistics.median(xs)
    return out


def map_columns(centres: dict[int, float], header_words: list[Word], source_round: str,
                spec: dict[str, Any]) -> tuple[dict[int, tuple[str, str]], list[str]]:
    """Each value column -> (survey round, sex), from the printed header words by position.

    Accepted layouts, per round group from left to right: Total, Male, Female; or Total, Male,
    Female followed by the two "Augmented" columns (Total, Female), which are recognised and left
    unmapped. The rounds must be the report's own round, optionally preceded by the round it is
    expected to compare with. Anything else returns problems and an empty mapping.
    """
    problems: list[str] = []
    cols = sorted(centres, key=lambda k: centres[k])
    if len(cols) < 3:
        return {}, ["fewer than three value columns"]
    xs = [centres[k] for k in cols]
    gap = min(b - a for a, b in zip(xs, xs[1:]))
    if gap <= 0:
        return {}, ["value columns overlap"]

    def nearest(x: float) -> tuple[int, float]:
        k = min(cols, key=lambda c: abs(centres[c] - x))
        return k, abs(centres[k] - x)

    # Survey rounds: the lowest header line that prints a round label.
    year_lines: dict[float, list[tuple[float, str]]] = defaultdict(list)
    for line in text_lines(header_words):
        for w in line:
            for fy in fiscal_years_in(w[4]):
                year_lines[max((x[1] + x[3]) / 2 for x in line)].append(((w[0] + w[2]) / 2, fy))
    if not year_lines:
        return {}, ["the header prints no survey round"]
    years = sorted(year_lines[max(year_lines)])
    labels = [fy for _, fy in years]
    previous = (spec.get("previous_round") or {}).get(source_round)
    allowed = [[source_round]] + ([[previous, source_round]] if previous else [])
    if labels not in allowed:
        return {}, [f"header rounds {labels} are not the expected {allowed}"]

    sexes: dict[int, list[str]] = defaultdict(list)
    augmented_x: list[float] = []
    for w in header_words:
        token = re.sub(r"[^a-z]", "", clean_text(w[4]).lower())
        cx = (w[0] + w[2]) / 2
        if token == "augmented":
            augmented_x.append(cx)
        elif token in SEX_WORDS:
            k, dist = nearest(cx)
            if dist <= gap / 2:
                sexes[k].append(SEX_WORDS[token])
    groups: dict[str, list[int]] = defaultdict(list)
    for k in cols:
        if len(sexes.get(k, [])) != 1:
            problems.append(f"column {k}: header gives {sexes.get(k, [])} instead of one of Total/Male/Female")
        groups[min(years, key=lambda y: abs(y[0] - centres[k]))[1]].append(k)
    if problems:
        return {}, problems
    mapping: dict[int, tuple[str, str]] = {}
    sizes = {len(g) for g in groups.values()}
    if set(groups) != set(labels) or len(sizes) != 1:
        return {}, [f"columns do not split evenly between the rounds {labels}"]
    for fy, members in groups.items():
        seq = [sexes[k][0] for k in members]
        if seq == ["total", "male", "female"]:
            pass
        elif seq == ["total", "male", "female", "total", "female"]:
            lo, hi = centres[members[3]] - gap / 2, centres[members[4]] + gap / 2
            if not any(lo <= x <= hi for x in augmented_x):
                problems.append(f"round {fy}: five columns but no 'Augmented' heading over the last two")
        else:
            problems.append(f"round {fy}: column order {seq} is not Total, Male, Female")
        for k, sex in zip(members[:3], seq[:3]):
            mapping[k] = (fy, sex)
    if problems:
        return {}, problems
    return mapping, []


# --------------------------------------------------------------------------- rows

class AreaRows:
    """Row label -> area of Pakistan, with the block context the label sits in.

    The tables list Pakistan, Rural, Urban and then each province with its own Rural and Urban
    rows. A bare "Rural"/"Urban"/"Total" row belongs to whichever block was opened last; if that
    block is a province, or an unrecognised label, the row stays unmapped.
    """

    def __init__(self, labels_spec: dict[str, Any]):
        self.entries = [(re.compile(e["pattern"], re.I), e["block"], e.get("area")) for e in labels_spec["area_labels"]]
        self.block: str | None = None

    def lookup(self, raw_label: str) -> tuple[str | None, str]:
        label = normalise_label(raw_label)
        hits = {(block, area) for pattern, block, area in self.entries if pattern.fullmatch(label)}
        if len(hits) != 1:
            self.block = None  # an unknown row breaks the block: later bare rows cannot be attributed
            return None, "ambiguous" if hits else "unmapped"
        block, area = hits.pop()
        if block != "same":
            self.block = block
        if self.block != "pakistan" or area is None:
            return None, "out_of_scope"
        return area, "dictionary"


def series_id_for(measure: str, sex: str, area: str) -> str:
    return f"lfs.{measure}.{sex}.{area}"


def industry_series_id(slug: str, sex: str) -> str:
    return f"lfs.employment_share.industry.{slug}.{sex}.total"


# --------------------------------------------------------------------------- one table -> cells

def build_cells(source, run: RunManifest, table: Table, kind: dict[str, Any], caption: str, header_words: list[Word],
                spec: dict[str, Any], labels_spec: dict[str, Any]) -> tuple[list[Cell], dict[str, Any]]:
    pdf = source_path(source)
    value_cols = table.value_columns()
    flags = detect_table_flags(table)
    coverage = table_coverage(table, pdf)
    if coverage["coverage_row_band"] is not None and coverage["coverage_row_band"] < 0.90 <= (coverage["coverage"] or 0):
        flags.append("possible_dropped_column")
    if coverage["coverage"] is None or coverage["coverage"] < spec.get("min_table_coverage", 0.90):
        flags.append("low_coverage")
    centres = column_centres(table, value_cols)
    col_map, col_problems = map_columns(centres, header_words, source.period, spec)
    if col_problems:
        flags.append("column_unmapped")
    unit_ok = re.search(kind["unit_marker"], caption) is not None
    if not unit_ok:
        flags.append("scale_not_confirmed")

    grid = table.grid()
    area_rows = AreaRows(labels_spec)
    industries = LabelMap(labels_spec["industry_labels"])
    cells: list[Cell] = []
    unmapped: list[str] = []
    out_of_scope = 0
    for r in range(table.num_rows):
        row_cells = [grid[r][k] for k in value_cols if grid[r][k] is not None and grid[r][k].row == r and grid[r][k].col == k]
        if row_cells and all(c.column_header for c in row_cells):
            continue
        label = row_label(table, grid, r, value_cols)
        first = grid[r][0]
        if not label and first is not None and first.row == r and first.col_span >= table.num_cols:
            # A block heading printed across the full width ("Pakistan"); Docling sometimes marks it as a header.
            label = clean_text(first.text)
        if not any(parse_printed(c.text).value is not None or parse_printed(c.text).is_missing and c.text.strip()
                   for c in row_cells):
            # A row with a label but no amounts (for example a "Pakistan" heading row) still opens a block.
            if label and kind["layout"] != "industry_by_round_sex":
                area_rows.lookup(label)
            continue
        if kind["layout"] == "industry_by_round_sex":
            key, how = industries.lookup(label)
        else:
            key, how = area_rows.lookup(label)
        if key is None and how == "out_of_scope":
            out_of_scope += 1
        elif key is None:
            unmapped.append(label or "(row with no label)")
        for tc in row_cells:
            if not tc.text.strip():
                continue
            period, sex = col_map.get(tc.col, (None, None))
            header = f"{period} {sex}" if period else ""
            cell = make_cell(source=source, run=run, table=table, tcell=tc, row_label_raw=label, col_label_raw=header,
                             table_flags=flags)
            cell.unit = kind["unit"]
            cell.scale_factor = int(kind.get("scale_factor", 1)) if unit_ok else None
            if key and period and unit_ok:
                cell.series_id = (industry_series_id(key, sex) if kind["layout"] == "industry_by_round_sex"
                                  else series_id_for(kind["measure"], sex, key))
                cell.period, cell.vintage, cell.mapping_method = period, spec.get("vintage", "na"), "dictionary"
            cells.append(cell)

    # Two rows claiming the same figure means the row logic is wrong for this table: map nothing.
    seen: dict[tuple[str, str], int] = defaultdict(int)
    for c in cells:
        if c.series_id:
            seen[(c.series_id, c.period)] += 1
    if any(n > 1 for n in seen.values()):
        flags.append("duplicate_row_mapping")
        for c in cells:
            c.series_id, c.period, c.vintage, c.mapping_method = None, None, None, "unmapped"
            c.structural_flags = list(flags)
    info = {
        "source_id": source.source_id, "kind": kind["kind"], "table": kind["title"], "page": table.page,
        "table_index": table.table_index, "run_id": run.run_id, "run_mode": run.run_mode, "page_range": run.page_range,
        "rows": table.num_rows, "cols": table.num_cols, "value_columns": value_cols, "table_flags": flags,
        "columns": {str(k): {"period": v[0], "sex": v[1]} for k, v in col_map.items()},
        "column_problems": col_problems, "unit_confirmed": bool(unit_ok), "caption": caption[:160],
        "unmapped_labels": unmapped, "rows_out_of_scope": out_of_scope,
        "mapped_cells": sum(1 for c in cells if c.series_id), "coverage": coverage,
    }
    return cells, info


def locate_tables(source, pairs: list[tuple[RunManifest, Table]], spec: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Find the target tables of one report. Two tables claiming the same kind: neither is used."""
    pdf = source_path(source)
    by_page: dict[int, list[tuple[RunManifest, Table]]] = defaultdict(list)
    for run, t in pairs:
        by_page[t.page].append((run, t))
    found: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    for page in sorted(by_page):
        words = page_words(pdf, page)
        zone_top = 0.0
        for run, t in sorted(by_page[page], key=lambda x: x[1].bbox[1]):
            caption, header_words = caption_and_header(t, t.value_columns(), words, zone_top)
            zone_top = max(zone_top, t.bbox[3])
            kind, result = classify(caption, source.period, spec)
            if kind is not None:
                found.append({"run": run, "table": t, "kind": kind, "caption": caption, "header_words": header_words})
            elif result not in ("no_title", "not_a_target"):
                rejected.append({"page": page, "table_index": t.table_index, "result": result, "caption": caption[:120]})
    counts: dict[str, int] = defaultdict(int)
    for f in found:
        counts[f["kind"]["kind"]] += 1
    for f in [f for f in found if counts[f["kind"]["kind"]] > 1]:
        rejected.append({"page": f["table"].page, "table_index": f["table"].table_index, "result": "tie",
                         "kind": f["kind"]["kind"], "caption": f["caption"][:120]})
    return [f for f in found if counts[f["kind"]["kind"]] == 1], rejected


# --------------------------------------------------------------------------- series

def series_catalogue(spec: dict[str, Any], labels_spec: dict[str, Any], breaks: list[SeriesBreak]) -> list[Series]:
    out: list[Series] = []
    sex_names, area_names = spec["sex_names"], spec["area_names"]

    def add(sid: str, name: str, parent: str | None, m: dict[str, Any], dims: dict[str, str], sort: int, definition: str) -> None:
        out.append(Series(series_id=sid, name=name, parent_id=parent, dataset=DATASET, frequency=spec["frequency"],
                          unit=m["unit"], scale_factor=int(m.get("scale_factor", 1)), definition=definition,
                          definition_status="draft", synonyms=list(m.get("synonyms", [])), breaks=breaks,
                          source_doc_types=[DOC_TYPE], sort_key=sort, dims=dims))

    for measure, m in spec["measures"].items():
        if measure == "employment_share.industry":
            for i, ind in enumerate(labels_spec["industries"]):
                for j, sex in enumerate(spec["sexes"]):
                    sid = industry_series_id(ind["slug"], sex)
                    if sex != "total":
                        parent = industry_series_id(ind["slug"], "total")
                    else:
                        parent = None if ind["slug"] == "all" else industry_series_id("all", "total")
                    add(sid, f"{m['name']}: {ind['name']}, {sex_names[sex]}", parent, m,
                        {"industry": ind["slug"], "sex": sex, "area": "total"}, m["sort"] + i * 3 + j,
                        f"{clean_text(m['definition'])} Industry division: {ind['name']}; {sex_names[sex]}.")
            continue
        n = 0
        for sex in spec["sexes"]:
            for area in spec["areas"]:
                sid = series_id_for(measure, sex, area)
                if area != "total":
                    parent = series_id_for(measure, sex, "total")
                else:
                    parent = None if sex == "total" else series_id_for(measure, "total", "total")
                add(sid, f"{m['name']}, {sex_names[sex]}, {area_names[area]}", parent, m, {"sex": sex, "area": area},
                    m["sort"] + n, f"{clean_text(m['definition'])} Coverage: {sex_names[sex]}, {area_names[area]}.")
                n += 1
    return out


# --------------------------------------------------------------------------- checks

def _index(cells: list[Cell]) -> dict[tuple[str, str], dict[str, Cell]]:
    """(source, period) -> series -> cell."""
    out: dict[tuple[str, str], dict[str, Cell]] = defaultdict(dict)
    for c in cells:
        if c.series_id and c.period:
            out[(c.source_id, c.period)].setdefault(c.series_id, c)
    return out


def _blocked(involved: list[Cell], blocked: dict[tuple[str, int, int], str]) -> str | None:
    return next((blocked[(c.source_id, c.page, c.table_index)] for c in involved
                 if (c.source_id, c.page, c.table_index) in blocked), None)


def _where(period: str, source_id: str, titles: dict[str, str]) -> str:
    return f"the {period} columns of the {titles.get(source_id, source_id)}"


def count_sum_checks(cells: list[Cell], spec: dict[str, Any], titles: dict[str, str],
                     blocked: dict[tuple[str, int, int], str]) -> list[Check]:
    """Counts: male + female = total; rural + urban = total; employed + unemployed = labour force."""
    out: list[Check] = []
    names = spec["measures"]
    for (source_id, period), by in sorted(_index(cells).items()):
        where = _where(period, source_id, titles)

        def run(rule_id: str, check_type: str, target_id: str, member_ids: list[str], what_members: str, what_target: str) -> None:
            if target_id not in by or not all(m in by for m in member_ids):
                return
            target, members = by[target_id], [by[m] for m in member_ids]
            if target.is_missing or any(m.is_missing for m in members):
                return
            out.append(sum_check(check_type=check_type, dataset=DATASET, rule_id=rule_id, target=target,
                                 members=[(m, 1) for m in members], what_members=what_members, what_target=what_target,
                                 column_label=where, blocked_reason=_blocked([target, *members], blocked)))

        for measure in COUNT_MEASURES:
            label = names[measure]["name"].lower()
            for area in spec["areas"]:
                run("lfs.male_plus_female", "row_total", series_id_for(measure, "total", area),
                    [series_id_for(measure, "male", area), series_id_for(measure, "female", area)],
                    f"male and female {label} ({spec['area_names'][area]})", f"total for both sexes")
            for sex in spec["sexes"]:
                run("lfs.rural_plus_urban", "column_total", series_id_for(measure, sex, "total"),
                    [series_id_for(measure, sex, "rural"), series_id_for(measure, sex, "urban")],
                    f"rural and urban {label} ({spec['sex_names'][sex]})", "Pakistan total")
        for sex in spec["sexes"]:
            for area in spec["areas"]:
                run("lfs.employed_plus_unemployed", "accounting_identity", series_id_for("labour_force", sex, area),
                    [series_id_for("employed", sex, area), series_id_for("unemployed", sex, area)],
                    f"employed and unemployed persons ({spec['sex_names'][sex]}, {spec['area_names'][area]})",
                    "civilian labour force")
    return out


def recompute_unemployment_rate(rate: Cell, labour_force: Cell, unemployed: Cell | None, employed: Cell | None,
                                where: str, what: str, blocked_reason: str | None = None) -> Check | None:
    """Printed unemployment rate vs unemployed / labour force x 100 from printed counts of the same report.

    Bound (specs/lfs.yaml): half a unit of the rate's last digit, plus the first-order effect of
    each count being rounded to half a unit of its own last digit.
    """
    other = unemployed if unemployed is not None else employed
    if other is None:
        return None
    members = [labour_force, other]
    rule = "lfs.unemployment_rate_from_counts" if unemployed is not None else "lfs.unemployment_rate_from_employed"
    if any(c.value_parsed is None for c in (rate, *members)) or Decimal(labour_force.value_parsed or "0") <= 0:
        return value_check(check_type="recompute", dataset=DATASET, rule_id=rule, target=rate, members=members,
                           computed=None, tolerance=Decimal(0), description_ok="", what=what,
                           blocked_reason=blocked_reason or "an input could not be parsed")
    lf, x = Decimal(labour_force.value_parsed), Decimal(other.value_parsed)
    half = Decimal("0.5")
    d_rate = half * last_digit_unit(rate.value_parsed)
    d_lf, d_x = half * last_digit_unit(labour_force.value_parsed), half * last_digit_unit(other.value_parsed)
    tolerance = d_rate + 100 * (d_x / lf + x * d_lf / (lf * lf))
    tolerance = tolerance.quantize(Decimal("0.0001"))
    if unemployed is not None:
        computed = x / lf * 100
        how = f"unemployed {fmt(x)} / labour force {fmt(lf)} x 100"
    else:
        computed = (lf - x) / lf * 100
        how = f"(labour force {fmt(lf)} - employed {fmt(x)}) / labour force {fmt(lf)} x 100"
    computed = computed.quantize(Decimal("0.0001"))
    return value_check(check_type="recompute", dataset=DATASET, rule_id=rule, target=rate, members=members,
                       computed=computed, tolerance=tolerance, what=what, blocked_reason=blocked_reason,
                       description_ok=f"{what} in {where}, recomputed from the printed counts in million as {how}.")


def recompute_checks(cells: list[Cell], spec: dict[str, Any], titles: dict[str, str],
                     blocked: dict[tuple[str, int, int], str]) -> list[Check]:
    out: list[Check] = []
    for (source_id, period), by in sorted(_index(cells).items()):
        for sex in spec["sexes"]:
            for area in spec["areas"]:
                rate = by.get(series_id_for("unemployment_rate", sex, area))
                lf = by.get(series_id_for("labour_force", sex, area))
                if rate is None or lf is None or rate.is_missing or lf.is_missing:
                    continue
                unemployed = by.get(series_id_for("unemployed", sex, area))
                employed = by.get(series_id_for("employed", sex, area))
                unemployed = None if unemployed is not None and unemployed.is_missing else unemployed
                employed = None if employed is not None and employed.is_missing else employed
                involved = [c for c in (rate, lf, unemployed if unemployed is not None else employed) if c is not None]
                chk = recompute_unemployment_rate(
                    rate, lf, unemployed, employed, _where(period, source_id, titles),
                    f"Unemployment rate ({spec['sex_names'][sex]}, {spec['area_names'][area]}, {period})",
                    _blocked(involved, blocked))
                if chk is not None:
                    out.append(chk)
    return out


def shares_checks(cells: list[Cell], spec: dict[str, Any], labels_spec: dict[str, Any], titles: dict[str, str],
                  blocked: dict[tuple[str, int, int], str]) -> list[Check]:
    """Industry shares in each column must add to the printed Total (100.0), within the frozen tolerance."""
    out: list[Check] = []
    tolerance = Decimal(str(spec["tolerances"]["shares_sum_abs"]))
    slugs = [i["slug"] for i in labels_spec["industries"] if i["slug"] != "all"]
    for (source_id, period), by in sorted(_index(cells).items()):
        for sex in spec["sexes"]:
            target = by.get(industry_series_id("all", sex))
            members = [by[industry_series_id(s, sex)] for s in slugs if industry_series_id(s, sex) in by]
            members = [m for m in members if not m.is_missing]
            if target is None or target.is_missing or not members:
                continue
            out.append(sum_check(
                check_type="weights_sum", dataset=DATASET, rule_id="lfs.industry_shares_add_to_total", target=target,
                members=[(m, 1) for m in members], what_members=f"the industry shares ({spec['sex_names'][sex]})",
                what_target="Total", column_label=_where(period, source_id, titles),
                blocked_reason=_blocked([target, *members], blocked), abs_tolerance=tolerance))
    return out


def cross_checks(cells: list[Cell], titles: dict[str, str], order: dict[str, str], series: dict[str, Series]) -> list[Check]:
    """The same round's figure printed again: in the next report (cross_edition) or twice in one report (cross_table)."""
    groups: dict[tuple[str, str], list[Cell]] = defaultdict(list)
    for c in cells:
        if c.series_id and c.period and not c.is_missing:
            groups[(c.series_id, c.period)].append(c)
    out: list[Check] = []
    for (sid, period), group in sorted(groups.items()):
        if len(group) < 2:
            continue
        group.sort(key=lambda c: (order.get(c.source_id, ""), c.page, c.table_index, c.row_index, c.col_index))
        first = group[0]
        what = f"{series[sid].name if sid in series else sid}, {period}"
        for other in group[1:]:
            same = other.source_id == first.source_id
            out.append(equality_check(
                check_type="cross_table" if same else "cross_edition", dataset=DATASET,
                rule_id="lfs.restated_in_same_report" if same else "lfs.same_figure_in_next_report",
                first=first, second=other, what=what,
                where_first=f"the {titles.get(first.source_id, first.source_id)} (page {first.page})",
                where_second=f"the {titles.get(other.source_id, other.source_id)} (page {other.page})"))
    return out


# --------------------------------------------------------------------------- comparability, gaps

def comparability_search(spec: dict[str, Any], sources: dict[str, Any]) -> dict[str, Any]:
    """Recorded text search of the 2024-25 report; decides whether the comparability break is kept."""
    cfg = spec["comparability_search"]
    source = sources.get(cfg["source_id"])
    if source is None:
        return {"status": "source_not_registered", "break_kept": True}
    import pymupdf

    mention_pages: list[int] = []
    mentions: list[dict[str, Any]] = []
    positive: list[dict[str, Any]] = []
    negative: list[dict[str, Any]] = []
    with pymupdf.open(source_path(source)) as doc:
        for i, page in enumerate(doc, 1):
            text = re.sub(r"\s+", " ", page.get_text())
            for m in re.finditer(cfg["mentions"], text):
                if i not in mention_pages:
                    mention_pages.append(i)
                if len(mentions) < 12:
                    mentions.append({"page": i, "text": text[max(0, m.start() - 100):m.end() + 100]})
            for key, bucket in (("positive", positive), ("negative", negative)):
                for m in re.finditer(cfg[key], text):
                    bucket.append({"page": i, "text": text[max(0, m.start() - 120):m.end() + 120]})
    kept = not positive or bool(negative)
    return {"status": "searched", "source_id": cfg["source_id"], "patterns": {k: cfg[k] for k in ("mentions", "positive", "negative")},
            "pages_mentioning_comparability": mention_pages, "mentions_sample": mentions,
            "positive_statements": positive[:10],
            "negative_statements": negative[:10], "break_kept": kept}


def gap_observations(spec: dict[str, Any], observations: list[Observation], series: dict[str, Series],
                     reasons: dict[str, str]) -> list[Observation]:
    """Expected headline figures with no cell: a labelled gap, never a blank (decision D7).

    Always `not_yet_verified`: we do not claim the government did not publish a headline rate.
    """
    have = {o.obs_id for o in observations}
    exp = spec["expected_every_round"]
    out: list[Observation] = []
    for period in exp["rounds"]:
        for measure in exp["measures"]:
            for sex in exp["sexes"]:
                for area in exp["areas"]:
                    sid = series_id_for(measure, sex, area)
                    oid = obs_id_for(sid, period, spec.get("vintage", "na"))
                    if oid in have:
                        continue
                    reason = reasons.get(period) or ("No located and mapped table in the registered reports prints this "
                                                     "figure yet.")
                    s = series[sid]
                    out.append(Observation(obs_id=oid, series_id=sid, period=period, vintage=spec.get("vintage", "na"),
                                           unit=s.unit, scale_factor=s.scale_factor, status="unchecked", published=False,
                                           gap_kind="not_yet_verified", gap_reason=reason, evidence_summary=reason))
    return out


# --------------------------------------------------------------------------- build

def build(release: str = config.DEFAULT_RELEASE) -> dict[str, Any]:
    spec = load_spec("lfs")
    labels_spec = load_spec("lfs_labels")
    sources = sorted((s for s in read_manifest() if s.doc_type == DOC_TYPE), key=lambda s: s.period)
    titles = {s.source_id: s.title for s in sources}
    order = {s.source_id: s.period for s in sources}
    comparability = comparability_search(spec, {s.source_id: s for s in sources})
    breaks = [SeriesBreak(**b) for b in spec.get("breaks", [])] if comparability["break_kept"] else []
    catalogue = series_catalogue(spec, labels_spec, breaks)
    series = {s.series_id: s for s in catalogue}

    cells: list[Cell] = []
    located: dict[str, Any] = {}
    not_located: dict[str, str] = {}
    coverage: list[dict[str, Any]] = []
    blocked: dict[tuple[str, int, int], str] = {}
    gap_reasons: dict[str, str] = {}
    kinds = [k["kind"] for k in spec["tables"]]
    for source in sources:
        if source.source_id in (spec.get("skip_sources") or {}):
            not_located[source.source_id] = clean_text(spec["skip_sources"][source.source_id])
            gap_reasons[source.period] = clean_text(spec["skip_sources"][source.source_id]) + "."
            continue
        pairs, runs_info = tables_for_source(source)
        if not runs_info:
            not_located[source.source_id] = "No validated extraction run exists"
            continue
        found, rejected = locate_tables(source, pairs, spec)
        tables_info: list[dict[str, Any]] = []
        for f in found:
            table = f["table"]
            table_cells, tinfo = build_cells(source, f["run"], table, f["kind"], f["caption"], f["header_words"], spec, labels_spec)
            cells.extend(table_cells)
            tables_info.append(tinfo)
            coverage.append({"dataset": DATASET, "source_id": source.source_id, "table": f["kind"]["title"],
                             "kind": f["kind"]["kind"], "run_id": f["run"].run_id, **tinfo["coverage"]})
            bad = sorted(set(tinfo["table_flags"]) & BLOCKING_TABLE_FLAGS)
            if f["kind"]["layout"] == "industry_by_round_sex" and tinfo["unmapped_labels"]:
                bad.append("a row of the table is not matched to an industry")
            if bad:
                blocked[(source.source_id, table.page, table.table_index)] = f"the table is flagged {', '.join(bad)}"
            overlay = config.work_dir() / "qa" / f"overlay_{source.source_id}_p{table.page:03d}_t{table.table_index}.png"
            render_overlay(source_path(source), table, overlay)
        got = {t["kind"] for t in tables_info}
        located[source.source_id] = {"runs": runs_info, "tables": tables_info, "rejected": rejected,
                                     "kinds_not_located": [k for k in kinds if k not in got]}

    checks = count_sum_checks(cells, spec, titles, blocked)
    checks += recompute_checks(cells, spec, titles, blocked)
    checks += shares_checks(cells, spec, labels_spec, titles, blocked)
    checks += cross_checks(cells, titles, order, series)
    checks = classify_disputes(checks, cells)  # D25: a differing pair that each add up is `disputed`, by code
    observations = build_observations(cells, checks, series, order, titles, release)
    observations += gap_observations(spec, observations, series, gap_reasons)
    used = {o.series_id for o in observations}
    used |= {s.parent_id for s in catalogue if s.series_id in used and s.parent_id}
    catalogue = [s for s in catalogue if s.series_id in used]

    printed = sum(c["printed_numeric_tokens"] for c in coverage)
    matched = sum(c["matched"] for c in coverage)
    gaps: dict[str, int] = defaultdict(int)
    tiers: dict[str, int] = defaultdict(int)
    for o in observations:
        gaps["published" if o.published else (o.gap_kind or "unknown")] += 1
        tiers[o.tier or "none"] += 1
    info = {
        "dataset": DATASET, "built_at": config.now_iso(), "located": located, "not_located": not_located,
        "coverage_overall": {"printed_numeric_tokens": printed, "matched": matched,
                             "coverage": round(matched / printed, 4) if printed else None,
                             "tables": len(coverage),
                             "min_table_coverage": min((c["coverage"] or 0 for c in coverage), default=None)},
        "check_pass_rates": {
            "all": pass_rate(checks),
            "arithmetic": pass_rate(checks, ["row_total", "column_total", "accounting_identity", "recompute",
                                             "weights_sum", "cross_table"]),
            "cross_edition": pass_rate(checks, ["cross_edition"]),
            **{f"type:{t}": pass_rate(checks, [t]) for t in sorted({c.check_type for c in checks})},
        },
        "observations_by_outcome": dict(gaps), "tier_mix": dict(tiers),
        "comparability_text_search": comparability,
    }
    save_dataset(DATASET, cells=cells, checks=checks, series=catalogue, observations=observations, coverage=coverage, info=info)
    return info
