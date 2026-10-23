#!/usr/bin/env python3
"""Turn your original character art into web images (needs Pillow: pip3 install pillow).

For every character in characters.json it reads the original assets/img/<id>.png, removes the white background connected to the
image edge (white dresses and faces stay), crops to the character, and writes:
  builds/img/stage/<id>.webp  the big cutout shown on stage
  builds/img/<id>.webp        a 256px square thumbnail for the picker
(WebP at quality 90: about 6x smaller than PNG and visually the same. Change WEBP_QUALITY
below to trade size for quality; 100 with lossless=True would be a perfect copy.)

It also builds two separate sets of site icons:
  Tab icon, from assets/img/favicon.png (white background is removed, so it is transparent):
    builds/img/favicon.ico            16, 32 and 48 px
  App icon, from assets/img/appicon.png (kept whole, opaque; phones need a solid square):
    builds/img/apple-touch-icon.png   180 px, iPhone/iPad home screen
    builds/img/icon-192.png           192 px, Android and Chrome
    builds/img/icon-512.png           512 px, Android and Chrome
Each set is skipped, with a note, if its source file is missing.
Everything in builds/ is generated and git-ignored: never edit it by hand. GitHub Actions
runs this script on every deploy; run it yourself to see the images locally.

It also makes the 1200x630 link-preview pictures in builds/img/share/.

Usage: python3 tools/make_images.py
"""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
KEY = (255, 0, 255)
WEBP_QUALITY = 90

APPICON = ROOT / "assets" / "img" / "appicon.png"    # source of the phone/app icons
FAVICON = ROOT / "assets" / "img" / "favicon.png"    # source of the browser-tab icon
FAVICON_PAD = 0.03  # transparent margin around the tab icon, as a fraction of its size


def save_webp(im, path):
    # alpha_quality=100 keeps the transparent edge around each character clean
    im.save(path, "WEBP", quality=WEBP_QUALITY, alpha_quality=100, method=6)


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


SHARE_SIZE = (1200, 630)  # the picture link previews (WhatsApp, X, Facebook...) show
SHARE_BG = (27, 29, 35)   # same dark as the site theme colour


def share_card(heroes, accent=(255, 255, 255)):
    """A link-preview picture: the character(s) on the site background with a thin accent frame."""
    card = Image.new("RGB", SHARE_SIZE, SHARE_BG)
    ImageDraw.Draw(card).rectangle((14, 14, SHARE_SIZE[0] - 15, SHARE_SIZE[1] - 15), outline=accent, width=6)
    slot = (SHARE_SIZE[0] - 80) // len(heroes)
    for i, hero in enumerate(heroes):
        h = hero.copy()
        h.thumbnail((slot - 20, SHARE_SIZE[1] - 120), Image.LANCZOS)
        x = 40 + i * slot + (slot - h.width) // 2
        card.paste(h, (x, (SHARE_SIZE[1] - h.height) // 2), h)
    return card


def make_app_icons(out):
    """Phone and app icons: the whole artwork, opaque (iOS fills transparency with black)."""
    if not APPICON.exists():
        print(f"skip app icons: {APPICON.relative_to(ROOT)} not found")
        return
    art = Image.open(APPICON).convert("RGB")
    for size, filename in ((180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        art.resize((size, size), Image.LANCZOS).save(out / filename, optimize=True)
    print("ok app icons (apple-touch-icon.png, icon-192.png, icon-512.png)")


def make_favicon(out):
    """Browser-tab icon: the favicon art on a transparent background."""
    if not FAVICON.exists():
        print(f"skip favicon: {FAVICON.relative_to(ROOT)} not found")
        return
    art = Image.open(FAVICON).convert("RGBA")
    if art.getchannel("A").getextrema()[0] == 255:  # fully opaque: remove the white background
        art = cutout(FAVICON)
    else:  # already transparent: just trim the empty border
        art = art.crop(art.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
    side = int(max(art.size) * (1 + 2 * FAVICON_PAD))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(art, ((side - art.width) // 2, (side - art.height) // 2), art)
    canvas.resize((256, 256), Image.LANCZOS).save(out / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("ok favicon (favicon.ico, transparent)")


def main():
    out = ROOT / "builds" / "img"
    (out / "stage").mkdir(parents=True, exist_ok=True)
    (out / "share").mkdir(exist_ok=True)
    for pattern in ("*.png", "*.webp", "*.ico"):
        for old in list(out.glob(pattern)) + list((out / "stage").glob(pattern)):
            old.unlink()  # leftovers, e.g. a renamed character's old files
    for old in (out / "share").glob("*.jpg"):
        old.unlink()
    heroes = []
    for c in json.loads((ROOT / "characters.json").read_text(encoding="utf-8"))["characters"]:
        name = c["id"]  # files are named by id, never by the label
        src = ROOT / "assets" / "img" / f"{name}.png"
        if not src.exists():
            print(f"skip {name}: {src} not found")
            continue
        big = cutout(src)
        heroes.append(big)
        accent = tuple(int(c["accent"][i:i + 2], 16) for i in (1, 3, 5))
        share_card([big], accent).save(out / "share" / f"{name}.jpg", quality=85, optimize=True)
        save_webp(big, out / "stage" / f"{name}.webp")
        thumb = big.copy()
        thumb.thumbnail((240, 240), Image.LANCZOS)
        sq = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        sq.paste(thumb, ((256 - thumb.width) // 2, (256 - thumb.height) // 2), thumb)
        save_webp(sq, out / f"{name}.webp")
        print(f"ok {name}")
    if heroes:
        share_card(heroes).save(out / "share" / "home.jpg", quality=85, optimize=True)
    make_app_icons(out)
    make_favicon(out)


if __name__ == "__main__":
    main()
