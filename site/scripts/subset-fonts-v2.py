"""Subset the Home v2 fonts into src/fonts (2026-11-23). Not run by the build.

Sources (SIL OFL 1.1), from the google/fonts repository:
  ofl/archivo/Archivo[wdth,wght].ttf
  ofl/atkinsonhyperlegiblemono/AtkinsonHyperlegibleMono[wght].ttf
Needs fonttools and brotli (python -m pip install fonttools brotli, ideally in a venv).

  python scripts/subset-fonts-v2.py Archivo[wdth,wght].ttf AtkinsonHyperlegibleMono[wght].ttf src/fonts

Output: archivo-latin-wdth-75-110-wght-700-800.woff2 (variable: width 75-110 %, weight 700-800)
        atkinson-hyperlegible-mono-latin-wght-400-700.woff2 (variable, weight 400-700)
Archivo is for headings and large numerals; the mono face is for page references only.
Characters and features as in scripts/subset-fonts.py.
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
      0x20A8, 0x20AC, 0x2122, 0x2212, 0x2264, 0x2265]
FEATURES = ["kern", "liga", "tnum", "lnum", "pnum", "case", "ccmp", "locl", "rvrn", "mark", "mkmk"]


def build(src, out, limits):
    font = TTFont(src)
    font = instancer.instantiateVariableFont(font, limits)
    tmp = io.BytesIO()
    font.save(tmp)
    tmp.seek(0)
    font = TTFont(tmp)  # reload: the mono face otherwise trips the subsetter on .notdef
    opts = subset.Options()
    opts.layout_features = FEATURES
    opts.flavor = "woff2"
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=U)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = "woff2"
    font.save(buf)
    with open(out, "wb") as f:
        f.write(buf.getvalue())
    print(out, len(buf.getvalue()), "bytes")


if __name__ == "__main__":
    archivo, mono, dest = sys.argv[1:4]
    build(archivo, os.path.join(dest, "archivo-latin-wdth-75-110-wght-700-800.woff2"), {"wdth": (75, 110), "wght": (700, 800)})
    build(mono, os.path.join(dest, "atkinson-hyperlegible-mono-latin-wght-400-700.woff2"), {"wght": (400, 700)})
