"""Compare a full-document Docling run with the page-range runs behind a release (plan step C8).

For every cell of a source in the release that came from Docling, look in the full-document run for
a table cell on the same page whose box is the same (within a tolerance) and report whether the
printed text is identical. Reads the release and the run output only; changes nothing.

    python scripts/compare_full_document_run.py <release dir> <source_id> <path to the run's raw/output.json>
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

from datalab import config
from datalab.tables import load_tables

TOL = 0.004     # normalised page units: about 3 points on an A4 page


def main(release: str, source_id: str, output_json: str) -> int:
    cells = [c for c in config.read_json(Path(release) / "cells.json")
             if c["source_id"] == source_id and c["extractor_name"] == "docling"]
    by_page: dict[int, list] = {}
    for table in load_tables(Path(output_json)):
        for tc in table.cells:
            if tc.bbox:
                by_page.setdefault(table.page, []).append(tc)
    outcome: Counter[str] = Counter()
    differences = []
    for c in cells:
        box = c["cell_bbox_norm"]
        near = [tc for tc in by_page.get(c["page"], []) if all(abs(a - b) <= TOL for a, b in zip(tc.bbox, box))]
        mapped = "mapped" if c["series_id"] else "unmapped"
        if not near:
            outcome[f"{mapped}: no cell at the same box"] += 1
            differences.append((c["page"], c["value_raw"], "no cell at the same box", c["series_id"]))
        elif any(tc.text == c["value_raw"] for tc in near):
            outcome[f"{mapped}: same text at the same box"] += 1
        else:
            outcome[f"{mapped}: different text at the same box"] += 1
            differences.append((c["page"], c["value_raw"], [tc.text for tc in near], c["series_id"]))
    print(f"{source_id}: {len(cells)} Docling cells in the release, pages {sorted({c['page'] for c in cells})}")
    for k, n in sorted(outcome.items()):
        print(f"  {k}: {n}")
    for d in differences[:40]:
        print("  DIFF", d)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(*sys.argv[1:4]))
