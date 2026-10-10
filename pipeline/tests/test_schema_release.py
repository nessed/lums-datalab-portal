import json
import re

import pytest
import yaml

from datalab import config
from datalab.datasets.common import LabelMap
from datalab.release import check_release, frozen_hash
from datalab.schema import MODELS, Cell, Observation, cell_id_for, obs_id_for


def test_json_schema_files_are_in_sync_with_models():
    for name, model in MODELS.items():
        path = config.SCHEMA_DIR / f"{name}.schema.json"
        assert path.exists(), f"run `python -m datalab export-schema` ({path.name} is missing)"
        assert json.loads(path.read_text(encoding="utf-8")) == json.loads(json.dumps(model.model_json_schema())), (
            f"{path.name} is stale: run `python -m datalab export-schema`")


def test_ids_are_stable():
    assert cell_id_for("abs-fed-2025-26", 17, 0, 9, 4) == cell_id_for("abs-fed-2025-26", 17, 0, 9, 4)
    assert re.fullmatch(r"c_[0-9a-f]{12}", cell_id_for("abs-fed-2025-26", 17, 0, 9, 4))
    assert obs_id_for("fed.exp.total", "2025-26", "be") == "fed.exp.total:2025-26:be"


def test_values_must_be_decimal_strings():
    base = dict(obs_id="s:2025-26:be", series_id="s", period="2025-26", vintage="be", unit="PKR")
    Observation(**base, value="2550000")
    Observation(**base, value="12.34")
    for bad in ("1,234", "1e3", "abc", "12."):
        with pytest.raises(ValueError):
            Observation(**base, value=bad)


def test_bbox_must_be_normalised_top_left():
    kw = dict(cell_id="c_x", source_id="s", page=1, table_index=0, row_index=0, col_index=0, value_raw="1",
              extractor_name="docling", extractor_version="t", run_id="r", extract_config_sha256="0" * 64)
    Cell(**kw, table_bbox_norm=[0, 0, 1, 1], cell_bbox_norm=[0.1, 0.2, 0.3, 0.4])
    with pytest.raises(ValueError):
        Cell(**kw, table_bbox_norm=[0, 0, 1, 1], cell_bbox_norm=[100, 200, 300, 400])   # points, not fractions
    with pytest.raises(ValueError):
        Cell(**kw, table_bbox_norm=[0, 0, 1, 1], cell_bbox_norm=[0.3, 0.4, 0.1, 0.2])   # inverted


def test_thresholds_match_the_frozen_hash():
    assert frozen_hash() == config.sha256_text_lf(config.THRESHOLDS_YAML), (
        "thresholds.yaml changed after it was frozen; record a deviation instead of editing it")


def test_abs_label_map_is_unambiguous_and_covers_known_labels():
    spec = yaml.safe_load((config.SPECS_DIR / "abs_labels.yaml").read_text(encoding="utf-8"))
    labels = LabelMap(spec["labels"])
    cases = {
        "01 General Public Services": "fed.exp.current.function.general_public_services",
        "Account General Public Services": "fed.exp.current.function.general_public_services",
        "07 Health": "fed.exp.current.function.health",
        "a. Current Exp. on Revenue Account": "fed.exp.current.revenue_account",
        "a. Current Exp. on Revenue": "fed.exp.current.revenue_account",
        "b. Current Exp. on Capital Account": "fed.exp.current.capital_account",
        "1 Total Current Expenditure (a + b)": "fed.exp.current.total",
        "c. Dev. Exp. on Revenue Account (i+ii)": "fed.exp.development.revenue_account",
        "i. Dev. Exp. on Revenue Account (PSDP)": "fed.exp.development.revenue_account.psdp",
        "d. Dev. Expenditure on Capital Account": "fed.exp.development.capital_account",
        "2 Total Development Expenditure (c + d)": "fed.exp.development.total",
        "Total - Expenditure (1+2+3)": "fed.exp.total",
        "Grand Total - Expenditure (1+2)": "fed.exp.total",
        "Total Expenditure:": "fed.exp.total",
        "Revenue Account (a+c)": "fed.exp.account.revenue",
    }
    for raw, expected in cases.items():
        assert labels.lookup(raw) == (expected, "dictionary"), raw
    assert labels.lookup("Something never seen before")[0] is None
    assert labels.lookup("4 Break-up of Expenditure")[0] is None


def test_abs_rules_reference_known_series():
    spec = yaml.safe_load((config.SPECS_DIR / "abs.yaml").read_text(encoding="utf-8"))
    extra = yaml.safe_load((config.SPECS_DIR / "abs_labels.yaml").read_text(encoding="utf-8"))
    known = {s["id"] for s in spec["series"]} | {s["id"] for s in extra["extra_series"]}
    mapped = {e["series"] for e in extra["labels"]}
    assert mapped <= known
    for rule in spec["rules"]:
        ids = [rule["target"], *rule.get("members", []), *rule.get("optional", [])]
        assert set(ids) <= known, rule["id"]
    assert set(spec["expected_every_edition"]) <= known


def _releases():
    return sorted(p for p in config.RELEASES_DIR.glob("*") if (p / "release.json").exists()) if config.RELEASES_DIR.exists() else []


@pytest.mark.parametrize("path", _releases(), ids=lambda p: p.name)
def test_release_is_self_consistent(path):
    assert check_release(path) == []


@pytest.mark.parametrize("path", _releases(), ids=lambda p: p.name)
def test_release_holds_no_value_for_unpublished_observations(path):
    for o in json.loads((path / "observations.json").read_text(encoding="utf-8")):
        assert o["published"] or o["value"] is None
        assert o["published"] or o["gap_kind"] in ("not_in_source", "not_yet_verified", "failed_checks")
