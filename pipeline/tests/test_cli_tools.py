"""Small command-line behaviours added with the E5/E6/E7 tools."""
from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from datalab import cli, config


def test_all_skips_a_source_that_failed_verification(monkeypatch, capsys):
    """`extract` stops the whole command on a failed source, so `all` must not hand it one (LFS 2014-15, AJK edition)."""
    from datalab import extract, sources, validate

    good = SimpleNamespace(source_id="lfs-good", doc_type="lfs_annual_report", verification_status="official_only")
    bad = SimpleNamespace(source_id="lfs-wrong-edition", doc_type="lfs_annual_report", verification_status="failed")
    extracted: list[str] = []
    monkeypatch.setattr(sources, "fetch", lambda: 0)
    monkeypatch.setattr(sources, "read_manifest", lambda: [bad, good])
    monkeypatch.setattr(extract, "extract", lambda source_id, **kw: extracted.append(source_id) or SimpleNamespace(run_id=f"run-of-{source_id}"))
    monkeypatch.setattr(validate, "validate_run", lambda run_id: SimpleNamespace(validated=True))
    monkeypatch.setattr(cli, "cmd_build", lambda a: 0)
    assert cli.main(["all", "--dataset", "lfs"]) == 0
    assert extracted == ["lfs-good"]
    assert "lfs-wrong-edition: skipped" in capsys.readouterr().out


def test_reproduce_script_is_plain_ascii_and_has_no_machine_paths():
    """Windows PowerShell 5.1 reads a script without a byte-order mark as ANSI, so it must be ASCII."""
    script = config.REPO_ROOT / "pipeline" / "scripts" / "reproduce.ps1"
    data = script.read_bytes()
    assert all(b < 128 for b in data)
    text = data.decode("ascii")
    assert "Users\\" not in text and "Users/" not in text
    for step in ("git", "requirements.lock", '"fetch"', '"all", "--dataset", "abs"', '"release", "--version"', '"diff-release"'):
        assert step in text, step
    assert isinstance(script, Path)
