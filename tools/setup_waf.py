#!/usr/bin/env python3
"""Create the Cloudflare edge rules that keep scanners away from the Workers. No Node, stdlib only. Safe to repeat:
it replaces the two rules this script owns (the zone's entrypoint rulesets for these two phases).

    python3 tools/setup_waf.py

Why: every request that reaches a Worker counts toward the free plan's 100,000 requests a day, even when the Worker
answers 403 at once. New hostnames are probed by scanners within minutes of their certificate going public. Requests
blocked here never reach the Worker and cost nothing.

  1. Custom rule: block requests to the Worker hostnames that do not carry one of the site's Origin headers.
     (Browsers on your site always send it, scanners and curl do not.)
  2. Rate limit: at most 40 requests per 10 seconds per IP to those hostnames; the rest are blocked for 10 seconds.
     (The free plan allows one rule with a 10 second period; it catches scripts that fake the Origin header.)
     The limit is generous on purpose: mobile networks (Indonesia especially) put many people behind one shared address,
     and a low limit blocked real visitors. Leaving a country out of the limit would be better, but that needs a paid plan
     ("ip.src.country" is not allowed in free rate limiting rules). The page also sends few requests (taps on a heart are
     combined into one), and each Worker has its own limits as well.
     The API Worker's /img/ pictures are left out of both rules: <img> tags send no Origin, and the Worker answers from the edge cache.
     The Gemini Worker's /whisper and /comment routes are left out: only the API Worker calls them, always from the same
     Cloudflare address, so a few people commenting at once would otherwise trip the limit for everybody. They stay
     protected by the Origin rule above, the secret INTERNAL_TOKEN and the Worker's own limits.

The API token in .env needs Zone > Zone WAF > Edit on the zone.
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_worker import call, load_env, read_config  # noqa: E402

def quoted(items):
    return " ".join(f'"{i}"' for i in items)


def main():
    load_env()
    token, account = os.environ.get("CLOUDFLARE_API_TOKEN"), os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        sys.exit("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env")
    base = os.environ.get("CLOUDFLARE_API_BASE", "https://api.cloudflare.com/client/v4")

    configs = [read_config("gemini"), read_config("api")]
    hosts = [c["domain"] for c in configs]
    origins = sorted({o.strip() for c in configs for o in c["vars"]["ALLOWED_ORIGINS"].split(",") if o.strip()})
    zone_name = ".".join(hosts[0].split(".")[-2:])
    zones = call(base, token, "GET", f"/zones?name={zone_name}").get("result") or []
    if not zones:
        sys.exit(f"Zone {zone_name} not found (or the token cannot read it)")
    zone = zones[0]["id"]

    on_workers = f"http.host in {{{quoted(hosts)}}}"
    internal = f'(http.host eq "{configs[0]["domain"]}" and http.request.uri.path in {{"/whisper" "/comment"}})'
    # the redrawn article pictures (/img/<n>.jpg on the API Worker) are loaded by <img> tags, which send no Origin
    pictures = f'(http.host eq "{configs[1]["domain"]}" and starts_with(http.request.uri.path, "/img/"))'
    no_origin = f"not any(http.request.headers[\"origin\"][*] in {{{quoted(origins)}}})"
    rules = {
        "http_request_firewall_custom": [{
            "action": "block",
            "description": "Omon Omon: Worker hostnames only for requests that carry the site's Origin",
            "expression": f"({on_workers} and {no_origin} and not {pictures})",
        }],
        "http_ratelimit": [{
            "action": "block",
            "description": "Omon Omon: at most 40 requests per 10 seconds per IP to the Workers",
            "expression": f"({on_workers} and not {internal} and not {pictures})",
            "ratelimit": {"characteristics": ["cf.colo.id", "ip.src"], "period": 10, "requests_per_period": 40, "mitigation_timeout": 10},
        }],
    }
    for phase, phase_rules in rules.items():
        res = call(base, token, "PUT", f"/zones/{zone}/rulesets/phases/{phase}/entrypoint", {"rules": phase_rules})
        if res.get("success"):
            print(f"ok {phase}: {phase_rules[0]['description']}")
        else:
            sys.exit(f"{phase} failed: {'; '.join(e.get('message', '?') for e in res.get('errors', []))}")
    print(f"Hostnames covered: {', '.join(hosts)}")
    print(f"Allowed origins: {', '.join(origins)}")


if __name__ == "__main__":
    main()
