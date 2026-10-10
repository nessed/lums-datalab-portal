"""Command line: `python -m datalab <command>`.

Every command is idempotent except `extract`, which always creates a new run.
"""
from __future__ import annotations

import argparse
import importlib
import sys

from . import config

DATASETS = ("abs", "cpi", "lfs")


def _sources_for(dataset: str | None, only: list[str] | None):
    from .sources import read_manifest

    doc_types = {"abs": ("abs",), "cpi": ("cpi_monthly_review",), "lfs": ("lfs_annual_report",)}
    rows = read_manifest()
    if only:
        return [s for s in rows if s.source_id in only]
    if dataset:
        return [s for s in rows if s.doc_type in doc_types[dataset]]
    return rows


def _builder(dataset: str):
    return importlib.import_module(f"datalab.datasets.{dataset}")


def cmd_register(a) -> int:
    from .sources import register

    register(only=a.source or None, save_to_wayback=not a.no_wayback_save)
    return 0


def cmd_fetch(a) -> int:
    from .sources import fetch

    return 1 if fetch() else 0


def cmd_verify(a) -> int:
    """Re-hash every registered file and compare with the manifest."""
    from .sources import read_manifest, source_path

    bad = 0
    for s in read_manifest():
        p = source_path(s)
        ok = p.exists() and config.sha256_file(p) == s.sha256
        bad += 0 if ok else 1
        print(f"[verify] {s.source_id}: {'ok' if ok else 'MISSING OR CHANGED'} ({s.verification_status})")
    return 1 if bad else 0


def cmd_profile(a) -> int:
    from .extract import profile_pdf
    from .sources import source_path

    for s in _sources_for(a.dataset, a.source):
        print(s.source_id, profile_pdf(source_path(s)))
    return 0


def cmd_extract(a) -> int:
    from .extract import extract

    page_range = tuple(int(x) for x in a.pages.split("-")) if a.pages else None
    for s in _sources_for(a.dataset, a.source):
        extract(s.source_id, page_range=page_range)
    return 0


def cmd_validate(a) -> int:
    from .extract import latest_run, runs_dir
    from .validate import validate_run

    if a.run:
        run_ids = a.run
    else:
        run_ids = []
        for s in _sources_for(a.dataset, a.source):
            run = latest_run(s.source_id, validated_only=False)
            if run:
                run_ids.append(run.run_id)
    bad = 0
    for run_id in run_ids:
        if not (runs_dir() / run_id / "manifest.json").exists():
            print(f"[validate] {run_id}: no such run")
            bad += 1
            continue
        bad += 0 if validate_run(run_id).validated else 1
    return 1 if bad else 0


def cmd_build(a) -> int:
    """normalise + locate + map + check + status for one dataset (they share one pass over the tables)."""
    for dataset in ([a.dataset] if a.dataset else DATASETS):
        try:
            module = _builder(dataset)
        except ModuleNotFoundError:
            print(f"[build] {dataset}: no builder yet")
            continue
        info = module.build()
        print(f"[build] {dataset}: located={len(info.get('located', {}))} not_located={len(info.get('not_located', {}))} "
              f"checks={info.get('check_pass_rates', {}).get('all')}")
    return 0


def cmd_release(a) -> int:
    from .release import build_release

    build_release(a.version, only=a.dataset or None)
    return 0


def cmd_check_release(a) -> int:
    from .release import check_release

    problems = check_release(config.REPO_ROOT / a.path if not a.path.startswith("/") else a.path)
    for p in problems:
        print(f"[check-release] PROBLEM: {p}")
    print(f"[check-release] {'FAILED' if problems else 'ok'}: {a.path}")
    return 1 if problems else 0


def cmd_export_schema(a) -> int:
    from .schema import export_json_schema

    for p in export_json_schema(config.SCHEMA_DIR):
        print(f"[schema] wrote {p.relative_to(config.REPO_ROOT)}")
    return 0


def cmd_gold_sample(a) -> int:
    from .gold import gold_sample

    gold_sample(a.version, a.n, a.seed)
    return 0


def cmd_gold_score(a) -> int:
    from pathlib import Path

    from .gold import gold_score

    gold_score([Path(f) for f in a.labels], a.version)
    return 0


def cmd_sanity(a) -> int:
    """Report only: reads a release folder, writes one Markdown file, changes nothing else."""
    from .sanity import write_sanity_report

    path = write_sanity_report(a.version)
    print(f"[sanity] wrote {(path.relative_to(config.REPO_ROOT) if path.is_relative_to(config.REPO_ROOT) else path).as_posix()}")
    return 0


def cmd_watch(a) -> int:
    """One pass over the manifest, then exit. Never scheduled, never a loop."""
    if not a.dry_run:
        print("[watch] only --dry-run exists: it prints a table and writes nothing. Run `datalab watch --dry-run`.")
        return 2
    from . import sources, watch

    rows = sources.read_manifest()
    if a.source:
        rows = [s for s in rows if s.source_id in a.source]
    print(f"[watch] dry run over {len(rows)} manifest rows; at least {watch.MIN_INTERVAL_S:g} s between requests to one host")
    result = watch.watch_once(rows, save_to_wayback=a.save_to_wayback)
    print(watch.format_table(result))
    return 0


def _release_path(text: str):
    """A release folder given as a path, a path relative to the repo, or a version name under releases/."""
    from pathlib import Path

    for candidate in (Path(text), config.REPO_ROOT / text, config.RELEASES_DIR / text):
        if (candidate / "release.json").exists():
            return candidate
    raise SystemExit(f"[diff-release] no release.json found for '{text}'")


def cmd_diff_release(a) -> int:
    from .diff_release import diff_releases, format_diff

    result = diff_releases(_release_path(a.a), _release_path(a.b))
    print(format_diff(result))
    return 0 if result["same"] else 1


def cmd_all(a) -> int:
    """fetch -> extract (new runs) -> validate -> build for one dataset."""
    from .extract import extract, latest_run
    from .sources import fetch
    from .validate import validate_run

    if fetch():
        return 1
    for s in _sources_for(a.dataset, None):
        if s.verification_status == "failed":
            # A file that failed verification is never used; `extract` would stop the whole command on it.
            print(f"[all] {s.source_id}: skipped, source verification failed")
            continue
        if a.reuse_runs and latest_run(s.source_id, validated_only=True):
            continue
        validate_run(extract(s.source_id).run_id)
    a.dataset = a.dataset
    return cmd_build(a)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="datalab", description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)

    def add(name, fn, help_):
        sp = sub.add_parser(name, help=help_)
        sp.set_defaults(fn=fn)
        return sp

    sp = add("register", cmd_register, "download, inspect and record the files in sources/plan.yaml")
    sp.add_argument("--source", action="append")
    sp.add_argument("--no-wayback-save", action="store_true")
    add("fetch", cmd_fetch, "rebuild SOURCES_DIR from sources/manifest.csv and verify hashes")
    add("verify", cmd_verify, "re-hash registered files against the manifest")
    for name, fn, help_ in (("profile", cmd_profile, "born-digital vs scanned, ruled vs borderless"),
                            ("extract", cmd_extract, "run Docling (always a new run)"),
                            ("validate", cmd_validate, "validate the newest run per source")):
        sp = add(name, fn, help_)
        sp.add_argument("--dataset", choices=DATASETS)
        sp.add_argument("--source", action="append")
        if name == "extract":
            sp.add_argument("--pages", help="page range A-B (decision D18; long reports only)")
        if name == "validate":
            sp.add_argument("--run", action="append")
    for name in ("build", "normalise", "locate", "map", "check", "status", "coverage"):
        sp = add(name, cmd_build, "normalise, locate, map, check and assign status (one pass)")
        sp.add_argument("--dataset", choices=DATASETS)
    for name in ("release", "render"):
        sp = add(name, cmd_release, "write the frozen release folder (includes page renders)")
        sp.add_argument("--version", default=config.DEFAULT_RELEASE)
        sp.add_argument("--dataset", action="append", choices=DATASETS, help="limit the release to these data types (repeatable)")
    sp = add("check-release", cmd_check_release, "re-run checks over a release and test self-consistency (no PDFs needed)")
    sp.add_argument("path")
    add("export-schema", cmd_export_schema, "write JSON Schema files to schema/")
    sp = add("gold-sample", cmd_gold_sample, "draw the blind gold-set sample for human labelling")
    sp.add_argument("--n", type=int, default=400)
    sp.add_argument("--seed", type=int, default=20261011)
    sp.add_argument("--version", default=config.DEFAULT_RELEASE)
    sp = add("gold-score", cmd_gold_score, "compare finished human labels with the release (error rate)")
    sp.add_argument("labels", nargs="+")
    sp.add_argument("--version", default=config.DEFAULT_RELEASE)
    sp = add("sanity", cmd_sanity, "write docs/reports/sanity_<release date>.md from a release folder (report only)")
    sp.add_argument("--version", default=config.DEFAULT_RELEASE)
    sp = add("watch", cmd_watch, "check once whether the official files changed (HEAD, then hash); prints a table and exits")
    sp.add_argument("--dry-run", action="store_true", help="required: print the table, write nothing")
    sp.add_argument("--save-to-wayback", action="store_true", help="ask the Wayback Machine to save a file that changed (default: off)")
    sp.add_argument("--source", action="append", help="limit to these source ids (repeatable)")
    sp = add("diff-release", cmd_diff_release, "semantic diff of two release folders; exit code 1 if the data differ")
    sp.add_argument("a")
    sp.add_argument("b")
    sp = add("all", cmd_all, "fetch, extract, validate and build one dataset")
    sp.add_argument("--dataset", choices=DATASETS, required=True)
    sp.add_argument("--reuse-runs", action="store_true", help="skip extraction where a validated run exists")

    a = p.parse_args(argv)
    return int(a.fn(a) or 0)


if __name__ == "__main__":
    sys.exit(main())
