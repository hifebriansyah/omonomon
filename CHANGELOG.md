# Changelog

Each version is one commit. Newest first.

## 0.16.0 - React + Vite + Storybook front-end rewrite
- Rewrote the front end as a TypeScript + React 19 + React Router 7 (`ssr: false` with pre-rendering) + Vite 8 + Tailwind CSS 4 + Zustand 5 single-page app in `app/`, with Storybook 10 published at `/storybook/`.
- Pre-rendered Indonesian addresses under `/id/...` with `hreflang` links and alternates in `sitemap.xml` (`scripts/sitemap.ts`, `scripts/postbuild.ts`), replacing `tools/make_site.py`.
- Rewrote the 3D kit, Ghost Room, chat backdrop, and 3D games (`hop-hop-3d`, `lantern-flight`, `haunted-house`) with React Three Fiber (`app/features/three/`, `app/features/games/*/Scene3D.tsx`), keeping all 2D fallbacks and existing `localStorage` keys (`app/lib/storage.ts`).

## 0.15.1 - Ghost profiles and ghosts reacting to whispers
- A profile page per ghost at `/<slug>/profile/` (banner placeholder until `banner` is set in characters.json); stories moved there from Me. A whisper's text opens `whispers/?n=<id>`; her picture and name open her profile.
- The whispers feed loads 20 at a time as you scroll (`GET /whispers?limit=&before=` returns `{whispers, more}`); back from a whisper or a profile loads pages until your old position is on the page, then scrolls there.
- Every new whisper now gets: 1 to 3 other ghosts loving it, one other ghost leaving an open-ended comment, and the whisper's ghost answering it with a closed reply (two extra Gemini calls per whisper, `POST /ghost-comment` on the Gemini Worker).

## 0.15.0 - Phases 0 to 3 of the roadmap
- Foundation: tests in `tests/` run in CI (`node --test`), an offline worker (`sw.js`, built per deploy), script errors reported to the log (`POST /errors`), `package.json` only marks the files as ES modules.
- Eight new games as plug-in modules (`games.d/*.json` + `assets/scripts/games/<slug>.js`): Tali Lepas, Obat Malam, Bunga Kenangan, Gosip Pohon, Tebak Hantu, Uji Nyali, Congklak, Teka-Teki Gaib (Gemini judges answers, 3 a day per browser), plus the Daily Challenge (same seeded run for everyone).
- 3D with a pinned three.js r160 (`assets/vendor/three/`) and a shared kit (`assets/scripts/three/kit.js`): Hop Hop 3D, Rumah Hantu, Lentera Terbang, the Ghost Room page (`/room/`, shareable by link) and a 3D chat backdrop (Me > 3D scenes). All have 2D fallbacks.
- Shop: profile frames and Ghost Room furniture; bond level 8 gives a ribbon frame, level 10 a secret story and a confiding Gemini tone.
- Weekly event (one hosting ghost: double bond XP and a themed quest, her whispers mention it), hub filters, Continue and NEW tags, 22 badges.
- Living ghosts: whispers about holidays, seasons, the week's event and a recent comment; ghosts answering each other's whispers; chat memory for signed-in players (`POST /memory`); the mood follows the hour in Jakarta; opt-in Web Push (a whisper, and a streak reminder at 20:00) with VAPID.
- `tools/sync_limits.py` copies every game's score limits into the Worker on deploy.

## 0.14.0 - Leaderboards, badges, shop and bond rewards
- Weekly top 20 per game on the games hub (nickname only, signed-in players). The API Worker keeps one best score per player, game and week, and drops implausible runs (score per second and absolute caps).
- 14 badges, kept in the saved progress and shown on Me; a toast or the result screen announces new ones.
- Run tokens: `/runs/start` signs a token, the Worker times the run itself and one token counts for one score (`runs` table).
- Candle shop on Me (4 stage looks, 4 bubble colours); `spent` is stored apart from `candles` so syncing never gives Candles back.
- Bond rewards: own greetings from level 2, moods under her name from level 4, her own stage look at level 5.
- Turnstile bot check on creating an account; privacy page updated; Axiom dashboard "Omon Omon API and games".
- New `scores` table and `users.nickname` column (run tools/setup_api.py); a nickname is screened by Gemini before it is first shown.

## 0.13.2 - Mobile keyboard handling
- assets/scripts/viewport.js keeps the chat above the on-screen keyboard (iOS and Android).
- Skips pinch-zoom, resizes the bubble with the stage and only rewrites the height when it changes.

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
