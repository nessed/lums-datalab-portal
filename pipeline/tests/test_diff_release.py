"""`datalab diff-release A B` (E5): same data or not, with run ids and timestamps reported apart."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from datalab import diff_release


def base() -> dict:
    def cell(cid, row, col, raw, parsed, series=None, reader="docling"):
        return {"cell_id": cid, "source_id": "doc-a", "page": 3, "table_index": 0, "row_index": row, "col_index": col,
                "value_raw": raw, "value_parsed": parsed, "cell_bbox_norm": [0.1, 0.2, 0.3, 0.4], "series_id": series,
                "period": "2025-26" if series else None, "vintage": "be" if series else None, "extractor_name": reader,
                "run_id": "ABS_2025-26__docling__full-document__run-01", "page_render_sha256": "aa"}

    return {
        "release": {"version": "v1", "created_at": "2026-10-10T00:00:00+00:00", "git_commit": "aaaa", "thresholds_sha256": "t",
                    "tool_versions": {"docling": "2.119.0"}, "extract_config_sha256s": ["c"]},
        "sources": [{"source_id": "doc-a", "sha256": "1" * 64, "retrieved_at": "2026-10-10T01:00:00+00:00", "retrieved_via": "official"}],
        "series": [{"series_id": "a.total"}, {"series_id": "a.part"}],
        "cells": [cell("c_t", 5, 2, "1,000", "1000", "a.total"), cell("c_m1", 3, 2, "600", "600", "a.part"),
                  cell("c_m2", 4, 2, "400", "400"), cell("c_m2b", 4, 2, "400", "400", reader="pdfplumber")],
        "checks": [{"check_id": "chk_1", "check_type": "column_total", "rule_id": "abs.total", "target_cell_id": "c_t",
                    "member_cell_ids": ["c_m1", "c_m2"], "result": "pass", "residual": "0"},
                   {"check_id": "chk_2", "check_type": "reference_value", "rule_id": "ref", "target_cell_id": "c_m1",
                    "member_cell_ids": [], "target_source": "spec.yaml", "target_value": "600", "result": "pass", "residual": "0"}],
        "observations": [{"obs_id": "a.total:2025-26:be", "value": "1000", "status": "checked", "tier": "B", "published": True,
                          "gap_kind": None, "first_published_release": "v1", "last_changed_release": "v1"},
                         {"obs_id": "a.part:2025-26:be", "value": None, "status": "unchecked", "tier": "C", "published": False,
                          "gap_kind": "not_yet_verified", "first_published_release": None, "last_changed_release": None}],
    }


def write(folder: Path, data: dict, runs: tuple[str, ...] = ("ABS_2025-26__docling__full-document__run-01",)) -> Path:
    folder.mkdir(parents=True)
    for name, content in data.items():
        (folder / f"{name}.json").write_text(json.dumps(content), encoding="utf-8")
    (folder / "runs").mkdir()
    for run in runs:
        (folder / "runs" / f"{run}.manifest.json").write_text("{}", encoding="utf-8")
    return folder


def rebuilt(data: dict) -> dict:
    """The same data as an honest rebuild would write it: new run ids, cell ids, check ids, commit and times."""
    out = copy.deepcopy(data)
    out["release"].update(version="v1-repro", created_at="2026-11-01T09:00:00+00:00", git_commit="bbbb")
    out["sources"][0]["retrieved_at"] = "2026-11-01T08:00:00+00:00"
    for c in out["cells"]:
        c["run_id"] = "ABS_2025-26__docling__full-document__run-02"
    for o in out["observations"]:
        if o["published"]:
            o["first_published_release"] = o["last_changed_release"] = "v1-repro"
    for chk in out["checks"]:
        chk["check_id"] += "_new"
    out["cells"].reverse()       # order in the file is not data
    out["checks"].reverse()
    return out


def test_identical_folders_are_the_same(tmp_path):
    a, b = write(tmp_path / "a", base()), write(tmp_path / "b", base())
    result = diff_release.diff_releases(a, b)
    assert result["same"] and result["expected"] == {} and all(not v for v in result["differences"].values())
    assert result["counts"]["cells"] == (4, 4)


def test_a_rebuild_with_new_run_ids_and_timestamps_is_the_same_and_they_are_listed_apart(tmp_path):
    a = write(tmp_path / "a", base())
    b = write(tmp_path / "b", rebuilt(base()), runs=("ABS_2025-26__docling__full-document__run-02",))
    result = diff_release.diff_releases(a, b)
    assert result["same"]
    expected = result["expected"]
    assert {"release.version", "release.created_at", "release.git_commit", "cells with another run id", "run manifests",
            "sources with another retrieval or Wayback timestamp", "observations with another release mark"} == set(expected)
    assert expected["cells with another run id"].startswith("4 cells")
    text = diff_release.format_diff(result)
    assert "RESULT: the two releases hold the same" in text and "Expected differences" in text


def test_bbox_within_tolerance_is_the_same_and_beyond_it_is_not(tmp_path):
    near, far = base(), base()
    near["cells"][0]["cell_bbox_norm"] = [0.10005, 0.2, 0.3, 0.39995]
    far["cells"][0]["cell_bbox_norm"] = [0.1002, 0.2, 0.3, 0.4]
    a = write(tmp_path / "a", base())
    assert diff_release.diff_releases(a, write(tmp_path / "near", near))["same"]
    result = diff_release.diff_releases(a, write(tmp_path / "far", far))
    assert not result["same"] and len(result["differences"]["cells"]) == 1 and "cell_bbox_norm" in result["differences"]["cells"][0]


@pytest.mark.parametrize("field,value", [("value_raw", "1,001"), ("value_parsed", "1001"), ("series_id", "a.part"),
                                         ("period", "2024-25"), ("vintage", "re")])
def test_any_cell_field_that_matters_is_a_difference(tmp_path, field, value):
    changed = base()
    changed["cells"][0][field] = value
    result = diff_release.diff_releases(write(tmp_path / "a", base()), write(tmp_path / "b", changed))
    assert not result["same"] and f"{field} " in result["differences"]["cells"][0] and "doc-a p.3 table 0 row 5 col 2" in result["differences"]["cells"][0]


def test_missing_and_extra_cells_and_the_second_reader_cell_is_its_own_cell(tmp_path):
    changed = base()
    changed["cells"] = [c for c in changed["cells"] if c["cell_id"] != "c_m2b"]     # the pdfplumber cell at the same spot
    result = diff_release.diff_releases(write(tmp_path / "a", base()), write(tmp_path / "b", changed))
    assert result["differences"]["cells"] == ["doc-a p.3 table 0 row 4 col 2 (pdfplumber): only in A ('400')"]


def test_source_hash_series_set_and_observation_fields(tmp_path):
    changed = base()
    changed["sources"][0]["sha256"] = "2" * 64
    changed["series"].append({"series_id": "a.new"})
    changed["observations"][0].update(tier="A")
    changed["observations"][1].update(status="disputed", gap_kind="disputed")
    changed["observations"].append({"obs_id": "a.new:2025-26:be", "value": None, "status": "unchecked", "tier": None,
                                    "published": False, "gap_kind": "not_in_source"})
    d = diff_release.diff_releases(write(tmp_path / "a", base()), write(tmp_path / "b", changed))["differences"]
    assert len(d["sources"]) == 1 and "sha256" in d["sources"][0]
    assert d["series"] == ["a.new: only in B"]
    assert d["observations"] == ["a.new:2025-26:be: only in B",
                                 "a.part:2025-26:be: status 'unchecked' -> 'disputed'; gap_kind 'not_yet_verified' -> 'disputed'",
                                 "a.total:2025-26:be: tier 'B' -> 'A'"]


def test_checks_are_matched_by_type_rule_and_cells_not_by_id(tmp_path):
    changed = rebuilt(base())
    changed["checks"][-1].update(result="pass_within_rounding", residual="-1")       # the column total (list was reversed)
    changed["checks"][0]["target_value"] = "601"                                      # the reference check now has another target
    d = diff_release.diff_releases(write(tmp_path / "a", base()), write(tmp_path / "b", changed))["differences"]["checks"]
    assert len(d) == 3
    assert any("column_total / abs.total" in line and "pass_within_rounding" in line for line in d)
    assert sum("reference_value / ref" in line and "only in" in line for line in d) == 2


def test_only_the_first_twenty_differences_per_kind_are_printed(tmp_path):
    changed = base()
    changed["series"] += [{"series_id": f"a.extra{i:02d}"} for i in range(27)]
    text = diff_release.format_diff(diff_release.diff_releases(write(tmp_path / "a", base()), write(tmp_path / "b", changed)))
    assert "series: 27 difference(s), first 20 shown" in text
    assert "a.extra19" in text and "a.extra20" not in text and "RESULT: the two releases DIFFER." in text


def test_other_metadata_is_reported_but_does_not_change_the_verdict(tmp_path):
    changed = base()
    changed["release"]["tool_versions"] = {"docling": "9.9.9"}
    for c in changed["cells"]:
        c["page_render_sha256"] = "bb"
    result = diff_release.diff_releases(write(tmp_path / "a", base()), write(tmp_path / "b", changed))
    assert result["same"] and "release.tool_versions" in result["other_metadata"]
    assert "cells whose page render has another hash" in result["other_metadata"]


def test_cli_exit_codes(tmp_path, capsys):
    from datalab import cli

    a = write(tmp_path / "a", base())
    b = write(tmp_path / "b", rebuilt(base()))
    changed = base()
    changed["observations"][0]["value"] = "1001"
    c = write(tmp_path / "c", changed)
    assert cli.main(["diff-release", str(a), str(b)]) == 0
    assert cli.main(["diff-release", str(a), str(c)]) == 1
    assert "value '1000' -> '1001'" in capsys.readouterr().out
    with pytest.raises(SystemExit):
        cli.main(["diff-release", str(a), str(tmp_path / "missing")])


def test_the_committed_release_equals_itself():
    from datalab import config

    folder = config.RELEASES_DIR / config.DEFAULT_RELEASE
    result = diff_release.diff_releases(folder, folder)
    assert result["same"] and result["expected"] == {} and result["other_metadata"] == {}
