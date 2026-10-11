"""Locations and small IO helpers. Paths come from `.env`; nothing is hard-coded."""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_env() -> None:
    env_file = REPO_ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env()


def _path_from_env(name: str, default: str | None = None) -> Path | None:
    value = os.environ.get(name) or default
    if not value:
        return None
    p = Path(value)
    return p if p.is_absolute() else (REPO_ROOT / p).resolve()


def sources_dir() -> Path:
    p = _path_from_env("SOURCES_DIR")
    if p is None:
        raise SystemExit("SOURCES_DIR is not set. Copy .env.example to .env and fill it in.")
    return p


def ra_ship_dir() -> Path | None:
    return _path_from_env("RA_SHIP_DIR")


def work_dir() -> Path:
    p = _path_from_env("WORK_DIR", "./work")
    assert p is not None
    p.mkdir(parents=True, exist_ok=True)
    return p


SPECS_DIR = REPO_ROOT / "specs"
SOURCES_REPO_DIR = REPO_ROOT / "sources"
MANIFEST_CSV = SOURCES_REPO_DIR / "manifest.csv"
VERIFICATION_DIR = SOURCES_REPO_DIR / "verification"
THRESHOLDS_YAML = REPO_ROOT / "thresholds" / "thresholds.yaml"
THRESHOLDS_FROZEN = REPO_ROOT / "thresholds" / "FROZEN.md"
RELEASES_DIR = REPO_ROOT / "releases"
SCHEMA_DIR = REPO_ROOT / "schema"
DEFAULT_RELEASE = "v0.0.1-prototype"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_text_lf(path: Path) -> str:
    """SHA-256 of a text file with line endings normalised to LF (same on every machine)."""
    data = path.read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def sha256_json(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=False) + "\n", encoding="utf-8", newline="\n")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
