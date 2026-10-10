"""CPI builder: label map, column mapping, checks and tolerance bounds. Synthetic fixtures only."""
from __future__ import annotations

from decimal import Decimal

import pytest

from datalab.datasets import cpi
from datalab.datasets.common import LabelMap, load_spec
from datalab.schema import Cell, cell_id_for
from datalab.status import build_observations
from datalab.tables import load_tables

from conftest import PAGE_H, PAGE_W, docling_table

SPEC = load_spec("cpi")
LABELS = load_spec("cpi_labels")
GROUPS = [g["slug"] for g in SPEC["groups"]]
TITLES = {"cpi-a": "Monthly Review, June 2025", "cpi-b": "Monthly Review, June 2026"}


# ----------------------------------------------------------------------------- helpers

def cell(source: str, row: int, col: int, raw: str, *, series: str | None = None, period: str | None = None,
         unit: str = "index", label: str = "", struct: list[str] | None = None) -> Cell:
    from datalab.normalise import parse_printed

    p = parse_printed(raw)
    return Cell(
        cell_id=cell_id_for(source, 8, 0, row, col), source_id=source, page=8, table_index=0,
        table_bbox_norm=[0.1, 0.1, 0.9, 0.9], cell_bbox_norm=[0.5, 0.2, 0.6, 0.22], row_index=row, col_index=col,
        row_label_raw=label, col_label_raw="", value_raw=raw, value_parsed=p.value_str, is_missing=p.is_missing,
        missing_marker=p.missing_marker, structural_flags=struct or [], series_id=series, period=period,
        vintage="na" if series else None, mapping_method="dictionary" if series else "unmapped",
        extractor_name="docling", extractor_version="test", run_id="TEST__run-01", extract_config_sha256="0" * 64,
        unit=unit, scale_factor=1,
    )


def make_table(source: str = "cpi-a", issue: str = "2025-06", *, weights: list[str] | None = None,
               general: tuple[str, str, str, str, str] = ("200.00", "198.00", "160.00", "1.01", "25.00"),
               group_rows: list[tuple[str, str, str, str, str]] | None = None, area: str = "national"):
    """Cells + meta for one synthetic CPI table. Default: every group has the same index as the general row."""
    weights = weights or ["34.58", "1.02", "8.60", "23.63", "4.10", "2.79", "5.91", "2.21", "1.59", "3.79", "6.92", "4.86"]
    group_rows = group_rows or [general] * 12
    cells: list[Cell] = []
    meta: dict[str, dict] = {}
    prev, last = cpi.month_add(issue, -1), cpi.month_add(issue, -12)
    rows = [("general", "100.00", general)] + [(g, w, r) for g, w, r in zip(GROUPS, weights, group_rows)]
    for r, (key, weight, (cur, prv, lst, mom, yoy)) in enumerate(rows):
        for col, (role, period, raw) in enumerate([("weight", issue, weight), ("index", issue, cur), ("index", prev, prv),
                                                   ("index", last, lst), ("mom", issue, mom), ("yoy", issue, yoy)]):
            sid = cpi.series_id_for(area, role, key, "b2015_16")
            c = cell(source, r, col, raw, series=sid, period=period if sid else None,
                     unit="index" if role == "index" else "percent", label=key)
            cells.append(c)
            meta[c.cell_id] = {"source_id": source, "issue": issue, "area": area, "base_tag": "b2015_16",
                               "base_year": "2015-16", "row": key, "role": role, "period": period, "page": 8, "table_index": 0}
    return cells, meta


def checks_of(checks, kind):
    return [c for c in checks if c.check_type == kind]


# ----------------------------------------------------------------------------- periods and ids

def test_month_add_crosses_years():
    assert cpi.month_add("2025-06", -1) == "2025-05"
    assert cpi.month_add("2025-06", -12) == "2024-06"
    assert cpi.month_add("2025-01", -1) == "2024-12"
    assert cpi.month_add("2024-12", 1) == "2025-01"


def test_expected_base_follows_the_rebasing():
    assert cpi.rebase_side("2019-06", SPEC)["base_year"] == "2007-08"
    assert cpi.rebase_side("2019-08", SPEC)["base_year"] == "2015-16"
    assert cpi.rebase_side("2016-06", SPEC)["areas"] == ["national"]
    assert cpi.rebase_side("2025-06", SPEC)["areas"] == ["national", "urban", "rural"]


def test_series_ids_keep_bases_apart():
    assert cpi.series_id_for("national", "index", "general", "b2015_16") == "cpi.national.general.b2015_16"
    assert cpi.series_id_for("national", "index", "food", "b2007_08") == "cpi.national.group.food.b2007_08"
    assert cpi.series_id_for("urban", "weight", "health", "b2015_16") == "cpi.urban.weight.health.b2015_16"
    assert cpi.series_id_for("national", "yoy", "general", "b2015_16") == "cpi.national.yoy.general"
    assert cpi.series_id_for("national", "yoy", "food", "b2015_16") == "cpi.national.yoy.group.food"
    assert cpi.series_id_for("national", "weight", "general", "b2015_16") is None
    assert cpi.series_id_for("national", "impact_mom", "food", "b2015_16") is None


def test_catalogue_every_series_carries_the_rebase_break():
    catalogue = cpi.series_catalogue(SPEC)
    ids = {s.series_id for s in catalogue}
    assert len(ids) == len(catalogue)
    assert {"cpi.national.general.b2015_16", "cpi.national.general.b2007_08", "cpi.rural.group.food.b2015_16",
            "cpi.national.weight.food.b2007_08", "cpi.national.yoy.general"} <= ids
    assert "cpi.urban.general.b2007_08" not in ids
    for s in catalogue:
        assert s.dataset == "cpi" and s.frequency == "month" and s.scale_factor == 1
        assert [b.at_period for b in s.breaks] == ["2019-08"] and s.breaks[0].kind == "rebase"
        assert s.unit == ("index" if ".general.b" in s.series_id or ".group." in s.series_id and s.series_id[-8:-6] == "b2" else "percent")
    general = next(s for s in catalogue if s.series_id == "cpi.national.general.b2015_16")
    assert general.dims == {"area": "national", "group": "general", "measure": "index", "base_year": "2015-16"}


# ----------------------------------------------------------------------------- label map

@pytest.mark.parametrize("label,key", [
    ("General", "general"),
    ("1. Food & Non-alcoholic Bev.", "food"),
    ("Food & Non-alcoholic Beverages", "food"),
    ("Alcoholic Bev.& Tobacco", "alcohol_tobacco"),
    ("2. Alcoholic Bev. & Tobacco", "alcohol_tobacco"),
    ("3. Clothing & Footwear", "clothing_footwear"),
    ("4. Housing, Water, Electricity, Gas & Fuels", "housing_utilities"),
    ("Furnishing & Household Equipment Maintenance", "furnishing_household"),
    ("Furnishing & Household Equipment Maint.", "furnishing_household"),
    ("5. Furnishing & Household Equip. & Maintenance", "furnishing_household"),
    ("6. Health", "health"),
    ("10. Education", "education"),
    ("11. Restaurants & Hotels", "restaurants_hotels"),
    ("12. Miscellaneous", "miscellaneous"),
])
def test_label_map(label, key):
    assert LabelMap(LABELS["labels"]).lookup(label) == (key, "dictionary")


@pytest.mark.parametrize("label", ["Non-perishable Food Items", "Perishable Food Items", "Gas & Fuels",
                                   "Housing, Water, Electricity,", "Equipment Maintenance", "Core inflation", ""])
def test_label_map_leaves_sub_rows_and_fragments_unmapped(label):
    assert LabelMap(LABELS["labels"]).lookup(label)[0] is None


def test_every_group_has_exactly_one_label_and_slug():
    keys = [e["series"] for e in LABELS["labels"]]
    assert sorted(keys) == sorted(["general", *GROUPS])


# ----------------------------------------------------------------------------- captions

def test_captions_give_area_and_base():
    texts = {
        5: "Table 2 : Consumer Price Index by Group of Commodities and Services (Base 2007-08) No Group",
        8: "Table 1: Consumer Price Index   (National) by Group of Commodities and Services   (Base 2015-16)",
        9: "Table 2: Consumer Price Index  (Urban) by Group of Commodities and Services  (Base 2015-16)",
        12: "Table 5: Wholesale Price Index by Group of Commodities (Base 2015-16)",
    }
    caps = cpi.find_captions(texts, SPEC)
    assert [(c["page"], c["area"], c["base_year"]) for c in caps] == [(5, "national", "2007-08"), (8, "national", "2015-16"),
                                                                       (9, "urban", "2015-16")]


# ----------------------------------------------------------------------------- column mapping

ROWS = [["No", "Group", "Weight", "Indices", "", "", "Change", "", "Impact", ""],
        ["", "General", "100.00", "264.22", "263.60", "255.94", "0.23", "3.23", "0.23", "3.23"],
        ["1.", "Food & Non-alcoholic Bev.", "34.58", "271.10", "272.12", "264.33", "-0.37", "2.56", "-0.13", "0.91"],
        ["2.", "Health", "2.79", "250.00", "249.00", "240.00", "0.40", "4.17", "0.01", "0.11"]]
COL_X = [20.0, 40.0, 200.0, 250.0, 300.0, 350.0, 400.0, 450.0, 500.0, 550.0, 590.0]


def word(x: float, y: float, text: str, w: float = 22.0, h: float = 8.0):
    return ((x - w / 2) / PAGE_W, (y - h / 2) / PAGE_H, (x + w / 2) / PAGE_W, (y + h / 2) / PAGE_H, text)


def header_words(months: list[str | None], *, stacked: bool = False, groups: dict[str, float] | None = None):
    """Text-layer words for the header: spanning words on one line, month labels on the bottom line."""
    centres = [(COL_X[k] + COL_X[k + 1]) / 2 for k in range(2, 10)]
    groups = groups or {"Weight": centres[0], "Indices": centres[2], "Change": (centres[4] + centres[5]) / 2,
                        "Impact": (centres[6] + centres[7]) / 2}
    out = [word(x, 60.0, text, w=30.0) for text, x in groups.items()]
    out.append(word((centres[4] + centres[5]) / 2, 72.0, "June", w=18.0))   # "June 2025 Over" spanning line
    out.append(word((centres[4] + centres[5]) / 2 + 20, 72.0, "2025", w=18.0))
    for cx, label in zip(centres, months):
        if not label:
            continue
        month, year = label.split()
        if stacked:
            out += [word(cx, 96.0, month, w=20.0), word(cx, 106.0, year, w=20.0)]
        else:
            out += [word(cx - 9, 106.0, month, w=18.0), word(cx + 10, 106.0, year, w=12.0)]
    return out


@pytest.fixture
def table(write_doc):
    return load_tables(write_doc([docling_table(ROWS, page=1, top=110.0, col_x=COL_X)]))[0]


GOOD = [None, "June 25", "May 25", "June 24", "May 25", "June 24", "May 25", "June 24"]


def test_columns_mapped_from_header_positions(table):
    cols = table.value_columns()
    assert cols == [2, 3, 4, 5, 6, 7, 8, 9]
    mapping, problems = cpi.map_columns(table, cols, header_words(GOOD), "2025-06", SPEC)
    assert problems == []
    assert [(mapping[c]["role"], mapping[c]["period"]) for c in cols] == [
        ("weight", "2025-06"), ("index", "2025-06"), ("index", "2025-05"), ("index", "2024-06"),
        ("mom", "2025-06"), ("yoy", "2025-06"), ("impact_mom", "2025-06"), ("impact_yoy", "2025-06")]
    # the spanning "June 2025 Over" line above is not mistaken for a column's own month
    assert mapping[6]["month_printed"] == "May 25"


def test_columns_mapped_when_month_and_year_are_stacked(table):
    months = [None, "June 2016", "May 2016", "June 2015", "May 2016", "June 2015", "May 2016", "June 2015"]
    mapping, problems = cpi.map_columns(table, table.value_columns(), header_words(months, stacked=True), "2016-06", SPEC)
    assert problems == []
    assert mapping[5]["period"] == "2015-06" and mapping[3]["period"] == "2016-06"


def test_columns_unmapped_when_header_month_is_not_the_expected_one(table):
    # the issue is June 2025 but the page prints the columns of another month
    mapping, problems = cpi.map_columns(table, table.value_columns(), header_words(GOOD), "2026-06", SPEC)
    assert problems and any("expected" in p for p in problems)


def test_columns_unmapped_when_two_index_columns_are_swapped(table):
    swapped = [None, "June 25", "June 24", "May 25", "May 25", "June 24", "May 25", "June 24"]
    _, problems = cpi.map_columns(table, table.value_columns(), header_words(swapped), "2025-06", SPEC)
    assert len(problems) == 2


def test_columns_unmapped_when_a_month_label_is_missing(table):
    missing = [None, "June 25", "May 25", None, "May 25", "June 24", "May 25", "June 24"]
    _, problems = cpi.map_columns(table, table.value_columns(), header_words(missing), "2025-06", SPEC)
    assert any("no month" in p for p in problems)


def test_columns_unmapped_when_a_spanning_header_sits_elsewhere(table):
    centres = [(COL_X[k] + COL_X[k + 1]) / 2 for k in range(2, 10)]
    groups = {"Weight": centres[0], "Indices": centres[5], "Change": centres[2], "Impact": centres[6]}
    _, problems = cpi.map_columns(table, table.value_columns(), header_words(GOOD, groups=groups), "2025-06", SPEC)
    assert any("does not sit above" in p for p in problems)


def test_columns_unmapped_when_a_column_is_missing(write_doc):
    rows = [r[:9] for r in ROWS]
    t = load_tables(write_doc([docling_table(rows, page=1, top=110.0, col_x=COL_X[:10])]))[0]
    mapping, problems = cpi.map_columns(t, t.value_columns(), header_words(GOOD), "2025-06", SPEC)
    assert mapping == {} and "8 are expected" in problems[0]


def test_month_tokens_two_digit_and_four_digit_years():
    toks = cpi.month_tokens([word(100, 50, "June", w=18), word(122, 50, "25", w=12), word(300, 50, "Sept.", w=20),
                             word(300, 60, "2019", w=20), word(400, 50, "Over")])
    assert sorted(t["period"] for t in toks) == ["2019-09", "2025-06"]


# ----------------------------------------------------------------------------- tolerance bounds

def test_aggregation_tolerance_from_printed_precision():
    # 12 groups, index 200.00 each, weights adding to 100.00:
    # 0.005 x 100/100 + 12 x 0.005 x 200/100 + 0.005 = 0.13
    weights = ["34.58", "1.02", "8.60", "23.63", "4.10", "2.79", "5.91", "2.21", "1.59", "3.79", "6.92", "4.86"]
    assert sum(Decimal(w) for w in weights) == Decimal("100.00")
    assert cpi.aggregation_tolerance("200.00", ["200.00"] * 12, weights) == Decimal("0.130000")
    # one-decimal indices are ten times coarser in the index terms
    assert cpi.aggregation_tolerance("200.0", ["200.0"] * 12, weights) == Decimal("0.05") + Decimal("0.12") + Decimal("0.05")


def test_recompute_tolerance_from_printed_precision():
    # 0.5 x 0.01 + 100 x (0.005 + 0.005 x 200/160) / 160 = 0.005 + 0.00703125
    assert cpi.recompute_tolerance("25.00", "200.00", "160.00") == Decimal("0.012032")
    # a percentage printed to one decimal has a wider own-rounding term
    assert cpi.recompute_tolerance("25.0", "200.00", "160.00") == Decimal("0.057032")


# ----------------------------------------------------------------------------- checks

def run(cells, meta, blocked=None):
    series = {s.series_id: s for s in cpi.series_catalogue(SPEC)}
    order = {"cpi-a": "2025-06", "cpi-b": "2026-06"}
    return cpi.run_checks(cells, meta, SPEC, TITLES, order, series, blocked or {}), series, order


def test_consistent_table_passes_every_check():
    cells, meta = make_table()
    checks, series, order = run(cells, meta)
    assert len(checks_of(checks, "weights_sum")) == 1
    assert len(checks_of(checks, "index_aggregation")) == 3      # one per index column
    assert len(checks_of(checks, "recompute")) == 26             # YoY and MoM for 13 rows
    assert {c.result for c in checks} <= {"pass", "pass_within_rounding"}
    assert all(c.description for c in checks)
    obs = build_observations(cells, checks, series, order, TITLES, "v0")
    assert len(obs) == 13 * 5 + 12 and all(o.published and o.tier == "B" for o in obs)
    yoy = next(o for o in obs if o.obs_id == "cpi.national.yoy.general:2025-06:na")
    assert yoy.value == "25.00" and "recomputation" in yoy.evidence_summary


def test_weights_sum_fails_beyond_tolerance_and_passes_within():
    weights = ["34.58", "1.02", "8.60", "23.63", "4.10", "2.79", "5.91", "2.21", "1.59", "3.79", "6.92", "4.86"]
    near = list(weights); near[0] = "34.62"       # sum 100.04: within 0.05
    far = list(weights); far[0] = "34.68"         # sum 100.10: fails
    for w, expected in ((near, "pass_within_rounding"), (far, "fail")):
        cells, meta = make_table(weights=w)
        checks, _, _ = run(cells, meta)
        assert checks_of(checks, "weights_sum")[0].result == expected


def test_weights_sum_not_evaluable_when_a_group_is_missing():
    cells, meta = make_table()
    gone = {cid for cid, m in meta.items() if m["row"] == "health" and m["role"] == "weight"}
    meta = {k: v for k, v in meta.items() if k not in gone}
    checks, _, _ = run(cells, meta)
    ws = checks_of(checks, "weights_sum")[0]
    assert ws.result == "not_evaluable" and "health" in ws.not_evaluable_reason
    assert all(c.result == "not_evaluable" for c in checks_of(checks, "index_aggregation"))


def test_index_aggregation_fails_when_one_group_index_is_misread():
    rows = [("200.00", "198.00", "160.00", "1.01", "25.00")] * 12
    rows[0] = ("210.00", "198.00", "160.00", "6.06", "31.25")      # food (weight 34.58) read 10 points too high
    cells, meta = make_table(group_rows=rows)
    checks, _, _ = run(cells, meta)
    by_result = sorted(c.result for c in checks_of(checks, "index_aggregation"))
    assert by_result == ["fail", "pass", "pass"]
    failed = next(c for c in checks_of(checks, "index_aggregation") if c.result == "fail")
    assert Decimal(failed.residual) == Decimal("3.458") and "fails" in failed.description


def test_index_aggregation_within_bound_passes_and_just_outside_fails():
    # all groups 200.00 -> weighted mean exactly 200; tolerance is 0.13 (see the tolerance test)
    for general, expected in (("200.13", "pass_within_rounding"), ("200.14", "fail")):
        cells, meta = make_table(general=(general, "198.00", "160.00", "1.01", "25.00"),
                                 group_rows=[("200.00", "198.00", "160.00", "1.01", "25.00")] * 12)
        checks, _, _ = run(cells, meta)
        target = next(c for c in cells if c.series_id == "cpi.national.general.b2015_16" and c.period == "2025-06")
        current = [c for c in checks_of(checks, "index_aggregation") if c.target_cell_id == target.cell_id]
        assert len(current) == 1 and current[0].result == expected


def test_recompute_catches_a_wrong_percentage_and_a_wrong_index():
    cells, meta = make_table(general=("200.00", "198.00", "160.00", "1.01", "25.20"))
    checks, _, _ = run(cells, meta)
    target = next(c for c in cells if c.series_id == "cpi.national.yoy.general")
    mine = [c for c in checks_of(checks, "recompute") if c.target_cell_id == target.cell_id]
    assert len(mine) == 1 and mine[0].result == "fail" and mine[0].rule_id == "cpi.yoy_recomputes_from_indices"
    mom = next(c for c in cells if c.series_id == "cpi.national.mom.general")
    assert next(c for c in checks_of(checks, "recompute") if c.target_cell_id == mom.cell_id).result == "pass_within_rounding"


def test_recompute_negative_change():
    cells, meta = make_table(general=("238.50", "226.59", "266.62", "5.26", "-10.55"),
                             group_rows=[("238.50", "226.59", "266.62", "5.26", "-10.55")] * 12)
    checks, _, _ = run(cells, meta)
    assert {c.result for c in checks_of(checks, "recompute")} == {"pass_within_rounding"}


def test_blocked_table_makes_every_check_not_evaluable():
    cells, meta = make_table()
    checks, _, _ = run(cells, meta, blocked={("cpi-a", 8, 0): "the table is flagged low_coverage"})
    assert checks and all(c.result == "not_evaluable" for c in checks)
    assert all("low_coverage" in c.not_evaluable_reason for c in checks)


def test_cross_edition_agreement_and_disagreement():
    a_cells, a_meta = make_table("cpi-a", "2025-06")
    # next year's issue prints June 2025 again in its "same month last year" column
    b_general = ("230.00", "228.00", "200.00", "0.88", "15.00")
    b_rows = [b_general] * 12
    b_rows[5] = ("230.00", "228.00", "200.07", "0.88", "14.96")     # health restated differently
    b_cells, b_meta = make_table("cpi-b", "2026-06", general=b_general, group_rows=b_rows)
    checks, series, order = run(a_cells + b_cells, {**a_meta, **b_meta})
    ce = checks_of(checks, "cross_edition")
    assert len(ce) == 13                                           # June 2025: general + 12 groups
    assert sorted(c.result for c in ce).count("fail") == 1
    failed = next(c for c in ce if c.result == "fail")
    assert "disagree" in failed.description and failed.residual == "0.07"
    obs = {o.obs_id: o for o in build_observations(a_cells + b_cells, checks, series, order, TITLES, "v0")}
    assert obs["cpi.national.general.b2015_16:2025-06:na"].tier == "A"
    assert obs["cpi.national.general.b2015_16:2025-06:na"].value == "200.00"      # the earliest printing is primary
    assert obs["cpi.national.general.b2015_16:2026-06:na"].tier == "B"


def test_cross_edition_never_pairs_different_bases_or_areas():
    a_cells, a_meta = make_table("cpi-a", "2025-06", area="national")
    b_cells, b_meta = make_table("cpi-b", "2026-06", area="urban")
    checks, _, _ = run(a_cells + b_cells, {**a_meta, **b_meta})
    assert checks_of(checks, "cross_edition") == []


# ----------------------------------------------------------------------------- cross-source (SBP EasyData)

SBP_CFG = SPEC["checks"]["cross_source_sbp"]


def test_read_sbp_csv_and_compare(tmp_path):
    path = tmp_path / "data_series.csv"
    path.write_text(
        '"Dataset","Series Key","Series","Observation Date","Observation Value","Unit","Observation Status","Observation Status Comment"\n'
        '"Inflation Snapshot","TS_GP_PT_CPI_M.P00011516","CPI National -YoY","30-Jun-2025","25","Percent","Normal",""\n'
        '"Inflation Snapshot","TS_GP_PT_CPI_M.P00011516","CPI National -YoY","31-May-2025","3.5","Percent","Normal",""\n'
        '"Inflation Snapshot","TS_OTHER","CPI Urban -YoY","30-Jun-2025","99.9","Percent","Normal",""\n', encoding="utf-8")
    sbp = cpi.read_sbp_yoy(path, SBP_CFG)
    assert sbp == {"2025-06": "25", "2025-05": "3.5"}

    cells, _ = make_table()
    checks = cpi.cross_source_checks(cells, {"2025-06": "25.0"}, "sbp-easydata-cpi", SBP_CFG, TITLES)
    assert len(checks) == 1 and checks[0].result == "pass" and checks[0].target_source == "sbp-easydata-cpi"
    # PBS 25.00 vs SBP 25.1: more than 0.05 + 0.005 apart
    bad = cpi.cross_source_checks(cells, {"2025-06": "25.1"}, "sbp-easydata-cpi", SBP_CFG, TITLES)
    assert bad[0].result == "fail" and "disagree" in bad[0].description
    # no SBP figure for the month: nothing is claimed
    assert cpi.cross_source_checks(cells, {"2024-06": "12.6"}, "sbp-easydata-cpi", SBP_CFG, TITLES) == []


def test_cross_source_rounding_and_status():
    cells, meta = make_table(general=("200.00", "198.00", "160.04", "1.01", "24.97"),
                             group_rows=[("200.00", "198.00", "160.04", "1.01", "24.97")] * 12)
    checks, series, order = run(cells, meta)
    sbp = cpi.cross_source_checks(cells, {"2025-06": "25.0"}, "sbp-easydata-cpi", SBP_CFG, TITLES)
    assert sbp[0].result == "pass_within_rounding"
    obs = {o.obs_id: o for o in build_observations(cells, checks + sbp, series, order, TITLES, "v0")}
    assert obs["cpi.national.yoy.general:2025-06:na"].tier == "A"


def test_cross_source_skips_old_base_months():
    cells, _ = make_table("cpi-a", "2019-06")
    assert cpi.cross_source_checks(cells, {"2019-06": "8.9"}, "sbp-easydata-cpi", SBP_CFG, TITLES) == []


# ----------------------------------------------------------------------------- gaps

def test_expected_observations_per_issue():
    new = cpi.expected_observations("2025-06", SPEC)
    old = cpi.expected_observations("2016-06", SPEC)
    assert len(new) == 3 * (13 * 5 + 12) and len(old) == 13 * 5 + 12
    assert ("national", "cpi.national.general.b2015_16", "2024-06") in new
    assert ("national", "cpi.national.general.b2007_08", "2015-06") in old
    assert not any(area != "national" for area, _, _ in old)


def test_gap_observations_are_labelled_not_yet_verified():
    class Src:
        source_id, period, title = "cpi-a", "2025-06", "Monthly Review, June 2025"

    series = {s.series_id: s for s in cpi.series_catalogue(SPEC)}
    cells, meta = make_table()
    checks, _, order = run(cells, meta)
    obs = build_observations(cells, checks, series, order, TITLES, "v0")
    gaps = cpi.gap_observations(SPEC, [Src], {"cpi-a:national": {"column_problems": [], "base_confirmed": True}},
                                {"cpi-a:urban": "The urban CPI table could not be located on page 9",
                                 "cpi-a:rural": "No validated extraction run exists"}, obs, series)
    assert len(gaps) == 2 * (13 * 5 + 12)
    assert all(g.gap_kind == "not_yet_verified" and not g.published and g.value is None and g.gap_reason for g in gaps)
    assert not {g.obs_id for g in gaps} & {o.obs_id for o in obs}


# ----------------------------------------------------------------------------- header-flagged data row

def test_general_row_marked_as_header_is_still_read(write_doc):
    # Docling marks the "General" row as a header row in some tables; "No" spans down from the header.
    t = load_tables(write_doc([docling_table(ROWS, page=1, top=110.0, header_rows=2, col_x=COL_X)]))[0]
    grid = t.grid()
    assert all(grid[1][k].column_header for k in t.value_columns())
    assert cpi.header_flagged_row_label(t, grid, 1, t.value_columns()) == "General"
    spanning = next(c for c in t.cells if c.row == 0 and c.col == 0)
    spanning.row_span = 2
    assert cpi.header_flagged_row_label(t, t.grid(), 1, t.value_columns()) == "General"
