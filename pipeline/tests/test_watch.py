"""`datalab watch --dry-run` (E7). A local fake transport stands in for the network: no test makes a request."""
from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from datalab import watch
from datalab.schema import Source

PDF_BYTES = b"%PDF-1.7 the registered file"
NEW_BYTES = b"%PDF-1.7 a reissued file with other content"


def source(source_id: str, url: str | None = "https://www.example.gov.pk/a.pdf", *, content: bytes = PDF_BYTES,
           fmt: str = "pdf", via: str = "official") -> Source:
    return Source(source_id=source_id, doc_type="abs", publisher="p", jurisdiction="federal", title=source_id, period="2025-26",
                  role="core", file_url=url, retrieved_via=via, sha256=hashlib.sha256(content).hexdigest(),
                  size_bytes=len(content), format=fmt, local_path=f"abs/{source_id}.{fmt}", verification_status="official_only",
                  verification_record=f"sources/verification/{source_id}.json")


class FakeTransport:
    """Answers from a dictionary: url -> {"head": Response, "body": bytes | None, "get_status": int}."""

    def __init__(self, table: dict[str, dict]) -> None:
        self.table = table
        self.calls: list[tuple[str, str]] = []
        self.download_folders: set[Path] = set()

    def head(self, url: str) -> watch.Response:
        self.calls.append(("HEAD", url))
        return self.table[url]["head"]

    def download(self, url: str, dest: Path) -> watch.Response:
        self.calls.append(("GET", url))
        self.download_folders.add(dest.parent)
        entry = self.table[url]
        if entry.get("get_error"):
            return watch.Response(error=entry["get_error"])
        status = entry.get("get_status", 200)
        if status == 200:
            dest.write_bytes(entry["body"])
        return watch.Response(status=status, content_length=len(entry.get("body") or b""))


class FakeTime:
    def __init__(self) -> None:
        self.t = 100.0
        self.sleeps: list[float] = []

    def now(self) -> float:
        return self.t

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.t += seconds


def run(sources, table, tmp_path, **kwargs):
    transport, clock_time = FakeTransport(table), FakeTime()
    clock = watch.PoliteClock(now=clock_time.now, sleep=clock_time.sleep)
    rows = watch.watch_once(sources, transport=transport, clock=clock, tmp_root=tmp_path, **kwargs)
    return {r["source_id"]: r for r in rows}, transport, clock_time


def ok(length: int | None, last_modified: str = "Mon, 01 Jun 2026 10:00:00 GMT") -> watch.Response:
    return watch.Response(status=200, content_length=length, last_modified=last_modified)


def test_same_length_is_unchanged_without_a_download(tmp_path):
    s = source("same")
    rows, transport, _ = run([s], {s.file_url: {"head": ok(len(PDF_BYTES))}}, tmp_path)
    assert rows["same"]["status"] == "unchanged" and rows["same"]["how"] == "same length (HEAD)"
    assert rows["same"]["last_modified"] == "Mon, 01 Jun 2026 10:00:00 GMT"
    assert transport.calls == [("HEAD", s.file_url)]


def test_different_length_downloads_and_reports_changed(tmp_path):
    s = source("reissued")
    rows, transport, _ = run([s], {s.file_url: {"head": ok(len(NEW_BYTES)), "body": NEW_BYTES}}, tmp_path)
    assert rows["reissued"]["status"] == "changed" and rows["reissued"]["how"] == "hash compared"
    assert hashlib.sha256(NEW_BYTES).hexdigest()[:12] in rows["reissued"]["note"]
    assert transport.calls == [("HEAD", s.file_url), ("GET", s.file_url)]


def test_no_length_downloads_and_same_hash_is_unchanged(tmp_path):
    s = source("nolength")
    rows, transport, _ = run([s], {s.file_url: {"head": ok(None), "body": PDF_BYTES}}, tmp_path)
    assert rows["nolength"]["status"] == "unchanged" and rows["nolength"]["how"] == "hash compared"
    assert "no length" in rows["nolength"]["note"]


def test_wrong_length_header_but_same_bytes_is_unchanged(tmp_path):
    s = source("lying-header")
    rows, _, _ = run([s], {s.file_url: {"head": ok(5), "body": PDF_BYTES}}, tmp_path)
    assert rows["lying-header"]["status"] == "unchanged"


@pytest.mark.parametrize("head", [watch.Response(status=404), watch.Response(status=500), watch.Response(error="ConnectTimeout")])
def test_unreachable_is_reported_and_never_retried(tmp_path, head):
    s = source("gone")
    rows, transport, _ = run([s], {s.file_url: {"head": head}}, tmp_path)
    assert rows["gone"]["status"] == "unreachable"
    assert transport.calls == [("HEAD", s.file_url)]              # one request, no retry, no download


def test_head_refused_falls_back_to_one_get(tmp_path):
    s = source("nohead")
    rows, transport, _ = run([s], {s.file_url: {"head": watch.Response(status=405), "body": PDF_BYTES}}, tmp_path)
    assert rows["nohead"]["status"] == "unchanged" and "HEAD answered 405" in rows["nohead"]["note"]
    assert transport.calls == [("HEAD", s.file_url), ("GET", s.file_url)]


def test_failed_download_is_unreachable_not_changed(tmp_path):
    a, b = source("get-503", "https://a.example/a.pdf"), source("get-error", "https://b.example/b.pdf")
    rows, _, _ = run([a, b], {a.file_url: {"head": ok(1), "get_status": 503},
                              b.file_url: {"head": ok(1), "get_error": "ReadTimeout"}}, tmp_path)
    assert rows["get-503"]["status"] == "unreachable" and rows["get-error"]["status"] == "unreachable"


def test_an_error_page_served_with_200_is_not_called_changed(tmp_path):
    s = source("soft404")
    rows, _, _ = run([s], {s.file_url: {"head": ok(None), "body": b"<html>Page not found</html>"}}, tmp_path)
    assert rows["soft404"]["status"] == "unreachable" and "not a PDF" in rows["soft404"]["note"]


def test_rows_without_an_official_file_url_are_not_requested(tmp_path):
    archive = source("archive-only", None, via="ra-ship-archive")
    form = source("data-form", "https://data.example/apex/form.accept", fmt="csv")
    rows, transport, _ = run([archive, form], {}, tmp_path)
    assert rows["archive-only"]["status"] == "no official url" and rows["data-form"]["status"] == "no official url"
    assert transport.calls == []


def test_at_least_two_seconds_between_requests_to_one_host_and_none_across_hosts(tmp_path):
    a1, a2 = source("a1", "https://www.finance.example/1.pdf"), source("a2", "http://finance.example/2.pdf")
    b1 = source("b1", "https://pbs.example/1.pdf")
    table = {a1.file_url: {"head": ok(None), "body": PDF_BYTES}, a2.file_url: {"head": ok(len(PDF_BYTES))},
             b1.file_url: {"head": ok(len(PDF_BYTES))}}
    _, transport, t = run([a1, a2, b1], table, tmp_path)
    # a1: HEAD, then GET (2 s wait); a2 is the same host with or without www (2 s wait); b1 is another host (no wait)
    assert [c[0] for c in transport.calls] == ["HEAD", "GET", "HEAD", "HEAD"]
    assert t.sleeps == [2.0, 2.0]


def test_polite_clock_waits_only_for_the_time_still_owed():
    t = FakeTime()
    clock = watch.PoliteClock(now=t.now, sleep=t.sleep)
    clock.wait("https://x.example/a")
    t.t += 1.5                                  # 1.5 s of work happened in between
    clock.wait("https://x.example/b")
    t.t += 5
    clock.wait("https://x.example/c")           # more than 2 s already passed
    assert t.sleeps == [0.5]


def test_temporary_download_is_deleted_and_nothing_else_is_written(tmp_path, monkeypatch):
    sources_dir = tmp_path / "SOURCES"
    sources_dir.mkdir()
    (sources_dir / "keep.pdf").write_bytes(PDF_BYTES)
    monkeypatch.setenv("SOURCES_DIR", str(sources_dir))
    scratch = tmp_path / "scratch"
    scratch.mkdir()
    s = source("reissued")
    rows, transport, _ = run([s], {s.file_url: {"head": ok(None), "body": NEW_BYTES}}, scratch)
    assert rows["reissued"]["status"] == "changed"
    assert list(scratch.iterdir()) == []                                  # the temporary folder and file are gone
    assert all(scratch in folder.parents for folder in transport.download_folders)
    assert [p.name for p in sources_dir.iterdir()] == ["keep.pdf"] and (sources_dir / "keep.pdf").read_bytes() == PDF_BYTES


def test_wayback_save_is_off_by_default_and_only_for_changed_files(tmp_path):
    changed, same = source("changed", "https://a.example/c.pdf"), source("same", "https://a.example/s.pdf")
    table = {changed.file_url: {"head": ok(None), "body": NEW_BYTES}, same.file_url: {"head": ok(len(PDF_BYTES))}}
    saved: list[str] = []

    def fake_save(url: str) -> dict:
        saved.append(url)
        return {"http_status": 200}

    run([changed, same], table, tmp_path, wayback_save=fake_save)
    assert saved == []                                                    # default: off
    rows, _, _ = run([changed, same], table, tmp_path, save_to_wayback=True, wayback_save=fake_save)
    assert saved == [changed.file_url] and "Wayback save requested: 200" in rows["changed"]["note"]


def test_user_agent_says_who_is_asking():
    assert "DataLab" in watch.USER_AGENT and "Mozilla" not in watch.USER_AGENT and "http" in watch.USER_AGENT
    assert watch.MIN_INTERVAL_S >= 2.0


def test_table_has_one_line_per_source_and_a_summary(tmp_path):
    a, b = source("a-same"), source("b-none", None)
    rows, _, _ = run([a, b], {a.file_url: {"head": ok(len(PDF_BYTES))}}, tmp_path)
    text = watch.format_table(list(rows.values()))
    assert "| a-same | 200 | unchanged |" in text and "| b-none |  | no official url |" in text
    assert "Summary: 1 unchanged, 0 changed, 0 unreachable, 1 no official url (2 manifest rows)." in text


def test_cli_dry_run_exits_zero_even_when_a_file_changed_and_writes_nothing(tmp_path, monkeypatch, capsys):
    from datalab import cli, config
    from datalab import sources as sources_module

    s = source("reissued")
    manifest_before = config.MANIFEST_CSV.read_bytes()
    monkeypatch.setattr(sources_module, "read_manifest", lambda: [s])
    monkeypatch.setattr(watch, "RequestsTransport", lambda: FakeTransport({s.file_url: {"head": ok(None), "body": NEW_BYTES}}))
    monkeypatch.setattr(watch.time, "sleep", lambda seconds: None)
    assert cli.main(["watch", "--dry-run"]) == 0
    out = capsys.readouterr().out
    assert "| reissued | 200 | changed |" in out
    assert config.MANIFEST_CSV.read_bytes() == manifest_before


def test_cli_refuses_to_run_without_dry_run(capsys):
    from datalab import cli

    assert cli.main(["watch"]) == 2
    assert "--dry-run" in capsys.readouterr().out
