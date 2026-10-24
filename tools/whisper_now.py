#!/usr/bin/env python3
"""Make the ghosts whisper right now, instead of waiting for the 3-hour timer. No Node, stdlib only.

    python3 tools/whisper_now.py              one new whisper from every ghost (1 to 4)
    python3 tools/whisper_now.py 2 4          only from ghosts 2 and 4
    python3 tools/whisper_now.py --list       show the latest whispers (no changes)
    python3 tools/whisper_now.py --delete 12  remove whisper number 12 (numbers are shown by --list)
    python3 tools/whisper_now.py --comments   show the newest comments (visitors' and the ghosts' replies) with their numbers
    python3 tools/whisper_now.py --delete-comment 7   remove comment 7 and the ghost's reply under it

Each whisper is one Gemini call. It needs INTERNAL_TOKEN in .env (the same value is set on both Workers by
tools/deploy_worker.py). The address and allowed origin come from worker/api.jsonc.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_worker import load_env, read_config  # noqa: E402

GHOSTS = {"1": "Pocomon", "2": "Ngesomon", "3": "Sundemon", "4": "Kuntimon"}


def request(method, path, body=None):
    cfg = read_config("api")
    url = f"https://{cfg['domain']}{path}"
    headers = {
        "Content-Type": "application/json",
        "Origin": cfg["vars"]["SITE_ORIGIN"],         # the edge rule only lets requests with the site's Origin through
        "X-Internal-Token": os.environ["INTERNAL_TOKEN"],
        "User-Agent": "pocomon-deploy/1.0",           # Cloudflare blocks the default Python user agent
    }
    req = urllib.request.Request(url, method=method, headers=headers, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {"error": f"HTTP {e.code}"}


def main():
    load_env()
    if not os.environ.get("INTERNAL_TOKEN"):
        sys.exit("Set INTERNAL_TOKEN in .env (see .env.example), then run tools/deploy_worker.py and tools/deploy_worker.py api once")
    args = sys.argv[1:]

    if args[:1] == ["--list"]:
        status, data = request("GET", "/whispers")
        if status != 200:
            sys.exit(f"Could not list whispers: {data.get('error')}")
        for w in data["whispers"]:
            when = time.strftime("%Y-%m-%d %H:%M", time.localtime(w["t"] / 1000))
            print(f"#{w['n']:<4} {GHOSTS.get(w['ghost'], w['ghost']):<9} {when}  {w['text']['en']}")
        print(f"{len(data['whispers'])} whispers")
        return

    if args[:1] == ["--comments"]:
        status, data = request("GET", "/internal/comments")
        if status != 200:
            sys.exit(f"Could not list comments: {data.get('error')}")
        for c in reversed(data["comments"]):
            who = c["author"] if c["kind"] == "user" else f"{GHOSTS.get(c['ghost'], c['ghost'])} (ghost)"
            when = time.strftime("%Y-%m-%d %H:%M", time.localtime(c["t"] / 1000))
            print(f"#{c['n']:<4} whisper {c['whisper']:<4} {when}  {who}: {c['body']}")
        print(f"{len(data['comments'])} comments")
        return

    if args[:1] == ["--delete-comment"]:
        if len(args) != 2 or not args[1].isdigit():
            sys.exit("Usage: whisper_now.py --delete-comment <number>")
        status, data = request("DELETE", f"/internal/comment/{args[1]}")
        print("deleted" if status == 200 else f"failed: {data.get('error')}")
        return

    if args[:1] == ["--delete"]:
        if len(args) != 2 or not args[1].isdigit():
            sys.exit("Usage: whisper_now.py --delete <number>")
        status, data = request("DELETE", f"/internal/whisper/{args[1]}")
        print("deleted" if status == 200 else f"failed: {data.get('error')}")
        return

    ghosts = args or list(GHOSTS)
    bad = [g for g in ghosts if g not in GHOSTS]
    if bad:
        sys.exit(f"Unknown ghost {', '.join(bad)}. Use: {', '.join(f'{k} ({v})' for k, v in GHOSTS.items())}")
    failures = 0
    for i, g in enumerate(ghosts):
        if i:
            time.sleep(3)  # keeps well under the edge rate limit (10 requests per 10 seconds)
        status, data = request("POST", "/internal/whisper", {"ghost": g})
        if status == 200 and data.get("whisper"):
            w = data["whisper"]
            print(f"#{w['n']} {GHOSTS[g]}: {w['text']['en']}\n     {w['text'].get('id') or '(no Indonesian version)'}")
        else:
            failures += 1
            print(f"{GHOSTS[g]}: failed ({data.get('error')})")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
