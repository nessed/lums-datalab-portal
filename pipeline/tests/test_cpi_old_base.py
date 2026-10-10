"""CPI on the 2007-08 base (decision D27): naming, separation from the 2015-16 base, and an
end-to-end build on PDFs generated in the test.

The old-base table prints no national/urban/rural label. Its series are named by what is printed
(`cpi.general.b2007_08`, ...) and are never joined to `cpi.national.*` or `cpi.urban.*`.

No source file and no Docling: the PDFs are drawn with PyMuPDF in `tmp_path`, and the
Docling-shaped table JSON is laid out on the same grid the text is drawn on.
"""
from __future__ import annotations

import json
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import pytest

from datalab import config
from datalab.datasets import cpi
from datalab.datasets.common import LabelMap, load_spec
from datalab.schema import RunManifest, Source
from datalab.tables import load_tables

from conftest import PAGE_H, PAGE_W, docling_doc, docling_table
from test_cpi import TITLES, make_table, run

SPEC = load_spec("cpi")
LABELS = load_spec("cpi_labels")
GROUPS = [g["slug"] for g in SPEC["groups"]]
OLD = cpi.AREA_NOT_STATED
NOTE = ("The 2007-08 base CPI was compiled from urban centres only (to confirm against PBS methodology; "
        "not stated in the monthly issue)")


# ----------------------------------------------------------------------------- naming (D27)

def test_old_base_ids_carry_no_area_segment():
    assert cpi.series_id_for(OLD, "index", "general", "b2007_08") == "cpi.general.b2007_08"
    assert cpi.series_id_for(OLD, "index", "food", "b2007_08") == "cpi.group.food.b2007_08"
    assert cpi.series_id_for(OLD, "weight", "food", "b2007_08") == "cpi.weight.food.b2007_08"
    assert cpi.series_id_for(OLD, "yoy", "general", "b2007_08") == "cpi.yoy.general.b2007_08"
    assert cpi.series_id_for(OLD, "mom", "health", "b2007_08") == "cpi.mom.group.health.b2007_08"
    assert cpi.series_id_for(OLD, "weight", "general", "b2007_08") is None
    assert cpi.series_id_for(OLD, "impact_yoy", "food", "b2007_08") is None


def test_old_base_catalogue_states_what_is_printed_and_nothing_more():
    catalogue = cpi.series_catalogue(SPEC)
    old = [s for s in catalogue if s.series_id.endswith(".b2007_08")]
    assert len(old) == 13 * 3 + 12                                  # index, yoy, mom for 13 rows; 12 weights
    for s in old:
        assert s.series_id.split(".")[1] not in ("national", "urban", "rural")
        assert "area" not in s.dims and s.dims["area_as_printed"] == "none stated"
        assert s.dims["base_year"] == "2007-08"
        assert s.definition_status == "draft" and s.notes == NOTE
        assert [(b.at_period, b.kind) for b in s.breaks] == [("2019-08", "rebase")]
        assert "National" not in s.name and "Urban" not in s.name
        assert s.parent_id is None or s.parent_id.endswith(".b2007_08")
    # the first run's naming is gone, and nothing on the 2015-16 base lost its area
    ids = {s.series_id for s in catalogue}
    assert not any(i.startswith(("cpi.national.", "cpi.urban.", "cpi.rural.")) and i.endswith("b2007_08") for i in ids)
    assert all(s.dims.get("area") in ("national", "urban", "rural") and not s.notes for s in catalogue if s not in old)
    # the old-base block sorts after every 2015-16 series (its own segment on the site)
    assert min(s.sort_key for s in old) > max(s.sort_key for s in catalogue if s not in old)


def test_unlabelled_caption_is_never_read_as_national():
    caps = cpi.find_captions({5: "Table 2 : Consumer Price Index by Group of Commodities and Services (Base 2007-08)"}, SPEC)
    assert [(c["area"], c["base_year"]) for c in caps] == [(OLD, "2007-08")]
    # an issue on the new base that printed an unlabelled table would locate nothing
    _, problems, _ = cpi.locate([], caps, cpi.rebase_side("2025-06", SPEC), SPEC)
    assert set(problems) == {"national", "urban", "rural"}


def test_old_base_expected_figures_and_gaps_use_the_new_ids_only():
    class Src:
        source_id, period, title = "cpi-old", "2016-06", "Monthly Review of Price Indices, June 2016"

    series = {s.series_id: s for s in cpi.series_catalogue(SPEC)}
    gaps = cpi.gap_observations(SPEC, [Src], {}, {f"cpi-old:{OLD}": "No validated extraction run exists"}, [], series)
    assert len(gaps) == 13 * 5 + 12
    assert all(g.series_id.endswith(".b2007_08") and g.series_id.split(".")[1] not in ("national", "urban", "rural")
               and g.gap_kind == "not_yet_verified" and g.value is None for g in gaps)
    assert {g.period for g in gaps} == {"2016-06", "2016-05", "2015-06"}


def test_old_base_is_never_paired_with_the_new_base_or_with_sbp():
    old_cells, old_meta = make_old_table("cpi-a", "2019-06")
    new_cells, new_meta = make_table("cpi-b", "2020-06")            # prints June 2019 as "same month last year"
    checks, _, _ = run(old_cells + new_cells, {**old_meta, **new_meta})
    assert [c for c in checks if c.check_type == "cross_edition"] == []
    # SBP's national YoY is compared with `cpi.national.yoy.general` only
    assert cpi.cross_source_checks(old_cells, {"2019-06": "25.0"}, "sbp", SPEC["checks"]["cross_source_sbp"], TITLES) == []


def test_old_base_cross_edition_pairs_two_old_issues():
    a_cells, a_meta = make_old_table("cpi-a", "2018-06")
    b_row = ("230.00", "228.00", "200.00", "0.88", "15.00")        # prints June 2018 = 200.00 again
    b_cells, b_meta = make_old_table("cpi-b", "2019-06", general=b_row, group_rows=[b_row] * 12)
    checks, _, _ = run(a_cells + b_cells, {**a_meta, **b_meta})
    ce = [c for c in checks if c.check_type == "cross_edition"]
    assert len(ce) == 13 and all(c.result == "pass" for c in ce)
    assert "CPI table (no area stated)" in next(c for c in checks if c.check_type == "weights_sum").description


def make_old_table(source: str, issue: str, **kw):
    """`test_cpi.make_table` cells re-filed the way the builder files an old-base table."""
    cells, meta = make_table(source, issue, **kw)
    for c in cells:
        m = meta[c.cell_id]
        m.update(area=OLD, base_tag="b2007_08", base_year="2007-08")
        c.series_id = cpi.series_id_for(OLD, m["role"], m["row"], "b2007_08")
        if c.series_id is None:
            c.period = c.vintage = None
    return cells, meta


# ----------------------------------------------------------------------------- label variants seen in the old issues

@pytest.mark.parametrize("label,key", [
    ("Food & Non-alcoholic Bev.", "food"),
    ("1 Food & Non-alcoholic Beverages", "food"),
    ("Alcoholic Bev.& Tobacco", "alcohol_tobacco"),
    ("Alcoholic Bev. & Tobacco", "alcohol_tobacco"),
    ("Housing, Water, Electricity, Gas & Fuels", "housing_utilities"),
    ("Furnishing & Household Equipment Maintenance", "furnishing_household"),
    ("Furnishing & Household Equipment Maint.", "furnishing_household"),
])
def test_old_base_label_variants(label, key):
    assert LabelMap(LABELS["labels"]).lookup(label) == (key, "dictionary")


@pytest.mark.parametrize("label", ["Housing, Water, Electricity,", "Gas & Fuels", "Furnishing & Household",
                                   "Equipment Maintenance", "Non-perishable Food Items", "Food"])
def test_old_base_label_fragments_map_nothing(label):
    assert LabelMap(LABELS["labels"]).lookup(label)[0] is None


# ----------------------------------------------------------------------------- end to end on generated PDFs

WEIGHTS = ["34.83", "1.41", "7.57", "29.41", "4.21", "2.19", "7.20", "3.22", "2.03", "3.94", "1.23", "2.76"]
ROW_LABELS = ["Food & Non-alcoholic Bev.", "Alcoholic Bev.& Tobacco", "Clothing & Footwear",
              "Housing, Water, Electricity, Gas & Fuels", "Furnishing & Household Equipment Maint.", "Health", "Transport",
              "Communication", "Recreation & Culture", "Education", "Restaurants & Hotels", "Miscellaneous"]
COL_X = [20.0, 40.0, 200.0, 250.0, 300.0, 350.0, 400.0, 450.0, 500.0, 550.0, 590.0]
TOP, ROW_H, FONT = 150.0, 22.0, 7.0
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November",
          "December"]


def q2(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def synthetic_index(group: int, period: str) -> Decimal:
    """A made-up index level for a group and a month; the same in every issue that prints that month."""
    months = int(period[:4]) * 12 + int(period[5:7]) - 2008 * 12
    return (Decimal(100) + Decimal(months) * (Decimal("0.61") + Decimal(group) * Decimal("0.07"))).quantize(Decimal("0.01"))


def table_rows(issue: str, *, wrong_index: bool = False) -> tuple[list[list[str]], list[str]]:
    """Header row + General + 12 groups (+ the two food sub-rows), all internally consistent."""
    periods = [issue, cpi.month_add(issue, -1), cpi.month_add(issue, -12)]
    body: list[list[str]] = []
    for g, (label, weight) in enumerate(zip(ROW_LABELS, WEIGHTS), start=1):
        a, b, c = (synthetic_index(g, p) for p in periods)
        mom, yoy = q2((a / b - 1) * 100), q2((a / c - 1) * 100)      # printed from the true index
        if wrong_index and g == 6:
            a += Decimal("25.00")                                  # a misread index: 3 checks must catch it
        body.append([f"{g}.", label, weight, q2(a), q2(b), q2(c), mom, yoy, "0.01", "0.11"])
    general = []
    for k in (3, 4, 5):
        general.append(sum((Decimal(w) * Decimal(r[k]) for w, r in zip(WEIGHTS, body)), Decimal(0)) / 100)
    if wrong_index:  # the general row is what the publisher printed from the true group indices
        true = synthetic_index(6, issue)
        general[0] = general[0] - Decimal(WEIGHTS[5]) * Decimal("25.00") / 100
        assert Decimal(body[5][3]) - true == Decimal("25.00")
    ga, gb, gc = (Decimal(q2(v)) for v in general)
    rows = [["", "General", "100.00", q2(ga), q2(gb), q2(gc), q2((ga / gb - 1) * 100), q2((ga / gc - 1) * 100), "0.50", "5.00"]]
    rows.append(body[0])
    rows.append(["", "Non-perishable Food Items", "29.84", "201.10", "200.20", "190.30", "0.45", "5.68", "0.13", "1.60"])
    rows.append(["", "Perishable Food Items", "4.99", "190.40", "195.10", "170.90", "-2.41", "11.41", "-0.12", "0.55"])
    rows.extend(body[1:])
    header_months = [periods[0], periods[1], periods[2], periods[1], periods[2], periods[1], periods[2]]
    header = ["No", "Group", "Weight (%)"] + [f"{MONTHS[int(p[5:7]) - 1]} {p[:4]}" for p in header_months]
    return [header] + rows, header_months


def write_issue(tmp: Path, source_id: str, issue: str, *, caption_area: str = "", swap_header: bool = False,
                wrong_index: bool = False) -> tuple[Path, Path]:
    """Draw one issue (a text page and the CPI table page) and write the matching table JSON."""
    import pymupdf

    rows, header_months = table_rows(issue, wrong_index=wrong_index)
    printed_months = list(header_months)
    if swap_header:  # the two comparison indices printed in the other order: must map nothing
        printed_months[1], printed_months[2] = printed_months[2], printed_months[1]
    doc = pymupdf.open()
    cover = doc.new_page(width=PAGE_W, height=PAGE_H)
    cover.insert_text((60, 100), f"Monthly Review of Price Indices, {MONTHS[int(issue[5:7]) - 1]} {issue[:4]} (synthetic test file)",
                      fontsize=10)
    page = doc.new_page(width=PAGE_W, height=PAGE_H)

    def put(x: float, y: float, text: str) -> None:
        page.insert_text((x, y), text, fontsize=FONT)

    put(60, 100, f"Table 2 : Consumer Price Index {caption_area}by Group of Commodities and Services (Base 2007-08)")
    issue_words = f"{MONTHS[int(issue[5:7]) - 1]} {issue[:4]} Over"
    put(COL_X[4] + 4, TOP - 18, "Indices")
    put(COL_X[6] + 4, TOP - 18, "% Change")
    put(COL_X[6] + 4, TOP - 8, issue_words)
    put(COL_X[8] + 4, TOP - 18, "Impact")
    put(COL_X[8] + 4, TOP - 8, issue_words)
    put(COL_X[0] + 2, TOP + 9, "No")
    put(COL_X[1] + 4, TOP + 9, "Group")
    put(COL_X[2] + 4, TOP + 9, "Weight")
    put(COL_X[2] + 4, TOP + 19, "(%)")
    for k, p in enumerate(printed_months, start=3):                # "June" printed above "2018"
        put(COL_X[k] + 4, TOP + 9, MONTHS[int(p[5:7]) - 1])
        put(COL_X[k] + 4, TOP + 19, p[:4])
    for r, row in enumerate(rows[1:], start=1):
        for k, text in enumerate(row):
            if text:
                put(COL_X[k] + (2 if k == 0 else 4), TOP + r * ROW_H + 14, text)
    pdf = tmp / f"{source_id}.pdf"
    doc.save(pdf)
    doc.close()
    out = tmp / f"{source_id}.json"
    table = docling_table([[t or None for t in row] if i else row for i, row in enumerate(rows)], page=2, top=TOP,
                          row_h=ROW_H, col_x=COL_X)
    out.write_text(json.dumps(docling_doc([table], pages=2)), encoding="utf-8")
    return pdf, out


def source(source_id: str, issue: str) -> Source:
    return Source(source_id=source_id, doc_type="cpi_monthly_review", publisher="Pakistan Bureau of Statistics", jurisdiction="pbs",
                  title=f"Monthly Review of Price Indices, {MONTHS[int(issue[5:7]) - 1]} {issue[:4]}", period=issue, role="core",
                  retrieved_via="official", sha256="0" * 64, size_bytes=1, page_count=2, local_path=f"{source_id}.pdf",
                  verification_status="official_only", verification_record="synthetic")


def build_from(tmp_path: Path, monkeypatch, issues: dict[str, dict]) -> dict[str, list[dict]]:
    """Run `cpi.build` over generated issues. `issues` = {source_id: {issue, **write_issue options}}."""
    files = {sid: write_issue(tmp_path, sid, **opts) for sid, opts in issues.items()}
    sources = [source(sid, opts["issue"]) for sid, opts in issues.items()]

    def fake_tables(src: Source):
        manifest = RunManifest(run_id=f"CPI_{src.period}__docling__full-document__run-01", source_id=src.source_id,
                               sha256_at_run="0" * 64, run_mode="full-document", tool_versions={"docling": "test"}, config={},
                               config_sha256="0" * 64, started_at="2026-10-12T00:00:00Z", validated=True)
        return manifest, load_tables(files[src.source_id][1])

    monkeypatch.setenv("WORK_DIR", str(tmp_path / "work"))
    monkeypatch.setattr(cpi, "read_manifest", lambda: sources)
    monkeypatch.setattr(cpi, "source_path", lambda src: files[src.source_id][0])
    monkeypatch.setattr(cpi, "validated_tables", fake_tables)
    cpi.build("v-test")
    d = config.work_dir() / "datasets" / "cpi"
    return {name: json.loads((d / f"{name}.json").read_text(encoding="utf-8"))
            for name in ("cells", "checks", "series", "observations", "coverage", "info")}


def by_type(checks: list[dict], kind: str) -> list[dict]:
    return [c for c in checks if c["check_type"] == kind]


def test_end_to_end_two_old_base_issues(tmp_path, monkeypatch):
    out = build_from(tmp_path, monkeypatch, {"cpi-t-2018-06": {"issue": "2018-06"}, "cpi-t-2019-06": {"issue": "2019-06"}})
    info = out["info"]
    assert set(info["located"]) == {f"cpi-t-2018-06:{OLD}", f"cpi-t-2019-06:{OLD}"} and info["not_located"] == {}
    for t in info["located"].values():
        assert t["page"] == 2 and t["base_year"] == "2007-08" and t["base_confirmed"]
        assert t["table_flags"] == [] and t["column_problems"] == [] and t["unmapped_labels"] == [] and t["ambiguous_labels"] == []
        assert len(t["rows_mapped"]) == 13 and len(t["not_targeted_rows"]) == 2
        assert [c["role"] for c in t["columns"].values()] == ["weight", "index", "index", "index", "mom", "yoy", "impact_mom",
                                                              "impact_yoy"]
        assert t["coverage"]["coverage"] == 1.0
    cols_2019 = info["located"][f"cpi-t-2019-06:{OLD}"]["columns"]
    assert [c["period"] for c in cols_2019.values()][:6] == ["2019-06", "2019-06", "2019-05", "2018-06", "2019-06", "2019-06"]
    assert cols_2019["5"]["month_printed"] == "June 2018"          # "June" above "2018", read by position

    # checks, each kind on its own
    checks = out["checks"]
    assert [c["result"] for c in by_type(checks, "weights_sum")] == ["pass", "pass"]
    assert len(by_type(checks, "index_aggregation")) == 6 and len(by_type(checks, "recompute")) == 52
    assert len(by_type(checks, "cross_edition")) == 13             # June 2018, general + 12 groups
    assert all(c["result"] in ("pass", "pass_within_rounding") for c in checks)

    # every series is an old-base series named by what is printed; none claims an area
    ids = {s["series_id"] for s in out["series"]}
    assert len(ids) == 13 * 3 + 12 and all(i.endswith(".b2007_08") for i in ids)
    assert not any(part in i.split(".") for i in ids for part in ("national", "urban", "rural"))
    assert all(s["dims"]["area_as_printed"] == "none stated" and "area" not in s["dims"] and s["notes"] == NOTE
               and s["breaks"][0]["at_period"] == "2019-08" for s in out["series"])

    obs = {o["obs_id"]: o for o in out["observations"]}
    assert all(o["published"] and o["status"] == "checked" for o in obs.values())
    assert len(obs) == 2 * (13 * 5 + 12) - 13                      # June 2018 is printed twice, one observation
    assert sum(o["tier"] == "A" for o in obs.values()) == 13
    june18 = obs["cpi.general.b2007_08:2018-06:na"]
    assert june18["tier"] == "A" and len(june18["supporting_cell_ids"]) == 1
    cells = {c["cell_id"]: c for c in out["cells"]}
    primary = cells[june18["primary_cell_id"]]
    assert primary["source_id"] == "cpi-t-2018-06" and primary["value_raw"] == june18["value"] and primary["page"] == 2
    assert primary["col_label_raw"] == "Indices: June 2018"
    # a % change belongs to the issue month, not to the month named in its column header
    yoy = cells[obs["cpi.yoy.general.b2007_08:2019-06:na"]["primary_cell_id"]]
    assert yoy["col_label_raw"] == "% Change over: June 2018" and yoy["period"] == "2019-06"
    # impact columns and the food sub-rows are read but never mapped
    assert not any(c["series_id"] for c in out["cells"] if c["row_label_raw"].endswith("Food Items"))
    assert not any(c["series_id"] for c in out["cells"] if c["col_label_raw"].startswith("Impact"))


def test_end_to_end_swapped_header_months_publish_nothing(tmp_path, monkeypatch):
    out = build_from(tmp_path, monkeypatch, {"cpi-t-2016-06": {"issue": "2016-06", "swap_header": True}})
    t = out["info"]["located"][f"cpi-t-2016-06:{OLD}"]
    assert "column_unmapped" in t["table_flags"] and len(t["column_problems"]) == 2
    assert not any(c["series_id"] for c in out["cells"]) and out["checks"] == []
    assert len(out["observations"]) == 13 * 5 + 12
    assert all(not o["published"] and o["value"] is None and o["gap_kind"] == "not_yet_verified"
               and "could not be confirmed by code" in o["gap_reason"] for o in out["observations"])


def test_end_to_end_table_labelled_with_an_area_is_not_taken_for_the_old_base_table(tmp_path, monkeypatch):
    out = build_from(tmp_path, monkeypatch, {"cpi-t-2016-06": {"issue": "2016-06", "caption_area": "(Urban) "}})
    assert out["info"]["located"] == {} and out["cells"] == []
    assert list(out["info"]["not_located"]) == [f"cpi-t-2016-06:{OLD}"]
    assert all(not o["published"] and o["series_id"].endswith(".b2007_08") for o in out["observations"])


def test_end_to_end_misread_index_fails_its_checks(tmp_path, monkeypatch):
    out = build_from(tmp_path, monkeypatch, {"cpi-t-2016-06": {"issue": "2016-06", "wrong_index": True}})
    failed = [c for c in out["checks"] if c["result"] == "fail"]
    # the general index for the issue month no longer aggregates; the Health row's two % changes no longer recompute
    assert sorted(c["check_type"] for c in failed) == ["index_aggregation", "recompute", "recompute"]
    assert out["info"]["check_pass_rates"]["index_aggregation"]["fail"] == 1
