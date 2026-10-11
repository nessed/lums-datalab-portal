"""Evidence-strength report: what actually supports each published value. Reads a frozen release; changes nothing.

For every published, non-derived observation it lists the checks that count as evidence for the primary cell (the
same rule status.decide_tier uses, including the P10 member floor) and sorts the value into one strength class:

  both       arithmetic and agreement with another printing (tier A)
  sum_2plus  two or more passed sums, and no agreement
  sum_1      exactly one passed sum, and no agreement
  agree      agreement with another printing only
  none       published in the release, but no evidence counts under the P10 floor
Within each class it also counts the weak spots: the only support is a pass within rounding, a member only just above the
floor (less than 3 x the allowance), a second-reader value, a cell with normalisation flags.

    python scripts/evidence_strength.py [releases/v0.0.1-prototype] [--out docs/reports/evidence_strength.md]
"""
from __future__ import annotations

import sys
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path

from datalab import config
from datalab.checks import sum_allowance
from datalab.schema import AGREEMENT_CHECKS, ARITHMETIC_CHECKS, PASSING, Cell, Check, Observation, Series
from datalab.status import credits

THIN = Decimal(3)   # a member smaller than 3 x the allowance is "thinly" supported


def classify(o: Observation, primary: Cell, supporting: list[Cell], by_cell: dict[str, list[Check]], cells: dict[str, Cell]):
    own = [c for c in by_cell.get(primary.cell_id, []) if c.official and c.result in PASSING and credits(c, primary, cells)]
    sums = [c for c in own if c.check_type in ARITHMETIC_CHECKS]
    agree = [c for c in own if c.check_type in AGREEMENT_CHECKS]
    if not sums:
        # arithmetic on a second printing that shows the same figure counts, as in decide_tier
        for s in supporting:
            sums += [c for c in by_cell.get(s.cell_id, []) if c.official and c.result in PASSING
                     and c.check_type in ARITHMETIC_CHECKS and credits(c, s, cells)]
    if sums and agree:
        klass = "both"
    elif len(sums) >= 2:
        klass = "sum_2plus"
    elif sums:
        klass = "sum_1"
    elif agree:
        klass = "agree"
    else:
        klass = "none"
    weak: list[str] = []
    only_rounding = [c for c in sums + agree if c.result == "pass_within_rounding"]
    if (sums or agree) and len(only_rounding) == len(sums) + len(agree):
        weak.append("every supporting pass is within rounding")
    thin = False
    for c in sums:
        allowance = sum_allowance(c, cells)
        if allowance and c.target_cell_id != primary.cell_id and primary.value_parsed is not None \
                and abs(Decimal(primary.value_parsed)) < THIN * allowance:
            thin = True
    if thin and len(sums) == 1 and not agree:
        weak.append("small member of its only sum")
    if primary.second_reader_of is not None:
        weak.append("second-reader value")
    if primary.normalization_flags:
        weak.append("normalisation flag")
    return klass, weak


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    out_path = None
    if "--out" in argv:
        out_path = Path(argv[argv.index("--out") + 1])
        args = [a for a in args if a != str(out_path)]
    path = Path(args[0] if args else "releases/v0.0.1-prototype")
    cells = {c["cell_id"]: Cell(**c) for c in config.read_json(path / "cells.json")}
    checks = [Check(**c) for c in config.read_json(path / "checks.json")]
    observations = [Observation(**o) for o in config.read_json(path / "observations.json")]
    series = {s["series_id"]: Series(**s) for s in config.read_json(path / "series.json")}
    by_cell: dict[str, list[Check]] = defaultdict(list)
    for chk in checks:
        for cid in {chk.target_cell_id, *chk.member_cell_ids} - {None}:
            by_cell[cid].append(chk)

    table: dict[str, Counter] = defaultdict(Counter)
    weak_by: dict[str, Counter] = defaultdict(Counter)
    withheld_now = Counter()
    for o in observations:
        s = series.get(o.series_id)
        if s is None or s.derived or o.primary_cell_id not in cells or o.status == "disputed":
            continue
        primary = cells[o.primary_cell_id]
        if primary.is_missing:
            continue
        if not o.published:
            continue
        supporting = [cells[c] for c in o.supporting_cell_ids if c in cells]
        klass, weak = classify(o, primary, supporting, by_cell, cells)
        table[s.dataset][klass] += 1
        for w in weak:
            weak_by[s.dataset][(klass, w)] += 1
    names = {"both": "arithmetic and agreement (tier A)", "sum_2plus": "two or more sums",
             "sum_1": "one sum only", "agree": "agreement only",
             "none": "no counted evidence (withheld once rebuilt, P10)"}
    lines = ["# Evidence strength of the published values", "",
             f"Release: `releases/{path.name}`. Published, non-derived observations, classified by what counts as evidence for the "
             "primary cell under the current rules (the P10 member floor applied). Generated by "
             "`pipeline/scripts/evidence_strength.py`; nothing in the release changes.", ""]
    header = "| Data type | " + " | ".join(names.values()) + " | Total |"
    lines += [header, "|" + "---|" * (len(names) + 2)]
    for ds in sorted(table):
        row = table[ds]
        lines.append(f"| {ds.upper()} | " + " | ".join(str(row[k]) for k in names) + f" | {sum(row.values())} |")
    lines += ["", "## Weak spots inside each class", "",
              "A value can appear under more than one weak spot. Counts are values, not checks.", "",
              "| Data type | Class | Weak spot | Values |", "|---|---|---|---|"]
    for ds in sorted(weak_by):
        for (klass, w), n in sorted(weak_by[ds].items(), key=lambda kv: (-kv[1], kv[0])):
            lines.append(f"| {ds.upper()} | {names[klass]} | {w} | {n} |")
    text = "\n".join(lines) + "\n"
    if out_path:
        out_path.write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
