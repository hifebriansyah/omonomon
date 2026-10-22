# Changelog

Each version is one commit. Newest first.

## 0.2.0 - Gemini replies through a Cloudflare Worker
- worker/worker.js calls Gemini with the character's persona; the page falls back to local rules when it fails.
- characters.json holds the characters; config.js holds the Worker address.
- tools/deploy_worker.py uploads the Worker with Python only.

## 0.1.0 - Rule-based ghost chat
- Static chat page (index.html, script.js, style.css) answering from local JSON rules.
- Persona and bilingual (EN/ID) rule sets: culture, daily life, emotions, life, safety, social, work and school.
- build.py shards the rules; tools/gen_synthetic.py makes test phrases.
- GitHub Pages deploy workflow.
