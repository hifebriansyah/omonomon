# Changelog

Each version is one commit. Newest first.

## 0.5.1 - Local Apache support
- .htaccess so the site runs under local Apache with the same routes.
- build.py moved to tools/make_shard.py.

## 0.5.0 - Routing and SEO
- assets/scripts/router.js gives each character its own address.
- tools/make_site.py generates per-character pages, sitemap and structured data; tools/build_all.py runs every step.
- Lucide icons, history panel and stage polish.

## 0.4.1 - Installable web app
- manifest.webmanifest and app icons from make_images.py.

## 0.4.0 - Split the page script into ES modules
- script.js replaced by assets/scripts/ (chat, composer, dom, main, replies, rules, stage, state, storage, util).
- Lighter character art; .DS_Store files kept out of the repo.

## 0.3.0 - Comic-style stage
- Big character on stage with comic speech bubbles and a redesigned layout.
- tools/make_images.py builds the character cutouts.
- Rule and persona wording fixes.

## 0.2.0 - Gemini replies through a Cloudflare Worker
- worker/worker.js calls Gemini with the character's persona; the page falls back to local rules when it fails.
- characters.json holds the characters; config.js holds the Worker address.
- tools/deploy_worker.py uploads the Worker with Python only.

## 0.1.0 - Rule-based ghost chat
- Static chat page (index.html, script.js, style.css) answering from local JSON rules.
- Persona and bilingual (EN/ID) rule sets: culture, daily life, emotions, life, safety, social, work and school.
- build.py shards the rules; tools/gen_synthetic.py makes test phrases.
- GitHub Pages deploy workflow.
