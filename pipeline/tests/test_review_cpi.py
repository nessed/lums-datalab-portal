"""Adversarial review of the CPI builder (docs/reports/review_cpi.md).

Every test here FAILS on the code as reviewed and is marked `xfail(strict=True)`, so the suite stays
green while the defect is on record; once a finding is fixed its test passes, the strict xfail turns
red, and the marker must be removed. Inputs are synthetic (small Cells / Tables); no source file is read.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

import pytest

from datalab.datasets import cpi
from datalab.datasets.common import load_spec
from datalab.normalise import parse_printed
from datalab.schema import PASSING
from datalab.status import build_observations
from datalab.tables import Table, TCell, norm_bbox

from test_cpi import GROUPS, TITLES, make_table, run

SPEC = load_spec("cpi")
SBP_CFG = SPEC["checks"]["cross_source_sbp"]
WEIGHTS = ["34.58", "1.02", "8.60", "23.63", "4.10", "2.79", "5.91", "2.21", "1.59", "3.79", "6.92", "4.86"]
ROW = ("200.00", "198.00", "160.00", "1.01", "25.00")          # index t, t-1, t-12, MoM, YoY (consistent)


def observations(cells, checks, series, order):
    return {o.obs_id: o for o in build_observations(cells, checks, series, order, TITLES, "v0")}


def q2(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def distinct_table():
    """A table that is consistent as printed: 12 different group rows and the general row derived from them."""
    w = [Decimal(x) for x in WEIGHTS]
    cur = [Decimal(200 + 10 * i) for i in range(12)]
    prev = [c - 2 for c in cur]
    last = [Decimal(160 + 5 * i) for i in range(12)]

    def row(c: Decimal, p: Decimal, l: Decimal) -> tuple[str, str, str, str, str]:
        return (q2(c), q2(p), q2(l), q2((c / p - 1) * 100), q2((c / l - 1) * 100))

    def mean(xs: list[Decimal]) -> Decimal:
        return Decimal(q2(sum((a * b for a, b in zip(w, xs)), Decimal(0)) / 100))

    return row(mean(cur), mean(prev), mean(last)), [row(c, p, l) for c, p, l in zip(cur, prev, last)]


# ----------------------------------------------------------------------------- REVIEW-CPI-1

def test_review_cpi_1_misread_index_with_failed_recompute_is_not_published():
    # Alcoholic Bev. & Tobacco (weight 1.02): the previous-month index is read 5 points too low (198 -> 193).
    # The MoM recomputation fails ((200/193 - 1) x 100 = 3.63, printed 1.01). The aggregation check for that
    # month still passes: the error moves the weighted mean by 1.02 x 5 / 100 = 0.051, inside its 0.13 tolerance.
    rows = [ROW] * 12
    rows[GROUPS.index("alcohol_tobacco")] = ("200.00", "193.00", "160.00", "1.01", "25.00")
    cells, meta = make_table(group_rows=rows)
    checks, series, order = run(cells, meta)
    bad = next(c for c in cells if c.series_id == "cpi.national.group.alcohol_tobacco.b2015_16" and c.period == "2025-05")
    mine = {c.check_type: c.result for c in checks if bad.cell_id in {c.target_cell_id, *c.member_cell_ids}}
    assert mine == {"recompute": "fail", "index_aggregation": "pass_within_rounding"}     # the premise
    o = observations(cells, checks, series, order)["cpi.national.group.alcohol_tobacco.b2015_16:2025-05:na"]
    assert not o.published, f"193.00 published as tier {o.tier} although the only check able to see it failed"


def test_review_cpi_1_misread_general_index_is_not_published():
    cells, meta = make_table(general=("200.10", "198.00", "160.00", "1.01", "25.00"))    # printed 200.00
    checks, series, order = run(cells, meta)
    o = observations(cells, checks, series, order)["cpi.national.general.b2015_16:2025-06:na"]
    assert not o.published, f"{o.value} published as tier {o.tier} with two failed recompute checks"


# ----------------------------------------------------------------------------- REVIEW-CPI-2

def test_review_cpi_2_aggregation_alone_does_not_check_a_low_weight_group_index():
    # The YoY cell of the row is printed as "n.a.", so no recompute check covers the same-month-last-year
    # index. It is read as 152.00 (printed 160.00). 1.02 x 8 / 100 = 0.082 < tolerance 0.106: 'pass'.
    rows = [ROW] * 12
    rows[GROUPS.index("alcohol_tobacco")] = ("200.00", "198.00", "152.00", "1.01", "n.a.")
    cells, meta = make_table(group_rows=rows)
    checks, series, order = run(cells, meta)
    assert all(c.result in PASSING for c in checks)                                    # nothing notices
    o = observations(cells, checks, series, order)["cpi.national.group.alcohol_tobacco.b2015_16:2024-06:na"]
    assert not o.published, f"{o.value} published as tier {o.tier}; the one check on it tolerates +-10 index points"


# ----------------------------------------------------------------------------- REVIEW-CPI-3

def test_review_cpi_3_truncated_index_is_not_published():
    printed = ("271.10", "272.12", "264.33", "-0.37", "2.56")
    rows = [printed] * 12
    rows[GROUPS.index("health")] = ("271", "272.12", "264.33", "-0.37", "2.56")          # decimals lost in extraction
    cells, meta = make_table(general=printed, group_rows=rows)
    checks, series, order = run(cells, meta)
    o = observations(cells, checks, series, order)["cpi.national.group.health.b2015_16:2025-06:na"]
    assert not (o.published and o.value == "271"), (
        "an index printed as 271.10 is published as 271: MoM tolerance grew from 0.009 to 0.19, aggregation from 0.17 to 0.67")


# ----------------------------------------------------------------------------- REVIEW-CPI-4

def test_review_cpi_4_two_rows_with_swapped_labels_are_noticed():
    general, rows = distinct_table()
    cells, meta = make_table(general=general, group_rows=rows)
    checks, _, _ = run(cells, meta)
    assert all(c.result in PASSING for c in checks)                                    # the table as printed is consistent
    # Same page, but the Health and Transport labels are attached to each other's rows.
    h, t = GROUPS.index("health"), GROUPS.index("transport")
    weights, swapped = list(WEIGHTS), list(rows)
    weights[h], weights[t] = weights[t], weights[h]
    swapped[h], swapped[t] = swapped[t], swapped[h]
    cells, meta = make_table(general=general, group_rows=swapped, weights=weights)
    checks, series, order = run(cells, meta)
    obs = observations(cells, checks, series, order)
    health = obs["cpi.national.group.health.b2015_16:2025-06:na"]
    by_id = {c.cell_id: c for c in cells}
    assert by_id[health.primary_cell_id].value_raw == rows[t][0]                       # Transport's index under "Health"
    assert any(c.result not in PASSING for c in checks) or not health.published, (
        "every check passes and Transport's figures are published as Health (weight 5.91 instead of 2.79)")


# ----------------------------------------------------------------------------- REVIEW-CPI-5

def _named_table(page: int) -> Table:
    names = ["General", "Food & Non-alcoholic Bev.", "Alcoholic Bev. & Tobacco", "Clothing & Footwear",
             "Housing, Water, Electricity, Gas & Fuels", "Furnishing & Household Equipment Maintenance", "Health",
             "Transport", "Communication", "Recreation & Culture", "Education", "Restaurants & Hotels", "Miscellaneous"]
    return Table(doc_table_index=0, page=page, table_index=0, bbox=[0.1, 0.1, 0.9, 0.5], num_rows=len(names), num_cols=1,
                 cells=[TCell(row=r, col=0, row_span=1, col_span=1, text=n, bbox=None) for r, n in enumerate(names)],
                 page_size=(600.0, 800.0))


def test_review_cpi_5_one_table_is_never_located_for_two_areas():
    # The Urban caption is printed at the foot of the page that carries the National table
    # (its own table starts on the next page). Both areas are 'found' in the single table of page 8.
    table = _named_table(8)
    captions = cpi.find_captions(
        {8: "Table 1: Consumer Price Index (National) by Group of Commodities and Services (Base 2015-16) General ... "
            "Table 2: Consumer Price Index (Urban) by Group of Commodities and Services (Base 2015-16)"}, SPEC)
    found, problems, _ = cpi.locate([table], captions, {"areas": ["national", "urban"]}, SPEC)
    assert "urban" not in found or found["urban"][0] is not found["national"][0], (
        "the National table would be published a second time as cpi.urban.* (every internal check passes)")


# ----------------------------------------------------------------------------- REVIEW-CPI-6

def test_review_cpi_6_two_printings_that_differ_are_not_agreement():
    a_cells, a_meta = make_table("cpi-a", "2025-06")                                   # June 2025 = 200.00
    b_row = ("230.00", "228.00", "200.01", "0.88", "14.99")                            # June 2025 = 200.01 a year later
    b_cells, b_meta = make_table("cpi-b", "2026-06", general=b_row, group_rows=[b_row] * 12)
    checks, series, order = run(a_cells + b_cells, {**a_meta, **b_meta})
    assert all(c.result in PASSING for c in checks)
    o = observations(a_cells + b_cells, checks, series, order)["cpi.national.general.b2015_16:2025-06:na"]
    assert o.tier != "A" or o.notes, "200.00 is 'verified' (tier A) by a later issue that prints 200.01, and nothing says so"


# ----------------------------------------------------------------------------- REVIEW-CPI-7

def test_review_cpi_7_cells_of_a_blocked_table_earn_no_passing_check():
    a_cells, a_meta = make_table("cpi-a", "2025-06")
    for c in a_cells:
        c.structural_flags = ["merged_rows"]
    b_row = ("230.00", "228.00", "200.00", "0.88", "15.00")
    b_cells, b_meta = make_table("cpi-b", "2026-06", general=b_row, group_rows=[b_row] * 12)
    checks, series, order = run(a_cells + b_cells, {**a_meta, **b_meta},
                                blocked={("cpi-a", 8, 0): "the table is flagged merged_rows"})
    a_ids = {c.cell_id for c in a_cells}
    credited = [c for c in checks if c.result in PASSING and a_ids & {c.target_cell_id, *c.member_cell_ids}]
    assert not credited, f"{len(credited)} passing {credited[0].check_type} checks credit cells of the blocked table"


# ----------------------------------------------------------------------------- REVIEW-CPI-8

def test_review_cpi_8_two_copies_of_one_issue_are_not_cross_edition_evidence():
    a_cells, a_meta = make_table("cpi-a", "2025-06")
    b_cells, b_meta = make_table("cpi-b", "2025-06")                                   # same issue, second copy
    series = {s.series_id: s for s in cpi.series_catalogue(SPEC)}
    order = {"cpi-a": "2025-06", "cpi-b": "2025-06"}
    checks = cpi.run_checks(a_cells + b_cells, {**a_meta, **b_meta}, SPEC, TITLES, order, series, {})
    pairs = [c for c in checks if c.check_type == "cross_edition"]
    assert not pairs, f"{len(pairs)} cross_edition checks compare an issue with a copy of itself"


# ----------------------------------------------------------------------------- REVIEW-CPI-9

@pytest.mark.xfail(strict=True, reason="REVIEW-CPI-9: the SBP rounding unit is inferred from the CSV text; '25' (25.0 with the "
                                       "trailing zero dropped) is taken as a whole-number figure and the tolerance becomes 0.505")
def test_review_cpi_9_sbp_value_without_trailing_zero_keeps_one_decimal_tolerance():
    cells, _ = make_table(general=("200.00", "198.00", "160.51", "1.01", "24.60"))     # PBS YoY 24.60
    checks = cpi.cross_source_checks(cells, {"2025-06": "25"}, "sbp-easydata-cpi", SBP_CFG, TITLES)
    assert len(checks) == 1
    assert checks[0].result == "fail", f"PBS 24.60 vs SBP 25.0 is recorded as '{checks[0].result}' (0.4 points apart)"


# ----------------------------------------------------------------------------- REVIEW-CPI-10

SBP_HEAD = '"Dataset","Series Key","Series","Observation Date","Observation Value","Unit"\n'
SBP_ROW = '"Inflation Snapshot","TS_GP_PT_CPI_M.P00011516","CPI National -YoY","{date}","{value}","Percent"\n'


@pytest.mark.xfail(strict=True, reason="REVIEW-CPI-10: read_sbp_yoy keeps the first of two different values for one month and "
                                       "says nothing (setdefault)")
def test_review_cpi_10_sbp_csv_with_two_values_for_one_month_is_not_silently_resolved(tmp_path):
    path = tmp_path / "sbp.csv"
    path.write_text(SBP_HEAD + SBP_ROW.format(date="30-Jun-2025", value="3.2") + SBP_ROW.format(date="30-Jun-2025", value="4.1"),
                    encoding="utf-8")
    try:
        sbp = cpi.read_sbp_yoy(path, SBP_CFG)
    except ValueError:
        return                                   # refusing the file is a correct outcome
    assert "2025-06" not in sbp, f"one of two conflicting SBP figures was picked without a trace: {sbp}"


@pytest.mark.xfail(strict=True, reason="REVIEW-CPI-10: read_sbp_yoy swallows an unreadable date of the target series "
                                       "(`except ValueError: continue`) and carries on")
def test_review_cpi_10_sbp_row_with_unreadable_date_is_not_swallowed(tmp_path):
    path = tmp_path / "sbp.csv"
    path.write_text(SBP_HEAD + SBP_ROW.format(date="2025-06-30", value="3.2"), encoding="utf-8")
    with pytest.raises(ValueError):
        cpi.read_sbp_yoy(path, SBP_CFG)


# ----------------------------------------------------------------------------- REVIEW-CPI-11

def test_review_cpi_11_new_base_caption_without_area_is_not_assumed_national():
    caps = cpi.find_captions({11: "Table 4: Consumer Price Index by Group of Commodities and Services (Base 2015-16)"}, SPEC)
    assert all(c["area"] != "national" for c in caps), "area defaulted to national; the page does not say so"


# ----------------------------------------------------------------------------- REVIEW-CPI-12

@pytest.mark.parametrize("text,expected", [(".37", Decimal("0.37")), ("-.37", Decimal("-0.37"))])
def test_review_cpi_12_leading_dot_decimal_is_not_read_as_a_whole_number(text, expected):
    value = parse_printed(text).value
    assert value is None or value == expected, f"{text!r} parsed as {value}"


# ----------------------------------------------------------------------------- REVIEW-CPI-13

def test_review_cpi_13_bbox_without_origin_is_refused():
    with pytest.raises((KeyError, ValueError)):
        norm_bbox({"l": 60.0, "t": 700.0, "r": 540.0, "b": 300.0}, 600.0, 800.0)
