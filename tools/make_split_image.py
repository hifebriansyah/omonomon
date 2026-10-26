#!/usr/bin/env python3
"""Local experiment: cut a redrawn sheet (made by tools/make_grid_image.py and redrawn by Gemini) back into its single square pictures.

    python3 tools/make_split_image.py --url builds/grids/grid-2x2-20261026-171356-anime-1k.jpg
    python3 tools/make_split_image.py --url https://example.com/sheet.jpg --grid 3
    python3 tools/make_split_image.py --url sheet.jpg --size 900 --trim 6

--url     an https address or a path on this machine. The sheet is square.
--grid    cells per side (2 = 2x2, 3 = 3x3). Default: read from the .json next to a sheet made by make_grid_image.py, else 2.
--trim    pixels cut off every edge of a tile, to drop the thin black lines Gemini draws between the panels (default 3).
--size    scale every tile to this many pixels square (default: keep the size).

The tiles are saved in builds/grids/split-<sheet name>/, row by row, left to right: named after their whisper number (189.jpg ...)
when the sheet's .json (the one make_grid_image.py wrote, found by dropping "-anime..." from the name) is there, else tile-<row>-<col>.jpg.
Nothing is uploaded and nothing in the database or the bucket changes.

Needs Pillow (pip install pillow).
"""
import argparse
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("This script needs Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "builds" / "grids"


def load(url):
    """(image, name) from an https address or a local path."""
    if re.match(r"^https?://", url):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; OmonOmonBot/1.0)"})
        with urllib.request.urlopen(req, timeout=60) as res:
            data = res.read()
        name = Path(url.split("?")[0]).stem or "sheet"
    else:
        path = Path(url.removeprefix("file://")).expanduser()
        if not path.is_absolute() and not path.exists():
            path = ROOT / path
        if not path.exists():
            sys.exit(f"{url} not found")
        data, name = path.read_bytes(), path.stem
    return Image.open(io.BytesIO(data)).convert("RGB"), name


def manifest_for(name):
    """The .json make_grid_image.py wrote for this sheet (the name without the '-anime...' part), or None."""
    for base in dict.fromkeys([name, re.sub(r"-anime.*$", "", name)]):
        path = OUT_DIR / f"{base}.json"
        if path.exists():
            return json.loads(path.read_text())
    return None


def main():
    ap = argparse.ArgumentParser(description="Cut a square sheet of pictures into its tiles (local test).")
    ap.add_argument("--url", required=True, help="https address or local path of the sheet")
    ap.add_argument("--grid", type=int, help="cells per side (default: from the sheet's .json, else 2)")
    ap.add_argument("--trim", type=int, default=3, help="pixels to cut off every tile edge (default 3)")
    ap.add_argument("--size", type=int, help="scale every tile to this many pixels square")
    args = ap.parse_args()

    sheet, name = load(args.url)
    if sheet.width != sheet.height:
        print(f"Note: the sheet is {sheet.width}x{sheet.height}, not square; the cells are cut from its own width and height.")
    manifest = manifest_for(name)
    grid = args.grid or (manifest or {}).get("grid") or 2
    cells = {c["index"]: c for c in (manifest or {}).get("cells", [])} if manifest and manifest.get("grid") == grid else {}

    out = OUT_DIR / f"split-{name}"
    out.mkdir(parents=True, exist_ok=True)
    cw, ch = sheet.width / grid, sheet.height / grid
    for row in range(grid):
        for col in range(grid):
            i = row * grid + col
            if cells and i not in cells:
                continue   # the sheet had fewer pictures than cells: that cell is empty
            box = (round(col * cw) + args.trim, round(row * ch) + args.trim, round((col + 1) * cw) - args.trim, round((row + 1) * ch) - args.trim)
            tile = sheet.crop(box)
            side = min(tile.size)   # keep it square even if the sheet or the trim is uneven
            tile = tile.crop((0, 0, side, side))
            if args.size:
                tile = tile.resize((args.size, args.size), Image.LANCZOS)
            label = f"{cells[i]['n']}" if cells else f"tile-{row}-{col}"
            tile.save(out / f"{label}.jpg", quality=92)
            print(f"  {label}.jpg  {tile.width}x{tile.height}")
    print(f"Saved in {out}")


if __name__ == "__main__":
    main()
