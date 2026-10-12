"""Offline OG font inputs: public WOFF2 -> static ASCII WOFF, weight 400.

Run only when the self-hosted source fonts change. Requires fontTools (the
repo's existing pyftsubset tooling); Node provides Brotli if Python lacks it.
The source SIL OFL licenses remain under public/fonts/OFL-*.txt.
"""
import importlib.util
from pathlib import Path
import subprocess
import sys
import types

if importlib.util.find_spec("brotli") is None:
    brotli = types.ModuleType("brotli")
    brotli.decompress = lambda data: subprocess.run(
        ["node", "--input-type=module", "-e",
         "import{readFileSync}from'node:fs';import{brotliDecompressSync}from'node:zlib';process.stdout.write(brotliDecompressSync(readFileSync(0)));"],
        input=data, capture_output=True, check=True,
    ).stdout
    sys.modules["brotli"] = brotli

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

root = Path(__file__).resolve().parent.parent
out = root / "scripts/assets/astrofolio-gap"
out.mkdir(parents=True, exist_ok=True)
for name in ["instrument-sans", "jetbrains-mono"]:
    font = TTFont(root / f"public/fonts/{name}-latin-wght-normal.woff2", recalcTimestamp=False)
    font = instantiateVariableFont(font, {"wght": 400}, inplace=False)
    options = subset.Options()
    options.recalc_timestamp = False
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=range(32, 127))
    sub.subset(font)
    font.flavor = "woff"
    font.save(out / f"{name}-400-ascii.woff")
