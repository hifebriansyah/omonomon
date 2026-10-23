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

    python3 tools/make_images.py   # assets/img -> builds/img
    python3 build.py               # source/    -> builds/data
    python3 -m http.server 8000    # open http://localhost:8000

## Deploy
Repo Settings > Pages > Source: **GitHub Actions**. Every push to `main` runs
`tools/make_images.py` and `build.py` and publishes. Everything in `builds/` is generated and git-ignored.

## Benchmark
    python3 tools/gen_synthetic.py /tmp/syn
    python3 build.py --src /tmp/syn --out /tmp/syn-data

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
  restored on reload. Nothing is sent to a server for this. History > Clear chat deletes one character's chat.

## Code layout
```
index.html, style.css, config.js, characters.json   the page, its look, settings, characters
assets/scripts/    the page logic, split into small ES modules (see main.js for the map)
  main.js          start-up: loads data, builds the picker, wires the buttons
  state.js         shared data (current character, saved chats, ...)
  dom.js           every page element the scripts use
  util.js          small helpers (hash and tokenizer, kept in sync with build.py)
  rules.js         lookup in the local rule library (builds/data/)
  replies.js       safety rule, then Gemini (via the Worker), then backup replies
  storage.js       saved chats in localStorage
  stage.js         the big character, comic bubbles, picker, history panel (view only)
  chat.js          sending, showing and clearing messages; switching characters
  composer.js      the message box: length limit, counter, sending
assets/img/        your big original art, 2048px (not published)
builds/            everything Python generates (never edit by hand):
  img/             web images made from assets/img by tools/make_images.py:
                   thumbnails for the picker, stage/ holds the big cutouts
  data/            the reply library made by build.py
                   (all of builds/ is git-ignored and rebuilt on every deploy)
source/, build.py  the rule library source and the script that builds builds/data/
worker/            the Cloudflare Worker (Gemini proxy and character prompts)
tools/             make_images.py, deploy_worker.py, gen_synthetic.py
```
New module? Add a `<link rel="modulepreload">` line for it in `index.html` (the page then downloads all
modules at once instead of one import at a time; `build.py` warns if one is missing).
The scripts use ES modules, so open the site through a web server (`python3 -m http.server`),
not by double-clicking `index.html`.

## Characters
The page has a picker with four ghost characters (`characters.json`, web images in `builds/img/`;
the 2048px originals are in `assets/img/` and are not published):

| id | name | personality |
|---|---|---|
| `pocomon` | Pocomon (pocong, purple bow) | gloomy and the most direct: blunt, no sugarcoating; also has the 700-rule JSON library as backup |
| `sustemon` | Sustemon (suster ngesot) | busy big sister: brisk, nagging out of love, no pet names for you |
| `sundemon` | Sundemon (sundel bolong, sunflower) | the most despairing: bleak, hollow, resigned; never tells you to give up, softens if you sound hopeless |
| `kuntimon` | Kuntimon (kuntilanak) | hyper and the most curious about you: asks one nosy question every reply |

- Each character has its own chat and memory; switching keeps the other chats.
- Personas live in `worker/worker.js` (`CHARACTERS`), so visitors can't swap prompts.
  **After editing a persona, run `python3 tools/deploy_worker.py`.**
- If Gemini fails: Pocomon uses the JSON library; the others use a few backup lines
  from `characters.json` (`fallback`). Crisis phrases always use the local safety rule.
- Add a character: put the big PNG (white background is fine) in `assets/img/<name>.png`, add an entry
  to `characters.json` (`image`: `builds/img/<name>.png`, `stage`: `builds/img/stage/<name>.png`), run
  `python3 tools/make_images.py` (needs `pip3 install pillow`) to cut out the background
  and make the web images (GitHub Actions does the same on deploy), and add a matching block in `CHARACTERS` in `worker/worker.js`.

## Look
Comic style: the selected character is shown big on a halftone panel in her accent colour.
Her reply appears in a speech bubble (typed out letter by letter, click to skip); your last
message is the small bubble at the bottom right. The History button opens the full log.
