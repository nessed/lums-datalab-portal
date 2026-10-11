"""Deterministic parsing of printed table text into Decimal values.

Ported and generalised from the normaliser tested in August 2026
(`compare_values.py` in the ra-ship archive). The printed text is never
discarded: callers keep `value_raw` verbatim beside whatever this returns.

No value is ever produced here by anything other than these rules.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

# Rule 1: dash-like characters that mean "minus" or "nothing" in print.
_MINUS = dict.fromkeys(map(ord, "\u2212\u2013\u2014\u2015\u00ad"), "-")

# Rule 2: typed missing markers (compared case-insensitively, after rule 1).
MISSING_MARKERS = frozenset(
    {"n.a.", "n.a", "na", "n/a", "nil", "-", "--", "---", "...", "..", "\u2026", "*", "**", "",
     "not available"}
)

# Rule 3: fiscal-year labels such as 2024-25, 2024-2025, 1999-00.
FISCAL_YEAR = re.compile(r"\b((?:19|20)\d{2})\s*-\s*(\d{4}|\d{2})\b")
_LONE_YEAR = re.compile(r"^(?:19|20)\d{2}$")
# In a cell, a year label is masked only when it is not the front of a longer number. "2015 -16.3"
# is a year and the figure -16.3 merged into one cell, not the label 2015-16 followed by ".3"
# (found by the property tests: it was read as 0.3). The same holds for "2015 -16,300".
_FISCAL_YEAR_LABEL = re.compile(FISCAL_YEAR.pattern + r"(?!\.\d|,\d{3}(?!\d))")

_NUMBER = re.compile(r"-?(?:\d[\d,]*(?:\.\d+)?\.?|\.\d+)")
_BRACKETED = re.compile(r"^\(\s*(-?\d[\d,]*(?:\.\d+)?)\s*\)$")
# Rule 5: footnote marks that may trail (or lead) a printed number.
_FOOTNOTE_TAIL = re.compile(r"(?:\s*(?:\*+|\u2020|\u2021|[\u00b9\u00b2\u00b3\u2070-\u2079]+|\([a-z]\)|@|#))+$", re.I)
_FOOTNOTE_HEAD = re.compile(r"^(?:\*+|\u2020|\u2021|@|#)\s*")

# Rule 7: scale phrases found in table headers or captions.
_SCALE_PATTERNS: list[tuple[re.Pattern[str], int]] = [
    (re.compile(r"(?i)\b(rs\.?|rupees)\s*(in\s+)?trillions?\b|\btrillion\s+rupees\b"), 10**12),
    (re.compile(r"(?i)\b(rs\.?|rupees)\s*(in\s+)?billions?\b|\bbillion\s+rupees\b|\brs\.?\s*bn\b"), 10**9),
    (re.compile(r"(?i)\b(rs\.?|rupees)\s*(in\s+)?millions?\b|\bmillion\s+rupees\b|\brs\.?\s*mn\b"), 10**6),
    (re.compile(r"(?i)\b(rs\.?|rupees)\s*(in\s+)?thousands?\b|\bthousand\s+rupees\b"), 10**3),
    (re.compile(r"(?i)\(\s*(in\s+)?millions?\s*\)|\bin\s+millions?\b"), 10**6),
    (re.compile(r"(?i)\(\s*(in\s+)?thousands?\s*\)|\bin\s+thousands?\b|\(000\)|\b000s\b"), 10**3),
]


@dataclass(frozen=True)
class Parsed:
    """Result of parsing one printed cell."""

    raw: str
    value: Decimal | None = None
    is_missing: bool = False
    missing_marker: str | None = None
    flags: tuple[str, ...] = field(default_factory=tuple)
    fiscal_years: tuple[str, ...] = field(default_factory=tuple)

    @property
    def value_str(self) -> str | None:
        return decimal_to_str(self.value) if self.value is not None else None


def clean_text(text: object) -> str:
    """Rule 1: unify dashes, non-breaking spaces and surrounding whitespace."""
    if text is None:
        return ""
    return str(text).translate(_MINUS).replace("\u00a0", " ").replace("\u2009", " ").strip()


def decimal_to_str(value: Decimal) -> str:
    """Canonical decimal string: no exponent, printed decimals kept ("5.0" stays "5.0")."""
    return format(value, "f")


def decimal_places(value_str: str) -> int:
    """Number of digits printed after the decimal point."""
    return len(value_str.split(".", 1)[1]) if "." in value_str else 0


def last_digit_unit(value_str: str) -> Decimal:
    """One unit of the last printed digit: 1 for "123", 0.1 for "12.3"."""
    return Decimal(1).scaleb(-decimal_places(value_str))


def _to_decimal(token: str) -> Decimal | None:
    token = token.replace(",", "").rstrip(".")
    if token in ("", "-"):
        return None
    try:
        return Decimal(token)
    except InvalidOperation:
        return None


def parse_printed(text: object) -> Parsed:
    """Parse one printed cell. Returns a value only when exactly one number is present."""
    raw = "" if text is None else str(text)
    t = clean_text(raw)
    flags: list[str] = []
    if raw != t and any(ch in raw for ch in "\u2212\u2013\u2014\u2015\u00ad"):
        flags.append("unicode_minus")

    # Rule 2: missing markers.
    if t.lower() in MISSING_MARKERS:
        return Parsed(raw=raw, is_missing=True, missing_marker=t, flags=tuple(flags))

    # Rule 3: mask fiscal-year labels before looking for numbers.
    fiscal_years = tuple(f"{a}-{b}" for a, b in _FISCAL_YEAR_LABEL.findall(t))
    masked = _FISCAL_YEAR_LABEL.sub(" ", t).strip()
    if fiscal_years and not _NUMBER.search(masked):
        flags.append("year_label_only")
        return Parsed(raw=raw, flags=tuple(flags), fiscal_years=fiscal_years)
    if fiscal_years:
        flags.append("fiscal_year_masked")

    # Rule 5 (part): percent sign and footnote marks.
    work = masked
    if "%" in work:
        work = work.replace("%", " ").strip()
        flags.append("percent_sign")
    stripped = _FOOTNOTE_TAIL.sub("", work)
    stripped = _FOOTNOTE_HEAD.sub("", stripped)
    if stripped != work and _NUMBER.search(stripped):
        flags.append("footnote_mark_stripped")
        work = stripped.strip()

    # Rule 4: bracketed negatives.
    negative = False
    m = _BRACKETED.match(work)
    if m:
        negative = True
        work = m.group(1)
        flags.append("bracket_negative")

    # Thousands separators printed as spaces inside one number are NOT joined:
    # two numeric tokens in one cell is the merged-row trap (rule 6).
    tokens = [tok for tok in _NUMBER.findall(work) if _to_decimal(tok) is not None]
    if not tokens:
        flags.append("no_number")
        return Parsed(raw=raw, flags=tuple(flags), fiscal_years=fiscal_years)
    if len(tokens) > 1:
        flags.append("merged_cell_suspected")
        return Parsed(raw=raw, flags=tuple(flags), fiscal_years=fiscal_years)

    token = tokens[0]
    residue = work.replace(token, "", 1).strip()
    if residue not in ("", "-") and re.search(r"[A-Za-z]", residue):
        flags.append("text_with_number")
        return Parsed(raw=raw, flags=tuple(flags), fiscal_years=fiscal_years)
    if residue == "-" and not token.startswith("-"):
        # a detached minus sign, e.g. "- 12.3"
        token = "-" + token
        # Ambiguous: a negative figure, or a dash for "nil" from the neighbouring column glued to
        # this number (seen in the ABS detail tables: '- 6' where the next edition prints 6).
        flags.append("detached_minus")

    value = _to_decimal(token)
    if value is None:
        flags.append("no_number")
        return Parsed(raw=raw, flags=tuple(flags), fiscal_years=fiscal_years)
    if negative and value > 0:
        value = -value
    if _LONE_YEAR.match(token) and not fiscal_years and "," not in raw:
        flags.append("looks_like_year")
    return Parsed(raw=raw, value=value, flags=tuple(flags), fiscal_years=fiscal_years)


def numeric_tokens(text: object) -> list[Decimal]:
    """Every number in a text fragment, for multiset coverage comparison (D11).

    Fiscal-year labels are masked; bracketed numbers are negative; `5.0 == 5`
    because Decimal equality ignores trailing zeros.
    """
    t = clean_text(text)
    t = FISCAL_YEAR.sub(" ", t)
    out: list[Decimal] = []
    for m in re.finditer(r"(\()?\s*(-?\d[\d,]*(?:\.\d+)?)\.?\s*(\))?", t):
        value = _to_decimal(m.group(2))
        if value is None:
            continue
        if m.group(1) and m.group(3) and value > 0:
            value = -value
        out.append(value)
    return out


def detect_scale(text: object) -> int | None:
    """Rule 7: scale factor from header or caption text, or None if not stated."""
    t = clean_text(text)
    for pattern, factor in _SCALE_PATTERNS:
        if pattern.search(t):
            return factor
    return None


def normalise_label(text: object) -> str:
    """Canonical form of a row or column label for dictionary lookup.

    Lowercase, collapsed whitespace, leading numbering stripped ("01", "a.",
    "(i)", "1"), trailing punctuation stripped, "&" spelled "and".
    """
    t = clean_text(text).lower().replace("&", " and ")
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"^(?:\(?(?:[ivx]{1,4}|[a-d]|\d{1,3})[\.\)]\s+|\d{1,3}\s+(?=[a-z])|\((?:[ivx]{1,4}|[a-d]|\d{1,3})\)\s*)", "", t)
    t = re.sub(r"[\s:\.\-,;\*†]+$", "", t)   # trailing punctuation and footnote marks ("Health*")
    t = re.sub(r"\s*([\(\)\+])\s*", r"\1", t)
    return t
