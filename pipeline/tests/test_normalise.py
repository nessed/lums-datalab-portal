from decimal import Decimal

import pytest

from datalab.normalise import (
    decimal_places,
    decimal_to_str,
    detect_scale,
    last_digit_unit,
    normalise_label,
    numeric_tokens,
    parse_printed,
)


@pytest.mark.parametrize(
    "text,expected",
    [
        ("17,203,391", "17203391"),
        ("  16,390,174   ", "16390174"),
        ("12.34", "12.34"),
        ("5.0", "5.0"),
        ("0", "0"),
        ("1,234.", "1234"),
        ("-45", "-45"),
    ],
)
def test_plain_numbers(text, expected):
    p = parse_printed(text)
    assert p.value_str == expected
    assert not p.is_missing


def test_five_point_zero_equals_five():
    assert parse_printed("5.0").value == parse_printed("5").value
    assert numeric_tokens("5.0") == numeric_tokens("5")


@pytest.mark.parametrize("dash", ["−", "–", "—", "―"])
def test_unicode_minus(dash):
    p = parse_printed(f"{dash}12.5")
    assert p.value == Decimal("-12.5")
    assert "unicode_minus" in p.flags


def test_nbsp_is_space():
    assert parse_printed(" 1,000 ").value == Decimal(1000)


@pytest.mark.parametrize(
    "marker", ["n.a.", "N.A.", "na", "n/a", "nil", "Nil", "-", "--", "---", "...", "…", "*", "**", "", "  ",
               "not available", "—", "–"]
)
def test_missing_markers(marker):
    p = parse_printed(marker)
    assert p.is_missing
    assert p.value is None


def test_missing_marker_is_kept():
    assert parse_printed("N.A.").missing_marker == "N.A."


def test_bracket_negative():
    p = parse_printed("(40,000)")
    assert p.value == Decimal(-40000)
    assert "bracket_negative" in p.flags


def test_fiscal_year_label_is_not_a_value():
    p = parse_printed("2024-25")
    assert p.value is None
    assert "year_label_only" in p.flags
    assert p.fiscal_years == ("2024-25",)


def test_fiscal_year_masked_before_parsing():
    p = parse_printed("Budget 2024-25")
    assert p.value is None


def test_percent_sign():
    p = parse_printed("12.5%")
    assert p.value == Decimal("12.5")
    assert "percent_sign" in p.flags


@pytest.mark.parametrize("text", ["1,234*", "1,234 **", "1,234†", "1,234 (a)", "1,234¹"])
def test_footnote_marks(text):
    p = parse_printed(text)
    assert p.value == Decimal(1234)
    assert "footnote_mark_stripped" in p.flags


def test_merged_cell_known_trap():
    # AGENTS.md section 7: one cell holding two numbers.
    p = parse_printed("852  251,130")
    assert p.value is None
    assert "merged_cell_suspected" in p.flags


def test_text_is_not_a_number():
    assert parse_printed("Health").value is None
    assert parse_printed("Table 12").value is None


def test_raw_is_always_kept():
    assert parse_printed(" (1,234) ").raw == " (1,234) "


def test_decimal_string_has_no_exponent():
    assert decimal_to_str(Decimal("1E+3")) == "1000"
    assert decimal_to_str(Decimal("0.10")) == "0.10"


def test_last_digit_unit():
    assert last_digit_unit("123") == Decimal(1)
    assert last_digit_unit("12.3") == Decimal("0.1")
    assert last_digit_unit("12.34") == Decimal("0.01")
    assert decimal_places("12.340") == 3


def test_numeric_tokens_masks_years_and_brackets():
    assert numeric_tokens("Budget 2024-25 17,203 (40) 5.0") == [Decimal(17203), Decimal(-40), Decimal("5.0")]


@pytest.mark.parametrize(
    "text,scale",
    [("(Rs in million)", 10**6), ("Rs. in Million", 10**6), ("(Million Rupees)", 10**6), ("Rs. in billion", 10**9),
     ("(In thousands)", 10**3), ("Percent", None)],
)
def test_detect_scale(text, scale):
    assert detect_scale(text) == scale


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("01 General Public Services", "general public services"),
        ("Defence Affairs & Services", "defence affairs and services"),
        ("a. Current Exp. on Revenue Account", "current exp. on revenue account"),
        ("1 Total Current Expenditure (a + b)", "total current expenditure(a+b)"),
        ("Total Expenditure:", "total expenditure"),
        ("(i) Something", "something"),
        ("  Health  ", "health"),
        ("07 Health*", "health"),
    ],
)
def test_normalise_label(raw, expected):
    assert normalise_label(raw) == expected
