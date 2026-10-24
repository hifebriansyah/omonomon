#!/usr/bin/env python3
"""One-time setup of the API Worker's database on Cloudflare: the D1 database and its tables.
No Node, no wrangler, stdlib only. Safe to run again: it reuses what already exists.

    python3 tools/setup_api.py          create/find the D1 database, apply worker/schema.sql (writes worker/api-db.json)
    python3 tools/deploy_worker.py api  then upload worker/api.js (this also attaches its domain)

The API token in .env needs: Account > D1 > Edit, Account > Workers Scripts > Edit and, for the domain,
Zone > Workers Routes > Edit plus Zone > DNS > Edit on securhat.com.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_worker import ROOT, load_env, read_config  # noqa: E402

BASE = os.environ.get("CLOUDFLARE_API_BASE", "https://api.cloudflare.com/client/v4")


def api(method, path, token, body=None):
    req = urllib.request.Request(
        f"{BASE}{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
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


def need(payload, what):
    if not payload.get("success"):
        errors = "; ".join(e.get("message", "?") for e in payload.get("errors", []))
        hint = "\n  -> the token is missing a permission: add it in Cloudflare > My Profile > API Tokens" if "uthentication" in errors else ""
        sys.exit(f"{what} failed: {errors}{hint}")
    return payload["result"]


def database(account, token, name):
    """The D1 database called `name`: found, or created."""
    found = need(api("GET", f"/accounts/{account}/d1/database?name={name}", token), "Listing D1 databases")
    for db in found:
        if db["name"] == name:
            print(f"D1 database '{name}' exists ({db['uuid'][:8]}...)")
            return db["uuid"]
    created = need(api("POST", f"/accounts/{account}/d1/database", token, {"name": name}), "Creating the D1 database")
    print(f"Created D1 database '{name}' ({created['uuid'][:8]}...)")
    return created["uuid"]


# Columns added after the first release. SQLite has no "ADD COLUMN IF NOT EXISTS", so each statement may fail with
# "duplicate column name" on a database that already has it; that is fine.
MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN name TEXT",
    "ALTER TABLE users ADD COLUMN picture TEXT",
    "ALTER TABLE users ADD COLUMN nickname TEXT",
    "ALTER TABLE comments ADD COLUMN body_id TEXT",
    "ALTER TABLE comments ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE whispers ADD COLUMN link_url TEXT",
    "ALTER TABLE whispers ADD COLUMN link_title TEXT",
    "ALTER TABLE whispers ADD COLUMN link_source TEXT",
    "ALTER TABLE whispers ADD COLUMN thumb_url TEXT",
]


def apply_schema(account, token, db_id):
    sql = (ROOT / "worker" / "schema.sql").read_text(encoding="utf-8")
    need(api("POST", f"/accounts/{account}/d1/database/{db_id}/query", token, {"sql": sql}), "Applying worker/schema.sql")
    for stmt in MIGRATIONS:
        res = api("POST", f"/accounts/{account}/d1/database/{db_id}/query", token, {"sql": stmt})
        errors = "; ".join(e.get("message", "") for e in res.get("errors", []))
        if not res.get("success") and "duplicate column" not in errors.lower():
            sys.exit(f"Migration failed ({stmt}): {errors}")
    print("Tables ready (users, sessions, progress, scores, runs, riddle_log, push_subs).")


def main():
    load_env()
    token, account = os.environ.get("CLOUDFLARE_API_TOKEN"), os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        sys.exit("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env")
    cfg = read_config("api")
    db_id = database(account, token, cfg["d1"]["name"])
    (ROOT / "worker" / "api-db.json").write_text(json.dumps({"database_id": db_id}, indent=2) + "\n", encoding="utf-8")
    apply_schema(account, token, db_id)
    print("Next:  python3 tools/deploy_worker.py api")


if __name__ == "__main__":
    main()
