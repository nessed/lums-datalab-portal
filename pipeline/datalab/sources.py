"""Register, verify and fetch source files (plan section 6.1).

`register` downloads each file in `sources/plan.yaml` from its official URL
(falling back to the Wayback Machine, then to the read-only archive copy),
inspects its content by code, and writes `sources/manifest.csv` plus one
verification record per file.

`fetch` rebuilds SOURCES_DIR on any machine from the manifest alone and
verifies every hash.
"""
from __future__ import annotations

import csv
import re
import shutil
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

import yaml

from . import config
from .schema import Source

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0 Safari/537.36"
)
MANIFEST_FIELDS = list(Source.model_fields.keys())


def _session():
    import requests

    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Accept": "application/pdf,*/*"})
    return s


def _encode(url: str) -> str:
    return quote(url, safe=":/?&=%#+~")


def download(url: str, dest: Path, attempts_log: list[dict[str, Any]], timeout: int = 60, retries: int = 3,
             pause: float = 2.0) -> dict[str, Any] | None:
    """Download `url` to `dest`. Returns response info, or None if every retry failed."""
    session = _session()
    for attempt in range(1, retries + 1):
        entry: dict[str, Any] = {"url": url, "time": config.now_iso(), "attempt": attempt}
        try:
            r = session.get(_encode(url), timeout=timeout, stream=True)
            entry["http_status"] = r.status_code
            if r.status_code == 200:
                dest.parent.mkdir(parents=True, exist_ok=True)
                tmp = dest.with_suffix(dest.suffix + ".part")
                with tmp.open("wb") as fh:
                    for chunk in r.iter_content(1 << 16):
                        fh.write(chunk)
                head = tmp.read_bytes()[:5]
                if dest.suffix.lower() == ".pdf" and not head.startswith(b"%PDF"):
                    entry["outcome"] = "not_a_pdf"
                    tmp.unlink()
                    attempts_log.append(entry)
                    return None
                tmp.replace(dest)
                entry["outcome"] = "ok"
                attempts_log.append(entry)
                time.sleep(pause)
                return {
                    "http_status": 200,
                    "final_url": r.url,
                    "headers": {k: r.headers.get(k) for k in ("Last-Modified", "Content-Length", "Content-Type", "ETag")},
                }
            entry["outcome"] = f"http_{r.status_code}"
        except Exception as exc:  # network errors are recorded, not raised
            entry["outcome"] = f"error:{type(exc).__name__}"
        attempts_log.append(entry)
        time.sleep(pause * attempt)
    return None


def sha1_base32(path: Path) -> str:
    """The digest format the Wayback CDX index uses for a capture's content."""
    import base64
    import hashlib

    h = hashlib.sha1()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return base64.b32encode(h.digest()).decode("ascii")


def wayback_lookup(url: str, attempts_log: list[dict[str, Any]], local_file: Path | None = None) -> dict[str, Any] | None:
    """A Wayback snapshot of `url` from the CDX index, or None.

    If `local_file` is given, a snapshot whose content digest equals the
    file's is preferred: that proves the archived bytes are the bytes we used.
    (The simpler "availability" API often answers with nothing for PDFs.)
    """
    session = _session()
    api = "http://web.archive.org/cdx/search/cdx"
    entry: dict[str, Any] = {"url": f"{api}?url={url}", "time": config.now_iso(), "purpose": "wayback_cdx_lookup"}
    try:
        r = session.get(api, params={"url": url.split("://", 1)[-1], "output": "json", "filter": "statuscode:200",
                                     "fl": "timestamp,original,digest,length", "limit": "-40"}, timeout=60)
        rows = r.json()[1:] if r.status_code == 200 and r.text.strip() else []
    except Exception as exc:
        entry["outcome"] = f"error:{type(exc).__name__}"
        attempts_log.append(entry)
        return None
    if not rows:
        entry["outcome"] = "no_snapshot"
        attempts_log.append(entry)
        return None
    digest = sha1_base32(local_file) if local_file is not None and local_file.exists() else None
    matching = [row for row in rows if digest and row[2] == digest]
    timestamp, original, snap_digest, _length = (matching or rows)[-1]
    entry["outcome"] = "snapshot_found"
    attempts_log.append(entry)
    time.sleep(1.0)
    return {
        "wayback_url": f"https://web.archive.org/web/{timestamp}/{original}", "wayback_timestamp": timestamp,
        "snapshots_seen": len(rows), "snapshot_digest": snap_digest,
        "digest_matches_file": (snap_digest == digest) if digest else None,
    }


def wayback_raw_url(snapshot: dict[str, str], url: str) -> str:
    """The `id_` form returns the original bytes, without the Wayback toolbar."""
    return f"https://web.archive.org/web/{snapshot['wayback_timestamp']}id_/{url}"


def inspect_pdf(path: Path, markers_all: list[str], markers_any: list[str], period_markers: list[str],
                marker_pages: int = 3) -> dict[str, Any]:
    """Content inspection by code: page count, metadata, text layer, expected markers."""
    import pymupdf
    from pypdf import PdfReader

    out: dict[str, Any] = {}
    reader = PdfReader(str(path))
    out["page_count"] = len(reader.pages)
    meta = reader.metadata or {}
    out["pdf_metadata"] = {k: str(meta.get(f"/{k}")) for k in ("Title", "Producer", "Creator", "CreationDate") if meta.get(f"/{k}")}
    doc = pymupdf.open(path)
    with_text = 0
    blank: list[int] = []
    image_only: list[int] = []
    for number, page in enumerate(doc, start=1):
        if len(page.get_text().strip()) >= 20:
            with_text += 1
            continue
        # A page with no text is either blank (nothing printed) or an image (a scan or a picture cover).
        samples = page.get_pixmap(dpi=36, colorspace=pymupdf.csGRAY).samples
        white = sum(1 for value in samples if value > 245) / max(len(samples), 1)
        if white > 0.995 and not page.get_images():
            blank.append(number)
        else:
            image_only.append(number)
    printed_pages = len(doc) - len(blank)
    out["pages_with_text_layer"] = with_text
    out["blank_pages"] = blank
    out["pages_without_text_layer"] = image_only
    # Blank pages have nothing that could carry a text layer, so they are left out of the fraction.
    out["text_layer_fraction"] = round(with_text / max(printed_pages, 1), 4)
    first = " ".join(doc[i].get_text() for i in range(min(marker_pages, len(doc))))
    first_norm = re.sub(r"\s+", " ", first).lower()
    ascii_chars = sum(1 for ch in first if ord(ch) < 128)
    out["ascii_ratio_first_pages"] = round(ascii_chars / max(len(first), 1), 4)
    out["markers"] = {
        "all": {m: (m.lower() in first_norm) for m in markers_all},
        "any": {m: (m.lower() in first_norm) for m in markers_any},
        "period": {m: (m.lower() in first_norm) for m in period_markers},
    }
    ok_all = all(out["markers"]["all"].values())
    ok_any = any(out["markers"]["any"].values()) if markers_any else True
    ok_period = any(out["markers"]["period"].values()) if period_markers else True
    out["markers_ok"] = bool(ok_all and ok_any and ok_period)
    doc.close()
    return out


def period_marker_variants(period: str) -> list[str]:
    """`2010-11` may be printed as 2010-11, 2010-2011 or 2010–11."""
    m = re.fullmatch(r"(\d{4})-(\d{2})", period)
    if not m:
        return [period]
    a, b = m.groups()
    full = a[:2] + b if int(b) > int(a[2:]) or b != "00" else str(int(a[:2]) + 1) + b
    return [f"{a}-{b}", f"{a}-{full}", f"{a} - {b}", f"{a}–{b}", f"{a}—{b}", f"{a} – {b}"]


def load_plan() -> list[dict[str, Any]]:
    plan = yaml.safe_load((config.SOURCES_REPO_DIR / "plan.yaml").read_text(encoding="utf-8"))
    defaults = plan.get("defaults", {})
    out = []
    for entry in plan["sources"]:
        family = entry.get("family") or entry["source_id"].split("-")[0]
        merged = {**defaults.get(family, {}), **entry}
        out.append(merged)
    return out


def read_manifest() -> list[Source]:
    if not config.MANIFEST_CSV.exists():
        return []
    rows = []
    with config.MANIFEST_CSV.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            clean: dict[str, Any] = {}
            for k, v in row.items():
                if v == "":
                    clean[k] = None
                elif k in ("size_bytes", "page_count"):
                    clean[k] = int(v)
                elif k == "is_born_digital":
                    clean[k] = v.lower() == "true"
                else:
                    clean[k] = v
            clean["notes"] = clean.get("notes") or ""
            rows.append(Source(**clean))
    return rows


def write_manifest(rows: list[Source]) -> None:
    config.MANIFEST_CSV.parent.mkdir(parents=True, exist_ok=True)
    rows = sorted(rows, key=lambda s: s.source_id)
    with config.MANIFEST_CSV.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=MANIFEST_FIELDS, lineterminator="\n")
        w.writeheader()
        for s in rows:
            d = s.model_dump()
            w.writerow({k: ("" if d[k] is None else d[k]) for k in MANIFEST_FIELDS})


def get_source(source_id: str) -> Source:
    for s in read_manifest():
        if s.source_id == source_id:
            return s
    raise KeyError(source_id)


def source_path(source: Source) -> Path:
    return config.sources_dir() / source.local_path


def register_one(entry: dict[str, Any], save_to_wayback: bool = True) -> Source | None:
    """Fetch, inspect and record one planned source. Returns None on a hard failure."""
    sid = entry["source_id"]
    file_url = entry.get("file_url")
    attempts: list[dict[str, Any]] = []
    record: dict[str, Any] = {"source_id": sid, "registered_at": config.now_iso(), "file_url": file_url,
                              "landing_url": entry.get("landing_url")}
    filename = entry.get("filename") or (file_url.rsplit("/", 1)[-1] if file_url else Path(entry["archive_path"]).name)
    rel = f"{entry['doc_type']}/{entry['period']}/{filename}"
    dest = config.sources_dir() / rel
    retrieved_via = None
    snapshot = None
    response = None

    if entry.get("prefetched") and dest.exists():
        # Downloaded earlier by a collection step that recorded how; keep its record.
        retrieved_via = entry["prefetched"]["retrieved_via"]
        response = {"headers": entry["prefetched"].get("response_headers"), "http_status": entry["prefetched"].get("http_status")}
        attempts = list(entry["prefetched"].get("attempts") or [])
        if entry["prefetched"].get("wayback_url"):
            snapshot = {"wayback_url": entry["prefetched"]["wayback_url"],
                        "wayback_timestamp": entry["prefetched"].get("wayback_timestamp") or ""}
        record["retrieved_at"] = entry["prefetched"].get("retrieved_at")
    elif file_url:
        response = download(file_url, dest, attempts)
        if response:
            retrieved_via = "official"
            record["retrieved_at"] = config.now_iso()
        else:
            snapshot = wayback_lookup(file_url, attempts)
            if snapshot and download(wayback_raw_url(snapshot, file_url), dest, attempts, timeout=120):
                retrieved_via = "wayback"
                record["retrieved_at"] = config.now_iso()

    archive_file = None
    if entry.get("archive_path") and config.ra_ship_dir():
        candidate = config.ra_ship_dir() / entry["archive_path"]
        if candidate.exists():
            archive_file = candidate
    if retrieved_via is None and archive_file is not None:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(archive_file, dest)  # read from the archive, written to SOURCES_DIR
        retrieved_via = "ra-ship-archive"
        record["retrieved_at"] = config.now_iso()
    if retrieved_via is None:
        record.update({"verification_status": "failed", "reason": "no copy obtainable", "attempts": attempts})
        config.write_json(config.VERIFICATION_DIR / f"{sid}.json", record)
        return None

    sha = config.sha256_file(dest)
    record.update({"retrieved_via": retrieved_via, "sha256": sha, "size_bytes": dest.stat().st_size,
                   "response": response, "attempts": attempts, "local_path": rel})
    if archive_file is not None:
        archive_sha = config.sha256_file(archive_file)
        record["archive_copy"] = {"path_in_ra_ship": entry["archive_path"], "sha256": archive_sha,
                                  "size_bytes": archive_file.stat().st_size, "identical": archive_sha == sha}
    for other in entry.get("other_archive_paths") or []:
        p = config.ra_ship_dir() / other if config.ra_ship_dir() else None
        if p and p.exists():
            record.setdefault("other_archive_copies", []).append(
                {"path_in_ra_ship": other, "sha256": config.sha256_file(p), "size_bytes": p.stat().st_size,
                 "identical": config.sha256_file(p) == sha})

    period_markers = period_marker_variants(entry["period"]) if entry.get("marker_period") else list(entry.get("markers_period") or [])
    inspection = inspect_pdf(dest, list(entry.get("markers_all") or []), list(entry.get("markers_any") or []), period_markers,
                             marker_pages=int(entry.get("marker_pages", 3)))
    if entry.get("prefetched", {}).get("sha256") and entry["prefetched"]["sha256"] != sha:
        record["prefetched_hash_mismatch"] = True
    record["inspection"] = inspection
    thresholds = yaml.safe_load(config.THRESHOLDS_YAML.read_text(encoding="utf-8"))
    min_text = thresholds["structure"]["min_text_layer_page_fraction"]
    record["text_layer_ok"] = inspection["text_layer_fraction"] >= min_text

    # Independent evidence that the official landing page for this period links to this exact file.
    record["landing_page_links_file"] = landing_links_file(entry.get("landing_url"), file_url, attempts)
    identity_ok = inspection["markers_ok"]
    record["identity_route"] = "cover_markers" if identity_ok else None
    if not identity_ok and entry.get("alt_markers_all"):
        # Some editions have no text on the cover (missing or an image). They are accepted only if
        # the contents-page markers and the period are present AND the official landing page for
        # that period links to this exact file. Recorded as a caveat (DECISIONS.md, 2026-10-11).
        alt = inspect_pdf(dest, list(entry["alt_markers_all"]), [], period_markers)
        record["alt_inspection_markers"] = alt["markers"]
        if alt["markers_ok"] and record["landing_page_links_file"] is True:
            identity_ok = True
            record["identity_route"] = "contents_markers_plus_official_landing_link"
    # Words that must NOT appear in the first pages (e.g. a regional edition filed under the national name).
    excluded = [m for m in (entry.get("markers_none") or [])
                if inspect_pdf(dest, [m], [], [], marker_pages=int(entry.get("marker_pages", 3)))["markers_ok"]]
    record["excluded_markers_found"] = excluded
    if excluded:
        status = "failed"
        record["reason"] = f"the first pages contain {excluded}: this is not the document the plan describes"
    elif not identity_ok:
        status = "failed"
        record["reason"] = "expected text markers not found in the first pages"
    elif retrieved_via == "official":
        if archive_file is None:
            status = "official_only"
        else:
            status = "official_match_archive" if record["archive_copy"]["identical"] else "official_differs_from_archive"
    elif retrieved_via == "wayback":
        status = "wayback_match_archive" if (archive_file is not None and record["archive_copy"]["identical"]) else "wayback_only"
    else:
        status = "archive_copy_content_inspected"
    record["verification_status"] = status

    # Best-effort Wayback record: an existing snapshot is looked up; a save is requested once.
    if file_url and (snapshot is None or snapshot.get("digest_matches_file") is None):
        snapshot = wayback_lookup(file_url, attempts, dest) or snapshot
    if save_to_wayback and file_url and retrieved_via == "official" and snapshot is None:
        record["wayback_save"] = wayback_save(file_url)
        snapshot = wayback_lookup(file_url, attempts, dest)
    record["wayback"] = snapshot
    record["attempts"] = attempts

    config.write_json(config.VERIFICATION_DIR / f"{sid}.json", record)
    notes = entry.get("notes", "")
    if record.get("identity_route") == "contents_markers_plus_official_landing_link":
        notes = (notes + " The cover page carries no text, so the title could not be read by code; the file is identified by "
                 "its contents page, the fiscal year in its tables and the link from the official budget page for that year.").strip()
    if not record["text_layer_ok"]:
        notes = (notes + f" Text layer on {inspection['pages_with_text_layer']} of "
                 f"{inspection['page_count'] - len(inspection['blank_pages'])} printed pages, below the 95% inspection level: "
                 f"page(s) {', '.join(str(n) for n in inspection['pages_without_text_layer'])} have no text layer (images). "
                 "Used under a recorded deviation; every page that values are taken from has a text layer.").strip()
    if status == "official_differs_from_archive":
        notes = (notes + " reissued_or_differs: official download differs from the archive copy.").strip()
    return Source(
        source_id=sid, doc_type=entry["doc_type"], publisher=entry["publisher"], jurisdiction=entry["jurisdiction"],
        title=entry["title"], period=entry["period"], role=entry["role"], landing_url=entry.get("landing_url"),
        file_url=file_url, wayback_url=(snapshot or {}).get("wayback_url"),
        wayback_timestamp=(snapshot or {}).get("wayback_timestamp"), retrieved_at=record.get("retrieved_at"),
        retrieved_via=retrieved_via, sha256=sha, size_bytes=dest.stat().st_size, format=dest.suffix.lstrip(".").lower(),
        page_count=inspection["page_count"], is_born_digital=inspection["text_layer_fraction"] >= 0.8,
        language=entry.get("language", "en"), local_path=rel, verification_status=status,
        verification_record=f"sources/verification/{sid}.json", notes=notes,
    )


def landing_links_file(landing_url: str | None, file_url: str | None, attempts_log: list[dict[str, Any]]) -> bool | None:
    """True if the landing page's HTML contains a link to the file. None if it could not be tested."""
    if not landing_url or not file_url:
        return None
    from urllib.parse import unquote

    entry: dict[str, Any] = {"url": landing_url, "time": config.now_iso(), "purpose": "landing_page_link_check"}
    try:
        r = _session().get(landing_url, timeout=60, headers={"Accept": "text/html,*/*"})
        entry["http_status"] = r.status_code
        if r.status_code != 200:
            entry["outcome"] = f"http_{r.status_code}"
            attempts_log.append(entry)
            return None
        hrefs = [unquote(h).replace("\\", "/").lower() for h in re.findall(r"""href\s*=\s*["']([^"']+)["']""", r.text, flags=re.I)]
        path = unquote(file_url.split("://", 1)[-1].split("/", 1)[-1]).lower()
        found = any(h.lstrip("./").endswith(path) or path.endswith(h.lstrip("./")) and len(h) > 8 for h in hrefs)
        entry["outcome"] = "link_found" if found else "link_not_found"
        attempts_log.append(entry)
        time.sleep(1.0)
        return found
    except Exception as exc:
        entry["outcome"] = f"error:{type(exc).__name__}"
        attempts_log.append(entry)
        return None


def wayback_save(url: str) -> dict[str, Any]:
    session = _session()
    out: dict[str, Any] = {"requested_at": config.now_iso(), "url": f"https://web.archive.org/save/{url}"}
    try:
        r = session.get(f"https://web.archive.org/save/{_encode(url)}", timeout=90)
        out["http_status"] = r.status_code
        out["content_location"] = r.headers.get("Content-Location") or r.url
    except Exception as exc:
        out["error"] = type(exc).__name__
    return out


def register(only: list[str] | None = None, save_to_wayback: bool = True) -> list[Source]:
    existing = {s.source_id: s for s in read_manifest()}
    for entry in load_plan():
        sid = entry["source_id"]
        if only and sid not in only:
            continue
        if not only and sid in existing and existing[sid].verification_status != "failed":
            print(f"[register] {sid}: already registered ({existing[sid].verification_status})")
            continue
        source = register_one(entry, save_to_wayback=save_to_wayback)
        if source is None:
            print(f"[register] {sid}: FAILED, see sources/verification/{sid}.json")
            continue
        existing[sid] = source
        write_manifest(list(existing.values()))
        print(f"[register] {sid}: {source.verification_status} pages={source.page_count} via={source.retrieved_via}")
    return list(existing.values())


def fetch() -> int:
    """Rebuild SOURCES_DIR from the manifest and verify every hash. Returns the number of problems."""
    problems = 0
    for s in read_manifest():
        dest = source_path(s)
        if dest.exists() and config.sha256_file(dest) == s.sha256:
            print(f"[fetch] {s.source_id}: present, hash ok")
            continue
        attempts: list[dict[str, Any]] = []
        got = False
        urls = []
        if s.file_url:
            urls.append(s.file_url)
        if s.wayback_timestamp and s.file_url:
            urls.append(wayback_raw_url({"wayback_timestamp": s.wayback_timestamp}, s.file_url))
        for url in urls:
            if download(url, dest, attempts, timeout=120) and config.sha256_file(dest) == s.sha256:
                got = True
                break
        if not got and config.ra_ship_dir():
            record = config.read_json(config.REPO_ROOT / s.verification_record)
            archive = (record.get("archive_copy") or {}).get("path_in_ra_ship")
            if archive and (config.ra_ship_dir() / archive).exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(config.ra_ship_dir() / archive, dest)
                got = config.sha256_file(dest) == s.sha256
        if got:
            print(f"[fetch] {s.source_id}: downloaded, hash ok")
        else:
            problems += 1
            print(f"[fetch] {s.source_id}: PROBLEM - could not obtain a copy with sha256 {s.sha256}")
    return problems
