"""LFS depth (plan item E3): provincial rows (decision D33) and the 19th ICLS tables (decision D34).

All inputs are synthetic: small cells, and report pages generated with PyMuPDF together with the
Docling table that goes with them. No source file is read.
"""
from __future__ import annotations

import json
from decimal import Decimal
from types import SimpleNamespace

import pytest

from datalab.datasets import lfs
from datalab.datasets.common import load_spec
from datalab.schema import PASSING, RunManifest
from datalab.status import build_observations

from conftest import PAGE_H, PAGE_W, docling_doc, docling_table, make_cell

SPEC = load_spec("lfs")
LABELS = load_spec("lfs_labels")
PROVINCES = ["kp", "pb", "sd", "ba"]


def with_flags(provinces: bool = True, icls19: bool = True) -> dict:
    return {**SPEC, "provinces": {**SPEC["provinces"], "enabled": provinces}, "icls19": {**SPEC["icls19"], "enabled": icls19}}


# ---------------------------------------------------------------- the spec as committed

def test_both_depth_flags_exist_and_geo_codes_are_the_documented_ones():
    assert SPEC["provinces"]["enabled"] is True and SPEC["icls19"]["enabled"] is True
    assert {k: v["geo"] for k, v in SPEC["provinces"]["list"].items()} == {"pb": "pk-pb", "sd": "pk-sd", "kp": "pk-kp", "ba": "pk-ba"}
    assert lfs.province_keys(with_flags(provinces=False)) == []


# ---------------------------------------------------------------- series ids

def test_national_ids_are_unchanged_and_new_ids_carry_their_segment():
    assert lfs.series_id_for("labour_force", "male", "rural") == "lfs.labour_force.male.rural"
    assert lfs.series_id_for("labour_force", "male", "rural", "pb") == "lfs.labour_force.pb.male.rural"
    assert lfs.series_id_for("labour_force", "male", "rural", None, True) == "lfs.labour_force.male.rural.icls19"
    assert lfs.series_id_for("labour_force", "male", "rural", "kp", True) == "lfs.labour_force.kp.male.rural.icls19"
    assert lfs.industry_series_id("manufacturing", "female") == "lfs.employment_share.industry.manufacturing.female.total"
    assert lfs.industry_series_id("manufacturing", "female", True) == "lfs.employment_share.industry.manufacturing.female.total.icls19"


@pytest.mark.parametrize("series_id,group", [
    ("lfs.labour_force.male.rural", "national"),
    ("lfs.employment_share.industry.manufacturing.female.total", "national"),
    ("lfs.employment_share.industry.all.total.total", "national"),
    ("lfs.unemployment_rate.total.total", "national"),
    ("lfs.labour_force.pb.male.rural", "provincial"),
    ("lfs.lfpr_crude.ba.total.total", "provincial"),
    ("lfs.labour_force.kp.male.rural.icls19", "icls19"),
    ("lfs.employment_share.industry.all.total.total.icls19", "icls19"),
])
def test_series_group(series_id, group):
    assert lfs.series_group(series_id, SPEC) == group


def test_catalogue_with_both_flags_off_is_the_national_catalogue():
    national = {s.series_id: s for s in lfs.series_catalogue(with_flags(False, False), LABELS, [])}
    full = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    assert set(national) < set(full)
    assert all(lfs.series_group(sid, SPEC) == "national" for sid in national)
    for sid, s in national.items():
        # the national series are the same series in the full catalogue: id, name, parent, definition, sort key
        assert full[sid].model_dump() == s.model_dump()
        assert s.geo == "pk" and s.dims["definition"] == "13th ICLS"


def test_provincial_series_geo_dims_and_parents():
    cat = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    s = cat["lfs.labour_force.pb.male.rural"]
    assert s.geo == "pk-pb" and s.dims == {"sex": "male", "area": "rural", "definition": "13th ICLS"}
    assert s.parent_id == "lfs.labour_force.pb.male.total" and "rural areas of Punjab" in s.name
    assert cat["lfs.labour_force.pb.male.total"].parent_id == "lfs.labour_force.pb.total.total"
    assert cat["lfs.labour_force.pb.total.total"].parent_id == "lfs.labour_force.total.total"
    assert {cat[f"lfs.employed.{k}.total.total"].geo for k in PROVINCES} == {"pk-kp", "pk-pb", "pk-sd", "pk-ba"}
    assert all(s.parent_id is None or s.parent_id in cat for s in cat.values())
    assert len({s.sort_key for s in cat.values()}) == len(cat)


def test_khyber_pakhtunkhwa_definition_says_the_old_name_maps_to_the_same_series():
    cat = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    text = cat["lfs.unemployed.kp.total.total"].definition
    assert "Khyber Pakhtunkhwa" in text and "NWFP" in text and "same series" in text
    assert "NWFP" not in cat["lfs.unemployed.pb.total.total"].definition


def test_icls19_series_are_separate_and_say_which_definition():
    statement = 'Definition as stated in the report: (p.45) "a quoted sentence"'
    cat = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [], statement)}
    s = cat["lfs.employed.total.total.icls19"]
    assert s.dims["definition"] == "19th ICLS" and "(19th ICLS)" in s.name and statement in s.definition
    assert "13th ICLS" not in s.definition and "never" in s.notes and s.definition_status == "draft"
    # parents stay inside the 19th ICLS family: never joined to a 13th ICLS series
    for sid, s in cat.items():
        if sid.endswith(".icls19"):
            assert s.parent_id is None or s.parent_id.endswith(".icls19")
            assert s.breaks == []
        else:
            assert s.dims["definition"] == "13th ICLS" and (s.parent_id is None or not s.parent_id.endswith(".icls19"))
    assert cat["lfs.employed.sd.female.urban.icls19"].geo == "pk-sd"


def test_icls19_definition_is_never_written_when_the_report_sentence_is_not_found():
    cat = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}       # no statement passed
    assert "Definition as stated in the report: not found." in cat["lfs.employed.total.total.icls19"].definition
    assert "own" not in cat["lfs.employed.total.total.icls19"].definition.lower()


def test_definition_statement_is_quoted_only_when_found_on_the_named_page(tmp_path, monkeypatch):
    import pymupdf

    quote = "Under the new standard the definition of employment is narrower."
    doc = pymupdf.open()
    doc.new_page(width=PAGE_W, height=PAGE_H).insert_text((50, 100), "Some other page.", fontsize=9)
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    page.insert_text((50, 100), "Under the new standard the definition of", fontsize=9)   # wrapped over two lines
    page.insert_text((50, 114), "employment is narrower. More text follows.", fontsize=9)
    pdf = tmp_path / "report.pdf"
    doc.save(pdf)
    doc.close()
    monkeypatch.setattr(lfs, "source_path", lambda source: pdf)
    source = SimpleNamespace(source_id="lfs-x")

    def spec_with(quotes):
        return {**SPEC, "icls19": {**SPEC["icls19"], "definition_statement": {"source_id": "lfs-x", "quotes": quotes}}}

    got = lfs.icls19_definition_statement(spec_with([{"page": 2, "text": quote}]), {"lfs-x": source})
    assert got["text"] == f'Definition as stated in the report: (p.2) "{quote}"' and got["quotes"][0]["found_on_page"]
    # wrong page, altered wording, page out of range, source not registered: nothing is quoted
    for quotes in ([{"page": 1, "text": quote}], [{"page": 2, "text": quote.replace("narrower", "broader")}],
                   [{"page": 9, "text": quote}], []):
        got = lfs.icls19_definition_statement(spec_with(quotes), {"lfs-x": source})
        assert got["text"] == "Definition as stated in the report: not found."
    assert lfs.icls19_definition_statement(spec_with([{"page": 2, "text": quote}]), {})["status"] == "source_not_registered"


# ---------------------------------------------------------------- which definition a table is on

T_19_LF = "table 3.8 civilian labour force - pakistan and provinces (19th icls) labour force (million) 2024-25 province/area total male female pakistan"
T_13_LF = "table 3.9 civilian labour force - pakistan and provinces (13th icls) labour force (millions) 2020-21 2024-25"


@pytest.mark.parametrize("caption,kind", [
    (T_19_LF, "labour_force"),
    ("table 3.10: crude labour force participation rate-19th icls (%) crude participation rate 2024-25 (19th icls)", "lfpr_crude"),
    ("table 3.12 refined labour force participation rate by province-19th icls (%) 2024-25", "lfpr_refined"),
    ("table 4.1 employed population - pakistan and provinces 19th icls employed population (million) 2024-25", "employed"),
    ("table 4.5 distribution of employed person by major industry divisions-19th icls (%) major industry divisions 2024-25", "industry"),
    ("table 9.2 unemployment rate- pakistan and provinces (19th icls) unemployment rate (2024-25)", "unemployment_rate"),
])
def test_19th_icls_titles_are_found_with_their_definition(caption, kind):
    got, result, definition = lfs.classify_with_definition(caption, "2024-25", SPEC)
    assert result == "found" and got["kind"] == kind and definition == "19th ICLS"
    # flag off: refused exactly as before
    assert lfs.classify_with_definition(caption, "2024-25", with_flags(icls19=False)) == (None, "other_definition", None)


def test_13th_icls_table_keeps_its_definition():
    got, result, definition = lfs.classify_with_definition(T_13_LF, "2024-25", SPEC)
    assert result == "found" and got["kind"] == "labour_force" and definition == "13th ICLS"
    assert lfs.classify_with_definition("table-11 civilian labour force - pakistan and provinces (million)", "2017-18", SPEC)[2] == "13th ICLS"


@pytest.mark.parametrize("caption,round_,result", [
    # both tags on one title or header: the definition cannot be established, nothing is mapped
    ("table 3.8 civilian labour force - pakistan and provinces (19th icls) labour force (million) (13th icls)", "2024-25", "definition_ambiguous"),
    # no tag in a round that prints both definitions
    ("table 3.8 civilian labour force - pakistan and provinces (million)", "2024-25", "definition_not_stated"),
    # a 19th ICLS tag in a round the spec does not list for it
    ("table 3.8 civilian labour force - pakistan and provinces (19th icls) labour force (million)", "2020-21", "other_definition"),
    ("table 3.8 civilian labour force - pakistan and provinces (million)", "2027-28", "definition_unknown_for_round"),
])
def test_definition_that_cannot_be_established_maps_nothing(caption, round_, result):
    assert lfs.classify_with_definition(caption, round_, SPEC) == (None, result, None)


def test_19th_icls_unemployment_rate_title_prints_no_unit():
    """LFS 2024-25 table 9.2: located, but its title prints no "(%)", so the builder maps nothing from it."""
    import re

    kind, _, _ = lfs.classify_with_definition(
        "table 9.2 unemployment rate- pakistan and provinces (19th icls) unemployment rate (2024-25) province/area total male female", "2024-25", SPEC)
    assert kind["kind"] == "unemployment_rate"
    assert re.search(kind["unit_marker"], "table 9.2 unemployment rate- pakistan and provinces (19th icls) unemployment rate (2024-25)") is None


# ---------------------------------------------------------------- rows: the block heading decides

def rows(provinces=PROVINCES):
    return lfs.AreaRows(LABELS, provinces)


def walk(area_rows, labels):
    out = []
    for label in labels:
        heading = label.startswith("#")          # "#KP": a row that prints the label and no amount
        area, how = area_rows.lookup(label.lstrip("#"), heading=heading)
        if not heading:
            out.append((area_rows.geo if area else None, area, how))
    return out


def test_rows_with_the_province_on_its_total_line():
    """2014-15 to 2020-21 layout: "KP" carries the province total, then bare Rural and Urban."""
    got = walk(rows(), ["Pakistan", "Rural", "Urban", "KP", "Rural", "Urban", "Punjab", "Rural", "Urban",
                        "Sindh", "Rural", "Urban", "Balochistan", "Rural", "Urban"])
    assert [(g, a) for g, a, _ in got] == [(geo, area) for geo in [None, "kp", "pb", "sd", "ba"] for area in ["total", "rural", "urban"]]
    assert all(how == "dictionary" for _, _, how in got)


def test_rows_under_a_heading_line_per_block():
    """2024-25 layout: a heading row per block, then Total, Rural, Urban."""
    got = walk(rows(), ["#Pakistan", "Total", "Rural", "Urban", "#KP", "Total", "Rural", "Urban", "#Sindh", "Total", "Rural", "Urban"])
    assert [(g, a) for g, a, _ in got] == [(geo, area) for geo in [None, "kp", "sd"] for area in ["total", "rural", "urban"]]


def test_bare_rows_under_an_unknown_heading_belong_to_nobody():
    """The trap: bare Rural/Urban repeat for every block. A heading that is not in the dictionary closes the block."""
    got = walk(rows(), ["#Punjab", "Total", "Rural", "#Gilgit Baltistan", "Total", "Rural", "Urban", "#Sindh", "Total"])
    assert got[:2] == [("pb", "total", "dictionary"), ("pb", "rural", "dictionary")]
    assert got[2:5] == [(None, None, "out_of_scope")] * 3          # never carried over as Punjab's
    assert got[5] == ("sd", "total", "dictionary")
    # the same with the unknown region printed on a line with amounts
    got = walk(rows(), ["Punjab", "Rural", "Islamabad", "Rural", "Urban"])
    assert got[2:] == [(None, None, "unmapped"), (None, None, "out_of_scope"), (None, None, "out_of_scope")]


def test_bare_rows_before_any_heading_belong_to_nobody():
    assert walk(rows(), ["Total", "Rural", "Urban"]) == [(None, None, "out_of_scope")] * 3


def test_provinces_switched_off_puts_every_provincial_row_out_of_scope():
    got = walk(rows(provinces=()), ["Pakistan", "Rural", "KP", "Rural", "Urban", "#Punjab", "Total", "Rural"])
    assert got[:2] == [(None, "total", "dictionary"), (None, "rural", "dictionary")]
    assert got[2:] == [(None, None, "out_of_scope")] * 5


@pytest.mark.parametrize("label", ["NWFP", "N.W.F.P", "N.W.F.P.", "North West Frontier Province", "North-West Frontier Province",
                                   "KP", "KPK", "Khyber Pakhtunkhwa"])
def test_old_and_new_names_of_khyber_pakhtunkhwa_open_the_same_block(label):
    area_rows = rows()
    assert area_rows.lookup(label) == ("total", "dictionary") and area_rows.geo == "kp"
    assert area_rows.lookup("Urban") == ("urban", "dictionary") and area_rows.geo == "kp"


def test_province_and_area_on_one_line():
    area_rows = rows()
    assert area_rows.lookup("Punjab Rural") == ("rural", "dictionary") and area_rows.geo == "pb"
    assert area_rows.lookup("Balochistan Total") == ("total", "dictionary") and area_rows.geo == "ba"


def test_area_heading_first_layout_still_maps_nothing_with_provinces_on():
    """Review finding LFS-6 must keep holding: "Rural" as a heading, then Pakistan and the provinces under it."""
    got = walk(rows(), ["#Rural", "Pakistan", "KP", "Punjab", "#Urban", "Pakistan", "KP"])
    assert got == [(None, None, "under_area_heading")] * 5


def test_block_opened_from_the_line_above_only_when_the_table_gave_no_label_first():
    area_rows = rows()
    assert area_rows.open_from_line_above("Pakistan") is True
    assert area_rows.lookup("Total") == ("total", "dictionary") and area_rows.geo is None
    assert rows().open_from_line_above("Total Male Female") is False       # a header line opens nothing
    assert rows().open_from_line_above("Rural") is False                   # a bare area word is not a block heading
    assert rows().open_from_line_above("Punjab Rural") is False
    touched = rows()
    touched.lookup("Gilgit", heading=True)
    assert touched.open_from_line_above("Pakistan") is False               # the table's own rows come first


# ---------------------------------------------------------------- columns

def word(x: float, y: float, text: str, w: float = 0.04):
    return (x - w / 2, y - 0.006, x + w / 2, y + 0.006, text)


def test_19th_icls_table_must_print_the_reports_own_round_only():
    centres = {1: 0.30, 2: 0.42, 3: 0.54, 4: 0.66, 5: 0.78, 6: 0.90}
    two_rounds = [word(0.42, 0.20, "2020-21"), word(0.78, 0.20, "2024-25")] + [
        word(x, 0.22, s) for x, s in zip(centres.values(), ["Total", "Male", "Female"] * 2)]
    assert lfs.map_columns(centres, two_rounds, "2024-25", SPEC)[0] != {}                      # 13th ICLS: accepted
    mapping, problems = lfs.map_columns(centres, two_rounds, "2024-25", SPEC, own_round_only=True)
    assert mapping == {} and problems
    three = {1: 0.30, 2: 0.42, 3: 0.54}
    own = [word(0.42, 0.20, "2024-25")] + [word(x, 0.22, s) for x, s in zip(three.values(), ["Total", "Male", "Female"])]
    assert lfs.map_columns(three, own, "2024-25", SPEC, own_round_only=True)[0] == {
        1: ("2024-25", "total"), 2: ("2024-25", "male"), 3: ("2024-25", "female")}


# ---------------------------------------------------------------- checks on cells

TITLES = {"lfs-a": "LFS 2017-18 report", "lfs-b": "LFS 2018-19 report"}
# (male, female) by (rural, urban) for each block; Pakistan is their sum.
SPLIT = {"kp": ("5.00", "1.00", "1.00", "0.20"), "pb": ("20.00", "8.00", "10.00", "2.00"),
         "sd": ("6.00", "1.50", "6.00", "0.50"), "ba": ("2.00", "0.30", "0.70", "0.05")}


def block_values(split):
    mr, fr, mu, fu = (Decimal(x) for x in split)
    return {("total", "total"): mr + fr + mu + fu, ("male", "total"): mr + mu, ("female", "total"): fr + fu,
            ("total", "rural"): mr + fr, ("male", "rural"): mr, ("female", "rural"): fr,
            ("total", "urban"): mu + fu, ("male", "urban"): mu, ("female", "urban"): fu}


def all_blocks(splits=SPLIT):
    blocks = {geo: block_values(split) for geo, split in splits.items()}
    blocks[None] = {key: sum(blocks[g][key] for g in splits) for key in blocks["kp"]}
    return blocks


def count_cells(measure="labour_force", source="lfs-a", period="2017-18", page=34, icls19=False, change=None, drop=()):
    """One count table as cells: Pakistan and the four provinces. `change`: {(geo, sex, area): printed text}."""
    out, row = [], 0
    for geo, values in all_blocks().items():
        if geo in drop:
            continue
        for (sex, area), value in values.items():
            row += 1
            raw = (change or {}).get((geo, sex, area), f"{value:.2f}")
            out.append(make_cell(source, row, 1, raw, raw, series=lfs.series_id_for(measure, sex, area, geo, icls19),
                                 period=period, vintage="na", page=page))
    return out


def by_rule(checks, rule):
    return [c for c in checks if c.rule_id == rule]


def test_every_block_is_checked_and_the_provinces_add_to_pakistan():
    checks = lfs.count_sum_checks(count_cells(), SPEC, TITLES, {})
    assert len(by_rule(checks, "lfs.male_plus_female")) == 15 and len(by_rule(checks, "lfs.rural_plus_urban")) == 15
    sums = by_rule(checks, "lfs.provinces_add_to_pakistan")
    assert len(sums) == 9 and {c.check_type for c in sums} == {"hierarchy_sum"}
    assert all(c.result == "pass" for c in checks)
    assert all(len(c.member_cell_ids) == 4 for c in sums)


def test_provinces_to_pakistan_within_rounding_and_fail():
    # 0.02 off with four members printed to 0.01: the limit is exactly 0.5 x 4 x 0.01 (decision D9)
    near = lfs.count_sum_checks(count_cells(change={(None, "male", "rural"): "33.02"}), SPEC, TITLES, {})
    target = [c for c in by_rule(near, "lfs.provinces_add_to_pakistan") if c.expected == "33.02"]
    assert [c.result for c in target] == ["pass_within_rounding"]
    far = lfs.count_sum_checks(count_cells(change={("kp", "male", "total"): "5.00"}), SPEC, TITLES, {})
    failed = [c for c in far if c.result == "fail"]
    assert {c.rule_id for c in failed} == {"lfs.provinces_add_to_pakistan", "lfs.male_plus_female", "lfs.rural_plus_urban"}
    assert len(by_rule(failed, "lfs.provinces_add_to_pakistan")) == 1


def test_a_failed_provinces_sum_withholds_every_figure_in_it():
    """The strict rule (status.py) applied to the new check: the Pakistan figure it targets is withheld too."""
    cells = count_cells(change={("kp", "male", "total"): "5.00"})
    checks = lfs.count_sum_checks(cells, SPEC, TITLES, {})
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    obs = {o.series_id: o for o in build_observations(cells, checks, series, {"lfs-a": "2017-18"}, TITLES, "test")}
    for sid in ["lfs.labour_force.male.total", "lfs.labour_force.kp.male.total", "lfs.labour_force.pb.male.total",
                "lfs.labour_force.sd.male.total", "lfs.labour_force.ba.male.total"]:
        assert not obs[sid].published and obs[sid].gap_kind == "failed_checks", sid
    assert obs["lfs.labour_force.pb.female.rural"].published and obs["lfs.labour_force.female.total"].published


def test_provinces_sum_is_not_evaluable_when_a_province_is_missing():
    checks = by_rule(lfs.count_sum_checks(count_cells(drop=("ba",)), SPEC, TITLES, {}), "lfs.provinces_add_to_pakistan")
    assert len(checks) == 9 and all(c.result == "not_evaluable" for c in checks)
    assert all("Balochistan" in c.not_evaluable_reason for c in checks)


def test_provinces_sum_is_not_forced_when_the_table_lists_another_region():
    """The Pakistan figure may cover a region the four provinces do not: not evaluable, with that reason."""
    cells = count_cells()
    reason = lfs.other_regions_reason({"layout": "area_by_round_sex"}, {"unmapped_labels": ["Islamabad"], "unknown_headings": []})
    assert "Islamabad" in reason and "may cover more than the provinces listed" in reason
    checks = lfs.count_sum_checks(cells, SPEC, TITLES, {}, {("lfs-a", 34, 0): reason})
    sums = by_rule(checks, "lfs.provinces_add_to_pakistan")
    assert all(c.result == "not_evaluable" and "Islamabad" in c.not_evaluable_reason for c in sums)
    # the identities inside each block do not depend on it
    assert all(c.result == "pass" for c in checks if c.rule_id != "lfs.provinces_add_to_pakistan")
    assert lfs.other_regions_reason({"layout": "area_by_round_sex"}, {"unmapped_labels": [], "unknown_headings": ["Gilgit Baltistan"]})
    assert lfs.other_regions_reason({"layout": "area_by_round_sex"}, {"unmapped_labels": [], "unknown_headings": []}) is None
    assert lfs.other_regions_reason({"layout": "industry_by_round_sex"}, {"unmapped_labels": ["Mining"]}) is None


def test_no_provinces_sum_without_provincial_cells_or_with_the_flag_off():
    national_only = [c for c in count_cells() if lfs.series_group(c.series_id, SPEC) == "national"]
    assert by_rule(lfs.count_sum_checks(national_only, SPEC, TITLES, {}), "lfs.provinces_add_to_pakistan") == []
    off = lfs.count_sum_checks(count_cells(), with_flags(provinces=False), TITLES, {})
    assert {c.rule_id for c in off} == {"lfs.male_plus_female", "lfs.rural_plus_urban"} and len(off) == 6


def test_employed_plus_unemployed_per_province():
    splits_e = {g: tuple(f"{Decimal(x) * Decimal('0.9'):.2f}" for x in s) for g, s in SPLIT.items()}
    cells = count_cells("labour_force", page=34)
    employed, unemployed = [], []
    row = 0
    for geo in [None, *PROVINCES]:
        lf = all_blocks()[geo]
        emp = all_blocks(splits_e)[geo]
        for key in lf:
            row += 1
            sex, area = key
            employed.append(make_cell("lfs-a", row, 1, f"{emp[key]:.2f}", f"{emp[key]:.2f}", period="2017-18", vintage="na",
                                      series=lfs.series_id_for("employed", sex, area, geo), page=35))
            u = f"{lf[key] - emp[key]:.2f}"
            unemployed.append(make_cell("lfs-a", row, 1, u, u, period="2017-18", vintage="na",
                                        series=lfs.series_id_for("unemployed", sex, area, geo), page=46))
    checks = by_rule(lfs.count_sum_checks(cells + employed + unemployed, SPEC, TITLES, {}), "lfs.employed_plus_unemployed")
    assert len(checks) == 45 and all(c.result == "pass" for c in checks)


def test_provincial_rate_recompute_follows_the_evidence_rule():
    """A provincial labour force is small, so the rounding bound is wide: the recompute rarely singles a rate out."""
    def cells(lf, unemployed, rate, geo="ba"):
        return [make_cell("lfs-a", 1, 1, rate, rate, series=lfs.series_id_for("unemployment_rate", "total", "total", geo), period="2017-18", vintage="na", page=44),
                make_cell("lfs-a", 2, 1, lf, lf, series=lfs.series_id_for("labour_force", "total", "total", geo), period="2017-18", vintage="na", page=34),
                make_cell("lfs-a", 3, 1, unemployed, unemployed, series=lfs.series_id_for("unemployed", "total", "total", geo), period="2017-18", vintage="na", page=46)]

    coarse = lfs.recompute_checks(cells("3.61", "0.15", "4.2"), SPEC, TITLES, {})
    assert len(coarse) == 1 and coarse[0].result == "not_evaluable" and "too coarse" in coarse[0].not_evaluable_reason
    assert "Balochistan" in coarse[0].description
    outside = lfs.recompute_checks(cells("3.61", "0.15", "5.0"), SPEC, TITLES, {})
    assert outside[0].result == "fail"                                  # coarse counts never excuse a rate outside the bound
    fine = lfs.recompute_checks(cells("41.900", "2.849", "6.8", geo="pb"), SPEC, TITLES, {})
    assert fine[0].result in PASSING and fine[0].credits_members is False


def test_cross_edition_pairs_provincial_figures_between_rounds_like_national_ones():
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    order = {"lfs-a": "2017-18", "lfs-b": "2018-19"}
    first = count_cells(source="lfs-a", period="2017-18", page=34)
    again = count_cells(source="lfs-b", period="2017-18", page=43, change={("sd", "female", "urban"): "0.90"})
    checks = lfs.cross_checks(first + again, TITLES, order, series)
    assert len(checks) == 45 and {c.check_type for c in checks} == {"cross_edition"}
    assert [c.result for c in checks].count("fail") == 1


def test_19th_icls_figures_are_never_paired_with_13th_icls_figures():
    """Same round, same report, same measure, both definitions: no check joins them, of any type."""
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    icls13 = count_cells(source="lfs-a", period="2024-25", page=58)
    icls19 = count_cells(source="lfs-a", period="2024-25", page=57, icls19=True,
                         change={(None, "total", "total"): "53.00"})          # differs from the 13th ICLS figure
    next_report = count_cells(source="lfs-b", period="2024-25", page=40)      # a later report reprints the 13th ICLS figures
    cells = icls13 + icls19 + next_report
    checks = (lfs.count_sum_checks(cells, SPEC, TITLES, {}) + lfs.recompute_checks(cells, SPEC, TITLES, {})
              + lfs.cross_checks(cells, TITLES, {"lfs-a": "2024-25", "lfs-b": "2027-28"}, series))
    by_id = {c.cell_id: c for c in cells}
    for chk in checks:
        ids = [chk.target_cell_id, *chk.member_cell_ids]
        kinds = {by_id[i].series_id.endswith(".icls19") for i in ids}
        assert len(kinds) == 1, chk.description
    cross = [c for c in checks if c.check_type in ("cross_edition", "cross_table")]
    assert len(cross) == 45 and all(not by_id[c.target_cell_id].series_id.endswith(".icls19") for c in cross)
    # the 19th ICLS block has its own sums, and its own failure stays its own
    failed = [c for c in checks if c.result == "fail"]
    assert failed and all(by_id[c.target_cell_id].series_id.endswith(".icls19") for c in failed)


def test_industry_shares_are_summed_per_definition():
    shares = {"all": "100.0", "agriculture": "33.1", "manufacturing": "14.8", "construction": "9.9", "wholesale_retail_trade": "16.0",
              "transport_storage_communication": "6.6", "community_social_personal_services": "17.9", "others": "1.6"}
    cells = []
    for is_19, page in ((False, 76), (True, 77)):
        for r, (slug, v) in enumerate(shares.items()):
            v = "35.1" if (slug == "agriculture" and not is_19) else v          # the 13th ICLS column does not add up
            cells.append(make_cell("lfs-a", r, 1, v, v, series=lfs.industry_series_id(slug, "total", is_19), period="2024-25",
                                   vintage="na", page=page))
    checks = lfs.shares_checks(cells, SPEC, LABELS, TITLES, {})
    assert len(checks) == 2
    by_def = {c.target_cell_id: c for c in checks}
    by_id = {c.cell_id: c for c in cells}
    results = {by_id[t].series_id.endswith(".icls19"): c.result for t, c in by_def.items()}
    assert results == {True: "pass_within_rounding", False: "fail"}
    assert all(len(c.member_cell_ids) == 7 for c in checks)


# ---------------------------------------------------------------- end to end: generated pages

ROW_H = 20.0
TABLE_TOP = 200.0
COLS_TWO_ROUNDS = [40.0, 160.0, 225.0, 290.0, 355.0, 420.0, 485.0, 550.0]
COLS_ONE_ROUND = [40.0, 160.0, 290.0, 420.0, 550.0]


def run_manifest() -> RunManifest:
    return RunManifest(run_id="LFS_TEST__docling__full-document__run-01", source_id="lfs-x", sha256_at_run="0" * 64,
                       run_mode="full-document", page_range=None, tool_versions={"docling": "test"}, config={},
                       config_sha256="0" * 64, started_at="2026-10-11T00:00:00", validated=True)


def make_page(tmp_path, monkeypatch, *, title_lines, header_rows, body_rows, col_x, period, docling_rows=None,
              header_flagged: int | None = None, heading_shift: float = 0.0):
    """A generated report page (PDF text layer) and the Docling table that goes with it.

    `docling_rows`: what Docling returned for the same page, when it differs from what is printed
    (a merged cell). `heading_shift`: block headings (label-only rows) are printed this many points
    lower, nearer to the row they head, as on the real pages. Returns (source, run, tables).
    """
    import pymupdf

    from datalab.tables import load_tables

    printed = header_rows + body_rows
    doc = pymupdf.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    for y, text in title_lines:
        page.insert_text((60, y), text, fontsize=9)
    for r, row in enumerate(printed):
        shift = heading_shift if r >= len(header_rows) and not any(row[1:]) else 0.0
        for k, text in enumerate(row):
            if text:
                page.insert_text((col_x[k] + 6, TABLE_TOP + r * ROW_H + 13 + shift), text, fontsize=8)
    pdf = tmp_path / "lfs.pdf"
    doc.save(pdf)
    doc.close()
    table = docling_table(docling_rows or printed, top=TABLE_TOP, row_h=ROW_H, col_x=col_x,
                          header_rows=len(header_rows) if header_flagged is None else header_flagged)
    out = tmp_path / "output.json"
    out.write_text(json.dumps(docling_doc([table])), encoding="utf-8")
    monkeypatch.setattr(lfs, "source_path", lambda source: pdf)
    monkeypatch.setattr("datalab.sources.source_path", lambda source: pdf)
    monkeypatch.setenv("WORK_DIR", str(tmp_path / "work"))
    source = SimpleNamespace(source_id="lfs-x", period=period, local_path="lfs.pdf", title="LFS synthetic report")
    run = run_manifest()
    return source, run, [(run, t) for t in load_tables(out)]


def fmt_row(label, values, rounds=1, places=2):
    """A printed row: label, then Total, Male, Female for each round (the second round is the first plus 1 per cell)."""
    cells = []
    for i in range(rounds):
        cells += [f"{v + i:.{places}f}" for v in values]
    return [label, *cells]


def body_total_on_province_line(rounds=2):
    """2014-15 to 2020-21 layout: the block name carries the total; bare Rural and Urban follow."""
    out = []
    names = {None: "Pakistan", "kp": "KP", "pb": "Punjab", "sd": "Sindh", "ba": "Balochistan"}
    for geo, v in all_blocks().items():
        out.append(fmt_row(names[geo], [v[("total", "total")], v[("male", "total")], v[("female", "total")]], rounds))
        out.append(fmt_row("Rural", [v[("total", "rural")], v[("male", "rural")], v[("female", "rural")]], rounds))
        out.append(fmt_row("Urban", [v[("total", "urban")], v[("male", "urban")], v[("female", "urban")]], rounds))
    # printed order: Pakistan first
    return out[-3:] + out[:-3]


def body_heading_per_block(order=(None, "kp", "pb", "sd", "ba"), extra=None, ncols=4):
    """2024-25 layout: a heading row per block, then Total, Rural, Urban. `extra`: (after which block, heading label)."""
    names = {None: "Pakistan", "kp": "KP", "pb": "Punjab", "sd": "Sindh", "ba": "Balochistan"}
    blocks = all_blocks()
    out = []
    for geo in order:
        v = blocks[geo]
        out.append([names[geo]] + [None] * (ncols - 1))
        for area, label in (("total", "Total"), ("rural", "Rural"), ("urban", "Urban")):
            out.append(fmt_row(label, [v[("total", area)], v[("male", area)], v[("female", area)]]))
        if extra and extra[0] == geo:
            out.append([extra[1]] + [None] * (ncols - 1))
            out += [fmt_row("Total", [Decimal("9"), Decimal("5"), Decimal("4")]), fmt_row("Rural", [Decimal("6"), Decimal("3"), Decimal("3")]),
                    fmt_row("Urban", [Decimal("3"), Decimal("2"), Decimal("1")])]
    return out


TITLE_13 = [(150.0, "Table-11"), (165.0, "CIVILIAN LABOUR FORCE - PAKISTAN AND PROVINCES (million)")]
HEADER_13 = [["Province/Area", None, "2014-15", None, None, "2017-18", None],
             [None, "Total", "Male", "Female", "Total", "Male", "Female"]]
TITLE_19 = [(150.0, "Table 3.8 Civilian Labour Force - Pakistan and Provinces (19th ICLS)")]
HEADER_19 = [[None, None, "Labour Force (Million) 2024-25", None], ["Province/Area", "Total", "Male", "Female"]]


def build(source, run, pairs, spec=SPEC):
    found, rejected = lfs.locate_tables(source, pairs, spec)
    out = []
    for f in found:
        cells, info = lfs.build_cells(source, run, f["table"], f["kind"], f["caption"], f["header_words"], spec, LABELS,
                                      f["definition"])
        out.append((f, cells, info))
    return out, rejected


def test_generated_page_with_province_blocks_and_bare_rural_urban_rows(tmp_path, monkeypatch):
    """Every bare Rural/Urban row lands in the block whose name is printed above it, in both rounds."""
    source, run, pairs = make_page(tmp_path, monkeypatch, title_lines=TITLE_13, header_rows=HEADER_13,
                                   body_rows=body_total_on_province_line(), col_x=COLS_TWO_ROUNDS, period="2017-18")
    (f, cells, info), = build(source, run, pairs)[0]
    assert f["definition"] == "13th ICLS" and info["table_flags"] == [] and info["column_problems"] == []
    assert info["mapped_cells"] == 90 and info["mapped_cells_by_group"] == {"national": 18, "provincial": 72}
    assert info["rows_out_of_scope"] == 0 and info["unmapped_labels"] == [] and info["unknown_headings"] == []
    got = {(c.series_id, c.period): c for c in cells if c.series_id}
    blocks = all_blocks()
    for geo, values in blocks.items():
        for (sex, area), value in values.items():
            sid = lfs.series_id_for("labour_force", sex, area, geo)
            assert got[(sid, "2014-15")].value_raw == f"{value:.2f}", sid
            assert got[(sid, "2017-18")].value_raw == f"{value + 1:.2f}", sid
    # the row label on the receipt is the printed one: bare for Rural/Urban, the province name for its total
    assert got[("lfs.labour_force.sd.male.rural", "2014-15")].row_label_raw == "Rural"
    assert got[("lfs.labour_force.sd.male.total", "2014-15")].row_label_raw == "Sindh"
    # and the checks validate the attribution: every block adds up, the provinces add to Pakistan (first round;
    # the second round is the first plus one per cell, which cannot add up, so it must fail)
    checks = lfs.count_sum_checks(cells, SPEC, {}, {})
    first = [c for c in checks if "2014-15" in c.description]
    assert len(first) == 39 and all(c.result == "pass" for c in first)
    assert any(c.result == "fail" for c in checks if "2017-18" in c.description)
    # flag off: the same page maps the national block only
    (_, cells_off, info_off), = build(source, run, pairs, with_flags(provinces=False))[0]
    assert info_off["mapped_cells"] == 18 and info_off["rows_out_of_scope"] == 12
    assert {c.series_id for c in cells_off if c.series_id} == {lfs.series_id_for("labour_force", s, a) for s in SPEC["sexes"] for a in SPEC["areas"]}


def test_generated_page_where_a_block_heading_is_not_recognised(tmp_path, monkeypatch):
    """A block under a heading that is not in the dictionary maps nothing, the next block starts clean,
    and the table is reported as listing another region."""
    body = body_heading_per_block(extra=("kp", "Gilgit Baltistan"))
    source, run, pairs = make_page(tmp_path, monkeypatch, title_lines=TITLE_19, header_rows=HEADER_19, body_rows=body,
                                   col_x=COLS_ONE_ROUND, period="2024-25")
    (f, cells, info), = build(source, run, pairs)[0]
    assert info["mapped_cells"] == 45 and info["rows_out_of_scope"] == 3 and info["unknown_headings"] == ["Gilgit Baltistan"]
    assert not [c for c in cells if c.series_id and c.value_raw in ("9.00", "6.00", "3.00", "5.00", "4.00")
                and c.row_label_raw in ("Total", "Rural", "Urban") and c.row_index in range(10, 14)]
    reason = lfs.other_regions_reason(f["kind"], info)
    assert reason and "Gilgit Baltistan" in reason
    checks = lfs.count_sum_checks(cells, SPEC, {}, {}, {("lfs-x", 1, 0): reason})
    sums = by_rule(checks, "lfs.provinces_add_to_pakistan")
    assert len(sums) == 9 and all(c.result == "not_evaluable" for c in sums)


def test_generated_page_with_a_lost_heading_maps_nothing(tmp_path, monkeypatch):
    """Docling loses the "Punjab" heading row: its Total/Rural/Urban would be read as a second KP block.
    Two rows claiming one figure: the whole table is unmapped and says why."""
    printed = body_heading_per_block()
    lost = [row for row in printed if row[0] != "Punjab"]
    source, run, pairs = make_page(tmp_path, monkeypatch, title_lines=TITLE_19, header_rows=HEADER_19, body_rows=printed,
                                   col_x=COLS_ONE_ROUND, period="2024-25", docling_rows=HEADER_19 + lost)
    (_, cells, info), = build(source, run, pairs)[0]
    assert "duplicate_row_mapping" in info["table_flags"] and info["mapped_cells"] == 0
    assert not [c for c in cells if c.series_id]


def test_generated_19th_icls_page_feeds_icls19_series_only(tmp_path, monkeypatch):
    source, run, pairs = make_page(tmp_path, monkeypatch, title_lines=TITLE_19, header_rows=HEADER_19,
                                   body_rows=body_heading_per_block(), col_x=COLS_ONE_ROUND, period="2024-25")
    (f, cells, info), = build(source, run, pairs)[0]
    assert f["definition"] == "19th ICLS" and info["definition"] == "19th ICLS"
    assert info["mapped_cells"] == 45 and info["mapped_cells_by_group"] == {"icls19": 45}
    mapped = [c for c in cells if c.series_id]
    assert all(c.series_id.endswith(".icls19") and c.period == "2024-25" for c in mapped)
    got = {c.series_id: c.value_raw for c in mapped}
    blocks = all_blocks()
    assert got["lfs.labour_force.total.total.icls19"] == f"{blocks[None][('total', 'total')]:.2f}"
    assert got["lfs.labour_force.ba.female.urban.icls19"] == "0.05" and got["lfs.labour_force.pb.male.rural.icls19"] == "20.00"
    checks = lfs.count_sum_checks(cells, SPEC, {}, {})
    assert len(checks) == 39 and all(c.result == "pass" for c in checks)
    # flag off: the table is refused, as before D34
    found, rejected = lfs.locate_tables(source, pairs, with_flags(icls19=False))
    assert found == [] and [r["result"] for r in rejected] == ["other_definition"]
    # provinces off, icls19 on: the national 19th ICLS block only
    (_, cells_national, info_national), = build(source, run, pairs, with_flags(provinces=False))[0]
    assert info_national["mapped_cells"] == 9 and all(lfs.series_group(c.series_id, SPEC) == "icls19" for c in cells_national if c.series_id)


def test_generated_19th_icls_page_that_prints_two_rounds_maps_nothing(tmp_path, monkeypatch):
    title = [(150.0, "Table 3.8 Civilian Labour Force - Pakistan and Provinces (19th ICLS)"), (165.0, "Labour Force (Million)")]
    header = [["Province/Area", None, "2020-21", None, None, "2024-25", None], [None, "Total", "Male", "Female", "Total", "Male", "Female"]]
    source, run, pairs = make_page(tmp_path, monkeypatch, title_lines=title, header_rows=header,
                                   body_rows=body_total_on_province_line(), col_x=COLS_TWO_ROUNDS, period="2024-25")
    (f, cells, info), = build(source, run, pairs)[0]
    assert f["definition"] == "19th ICLS" and "column_unmapped" in info["table_flags"] and info["mapped_cells"] == 0


def test_generated_page_with_a_merged_cell_is_rescued_only_through_its_own_sums(tmp_path, monkeypatch):
    """LFS 2024-25 p.57: Docling put two amounts in one cell. The table is flagged; the second reader's
    reading is used because every sum of the table passes on it, including the Pakistan block whose
    heading the second reader leaves with the header lines."""
    printed = body_heading_per_block()
    merged = [list(r) for r in printed]
    merged[7] = [merged[7][0], merged[7][1], f"{merged[7][2]}  {merged[7][3]}", None]        # "Rural" of Punjab... of the second block
    source, run, pairs = make_page(tmp_path, monkeypatch, title_lines=TITLE_19, header_rows=HEADER_19, body_rows=printed,
                                   col_x=COLS_ONE_ROUND, period="2024-25", docling_rows=HEADER_19 + merged, heading_shift=4.0)
    found, _ = lfs.locate_tables(source, pairs, SPEC)
    f = found[0]
    cells, info = lfs.build_cells(source, run, f["table"], f["kind"], f["caption"], f["header_words"], SPEC, LABELS, f["definition"])
    assert "merged_rows" in info["table_flags"]
    first_ids = {c.cell_id for c in cells}
    promoted, coverage = lfs.second_reading(source, f, cells, info, SPEC, LABELS, {})
    record = info["second_reader"]
    assert promoted, record.get("decision")
    assert record["checks"]["hierarchy_sum"]["pass"] == 9 and record["block_heading_from_text_layer"] == "Pakistan"
    second = [c for c in cells if c.cell_id not in first_ids]
    assert len([c for c in second if c.series_id]) == 45 and all(c.extractor_name == "pdfplumber" for c in second)
    assert all(c.series_id is None for c in cells if c.cell_id in first_ids)          # Docling's cells stay, unmapped
    assert coverage["reader"] == "pdfplumber" and info["mapped_cells_by_group"] == {"icls19": 45}


def test_merged_cell_page_is_not_rescued_when_a_sum_fails_on_the_second_reading(tmp_path, monkeypatch):
    printed = body_heading_per_block()
    printed[5][2] = "9.99"                                    # KP total, male: the page itself does not add up
    merged = [list(r) for r in printed]
    merged[7] = [merged[7][0], merged[7][1], f"{merged[7][2]}  {merged[7][3]}", None]
    source, run, pairs = make_page(tmp_path, monkeypatch, title_lines=TITLE_19, header_rows=HEADER_19, body_rows=printed,
                                   col_x=COLS_ONE_ROUND, period="2024-25", docling_rows=HEADER_19 + merged, heading_shift=4.0)
    f = lfs.locate_tables(source, pairs, SPEC)[0][0]
    cells, info = lfs.build_cells(source, run, f["table"], f["kind"], f["caption"], f["header_words"], SPEC, LABELS, f["definition"])
    before = [(c.cell_id, c.series_id) for c in cells]
    promoted, _ = lfs.second_reading(source, f, cells, info, SPEC, LABELS, {})
    assert not promoted and "arithmetic checks did not pass" in info["second_reader"]["decision"]
    assert [(c.cell_id, c.series_id) for c in cells] == before               # nothing changes


def test_flagged_rate_table_is_never_sent_to_the_second_reader():
    """A table of rates has no sum of its own, so nothing could validate a second reading of it."""
    kind = next(k for k in SPEC["tables"] if k["kind"] == "lfpr_crude")
    info = {"table_flags": ["merged_rows"], "coverage": {"coverage": 1.0}}
    promoted, coverage = lfs.second_reading(None, {"kind": kind, "definition": "19th ICLS"}, [], info, SPEC, LABELS, {})
    assert promoted is False and coverage == {"coverage": 1.0} and "second_reader" not in info
