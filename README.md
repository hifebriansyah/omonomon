# Pocomon

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
Needs Python 3 and Pillow (`pip3 install pillow`). Run both builds once, and again after you change
the source rules or the original art in `assets/img/`:

    python3 tools/build_all.py          # images, rule shards, then the site pages in builds/site/
    python3 -m http.server -d builds/site     # open http://localhost:8000

(`build_all.py` runs `tools/make_images.py`, `tools/make_shard.py` and `tools/make_site.py` in that order. Serve `builds/site/`,
not the repo root: the repo has only templates (`chat.html`, `shell.html`), and the real pages such as `/pocomon/`
exist only in `builds/site/`.)

If your local server serves the repo folder itself (e.g. Apache at `/for-fun/chat-learning/`), the repo's `.htaccess`
maps `/`, `/<slug>/`, `/<slug>/history/`, `/games/...`, `/me/`, `sitemap.xml` and `robots.txt` to the pages in
`builds/site/` (run `python3 tools/build_all.py` first, and again after editing `chat.html`, `shell.html`,
`characters.json` or `games.json`). Apache needs `LoadModule rewrite_module ...` enabled and
`AllowOverride FileInfo` (or `All`) on the web folder in `httpd.conf`, then `brew services restart httpd`.

## Deploy
Repo Settings > Pages > Source: **GitHub Actions**. Every push to `main` runs `tools/build_all.py` and
publishes `builds/site/`. `builds/` (which holds `builds/site/`) is generated and git-ignored.

## Addresses and SEO
GitHub Pages cannot route, so `tools/make_site.py` writes one real HTML file per address. The app works like WhatsApp:
a chat list with a bottom tab bar (Chats, Games, Me); opening a ghost opens her chat with a back arrow.

| address | page | template | indexed |
|---|---|---|---|
| `/` | chat list: the four ghosts, newest chat first with last message and time (Chats tab) | `shell.html` | yes |
| `/<slug>/` e.g. `/pocomon/` | that character's chat | `chat.html` | yes |
| `/<slug>/history/` | her chat history panel open | `chat.html` | no (`noindex`) |
| `/games/`, `/games/<slug>/` | the game hub (Games tab) and one game (no tab bar) | `shell.html` | yes |
| `/me/` | guest profile, candles, bond levels, Privacy link (Me tab) | `shell.html` | no (`noindex`) |
| `/privacy/` | privacy page | `privacy.html` | yes |

Each page has its own `<title>`, description, canonical link, Open Graph and Twitter tags, a 1200x630 share
picture (`builds/img/share/`), JSON-LD, and the character links already in the HTML. Also generated: `404.html`
(a real 404), `sitemap.xml` and `robots.txt`. In the browser, `router.js` makes the History button
and Back/Forward move between these addresses without reloading, and keeps the title and meta tags current.

- Each chat remembers the view it was left in (`ghostmode:v1:<id>` in localStorage). The chat list links a chat to
  `/<slug>/history/` when it was last left in history, and to `/<slug>/` otherwise. Clearing a chat resets it.
- The first time a ghost is shown, the browser stores that time (`ghostseen:v1:<id>`). It is the time on a chat-list row
  without a chat and the date of her greeting in the history panel, like a new WhatsApp contact.
- The **slug** is the address and is its own field in `characters.json` (next to the numeric id), so renaming a
  label does not have to change the URL. Changing a slug changes a public link: do it rarely.
- Page text lives in `characters.json` (`seo.tagline`, `seo.description` with `{name}`) and `site.json`
  (site address, name, home title and description). `site.json` > `url` must match your custom domain.
- The head text is built twice, in `tools/make_site.py` and `headFor()` in `router.js`: change both together.
- `<base href>` is `./`, `../` or `../../` per page, so the site also works from a sub-folder.

## Benchmark
    python3 tools/gen_synthetic.py /tmp/syn
    python3 tools/make_shard.py --src /tmp/syn --out /tmp/syn-data

## Gemini replies (optional)
The page asks Gemini first and falls back to the local JSON rules if Gemini is
unreachable, slow (`TIMEOUT_MS`) or out of quota. Crisis phrases (priority 100) are
always answered by the local safety rule and never sent to Gemini.

The API key never goes in the page. It lives in a Cloudflare Worker, **omonomon-gemini**
(`worker/gemini.js`, at `geminimon.securhat.com`), which also holds the persona prompt, caps reply length and only accepts
requests from your site's origin. It does only two things: Gemini replies and the request log (Axiom). Everything else
(accounts, game progress, later features) lives in the separate **omonomon-api** Worker (`worker/api.js`,
at `apimon.securhat.com`), so nothing there can touch the Gemini key or budget.

Setup (no Node needed):
1. Get a key at https://aistudio.google.com/apikey (use a dedicated key/project).
2. Deploy from your machine (see "Deploy the Workers" below): `python3 tools/deploy_worker.py`.
3. dash.cloudflare.com > Workers & Pages > omonomon-gemini > Settings > Variables and Secrets:
   add `GEMINI_API_KEY` (type **Secret**) = your key. Deploys keep it. The other settings (`ALLOWED_ORIGINS`,
   `THINKING_BUDGET`) are plain variables kept in `worker/gemini.jsonc` and set on every deploy; optional
   `GEMINI_MODEL` (default `gemini-3.8-flash`) can be added there too.
4. `WORKER_URL` in `config.js` is the Worker's domain (`https://geminimon.securhat.com/`). Commit and push.

Instruction privacy: Gemini occasionally echoes part of its instructions (for example after a vague
message like "kenapa?"). Before a reply is returned, the Worker drops any sentence that repeats 7 or more
words in a row from the private instructions (not the examples), and asks Gemini again if nothing real is
left; if it still fails, the page shows its backup reply. Replies that leak nothing pass through unchanged.
The Worker's log says "stripped leaked instructions" when it happens. It catches word-for-word repeats only,
not paraphrases.

Cost safety: the origin check only stops other websites, not scripts that fake the
Origin header. Prefer a free-tier key (hard rate limits), or set a quota/budget cap on
the Google Cloud project, and watch usage.

## Deploy the Workers (from your machine, no Node, no GitHub)
1. Cloudflare dashboard > My Profile > API Tokens > Create Token with: Account > Workers Scripts > Edit,
   Account > D1 > Edit (for omonomon-api), Zone > Workers Routes > Edit and Zone > DNS > Edit on your domain.
2. Account ID: Workers & Pages overview page, right-hand side.
3. `cp .env.example .env` and fill in the values (file is git-ignored; `AXIOM_TOKEN` is optional).
4. Deploy after every edit:

       python3 tools/deploy_worker.py        # omonomon-gemini (worker/gemini.js, settings in worker/gemini.jsonc)
       python3 tools/setup_api.py            # once: the D1 database for omonomon-api
       python3 tools/deploy_worker.py api    # omonomon-api (worker/api.js, settings in worker/api.jsonc)

   Each deploy also attaches the Worker's domain and turns its workers.dev address off.

## Limits
- `INPUT_MAX_CHARS` in `config.js` (default 200) caps what a visitor can type; the Worker also cuts every
  message to 300 characters (`MAX_CHARS`), because a page-only limit can be bypassed.
- `HISTORY_TURNS` (default 8) is how many earlier messages go to Gemini.
- The Worker allows 20 requests a minute per IP (`ratelimits` in `worker/gemini.jsonc`, sent as a Cloudflare
  rate-limit binding by `tools/deploy_worker.py`). The `Origin` check only stops other websites: a script can fake
  that header, so this limit is what slows scripts down. Over the limit the Worker answers 429 and the page
  shows a 429 line in the character's voice (`busy` in `characters.json`; kept out of Gemini's context). Other failures use the
  backup replies, and after 3 in a row the status line shows `trouble` until the next success. For a stronger guard add a Cloudflare WAF rate-limiting rule on the Worker's own domain.

- Chats are saved per character in the visitor's own browser (`localStorage`, last 60 messages each) and
  restored on reload. Nothing is sent to a server for this. The chat list's ... menu > Clear chat deletes one character's chat.

## Games
`/games/` lists the mini-games and `/games/<slug>/` is one game (built by `tools/make_site.py` from `shell.html` and
`games.json`; a game only gets a page once `"ready": true`). Code is in `assets/scripts/games/`: `progress.js`
(candles, bond XP per ghost, best scores, daily candle cap, saved in this browser), `text.js` (EN/ID words),
`hub.js`, `runner.js` (**Hop Hop**, Pocomon's endless runner) and `main.js`. New game: add it to `games.json`, write
its module, reuse `recordRun()` for rewards. Plan and status: `GAMIFICATION.md`.

## Accounts and saved progress (omonomon-api)
Optional. Without it, candles, bonds and best scores are kept in this browser only (guest mode). With it, a player can
sign in with Google on the Me page and their progress follows them across devices.

- `worker/api.js` is the **omonomon-api** Cloudflare Worker (separate from the Gemini one, so it can never touch the Gemini budget) with a D1 database named `omonomon`
  (`worker/schema.sql`: users, sessions, progress). It verifies Google's ID token (signature, issuer, audience, expiry),
  creates the account on first sign-in, and gives back a random session token (only its SHA-256 hash is stored).
  Endpoints: `POST /auth/google`, `GET /me`, `PUT /progress`, `POST /auth/logout`, `DELETE /me`.
  Progress is merged, never overwritten: for every number the larger value wins. Numbers are capped and odd keys dropped.
- Client: `assets/scripts/games/account.js` (sign-in, refresh, sign out, delete account, push after each run) and the
  Me page. The session token is kept in `localStorage` (Bearer header, not a cookie, so sign-in also works on localhost).
- Setup (needs an API token with Account > D1 > Edit; the other permissions are the ones the chat Worker already uses):

      python3 tools/setup_api.py           # create the D1 database and its tables (writes worker/api-db.json)
      python3 tools/deploy_worker.py api   # upload worker/api.js (settings in worker/api.jsonc) and attach apimon.securhat.com

  Then set `API_URL` in `config.js` and push. The sign-in button appears only when `API_URL` is set.
- Google console: the OAuth client needs `https://omonomon.securhat.com` and `http://localhost` as authorized
  JavaScript origins. The client ID is public (`config.js` and `worker/api.jsonc`); the client secret is not used.
- Privacy: the account stores the Google id and email only. Chat logs are never linked to accounts. Delete account on the
  Me page removes the user, sessions and progress.

## Request log (Axiom, optional)
If the Worker has the secret `AXIOM_TOKEN` (an ingest-only token for one dataset), it sends one line per request to
Axiom: time, status, error word, character id, Gemini calls, upstream status, country, duration, **and the
visitor's IP address, their message and the reply**. That is personal data, so the site needs a privacy notice
that says so, and the dataset's retention (30 days by default) should stay short. Set the Worker text variable
`LOG_CHAT` to `off` to log only the technical fields. Optional text variables on the Worker:
`AXIOM_DATASET` (default `omonomon`) and `AXIOM_URL` (the dataset's edge address; default
`https://us-east-1.aws.edge.axiom.co`, the other is `https://eu-central-1.aws.edge.axiom.co`; it must match the account's region). Without the token nothing is sent. Useful questions to ask the data: how many 429s
per hour, which character is busiest, how many Gemini calls (cost), which countries.

## Code layout
```
chat.html, style.css     the chat page template and its look (the chat screens)
shell.html, app.css      the template and look of the app pages (chat list, games, me)
config.js, characters.json, games.json   settings, characters, games
site.json          site address, name and home page text (SEO)
assets/scripts/shell/   the app pages: main.js (entry), home.js (chat list), me.js
assets/scripts/games/   progress, hub, Hop Hop, words (text.js)
assets/scripts/    the page logic, split into small ES modules (see main.js for the map)
  main.js          start-up: loads data, shows the route, wires the buttons
  state.js         shared data (current character, saved chats, ...)
  dom.js           every page element the scripts use
  util.js          small helpers (hash and tokenizer, kept in sync with tools/make_shard.py)
  rules.js         lookup in the local rule library (builds/data/)
  replies.js       safety rule, then Gemini (via the Worker), then backup replies
  storage.js       saved chats in localStorage
  stage.js         the big character, comic bubbles, header, history panel (view only)
  chat.js          sending, showing and clearing messages; switching characters
  composer.js      the message box: length limit, counter, sending
  router.js        addresses (/<slug>/, /<slug>/history/) and the page <head>
assets/img/        your big original art, 2048px (not published)
assets/icons/      notes and license for the Lucide icons pasted inline in chat.html and the site generator (not published)
builds/            everything Python generates (never edit by hand):
  img/             web images (WebP, about 6x smaller than PNG) made from assets/img by
                   tools/make_images.py: thumbnails for the chat list, stage/ holds the big cutouts
                   and the site icons (favicon.ico from favicon.png; app icons from appicon.png)
  data/            the reply library made by tools/make_shard.py
                   (all of builds/ is git-ignored and rebuilt on every deploy)
source/            the rule library source (tools/make_shard.py builds it into builds/data/)
worker/            the Cloudflare Workers: gemini.js (Gemini proxy, character prompts, request log) and api.js (accounts, progress)
tools/             build_all.py, make_images.py, make_shard.py, make_site.py, deploy_worker.py, setup_api.py, gen_synthetic.py
```
New module? Add a `<link rel="modulepreload">` line for it in `chat.html` (the page then downloads all
modules at once instead of one import at a time; `tools/make_shard.py` warns if one is missing).
The scripts use ES modules, so open the site through a web server (`python3 -m http.server`),
not by double-clicking a template. Serve `builds/site/` (see Run locally).

## Characters
The chat list has four ghost characters (`characters.json`, web images in `builds/img/`;
the 2048px originals are in `assets/img/` and are not published):

| id | name (a label) | personality |
|---|---|---|
| `1` | Pocomon (pocong, purple bow) | gloomy and the most direct: blunt, no sugarcoating; also has the 700-rule JSON library as backup |
| `2` | Ngesomon (suster ngesot) | busy big sister: brisk, nagging out of love, no pet names for you |
| `3` | Sundemon (sundel bolong, sunflower) | the most despairing: bleak, hollow, resigned; never tells you to give up, softens if you sound hopeless |
| `4` | Kuntimon (kuntilanak) | hyper and the most curious about you: asks one nosy question every reply |

**The id is a number and never changes; the name is only a label.** Everything that must stay put is keyed by
the number: saved chats in people's browsers (`ghostchat:v1:2`), the Worker's persona (`CHARACTERS["2"]`),
the original art (`assets/img/2.png`) and the generated images (`builds/img/2.webp`). So you can rename a
character by editing only `name` (and the greeting/typing text that mentions it) in `characters.json`: her
saved history, images and persona are untouched. Saved chats don't store the greeting, so even that
text follows the new name. New character: use the next number (highest + 1) and never reuse a retired one.
Keep names out of the `greeting`, `fallback` and `status` text (say "Hey!", not "Hey! Ngesomon here"), so a rename is
one edit. `python3 tools/make_shard.py` warns if `characters.json`, the image names, the original art and the Worker drift apart,
or if a name appears in that text.

- Each character has her own chat and memory; switching keeps the other chats.
- Personas live in `worker/gemini.js` (`CHARACTERS`), so visitors can't swap prompts.
  **After editing a persona, run `python3 tools/deploy_worker.py`.**
- If Gemini fails: Pocomon uses the JSON library; the others use a few backup lines
  from `characters.json` (`fallback`). Crisis phrases always use the local safety rule.
- Add a character: pick the next id (say `5`), put the big PNG (white background is fine) in `assets/img/5.png`,
  add an entry to `characters.json` (`id`: `"5"`, `image`: `builds/img/5.webp`, `stage`: `builds/img/stage/5.webp`),
  add `"5": {...}` to `CHARACTERS` in `worker/gemini.js`, and run `python3 tools/make_images.py`
  (needs `pip3 install pillow`; GitHub Actions does the same on deploy) to cut out the background and make the web images.

## Site icons (two separate sets)
| Source (you edit) | Becomes | Used for |
|---|---|---|
| `assets/img/favicon.png` | `builds/img/favicon.ico` (16/32/48 px, **transparent**) | the browser tab |
| `assets/img/appicon.png` | `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` (opaque) | phone home screens, Android/Chrome install |

`python3 tools/make_images.py` builds both sets. For the favicon, the white background of your picture is removed
(only the white connected to the outside edge, like the characters), so draw it on plain white or already
transparent. The app icon stays a full opaque square, which phones need. `chat.html` links only the favicon
as `rel="icon"` and the app icon as `apple-touch-icon`, so the tab never shows the busy app icon.
If a source file is missing its set is skipped. Browsers cache favicons hard: after changing one,
hard-refresh or reopen the tab.

## Install as an app (PWA)
`manifest.webmanifest` makes the site installable ("Install app" in Chrome and Edge, "Add to Home screen"
on Android; iPhone uses the `apple-touch-icon`). Edit it for the name and colours. Its icons are
`builds/img/icon-192.png` and `icon-512.png`, which `make_images.py` builds from **`assets/img/appicon.png`**
(never from `favicon.png`, which is only the tab icon). `id` gives the installed app a fixed identity, so later edits to
`start_url` or the name don't make Chrome treat it as a different app. Don't rename or move
`manifest.webmanifest`: browsers then stop updating apps people already installed. There is deliberately no service worker, so
the installed app is the same site in its own window and still needs the internet (the chat does anyway).

## Look
Comic style: the selected character is shown big on a halftone panel in her accent colour.
Her reply appears in a speech bubble (typed out letter by letter, click to skip); your last
message is the small bubble at the bottom right. The History button opens the full log.
