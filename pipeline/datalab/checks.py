"""Deterministic checks (plan 6.7). Every function here is pure arithmetic on parsed cells.

Tolerances follow decision D9:
- sums: residual 0 -> pass; 0 < |residual| <= 0.5 x members x (one unit of the last
  printed digit) -> pass_within_rounding; otherwise fail.
- the same figure printed twice: equal within 1 unit of the last printed digit -> pass.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any, Iterable, Sequence

from .normalise import decimal_to_str, last_digit_unit
from .schema import Cell, Check, check_id_for

SUM_RULE_TEXT = ("Exact match passes. A difference of at most half a unit of the last printed digit per "
                 "item added passes as 'within rounding'. Anything larger fails.")
EQUAL_RULE_TEXT = "The two printed figures must be equal within 1 unit of the last printed digit."


def fmt(value: Decimal | str | None) -> str:
    """Thousands separators for sentences on receipts; no change to the digits."""
    if value is None:
        return "n/a"
    d = Decimal(value)
    text = decimal_to_str(d)
    sign = "-" if text.startswith("-") else ""
    text = text.lstrip("-")
    whole, _, frac = text.partition(".")
    whole = f"{int(whole):,}"
    return f"{sign}{whole}" + (f".{frac}" if frac else "")


def classify_sum(residual: Decimal, members: int, unit: Decimal, abs_tolerance: Decimal | None = None) -> str:
    if residual == 0:
        return "pass"
    limit = abs_tolerance if abs_tolerance is not None else Decimal("0.5") * members * unit
    return "pass_within_rounding" if abs(residual) <= limit else "fail"


def _unit(cells: Iterable[Cell]) -> Decimal:
    units = [last_digit_unit(c.value_parsed) for c in cells if c.value_parsed is not None]
    return max(units) if units else Decimal(1)


def sum_check(*, check_type: str, dataset: str, rule_id: str, target: Cell, members: Sequence[tuple[Cell, int]],
              what_members: str, what_target: str, column_label: str, blocked_reason: str | None = None,
              abs_tolerance: Decimal | None = None) -> Check:
    """Target cell must equal the signed sum of the member cells."""
    member_cells = [c for c, _ in members]
    cid = check_id_for(check_type, rule_id, target.cell_id, *sorted(c.cell_id for c in member_cells))
    base: dict[str, Any] = dict(
        check_id=cid, check_type=check_type, dataset=dataset, rule_id=rule_id,
        source_ids=sorted({target.source_id, *(c.source_id for c in member_cells)}),
        member_cell_ids=[c.cell_id for c in member_cells], target_cell_id=target.cell_id,
        tolerance_rule=SUM_RULE_TEXT if abs_tolerance is None else f"Absolute tolerance {abs_tolerance}.",
    )
    unparsed = [c for c in [target, *member_cells] if c.value_parsed is None]
    if blocked_reason or unparsed:
        reason = blocked_reason or "a member or the total could not be parsed as one number"
        return Check(**base, result="not_evaluable", not_evaluable_reason=reason,
                     description=f"Could not test whether {what_members} add to {what_target} in {column_label}: {reason}.")
    observed = sum((Decimal(c.value_parsed) * sign for c, sign in members), Decimal(0))
    expected = Decimal(target.value_parsed)
    residual = observed - expected
    result = classify_sum(residual, len(member_cells), _unit([target, *member_cells]), abs_tolerance)
    n = len(member_cells)
    if result == "pass":
        verdict = "They add exactly."
    elif result == "pass_within_rounding":
        verdict = f"They differ by {fmt(abs(residual))}, which is within rounding for {n} printed amounts."
    else:
        verdict = f"They differ by {fmt(abs(residual))}, more than rounding allows, so this check fails."
    description = (f"In {column_label}, {what_members} ({n} amounts) add to {fmt(observed)}; "
                   f"the printed {what_target} is {fmt(expected)}. {verdict}")
    return Check(**base, expected=decimal_to_str(expected), observed=decimal_to_str(observed),
                 residual=decimal_to_str(residual), result=result, description=description)


def equality_check(*, check_type: str, dataset: str, rule_id: str, first: Cell, second: Cell, what: str,
                   where_first: str, where_second: str, units: int = 1, official: bool = True) -> Check:
    """The same figure printed in two places must agree."""
    cid = check_id_for(check_type, rule_id, *sorted([first.cell_id, second.cell_id]))
    base: dict[str, Any] = dict(
        check_id=cid, check_type=check_type, dataset=dataset, rule_id=rule_id,
        source_ids=sorted({first.source_id, second.source_id}), member_cell_ids=[second.cell_id],
        target_cell_id=first.cell_id, tolerance_rule=EQUAL_RULE_TEXT, official=official,
    )
    if first.value_parsed is None or second.value_parsed is None:
        return Check(**base, result="not_evaluable", not_evaluable_reason="one of the two figures could not be parsed",
                     description=f"Could not compare {what} between {where_first} and {where_second}.")
    a, b = Decimal(first.value_parsed), Decimal(second.value_parsed)
    residual = b - a
    unit = _unit([first, second])
    if residual == 0:
        result, verdict = "pass", "They are equal."
    elif abs(residual) <= units * unit:
        result, verdict = "pass_within_rounding", f"They differ by {fmt(abs(residual))}, within rounding."
    else:
        result, verdict = "fail", f"They differ by {fmt(abs(residual))}, so the two printings disagree."
    description = f"{what}: {where_first} prints {fmt(a)}; {where_second} prints {fmt(b)}. {verdict}"
    return Check(**base, expected=decimal_to_str(a), observed=decimal_to_str(b), residual=decimal_to_str(residual),
                 result=result, description=description)


def value_check(*, check_type: str, dataset: str, rule_id: str, target: Cell, members: Sequence[Cell],
                computed: Decimal | None, tolerance: Decimal, description_ok: str, what: str,
                blocked_reason: str | None = None) -> Check:
    """A printed figure must equal a value recomputed from other printed figures (rates, index aggregation)."""
    cid = check_id_for(check_type, rule_id, target.cell_id, *sorted(c.cell_id for c in members))
    base: dict[str, Any] = dict(
        check_id=cid, check_type=check_type, dataset=dataset, rule_id=rule_id,
        source_ids=sorted({target.source_id, *(c.source_id for c in members)}),
        member_cell_ids=[c.cell_id for c in members], target_cell_id=target.cell_id,
        tolerance_rule=f"Recomputed value must be within {tolerance} of the printed value.",
    )
    if blocked_reason or computed is None or target.value_parsed is None:
        reason = blocked_reason or "an input could not be parsed"
        return Check(**base, result="not_evaluable", not_evaluable_reason=reason,
                     description=f"Could not recompute {what}: {reason}.")
    expected = Decimal(target.value_parsed)
    residual = computed - expected
    if residual == 0:
        result, verdict = "pass", "They match exactly."
    elif abs(residual) <= tolerance:
        result, verdict = "pass_within_rounding", f"They differ by {fmt(abs(residual))}, within rounding."
    else:
        result, verdict = "fail", f"They differ by {fmt(abs(residual))}, more than rounding allows, so this check fails."
    return Check(**base, expected=decimal_to_str(expected), observed=decimal_to_str(computed),
                 residual=decimal_to_str(residual), result=result,
                 description=f"{description_ok} Recomputed: {fmt(computed)}; printed: {fmt(expected)}. {verdict}")


def evaluate_sum_rules(cells: list[Cell], rules: list[dict[str, Any]], dataset: str,
                       parents: dict[str, str | None], blocked_tables: dict[tuple[str, int, int], str],
                       column_label_for) -> list[Check]:
    """Apply spec-defined sum rules to every (source, period, vintage) column.

    A rule is {id, type, target, members[], optional[], children_of_target, what_members, what_target}.
    `optional` members are added when the edition prints them. A rule whose
    target is not printed in a column is skipped for that column; a rule whose
    required members are missing is recorded as not_evaluable.
    """
    columns: dict[tuple[str, str, str], dict[str, Cell]] = defaultdict(dict)
    for c in cells:
        if c.series_id and c.period and c.vintage:
            columns[(c.source_id, c.period, c.vintage)].setdefault(c.series_id, c)
    out: list[Check] = []
    for key in sorted(columns):
        by_series = columns[key]
        for rule in rules:
            target = by_series.get(rule["target"])
            if target is None:
                continue
            # Some identities exist in two printed forms; a rule can be tied to the form the edition prints.
            if rule.get("if_present") and rule["if_present"] not in by_series:
                continue
            if rule.get("unless_present") and rule["unless_present"] in by_series:
                continue
            members: list[tuple[Cell, int]] = []
            missing: list[str] = []
            if rule.get("children_of_target"):
                kids = [c for sid, c in by_series.items() if parents.get(sid) == rule["target"]
                        and sid not in set(rule.get("exclude", []))]
                if not kids:
                    continue
                members = [(c, 1) for c in sorted(kids, key=lambda c: c.row_index)]
            else:
                for m in rule.get("members", []):
                    sid, sign = (m, 1) if isinstance(m, str) else (m["series"], int(m.get("sign", 1)))
                    if sid in by_series:
                        members.append((by_series[sid], sign))
                    else:
                        missing.append(sid)
                for m in rule.get("optional", []):
                    sid, sign = (m, 1) if isinstance(m, str) else (m["series"], int(m.get("sign", 1)))
                    if sid in by_series:
                        members.append((by_series[sid], sign))
            if target.is_missing:
                continue  # the document prints no figure for the total; there is nothing to test
            # An item printed as "-" or "nil" adds nothing to a sum. It is left out of the members,
            # so it is never credited as checked; the sum only passes if the rest really add up.
            members = [(c, sign) for c, sign in members if not c.is_missing]
            involved = [target, *(c for c, _ in members)]
            blocked = next((blocked_tables[(c.source_id, c.page, c.table_index)] for c in involved
                            if (c.source_id, c.page, c.table_index) in blocked_tables), None)
            if missing:
                blocked = f"the table does not carry a mapped row for: {', '.join(missing)}"
            if not members:
                continue
            out.append(sum_check(
                check_type=rule["type"], dataset=dataset, rule_id=rule["id"], target=target, members=members,
                what_members=rule.get("what_members", "the listed items"),
                what_target=rule.get("what_target", target.row_label_raw), column_label=column_label_for(target),
                blocked_reason=blocked,
            ))
    return out


def pass_rate(checks: Iterable[Check], kinds: Iterable[str] | None = None, official_only: bool = True) -> dict[str, Any]:
    """Share of evaluable checks that passed. Not-evaluable checks are counted separately."""
    kinds_set = set(kinds) if kinds else None
    counts = {"pass": 0, "pass_within_rounding": 0, "fail": 0, "not_evaluable": 0}
    for c in checks:
        if official_only and not c.official:
            continue
        if kinds_set and c.check_type not in kinds_set:
            continue
        counts[c.result] += 1
    evaluable = counts["pass"] + counts["pass_within_rounding"] + counts["fail"]
    rate = round((counts["pass"] + counts["pass_within_rounding"]) / evaluable, 4) if evaluable else None
    return {**counts, "evaluable": evaluable, "pass_rate": rate}
