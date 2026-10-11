"""Adversarial review of the LFS builder (docs/reports/review_lfs.md).

Every test here documents a defect found by the review. All eight findings are fixed
(docs/reports/fix_lfs.md), so the tests now pass and carry no xfail marker; they stay as
regression tests. Inputs are synthetic (small cells, a generated Docling document); no
source file is read.
"""
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from datalab.datasets import lfs
from datalab.datasets.common import load_spec
from datalab.schema import PASSING, RunManifest
from datalab.status import build_observations

from conftest import docling_doc, docling_table, make_cell

SPEC = load_spec("lfs")
# These are regression tests of the national block. Provincial rows (decision D33) and 19th ICLS
# tables (D34) are tested in test_lfs_depth.py; here both are switched off, as the spec flags allow.
NATIONAL_ONLY = {**SPEC, "provinces": {**SPEC["provinces"], "enabled": False}, "icls19": {**SPEC["icls19"], "enabled": False}}
LABELS = load_spec("lfs_labels")
TITLES = {"lfs-a": "LFS 2017-18 report"}
ORDER = {"lfs-a": "2017-18"}
PERIOD = "2017-18"


def cell(page: int, value: str, series: str):
    return make_cell("lfs-a", 1, 1, value, value, series=series, period=PERIOD, vintage="na", page=page)


def rate_cells(*, rate: str, labour_force: str, unemployed: str | None = None, employed: str | None = None,
               sex: str = "total", area: str = "total"):
    cells = [cell(44, rate, f"lfs.unemployment_rate.{sex}.{area}"), cell(34, labour_force, f"lfs.labour_force.{sex}.{area}")]
    if unemployed is not None:
        cells.append(cell(46, unemployed, f"lfs.unemployed.{sex}.{area}"))
    if employed is not None:
        cells.append(cell(35, employed, f"lfs.employed.{sex}.{area}"))
    return cells


# ---------------------------------------------------------------- REVIEW-LFS-1

@pytest.mark.parametrize("counts,printed_rates", [
    # labour force 2.90, employed 2.43 -> 16.2069; bound 0.3669: 15.9 ... 16.5 all pass
    ({"labour_force": "2.90", "employed": "2.43"}, ("16.0", "16.5")),
    # labour force 2.40, unemployed 0.49 -> 20.4167; bound 0.3009: 20.2 ... 20.7 all pass
    ({"labour_force": "2.40", "unemployed": "0.49"}, ("20.2", "20.6")),
])
def test_recompute_cannot_confirm_two_different_printed_rates(counts, printed_rates):
    """A check that is evidence for a printed figure must not also accept a different printed figure.

    The same pair of counts currently "confirms" rates that are four or five tenths apart, so a
    passing result says nothing about the last printed digit, yet the rate becomes tier B / checked.
    """
    results = [lfs.recompute_checks(rate_cells(rate=r, sex="female", area="urban", **counts), SPEC, TITLES, {})[0].result
               for r in printed_rates]
    assert sum(r in PASSING for r in results) <= 1, results


def test_coarse_counts_do_not_excuse_a_rate_outside_the_bound():
    """Too coarse to confirm is not too coarse to contradict: a printed rate outside the wide bound still fails."""
    counts = {"labour_force": "2.90", "employed": "2.43"}          # recomputed 16.2069, bound 0.3669
    inside = lfs.recompute_checks(rate_cells(rate="16.2", sex="female", area="urban", **counts), SPEC, TITLES, {})[0]
    assert inside.result == "not_evaluable" and inside.not_evaluable_reason.startswith(lfs.COARSE_COUNTS_REASON)
    outside = lfs.recompute_checks(rate_cells(rate="17.0", sex="female", area="urban", **counts), SPEC, TITLES, {})[0]
    assert outside.result == "fail"


def test_printable_values_within_the_bound_are_counted_exactly():
    from decimal import Decimal as D
    assert lfs.printable_values_within(D("5.7863"), D("0.0581"), D("0.1")) == 1      # 5.8 only
    assert lfs.printable_values_within(D("5.8488"), D("0.0582"), D("0.1")) == 2      # 5.8 and 5.9
    assert lfs.printable_values_within(D("16.2069"), D("0.3669"), D("0.1")) == 7     # 15.9 ... 16.5
    assert lfs.printable_values_within(D("5.85"), D("0.05"), D("0.1")) == 2          # a value ON the bound counts


# ---------------------------------------------------------------- REVIEW-LFS-2

@pytest.mark.parametrize("labour_force", ["64.90", "65.80"])
def test_recompute_does_not_make_an_input_count_checked(labour_force):
    """Rate 5.8 with unemployed 3.79 is singled out for any labour force from about 64.9 to 65.8 million.

    No sum, identity or second printing covers the labour-force cell here; the only check that
    touches it is the rate's recomputation, which cannot tell 64.90 from 65.80.

    (The review used 64.80 and 65.90. With the REVIEW-LFS-1 rule those two no longer pass at all:
    the bound 0.058 around the recomputed 5.849 / 5.751 holds two printable rates, so the check is
    not evaluable. The values were moved inside the range where the rate is still confirmed.)
    """
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    cells = rate_cells(rate="5.8", labour_force=labour_force, unemployed="3.79")
    checks = lfs.recompute_checks(cells, SPEC, TITLES, {})
    assert [c.result for c in checks] == ["pass_within_rounding"]      # the rate itself is tested
    obs = {o.series_id: o for o in build_observations(cells, checks, series, ORDER, TITLES, "v0-test")}
    count = obs["lfs.labour_force.total.total"]
    assert not count.published and count.status != "checked"
    assert obs["lfs.unemployment_rate.total.total"].published      # the target still earns its tier
    assert checks[0].credits_members is False


@pytest.mark.parametrize("labour_force", ["64.80", "65.90"])
def test_recompute_at_the_edge_of_the_bound_confirms_nothing(labour_force):
    """The review's own values: two printable rates lie within the bound, so neither rate nor count is checked."""
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    cells = rate_cells(rate="5.8", labour_force=labour_force, unemployed="3.79")
    checks = lfs.recompute_checks(cells, SPEC, TITLES, {})
    assert [c.result for c in checks] == ["not_evaluable"]
    assert lfs.COARSE_COUNTS_REASON in checks[0].not_evaluable_reason
    assert not any(o.published for o in build_observations(cells, checks, series, ORDER, TITLES, "v0-test"))


# ---------------------------------------------------------------- REVIEW-LFS-3

@pytest.mark.parametrize("caption,round_", [
    ("table 8.9 youth (15-24 years) unemployment rate by province, region & sex (%) unemployment rate (13th icls) "
     "2020-21 2024-25 province/region total male female total male female", "2024-25"),
    ("table-24 long term unemployed - pakistan and provinces (million) 2014-15 2017-18 total male female", "2017-18"),
    ("table-14 self employed - pakistan and provinces (million) 2014-15 2017-18 total male female", "2017-18"),
    ("table 3.9 female civilian labour force - pakistan and provinces (million) 2018-19 2020-21", "2020-21"),
    ("table 4.9 non-agriculture employed - distribution by major industry divisions (%) 2018-19 2020-21", "2020-21"),
])
def test_title_with_a_qualifier_is_not_the_headline_table(caption, round_):
    """ "Youth unemployment rate by province, region & sex" is not "Unemployment rate by province, region & sex".

    The tie rule does not help: it only compares tables that were found, and page-range runs see
    a fraction of the report. One such table inside the range, with the real one outside it or
    missed by Docling, is mapped to the headline series and its own sums pass.
    """
    kind, result = lfs.classify(caption, round_, SPEC)
    assert kind is None, f"classified as {kind['kind']} ({result})"


# ---------------------------------------------------------------- REVIEW-LFS-4

@pytest.mark.parametrize("round_", ["2025-26", "2026-27"])
def test_round_with_unknown_definition_is_not_assumed_13th_icls(round_):
    """A report newer than 2024-25 whose title does not say which definition it uses must not be mapped.

    Every series definition says "13th ICLS". From 2024-25 PBS leads with the 19th ICLS, so a later
    report that prints one definition only and does not name it would flow into the 13th ICLS series.
    """
    caption = (f"table 3.6 civilian labour force - pakistan and provinces (million) labour force {round_} "
               "province/area total male female")
    try:
        kind, result = lfs.classify(caption, round_, SPEC)
    except (KeyError, ValueError):
        return      # refusing loudly is an acceptable fix
    assert kind is None, f"classified as {kind['kind']} ({result}) with no definition stated"


def test_refused_round_records_its_reason():
    caption = "table 3.6 civilian labour force - pakistan and provinces (million) labour force 2025-26"
    assert lfs.classify(caption, "2025-26", SPEC) == (None, "definition_unknown_for_round")
    assert lfs.classify(caption, "2020-21", SPEC)[1] == "found"      # a round listed as 13th ICLS throughout


# ---------------------------------------------------------------- REVIEW-LFS-5

def manifest(run_id: str, mode: str, pages) -> RunManifest:
    return RunManifest(run_id=run_id, source_id="lfs-x", sha256_at_run="0" * 64, run_mode=mode, page_range=pages,
                       tool_versions={"docling": "test"}, config={}, config_sha256="0" * 64, started_at="2026-10-11T00:00:00",
                       validated=True)


def test_page_range_run_without_a_recorded_range_supplies_nothing():
    try:
        pages = lfs.usable_pages(manifest("r1", "page-range", None), 400)
    except (ValueError, KeyError):
        return      # refusing loudly is an acceptable fix
    assert pages == set()


def test_full_document_run_is_not_silently_emptied_by_a_missing_page_count(tmp_path, monkeypatch):
    monkeypatch.setenv("WORK_DIR", str(tmp_path / "work"))
    run = manifest("LFS_TEST__docling__full-document__run-01", "full-document", None)
    run_dir = tmp_path / "work" / "runs" / run.run_id
    (run_dir / "raw").mkdir(parents=True)
    (run_dir / "manifest.json").write_text(run.model_dump_json(), encoding="utf-8")
    table = docling_table([["Area", "Total", "Male", "Female"], ["Pakistan", "5.8", "5.1", "8.3"]], page=2)
    (run_dir / "raw" / "output.json").write_text(json.dumps(docling_doc([table], pages=3)), encoding="utf-8")
    source = SimpleNamespace(source_id="lfs-x", page_count=None)
    try:
        pairs, _ = lfs.tables_for_source(source)
    except (ValueError, KeyError):
        return      # refusing loudly is an acceptable fix
    assert [t.page for _, t in pairs] == [2]


# ---------------------------------------------------------------- end-to-end fixture (locate_tables + build_cells)

COL_X = [40.0, 160.0, 225.0, 290.0, 355.0, 420.0, 485.0, 550.0]
ROW_H = 20.0
TABLE_TOP = 200.0
TITLE_LINES = [(150.0, "Table-11"), (165.0, "CIVILIAN LABOUR FORCE - PAKISTAN AND PROVINCES (million)")]
HEADER_ROWS = [["Province/Area", None, "2014-15", None, None, "2017-18", None],
               [None, "Total", "Male", "Female", "Total", "Male", "Female"]]


def amounts(first: int) -> list[str]:
    return [f"{first + i}.00" for i in range(6)]


def build_one_table(tmp_path, monkeypatch, body_rows, *, header_rows: int = 2, spec=None):
    """One synthetic report page: a PDF text layer and the Docling table that goes with it.

    The same grid positions are used for the printed words and for Docling's cell boxes, so the
    builder reads the title and the column header from the text layer exactly as it does for a
    real report. `header_rows` is how many leading rows Docling flags as column headers.
    Returns (cells, info) for the one located table.
    """
    import pymupdf

    from conftest import PAGE_H, PAGE_W
    from datalab.tables import load_tables

    rows = HEADER_ROWS + body_rows
    doc = pymupdf.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    for y, text in TITLE_LINES:
        page.insert_text((60, y), text, fontsize=9)
    for r, row in enumerate(rows):
        for k, text in enumerate(row):
            if text:
                page.insert_text((COL_X[k] + 6, TABLE_TOP + r * ROW_H + 13), text, fontsize=8)
    pdf = tmp_path / "lfs.pdf"
    doc.save(pdf)
    doc.close()
    out = tmp_path / "output.json"
    table = docling_table(rows, top=TABLE_TOP, row_h=ROW_H, col_x=COL_X, header_rows=header_rows)
    out.write_text(json.dumps(docling_doc([table])), encoding="utf-8")

    monkeypatch.setattr(lfs, "source_path", lambda source: pdf)
    source = SimpleNamespace(source_id="lfs-x", period="2017-18", local_path="lfs.pdf", title="LFS synthetic report")
    run = manifest("LFS_TEST__docling__full-document__run-01", "full-document", None)
    spec = spec or NATIONAL_ONLY
    found, _ = lfs.locate_tables(source, [(run, t) for t in load_tables(out)], spec)
    assert [f["kind"]["kind"] for f in found] == ["labour_force"]
    f = found[0]
    return lfs.build_cells(source, run, f["table"], f["kind"], f["caption"], f["header_words"], spec, LABELS)


def test_fixture_baseline_maps_the_national_block_only(tmp_path, monkeypatch):
    """Not a finding: shows the end-to-end fixture is sound (so the two failures below mean something)."""
    body = [["Pakistan"] + amounts(61), ["Rural"] + amounts(41), ["Urban"] + amounts(19),
            ["KP"] + amounts(7), ["Rural"] + amounts(5), ["Urban"] + amounts(1)]
    cells, info = build_one_table(tmp_path, monkeypatch, body)
    assert info["table_flags"] == [] and info["column_problems"] == [] and info["mapped_cells"] == 18
    got = {(c.series_id, c.period): c.value_raw for c in cells if c.series_id}
    assert got[("lfs.labour_force.total.total", "2014-15")] == "61.00"
    assert got[("lfs.labour_force.female.total", "2017-18")] == "66.00"
    assert got[("lfs.labour_force.male.rural", "2014-15")] == "42.00"
    assert got[("lfs.labour_force.total.urban", "2017-18")] == "22.00"
    assert "7.00" not in got.values() and "5.00" not in got.values()      # provincial rows stay unmapped


# ---------------------------------------------------------------- REVIEW-LFS-6

def test_pakistan_row_under_a_rural_heading_is_not_the_national_total(tmp_path, monkeypatch):
    """Rows grouped by area first (heading "Rural", then Pakistan and the provinces).

    The label-only "Rural" row is looked up, found to be a bare area word with no open block and
    forgotten; "Pakistan" then opens the national block and its amounts become
    lfs.labour_force.*.total. Nothing repeats, so the duplicate guard stays silent.
    """
    body = [["Rural"] + [None] * 6, ["Pakistan"] + amounts(41), ["KP"] + amounts(5), ["Punjab"] + amounts(25)]
    # With provincial rows mapped (D33) the rule must hold just the same: nothing below the heading is mapped.
    cells, info = build_one_table(tmp_path, monkeypatch, body, spec=SPEC)
    assert info["mapped_cells"] == 0 and not [c for c in cells if c.series_id]
    cells, info = build_one_table(tmp_path, monkeypatch, body)
    wrong = sorted({c.series_id for c in cells if c.series_id and c.series_id.endswith(".total")})
    assert wrong == [], f"rural figures mapped to {wrong}"
    assert info["mapped_cells"] == 0 and any("Pakistan" in label for label in info["unmapped_labels"])


# ---------------------------------------------------------------- REVIEW-LFS-7

def test_national_row_flagged_as_header_does_not_vanish_silently(tmp_path, monkeypatch):
    """Docling marks the first data row ("Pakistan" with six amounts) as a header row.

    The builder drops the row before reading its label, emits no cell for it, never opens the
    national block (so Rural and Urban go out of scope too) and raises no flag: the report shows
    coverage 100% and a healthy table with nothing mapped. Either the row is recognised as data
    (every value column holds one number) or the table says why it is not usable.
    """
    body = [["Pakistan"] + amounts(61), ["Rural"] + amounts(41), ["Urban"] + amounts(19),
            ["KP"] + amounts(7), ["Rural"] + amounts(5), ["Urban"] + amounts(1)]
    cells, info = build_one_table(tmp_path, monkeypatch, body, header_rows=3)
    assert info["mapped_cells"] == 18 or info["table_flags"], "national block lost and nothing says so"
    assert info["mapped_cells"] == 18 and info["header_rows_as_data"] == [2]
    national = [c for c in cells if c.series_id == "lfs.labour_force.total.total"]
    assert all("header_row_as_data" in c.structural_flags and c.row_label_raw == "Pakistan" for c in national)


def test_header_flagged_row_with_some_numbers_flags_the_table(tmp_path, monkeypatch):
    """A flagged row that holds numbers but not one per value column is not data, and the table says so."""
    body = [["Pakistan", "61.00", "62.00", None, "64.00", "65.00", "66.00"], ["Rural"] + amounts(41),
            ["Urban"] + amounts(19)]
    cells, info = build_one_table(tmp_path, monkeypatch, body, header_rows=3)
    assert "header_row_with_numbers" in info["table_flags"] and info["mapped_cells"] == 0


# ---------------------------------------------------------------- REVIEW-LFS-8

def test_two_files_of_one_edition_are_not_cross_edition_agreement():
    """A second copy of one report (a re-issue, a mirror, a 'final' PDF) agrees with itself by construction.

    `cross_checks` decides "another edition" by source_id alone although it is handed the round of
    every source. Here both sources are the 2017-18 report; a participation rate printed once,
    which no check covers, becomes checked and is published.
    """
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    order = {"lfs-a": "2017-18", "lfs-a-copy": "2017-18"}
    titles = {"lfs-a": "LFS 2017-18 report", "lfs-a-copy": "LFS 2017-18 report (second file)"}
    sid = "lfs.lfpr_refined.total.total"
    cells = [make_cell(source, 1, 4, "44.3", "44.3", series=sid, period="2017-18", vintage="na", page=32)
             for source in order]
    checks = lfs.cross_checks(cells, titles, order, series)
    assert not [c for c in checks if c.check_type == "cross_edition" and c.result in PASSING]
    obs = build_observations(cells, checks, series, order, titles, "v0-test")
    assert not obs[0].published


def test_a_real_second_edition_still_agrees_beside_a_duplicate_file():
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    order = {"lfs-a": "2017-18", "lfs-a-copy": "2017-18", "lfs-b": "2018-19"}
    sid = "lfs.lfpr_refined.total.total"
    cells = [make_cell(source, 1, 4, "44.3", "44.3", series=sid, period="2017-18", vintage="na", page=32)
             for source in order]
    checks = lfs.cross_checks(cells, {}, order, series)
    assert [(c.check_type, c.source_ids, c.result) for c in checks] == [("cross_edition", ["lfs-a", "lfs-b"], "pass")]


# ---------------------------------------------------------------- unproven 5 and 6 (cheap, conservative)

def test_cross_check_with_a_cell_in_a_blocked_table_is_not_evaluable():
    """An agreeing second printing must not rescue a figure when either table is blocked."""
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    order = {"lfs-a": "2017-18", "lfs-b": "2018-19"}
    sid = "lfs.lfpr_refined.total.total"
    a = make_cell("lfs-a", 1, 4, "44.3", "44.3", series=sid, period="2017-18", vintage="na", page=32)
    b = make_cell("lfs-b", 1, 1, "44.3", "44.3", series=sid, period="2017-18", vintage="na", page=40)
    assert [c.result for c in lfs.cross_checks([a, b], {}, order, series, {})] == ["pass"]
    for cell_ in (a, b):
        blocked = {(cell_.source_id, cell_.page, cell_.table_index): "the table is flagged merged_rows"}
        checks = lfs.cross_checks([a, b], {}, order, series, blocked)
        assert [(c.check_type, c.result) for c in checks] == [("cross_edition", "not_evaluable")]
        assert "merged_rows" in checks[0].not_evaluable_reason
        assert not build_observations([a, b], checks, series, order, {}, "v0-test")[0].published


def test_shares_sum_with_an_absent_industry_is_not_evaluable():
    """A lost row is not a nil row: the remaining shares must not be summed as if it were not there."""
    shares = {"all": "100.0", "agriculture": "38.5", "manufacturing": "16.1", "construction": "7.6",
              "wholesale_retail_trade": "14.9", "transport_storage_communication": "6.2",
              "community_social_personal_services": "14.9", "others": "1.8"}

    def cells_for(values):
        return [make_cell("lfs-a", r, 1, v, v, series=f"lfs.employment_share.industry.{slug}.total.total", period=PERIOD,
                          vintage="na", page=35) for r, (slug, v) in enumerate(values.items())]

    assert [c.result for c in lfs.shares_checks(cells_for(shares), SPEC, LABELS, TITLES, {})] == ["pass"]
    # "others" printed as 0.1 and lost: the seven remaining rows are within the 0.1 tolerance of 100.0
    near = {**shares, "others": "0.1", "agriculture": "40.2"}
    assert [c.result for c in lfs.shares_checks(cells_for(near), SPEC, LABELS, TITLES, {})] == ["pass"]
    lost = {k: v for k, v in near.items() if k != "others"}
    checks = lfs.shares_checks(cells_for(lost), SPEC, LABELS, TITLES, {})
    assert [c.result for c in checks] == ["not_evaluable"] and "others" in checks[0].not_evaluable_reason
