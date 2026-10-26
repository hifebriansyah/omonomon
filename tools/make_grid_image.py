#!/usr/bin/env python3
"""Local experiment: put the pictures of the newest article whispers into ONE square sheet (a grid), so a single Gemini call could redraw
several of them at once (see the 3x3 test: one sheet costs about the same as 2-3 single redraws).

  1. reads the newest whispers that point to an article (link_url) and have a picture (thumb_url), newest first,
  2. downloads each source picture (thumb_url, untouched in the database),
  3. crops it to 1:1 (the middle of the picture) and scales it to a cell,
  4. pastes the cells into a grid (2x2 for 4 pictures, 3x3 for 9) and saves it in builds/grids/ with a small .json that says
     which whisper sits in which cell (row by row, left to right), so the sheet can be cut up again later.

Nothing is sent anywhere and nothing in the database or the bucket changes.

    python3 tools/make_grid_image.py                 the 4 newest, a 2x2 sheet of 2048x2048
    python3 tools/make_grid_image.py --count 9       a 3x3 sheet
    python3 tools/make_grid_image.py --cell 768      smaller cells (default 1024)
    python3 tools/make_grid_image.py --n 189 184 178 173    exactly these whispers, in this order

Needs Pillow (pip install pillow) and in .env: CLOUDFLARE_API_TOKEN (D1 Edit) and CLOUDFLARE_ACCOUNT_ID.
"""
import argparse
import io
import json
import math
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_worker import load_env  # noqa: E402
from remake_image import download, sql  # noqa: E402
from setup_api import ROOT  # noqa: E402

try:
    from PIL import Image
except ImportError:
    sys.exit("This script needs Pillow: pip install pillow")

OUT_DIR = ROOT / "builds" / "grids"


def square(image, size):
    """The middle square of the picture, scaled to size x size."""
    side = min(image.size)
    left, top = (image.width - side) // 2, (image.height - side) // 2
    return image.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser(description="Merge the pictures of the newest article whispers into one square sheet (local test).")
    ap.add_argument("--count", type=int, default=4, help="how many pictures: a perfect square makes a full grid (4, 9, 16); default 4")
    ap.add_argument("--cell", type=int, default=1024, help="side of one cell in pixels (default 1024)")
    ap.add_argument("--n", type=int, nargs="+", help="use exactly these whisper numbers, in this order")
    args = ap.parse_args()

    load_env()
    token, account = os.environ.get("CLOUDFLARE_API_TOKEN"), os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not (token and account):
        sys.exit("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env")
    db_file = ROOT / "worker" / "api-db.json"
    if not db_file.exists():
        sys.exit("worker/api-db.json is missing: run  python3 tools/setup_api.py  first")
    db_id = json.loads(db_file.read_text())["database_id"]

    where, params = "link_url IS NOT NULL AND thumb_url IS NOT NULL", []
    if args.n:
        where += f" AND n IN ({','.join('?' * len(args.n))})"
        params += args.n
        limit = len(args.n)
    else:
        limit = args.count
    rows = sql(account, token, db_id, f"SELECT n, link_title, thumb_url FROM whispers WHERE {where} ORDER BY n DESC LIMIT ?", params + [limit])
    if args.n:
        rows.sort(key=lambda r: args.n.index(r["n"]))
    if not rows:
        sys.exit("No article whisper with a picture found.")

    cells = []
    for r in rows:
        try:
            data, _ = download(r["thumb_url"])
            cells.append((r, square(Image.open(io.BytesIO(data)).convert("RGB"), args.cell)))
            print(f"  ok   #{r['n']} {(r['link_title'] or '')[:60]}")
        except Exception as err:  # a picture that cannot be fetched leaves the sheet one cell short
            print(f"  skip #{r['n']}: {err}")
    if not cells:
        sys.exit("No picture could be downloaded.")

    side = math.ceil(math.sqrt(len(cells)))
    sheet = Image.new("RGB", (side * args.cell, side * args.cell), (0, 0, 0))
    for i, (_, cell) in enumerate(cells):
        sheet.paste(cell, ((i % side) * args.cell, (i // side) * args.cell))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    name = f"grid-{side}x{side}-{time.strftime('%Y%m%d-%H%M%S')}"
    sheet.save(OUT_DIR / f"{name}.jpg", quality=90)
    (OUT_DIR / f"{name}.json").write_text(json.dumps({
        "grid": side, "cell": args.cell, "size": side * args.cell,
        "cells": [{"index": i, "row": i // side, "col": i % side, "n": r["n"], "title": r["link_title"], "source": r["thumb_url"]} for i, (r, _) in enumerate(cells)],
    }, ensure_ascii=False, indent=2))
    print(f"Saved {OUT_DIR / (name + '.jpg')} ({side}x{side}, {side * args.cell}x{side * args.cell}px, {len(cells)} picture(s)) and the matching .json")


if __name__ == "__main__":
    main()
