#!/usr/bin/env python3
"""Turn the big character PNGs in assets/ into web images (needs Pillow: pip3 install pillow).

For every character in characters.json it reads assets/<name>.png (the file name of
its "image" field), removes the white background connected to the image edge (white
dresses and faces stay), crops to the character, and writes:
  img/stage/<name>.png  the big cutout shown on stage
  img/<name>.png        a 256px square thumbnail for the picker

Usage: python3 tools/make_images.py
"""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
KEY = (255, 0, 255)


def cutout(path, size=720):
    im = Image.open(path).convert("RGB").resize((size, size), Image.LANCZOS)
    marked = im.copy()
    edge = [(x, y) for x in range(0, size, 8) for y in (0, size - 1)]
    edge += [(x, y) for y in range(0, size, 8) for x in (0, size - 1)]
    for pt in edge:
        px = marked.getpixel(pt)
        if px != KEY and min(px) > 225:
            ImageDraw.floodfill(marked, pt, KEY, thresh=28)
    data, mask = marked.load(), Image.new("L", im.size, 0)
    mp = mask.load()
    for y in range(size):
        for x in range(size):
            if data[x, y] == KEY:
                mp[x, y] = 255
    alpha = ImageChops.invert(mask).filter(ImageFilter.GaussianBlur(0.7))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
    pad = 6
    return out.crop((max(0, box[0] - pad), max(0, box[1] - pad),
                     min(size, box[2] + pad), min(size, box[3] + pad)))


def main():
    (ROOT / "img" / "stage").mkdir(parents=True, exist_ok=True)
    for c in json.loads((ROOT / "characters.json").read_text(encoding="utf-8"))["characters"]:
        name = Path(c["image"]).stem
        src = ROOT / "assets" / f"{name}.png"
        if not src.exists():
            print(f"skip {name}: {src} not found")
            continue
        big = cutout(src)
        big.save(ROOT / "img" / "stage" / f"{name}.png", optimize=True)
        thumb = big.copy()
        thumb.thumbnail((240, 240), Image.LANCZOS)
        sq = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        sq.paste(thumb, ((256 - thumb.width) // 2, (256 - thumb.height) // 2), thumb)
        sq.save(ROOT / "img" / f"{name}.png", optimize=True)
        print(f"ok {name}")


if __name__ == "__main__":
    main()
