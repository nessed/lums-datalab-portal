"""`datalab gold-score` on synthetic label files.

Every file here is written to pytest's temporary folder. Nothing is read from or written to the
real `gold/` folder: that folder is for the human labellers, and no label in it may come from code.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from datalab import gold

FIELDS = ["sample_id", "cell_id", "labeller", "reading", "unreadable", "note", "labelled_at"]

# cell_id -> (value_parsed, is_missing)
CELLS = {
    "c_ok1": ("1234", False), "c_ok2": ("12.5", False), "c_ok3": ("-40", False), "c_ok4": ("5.0", False),
    "c_dash": (None, True),                # the release read a blank marker
    "c_wrong": ("852", False),             # both labellers read 825: an extraction error
    "c_novalue": (None, False),            # the release holds no value (two numbers in one cell)
    "c_split": ("77", False),              # the labellers read different numbers
    "c_bothwrong": ("300", False),         # both disagree with the release, and with each other
    "c_unread_all": ("9", False), "c_unread_one": ("8", False),
    "c_text": ("6", False),                # one labeller typed text that is not one number
    "c_one_only": ("4", False),            # only the first labeller labelled it
}


def write_release(folder: Path) -> Path:
    folder.mkdir(parents=True)
    cells = [{"cell_id": cid, "value_parsed": parsed, "is_missing": missing} for cid, (parsed, missing) in CELLS.items()]
    (folder / "cells.json").write_text(json.dumps(cells), encoding="utf-8")
    return folder


def write_labels(path: Path, rows: dict[str, str | None]) -> Path:
    """rows: cell_id -> typed reading, or None for the Unreadable box."""
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        for i, (cell_id, reading) in enumerate(rows.items(), start=1):
            w.writerow({"sample_id": f"g{i:04d}", "cell_id": cell_id, "labeller": path.stem,
                        "reading": reading or "", "unreadable": "true" if reading is None else "", "note": "", "labelled_at": ""})
    return path


RATER_A = {"c_ok1": "1,234", "c_ok2": "12.5", "c_ok3": "(40)", "c_ok4": "5", "c_dash": "-", "c_wrong": "825",
           "c_novalue": "17", "c_split": "77", "c_bothwrong": "301", "c_unread_all": None, "c_unread_one": "8",
           "c_text": "see note", "c_one_only": "4", "c_not_in_release": "1"}
RATER_B = {"c_ok1": "1234", "c_ok2": "12.50", "c_ok3": "−40", "c_ok4": "5.0", "c_dash": "n.a.", "c_wrong": "825",
           "c_novalue": "17", "c_split": "71", "c_bothwrong": "310", "c_unread_all": None, "c_unread_one": None,
           "c_text": "6", "c_not_in_release": "1"}


@pytest.fixture
def scored(tmp_path):
    release = write_release(tmp_path / "release")
    a = write_labels(tmp_path / "labels_a.csv", RATER_A)
    b = write_labels(tmp_path / "labels_b.csv", RATER_B)
    out = tmp_path / "score.json"
    result = gold.gold_score([a, b], "v-test", release_dir=release, out_path=out)
    return result, out


def test_error_rate_uses_only_cells_both_could_read_and_agree_on(scored):
    result, _ = scored
    # agreed readings: ok1, ok2, ok3, ok4, dash, wrong, novalue = 7; of those the release differs on wrong and novalue
    assert result["cells_with_agreed_label"] == 7
    assert result["errors"] == 2 and result["errors_where_extraction_has_no_value"] == 1
    assert result["error_rate"] == round(2 / 7, 4)
    assert {e["cell_id"] for e in result["error_list"]} == {"c_wrong", "c_novalue"}
    assert {"cell_id": "c_wrong", "human": "825", "extracted": "852"} in result["error_list"]


def test_everything_else_is_counted_apart_and_never_enters_the_rate(scored):
    result, _ = scored
    assert result["not_scored"] == {"unknown_cell_ids": 1, "labelled_by_some_labellers_only": 1, "label_not_one_number": 1,
                                    "unreadable_for_all": 1, "unreadable_for_some": 1, "labellers_read_different_numbers": 2}
    assert result["cells_labelled"] == 14
    assert result["cells_with_agreed_label"] + sum(result["not_scored"].values()) == result["cells_labelled"]
    assert {d["cell_id"] for d in result["disagreement_list"]} == {"c_split", "c_bothwrong"}
    assert result["labeller_disagreements_to_resolve"] == 2 and result["unreadable"] == 1


def test_formatting_differences_are_the_same_reading(scored):
    result, _ = scored
    wrong = {e["cell_id"] for e in result["error_list"]}
    # "1,234" and "1234"; "12.5" and "12.50"; "(40)" and a unicode minus; "5" and "5.0"; "-" and "n.a."
    assert not wrong & {"c_ok1", "c_ok2", "c_ok3", "c_ok4", "c_dash"}


def test_inter_rater_agreement_on_the_match_mismatch_outcome(scored):
    result, _ = scored
    (pair,) = result["inter_rater_agreement"]
    assert pair["labellers"] == ["labels_a", "labels_b"]
    # both could read: ok1..ok4, dash, wrong, novalue, split, bothwrong = 9 (c_text is left out: not one number)
    assert pair["cells_both_could_read"] == 9 and pair["same_reading"] == 7
    mm = pair["match_mismatch"]
    # outcomes (a/b): 5 match/match; wrong, novalue, bothwrong mismatch/mismatch; split match/mismatch
    assert mm["categories"] == {"match/match": 5, "match/mismatch": 1, "mismatch/match": 0, "mismatch/mismatch": 3}
    assert mm["items"] == 9 and mm["raw_agreement"] == round(8 / 9, 4)
    # chance agreement = (6/9)(5/9) + (3/9)(4/9) = 42/81; kappa = (8/9 - 42/81) / (1 - 42/81) = 30/39
    assert mm["kappa"] == round(30 / 39, 4)
    # with unreadable as a third category: unread_all (unreadable/unreadable) and unread_one (match/unreadable) join
    three = pair["match_mismatch_unreadable"]
    assert three["items"] == 11 and three["raw_agreement"] == round(9 / 11, 4)
    assert three["categories"]["unreadable/unreadable"] == 1 and three["categories"]["match/unreadable"] == 1


def test_both_wrong_with_different_numbers_agree_on_outcome_but_are_not_scored(scored):
    result, _ = scored
    assert "c_bothwrong" not in {e["cell_id"] for e in result["error_list"]}
    assert {"cell_id": "c_bothwrong", "readings": {"labels_a": "301", "labels_b": "310"}} in result["disagreement_list"]


def test_score_is_written_where_asked_and_not_into_the_gold_folder(scored):
    result, out = scored
    assert json.loads(out.read_text(encoding="utf-8")) == result
    assert gold.GOLD_DIR not in out.parents


def test_cohen_kappa_by_hand():
    perfect = [("match", "match")] * 6 + [("mismatch", "mismatch")] * 4
    assert gold.cohen_kappa(perfect)["kappa"] == 1.0 and gold.cohen_kappa(perfect)["raw_agreement"] == 1.0
    # textbook 2x2: 20 yes/yes, 5 yes/no, 10 no/yes, 15 no/no -> po 0.7, pe 0.5, kappa 0.4
    textbook = [("y", "y")] * 20 + [("y", "n")] * 5 + [("n", "y")] * 10 + [("n", "n")] * 15
    assert gold.cohen_kappa(textbook) == {"items": 50, "raw_agreement": 0.7, "kappa": 0.4,
                                          "categories": {"n/n": 15, "n/y": 10, "y/n": 5, "y/y": 20}}
    opposite = [("match", "mismatch")] * 5 + [("mismatch", "match")] * 5
    assert gold.cohen_kappa(opposite)["kappa"] == -1.0


def test_kappa_is_undefined_not_invented_when_there_is_one_category_or_no_item():
    all_match = gold.cohen_kappa([("match", "match")] * 12)
    assert all_match["raw_agreement"] == 1.0 and all_match["kappa"] is None
    assert gold.cohen_kappa([]) == {"items": 0, "raw_agreement": None, "kappa": None, "categories": {}}


def test_one_labeller_gives_no_error_rate(tmp_path):
    release = write_release(tmp_path / "release")
    a = write_labels(tmp_path / "labels_a.csv", RATER_A)
    result = gold.gold_score([a], "v-test", release_dir=release, out_path=tmp_path / "score.json")
    assert result["error_rate"] is None and result["cells_with_agreed_label"] == 0
    assert "at least two labellers" in result["error_rate_basis"] and result["inter_rater_agreement"] == []


def test_perfect_agreement_and_no_errors(tmp_path):
    release = write_release(tmp_path / "release")
    rows = {"c_ok1": "1,234", "c_ok2": "12.5", "c_ok3": "-40", "c_dash": "nil"}
    a, b = write_labels(tmp_path / "a.csv", rows), write_labels(tmp_path / "b.csv", rows)
    result = gold.gold_score([a, b], "v-test", release_dir=release, out_path=tmp_path / "score.json")
    assert result["error_rate"] == 0.0 and result["cells_with_agreed_label"] == 4 and sum(result["not_scored"].values()) == 0
    assert result["inter_rater_agreement"][0]["match_mismatch"]["kappa"] is None      # one category only: undefined


def test_blank_rows_are_not_labels_and_a_repeated_cell_takes_the_later_row(tmp_path):
    path = tmp_path / "labels.csv"
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        w.writerow({"cell_id": "c_ok1", "reading": "999"})
        w.writerow({"cell_id": "c_ok2", "reading": "", "unreadable": ""})       # skipped by the labeller
        w.writerow({"cell_id": "c_ok1", "reading": "1,234"})                    # corrected later in the same file
        w.writerow({"cell_id": "c_ok3", "reading": "", "unreadable": "TRUE"})
        w.writerow({"cell_id": "c_text", "reading": "852  251,130"})            # two numbers typed: not one number
    labels, repeats = gold.read_labels(path)
    assert labels == {"c_ok1": ("reading", "1234"), "c_ok3": ("unreadable", None), "c_text": ("not_one_number", "852  251,130")}
    assert repeats == 1


def test_cli_gold_score_writes_to_out(tmp_path, monkeypatch, capsys):
    from datalab import cli, config

    release = write_release(tmp_path / "releases" / "v-test")
    monkeypatch.setattr(config, "RELEASES_DIR", release.parent)
    a = write_labels(tmp_path / "labels_a.csv", RATER_A)
    b = write_labels(tmp_path / "labels_b.csv", RATER_B)
    out = tmp_path / "out" / "score.json"
    assert cli.main(["gold-score", str(a), str(b), "--version", "v-test", "--out", str(out)]) == 0
    assert json.loads(out.read_text(encoding="utf-8"))["errors"] == 2
    assert "Cohen's kappa" in capsys.readouterr().out
