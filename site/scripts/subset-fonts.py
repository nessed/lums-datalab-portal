"""Subset the two web fonts in src/fonts (round 2, 2026-11-15). Not run by the build.

Sources (SIL OFL 1.1), from the google/fonts repository:
  ofl/notosans/NotoSans[wdth,wght].ttf
  ofl/notosansdisplay/NotoSansDisplay[wdth,wght].ttf
Needs fonttools and brotli (python -m pip install fonttools brotli, ideally in a venv).

  python scripts/subset-fonts.py NotoSans[wdth,wght].ttf NotoSansDisplay[wdth,wght].ttf src/fonts

Output: noto-sans-latin-wght-400-700.woff2 (variable, wght 400-700, wdth fixed at 100)
        noto-sans-display-latin-700.woff2 (static Bold)
Characters: Basic Latin, Latin-1 (punctuation, symbols, letters), dashes, quotes,
ellipsis, bullet, per mille, rupee sign, minus, <= >=. Noto Sans has no arrow or
triangle glyphs; components/ui/Arrow.tsx draws arrows as SVG. Features kept:
kern, liga, tnum, lnum, pnum, case, ccmp, locl (+ rvrn, mark, mkmk where present).
Noto Sans figures are tabular by default; pnum makes them proportional.
"""
import io
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

U = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100))
U += list(range(0x2010, 0x2016)) + list(range(0x2018, 0x2023))
U += [0x2026, 0x2030, 0x2032, 0x2033, 0x2039, 0x203A, 0x2044, 0x2009, 0x200A, 0x202F, 0x2060,
      0x20A8, 0x20AC, 0x2122, 0x2212, 0x2264, 0x2265, 0x2190, 0x2191, 0x2192, 0x2193, 0x25B2, 0x25BC]
FEATURES = ["kern", "liga", "tnum", "lnum", "pnum", "case", "ccmp", "locl", "rvrn", "mark", "mkmk"]


def make(src, axes, dst):
    font = TTFont(src)
    opts = subset.Options()
    opts.layout_features = FEATURES
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]  # keep copyright and licence
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=U)
    s.subset(font)
    # Instance after subsetting (instancing first trips fontTools' lazy gvar loading).
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    font = instancer.instantiateVariableFont(TTFont(buf), axes)
    font.flavor = "woff2"
    font.save(dst)
    print(dst, os.path.getsize(dst), "bytes")


if __name__ == "__main__":
    sans, disp, out = sys.argv[1:4]
    make(sans, {"wdth": 100, "wght": (400, 700)}, os.path.join(out, "noto-sans-latin-wght-400-700.woff2"))
    make(disp, {"wdth": 100, "wght": 700}, os.path.join(out, "noto-sans-display-latin-700.woff2"))
