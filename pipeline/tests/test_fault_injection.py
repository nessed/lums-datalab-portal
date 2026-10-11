"""The fault catalogue of scripts/fault_injection.py is deterministic and makes the faults it names."""
import importlib.util
from decimal import Decimal
from pathlib import Path

_spec = importlib.util.spec_from_file_location("fault_injection", Path(__file__).resolve().parents[1] / "scripts" / "fault_injection.py")
fi = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fi)


def test_faults_change_the_value_in_the_way_they_name():
    v = Decimal("1234.5")
    assert fi.f_times10(v) == Decimal("12345.0")
    assert fi.f_div10(v) == Decimal("123.45")
    assert fi.f_sign(v) == Decimal("-1234.5")
    assert fi.f_last_digit(v) == Decimal("1234.6")
    assert fi.f_first_digit(v) == Decimal("2234.5")
    assert fi.f_transpose(v) == Decimal("2134.5")
    assert fi.f_drop_leading(v) == Decimal("234.5")


def test_faults_skip_values_they_cannot_change():
    assert fi.f_sign(Decimal(0)) is None and fi.f_times10(Decimal(0)) is None
    assert fi.f_transpose(Decimal(11)) is None            # equal neighbours: swapping changes nothing
    assert fi.f_drop_leading(Decimal(7)) is None          # a single digit has nothing left


def test_negative_values_keep_their_sign_in_digit_faults():
    assert fi.f_first_digit(Decimal("-50")) == Decimal("-60")
    assert fi.f_transpose(Decimal("-12")) == Decimal("-21")
