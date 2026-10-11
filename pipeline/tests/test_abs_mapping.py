"""Column and row meaning read from the text layer by position (synthetic words, no PDF)."""
import yaml

from conftest import PAGE_H, PAGE_W, docling_table
from datalab import config
from datalab.datasets.abs import locate, map_columns
from datalab.datasets.common import column_header_text, previous_fy, next_fy, text_layer_row_label
from datalab.tables import load_tables

SPEC = yaml.safe_load((config.SPECS_DIR / "abs.yaml").read_text(encoding="utf-8"))
FUNCTIONS = ["General Public Services", "Defence Affairs and Services", "Public Order and Safety Affairs", "Economic Affairs",
             "Environment Protection", "Housing and Community Amenities", "Health", "Recreation, Culture and Religion",
             "Education Affairs and Services", "Social Protection"]


def word(x0, y0, x1, y1, text):
    return (x0 / PAGE_W, y0 / PAGE_H, x1 / PAGE_W, y1 / PAGE_H, text)


def function_table(header=("Estimates 2024-25", "Estimates 2024-25", "Estimates 2025-26")):
    rows = [["Code", "Description", *header]]
    rows += [[f"{i + 1:02d}", name, f"{(i + 1) * 1000:,}", f"{(i + 1) * 1100:,}", f"{(i + 1) * 1200:,}"] for i, name in enumerate(FUNCTIONS)]
    return docling_table(rows, top=100.0)


def header_words(labels):
    # value columns sit at x = 250-350, 350-450, 450-550; headers are printed above y = 120
    out = []
    for k, (kind, year) in enumerate(labels):
        x = 260 + 100 * k
        out += [word(x, 60, x + 60, 70, kind), word(x, 72, x + 60, 82, "Estimates"), word(x, 84, x + 60, 94, year)]
    return out


def test_fiscal_year_helpers():
    assert previous_fy("2025-26") == "2024-25" and next_fy("2025-26") == "2026-27"
    assert previous_fy("2000-01") == "1999-00"


def test_locator_finds_the_function_table_and_rejects_ties(write_doc):
    other = docling_table([["A", "B"], ["Health", "1"], ["Economic Affairs", "2"]])
    tables = load_tables(write_doc([other, function_table()]))
    table, info = locate(tables, SPEC)
    assert info["result"] == "found" and table.num_rows == 11
    tables = load_tables(write_doc([function_table(), function_table()]))
    assert locate(tables, SPEC)[1]["result"] == "tie"
    assert locate(load_tables(write_doc([other])), SPEC)[1]["result"] == "not_found"


def test_column_meaning_comes_from_the_text_layer_not_docling_headers(write_doc):
    # Docling lost "Budget"/"Revised" from the headers; the words above the columns still carry them.
    (table,) = load_tables(write_doc([function_table()]))
    words = header_words([("Budget", "2024-25"), ("Revised", "2024-25"), ("Budget", "2025-26")])
    assert "Budget" in column_header_text(table, 2, words) and "2024-25" in column_header_text(table, 2, words)
    mapping, problems = map_columns(table, table.value_columns(), words, "2025-26", SPEC)
    assert problems == []
    assert {k: v[:2] for k, v in mapping.items()} == {2: ("2024-25", "be"), 3: ("2024-25", "re"), 4: ("2025-26", "be")}


def test_unexpected_columns_block_the_mapping(write_doc):
    (table,) = load_tables(write_doc([function_table()]))
    wrong_year = header_words([("Budget", "2023-24"), ("Revised", "2023-24"), ("Budget", "2024-25")])
    assert map_columns(table, table.value_columns(), wrong_year, "2025-26", SPEC)[1]
    no_vintage = header_words([("", "2024-25"), ("", "2024-25"), ("", "2025-26")])
    assert map_columns(table, table.value_columns(), no_vintage, "2025-26", SPEC)[1]


def test_row_label_from_text_layer(write_doc):
    (table,) = load_tables(write_doc([function_table()]))
    grid = table.grid()
    # row 7 (Health) occupies y = 240-260; its label words are printed left of x = 250
    words = [word(60, 244, 80, 256, "07"), word(160, 244, 200, 256, "Health"),
             word(160, 224, 240, 236, "Housing"), word(260, 244, 300, 256, "7,000")]
    assert text_layer_row_label(table, grid, 7, table.value_columns(), words) == "07 Health"
