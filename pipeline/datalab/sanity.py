"""Sanity report for humans (plan item E6): `datalab sanity`.

Reads a release folder and nothing else (no PDFs, no work folder) and writes
`docs/reports/sanity_<release date>.md`. It lists things a person should look
at before anyone else does: large jumps, sign changes, series that some
documents print and others do not, checks that passed only just, parsed cells
that needed a normalisation rule, and disputed figures.

REPORT ONLY. Nothing here writes into a release, and nothing here changes a
value, a check result, a tier or a status. An entry in this report is a
pointer for a human, not a finding that a number is wrong.
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path
from typing import Any

from . import config
from .checks import EQUAL_RULE_TEXT, SUM_RULE_TEXT
from .normalise import last_digit_unit

CHANGE_THRESHOLD = Decimal("0.5")      # a change of more than 50% between two periods is listed
NEAR_TOLERANCE_SHARE = Decimal("0.8")  # a residual above 80% of what the rule allows is listed
MAX_ROWS = 25                          # rows shown per table; the number cut is always stated

_STATED_BOUND = (re.compile(r"^Absolute tolerance (\d+(?:\.\d+)?)\.$"),
                 re.compile(r"^Recomputed value must be within (\d+(?:\.\d+)?) of the printed value\.$"))
_FISCAL = re.compile(r"^(\d{4})-(\d{2})$")
_MONTH = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


# ---------------------------------------------------------------- loading

def load_release(release_dir: Path) -> dict[str, Any]:
    """The release's own JSON files, as plain dictionaries."""
    release_dir = Path(release_dir)
    names = ("release", "sources", "series", "observations", "cells", "checks")
    return {name: config.read_json(release_dir / f"{name}.json") for name in names}


def receipt_path(obs_id: str) -> str:
    """The site path of an observation's receipt."""
    return "/o/" + obs_id.replace(":", "~")


# ---------------------------------------------------------------- 1. changes between periods

def earlier_periods(period: str, frequency: str, rounds: list[str]) -> list[tuple[str, str]]:
    """The period(s) a figure is compared with: [(earlier period, kind of comparison)].

    Fiscal year: the year before. Month: the month before and the same month a year before.
    Survey round: the round before it among the rounds the data type holds (rounds are not yearly).
    """
    if frequency == "month":
        m = _MONTH.match(period)
        if not m:
            return []
        year, month = int(m.group(1)), int(m.group(2))
        before = f"{year - 1}-12" if month == 1 else f"{year}-{month - 1:02d}"
        return [(before, "month on month"), (f"{year - 1}-{month:02d}", "year on year")]
    if frequency == "survey_round":
        earlier = [r for r in rounds if r < period]
        return [(earlier[-1], "round on round")] if earlier else []
    m = _FISCAL.match(period)
    if not m:
        return []
    start = int(m.group(1))
    return [(f"{start - 1}-{start % 100:02d}", "year on year")]


def break_between(series: dict[str, Any], earlier: str, later: str) -> dict[str, Any] | None:
    """The series break that falls after `earlier` and at or before `later`, if any."""
    for b in series.get("breaks") or []:
        at = b.get("at_period") or ""
        if earlier < at <= later:
            return b
    return None


def period_changes(observations: list[dict[str, Any]], series: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Large changes and sign changes between consecutive published figures of one series and vintage."""
    published = {(o["series_id"], o["period"], o["vintage"]): o for o in observations if o["published"] and o["value"] is not None}
    rounds: dict[str, list[str]] = defaultdict(list)
    for o in observations:
        s = series[o["series_id"]]
        if s["frequency"] == "survey_round" and o["period"] not in rounds[s["dataset"]]:
            rounds[s["dataset"]].append(o["period"])
    for values in rounds.values():
        values.sort()
    large: list[dict[str, Any]] = []
    signs: list[dict[str, Any]] = []
    from_zero: list[dict[str, Any]] = []
    skipped_breaks: Counter = Counter()
    skipped_break_series: dict[tuple, set[str]] = defaultdict(set)
    compared = no_earlier = 0
    for (series_id, period, vintage), later in sorted(published.items()):
        s = series[series_id]
        for earlier_period, kind in earlier_periods(period, s["frequency"], rounds[s["dataset"]]):
            earlier = published.get((series_id, earlier_period, vintage))
            if earlier is None:
                no_earlier += 1
                continue
            b = break_between(s, earlier_period, period)
            if b is not None:
                key = (s["dataset"], b.get("at_period"), b.get("kind"), earlier_period, period)
                skipped_breaks[key] += 1
                skipped_break_series[key].add(series_id)
                continue
            compared += 1
            a, c = Decimal(earlier["value"]), Decimal(later["value"])
            row = {"dataset": s["dataset"], "unit": s["unit"], "series_id": series_id, "vintage": vintage, "kind": kind,
                   "earlier_obs": earlier["obs_id"], "later_obs": later["obs_id"], "earlier_value": earlier["value"],
                   "later_value": later["value"], "difference": c - a, "change": None}
            if a * c < 0:
                signs.append(row)
            if a == 0:
                if c != 0:
                    from_zero.append(row)
                continue
            row["change"] = (c - a) / abs(a)
            if abs(row["change"]) > CHANGE_THRESHOLD:
                large.append(row)
    large.sort(key=lambda r: (-abs(r["change"]), r["later_obs"], r["kind"]))
    signs.sort(key=lambda r: (r["later_obs"], r["kind"]))
    from_zero.sort(key=lambda r: (r["later_obs"], r["kind"]))
    skipped = [{"dataset": k[0], "at_period": k[1], "kind": k[2], "earlier": k[3], "later": k[4], "comparisons": n,
                "series": len(skipped_break_series[k])} for k, n in sorted(skipped_breaks.items(), key=lambda kv: tuple(str(x) for x in kv[0]))]
    return {"compared": compared, "no_earlier_figure": no_earlier, "large": large, "sign_changes": signs,
            "from_zero": from_zero, "skipped_at_breaks": skipped}


# ---------------------------------------------------------------- 2. presence across documents

def presence(cells: list[dict[str, Any]], series: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """For each data type: which documents print each series. A document counts when it holds a mapped cell."""
    printed_in: dict[str, set[str]] = defaultdict(set)
    documents: dict[str, set[str]] = defaultdict(set)
    for c in cells:
        sid = c.get("series_id")
        if not sid or sid not in series or c.get("is_missing"):
            continue
        printed_in[sid].add(c["source_id"])
        documents[series[sid]["dataset"]].add(c["source_id"])
    out: dict[str, Any] = {}
    for dataset in sorted(documents):
        docs = sorted(documents[dataset])
        patterns: dict[tuple[str, ...], list[str]] = defaultdict(list)
        everywhere = 0
        for sid in sorted(printed_in):
            if series[sid]["dataset"] != dataset:
                continue
            absent = tuple(d for d in docs if d not in printed_in[sid])
            if absent:
                patterns[absent].append(sid)
            else:
                everywhere += 1
        rows = [{"absent_from": list(absent), "printed_in": [d for d in docs if d not in absent], "series": ids}
                for absent, ids in sorted(patterns.items(), key=lambda kv: (-len(kv[1]), kv[0]))]
        out[dataset] = {"documents": docs, "series_in_every_document": everywhere,
                        "series_absent_somewhere": sum(len(r["series"]) for r in rows), "patterns": rows}
    return out


# ---------------------------------------------------------------- 3. residuals near the tolerance

def tolerance_bound(check: dict[str, Any], cells: dict[str, dict[str, Any]]) -> tuple[Decimal | None, str]:
    """The largest residual the check's rule allows, where it can be recomputed from the record.

    Returns (bound, where it comes from). (None, reason) when the record does not allow it.
    """
    rule = check.get("tolerance_rule") or ""
    ids = [check.get("target_cell_id"), *check.get("member_cell_ids", [])]
    parsed = [cells[i]["value_parsed"] for i in ids if i and i in cells and cells[i].get("value_parsed") is not None]
    if rule == SUM_RULE_TEXT:
        if not parsed or not check.get("member_cell_ids"):
            return None, "cells not in the release"
        unit = max(last_digit_unit(v) for v in parsed)
        return Decimal("0.5") * len(check["member_cell_ids"]) * unit, "0.5 x members x unit"
    if rule == EQUAL_RULE_TEXT:
        if len(parsed) < 2:
            return None, "cells not in the release"
        return max(last_digit_unit(v) for v in parsed), "1 unit of the last digit"
    for pattern in _STATED_BOUND:
        m = pattern.match(rule)
        if m:
            return Decimal(m.group(1)), "stated in the rule"
    return None, "rule does not state a bound"


def near_tolerance(checks: list[dict[str, Any]], cells: dict[str, dict[str, Any]],
                   observations: list[dict[str, Any]]) -> dict[str, Any]:
    """Checks that passed within rounding with a residual above 80% of what their rule allows."""
    obs_of_check: dict[str, str] = {}
    for o in sorted(observations, key=lambda o: o["obs_id"]):
        for cid in o.get("check_ids", []):
            obs_of_check.setdefault(cid, o["obs_id"])
    near: list[dict[str, Any]] = []
    unbounded: list[dict[str, Any]] = []
    by_type: dict[str, Counter] = defaultdict(Counter)
    for chk in checks:
        if chk["result"] != "pass_within_rounding" or chk.get("residual") is None:
            continue
        residual = abs(Decimal(chk["residual"]))
        bound, origin = tolerance_bound(chk, cells)
        target = cells.get(chk.get("target_cell_id") or "")
        row = {"check_id": chk["check_id"], "check_type": chk["check_type"], "dataset": chk.get("dataset"),
               "rule_id": chk.get("rule_id"), "residual": residual, "bound": bound, "bound_from": origin,
               "members": len(chk.get("member_cell_ids", [])),
               "where": f"{target['source_id']} p.{target['page']}" if target else ", ".join(chk.get("source_ids", [])),
               "obs_id": obs_of_check.get(chk["check_id"])}
        by_type[chk["check_type"]]["within_rounding"] += 1
        if bound is None or bound == 0:
            by_type[chk["check_type"]]["no_bound"] += 1
            unbounded.append(row)
            continue
        row["share"] = residual / bound
        if row["share"] > NEAR_TOLERANCE_SHARE:
            by_type[chk["check_type"]]["near"] += 1
            near.append(row)
    near.sort(key=lambda r: (-r["share"], r["check_type"], r["check_id"]))
    unbounded.sort(key=lambda r: (-r["residual"], r["check_id"]))
    return {"near": near, "unbounded": unbounded, "by_type": {k: dict(v) for k, v in sorted(by_type.items())}}


# ---------------------------------------------------------------- 4. normalisation flags behind published values

def flagged_published_cells(observations: list[dict[str, Any]], cells: dict[str, dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Cells behind published values whose `normalization_flags` list is not empty, grouped by flag."""
    out: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen: set[str] = set()
    for o in sorted(observations, key=lambda o: o["obs_id"]):
        if not o["published"]:
            continue
        for role, cid in [("primary", o.get("primary_cell_id")), *(("supporting", c) for c in o.get("supporting_cell_ids", []))]:
            cell = cells.get(cid or "")
            if cell is None or not cell.get("normalization_flags") or cid in seen:
                continue
            seen.add(cid)
            for flag in cell["normalization_flags"]:
                out[flag].append({"cell_id": cid, "role": role, "obs_id": o["obs_id"], "source_id": cell["source_id"],
                                  "page": cell["page"], "value_raw": cell["value_raw"], "value_parsed": cell["value_parsed"],
                                  "flags": list(cell["normalization_flags"])})
    return dict(sorted(out.items()))


# ---------------------------------------------------------------- writing

def _md(text: Any) -> str:
    return str(text).replace("|", "\\|").replace("\n", " ").strip()


def _num(value: Any) -> str:
    """A decimal with thousands separators; the digits are not changed."""
    d = Decimal(str(value))
    text = format(d, "f")
    sign = "-" if text.startswith("-") else ""
    whole, _, frac = text.lstrip("-").partition(".")
    return f"{sign}{int(whole):,}" + (f".{frac}" if frac else "")


def _pct(fraction: Decimal) -> str:
    return f"{(fraction * 100).quantize(Decimal('0.1')):+,}%"


def _table(header: list[str], rows: list[list[Any]], total: int | None = None, what: str = "rows",
           commas: bool = False) -> list[str]:
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(_md(f"{v:,}" if isinstance(v, int) and commas else v) for v in row) + " |" for row in rows]
    if total is not None and total > len(rows):
        lines += ["", f"Showing {len(rows)} of {total} {what}; {total - len(rows)} more are not shown."]
    return lines + [""]


def _change_rows(rows: list[dict[str, Any]]) -> list[list[Any]]:
    return [[f"`{r['earlier_obs']}`", _num(r["earlier_value"]), f"`{r['later_obs']}`", _num(r["later_value"]),
             _pct(r["change"]) if r["change"] is not None else "from zero", r["kind"],
             f"`{receipt_path(r['earlier_obs'])}` and `{receipt_path(r['later_obs'])}`"] for r in rows]


CHANGE_HEADER = ["Earlier figure", "Value", "Later figure", "Value", "Change", "Compared", "Receipts"]


def render(data: dict[str, Any]) -> str:
    """The whole report as Markdown. Deterministic: the same release gives the same text."""
    release = data["release"]
    series = {s["series_id"]: s for s in data["series"]}
    cells = {c["cell_id"]: c for c in data["cells"]}
    observations = data["observations"]
    changes = period_changes(observations, series)
    present = presence(data["cells"], series)
    near = near_tolerance(data["checks"], cells, observations)
    flagged = flagged_published_cells(observations, cells)
    disputed = sorted((o for o in observations if o["status"] == "disputed"), key=lambda o: o["obs_id"])

    out: list[str] = [
        f"# Sanity report for release {release['version']}", "",
        f"Release built {release['created_at']} from commit `{str(release.get('git_commit', ''))[:12]}`. "
        "Written by `python -m datalab sanity` from the files in the release folder only. No PDF was opened.", "",
        "**This is a report. It changes nothing.** No value, check result, tier or status was touched. An entry "
        "here is not a finding that a number is wrong: it is a place where a person should open the receipt and "
        "look at the page. A receipt path such as `/o/series~period~vintage` is the page of that figure on the site.", "",
    ]

    # 1
    out += ["## 1. Large changes and sign changes between periods", "",
            "For every published series, each published figure is compared with the published figure of the same "
            "series and the same kind (vintage) one period earlier: the year before for fiscal years; the month before "
            "and the same month a year before for months; the survey round before for survey rounds. A change of more "
            f"than {int(CHANGE_THRESHOLD * 100)}% of the earlier figure is listed, and so is every change of sign. "
            "Where the unit is percent, the figure is itself a rate or a share, so the change shown is the relative "
            "change of that rate, not a difference in percentage points.", "",
            f"Comparisons made: {changes['compared']:,}. Figures with no published figure one period earlier "
            f"(nothing to compare with): {changes['no_earlier_figure']:,}.", ""]
    out += ["### 1.1 Comparisons not made because a series break lies between the two periods", ""]
    if changes["skipped_at_breaks"]:
        out += ["Figures on the two sides of a marked break are not comparable, so they are not compared here.", ""]
        out += _table(["Data type", "Break at", "Kind of break", "Periods not compared", "Comparisons skipped", "Series"],
                      [[r["dataset"], r["at_period"], r["kind"], f"{r['earlier']} against {r['later']}", r["comparisons"], r["series"]]
                       for r in changes["skipped_at_breaks"]])
    else:
        out += ["None: no pair of consecutive published figures has a marked break between them.", ""]
    out += [f"### 1.2 Changes above {int(CHANGE_THRESHOLD * 100)}%", "",
            f"{len(changes['large']):,} in all, largest first within each data type and unit.", ""]
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for r in changes["large"]:
        groups[(r["dataset"], r["unit"])].append(r)
    for (dataset, unit), rows in sorted(groups.items()):
        out += [f"**{dataset}, unit {unit}** ({len(rows):,})", ""]
        out += _table(CHANGE_HEADER, _change_rows(rows[:MAX_ROWS]), len(rows), "changes")
    if not groups:
        out += ["None.", ""]
    out += ["### 1.3 Changes of sign", "", f"{len(changes['sign_changes']):,} in all.", ""]
    groups = defaultdict(list)
    for r in changes["sign_changes"]:
        groups[(r["dataset"], r["unit"])].append(r)
    for (dataset, unit), rows in sorted(groups.items()):
        out += [f"**{dataset}, unit {unit}** ({len(rows):,})", ""]
        out += _table(CHANGE_HEADER, _change_rows(rows[:MAX_ROWS]), len(rows), "changes of sign")
    out += ["### 1.4 Figures that follow a zero", "",
            "A percentage change from zero cannot be computed, so these are listed apart.", ""]
    if changes["from_zero"]:
        out += _table(CHANGE_HEADER, _change_rows(changes["from_zero"][:MAX_ROWS]), len(changes["from_zero"]), "figures")
    else:
        out += ["None.", ""]

    # 2
    out += ["## 2. Series that some documents print and others do not", "",
            "A document counts as printing a series when the release holds a cell from it that is mapped to that "
            "series and is not a blank marker. Only documents that print at least one series of the data type are "
            "counted. Derived series have no cells of their own and are left out. A series missing from a document "
            "can be a real change in what the publisher prints, a table that was not located, or a label that is "
            "not in the dictionary: this list does not say which.", ""]
    for dataset, p in present.items():
        n = len(p["documents"])
        out += [f"### {dataset}: {n} documents", "",
                f"Documents: {', '.join('`' + d + '`' for d in p['documents'])}.", "",
                f"Series printed in every one of them: {p['series_in_every_document']:,}. "
                f"Series absent from at least one: {p['series_absent_somewhere']:,}, in "
                f"{len(p['patterns']):,} different patterns.", ""]
        rows = []
        for r in p["patterns"][:MAX_ROWS]:
            if len(r["printed_in"]) <= len(r["absent_from"]):
                where = "printed only in " + ", ".join(r["printed_in"])
            else:
                where = "absent from " + ", ".join(r["absent_from"])
            examples = ", ".join(f"`{s}`" for s in r["series"][:3]) + (f" and {len(r['series']) - 3} more" if len(r["series"]) > 3 else "")
            rows.append([f"{len(r['printed_in'])} of {n}", where, len(r["series"]), examples])
        if rows:
            out += _table(["Printed in", "Which documents", "Series", "Examples"], rows, len(p["patterns"]), "patterns")

    # 3
    out += ["## 3. Checks that passed only just", "",
            "A check that passes \"within rounding\" has a residual that is not zero but is inside what its rule "
            f"allows. Listed here are those whose residual is above {int(NEAR_TOLERANCE_SHARE * 100)}% of that allowance. "
            "The allowance is recomputed from the check record: for a sum, half a unit of the last printed digit for "
            "each amount added; for the same figure printed twice, one unit of the last printed digit; for a rule "
            "that states its allowance as a number, that number.", ""]
    out += _table(["Check type", "Passed within rounding", f"Above {int(NEAR_TOLERANCE_SHARE * 100)}% of the allowance", "Allowance not recomputable"],
                  [[t, c.get("within_rounding", 0), c.get("near", 0), c.get("no_bound", 0)] for t, c in near["by_type"].items()])
    by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in near["near"]:
        by_type[r["check_type"]].append(r)
    for check_type, rows in sorted(by_type.items()):
        out += [f"### {check_type} ({len(rows):,})", ""]
        out += _table(["Check", "Rule", "Where", "Amounts", "Residual", "Allowed", "Share used", "Allowance from", "A receipt that shows it"],
                      [[f"`{r['check_id']}`", r["rule_id"], r["where"], r["members"], _num(r["residual"]), _num(r["bound"]),
                        f"{(r['share'] * 100).quantize(Decimal('0.1'))}%", r["bound_from"],
                        f"`{receipt_path(r['obs_id'])}`" if r["obs_id"] else "none"] for r in rows[:MAX_ROWS]], len(rows), "checks")
    out += ["### Passed within rounding, allowance not recomputable from the record", "",
            "Listed by the size of the residual, largest first.", ""]
    if near["unbounded"]:
        out += _table(["Check", "Type", "Rule", "Where", "Residual", "Why no allowance", "A receipt that shows it"],
                      [[f"`{r['check_id']}`", r["check_type"], r["rule_id"], r["where"], _num(r["residual"]), r["bound_from"],
                        f"`{receipt_path(r['obs_id'])}`" if r["obs_id"] else "none"] for r in near["unbounded"][:MAX_ROWS]],
                      len(near["unbounded"]), "checks")
    else:
        out += ["None.", ""]

    # 4
    out += ["## 4. Published figures whose printed text needed a normalisation rule", "",
            "Cells behind published values (the cell a value is taken from and the other printings that support it) "
            "whose `normalization_flags` list is not empty. A flag means the parser applied a rule to the printed "
            "text, for example reading a number in brackets as negative. The printed text is shown as printed.", ""]
    if not flagged:
        out += ["None.", ""]
    for flag, rows in flagged.items():
        out += [f"### {flag} (cells: {len(rows):,})", ""]
        out += _table(["Cell", "Document and page", "Printed text", "Parsed as", "Role", "Receipt"],
                      [[f"`{r['cell_id']}`", f"{r['source_id']} p.{r['page']}", f"`{r['value_raw'].strip()}`", r["value_parsed"], r["role"],
                        f"`{receipt_path(r['obs_id'])}`"] for r in rows[:MAX_ROWS]], len(rows), "cells")

    # 5
    out += ["## 5. Disputed figures", "",
            "Two official documents print different figures and each adds up in its own table. Neither is published. "
            f"{len(disputed):,} in all.", ""]
    if disputed:
        out += _table(["Figure", "Readings, earliest document first", "Receipt"],
                      [[f"`{o['obs_id']}`", "; ".join(f"{r['value_raw'].strip()} ({r['source_id']} p.{r['page']})" for r in o.get("disputed_readings", [])),
                        f"`{receipt_path(o['obs_id'])}`"] for o in disputed[:2 * MAX_ROWS]], len(disputed), "disputed figures")

    # 6
    out += ["## 6. Counts", ""]
    by_dataset: dict[str, Counter] = defaultdict(Counter)
    for o in observations:
        ds = series[o["series_id"]]["dataset"]
        by_dataset[ds]["observations"] += 1
        by_dataset[ds]["published" if o["published"] else f"gap: {o['gap_kind']}"] += 1
        if o["published"] and o.get("tier"):
            by_dataset[ds][f"tier {o['tier']}"] += 1
    columns = ["observations", "published", "tier A", "tier B", "gap: disputed", "gap: failed_checks", "gap: not_yet_verified", "gap: not_in_source"]
    extra = sorted({k for c in by_dataset.values() for k in c} - set(columns))
    out += _table(["Data type", *columns, *extra], [[ds, *(c.get(k, 0) for k in [*columns, *extra])] for ds, c in sorted(by_dataset.items())], commas=True)
    results = Counter(c["result"] for c in data["checks"])
    out += _table(["Check result", "Checks"], [[k, v] for k, v in sorted(results.items())], commas=True)
    out += _table(["In this report", "Count"], [
        ["Period comparisons made", changes["compared"]],
        ["Comparisons skipped at a series break", sum(r["comparisons"] for r in changes["skipped_at_breaks"])],
        [f"Changes above {int(CHANGE_THRESHOLD * 100)}%", len(changes["large"])],
        ["Changes of sign", len(changes["sign_changes"])],
        ["Figures that follow a zero", len(changes["from_zero"])],
        ["Series absent from at least one document", sum(p["series_absent_somewhere"] for p in present.values())],
        ["Checks passed within rounding", sum(c.get("within_rounding", 0) for c in near["by_type"].values())],
        [f"of which above {int(NEAR_TOLERANCE_SHARE * 100)}% of the allowance", len(near["near"])],
        ["of which with no recomputable allowance", len(near["unbounded"])],
        ["Cells behind published values with a normalisation flag", len({r["cell_id"] for rows in flagged.values() for r in rows})],
        ["Disputed figures", len(disputed)],
    ], commas=True)
    return "\n".join(out).rstrip("\n") + "\n"


def _default_out_dir() -> Path:
    return config.REPO_ROOT / "docs" / "reports"


def write_sanity_report(version: str = config.DEFAULT_RELEASE, release_dir: Path | None = None,
                        out_dir: Path | None = None) -> Path:
    """Write the report for one release and return its path. Reads the release; writes one Markdown file."""
    release_dir = Path(release_dir) if release_dir is not None else config.RELEASES_DIR / version
    data = load_release(release_dir)
    out_dir = Path(out_dir) if out_dir is not None else _default_out_dir()
    path = out_dir / f"sanity_{str(data['release']['created_at'])[:10]}.md"
    config.write_text(path, render(data))
    return path
