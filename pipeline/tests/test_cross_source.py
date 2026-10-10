"""Cross-source checks on synthetic inputs only."""
from __future__ import annotations

from datalab import config
from datalab.datasets import cross_source
from datalab.datasets.common import load_spec
from datalab.schema import Source
from datalab.status import build_observations

from test_cpi import TITLES, make_table, run

SBP_CFG = load_spec("cpi")["checks"]["cross_source_sbp"]
KEY = SBP_CFG["series_key"]
HEADER = '"Dataset","Series Key","Series","Observation Date","Observation Value","Unit","Observation Status","Observation Status Comment"\n'


def sbp_row(date: str, value: str, *, dataset: str = "Inflation Snapshot (New Base: 2015-16)", key: str = KEY,
            series: str = "CPI National -YoY", unit: str = "Percent") -> str:
    return f'"{dataset}","{key}","{series}","{date}","{value}","{unit}","Normal",""\n'


def sbp_source(tmp_path, text: str) -> tuple[Source, dict]:
    path = tmp_path / "sbp_easydata" / "2026-01-01" / "data_series.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    source = Source(source_id="sbp-test", doc_type="sbp_easydata", publisher="State Bank of Pakistan", jurisdiction="sbp",
                    title="SBP EasyData test", period="2026-01-01", role="cross_source",
                    file_url="https://example.invalid/apex/wwv_flow.accept", retrieved_at="2026-01-01T00:00:00Z",
                    retrieved_via="official", sha256=config.sha256_file(path), size_bytes=path.stat().st_size, format="csv",
                    local_path="sbp_easydata/2026-01-01/data_series.csv", verification_status="official_only",
                    verification_record="sources/verification/sbp-test.json")
    config.write_json(tmp_path / "verification" / "sbp-test.json", {"request": {"method": "POST"}})
    return source, {"sources_dir": tmp_path, "verification_dir": tmp_path / "verification"}


def test_easydata_rows_carry_their_row_number_and_series_key(tmp_path):
    source, _ = sbp_source(tmp_path, HEADER + sbp_row("30-Jun-2025", "25") + sbp_row("31-May-2025", "3.5")
                           + sbp_row("30-Jun-2025", "99.9", key="TS_OTHER", series="CPI Urban -YoY"))
    got = cross_source.read_easydata_series(tmp_path / source.local_path, SBP_CFG)
    assert got["problems"] == []
    assert got["rows"]["2025-06"] == {"value_raw": "25", "row": 2, "series_key": KEY, "observation_date": "30-Jun-2025"}
    assert got["rows"]["2025-05"]["row"] == 3 and "2025-06" in got["rows"] and len(got["rows"]) == 2


def test_easydata_series_on_another_base_or_unit_is_not_established(tmp_path):
    for bad in (sbp_row("30-Jun-2025", "25", dataset="Inflation Snapshot (Base: 2007-08)"),
                sbp_row("30-Jun-2025", "25", unit="Index"),
                sbp_row("30-Jun-2025", "25", series="CPI National - Food YoY"),
                sbp_row("30-Jun-2025", "25") + sbp_row("30-Jun-2025", "26")):
        source, _ = sbp_source(tmp_path, HEADER + bad)
        assert cross_source.read_easydata_series(tmp_path / source.local_path, SBP_CFG)["problems"]
    source, _ = sbp_source(tmp_path, HEADER)
    assert cross_source.read_easydata_series(tmp_path / source.local_path, SBP_CFG)["problems"]


def test_sbp_check_passes_with_provenance_and_lifts_the_tier(tmp_path):
    cells, meta = make_table(general=("200.00", "198.00", "160.04", "1.01", "24.97"),
                             group_rows=[("200.00", "198.00", "160.04", "1.01", "24.97")] * 12)
    source, where = sbp_source(tmp_path, HEADER + sbp_row("30-Jun-2025", "25.0"))
    checks, info = cross_source.sbp_cpi_checks(cells, [source], SBP_CFG, TITLES, **where)
    assert info["status"] == "compared" and len(checks) == 1 and checks[0].result == "pass_within_rounding"
    assert checks[0].target_source == "sbp-test" and checks[0].member_cell_ids == []
    # provenance of a figure with no page: series key, row of the file, request
    assert f"series {KEY}" in checks[0].description and "row 2 of data_series.csv" in checks[0].description
    assert "POST https://example.invalid/apex/wwv_flow.accept" in checks[0].description
    assert info["compared"][0]["sbp_row"] == 2 and info["compared"][0]["sbp_value_raw"] == "25.0"
    own, series, order = run(cells, meta)
    tiers = lambda extra: {o.obs_id: o.tier for o in build_observations(cells, own + extra, series, order, TITLES, "v0")}
    assert tiers([])["cpi.national.yoy.general:2025-06:na"] == "B"
    assert tiers(checks)["cpi.national.yoy.general:2025-06:na"] == "A"


def test_sbp_disagreement_is_a_recorded_fail_with_a_note_and_no_crash(tmp_path):
    """A failed check against a data file has no second cell; the receipt must still say what the other source gives."""
    cells, meta = make_table()
    source, where = sbp_source(tmp_path, HEADER + sbp_row("30-Jun-2025", "25.4"))
    checks, _ = cross_source.sbp_cpi_checks(cells, [source], SBP_CFG, TITLES, **where)
    assert checks[0].result == "fail"
    own, series, order = run(cells, meta)
    titles = {**TITLES, "sbp-test": "SBP EasyData test"}
    obs = {o.obs_id: o for o in build_observations(cells, own + checks, series, order, titles, "v0")}
    o = obs["cpi.national.yoy.general:2025-06:na"]
    assert o.tier == "B"                                  # never lifted by a source that disagrees
    assert "SBP EasyData test gives a different figure for this (25.4)" in o.notes
    assert "Differs from the figure given by the SBP EasyData test (25.4)." in o.evidence_summary   # named, not an id


def test_sbp_not_compared_when_the_definition_or_the_file_cannot_be_established(tmp_path):
    cells, _ = make_table()
    source, where = sbp_source(tmp_path, HEADER + sbp_row("30-Jun-2025", "25.0", dataset="Inflation Snapshot (Base: 2007-08)"))
    checks, info = cross_source.sbp_cpi_checks(cells, [source], SBP_CFG, TITLES, **where)
    assert checks == [] and info["status"] == "not_compared" and info["problems"]

    source, where = sbp_source(tmp_path, HEADER + sbp_row("30-Jun-2025", "25.0"))
    changed = source.model_copy(update={"sha256": "0" * 64})
    assert cross_source.sbp_cpi_checks(cells, [changed], SBP_CFG, TITLES, **where)[1]["status"] == "skipped"
    (tmp_path / source.local_path).unlink()
    assert cross_source.sbp_cpi_checks(cells, [source], SBP_CFG, TITLES, **where)[1]["status"] == "skipped"
    failed = source.model_copy(update={"verification_status": "failed"})
    assert cross_source.sbp_cpi_checks(cells, [failed], SBP_CFG, TITLES, **where)[1]["status"] == "skipped"
    assert cross_source.sbp_cpi_checks(cells, [], SBP_CFG, TITLES, **where)[1]["status"] == "skipped"
