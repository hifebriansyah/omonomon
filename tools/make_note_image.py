#!/usr/bin/env python3
"""Draw the share picture of a plain thought: the sticky note of the whisper page, as a square JPEG, and store it in R2.

A whisper with no article (no link_url) is a "plain thought". On the site it is shown as a sticky note (assets/scripts/shell/ui.js,
app.css); this script draws the same note with Pillow so a link preview (WhatsApp, Telegram, X ...) can show it. The edge Worker
(worker/edge.js) uses it as og:image when it exists, and the ghost's scene picture otherwise.

  note/<n>.jpg      the Indonesian words (the site's default; the English ones when the whisper has no Indonesian)
  note/<n>-en.jpg   the English words (for links shared with ?lang=en)

The API Worker serves them as /note/<n>.jpg (reached through the edge Worker as /whispers/note/<n>.jpg).

    python3 tools/make_note_image.py --n 123            draw and store whisper 123
    python3 tools/make_note_image.py --missing          every plain whisper that has no picture yet (newest first, --limit 30)
    python3 tools/make_note_image.py --n 123 --out builds/notes     only write the files there, upload nothing, ask the API for nothing

In normal use this script is not needed: the API Worker has the picture drawn right after each plain whisper is posted, by the Vercel
function (vercel/api/render.py, which uses the same drawing code in vercel/note_render.py) and stores it in R2 itself. This tool is for tests
(--out) and for catching up on whispers that have no picture.
Needs Pillow (pip install pillow), a bold Comic-like font (vercel/fonts/ComicNeue-Bold.ttf, Comic Sans on a Mac, or NOTE_FONT=/path/to.ttf)
and in .env (or the environment): CLOUDFLARE_API_TOKEN (D1 Read, Workers R2 Storage Edit) and CLOUDFLARE_ACCOUNT_ID.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_worker import load_env, read_config  # noqa: E402
from remake_image import sql, store  # noqa: E402
from setup_api import ROOT  # noqa: E402

sys.path.insert(0, str(ROOT / "vercel"))
try:
    from note_render import find_font, jpeg, render_note  # noqa: E402  (the drawing, shared with the Vercel function)
except ImportError as e:
    sys.exit(f"This script needs Pillow: pip install pillow ({e})")


def has_picture(site, n):
    """True when the site already serves note/<n>.jpg (the edge Worker passes the request on to the API Worker, which reads R2)."""
    req = urllib.request.Request(f"{site}/whispers/note/{n}.jpg", method="HEAD", headers={"User-Agent": "omonomon-note/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20):
            return True
    except urllib.error.HTTPError as e:
        return e.code != 404           # any other answer (a hiccup): do not draw twice
    except OSError:
        return False


def main():
    ap = argparse.ArgumentParser(description="Draw the share picture of plain-thought whispers and store it in R2.")
    ap.add_argument("--n", type=int, help="only this whisper")
    ap.add_argument("--missing", action="store_true", help="every plain whisper that has no picture yet")
    ap.add_argument("--limit", type=int, default=30, help="with --missing: at most this many, newest first (default 30)")
    ap.add_argument("--force", action="store_true", help="draw again even if the picture exists")
    ap.add_argument("--out", help="only write the files into this folder (no upload, no API check)")
    args = ap.parse_args()
    if not args.n and not args.missing:
        ap.error("give --n <whisper> or --missing")

    load_env()
    token, account = os.environ.get("CLOUDFLARE_API_TOKEN"), os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not (token and account):
        sys.exit("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (in .env or the environment)")
    db_id = json.loads((ROOT / "worker" / "api-db.json").read_text())["database_id"]
    cfg = read_config("api")
    site, bucket = cfg["vars"]["SITE_ORIGIN"], cfg["r2"]["bucket"]
    chars = {c["id"]: c for c in json.loads((ROOT / "characters.json").read_text())["characters"]}
    font_path = find_font()

    if args.n:
        rows = sql(account, token, db_id, "SELECT n, ghost, text_en, text_id FROM whispers WHERE n = ?1 AND link_url IS NULL", [args.n])
    else:
        rows = sql(account, token, db_id, "SELECT n, ghost, text_en, text_id FROM whispers WHERE link_url IS NULL ORDER BY n DESC LIMIT ?1", [args.limit * 3])
    if not rows:
        print("No plain whisper found.")
        return
    made = 0
    for r in rows:
        if args.missing and made >= args.limit:
            break
        slug = (chars.get(str(r["ghost"])) or {}).get("slug")
        if not slug:
            continue
        if not args.out and not args.force and has_picture(site, r["n"]):
            continue
        versions = [("", (r["text_id"] or r["text_en"] or "").strip())]
        if r["text_id"] and r["text_en"]:
            versions.append(("-en", r["text_en"].strip()))
        for suffix, text in versions:
            if not text:
                continue
            data = jpeg(render_note(slug, text, int(r["n"]), font_path))
            if args.out:
                out = Path(args.out)
                out.mkdir(parents=True, exist_ok=True)
                (out / f"{r['n']}{suffix}.jpg").write_bytes(data)
            else:
                store(account, token, bucket, f"note/{r['n']}{suffix}.jpg", data)
            print(f"  #{r['n']} {slug}{suffix or ''}  {len(data) // 1024} KB")
        made += 1
    print(f"Done: {made} whisper(s).")


if __name__ == "__main__":
    main()
