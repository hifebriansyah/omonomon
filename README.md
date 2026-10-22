# Pocowomon

Gloomy chatbot driven by pure JSON, no AI. Static, built for GitHub Pages.
Languages: English (`en`) and Indonesian (`id`).

## Content layout
- `source/persona.json`: per-language greeting, fallback replies and stopwords
  (stopwords are only used to detect which language the user is writing in).
- `source/rules/<topic>.<lang>.json`: rules, e.g. `daily.en.json`, `daily.id.json`.

Rule file:

    {"lang": "en", "rules": [{"triggers": ["rain", "how are you"], "priority": 0, "replies": ["..."]}]}

Matching: higher `priority` wins, then a rule in the user's language, then the longer
phrase. Rules that still tie share the turn at random. `safety.*.json` (priority 100)
answers crisis phrases with a caring, non-gloomy reply; keep it intact.

## Add a language (e.g. Spanish)
1. Add `"es": {"greeting": ..., "fallback": [...], "stopwords": [...]}` under `languages` in `persona.json`.
2. Add `source/rules/*.es.json` files with `"lang": "es"`. Write them natively, not as translations.
3. Add a Spanish `safety.es.json` with local crisis resources.

## Run locally
    python3 build.py
    python3 -m http.server 8000   # open http://localhost:8000

## Deploy
Repo Settings > Pages > Source: **GitHub Actions**. Every push to `main` runs
`build.py` and publishes. `data/` is generated and git-ignored.

## Benchmark
    python3 tools/gen_synthetic.py /tmp/syn
    python3 build.py --src /tmp/syn --out /tmp/syn-data
