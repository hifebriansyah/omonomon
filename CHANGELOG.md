# Changelog

Each version is one commit. Newest first.

## 0.13.1 - Deploy workflow fixes
- Workflow installs pillow, numpy and scipy; GitHub actions bumped to Node 24 versions.

## 0.13.0 - Whispers
- Whispers tab: every 3 hours a ghost posts a Gemini-written thought (cron on the API Worker).
- Anonymous comments with ghost replies, love counts and a Loved page on Me.
- tools/whisper_now.py forces a whisper.

## 0.12.0 - Three more mini-games
- Night Rounds, Quiet Wish and Hair Catch, with scene art from tools/make_scenes.py.

## 0.11.0 - Bond rewards, daily quests and streak
- Chat earns bond XP with level-up toasts; Gemini's tone follows the bond level.
- Daily quests, streak and ghost stories that unlock at bond levels 3 and 6.

## 0.10.1 - Logging on both Workers
- Axiom log lines from the API Worker too, with method, URL, status and browser type.

## 0.10.0 - Accounts and cloud save
- omonomon-api Worker (apimon.securhat.com) with D1 database and Google sign-in.
- Gemini Worker renamed to omonomon-gemini (geminimon.securhat.com).
- tools/setup_api.py and tools/setup_waf.py (Cloudflare WAF rules for the Worker hosts).

## 0.9.0 - WhatsApp-style app shell and first game
- shell.html with Chats, Games and Me tabs; the chat moves to chat.html.
- Games hub and Hop Hop (endless runner); candles and bond XP saved in the browser.

## 0.8.0 - Privacy page and gamification plan
- privacy.html added to the site and sitemap.
- GAMIFICATION.md: plan for mini-games, bonds, quests and accounts.

## 0.7.0 - Request log in Axiom
- The Worker sends one log line per request to Axiom when AXIOM_TOKEN is set.
- .env.example replaces .env.deploy.example; deploy_worker.py copies secrets without printing them.

## 0.6.0 - Rate limit and custom domain for the Worker
- Per-IP rate limit (20/min) via a Workers rate-limit binding; 429 shows a 'busy' line in the character's voice.
- Worker served from its own securhat.com subdomain.

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
