"""Data model: Source, Series, Cell, Observation, Check, Release, RunManifest.

Numbers are decimal strings in JSON and CSV ("2550000", "12.34"), never
floats. Floats appear only in Parquet columns named `*_num`.

`python -m datalab export-schema` writes JSON Schema files to `schema/`;
a test keeps them in sync with these models.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

DecimalStr = str
_DECIMAL_RE = re.compile(r"^-?\d+(\.\d+)?$")

DocType = Literal["abs", "cpi_monthly_review", "lfs_annual_report", "pes_chapter", "sbp_easydata", "cpi_reference"]
Role = Literal["core", "corroboration", "cross_source"]
RetrievedVia = Literal["official", "wayback", "ra-ship-archive"]
VerificationStatus = Literal[
    "official_match_archive",
    "official_only",
    "official_differs_from_archive",
    "wayback_only",
    "wayback_match_archive",
    "archive_copy_content_inspected",
    "failed",
]
Dataset = Literal["abs", "cpi", "lfs"]
Frequency = Literal["fiscal_year", "month", "survey_round"]
Unit = Literal["PKR", "index", "percent", "persons"]
Vintage = Literal["be", "re", "actual", "provisional", "final", "rebased", "na"]
Tier = Literal["A", "B", "C", "D", "E"]
Status = Literal["checked", "unchecked", "disputed"]
GapKind = Literal["not_in_source", "not_yet_verified", "failed_checks"]
CheckType = Literal[
    "column_total",
    "row_total",
    "hierarchy_sum",
    "cross_edition",
    "cross_table",
    "accounting_identity",
    "cross_source",
    "recompute",
    "weights_sum",
    "index_aggregation",
]
CheckResult = Literal["pass", "pass_within_rounding", "fail", "not_evaluable"]

ARITHMETIC_CHECKS = frozenset(
    {"column_total", "hierarchy_sum", "row_total", "accounting_identity", "weights_sum",
     "index_aggregation", "recompute", "cross_table"}
)
AGREEMENT_CHECKS = frozenset({"cross_edition", "cross_source"})
PASSING = frozenset({"pass", "pass_within_rounding"})


def _check_decimal(value: Optional[str]) -> Optional[str]:
    if value is not None and not _DECIMAL_RE.match(value):
        raise ValueError(f"not a decimal string: {value!r}")
    return value


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Source(Model):
    """One original file."""

    source_id: str
    doc_type: DocType
    publisher: str
    jurisdiction: str
    title: str
    period: str
    role: Role
    landing_url: Optional[str] = None
    file_url: Optional[str] = None
    wayback_url: Optional[str] = None
    wayback_timestamp: Optional[str] = None
    retrieved_at: Optional[str] = None
    retrieved_via: RetrievedVia
    sha256: str
    size_bytes: int
    format: str = "pdf"
    page_count: Optional[int] = None
    is_born_digital: Optional[bool] = None
    language: Optional[str] = None
    local_path: str = Field(description="Path relative to SOURCES_DIR, forward slashes.")
    verification_status: VerificationStatus
    verification_record: str
    notes: str = ""


class SeriesBreak(Model):
    at_period: str
    kind: str
    note: str


class Derivation(Model):
    formula: str
    inputs: list[str]


class Series(Model):
    """What a number measures."""

    series_id: str
    name: str
    parent_id: Optional[str] = None
    dataset: Dataset
    geo: str = "pk"
    dims: dict[str, str] = Field(default_factory=dict)
    frequency: Frequency
    unit: Unit
    scale_factor: int = 1
    definition: str = ""
    definition_status: Literal["draft", "reviewed"] = "draft"
    synonyms: list[str] = Field(default_factory=list)
    breaks: list[SeriesBreak] = Field(default_factory=list)
    source_doc_types: list[str] = Field(default_factory=list)
    derived: bool = False
    derivation: Optional[Derivation] = None
    sort_key: int = 0
    notes: str = ""


class SecondReader(Model):
    name: str
    version: str
    value_raw: str
    agreement: bool


class SecondReaderOf(Model):
    """Set on a cell that was read by the second reader (decision D28).

    The first reader's cells of the same table stay in the record, unmapped, with their flags.
    """

    first_reader: str
    first_reader_version: str
    routed_by: list[str] = Field(description="Structural flags on the first reader's table that sent it to the second reader.")
    first_cell_ids: list[str] = Field(default_factory=list, description="First-reader cell(s) covering this spot on the page.")


class Cell(Model):
    """One printed number in one file."""

    cell_id: str
    source_id: str
    page: int
    page_render_sha256: Optional[str] = None
    table_index: int
    table_bbox_norm: list[float]
    cell_bbox_norm: list[float]
    row_index: int
    col_index: int
    row_span: int = 1
    col_span: int = 1
    row_label_raw: str = ""
    row_label_path: list[str] = Field(default_factory=list)
    col_label_raw: str = ""
    col_label_path: list[str] = Field(default_factory=list)
    value_raw: str
    value_parsed: Optional[DecimalStr] = None
    is_missing: bool = False
    missing_marker: Optional[str] = None
    normalization_flags: list[str] = Field(default_factory=list)
    unit: Optional[Unit] = None
    scale_factor: Optional[int] = None
    series_id: Optional[str] = None
    period: Optional[str] = None
    vintage: Optional[Vintage] = None
    mapping_method: Literal["dictionary", "unmapped"] = "unmapped"
    extractor_name: str
    extractor_version: str
    run_id: str
    extract_config_sha256: str
    structural_flags: list[str] = Field(default_factory=list)
    second_reader: Optional[SecondReader] = None
    second_reader_of: Optional[SecondReaderOf] = None

    _v = field_validator("value_parsed")(_check_decimal)

    @field_validator("table_bbox_norm", "cell_bbox_norm")
    @classmethod
    def _bbox(cls, v: list[float]) -> list[float]:
        if len(v) != 4 or not (-0.01 <= v[0] <= v[2] <= 1.01 and -0.01 <= v[1] <= v[3] <= 1.01):
            raise ValueError(f"bbox must be [x0,y0,x1,y1] in 0..1 with a top-left origin: {v}")
        return v


class Observation(Model):
    """The fact that one or more cells support."""

    obs_id: str
    series_id: str
    period: str
    vintage: Vintage
    value: Optional[DecimalStr] = None
    unit: Unit
    scale_factor: int = 1
    primary_cell_id: Optional[str] = None
    supporting_cell_ids: list[str] = Field(default_factory=list)
    check_ids: list[str] = Field(default_factory=list)
    tier: Optional[Tier] = None
    status: Status = "unchecked"
    published: bool = False
    gap_kind: Optional[GapKind] = None
    gap_reason: Optional[str] = None
    evidence_summary: str = ""
    notes: str = Field(default="", description="Caveats the reader must see, e.g. a footnote the document attaches to the line.")
    derived_from: list[str] = Field(default_factory=list)
    first_published_release: Optional[str] = None
    last_changed_release: Optional[str] = None

    _v = field_validator("value")(_check_decimal)


class Check(Model):
    check_id: str
    check_type: CheckType
    dataset: Dataset
    source_ids: list[str]
    member_cell_ids: list[str] = Field(default_factory=list)
    target_cell_id: Optional[str] = None
    target_value: Optional[DecimalStr] = None
    target_source: Optional[str] = None
    expected: Optional[DecimalStr] = None
    observed: Optional[DecimalStr] = None
    residual: Optional[DecimalStr] = None
    tolerance_rule: str = ""
    result: CheckResult
    not_evaluable_reason: Optional[str] = None
    description: str = ""
    official: bool = Field(default=True, description="False for comparison-only sources that never feed status.")
    rule_id: Optional[str] = None


class RunManifest(Model):
    run_id: str
    source_id: str
    sha256_at_run: str
    run_mode: Literal["full-document", "page-range"]
    page_range: Optional[list[int]] = None
    tool_versions: dict[str, str]
    config: dict[str, Any]
    config_sha256: str
    started_at: str
    finished_at: Optional[str] = None
    duration_s: Optional[float] = None
    pages_emitted: Optional[int] = None
    tables_emitted: Optional[int] = None
    errors: dict[str, Any] = Field(default_factory=dict)
    profile: dict[str, Any] = Field(default_factory=dict)
    validated: bool = False
    validator_report: Optional[str] = None


class Release(Model):
    version: str
    created_at: str
    git_commit: str
    label: str = "prototype"
    doi: Optional[str] = None
    scope: dict[str, Any]
    thresholds_sha256: str
    tool_versions: dict[str, str]
    extract_config_sha256s: list[str]
    source_sha256s: dict[str, str]
    counts: dict[str, Any]
    coverage_summary: dict[str, Any]
    check_pass_rates: dict[str, Any]
    dataset_status: dict[str, Any] = Field(default_factory=dict)
    gold_set: dict[str, Any] = Field(default_factory=lambda: {"status": "pending_human_labelling"})
    measured_error_rate: Optional[float] = None
    notes: str = ""


MODELS: dict[str, type[Model]] = {
    "source": Source,
    "series": Series,
    "cell": Cell,
    "observation": Observation,
    "check": Check,
    "run_manifest": RunManifest,
    "release": Release,
}


def cell_id_for(source_id: str, page: int, table_index: int, row_index: int, col_index: int, reader: str = "") -> str:
    """`reader` is given only for a second reader's cell, so first-reader ids never change."""
    key = f"{source_id}|{page}|{table_index}|{row_index}|{col_index}" + (f"|{reader}" if reader else "")
    return "c_" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]


def check_id_for(*parts: object) -> str:
    key = "|".join(str(p) for p in parts)
    return "chk_" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]


def obs_id_for(series_id: str, period: str, vintage: str) -> str:
    return f"{series_id}:{period}:{vintage}"


def export_json_schema(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, model in MODELS.items():
        path = out_dir / f"{name}.schema.json"
        text = json.dumps(model.model_json_schema(), indent=2, sort_keys=True) + "\n"
        path.write_text(text, encoding="utf-8", newline="\n")
        written.append(path)
    return written
