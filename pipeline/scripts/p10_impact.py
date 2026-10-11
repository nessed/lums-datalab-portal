"""P10 impact: what the member floor (H12) does to a frozen release. Reads the release only; changes nothing.

For every observation that has a primary cell, decide the tier twice from the release's own cells and checks:
once with the floor switched off (the rule the release was built under) and once with it on. Prints how many
published values change tier or lose publication, by data type, and lists the lost ones.

    python scripts/p10_impact.py [releases/v0.0.1-prototype] [--list]
"""
from __future__ import annotations

import sys
from collections import Counter, defaultdict
from pathlib import Path

from datalab import config, status
from datalab.schema import Cell, Check, Observation, Series


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    path = Path(args[0] if args else "releases/v0.0.1-prototype")
    cells = {c["cell_id"]: Cell(**c) for c in config.read_json(path / "cells.json")}
    checks = [Check(**c) for c in config.read_json(path / "checks.json")]
    observations = [Observation(**o) for o in config.read_json(path / "observations.json")]
    series = {s["series_id"]: Series(**s) for s in config.read_json(path / "series.json")}
    by_cell: dict[str, list[Check]] = defaultdict(list)
    for chk in checks:
        for cid in {chk.target_cell_id, *chk.member_cell_ids} - {None}:
            by_cell[cid].append(chk)

    real_floor = status.below_allowance
    changes: Counter = Counter()
    lost: list[tuple[str, str, str, str]] = []
    published: Counter = Counter()
    for o in observations:
        s = series.get(o.series_id)
        if s is None or s.derived or o.status == "disputed" or o.primary_cell_id not in cells:
            continue
        primary = cells[o.primary_cell_id]
        if primary.is_missing:
            continue
        supporting = [cells[c] for c in o.supporting_cell_ids if c in cells]
        status.below_allowance = lambda *a, **k: False
        old, _ = status.decide_tier(primary, supporting, by_cell, cells)
        status.below_allowance = real_floor
        new, _ = status.decide_tier(primary, supporting, by_cell, cells)
        if old in ("A", "B"):
            published[s.dataset] += 1
        if old != new:
            changes[(s.dataset, f"{old}->{new}")] += 1
            if old in ("A", "B") and new not in ("A", "B"):
                lost.append((s.dataset, o.obs_id, primary.value_raw.strip(), f"{primary.source_id} p.{primary.page}"))
    print(f"release {path}")
    for ds in sorted(published):
        gone = sum(1 for d, *_ in lost if d == ds)
        print(f"  {ds}: {published[ds]} published under the old rule; {gone} lose publication under the floor")
    for (ds, move), n in sorted(changes.items()):
        print(f"  tier change {ds} {move}: {n}")
    print(f"  total published values withheld by the floor: {len(lost)}")
    if "--list" in argv:
        for row in sorted(lost):
            print("   ", *row)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
