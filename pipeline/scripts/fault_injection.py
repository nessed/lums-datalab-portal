"""Fault injection: if a published value were wrong in a typical way, would the layer still publish it?

Reads a frozen release and changes nothing in it. For every published, non-derived observation it makes a wrong copy of
the primary cell's value (one fault at a time), recomputes every sum and equality check that touches that cell from the
changed value, and asks `status.decide_tier` whether the observation would still be published (tier A or B). A fault that
still comes out published is an *escape*.

What it can and cannot say
  * It redoes sums (including weights), equalities, reference weights, cross-source comparisons, recomputed rates and
    index aggregations from the changed value. Where a recompute formula cannot be reproduced from the stored record
    the stored result is kept and an escape on it is counted as "not simulated" (an upper bound).
  * It injects faults into the value only. Lost columns, merged cells and wrong row mapping are different failure modes
    (AGENTS.md section 7), caught by flags and the label dictionary, and are not simulated here.
  * It does not measure the error rate of the portal. Only the gold set does that. It measures what the checks can see.

    python scripts/fault_injection.py [releases/v0.0.1-prototype] [--out docs/reports/fault_injection.md]
"""
from __future__ import annotations

import sys
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path

from datalab import config
from datalab.checks import classify_sum, sum_allowance  # noqa: F401  (sum_allowance documents the P10 floor used below)
from datalab.normalise import decimal_to_str, last_digit_unit
from datalab.release import EQUAL_TYPES, SUM_TYPES
from datalab.schema import AGREEMENT_CHECKS, ARITHMETIC_CHECKS, PASSING, Cell, Check, Observation, Series
from datalab.status import decide_tier

import re

_ABS_TOL = re.compile(r"^Absolute tolerance (\d+(?:\.\d+)?)\.$")


# ---------------------------------------------------------------- the faults

def _digits(v: Decimal) -> str:
    return decimal_to_str(abs(v))


def _rebuild(v: Decimal, text: str) -> Decimal | None:
    try:
        out = Decimal(text)
    except Exception:
        return None
    return -out if v < 0 else out


def f_times10(v: Decimal) -> Decimal | None:
    return v * 10 if v != 0 else None


def f_div10(v: Decimal) -> Decimal | None:
    return v / 10 if v != 0 else None


def f_sign(v: Decimal) -> Decimal | None:
    return -v if v != 0 else None


def f_last_digit(v: Decimal) -> Decimal | None:
    return v + last_digit_unit(decimal_to_str(v))


def f_first_digit(v: Decimal) -> Decimal | None:
    s = _digits(v)
    for i, ch in enumerate(s):
        if ch.isdigit() and ch != "0":
            d = int(ch)
            return _rebuild(v, s[:i] + str(d + 1 if d < 9 else d - 1) + s[i + 1:])
    return None


def f_transpose(v: Decimal) -> Decimal | None:
    s = list(_digits(v))
    idx = [i for i, ch in enumerate(s) if ch.isdigit()]
    for a, b in zip(idx, idx[1:]):
        if b == a + 1 and s[a] != s[b]:
            s[a], s[b] = s[b], s[a]
            return _rebuild(v, "".join(s))
    return None


def f_drop_leading(v: Decimal) -> Decimal | None:
    s = _digits(v)
    digits = [i for i, ch in enumerate(s) if ch.isdigit()]
    if len(digits) < 2:
        return None
    first = digits[0]
    rest = (s[:first] + s[first + 1:]).lstrip("0") or "0"
    if rest.startswith("."):
        rest = "0" + rest
    return _rebuild(v, rest)


FAULTS = {
    "times 10 (decimal point shifted right)": f_times10,
    "divided by 10 (decimal point shifted left)": f_div10,
    "sign flipped": f_sign,
    "last digit up by one unit": f_last_digit,
    "leading digit changed by one": f_first_digit,
    "two adjacent digits swapped": f_transpose,
    "leading digit dropped": f_drop_leading,
}


# ---------------------------------------------------------------- re-running the checks on a changed cell

def _ratio_candidates(a: Decimal, b: Decimal) -> list[Decimal]:
    out: list[Decimal] = []
    if b != 0:
        out += [(a / b - 1) * 100, a / b * 100]
    if a != 0:
        out += [(b / a - 1) * 100, b / a * 100]
    return out


def _bound(chk: Check) -> Decimal | None:
    m = re.match(r"^Recomputed value must be within (\d+(?:\.\d+)?) of the printed value\.$", chk.tolerance_rule)
    return Decimal(m.group(1)) if m else None


def _grade(residual: Decimal, bound: Decimal) -> str:
    return "pass" if residual == 0 else ("pass_within_rounding" if abs(residual) <= bound else "fail")


def _formula(chk: Check, original: dict[str, Cell]):
    """A function from the (changed) cells to the recomputed value, found by reproducing the stored one on the original
    cells. None when no known formula reproduces it."""
    stored = Decimal(chk.observed)
    tol = Decimal("0.00001") * max(Decimal(1), abs(stored))
    if chk.check_type == "recompute" and len(chk.member_cell_ids) == 2:
        ids = chk.member_cell_ids
        def candidates(cells):
            a, b = (Decimal(cells[i].value_parsed) for i in ids)
            return _ratio_candidates(a, b)
        for k, cand in enumerate(candidates(original)):
            if abs(cand - stored) <= tol:
                return lambda cells, k=k: (candidates(cells) or [None] * 4)[k] if len(candidates(cells)) > k else None
        return None
    if chk.check_type == "index_aggregation":
        idx = {c.series_id.split("cpi.group.", 1)[1]: c.cell_id for c in (original[i] for i in chk.member_cell_ids)
               if c.series_id and c.series_id.startswith("cpi.group.")}
        wts = {c.series_id.split("cpi.weight.", 1)[1]: c.cell_id for c in (original[i] for i in chk.member_cell_ids)
               if c.series_id and c.series_id.startswith("cpi.weight.")}
        if not idx or set(idx) != set(wts):
            return None
        def mean(cells, normalise):
            tot = sum(Decimal(cells[wts[k]].value_parsed) * Decimal(cells[idx[k]].value_parsed) for k in idx)
            den = sum(Decimal(cells[wts[k]].value_parsed) for k in idx) if normalise else Decimal(100)
            return tot / den if den else None
        for normalise in (True, False):
            if (v := mean(original, normalise)) is not None and abs(v - stored) <= tol:
                return lambda cells, n=normalise: mean(cells, n)
    return None


def recompute(chk: Check, original: dict[str, Cell], cells: dict[str, Cell], changed_id: str) -> tuple[str, bool]:
    """(result, simulated). A check this script cannot redo keeps its stored result and says simulated=False."""
    if chk.result == "not_evaluable":
        return chk.result, True
    try:
        target = cells.get(chk.target_cell_id or "")
        if chk.check_type in SUM_TYPES or chk.check_type == "weights_sum":
            members = [cells[i] for i in chk.member_cell_ids]
            signs = chk.member_signs or [1] * len(members)
            observed = sum((Decimal(m.value_parsed) * s for m, s in zip(members, signs, strict=True)), Decimal(0))
            expected = Decimal(target.value_parsed) if target is not None else Decimal(chk.expected)
            unit = max(last_digit_unit(c.value_parsed) for c in ([*members, target] if target is not None else members))
            m = _ABS_TOL.match(chk.tolerance_rule)
            return classify_sum(observed - expected, len(members), unit, Decimal(m.group(1)) if m else None), True
        if chk.check_type in EQUAL_TYPES:
            a = Decimal(cells[chk.target_cell_id].value_parsed)
            b = Decimal(cells[chk.member_cell_ids[0]].value_parsed)
            unit = max(last_digit_unit(cells[chk.target_cell_id].value_parsed),
                       last_digit_unit(cells[chk.member_cell_ids[0]].value_parsed))
            return ("pass" if a == b else ("pass_within_rounding" if abs(a - b) <= unit else "fail")), True
        if chk.check_type == "reference_value" and target is not None and chk.target_value is not None:
            return ("pass" if Decimal(target.value_parsed) == Decimal(chk.target_value) else "fail"), True
        if chk.check_type == "cross_source" and target is not None and chk.target_value is not None:
            bound = Decimal("0.5") * (last_digit_unit(target.value_parsed) + last_digit_unit(chk.target_value))
            return _grade(Decimal(target.value_parsed) - Decimal(chk.target_value), bound), True
        bound = _bound(chk)
        if chk.check_type in ("recompute", "index_aggregation") and bound is not None and chk.observed is not None and target is not None:
            if chk.target_cell_id == changed_id:
                return _grade(Decimal(chk.observed) - Decimal(target.value_parsed), bound), True
            formula = _formula(chk, original)
            if formula is not None and (v := formula(cells)) is not None:
                return _grade(v - Decimal(target.value_parsed), bound), True
    except Exception:
        pass
    return chk.result, False


def evidence_class(primary: Cell, supporting: list[Cell], by_cell: dict[str, list[Check]]) -> str:
    own = [c for c in by_cell.get(primary.cell_id, []) if c.official and c.result in PASSING]
    arithmetic = [c for c in own if c.check_type in ARITHMETIC_CHECKS]
    agreement = [c for c in own if c.check_type in AGREEMENT_CHECKS]
    if not arithmetic:
        for s in supporting:
            arithmetic += [c for c in by_cell.get(s.cell_id, []) if c.official and c.result in PASSING
                           and c.check_type in ARITHMETIC_CHECKS]
    if arithmetic and agreement:
        return "arithmetic and agreement"
    if len(arithmetic) >= 2:
        return "two or more sums"
    if arithmetic:
        return "one sum only"
    return "agreement only"


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    out_path = Path(argv[argv.index("--out") + 1]) if "--out" in argv else None
    if out_path is not None:
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

    injected: Counter = Counter()
    escaped: Counter = Counter()
    uncertain: Counter = Counter()
    by_fault: dict[str, Counter] = defaultdict(Counter)
    by_class: dict[str, Counter] = defaultdict(Counter)
    by_dataset: dict[str, Counter] = defaultdict(Counter)
    samples: dict[str, list[str]] = defaultdict(list)

    for o in observations:
        s = series.get(o.series_id)
        if s is None or s.derived or not o.published or o.primary_cell_id not in cells:
            continue
        primary = cells[o.primary_cell_id]
        if primary.is_missing or primary.value_parsed is None:
            continue
        supporting = [cells[c] for c in o.supporting_cell_ids if c in cells]
        klass = evidence_class(primary, supporting, by_cell)
        v = Decimal(primary.value_parsed)
        for name, fn in FAULTS.items():
            wrong = fn(v)
            if wrong is None or wrong == v:
                continue
            wrong_cell = primary.model_copy(update={"value_parsed": decimal_to_str(wrong)})
            changed = {**cells, primary.cell_id: wrong_cell}
            # only the primary is wrong; every check that names it is redone from the changed value
            new_by_cell: dict[str, list[Check]] = dict(by_cell)
            unsimulated = False
            for chk in by_cell.get(primary.cell_id, []):
                result, simulated = recompute(chk, cells, changed, primary.cell_id)
                unsimulated = unsimulated or (not simulated and chk.result in PASSING)
                new = chk.model_copy(update={"result": result})
                for cid in {chk.target_cell_id, *chk.member_cell_ids} - {None}:
                    new_by_cell[cid] = [new if c.check_id == chk.check_id else c for c in new_by_cell.get(cid, [])]
            tier, _ = decide_tier(wrong_cell, supporting, new_by_cell, changed)
            published = tier in ("A", "B")
            injected[name] += 1
            by_fault[s.dataset][name, "n"] += 1
            by_class[klass][name, "n"] += 1
            by_dataset[s.dataset]["n"] += 1
            by_class[klass]["n"] += 1
            if published:
                if unsimulated:
                    uncertain[name] += 1
                escaped[name] += 1
                by_fault[s.dataset][name, "escaped"] += 1
                by_class[klass][name, "escaped"] += 1
                by_dataset[s.dataset]["escaped"] += 1
                by_class[klass]["escaped"] += 1
                if len(samples[name]) < 3:
                    samples[name].append(f"{o.obs_id}: {decimal_to_str(v)} -> {decimal_to_str(wrong)} ({klass})")

    def pct(a: int, b: int) -> str:
        return f"{100 * a / b:.1f}%" if b else "n/a"

    lines = ["# Fault injection on the published values", "",
             f"Release: `releases/{path.name}`. Generated by `pipeline/scripts/fault_injection.py`; the release is not changed.", "",
             "For each published value, one wrong copy per fault is made, the sums and equalities it belongs to are recomputed, "
             "and the status rule is applied. An *escape* is a wrong value that would still be published as checked. "
             "This measures what the checks can see; it is not the portal's error rate (that needs the gold set). "
             "Sums, equalities, reference weights, cross-source checks, recomputed rates and index aggregations are redone from the "
             "changed value; where a recompute formula could not be reproduced the stored result is kept and the escape is counted as not simulated. Only value faults are injected: lost columns, merged cells and "
             "wrong row mapping are other failure modes.", "",
             "## Escape rate by fault", "", "| Fault | Injected | Escaped | Escape rate | Of which a check on it was not simulated |", "|---|---|---|---|---|"]
    for name in FAULTS:
        lines.append(f"| {name} | {injected[name]} | {escaped[name]} | {pct(escaped[name], injected[name])} | {uncertain[name]} |")
    lines += ["", "## Escape rate by evidence class (of the unchanged value)", "",
              "| Evidence class | Injected | Escaped | Escape rate |", "|---|---|---|---|"]
    for klass in ("arithmetic and agreement", "two or more sums", "one sum only", "agreement only"):
        c = by_class[klass]
        lines.append(f"| {klass} | {c['n']} | {c['escaped']} | {pct(c['escaped'], c['n'])} |")
    lines += ["", "## Escape rate by data type", "", "| Data type | Injected | Escaped | Escape rate |", "|---|---|---|---|"]
    for ds in sorted(by_dataset):
        c = by_dataset[ds]
        lines.append(f"| {ds.upper()} | {c['n']} | {c['escaped']} | {pct(c['escaped'], c['n'])} |")
    lines += ["", "## Escape rate by fault and evidence class", "",
              "| Evidence class | " + " | ".join(FAULTS) + " |", "|---|" + "---|" * len(FAULTS)]
    for klass in ("arithmetic and agreement", "two or more sums", "one sum only", "agreement only"):
        c = by_class[klass]
        lines.append(f"| {klass} | " + " | ".join(pct(c[name, "escaped"], c[name, "n"]) for name in FAULTS) + " |")
    lines += ["", "## Examples of escapes", ""]
    for name, rows in samples.items():
        lines.append(f"- **{name}**")
        lines += [f"  - `{r}`" for r in rows]
    text = "\n".join(lines) + "\n"
    if out_path is not None:
        out_path.write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
