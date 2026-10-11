"""Source-change check (plan item E7): `datalab watch --dry-run`.

For every manifest row with an official file URL: one HEAD request. If the
server's Content-Length equals the size in the manifest, the file is taken as
unchanged. If the length differs, or the server gives none, the file is
downloaded once to a temporary folder, hashed, compared with the manifest's
SHA-256 and deleted.

It runs once and exits. It is not a monitor: nothing here loops, sleeps until
later, schedules itself or keeps a process alive (CLAUDE.md: no scheduled jobs
from a session). It never writes to SOURCES_DIR, the manifest or the repo.

Politeness: at least `MIN_INTERVAL_S` seconds between two requests to the same
host, a User-Agent that says who is asking and why, timeouts on every request,
and no retries (at most one HEAD and one GET per file).
"""
from __future__ import annotations

import hashlib
import shutil
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Protocol
from urllib.parse import quote, urlsplit

from .schema import Source

USER_AGENT = ("LUMS-DataLab-Portal-source-check/0.1 (research project, LUMS Department of Economics; checks once whether "
              "an official statistical PDF has changed; +https://github.com/nessed/lums-datalab-portal)")
MIN_INTERVAL_S = 2.0
HEAD_TIMEOUT = (10, 30)            # seconds: connect, read
GET_TIMEOUT = (10, 120)
MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024
# Servers that refuse HEAD but may still serve the file: one GET is tried instead.
HEAD_NOT_ALLOWED = frozenset({403, 405, 501})

UNCHANGED, CHANGED, UNREACHABLE, NO_URL = "unchanged", "changed", "unreachable", "no official url"


@dataclass
class Response:
    """What one request told us. `error` is set when no HTTP answer arrived."""

    status: int | None = None
    content_length: int | None = None
    last_modified: str | None = None
    error: str | None = None


class Transport(Protocol):
    def head(self, url: str) -> Response: ...

    def download(self, url: str, dest: Path) -> Response: ...


def _length(value: Any) -> int | None:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


class RequestsTransport:
    """The real network. One session, the descriptive User-Agent, timeouts, no retries."""

    def __init__(self) -> None:
        import requests

        self._session = requests.Session()
        # `identity`: a compressed transfer would report the compressed length, not the file's.
        self._session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/pdf,*/*", "Accept-Encoding": "identity"})

    @staticmethod
    def _encode(url: str) -> str:
        return quote(url, safe=":/?&=%#+~,")

    def head(self, url: str) -> Response:
        try:
            r = self._session.head(self._encode(url), timeout=HEAD_TIMEOUT, allow_redirects=True)
        except Exception as exc:  # recorded, never retried
            return Response(error=type(exc).__name__)
        return Response(status=r.status_code, content_length=_length(r.headers.get("Content-Length")),
                        last_modified=r.headers.get("Last-Modified"))

    def download(self, url: str, dest: Path) -> Response:
        try:
            with self._session.get(self._encode(url), timeout=GET_TIMEOUT, stream=True, allow_redirects=True) as r:
                out = Response(status=r.status_code, content_length=_length(r.headers.get("Content-Length")),
                               last_modified=r.headers.get("Last-Modified"))
                if r.status_code != 200:
                    return out
                written = 0
                with dest.open("wb") as fh:
                    for chunk in r.iter_content(1 << 16):
                        written += len(chunk)
                        if written > MAX_DOWNLOAD_BYTES:
                            out.error = "TooLarge"
                            return out
                        fh.write(chunk)
                return out
        except Exception as exc:
            return Response(error=type(exc).__name__)


class PoliteClock:
    """Keeps at least `min_interval` seconds between two requests to the same host."""

    def __init__(self, min_interval: float = MIN_INTERVAL_S, now: Callable[[], float] | None = None,
                 sleep: Callable[[float], None] | None = None) -> None:
        self.min_interval = min_interval
        self._now = now or time.monotonic
        self._sleep = sleep or (lambda seconds: time.sleep(seconds))
        self._last: dict[str, float] = {}

    @staticmethod
    def host(url: str) -> str:
        host = (urlsplit(url).hostname or "").lower()
        return host[4:] if host.startswith("www.") else host

    def wait(self, url: str) -> None:
        host = self.host(url)
        if host in self._last:
            remaining = self.min_interval - (self._now() - self._last[host])
            if remaining > 0:
                self._sleep(remaining)
        self._last[host] = self._now()


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _row(source: Source, status: str, how: str, head: Response | None = None, note: str = "") -> dict[str, Any]:
    return {"source_id": source.source_id, "status": status, "how": how, "http": head.status if head else None,
            "last_modified": head.last_modified if head else None, "server_length": head.content_length if head else None,
            "manifest_size": source.size_bytes, "note": note}


def _compare_download(source: Source, transport: Transport, clock: PoliteClock, tmp_dir: Path, head: Response) -> dict[str, Any]:
    """Download once to the temporary folder, hash, compare, delete."""
    dest = tmp_dir / f"{source.source_id}.download"
    clock.wait(source.file_url)
    try:
        got = transport.download(source.file_url, dest)
        shown = Response(status=got.status if got.status is not None else head.status,
                         content_length=got.content_length if got.content_length is not None else head.content_length,
                         last_modified=got.last_modified or head.last_modified)
        if got.error or got.status != 200 or not dest.exists():
            return _row(source, UNREACHABLE, "download failed", shown, got.error or f"HTTP {got.status} on download")
        if source.format == "pdf":
            with dest.open("rb") as fh:
                if not fh.read(5).startswith(b"%PDF"):
                    return _row(source, UNREACHABLE, "download is not a PDF", shown,
                                "the server answered 200 but the body is not a PDF (an error page, most likely)")
        digest = _sha256(dest)
        size = dest.stat().st_size
        if digest == source.sha256:
            return _row(source, UNCHANGED, "hash compared", shown, "same SHA-256 as the manifest")
        return _row(source, CHANGED, "hash compared", shown,
                    f"downloaded {size:,} bytes, sha256 {digest[:12]}; the manifest has {source.sha256[:12]}")
    finally:
        dest.unlink(missing_ok=True)


def check_source(source: Source, transport: Transport, clock: PoliteClock, tmp_dir: Path) -> dict[str, Any]:
    """One manifest row: at most one HEAD and one GET."""
    if not source.file_url:
        return _row(source, NO_URL, "not requested", note=f"no official file URL in the manifest (obtained via {source.retrieved_via})")
    if source.format != "pdf":
        # A data-service download is a form submission, not a file address (see sources.fetch).
        return _row(source, NO_URL, "not requested", note="the recorded address is a data-service form, not a file that can be requested by URL")
    clock.wait(source.file_url)
    head = transport.head(source.file_url)
    if head.error:
        return _row(source, UNREACHABLE, "HEAD failed", head, head.error)
    if head.status in HEAD_NOT_ALLOWED:
        row = _compare_download(source, transport, clock, tmp_dir, head)
        row["note"] = f"HEAD answered {head.status}, so one GET was tried. " + row["note"]
        return row
    if head.status != 200:
        return _row(source, UNREACHABLE, "HEAD", head, f"HTTP {head.status}")
    if head.content_length is not None and head.content_length == source.size_bytes:
        return _row(source, UNCHANGED, "same length (HEAD)", head)
    row = _compare_download(source, transport, clock, tmp_dir, head)
    reason = "the server gave no length" if head.content_length is None else \
        f"length {head.content_length:,} differs from the manifest's {source.size_bytes:,}"
    row["note"] = f"{reason}. " + row["note"]
    return row


def watch_once(sources: list[Source], transport: Transport | None = None, clock: PoliteClock | None = None,
               save_to_wayback: bool = False, wayback_save: Callable[[str], dict[str, Any]] | None = None,
               tmp_root: Path | None = None) -> list[dict[str, Any]]:
    """Check every source once and return one row per source. Leaves nothing behind."""
    transport = transport or RequestsTransport()
    clock = clock or PoliteClock()
    tmp_dir = Path(tempfile.mkdtemp(prefix="datalab-watch-", dir=tmp_root))
    rows: list[dict[str, Any]] = []
    try:
        for source in sorted(sources, key=lambda s: s.source_id):
            row = check_source(source, transport, clock, tmp_dir)
            if row["status"] == CHANGED and save_to_wayback:
                if wayback_save is None:
                    from . import sources as sources_module

                    wayback_save = sources_module.wayback_save
                saved = wayback_save(source.file_url)
                row["note"] += f" Wayback save requested: {saved.get('http_status') or saved.get('error')}."
            rows.append(row)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
    return rows


def format_table(rows: list[dict[str, Any]]) -> str:
    """The table printed at the end, as Markdown so it can be pasted into a note."""
    header = ["Source", "HTTP", "Result", "Decided by", "Last-Modified", "Server length", "Manifest size", "Note"]
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    for r in rows:
        cells = [r["source_id"], r["http"] if r["http"] is not None else "", r["status"], r["how"], r["last_modified"] or "",
                 f"{r['server_length']:,}" if r["server_length"] is not None else "",
                 f"{r['manifest_size']:,}" if r["manifest_size"] is not None else "", r["note"]]
        lines.append("| " + " | ".join(str(c).replace("|", "/") for c in cells) + " |")
    counts = {s: sum(1 for r in rows if r["status"] == s) for s in (UNCHANGED, CHANGED, UNREACHABLE, NO_URL)}
    lines += ["", "Summary: " + ", ".join(f"{n} {s}" for s, n in counts.items()) + f" ({len(rows)} manifest rows)."]
    return "\n".join(lines)
