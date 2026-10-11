from decimal import Decimal

from conftest import make_cell
from datalab.checks import (classify_disputes, classify_sum, dispute_summary, equality_check, evaluate_sum_rules, fmt,
                            pass_rate, sum_check, value_check)
from datalab.schema import Series
from datalab.status import build_observations, decide_tier

RULES = [{"id": "t.total", "type": "column_total", "target": "s.total", "members": ["s.a", "s.b", "s.c"],
          "what_members": "the three items", "what_target": "Total"}]
SERIES = {sid: Series(series_id=sid, name=sid, dataset="abs", frequency="fiscal_year", unit="PKR", scale_factor=10**6)
          for sid in ("s.a", "s.b", "s.c", "s.total")}


def column(source: str, values: dict[str, str], period="2025-26", vintage="be", col=2, struct=None):
    order = ["s.a", "s.b", "s.c", "s.total"]
    return [make_cell(source, order.index(sid), col, v, v.replace(",", ""), series=sid, period=period, vintage=vintage,
                      label=sid, struct=struct) for sid, v in values.items()]


def run_rules(cells, blocked=None):
    return evaluate_sum_rules(cells, RULES, "abs", {}, blocked or {}, lambda c: "the test column")


def by_cell(checks):
    out = {}
    for chk in checks:
        for cid in {chk.target_cell_id, *chk.member_cell_ids}:
            out.setdefault(cid, []).append(chk)
    return out


def test_fmt_keeps_digits():
    assert fmt("17203391") == "17,203,391"
    assert fmt("-40000") == "-40,000"
    assert fmt("12.50") == "12.50"


def test_classify_sum_tolerance_d9():
    unit = Decimal(1)
    assert classify_sum(Decimal(0), 10, unit) == "pass"
    assert classify_sum(Decimal(5), 10, unit) == "pass_within_rounding"      # 0.5 x 10 x 1
    assert classify_sum(Decimal(-5), 10, unit) == "pass_within_rounding"
    assert classify_sum(Decimal(6), 10, unit) == "fail"
    assert classify_sum(Decimal("0.1"), 2, Decimal("0.1")) == "pass_within_rounding"
    assert classify_sum(Decimal("0.2"), 2, Decimal("0.1")) == "fail"


def test_column_total_pass_and_description():
    cells = column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "600"})
    (chk,) = run_rules(cells)
    assert chk.result == "pass" and chk.residual == "0"
    assert "add exactly" in chk.description.lower()
    assert len(chk.member_cell_ids) == 3


def test_column_total_within_rounding_and_fail():
    (chk,) = run_rules(column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "601"}))
    assert chk.result == "pass_within_rounding"
    (chk,) = run_rules(column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "650"}))
    assert chk.result == "fail" and chk.residual == "-50"


def test_missing_member_is_not_evaluable_never_passed():
    (chk,) = run_rules(column("e1", {"s.a": "100", "s.b": "200", "s.total": "300"}))
    assert chk.result == "not_evaluable"
    assert "s.c" in chk.not_evaluable_reason


def test_blocked_table_is_not_evaluable_even_if_it_adds_up():
    # A passing sum on a table that lost a column is not reassurance (AGENTS.md section 6).
    cells = column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "600"})
    (chk,) = run_rules(cells, blocked={("e1", 1, 0): "the table is flagged dropped_column"})
    assert chk.result == "not_evaluable"


def test_printed_dash_member_counts_as_nil_and_is_not_credited():
    cells = column("e1", {"s.a": "100", "s.b": "200", "s.total": "300"})
    dash = make_cell("e1", 2, 2, "-", None, series="s.c", missing=True)
    (chk,) = run_rules(cells + [dash])
    assert chk.result == "pass"
    assert dash.cell_id not in chk.member_cell_ids


def test_rule_skipped_when_target_not_printed():
    assert run_rules(column("e1", {"s.a": "100", "s.b": "200", "s.c": "300"})) == []


def test_bracket_negative_member_in_sum():
    a = make_cell("e1", 0, 2, "100", "100", series="s.a")
    b = make_cell("e1", 1, 2, "(40)", "-40", series="s.b")
    t = make_cell("e1", 3, 2, "60", "60", series="s.total")
    chk = sum_check(check_type="accounting_identity", dataset="abs", rule_id="r", target=t, members=[(a, 1), (b, 1)],
                    what_members="x", what_target="y", column_label="z")
    assert chk.result == "pass"


def test_cross_edition_equality():
    first = make_cell("e1", 0, 4, "31,975", "31975", series="s.a")
    same = make_cell("e2", 0, 2, "31,975", "31975", series="s.a")
    off_by_one = make_cell("e2", 0, 2, "31,976", "31976", series="s.a")
    different = make_cell("e2", 0, 2, "32,975", "32975", series="s.a")
    kw = dict(check_type="cross_edition", dataset="abs", rule_id="x", what="Health", where_first="A", where_second="B")
    assert equality_check(first=first, second=same, **kw).result == "pass"
    assert equality_check(first=first, second=off_by_one, **kw).result == "pass_within_rounding"
    assert equality_check(first=first, second=different, **kw).result == "fail"


def test_value_check_recompute():
    target = make_cell("e1", 0, 2, "6.3", "6.3", series="s.a")
    kw = dict(check_type="recompute", dataset="lfs", rule_id="r", target=target, members=[], tolerance=Decimal("0.05"),
              description_ok="Rate = unemployed / labour force.", what="the rate")
    assert value_check(computed=Decimal("6.3"), **kw).result == "pass"
    assert value_check(computed=Decimal("6.34"), **kw).result == "pass_within_rounding"
    assert value_check(computed=Decimal("6.9"), **kw).result == "fail"
    assert value_check(computed=None, **kw).result == "not_evaluable"


def test_pass_rate_separates_not_evaluable_and_ignores_unofficial():
    ok = run_rules(column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "600"}))
    ne = run_rules(column("e2", {"s.a": "100", "s.b": "200", "s.total": "300"}))
    rate = pass_rate(ok + ne)
    assert rate["evaluable"] == 1 and rate["not_evaluable"] == 1 and rate["pass_rate"] == 1.0


# ---------------------------------------------------------------- status

def tiers(cells, checks):
    obs = build_observations(cells, checks, SERIES, {"e1": "2025-26", "e2": "2026-27"}, {"e1": "Edition 1", "e2": "Edition 2"}, "vT")
    return {o.obs_id: o for o in obs}


def test_tier_b_arithmetic_only_is_published():
    cells = column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "600"})
    obs = tiers(cells, run_rules(cells))
    o = obs["s.a:2025-26:be"]
    assert (o.tier, o.status, o.published, o.value) == ("B", "checked", True, "100")
    assert "add to the printed" in o.evidence_summary


def test_tier_a_needs_arithmetic_and_second_printing():
    e1 = column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "600"})
    e2 = column("e2", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "600"}, col=0)
    checks = run_rules(e1 + e2)
    for a, b in zip(e1, e2):
        checks.append(equality_check(check_type="cross_edition", dataset="abs", rule_id="x", first=a, second=b, what="w",
                                     where_first="Edition 1", where_second="Edition 2"))
    obs = tiers(e1 + e2, checks)
    o = obs["s.b:2025-26:be"]
    assert o.tier == "A" and o.published
    assert o.primary_cell_id == e1[1].cell_id and o.supporting_cell_ids == [e2[1].cell_id]   # earliest edition is primary


def test_tier_c_unchecked_value_is_withheld():
    cells = column("e1", {"s.a": "100"})
    o = tiers(cells, [])["s.a:2025-26:be"]
    assert (o.tier, o.published, o.value, o.gap_kind) == ("C", False, None, "not_yet_verified")


def test_failed_sum_holds_back_the_whole_set():
    # Rule 10: nothing points to one bad value, so every member and the total are withheld.
    cells = column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "999"})
    obs = tiers(cells, run_rules(cells))
    assert all(o.tier == "D" and not o.published and o.value is None and o.gap_kind == "failed_checks" for o in obs.values())


def test_failed_sum_member_is_withheld_even_when_reprinted_unchanged():
    e1 = column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "999"})
    e2_a = make_cell("e2", 0, 0, "100", "100", series="s.a")
    checks = run_rules(e1) + [equality_check(check_type="cross_edition", dataset="abs", rule_id="x", first=e1[0], second=e2_a,
                                             what="w", where_first="Edition 1", where_second="Edition 2")]
    obs = tiers(e1 + [e2_a], checks)
    # A failed check is never outvoted: the reprint shows the reading of s.a twice, not that the block adds up.
    assert obs["s.a:2025-26:be"].tier == "D" and not obs["s.a:2025-26:be"].published
    assert obs["s.b:2025-26:be"].tier == "D"


def test_flagged_cell_is_quarantined():
    cell = make_cell("e1", 0, 2, "852  251,130", None, series="s.a", flags=["merged_cell_suspected"])
    assert decide_tier(cell, [], {})[0] == "D"
    blocked = make_cell("e1", 0, 2, "100", "100", series="s.a", struct=["dropped_column"])
    assert decide_tier(blocked, [], {})[0] == "D"


def test_not_evaluable_never_counts_as_evidence():
    cells = column("e1", {"s.a": "100", "s.b": "200", "s.total": "300"})
    obs = tiers(cells, run_rules(cells))
    assert obs["s.a:2025-26:be"].tier == "C"


def test_printed_dash_is_a_gap_not_in_source():
    cell = make_cell("e1", 0, 2, "-", None, series="s.a", missing=True)
    o = tiers([cell], [])["s.a:2025-26:be"]
    assert o.gap_kind == "not_in_source" and not o.published


def test_status_is_deterministic():
    cells = column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "600"})
    a = [o.model_dump() for o in tiers(cells, run_rules(cells)).values()]
    b = [o.model_dump() for o in tiers(list(reversed(cells)), list(reversed(run_rules(cells)))).values()]
    assert a == b


def _two_editions(e2_values, struct2=None):
    e1 = column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "600"})
    e2 = column("e2", e2_values, col=0, struct=struct2)
    checks = run_rules(e1 + e2)
    for a, b in zip(e1, e2):
        checks.append(equality_check(check_type="cross_edition", dataset="abs", rule_id="x", first=a, second=b, what="w",
                                     where_first="Edition 1", where_second="Edition 2"))
    return e1, e2, classify_disputes(checks, e1 + e2)


def test_restated_figure_that_adds_up_in_both_editions_is_disputed_d25():
    # 50 moved from b to a in the later edition; both columns still add to 600.
    e1, e2, checks = _two_editions({"s.a": "150", "s.b": "150", "s.c": "300", "s.total": "600"})
    assert dispute_summary(checks) == {"differing_pairs": 2, "disputed": 2, "kept_as_fail": {}}
    obs = tiers(e1 + e2, checks)
    o = obs["s.a:2025-26:be"]
    assert o.status == "disputed" and not o.published and o.value is None and o.tier is None and o.gap_kind == "disputed"
    assert [(r.source_id, r.value_parsed) for r in o.disputed_readings] == [("e1", "100"), ("e2", "150")]
    assert o.evidence_summary.startswith("Printed as 100 in the Edition 1 (p.1) and as 150 in the Edition 2 (p.1).")
    assert "We do not publish either figure as checked." in o.evidence_summary
    # an undisputed line in the same tables is unaffected
    assert obs["s.c:2025-26:be"].tier == "A" and obs["s.c:2025-26:be"].status == "checked"
    # D26: disputed pairs are left out of cross-edition agreement but never count as a pass overall
    cross = pass_rate(checks, ["cross_edition"])
    assert (cross["pass"], cross["fail"], cross["disputed"], cross["pass_rate"]) == (2, 0, 2, 1.0)
    overall = pass_rate(checks, disputed_as_failed=True)
    assert overall["evaluable"] == 6 and overall["pass_rate"] == round(4 / 6, 4)


def test_differing_pair_stays_fail_and_is_withheld_when_one_table_does_not_add_up():
    # the later edition's column does not add up: that is an extraction problem, not a restatement
    e1, e2, checks = _two_editions({"s.a": "150", "s.b": "200", "s.c": "300", "s.total": "600"})
    summary = dispute_summary(checks)
    assert summary["disputed"] == 0 and summary["kept_as_fail"] == {"an arithmetic check on one reading failed": 1}
    o = tiers(e1 + e2, checks)["s.a:2025-26:be"]
    assert o.status == "unchecked" and not o.published and o.tier == "D" and o.disputed_readings == []


def test_differing_pair_stays_fail_when_a_table_is_flagged():
    e1, e2, checks = _two_editions({"s.a": "150", "s.b": "150", "s.c": "300", "s.total": "600"}, struct2=["merged_rows"])
    assert dispute_summary(checks)["disputed"] == 0
    assert set(dispute_summary(checks)["kept_as_fail"]) == {"a table or row carries a structural flag"}
    o = tiers(e1 + e2, checks)["s.a:2025-26:be"]
    assert not o.published and o.status == "unchecked" and o.tier == "D"


def test_differing_pair_stays_fail_without_arithmetic_evidence_on_both_sides():
    e1 = column("e1", {"s.a": "100", "s.b": "200", "s.c": "300", "s.total": "600"})
    e2 = column("e2", {"s.a": "150"}, col=0)          # the later edition prints the line alone: no sum covers it
    checks = run_rules(e1 + e2)
    checks.append(equality_check(check_type="cross_edition", dataset="abs", rule_id="x", first=e1[0], second=e2[0], what="w",
                                 where_first="Edition 1", where_second="Edition 2"))
    checks = classify_disputes(checks, e1 + e2)
    assert dispute_summary(checks)["kept_as_fail"] == {"a reading has no passed arithmetic check in its own table": 1}
    o = tiers(e1 + e2, checks)["s.a:2025-26:be"]
    assert not o.published and o.tier == "D"          # withheld although its own sum passed
