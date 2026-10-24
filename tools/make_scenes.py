#!/usr/bin/env python3
"""Put the characters on the scene backgrounds (needs Pillow: pip3 install pillow).

Backgrounds, your own art:
  assets/img/bg-1_1.png   square
  assets/img/bg-16_9.png  landscape
  assets/img/bg-9_16.png  portrait
Characters: assets/img/<id>.png, cut out here at full resolution (see cutout) and shrunk once, so edges stay smooth.

For every background it writes, into builds/img/scenes/<ratio>/:
  <id>.jpg    one character on the background (id from characters.json)
and, into builds/img/heads/: <id>.webp, the head only, from assets/img/head-<id>.png, background removed, on a square transparent canvas.
Nothing uses these yet: look at them, decide where each goes, then wire it in (make_site.py).
Everything in builds/ is generated: never edit it by hand.

Needs numpy and scipy as well: pip3 install pillow numpy scipy

Usage: python3 tools/make_scenes.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from scipy import ndimage


ROOT = Path(__file__).resolve().parent.parent

# ratio -> (background file, output size, character height as a fraction of the picture)
SCENES = {
    "1_1": ("bg-1_1.png", (1080, 1080), 0.62),
    "16_9": ("bg-16_9.png", (1600, 900), 0.7),
    "9_16": ("bg-9_16.png", (1080, 1920), 0.42),
}

HEAD_SIZE = 256    # side of the square head picture, px


def head(path):
    """Your head art (assets/img/head-<id>.png): background removed, shrunk, centred on a square transparent canvas."""
    art = cutout(path)
    art.thumbnail((HEAD_SIZE, HEAD_SIZE), Image.LANCZOS)
    square = Image.new("RGBA", (HEAD_SIZE, HEAD_SIZE), (0, 0, 0, 0))
    square.paste(art, ((HEAD_SIZE - art.width) // 2, (HEAD_SIZE - art.height) // 2), art)
    return square


def cutout(path):
    """The character without its white background, at the artwork's full resolution.

    The background is the near-white area connected to the picture edge (white dresses and faces
    stay, the black outline closes them off). The mask is then pulled in about 2px, into the black
    outline, so no white fringe is left, and softened a little; it is anti-aliased when place() shrinks it.
    """
    im = Image.open(path).convert("RGB")
    white = np.asarray(im).min(axis=2) > 225
    labels, _ = ndimage.label(white)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    background = np.isin(labels, edge[edge > 0])
    alpha = Image.fromarray(np.where(background, 0, 255).astype("uint8"))
    alpha = alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.5))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    return out.crop(alpha.point(lambda v: 255 if v > 8 else 0).getbbox())


GLOW = (90, 255, 170)    # the green of the scene's mist
TINT = (232, 222, 255)   # moonlight on the white costumes


def place(scene, hero, cx, base, height):
    """Paste one character standing at baseline y=base, centred on x=cx, glowing like the scene's ghosts.

    Three layers: a soft wide halo and a tight bright one around the outline, and a rim of light just
    inside the outline. The white costume is also tinted a little towards the moonlight.
    """
    w, h = scene.size
    hero = hero.resize((round(hero.width * height / hero.height), round(height)), Image.LANCZOS)
    cx, base = round(cx * w), round(base * h)
    pad = round(hero.height * 0.2)  # room for the halo to fade out
    alpha = Image.new("L", (hero.width + 2 * pad, hero.height + 2 * pad), 0)
    alpha.paste(hero.getchannel("A"), (pad, pad))
    spot = (cx - hero.width // 2 - pad, base - hero.height - pad)

    shadow = Image.new("RGBA", scene.size, (0, 0, 0, 0))
    sw, sh = hero.width * 0.5, hero.height * 0.06
    ImageDraw.Draw(shadow).ellipse((cx - sw, base - sh, cx + sw, base + sh), fill=(0, 0, 0, 150))
    scene.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(hero.height * 0.025)))

    for blur, strength in ((0.05, 0.75), (0.012, 1.0)):  # wide halo, then the bright tight one
        halo = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(hero.height * blur))
        halo = halo.point(lambda v, k=strength: min(255, round(v * k * 1.6)))
        layer = Image.new("RGBA", alpha.size, GLOW + (0,))
        layer.putalpha(halo)
        scene.alpha_composite(layer, (max(spot[0], 0), max(spot[1], 0)),
                              (max(-spot[0], 0), max(-spot[1], 0), alpha.width, alpha.height))

    base_rgb = hero.convert("RGB")
    tinted = Image.fromarray((np.asarray(base_rgb) * (np.array(TINT) / 255.0)).astype("uint8"))
    rgb = Image.blend(base_rgb, tinted, 0.45)
    inside = hero.getchannel("A").filter(ImageFilter.MinFilter(7)).filter(ImageFilter.GaussianBlur(hero.height * 0.012))
    rim = Image.eval(inside, lambda v: 255 - v)                       # strong at the outline, none in the middle
    rim = ImageChops.multiply(rim, hero.getchannel("A")).point(lambda v: round(v * 0.55))
    rgb = Image.composite(Image.new("RGB", hero.size, GLOW), rgb, rim)
    hero = rgb.convert("RGBA")
    hero.putalpha(alpha.crop((pad, pad, pad + hero.width, pad + hero.height)))
    scene.alpha_composite(hero, (cx - hero.width // 2, base - hero.height))


def background(path, size):
    """Cover-fit the background to the output size (centred crop)."""
    bg = Image.open(path).convert("RGBA")
    scale = max(size[0] / bg.width, size[1] / bg.height)
    bg = bg.resize((round(bg.width * scale), round(bg.height * scale)), Image.LANCZOS)
    left, top = (bg.width - size[0]) // 2, (bg.height - size[1]) // 2
    return bg.crop((left, top, left + size[0], top + size[1]))


def main():
    chars = json.loads((ROOT / "characters.json").read_text(encoding="utf-8"))["characters"]
    heroes = []
    for c in chars:
        src = ROOT / "assets" / "img" / f"{c['id']}.png"
        if src.exists():
            heroes.append((c["id"], cutout(src)))
            head_src = ROOT / "assets" / "img" / f"head-{c['id']}.png"
            if head_src.exists():
                heads = ROOT / "builds" / "img" / "heads"
                heads.mkdir(parents=True, exist_ok=True)
                head(head_src).save(heads / f"{c['id']}.webp", "WEBP", quality=90, alpha_quality=100, method=6)
            else:
                print(f"skip head {c['id']}: {head_src.relative_to(ROOT)} not found")
        else:
            print(f"skip {c['id']}: {src} not found")
    for ratio, (bgfile, size, solo) in SCENES.items():
        bgpath = ROOT / "assets" / "img" / bgfile
        if not bgpath.exists():
            print(f"skip {ratio}: {bgpath.relative_to(ROOT)} not found")
            continue
        out = ROOT / "builds" / "img" / "scenes" / ratio
        out.mkdir(parents=True, exist_ok=True)
        for cid, hero in heroes:
            scene = background(bgpath, size)
            place(scene, hero, 0.5, 0.93, solo * size[1])
            scene.convert("RGB").save(out / f"{cid}.jpg", quality=88, optimize=True)
        print(f"ok {ratio} {size[0]}x{size[1]}")


if __name__ == "__main__":
    main()
