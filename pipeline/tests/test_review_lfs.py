"""Adversarial review of the LFS builder (docs/reports/review_lfs.md).

Every test here documents a defect: it FAILS on the current code and is marked
`xfail(strict=True)` so the suite stays green. When a defect is fixed its test
starts passing, strict xfail turns that into a suite failure, and the marker
must then be removed. Inputs are synthetic (small cells, a generated Docling
document); no source file is read.
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

@pytest.mark.xfail(strict=True, reason="REVIEW-LFS-1: the recompute bound grows with 1/labour force; for a small base it is "
                                       "several units of the rate's last digit, so different printed rates all 'pass'")
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


# ---------------------------------------------------------------- REVIEW-LFS-2

@pytest.mark.xfail(strict=True, reason="REVIEW-LFS-2: a passing recompute check is credited to its input counts, which it "
                                       "barely constrains; a labour-force count 0.7 million off is published as checked")
@pytest.mark.parametrize("labour_force", ["64.80", "65.90"])
def test_recompute_does_not_make_an_input_count_checked(labour_force):
    """Rate 5.8 with unemployed 3.79 passes for any labour force from about 64.7 to 66.0 million.

    No sum, identity or second printing covers the labour-force cell here; the only check that
    touches it is the rate's recomputation, which cannot tell 64.80 from 65.90.
    """
    series = {s.series_id: s for s in lfs.series_catalogue(SPEC, LABELS, [])}
    cells = rate_cells(rate="5.8", labour_force=labour_force, unemployed="3.79")
    checks = lfs.recompute_checks(cells, SPEC, TITLES, {})
    assert [c.result for c in checks] == ["pass_within_rounding"]      # the rate itself is tested
    obs = {o.series_id: o for o in build_observations(cells, checks, series, ORDER, TITLES, "v0-test")}
    count = obs["lfs.labour_force.total.total"]
    assert not count.published and count.status != "checked"


# ---------------------------------------------------------------- REVIEW-LFS-3

@pytest.mark.xfail(strict=True, reason="REVIEW-LFS-3: title patterns are searched anywhere in the title, so a table about a "
                                       "sub-population is accepted as the headline table")
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

@pytest.mark.xfail(strict=True, reason="REVIEW-LFS-4: only the round listed in icls.required_in_rounds must state its "
                                       "definition; any later round silently defaults to '13th ICLS'")
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


# ---------------------------------------------------------------- REVIEW-LFS-5

def manifest(run_id: str, mode: str, pages) -> RunManifest:
    return RunManifest(run_id=run_id, source_id="lfs-x", sha256_at_run="0" * 64, run_mode=mode, page_range=pages,
                       tool_versions={"docling": "test"}, config={}, config_sha256="0" * 64, started_at="2026-10-11T00:00:00",
                       validated=True)


@pytest.mark.xfail(strict=True, reason="REVIEW-LFS-5: a page-range run whose manifest lacks the range is treated as a "
                                       "full-document run (boundary pages included, every page claimed)")
def test_page_range_run_without_a_recorded_range_supplies_nothing():
    try:
        pages = lfs.usable_pages(manifest("r1", "page-range", None), 400)
    except (ValueError, KeyError):
        return      # refusing loudly is an acceptable fix
    assert pages == set()


@pytest.mark.xfail(strict=True, reason="REVIEW-LFS-5: a full-document run of a source with an empty page count "
                                       "(a known registry trap) silently supplies no table at all")
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


def build_one_table(tmp_path, monkeypatch, body_rows, *, header_rows: int = 2):
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
    found, _ = lfs.locate_tables(source, [(run, t) for t in load_tables(out)], SPEC)
    assert [f["kind"]["kind"] for f in found] == ["labour_force"]
    f = found[0]
    return lfs.build_cells(source, run, f["table"], f["kind"], f["caption"], f["header_words"], SPEC, LABELS)


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

@pytest.mark.xfail(strict=True, reason="REVIEW-LFS-6: a 'Pakistan' row is mapped as the national total whatever heading "
                                       "it sits under; under a 'Rural' heading it is rural Pakistan")
def test_pakistan_row_under_a_rural_heading_is_not_the_national_total(tmp_path, monkeypatch):
    """Rows grouped by area first (heading "Rural", then Pakistan and the provinces).

    The label-only "Rural" row is looked up, found to be a bare area word with no open block and
    forgotten; "Pakistan" then opens the national block and its amounts become
    lfs.labour_force.*.total. Nothing repeats, so the duplicate guard stays silent.
    """
    body = [["Rural"] + [None] * 6, ["Pakistan"] + amounts(41), ["KP"] + amounts(5), ["Punjab"] + amounts(25)]
    cells, info = build_one_table(tmp_path, monkeypatch, body)
    wrong = sorted({c.series_id for c in cells if c.series_id and c.series_id.endswith(".total")})
    assert wrong == [], f"rural figures mapped to {wrong}"


# ---------------------------------------------------------------- REVIEW-LFS-7

@pytest.mark.xfail(strict=True, reason="REVIEW-LFS-7: a data row that Docling flags as a column header is skipped on the "
                                       "flag alone; the national row and its block vanish with no flag (AGENTS.md 7)")
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


# ---------------------------------------------------------------- REVIEW-LFS-8

@pytest.mark.xfail(strict=True, reason="REVIEW-LFS-8: two registered files of the SAME edition count as two editions; "
                                       "their agreement is recorded as cross_edition and publishes the figure")
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
