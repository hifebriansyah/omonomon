#!/usr/bin/env python3
"""Build the sharded response library for Pocomon.

Reads   source/persona.json (per-language greeting, fallback, stopwords)
        source/rules/*.json     ("lang" per file or per rule; default = defaultLang)
Writes  builds/data/manifest.json
        builds/data/shards/<n>.json    trigger -> [[ruleId, priority, langIndex], ...]
        builds/data/replies/<n>.json   reply pools, REPLIES_PER_CHUNK rules per file

Triggers are bucketed by FNV-1a hash, so the browser can find the right shard
for any word without downloading an index. Keep normalize() and fnv1a() in
sync with assets/scripts/util.js.

Usage: python3 tools/make_shard.py [--src source] [--out builds/data]
"""
import argparse
import hashlib
import json
import os
import re
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


# Folders and files a character page must not shadow (each character's page lives at /<slug>/).
RESERVED_SLUGS = {"assets", "builds", "history", "worker", "source", "tools", "404", "privacy", "games", "me", "leaderboard"}


def check_characters():
    """A character's id ties together characters.json, the image file names, the original art
    and the Worker's persona. The id never changes (the "name" is only a label); warn if they drift."""
    chars_file, worker_file = Path("characters.json"), Path("worker/worker.js")
    if not (chars_file.exists() and worker_file.exists()):
        return
    data = json.loads(chars_file.read_text(encoding="utf-8"))
    worker = worker_file.read_text(encoding="utf-8")
    block = worker[worker.index("const CHARACTERS = {"):worker.index("const DEFAULT_CHARACTER")]
    worker_ids = set(re.findall(r'^  "([0-9]+)": \{$', block, re.M))
    ids = [c["id"] for c in data["characters"]]
    problems = []
    if len(set(ids)) != len(ids):
        problems.append("characters.json has duplicate ids")
    if data["default"] not in ids:
        problems.append(f'default character "{data["default"]}" is not in the list')
    for c in data["characters"]:
        i = c["id"]
        if not re.fullmatch(r"[0-9]+", i):
            problems.append(f'id "{i}" should be a number (digits only, never taken from a name)')
        if i not in worker_ids:
            problems.append(f'"{i}" has no persona in worker/worker.js (CHARACTERS)')
        for key, want in (("image", f"builds/img/{i}.webp"), ("stage", f"builds/img/stage/{i}.webp")):
            if c.get(key) != want:
                problems.append(f'{i}: "{key}" should be {want}')
        if not Path(f"assets/img/{i}.png").exists():
            problems.append(f"{i}: original art assets/img/{i}.png not found")
        for lang in ("en", "id"):
            if not c.get("busy", {}).get(lang):
                problems.append(f'{i}: "busy" needs at least one line in "{lang}" (shown when the Worker says 429)')
        slug = c.get("slug", "")
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug) or slug in RESERVED_SLUGS:
            problems.append(f'{i}: slug "{slug}" must be lowercase letters/digits/hyphens and not one of {sorted(RESERVED_SLUGS)}')
        seo = c.get("seo", {})
        if not seo.get("tagline") or "{name}" not in seo.get("description", ""):
            problems.append(f'{i}: "seo" needs a tagline and a description that uses {{name}} (not the literal name)')
    slugs = [c.get("slug") for c in data["characters"]]
    if len(set(slugs)) != len(slugs):
        problems.append("characters.json has duplicate slugs")
    # Names live only in "name". Text that repeats one would have to be edited on every rename.
    labels = [c["name"] for c in data["characters"]]
    def strings(o):
        if isinstance(o, str):
            yield o
        elif isinstance(o, list):
            for x in o:
                yield from strings(x)
        elif isinstance(o, dict):
            for x in o.values():
                yield from strings(x)
    for c in data["characters"]:
        for field in ("greeting", "fallback", "status"):
            for text in strings(c.get(field, "")):
                for label in labels:
                    if label.lower() in text.lower():
                        problems.append(f'{c["id"]}: {field} mentions "{label}"; keep names only in "name"')
    for extra in sorted(worker_ids - set(ids)):
        problems.append(f'worker/worker.js has a persona "{extra}" that is not in characters.json')
    for p in problems:
        print(f"WARNING: {p}")


def main():
    os.chdir(Path(__file__).resolve().parent.parent)  # paths below are relative to the project folder
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="source")
    ap.add_argument("--out", default="builds/data")
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
        "langs": langs,
        "defaultLang": default_lang,
        "languages": languages,
        "shards": shard_count,
        "maxGram": max_gram,
        "chunkSize": REPLIES_PER_CHUNK,
    }
    dump(out / "manifest.json", manifest)

    if not Path("builds/img/stage").exists():
        print("NOTE: no images yet. Run: python3 tools/make_images.py (needs: pip3 install pillow)")

    check_characters()

    # Every script module should be preloaded in index.html (otherwise the page loads
    # them in slow one-import-at-a-time waves). A missing entry is only slower, not broken.
    page = Path("index.html")
    if page.exists():
        html = page.read_text(encoding="utf-8")
        for f in sorted(Path("assets/scripts").glob("*.js")):
            if f"assets/scripts/{f.name}" not in html:
                print(f"WARNING: assets/scripts/{f.name} is not preloaded in index.html")

    print(f"rules: {len(kept)} kept, {skipped} skipped (no triggers or replies)")
    print("per language: " + ", ".join(f"{l}={n}" for l, n in per_lang.items()))
    print(f"triggers: {len(index)}  shards: {shard_count}  reply chunks: {chunks}")
    print(f"version: {manifest['version']}")


if __name__ == "__main__":
    main()
