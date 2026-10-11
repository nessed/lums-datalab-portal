"""Property-based tests for the normaliser (plan item E10), with `hypothesis`.

The example tests in test_normalise.py pin known cases. These state what must hold for every
input of a kind: a formatted number reads back as itself, and text that holds two numbers never
yields a value. The second is the merged-row trap (AGENTS.md section 7): a wrong number that looks
right is the worst outcome, so the parser must give nothing rather than one of the two.

Runs are deterministic (`derandomize=True`), so CI and a laptop test the same inputs.
"""
from __future__ import annotations

import re
from decimal import Decimal

from hypothesis import assume, example, given, settings
from hypothesis import strategies as st

from datalab.normalise import FISCAL_YEAR, clean_text, normalise_label, numeric_tokens, parse_printed

COMMON = settings(max_examples=300, deadline=None, derandomize=True)
UNICODE_DASHES = ["−", "–", "—", "―"]            # minus, en dash, em dash, horizontal bar
TRAILING_MARKS = ["*", "**", "†", "‡", "¹", "²³", "⁴", "(a)", "(b)", "@", "#"]
LEADING_MARKS = ["*", "**", "†", "‡", "@", "#"]


@st.composite
def printed_numbers(draw, commas=None):
    """(text as a table would print it, the value it stands for, the plain decimal string)."""
    whole = draw(st.integers(min_value=0, max_value=10**13))
    places = draw(st.integers(min_value=0, max_value=4))
    plain = str(whole)
    text = f"{whole:,}" if (draw(st.booleans()) if commas is None else commas) else plain
    if places:
        frac = f"{draw(st.integers(min_value=0, max_value=10**places - 1)):0{places}d}"
        plain, text = f"{plain}.{frac}", f"{text}.{frac}"
    return text, Decimal(plain), plain


padding = st.text(alphabet=" \t  ", max_size=3)


# ------------------------------------------------------------------ round trips

@COMMON
@given(printed_numbers(), padding, padding)
def test_formatted_decimal_round_trips(number, left, right):
    text, value, plain = number
    p = parse_printed(left + text + right)
    assert p.value == value
    assert p.value_str == plain                      # printed decimals are kept: "5.0" stays "5.0"
    assert not p.is_missing
    assert p.raw == left + text + right              # the printed text is never altered


@COMMON
@given(printed_numbers(commas=True))
def test_thousands_separators_never_change_the_value(number):
    text, value, _ = number
    assert parse_printed(text).value == parse_printed(text.replace(",", "")).value == value


@COMMON
@given(printed_numbers(), st.sampled_from(["", " "]))
def test_bracketed_number_is_negative(number, gap):
    text, value, _ = number
    p = parse_printed(f"({gap}{text}{gap})")
    assert p.value == -value
    assert "bracket_negative" in p.flags


@COMMON
@given(printed_numbers(), st.sampled_from(UNICODE_DASHES))
def test_unicode_minus_is_a_minus(number, dash):
    text, value, _ = number
    p = parse_printed(dash + text)
    assert p.value == -value
    assert "unicode_minus" in p.flags
    assert p.value == parse_printed("-" + text).value


@COMMON
@given(printed_numbers(), st.sampled_from(TRAILING_MARKS), st.sampled_from(["", " "]), st.booleans())
def test_trailing_footnote_mark_is_stripped_and_the_value_kept(number, mark, gap, bracketed):
    text, value, _ = number
    shown = f"({text})" if bracketed else text
    p = parse_printed(shown + gap + mark)
    assert p.value == (-value if bracketed else value)
    assert "footnote_mark_stripped" in p.flags


@COMMON
@given(printed_numbers(), st.sampled_from(LEADING_MARKS), st.sampled_from(["", " "]))
def test_leading_footnote_mark_is_stripped_and_the_value_kept(number, mark, gap):
    text, value, _ = number
    p = parse_printed(mark + gap + text)
    assert p.value == value
    assert "footnote_mark_stripped" in p.flags


@COMMON
@given(printed_numbers(), st.sampled_from(["%", " %"]))
def test_percent_sign_does_not_change_the_value(number, sign):
    text, value, _ = number
    p = parse_printed(text + sign)
    assert p.value == value and "percent_sign" in p.flags


# ------------------------------------------------------------------ two numbers never give a value

signed = st.sampled_from(["plain", "minus", "unicode_minus", "bracket"])
gaps = st.text(alphabet=" \t\n ", min_size=1, max_size=4)
words = st.text(alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .:", max_size=12)


def dress(text: str, how: str) -> str:
    return {"plain": text, "minus": "-" + text, "unicode_minus": "−" + text, "bracket": f"({text})"}[how]


@COMMON
@given(printed_numbers(), signed, gaps, printed_numbers(), signed, words, words)
@example(("852", Decimal("852"), "852"), "plain", "  ", ("251,130", Decimal("251130"), "251130"), "plain", "", "")
@example(("2015", Decimal("2015"), "2015"), "plain", " ", ("16.3", Decimal("16.3"), "16.3"), "minus", "", "")
@example(("2024", Decimal("2024"), "2024"), "plain", " ", ("2025.5", Decimal("2025.5"), "2025.5"), "minus", "", "")
def test_two_numbers_in_one_cell_never_yield_a_value(first, first_sign, gap, second, second_sign, before, after):
    text = before + dress(first[0], first_sign) + gap + dress(second[0], second_sign) + after
    p = parse_printed(text)
    assert p.value is None, f"{text!r} was read as {p.value} with flags {p.flags}"
    assert not p.is_missing


@COMMON
@given(st.lists(printed_numbers(), min_size=2, max_size=5), gaps)
def test_any_run_of_numbers_never_yields_a_value(numbers, gap):
    assert parse_printed(gap.join(n[0] for n in numbers)).value is None


digit_chunks = st.text(alphabet="0123456789.,-()−%*", min_size=1, max_size=7).filter(lambda c: re.search(r"\d", c) is not None)
any_chunks = st.text(alphabet="0123456789.,-()−%*", max_size=4)


@settings(max_examples=1500, deadline=None, derandomize=True)
@given(any_chunks, digit_chunks, st.lists(digit_chunks, min_size=1, max_size=3), any_chunks, gaps)
def test_number_like_text_with_two_separate_digit_groups_never_yields_a_value(before, first, rest, after, gap):
    """Independent of the parser's own token rule: two chunks of the cell, split on spaces, each hold a digit."""
    text = gap.join([before, first, *rest, after])
    assert len([c for c in clean_text(text).split() if re.search(r"\d", c)]) >= 2
    # A fiscal-year label followed by one figure is a label and a number, not two numbers (rule 3).
    assume(not FISCAL_YEAR.search(clean_text(text)))
    assert parse_printed(text).value is None


# ------------------------------------------------------------------ never raises

@settings(max_examples=1500, deadline=None, derandomize=True)
@given(st.text(max_size=40))
def test_parse_never_raises_on_arbitrary_text(text):
    p = parse_printed(text)
    assert p.raw == text
    assert p.value is None or (isinstance(p.value, Decimal) and p.value.is_finite())
    assert not (p.is_missing and p.value is not None)
    if p.value is not None:
        assert Decimal(p.value_str) == p.value and "e" not in p.value_str.lower()


@settings(max_examples=1500, deadline=None, derandomize=True)
@given(st.text(alphabet="0123456789.,-()%*+eE \t\n−– ٣²", max_size=30))
def test_parse_never_raises_on_number_like_text(text):
    p = parse_printed(text)
    assert p.value is None or p.value.is_finite()


@COMMON
@given(st.one_of(st.none(), st.integers(), st.floats(allow_nan=True, allow_infinity=True), st.binary(max_size=8)))
def test_parse_never_raises_on_things_that_are_not_text(thing):
    p = parse_printed(thing)
    assert p.value is None or p.value.is_finite()


@settings(max_examples=800, deadline=None, derandomize=True)
@given(st.text(max_size=40))
def test_helpers_never_raise_on_arbitrary_text(text):
    assert all(isinstance(v, Decimal) for v in numeric_tokens(text))
    assert isinstance(normalise_label(text), str)


# ------------------------------------------------------------------ the case these tests found

def test_a_year_glued_to_a_negative_figure_is_not_a_fiscal_year_label():
    """Found by the property above: "2015 -16.3" was read as the label 2015-16 followed by ".3", value 0.3."""
    for text in ("2015 -16.3", "2015-16.3", "2024 -2025.5", "2015 -16,300", "2015\u201316.3"):
        p = parse_printed(text)
        assert p.value is None and "merged_cell_suspected" in p.flags, text


def test_real_fiscal_year_labels_are_still_masked():
    assert parse_printed("2024-25").flags == ("year_label_only",)
    assert parse_printed("2024-25, 2025-26").fiscal_years == ("2024-25", "2025-26")
    assert parse_printed("1999-00,2000-01").fiscal_years == ("1999-00", "2000-01")     # a comma between two labels
    assert parse_printed("Budget 2024-25.").fiscal_years == ("2024-25",)               # a full stop after a label
    p = parse_printed("2024-25 1,234")
    assert p.value == Decimal("1234") and p.flags == ("fiscal_year_masked",)
