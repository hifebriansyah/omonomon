"""Draws the sticky-note picture of a plain thought (a square JPEG): the same note as the whisper page (assets/scripts/shell/ui.js, app.css).

Shared by the Vercel function (vercel/api/render.py, which the API Worker calls right after a plain whisper is posted) and the local tool
tools/make_note_image.py (backfill and tests). Needs Pillow and a bold Comic-like font (vercel/fonts/ComicNeue-Bold.ttf, or NOTE_FONT=/path).
"""
import io
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 800           # the picture, in pixels
SS = 2               # drawn at twice the size, then scaled down: smooth edges
# the paper colour of each ghost: the same as NOTE_COLORS in assets/scripts/shell/ui.js
COLORS = {"pocomon": "#a07fd6", "ngesomon": "#e2707f", "sundemon": "#d99a3a", "kuntimon": "#4db58a"}
HERE = Path(__file__).resolve().parent
FONT_PATHS = [
    str(HERE / "fonts" / "ComicNeue-Bold.ttf"),                                 # bundled with the Vercel function (Comic Neue, SIL Open Font License)
    "/usr/share/fonts/truetype/comic-neue/ComicNeue-Bold.ttf",                  # Ubuntu package fonts-comic-neue
    "/System/Library/Fonts/Supplemental/Comic Sans MS Bold.ttf",                # macOS
    "C:/Windows/Fonts/comicbd.ttf",
]


def find_font():
    for path in [os.environ.get("NOTE_FONT"), *FONT_PATHS]:
        if path and Path(path).exists():
            return path
    try:   # anything fontconfig can find
        out = subprocess.run(["fc-match", "-f", "%{file}", "Comic Neue:bold"], capture_output=True, text=True, timeout=10).stdout.strip()
        if out and Path(out).exists():
            return out
    except (OSError, subprocess.SubprocessError):
        pass
    raise RuntimeError("No bold Comic font found: put ComicNeue-Bold.ttf in vercel/fonts/, or set NOTE_FONT=/path/to/font.ttf")


def rgb(hex_color):
    return tuple(int(hex_color[i:i + 2], 16) for i in (1, 3, 5))


def mix(a, b, k):
    return tuple(round(x + (y - x) * k) for x, y in zip(a, b))


def draw_pattern(slug, size, k):
    """The ghost's pattern as a mask (255 = ink). The same shapes as app.css; k scales the CSS pixels (they are made for a note ~480px wide)."""
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    if slug == "pocomon":      # the bands of a shroud
        step = 26 * 1.4142 * k
        x = -size
        while x < size * 2:
            d.line([(x, size), (x + size, 0)], fill=255, width=max(1, round(9 * k * 1.4142)))
            x += step
    elif slug == "ngesomon":   # a heartbeat line, continuous across, one row every 56px
        tile_w, tile_h, s = 34 * k, 56 * k, 0.607 * k
        pts = [(0, 22), (17, 22), (21, 10), (27, 34), (32, 22), (56, 22)]
        row = 0
        while row * tile_h < size:
            x0 = 0.0
            while x0 < size:
                d.line([(x0 + px * s, row * tile_h + 14.6 * k + py * s) for px, py in pts], fill=255, width=max(1, round(1.8 * k)), joint="curve")
                x0 += tile_w
            row += 1
    elif slug == "sundemon":   # window panes
        step, line = 42 * k, max(1, round(2 * k))
        p = 0.0
        while p < size:
            d.rectangle([p, 0, p + line, size], fill=255)
            d.rectangle([0, p, size, p + line], fill=255)
            p += step
    elif slug == "kuntimon":   # polka dots
        tile, r = 64 * k, 4.5 * k
        y = 0.0
        while y < size:
            x = 0.0
            while x < size:
                for cx, cy in ((16, 16), (48, 48)):
                    d.ellipse([x + cx * k - r, y + cy * k - r, x + cx * k + r, y + cy * k + r], fill=255)
                x += tile
            y += tile
    return mask


def wrap(text, font, max_width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if line and font.getlength(trial) > max_width:
            lines.append(line)
            line = word
        else:
            line = trial
    if line:
        lines.append(line)
    return lines


def render_note(slug, text, n, font_path):
    ns = SIZE * SS                     # the note fills the whole picture, in drawing pixels
    k = ns / 480                       # one CSS pixel of the 480px note
    color = rgb(COLORS.get(slug, "#8d9ae8"))
    # paper: a soft light at the top, the ghost's colour below
    top = Image.new("RGB", (ns, ns), mix(color, (255, 255, 255), 0.1))
    note = Image.composite(Image.new("RGB", (ns, ns), color), top, Image.linear_gradient("L").resize((ns, ns)))
    # her pattern: solid black at 5% (as on the site)
    ink = draw_pattern(slug, ns, k).point(lambda v: round(v * 0.05))
    note = Image.composite(Image.new("RGB", (ns, ns), (0, 0, 0)), note, ink)
    note = note.convert("RGBA")
    if slug == "sundemon":             # her note cries: three tear drops, frozen mid-fall
        tears = Image.new("RGBA", (ns, ns), (0, 0, 0, 0))
        for fx, fy in ((0.20, 0.20), (0.58, 0.64), (0.82, 0.40)):
            cx, y = fx * ns, fy * ns
            w, h = 0.022 * ns, 0.033 * ns
            trail_h = round(0.15 * ns)
            fade = Image.linear_gradient("L").resize((round(0.006 * ns) or 1, trail_h))   # black at the top, white at the bottom
            trail = Image.new("RGBA", fade.size, (20, 12, 0, 255))
            trail.putalpha(fade.point(lambda v: round(v * 0.3)))
            tears.alpha_composite(trail, (round(cx - fade.width / 2), round(y - trail_h + h * 0.2)))
            ImageDraw.Draw(tears).ellipse([cx - w / 2, y, cx + w / 2, y + h], fill=(20, 12, 0, round(255 * 0.4)))
        note.alpha_composite(tears)
    # the words, centred, white, with a soft dark shadow
    size_ratio = 0.079 if len(text) <= 50 else 0.067 if len(text) <= 100 else 0.053
    font = ImageFont.truetype(font_path, round(ns * size_ratio * 1.15))
    lines = wrap(text, font, ns * 0.80)
    line_h = font.size * 1.3
    y0 = (ns - line_h * len(lines)) / 2
    shadow = Image.new("RGBA", (ns, ns), (0, 0, 0, 0))
    words = Image.new("RGBA", (ns, ns), (0, 0, 0, 0))
    sd, wd = ImageDraw.Draw(shadow), ImageDraw.Draw(words)
    for i, line in enumerate(lines):
        x = (ns - font.getlength(line)) / 2
        y = y0 + i * line_h
        sd.text((x, y + 1.5 * k), line, font=font, fill=(0, 0, 0, 80))
        wd.text((x, y), line, font=font, fill=(255, 255, 255, 255))
    note.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(2 * k)))
    note.alpha_composite(words)
    # the picture is the note itself, edge to edge: no tilt, no tape, no border, square corners (JPEG has no transparency)
    return note.convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)


def jpeg(image):
    buf = io.BytesIO()
    image.save(buf, "JPEG", quality=90, optimize=True, progressive=True)
    return buf.getvalue()
