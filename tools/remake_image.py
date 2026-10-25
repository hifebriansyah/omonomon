#!/usr/bin/env python3
"""Redraw the pictures of the articles the ghosts link to, as anime (stdlib only, no Node).

For every whisper that points to an article (link_url is set), has a picture (thumb_url) and has no redrawn picture yet
(anime_image is NULL):

  1. asks the Gemini Worker (POST /image, model gemini-nano-banana-2.1, 1:1) to redraw the source's picture,
  2. stores the result in the R2 bucket (worker/api.jsonc "r2") as anime/<n>.jpg,
  3. writes that key to whispers.anime_image.

The source's own picture stays in whispers.thumb_url, untouched. The API Worker then serves the redrawn one at /img/<n>.jpg and gives
it to the pages as the whisper's thumb (the original is still in `link.original`).

    python3 tools/remake_image.py                 redraw up to 5 (the newest first)
    python3 tools/remake_image.py --limit 20      redraw up to 20
    python3 tools/remake_image.py --n 123         only whisper 123 (add --force to redo one that already has a picture)
    python3 tools/remake_image.py --dry-run       list what would be redrawn, call nothing

Needs in .env: CLOUDFLARE_API_TOKEN (D1 Edit and Workers R2 Storage Edit), CLOUDFLARE_ACCOUNT_ID and INTERNAL_TOKEN.
Each picture is one Gemini image call (about $0.03-0.04). Run  python3 tools/setup_api.py  once first (adds the column, creates the bucket).
"""
import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_worker import load_env, read_config  # noqa: E402
from setup_api import api, ROOT  # noqa: E402

GEMINI_URL = "https://geminimon.securhat.com/image"
SITE_ORIGIN = "https://omonomon.securhat.com"
PROMPT = None  # None: the Worker's own prompt (IMAGE_PROMPT in worker/gemini.js)


def sql(account, token, db_id, statement, params=()):
    res = api("POST", f"/accounts/{account}/d1/database/{db_id}/query", token, {"sql": statement, "params": list(params)})
    if not res.get("success"):
        sys.exit("D1 query failed: " + "; ".join(e.get("message", "?") for e in res.get("errors", [])))
    return res["result"][0].get("results", [])


def redraw(src_url, internal):
    """The redrawn picture as bytes, from the Gemini Worker."""
    body = {"url": src_url}
    if PROMPT:
        body["prompt"] = PROMPT
    req = urllib.request.Request(
        GEMINI_URL, method="POST", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Origin": SITE_ORIGIN, "X-Internal-Token": internal, "User-Agent": "omonomon-remake/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            image = json.loads(res.read())["image"]
    except urllib.error.HTTPError as e:
        detail = e.read()[:300].decode("utf-8", "replace")
        raise RuntimeError(f"Gemini Worker answered {e.code}: {detail}")
    return base64.b64decode(image["data"]), image.get("mime", "image/jpeg"), image.get("usage") or {}


def store(account, token, bucket, key, data, mime):
    """Put the picture in the R2 bucket (Cloudflare API: PUT .../r2/buckets/<bucket>/objects/<key>)."""
    req = urllib.request.Request(
        f"{os.environ.get('CLOUDFLARE_API_BASE', 'https://api.cloudflare.com/client/v4')}/accounts/{account}/r2/buckets/{bucket}/objects/{key}",
        method="PUT", data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": mime, "User-Agent": "omonomon-remake/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            out = json.loads(res.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"R2 upload failed ({e.code}): {e.read()[:200].decode('utf-8', 'replace')}")
    if not out.get("success", True):
        raise RuntimeError("R2 upload failed: " + "; ".join(x.get("message", "?") for x in out.get("errors", [])))


def main():
    ap = argparse.ArgumentParser(description="Redraw article pictures as anime.")
    ap.add_argument("--limit", type=int, default=5, help="at most this many pictures (default 5)")
    ap.add_argument("--n", type=int, help="only this whisper number")
    ap.add_argument("--force", action="store_true", help="with --n: redo a picture that was already redrawn")
    ap.add_argument("--dry-run", action="store_true", help="only list what would be redrawn")
    args = ap.parse_args()

    load_env()
    token, account, internal = (os.environ.get(k) for k in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "INTERNAL_TOKEN"))
    if not (token and account and internal):
        sys.exit("Set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and INTERNAL_TOKEN in .env")
    cfg = read_config("api")
    bucket = cfg["r2"]["bucket"]
    db_file = ROOT / "worker" / "api-db.json"
    if not db_file.exists():
        sys.exit("worker/api-db.json is missing: run  python3 tools/setup_api.py  first")
    db_id = json.loads(db_file.read_text())["database_id"]

    where = "link_url IS NOT NULL AND thumb_url IS NOT NULL"
    params = []
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
    done = failed = total = 0
    for r in rows:
        label = f"#{r['n']} {(r['link_title'] or '')[:60]}"
        if args.dry_run:
            print(f"  {label}\n      {r['thumb_url']}")
            continue
        try:
            data, mime, usage = redraw(r["thumb_url"], internal)
            key = f"anime/{r['n']}.jpg"
            store(account, token, bucket, key, data, mime)
            sql(account, token, db_id, "UPDATE whispers SET anime_image = ? WHERE n = ?", [key, r["n"]])
            tokens = f"  tokens in {usage.get('tokensIn', '?')} / out {usage.get('tokensOut', '?')} (picture {usage.get('tokensOutImage', '?')}) / thinking {usage.get('tokensThinking', '?')} / total {usage.get('tokensTotal', '?')}"
            print(f"  ok   {label}  ({len(data) // 1024} KB){tokens}")
            total += usage.get("tokensTotal", 0)
            done += 1
        except Exception as err:  # one bad picture must not stop the rest; it stays NULL and is tried again next run
            print(f"  FAIL {label}: {err}")
            failed += 1
    if not args.dry_run:
        print(f"Tokens used in this run: {total}")
        print(f"Done: {done} redrawn, {failed} failed. The pages show the new pictures after the API cache (2 minutes) expires.")


if __name__ == "__main__":
    main()
