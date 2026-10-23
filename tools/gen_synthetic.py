#!/usr/bin/env python3
"""Generate a large fake library to benchmark the shards.

Usage: python3 tools/gen_synthetic.py <out_src_dir> [rules=200000] [triggers_per_rule=5]
Then:  python3 tools/make_shard.py --src <out_src_dir> --out <out_data_dir>
"""
import json
import random
import sys
from pathlib import Path

out = Path(sys.argv[1])
n_rules = int(sys.argv[2]) if len(sys.argv) > 2 else 200_000
per_rule = int(sys.argv[3]) if len(sys.argv) > 3 else 5

rnd = random.Random(42)
syl = ["ka", "zo", "mi", "ra", "tu", "ne", "lo", "shi", "bo", "va", "pe", "du", "gri", "fon", "xel"]


def word():
    return "".join(rnd.choice(syl) for _ in range(rnd.randint(2, 4)))


rules = []
for i in range(n_rules):
    triggers = []
    for _ in range(per_rule):
        n = rnd.choices([1, 2, 3], weights=[8, 2, 1])[0]
        triggers.append(" ".join(word() for _ in range(n)))
    rules.append({"triggers": triggers, "replies": [f"gloomy reply {i}a", f"gloomy reply {i}b"]})

# Known probe so the benchmark can be checked by hand.
rules.append({"triggers": ["zorbakkle"], "priority": 5, "replies": ["You found the probe. How tragic."]})

(out / "rules").mkdir(parents=True, exist_ok=True)
persona = json.loads(Path("source/persona.json").read_text(encoding="utf-8"))
(out / "persona.json").write_text(json.dumps(persona), encoding="utf-8")
(out / "rules" / "synthetic.json").write_text(json.dumps({"rules": rules}), encoding="utf-8")
print(f"wrote {len(rules)} rules (~{len(rules) * per_rule} triggers) to {out}")
