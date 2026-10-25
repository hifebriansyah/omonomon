#!/usr/bin/env python3
"""What Workers AI used on this Cloudflare account, from Cloudflare's own analytics (stdlib only, no Node).

The API Worker's anime redraws (and tools/remake_image.py) run on Workers AI (FLUX.2 klein), which is paid in "neurons":
10,000 a day are free, after that $0.011 per 1,000. This asks Cloudflare's GraphQL Analytics API (dataset aiInferenceAdaptiveGroups),
so it works even when a redraw's own log line has no neuron count (null).

    python3 tools/neuron_usage.py                 neurons per day for the last 7 days, per model
    python3 tools/neuron_usage.py --days 30       a longer window
    python3 tools/neuron_usage.py --by hour       per hour instead of per day (use with a short --days)
    python3 tools/neuron_usage.py --calls         every call of the last 24 hours with its own neurons (use --days to change the window)

Times are UTC (Indonesia, WIB, is 7 hours ahead). Needs CLOUDFLARE_API_TOKEN (Account Analytics Read) and CLOUDFLARE_ACCOUNT_ID in .env.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_worker import load_env  # noqa: E402

GRAPHQL = os.environ.get("CLOUDFLARE_GRAPHQL", "https://api.cloudflare.com/client/v4/graphql")
FREE_PER_DAY = 10_000
USD_PER_1000 = 0.011


def gql(token, query):
    req = urllib.request.Request(GRAPHQL, method="POST", data=json.dumps({"query": query}).encode(),
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "omonomon-usage/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            out = json.loads(res.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"Cloudflare answered {e.code}: {e.read()[:300].decode('utf-8', 'replace')}")
    if out.get("errors"):
        sys.exit("GraphQL error: " + "; ".join(e.get("message", "?") for e in out["errors"]))
    return out["data"]["viewer"]["accounts"][0]["aiInferenceAdaptiveGroups"]


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    ap = argparse.ArgumentParser(description="Workers AI neuron usage from Cloudflare analytics.")
    ap.add_argument("--days", type=float, default=None, help="how far back (default 7; 1 with --calls)")
    ap.add_argument("--by", choices=("day", "hour"), default="day", help="group by day (default) or hour")
    ap.add_argument("--calls", action="store_true", help="list each call with its own neurons")
    args = ap.parse_args()

    load_env()
    token, account = os.environ.get("CLOUDFLARE_API_TOKEN"), os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        sys.exit("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env")
    days = args.days if args.days is not None else (1 if args.calls else 7)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    flt = f'accountTag:"{account}"'
    window = f'datetime_geq:"{iso(start)}", datetime_leq:"{iso(end)}"'

    if args.calls:
        rows = gql(token, '{ viewer { accounts(filter:{%s}) { aiInferenceAdaptiveGroups(limit:1000, filter:{%s}, orderBy:[datetime_ASC]) '
                          '{ dimensions { datetime modelId neurons errorCode inferenceTimeMs } count } } } }' % (flt, window))
        print(f"{'time (UTC)':20} {'model':32} {'neurons':>9} {'ms':>7}  error")
        total = 0.0
        for r in rows:
            d = r["dimensions"]
            n = d.get("neurons") or 0
            total += n * r["count"]
            print(f"{d['datetime'][:19].replace('T', ' '):20} {d['modelId'].split('/')[-1]:32} {n:>9.2f} {d.get('inferenceTimeMs') or 0:>7}  {d.get('errorCode') or ''}")
        print(f"{sum(r['count'] for r in rows)} call(s), {total:,.2f} neurons")
        return

    dim = "date" if args.by == "day" else "datetimeHour"
    rows = gql(token, '{ viewer { accounts(filter:{%s}) { aiInferenceAdaptiveGroups(limit:1000, filter:{%s}, orderBy:[%s_ASC]) '
                      '{ dimensions { %s modelId } count sum { totalNeurons } } } } }' % (flt, window, dim, dim))
    if not rows:
        print("No Workers AI usage in this window.")
        return
    per = {}
    print(f"{'when (UTC)':22} {'model':32} {'calls':>6} {'neurons':>10}")
    for r in rows:
        when = r["dimensions"][dim]
        n = r["sum"]["totalNeurons"] or 0
        per[when[:10]] = per.get(when[:10], 0) + n
        print(f"{when[:19].replace('T', ' '):22} {r['dimensions']['modelId'].split('/')[-1]:32} {r['count']:>6} {n:>10.2f}")
    print()
    print(f"{'day (UTC)':12} {'neurons':>10}  {'free left':>10}  {'over the free 10,000':>22}")
    for day in sorted(per):
        n = per[day]
        over = max(0.0, n - FREE_PER_DAY)
        print(f"{day:12} {n:>10.2f}  {max(0.0, FREE_PER_DAY - n):>10.2f}  {over:>10.2f} (about ${over / 1000 * USD_PER_1000:.4f})")
    print("A day here is a UTC day; check Cloudflare's own billing page for how it resets the free allowance.")


if __name__ == "__main__":
    main()
