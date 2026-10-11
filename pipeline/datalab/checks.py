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
from .schema import BLOCKING_CELL_FLAGS, DISPUTE_ARITHMETIC, PASSING, TARGET_ONLY_CHECKS, Cell, Check, check_id_for

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
        member_signs=[sign for _, sign in members] if any(sign != 1 for _, sign in members) else [],
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
                   where_first: str, where_second: str, units: int = 1, official: bool = True,
                   blocked_reason: str | None = None) -> Check:
    """The same figure printed in two places must agree."""
    cid = check_id_for(check_type, rule_id, *sorted([first.cell_id, second.cell_id]))
    base: dict[str, Any] = dict(
        check_id=cid, check_type=check_type, dataset=dataset, rule_id=rule_id,
        source_ids=sorted({first.source_id, second.source_id}), member_cell_ids=[second.cell_id],
        target_cell_id=first.cell_id, tolerance_rule=EQUAL_RULE_TEXT, official=official,
    )
    if blocked_reason or first.value_parsed is None or second.value_parsed is None:
        reason = blocked_reason or "one of the two figures could not be parsed"
        return Check(**base, result="not_evaluable", not_evaluable_reason=reason,
                     description=f"Could not compare {what} between {where_first} and {where_second}: {reason}.")
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
                blocked_reason: str | None = None, credits_members: bool = True) -> Check:
    """A printed figure must equal a value recomputed from other printed figures (rates, index aggregation).

    `credits_members=False`: a pass is evidence for the target only, not for the figures it was computed from.
    """
    cid = check_id_for(check_type, rule_id, target.cell_id, *sorted(c.cell_id for c in members))
    base: dict[str, Any] = dict(
        check_id=cid, check_type=check_type, dataset=dataset, rule_id=rule_id,
        source_ids=sorted({target.source_id, *(c.source_id for c in members)}),
        member_cell_ids=[c.cell_id for c in members], target_cell_id=target.cell_id,
        tolerance_rule=f"Recomputed value must be within {tolerance} of the printed value.",
        credits_members=credits_members,
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


def dispute_test(chk: Check, cells_by_id: dict[str, Cell], checks_by_cell: dict[str, list[Check]]) -> str | None:
    """Why a differing cross-edition pair is NOT a dispute, or None when every D25 condition holds.

    (a) each reading is part of a passed arithmetic check inside its own document, and of no failed one;
    (b) neither table (nor cell) carries an extraction flag; (c) both readings are of the same observation.
    """
    first = cells_by_id.get(chk.target_cell_id or "")
    second = cells_by_id.get(chk.member_cell_ids[0]) if len(chk.member_cell_ids) == 1 else None
    if first is None or second is None:
        return "a reading is not in the record"
    key = (first.series_id, first.period, first.vintage)
    if not all(key) or key != (second.series_id, second.period, second.vintage):
        return "the two readings are not of the same observation"
    if first.source_id == second.source_id:
        return "both readings are in the same document"
    if first.value_parsed is None or second.value_parsed is None:
        return "a reading could not be parsed"
    if first.structural_flags or second.structural_flags:
        return "a table or row carries a structural flag"
    if (set(first.normalization_flags) | set(second.normalization_flags)) & BLOCKING_CELL_FLAGS:
        return "a table or cell carries an extraction flag"
    for cell in (first, second):
        own = [c for c in checks_by_cell.get(cell.cell_id, [])
               if c.official and c.check_type in DISPUTE_ARITHMETIC and c.source_ids == [cell.source_id]]
        if any(c.result == "fail" for c in own):
            return "an arithmetic check on one reading failed"
        if not any(c.result in PASSING and ((c.check_type not in TARGET_ONLY_CHECKS and c.credits_members)
                                            or c.target_cell_id == cell.cell_id) for c in own):
            return "a reading has no passed arithmetic check in its own table"
    return None


def classify_disputes(checks: list[Check], cells: Iterable[Cell]) -> list[Check]:
    """Turn a differing cross-edition pair into `disputed` when every D25 condition holds. Pure function.

    A pair that stays `fail` records which condition turned it away.
    """
    cells_by_id = {c.cell_id: c for c in cells}
    checks_by_cell: dict[str, list[Check]] = defaultdict(list)
    for chk in checks:
        for cid in {chk.target_cell_id, *chk.member_cell_ids} - {None}:
            checks_by_cell[cid].append(chk)
    out: list[Check] = []
    for chk in checks:
        if chk.check_type == "cross_edition" and chk.official and chk.result in ("fail", "disputed"):
            why_not = dispute_test(chk, cells_by_id, checks_by_cell)
            chk = chk.model_copy(update={"result": "fail" if why_not else "disputed", "dispute_rejected": why_not})
        out.append(chk)
    return out


def dispute_summary(checks: Iterable[Check]) -> dict[str, Any]:
    """Cross-edition pairs that differ: how many are disputes, and what turned the others away."""
    differing = [c for c in checks if c.check_type == "cross_edition" and c.official and c.result in ("fail", "disputed")]
    turned_away: dict[str, int] = defaultdict(int)
    for c in differing:
        if c.result == "fail":
            turned_away[c.dispute_rejected or "not tested"] += 1
    return {"differing_pairs": len(differing), "disputed": sum(1 for c in differing if c.result == "disputed"),
            "kept_as_fail": dict(sorted(turned_away.items()))}


def pass_rate(checks: Iterable[Check], kinds: Iterable[str] | None = None, official_only: bool = True,
              disputed_as_failed: bool = False) -> dict[str, Any]:
    """Share of evaluable checks that passed. Not-evaluable checks are counted separately.

    Disputed pairs (two official printings that each add up but differ, D25) are counted on their
    own. For cross-edition agreement they are left out of the ratio (D26: agree / (agree + fail));
    for the overall rate pass `disputed_as_failed=True` so that a dispute never counts as a pass.
    """
    kinds_set = set(kinds) if kinds else None
    counts = {"pass": 0, "pass_within_rounding": 0, "fail": 0, "not_evaluable": 0, "disputed": 0}
    for c in checks:
        if official_only and not c.official:
            continue
        if kinds_set and c.check_type not in kinds_set:
            continue
        counts[c.result] += 1
    evaluable = counts["pass"] + counts["pass_within_rounding"] + counts["fail"]
    if disputed_as_failed:
        evaluable += counts["disputed"]
    rate = round((counts["pass"] + counts["pass_within_rounding"]) / evaluable, 4) if evaluable else None
    return {**counts, "evaluable": evaluable, "pass_rate": rate}
