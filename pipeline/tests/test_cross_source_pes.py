"""LFS against the Economic Survey labour chapter: synthetic tables and one generated PDF, never a source file."""
from __future__ import annotations

import json

import pymupdf
import pytest

from datalab import config
from datalab.datasets import cross_source as xs
from datalab.datasets.common import load_spec
from datalab.schema import RunManifest, Source
from datalab.status import build_observations
from datalab.tables import load_tables

from conftest import PAGE_H, PAGE_W, docling_doc, docling_table, make_cell

CFG = load_spec("lfs")["cross_source_pes"]
BY_YEAR = next(k for k in CFG["tables"] if k["layout"] == "measures_by_year")
BY_MEASURE = next(k for k in CFG["tables"] if k["layout"] == "years_by_measure")
TITLES = {"lfs-a": "LFS 2017-18 report"}


def lfs_cell(row, value, series, period="2017-18", *, unit="persons", scale=1000000, source="lfs-a"):
    c = make_cell(source, row, 1, value, value, series=series, period=period, vintage="na")
    c.unit, c.scale_factor = unit, scale
    return c


def pes_cell(row, value, *, unit="persons", scale=1000000):
    c = make_cell("pes-x", row, 5, value, value, page=24)
    c.unit, c.scale_factor = unit, scale
    return c


# ---------------------------------------------------------------- the comparison itself

@pytest.mark.parametrize("ours,theirs,result", [
    ("65.50", "65.50", "pass"),
    ("65.50", "65.5", "pass"),
    ("5.79", "5.8", "pass_within_rounding"),       # 0.01 <= 0.005 + 0.05
    ("65.50", "65.51", "pass_within_rounding"),    # one unit of the last digit
    ("65.50", "65.52", "fail"),
    ("5.7", "5.8", "pass_within_rounding"),
    ("5.6", "5.8", "fail"),
])
def test_pair_check_rounding_rule(ours, theirs, result):
    chk = xs.cell_pair_check(dataset="lfs", rule_id="r", ours=lfs_cell(1, ours, "lfs.labour_force.total.total"),
                             theirs=pes_cell(1, theirs), what="Labour force", where_ours="A", where_theirs="B")
    assert chk.result == result and chk.check_type == "cross_source"
    assert chk.target_source == "pes-x" and len(chk.member_cell_ids) == 1


def test_pair_check_unparsed_is_not_evaluable():
    theirs = pes_cell(1, "65.50")
    theirs.value_raw, theirs.value_parsed = "65.50 66.10", None      # two numbers in one cell: never parsed
    chk = xs.cell_pair_check(dataset="lfs", rule_id="r", ours=lfs_cell(1, "65.50", "s"), theirs=theirs, what="x",
                             where_ours="A", where_theirs="B")
    assert chk.result == "not_evaluable"


def test_pairs_need_the_same_unit_and_scale():
    theirs = [(pes_cell(1, "65.50"), "labour_force", "total", "2017-18", "T")]
    ours_ok = lfs_cell(1, "65.50", "lfs.labour_force.total.total")
    ours_thousand = lfs_cell(2, "65500", "lfs.labour_force.total.total", scale=1000, source="lfs-b")
    other_round = lfs_cell(3, "63.39", "lfs.labour_force.total.total", period="2014-15")
    other_sex = lfs_cell(4, "50.74", "lfs.labour_force.male.total")
    checks, pairs = xs.pair_checks([ours_ok, ours_thousand, other_round, other_sex], theirs, CFG, {}, TITLES, "PES")
    assert len(checks) == 1 and checks[0].target_cell_id == ours_ok.cell_id and pairs[0]["result"] == "pass"
    wrong_unit = [(pes_cell(1, "65.50", unit="percent", scale=1), "labour_force", "total", "2017-18", "T")]
    assert xs.pair_checks([ours_ok], wrong_unit, CFG, {}, TITLES, "PES") == ([], [])


def test_agreement_publishes_a_figure_no_other_check_covers_and_a_disagreement_does_not():
    from datalab.datasets import lfs

    spec, labels = load_spec("lfs"), load_spec("lfs_labels")
    series = {s.series_id: s for s in lfs.series_catalogue(spec, labels, [])}
    ours = lfs_cell(1, "32.3", "lfs.lfpr_crude.total.total", unit="percent", scale=1)
    tier = lambda cells, checks: build_observations(cells, checks, series, {"lfs-a": "2017-18"}, TITLES, "v0")[0]
    assert tier([ours], []).tier == "C"                      # printed once, no check: withheld
    good = pes_cell(1, "32.3", unit="percent", scale=1)
    checks, _ = xs.pair_checks([ours], [(good, "lfpr_crude", "total", "2017-18", "T")], CFG, {}, TITLES, "PES")
    obs = tier([ours, good], checks)
    assert (obs.tier, obs.published, obs.primary_cell_id) == ("B", True, ours.cell_id)
    bad = pes_cell(1, "31.7", unit="percent", scale=1)
    checks, _ = xs.pair_checks([ours], [(bad, "lfpr_crude", "total", "2017-18", "T")], CFG, {}, TITLES, "PES")
    obs = tier([ours, bad], checks)
    assert (obs.tier, obs.published) == ("D", False)         # the only evidence is a disagreement


def test_the_chapters_cells_never_become_observations():
    from datalab.datasets import lfs

    spec, labels = load_spec("lfs"), load_spec("lfs_labels")
    series = {s.series_id: s for s in lfs.series_catalogue(spec, labels, [])}
    assert build_observations([pes_cell(1, "65.50")], [], series, {}, {}, "v0") == []


# ---------------------------------------------------------------- reading the chapter's tables

def test_header_key_joins_words_hyphenated_at_a_line_end():
    assert xs.header_key("Unemp- loyed Labour Force") == "unemployed labour force"
    assert xs.header_key("Crude  Activity Rate(%)") == "crude activity rate(%)"


ROWS_A = [["Mid Year", "2017-18", "2018-19"],
          ["Population", "200.00", "210.00"], ["Rural", "130.00", "135.00"], ["Urban", "70.00", "75.00"],
          ["Labour Force", "65.50", "68.75"], ["Rural", "42.91", "45.86"], ["Urban", "22.59", "22.89"],
          ["Employed Labour Force", "61.71", "64.03"], ["Rural", "40.75", "43.04"], ["Urban", "20.96", "20.99"],
          ["Unemployed Labour Force", "3.79", "4.72"], ["Rural", "2.16", "2.82"], ["Urban", "1.63", "1.90"],
          ["Unemployment Rate (%)", "5.8", "6.9"], ["Rural", "5.0", "6.4"], ["Urban", "7.2", "7.9"],
          ["Labour Force Partici- pation Rates (%)", "31.7", "32.3"], ["Rural", "33.0", "34.0"], ["Urban", "29.0", "30.0"]]


def read_a(rows, headers=None, write_doc=None):
    table = load_tables(write_doc([docling_table(rows)]))[0]
    cols = table.value_columns()
    headers = headers or {1: "2017-18", 2: "In million 2018-19"}
    labels = {r: row[0] for r, row in enumerate(rows)}
    return xs.read_measures_by_year(table, table.grid(), cols, headers, labels, BY_YEAR)


def test_measures_by_year_reads_only_the_blocks_it_can_name(write_doc):
    figures, problems = read_a(ROWS_A, write_doc=write_doc)
    assert problems == []
    got = {k: v.text for k, v in figures.items()}
    assert got[("labour_force", "total", "2017-18")] == "65.50" and got[("labour_force", "urban", "2018-19")] == "22.89"
    assert got[("unemployment_rate", "rural", "2017-18")] == "5.0" and got[("unemployed", "total", "2018-19")] == "4.72"
    assert len(got) == 4 * 3 * 2                               # four measures, three areas, two years
    # population and the participation rate (crude or refined is not printed) are never read
    assert "200.00" not in got.values() and "31.7" not in got.values() and "33.0" not in got.values()


def test_measures_by_year_an_unknown_row_closes_the_block(write_doc):
    rows = [ROWS_A[0], ["Labour Force", "65.50", "68.75"], ["Of which women", "14.76", "15.00"], ["Rural", "42.91", "45.86"]]
    figures, _ = read_a(rows, write_doc=write_doc)
    assert set(figures) == {("labour_force", "total", "2017-18"), ("labour_force", "total", "2018-19")}


@pytest.mark.parametrize("headers", [{1: "2017-18", 2: "Mid Year"}, {1: "2017-18", 2: "2017-18"},
                                     {1: "2017-18 2018-19", 2: "2018-19"}])
def test_measures_by_year_unreadable_headers_leave_the_table_unread(headers, write_doc):
    figures, problems = read_a(ROWS_A, headers, write_doc=write_doc)
    assert figures == {} and problems


def test_measures_by_year_two_blocks_with_one_name_leave_the_table_unread(write_doc):
    figures, problems = read_a(ROWS_A + [["Labour Force", "1.00", "2.00"]], write_doc=write_doc)
    assert figures == {} and "two cells claim" in problems[0]


ROWS_B = [["Years", "Pop", "Crude", "LF", "Unemp", "Emp", "Agri"],
          ["2014-15", "189.19", "32.3", "61.04", "3.62", "57.42", "24.27"],
          ["2017-18", "206.62", "31.7", "65.50", "3.79", "61.71", "23.76"],
          ["Source: PBS", "", "", "", "", "", ""]]
HEADERS_B = {1: "Popula- tion", 2: "Crude Activity Rate(%)", 3: "Labour Force", 4: "Unemp- loyed Labour Force",
             5: "Employed Labour Force", 6: "Agricul- ture"}


def read_b(headers, write_doc):
    table = load_tables(write_doc([docling_table(ROWS_B)]))[0]
    labels = {r: row[0] for r, row in enumerate(ROWS_B)}
    return xs.read_years_by_measure(table, table.grid(), table.value_columns(), headers, labels, BY_MEASURE)


def test_years_by_measure_maps_columns_by_their_whole_header(write_doc):
    figures, problems = read_b(HEADERS_B, write_doc)
    assert problems == []
    got = {k: v.text for k, v in figures.items()}
    assert got == {("lfpr_crude", "total", "2014-15"): "32.3", ("labour_force", "total", "2014-15"): "61.04",
                   ("unemployed", "total", "2014-15"): "3.62", ("employed", "total", "2014-15"): "57.42",
                   ("lfpr_crude", "total", "2017-18"): "31.7", ("labour_force", "total", "2017-18"): "65.50",
                   ("unemployed", "total", "2017-18"): "3.79", ("employed", "total", "2017-18"): "61.71"}


@pytest.mark.parametrize("change", [{3: "Labour"}, {4: "Labour Force"}, {5: "loyed Employed Labour Force"}])
def test_years_by_measure_a_header_that_is_not_exact_leaves_the_table_unread(change, write_doc):
    figures, problems = read_b({**HEADERS_B, **change}, write_doc)
    assert figures == {} and "needed exactly once" in problems[0]


def test_a_year_whose_own_identity_fails_is_not_used(write_doc):
    figures, _ = read_b(HEADERS_B, write_doc)
    assert xs.identity_problem_years(figures) == {}
    rows = [ROWS_B[0], ["2014-15", "189.19", "32.3", "61.04", "3.62", "57.92", "24.27"], ROWS_B[2]]
    table = load_tables(write_doc([docling_table(rows)]))[0]
    figures, _ = xs.read_years_by_measure(table, table.grid(), table.value_columns(), HEADERS_B,
                                          {r: row[0] for r, row in enumerate(rows)}, BY_MEASURE)
    assert list(xs.identity_problem_years(figures)) == ["2014-15"]


# ---------------------------------------------------------------- end to end on a generated PDF

def test_end_to_end_on_a_generated_pdf(tmp_path, monkeypatch):
    """A PDF drawn with PyMuPDF and a Docling-shaped JSON with the same boxes: located by title, read, compared."""
    monkeypatch.setenv("SOURCES_DIR", str(tmp_path / "src"))
    monkeypatch.setenv("WORK_DIR", str(tmp_path / "work"))
    rows = [["Mid Year", "2017-18", "2018-19"]] + ROWS_A[4:16]
    col_x, top, row_h = [60.0, 300.0, 400.0, 500.0], 150.0, 20.0
    pdf = tmp_path / "src" / "pes_chapter" / "2024-25" / "chapter.pdf"
    pdf.parent.mkdir(parents=True)
    doc = pymupdf.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    page.insert_text((60, 100), "TABLE 12.7", fontsize=9)
    page.insert_text((60, 115), "LABOUR FORCE AND EMPLOYMENT", fontsize=9)
    page.insert_text((450, 130), "In million", fontsize=9)
    for r, row in enumerate(rows):
        for k, text in enumerate(row):
            page.insert_text((col_x[k] + 6, top + r * row_h + 13), text, fontsize=9)
    doc.save(pdf)
    doc.close()

    run_id = "PES_2024-25__docling__full-document__run-01"
    run_dir = tmp_path / "work" / "runs" / run_id
    (run_dir / "raw").mkdir(parents=True)
    (run_dir / "raw" / "output.json").write_text(
        json.dumps(docling_doc([docling_table(rows, top=top, row_h=row_h, col_x=col_x)])), encoding="utf-8")
    run = RunManifest(run_id=run_id, source_id=CFG["source_id"], sha256_at_run=config.sha256_file(pdf),
                      run_mode="full-document", tool_versions={"docling": "test"}, config={}, config_sha256="0" * 64,
                      started_at="2026-01-01T00:00:00+00:00", validated=True)
    config.write_json(run_dir / "manifest.json", run.model_dump())
    source = Source(source_id=CFG["source_id"], doc_type="pes_chapter", publisher="Finance Division", jurisdiction="federal",
                    title="Economic Survey test chapter", period="2024-25", role="cross_source", retrieved_via="official",
                    sha256=config.sha256_file(pdf), size_bytes=pdf.stat().st_size, page_count=1,
                    local_path="pes_chapter/2024-25/chapter.pdf", verification_status="official_only",
                    verification_record="sources/verification/x.json")

    ours = [lfs_cell(1, "65.50", "lfs.labour_force.total.total"),
            lfs_cell(2, "22.59", "lfs.labour_force.total.urban"),
            lfs_cell(3, "5.79", "lfs.unemployment_rate.total.total", unit="percent", scale=1),
            lfs_cell(4, "4.71", "lfs.unemployed.total.total", period="2018-19"),      # the chapter prints 4.72
            lfs_cell(5, "64.50", "lfs.employed.total.total", period="2018-19"),       # the chapter prints 64.03
            lfs_cell(6, "50.74", "lfs.labour_force.male.total")]                      # no male figure in the chapter
    checks, pes_cells, info = xs.pes_labour_checks(ours, [source], CFG, {}, TITLES)
    assert info["status"] == "compared"
    table_a = info["tables"][0]
    assert (table_a["result"], table_a["page"], table_a["coverage"]) == ("read", 1, 1.0)
    assert info["tables"][1]["result"] == "not_located"
    results = {(p["series_id"], p["period"]): p["result"] for p in info["pairs"]}
    assert results == {("lfs.labour_force.total.total", "2017-18"): "pass",
                       ("lfs.labour_force.total.urban", "2017-18"): "pass",
                       ("lfs.unemployment_rate.total.total", "2017-18"): "pass_within_rounding",
                       ("lfs.unemployed.total.total", "2018-19"): "pass_within_rounding",
                       ("lfs.employed.total.total", "2018-19"): "fail"}
    assert len(checks) == 5 and len(pes_cells) == 5
    assert all(c.series_id is None and c.source_id == CFG["source_id"] and c.page == 1 for c in pes_cells)
    # the chapter's cell keeps its own place on the page (provenance of the evidence)
    lf = next(c for c in pes_cells if c.value_raw == "65.50")
    assert lf.row_label_raw == "Labour Force" and "2017-18" in lf.col_label_raw
    assert 0.5 < lf.cell_bbox_norm[0] < lf.cell_bbox_norm[2] < 0.67

    # a source that failed verification, or one with no validated run, is never compared
    failed = source.model_copy(update={"verification_status": "failed"})
    assert xs.pes_labour_checks(ours, [failed], CFG, {}, TITLES)[2]["status"] == "skipped"
    config.write_json(run_dir / "manifest.json", run.model_copy(update={"validated": False}).model_dump())
    assert xs.pes_labour_checks(ours, [source], CFG, {}, TITLES)[2]["status"] == "skipped"
