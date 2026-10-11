"""Frozen releases (plan 6.9, 6.10) and the release self-check used in CI.

A release folder is everything the site needs. Only `published: true`
observations carry a value; everything else is a labelled gap.
"""
from __future__ import annotations

import csv
import re
import subprocess
from collections import Counter, defaultdict
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path
from typing import Any

import yaml

from . import config
from .checks import classify_sum, dispute_summary, dispute_test, pass_rate
from .normalise import last_digit_unit
from .schema import (AGREEMENT_CHECKS, PASSING, Cell, Check, Observation, Release, RunManifest, Series, Source)
from .status import decide_tier, disputed_readings, is_disputed

SUM_TYPES = frozenset({"column_total", "hierarchy_sum", "row_total", "accounting_identity"})
EQUAL_TYPES = frozenset({"cross_edition", "cross_table"})
# Decision D26 (a recorded deviation, not a frozen threshold): a data type whose disputed pairs are
# more than this share of all evaluable cross-edition pairs is not published.
MAX_DISPUTED_SHARE = Decimal("0.05")
DATASET_NAMES = {"abs": "Federal Annual Budget Statement", "cpi": "Consumer Price Index", "lfs": "Labour Force Survey"}


def _git_commit() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], cwd=config.REPO_ROOT, capture_output=True, text=True,
                              check=True).stdout.strip()
    except Exception:
        return "unknown"


def thresholds() -> dict[str, Any]:
    return yaml.safe_load(config.THRESHOLDS_YAML.read_text(encoding="utf-8"))


def frozen_hash() -> str | None:
    m = re.search(r"`thresholds/thresholds\.yaml`\s*\|\s*`([0-9a-f]{64})`", config.THRESHOLDS_FROZEN.read_text(encoding="utf-8"))
    return m.group(1) if m else None


def gate_dataset(dataset: str, coverage: list[dict[str, Any]], checks: list[Check]) -> dict[str, Any]:
    """Apply the frozen thresholds (D10) to one data type. Coverage and accuracy stay separate numbers."""
    th = thresholds()
    printed = sum(c.get("printed_numeric_tokens") or 0 for c in coverage)
    matched = sum(c.get("matched") or 0 for c in coverage)
    cov = round(matched / printed, 4) if printed else None
    tables_below = [f"{c['source_id']} p.{c['page']}" for c in coverage
                    if c.get("coverage") is not None and c["coverage"] < th["coverage"]["min_per_table"]]
    # Overall rate: a disputed pair never counts as a pass. Cross-edition agreement (D26):
    # agree / (agree + fail); disputed pairs are counted and shown separately.
    all_rate = pass_rate(checks, disputed_as_failed=True)
    cross = pass_rate(checks, AGREEMENT_CHECKS & {"cross_edition"})
    pairs = cross["evaluable"] + cross["disputed"]
    disputed_share = round(cross["disputed"] / pairs, 4) if pairs else None
    reasons = []
    if cov is None:
        reasons.append("no coverage measurement")
    elif cov < th["coverage"]["min_per_data_type"]:
        reasons.append(f"coverage {cov} is below {th['coverage']['min_per_data_type']}")
    if all_rate["pass_rate"] is None:
        reasons.append("no evaluable checks")
    elif all_rate["pass_rate"] < th["checks"]["min_evaluable_pass_rate_per_data_type"]:
        reasons.append(f"check pass rate {all_rate['pass_rate']} is below {th['checks']['min_evaluable_pass_rate_per_data_type']}")
    if cross["pass_rate"] is not None and cross["pass_rate"] < th["checks"]["min_cross_edition_agreement"]:
        reasons.append(f"cross-edition agreement {cross['pass_rate']} is below {th['checks']['min_cross_edition_agreement']}")
    if disputed_share is not None and Decimal(str(disputed_share)) > MAX_DISPUTED_SHARE:
        reasons.append(f"disputed cross-edition pairs are {disputed_share} of all pairs, above {MAX_DISPUTED_SHARE} (decision D26)")
    return {
        "dataset": dataset, "name": DATASET_NAMES.get(dataset, dataset), "meets_thresholds": not reasons,
        "state": "published" if not reasons else "coming", "reasons": reasons,
        "coverage": {"printed_numeric_tokens": printed, "matched": matched, "coverage": cov, "tables": len(coverage),
                     "tables_below_per_table_minimum": tables_below},
        "check_pass_rate": all_rate, "cross_edition_agreement": cross,
        "disputes": {**dispute_summary(checks), "cross_edition_pairs": pairs, "disputed_share": disputed_share,
                     "max_disputed_share": str(MAX_DISPUTED_SHARE)},
    }


def render_pages(cells: list[Cell], sources: dict[str, Source], out_dir: Path, dpi: int = 144) -> dict[tuple[str, int], str]:
    """One PNG per used page (D12). Returns {(source_id, page): sha256}."""
    import pymupdf

    from .sources import source_path

    wanted = sorted({(c.source_id, c.page) for c in cells})
    hashes: dict[tuple[str, int], str] = {}
    by_source: dict[str, list[int]] = defaultdict(list)
    for sid, page in wanted:
        by_source[sid].append(page)
    for sid, pages in by_source.items():
        with pymupdf.open(source_path(sources[sid])) as doc:
            for page in pages:
                out = out_dir / sid / f"p{page:03d}.png"
                out.parent.mkdir(parents=True, exist_ok=True)
                pix = doc[page - 1].get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY if False else pymupdf.csRGB, alpha=False)
                pix.save(out)
                hashes[(sid, page)] = config.sha256_file(out)
    return hashes


OBS_CSV_FIELDS = ["obs_id", "series_id", "series_name", "dataset", "period", "vintage", "value", "unit", "scale_factor",
                  "status", "tier", "published", "gap_kind", "gap_reason", "source_id", "source_title", "source_file_url",
                  "source_sha256", "page", "cell_id", "value_as_printed", "disputed_readings", "evidence_summary", "release"]


def _obs_rows(observations: list[Observation], series: dict[str, Series], cells: dict[str, Cell],
              sources: dict[str, Source], version: str) -> list[dict[str, Any]]:
    rows = []
    for o in observations:
        cell = cells.get(o.primary_cell_id or "")
        src = sources.get(cell.source_id) if cell else None
        s = series[o.series_id]
        rows.append({
            "obs_id": o.obs_id, "series_id": o.series_id, "series_name": s.name, "dataset": s.dataset, "period": o.period,
            "vintage": o.vintage, "value": o.value if o.published else "", "unit": o.unit, "scale_factor": o.scale_factor,
            "status": o.status, "tier": o.tier or "", "published": str(o.published).lower(), "gap_kind": o.gap_kind or "",
            "gap_reason": o.gap_reason or "", "source_id": src.source_id if src else "", "source_title": src.title if src else "",
            "source_file_url": (src.file_url or "") if src else "", "source_sha256": src.sha256 if src else "",
            "page": cell.page if cell else "", "cell_id": cell.cell_id if cell else "",
            "value_as_printed": cell.value_raw.strip() if (cell and o.published) else "",
            "disputed_readings": " | ".join(f"{r.value_raw} ({r.source_id} p.{r.page})" for r in o.disputed_readings),
            "evidence_summary": o.evidence_summary, "release": version,
        })
    return rows


def _write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, lineterminator="\n", extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def build_release(version: str = config.DEFAULT_RELEASE, only: list[str] | None = None) -> Path:
    from .datasets.common import load_dataset
    from .extract import runs_dir, tool_versions
    from .sources import read_manifest

    out = config.RELEASES_DIR / version
    out.mkdir(parents=True, exist_ok=True)
    # A release is rebuilt whole: page renders and run manifests of a previous build are removed first.
    import shutil

    for sub in ("pages", "runs"):
        shutil.rmtree(out / sub, ignore_errors=True)
    sources = {s.source_id: s for s in read_manifest()}
    all_cells: list[Cell] = []
    all_checks: list[Check] = []
    all_series: list[Series] = []
    all_obs: list[Observation] = []
    all_cov: list[dict[str, Any]] = []
    dataset_status: dict[str, Any] = {}
    dataset_info: dict[str, Any] = {}
    for dataset in ("abs", "cpi", "lfs"):
        d = load_dataset(dataset) if (not only or dataset in only) else None
        if d is None:
            dataset_status[dataset] = {"dataset": dataset, "name": DATASET_NAMES[dataset], "meets_thresholds": False,
                                       "state": "coming", "reasons": ["not processed yet"]}
            continue
        gate = gate_dataset(dataset, d["coverage"], d["checks"])
        dataset_status[dataset] = gate
        dataset_info[dataset] = d["info"]
        obs = d["observations"]
        if not gate["meets_thresholds"]:
            # A data type below a frozen threshold is not published at all (D10).
            reason = "This data type is below a frozen publication threshold: " + "; ".join(gate["reasons"]) + "."
            obs = [o.model_copy(update={"value": None, "published": False,
                                        "status": "disputed" if o.status == "disputed" else "unchecked",
                                        "gap_kind": o.gap_kind or "not_yet_verified",
                                        "gap_reason": o.gap_reason if o.gap_kind else reason,
                                        "first_published_release": None, "last_changed_release": None}) for o in obs]
        all_cells += d["cells"]
        all_checks += d["checks"]
        all_series += d["series"]
        all_obs += obs
        all_cov += d["coverage"]

    # Page renders for every page that holds a cell.
    used_sources = {c.source_id for c in all_cells}
    hashes = render_pages(all_cells, sources, out / "pages")
    for c in all_cells:
        c.page_render_sha256 = hashes[(c.source_id, c.page)]
    # Unpublished observations never carry a value.
    for o in all_obs:
        if not o.published:
            o.value = None

    cells_by_id = {c.cell_id: c for c in all_cells}
    series_by_id = {s.series_id: s for s in all_series}
    release_sources = [s for s in sources.values() if s.source_id in used_sources or s.doc_type in
                       ("abs", "cpi_monthly_review", "lfs_annual_report", "pes_chapter", "sbp_easydata", "cpi_reference")]
    release_sources.sort(key=lambda s: s.source_id)

    # Run manifests for every run that produced a cell.
    run_ids = sorted({c.run_id for c in all_cells})
    (out / "runs").mkdir(exist_ok=True)
    runs: list[RunManifest] = []
    for run_id in run_ids:
        m = RunManifest(**config.read_json(runs_dir() / run_id / "manifest.json"))
        runs.append(m)
        config.write_json(out / "runs" / f"{run_id}.manifest.json", m.model_dump())

    sources_out = []
    for s in release_sources:
        record_path = config.REPO_ROOT / s.verification_record
        record = config.read_json(record_path) if record_path.exists() else {}
        pages_used = sorted({c.page for c in all_cells if c.source_id == s.source_id})
        sources_out.append({**s.model_dump(), "pages_used": pages_used,
                            "run_ids": sorted({c.run_id for c in all_cells if c.source_id == s.source_id}),
                            "verification": {k: record.get(k) for k in
                                             ("retrieved_via", "retrieved_at", "identity_route", "landing_page_links_file",
                                              "archive_copy", "inspection", "response", "wayback", "text_layer_ok")}})

    config.write_json(out / "sources.json", sources_out)
    config.write_json(out / "series.json", [s.model_dump() for s in sorted(all_series, key=lambda s: (s.dataset, s.sort_key, s.series_id))])
    config.write_json(out / "cells.json", [c.model_dump() for c in all_cells])
    config.write_json(out / "checks.json", [c.model_dump() for c in all_checks])
    config.write_json(out / "observations.json", [o.model_dump() for o in all_obs])
    config.write_json(out / "coverage.json", all_cov)

    rows = _obs_rows(all_obs, series_by_id, cells_by_id, sources, version)
    _write_csv(out / "observations.csv", rows, OBS_CSV_FIELDS)
    cell_fields = ["cell_id", "source_id", "page", "table_index", "row_index", "col_index", "row_label_raw", "col_label_raw",
                   "value_raw", "value_parsed", "is_missing", "series_id", "period", "vintage", "unit", "scale_factor",
                   "normalization_flags", "structural_flags", "cell_bbox_norm", "run_id", "extractor_name",
                   "extractor_version", "extract_config_sha256", "page_render_sha256"]
    published_cells = {o.primary_cell_id for o in all_obs if o.published} | {cid for o in all_obs if o.published for cid in o.supporting_cell_ids}
    cell_rows = []
    for c in all_cells:
        d = c.model_dump()
        d["normalization_flags"] = "|".join(d["normalization_flags"])
        d["structural_flags"] = "|".join(d["structural_flags"])
        d["cell_bbox_norm"] = " ".join(str(x) for x in d["cell_bbox_norm"])
        cell_rows.append(d)
    _write_csv(out / "cells.csv", cell_rows, cell_fields)
    try:
        import pandas as pd

        df = pd.DataFrame(rows)
        df["value_num"] = [float(v) if v not in ("", None) else None for v in df["value"]]
        df["page"] = df["page"].astype(str)
        df.to_parquet(out / "observations.parquet", index=False)
    except Exception as exc:  # Parquet is a convenience copy; CSV and JSON are the record.
        print(f"[release] parquet not written: {type(exc).__name__}: {exc}")

    obs_counts = Counter()
    for o in all_obs:
        key = "published" if o.published else f"gap:{o.gap_kind}"
        obs_counts[(series_by_id[o.series_id].dataset, key)] += 1
    tiers = Counter((series_by_id[o.series_id].dataset, o.tier) for o in all_obs if o.tier)
    counts = {
        "sources": len(sources_out), "cells": len(all_cells), "cells_mapped": sum(1 for c in all_cells if c.series_id),
        "cells_behind_published_values": len(published_cells - {None}),
        "series": len(all_series), "observations": len(all_obs),
        "observations_by_dataset": {ds: {k: v for (d2, k), v in sorted(obs_counts.items()) if d2 == ds} for ds in dataset_status},
        "tiers_by_dataset": {ds: {t: v for (d2, t), v in sorted(tiers.items()) if d2 == ds} for ds in dataset_status},
        "checks_by_result": dict(Counter(c.result for c in all_checks)),
        "checks_by_type": {t: dict(Counter(c.result for c in all_checks if c.check_type == t))
                           for t in sorted({c.check_type for c in all_checks})},
        "page_renders": len(hashes),
    }
    release = Release(
        version=version, created_at=config.now_iso(), git_commit=_git_commit(), label="prototype", doi=None,
        scope={"datasets": [ds for ds, g in dataset_status.items() if g["state"] == "published"],
               "datasets_coming": [ds for ds, g in dataset_status.items() if g["state"] != "published"],
               "sources": sorted(used_sources),
               "periods": {ds: sorted({o.period for o in all_obs if series_by_id[o.series_id].dataset == ds and o.published})
                           for ds in dataset_status}},
        thresholds_sha256=config.sha256_text_lf(config.THRESHOLDS_YAML), tool_versions=tool_versions(),
        extract_config_sha256s=sorted({r.config_sha256 for r in runs}),
        source_sha256s={s.source_id: s.sha256 for s in release_sources}, counts=counts,
        coverage_summary={ds: g.get("coverage") for ds, g in dataset_status.items()},
        check_pass_rates={ds: {"all": g.get("check_pass_rate"), "cross_edition": g.get("cross_edition_agreement")}
                          for ds, g in dataset_status.items()},
        dataset_status=dataset_status,
        notes=("Prototype release, built unattended and rebuilt before first deployment (D29). No DOI. Not for citation in publications yet. "
               "Measured error rate is pending human gold-set labelling."),
    )
    config.write_json(out / "release.json", release.model_dump())
    config.write_json(out / "dataset_info.json", dataset_info)
    from .release_docs import write_release_docs

    write_release_docs(out, release, sources_out, all_cov, all_obs, series_by_id)
    problems = check_release(out)
    for p in problems:
        print(f"[release] PROBLEM: {p}")
    print(f"[release] {version}: {counts['observations']} observations, "
          f"{sum(1 for o in all_obs if o.published)} published, {len(hashes)} page renders, "
          f"{'self-check ok' if not problems else str(len(problems)) + ' problems'}")
    return out


def check_release(path: Path | str) -> list[str]:
    """Re-run the arithmetic over a release's own cells and test self-consistency. Needs no PDFs."""
    path = Path(path)
    problems: list[str] = []
    try:
        release = Release(**config.read_json(path / "release.json"))
        cells = {c["cell_id"]: Cell(**c) for c in config.read_json(path / "cells.json")}
        checks = [Check(**c) for c in config.read_json(path / "checks.json")]
        observations = [Observation(**o) for o in config.read_json(path / "observations.json")]
        series = {s["series_id"]: Series(**s) for s in config.read_json(path / "series.json")}
        sources = {s["source_id"] for s in config.read_json(path / "sources.json")}
    except Exception as exc:
        return [f"release files do not load against the schema: {type(exc).__name__}: {exc}"]

    # thresholds
    live = config.sha256_text_lf(config.THRESHOLDS_YAML)
    if release.thresholds_sha256 != live:
        problems.append("release.thresholds_sha256 differs from thresholds/thresholds.yaml")
    if frozen_hash() != live:
        problems.append("thresholds/thresholds.yaml does not match the hash in thresholds/FROZEN.md")

    # referential integrity
    checks_by_id = {c.check_id: c for c in checks}
    if len(checks_by_id) != len(checks):
        problems.append("duplicate check ids")
    for c in cells.values():
        if c.source_id not in sources:
            problems.append(f"cell {c.cell_id}: unknown source {c.source_id}")
        png = path / "pages" / c.source_id / f"p{c.page:03d}.png"
        if not png.exists():
            problems.append(f"cell {c.cell_id}: page render missing {png.name}")
    seen_png: dict[Path, str] = {}
    for c in cells.values():
        png = path / "pages" / c.source_id / f"p{c.page:03d}.png"
        if png.exists():
            if png not in seen_png:
                seen_png[png] = config.sha256_file(png)
            if c.page_render_sha256 != seen_png[png]:
                problems.append(f"cell {c.cell_id}: page render hash mismatch")
                break
    for chk in checks:
        for cid in [chk.target_cell_id, *chk.member_cell_ids]:
            if cid is not None and cid not in cells:
                problems.append(f"check {chk.check_id}: unknown cell {cid}")
    obs_ids = set()
    for o in observations:
        if o.obs_id in obs_ids:
            problems.append(f"duplicate observation {o.obs_id}")
        obs_ids.add(o.obs_id)
        if o.series_id not in series:
            problems.append(f"observation {o.obs_id}: unknown series")
            continue
        if o.primary_cell_id is not None and o.primary_cell_id not in cells:
            problems.append(f"observation {o.obs_id}: unknown primary cell")
        for cid in o.supporting_cell_ids:
            if cid not in cells:
                problems.append(f"observation {o.obs_id}: unknown supporting cell {cid}")
        for cid in o.check_ids:
            if cid not in checks_by_id:
                problems.append(f"observation {o.obs_id}: unknown check {cid}")
        if not o.published and o.value is not None:
            problems.append(f"observation {o.obs_id}: unpublished but carries a value")
        if not o.published and not o.gap_kind:
            problems.append(f"observation {o.obs_id}: unpublished without a gap kind")
        if o.published and o.status != "checked":
            problems.append(f"observation {o.obs_id}: published but not 'checked'")
        if o.published and o.tier not in ("A", "B"):
            problems.append(f"observation {o.obs_id}: published with tier {o.tier}")

    checks_by_cell: dict[str, list[Check]] = defaultdict(list)
    for chk in checks:
        for cid in {chk.target_cell_id, *chk.member_cell_ids} - {None}:
            checks_by_cell[cid].append(chk)

    # re-run the arithmetic of every check from the cells
    for chk in checks:
        if chk.result == "not_evaluable":
            continue
        try:
            if chk.check_type in SUM_TYPES or chk.check_type == "weights_sum":
                members = [cells[cid] for cid in chk.member_cell_ids]
                signs = chk.member_signs or [1] * len(members)
                observed = sum((Decimal(m.value_parsed) * s for m, s in zip(members, signs, strict=True)), Decimal(0))
                if chk.observed is None or Decimal(chk.observed) != observed:
                    problems.append(f"check {chk.check_id}: stored sum {chk.observed} != recomputed {observed}")
                expected = Decimal(cells[chk.target_cell_id].value_parsed) if chk.target_cell_id else Decimal(chk.expected)
                if chk.check_type in SUM_TYPES:
                    unit = max(last_digit_unit(c.value_parsed) for c in [*members, cells[chk.target_cell_id]])
                    result = classify_sum(observed - expected, len(members), unit)
                    if result != chk.result:
                        problems.append(f"check {chk.check_id}: stored result {chk.result} != recomputed {result}")
            elif chk.check_type in EQUAL_TYPES:
                a = Decimal(cells[chk.target_cell_id].value_parsed)
                b = Decimal(cells[chk.member_cell_ids[0]].value_parsed)
                unit = max(last_digit_unit(cells[chk.target_cell_id].value_parsed),
                           last_digit_unit(cells[chk.member_cell_ids[0]].value_parsed))
                result = "pass" if a == b else ("pass_within_rounding" if abs(a - b) <= unit else "fail")
                if result == "fail" and chk.check_type == "cross_edition" and chk.official:
                    # D25: `disputed` only when every condition holds; recomputed here from the release itself.
                    result = "fail" if dispute_test(chk, cells, checks_by_cell) else "disputed"
                if result != chk.result:
                    problems.append(f"check {chk.check_id}: stored result {chk.result} != recomputed {result}")
            if chk.expected is not None and chk.observed is not None and chk.residual is not None:
                if Decimal(chk.observed) - Decimal(chk.expected) != Decimal(chk.residual):
                    problems.append(f"check {chk.check_id}: residual is not observed minus expected")
        except Exception as exc:
            problems.append(f"check {chk.check_id}: could not be recomputed ({type(exc).__name__})")

    # status must be reproducible from the evidence in the release
    by_obs = {o.obs_id: o for o in observations}
    gated = {ds for ds, g in release.dataset_status.items() if not g.get("meets_thresholds")}
    for o in observations:
        s = series[o.series_id]
        if s.derived:
            if o.published:
                inputs = [by_obs.get(i) for i in o.derived_from]
                if len(inputs) != 2 or any(i is None or not i.published for i in inputs):
                    problems.append(f"derived observation {o.obs_id}: an input is not published")
                elif s.derivation and "x 100" in s.derivation.formula:
                    value = (Decimal(inputs[0].value) / Decimal(inputs[1].value) * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
                    if value != Decimal(o.value):
                        problems.append(f"derived observation {o.obs_id}: value does not recompute")
            continue
        if o.primary_cell_id is None or o.primary_cell_id not in cells:
            continue
        primary = cells[o.primary_cell_id]
        if o.published and o.value != primary.value_parsed:
            problems.append(f"observation {o.obs_id}: published value differs from its primary cell")
        if primary.is_missing:
            continue
        supporting = [cells[c] for c in o.supporting_cell_ids if c in cells]
        if is_disputed([primary, *supporting], checks_by_cell) != (o.status == "disputed"):
            problems.append(f"observation {o.obs_id}: status {o.status} does not follow from its cross-edition checks")
        if o.status == "disputed":
            if o.published or o.value is not None or o.tier is not None or o.gap_kind != "disputed":
                problems.append(f"observation {o.obs_id}: disputed but carries a value, a tier or the wrong gap kind")
            if [r.model_dump() for r in o.disputed_readings] != [r.model_dump() for r in disputed_readings([primary, *supporting])]:
                problems.append(f"observation {o.obs_id}: disputed readings differ from its cells")
            if len({r.value_parsed for r in o.disputed_readings}) < 2:
                problems.append(f"observation {o.obs_id}: disputed without two different readings")
            continue
        if o.disputed_readings:
            problems.append(f"observation {o.obs_id}: lists disputed readings but is not disputed")
        tier, _ = decide_tier(primary, supporting, checks_by_cell)
        if tier != o.tier:
            problems.append(f"observation {o.obs_id}: stored tier {o.tier} != tier from evidence {tier}")
        if s.dataset in gated and o.published:
            problems.append(f"observation {o.obs_id}: published although its data type is below a threshold")
        if s.dataset not in gated and (tier in ("A", "B")) != o.published:
            problems.append(f"observation {o.obs_id}: published flag does not follow from tier {tier}")
    return problems
