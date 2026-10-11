"""ABS function-wise detail tables (D31): labels, structure, checks. Synthetic inputs only, no source files."""
import yaml

from conftest import docling_table, make_cell
from datalab import config
from datalab.datasets import abs_detail as ad
from datalab.schema import RunManifest, Source
from datalab.tables import load_tables

SPEC = yaml.safe_load((config.SPECS_DIR / "abs_detail.yaml").read_text(encoding="utf-8"))
LABELS_SPEC = yaml.safe_load((config.SPECS_DIR / "abs_detail_labels.yaml").read_text(encoding="utf-8"))
ABS_SPEC = yaml.safe_load((config.SPECS_DIR / "abs.yaml").read_text(encoding="utf-8"))
LABELS = ad.DetailLabels(SPEC, LABELS_SPEC)
HEADER = ["Function Code", "Description", "Budget Estimates 2024-25", "Revised Estimates 2024-25", "Budget Estimates 2025-26"]
COLUMNS = {2: ("2024-25", "be", "Budget Estimates 2024-25"), 3: ("2024-25", "re", "Revised Estimates 2024-25"),
           4: ("2025-26", "be", "Budget Estimates 2025-26")}
SCALE_WORDS = [(0.8, 0.01, 0.82, 0.02, "(Rs"), (0.83, 0.01, 0.84, 0.02, "in"), (0.85, 0.01, 0.9, 0.02, "million)")]
FULL = {"coverage": 1.0, "coverage_row_band": 1.0, "printed_numeric_tokens": 10, "matched": 10}


def row(code, name, a, b=None, c=None):
    return [code, name, str(a), str(b if b is not None else a), str(c if c is not None else a)]


def current_revenue_page():
    return [HEADER,
            row("07", "Health", 30),
            row("073", "Hospital Services", 10), row("074", "Public Health Services", 15), row("076", "Health Administration", 5),
            row("10", "Social Protection", 9),
            row("107", "Administration", 4), row("108", "Others", 5),
            row("", "a. Current Expenditure on Revenue Account", 39)]


def development_page():
    return [HEADER,
            row("07", "Health", 8),
            row("073", "Hospital Services", 3), row("074", "Public Health Services", 5),
            row("09", "Education Affairs and Services", 6),
            row("093", "Tertiary Edu. Affairs & Services", 6),
            row("", "c. Dev. Exp. on Revenue Account", 14)]


def source(period="2025-26"):
    return Source.model_construct(source_id=f"abs-test-{period}", doc_type="abs", title=f"ABS {period}", period=period)


RUN = RunManifest.model_construct(run_id="TEST__run-01", tool_versions={"docling": "test"}, config_sha256="0" * 64)


def build(tables, *, coverage=None, columns=COLUMNS, problems=(), words=SCALE_WORDS, src=None):
    return ad.build_source(
        source=src or source(), run=RUN, tables=tables, spec=SPEC, abs_spec=ABS_SPEC, labels=LABELS,
        words_for=lambda t: words, coverage_for=lambda t: (coverage or {}).get(t.page, FULL),
        map_columns=lambda table, cols, w, edition, spec: (dict(columns), list(problems)))


def checks_for(got, src_id="abs-test-2025-26"):
    return ad.structure_checks(src_id, got["structure"], got["blocked"], SPEC, LABELS, lambda c: f"column {c.period} {c.vintage}")


# ------------------------------------------------------------------ labels

def test_a_row_needs_both_its_code_and_its_whole_name():
    assert LABELS.resolve("07 Health") == ad.Resolved("function", code="07", slug="health")
    assert LABELS.resolve("073 Hospital Services").slug == "hospital_services"
    # the same word under two codes is two different lines
    assert LABELS.resolve("096 Administration").slug == "education_administration"
    assert LABELS.resolve("107 Administration").slug == "social_protection_administration"
    # code 011 carries three different lines; the name decides
    assert LABELS.resolve("011 Foreign Loan Repayment").slug == "foreign_loans_repayment"
    assert LABELS.resolve("011 Executive & Legislative Organs, Financial & Fiscal Affairs, External Affairs").slug.startswith("executive")
    # wrong code for the name, a cut label, a scrambled label: recognised as coded but unknown
    for label in ("031 Police", "011 Executive & Legislative Organs,", "097 Elsewhere Classified Education Affairs & Services not",
                  "48 Economic Affairs", "83 Broadcasting and Publishing", "062 063 Community Development Water Supply"):
        assert LABELS.resolve(label).kind == "unknown_code", label
    # a two-digit "19" line is not assumed to be sub-function 019 (a sum check contradicted that reading)
    assert LABELS.resolve("19 Gen. Public Services not elsewhere defined").kind == "unknown_code"
    # rows below sub-function level are not recognised at all
    assert LABELS.resolve("Servicing of Foreign Debt") is None and LABELS.resolve("A01 Employees Related Expenses") is None


def test_total_lines_close_the_right_part():
    assert LABELS.resolve("a.Current Expenditure on Revenue Account").part == "current_revenue"
    assert LABELS.resolve("b. Current Expenditure on Capital Account").part == "current_capital"
    assert LABELS.resolve("c. Dev. Exp. on Revenue Account").part == "development_revenue"
    assert LABELS.resolve("i. Dev. Exp. on Revenue Account (PSDP)").part == "development_revenue_psdp"
    assert LABELS.resolve("d. Dev. Expenditure on Capital Account").part == "development_capital"
    assert LABELS.resolve("i. Dev. Expenditure on Capital Account (PSDP)").part == "development_capital_psdp"
    # "(i+ii)" is the sum of two parts: a total to compare with the summary, never the closer of function lines
    got = LABELS.resolve("c. Dev. Exp. on Revenue Account (i+ii)")
    assert got.kind == "total" and got.series == "fed.exp.development.revenue_account"
    assert LABELS.resolve("II.Total Development Expenditure (c+d)").series == "fed.exp.development.total"
    # the line after which some editions print the operational shortfall is deliberately not mapped
    assert LABELS.resolve("III.Total Exp. (Current+Development)") is None


def test_no_development_or_total_by_function_series_is_ever_constructed():
    ids = {s.series_id for s in ad.series_catalogue(SPEC, LABELS_SPEC, ABS_SPEC, set())}
    assert "fed.exp.development.revenue_account.function.health" in ids
    assert "fed.exp.development.revenue_account.psdp.function.health" in ids
    assert not any(i.startswith(("fed.exp.development.function.", "fed.exp.total.function.")) for i in ids)
    # function lines of the first part reuse the ids already published from the summary table
    assert "fed.exp.current.function.health" in ids and "fed.exp.current.function.health.hospital_services" in ids


# ------------------------------------------------------------------ locating and structure

def test_the_run_of_detail_tables_starts_after_the_summary_and_stops_at_the_first_other_table(write_doc):
    summary = docling_table([HEADER, row("07", "Health", 30), row("10", "Social Protection", 9)], page=1)
    other = docling_table([HEADER, row("A101", "Domestic Permanent Debt", 5), row("A104", "Floating Debt", 6)], page=4)
    late = docling_table(development_page(), page=5)
    tables = load_tables(write_doc([summary, docling_table(current_revenue_page(), page=2), docling_table(development_page(), page=3),
                                    other, late], pages=5))
    run = ad.locate_detail(tables, tables[0], LABELS, SPEC["locator"]["min_recognised_rows"])
    assert [t.page for t in run] == [2, 3]


def test_function_blocks_go_to_the_part_whose_total_line_follows(write_doc):
    tables = load_tables(write_doc([docling_table(current_revenue_page(), page=1), docling_table(development_page(), page=2)], pages=2))
    got = build(tables)
    parts = {p.part_id: p for p in got["structure"].parts}
    assert list(parts) == ["current_revenue", "development_revenue"]
    by_series = {(c.series_id, c.period, c.vintage): c.value_parsed for c in got["cells"] if c.series_id}
    assert by_series[("fed.exp.current.function.health", "2025-26", "be")] == "30"
    assert by_series[("fed.exp.development.revenue_account.function.health", "2025-26", "be")] == "8"
    assert by_series[("fed.exp.development.revenue_account.function.health.hospital_services", "2024-25", "re")] == "3"
    assert by_series[("fed.exp.current.revenue_account", "2024-25", "be")] == "39"
    # only two of the four parts were closed, so this edition does not count as located
    assert got["located"] is False and len(got["parts_missing"]) == 2
    checks = checks_for(got)
    assert {c.result for c in checks} == {"pass"}
    assert sorted((c.check_type, c.rule_id) for c in checks).count(("column_total", "abs_detail.functions_add_to_part_total")) == 6
    assert sum(1 for c in checks if c.check_type == "hierarchy_sum") == 12


def test_a_wrong_amount_fails_its_sum_and_nothing_else(write_doc):
    page = current_revenue_page()
    page[2] = row("073", "Hospital Services", 10, 10, 20)          # Budget 2025-26 no longer adds up
    got = build(load_tables(write_doc([docling_table(page)])))
    failed = [c for c in checks_for(got) if c.result == "fail"]
    assert len(failed) == 1 and failed[0].check_type == "hierarchy_sum" and failed[0].residual == "10"


def test_a_missed_total_line_never_moves_functions_into_the_next_part(write_doc):
    current = current_revenue_page()[:-1]                           # the "a." line was lost
    tables = load_tables(write_doc([docling_table(current, page=1), docling_table(development_page(), page=2)], pages=2))
    got = build(tables)
    assert [p.part_id for p in got["structure"].parts] == ["development_revenue"]
    assert len(got["structure"].unassigned) == 2                    # Health and Social Protection of the first page
    mapped = {c.series_id for c in got["cells"] if c.series_id}
    assert not any(s.startswith("fed.exp.current.") for s in mapped)
    assert len(got["structure"].parts[0].blocks) == 2               # only the development page's own functions


def test_a_total_line_printed_twice_closes_nothing(write_doc):
    # ABS 2012-13 p.19: "d. Dev. Expenditure on Capital Account" is printed after the PSDP function lines
    # and again, with another amount, after the "Other" lines. Taking the first as the part total would
    # publish PSDP-only function lines as all development expenditure on capital account.
    page = [HEADER,
            row("04", "Economic Affairs", 20),
            row("045", "Construction and Transport", 20),
            row("", "d. Dev. Expenditure on Capital Account", 20),
            row("014", "Transfers", 5),
            row("", "d. Dev. Expenditure on Capital Account", 25)]
    got = build(load_tables(write_doc([docling_table(current_revenue_page(), page=1), docling_table(page, page=2)], pages=2)))
    assert got["parts_closed"] == ["current_revenue"]
    assert any("printed twice" in u for u in got["structure"].unassigned)
    assert any("printed twice" in n for n in got["structure"].notes)
    mapped = {c.series_id for c in got["cells"] if c.series_id}
    assert not any("development.capital_account" in s for s in mapped)
    assert all(c.series_id is None for c in got["cells"] if c.row_label_raw.startswith(("04", "045", "d.")))


def test_unknown_or_misplaced_coded_rows_make_sums_not_evaluable(write_doc):
    page = current_revenue_page()
    page.insert(4, row("075", "Some New Health Line", 0))           # a sub-function the dictionary does not know
    got = build(load_tables(write_doc([docling_table(page)])))
    health = [c for c in checks_for(got) if c.check_type == "hierarchy_sum" and "Health" in c.description]
    assert health and {c.result for c in health} == {"not_evaluable"}
    # a sub-function printed under the wrong function: its function line was probably lost
    page = current_revenue_page()
    del page[5]                                                     # the "10 Social Protection" line
    got = build(load_tables(write_doc([docling_table(page)])))
    totals = [c for c in checks_for(got) if c.check_type == "column_total"]
    assert totals and {c.result for c in totals} == {"not_evaluable"}
    assert not any((c.series_id or "").endswith("social_protection_administration") for c in got["cells"])


def test_flagged_or_unmapped_tables_block_everything_that_touches_them(write_doc):
    tables = load_tables(write_doc([docling_table(current_revenue_page())]))
    low = build(tables, coverage={1: {**FULL, "coverage": 0.85}})
    assert "low_coverage" in low["tables"][0]["table_flags"]
    assert {c.result for c in checks_for(low)} == {"not_evaluable"}
    # column meaning not confirmed from the text layer: nothing from the table is mapped
    unmapped = build(tables, problems=["columns differ from the expected"])
    assert not any(c.series_id for c in unmapped["cells"]) and checks_for(unmapped) == []
    # the page does not say "(Rs in million)": nothing is mapped either
    no_scale = build(tables, words=[])
    assert not any(c.series_id for c in no_scale["cells"])


def test_a_label_wrapped_over_two_rows_is_joined_and_must_then_match_in_full(write_doc):
    page = [HEADER, row("09", "Education Affairs and Services", 7), row("093", "Tertiary Edu. Affairs & Services", 5),
            ["097", "Education Affairs & Services not", "", "", ""], row("", "Elsewhere Classified", 2),
            row("", "c. Dev. Exp. on Revenue Account", 7)]
    got = build(load_tables(write_doc([docling_table(page)])))
    joined = [c for c in got["cells"] if "row_label_joined_from_two_rows" in c.structural_flags]
    assert len(joined) == 3 and joined[0].series_id.endswith("education_not_elsewhere_classified")
    assert {c.result for c in checks_for(got)} == {"pass"}


def test_a_first_data_row_flagged_as_header_is_still_read(write_doc):
    table = docling_table(current_revenue_page(), header_rows=2)    # Docling marked "07 Health" as a header row
    got = build(load_tables(write_doc([table])))
    assert any(c.series_id == "fed.exp.current.function.health" for c in got["cells"])
    assert {c.result for c in checks_for(got)} == {"pass"}


# ------------------------------------------------------------------ agreement with the summary and the next edition

def test_detail_lines_are_compared_with_the_summary_and_with_the_next_edition(write_doc):
    this = build(load_tables(write_doc([docling_table(current_revenue_page())])))
    nxt_page = [[*HEADER[:2], "Budget Estimates 2025-26", "Revised Estimates 2025-26", "Budget Estimates 2026-27"],
                row("07", "Health", 30, 33, 36), row("073", "Hospital Services", 10, 12, 14),
                row("074", "Public Health Services", 15, 16, 17), row("076", "Health Administration", 9, 5, 5),
                row("", "a. Current Expenditure on Revenue Account", 30, 33, 36)]
    nxt_cols = {2: ("2025-26", "be", "Budget Estimates 2025-26"), 3: ("2025-26", "re", "Revised Estimates 2025-26"),
                4: ("2026-27", "be", "Budget Estimates 2026-27")}
    nxt = build(load_tables(write_doc([docling_table(nxt_page)])), columns=nxt_cols, src=source("2026-27"))
    summary = [make_cell("abs-test-2025-26", 7, 4, "30", "30", series="fed.exp.current.function.health", label="Health", page=9),
               make_cell("abs-test-2025-26", 1, 4, "50", "50", series="fed.exp.current.revenue_account", label="a. Current Exp.", page=9)]
    titles = {"abs-test-2025-26": "ABS 2025-26", "abs-test-2026-27": "ABS 2026-27"}
    order = {"abs-test-2025-26": "2025-26", "abs-test-2026-27": "2026-27"}
    checks = ad.agreement_checks(summary, this["cells"] + nxt["cells"], SPEC, titles, order, {})
    cross_table = {c.description.split(",")[0]: c.result for c in checks if c.check_type == "cross_table"}
    assert cross_table == {"fed.exp.current.function.health": "pass", "fed.exp.current.revenue_account": "fail"}
    cross_edition = [c for c in checks if c.check_type == "cross_edition"]
    # three sub-functions are printed for Budget 2025-26 in both editions; one was restated (5 -> 9)
    assert sorted(c.result for c in cross_edition) == ["fail", "pass", "pass"]
    assert all(len(c.source_ids) == 2 for c in cross_edition)
    # lines the summary also prints get no second cross-edition check here
    assert not any("fed.exp.current.function.health," in c.description for c in cross_edition)


def test_cells_from_a_flagged_table_take_no_part_in_agreement_checks(write_doc):
    got = build(load_tables(write_doc([docling_table(current_revenue_page())])), coverage={1: {**FULL, "coverage": 0.5}})
    summary = [make_cell("abs-test-2025-26", 7, 4, "30", "30", series="fed.exp.current.function.health", page=9)]
    assert ad.agreement_checks(summary, got["cells"], SPEC, {}, {}, {}) == []


def test_a_detail_figure_with_a_failed_check_is_withheld_even_if_another_check_passed():
    from datalab.checks import equality_check, sum_check
    from datalab.status import build_observations
    from datalab.schema import Series

    def series(sid):
        return Series(series_id=sid, name=sid, dataset="abs", frequency="fiscal_year", unit="PKR", scale_factor=1000000)

    fn, sub, sub2 = "fed.exp.development.revenue_account.function.health", "x.hospital", "x.public"
    a_fn = make_cell("abs-a", 1, 4, "30", "30", series=fn, page=5)
    a_sub = make_cell("abs-a", 2, 4, "10", "10", series=sub, page=5)
    a_sub2 = make_cell("abs-a", 3, 4, "15", "15", series=sub2, page=5)
    b_sub = make_cell("abs-b", 2, 2, "10", "10", series=sub, page=5)
    checks = [sum_check(check_type="hierarchy_sum", dataset="abs", rule_id="r", target=a_fn, members=[(a_sub, 1), (a_sub2, 1)],
                        what_members="m", what_target="t", column_label="c"),
              equality_check(check_type="cross_edition", dataset="abs", rule_id="e", first=a_sub, second=b_sub, what="w",
                             where_first="a", where_second="b")]
    assert [c.result for c in checks] == ["fail", "pass"]
    cells = [a_fn, a_sub, a_sub2, b_sub]
    obs = build_observations(cells, checks, {s: series(s) for s in (fn, sub, sub2)}, {"abs-a": "1", "abs-b": "2"}, {}, "v-test")
    by_id = {o.series_id: o for o in obs}
    # The rule this track introduced now lives in status.decide_tier for every data type.
    assert not by_id[sub].published and by_id[sub].value is None
    assert by_id[sub].gap_kind == "failed_checks" and by_id[sub].tier == "D"
    assert ad.withhold_where_a_check_failed(obs, checks, {c.cell_id for c in cells}) == 0      # nothing left for it to do
