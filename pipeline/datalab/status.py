"""Status is a pure function of stored evidence (plan 6.8, decision D8).

Nothing here looks at a page, a model or a human opinion: only at cells,
their flags and the recorded check results.

Tiers
  D quarantined  the primary cell is flagged (merged cell, title text, blocked table) with no
                 agreeing second printing, or a check it belongs to failed and no other check passed.
  A verified     at least one arithmetic check passed AND at least one agreement with another
                 official printing (cross-edition or cross-source).
  B corroborated exactly one of those two kinds of evidence.
  C single       no check covers it and nothing is flagged.

Public: A, B -> checked, published. C -> unchecked, withheld (gap: not yet verified).
D -> withheld (gap: failed checks).

Disputed (decision D25): two official documents print different figures for the same observation
and each printing adds up in its own table. `checks.classify_disputes` decides that; here the
observation then gets status `disputed`, no value and no tier, and lists every printing.
A cross-edition pair that differs without meeting those conditions stays `fail`, and the
observation is withheld (tier D) whatever else passed.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Iterable

from .checks import fmt
from .normalise import last_digit_unit
from .schema import (AGREEMENT_CHECKS, ARITHMETIC_CHECKS, BLOCKING_CELL_FLAGS, PASSING, TARGET_ONLY_CHECKS, Cell, Check,
                     DisputedReading, Observation, Series, obs_id_for)

BLOCKING_STRUCT_FLAGS = frozenset({"dropped_column", "merged_rows", "possible_dropped_column", "low_coverage", "column_unmapped"})


def _agree(a: Cell, b: Cell) -> bool:
    if a.value_parsed is None or b.value_parsed is None:
        return False
    unit = max(last_digit_unit(a.value_parsed), last_digit_unit(b.value_parsed))
    return abs(Decimal(a.value_parsed) - Decimal(b.value_parsed)) <= unit


def credits(chk: Check, cell_id: str) -> bool:
    """Does a passed check count as evidence for this cell? Target-only checks credit their target alone."""
    return chk.check_type not in TARGET_ONLY_CHECKS or chk.target_cell_id == cell_id


def decide_tier(primary: Cell, supporting: list[Cell], checks_by_cell: dict[str, list[Check]]) -> tuple[str, list[str]]:
    """Return (tier, reasons). Pure function of the cells and their checks."""
    reasons: list[str] = []
    agreeing = [s for s in supporting if _agree(primary, s)]
    flagged = sorted((set(primary.normalization_flags) & BLOCKING_CELL_FLAGS)
                     | (set(primary.structural_flags) & BLOCKING_STRUCT_FLAGS))
    if primary.value_parsed is None:
        return "D", ["the printed text could not be parsed as one number"]
    if flagged and not agreeing:
        return "D", [f"extraction flags on the cell or its table: {', '.join(flagged)}"]

    own = [c for c in checks_by_cell.get(primary.cell_id, []) if c.official]
    failed = [c for c in own if c.result == "fail"]
    passed = [c for c in own if c.result in PASSING and credits(c, primary.cell_id)]
    arithmetic = [c for c in passed if c.check_type in ARITHMETIC_CHECKS]
    agreement = [c for c in passed if c.check_type in AGREEMENT_CHECKS]
    # Arithmetic evidence on a second printing counts only if that printing shows the same figure.
    if not arithmetic:
        for s in agreeing:
            arithmetic += [c for c in checks_by_cell.get(s.cell_id, []) if c.official and c.result in PASSING
                           and c.check_type in ARITHMETIC_CHECKS and credits(c, s.cell_id)]
    if any(c.check_type == "cross_edition" for c in failed):
        # Another official document prints a different figure and the difference is not established
        # as a restatement (the D25 conditions do not all hold): withheld, never shown as checked.
        return "D", ["another official document prints a different figure and the difference is not explained"]
    if failed:
        # A failed check is never outvoted. Another sum can pass around a wrong member (review finding
        # CPI-1), and a figure reprinted unchanged in the next edition can still be part of a block that
        # does not add up because of a line we do not model (ABS detail tables). Rule 10: hold back the set.
        kinds = ", ".join(sorted({c.check_type.replace("_", " ") for c in failed}))
        return "D", [f"{len(failed)} check(s) on this figure failed ({kinds})"]
    if arithmetic and agreement:
        return "A", reasons
    if arithmetic or agreement:
        return "B", reasons
    return "C", reasons


_ROUTING_WORDS = {"merged_rows": "merged rows", "dropped_column": "lost a column"}


def second_reader_sentence(cell: Cell) -> str:
    """Say plainly that a figure was read by the second tool and why. Built from stored fields only."""
    link = cell.second_reader_of
    if link is None:
        return ""
    why = [_ROUTING_WORDS[f] for f in link.routed_by if f in _ROUTING_WORDS]
    because = f" because the first tool ({link.first_reader}) {' and '.join(why)} in this table" if why else ""
    return (f"Read by a second tool ({cell.extractor_name}){because}; the second reading is used only because "
            "the table's own arithmetic checks pass on it.")


def evidence_sentence(primary: Cell, tier: str, checks_by_cell: dict[str, list[Check]], cells_by_id: dict[str, Cell],
                      source_titles: dict[str, str]) -> str:
    """One plain-language sentence per piece of evidence, generated from the check records."""
    parts: list[str] = []
    for chk in checks_by_cell.get(primary.cell_id, []):
        if not chk.official:
            continue
        how = {"pass": "exactly", "pass_within_rounding": "within rounding"}.get(chk.result)
        if chk.check_type in ("recompute", "index_aggregation") and chk.expected is not None:
            # Not a plain sum: a figure recomputed from other printed figures (CPI, LFS).
            target = cells_by_id.get(chk.target_cell_id or "")
            n = len(chk.member_cell_ids)
            kind = ("weighted average of the group indices" if chk.check_type == "index_aggregation"
                    else "recomputation from the printed figures it is derived from")
            if chk.target_cell_id == primary.cell_id:
                if how:
                    parts.append(f"Matches the {kind} ({n} printed figures; {how}).")
                elif chk.result == "fail":
                    parts.append(f"Does NOT match the {kind} (difference {fmt(chk.residual)}).")
            else:
                label = (target.row_label_raw if target else "").strip()
                col = (target.col_label_raw if target else "").strip()
                what = f"the printed '{label}' figure {fmt(chk.expected)}" + (f" in column '{col}'" if col else "")
                if how:
                    parts.append(f"One of {n} printed figures from which {what} recomputes ({how}).")
                elif chk.result == "fail":
                    parts.append(f"One of {n} printed figures from which {what} should recompute but does not "
                                 f"(difference {fmt(chk.residual)}).")
        elif chk.check_type in ARITHMETIC_CHECKS and chk.check_type != "cross_table" and chk.expected is not None:
            target = cells_by_id.get(chk.target_cell_id or "")
            target_label = (target.row_label_raw if target else "the printed total").strip()
            n = len(chk.member_cell_ids)
            if chk.target_cell_id == primary.cell_id:
                if how:
                    parts.append(f"Equals the sum of {n} printed amounts ({how}).")
                elif chk.result == "fail":
                    parts.append(f"Does NOT equal the sum of {n} printed amounts (difference {fmt(chk.residual)}).")
            else:
                if how:
                    parts.append(f"One of {n} amounts that add to the printed '{target_label}' "
                                 f"{fmt(chk.expected)} ({how}).")
                elif chk.result == "fail":
                    parts.append(f"One of {n} amounts that should add to the printed '{target_label}' "
                                 f"{fmt(chk.expected)} but do not (difference {fmt(chk.residual)}).")
        elif chk.check_type in ("cross_edition", "cross_table", "cross_source"):
            if chk.target_cell_id == primary.cell_id:
                # A cross-source check against a non-PDF source has no member cell, only `target_source`.
                other_id = chk.member_cell_ids[0] if chk.member_cell_ids else None
            else:
                other_id = chk.target_cell_id
            other = cells_by_id.get(other_id or "")
            where = source_titles.get(other.source_id, other.source_id) if other else (chk.target_source or "another printing")
            same_doc = other is not None and other.source_id == primary.source_id
            place = "a second place in the same document" if same_doc else f"the {where}"
            if how:
                parts.append(f"Equal to the figure printed in {place} ({how}).")
            elif chk.result == "fail" and other is not None:
                parts.append(f"Differs from the figure printed in {place} ({fmt(other.value_parsed)}).")
            elif chk.result == "fail" and chk.target_value is not None:
                parts.append(f"Differs from the figure given by {place} ({fmt(chk.target_value)}).")
        elif chk.result == "not_evaluable":
            parts.append(f"A {chk.check_type.replace('_', ' ')} check could not be run: {chk.not_evaluable_reason}.")
    if not parts:
        parts.append("No check covers this figure yet.")
    # stable order, no duplicates
    seen: set[str] = set()
    unique = [p for p in parts if not (p in seen or seen.add(p))]
    prefix = second_reader_sentence(primary)
    return " ".join(([prefix] if prefix else []) + unique)


def disagreement_note(primary: Cell, checks_by_cell: dict[str, list[Check]], cells_by_id: dict[str, Cell],
                      source_titles: dict[str, str]) -> str:
    """Say so, in words, when another official printing of the same figure disagrees (never hidden).

    The published value is the primary printing, which passed its own check. If the other
    printing also passed an arithmetic check in its own table, both numbers are as printed,
    i.e. the publisher restated the figure.
    """
    notes: list[str] = []
    for chk in checks_by_cell.get(primary.cell_id, []):
        if chk.official and chk.result == "pass_within_rounding" and chk.check_type == "cross_edition":
            other_id = chk.member_cell_ids[0] if chk.target_cell_id == primary.cell_id else chk.target_cell_id
            other = cells_by_id.get(other_id or "")
            if other is not None and other.value_parsed is not None and primary.value_parsed is not None \
                    and Decimal(other.value_parsed) != Decimal(primary.value_parsed):
                notes.append(f"The {source_titles.get(other.source_id, other.source_id)} prints this figure as "
                             f"{fmt(other.value_parsed)}, one unit of the last printed digit away; that counts as agreement "
                             f"within rounding. The value shown is the one printed in the "
                             f"{source_titles.get(primary.source_id, primary.source_id)}.")
            continue
        if not chk.official or chk.result != "fail" or chk.check_type not in AGREEMENT_CHECKS:
            continue
        other_id = chk.member_cell_ids[0] if chk.target_cell_id == primary.cell_id else chk.target_cell_id
        other = cells_by_id.get(other_id or "")
        if other is None:
            continue
        other_ok = any(c.official and c.result in PASSING and c.check_type in ARITHMETIC_CHECKS
                       for c in checks_by_cell.get(other.cell_id, []))
        where = source_titles.get(other.source_id, other.source_id)
        here = source_titles.get(primary.source_id, primary.source_id)
        text = (f"The {where} prints a different figure for this ({fmt(other.value_parsed)}). The value shown is the one "
                f"printed in the {here}.")
        if other_ok:
            text += (" Both figures add up within their own tables, so each is as printed: the publisher restated the "
                     "figure in the later document.")
        notes.append(text)
    return " ".join(sorted(set(notes)))


def is_disputed(group: Iterable[Cell], checks_by_cell: dict[str, list[Check]]) -> bool:
    """True when a cross-edition pair among these printings was classified `disputed` (D25)."""
    return any(chk.official and chk.result == "disputed" and chk.check_type == "cross_edition"
               for c in group for chk in checks_by_cell.get(c.cell_id, []))


def disputed_readings(group: Iterable[Cell]) -> list[DisputedReading]:
    """Every printing of the figure, in the order given (earliest document first)."""
    return [DisputedReading(cell_id=c.cell_id, source_id=c.source_id, page=c.page, value_raw=c.value_raw.strip(),
                            value_parsed=c.value_parsed)
            for c in group if c.value_parsed is not None and not c.is_missing]


def disputed_sentence(readings: list[DisputedReading], source_titles: dict[str, str]) -> str:
    # One clause per document and figure; a document that prints the figure on two pages lists both.
    pages: dict[tuple[str, str], list[int]] = {}
    for r in readings:
        pages.setdefault((r.source_id, r.value_raw), []).append(r.page)
    parts = []
    for (source_id, raw), pp in pages.items():
        pp = sorted(set(pp))
        where = f"p.{pp[0]}" if len(pp) == 1 else "pp." + ", ".join(str(p) for p in pp)
        parts.append(f"as {raw} in the {source_titles.get(source_id, source_id)} ({where})")
    return ("Printed " + " and ".join(parts) + ". Each table adds up on its own page. "
            "We do not publish either figure as checked.")


def build_observations(cells: Iterable[Cell], checks: Iterable[Check], series: dict[str, Series],
                       source_order: dict[str, str], source_titles: dict[str, str], release: str) -> list[Observation]:
    """Group mapped cells into observations and assign tier/status from evidence."""
    cells = list(cells)
    cells_by_id = {c.cell_id: c for c in cells}
    checks_by_cell: dict[str, list[Check]] = defaultdict(list)
    for chk in checks:
        for cid in {chk.target_cell_id, *chk.member_cell_ids} - {None}:
            checks_by_cell[cid].append(chk)

    groups: dict[tuple[str, str, str], list[Cell]] = defaultdict(list)
    for c in cells:
        if c.series_id and c.period and c.vintage and c.series_id in series:
            groups[(c.series_id, c.period, c.vintage)].append(c)

    out: list[Observation] = []
    for (sid, period, vintage), group in sorted(groups.items()):
        # Primary = the earliest document that prints the figure (plan 7.1); ties by position.
        group.sort(key=lambda c: (source_order.get(c.source_id, c.source_id), c.page, c.table_index, c.row_index, c.col_index))
        primary, supporting = group[0], group[1:]
        s = series[sid]
        check_ids = sorted({chk.check_id for c in group for chk in checks_by_cell.get(c.cell_id, [])})
        base = dict(obs_id=obs_id_for(sid, period, vintage), series_id=sid, period=period, vintage=vintage,
                    unit=s.unit, scale_factor=s.scale_factor, primary_cell_id=primary.cell_id,
                    supporting_cell_ids=[c.cell_id for c in supporting], check_ids=check_ids)
        if primary.is_missing:
            out.append(Observation(**base, tier=None, status="unchecked", published=False, gap_kind="not_in_source",
                                   gap_reason=f"The document prints '{primary.missing_marker}' instead of a figure.",
                                   evidence_summary="The source prints no figure here."))
            continue
        if is_disputed(group, checks_by_cell):
            readings = disputed_readings(group)
            sentence = disputed_sentence(readings, source_titles)
            out.append(Observation(**base, tier=None, status="disputed", published=False, gap_kind="disputed",
                                   gap_reason="Two official documents print different figures for this.",
                                   evidence_summary=sentence, disputed_readings=readings))
            continue
        tier, reasons = decide_tier(primary, supporting, checks_by_cell)
        sentence = evidence_sentence(primary, tier, checks_by_cell, cells_by_id, source_titles)
        if tier in ("A", "B"):
            out.append(Observation(**base, value=primary.value_parsed, tier=tier, status="checked", published=True,
                                   evidence_summary=sentence, notes=disagreement_note(primary, checks_by_cell, cells_by_id, source_titles),
                                   first_published_release=release, last_changed_release=release))
        elif tier == "C":
            out.append(Observation(**base, tier=tier, status="unchecked", published=False, gap_kind="not_yet_verified",
                                   gap_reason="No deterministic check covers this figure yet.", evidence_summary=sentence))
        else:
            out.append(Observation(**base, tier=tier, status="unchecked", published=False, gap_kind="failed_checks",
                                   gap_reason="; ".join(reasons) or "failed checks", evidence_summary=sentence))
    return out
