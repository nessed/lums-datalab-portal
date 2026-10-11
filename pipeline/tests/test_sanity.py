"""`datalab sanity` (E6): a report from a release folder only, which never changes anything."""
from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from pathlib import Path

from datalab import sanity
from datalab.checks import EQUAL_RULE_TEXT, SUM_RULE_TEXT


def series(sid: str, dataset: str = "abs", frequency: str = "fiscal_year", unit: str = "PKR", breaks=None) -> dict:
    return {"series_id": sid, "name": sid, "dataset": dataset, "frequency": frequency, "unit": unit, "breaks": breaks or [],
            "derived": False}


def obs(sid: str, period: str, value: str | None, vintage: str = "be", **extra) -> dict:
    published = value is not None
    return {"obs_id": f"{sid}:{period}:{vintage}", "series_id": sid, "period": period, "vintage": vintage, "value": value,
            "published": published, "status": "checked" if published else "unchecked", "tier": "B" if published else None,
            "gap_kind": None if published else "not_yet_verified", "primary_cell_id": None, "supporting_cell_ids": [],
            "check_ids": [], "disputed_readings": [], **extra}


def cell(cid: str, source: str, parsed: str | None, *, raw: str | None = None, series_id: str | None = None, page: int = 3,
         flags=None, missing: bool = False) -> dict:
    return {"cell_id": cid, "source_id": source, "page": page, "value_raw": raw if raw is not None else (parsed or ""),
            "value_parsed": parsed, "series_id": series_id, "normalization_flags": flags or [], "is_missing": missing}


def check(cid: str, result: str, residual: str | None, rule: str, *, target: str | None = None, members=(), check_type="column_total") -> dict:
    return {"check_id": cid, "check_type": check_type, "dataset": "abs", "rule_id": "test.rule", "source_ids": ["doc-a"],
            "member_cell_ids": list(members), "target_cell_id": target, "residual": residual, "tolerance_rule": rule, "result": result}


def by_id(series_list: list[dict]) -> dict:
    return {s["series_id"]: s for s in series_list}


def test_receipt_path_replaces_the_colons():
    assert sanity.receipt_path("fed.exp.total:2025-26:be") == "/o/fed.exp.total~2025-26~be"


def test_earlier_periods_by_frequency():
    assert sanity.earlier_periods("2025-26", "fiscal_year", []) == [("2024-25", "year on year")]
    assert sanity.earlier_periods("2000-01", "fiscal_year", []) == [("1999-00", "year on year")]
    assert sanity.earlier_periods("2026-06", "month", []) == [("2026-05", "month on month"), ("2025-06", "year on year")]
    assert sanity.earlier_periods("2026-01", "month", [])[0] == ("2025-12", "month on month")
    # survey rounds are not yearly: the round before is the one the data type holds
    assert sanity.earlier_periods("2020-21", "survey_round", ["2014-15", "2018-19", "2020-21"]) == [("2018-19", "round on round")]
    assert sanity.earlier_periods("2014-15", "survey_round", ["2014-15", "2018-19"]) == []


def test_large_change_is_listed_and_a_small_one_is_not():
    s = by_id([series("a.big"), series("a.small")])
    o = [obs("a.big", "2023-24", "100"), obs("a.big", "2024-25", "151"),
         obs("a.small", "2023-24", "100"), obs("a.small", "2024-25", "150")]   # exactly 50% is not "above 50%"
    out = sanity.period_changes(o, s)
    assert [r["later_obs"] for r in out["large"]] == ["a.big:2024-25:be"]
    assert out["large"][0]["change"] == Decimal("0.51")
    assert out["compared"] == 2 and out["no_earlier_figure"] == 2


def test_a_fall_of_more_than_half_is_listed_too():
    out = sanity.period_changes([obs("a.x", "2023-24", "100"), obs("a.x", "2024-25", "40")], by_id([series("a.x")]))
    assert out["large"][0]["change"] == Decimal("-0.6")


def test_sign_change_is_listed_even_when_small_and_zero_is_handled():
    s = by_id([series("a.sign"), series("a.zero")])
    o = [obs("a.sign", "2023-24", "-1"), obs("a.sign", "2024-25", "1.2"),
         obs("a.zero", "2023-24", "0"), obs("a.zero", "2024-25", "7"), obs("a.zero", "2025-26", "0")]
    out = sanity.period_changes(o, s)
    assert [r["later_obs"] for r in out["sign_changes"]] == ["a.sign:2024-25:be"]
    assert [r["later_obs"] for r in out["from_zero"]] == ["a.zero:2024-25:be"]   # no division by zero
    assert "a.zero:2025-26:be" in [r["later_obs"] for r in out["large"]]         # 7 to 0 is a 100% fall


def test_vintages_are_never_mixed_and_unpublished_figures_are_not_compared():
    s = by_id([series("a.v")])
    o = [obs("a.v", "2023-24", "100", "be"), obs("a.v", "2024-25", "900", "re"),   # different vintage: no pair
         obs("a.v", "2024-25", None, "be")]                                           # unpublished: no pair
    out = sanity.period_changes(o, s)
    assert out["compared"] == 0 and out["large"] == []


def test_a_gap_year_is_not_bridged():
    out = sanity.period_changes([obs("a.g", "2021-22", "1"), obs("a.g", "2023-24", "100")], by_id([series("a.g")]))
    assert out["compared"] == 0 and out["large"] == []


def test_no_comparison_across_a_series_break_and_the_skip_is_reported():
    brk = [{"at_period": "2011-12", "kind": "devolution", "note": "n"}]
    s = by_id([series("a.b", breaks=brk)])
    o = [obs("a.b", "2009-10", "100"), obs("a.b", "2010-11", "101"), obs("a.b", "2011-12", "5"), obs("a.b", "2012-13", "6")]
    out = sanity.period_changes(o, s)
    assert out["large"] == []                       # 101 -> 5 would be a 95% fall, but it crosses the break
    assert out["compared"] == 2                     # 2009-10/2010-11 and 2011-12/2012-13
    assert out["skipped_at_breaks"] == [{"dataset": "abs", "at_period": "2011-12", "kind": "devolution", "earlier": "2010-11",
                                         "later": "2011-12", "comparisons": 1, "series": 1}]


def test_monthly_series_break_between_months():
    brk = [{"at_period": "2019-08", "kind": "rebase", "note": "n"}]
    s = by_id([series("c.i", dataset="cpi", frequency="month", unit="index", breaks=brk)])
    o = [obs("c.i", "2019-06", "100", "na"), obs("c.i", "2020-06", "300", "na"), obs("c.i", "2020-05", "290", "na")]
    out = sanity.period_changes(o, s)
    assert out["large"] == [] and out["skipped_at_breaks"][0]["comparisons"] == 1
    assert out["compared"] == 1                     # May 2020 to June 2020 is on one side of the break


def test_survey_rounds_compare_with_the_round_before():
    s = by_id([series("l.u", dataset="lfs", frequency="survey_round", unit="percent")])
    o = [obs("l.u", "2014-15", "5.0", "na"), obs("l.u", "2017-18", "9.0", "na")]
    out = sanity.period_changes(o, s)
    assert out["large"][0]["kind"] == "round on round" and out["large"][0]["earlier_obs"] == "l.u:2014-15:na"


def test_presence_groups_series_by_the_documents_that_do_not_print_them():
    s = by_id([series("a.all"), series("a.some"), series("a.other")])
    cells = [cell("c1", "doc-a", "1", series_id="a.all"), cell("c2", "doc-b", "1", series_id="a.all"),
             cell("c3", "doc-a", "1", series_id="a.some"),
             cell("c4", "doc-b", None, series_id="a.some", missing=True),      # a dash is not a printing of a figure
             cell("c5", "doc-c", "9"),                                          # unmapped: doc-c prints no series
             cell("c6", "doc-b", "2", series_id="a.other")]
    out = sanity.presence(cells, s)["abs"]
    assert out["documents"] == ["doc-a", "doc-b"]
    assert out["series_in_every_document"] == 1 and out["series_absent_somewhere"] == 2
    assert {tuple(p["absent_from"]): p["series"] for p in out["patterns"]} == {("doc-b",): ["a.some"], ("doc-a",): ["a.other"]}


def test_sum_bound_is_half_a_unit_per_member():
    cells = {c["cell_id"]: c for c in [cell("t", "doc-a", "10.0"), cell("m1", "doc-a", "3.3"), cell("m2", "doc-a", "3.3"),
                                       cell("m3", "doc-a", "3.3")]}
    bound, origin = sanity.tolerance_bound(check("k", "pass_within_rounding", "-0.1", SUM_RULE_TEXT, target="t", members=["m1", "m2", "m3"]), cells)
    assert bound == Decimal("0.15") and origin == "0.5 x members x unit"


def test_other_bounds():
    cells = {c["cell_id"]: c for c in [cell("a", "doc-a", "12.34"), cell("b", "doc-b", "12.3")]}
    assert sanity.tolerance_bound(check("k", "pass_within_rounding", "0.04", EQUAL_RULE_TEXT, target="a", members=["b"]), cells)[0] == Decimal("0.1")
    assert sanity.tolerance_bound(check("k", "pass_within_rounding", "0.04", "Absolute tolerance 0.05."), cells)[0] == Decimal("0.05")
    assert sanity.tolerance_bound(check("k", "pass_within_rounding", "0.004", "Recomputed value must be within 0.008862 of the printed value."), cells)[0] == Decimal("0.008862")
    assert sanity.tolerance_bound(check("k", "pass_within_rounding", "0.03", "|ours - theirs| <= half a unit of the last printed digit of each figure"), cells)[0] is None


def test_near_tolerance_lists_only_within_rounding_checks_above_80_percent():
    cells = {c["cell_id"]: c for c in [cell("t", "doc-a", "100"), *(cell(f"m{i}", "doc-a", "10") for i in range(10))]}
    members = [f"m{i}" for i in range(10)]                                     # allowance 0.5 x 10 x 1 = 5
    checks = [check("k_near", "pass_within_rounding", "-4.5", SUM_RULE_TEXT, target="t", members=members),
              check("k_at_80", "pass_within_rounding", "4", SUM_RULE_TEXT, target="t", members=members),   # exactly 80%: not above
              check("k_far", "pass_within_rounding", "1", SUM_RULE_TEXT, target="t", members=members),
              check("k_exact", "pass", "0", SUM_RULE_TEXT, target="t", members=members),
              check("k_fail", "fail", "9", SUM_RULE_TEXT, target="t", members=members),
              check("k_nobound", "pass_within_rounding", "0.03", "some other rule", target="t", check_type="cross_source")]
    observations = [obs("a.x", "2024-25", "100", check_ids=["k_near"])]
    out = sanity.near_tolerance(checks, cells, observations)
    assert [r["check_id"] for r in out["near"]] == ["k_near"]
    assert out["near"][0]["share"] == Decimal("0.9") and out["near"][0]["obs_id"] == "a.x:2024-25:be"
    assert [r["check_id"] for r in out["unbounded"]] == ["k_nobound"]
    assert out["by_type"]["column_total"] == {"within_rounding": 3, "near": 1}


def test_flagged_cells_only_behind_published_values_grouped_by_flag():
    cells = {c["cell_id"]: c for c in [
        cell("p1", "doc-a", "-40", raw="(40)", flags=["bracket_negative"]),
        cell("s1", "doc-b", "-40", raw="−40*", flags=["unicode_minus", "footnote_mark_stripped"]),
        cell("u1", "doc-a", "-7", raw="(7)", flags=["bracket_negative"]),       # behind an unpublished figure
        cell("clean", "doc-a", "5")]}
    observations = [obs("a.x", "2024-25", "-40", primary_cell_id="p1", supporting_cell_ids=["s1", "clean"]),
                    obs("a.y", "2024-25", None, primary_cell_id="u1")]
    out = sanity.flagged_published_cells(observations, cells)
    assert sorted(out) == ["bracket_negative", "footnote_mark_stripped", "unicode_minus"]
    assert [r["cell_id"] for r in out["bracket_negative"]] == ["p1"]
    assert out["unicode_minus"][0]["role"] == "supporting"


def _write_release(folder: Path) -> None:
    brk = [{"at_period": "2011-12", "kind": "devolution", "note": "n"}]
    all_series = [series("a.jump", breaks=brk), series("a.steady", breaks=brk)]
    cells = [cell("t", "doc-a", "100", series_id="a.steady"), cell("m1", "doc-a", "50", series_id="a.jump"),
             cell("m2", "doc-a", "49", raw="(49) | x", series_id="a.jump", flags=["bracket_negative"]),
             cell("d1", "doc-a", "7", raw="7"), cell("d2", "doc-b", "9", raw="9")]
    observations = [
        obs("a.jump", "2023-24", "10", primary_cell_id="m1", check_ids=["k1"]),
        obs("a.jump", "2024-25", "49", primary_cell_id="m2", check_ids=["k1"]),
        obs("a.steady", "2010-11", "100", primary_cell_id="t"), obs("a.steady", "2011-12", "3", primary_cell_id="t"),
        {**obs("a.steady", "2024-25", None), "status": "disputed", "gap_kind": "disputed",
         "disputed_readings": [{"cell_id": "d1", "source_id": "doc-a", "page": 3, "value_raw": "7", "value_parsed": "7"},
                               {"cell_id": "d2", "source_id": "doc-b", "page": 4, "value_raw": "9", "value_parsed": "9"}]},
    ]
    checks = [check("k1", "pass_within_rounding", "-1", SUM_RULE_TEXT, target="t", members=["m1", "m2"])]
    files = {"release": {"version": "v-test", "created_at": "2031-02-03T04:05:06+00:00", "git_commit": "abcdef0123456789"},
             "sources": [{"source_id": "doc-a"}, {"source_id": "doc-b"}], "series": all_series, "observations": observations,
             "cells": cells, "checks": checks}
    for name, content in files.items():
        (folder / f"{name}.json").write_text(json.dumps(content), encoding="utf-8")


def _digest(folder: Path) -> dict[str, str]:
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.iterdir())}


def test_report_is_written_from_the_release_folder_and_changes_nothing(tmp_path):
    release_dir, out_dir = tmp_path / "release", tmp_path / "reports"
    release_dir.mkdir()
    _write_release(release_dir)
    before = _digest(release_dir)
    path = sanity.write_sanity_report(release_dir=release_dir, out_dir=out_dir)
    assert path == out_dir / "sanity_2031-02-03.md"            # named after the release date, not today
    assert _digest(release_dir) == before                        # report only: the release is untouched
    text = path.read_text(encoding="utf-8")
    for heading in ("## 1. Large changes", "## 2. Series that some documents", "## 3. Checks that passed only just",
                    "## 4. Published figures whose printed text", "## 5. Disputed figures", "## 6. Counts"):
        assert heading in text
    assert "`a.jump:2024-25:be`" in text and "`/o/a.jump~2024-25~be`" in text and "+390.0%" in text
    assert "2010-11 against 2011-12" in text                     # the skipped break is said out loud
    assert "a.steady:2011-12:be` | 3" not in text                # and its 97% fall is not listed
    assert "`chk" not in text and "`k1`" in text and "100.0%" in text
    assert "bracket_negative (cells: 1)" in text and "(49) \\| x" in text   # a pipe in printed text cannot break the table
    assert "7 (doc-a p.3); 9 (doc-b p.4)" in text
    assert "—" not in text
    assert sanity.write_sanity_report(release_dir=release_dir, out_dir=out_dir).read_text(encoding="utf-8") == text   # deterministic


def test_long_lists_are_capped_and_say_how_many_were_cut(tmp_path):
    release_dir = tmp_path / "release"
    release_dir.mkdir()
    _write_release(release_dir)
    n = sanity.MAX_ROWS + 7
    all_series = [series(f"a.s{i:03d}") for i in range(n)]
    observations = [o for i in range(n) for o in (obs(f"a.s{i:03d}", "2023-24", "10"), obs(f"a.s{i:03d}", "2024-25", str(100 + i)))]
    (release_dir / "series.json").write_text(json.dumps(all_series), encoding="utf-8")
    (release_dir / "observations.json").write_text(json.dumps(observations), encoding="utf-8")
    (release_dir / "cells.json").write_text("[]", encoding="utf-8")
    (release_dir / "checks.json").write_text("[]", encoding="utf-8")
    text = sanity.write_sanity_report(release_dir=release_dir, out_dir=tmp_path).read_text(encoding="utf-8")
    assert f"Showing {sanity.MAX_ROWS} of {n} changes; 7 more are not shown." in text
    assert f"`a.s{n - 1:03d}:2024-25:be`" in text and "`a.s000:2024-25:be`" not in text   # largest first; the smallest is cut


def test_cli_sanity_runs_on_the_committed_release_without_touching_it(tmp_path, monkeypatch, capsys):
    from datalab import cli, config

    release_dir = config.RELEASES_DIR / config.DEFAULT_RELEASE
    before = {p.name: p.stat().st_mtime_ns for p in release_dir.glob("*.json")}
    monkeypatch.setattr(sanity, "_default_out_dir", lambda: tmp_path)
    assert cli.main(["sanity"]) == 0
    assert "sanity_" in capsys.readouterr().out
    assert len(list(tmp_path.glob("sanity_*.md"))) == 1
    assert {p.name: p.stat().st_mtime_ns for p in release_dir.glob("*.json")} == before
