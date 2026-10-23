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
not the repo root: the repo's `index.html` is only the template, and `/pocomon/` exists only in `builds/site/`.)

If your local server serves the repo folder itself (e.g. Apache at `/for-fun/chat-learning/`), run
`python3 tools/build_all.py --dev`: it runs the same builds, but writes only the `/<slug>/` and `/<slug>/history/` pages next to
`index.html` (git-ignored), so refreshing on those addresses works there too. Rerun it after editing
`index.html` or `characters.json`.

Or use the repo's `.htaccess` instead of `--dev`: it maps `/<slug>/` and `/<slug>/history/` to the pages in
`builds/site/` (run `python3 tools/build_all.py` first). Apache needs `LoadModule rewrite_module ...` enabled and
`AllowOverride FileInfo` (or `All`) on the web folder in `httpd.conf`, then `brew services restart httpd`.

## Deploy
Repo Settings > Pages > Source: **GitHub Actions**. Every push to `main` runs `tools/build_all.py` and
publishes `builds/site/`. `builds/` (which holds `builds/site/`) is generated and git-ignored.

## Addresses and SEO
GitHub Pages cannot route, so `tools/make_site.py` writes one real HTML file per address, from `index.html`:

| address | page | indexed |
|---|---|---|
| `/` | home: shows whoever you talked to last | yes |
| `/<slug>/` e.g. `/pocomon/` | that character on stage | yes |
| `/<slug>/history/` | her chat history panel open | no (`noindex`) |

Each page has its own `<title>`, description, canonical link, Open Graph and Twitter tags, a 1200x630 share
picture (`builds/img/share/`), JSON-LD, and the character links already in the HTML. Also generated: `404.html`
(a real 404), `sitemap.xml` and `robots.txt`. In the browser, `router.js` makes the picker, the History button
and Back/Forward move between these addresses without reloading, and keeps the title and meta tags current.

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

The API key never goes in the page. It lives in a Cloudflare Worker (`worker/worker.js`),
which also holds the persona prompt, caps reply length and only accepts requests from
your site's origin.

Setup (no Node needed):
1. Get a key at https://aistudio.google.com/apikey (use a dedicated key/project).
2. dash.cloudflare.com > Workers & Pages > Create > Hello World > name it > Deploy >
   Edit code > paste `worker/worker.js` > Deploy.
3. Worker > Settings > Variables and Secrets:
   - `GEMINI_API_KEY` (type **Secret**) = your key
   - `ALLOWED_ORIGINS` = `https://YOURNAME.github.io,http://localhost:8000`
   - optional: `GEMINI_MODEL` (default `gemini-3.8-flash`), `THINKING_BUDGET` = `0`
4. Put the worker URL in `config.js` as `WORKER_URL`, commit and push.

Instruction privacy: Gemini occasionally echoes part of its instructions (for example after a vague
message like "kenapa?"). Before a reply is returned, the Worker drops any sentence that repeats 7 or more
words in a row from the private instructions (not the examples), and asks Gemini again if nothing real is
left; if it still fails, the page shows its backup reply. Replies that leak nothing pass through unchanged.
The Worker's log says "stripped leaked instructions" when it happens. It catches word-for-word repeats only,
not paraphrases.

Cost safety: the origin check only stops other websites, not scripts that fake the
Origin header. Prefer a free-tier key (hard rate limits), or set a quota/budget cap on
the Google Cloud project, and watch usage.

## Auto-deploy the Worker on push
Instead of pasting `worker/worker.js` into the dashboard each time:
1. Push this repo to GitHub.
2. Cloudflare dashboard > Workers & Pages > your Worker > Settings > Builds > Connect.
3. Pick the GitHub repo and branch `main`. Set **Root directory** to `/worker`.
   Leave the build command empty; keep the deploy command `npx wrangler deploy`.
4. (Optional) Build watch paths: `worker/*`, so only worker changes trigger a deploy.
5. Push a change to `worker/worker.js`; the Worker updates itself (see the Builds tab).

`worker/wrangler.jsonc` must keep `"name"` equal to your Worker's name.

## Deploy the Worker from your machine (no Node, no GitHub)
1. Cloudflare dashboard > My Profile > API Tokens > Create Token > template
   **Edit Cloudflare Workers** (or a custom token with Account > Workers Scripts > Edit).
2. Account ID: Workers & Pages overview page, right-hand side.
3. `cp .env.deploy.example .env.deploy` and fill in both values (file is git-ignored).
4. `python3 tools/deploy_worker.py` after every edit to `worker/worker.js`.

## Limits
- `INPUT_MAX_CHARS` in `config.js` (default 200) caps what a visitor can type; the Worker also cuts every
  message to 300 characters (`MAX_CHARS`), because a page-only limit can be bypassed.
- `HISTORY_TURNS` (default 8) is how many earlier messages go to Gemini.

- Chats are saved per character in the visitor's own browser (`localStorage`, last 60 messages each) and
  restored on reload. Nothing is sent to a server for this. History > Clear deletes one character's chat.

## Code layout
```
index.html, style.css, config.js, characters.json   the page template, its look, settings, characters
site.json          site address, name and home page text (SEO)
assets/scripts/    the page logic, split into small ES modules (see main.js for the map)
  main.js          start-up: loads data, builds the picker, wires the buttons
  state.js         shared data (current character, saved chats, ...)
  dom.js           every page element the scripts use
  util.js          small helpers (hash and tokenizer, kept in sync with tools/make_shard.py)
  rules.js         lookup in the local rule library (builds/data/)
  replies.js       safety rule, then Gemini (via the Worker), then backup replies
  storage.js       saved chats in localStorage
  stage.js         the big character, comic bubbles, picker, history panel (view only)
  chat.js          sending, showing and clearing messages; switching characters
  composer.js      the message box: length limit, counter, sending
  router.js        addresses (/<slug>/, /<slug>/history/) and the page <head>
assets/img/        your big original art, 2048px (not published)
assets/icons/      notes and license for the Lucide icons pasted inline in index.html (not published)
builds/            everything Python generates (never edit by hand):
  img/             web images (WebP, about 6x smaller than PNG) made from assets/img by
                   tools/make_images.py: thumbnails for the picker, stage/ holds the big cutouts
                   and the site icons (favicon.ico from favicon.png; app icons from appicon.png)
  data/            the reply library made by tools/make_shard.py
                   (all of builds/ is git-ignored and rebuilt on every deploy)
source/            the rule library source (tools/make_shard.py builds it into builds/data/)
worker/            the Cloudflare Worker (Gemini proxy and character prompts)
tools/             build_all.py, make_images.py, make_shard.py, make_site.py, deploy_worker.py, gen_synthetic.py
```
New module? Add a `<link rel="modulepreload">` line for it in `index.html` (the page then downloads all
modules at once instead of one import at a time; `tools/make_shard.py` warns if one is missing).
The scripts use ES modules, so open the site through a web server (`python3 -m http.server`),
not by double-clicking `index.html`. Serve `builds/site/` (see Run locally).

## Characters
The page has a picker with four ghost characters (`characters.json`, web images in `builds/img/`;
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
- Personas live in `worker/worker.js` (`CHARACTERS`), so visitors can't swap prompts.
  **After editing a persona, run `python3 tools/deploy_worker.py`.**
- If Gemini fails: Pocomon uses the JSON library; the others use a few backup lines
  from `characters.json` (`fallback`). Crisis phrases always use the local safety rule.
- Add a character: pick the next id (say `5`), put the big PNG (white background is fine) in `assets/img/5.png`,
  add an entry to `characters.json` (`id`: `"5"`, `image`: `builds/img/5.webp`, `stage`: `builds/img/stage/5.webp`),
  add `"5": {...}` to `CHARACTERS` in `worker/worker.js`, and run `python3 tools/make_images.py`
  (needs `pip3 install pillow`; GitHub Actions does the same on deploy) to cut out the background and make the web images.

## Site icons (two separate sets)
| Source (you edit) | Becomes | Used for |
|---|---|---|
| `assets/img/favicon.png` | `builds/img/favicon.ico` (16/32/48 px, **transparent**) | the browser tab |
| `assets/img/appicon.png` | `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` (opaque) | phone home screens, Android/Chrome install |

`python3 tools/make_images.py` builds both sets. For the favicon, the white background of your picture is removed
(only the white connected to the outside edge, like the characters), so draw it on plain white or already
transparent. The app icon stays a full opaque square, which phones need. `index.html` links only the favicon
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
