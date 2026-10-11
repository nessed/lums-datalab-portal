"""PBS Labour Force Survey annual reports: locate the summary tables, map rows and columns, check, decide status.

Everything here is driven by `specs/lfs.yaml` and `specs/lfs_labels.yaml`.

How a number gets a meaning (never by guessing):
- the table KIND comes from its printed title, read from the PDF text layer above the table;
- a COLUMN's survey round and sex come from the printed header words by position, and the
  result must be exactly the layout the report is expected to print (previous round then own
  round, each Total / Male / Female), otherwise the whole table stays unmapped;
- a ROW's area or industry comes from the hand-written label dictionary; a bare "Total", "Rural"
  or "Urban" row belongs to the block whose heading is printed above it ("Pakistan", or one of
  the four provinces: decision D33), and to nothing when that heading is not recognised;
- the DEFINITION (13th or 19th ICLS, decision D34) comes from the tag the title or header prints.
  19th ICLS tables feed separate `.icls19` series that are never joined to or compared with the
  13th ICLS series.

The long reports are extracted in page ranges (decision D18), so a source can have several
validated runs; `validated_runs` lists all of them and each page is taken from the newest run
that holds it strictly inside its range.
"""
from __future__ import annotations

import re
import statistics
from collections import defaultdict
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal
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
from .common import LabelMap, fiscal_years_in, load_spec, make_cell, row_label, save_dataset, try_second_reader

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


def usable_pages(run: RunManifest, page_count: int | None) -> set[int]:
    """Pages a run may supply. A page-range run never supplies its first or last page (D18).

    Refuses, loudly, the two cases where the pages are not known: a page-range run whose manifest
    records no range (it would otherwise pass for a full-document run and supply its boundary
    pages), and a full-document run of a source whose registry page count is empty (it would
    otherwise supply no page at all and every table would be reported as "not located").
    """
    if run.run_mode == "page-range":
        if not run.page_range or len(run.page_range) != 2:
            raise ValueError(f"run {run.run_id} is a page-range run but its manifest records no page range")
        return set(range(int(run.page_range[0]) + 1, int(run.page_range[1])))
    if not page_count:
        raise ValueError(f"run {run.run_id} is a full-document run but the registry holds no page count for "
                         f"{run.source_id}; the pages it supplies are not known")
    return set(range(1, int(page_count) + 1))


def tables_for_source(source) -> tuple[list[tuple[RunManifest, Table]], list[dict[str, Any]]]:
    """Tables from all validated runs; each page comes from the newest run that holds it inside its range."""
    claimed: set[int] = set()
    out: list[tuple[RunManifest, Table]] = []
    runs_info: list[dict[str, Any]] = []
    for run in validated_runs(source.source_id):
        pages = usable_pages(run, source.page_count) - claimed
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


DEFINITION_13, DEFINITION_19 = "13th ICLS", "19th ICLS"


def icls19_enabled(spec: dict[str, Any]) -> bool:
    return bool((spec.get("icls19") or {}).get("enabled"))


def province_keys(spec: dict[str, Any]) -> list[str]:
    """Province blocks that are mapped (decision D33); empty when `provinces.enabled` is off."""
    cfg = spec.get("provinces") or {}
    return list(cfg.get("list") or {}) if cfg.get("enabled") else []


def definition_of(caption: str, source_round: str, spec: dict[str, Any]) -> tuple[str | None, str]:
    """Which ICLS definition a table is on, from the tag its title or header prints. Never assumed.

    A 19th ICLS tag is accepted only in the rounds `icls19.rounds` lists and only while
    `icls19.enabled` is on; a caption that prints both tags is on neither.
    """
    icls = spec.get("icls") or {}
    has_19 = re.search(icls.get("forbidden_pattern", r"$^"), caption) is not None
    has_13 = re.search(icls.get("required_pattern", r"$^"), caption) is not None
    if has_19 and has_13:
        return None, "definition_ambiguous"
    if has_19:
        if not icls19_enabled(spec) or source_round not in (spec["icls19"].get("rounds") or []):
            return None, "other_definition"
        return DEFINITION_19, "found"
    if source_round in icls.get("required_in_rounds", []):
        if not has_13:
            return None, "definition_not_stated"
    elif source_round not in icls.get("rounds_13th_icls_throughout", []):
        # A round that the spec lists neither as printing the 13th ICLS definitions throughout nor
        # as having to state them is refused, never assumed.
        return None, "definition_unknown_for_round"
    return DEFINITION_13, "found"


def classify_with_definition(caption: str, source_round: str,
                             spec: dict[str, Any]) -> tuple[dict[str, Any] | None, str, str | None]:
    """(kind, result, definition) for a printed title. `definition` is set only when the table is found."""
    if not caption:
        return None, "no_title", None
    start = spec["title_start"]
    hits = [k for k in spec["tables"] if any(re.match(f"{start}(?:{p})", caption) for p in k["captions"])
            and not (k.get("exclude") and re.search(k["exclude"], caption))]
    if not hits:
        return None, "not_a_target", None
    if len(hits) > 1:
        return None, "ambiguous_title", None
    definition, result = definition_of(caption, source_round, spec)
    if definition is None:
        return None, result, None
    return hits[0], "found", definition


def classify(caption: str, source_round: str, spec: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    """Which kind of table a printed title names. Exactly one kind must match.

    A pattern is matched from the START of the title, straight after the table number
    (`title_start` in the spec), so a title with a qualifier in front ("Youth unemployment
    rate ...", "Self employed ...") is not the headline table.
    """
    kind, result, _ = classify_with_definition(caption, source_round, spec)
    return kind, result


# --------------------------------------------------------------------------- columns

def column_centres(table: Table, value_cols: list[int]) -> dict[int, float]:
    out: dict[int, float] = {}
    for col in value_cols:
        xs = [(c.bbox[0] + c.bbox[2]) / 2 for c in numeric_body_cells(table, [col])]
        if xs:
            out[col] = statistics.median(xs)
    return out


def map_columns(centres: dict[int, float], header_words: list[Word], source_round: str,
                spec: dict[str, Any], own_round_only: bool = False) -> tuple[dict[int, tuple[str, str]], list[str]]:
    """Each value column -> (survey round, sex), from the printed header words by position.

    Accepted layouts, per round group from left to right: Total, Male, Female; or Total, Male,
    Female followed by the two "Augmented" columns (Total, Female), which are recognised and left
    unmapped. The rounds must be the report's own round, optionally preceded by the round it is
    expected to compare with. Anything else returns problems and an empty mapping.
    `own_round_only`: only the report's own round is accepted (19th ICLS tables: no earlier
    round exists on that definition, so a second round in the header means the table is not
    what its title was taken for).
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
    allowed = [[source_round]] + ([[previous, source_round]] if previous and not own_round_only else [])
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
    """Row label -> area, with the block the label sits in.

    The tables list Pakistan, Rural, Urban and then each province with its own Rural and Urban
    rows (2024-25: a heading row per block, then Total, Rural, Urban). A bare
    "Rural"/"Urban"/"Total" row belongs to whichever block heading was printed last above it.
    `provinces` are the province blocks that are mapped (decision D33); a row in any other
    province block, or below a label that is not in the dictionary, stays unmapped. After a
    successful lookup `geo` says whose row it is: None for Pakistan, else the province key.
    """

    def __init__(self, labels_spec: dict[str, Any], provinces: Any = ()):
        self.entries = [(re.compile(e["pattern"], re.I), e["block"], e.get("area")) for e in labels_spec["area_labels"]]
        self.provinces = frozenset(provinces)
        self.block: str | None = None
        self.pending_area: str | None = None
        self.touched = False      # has any row of the table been looked up yet?

    @property
    def geo(self) -> str | None:
        return None if self.block in (None, "pakistan") else self.block

    def lookup(self, raw_label: str, heading: bool = False) -> tuple[str | None, str]:
        """`heading`: the row prints a label and no amount."""
        self.touched = True
        label = normalise_label(raw_label)
        hits = {(block, area) for pattern, block, area in self.entries if pattern.fullmatch(label)}
        if len(hits) != 1:
            self.block = None  # an unknown row breaks the block: later bare rows cannot be attributed
            return None, "ambiguous" if hits else "unmapped"
        block, area = hits.pop()
        if heading and block == "same" and self.block is None and area in ("rural", "urban"):
            # A "Rural"/"Urban" heading with no block open: the rows below it are grouped by area
            # first ("Rural", then Pakistan and the provinces). A "Pakistan" row under it is that
            # area of Pakistan, not the national total.
            self.pending_area = area
        if self.pending_area is not None:
            return None, "under_area_heading"   # this layout is not modelled: nothing below the heading is mapped
        if block != "same":
            self.block = block
        if area is None or not (self.block == "pakistan" or self.block in self.provinces):
            return None, "out_of_scope"
        return area, "dictionary"


    def open_from_line_above(self, line_text: str) -> bool:
        """Open a block from the printed line directly above the table's first amounts.

        Used only when the table's own rows gave no label before its first row of amounts (the
        second reader puts a label-only "Pakistan" line with the header lines). The line must be
        a block heading by the dictionary and nothing else; any other line changes nothing.
        """
        if self.touched or self.block is not None:
            return False
        label = normalise_label(line_text)
        hits = {(block, area) for pattern, block, area in self.entries if pattern.fullmatch(label)}
        if len(hits) != 1:
            return False
        block, area = hits.pop()
        if block == "same" or area != "total":
            return False
        self.block = block
        return True


ICLS19_SUFFIX = ".icls19"


def series_id_for(measure: str, sex: str, area: str, geo: str | None = None, icls19: bool = False) -> str:
    """`lfs.<measure>[.<province>].<sex>.<area>[.icls19]`. National 13th ICLS ids carry neither extra segment."""
    province = f".{geo}" if geo else ""
    return f"lfs.{measure}{province}.{sex}.{area}{ICLS19_SUFFIX if icls19 else ''}"


def industry_series_id(slug: str, sex: str, icls19: bool = False) -> str:
    return f"lfs.employment_share.industry.{slug}.{sex}.total{ICLS19_SUFFIX if icls19 else ''}"


def series_group(series_id: str, spec: dict[str, Any]) -> str:
    """`national`, `provincial` or `icls19` (reported separately; an icls19 series of a province counts as icls19)."""
    if series_id.endswith(ICLS19_SUFFIX):
        return "icls19"
    parts = series_id.split(".")
    provinces = set(((spec.get("provinces") or {}).get("list") or {}))
    return "provincial" if len(parts) >= 4 and parts[-3] in provinces else "national"


# --------------------------------------------------------------------------- one table -> cells

def build_cells(source, run: RunManifest, table: Table, kind: dict[str, Any], caption: str, header_words: list[Word],
                spec: dict[str, Any], labels_spec: dict[str, Any],
                definition: str = DEFINITION_13) -> tuple[list[Cell], dict[str, Any]]:
    pdf = source_path(source)
    is_19 = definition == DEFINITION_19
    value_cols = table.value_columns()
    flags = detect_table_flags(table)
    coverage = table_coverage(table, pdf)
    if coverage["coverage_row_band"] is not None and coverage["coverage_row_band"] < 0.90 <= (coverage["coverage"] or 0):
        flags.append("possible_dropped_column")
    if coverage["coverage"] is None or coverage["coverage"] < spec.get("min_table_coverage", 0.90):
        flags.append("low_coverage")
    centres = column_centres(table, value_cols)
    col_map, col_problems = map_columns(centres, header_words, source.period, spec, own_round_only=is_19)
    if col_problems:
        flags.append("column_unmapped")
    unit_ok = re.search(kind["unit_marker"], caption) is not None
    if not unit_ok:
        flags.append("scale_not_confirmed")

    grid = table.grid()
    area_rows = AreaRows(labels_spec, province_keys(spec))
    above = text_lines(header_words)
    line_above = clean_text(" ".join(w[4] for w in above[-1])) if above else ""
    heading_from_text_layer: str | None = None
    industries = LabelMap(labels_spec["industry_labels"])
    cells: list[Cell] = []
    unmapped: list[str] = []
    unknown_headings: list[str] = []
    seen_amounts = False
    out_of_scope = 0

    def own_value_cells(r: int) -> list[Any]:
        return [grid[r][k] for k in value_cols if grid[r][k] is not None and grid[r][k].row == r and grid[r][k].col == k]

    # Docling sometimes marks the first data row as a column header (AGENTS.md section 7). A row
    # flagged that way is data only when every value column holds exactly one number in it; a
    # flagged row that holds some numbers but not one per column is left out AND the table says so.
    header_rows_as_data: set[int] = set()
    for r in range(table.num_rows):
        row_cells = own_value_cells(r)
        if not row_cells or not all(c.column_header for c in row_cells):
            continue
        numbers = [c for c in row_cells if parse_printed(c.text).value is not None]
        if len(numbers) == len(row_cells) == len(value_cols):
            header_rows_as_data.add(r)
        elif numbers and "header_row_with_numbers" not in flags:
            flags.append("header_row_with_numbers")
    for r in range(table.num_rows):
        row_cells = own_value_cells(r)
        row_flags = flags
        if r in header_rows_as_data:
            # Its label: the row's own non-value cells (row_label leaves out header-flagged cells).
            own = [grid[r][k] for k in range(table.num_cols) if k not in value_cols and grid[r][k] is not None
                   and grid[r][k].row == r and grid[r][k].col == k]
            label = clean_text(" ".join(c.text.strip() for c in own if c.text.strip()))
            row_flags = [*flags, "header_row_as_data"]
        elif row_cells and all(c.column_header for c in row_cells):
            continue
        else:
            label = row_label(table, grid, r, value_cols)
        first = grid[r][0]
        label_from_header_cell = False
        if not label and first is not None and first.row == r and first.col_span >= table.num_cols:
            # A block heading printed across the full width ("Pakistan"); Docling sometimes marks it as a header.
            label = clean_text(first.text)
            label_from_header_cell = bool(first.column_header)
        if not any(parse_printed(c.text).value is not None or parse_printed(c.text).is_missing and c.text.strip()
                   for c in row_cells):
            # A row with a label but no amounts (for example a "Pakistan" heading row) still opens a block.
            if label and kind["layout"] != "industry_by_round_sex":
                _, how = area_rows.lookup(label, heading=True)
                # A heading that is not in the dictionary may be a region the Pakistan figure includes
                # (a header line Docling flagged as such, before any amount, is not one).
                if how in ("unmapped", "ambiguous") and (seen_amounts or not label_from_header_cell):
                    unknown_headings.append(label)
            continue
        seen_amounts = True
        geo = None
        if kind["layout"] == "industry_by_round_sex":
            key, how = industries.lookup(label)
        else:
            if area_rows.open_from_line_above(line_above):
                heading_from_text_layer = line_above
            key, how = area_rows.lookup(label)
            geo = area_rows.geo if key is not None else None
        if key is None and how == "out_of_scope":
            out_of_scope += 1
        elif key is None and how == "under_area_heading":
            unmapped.append(f"{label} (under a Rural/Urban heading; not the national block)")
        elif key is None:
            unmapped.append(label or "(row with no label)")
        for tc in row_cells:
            if not tc.text.strip():
                continue
            period, sex = col_map.get(tc.col, (None, None))
            header = f"{period} {sex}" if period else ""
            cell = make_cell(source=source, run=run, table=table, tcell=tc, row_label_raw=label, col_label_raw=header,
                             table_flags=row_flags)
            cell.unit = kind["unit"]
            cell.scale_factor = int(kind.get("scale_factor", 1)) if unit_ok else None
            if key and period and unit_ok:
                cell.series_id = (industry_series_id(key, sex, is_19) if kind["layout"] == "industry_by_round_sex"
                                  else series_id_for(kind["measure"], sex, key, geo, is_19))
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
        "source_id": source.source_id, "kind": kind["kind"], "definition": definition, "table": kind["title"],
        "page": table.page,
        "table_index": table.table_index, "run_id": run.run_id, "run_mode": run.run_mode, "page_range": run.page_range,
        "rows": table.num_rows, "cols": table.num_cols, "value_columns": value_cols, "table_flags": flags,
        "columns": {str(k): {"period": v[0], "sex": v[1]} for k, v in col_map.items()},
        "column_problems": col_problems, "unit_confirmed": bool(unit_ok), "caption": caption[:160],
        "unmapped_labels": unmapped, "unknown_headings": unknown_headings, "rows_out_of_scope": out_of_scope,
        "header_rows_as_data": sorted(header_rows_as_data),
        "block_heading_from_text_layer": heading_from_text_layer,
        "mapped_cells": sum(1 for c in cells if c.series_id),
        "mapped_cells_by_group": dict(sorted(_count(series_group(c.series_id, spec) for c in cells if c.series_id).items())),
        "coverage": coverage,
    }
    return cells, info


def _count(items) -> dict[str, int]:
    out: dict[str, int] = defaultdict(int)
    for item in items:
        out[item] += 1
    return out


def locate_tables(source, pairs: list[tuple[RunManifest, Table]], spec: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Find the target tables of one report. Two tables claiming the same kind on the same definition: neither is used."""
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
            kind, result, definition = classify_with_definition(caption, source.period, spec)
            if kind is not None:
                found.append({"run": run, "table": t, "kind": kind, "caption": caption, "header_words": header_words,
                              "definition": definition})
            elif result not in ("no_title", "not_a_target"):
                rejected.append({"page": page, "table_index": t.table_index, "result": result, "caption": caption[:120]})
    counts = _count((f["kind"]["kind"], f["definition"]) for f in found)
    for f in [f for f in found if counts[(f["kind"]["kind"], f["definition"])] > 1]:
        rejected.append({"page": f["table"].page, "table_index": f["table"].table_index, "result": "tie",
                         "kind": f["kind"]["kind"], "definition": f["definition"], "caption": f["caption"][:120]})
    return [f for f in found if counts[(f["kind"]["kind"], f["definition"])] == 1], rejected


def other_regions_reason(kind: dict[str, Any], tinfo: dict[str, Any]) -> str | None:
    """Why the provinces of an area table cannot be required to add to its Pakistan figure, or None.

    The table prints a row or a block heading that is neither Pakistan nor one of the four
    provinces: its Pakistan figure may cover that region too. Decided from the printed labels only.
    """
    if kind["layout"] == "industry_by_round_sex":
        return None
    labels = [*tinfo.get("unmapped_labels", []), *tinfo.get("unknown_headings", [])]
    if not labels:
        return None
    return ("the table prints a row that is neither Pakistan nor one of the four provinces ("
            + "; ".join(labels[:4]) + "), so its Pakistan figure may cover more than the provinces listed")


SECOND_READER_REQUIRED = {"area_by_round_sex": ("row_total", "column_total"), "industry_by_round_sex": ("weights_sum",)}


def second_reading(source, found: dict[str, Any], table_cells: list[Cell], tinfo: dict[str, Any], spec: dict[str, Any],
                   labels_spec: dict[str, Any], titles: dict[str, str]) -> tuple[bool, dict[str, Any]]:
    """Decision D28: a table flagged `merged_rows` or `dropped_column` goes to the second reader (pdfplumber).

    Its reading replaces Docling's only if every sum check of THIS table passes on it (per block:
    male + female = total, rural + urban = total, the provinces add to Pakistan; industry shares
    add to the printed Total), none fails and none is not evaluable. A table of rates has no sum
    check of its own, so a flagged rate table is never rescued this way. When promoted,
    `table_cells` gains the second reader's cells and Docling's stay in the record, unmapped.
    Returns (promoted, coverage row for the reading in use).
    """
    kind, definition = found["kind"], found["definition"]
    if kind["measure"] not in COUNT_MEASURES and kind["layout"] != "industry_by_round_sex":
        return False, dict(tinfo["coverage"])
    rounds = 1 if definition == DEFINITION_19 else 2

    second_info: dict[str, Any] = {}

    def build(t2: Table) -> tuple[list[Cell], dict[str, Any], dict[str, Any]]:
        c2, i2 = build_cells(source, found["run"], t2, kind, found["caption"], found["header_words"], spec, labels_spec,
                             definition)
        second_info.update(i2)
        return c2, i2, {}

    def checks(c2: list[Cell], _meta: dict[str, Any]) -> list[Check]:
        return count_sum_checks(c2, spec, titles, {}) + shares_checks(c2, spec, labels_spec, titles, {})

    second = try_second_reader(source=source, table=found["table"], table_flags=tinfo["table_flags"],
                               first_cells=table_cells, expected_value_columns=len(spec["sexes"]) * rounds,
                               build=build, checks=checks, required_checks=SECOND_READER_REQUIRED[kind["layout"]])
    if second is None:
        return False, dict(tinfo["coverage"])
    tinfo["second_reader"] = second["record"]
    tinfo["second_reader"]["block_heading_from_text_layer"] = second_info.get("block_heading_from_text_layer")
    tinfo["second_reader"]["rows_out_of_scope"] = second_info.get("rows_out_of_scope")
    if not second["promoted"]:
        return False, dict(tinfo["coverage"])
    table_cells.extend(second["cells"])
    tinfo["mapped_cells"] = sum(1 for c in table_cells if c.series_id)
    tinfo["mapped_cells_by_group"] = dict(sorted(_count(series_group(c.series_id, spec) for c in table_cells if c.series_id).items()))
    return True, {**second["coverage"], "reader": second["record"]["reading"]["reader"],
                  "first_reader_coverage": tinfo["coverage"]}


# --------------------------------------------------------------------------- series

def place_names(spec: dict[str, Any], geo: str | None) -> dict[str, str]:
    """Area -> words for it: Pakistan's (as in the spec) or one province's."""
    if geo is None:
        return dict(spec["area_names"])
    name = spec["provinces"]["list"][geo]["name"]
    return {"total": name, "rural": f"rural areas of {name}", "urban": f"urban areas of {name}"}


ICLS19_STATEMENT_NOT_FOUND = "Definition as stated in the report: not found."


def icls19_definition_statement(spec: dict[str, Any], sources: dict[str, Any]) -> dict[str, Any]:
    """What the report itself says the 19th ICLS definition is: the spec's quotes, each verified on its page.

    The series definition carries only sentences that code found, word for word, on the page the
    spec names. If none is found the definition says so; it is never written from memory.
    """
    cfg = (spec.get("icls19") or {}).get("definition_statement") or {}
    source = sources.get(cfg.get("source_id"))
    record: dict[str, Any] = {"source_id": cfg.get("source_id"), "quotes": [], "text": ICLS19_STATEMENT_NOT_FOUND}
    if source is None:
        return {**record, "status": "source_not_registered"}
    import pymupdf

    with pymupdf.open(source_path(source)) as doc:
        for q in cfg.get("quotes") or []:
            page = int(q["page"])
            page_text = re.sub(r"\s+", " ", doc[page - 1].get_text()) if 1 <= page <= doc.page_count else ""
            quote = re.sub(r"\s+", " ", str(q["text"])).strip()
            record["quotes"].append({"page": page, "text": quote, "found_on_page": bool(quote) and quote in page_text})
    found = [q for q in record["quotes"] if q["found_on_page"]]
    if found:
        record["text"] = ("Definition as stated in the report: "
                          + " ".join(f'(p.{q["page"]}) "{q["text"]}"' for q in found))
    return {**record, "status": "searched"}


def series_catalogue(spec: dict[str, Any], labels_spec: dict[str, Any], breaks: list[SeriesBreak],
                     icls19_statement: str = ICLS19_STATEMENT_NOT_FOUND) -> list[Series]:
    """Every series the builder can fill: national (ids unchanged), provincial (D33), `.icls19` (D34).

    Sort keys inside a measure: national 0-8, provinces 10-48 (spec order), the same plus 50 for
    the 19th ICLS variant.
    """
    out: list[Series] = []
    sex_names = spec["sex_names"]
    provinces = (spec.get("provinces") or {}).get("list") or {}
    geos: list[str | None] = [None, *province_keys(spec)]
    cfg19 = spec.get("icls19") or {}
    variants = [False] + ([True] if icls19_enabled(spec) else [])

    def add(sid: str, name: str, parent: str | None, m: dict[str, Any], dims: dict[str, str], sort: int, definition: str,
            geo: str = "pk", is_19: bool = False) -> None:
        if is_19:
            name = f"{name} ({DEFINITION_19})"
        out.append(Series(series_id=sid, name=name, parent_id=parent, dataset=DATASET, geo=geo, frequency=spec["frequency"],
                          unit=m["unit"], scale_factor=int(m.get("scale_factor", 1)), definition=definition,
                          definition_status="draft", synonyms=list(m.get("synonyms", [])), breaks=[] if is_19 else breaks,
                          source_doc_types=[DOC_TYPE], sort_key=sort + (50 if is_19 else 0),
                          dims={**dims, "definition": DEFINITION_19 if is_19 else DEFINITION_13},
                          notes=clean_text(cfg19.get("series_note", "")) if is_19 else ""))

    def definition_for(m: dict[str, Any], is_19: bool) -> str:
        if not is_19:
            return clean_text(m["definition"])
        return (f"{m['name']}, as printed in the tables that the Labour Force Survey report labels {DEFINITION_19} "
                f"(rounds: {', '.join(cfg19.get('rounds') or [])}). {icls19_statement}")

    for measure, m in spec["measures"].items():
        if measure == "employment_share.industry":
            for is_19 in variants:
                for i, ind in enumerate(labels_spec["industries"]):
                    for j, sex in enumerate(spec["sexes"]):
                        sid = industry_series_id(ind["slug"], sex, is_19)
                        if sex != "total":
                            parent = industry_series_id(ind["slug"], "total", is_19)
                        else:
                            parent = None if ind["slug"] == "all" else industry_series_id("all", "total", is_19)
                        add(sid, f"{m['name']}: {ind['name']}, {sex_names[sex]}", parent, m,
                            {"industry": ind["slug"], "sex": sex, "area": "total"}, m["sort"] + i * 3 + j,
                            f"{definition_for(m, is_19)} Industry division: {ind['name']}; {sex_names[sex]}.", is_19=is_19)
            continue
        for is_19 in variants:
            for g, geo in enumerate(geos):
                places = place_names(spec, geo)
                province = provinces.get(geo) or {}
                n = 0
                for sex in spec["sexes"]:
                    for area in spec["areas"]:
                        sid = series_id_for(measure, sex, area, geo, is_19)
                        if area != "total":
                            parent = series_id_for(measure, sex, "total", geo, is_19)
                        elif sex != "total":
                            parent = series_id_for(measure, "total", "total", geo, is_19)
                        else:
                            parent = None if geo is None else series_id_for(measure, "total", "total", None, is_19)
                        definition = f"{definition_for(m, is_19)} Coverage: {sex_names[sex]}, {places[area]}."
                        if province.get("definition_note"):
                            definition += " " + clean_text(province["definition_note"])
                        add(sid, f"{m['name']}, {sex_names[sex]}, {places[area]}", parent, m, {"sex": sex, "area": area},
                            m["sort"] + g * 10 + n, definition, geo=province.get("geo", "pk"), is_19=is_19)
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


def scopes(spec: dict[str, Any]) -> list[tuple[str | None, bool]]:
    """(province or None for Pakistan, 19th ICLS?) for every block of series the checks walk."""
    variants = [False] + ([True] if icls19_enabled(spec) else [])
    return [(geo, is_19) for is_19 in variants for geo in [None, *province_keys(spec)]]


def count_sum_checks(cells: list[Cell], spec: dict[str, Any], titles: dict[str, str],
                     blocked: dict[tuple[str, int, int], str],
                     other_regions: dict[tuple[str, int, int], str] | None = None) -> list[Check]:
    """Counts, per block (Pakistan and each province) and per definition:
    male + female = total; rural + urban = total; employed + unemployed = labour force.
    Across blocks: the four provinces add to Pakistan (`lfs.provinces_add_to_pakistan`).

    `other_regions`: tables that print a row which is neither Pakistan nor one of the four
    provinces. Their Pakistan total may cover more than the provinces listed, so the
    provinces-to-Pakistan sum is `not_evaluable` there, never forced.
    """
    out: list[Check] = []
    names = spec["measures"]
    other_regions = other_regions or {}
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

        for geo, is_19 in scopes(spec):
            places = place_names(spec, geo)
            tag = f", {DEFINITION_19}" if is_19 else ""
            for measure in COUNT_MEASURES:
                label = names[measure]["name"].lower()
                for area in spec["areas"]:
                    run("lfs.male_plus_female", "row_total", series_id_for(measure, "total", area, geo, is_19),
                        [series_id_for(measure, "male", area, geo, is_19), series_id_for(measure, "female", area, geo, is_19)],
                        f"male and female {label} ({places[area]}{tag})", f"total for both sexes")
                for sex in spec["sexes"]:
                    run("lfs.rural_plus_urban", "column_total", series_id_for(measure, sex, "total", geo, is_19),
                        [series_id_for(measure, sex, "rural", geo, is_19), series_id_for(measure, sex, "urban", geo, is_19)],
                        f"rural and urban {label} ({spec['sex_names'][sex]}{tag})", f"{places['total']} total")
            for sex in spec["sexes"]:
                for area in spec["areas"]:
                    run("lfs.employed_plus_unemployed", "accounting_identity", series_id_for("labour_force", sex, area, geo, is_19),
                        [series_id_for("employed", sex, area, geo, is_19), series_id_for("unemployed", sex, area, geo, is_19)],
                        f"employed and unemployed persons ({spec['sex_names'][sex]}, {places[area]}{tag})",
                        "civilian labour force")

        # The four provinces add to Pakistan (counts only; a rate is not a sum of rates).
        keys = province_keys(spec)
        province_names = {k: spec["provinces"]["list"][k]["name"] for k in keys}
        for is_19 in ([False, True] if keys else []):
            tag = f", {DEFINITION_19}" if is_19 else ""
            for measure in COUNT_MEASURES:
                label = names[measure]["name"].lower()
                for sex in spec["sexes"]:
                    for area in spec["areas"]:
                        target = by.get(series_id_for(measure, sex, area, None, is_19))
                        present = [k for k in keys if series_id_for(measure, sex, area, k, is_19) in by]
                        if target is None or target.is_missing or not present:
                            continue
                        members = [by[series_id_for(measure, sex, area, k, is_19)] for k in present]
                        if any(m.is_missing for m in members):
                            continue
                        absent = [province_names[k] for k in keys if k not in present]
                        reason = _blocked([target, *members], blocked)
                        if absent:
                            reason = reason or f"the table does not carry a mapped row for: {', '.join(absent)}"
                        reason = reason or next((other_regions[(c.source_id, c.page, c.table_index)] for c in [target, *members]
                                                 if (c.source_id, c.page, c.table_index) in other_regions), None)
                        out.append(sum_check(
                            check_type="hierarchy_sum", dataset=DATASET, rule_id="lfs.provinces_add_to_pakistan",
                            target=target, members=[(m, 1) for m in members],
                            what_members=(f"{label} of {', '.join(province_names[k] for k in present)} "
                                          f"({spec['sex_names'][sex]}, {spec['area_names'][area]}{tag})"),
                            what_target="Pakistan figure", column_label=where, blocked_reason=reason))
    return out


COARSE_COUNTS_REASON = "the printed counts are too coarse to confirm this rate"


def printable_values_within(centre: Decimal, bound: Decimal, unit: Decimal) -> int:
    """How many multiples of `unit` (values printable at that precision) lie within `bound` of `centre`."""
    lowest = ((centre - bound) / unit).to_integral_value(rounding=ROUND_CEILING)
    highest = ((centre + bound) / unit).to_integral_value(rounding=ROUND_FLOOR)
    return max(0, int(highest - lowest) + 1)


def recompute_unemployment_rate(rate: Cell, labour_force: Cell, unemployed: Cell | None, employed: Cell | None,
                                where: str, what: str, blocked_reason: str | None = None) -> Check | None:
    """Printed unemployment rate vs unemployed / labour force x 100 from printed counts of the same report.

    Bound (specs/lfs.yaml): half a unit of the rate's last digit, plus the first-order effect of
    each count being rounded to half a unit of its own last digit.

    The bound grows with 1 / labour force. A result inside it is evidence for the printed rate
    only when the bound singles that rate out: exactly one value printable at the rate's precision
    lies within the bound of the recomputed value. Otherwise the counts would equally "confirm" a
    different printed rate and the check is `not_evaluable`. A printed rate OUTSIDE the bound still
    fails: coarse counts cannot excuse that. A pass is evidence for the rate only, never for the
    counts it was computed from (`credits_members=False`): they are barely constrained by it.
    """
    other = unemployed if unemployed is not None else employed
    if other is None:
        return None
    members = [labour_force, other]
    rule = "lfs.unemployment_rate_from_counts" if unemployed is not None else "lfs.unemployment_rate_from_employed"
    if any(c.value_parsed is None for c in (rate, *members)) or Decimal(labour_force.value_parsed or "0") <= 0:
        return value_check(check_type="recompute", dataset=DATASET, rule_id=rule, target=rate, members=members,
                           computed=None, tolerance=Decimal(0), description_ok="", what=what, credits_members=False,
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
    unit = last_digit_unit(rate.value_parsed)
    candidates = printable_values_within(computed, tolerance, unit)
    if blocked_reason is None and abs(computed - Decimal(rate.value_parsed)) <= tolerance and candidates != 1:
        blocked_reason = (f"{COARSE_COUNTS_REASON} ({candidates} rates printable to {fmt(unit)} lie within the rounding "
                          f"bound {tolerance} of the recomputed {fmt(computed)})")
    return value_check(check_type="recompute", dataset=DATASET, rule_id=rule, target=rate, members=members,
                       computed=computed, tolerance=tolerance, what=what, blocked_reason=blocked_reason,
                       credits_members=False,
                       description_ok=f"{what} in {where}, recomputed from the printed counts in million as {how}.")


def recompute_checks(cells: list[Cell], spec: dict[str, Any], titles: dict[str, str],
                     blocked: dict[tuple[str, int, int], str]) -> list[Check]:
    out: list[Check] = []
    for (source_id, period), by in sorted(_index(cells).items()):
        for geo, is_19 in scopes(spec):
            places = place_names(spec, geo)
            tag = f", {DEFINITION_19}" if is_19 else ""
            for sex in spec["sexes"]:
                for area in spec["areas"]:
                    rate = by.get(series_id_for("unemployment_rate", sex, area, geo, is_19))
                    lf = by.get(series_id_for("labour_force", sex, area, geo, is_19))
                    if rate is None or lf is None or rate.is_missing or lf.is_missing:
                        continue
                    unemployed = by.get(series_id_for("unemployed", sex, area, geo, is_19))
                    employed = by.get(series_id_for("employed", sex, area, geo, is_19))
                    unemployed = None if unemployed is not None and unemployed.is_missing else unemployed
                    employed = None if employed is not None and employed.is_missing else employed
                    involved = [c for c in (rate, lf, unemployed if unemployed is not None else employed) if c is not None]
                    chk = recompute_unemployment_rate(
                        rate, lf, unemployed, employed, _where(period, source_id, titles),
                        f"Unemployment rate ({spec['sex_names'][sex]}, {places[area]}, {period}{tag})",
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
        for is_19 in (False, True):
            tag = f", {DEFINITION_19}" if is_19 else ""
            for sex in spec["sexes"]:
                target = by.get(industry_series_id("all", sex, is_19))
                if target is None or target.is_missing:
                    continue
                absent = [s for s in slugs if industry_series_id(s, sex, is_19) not in by]
                members = [by[industry_series_id(s, sex, is_19)] for s in slugs if industry_series_id(s, sex, is_19) in by]
                members = [m for m in members if not m.is_missing]
                if not members and not absent:
                    continue
                # An industry with no mapped cell is not "nil": the sum cannot be tested without it.
                reason = _blocked([target, *members], blocked)
                if absent:
                    reason = reason or f"the table does not carry a mapped row for: {', '.join(absent)}"
                out.append(sum_check(
                    check_type="weights_sum", dataset=DATASET, rule_id="lfs.industry_shares_add_to_total", target=target,
                    members=[(m, 1) for m in members], what_members=f"the industry shares ({spec['sex_names'][sex]}{tag})",
                    what_target="Total", column_label=_where(period, source_id, titles),
                    blocked_reason=reason, abs_tolerance=tolerance))
    return out


def cross_checks(cells: list[Cell], titles: dict[str, str], order: dict[str, str], series: dict[str, Series],
                 blocked: dict[tuple[str, int, int], str] | None = None) -> list[Check]:
    """The same round's figure printed again: in the next report (cross_edition) or twice in one report (cross_table).

    Two registered files of the same round are the same edition (a re-issue, a mirror): they agree
    by construction, so no check is recorded between them. A pair with either cell in a blocked
    table is `not_evaluable`, like every other check.
    """
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
            if not same and order.get(other.source_id) is not None and order.get(other.source_id) == order.get(first.source_id):
                continue        # two files of one edition are not a second printing
            out.append(equality_check(
                blocked_reason=_blocked([first, other], blocked or {}),
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


def unread_gap_reasons(gap_reasons: dict[str, str], periods_read: set[str]) -> dict[str, str]:
    """A skipped file explains a round's gaps only when no other registered report of that round was read.

    (Two files are registered for 2014-15: the Azad Jammu & Kashmir edition, skipped, and the national report.)
    """
    return {period: reason for period, reason in gap_reasons.items() if period not in periods_read}


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
    statement = icls19_definition_statement(spec, {s.source_id: s for s in sources})
    catalogue = series_catalogue(spec, labels_spec, breaks, statement["text"])
    series = {s.series_id: s for s in catalogue}

    cells: list[Cell] = []
    located: dict[str, Any] = {}
    not_located: dict[str, str] = {}
    coverage: list[dict[str, Any]] = []
    blocked: dict[tuple[str, int, int], str] = {}
    other_regions: dict[tuple[str, int, int], str] = {}
    gap_reasons: dict[str, str] = {}
    kinds = [k["kind"] for k in spec["tables"]]
    by_round: dict[str, list[str]] = defaultdict(list)
    for source in sources:
        if source.source_id not in (spec.get("skip_sources") or {}):
            by_round[source.period].append(source.source_id)
    # The same round registered twice is one edition in two files: reported, never cross-edition evidence.
    rounds_registered_twice = {period: ids for period, ids in sorted(by_round.items()) if len(ids) > 1}
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
            table_cells, tinfo = build_cells(source, f["run"], table, f["kind"], f["caption"], f["header_words"], spec,
                                             labels_spec, f["definition"])
            promoted, table_cov = second_reading(source, f, table_cells, tinfo, spec, labels_spec, titles)
            cells.extend(table_cells)
            tables_info.append(tinfo)
            title = f["kind"]["title"] + (f" ({DEFINITION_19})" if f["definition"] == DEFINITION_19 else "")
            coverage.append({"dataset": DATASET, "source_id": source.source_id, "table": title,
                             "kind": f["kind"]["kind"], "definition": f["definition"], "run_id": f["run"].run_id,
                             **table_cov})
            reason = other_regions_reason(f["kind"], tinfo)
            if reason:
                other_regions[(source.source_id, table.page, table.table_index)] = reason
            bad = sorted(set(tinfo["table_flags"]) & BLOCKING_TABLE_FLAGS)
            if f["kind"]["layout"] == "industry_by_round_sex" and tinfo["unmapped_labels"]:
                bad.append("a row of the table is not matched to an industry")
            if bad and not promoted:
                blocked[(source.source_id, table.page, table.table_index)] = f"the table is flagged {', '.join(bad)}"
            overlay = config.work_dir() / "qa" / f"overlay_{source.source_id}_p{table.page:03d}_t{table.table_index}.png"
            render_overlay(source_path(source), table, overlay)
        got = {t["kind"] for t in tables_info if t["definition"] == DEFINITION_13}
        got_19 = {t["kind"] for t in tables_info if t["definition"] == DEFINITION_19}
        located[source.source_id] = {"runs": runs_info, "tables": tables_info, "rejected": rejected,
                                     "kinds_not_located": [k for k in kinds if k not in got]}
        if icls19_enabled(spec) and source.period in (spec["icls19"].get("rounds") or []):
            located[source.source_id]["kinds_not_located_icls19"] = [k for k in kinds if k not in got_19]

    gap_reasons = unread_gap_reasons(gap_reasons, {s.period for s in sources if s.source_id in located})

    checks = count_sum_checks(cells, spec, titles, blocked, other_regions)
    checks += recompute_checks(cells, spec, titles, blocked)
    checks += shares_checks(cells, spec, labels_spec, titles, blocked)
    checks += cross_checks(cells, titles, order, series, blocked)
    # Economic Survey labour chapter: cross-source evidence only; its cells carry no series id.
    from .cross_source import pes_labour_checks

    manifest = read_manifest()
    pes_checks, pes_cells, pes_info = pes_labour_checks(cells, manifest, spec["cross_source_pes"],
                                                        {s.series_id: s.name for s in catalogue}, titles)
    checks += pes_checks
    cells += pes_cells
    titles.update({s.source_id: s.title for s in manifest if s.source_id == pes_info.get("source_id")})
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
    by_group: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for o in observations:
        gaps["published" if o.published else (o.gap_kind or "unknown")] += 1
        tiers[o.tier or "none"] += 1
        outcome = "published" if o.published else (o.gap_kind or "unknown")
        by_group[series_group(o.series_id, spec)][f"{outcome}, tier {o.tier or 'none'}"] += 1
    info = {
        "dataset": DATASET, "built_at": config.now_iso(), "located": located, "not_located": not_located,
        "rounds_registered_twice": rounds_registered_twice,
        "coverage_overall": {"printed_numeric_tokens": printed, "matched": matched,
                             "coverage": round(matched / printed, 4) if printed else None,
                             "tables": len(coverage),
                             "min_table_coverage": min((c["coverage"] or 0 for c in coverage), default=None)},
        "check_pass_rates": {
            "all": pass_rate(checks),
            "arithmetic": pass_rate(checks, ["row_total", "column_total", "accounting_identity", "recompute",
                                             "weights_sum", "cross_table", "hierarchy_sum"]),
            "cross_edition": pass_rate(checks, ["cross_edition"]),
            "cross_source": pass_rate(checks, ["cross_source"]),
            **{f"type:{t}": pass_rate(checks, [t]) for t in sorted({c.check_type for c in checks})},
        },
        "observations_by_outcome": dict(gaps), "tier_mix": dict(tiers),
        # National (13th ICLS), provincial (D33) and 19th ICLS (D34) are reported apart, never as one number.
        "observations_by_group": {g: dict(sorted(v.items())) for g, v in sorted(by_group.items())},
        "depth": {"provinces_enabled": bool(province_keys(spec)), "icls19_enabled": icls19_enabled(spec),
                  "tables_with_other_regions": [f"{k[0]} p.{k[1]}" for k in sorted(other_regions)]},
        "icls19_definition_statement": statement,
        "comparability_text_search": comparability,
        "cross_source_pes": pes_info,
    }
    save_dataset(DATASET, cells=cells, checks=checks, series=catalogue, observations=observations, coverage=coverage, info=info)
    return info
