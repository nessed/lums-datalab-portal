"""Fresh Docling runs (plan section 6.3, decisions D17/D18).

Every call creates a new run folder; nothing is ever overwritten. This step
never marks its own run as validated: only `validate.py` does that.
"""
from __future__ import annotations

import importlib.metadata as md
import os
import platform
import re
import time
import traceback
from pathlib import Path
from typing import Any

from . import config
from .schema import RunManifest
from .sources import get_source, source_path

DOC_CODES = {"abs": "ABS", "cpi_monthly_review": "CPI", "lfs_annual_report": "LFS", "pes_chapter": "PES",
             "cpi_reference": "CPIREF"}

# Decision D17. Hashed and stored with every run.
DEFAULT_CONFIG: dict[str, Any] = {
    "extractor": "docling",
    "pipeline": "standard_pdf",
    "pdf_backend": "docling_parse",
    "do_ocr": False,
    "do_table_structure": True,
    "table_mode": "accurate",
    "table_cell_matching": True,
    "device": "cpu",
    "num_threads": 8,
    "generate_page_images": False,
    "generate_picture_images": False,
    # torch.compile needs a C++ compiler (MSVC `cl`) that is not present on the RA machines; without
    # this every page fails with InvalidCxxCompiler. Disabling it changes speed only, not output.
    "torch_dynamo_disabled": True,
}


def tool_versions() -> dict[str, str]:
    out = {"python": platform.python_version()}
    for pkg in ("docling", "docling-core", "docling-parse", "docling-ibm-models", "pymupdf", "pdfplumber", "pypdf"):
        try:
            out[pkg] = md.version(pkg)
        except md.PackageNotFoundError:
            out[pkg] = "not installed"
    return out


def runs_dir() -> Path:
    d = config.work_dir() / "runs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def next_run_id(source_id: str, run_mode: str) -> str:
    source = get_source(source_id)
    prefix = f"{DOC_CODES.get(source.doc_type, source.doc_type.upper())}_{source.period}__docling__{run_mode}__run-"
    existing = [int(m.group(1)) for p in runs_dir().glob(prefix + "*") if (m := re.search(r"run-(\d+)$", p.name))]
    return f"{prefix}{(max(existing) + 1 if existing else 1):02d}"


def latest_run(source_id: str, validated_only: bool = True) -> RunManifest | None:
    """The newest run for a source (by run number), optionally only validated ones."""
    best: RunManifest | None = None
    for path in sorted(runs_dir().glob("*/manifest.json")):
        m = RunManifest(**config.read_json(path))
        if m.source_id != source_id or (validated_only and not m.validated):
            continue
        if best is None or m.started_at >= best.started_at:
            best = m
    return best


def run_output_json(run_id: str) -> Path:
    return runs_dir() / run_id / "raw" / "output.json"


def _backend_class(name: str):
    if name == "docling_parse":
        try:
            from docling.backend.docling_parse_backend import DoclingParseDocumentBackend
            return DoclingParseDocumentBackend
        except ImportError:
            from docling.backend.docling_parse_v4_backend import DoclingParseV4DocumentBackend
            return DoclingParseV4DocumentBackend
    if name == "pypdfium2":
        from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
        return PyPdfiumDocumentBackend
    raise ValueError(f"unsupported pdf_backend {name!r}")


def _converter(cfg: dict[str, Any]):
    if cfg.get("torch_dynamo_disabled"):
        os.environ["TORCHDYNAMO_DISABLE"] = "1"
    from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
    from docling.document_converter import DocumentConverter, PdfFormatOption

    opts = PdfPipelineOptions()
    opts.do_ocr = bool(cfg["do_ocr"])
    opts.do_table_structure = bool(cfg["do_table_structure"])
    opts.table_structure_options.mode = TableFormerMode.ACCURATE if cfg["table_mode"] == "accurate" else TableFormerMode.FAST
    opts.table_structure_options.do_cell_matching = bool(cfg["table_cell_matching"])
    opts.generate_page_images = bool(cfg["generate_page_images"])
    opts.generate_picture_images = bool(cfg["generate_picture_images"])
    opts.accelerator_options = AcceleratorOptions(num_threads=int(cfg["num_threads"]), device=AcceleratorDevice.CPU)
    backend = _backend_class(cfg["pdf_backend"])
    return DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts, backend=backend)}), backend.__name__


def profile_pdf(path: Path) -> dict[str, Any]:
    """Plan 6.2: born-digital vs scanned, ruled vs borderless, language.

    A page with no text is either blank (nothing printed on it) or an image. Only image pages
    count as scanned, and the fraction is taken over printed pages: the same definition the
    source inspection uses (`sources.inspect_pdf`, DECISIONS.md 2026-10-11).
    """
    import pymupdf

    with pymupdf.open(path) as doc:
        n = len(doc)
        with_text = 0
        blank = 0
        ruled_pages = 0
        ascii_chars = total_chars = 0
        for page in doc:
            text = page.get_text()
            if len(text.strip()) >= 20:
                with_text += 1
            else:
                samples = page.get_pixmap(dpi=36, colorspace=pymupdf.csGRAY).samples
                white = sum(1 for value in samples if value > 245) / max(len(samples), 1)
                if white > 0.995 and not page.get_images():
                    blank += 1
            total_chars += len(text)
            ascii_chars += sum(1 for ch in text if ord(ch) < 128)
            lines = 0
            for d in page.get_drawings():
                for item in d.get("items", []):
                    if item[0] in ("l", "re"):
                        lines += 1
            if lines >= 8:
                ruled_pages += 1
    printed = max(n - blank, 1)
    scanned_fraction = round((printed - with_text) / printed, 4) if n else 1.0
    return {
        "page_count": n,
        "blank_pages": blank,
        "image_only_pages": n - blank - with_text,
        "text_layer_page_fraction": round(with_text / printed, 4),
        "scanned_page_fraction": scanned_fraction,
        "track": "scanned" if scanned_fraction > 0.20 else "born_digital",
        "ruled_page_fraction": round(ruled_pages / max(n, 1), 4),
        "table_style_hint": "ruled" if ruled_pages > n / 2 else "borderless_or_mixed",
        "ascii_ratio": round(ascii_chars / max(total_chars, 1), 4),
        "language_hint": "en" if ascii_chars / max(total_chars, 1) > 0.9 else "mixed_or_non_english",
    }


def extract(source_id: str, page_range: tuple[int, int] | None = None, cfg: dict[str, Any] | None = None) -> RunManifest:
    """Run Docling once on a registered source and write the run manifest."""
    source = get_source(source_id)
    if source.verification_status == "failed":
        raise SystemExit(f"{source_id}: source verification failed; the file is not used (see {source.verification_record})")
    pdf = source_path(source)
    sha = config.sha256_file(pdf)
    if sha != source.sha256:
        raise SystemExit(f"{source_id}: file hash differs from the manifest; refusing to extract")
    cfg = dict(cfg or DEFAULT_CONFIG)
    profile = profile_pdf(pdf)
    run_mode = "page-range" if page_range else "full-document"
    run_id = next_run_id(source_id, run_mode)
    run_dir = runs_dir() / run_id
    raw_dir = run_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=False)
    error_log = run_dir / "errors.log"
    error_log.write_text("", encoding="utf-8")
    manifest = RunManifest(
        run_id=run_id, source_id=source_id, sha256_at_run=sha, run_mode=run_mode,
        page_range=list(page_range) if page_range else None, tool_versions=tool_versions(), config=cfg,
        config_sha256=config.sha256_json(cfg), started_at=config.now_iso(), profile=profile,
    )
    config.write_json(run_dir / "manifest.json", manifest.model_dump())
    if profile["track"] == "scanned":
        error_log.write_text("scanned track: more than 20% of pages have no text layer; not processed\n", encoding="utf-8")
        manifest.errors = {"count": 1, "path": "errors.log"}
        manifest.finished_at = config.now_iso()
        config.write_json(run_dir / "manifest.json", manifest.model_dump())
        return manifest

    t0 = time.time()
    errors = 0
    try:
        converter, backend_name = _converter(cfg)
        manifest.config = {**cfg, "pdf_backend_class": backend_name}
        kwargs: dict[str, Any] = {"raises_on_error": False}
        if page_range:
            kwargs["page_range"] = (int(page_range[0]), int(page_range[1]))
        result = converter.convert(str(pdf), **kwargs)
        for err in getattr(result, "errors", None) or []:
            errors += 1
            with error_log.open("a", encoding="utf-8") as fh:
                fh.write(f"{getattr(err, 'component_type', '')}: {getattr(err, 'error_message', err)}\n")
        status = str(getattr(result, "status", ""))
        if "SUCCESS" not in status.upper() or "PARTIAL" in status.upper():
            errors += 1
            with error_log.open("a", encoding="utf-8") as fh:
                fh.write(f"conversion status: {status}\n")
        doc = result.document
        doc.save_as_json(raw_dir / "output.json")
        config.write_text(raw_dir / "output.md", doc.export_to_markdown())
        manifest.pages_emitted = len(doc.pages)
        manifest.tables_emitted = len(doc.tables)
    except Exception:
        errors += 1
        with error_log.open("a", encoding="utf-8") as fh:
            fh.write(traceback.format_exc())
    manifest.finished_at = config.now_iso()
    manifest.duration_s = round(time.time() - t0, 1)
    manifest.errors = {"count": errors, "path": "errors.log"}
    # config_sha256 covers the requested configuration only (D17), so runs are comparable.
    config.write_json(run_dir / "manifest.json", manifest.model_dump())
    print(f"[extract] {run_id}: pages={manifest.pages_emitted} tables={manifest.tables_emitted} "
          f"errors={errors} {manifest.duration_s}s")
    return manifest
