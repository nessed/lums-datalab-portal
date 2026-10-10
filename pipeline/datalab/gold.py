"""Gold-set kit (plan 6.11). The pipeline draws the sample; only humans label it.

`gold-sample` writes a blind sample: the extracted value is NOT included, so
the labeller reads the number from the page image without seeing ours.
`gold-score` compares finished human labels with the release. No language
model takes part in either step.
"""
from __future__ import annotations

import csv
import json
import random
import shutil
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from typing import Any

from . import config
from .normalise import parse_printed

GOLD_DIR = config.REPO_ROOT / "gold"
SAMPLE_FIELDS = ["sample_id", "cell_id", "source_id", "source_title", "page", "render", "x0", "y0", "x1", "y1",
                 "row_label", "column_label", "stratum"]


def _level(series: dict[str, Any] | None) -> str:
    if series is None:
        return "unmapped"
    sid = series["series_id"]
    if ".function." in sid or ".group." in sid or ".industry." in sid:
        return "breakdown"
    if "total" in sid or sid.endswith("_account") or ".general" in sid:
        return "total"
    return "other"


def gold_sample(version: str = config.DEFAULT_RELEASE, n: int = 400, seed: int = 20261011) -> Path:
    release_dir = config.RELEASES_DIR / version
    cells = config.read_json(release_dir / "cells.json")
    series = {s["series_id"]: s for s in config.read_json(release_dir / "series.json")}
    sources = {s["source_id"]: s for s in config.read_json(release_dir / "sources.json")}
    eligible = [c for c in cells if c["value_raw"].strip()]
    strata: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for c in eligible:
        s = series.get(c["series_id"]) if c["series_id"] else None
        dataset = s["dataset"] if s else sources[c["source_id"]]["doc_type"]
        strata[(dataset, c["source_id"], _level(s))].append(c)
    rng = random.Random(seed)
    total = len(eligible)
    n = min(n, total)
    chosen: list[tuple[tuple[str, str, str], dict[str, Any]]] = []
    # proportional allocation, at least one cell per stratum
    quotas = {k: max(1, round(n * len(v) / total)) for k, v in sorted(strata.items())}
    for key in sorted(strata):
        pool = sorted(strata[key], key=lambda c: c["cell_id"])
        rng.shuffle(pool)
        chosen += [(key, c) for c in pool[: min(quotas[key], len(pool))]]
    rng.shuffle(chosen)
    chosen = chosen[:n] if len(chosen) > n else chosen

    GOLD_DIR.mkdir(exist_ok=True)
    renders = GOLD_DIR / "renders"
    rows = []
    for i, (key, c) in enumerate(chosen, start=1):
        rel = f"renders/{c['source_id']}/p{c['page']:03d}.png"
        dest = GOLD_DIR / rel
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(release_dir / "pages" / c["source_id"] / f"p{c['page']:03d}.png", dest)
        x0, y0, x1, y1 = c["cell_bbox_norm"]
        rows.append({"sample_id": f"g{i:04d}", "cell_id": c["cell_id"], "source_id": c["source_id"],
                     "source_title": sources[c["source_id"]]["title"], "page": c["page"], "render": rel,
                     "x0": x0, "y0": y0, "x1": x1, "y1": y1, "row_label": c["row_label_raw"],
                     "column_label": c["col_label_raw"], "stratum": "/".join(key)})
    with (GOLD_DIR / "sample.csv").open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=SAMPLE_FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    # The labelling page is opened from disk (file://), where fetch() of a CSV is blocked, so the
    # same rows are also written as a script the page can load.
    config.write_text(GOLD_DIR / "sample.js", "window.GOLD_SAMPLE = " + json.dumps(rows, indent=1) + ";\n")
    config.write_json(GOLD_DIR / "sample_meta.json", {
        "release": version, "seed": seed, "requested": n, "drawn": len(rows), "eligible_cells": total,
        "strata": {"/".join(k): {"cells": len(v), "drawn": sum(1 for key, _ in chosen if key == k)} for k, v in sorted(strata.items())},
        "blind": "The extracted value is deliberately absent from sample.csv and sample.js.",
        "status": "unlabelled",
    })
    print(f"[gold] drew {len(rows)} of {total} cells across {len(strata)} strata (seed {seed}) -> gold/sample.csv")
    return GOLD_DIR / "sample.csv"


def gold_score(label_files: list[Path], version: str = config.DEFAULT_RELEASE) -> dict[str, Any]:
    """Compare human labels with the release. A cell counts only when every labeller agrees with the others."""
    cells = {c["cell_id"]: c for c in config.read_json(config.RELEASES_DIR / version / "cells.json")}
    readings: dict[str, list[str]] = defaultdict(list)
    for path in label_files:
        with Path(path).open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                if (row.get("reading") or "").strip() or (row.get("unreadable") or "").lower() in ("1", "true", "yes"):
                    readings[row["cell_id"]].append("UNREADABLE" if (row.get("unreadable") or "").lower() in ("1", "true", "yes")
                                                    else row["reading"])
    agreed = wrong = disagreements = unreadable = 0
    errors = []
    for cell_id, values in readings.items():
        cell = cells.get(cell_id)
        if cell is None or len(values) < len(label_files):
            continue
        parsed = [parse_printed(v) for v in values]
        keys = {("missing" if p.is_missing else str(p.value)) if v != "UNREADABLE" else "UNREADABLE" for p, v in zip(parsed, values)}
        if len(keys) != 1:
            disagreements += 1
            continue
        key = keys.pop()
        if key == "UNREADABLE":
            unreadable += 1
            continue
        agreed += 1
        ours = "missing" if cell["is_missing"] else cell["value_parsed"]
        same = (ours == key) or (ours not in (None, "missing") and key not in ("missing", "None") and Decimal(ours) == Decimal(key))
        if not same:
            wrong += 1
            errors.append({"cell_id": cell_id, "human": key, "extracted": ours})
    result = {"release": version, "labellers": len(label_files), "cells_with_agreed_label": agreed,
              "labeller_disagreements_to_resolve": disagreements, "unreadable": unreadable, "errors": wrong,
              "error_rate": round(wrong / agreed, 4) if agreed else None, "error_list": errors}
    config.write_json(GOLD_DIR / "score.json", result)
    print(f"[gold] agreed labels: {agreed}; extraction errors: {wrong}; error rate: {result['error_rate']}; "
          f"labeller disagreements still to resolve: {disagreements}")
    return result
