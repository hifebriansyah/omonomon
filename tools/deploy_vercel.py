#!/usr/bin/env python3
"""Deploy the sticky-note renderer (vercel/) to Vercel, stdlib only, no Node and no vercel CLI.

    python3 tools/deploy_vercel.py            create the project if needed, set its secret, deploy to production, wait until it is ready
    python3 tools/deploy_vercel.py --public   also switch off Vercel's login wall on the project's address (the function has its own secret)

Needs in .env: VERCEL_TOKEN (a token from vercel.com/account/tokens) and NOTE_RENDER_TOKEN (the secret shared with the API Worker; the
same value is set on the Worker by  python3 tools/deploy_worker.py api  and here as the function's RENDER_TOKEN).
The project is called omonomon-notes, so its address is https://omonomon-notes.vercel.app/api/render (NOTE_RENDER_URL in worker/api.jsonc).
What is uploaded: everything in vercel/ (api/render.py, note_render.py, requirements.txt, vercel.json, fonts/).
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_worker import load_env  # noqa: E402
from setup_api import ROOT  # noqa: E402

BASE = "https://api.vercel.com"
PROJECT = "omonomon-notes"
FOLDER = ROOT / "vercel"
FONT = FOLDER / "fonts" / "ComicNeue-Bold.ttf"


def call(token, method, path, body=None, query=None):
    url = BASE + path + (("?" + urllib.parse.urlencode(query)) if query else "")
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "omonomon-deploy/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {}


def message(data):
    err = data.get("error") or {}
    return f"{err.get('code', '?')}: {err.get('message', data)}"[:300]


def files_to_upload():
    out = []
    for path in sorted(FOLDER.rglob("*")):
        if path.is_dir() or "__pycache__" in path.parts or path.suffix == ".pyc" or path.name == ".DS_Store":
            continue
        out.append({"file": path.relative_to(FOLDER).as_posix(), "data": base64.b64encode(path.read_bytes()).decode(), "encoding": "base64"})
    return out


def main():
    ap = argparse.ArgumentParser(description="Deploy the sticky-note renderer to Vercel.")
    ap.add_argument("--public", action="store_true", help="switch off Vercel's login wall (deployment protection) on the project")
    args = ap.parse_args()

    load_env()
    token, secret = os.environ.get("VERCEL_TOKEN"), os.environ.get("NOTE_RENDER_TOKEN")
    if not token:
        sys.exit("Set VERCEL_TOKEN in .env")
    if not secret:
        sys.exit("Set NOTE_RENDER_TOKEN in .env (any long random string; the Worker gets the same one)")
    if not FONT.exists():
        sys.exit(f"The font is missing: put Comic Neue Bold at {FONT.relative_to(ROOT)}")

    status, user = call(token, "GET", "/v2/user")
    if status != 200:
        sys.exit(f"Vercel refused the token: {message(user)}")
    scope = {}   # the token's own (personal) account; a team id would go here
    print(f"Vercel account: {user['user'].get('username')}")

    status, project = call(token, "GET", f"/v9/projects/{PROJECT}", query=scope)
    if status == 404:
        status, project = call(token, "POST", "/v11/projects", {"name": PROJECT, "framework": None}, query=scope)
        if status not in (200, 201):
            sys.exit(f"Could not create the project: {message(project)}")
        print(f"Created project {PROJECT}.")
    elif status != 200:
        sys.exit(f"Could not read the project: {message(project)}")
    pid = project["id"]

    status, out = call(token, "POST", f"/v10/projects/{pid}/env", {"key": "RENDER_TOKEN", "value": secret, "type": "encrypted", "target": ["production", "preview"]}, query={**scope, "upsert": "true"})
    if status not in (200, 201):
        sys.exit(f"Could not set the secret: {message(out)}")
    print("Secret RENDER_TOKEN set on the project.")

    if args.public:
        status, out = call(token, "PATCH", f"/v9/projects/{pid}", {"ssoProtection": None}, query=scope)
        print("Login wall switched off." if status == 200 else f"Could not switch off the login wall: {message(out)}")

    files = files_to_upload()
    print(f"Uploading {len(files)} files ...")
    status, dep = call(token, "POST", "/v13/deployments", {"name": PROJECT, "project": pid, "target": "production", "files": files, "projectSettings": {"framework": None}}, query={**scope, "forceNew": "1", "skipAutoDetectionConfirmation": "1"})
    if status not in (200, 201):
        sys.exit(f"Deploy failed: {message(dep)}")
    dep_id = dep["id"]
    for _ in range(60):
        time.sleep(4)
        status, dep = call(token, "GET", f"/v13/deployments/{dep_id}", query=scope)
        state = dep.get("readyState")
        if state == "READY":
            print(f"Ready: https://{dep.get('url')}  (production address: https://{PROJECT}.vercel.app/api/render)")
            return
        if state in ("ERROR", "CANCELED"):
            sys.exit(f"Deployment {state}: {dep.get('errorMessage') or message(dep)}")
    sys.exit("Still building after 4 minutes; look at it on vercel.com")


if __name__ == "__main__":
    main()
