#!/usr/bin/env python3
"""Upload a Worker to Cloudflare. No Node, no wrangler, stdlib only.

Setup: copy .env.example to .env and fill in the values (it is git-ignored). Then:

    python3 tools/deploy_worker.py          the Gemini chat Worker (worker/gemini.js, settings in worker/gemini.jsonc)
    python3 tools/deploy_worker.py feeds    the feeds Worker (worker/feeds.js): securhat.com/feeds rendered on the server
    python3 tools/deploy_worker.py edge     the edge Worker (worker/edge.js, worker/edge.jsonc): per-whisper link previews,
                                            run in front of omonomon.securhat.com/whispers* (a route, no secrets)
    python3 tools/deploy_worker.py api      the general API Worker (worker/api.js, settings in worker/api.jsonc;
                                            run tools/setup_api.py once first for its D1 database)

Each deploy also (re)attaches the Worker's domain and turns its workers.dev address off. Plain variables and the rate limit
come from the .jsonc file on every deploy. Secrets are never in the repo and are kept across deploys: GEMINI_API_KEY is
entered in the Cloudflare dashboard, AXIOM_TOKEN (the request log) and INTERNAL_TOKEN (the secret the two Workers share) are copied from .env, for both Workers.
"""
import json
import os
import subprocess
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


# which Worker to deploy: config file and code file inside worker/
TARGETS = {"gemini": ("gemini.jsonc", "gemini.js"), "api": ("api.jsonc", "api.js"), "edge": ("edge.jsonc", "edge.js"), "feeds": ("feeds.jsonc", "feeds.js")}


def read_config(name):
    # the .jsonc files only have whole-line // comments, so this is enough.
    text = (ROOT / "worker" / TARGETS[name][0]).read_text(encoding="utf-8")
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


def call(base, token, method, path, body=None):
    req = urllib.request.Request(
        f"{base}{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "pocomon-deploy/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"success": False, "errors": [{"message": f"HTTP {e.code}"}]}


def attach_domain(base, account, token, cfg):
    """Point the Worker's public domain at it (safe to repeat) and turn its workers.dev address off."""
    domain = cfg.get("domain")
    if not domain:
        return
    zone_name = ".".join(domain.split(".")[-2:])
    zones = call(base, token, "GET", f"/zones?name={zone_name}").get("result") or []
    if not zones:
        print(f"Domain {domain}: zone {zone_name} not found or the token cannot read it; attach it in the dashboard.")
        return
    res = call(base, token, "PUT", f"/accounts/{account}/workers/domains",
               {"hostname": domain, "service": cfg["name"], "environment": "production", "zone_id": zones[0]["id"]})
    print(f"Domain https://{domain}/ -> {cfg['name']}" if res.get("success") else f"Domain {domain} NOT attached: {res.get('errors')}")
    off = call(base, token, "POST", f"/accounts/{account}/workers/scripts/{cfg['name']}/subdomain", {"enabled": False})
    print("workers.dev address off" if off.get("success") else f"workers.dev not changed ({(off.get('errors') or [{}])[0].get('message')})")


def attach_route(base, account, token, cfg):
    """Run the Worker in front of one path of an existing address (a route; safe to repeat)."""
    pattern = cfg.get("route")
    if not pattern:
        return
    zone_name = ".".join(pattern.split("/")[0].split(".")[-2:])
    zones = call(base, token, "GET", f"/zones?name={zone_name}").get("result") or []
    if not zones:
        print(f"Route {pattern}: zone {zone_name} not found or the token cannot read it; add the route in the dashboard.")
        return
    zone = zones[0]["id"]
    routes = call(base, token, "GET", f"/zones/{zone}/workers/routes").get("result") or []
    old = next((r for r in routes if r["pattern"] == pattern), None)
    body = {"pattern": pattern, "script": cfg["name"]}
    res = call(base, token, "PUT", f"/zones/{zone}/workers/routes/{old['id']}", body) if old else call(base, token, "POST", f"/zones/{zone}/workers/routes", body)
    print(f"Route {pattern} -> {cfg['name']}" if res.get("success") else f"Route {pattern} NOT set: {res.get('errors')}")
    off = call(base, token, "POST", f"/accounts/{account}/workers/scripts/{cfg['name']}/subdomain", {"enabled": False})
    print("workers.dev address off" if off.get("success") else f"workers.dev not changed ({(off.get('errors') or [{}])[0].get('message')})")


def main():
    load_env()
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        sys.exit("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (see .env.example)")

    target = sys.argv[1] if len(sys.argv) > 1 else "gemini"
    if target not in TARGETS:
        sys.exit(f"Unknown Worker '{target}'. Use: {', '.join(TARGETS)}")
    cfg = read_config(target)
    if target == "api":
        subprocess.run([sys.executable, str(ROOT / "tools" / "sync_limits.py")], check=True)  # every game's score limits into api.js
    code_file = TARGETS[target][1]
    code = (ROOT / "worker" / code_file).read_text(encoding="utf-8")
    bindings = [
        {"type": "ratelimit", "name": r["name"], "namespace_id": r["namespace_id"], "simple": r["simple"]}
        for r in cfg.get("ratelimits", [])
    ]
    if target == "api":
        db_file = ROOT / "worker" / "api-db.json"
        if not db_file.exists():
            sys.exit("worker/api-db.json is missing: run  python3 tools/setup_api.py  first")
        bindings.append({"type": "d1", "name": cfg["d1"]["binding"], "id": json.loads(db_file.read_text())["database_id"]})
    if cfg.get("r2"):
        bindings.append({"type": "r2_bucket", "name": cfg["r2"]["binding"], "bucket_name": cfg["r2"]["bucket"]})
    bindings += [{"type": "service", "name": x["binding"], "service": x["service"]} for x in cfg.get("services", [])]
    bindings += [{"type": "plain_text", "name": k, "text": v} for k, v in cfg.get("vars", {}).items()]
    metadata = {
        "main_module": code_file,
        "compatibility_date": cfg["compatibility_date"],
        "bindings": bindings,
    }
    metadata["keep_bindings"] = ["secret_text"]  # secrets (GEMINI_API_KEY, ...) stay across deploys
    if cfg.get("placement"):
        metadata["placement"] = cfg["placement"]  # where the Worker runs (see worker/gemini.jsonc)

    boundary = uuid.uuid4().hex
    parts = [
        ("metadata", None, "application/json", json.dumps(metadata)),
        (code_file, code_file, "application/javascript+module", code),
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
    if target not in ("edge", "feeds"):  # the edge and feeds Workers have no secrets
        set_secret(base, account, cfg["name"], token, "AXIOM_TOKEN")
        set_secret(base, account, cfg["name"], token, "INTERNAL_TOKEN")  # the secret the two Workers share (whispers)
        if target == "api":
            set_secret(base, account, cfg["name"], token, "YOUTUBE_API_KEY")  # optional: popular Indonesian videos for whispers
            set_secret(base, account, cfg["name"], token, "VAPID_PRIVATE_JWK")  # optional: Web Push to subscribers
            set_secret(base, account, cfg["name"], token, "TURNSTILE_SECRET")  # optional: the bot check on a first sign-in
    if cfg.get("crons"):
        res = call(base, token, "PUT", f"/accounts/{account}/workers/scripts/{cfg['name']}/schedules", [{"cron": c} for c in cfg["crons"]])
        print(f"Timer {', '.join(cfg['crons'])}" if res.get("success") else f"Timer NOT set: {res.get('errors')}")
    if target == "gemini":
        print("GEMINI_API_KEY is a secret you enter in the dashboard (Worker > Settings > Variables and Secrets); deploys keep it.")
    attach_domain(base, account, token, cfg)
    attach_route(base, account, token, cfg)


if __name__ == "__main__":
    main()
