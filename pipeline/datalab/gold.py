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
from fractions import Fraction
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
    rows = []
    for i, (key, c) in enumerate(chosen, start=1):
        # The labelling page shows the release's own page renders; nothing is copied.
        rel = f"../releases/{version}/pages/{c['source_id']}/p{c['page']:03d}.png"
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


UNREADABLE_WORDS = ("1", "true", "yes")


def read_labels(path: Path) -> tuple[dict[str, tuple[str, str | None]], int]:
    """One labeller's file -> ({cell_id: (kind, key)}, rows that repeated a cell).

    kind is `reading` (key: "missing" or the canonical decimal string), `unreadable` (the box was
    ticked) or `not_one_number` (text was typed that the parser does not read as exactly one number
    or a blank marker). A row with neither a reading nor the box ticked is not a label. The typed
    text is parsed by the same `parse_printed` the pipeline uses, so "1,234" and "1234" are the
    same reading. If a cell appears twice in one file, the later row counts.
    """
    labels: dict[str, tuple[str, str | None]] = {}
    repeats = 0
    with Path(path).open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            cell_id = (row.get("cell_id") or "").strip()
            reading = (row.get("reading") or "").strip()
            unreadable = (row.get("unreadable") or "").strip().lower() in UNREADABLE_WORDS
            if not cell_id or not (reading or unreadable):
                continue
            repeats += cell_id in labels
            if unreadable:
                labels[cell_id] = ("unreadable", None)
                continue
            parsed = parse_printed(reading)
            if parsed.is_missing:
                labels[cell_id] = ("reading", "missing")
            elif parsed.value is not None:
                labels[cell_id] = ("reading", _canonical(parsed.value))
            else:
                labels[cell_id] = ("not_one_number", reading)
    return labels, repeats


def _canonical(value: Decimal) -> str:
    """One string per numeric value, so that 5.0 and 5 are the same reading (as before this change)."""
    return "0" if value == 0 else format(value.normalize(), "f")


def _extracted_key(cell: dict[str, Any]) -> str | None:
    """The release's reading of a cell in the same form as a label key; None when it holds no value."""
    if cell.get("is_missing"):
        return "missing"
    if cell.get("value_parsed") is None:
        return None
    return _canonical(Decimal(cell["value_parsed"]))


def cohen_kappa(pairs: list[tuple[str, str]]) -> dict[str, Any]:
    """Raw agreement and Cohen's kappa for two raters' categories over the same items.

    kappa = (observed agreement - agreement expected by chance) / (1 - agreement expected by chance).
    It is None when there are no items, or when chance agreement is 1 (both raters used a single
    category throughout, so kappa is not defined; raw agreement is still reported).
    """
    n = len(pairs)
    if n == 0:
        return {"items": 0, "raw_agreement": None, "kappa": None, "categories": {}}
    observed = Fraction(sum(1 for a, b in pairs if a == b), n)
    categories = sorted({c for pair in pairs for c in pair})
    first = {c: Fraction(sum(1 for a, _ in pairs if a == c), n) for c in categories}
    second = {c: Fraction(sum(1 for _, b in pairs if b == c), n) for c in categories}
    chance = sum((first[c] * second[c] for c in categories), Fraction(0))
    kappa = None if chance == 1 else (observed - chance) / (1 - chance)
    table = {f"{a}/{b}": sum(1 for pair in pairs if pair == (a, b)) for a in categories for b in categories}
    return {"items": n, "raw_agreement": round(float(observed), 4), "kappa": None if kappa is None else round(float(kappa), 4),
            "categories": table}


def gold_score(label_files: list[Path], version: str = config.DEFAULT_RELEASE, release_dir: Path | None = None,
               out_path: Path | None = None) -> dict[str, Any]:
    """Compare human labels with the release.

    The error rate is computed ONLY from cells that every labeller could read and on which all of
    them typed the same reading; it needs at least two labellers. Every other cell is counted in
    its own bucket and never enters the rate: labelled by some labellers only, unreadable for all,
    unreadable for some, a label that is not one number, labellers who read different numbers, and
    cell ids the release does not hold.

    Inter-rater agreement is reported per pair of labellers on the outcome "does my reading match
    the extracted value" (match / mismatch): raw agreement and Cohen's kappa over the cells both
    could read, and again with `unreadable` as a third category. Two labellers who both disagree
    with the extraction but typed different numbers agree on the outcome and still disagree on the
    reading, so that cell is not scored.
    """
    release_dir = Path(release_dir) if release_dir is not None else config.RELEASES_DIR / version
    cells = {c["cell_id"]: c for c in config.read_json(release_dir / "cells.json")}
    files = [Path(f) for f in label_files]
    raters = [f.stem for f in files]
    loaded = [read_labels(f) for f in files]
    labels = [found for found, _ in loaded]
    every_cell = sorted({cid for found in labels for cid in found})

    buckets = {"unknown_cell_ids": 0, "labelled_by_some_labellers_only": 0, "label_not_one_number": 0,
               "unreadable_for_all": 0, "unreadable_for_some": 0, "labellers_read_different_numbers": 0}
    agreed = wrong = no_value = 0
    errors: list[dict[str, Any]] = []
    to_resolve: list[dict[str, Any]] = []
    for cell_id in every_cell:
        cell = cells.get(cell_id)
        if cell is None:
            buckets["unknown_cell_ids"] += 1
            continue
        given = [found.get(cell_id) for found in labels]
        if any(g is None for g in given):
            buckets["labelled_by_some_labellers_only"] += 1
            continue
        kinds = [g[0] for g in given]
        if "not_one_number" in kinds:
            buckets["label_not_one_number"] += 1
            continue
        if all(k == "unreadable" for k in kinds):
            buckets["unreadable_for_all"] += 1
            continue
        if "unreadable" in kinds:
            buckets["unreadable_for_some"] += 1
            continue
        keys = {g[1] for g in given}
        if len(keys) != 1:
            buckets["labellers_read_different_numbers"] += 1
            to_resolve.append({"cell_id": cell_id, "readings": {r: g[1] for r, g in zip(raters, given)}})
            continue
        if len(files) < 2:
            continue                              # one labeller alone is not an agreed reading
        agreed += 1
        human, ours = keys.pop(), _extracted_key(cell)
        if human != ours:
            wrong += 1
            no_value += ours is None
            errors.append({"cell_id": cell_id, "human": human, "extracted": ours})

    def outcome(label: tuple[str, str | None], cell: dict[str, Any]) -> str:
        return "unreadable" if label[0] == "unreadable" else ("match" if label[1] == _extracted_key(cell) else "mismatch")

    agreement = []
    for i in range(len(files)):
        for j in range(i + 1, len(files)):
            both = [(labels[i][c], labels[j][c], cells[c]) for c in every_cell
                    if c in cells and c in labels[i] and c in labels[j]
                    and "not_one_number" not in (labels[i][c][0], labels[j][c][0])]
            readable = [(a, b, cell) for a, b, cell in both if a[0] == b[0] == "reading"]
            agreement.append({
                "labellers": [raters[i], raters[j]], "cells_labelled_by_both": len(both), "cells_both_could_read": len(readable),
                "same_reading": sum(1 for a, b, _ in readable if a[1] == b[1]),
                "match_mismatch": cohen_kappa([(outcome(a, cell), outcome(b, cell)) for a, b, cell in readable]),
                "match_mismatch_unreadable": cohen_kappa([(outcome(a, cell), outcome(b, cell)) for a, b, cell in both]),
            })

    basis = "cells that every labeller could read and on which all typed the same reading"
    result = {
        "release": version, "labellers": len(files), "labeller_files": raters,
        "labels_per_labeller": {r: len(found) for r, found in zip(raters, labels)},
        "repeated_rows_per_labeller": {r: n for r, (_, n) in zip(raters, loaded)},
        "cells_labelled": len(every_cell),
        # the only cells the error rate is computed from
        "cells_with_agreed_label": agreed, "errors": wrong, "errors_where_extraction_has_no_value": no_value,
        "error_rate": round(wrong / agreed, 4) if agreed else None,
        "error_rate_basis": basis if len(files) >= 2 else basis + "; not computed: at least two labellers are needed",
        # everything else, each counted apart, none of it in the rate
        "not_scored": buckets,
        "labeller_disagreements_to_resolve": buckets["labellers_read_different_numbers"],
        "unreadable": buckets["unreadable_for_all"],
        "inter_rater_agreement": agreement, "error_list": errors, "disagreement_list": to_resolve,
    }
    out_path = Path(out_path) if out_path is not None else GOLD_DIR / "score.json"
    config.write_json(out_path, result)
    not_scored = ", ".join(f"{k} {v}" for k, v in buckets.items() if v) or "none"
    print(f"[gold] cells every labeller read the same way: {agreed}; of those, extraction differs: {wrong}; "
          f"error rate: {result['error_rate']}; not scored: {sum(buckets.values())} ({not_scored})")
    for a in agreement:
        mm = a["match_mismatch"]
        print(f"[gold] {a['labellers'][0]} and {a['labellers'][1]}: both could read {a['cells_both_could_read']} cells; "
              f"raw agreement on match/mismatch {mm['raw_agreement']}; Cohen's kappa {mm['kappa']}")
    return result
