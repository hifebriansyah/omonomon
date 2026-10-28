#!/usr/bin/env python3
"""Backfill: redraw the pictures of OLD whispers' articles as anime with Cloudflare Workers AI (FLUX.2 klein), stdlib only, no Node.

New whispers do not need this: the API Worker redraws the picture while it makes the whisper (animeFor in worker/api.js). This script
catches up the ones that have none: every whisper that points to an article (link_url), has a picture (thumb_url) and whose
anime_image is NULL.

  1. downloads the source's picture (thumb_url, which stays in the database untouched),
  2. sends it to @cf/black-forest-labs/flux-2-klein-4b on Workers AI (1024x1024, the same prompt as the Worker),
  3. stores the result in the R2 bucket (worker/api.jsonc "r2") as anime/<n>.jpg and writes that key to whispers.anime_image.

A redraw is about 110 neurons (Cloudflare reports the exact number for every call; it is printed here). The first 10,000 neurons a day
are free and the Worker's own redraws share them; after that it is $0.011 per 1,000 neurons. Cloudflare's filter refuses some pictures
("output flagged"): those cost nothing and stay NULL (tried again on the next run, so use --limit to keep going past them).
The API Worker gives the pages a resized address of the stored picture (Cloudflare image resizing, see IMAGE_OPTIONS in worker/api.js).

    python3 tools/remake_image.py                 redraw up to 5 (the newest first)
    python3 tools/remake_image.py --limit 20      redraw up to 20
    python3 tools/remake_image.py --n 123         only whisper 123 (add --force to redo one that already has a picture)
    python3 tools/remake_image.py --dry-run       list what would be redrawn, call nothing

Needs in .env: CLOUDFLARE_API_TOKEN (D1 Edit, Workers R2 Storage Edit and Workers AI) and CLOUDFLARE_ACCOUNT_ID.
Run  python3 tools/setup_api.py  once first (adds the columns, creates the bucket). tools/neuron_usage.py shows what was used.
"""
import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_worker import load_env, read_config  # noqa: E402
from setup_api import api, ROOT  # noqa: E402

BASE = os.environ.get("CLOUDFLARE_API_BASE", "https://api.cloudflare.com/client/v4")
MODEL = "@cf/black-forest-labs/flux-2-klein-4b"
# A short prompt for the small FLUX.2 klein model; keep in step with KLEIN_PROMPT in worker/api.js (this one asks for a square).
PROMPT = ("Redraw this photo as a 2D Japanese anime frame in the style of Frieren: Beyond Journey's End: clean, delicate linework, "
          "soft painterly shading, vibrant harmonious colors, deep blacks, rich contrast, cinematic lighting. Keep the same scene, "
          "subjects, layout and camera angle; change only the drawing style. Make it square by extending the background, never by "
          "stretching or squashing. Add no people or objects that are not in the photo. Remove all text, logos, watermarks, captions "
          "and borders.")
SOURCE_MAX_BYTES = 6 * 1024 * 1024


class Refused(Exception):
    """Workers AI's content filter refused this picture (error 3030): no neurons are used."""


def sql(account, token, db_id, statement, params=()):
    res = api("POST", f"/accounts/{account}/d1/database/{db_id}/query", token, {"sql": statement, "params": list(params)})
    if not res.get("success"):
        sys.exit("D1 query failed: " + "; ".join(e.get("message", "?") for e in res.get("errors", [])))
    return res["result"][0].get("results", [])


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; OmonOmonBot/1.0)"})
    with urllib.request.urlopen(req, timeout=30) as res:
        mime = (res.headers.get("Content-Type") or "").split(";")[0].strip()
        data = res.read(SOURCE_MAX_BYTES + 1)
    if mime not in ("image/jpeg", "image/png", "image/webp"):
        raise RuntimeError(f"source is not a usable picture ({mime or 'unknown type'})")
    if len(data) > SOURCE_MAX_BYTES:
        raise RuntimeError("source picture is too big")
    return data, mime


def redraw(account, token, source, mime):
    """(jpeg bytes, neurons used or None) from Workers AI; raises Refused when the filter says no."""
    boundary = uuid.uuid4().hex

    def part(name, value, filename=None, ctype=None):
        head = f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"' + (f'; filename="{filename}"' if filename else "") + "\r\n"
        if ctype:
            head += f"Content-Type: {ctype}\r\n"
        return head.encode() + b"\r\n" + (value if isinstance(value, bytes) else str(value).encode()) + b"\r\n"

    body = (part("prompt", PROMPT) + part("width", 1024) + part("height", 1024) + part("input_image_0", source, "source", mime)
            + f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(f"{BASE}/accounts/{account}/ai/run/{MODEL}", method="POST", data=body,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "omonomon-remake/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            neurons = res.headers.get("cf-ai-neurons")
            out = json.loads(res.read())
    except urllib.error.HTTPError as e:
        text = e.read()[:400].decode("utf-8", "replace")
        if '"code":3030' in text or "flagged" in text:
            raise Refused()
        raise RuntimeError(f"Workers AI answered {e.code}: {text}")
    image = (out.get("result") or {}).get("image")
    if not image:
        raise RuntimeError("Workers AI sent no picture")
    return base64.b64decode(image), (float(neurons) if neurons else None)


def store(account, token, bucket, key, data):
    """Put the picture in the R2 bucket (Cloudflare API: PUT .../r2/buckets/<bucket>/objects/<key>)."""
    req = urllib.request.Request(f"{BASE}/accounts/{account}/r2/buckets/{bucket}/objects/{key}", method="PUT", data=data,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "image/jpeg", "User-Agent": "omonomon-remake/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            out = json.loads(res.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"R2 upload failed ({e.code}): {e.read()[:200].decode('utf-8', 'replace')}")
    if not out.get("success", True):
        raise RuntimeError("R2 upload failed: " + "; ".join(x.get("message", "?") for x in out.get("errors", [])))


def main():
    ap = argparse.ArgumentParser(description="Backfill anime pictures for old whispers (Workers AI, FLUX.2 klein).")
    ap.add_argument("--limit", type=int, default=5, help="at most this many pictures (default 5)")
    ap.add_argument("--n", type=int, help="only this whisper number")
    ap.add_argument("--force", action="store_true", help="with --n: redo a picture that was already redrawn")
    ap.add_argument("--dry-run", action="store_true", help="only list what would be redrawn")
    args = ap.parse_args()

    load_env()
    token, account = os.environ.get("CLOUDFLARE_API_TOKEN"), os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not (token and account):
        sys.exit("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env")
    bucket = read_config("api")["r2"]["bucket"]
    db_file = ROOT / "worker" / "api-db.json"
    if not db_file.exists():
        sys.exit("worker/api-db.json is missing: run  python3 tools/setup_api.py  first")
    db_id = json.loads(db_file.read_text())["database_id"]

    where, params = "link_url IS NOT NULL AND thumb_url IS NOT NULL", []
    if args.n:
        where += " AND n = ?"
        params.append(args.n)
        if not args.force:
            where += " AND anime_image IS NULL"
    else:
        where += " AND anime_image IS NULL"
    rows = sql(account, token, db_id, f"SELECT n, link_title, thumb_url FROM whispers WHERE {where} ORDER BY n DESC LIMIT ?", params + [args.limit])
    if not rows:
        print("Nothing to redraw: every article picture already has one (or there are no articles).")
        return

    print(f"{len(rows)} picture(s) to redraw{' (dry run)' if args.dry_run else ''}:")
    done = refused = failed = unknown = 0
    neurons_total = 0.0
    for r in rows:
        label = f"#{r['n']} {(r['link_title'] or '')[:60]}"
        if args.dry_run:
            print(f"  {label}\n      {r['thumb_url']}")
            continue
        try:
            source, mime = download(r["thumb_url"])
            data, neurons = redraw(account, token, source, mime)
            key = f"anime/{r['n']}.jpg"
            store(account, token, bucket, key, data)
            sql(account, token, db_id, "UPDATE whispers SET anime_image = ? WHERE n = ?", [key, r["n"]])
            if neurons is None:
                unknown += 1
            else:
                neurons_total += neurons
            print(f"  ok      {label}  ({len(data) // 1024} KB, {'neurons: not reported' if neurons is None else f'{neurons:.2f} neurons'})")
            done += 1
        except Refused:
            print(f"  refused {label}: Workers AI's filter said no (0 neurons); it stays without a picture")
            refused += 1
        except Exception as err:  # one bad picture must not stop the rest; it stays NULL and is tried again next run
            print(f"  FAIL    {label}: {err}")
            failed += 1
    if not args.dry_run:
        print(f"Done: {done} redrawn, {refused} refused, {failed} failed. Neurons used: {neurons_total:.2f}"
              + (f" (+ {unknown} call(s) where Cloudflare did not report it)" if unknown else "") + ".")
        print("The pages show a new picture after the API cache (2 minutes) expires. Check usage with: python3 tools/neuron_usage.py")


if __name__ == "__main__":
    main()
