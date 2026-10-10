"""Semantic diff of two release folders (plan item E5): `datalab diff-release A B`.

Answers one question: do the two folders hold the same data? "Same" means

- the same sources, by SHA-256;
- the same series ids;
- the same cells, matched by where they are (source, page, table, row, column, reader), with the
  same printed text, parsed value, box (within 1e-4), series, period and vintage;
- the same checks, matched by type, rule and the cells they cover, with the same result and residual;
- the same observations, matched by id, with the same value, status, tier, published flag and gap kind.

Run ids, timestamps, the git commit and `created_at` differ between two honest rebuilds. They are
reported apart as "expected differences" and do not affect the verdict. Nothing is written.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from . import config

BBOX_TOLERANCE = 1e-4
SHOW = 20
KINDS = ("sources", "series", "cells", "checks", "observations")
CELL_FIELDS = ("value_raw", "value_parsed", "series_id", "period", "vintage")
OBS_FIELDS = ("value", "status", "tier", "published", "gap_kind")


def _load(folder: Path) -> dict[str, Any]:
    names = ("release", "sources", "series", "observations", "cells", "checks")
    return {name: config.read_json(Path(folder) / f"{name}.json") for name in names}


def cell_key(cell: dict[str, Any]) -> tuple:
    """Where a cell is. The reader is part of it: a second reader's cell can sit at the same spot."""
    return (cell["source_id"], cell["page"], cell["table_index"], cell["row_index"], cell["col_index"],
            cell.get("extractor_name") or "")


def _key_text(key: tuple) -> str:
    return f"{key[0]} p.{key[1]} table {key[2]} row {key[3]} col {key[4]}" + (f" ({key[5]})" if key[5] not in ("", "docling") else "")


def _bbox_differs(a: Any, b: Any) -> bool:
    if a is None or b is None:
        return a != b
    return len(a) != len(b) or any(abs(float(x) - float(y)) > BBOX_TOLERANCE for x, y in zip(a, b))


def check_key(check: dict[str, Any], cell_keys: dict[str, tuple]) -> tuple:
    """A check's identity without ids from a run: type, rule, and the positions of its cells."""
    target = cell_keys.get(check.get("target_cell_id") or "")
    members = tuple(sorted((cell_keys.get(m) or ("?", m) for m in check.get("member_cell_ids", [])), key=str))
    return (check["check_type"], check.get("rule_id") or "", target, members, check.get("target_source") or "",
            check.get("target_value") or "")


def _check_text(key: tuple) -> str:
    where = _key_text(key[2]) if key[2] else (key[4] or "no target cell")
    return f"{key[0]} / {key[1]} on {where} with {len(key[3])} member cell(s)"


def _unique(items: list[dict[str, Any]], key_of, what: str, side: str, problems: list[str]) -> dict[Any, dict[str, Any]]:
    out: dict[Any, dict[str, Any]] = {}
    for item in items:
        key = key_of(item)
        if key in out:
            problems.append(f"{side}: two {what} share the key {key}")
        out[key] = item
    return out


def diff_releases(a_dir: Path | str, b_dir: Path | str) -> dict[str, Any]:
    """Compare two release folders. Returns {"differences": {kind: [...]}, "expected": {...}, "counts": {...}}."""
    a_dir, b_dir = Path(a_dir), Path(b_dir)
    a, b = _load(a_dir), _load(b_dir)
    diffs: dict[str, list[str]] = {kind: [] for kind in KINDS}

    # sources, by SHA-256
    sa = {s["source_id"]: s for s in a["sources"]}
    sb = {s["source_id"]: s for s in b["sources"]}
    for sid in sorted(set(sa) | set(sb)):
        if sid not in sb:
            diffs["sources"].append(f"{sid}: only in A")
        elif sid not in sa:
            diffs["sources"].append(f"{sid}: only in B")
        elif sa[sid].get("sha256") != sb[sid].get("sha256"):
            diffs["sources"].append(f"{sid}: sha256 {str(sa[sid].get('sha256'))[:12]} in A, {str(sb[sid].get('sha256'))[:12]} in B")

    # series ids
    ia, ib = {s["series_id"] for s in a["series"]}, {s["series_id"] for s in b["series"]}
    diffs["series"] += [f"{sid}: only in A" for sid in sorted(ia - ib)] + [f"{sid}: only in B" for sid in sorted(ib - ia)]

    # cells, by position
    ca = _unique(a["cells"], cell_key, "cells", "A", diffs["cells"])
    cb = _unique(b["cells"], cell_key, "cells", "B", diffs["cells"])
    for key in sorted(set(ca) | set(cb), key=str):
        if key not in cb:
            diffs["cells"].append(f"{_key_text(key)}: only in A ({ca[key].get('value_raw')!r})")
            continue
        if key not in ca:
            diffs["cells"].append(f"{_key_text(key)}: only in B ({cb[key].get('value_raw')!r})")
            continue
        x, y = ca[key], cb[key]
        changed = [f"{f} {x.get(f)!r} -> {y.get(f)!r}" for f in CELL_FIELDS if x.get(f) != y.get(f)]
        if _bbox_differs(x.get("cell_bbox_norm"), y.get("cell_bbox_norm")):
            changed.append(f"cell_bbox_norm {x.get('cell_bbox_norm')} -> {y.get('cell_bbox_norm')}")
        if changed:
            diffs["cells"].append(f"{_key_text(key)}: " + "; ".join(changed))

    # checks, by type, rule and cells; several checks may share a key, so outcomes are compared as multisets
    keys_a = {c["cell_id"]: cell_key(c) for c in a["cells"]}
    keys_b = {c["cell_id"]: cell_key(c) for c in b["cells"]}
    ka: dict[tuple, list[tuple]] = defaultdict(list)
    kb: dict[tuple, list[tuple]] = defaultdict(list)
    for chk in a["checks"]:
        ka[check_key(chk, keys_a)].append((chk.get("result"), chk.get("residual")))
    for chk in b["checks"]:
        kb[check_key(chk, keys_b)].append((chk.get("result"), chk.get("residual")))
    for key in sorted(set(ka) | set(kb), key=str):
        if key not in kb:
            diffs["checks"].append(f"{_check_text(key)}: only in A")
        elif key not in ka:
            diffs["checks"].append(f"{_check_text(key)}: only in B")
        elif Counter(ka[key]) != Counter(kb[key]):
            diffs["checks"].append(f"{_check_text(key)}: (result, residual) {sorted(ka[key], key=str)} in A, {sorted(kb[key], key=str)} in B")

    # observations, by id
    oa = _unique(a["observations"], lambda o: o["obs_id"], "observations", "A", diffs["observations"])
    ob = _unique(b["observations"], lambda o: o["obs_id"], "observations", "B", diffs["observations"])
    for oid in sorted(set(oa) | set(ob)):
        if oid not in ob:
            diffs["observations"].append(f"{oid}: only in A")
        elif oid not in oa:
            diffs["observations"].append(f"{oid}: only in B")
        else:
            changed = [f"{f} {oa[oid].get(f)!r} -> {ob[oid].get(f)!r}" for f in OBS_FIELDS if oa[oid].get(f) != ob[oid].get(f)]
            if changed:
                diffs["observations"].append(f"{oid}: " + "; ".join(changed))

    # expected differences: reported, never part of the verdict
    expected: dict[str, Any] = {}
    ra, rb = a["release"], b["release"]
    for field in ("version", "created_at", "git_commit"):
        if ra.get(field) != rb.get(field):
            expected[f"release.{field}"] = f"{ra.get(field)} in A, {rb.get(field)} in B"
    shared_cells = [k for k in ca if k in cb]
    run_changes = Counter((ca[k].get("run_id"), cb[k].get("run_id")) for k in shared_cells if ca[k].get("run_id") != cb[k].get("run_id"))
    if run_changes:
        expected["cells with another run id"] = (f"{sum(run_changes.values()):,} cells; " + "; ".join(
            f"{x} -> {y} ({n:,})" for (x, y), n in sorted(run_changes.items(), key=str)[:SHOW])
            + (f"; and {len(run_changes) - SHOW} more pairs of runs" if len(run_changes) > SHOW else ""))
    runs_a = {p.name for p in (a_dir / "runs").glob("*.json")} if (a_dir / "runs").is_dir() else set()
    runs_b = {p.name for p in (b_dir / "runs").glob("*.json")} if (b_dir / "runs").is_dir() else set()
    if runs_a != runs_b:
        expected["run manifests"] = f"{len(runs_a - runs_b)} only in A, {len(runs_b - runs_a)} only in B"
    stamps = sum(1 for sid in sa if sid in sb and any(sa[sid].get(f) != sb[sid].get(f) for f in ("retrieved_at", "wayback_timestamp")))
    if stamps:
        expected["sources with another retrieval or Wayback timestamp"] = f"{stamps} sources"
    marks = sum(1 for oid in oa if oid in ob and any(oa[oid].get(f) != ob[oid].get(f) for f in ("first_published_release", "last_changed_release")))
    if marks:
        expected["observations with another release mark"] = f"{marks:,} observations (first_published_release, last_changed_release)"

    # not part of the verdict either, but a reader should know
    other: dict[str, str] = {}
    for field in ("thresholds_sha256", "tool_versions", "extract_config_sha256s"):
        if ra.get(field) != rb.get(field):
            other[f"release.{field}"] = f"{ra.get(field)} in A, {rb.get(field)} in B"
    renders = sum(1 for k in shared_cells if ca[k].get("page_render_sha256") != cb[k].get("page_render_sha256"))
    if renders:
        other["cells whose page render has another hash"] = f"{renders:,} cells (the page image file differs; the data compared above does not depend on it)"
    retrieved = [sid for sid in sorted(sa) if sid in sb and sa[sid].get("retrieved_via") != sb[sid].get("retrieved_via")]
    if retrieved:
        other["sources obtained by another route"] = ", ".join(f"{sid} ({sa[sid].get('retrieved_via')} -> {sb[sid].get('retrieved_via')})" for sid in retrieved)

    counts = {"sources": (len(sa), len(sb)), "series": (len(ia), len(ib)), "cells": (len(a["cells"]), len(b["cells"])),
              "checks": (len(a["checks"]), len(b["checks"])), "observations": (len(a["observations"]), len(b["observations"]))}
    return {"a": str(a_dir), "b": str(b_dir), "differences": diffs, "expected": expected, "other_metadata": other,
            "counts": counts, "same": not any(diffs.values())}


def format_diff(result: dict[str, Any]) -> str:
    lines = [f"A: {result['a']}", f"B: {result['b']}", "", f"{'kind':<14}{'in A':>9}{'in B':>9}{'differences':>14}"]
    for kind in KINDS:
        n_a, n_b = result["counts"][kind]
        lines.append(f"{kind:<14}{n_a:>9,}{n_b:>9,}{len(result['differences'][kind]):>14,}")
    for kind in KINDS:
        found = result["differences"][kind]
        if not found:
            continue
        lines += ["", f"{kind}: {len(found):,} difference(s)" + (f", first {SHOW} shown" if len(found) > SHOW else "")]
        lines += [f"  - {d}" for d in found[:SHOW]]
    lines += ["", "Expected differences (run ids, timestamps, commit; not part of the verdict):"]
    lines += [f"  - {k}: {v}" for k, v in result["expected"].items()] or ["  - none"]
    if result["other_metadata"]:
        lines += ["", "Other metadata that differs (not part of the verdict; worth a look):"]
        lines += [f"  - {k}: {v}" for k, v in result["other_metadata"].items()]
    lines += ["", "RESULT: the two releases hold the same sources, series, cells, checks and observations." if result["same"]
              else "RESULT: the two releases DIFFER."]
    return "\n".join(lines)
