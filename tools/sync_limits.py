#!/usr/bin/env python3
"""Copy every game's score limits (the "limits" object of games.json and games.d/*.json) into worker/api.js, between the
BEGIN/END SCORE_LIMITS markers. deploy_worker.py runs this before it uploads the API Worker; running it again changes nothing.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def all_games():
    games = json.loads((ROOT / "games.json").read_text(encoding="utf-8"))["games"]
    for f in sorted((ROOT / "games.d").glob("*.json")):
        games.append(json.loads(f.read_text(encoding="utf-8")))
    return games


def main():
    lines = []
    for g in all_games():
        lim = g.get("limits")
        if g.get("ready") and lim:
            lines.append(f'  "{g["slug"]}": {{ perSec: {lim["perSec"]}, slack: {lim["slack"]}, max: {lim["max"]} }},')
    block = ("// BEGIN SCORE_LIMITS (written by tools/sync_limits.py from the \"limits\" of every game in games.json and games.d/)\n"
             "const SCORE_LIMITS = {\n" + "\n".join(lines) + "\n};\n// END SCORE_LIMITS")
    path = ROOT / "worker" / "api.js"
    text = path.read_text(encoding="utf-8")
    new = re.sub(r"// BEGIN SCORE_LIMITS.*?// END SCORE_LIMITS", lambda m: block, text, flags=re.S)
    if new != text:
        path.write_text(new, encoding="utf-8")
    print(f"score limits for {len(lines)} games in worker/api.js")


if __name__ == "__main__":
    main()
