#!/usr/bin/env python3
"""Upload worker/worker.js to your Cloudflare Worker. No Node, no wrangler, stdlib only.

Setup: copy .env.example to .env and fill in the values
(it is git-ignored). Then:  python3 tools/deploy_worker.py

Dashboard variables (ALLOWED_ORIGINS, GEMINI_MODEL, ...) and the GEMINI_API_KEY
secret are kept: the upload asks Cloudflare to preserve existing bindings.
"""
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_env():
    f = ROOT / ".env"
    if not f.exists():
        return
    for line in f.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def read_config():
    # wrangler.jsonc only has whole-line // comments, so this is enough.
    text = (ROOT / "worker" / "wrangler.jsonc").read_text(encoding="utf-8")
    return json.loads("\n".join(l for l in text.splitlines() if not l.strip().startswith("//")))


def set_secret(base, account, worker, token, name):
    """Copy a secret from .env to the Worker (only when it is set there). The value is never printed."""
    value = os.environ.get(name)
    if not value:
        return
    req = urllib.request.Request(
        f"{base}/accounts/{account}/workers/scripts/{worker}/secrets",
        data=json.dumps({"name": name, "text": value, "type": "secret_text"}).encode(),
        method="PUT",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "pocomon-deploy/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            ok = json.loads(res.read()).get("success")
    except urllib.error.HTTPError as e:
        sys.exit(f"Setting {name} failed: HTTP {e.code}")
    print(f"Secret {name} {'set' if ok else 'NOT set'} on the Worker.")


def main():
    load_env()
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        sys.exit("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (see .env.example)")

    cfg = read_config()
    code = (ROOT / "worker" / "worker.js").read_text(encoding="utf-8")
    metadata = {
        "main_module": "worker.js",
        "compatibility_date": cfg["compatibility_date"],
        "keep_bindings": ["plain_text", "secret_text"],
        "bindings": [
            {"type": "ratelimit", "name": r["name"], "namespace_id": r["namespace_id"], "simple": r["simple"]}
            for r in cfg.get("ratelimits", [])
        ],
    }

    boundary = uuid.uuid4().hex
    parts = [
        ("metadata", None, "application/json", json.dumps(metadata)),
        ("worker.js", "worker.js", "application/javascript+module", code),
    ]
    body = b""
    for name, filename, ctype, content in parts:
        disp = f'form-data; name="{name}"' + (f'; filename="{filename}"' if filename else "")
        body += (
            f"--{boundary}\r\nContent-Disposition: {disp}\r\nContent-Type: {ctype}\r\n\r\n{content}\r\n"
        ).encode("utf-8")
    body += f"--{boundary}--\r\n".encode()

    base = os.environ.get("CLOUDFLARE_API_BASE", "https://api.cloudflare.com/client/v4")
    url = f"{base}/accounts/{account}/workers/scripts/{cfg['name']}"
    req = urllib.request.Request(
        url,
        data=body,
        method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            # Cloudflare blocks the default Python user agent.
            "User-Agent": "pocomon-deploy/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            payload = json.loads(res.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        sys.exit(f"Deploy failed: HTTP {e.code}\n{detail}")

    if not payload.get("success"):
        sys.exit(f"Deploy failed: {payload.get('errors')}")
    print(f"Deployed worker '{cfg['name']}' ({len(code)} bytes).")
    set_secret(base, account, cfg["name"], token, "AXIOM_TOKEN")
    print("Check Settings > Variables once after the first run to confirm they were kept.")


if __name__ == "__main__":
    main()
