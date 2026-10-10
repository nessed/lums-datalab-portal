from decimal import Decimal

import pytest

from conftest import PAGE_H, PAGE_W, docling_table
from datalab.tables import load_tables, norm_bbox
from datalab.validate import _multiset_match, detect_table_flags

ROWS = [
    ["Code", "Description", "Budget 2024-25", "Revised 2024-25", "Budget 2025-26"],
    ["01", "General Public Services", "13,640,239", "12,719,051", "12,210,851"],
    ["07", "Health", "28,171", "52,130", "31,975"],
    ["", "Total", "13,668,410", "12,771,181", "12,242,826"],
]


def test_bbox_origins_are_converted_not_assumed():
    # The same physical box, described with both origins, must normalise to the same thing.
    top_left = {"l": 60, "t": 100, "r": 160, "b": 120, "coord_origin": "TOPLEFT"}
    bottom_left = {"l": 60, "t": PAGE_H - 100, "r": 160, "b": PAGE_H - 120, "coord_origin": "BOTTOMLEFT"}
    assert norm_bbox(top_left, PAGE_W, PAGE_H) == norm_bbox(bottom_left, PAGE_W, PAGE_H) == [0.1, 0.125, 0.26667, 0.15]


def test_unknown_origin_is_an_error():
    with pytest.raises(ValueError):
        norm_bbox({"l": 0, "t": 0, "r": 1, "b": 1, "coord_origin": "CENTER"}, PAGE_W, PAGE_H)


def test_cells_sit_inside_their_table(write_doc):
    (table,) = load_tables(write_doc([docling_table(ROWS)]))
    x0, y0, x1, y1 = table.bbox
    for c in table.cells:
        assert x0 <= c.bbox[0] <= c.bbox[2] <= x1
        assert y0 <= c.bbox[1] <= c.bbox[3] <= y1


def test_value_columns_exclude_code_and_description(write_doc):
    (table,) = load_tables(write_doc([docling_table(ROWS)]))
    assert table.value_columns() == [2, 3, 4]


def test_table_index_counts_within_the_page(write_doc):
    tables = load_tables(write_doc([docling_table(ROWS, page=1), docling_table(ROWS, page=2), docling_table(ROWS, page=2)], pages=2))
    assert [(t.page, t.table_index) for t in tables] == [(1, 0), (2, 0), (2, 1)]


def test_clean_table_has_no_flags(write_doc):
    (table,) = load_tables(write_doc([docling_table(ROWS)]))
    assert detect_table_flags(table, expected_value_columns=3) == []


def test_detector_merged_rows(write_doc):
    rows = [r[:] for r in ROWS]
    rows[2][2] = "852  251,130"          # AGENTS.md section 7, trap 2
    (table,) = load_tables(write_doc([docling_table(rows)]))
    assert "merged_rows" in detect_table_flags(table, expected_value_columns=3)


def test_detector_title_text_as_data(write_doc):
    rows = [r[:] for r in ROWS]
    rows[1][4] = "Table 12"
    (table,) = load_tables(write_doc([docling_table(rows)]))
    assert "title_text_as_data" in detect_table_flags(table, expected_value_columns=3)


def test_detector_dropped_column(write_doc):
    rows = [r[:4] for r in ROWS]         # one value column lost
    (table,) = load_tables(write_doc([docling_table(rows)]))
    assert "dropped_column" in detect_table_flags(table, expected_value_columns=3)


def test_coverage_multiset_counts_duplicates():
    printed = [Decimal(415), Decimal(415), Decimal(448), Decimal("5.0")]
    emitted = [Decimal(415), Decimal(448), Decimal(5)]
    matched, missing = _multiset_match(printed, emitted)
    assert matched == 3                   # only one 415 was captured; 5.0 == 5
    assert missing == ["415"]
