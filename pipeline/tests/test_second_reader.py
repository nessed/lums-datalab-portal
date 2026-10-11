"""Second reader (decision D28): pdfplumber word geometry, refusal instead of guessing, routing by checks.

Every PDF here is generated in tmp_path with PyMuPDF: a borderless table with a wrapped row
label, a blank cell, a negative printed in brackets and two columns printed close together.
The "first reader" table is written in Docling's own shape (table box BOTTOMLEFT, cell boxes
TOPLEFT) with the two close columns merged into one, which is the failure the reader is for.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pymupdf
import pytest

from datalab import second_reader as sr
from datalab.checks import sum_check
from datalab.datasets import common
from datalab.schema import RunManifest, Series, Source, cell_id_for
from datalab.status import build_observations
from datalab.tables import load_tables, norm_bbox, page_words
from datalab.validate import detect_table_flags, table_coverage

W, H = 600.0, 800.0
FONT, SIZE = "helv", 9
RIGHT = [330.0, 392.0, 432.0, 545.0]     # right edge of each value column; the 2nd and 3rd are close together
LABEL_X, CODE_X, NAME_X = 50.0, 45.0, 70.0
TOP, HEADER_Y, FIRST_Y, PITCH, WRAP = 95.0, 110.0, 130.0, 18.0, 9.0

# (label lines, [2024, 2025, change, count]); None = nothing printed in that cell.
ROWS = [
    (["Food and drink"], ["10.0", "12.0", "2.0", "1"]),
    (["Housing, water and", "household fuels"], ["5.5", "5.0", "(0.5)", "2"]),     # wrapped label, bracket negative
    (["Transport"], ["4.5", "4.5", None, "3"]),                                    # blank cell
    (["Total"], ["20.0", "21.5", "1.5", "6"]),
]


def text_width(text: str) -> float:
    return pymupdf.get_text_length(text, fontname=FONT, fontsize=SIZE)


def layout(rows, *, wrap: float = WRAP, pitch: float = PITCH, data_line: int = 0, codes: bool = False):
    """Where everything is printed: [(y of the numbers' line, [(x, y, text) labels], [(col, x0, text)])], bottom y."""
    out = []
    y = FIRST_Y
    for n, (lines, values) in enumerate(rows):
        k = min(data_line, len(lines) - 1)
        label_x = NAME_X if codes else LABEL_X
        labels = [(label_x, y + i * wrap, line) for i, line in enumerate(lines)]
        num_y = y + k * wrap
        if codes and lines[0] != "Total":
            labels.append((CODE_X, num_y, f"{n + 1}."))
        nums = [(col, RIGHT[col] - text_width(v), v) for col, v in enumerate(values) if v is not None]
        out.append((num_y, labels, nums))
        y += (len(lines) - 1) * wrap + pitch
    return out, y


def make_pdf(path: Path, rows=ROWS, *, extra: list[tuple[float, float, str]] | None = None, **kw) -> Path:
    placed, _ = layout(rows, **kw)
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    page.insert_text((50, 70), "Table 9: Spending by item, 2024 and 2025 (not a real table)", fontsize=SIZE, fontname=FONT)
    for x, text in [(LABEL_X, "Item")] + [(RIGHT[c] - text_width(t), t) for c, t in enumerate(["2024", "2025", "Change", "Count"])]:
        page.insert_text((x, HEADER_Y), text, fontsize=SIZE, fontname=FONT)
    for num_y, labels, nums in placed:
        for x, y, text in labels:
            page.insert_text((x, y), text, fontsize=SIZE, fontname=FONT)
        for _, x, text in nums:
            page.insert_text((x, num_y), text, fontsize=SIZE, fontname=FONT)
    for x, y, text in extra or []:
        page.insert_text((x, y), text, fontsize=SIZE, fontname=FONT)
    doc.save(path)
    doc.close()
    return path


def first_reader_doc(rows=ROWS, **kw) -> dict:
    """What Docling made of the table: the 2025 and Change columns merged into one (3 value columns, not 4)."""
    placed, bottom = layout(rows, **kw)

    def cell(r, c, text, x0, x1, y, header=False):
        return {"bbox": {"l": x0, "t": y - 8, "r": x1, "b": y + 2, "coord_origin": "TOPLEFT"}, "row_span": 1, "col_span": 1,
                "start_row_offset_idx": r, "end_row_offset_idx": r + 1, "start_col_offset_idx": c, "end_col_offset_idx": c + 1,
                "text": text, "column_header": header, "row_header": False, "row_section": False}

    cells = [cell(0, 0, "Item", LABEL_X, 80, HEADER_Y, True), cell(0, 1, "2024", 300, RIGHT[0], HEADER_Y, True),
             cell(0, 2, "2025 Change", 360, RIGHT[2], HEADER_Y, True), cell(0, 3, "Count", 515, RIGHT[3], HEADER_Y, True)]
    for r, ((lines, values), (num_y, _, nums)) in enumerate(zip(rows, placed), start=1):
        cells.append(cell(r, 0, " ".join(lines), LABEL_X, 200, num_y))
        at = {col: (x0, text) for col, x0, text in nums}
        if 0 in at:
            cells.append(cell(r, 1, at[0][1], at[0][0], RIGHT[0], num_y))
        merged = [at[c] for c in (1, 2) if c in at]
        if merged:
            right = RIGHT[2] if 2 in at else RIGHT[1]
            cells.append(cell(r, 2, " ".join(t for _, t in merged), merged[0][0], right, num_y))
        if 3 in at:
            cells.append(cell(r, 3, at[3][1], at[3][0], RIGHT[3], num_y))
    table = {"label": "table",
             "prov": [{"page_no": 1, "bbox": {"l": 40.0, "t": H - TOP, "r": 560.0, "b": H - bottom, "coord_origin": "BOTTOMLEFT"}}],
             "data": {"num_rows": len(rows) + 1, "num_cols": 4, "table_cells": cells}}
    return {"schema_name": "DoclingDocument", "version": "test",
            "pages": {"1": {"page_no": 1, "size": {"width": W, "height": H}}}, "tables": [table], "texts": []}


@pytest.fixture
def first_table(tmp_path):
    def _make(rows=ROWS, **kw):
        p = tmp_path / "output.json"
        p.write_text(json.dumps(first_reader_doc(rows, **kw)), encoding="utf-8")
        return load_tables(p)[0]
    return _make


def body_rows(table):
    """Rows of the second reading below the header, as lists of cell text by column."""
    grid = table.grid()
    return [[c.text if c else None for c in row] for row in grid if not any(c and c.column_header for c in row)]


# ----------------------------------------------------------------------------- the first reader really is broken

def test_first_reader_fixture_carries_both_routing_flags(first_table):
    flags = detect_table_flags(first_table(), expected_value_columns=4)
    assert "merged_rows" in flags and "dropped_column" in flags


# ----------------------------------------------------------------------------- clustering

def test_rows_and_columns_are_recovered_from_word_positions(tmp_path, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    reading = sr.read_docling_table(pdf, first_table(), expected_columns=4)
    assert reading.usable, reading.reason
    assert reading.reader == "pdfplumber" and reading.version == sr.reader_version()
    assert re.fullmatch(r"[0-9a-f]{64}", reading.config_sha256)
    assert body_rows(reading.table) == [
        ["Food and drink", "10.0", "12.0", "2.0", "1"],
        ["Housing, water and household fuels", "5.5", "5.0", "(0.5)", "2"],   # wrapped label joined, in reading order
        ["Transport", "4.5", "4.5", None, "3"],                               # the blank cell stays blank
        ["Total", "20.0", "21.5", "1.5", "6"],
    ]
    assert reading.stats["data_rows"] == 4 and reading.stats["value_cells"] == 15
    assert reading.stats["columns_found"] == 4 and reading.stats["anchors_matched"] == reading.stats["anchors_given"] == 3
    # the two close columns are separate bands that do not touch
    b, c = reading.column_bands[1], reading.column_bands[2]
    assert b[1] < c[0]
    # header words (including the years) are kept as header text and never read as data
    headers = [c.text for c in reading.table.cells if c.column_header]
    assert headers == ["Item 2024 2025 Change Count"]
    assert reading.table.value_columns() == [1, 2, 3, 4]
    assert detect_table_flags(reading.table, expected_value_columns=4) == []


def test_bracket_negative_is_parsed_only_by_the_normaliser(tmp_path, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    table = sr.read_docling_table(pdf, first_table(), 4).table
    cell = next(c for c in table.cells if c.text == "(0.5)")
    made = common.make_cell(source=SOURCE, run=RUN, table=table, tcell=cell, row_label_raw="x", col_label_raw="", table_flags=[])
    assert made.value_raw == "(0.5)" and made.value_parsed == "-0.5" and "bracket_negative" in made.normalization_flags


def test_coverage_of_the_second_reading_is_measured_against_the_text_layer(tmp_path, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    table = sr.read_docling_table(pdf, first_table(), 4).table
    cov = table_coverage(table, pdf)
    assert cov["printed_numeric_tokens"] == 17 and cov["matched"] == 17 and cov["coverage"] == 1.0   # 15 values + 2 header years


def test_leading_code_column_is_kept_apart_so_a_wrapped_name_reads_in_order(tmp_path, first_table):
    # "2." and the numbers sit on the SECOND line of the wrapped name, as in the PBS CPI tables.
    kw = dict(codes=True, data_line=1)
    pdf = make_pdf(tmp_path / "t.pdf", **kw)
    reading = sr.read_docling_table(pdf, first_table(**kw), 4)
    assert reading.usable, reading.reason
    assert reading.stats["label_columns"] == 2
    rows = body_rows(reading.table)
    assert rows[1][:3] == ["2.", "Housing, water and household fuels", "5.5"]
    assert rows[3][:2] == [None, "Total"]


# ----------------------------------------------------------------------------- provenance

def test_cell_boxes_are_normalised_top_left_and_sit_on_the_printed_number(tmp_path, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    first = first_table()
    reading = sr.read_docling_table(pdf, first, 4)
    assert reading.table.page == 1 and reading.table.bbox == first.bbox
    printed = {w[4]: w for w in page_words(pdf, 1)}          # PyMuPDF, an independent parser of the same text layer
    for text in ("21.5", "(0.5)", "6"):
        cell = next(c for c in reading.table.cells if c.text == text)
        x0, y0, x1, y1 = cell.bbox
        assert 0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        w = printed[text]
        assert w[0] <= cx <= w[2] and w[1] <= cy <= w[3]
    total = next(c for c in reading.table.cells if c.text == "21.5")
    assert total.bbox[1] > 0.2 and total.bbox[2] == pytest.approx(RIGHT[1] / W, abs=0.003)   # low on the page, not flipped


def test_an_unconverted_bottom_left_table_box_is_refused_not_read(tmp_path, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    first = first_table()
    raw = first_reader_doc()["tables"][0]["prov"][0]["bbox"]
    wrong = norm_bbox({**raw, "coord_origin": "TOPLEFT"}, W, H)     # the trap: bottom-left numbers read as top-left
    assert wrong != first.bbox
    reading = sr.read_table(pdf, 1, wrong, sr.anchors_from_table(first), 4)
    assert not reading.usable and "outside the table box" in reading.reason


# ----------------------------------------------------------------------------- refusals

def test_refuses_when_a_number_straddles_two_column_bands(tmp_path, first_table):
    wide = "1,234,567.8"
    y = FIRST_Y + PITCH + WRAP + PITCH      # the Transport row
    pdf = make_pdf(tmp_path / "t.pdf", extra=[(RIGHT[2] - 8 - text_width(wide), y, wide)])
    reading = sr.read_docling_table(pdf, first_table(), 4)
    assert not reading.usable and reading.table is None
    assert "straddles two column bands" in reading.reason


def test_refuses_when_the_column_count_is_not_the_expected_one(tmp_path, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    reading = sr.read_docling_table(pdf, first_table(), expected_columns=5)
    assert not reading.usable and "4 value columns were found by position; 5 are expected" in reading.reason


def test_refuses_when_a_label_line_could_belong_to_either_row(tmp_path, first_table):
    kw = dict(wrap=13.0, pitch=13.0)        # the continuation line is exactly half way between two rows of numbers
    pdf = make_pdf(tmp_path / "t.pdf", **kw)
    reading = sr.read_docling_table(pdf, first_table(**kw), 4)
    assert not reading.usable and "could belong to either" in reading.reason


def test_refuses_a_row_of_numbers_without_a_label(tmp_path, first_table):
    rows = ROWS[:2] + [([""], ["4.5", "4.5", None, "3"])] + ROWS[3:]
    pdf = make_pdf(tmp_path / "t.pdf", rows)
    reading = sr.read_docling_table(pdf, first_table(rows), 4)
    assert not reading.usable and "has no label" in reading.reason


def test_refuses_when_page_sizes_differ(tmp_path, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    first = first_table()
    first.page_size = (W, H + 40)
    reading = sr.read_docling_table(pdf, first, 4)
    assert not reading.usable and "page size" in reading.reason


def test_refuses_when_the_first_reader_gives_nothing_to_anchor_on(tmp_path, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    first = first_table()
    first.cells = [c for c in first.cells if c.column_header or c.col == 0]
    reading = sr.read_docling_table(pdf, first, 4)
    assert not reading.usable and "anchor" in reading.reason


# ----------------------------------------------------------------------------- routing: the checks decide

SOURCE = Source(source_id="test-src", doc_type="abs", publisher="Test", jurisdiction="pk", title="Test Statement 2025",
                period="2025-26", role="core", retrieved_via="official", sha256="0" * 64, size_bytes=1,
                local_path="t.pdf", verification_status="official_only", verification_record="none")
RUN = RunManifest(run_id="TEST__docling__full-document__run-01", source_id="test-src", sha256_at_run="0" * 64,
                  run_mode="full-document", tool_versions={"docling": "9.9.9"}, config={}, config_sha256="1" * 64,
                  started_at="2026-10-12T00:00:00+00:00", validated=True)
COLUMNS = {1: "y2024", 2: "y2025", 3: "change", 4: "count"}
SERIES = {f"t.{row}.{col}": Series(series_id=f"t.{row}.{col}", name=f"{row} {col}", dataset="abs", frequency="fiscal_year", unit="PKR")
          for row in ("food", "housing", "transport", "total") for col in COLUMNS.values()}


def build_for(pdf: Path):
    """A minimal dataset builder in the shape `try_second_reader` expects."""
    def build(table):
        flags = detect_table_flags(table, expected_value_columns=4)
        coverage = table_coverage(table, pdf)
        grid = table.grid()
        value_cols = table.value_columns()
        cells, meta = [], {}
        for r in range(table.num_rows):
            label = common.row_label(table, grid, r, value_cols)
            for k in value_cols:
                tc = grid[r][k]
                if tc is None or tc.column_header or not tc.text.strip():
                    continue
                cell = common.make_cell(source=SOURCE, run=RUN, table=table, tcell=tc, row_label_raw=label,
                                        col_label_raw=COLUMNS.get(k, ""), table_flags=flags)
                row_key = label.split()[0].strip(",").lower() if label else ""
                sid = f"t.{row_key}.{COLUMNS.get(k)}"
                if sid in SERIES and len(value_cols) == 4:
                    cell.series_id, cell.period, cell.vintage, cell.mapping_method = sid, "2025-26", "be", "dictionary"
                    meta[cell.cell_id] = {"row": row_key, "col": COLUMNS[k]}
                cells.append(cell)
        return cells, {"table_flags": flags, "coverage": coverage}, meta
    return build


def column_totals(cells, meta):
    out = []
    for col in COLUMNS.values():
        by_row = {meta[c.cell_id]["row"]: c for c in cells if c.cell_id in meta and meta[c.cell_id]["col"] == col}
        if "total" not in by_row:
            continue
        members = [(c, 1) for row, c in sorted(by_row.items()) if row != "total"]
        out.append(sum_check(check_type="column_total", dataset="abs", rule_id="t.total", target=by_row["total"], members=members,
                             what_members="the items", what_target="Total", column_label=f"column {col}"))
    return out


def route(tmp_path, monkeypatch, first, pdf, required=("column_total",)):
    monkeypatch.setenv("WORK_DIR", str(tmp_path / "work"))
    monkeypatch.setattr("datalab.sources.source_path", lambda source: pdf)
    build = build_for(pdf)
    first_cells, info, _ = build(first)
    result = common.try_second_reader(source=SOURCE, table=first, table_flags=info["table_flags"], first_cells=first_cells,
                                      expected_value_columns=4, build=build, checks=column_totals, required_checks=required)
    return first_cells, result


def test_second_reading_is_promoted_when_every_check_passes(tmp_path, monkeypatch, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    first = first_table()
    first_cells, result = route(tmp_path, monkeypatch, first, pdf)
    assert result["promoted"] and result["record"]["decision"].startswith("used: all 4 arithmetic checks pass")
    assert result["record"]["routed_by"] == ["dropped_column", "merged_rows"]
    assert result["record"]["checks"]["column_total"] == {"pass": 4, "pass_within_rounding": 0, "fail": 0, "not_evaluable": 0}
    assert result["coverage"]["coverage"] == 1.0
    cells = result["cells"]
    assert len(cells) == 15 and all(c.series_id for c in cells)
    for c in cells:
        assert c.extractor_name == "pdfplumber" and c.extractor_version == sr.reader_version()
        assert c.extract_config_sha256 == sr.reader_config_sha256() and c.run_id == RUN.run_id
        assert c.second_reader_of.first_reader == "docling" and c.second_reader_of.first_reader_version == "9.9.9"
        assert c.second_reader_of.routed_by == ["dropped_column", "merged_rows"]
        # the first reader's blocking flags do not carry over onto the reading that passed
        assert c.structural_flags == []
        assert c.cell_id == cell_id_for(c.source_id, c.page, c.table_index, c.row_index, c.col_index, reader="pdfplumber")
    assert not {c.cell_id for c in cells} & {c.cell_id for c in first_cells}
    # the first reading stays in the record: unmapped, flagged, with what the second reader read at the same spot
    assert all(c.series_id is None and "superseded_by_second_reader" in c.structural_flags for c in first_cells)
    merged = next(c for c in first_cells if c.value_raw == "5.0 (0.5)")
    assert merged.value_parsed is None and "merged_rows" in merged.structural_flags
    assert merged.second_reader.name == "pdfplumber" and merged.second_reader.value_raw == "5.0 (0.5)" and merged.second_reader.agreement
    change = next(c for c in cells if c.value_raw == "(0.5)")
    assert change.value_parsed == "-0.5" and change.second_reader_of.first_cell_ids == [merged.cell_id]
    assert (tmp_path / "work" / "qa" / "overlay_test-src_p001_second_reader.png").exists()


def test_promoted_values_are_tier_b_and_the_receipt_says_a_second_tool_read_them(tmp_path, monkeypatch, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    first_cells, result = route(tmp_path, monkeypatch, first_table(), pdf)
    cells = first_cells + result["cells"]
    checks = column_totals(result["cells"], result["meta"])
    obs = {o.obs_id: o for o in build_observations(cells, checks, SERIES, {"test-src": "2025-26"}, {"test-src": SOURCE.title}, "v-test")}
    o = obs["t.housing.change:2025-26:be"]
    assert o.value == "-0.5" and o.tier == "B" and o.published      # arithmetic alone never gives tier A
    assert o.evidence_summary.startswith("Read by a second tool (pdfplumber) because the first tool (docling) lost a column "
                                         "and merged rows in this table;")
    assert "One of 2 amounts that add to the printed 'Total' 1.5 (exactly)." in o.evidence_summary
    # P10: the count column (1, 2, 3 = 6) has a rounding allowance of 1.5, so the member 1 earns nothing from that sum;
    # every other figure, including the other two members and the total, is still tier B.
    assert len(obs) == 15
    small = obs["t.food.count:2025-26:be"]
    assert small.tier == "C" and not small.published
    assert all(v.tier == "B" for k, v in obs.items() if k != small.obs_id)


def test_one_altered_digit_fails_the_check_and_nothing_is_promoted(tmp_path, monkeypatch, first_table):
    rows = [(["Food and drink"], ["10.0", "13.0", "2.0", "1"])] + ROWS[1:]      # 12.0 printed as 13.0; the total still says 21.5
    pdf = make_pdf(tmp_path / "t.pdf", rows)
    first = first_table(rows)
    first_cells, result = route(tmp_path, monkeypatch, first, pdf)
    record = result["record"]
    assert record["reading"]["usable"] is True
    assert not result["promoted"] and not record["promoted"] and result["cells"] == [] and result["meta"] == {}
    assert record["decision"] == "not used: 1 of 4 arithmetic checks did not pass on the second reading"
    assert record["checks"]["column_total"]["fail"] == 1
    # everything stays exactly as it was: flagged, no second reading attached, nothing superseded
    assert all(c.second_reader is None and "superseded_by_second_reader" not in c.structural_flags for c in first_cells)
    assert all("merged_rows" in c.structural_flags for c in first_cells)
    obs = build_observations(first_cells, [], SERIES, {"test-src": "2025-26"}, {"test-src": SOURCE.title}, "v-test")
    assert not any(o.published for o in obs)


def test_nothing_is_promoted_when_a_required_check_never_ran(tmp_path, monkeypatch, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    _, result = route(tmp_path, monkeypatch, first_table(), pdf, required=("column_total", "recompute"))
    assert not result["promoted"] and "could not be run on the second reading: recompute" in result["record"]["decision"]


def test_nothing_is_promoted_when_the_reader_refuses(tmp_path, monkeypatch, first_table):
    kw = dict(wrap=13.0, pitch=13.0)
    pdf = make_pdf(tmp_path / "t.pdf", **kw)
    first_cells, result = route(tmp_path, monkeypatch, first_table(**kw), pdf)
    assert not result["promoted"] and result["cells"] == []
    assert result["record"]["decision"].startswith("not used: the label line")
    assert all(c.second_reader is None for c in first_cells)


def test_a_table_without_the_routing_flags_never_reaches_the_second_reader(tmp_path, monkeypatch, first_table):
    pdf = make_pdf(tmp_path / "t.pdf")
    first = first_table()
    monkeypatch.setattr("datalab.sources.source_path", lambda source: (_ for _ in ()).throw(AssertionError("must not be read")))
    for flags in ([], ["title_text_as_data"], ["low_coverage", "possible_dropped_column", "column_unmapped"]):
        assert common.try_second_reader(source=SOURCE, table=first, table_flags=flags, first_cells=[], expected_value_columns=4,
                                        build=build_for(pdf), checks=column_totals, required_checks=("column_total",)) is None


def test_first_reader_cell_ids_are_unchanged_by_the_reader_argument():
    assert cell_id_for("s", 1, 0, 2, 3) == cell_id_for("s", 1, 0, 2, 3, reader="")
    assert cell_id_for("s", 1, 0, 2, 3) != cell_id_for("s", 1, 0, 2, 3, reader="pdfplumber")
