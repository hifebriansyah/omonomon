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
    python3 build.py
    python3 -m http.server 8000   # open http://localhost:8000

## Deploy
Repo Settings > Pages > Source: **GitHub Actions**. Every push to `main` runs
`build.py` and publishes. `data/` is generated and git-ignored.

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

## Characters
The page has a picker with four ghost characters (`characters.json`, images in `img/`;
the 2048px originals stay in `assets/` and are not published):

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
- Add a character: put the big PNG (white background is fine) in `assets/`, add an entry
  to `characters.json` (`image`: `img/<name>.png`, `stage`: `img/stage/<name>.png`), run
  `python3 tools/make_images.py` (needs `pip3 install pillow`) to cut out the background
  and make the web images, and add a matching block in `CHARACTERS` in `worker/worker.js`.

## Look
Comic style: the selected character is shown big on a halftone panel in her accent colour.
Her reply appears in a speech bubble (typed out letter by letter, click to skip); your last
message is the small bubble at the bottom right. The History button opens the full log.
