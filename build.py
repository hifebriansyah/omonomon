#!/usr/bin/env python3
"""Build the sharded response library for Pocomon.

Reads   source/persona.json (per-language greeting, fallback, stopwords)
        source/rules/*.json     ("lang" per file or per rule; default = defaultLang)
Writes  data/manifest.json
        data/shards/<n>.json    trigger -> [[ruleId, priority, langIndex], ...]
        data/replies/<n>.json   reply pools, REPLIES_PER_CHUNK rules per file

Triggers are bucketed by FNV-1a hash, so the browser can find the right shard
for any word without downloading an index. Keep normalize() and fnv1a() in
sync with script.js.

Usage: python3 build.py [--src source] [--out data]
"""
import argparse
import hashlib
import json
import math
import shutil
import sys
import unicodedata
from pathlib import Path

TRIGGERS_PER_SHARD = 1000
REPLIES_PER_CHUNK = 500


def normalize(text):
    """Lowercase, keep letters/digits/apostrophes, collapse whitespace."""
    out = []
    for ch in text.lower():
        keep = ch == "'" or ch.isspace() or unicodedata.category(ch)[0] in "LN"
        out.append(ch if keep else " ")
    return " ".join("".join(out).split())


def fnv1a(text):
    h = 0x811C9DC5
    for b in text.encode("utf-8"):
        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    return h


def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    path.write_text(data, encoding="utf-8")
    return data


def load_rules(rules_dir, default_lang):
    """Yield (lang, rule). A file's top-level "lang" is the default for its rules."""
    for f in sorted(rules_dir.glob("*.json")):
        raw = json.loads(f.read_text(encoding="utf-8"))
        if isinstance(raw, list):
            raw = {"rules": raw}
        for rule in raw["rules"]:
            yield rule.get("lang") or raw.get("lang") or default_lang, rule


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="source")
    ap.add_argument("--out", default="data")
    args = ap.parse_args()

    src, out = Path(args.src), Path(args.out)
    persona_file = json.loads((src / "persona.json").read_text(encoding="utf-8"))

    languages = persona_file["languages"]
    langs = list(languages)
    default_lang = persona_file["defaultLang"]
    if default_lang not in languages:
        sys.exit(f"defaultLang {default_lang!r} is not in persona.json languages")

    kept, index, max_gram, skipped = [], {}, 1, 0
    per_lang = {l: 0 for l in langs}
    for lang, rule in load_rules(src / "rules", default_lang):
        if lang not in languages:
            sys.exit(f"unknown lang {lang!r} (add it to persona.json): {rule.get('triggers')}")
        replies = [r for r in rule.get("replies", []) if isinstance(r, str) and r.strip()]
        triggers = {normalize(t) for t in rule.get("triggers", [])} - {""}
        if not replies or not triggers:
            skipped += 1
            continue
        rule_id = len(kept)
        kept.append(replies)
        per_lang[lang] += 1
        prio = int(rule.get("priority", 0))
        for t in triggers:
            max_gram = max(max_gram, t.count(" ") + 1)
            index.setdefault(t, []).append([rule_id, prio, langs.index(lang)])

    shard_count = max(1, math.ceil(len(index) / TRIGGERS_PER_SHARD))
    buckets = [{} for _ in range(shard_count)]
    for trigger, entries in index.items():
        buckets[fnv1a(trigger) % shard_count][trigger] = entries

    # Only wipe an existing build output, never an arbitrary folder.
    if out.exists():
        if not (out / "manifest.json").exists() and any(out.iterdir()):
            sys.exit(f"{out} exists and is not a build output; refusing to wipe it")
        shutil.rmtree(out)

    digest = hashlib.sha1()
    for i, bucket in enumerate(buckets):
        digest.update(dump(out / "shards" / f"{i}.json", bucket).encode())
    chunks = math.ceil(len(kept) / REPLIES_PER_CHUNK)
    for c in range(chunks):
        pool = kept[c * REPLIES_PER_CHUNK:(c + 1) * REPLIES_PER_CHUNK]
        digest.update(dump(out / "replies" / f"{c}.json", pool).encode())

    manifest = {
        "version": digest.hexdigest()[:10],
        "persona": persona_file["persona"],
        "langs": langs,
        "defaultLang": default_lang,
        "languages": languages,
        "shards": shard_count,
        "maxGram": max_gram,
        "chunkSize": REPLIES_PER_CHUNK,
    }
    dump(out / "manifest.json", manifest)

    print(f"rules: {len(kept)} kept, {skipped} skipped (no triggers or replies)")
    print("per language: " + ", ".join(f"{l}={n}" for l, n in per_lang.items()))
    print(f"triggers: {len(index)}  shards: {shard_count}  reply chunks: {chunks}")
    print(f"version: {manifest['version']}")


if __name__ == "__main__":
    main()
