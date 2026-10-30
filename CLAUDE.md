# Notes for Claude

## Unit tests

- **Never run the unit tests on your own.** Run them only when the user asks.
- **Exception: a test you just created.** Run that one test file, and only that file.
- **Exception: a test you just changed.** Run that one test file, and only that file.
- Never run the whole suite (`npm test`) unless the user asks for it. Use the single-file form:

```bash
node --test tests/<name>.test.mjs
```

- Changing code that a test covers, without changing the test itself, is not a reason to run it. Say which test covers it and let the user decide.
- CI runs the whole suite on every deploy, so that is not your job either.
- `tests/legacy/` holds the old front-end tests. They are the spec for porting the game rules and are not run until the tests phase (see `refactor.md`, "Tests").

## Front end

- React 19 + React Router 7 (pre-rendered, `ssr: false`) + Vite + TypeScript + Tailwind 4, Storybook for the components. Node 24 (`.nvmrc`).
- Checks that are fine to run: `npm run typecheck`, `npm run lint`, `npm run build` (after `python3 tools/build_all.py` has made `build/img` and `build/data`), `npm run build-storybook`.
- `app/lib/storage.ts` is the only place that touches localStorage. Keys and value shapes never change: people's chats and progress live in them.
- Every page exists in English (`/x/`) and Indonesian (`/id/x/`). Text goes in `app/i18n/en.ts` and `id.ts`.
- Nothing may read `window`, `localStorage` or the clock during the first render: the pages are pre-rendered in Node.
- `tools/` and `vercel/` stay Python; `worker/` is plain JS for Cloudflare. They are not part of the front-end build.

## File names

- File and folder names are in English by default (for example `ghost-room.ts`, not `kamar-hantu.ts`).
- Only use a non-English name when the user asks for it, or when it is a name that already exists. Never rename existing files or public addresses on your own.
