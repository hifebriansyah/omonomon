# Game modules

Every game lives in `app/features/games/<slug>/` and is lazy-loaded by `app/features/games/registry.ts` so the home page never downloads game code, and only 3D games download `three`.

Each game folder has three parts:
- `logic.ts`: pure state and rules, with no DOM, no React, and no timers you cannot control (`tests/legacy/<slug>.test.mjs` is its spec).
- `Game.tsx`: the React view (`export default function Game(props: GameProps)` from `app/features/games/types.ts`). `GamePage.tsx` mounts `<Game key={run.n} ... />`, so starting a new run mounts a fresh instance and leaving unmounts it cleanly.
- `Game.stories.tsx`: Storybook stories for start, playing, game over, and Indonesian (`lang: "id"`).

Rules for a game:
- `logic.ts` must not touch `window`, `document`, or `localStorage` at import time (pre-rendering imports the route modules in Node). Any storage access goes through `app/lib/storage.ts`.
- Touch and keyboard both work, buttons are real `<button>` elements with accessible labels, and `props.reduceMotion` disables non-essential motion (or switches 3D games to their 2D fallback).
- 3D games check `canUse3D()` from `app/features/three/kit.ts` first, lazy-load their R3F scene (`Scene3D.tsx`) inside `<ThreeBoundary>` and `<Suspense>`, and fall back to a 2D version when WebGL2 is unavailable.
- EN and ID text for everything the player reads; Indonesian is casual (`aku` and `kamu`, never `saya` or `Anda`).
- No pet names and no "I'm just a bot" lines in anything a ghost says.
