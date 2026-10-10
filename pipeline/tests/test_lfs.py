"""LFS builder: label maps, column mapping, title classification and every check, on synthetic fixtures only."""
from __future__ import annotations

from decimal import Decimal

import pytest

from datalab.datasets import lfs
from datalab.datasets.common import LabelMap, load_spec
from datalab.schema import RunManifest
from datalab.status import build_observations

from conftest import make_cell

SPEC = load_spec("lfs")
LABELS = load_spec("lfs_labels")
TITLES = {"lfs-a": "LFS 2017-18 report", "lfs-b": "LFS 2018-19 report"}
ORDER = {"lfs-a": "2017-18", "lfs-b": "2018-19"}


def word(x: float, y: float, text: str, w: float = 0.04) -> tuple[float, float, float, float, str]:
    return (x - w / 2, y - 0.005, x + w / 2, y + 0.005, text)


def header(rounds: list[str], sexes: list[str], centres: list[float], augmented_at: float | None = None):
    """Header words: one round label centred over each group, one sex word over each column."""
    per = len(centres) // len(rounds)
    words = []
    for i, r in enumerate(rounds):
        group = centres[i * per:(i + 1) * per]
        words.append(word(sum(group) / len(group), 0.20, r))
    if augmented_at is not None:
        words.append(word(augmented_at, 0.21, "*Augmented"))
    words += [word(x, 0.22, s) for x, s in zip(centres, sexes)]
    return words


def cell(source, row, col, value, series, period, page=1):
    return make_cell(source, row, col, value, value, series=series, period=period, vintage="na", page=page)


# ---------------------------------------------------------------- titles

@pytest.mark.parametrize("caption,round_,kind", [
    ("table-21 unemployment rates - by area and sex (%) area/sex 2014-15 2017-18", "2017-18", "unemployment_rate"),
    ("table-23 unemployed - pakistan and provinces (million)", "2017-18", "unemployed"),
    ("table-12 employed - pakistan and provinces (million)", "2017-18", "employed"),
    ("table-8 crude activity (participation) rates - pakistan and provinces (%)", "2018-19", "lfpr_crude"),
    ("table 3.8 refined activity (participation) rates - pakistan and provinces", "2020-21", "lfpr_refined"),
    ("table 4.2 employed - distribution by major industry divisions (%)", "2020-21", "industry"),
    ("table 3.9 civilian labour force - pakistan and provinces (13th icls) labour force (millions)", "2024-25", "labour_force"),
    ("table 9.3 unemployment rate by province, region & sex (%) unemployment rate (13th icls)", "2024-25", "unemployment_rate"),
])
def test_title_names_one_kind(caption, round_, kind):
    got, result = lfs.classify(caption, round_, SPEC)
    assert result == "found" and got["kind"] == kind


@pytest.mark.parametrize("caption,round_,result", [
    ("", "2017-18", "no_title"),
    ("table-18 informal sector workers - distribution by major industry divisions", "2017-18", "not_a_target"),
    ("table-26 occupational injuries/diseases -distribution of employed persons by major industry divisions (%)", "2017-18", "not_a_target"),
    ("table 3.8 civilian labour force - pakistan and provinces (19th icls)", "2024-25", "other_definition"),
    ("table 9.2 unemployment rate by province, region & sex (%)", "2024-25", "definition_not_stated"),
])
def test_title_rejected(caption, round_, result):
    got, why = lfs.classify(caption, round_, SPEC)
    assert got is None and why == result


def test_caption_is_read_from_the_last_table_title_above_the_amounts(write_doc):
    from conftest import docling_table
    from datalab.tables import load_tables

    table = load_tables(write_doc([docling_table([["Area", "Total", "Male", "Female"], ["Pakistan", "5.8", "5.1", "8.3"]], top=400.0)]))[0]
    words = [word(0.3, 0.40, "See"), word(0.4, 0.40, "table-20."), word(0.2, 0.45, "Table-21"),
             word(0.4, 0.45, "UNEMPLOYMENT"), word(0.2, 0.47, "(%)"), word(0.5, 0.49, "2017-18")]
    caption, header_words = lfs.caption_and_header(table, table.value_columns(), words, 0.0)
    assert caption == "table-21 unemployment (%) 2017-18"
    assert [w[4] for w in header_words] == ["(%)", "2017-18"]
    # nothing is found when the zone starts below the title (a second table on the page)
    assert lfs.caption_and_header(table, table.value_columns(), words, 0.46) == ("", [])


# ---------------------------------------------------------------- columns

CENTRES6 = {k: 0.30 + 0.1 * i for i, k in enumerate(range(1, 7))}


def test_columns_two_rounds_by_sex():
    words = header(["2017-18", "2018-19"], ["Total", "Male", "Female"] * 2, list(CENTRES6.values()))
    mapping, problems = lfs.map_columns(CENTRES6, words, "2018-19", SPEC)
    assert problems == []
    assert mapping == {1: ("2017-18", "total"), 2: ("2017-18", "male"), 3: ("2017-18", "female"),
                       4: ("2018-19", "total"), 5: ("2018-19", "male"), 6: ("2018-19", "female")}


def test_columns_with_augmented_columns_left_unmapped():
    centres = {k: 0.20 + 0.07 * i for i, k in enumerate(range(1, 11))}
    xs = list(centres.values())
    sexes = ["Total", "Male", "Female", "Total", "Female"] * 2
    words = header(["2014-15", "2017-18"], sexes, xs) + [word((xs[3] + xs[4]) / 2, 0.21, "*Augmented"),
                                                         word((xs[8] + xs[9]) / 2, 0.21, "Augmented")]
    mapping, problems = lfs.map_columns(centres, words, "2017-18", SPEC)
    assert problems == []
    assert sorted(mapping) == [1, 2, 3, 6, 7, 8]
    assert mapping[6] == ("2017-18", "total") and mapping[3] == ("2014-15", "female")
    # the same five columns without an "Augmented" heading are not accepted
    mapping, problems = lfs.map_columns(centres, header(["2014-15", "2017-18"], sexes, xs), "2017-18", SPEC)
    assert mapping == {} and problems


@pytest.mark.parametrize("rounds,sexes,source_round", [
    (["2014-15", "2018-19"], ["Total", "Male", "Female"] * 2, "2018-19"),   # not the round the report compares with
    (["2018-19", "2017-18"], ["Total", "Male", "Female"] * 2, "2018-19"),   # rounds in the wrong order
    (["2017-18", "2018-19"], ["Total", "Female", "Male"] * 2, "2018-19"),   # sexes in an unexpected order
    (["2017-18", "2018-19"], ["Total", "Male", "Rural"] * 2, "2018-19"),    # a column with no sex word
])
def test_columns_unexpected_header_stays_unmapped(rounds, sexes, source_round):
    mapping, problems = lfs.map_columns(CENTRES6, header(rounds, sexes, list(CENTRES6.values())), source_round, SPEC)
    assert mapping == {} and problems


def test_columns_no_round_in_header():
    words = [word(x, 0.22, s) for x, s in zip(CENTRES6.values(), ["Total", "Male", "Female"] * 2)]
    assert lfs.map_columns(CENTRES6, words, "2018-19", SPEC)[0] == {}


# ---------------------------------------------------------------- rows

def test_area_rows_only_the_national_block_is_mapped():
    rows = lfs.AreaRows(LABELS)
    got = [rows.lookup(x) for x in ["Pakistan", "Rural", "Urban", "KP", "Rural", "Urban", "Punjab Total", "Rural"]]
    assert got[:3] == [("total", "dictionary"), ("rural", "dictionary"), ("urban", "dictionary")]
    assert all(g == (None, "out_of_scope") for g in got[3:])


def test_area_rows_two_column_labels_and_unknown_rows():
    rows = lfs.AreaRows(LABELS)
    assert rows.lookup("Pakistan Total") == ("total", "dictionary")
    assert rows.lookup("Pakistan Rural") == ("rural", "dictionary")
    assert rows.lookup("Gilgit") == (None, "unmapped")
    # after an unknown row a bare "Urban" cannot be attributed to Pakistan
    assert rows.lookup("Urban") == (None, "out_of_scope")
    # a bare row before any block is opened is not mapped either
    assert lfs.AreaRows(LABELS).lookup("Rural") == (None, "out_of_scope")


def test_industry_labels():
    m = LabelMap(LABELS["industry_labels"])
    assert m.lookup("Agriculture/ forestry/hunting & fishing") == ("agriculture", "dictionary")
    assert m.lookup("Agriculture, forestry & fishing") == ("agriculture", "dictionary")
    assert m.lookup("Transport/storage & communication") == ("transport_storage_communication", "dictionary")
    assert m.lookup("*Others") == ("others", "dictionary")
    assert m.lookup("Total") == ("all", "dictionary")
    assert m.lookup("Mining & quarrying") == (None, "unmapped")
    slugs = {i["slug"] for i in LABELS["industries"]}
    assert {e["series"] for e in LABELS["industry_labels"]} <= slugs


def test_series_catalogue_hierarchy():
    cat = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    assert cat["lfs.unemployment_rate.total.total"].parent_id is None
    assert cat["lfs.unemployment_rate.female.total"].parent_id == "lfs.unemployment_rate.total.total"
    assert cat["lfs.unemployment_rate.female.urban"].parent_id == "lfs.unemployment_rate.female.total"
    assert cat["lfs.labour_force.male.rural"].scale_factor == 1000000 and cat["lfs.labour_force.male.rural"].unit == "persons"
    assert cat["lfs.employment_share.industry.manufacturing.male.total"].parent_id == "lfs.employment_share.industry.manufacturing.total.total"
    assert all(s.parent_id is None or s.parent_id in cat for s in cat.values())
    assert all(s.frequency == "survey_round" and s.dataset == "lfs" for s in cat.values())


# ---------------------------------------------------------------- runs

def run(run_id, mode, pages, started):
    return RunManifest(run_id=run_id, source_id="lfs-a", sha256_at_run="0" * 64, run_mode=mode, page_range=pages,
                       tool_versions={}, config={}, config_sha256="0" * 64, started_at=started, validated=True)


def test_page_range_run_never_supplies_its_boundary_pages():
    assert lfs.usable_pages(run("r1", "page-range", [35, 40], "t1"), 400) == {36, 37, 38, 39}
    assert lfs.usable_pages(run("r2", "full-document", None, "t2"), 5) == {1, 2, 3, 4, 5}


# ---------------------------------------------------------------- checks

def counts(source="lfs-a", period="2017-18", total="65.50", male="50.74", female="14.76", rural="42.91", urban="22.59"):
    return [cell(source, 1, 1, total, "lfs.labour_force.total.total", period),
            cell(source, 1, 2, male, "lfs.labour_force.male.total", period),
            cell(source, 1, 3, female, "lfs.labour_force.female.total", period),
            cell(source, 2, 1, rural, "lfs.labour_force.total.rural", period),
            cell(source, 3, 1, urban, "lfs.labour_force.total.urban", period)]


def by_rule(checks, rule):
    return [c for c in checks if c.rule_id == rule]


def test_count_sums_pass():
    checks = lfs.count_sum_checks(counts(), SPEC, TITLES, {})
    assert {c.rule_id: c.result for c in checks} == {"lfs.male_plus_female": "pass", "lfs.rural_plus_urban": "pass"}
    assert by_rule(checks, "lfs.male_plus_female")[0].check_type == "row_total"
    assert by_rule(checks, "lfs.rural_plus_urban")[0].check_type == "column_total"
    assert "LFS 2017-18 report" in checks[0].description


def test_count_sums_rounding_and_fail():
    checks = lfs.count_sum_checks(counts(male="50.75", urban="23.59"), SPEC, TITLES, {})
    assert by_rule(checks, "lfs.male_plus_female")[0].result == "pass_within_rounding"
    assert by_rule(checks, "lfs.rural_plus_urban")[0].result == "fail"


def test_count_sums_blocked_table_is_not_evaluable():
    cells = counts()
    blocked = {(cells[0].source_id, cells[0].page, cells[0].table_index): "the table is flagged low_coverage"}
    assert {c.result for c in lfs.count_sum_checks(cells, SPEC, TITLES, blocked)} == {"not_evaluable"}


def test_employed_plus_unemployed_identity():
    cells = [cell("lfs-a", 1, 1, "65.50", "lfs.labour_force.total.total", "2017-18", page=34),
             cell("lfs-a", 1, 1, "61.71", "lfs.employed.total.total", "2017-18", page=35),
             cell("lfs-a", 1, 1, "3.79", "lfs.unemployed.total.total", "2017-18", page=46)]
    chk = by_rule(lfs.count_sum_checks(cells, SPEC, TITLES, {}), "lfs.employed_plus_unemployed")[0]
    assert chk.check_type == "accounting_identity" and chk.result == "pass"
    cells[2] = cell("lfs-a", 1, 1, "4.79", "lfs.unemployed.total.total", "2017-18", page=46)
    assert by_rule(lfs.count_sum_checks(cells, SPEC, TITLES, {}), "lfs.employed_plus_unemployed")[0].result == "fail"


def rate_cells(rate="5.8", lf="65.50", unemployed="3.79", employed=None):
    cells = [cell("lfs-a", 1, 1, rate, "lfs.unemployment_rate.total.total", "2017-18", page=44),
             cell("lfs-a", 1, 1, lf, "lfs.labour_force.total.total", "2017-18", page=34)]
    if unemployed:
        cells.append(cell("lfs-a", 1, 1, unemployed, "lfs.unemployed.total.total", "2017-18", page=46))
    if employed:
        cells.append(cell("lfs-a", 1, 1, employed, "lfs.employed.total.total", "2017-18", page=35))
    return cells


def test_recompute_unemployment_rate_from_counts():
    chk = lfs.recompute_checks(rate_cells(), SPEC, TITLES, {})[0]
    assert chk.check_type == "recompute" and chk.rule_id == "lfs.unemployment_rate_from_counts"
    assert chk.result == "pass_within_rounding"          # 3.79 / 65.50 x 100 = 5.7863
    assert Decimal(chk.observed) == Decimal("5.7863")
    assert "3.79" in chk.description and "65.50" in chk.description


def test_recompute_bound_is_derived_from_printed_precision():
    # dR = 0.05; dU = dL = 0.005; bound = 0.05 + 100 x (0.005/65.5 + 3.79 x 0.005/65.5^2) = 0.0581
    chk = lfs.recompute_checks(rate_cells(), SPEC, TITLES, {})[0]
    assert "0.0581" in chk.tolerance_rule
    # 5.9 is 0.11 away from the recomputed 5.79: outside the bound
    assert lfs.recompute_checks(rate_cells(rate="5.9"), SPEC, TITLES, {})[0].result == "fail"


def test_recompute_falls_back_to_labour_force_minus_employed():
    chk = lfs.recompute_checks(rate_cells(unemployed=None, employed="61.71"), SPEC, TITLES, {})[0]
    assert chk.rule_id == "lfs.unemployment_rate_from_employed" and chk.result == "pass_within_rounding"
    assert lfs.recompute_checks(rate_cells(unemployed=None), SPEC, TITLES, {}) == []


def test_recompute_blocked():
    cells = rate_cells()
    blocked = {(cells[1].source_id, cells[1].page, cells[1].table_index): "the table is flagged merged_rows"}
    assert lfs.recompute_checks(cells, SPEC, TITLES, blocked)[0].result == "not_evaluable"


SHARES = {"all": "100.0", "agriculture": "38.5", "manufacturing": "16.1", "construction": "7.6",
          "wholesale_retail_trade": "14.9", "transport_storage_communication": "6.2",
          "community_social_personal_services": "14.9", "others": "1.8"}


def share_cells(values=SHARES):
    return [cell("lfs-a", r, 1, v, f"lfs.employment_share.industry.{slug}.total.total", "2017-18", page=35)
            for r, (slug, v) in enumerate(values.items())]


def test_industry_shares_add_to_printed_total():
    chk = lfs.shares_checks(share_cells(), SPEC, LABELS, TITLES, {})[0]
    assert chk.check_type == "weights_sum" and chk.result == "pass" and len(chk.member_cell_ids) == 7
    near = lfs.shares_checks(share_cells({**SHARES, "others": "1.9"}), SPEC, LABELS, TITLES, {})[0]
    assert near.result == "pass_within_rounding"         # off by 0.1, the frozen tolerance


def test_industry_shares_fail_and_blocked():
    bad = lfs.shares_checks(share_cells({**SHARES, "manufacturing": "61.1"}), SPEC, LABELS, TITLES, {})[0]
    assert bad.result == "fail"
    cells = share_cells()
    blocked = {(cells[0].source_id, 35, 0): "the table is flagged a row of the table is not matched to an industry"}
    assert lfs.shares_checks(cells, SPEC, LABELS, TITLES, blocked)[0].result == "not_evaluable"


def test_cross_edition_agreement_and_recorded_disagreement():
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    a = cell("lfs-a", 1, 4, "5.8", "lfs.unemployment_rate.total.total", "2017-18")
    b = cell("lfs-b", 1, 1, "5.8", "lfs.unemployment_rate.total.total", "2017-18")
    chk = lfs.cross_checks([a, b], TITLES, ORDER, series)[0]
    assert chk.check_type == "cross_edition" and chk.result == "pass" and chk.target_cell_id == a.cell_id
    c = cell("lfs-b", 1, 1, "6.1", "lfs.unemployment_rate.total.total", "2017-18")
    revised = lfs.cross_checks([a, c], TITLES, ORDER, series)[0]
    assert revised.result == "fail" and "disagree" in revised.description
    # different rounds are never compared
    d = cell("lfs-b", 1, 4, "6.9", "lfs.unemployment_rate.total.total", "2018-19")
    assert lfs.cross_checks([a, d], TITLES, ORDER, series) == []


def test_status_published_only_with_evidence():
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    cells = rate_cells() + [cell("lfs-a", 1, 1, "44.3", "lfs.lfpr_refined.total.total", "2017-18", page=32)]
    checks = lfs.recompute_checks(cells, SPEC, TITLES, {})
    obs = {o.series_id: o for o in build_observations(cells, checks, series, ORDER, TITLES, "v0-test")}
    assert obs["lfs.unemployment_rate.total.total"].published and obs["lfs.unemployment_rate.total.total"].value == "5.8"
    lfpr = obs["lfs.lfpr_refined.total.total"]            # printed once, no check covers it: withheld
    assert not lfpr.published and lfpr.gap_kind == "not_yet_verified" and lfpr.value is None


def test_gap_observations_for_missing_headline_figures():
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    gaps = lfs.gap_observations(SPEC, [], series, {"2014-15": "The registered file is the AJK edition."})
    assert len(gaps) == 5 * 3 * 3
    assert all(g.gap_kind == "not_yet_verified" and not g.published and g.value is None and g.vintage == "na" for g in gaps)
    first = next(g for g in gaps if g.period == "2014-15")
    assert "AJK" in (first.gap_reason or "")
