# Big-bang refactor: React + Vite + Storybook

Plan for rewriting the Omon Omon front end as a React single-page app. Written 2026-10-31, checked against the repo
the same day.

## Where things stand
Checked against `main` on 2026-10-31 (clean tree, 45 `checkpoint` commits, last one 2026-10-29):
- **`refactor/react` does not exist yet.** There is only `main` and `backup/checkpoints`. Phase 0 creates the branch.
- Nothing of the rewrite has started: no React, Vite or Storybook files, and `package.json` only has
  `"test": "node --test tests/*.test.mjs"`.
- The newest work on `main` (2026-10-29) is the whisper "sticky note" picture: a Python renderer in `vercel/`
  that draws the whisper share image, with its scripts in `tools/` and routes in `worker/`. It is out of scope for the
  rewrite (see "Vercel note renderer").
- Every `checkpoint` commit on `main` after the freeze (phase 0) has to be ported to the branch by hand, so keep the
  freeze short.

## Goals
1. React instead of plain ES modules and HTML templates.
2. Storybook for every UI component.
3. A single-page app: moving between pages never reloads.
4. React Router for addresses.
5. Recent, **stable** libraries only (see "Library rules").
6. Tests come later, in their own phase (see "Tests").
7. Vite builds it.

## Decisions taken
| Topic | Decision |
|---|---|
| Language | TypeScript (strict) |
| SEO and deep links | Keep one pre-rendered HTML file per address, so every public page keeps its own title, meta, Open Graph and JSON-LD. React takes over in the browser. |
| Styling | Tailwind CSS. `app.css` and `style.css` are rewritten as utilities plus a small `@theme` of design tokens. |
| Build tools | Only the page building moves to Node (React Router prerender). **No `.py` file is ported**: the image, scene, shard and ops scripts and the Vercel renderer stay Python (see "Build scripts: Python stays"). `make_site.py` is removed, not ported. |
| Saved data | Same localStorage keys and value shapes as today. Nobody loses chats or progress. |
| 3D games | Rewritten with React Three Fiber. |
| PWA / offline | Kept. |
| AdSense | Kept. |
| i18n (en/id) | Kept. Indonesian gets its own indexed addresses under `/id/`. |
| Storybook | Published with the site at `/storybook/` (not indexed). |
| Old browsers | Not supported. Visitors on one see a "your browser is too old" banner. |
| Cloudflare Workers | Not part of the rewrite. `worker/` stays as it is. |
| Vercel note renderer | Not part of the rewrite and not changed (decided 2026-10-31). It draws the whisper share image on Vercel with Python. |
| Scope | Everything is ported. Nothing is dropped, including sub-folder hosting (see "Everything is ported"). |
| Where | A long-lived branch `refactor/react` in this repo, merged to `main` once. |

### Rules this overturns
`ROADMAP.md` lists "Python tooling and plain ES modules; no Node build step" as a constraint (line 8, and again near
line 78: "It still fits 'no Node build'"). This refactor drops the Node half only: the front end now has a Node build
(Vite and React Router), but the Python tooling stays for pictures, shards, ops and Vercel. Update `ROADMAP.md`, `README.md` (its setup says Python
only and "no Node needed": add Node and the new order of steps; the deploy steps are unchanged) and `CLAUDE.md` in the same merge. `CHANGELOG.md`,
`GAMIFICATION.md` and `assets/scripts/games/README.md` mention the old file layout too: fix their paths.

These rules still hold: free hosting (GitHub Pages, Cloudflare Workers, D1), nothing secret in the repo, character IDs are numbers, every public page goes in the sitemap, slugs are public addresses and do not change.

## Library rules
- Use the newest **major** that has been out at least 3 months and has had patch releases since. No `alpha`, `beta`, `rc`, `canary`, `next` or `experimental` tags.
- Pin exact versions in `package.json` (no `^` or `~`) and commit the lockfile.
- Check each pick on npm at kickoff and write the chosen versions into the table below.
- When two libraries work together (React + R3F, Vite + React Router + Storybook), pick versions their docs say are compatible. If one isn't ready for the newest major of another, stay one major back.

| Need | Library | Version (fill in at kickoff) |
|---|---|---|
| Runtime | Node.js, the current Active LTS (24.x) | 24.22.0 (`.nvmrc`: 24) |
| Package manager | npm | 11.19.1 (project `.npmrc` points at registry.npmjs.org, `save-exact`) |
| Build | Vite | 8.3.5 |
| UI | React + React DOM 19.x | 19.3.1 (R3F 9 supports < 19.4) |
| Router + pre-render | React Router 7.x, framework mode with `ssr: false` and `prerender` | 7.18.5 (`react-router`, `@react-router/dev`, `@react-router/node`) |
| Types | TypeScript 5.x (not the native-port preview) | 5.9.3 |
| Styling | Tailwind CSS 4.x with `@tailwindcss/vite` | 4.3.3 |
| Components | Storybook (current stable major) with `@storybook/react-vite` | 10.6.5 (+ `@storybook/addon-a11y`, `eslint-plugin-storybook`) |
| 3D | `three`, `@react-three/fiber` 9.x, `@react-three/drei` (the major that matches R3F 9) | three 0.185.1, R3F 9.8.2, drei 10.7.9 |
| App state | Zustand 5.x | 5.0.16 |
| i18n | i18next + react-i18next | 26.5.12 + 17.1.9 |
| PWA | vite-plugin-pwa (Workbox) | **Changed:** `workbox-build` 7.4.1 (`getManifest` in `scripts/postbuild.ts`) + `workbox-window` 7.4.1. React Router writes the pre-rendered pages after Vite's client build ends, so a Vite plugin would precache before the pages exist; vite-plugin-pwa 2.x was also under 3 months old. |
| Icons | lucide-react (ISC) | 1.65.0 |
| Bot check (first-visit redirect) | isbot | 5.1.32 |
| Lint and format | ESLint 9 (flat config) + typescript-eslint + Prettier | ESLint 9.39.5, typescript-eslint 8.72.1, Prettier 3.9.10, react-hooks 7.1.1 |
| Tests (later phase) | Vitest + React Testing Library + Playwright | not installed yet |

## Target architecture

### Folder layout
```
app/
  root.tsx               layout, <Meta/>, <Links/>, tab bar, toasts, error boundary, old-browser check
  routes.ts              the route table
  routes/                one file per address (loader, meta, component)
  components/            shared UI (Bubble, Avatar, TabBar, Toast, Sheet, ...) each with a .stories.tsx
  features/
    chat/                composer, replies, rules matcher, Gemini client, history
    whispers/            feed, comments, loves
    games/               hub, runner, rounds, progress, quests, achievements, cosmetics
      <game-slug>/       one folder per game: logic.ts (pure), Game.tsx (view), *.stories.tsx
    three/               R3F scenes, shared kit, stage, Ghost Room
    account/             Google sign-in, Turnstile, cloud save, push
    ads/                 AdSense slot
    report/              error reporter (port of report.js: sends page errors to the API Worker, max 5 per visit)
  lib/                   storage, time, util, viewport, config
  i18n/                  en.ts, id.ts, setup
  styles/app.css         @import "tailwindcss" and @theme tokens
content/                 characters.json, games.json, games.d/, site.json, stories.json, source/ (moved, unchanged;
                         today these sit in the repo root, and source/ holds persona.json and rules/)
scripts/                 sitemap.ts only (the Python scripts stay in tools/)
public/                  manifest, icons, static art
worker/                  unchanged
.storybook/
```

### Routes
Same public addresses as today, plus an Indonesian copy of each under `/id/` (see i18n). Every address is pre-rendered
into its own `index.html` at build time, once per language.

| Address (English) | Indonesian | Route file | Indexed |
|---|---|---|---|
| `/` | `/id/` | `routes/home.tsx` (chat list, Chats tab) | yes |
| `/:slug/` | `/id/:slug/` | `routes/chat.tsx` | yes |
| `/:slug/history/` | `/id/:slug/history/` | `routes/chat.tsx` (history open) | no |
| `/:slug/profile/` | `/id/:slug/profile/` | `routes/profile.tsx` (banner, stories, latest whispers, her games) | yes |
| `/whispers/` | `/id/whispers/` | `routes/whispers.tsx` (`?n=<id>` opens one whisper) | no |
| `/whispers/:slug/` | `/id/whispers/:slug/` | `routes/whispers.tsx` (that ghost's share picture) | no |
| `/loved/` | `/id/loved/` | `routes/loved.tsx` | no |
| `/games/` | `/id/games/` | `routes/games.tsx` | yes |
| `/games/:game/` | `/id/games/:game/` | `routes/game.tsx` | yes |
| `/room/` | `/id/room/` | `routes/room.tsx` (Ghost Room, 3D) | no |
| `/me/` | `/id/me/` | `routes/me.tsx` | no |
| `/privacy/` | `/id/privacy/` | `routes/privacy.tsx` | yes |
| `*` | | `404.html` | no |
| `/storybook/` | | Storybook build (see Storybook) | no |

Checked against `tools/make_site.py` on 2026-10-31: every address it writes (chat list, chats, history, profile, whispers,
whispers per ghost, loved, games, one game, me, privacy, `404.html`) is in this table. `/room/` is linked from Me
(`room/`) and is in the plan. Re-check at the end of phase 0 in case `main` added one.

- Each route's `meta()` export builds title, description, canonical link, `hreflang` links, Open Graph, Twitter tags
  and robots. This replaces both `tools/make_site.py` and `headFor()` in `router.js`, so the head text is written once,
  not twice.
- JSON-LD comes from the same `meta()` (or a `<script type="application/ld+json">` in the route).
- `sitemap.xml` and `robots.txt` are written by a build script from the same route list.
- `prerender()` in `react-router.config.ts` reads `characters.json` and `games.json` to list the addresses.
- Sub-folder hosting is kept: see "Sub-folder hosting" near the end.
- Things that only work in the browser (localStorage, `window`, the R3F `<Canvas>`, AdSense, Google sign-in) must not run during pre-render. Read them in `useEffect`, in a `clientLoader`, or behind a `<ClientOnly>` wrapper. Otherwise pre-rendered HTML and the first browser render won't match (a hydration mismatch).

### State
- Zustand stores per feature (`useChatStore`, `useProgressStore`, `useAccountStore`, ...), each saved with a small
  hand-written persistence layer that reads and writes the **existing keys** (below). Don't use Zustand's `persist`
  middleware as-is: it wraps values in `{state, version}` and would break today's format.
- Content JSON (`characters.json`, rules, games) is imported at build time or fetched once, then cached.

### localStorage compatibility
Keys found in the code on 2026-10-31 (grep of `assets/scripts/`). The new app must read and write these exactly, in the
same value shape. `localStorage`:

| Key | Holds | Defined in |
|---|---|---|
| `ghostchat:v1:<id>` | chat history with one ghost | `storage.js` |
| `ghostmode:v1:<id>` | view the chat was left in (chat or history) | `storage.js` |
| `ghostseen:v1:<id>` | time the ghost was first shown | `storage.js` |
| `ghostgame:v1` | game progress: candles, bond XP, quests, streak, best scores, cosmetics | `games/progress.js` |
| `ghostgame:session` | sign-in session token (random value; the API stores only its hash) | `games/account.js` |
| `ghostloved:v1` | loved whispers | `shell/loved-store.js` |
| `ghostwhisper:seen` | newest whisper the visitor has seen (badge on the tab) | `shell/whisper-badge.js` |
| `ghostnick` | nickname shown next to comments | `shell/identity.js` |
| `ghostdevice` | random device id for comments | `shell/identity.js` |
| `ghostmine` | numbers of the comments this browser posted (shows a delete button) | `shell/identity.js` |
| `ghostlast` | last game opened | `games/hub.js` |
| `ghost3d` | 3D prefs | `games/prefs3d.js` |
| `ghostlang` | chosen language | `games/text.js` |
| `ghostriddle:done` | riddles already solved (Teka-Teki Gaib) | `games/ghost-riddles.js` |

`sessionStorage` (per tab, so a loss costs nothing, but keep the names): `ghostwhisper:checked` and
`ghostwhisper:checked:new` (last whisper check, `whisper-badge.js`), and the per-address scroll position in
`shell/scroll-memory.js`.

Still to do at kickoff: read the values' exact shapes from the code (the table above gives names and purpose, not types),
write a TypeScript type for each, and add any key a later `main` commit introduces. Keep one `lib/storage.ts` as the only
place that touches storage.

Also: `ghostlang` today is a plain preference. Under the new i18n rules the address decides the language, so
`ghostlang` is kept (same key, same values) only as the saved choice used by the first-visit redirect.

### i18n
- Move the `TEXT` table in `games/text.js` and the chat-page strings into `i18n/en.ts` and `i18n/id.ts`. Function
  values (`sayTo(name)`) become i18next interpolation (`"Say something to {{name}}..."`) and plurals.
- **The address decides the page language.** No prefix is English, `/id/...` is Indonesian. Both are pre-rendered,
  so search engines index the Indonesian pages too.
- Every page links its other-language copy with `<link rel="alternate" hreflang="en|id|x-default">`, and the sitemap
  lists both copies with `xhtml:link` alternates. Canonical links point at each page's own language.
- Slugs are the same in both languages (`/pocomon/` and `/id/pocomon/`).
- The language switch on Me navigates to the same page in the other language and saves the choice.
- On the first visit to an English page, a browser set to Indonesian (or with a saved choice of `id`) is sent to the
  `/id/` copy in the browser. Never do this for search engine bots, and do it only once per visit so Back still works.
- Saved data (chats, progress) is shared between the two languages: the localStorage keys don't include the language.
- Keep the chat's own language detection from `persona.json` stopwords as it is. The ghost answers in the language you
  type in, whatever the page language.
- Whispers come from the API in both languages today; check how the API picks one, and pass the page language.

### Chat engine
Port `chat.js`, `replies.js`, `rules.js`, `composer.js` and the rule shards as **pure TypeScript with no React or DOM**
in `features/chat/engine/`. The React side only calls it. Behaviour must stay exactly the same: Gemini first,
timeout from config, fall back to local rules, priority 100 safety rules always win and are never sent to Gemini.

### Games
- Every game is split into `logic.ts` (pure state and rules, no DOM, no timers you can't control) and a React view.
  Today's tests already exercise the rules of most games, so the logic split makes them easy to port later.
- The shared pieces (`runner`, `rounds`, `progress`, `quests`, `achievements`, `cosmetics`, `daily`, `event`,
  `leaderboard`) become hooks and stores.
- Game data stays in `games.d/*.json` and `games.json`.
- All games are ported, including the 2D versions of the 3D games.

### 3D (React Three Fiber)
- Rewrite `three/kit.js`, `three/room.js`, `three/stage3d.js`, the 3D games (`hop-hop-3d`, `haunted-house`,
  `lantern-flight` and any other game that uses `stage3d`), the Ghost Room and the 3D chat backdrop as R3F components.
- Drop the vendored `assets/vendor/three/three.module.min.js`; `three` comes from npm. Keep its licence notice in
  the built site.
- Load each 3D scene with `React.lazy`, so the home page doesn't download three.js.
- Keep the 3D prefs (`prefs3d.js`) and the 2D fallbacks for phones without WebGL2 or with low power.

### Styling (Tailwind)
- Put colours, fonts, radii and spacing from `app.css` and `style.css` into `@theme` tokens first, then build
  components with utilities.
- Keep the dark-first paint: `<html class="dark">`, `color-scheme: dark` and an inline background colour in
  `root.tsx`, so there is no white flash.
- Lucide icons: use `lucide-react` (same ISC licence) instead of the copied SVGs.
- Visual parity is checked in Storybook against screenshots of the current site (see "Parity check").

### PWA
- `vite-plugin-pwa` generates the service worker and precaches the hashed build output and art. Port the behaviour of
  `sw.js` (offline shell, games playable offline) and keep `manifest.webmanifest`.
- Use `registerType: "prompt"` (or auto-update with a reload prompt) so a new deploy replaces old scripts. Hashed
  file names from Vite also fix the "stale scripts after a deploy" problem in the roadmap.
- **The old `sw.js` must be replaced cleanly.** The new worker must have the same URL (`/sw.js`) so browsers
  update it instead of keeping the old one, and it must delete the old caches on `activate`.
- Web Push (`tests/push.test.mjs`, `VAPID_PUBLIC_KEY`) must keep working: port the push handler into the new worker.
- Keep `/storybook/` out of the precache.

### AdSense
An `<AdSlot>` component that loads the AdSense script once, only in the browser, and shows a slot every
`site.json > ads.every` messages, as today. Never during pre-render. In Storybook, a grey placeholder.

### Config
`config.js` (`window.POCO_CONFIG`) becomes `VITE_*` values + a typed `lib/config.ts`. Today it holds `WORKER_URL`,
`GOOGLE_CLIENT_ID`, `API_URL`, `TURNSTILE_SITE_KEY`, `VAPID_PUBLIC_KEY`, `INPUT_MAX_CHARS`, `HISTORY_TURNS` and
`TIMEOUT_MS`. All of them are public by design, so they may be committed in a `.env.production`. No secret ever goes into
a `VITE_` variable.

Careful: the repo root already has a **git-ignored `.env`** with secrets for the ops scripts (`VERCEL_TOKEN`,
`NOTE_RENDER_TOKEN`, Cloudflare tokens, ...). Vite reads `.env` too, but only exposes `VITE_*` keys to the browser. Put the
public values in `.env.production` (committed) and keep secrets in `.env` with no `VITE_` prefix. Add a build check that
fails if a `VITE_` name contains `TOKEN`, `SECRET` or `KEY` (`TURNSTILE_SITE_KEY` and `VAPID_PUBLIC_KEY` are the allowed
public ones). `.env.example` is updated to match.

### Storybook
- One `*.stories.tsx` next to every component in `components/` and every game view.
- Global decorators: Tailwind CSS, dark background, i18n with a locale switch (en/id) in the toolbar, a
  `MemoryRouter`, and a fake storage so stories never touch real localStorage.
- Stories for each state that matters: empty chat, long history, Gemini thinking, error, offline; game start, playing,
  game over, new best; whisper with and without comments.
- Use `@storybook/addon-a11y`. Interaction tests and visual tests come in the tests phase.
- Build Storybook in CI (`build-storybook`) so broken stories fail the build.
- **Publish it** with the site at `/storybook/`: copy `storybook-static/` into the Pages output. Keep it out of the
  sitemap, add `Disallow: /storybook/` to `robots.txt`, and keep it out of the PWA precache.
- Stories must never call the real Workers (Gemini, API): mock every fetch, so a public Storybook can't spend quota.

### Old browsers
No support for old browsers, but tell the visitor instead of showing a broken page.
- **Minimum:** what Tailwind CSS 4 needs (Safari 16.4, Chrome 111, Firefox 128). Set Vite's `build.target` to match.
  It also covers ES modules, `:has()` and `color-mix()`.
- **Check:** a small inline script in `root.tsx`, written in old JavaScript (ES5, no arrow functions), that runs before
  the app: `if (!window.CSS || !CSS.supports("color", "color-mix(in srgb, red, blue)"))`. Also add a
  `<script nomodule>` with the same message for browsers without ES modules.
- **Message:** a plain HTML banner at the top (not `window.alert`), in the page language from the address: "Your
  browser is too old for Omon Omon. Please update it, or open the site in a recent Chrome, Safari or Firefox." /
  "Browser kamu terlalu lama untuk Omon Omon. Perbarui dulu, atau buka di Chrome, Safari atau Firefox terbaru."
  Styled inline (Tailwind won't work there), dismissible, and the app still tries to start under it.
- **3D:** a phone without WebGL2 is not "too old". 3D games and the Ghost Room fall back to their 2D version or show
  their own short message.
- Add a story for the banner, and check it once in an old Safari on BrowserStack or a real old iPhone.

## Build scripts: Python stays
Decided 2026-10-31: **no `.py` file is ported.** Every script in `tools/` and `vercel/` stays Python and keeps working.
The one thing that goes away is `tools/make_site.py`, and that is not a port: React Router's `prerender` replaces the
pages it wrote (see "Routes"), so the script has no job left.

| Script | Fate | Notes |
|---|---|---|
| `tools/make_images.py` | stays (Pillow) | writes `builds/img/` (stage cut-outs, thumbnails, favicon, app icons) |
| `tools/make_scenes.py` | stays (Pillow, numpy, scipy) | writes `builds/img/scenes/` and `builds/img/heads/` |
| `tools/make_shard.py` | stays | writes `builds/data/` (manifest, shards, replies) from `source/` |
| `tools/gen_synthetic.py`, `remake_image.py`, `make_grid_image.py`, `make_split_image.py`, `make_note_image.py` | stay | benchmark and image helpers, not on the build path |
| `tools/deploy_worker.py`, `setup_api.py`, `setup_waf.py`, `sync_limits.py`, `whisper_now.py`, `neuron_usage.py`, `deploy_vercel.py` | stay | ops scripts; they do not touch the front end |
| `tools/build_all.py` | edited, not ported | drop the `make_site.py` step; it then runs images, scenes and shards only |
| `tools/make_site.py` | **removed** | replaced by React Router `prerender`, `meta()` and a small `scripts/sitemap.ts` (new code, see below) |

What this means for the build:
- The pipeline becomes `python3 tools/build_all.py` (fills `builds/img/` and `builds/data/`), then `npm run build`.
  `npm run build` does not run Python itself; CI and the README run both, in that order.
- Vite copies `builds/img/` and `builds/data/` into `build/client/builds/...` (a small copy step or a plugin with
  `publicDir`), so the **addresses stay the same** (`builds/img/...`, `builds/data/...`) and `characters.json` image paths
  and the Worker's share-image links keep working. Check `characters.json`, `site.json` and the Worker for every
  `builds/` path before choosing the output layout.
- The only new Node scripts are `scripts/sitemap.ts` (writes `sitemap.xml`, `robots.txt` from the route list: this used
  to be inside `make_site.py`) and the 404 page. `make_site.py` also copied `sw.js` and filled it in, which
  `vite-plugin-pwa` now does (see PWA), and copied `assets/vendor/three/` (replaced by `three` from npm).
- `tools/make_shard.py` says its `normalize()` and `fnv1a()` must stay in sync with `assets/scripts/util.js`. The
  chat engine is ported to TypeScript, so keep the same pair in `features/chat/engine/` and note the rule in both files:
  if either side changes, shards no longer match the browser. Check it once in the tests phase (hash a list of words in
  Python and in TypeScript, compare).
- Because Python stays, the repo still needs Python 3 with Pillow, numpy and scipy to build the pictures and shards.
  Keep that in `README.md`; only the page-building step drops out.

## Vercel note renderer (out of scope)
New on `main` since the first draft of this plan (2026-10-29). `vercel/` holds a Python serverless function
(`api/render.py`, `note_render.py`, `requirements.txt`, `vercel.json`, the Comic Neue font) that draws the sticky-note
picture used as the share image of a whisper. `worker/api.js` and `worker/edge.js` call it (`NOTE_RENDER_URL` in
`worker/api.jsonc`). Decided 2026-10-31: **it has nothing to do with the React rewrite, and nothing in it changes.**
- `vercel/` stays exactly as it is, in Python, and keeps deploying the way it does today. Do not touch it on the branch.
- `tools/deploy_vercel.py`, `tools/make_note_image.py`, `tools/make_grid_image.py` and `tools/make_split_image.py` are
  part of the same side system. They stay in Python in `tools/`, like every other Python script (see "Build scripts:
  Python stays").
- The React app only sees one thing: the whisper share image address. Keep it the same. The parity check already
  covers `/whispers/:slug/` meta, so also open one shared whisper link and check its preview picture still loads.
- `.env` keeps `VERCEL_TOKEN` and `NOTE_RENDER_TOKEN` for these scripts (see "Config").

## CI (`.github/workflows/pages.yml`)
Today the workflow runs on every push to `main`: `setup-python` 3.12, `pip install pillow numpy scipy`,
`node --test tests/*.test.mjs` (all tests), `python3 tools/build_all.py` (pictures, shards and pages), then uploads
`builds/site`. Its action versions
(checkout v6, configure-pages v6, upload-pages-artifact v5, deploy-pages v5) already run on Node 24; keep them. The branch
changes it like this:
- Keep `setup-python`, add `actions/setup-node` with the LTS from the table, `npm ci`.
- Order: `python3 tools/build_all.py`, then `npm run lint`, `npm run typecheck`, `npm run build-storybook`, `npm run build`.
- Worker tests (`tests/worker.test.mjs`, `tests/push.test.mjs`) keep running: the Worker hasn't changed. Run them by
  name, not with `tests/*.test.mjs`, because the legacy tests move away (see "Tests").
- Deploys still trigger on `main` only. Add a `pull_request` run (build, no deploy) so the branch is checked while it
  is long-lived.
- Front-end tests are switched off until the tests phase (see below). Say so in the workflow comment.
- Upload `build/client` (React Router's output folder, with `storybook/` copied in) instead of `builds/site`.
- Python setup and `pip install pillow numpy scipy` **stay**, because `tools/build_all.py` still makes the pictures and
  rule shards. The step now runs before `npm run build` and no longer builds pages. Cache `builds/` between runs if the
  pictures are slow.

## Tests
Not part of the rewrite. Until the tests phase:
- Keep `tests/worker.test.mjs` and `tests/push.test.mjs` (they test `worker/`, which is unchanged).
- The 14 other tests in `tests/` import the old `assets/scripts/` files: `congklak`, `daily-and-riddles`, `dare-night`,
  `games`, `guess-the-ghost`, `haunted-house`, `hop-hop-3d`, `lantern-flight`, `memory-garden`, `night-meds`, `room`,
  `rope-untangle`, `stage3d` and `tree-gossip`. Move them to `tests/legacy/` on the branch and don't run them; they are
  the spec for porting the game rules. (`room` and `stage3d` are the spec for the pure parts of the Ghost Room and the 3D
  stage.)
- Per `CLAUDE.md`, nobody runs the unit tests unprompted. In the tests phase, run a single file with
  `node --test tests/<name>.test.mjs`, and the whole suite only when asked.

Tests phase, after the merge:
1. Port the legacy game tests to Vitest against `features/games/*/logic.ts`.
2. Unit tests for the chat engine and the storage layer (old-format data in, same data out).
3. Storybook interaction tests (`play` functions) run with the Vitest addon.
4. A few Playwright smoke tests on the built site: every pre-rendered address loads, has the right `<title>`, and works offline after the first visit.

## Phases on the branch
Sizes as in the roadmap: **S** an evening, **M** a day or two, **L** a week.

| # | Work | Size |
|---|---|---|
| 0 | Create `refactor/react` from `main` (it does not exist yet). Freeze features on `main` (bug fixes only, ported to the branch by hand). Take screenshots of every page and game at phone and desktop width as the parity baseline. Fill in the version table and add the value shapes to the localStorage key table. Copy the current `builds/site/` aside as the parity reference (pages, `sitemap.xml`, `robots.txt`). | S |
| 1 | Scaffold: Vite + React Router (framework, SPA + prerender) + TS + Tailwind + ESLint/Prettier + Storybook. `BASE_PATH` wired in from the start. Move content JSON into `content/` (this moves the paths `make_images.py`, `make_shard.py` and the Worker read: update them with the smallest edit, or keep the JSON where it is and only import it from `app/`). CI builds the empty shell. | M |
| 2 | `lib/` (storage with the old keys, config, time, util) and i18n. Design tokens in `@theme`. Base components + stories: TabBar, Avatar, Bubble, Toast, Sheet, Button, Icon. | M |
| 3 | Routes in both languages, layout, `meta()`, `hreflang`, pre-render list, sitemap, robots, 404, old-browser banner, Storybook published at `/storybook/`. Check the generated head of each page against the current site. | M |
| 4 | Chat: engine port, chat page, history, composer, Gemini client, chat memory, ads in chat. | L |
| 5 | Shell: home list, whispers (feed, comments, loves), ghost profiles, Me (profile, nickname, language, loved list, shop), privacy. | L |
| 6 | Games framework (hub, runner, rounds, progress, quests, achievements, cosmetics, leaderboard, daily, event) and the 2D games, including Teka-Teki Gaib. | L |
| 7 | R3F: kit, room, stage, 3D games, Ghost Room, 3D chat backdrop; 2D fallbacks wired in. | L |
| 8 | Account: Google sign-in, Turnstile, cloud save, push subscription. | M |
| 9 | PWA (service worker swap, offline, update prompt, Web Push). | M |
| 10 | Remove `make_site.py` and edit `build_all.py`; wire the Python outputs (`builds/img`, `builds/data`) into the Vite build; write `scripts/sitemap.ts`. New `.htaccess`. Delete the old templates (`chat.html`, `shell.html`, `privacy.html`), `config.js`, `sw.js`, `app.css`, `style.css`, `assets/scripts/` and `assets/vendor/`. **`tools/` and `vercel/` stay** (minus `make_site.py`). | M |
| 11 | Parity check (below), docs updated, merge to `main`. | M |

## Parity check before the merge
- Every address in the current `sitemap.xml` exists in the new build with the same title, description, canonical
  link, share image and robots value.
- Every `/id/` page exists, is in Indonesian from the first byte of HTML, and has correct `hreflang` links both ways.
- An old browser shows the "too old" banner in the right language.
- `/storybook/` loads, is not in the sitemap and makes no calls to the real Workers.
- A browser with old data (copy localStorage from the live site) opens the new app and shows the same chats, candles,
  bond levels, quests, streak, cosmetics and loved whispers.
- Signed-in users stay signed in or can sign in again, and cloud save still syncs.
- Safety rules (priority 100) still answer crisis phrases, with Gemini on and off.
- Each game: start, play, game over, rewards, daily candle cap, best score, leaderboard.
- Each 3D page works with WebGL2 and falls back to 2D without it.
- Installed PWA updates to the new version and works offline.
- Push notifications still arrive.
- AdSense slots appear at the same rate.
- Page weight: home page JS doesn't include three.js. Compare Lighthouse scores on a phone profile with today's.
- Sub-folder hosting still works (see "Sub-folder hosting").

## Risks
- **Hydration mismatches** from anything that reads the browser during pre-render. Mitigated by the client-only rules above.
- **Old service worker** keeps serving the old app. Mitigated by the same `/sw.js` URL and cache cleanup.
- **Python outputs vs the new build**: the app expects `builds/img/` and `builds/data/` at the same addresses. If the
  copy step puts them elsewhere, images, shards and share images break quietly. Covered by the parity check.
- **Shard hash drift**: `make_shard.py` and the TypeScript chat engine must hash words the same way (see "Build scripts").
- **R3F rewrite** is the largest unknown; game feel (timing, controls) can drift. Keep the pure logic identical and compare side by side on a phone.
- **Big bang**: `main` is frozen for weeks. Keep phases small and merge `main` into the branch often.

## Everything is ported
Decided 2026-10-31: **nothing is dropped.** Every page and feature on the site today is ported, including sub-folder
hosting.

### Sub-folder hosting
The site must keep working both at the domain root and from a folder such as `localhost/for-fun/omon-omon/`.
- One build-time value, `BASE_PATH` (default `/`), sets Vite's `base` and React Router's `basename`.
- Every internal link goes through React Router (`<Link>`, `href()`), and every asset through Vite imports or
  `import.meta.env.BASE_URL`. No hard-coded `/` paths.
- The PWA manifest's `start_url` and `scope`, and the service worker's scope, follow `BASE_PATH`.
- Canonical links, `hreflang`, the sitemap and share images still use `site.json > url` (the live domain).
- Replace `.htaccess` with a new one for the new output folder (`build/client`), so refreshing any address in a
  sub-folder serves its pre-rendered `index.html`. The current file (local Apache only, ignored by GitHub Pages) does
  four things the new one must keep: `Cache-Control: no-cache` while developing; serving `games.json` and `sw.js` from the
  build (they are sources in the repo root); adding the missing trailing slash (`/privacy` to `/privacy/`, also for
  `/games/<x>`, `/whispers/<x>`, `/<slug>/history` and `/<slug>/profile`); and mapping each address to its
  `index.html`, plus `sitemap.xml` and `robots.txt`. Add the `/id/` copies.
- The service worker today is `sw.js` in the repo root and is filled in by `make_site.py`; the new one is generated by
  `vite-plugin-pwa` (see PWA).
- Parity check: build once with `BASE_PATH=/for-fun/omon-omon/`, serve it from Apache, and click through every page.

### Usage, for deciding later
Nothing below is dropped now. The numbers are kept here so features can be reviewed after the merge. Usage from the
Axiom log, 30 days to 2026-10-30. It only shows calls to the Workers; games played offline and local chat replies
don't reach the log, and some of the users may be the developer testing. About 226 distinct IPs used the API.

| Feature | Usage (30 days) | Would save, if dropped later | Note |
|---|---|---|---|
| Web Push (whisper alerts, streak reminder at 20:00) | 2 subscribers | Push code in the service worker, VAPID, Me settings | Hardest part of the PWA port |
| Chat memory for signed-in players (`/memory`) | 1 call, 1 user | Small | |
| Leaderboards + run tokens | 27 viewers of Hop Hop's board, almost none for others; 5 users posted scores | Board UI, run tokens client code | Could keep Hop Hop's board only |
| Teka-Teki Gaib (Gemini judges riddles) | 11 calls, 2 users | One game + a Gemini call | |
| Ghost Room `/room/` (3D, shareable) | not logged | One R3F scene, furniture in the shop | Large R3F work for a page that isn't indexed |
| 3D chat backdrop (Me > 3D scenes) | not logged | One R3F scene + prefs | |
| 2D fallbacks of the 3D games | not logged | A second version of each 3D game | |
| Hop Hop (2D) next to Hop Hop 3D | not logged | One game | Two versions of the same game |
| `/<slug>/history/` as its own address | not logged | One route variant | Could be a panel without its own address |
| Weekly event | not logged | Small | |
| Local JSON rules (700 rules, shards, synthetic benchmark) | not logged; they answer when Gemini is down, slow or out of quota | `make_shard`, `gen_synthetic`, most of the rules engine | **Keep the safety rules (priority 100) whatever you choose.** Gemini chat itself had only 85 calls from 8 users. |

Signed-in features (`/me`, `/progress`) have about 17 to 18 users, and whispers are by far the most used part
(221 users), so keep both.
