"""Write docs/HOW_A_NUMBER_GETS_ON_THE_SITE.md from the release files.

The walk-through follows one real published figure from the PDF to the page. Every value quoted
in it is read from the release folder by this script and written into the document together with
the file and the field it came from. Nobody types a value: to change the document, change the
sentences in this script, or rebuild the release and run the script again.

Run from `pipeline/`:

    python scripts/gen_walkthrough.py
    python scripts/gen_walkthrough.py --obs <obs_id> --version <release version>

The figure must be a published observation of the Annual Budget Statement kind (one primary cell,
at least one check); the script stops with a message if the one asked for is not.
"""
from __future__ import annotations

import argparse
import csv
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datalab import config  # noqa: E402

DEFAULT_OBS = "fed.exp.current.function.health:2025-26:be"

VINTAGES = {"be": "budget estimate", "re": "revised estimate", "actual": "actual", "provisional": "provisional",
            "final": "final", "rebased": "rebased", "na": "no vintage (the publication prints one kind of figure only)"}
VERIFICATION = {
    "official_match_archive": "downloaded from the official address, and identical to the older archived copy we hold",
    "official_only": "downloaded from the official address; there is no archived copy to compare it with",
    "official_differs_from_archive": "downloaded from the official address; it differs from the older archived copy we hold, "
                                     "which means the publisher has reissued the file, and the official file is the one used",
    "wayback_match_archive": "taken from an Internet Archive snapshot because the official address failed; identical to the archived copy",
    "wayback_only": "taken from an Internet Archive snapshot because the official address failed",
    "archive_copy_content_inspected": "only the archived copy could be obtained",
}
RESULTS = {"pass": "passed exactly", "pass_within_rounding": "passed within rounding", "fail": "failed",
           "not_evaluable": "could not be run", "disputed": "disputed"}


def commas(value: str | int | Decimal) -> str:
    """Thousands separators for reading; the digits are not changed."""
    text = format(Decimal(str(value)), "f")
    sign = "-" if text.startswith("-") else ""
    whole, _, frac = text.lstrip("-").partition(".")
    return f"{sign}{int(whole):,}" + (f".{frac}" if frac else "")


def code(value: object) -> str:
    return "`" + str(value).replace("|", "\\|").replace("\n", " ") + "`"


def facts(rows: list[tuple[str, object, str, str]]) -> list[str]:
    """A table of facts: what, the value as read, the file in the release, the field."""
    out = ["| What | Value read by the script | File in the release | Field |", "|---|---|---|---|"]
    out += [f"| {what} | {code(value)} | `{file}` | `{field}` |" for what, value, file, field in rows]
    return out + [""]


def build(version: str, obs_id: str) -> str:
    rel_dir = config.RELEASES_DIR / version
    read = lambda name: config.read_json(rel_dir / name)  # noqa: E731
    release = read("release.json")
    obs = next((o for o in read("observations.json") if o["obs_id"] == obs_id), None)
    if obs is None or not obs["published"] or not obs["primary_cell_id"] or not obs["check_ids"]:
        raise SystemExit(f"{obs_id} is not a published observation with a primary cell and checks in {version}")
    cells = {c["cell_id"]: c for c in read("cells.json")}
    checks = {c["check_id"]: c for c in read("checks.json")}
    series = next(s for s in read("series.json") if s["series_id"] == obs["series_id"])
    sources = {s["source_id"]: s for s in read("sources.json")}
    cell = cells[obs["primary_cell_id"]]
    source = sources[cell["source_id"]]
    verification = source.get("verification") or {}
    run_file = f"runs/{cell['run_id']}.manifest.json"
    run = read(run_file)
    coverage = next((c for c in read("coverage.json") if c["source_id"] == cell["source_id"] and c["page"] == cell["page"]
                     and c.get("table_index") == cell["table_index"]), None)
    with (rel_dir / "observations.csv").open(encoding="utf-8", newline="") as fh:
        csv_row = next(r for r in csv.DictReader(fh) if r["obs_id"] == obs_id)
    gate = release["dataset_status"][series["dataset"]]
    render = f"pages/{cell['source_id']}/p{cell['page']:03d}.png"
    render_exists = (rel_dir / render).exists()
    rupees = Decimal(obs["value"]) * Decimal(obs["scale_factor"])
    scale_words = {1000000: "million", 1000: "thousand", 1000000000: "billion", 1: ""}.get(obs["scale_factor"], f"x {obs['scale_factor']}")
    vintage_words = VINTAGES.get(obs["vintage"], obs["vintage"])
    supporting = [cells[c] for c in obs["supporting_cell_ids"]]
    own_checks = [checks[c] for c in obs["check_ids"]]
    receipt = "/o/" + obs_id.replace(":", "~")
    obs_file, cell_file, src_file = "observations.json", "cells.json", "sources.json"
    title = source["title"]

    L: list[str] = []
    L += ["# How a number gets on the site", "",
          "This page follows one real figure from a government PDF to a page on the site, step by step. It is meant for "
          "someone new to the project. Terms in use here are explained in `docs/GLOSSARY.md`, and the rules behind each "
          "step are in `docs/METHODS.md`.", "",
          f"The figure is {code(obs_id)}: the {vintage_words} for {series['name']} in {obs['period']}, "
          f"taken from the {title}.", "",
          "**Where the values on this page come from.** Every value in a table below was read from the release folder "
          f"`releases/{version}/` by the script `pipeline/scripts/gen_walkthrough.py`, which also wrote this page. Each row "
          "names the file and the field. No value was typed by a person or by a language model. If the release is "
          "rebuilt, run the script again.", ""]
    L += facts([("Release", release["version"], "release.json", "version"),
                ("Built at", release["created_at"], "release.json", "created_at"),
                ("From commit", release["git_commit"], "release.json", "git_commit")])

    L += ["## The figure we are following", "",
          f"On the site this figure reads as Rs {commas(obs['value'])} {scale_words}, with the badge \"Checked\". "
          f"Its page is at `{receipt}` (the id with each colon replaced by `~`).", ""]
    L += facts([("Id of the figure", obs["obs_id"], obs_file, "obs_id"),
                ("What it measures", series["name"], "series.json", "name"),
                ("Year", obs["period"], obs_file, "period"),
                ("Kind of figure", f"{obs['vintage']} ({vintage_words})", obs_file, "vintage"),
                ("Value", obs["value"], obs_file, "value"),
                ("Unit", obs["unit"], obs_file, "unit"),
                ("Scale", obs["scale_factor"], obs_file, "scale_factor"),
                ("Value in rupees (value times scale, computed by the script)", commas(rupees), obs_file, "value, scale_factor")])
    L += ["An id has three parts: what is measured, the period, and the kind of figure. The same line for the same year can "
          "exist as a budget estimate and as a revised estimate, and they are different figures with different ids.", ""]

    L += ["## Step 1. Register: get the file and prove it is the right one", "",
          "Nothing is read from a document until the file itself has been recorded. A program downloads it from the "
          "publisher's own address, measures it, takes its SHA-256 fingerprint (a short code that changes if a single "
          "byte of the file changes) and checks that the words on its first pages are the ones this document should carry.", ""]
    L += facts([("Document", title, src_file, "title"),
                ("Publisher", source["publisher"], src_file, "publisher"),
                ("Official address of the file", source["file_url"], src_file, "file_url"),
                ("Page that links to it", source["landing_url"], src_file, "landing_url"),
                ("Obtained from", source["retrieved_via"], src_file, "retrieved_via"),
                ("Downloaded at", source["retrieved_at"], src_file, "retrieved_at"),
                ("Size in bytes", source["size_bytes"], src_file, "size_bytes"),
                ("Pages", source["page_count"], src_file, "page_count"),
                ("SHA-256 fingerprint", source["sha256"], src_file, "sha256"),
                ("Verification result", source["verification_status"], src_file, "verification_status"),
                ("How the document was identified", verification.get("identity_route"), src_file, "verification.identity_route"),
                ("The official page links to this exact file", verification.get("landing_page_links_file"), src_file, "verification.landing_page_links_file"),
                ("Internet Archive snapshot", source.get("wayback_url"), src_file, "wayback_url"),
                ("Note on the source", source.get("notes") or "(none)", src_file, "notes")])
    meaning = VERIFICATION.get(source["verification_status"])
    if meaning:
        L += [f"The verification result `{source['verification_status']}` means: {meaning}. A file whose result is `failed` "
              "is never used.", ""]

    profile = run.get("profile") or {}
    L += ["## Step 2. Profile: what kind of PDF is it", "",
          "Before extraction, a program looks at every page: does it carry real text or only an image of text, and are the "
          "tables drawn with ruled lines? A document in which more than a fifth of the pages are images goes to a separate "
          "track and is not processed here.", ""]
    inspection = verification.get("inspection") or {}
    blank = inspection.get("blank_pages") or []
    L += facts([("Track", profile.get("track"), run_file, "profile.track"),
                ("Share of pages with no text, as stored with the run", profile.get("scanned_page_fraction"), run_file, "profile.scanned_page_fraction"),
                ("Table style", profile.get("table_style_hint"), run_file, "profile.table_style_hint"),
                ("Pages with a text layer", inspection.get("pages_with_text_layer"), src_file, "verification.inspection.pages_with_text_layer"),
                ("Blank pages (nothing printed on them)", blank or "(none)", src_file, "verification.inspection.blank_pages"),
                ("Pages that are images", inspection.get("pages_without_text_layer") or "(none)", src_file, "verification.inspection.pages_without_text_layer")])
    L += ["A page with no text is either blank or an image, and only image pages are a problem for reading numbers.", ""]
    stored = profile.get("scanned_page_fraction")
    if blank and profile.get("page_count") and stored is not None and round(len(blank) / profile["page_count"], 4) == stored:
        L += [f"The share stored with this run equals the {len(blank)} blank pages divided by the {profile['page_count']} pages of "
              "the file (computed by the script from the two fields above): this run was profiled before blank pages were "
              "counted apart from image pages. Either way the document is far below the limit.", ""]

    config_used = run.get("config") or {}
    L += ["## Step 3. Extract: a table-reading tool reads the whole document", "",
          "The tool is Docling. It reads the whole document in one go, because cutting a document into pieces breaks "
          "tables that run over several pages. Every run gets an id and is never overwritten. The tool's version and "
          "settings are stored with the run, so the same run can be repeated later.", ""]
    L += facts([("Run id", run["run_id"], run_file, "run_id"),
                ("Tool and version", f"{cell['extractor_name']} {cell['extractor_version']}", cell_file, "extractor_name, extractor_version"),
                ("How the document was run", run["run_mode"], run_file, "run_mode"),
                ("Table mode", config_used.get("table_mode"), run_file, "config.table_mode"),
                ("Optical character recognition used", config_used.get("do_ocr"), run_file, "config.do_ocr"),
                ("Fingerprint of the settings", run["config_sha256"], run_file, "config_sha256"),
                ("Started", run["started_at"], run_file, "started_at"),
                ("Finished", run["finished_at"], run_file, "finished_at"),
                ("Pages the tool returned", run["pages_emitted"], run_file, "pages_emitted"),
                ("Tables the tool returned", run["tables_emitted"], run_file, "tables_emitted"),
                ("Errors logged", (run.get("errors") or {}).get("count"), run_file, "errors.count")])

    L += ["## Step 4. Validate: the run is checked before anything is taken from it", "",
          "The extraction step never declares its own run good. A separate validator does, and only when the file's "
          "fingerprint is still the registered one, every page is accounted for exactly once and the error log is empty.", ""]
    L += facts([("Run marked valid by the validator", run["validated"], run_file, "validated"),
                ("File fingerprint when the run was made", run["sha256_at_run"], run_file, "sha256_at_run"),
                ("Same as the registered fingerprint (compared by the script)", run["sha256_at_run"] == source["sha256"], f"{run_file}, {src_file}", "sha256_at_run, sha256"),
                ("Pages returned equal pages in the file (compared by the script)", run["pages_emitted"] == source["page_count"], f"{run_file}, {src_file}", "pages_emitted, page_count")])

    L += ["## Step 5. Find the cell: one printed number in one place", "",
          "The tool's output is a set of tables. A program locates the table we want by the words printed in it, never by "
          "a page number, and turns each of its numbers into a cell: a record of one printed number, with its page, its "
          "position in the table, the exact printed text and a box around it. Boxes are fractions of the page, from the "
          "top-left corner, as left, top, right, bottom.", ""]
    L += facts([("Cell id", cell["cell_id"], cell_file, "cell_id"),
                ("Page (the first page is 1)", cell["page"], cell_file, "page"),
                ("Table on that page (the first is 0)", cell["table_index"], cell_file, "table_index"),
                ("Row and column in the table", f"{cell['row_index']}, {cell['col_index']}", cell_file, "row_index, col_index"),
                ("Row label as printed", cell["row_label_raw"], cell_file, "row_label_raw"),
                ("Column heading", cell["col_label_raw"], cell_file, "col_label_raw"),
                ("Text printed in the cell", cell["value_raw"], cell_file, "value_raw"),
                ("Box around the number", cell["cell_bbox_norm"], cell_file, "cell_bbox_norm"),
                ("Image of the page in the release", render, cell_file, "source_id, page"),
                ("That image file exists (checked by the script)", render_exists, "(the folder itself)", render),
                ("Fingerprint of the page image", cell["page_render_sha256"], cell_file, "page_render_sha256"),
                ("Flags on the table's structure", cell["structural_flags"] or "(none)", cell_file, "structural_flags")])
    if coverage:
        L += ["**Coverage** is a separate question from correctness: how much of the printed table did the tool capture? A "
              "program counts the numbers in the PDF's text inside the table's area and compares them with the numbers the "
              "tool returned for that table.", ""]
        L += facts([("Table", coverage.get("table"), "coverage.json", "table"),
                    ("Numbers printed in the table's area", coverage.get("printed_numeric_tokens"), "coverage.json", "printed_numeric_tokens"),
                    ("Of those, found in the tool's output", coverage.get("matched"), "coverage.json", "matched"),
                    ("Coverage", coverage.get("coverage"), "coverage.json", "coverage")])

    L += ["## Step 6. Normalise: printed text becomes a number, by fixed rules", "",
          "The printed text is kept exactly as printed. Next to it, a fixed set of rules produces the parsed value: commas "
          "are thousands separators, a number in brackets is negative, a dash means no figure, and a cell that holds two "
          "numbers is treated as a reading error. A flag is recorded whenever a rule had to do more than remove commas.", ""]
    L += facts([("Printed text", cell["value_raw"], cell_file, "value_raw"),
                ("Parsed value", cell["value_parsed"], cell_file, "value_parsed"),
                ("Normalisation flags", cell["normalization_flags"] or "(none)", cell_file, "normalization_flags"),
                ("Read as a blank marker", cell["is_missing"], cell_file, "is_missing"),
                ("Unit", cell["unit"], cell_file, "unit"),
                ("Scale stated by the table", cell["scale_factor"], cell_file, "scale_factor")])

    L += ["## Step 7. Map: say what the number measures", "",
          "The row label is looked up in a dictionary of known labels. That gives the series (what is measured). The "
          "column heading gives the year and the kind of figure. A label that is not in the dictionary stays unmapped, "
          "and an unmapped cell can never become a published value.", ""]
    L += facts([("Series", cell["series_id"], cell_file, "series_id"),
                ("How it was mapped", cell["mapping_method"], cell_file, "mapping_method"),
                ("Year", cell["period"], cell_file, "period"),
                ("Kind of figure", cell["vintage"], cell_file, "vintage"),
                ("Name of the series", series["name"], "series.json", "name"),
                ("Definition", series["definition"], "series.json", "definition"),
                ("State of the definition", series["definition_status"], "series.json", "definition_status"),
                ("Parent series", series.get("parent_id"), "series.json", "parent_id")])
    for b in series.get("breaks") or []:
        L += facts([("Series break at", b["at_period"], "series.json", "breaks[].at_period"),
                    ("Kind of break", b["kind"], "series.json", "breaks[].kind"),
                    ("Note on the break", b["note"], "series.json", "breaks[].note")])

    L += ["## Step 8. Check: arithmetic decides whether the number can be trusted", "",
          f"This figure took part in {len(own_checks)} checks. Each one is plain arithmetic over printed numbers, and each "
          "is stored with its result. The sentence in the last column is the description stored with the check; it is "
          "quoted as stored.", ""]
    L += ["| Check | Kind | Rule | Result | Expected | Found | Difference | Numbers added or compared | Documents | Stored description |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for chk in own_checks:
        L.append(f"| {code(chk['check_id'])} | {chk['check_type']} | {code(chk['rule_id'])} | {chk['result']} ({RESULTS.get(chk['result'], '')}) | "
                 f"{code(chk['expected'])} | {code(chk['observed'])} | {code(chk['residual'])} | {len(chk['member_cell_ids'])} | "
                 f"{', '.join(chk['source_ids'])} | {str(chk['description']).replace('|', '/')} |")
    L += ["", "Every row above is read from `checks.json` (fields `check_id`, `check_type`, `rule_id`, `result`, `expected`, "
          "`observed`, `residual`, `member_cell_ids`, `source_ids`, `description`); the list of checks for this figure is "
          "`check_ids` in `observations.json`.", ""]
    tolerance_rules = sorted({chk["tolerance_rule"] for chk in own_checks})
    L += ["The rules these checks were held to, as stored in `checks.json`, field `tolerance_rule`:", ""]
    L += [f"- {rule}" for rule in tolerance_rules] + [""]
    if supporting:
        L += ["The same figure is printed in other places. Each is a cell of its own, with its own page and box. They are "
              "listed in `observations.json`, field `supporting_cell_ids`.", ""]
        L += ["| Cell | Document | Page | Row label as printed | Column heading | Printed text | Parsed value |", "|---|---|---|---|---|---|---|"]
        for c in supporting:
            L.append(f"| {code(c['cell_id'])} | {sources[c['source_id']]['title']} | {c['page']} | {code(c['row_label_raw'])} | "
                     f"{code(c['col_label_raw'])} | {code(c['value_raw'])} | {code(c['value_parsed'])} |")
        L += ["", "Read from `cells.json` (fields `cell_id`, `source_id`, `page`, `row_label_raw`, `col_label_raw`, `value_raw`, "
              "`value_parsed`) and `sources.json` (field `title`).", ""]

    L += ["## Step 9. Status: a program works out what may be shown", "",
          "Status is computed from the stored check results. Nobody sets it by hand, and no language model takes part. "
          "Tier A means an arithmetic check passed and a second official printing agrees. Tier B means one of those two. "
          "Both are shown as \"Checked\". Anything else is shown as a labelled gap with no value.", ""]
    L += facts([("Tier", obs["tier"], obs_file, "tier"),
                ("Status", obs["status"], obs_file, "status"),
                ("Published", obs["published"], obs_file, "published"),
                ("Kind of gap", obs["gap_kind"] or "(none: the value is published)", obs_file, "gap_kind"),
                ("Sentence shown on the receipt", obs["evidence_summary"], obs_file, "evidence_summary")])
    L += ["A figure is published only if its whole data type also clears thresholds that were fixed before any result "
          "was seen (`thresholds/thresholds.yaml`; its fingerprint is stored in the release). Coverage and check results "
          "are kept as separate numbers.", ""]
    L += facts([("Data type", gate["name"], "release.json", f"dataset_status.{series['dataset']}.name"),
                ("Coverage of the data type", gate["coverage"]["coverage"], "release.json", f"dataset_status.{series['dataset']}.coverage.coverage"),
                ("Checks that could be run", gate["check_pass_rate"]["evaluable"], "release.json", f"dataset_status.{series['dataset']}.check_pass_rate.evaluable"),
                ("Share of those that passed", gate["check_pass_rate"]["pass_rate"], "release.json", f"dataset_status.{series['dataset']}.check_pass_rate.pass_rate"),
                ("Cross-edition agreement", gate["cross_edition_agreement"]["pass_rate"], "release.json", f"dataset_status.{series['dataset']}.cross_edition_agreement.pass_rate"),
                ("Meets every threshold", gate["meets_thresholds"], "release.json", f"dataset_status.{series['dataset']}.meets_thresholds"),
                ("Fingerprint of the thresholds file", release["thresholds_sha256"], "release.json", "thresholds_sha256")])

    L += ["## Step 10. Publish: the figure goes into a frozen release", "",
          "A release is a folder of files that is never changed silently once it is public. The site and the downloads "
          "are built from that folder and from nothing else. In the CSV download the figure is one row.", ""]
    L += facts([("Value", csv_row["value"], "observations.csv", "value"),
                ("Value as printed", csv_row["value_as_printed"], "observations.csv", "value_as_printed"),
                ("Status", csv_row["status"], "observations.csv", "status"),
                ("Document", csv_row["source_title"], "observations.csv", "source_title"),
                ("Page", csv_row["page"], "observations.csv", "page"),
                ("Fingerprint of the document", csv_row["source_sha256"], "observations.csv", "source_sha256"),
                ("Release", csv_row["release"], "observations.csv", "release"),
                ("First published in", obs["first_published_release"], obs_file, "first_published_release")])
    L += ["`python -m datalab check-release` repeats the arithmetic of every check from the release's own cells and "
          "confirms that every status follows from the stored evidence. It needs no PDF and runs on every change to "
          "the code.", ""]

    L += ["## Step 11. The page", "",
          f"The site builds one page per figure. For this one the path is `{receipt}`. At the time of writing the page "
          "shows the value, the status badge, the sentence from `evidence_summary`, the image of the page with the box "
          "from `cell_bbox_norm` drawn on it, the checks, and links to the official file (`file_url`) and to the Internet "
          "Archive snapshot (`wayback_url`). A reader can open the official PDF, go to the page given above and see the "
          "same number in the same place.", "",
          "## What did not happen", "",
          "- No language model read the PDF, wrote the value, corrected it or decided its status. Language models were "
          "used to write the software.",
          "- Nobody typed the value. It was read by the extraction tool, parsed by fixed rules and checked by arithmetic.",
          "- The error rate has not been measured yet. Checks show that numbers agree with each other; only the "
          "hand-labelled gold set can say how often a published number is wrong, and it has not been labelled.", ""]
    return "\n".join(L).rstrip("\n") + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--obs", default=DEFAULT_OBS)
    parser.add_argument("--version", default=config.DEFAULT_RELEASE)
    args = parser.parse_args()
    out = config.REPO_ROOT / "docs" / "HOW_A_NUMBER_GETS_ON_THE_SITE.md"
    config.write_text(out, build(args.version, args.obs))
    print(f"wrote {out.relative_to(config.REPO_ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
