"""ABS receipts side (E2, D32): labels, locator, cells, checks, gaps. Synthetic inputs only, no source files."""
import yaml

from conftest import docling_table
from datalab import config
from datalab.datasets import abs_receipts as ar
from datalab.schema import RunManifest, Source
from datalab.tables import load_tables

SPEC = yaml.safe_load((config.SPECS_DIR / "abs_receipts.yaml").read_text(encoding="utf-8"))
LABELS_SPEC = yaml.safe_load((config.SPECS_DIR / "abs_receipts_labels.yaml").read_text(encoding="utf-8"))
ABS_SPEC = yaml.safe_load((config.SPECS_DIR / "abs.yaml").read_text(encoding="utf-8"))
CATALOGUE = ar.series_catalogue(SPEC, ABS_SPEC)
SERIES = {s.series_id: s for s in CATALOGUE}
PARENTS = {s.series_id: s.parent_id for s in CATALOGUE}
NAMES = {s.series_id: s.name for s in CATALOGUE}
LABELS = ar.ReceiptLabels(LABELS_SPEC, PARENTS)
TSPEC = {t["id"]: t for t in SPEC["tables"]}
TABLE_NAMES = {t["id"]: t["name"] for t in SPEC["tables"]}
HEADER = ["Object Code", "Description", "Budget Estimates 2024-25", "Revised Estimates 2024-25", "Budget Estimates 2025-26"]
SCALE_WORDS = [(0.8, 0.01, 0.82, 0.02, "(Rs"), (0.83, 0.01, 0.84, 0.02, "in"), (0.85, 0.01, 0.9, 0.02, "million)")]
FULL = {"coverage": 1.0, "coverage_row_band": 1.0, "printed_numeric_tokens": 10, "matched": 10}
RUN = RunManifest.model_construct(run_id="TEST__run-01", tool_versions={"docling": "test"}, config_sha256="0" * 64)


def row(code, name, a, b=None, c=None):
    return [code, name, str(a), str(b if b is not None else a), str(c if c is not None else a)]


def summary_rows(*, tax=100, direct=40, indirect=60, share=50, net=None):
    revenue = tax + 30
    gross = revenue + 20 + 10 + 5
    net = gross - share if net is None else net
    return [HEADER,
            row("B", "1 Tax Revenue Receipts", tax), row("", "FBR Taxes", tax),
            row("B01", "Direct Taxes", direct), row("B02", "Indirect Taxes", indirect),
            row("C", "2 Non-Tax Revenue Receipts", 30),
            row("C01", "Income from Property and Enterprise", 10), row("C02", "Receipts from Civil Administration etc.", 12),
            row("C03", "Miscellaneous Receipts", 8),
            row("", "3 Total Revenue Receipts (1+2)", revenue),
            row("E", "4 Capital Receipts", 20),
            row("E02", "Recovery of Loans and Advances", 5), row("E03", "Domestic Debt Receipts (Non Bank) - Net", 15),
            row("", "5 Total Internal Receipts (3+4)", revenue + 20),
            row("", "6 External Receipts", 10),
            row("", "7 Total Internal and External Receipts (5+6)", revenue + 30),
            row("G", "8 Public Account Receipts", 5),
            row("", "Deferred Liabilities (Net)", 2), row("", "Deposit and Reserves (Net)", 3),
            row("", "9 Gross Federal Resources (7+8)", gross),
            row("", "10 Less Provincial Share in Federal Taxes", share),
            row("", "11 Net Federal Resources (9-10)", net),
            row("", "12 Cash Balance Surplus by the Provinces", 4),
            row("", "13 Privatization Proceeds", "-"),
            row("", "14 Domestic Debt Receipts (Bank) - Net", 6),
            row("", "15 Total Resources (11+12+13+14)", net + 10)]


def tax_rows(*, sales=35, with_sales=True, direct=40, indirect=60):
    rows = [HEADER,
            ["B", "Tax Revenue", "", "", ""],
            row("", "FBR Taxes", direct + indirect),
            row("B01", "i.Direct Taxes", direct),
            row("B011", "Taxes on Income", direct - 3), row("B01501", "WWF (Ordinary Collection)", 1),
            row("B01502", "WPPF(Contribution under Companies Profit)", 1), row("B017-18", "Capital Value Tax (CVT)", 1),
            row("B02", "ii.Indirect Taxes", indirect),
            row("B020-22", "Customs Duties", 15)]
    if with_sales:
        rows.append(row("B023", "Sales Tax", sales))
    rows += [row("B024-25", "Federal Excise", 10), row("", "1 Total Tax Revenue (i+ii)", direct + indirect)]
    return rows


def source(period="2025-26"):
    return Source.model_construct(source_id=f"abs-test-{period}", doc_type="abs", title=f"ABS {period}", period=period)


def columns_for(period):
    prev = ar.previous_fy(period)
    return {2: (prev, "be", f"Budget Estimates {prev}"), 3: (prev, "re", f"Revised Estimates {prev}"),
            4: (period, "be", f"Budget Estimates {period}")}


def build(table, kind, *, src=None, coverage=FULL, problems=(), words=SCALE_WORDS):
    src = src or source()
    return ar.build_table(source=src, run=RUN, table=table, tspec=TSPEC[kind], spec=SPEC, abs_spec=ABS_SPEC, labels=LABELS,
                          words=words, coverage=coverage,
                          map_columns=lambda t, cols, w, edition, spec: (columns_for(edition), list(problems)))


def checks_for(cells, src_id="abs-test-2025-26", blocked=None):
    return ar.sum_checks({(src_id, 1, 0): cells}, SPEC, PARENTS, blocked or {}, lambda c: f"column {c.period} {c.vintage}")


def by_rule(checks, rule, period="2025-26", vintage="be"):
    return [k for k in checks if k.rule_id == f"abs_receipts.{rule}" and f"column {period} {vintage}" in k.description]


def series_of(cells):
    return {c.series_id for c in cells if c.series_id}


# ------------------------------------------------------------------ spec consistency

def test_spec_names_only_series_that_exist():
    ids = set(SERIES)
    assert all(s.parent_id is None or s.parent_id in ids for s in CATALOGUE)
    assert {e["series"] for e in LABELS_SPEC["labels"]} <= ids and set(LABELS_SPEC["block_heads"]) <= ids
    for rule in SPEC["rules"]:
        named = [rule["target"], rule.get("if_present"), rule.get("unless_present")]
        named += [m if isinstance(m, str) else m["series"] for m in rule.get("members", []) + rule.get("optional", [])]
        assert {n for n in named if n} <= ids, rule["id"]
    for t in SPEC["tables"]:
        assert set(t["expected"]) <= ids
    assert set(SPEC["watch_series"]) <= set(TSPEC["tax"]["expected"])
    assert all(s.series_id.startswith("fed.rev.") and s.unit == "PKR" and s.scale_factor == 1000000 for s in CATALOGUE)


def test_enabled_flag_is_read_from_the_spec(monkeypatch, tmp_path):
    assert ar.enabled() is bool(SPEC["enabled"])
    monkeypatch.setattr(config, "SPECS_DIR", tmp_path)
    assert ar.enabled() is False                      # no spec file: receipts are simply not read
    (tmp_path / "abs_receipts.yaml").write_text("enabled: false\n", encoding="utf-8")
    assert ar.enabled() is False


# ------------------------------------------------------------------ labels

def test_object_code_line_number_and_enumerator_are_stripped_before_a_full_match():
    assert LABELS.lookup("B 1 Tax Revenue Receipts", None) == ("fed.rev.tax", "dictionary")
    assert LABELS.lookup("B01 i.Direct Taxes", None)[0] == "fed.rev.tax.direct"
    assert LABELS.lookup("B02 b. Indirect Taxes", None)[0] == "fed.rev.tax.indirect"
    assert LABELS.lookup("a. FBR Taxes (i+ii)", None)[0] == "fed.rev.tax.fbr"
    assert LABELS.lookup("E033 6 External Receipts", None)[0] == "fed.rev.external"
    assert LABELS.lookup("G03 7 Public Accounts Receipts (Net)", None)[0] == "fed.rev.public_account"
    assert LABELS.lookup("15 Total-Resources (11+12+13+14)", None)[0] == "fed.rev.total_resources"
    assert LABELS.lookup("I) Total Tax Revenue (a+b)*", None)[0] == "fed.rev.tax"
    # no partial matches, and a scrambled label is not repaired
    for label in ("Sales Tax on Services", "Total Revenue", "Tax Revenue (a+b)* Total", "Net Federal Resources",
                  "Gross Federal Resources (1+2)", "Taxes"):
        assert LABELS.lookup(label, "fed.rev.tax.indirect")[0] is None, label


def test_a_line_under_a_head_is_recognised_only_inside_that_heads_block():
    assert LABELS.lookup("B023 Sales Tax", "fed.rev.tax.indirect") == ("fed.rev.tax.indirect.sales_tax", "dictionary")
    assert LABELS.lookup("B023 Sales Tax", None) == (None, "outside_its_block")
    assert LABELS.lookup("B023 Sales Tax", "fed.rev.tax.direct") == (None, "outside_its_block")
    # the same printed name is a different line under a different head
    assert LABELS.lookup("Petroleum Levy", "fed.rev.tax.indirect")[0] == "fed.rev.tax.indirect.petroleum_levy"
    assert LABELS.lookup("B03085 Petroleum Levy", "fed.rev.tax.other")[0] == "fed.rev.tax.other.petroleum_levy"
    assert LABELS.lookup("B03064 Airport Tax", "fed.rev.tax.other")[0] == "fed.rev.tax.other.airport_tax"
    assert LABELS.lookup("Loans", "fed.rev.external")[0] == "fed.rev.external.loans"
    assert LABELS.lookup("Loans", "fed.rev.capital")[0] is None
    # "(Bank) - Net" is printed under capital receipts and as a financing line; the block decides
    label = "Domestic Debt Receipts (Bank) - Net"
    assert LABELS.lookup("E03 " + label, "fed.rev.capital")[0] == "fed.rev.capital.domestic_debt_bank_net"
    assert LABELS.lookup("14 " + label, None)[0] == "fed.rev.domestic_debt_bank_net"


def test_wrapped_and_renamed_labels_that_the_editions_print():
    assert LABELS.lookup("10 Less Provincial Share in Federal", None)[0] == "fed.rev.provincial_share"
    assert LABELS.lookup("10 Taxes Less Provincial Share in Federal", None)[0] == "fed.rev.provincial_share"
    assert LABELS.lookup("12 Cash Balance Surplus by the", None)[0] == "fed.rev.provincial_cash_surplus"
    assert LABELS.lookup("11 Cash Balance built up by the Provinces", None)[0] == "fed.rev.provincial_cash_surplus"
    assert LABELS.lookup("B024-25 Federal Excise Duty", "fed.rev.tax.indirect")[0] == "fed.rev.tax.indirect.federal_excise"
    assert LABELS.lookup("B01501 Worker's Welfare Fund", "fed.rev.tax.direct")[0] == "fed.rev.tax.direct.workers_welfare_fund"
    assert LABELS.lookup("B015 Worker's Profit Participation Fund", "fed.rev.tax.direct")[0].endswith("participation_fund")
    # the glued forms of the next row are NOT in the dictionary; the text layer has to supply the label
    assert LABELS.lookup("Taxes 11 Net Federal Resources (9-10)", None)[0] is None
    assert LABELS.lookup("Provinces 13 Privatization Proceeds", None)[0] is None
    # the two "Federal Consolidated Fund" lines are different quantities
    assert LABELS.lookup("Federal Consolidated Fund (5+6)", None)[0] == "fed.rev.consolidated_fund"
    assert LABELS.lookup("Federal Consolidated Fund (5+6-10)", None)[0] == "fed.rev.consolidated_fund_net"


def test_the_footnote_row_is_ignored_not_unmapped():
    assert LABELS.lookup("*Of which FBR", None) == (None, "ignored")
    assert LABELS.lookup("*Of which FBR taxes", "fed.rev.tax.indirect") == (None, "ignored")


def test_dictionary_must_not_name_an_unknown_series():
    bad = dict(LABELS_SPEC, labels=[{"pattern": "x", "series": "fed.rev.not_a_series"}])
    try:
        ar.ReceiptLabels(bad, PARENTS)
    except ValueError as exc:
        assert "fed.rev.not_a_series" in str(exc)
    else:
        raise AssertionError("an unknown series was accepted")


# ------------------------------------------------------------------ locator

def test_locator_finds_both_tables_by_head_names_whatever_the_page(write_doc):
    other = docling_table([["A", "B"], ["Health", "1"], ["Sales Tax", "2"]], page=1)
    tables = load_tables(write_doc([other, docling_table(tax_rows(), page=9), docling_table(summary_rows(), page=4)], pages=9))
    found, info = ar.locate(tables, SPEC)
    assert found["summary"].page == 4 and found["tax"].page == 9
    assert info["summary"]["result"] == info["tax"]["result"] == "found"


def test_locator_refuses_ties_and_missing_tables(write_doc):
    tables = load_tables(write_doc([docling_table(summary_rows(), page=1), docling_table(summary_rows(), page=2)], pages=2))
    found, info = ar.locate(tables, SPEC)
    assert found == {} and info["summary"]["result"] == "tie" and info["tax"]["result"] == "not_found"


# ------------------------------------------------------------------ rows and cells

def test_rows_are_mapped_with_columns_unit_and_scale(write_doc):
    (table,) = load_tables(write_doc([docling_table(tax_rows())]))
    cells, info = build(table, "tax")
    assert info["table_flags"] == [] and info["unmapped_labels"] == [] and info["amount_rows"] == info["rows_mapped"] == 11
    sales = [c for c in cells if c.series_id == "fed.rev.tax.indirect.sales_tax"]
    assert [(c.period, c.vintage, c.value_parsed) for c in sales] == [("2024-25", "be", "35"), ("2024-25", "re", "35"), ("2025-26", "be", "35")]
    assert all(c.unit == "PKR" and c.scale_factor == 1000000 and c.mapping_method == "dictionary" for c in sales)
    assert sales[0].row_label_raw == "B023 Sales Tax" and sales[0].col_label_raw == "Budget Estimates 2024-25"


def test_unconfirmed_columns_or_scale_map_nothing(write_doc):
    (table,) = load_tables(write_doc([docling_table(tax_rows())]))
    cells, info = build(table, "tax", problems=["columns found differ from the expected"])
    assert "column_unmapped" in info["table_flags"] and series_of(cells) == set() and info["series_mapped"] == []
    cells, info = build(table, "tax", words=[])
    assert "scale_not_confirmed" in info["table_flags"] and series_of(cells) == set()
    assert all(c.scale_factor is None for c in cells)


def test_members_of_a_lost_head_stay_unmapped(write_doc):
    rows = [r for r in tax_rows() if r[1] != "ii.Indirect Taxes"]
    (table,) = load_tables(write_doc([docling_table(rows)]))
    cells, info = build(table, "tax")
    assert not any((c.series_id or "").startswith("fed.rev.tax.indirect") for c in cells)
    assert info["labels_outside_their_block"] == ["B020-22 Customs Duties", "B023 Sales Tax", "B024-25 Federal Excise"]


def test_two_rows_on_one_series_are_both_left_unmapped(write_doc):
    rows = tax_rows()
    rows.insert(10, row("B023", "Sales Tax", 99))
    (table,) = load_tables(write_doc([docling_table(rows)]))
    cells, info = build(table, "tax")
    assert "fed.rev.tax.indirect.sales_tax" not in series_of(cells)
    assert info["duplicate_labels"] == ["B023 Sales Tax", "B023 Sales Tax"]


def test_unit_line_inside_the_table_is_not_an_amount_row(write_doc):
    rows = tax_rows()
    rows.insert(1, ["", "", "", "(Rs in million)", ""])
    (table,) = load_tables(write_doc([docling_table(rows)]))
    _, info = build(table, "tax")
    assert info["amount_rows"] == 11 and info["unmapped_labels"] == []


def test_label_falls_back_to_the_text_layer_on_the_amounts_own_line(write_doc):
    # Docling glued the second line of the row above ("Taxes") in front of this row's label.
    rows = summary_rows()
    at = next(i for i, r in enumerate(rows) if r[1].startswith("11 Net Federal"))
    rows[at][1] = "Taxes 11 Net Federal Resources (9-10)"
    rows[at - 1][1] = "10 Less Provincial Share in Federal"
    (table,) = load_tables(write_doc([docling_table(rows)]))
    y = (100.0 + at * 20.0 + 10.0) / 800.0                         # the row's vertical centre (conftest geometry)
    words = SCALE_WORDS + [(0.26 + 0.02 * i, y - 0.004, 0.275 + 0.02 * i, y + 0.004, w)
                           for i, w in enumerate(["11", "Net", "Federal", "Resources", "(9-10)"])]
    cells, info = build(table, "summary", words=words)
    assert info["labels_from_text_layer"] == ["11 Net Federal Resources (9-10)"] and info["unmapped_labels"] == []
    net = [c for c in cells if c.series_id == "fed.rev.net_federal_resources"]
    assert len(net) == 3 and all("row_label_from_text_layer" in c.structural_flags for c in net)
    assert {"fed.rev.provincial_share", "fed.rev.gross_federal_resources"} <= series_of(cells)


# ------------------------------------------------------------------ sum checks

def test_printed_hierarchy_adds_up_in_both_tables(write_doc):
    (summary,) = load_tables(write_doc([docling_table(summary_rows())]))
    cells, info = build(summary, "summary")
    assert info["unmapped_labels"] == [] and info["rows_mapped"] == 25
    checks = checks_for(cells)
    assert checks and all(k.result == "pass" for k in checks)
    rules = {k.rule_id.split(".")[1] for k in checks}
    assert {"fbr_is_direct_plus_indirect", "tax_is_fbr_plus_other", "nontax_heads", "revenue_total", "capital_heads",
            "internal_total", "internal_and_external_total", "public_account_heads", "gross_resources", "net_resources",
            "total_resources"} <= rules
    assert "tax_is_direct_plus_indirect" not in rules and "gross_resources_three_parts" not in rules
    # the financing line printed as "-" adds nothing and is never a member
    total = by_rule(checks, "total_resources")[0]
    assert len(total.member_cell_ids) == 3
    (tax,) = load_tables(write_doc([docling_table(tax_rows())]))
    tax_checks = checks_for(build(tax, "tax")[0])
    assert {k.rule_id.split(".")[1] for k in tax_checks} == {"fbr_is_direct_plus_indirect", "tax_is_fbr_plus_other",
                                                              "direct_tax_heads", "indirect_tax_heads"}
    assert all(k.result == "pass" for k in tax_checks)


def test_net_is_gross_less_the_provincial_share(write_doc):
    (table,) = load_tables(write_doc([docling_table(summary_rows(net=999))]))
    checks = checks_for(build(table, "summary")[0])
    net = by_rule(checks, "net_resources")
    assert len(net) == 1 and net[0].result == "fail" and net[0].observed == "115" and net[0].expected == "999"
    assert by_rule(checks, "revenue_total")[0].result == "pass"


def test_a_lost_sales_tax_row_fails_the_indirect_sum(write_doc):
    (table,) = load_tables(write_doc([docling_table(tax_rows(with_sales=False))]))
    cells, _ = build(table, "tax")
    assert "fed.rev.tax.indirect.sales_tax" not in series_of(cells)
    indirect = by_rule(checks_for(cells), "indirect_tax_heads")
    assert indirect[0].result == "fail" and indirect[0].residual == "-35"      # customs + excise = 25, printed 60
    assert by_rule(checks_for(cells), "direct_tax_heads")[0].result == "pass"


def test_a_wrong_figure_fails_and_is_never_forced(write_doc):
    # the frozen rule: half a unit of the last printed digit per member, here 3 x 0.5 = 1.5
    (table,) = load_tables(write_doc([docling_table(tax_rows(sales=36))]))
    assert by_rule(checks_for(build(table, "tax")[0]), "indirect_tax_heads")[0].result == "pass_within_rounding"
    (table,) = load_tables(write_doc([docling_table(tax_rows(sales=37))]))
    checks = checks_for(build(table, "tax")[0])
    assert by_rule(checks, "indirect_tax_heads")[0].result == "fail"


def test_older_layout_without_an_fbr_line_and_with_three_part_gross(write_doc):
    rows = [HEADER,
            row("", "Federal Consolidated Fund (5+6)", 150),
            row("B", "1 Tax Revenue Receipts", 100), row("", "Direct Taxes", 40), row("", "Indirect Taxes", 60),
            row("C", "2 Non-Tax Receipts", 20), row("C01", "Income from Property and Enterprise", 20),
            row("", "3 Total Revenue Receipts (1+2)", 120),
            row("E", "4 Capital Receipts", 10), row("E02", "Recovery of Loans and Advances", 10),
            row("", "5 Total Internal Receipts (3+4)", 130),
            row("E033", "6 External Receipts", 20), row("", "Loans", 15), row("", "Grants", 5),
            row("G03", "7 Public Accounts Receipts (Net)", 7), row("", "Deferred Liabilities (Net)", 7),
            row("", "8 Gross Federal Resources (5+6+7)", 157),
            row("", "9 Less Provincial Share in Federal Taxes", 57),
            row("", "10 Net Federal Resources (8-9)", 100),
            row("", "11 Cash Balance built up by the Provinces", 5), row("", "13 Credit from Banking Sector", 5),
            row("", "14 Total-Resources (10+11+12+13)", 110)]
    (table,) = load_tables(write_doc([docling_table(rows)]))
    cells, info = build(table, "summary")
    assert info["unmapped_labels"] == [] and info["labels_outside_their_block"] == []
    checks = checks_for(cells)
    rules = {k.rule_id.split(".")[1] for k in checks}
    assert {"tax_is_direct_plus_indirect", "gross_resources_three_parts", "consolidated_fund", "external_heads"} <= rules
    assert "gross_resources" not in rules and "tax_is_fbr_plus_other" not in rules
    assert all(k.result == "pass" for k in checks)


def test_flagged_table_gets_not_evaluable_never_pass(write_doc):
    (table,) = load_tables(write_doc([docling_table(tax_rows())]))
    low = {"coverage": 0.5, "coverage_row_band": 0.5, "printed_numeric_tokens": 10, "matched": 5}
    cells, info = build(table, "tax", coverage=low)
    assert "low_coverage" in info["table_flags"]
    checks = checks_for(cells, blocked={("abs-test-2025-26", 1, 0): "the table on p.1 is flagged low_coverage"})
    assert checks and all(k.result == "not_evaluable" for k in checks)


# ------------------------------------------------------------------ the same figure printed twice

def agreement(cells_by_kind, sources):
    titles = {s.source_id: s.title for s in sources}
    order = {s.source_id: s.period for s in sources}
    return ar.agreement_checks(cells_by_kind, SPEC, TABLE_NAMES, titles, order, NAMES)


def test_a_line_printed_in_both_tables_must_agree(write_doc):
    tables = load_tables(write_doc([docling_table(summary_rows(), page=1), docling_table(tax_rows(), page=2)], pages=2))
    src = source()
    summary, tax = build(tables[0], "summary", src=src)[0], build(tables[1], "tax", src=src)[0]
    checks = agreement({"summary": summary, "tax": tax}, [src])
    assert {k.check_type for k in checks} == {"cross_table"} and all(k.result == "pass" for k in checks)
    assert len(checks) == 4 * 3                                # tax, FBR, direct, indirect in three columns
    tables = load_tables(write_doc([docling_table(summary_rows(), page=1), docling_table(tax_rows(direct=45, indirect=55), page=2)], pages=2))
    tax = build(tables[1], "tax", src=src)[0]
    checks = agreement({"summary": summary, "tax": tax}, [src])
    assert sorted(k.result for k in checks).count("fail") == 2 * 3   # direct and indirect differ; tax and FBR still agree


def test_next_edition_is_compared_like_with_like_and_only_on_the_shared_column(write_doc):
    a, b = source("2024-25"), source("2025-26")
    (t,) = load_tables(write_doc([docling_table(tax_rows())]))
    first, second = build(t, "tax", src=a)[0], build(t, "tax", src=b)[0]
    checks = agreement({"summary": [], "tax": first + second}, [a, b])
    assert {k.check_type for k in checks} == {"cross_edition"} and all(k.result == "pass" for k in checks)
    mapped_rows = 11
    assert len(checks) == mapped_rows                           # one pair per line: BE 2024-25 is the only shared column
    (t2,) = load_tables(write_doc([docling_table(tax_rows(sales=30, indirect=55))]))
    second = build(t2, "tax", src=b)[0]
    failed = [k for k in agreement({"summary": [], "tax": first + second}, [a, b]) if k.result == "fail"]
    assert {k.expected for k in failed} == {"35", "60", "100"} and {k.observed for k in failed} == {"30", "55", "95"}


def test_a_flagged_table_takes_no_part_in_agreement(write_doc):
    a, b = source("2024-25"), source("2025-26")
    (t,) = load_tables(write_doc([docling_table(tax_rows())]))
    low = {"coverage": 0.5, "coverage_row_band": 0.5, "printed_numeric_tokens": 10, "matched": 5}
    first, second = build(t, "tax", src=a)[0], build(t, "tax", src=b, coverage=low)[0]
    assert agreement({"summary": [], "tax": first + second}, [a, b]) == []


# ------------------------------------------------------------------ gaps

def test_sales_tax_is_mapped_or_a_named_gap_with_its_reason(write_doc):
    src = source()
    titles = {src.source_id: src.title}
    (good,) = load_tables(write_doc([docling_table(tax_rows())]))
    cells, info = build(good, "tax", src=src)
    watch = ar.watch_report([src], SPEC, {(src.source_id, "tax"): info}, {}, cells, titles)
    assert watch["fed.rev.tax.indirect.sales_tax"][src.source_id]["mapped"] is True
    assert ar.gap_observations([src], SPEC, {(src.source_id, "tax"): info}, {(src.source_id, "summary"): "x"}, cells, SERIES,
                               titles)[0].series_id.startswith("fed.rev.")   # only the summary lines are gaps

    # the row is not printed (every printed number captured, every row matched): the government did not print it
    (lost,) = load_tables(write_doc([docling_table(tax_rows(with_sales=False))]))
    cells, info = build(lost, "tax", src=src)
    entry = ar.watch_report([src], SPEC, {(src.source_id, "tax"): info}, {}, cells, titles)["fed.rev.tax.indirect.sales_tax"]
    assert entry[src.source_id]["mapped"] is False and entry[src.source_id]["gap_kind"] == "not_in_source"
    gaps = [g for g in ar.gap_observations([src], SPEC, {(src.source_id, "tax"): info}, {}, cells, SERIES, titles)
            if g.series_id == "fed.rev.tax.indirect.sales_tax"]
    assert len(gaps) == 3 and all(not g.published and g.value is None and g.gap_kind == "not_in_source" for g in gaps)

    # a row that could not be matched: we cannot say the line is not printed
    rows = tax_rows(with_sales=False)
    rows.insert(10, row("B023", "Sa1es Tax", 35))
    (odd,) = load_tables(write_doc([docling_table(rows)]))
    cells, info = build(odd, "tax", src=src)
    entry = ar.watch_report([src], SPEC, {(src.source_id, "tax"): info}, {}, cells, titles)["fed.rev.tax.indirect.sales_tax"]
    assert entry[src.source_id]["gap_kind"] == "not_yet_verified" and "could not be matched" in entry[src.source_id]["reason"]

    # the table was not located at all
    entry = ar.watch_report([src], SPEC, {}, {(src.source_id, "tax"): "The Statement of Tax Revenue could not be located (tie)"},
                            [], titles)["fed.rev.tax.indirect.sales_tax"]
    assert entry[src.source_id]["gap_kind"] == "not_yet_verified" and "could not be located (tie)" in entry[src.source_id]["reason"]
    gaps = ar.gap_observations([src], SPEC, {}, {(src.source_id, "tax"): "nope", (src.source_id, "summary"): "nope"}, [], SERIES, titles)
    assert len(gaps) == 3 * (len(TSPEC["tax"]["expected"]) + len(TSPEC["summary"]["expected"]))


def test_pass_rates_count_receipts_checks_only(write_doc):
    (table,) = load_tables(write_doc([docling_table(tax_rows())]))
    checks = checks_for(build(table, "tax")[0])
    foreign = checks[0].model_copy(update={"rule_id": "abs.something_else", "result": "fail"})
    rates = ar.pass_rates(checks + [foreign])
    assert rates["sums"]["fail"] == 0 and rates["sums"]["evaluable"] == len(checks) and rates["cross_edition"]["evaluable"] == 0
