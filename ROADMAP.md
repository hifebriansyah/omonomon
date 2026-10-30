# Roadmap

Where Omon Omon goes after v0.13. **Phases 0 to 3 were built in 0.15** (see CHANGELOG); still open from them: ghost outfits and accessories (1.1, needs art), the fifth ghost (3.6, needs art), how-to-play clips (hub upgrades) and the rewarded 3D items that need playtesting on real phones. `GAMIFICATION.md` was the first plan; this one picks up what is left from it and adds
more games, a 3D track with three.js, and a monetization plan. Each phase can ship on its own. Sizes: **S** is an evening, **M** a day or two, **L** a week.

The constraints still hold:
- Free hosting: GitHub Pages, Cloudflare Workers and D1.
- Python tooling for images, scenes, shards, Vercel and Worker ops; Node 24 (Vite + React Router 7 + TypeScript + Tailwind 4 + Storybook) for the front-end SPA and pre-rendered pages.
- Nothing secret in the repo.
- No pet names, and no "just a bot" lines.
- Character IDs are numbers.
- Every public page goes in the sitemap.

## Where it stands
- **Chat:** four ghosts (Pocomon, Ngesomon, Sundemon, Kuntimon). Gemini answers, with local rules as the fallback, and the tone follows the bond level.
- **Games:** one per ghost: Hop Hop, Night Rounds, Quiet Wish and Hair Catch. They earn Candles and bond XP, and there are daily quests and a streak.
- **Accounts:** Google sign-in and cloud save, through the API Worker and D1.
- **Whispers:** a Gemini post every 15 minutes (each ghost once an hour, shuffled), with comments, ghost replies and loves.

What is missing:
- **Candle shop:** built in 0.14 (stage looks and bubble colours); outfits and profile frames are still open.
- **Built in 0.14:** achievements (14 badges) and weekly leaderboards. More badges and a Turnstile check on first sign-in are still open.
- **Stale scripts after a deploy.** Cloudflare's 4-hour browser cache can run new HTML with an old script.
- **Tests aren't in the repo.** They live outside it, and CI only checks that the build works.

## Phase 0: Foundation (do first, all small)
| # | Work | Size | Why |
|---|---|---|---|
| 0.1 | Versioned script and style URLs at build time (Vite hashed assets + Workbox precache) | S | Fixes the stale-cache bug for good, with no Cloudflare rule needed |
| 0.2 | Move the Worker and game tests into `tests/` and run them in CI | M | Lets later phases go fast without breaking chat or saves |
| 0.3 | Error reporting from the page: `window.onerror` sends to the API Worker, which writes to Axiom (rate limited) | S | Bugs on phones show up in the log, not in DMs |
| 0.4 | Axiom dashboard: requests, 429s, Gemini calls a day, comments, game runs | S | See what people actually use before building more |
| 0.5 | Offline shell (service worker caches pages, art and games) | M | Games play on bad mobile data; the app feels installed |

## Phase 1: Give progress a purpose
| # | Work | Size |
|---|---|---|
| 1.1 | **Candle shop** on Me: stage backgrounds, chat bubble styles, ghost outfits/accessories, profile frames. Cosmetic only, saved in `progress` | M |
| 1.2 | **Achievements**: about 20 badges (first win, all four games, 7-day streak, bond 5 with everyone, 10 comments, first loved whisper…), shown on Me with a toast when earned | M |
| 1.3 | **Bond rewards up to level 10**: new greetings at 2, story at 3, mood lines at 4, background at 5, story at 6, outfit at 8, "secret" chat topic at 10 | M |
| 1.4 | **Weekly leaderboards** per game (nickname only, top 20). Server checks: a run token from `/runs/start`, plausibility caps per game, one score per token | L |
| 1.5 | **Weekly event**: one ghost "hosts" the week, with double bond XP for her game, a themed quest and a whisper series | S |

## Phase 2: More games
Each ghost gets a second game; then shared games bring them together. The rules for every new game:
- It runs on the existing frame: `app/features/games/progress.ts`, the result screen, quests and the `games.json` / `games.d/*.json` entry.
- It is split into `logic.ts` (pure) and `Game.tsx` (view) under `app/features/games/<slug>/` and works with touch and keys.
- It has an option for reduced motion.
- It has EN and ID text.

### Second game per ghost (no Gemini cost)
| Ghost | Game | Mechanic | Size |
|---|---|---|---|
| Pocomon | **Tali Lepas** (Untie) | Untangle-the-ropes puzzle: drag knots until no lines cross; levels get bigger | M |
| Ngesomon | **Obat Malam** (Night Meds) | Sort falling pills into the right patient's tray by color/shape; speeds up | M |
| Sundemon | **Bunga Kenangan** (Memory Garden) | Calm match-3 with petals; no timer, a fixed number of moves | L |
| Kuntimon | **Gosip Pohon** (Tree Gossip) | Whack-a-mole: catch secrets peeking from branches; skip the decoys | S |

### Shared games
| Game | Mechanic | Gemini? | Size |
|---|---|---|---|
| **Tebak Hantu** (Guess the Ghost) | A ghost line from the rules files is shown; guess who said it. Daily set of 10 | no | S |
| **Uji Nyali** (Dare Night) | Choose-your-path story: 5 to 8 choices a run, with endings that depend on bond level. Written ahead in `stories.json` style | no | M |
| **Teka-Teki Gaib** (Ghost Riddles) | A ghost gives a riddle in her voice; the player types an answer and Gemini judges it. 3 a day per device | yes, capped | M |
| **Congklak** | The traditional mancala game against a ghost AI with three levels (easy = Sundemon, hard = Ngesomon) | no | L |
| **Daily Challenge** | The same seeded run of one game for everyone each day, with its own board | no | S (after 1.4) |

The Gemini games reuse the comment safety path. They are screened, fail closed, and have a per-device daily cap and a
global daily cap, so cost stays bounded.

### Games hub upgrades
- Filters: "per ghost" and "quick (under 1 min)".
- "Continue" for the last game played.
- New badges on fresh games.
- Short how-to-play clips (animated WebP).

## Phase 2b: 3D with three.js
three.js (via React Three Fiber in `app/features/three/`) gives the app the depth that 2D cutouts can't:
- `three` and `@react-three/fiber` come from npm, bundled only into the lazy-loaded 3D chunks (`three-LICENSE.txt` is copied into the build output).
- It loads only on pages that use it, through `React.lazy()`.
- Every 3D feature has a 2D fallback. It falls back when WebGL2 is missing, when Save-Data is on, on low-end devices (`navigator.deviceMemory` of 2 or less), and when reduced motion is set.

| # | Work | Size |
|---|---|---|
| 3D.1 | **Shared 3D kit** (`app/features/three/scene-kit.tsx`): a renderer that pauses when the tab or canvas is hidden, a pixel-ratio cap of 2, fog, a moonlight and lantern light rig, the ghost cutouts as camera-facing sprites with a soft glow, and a small particle system (fireflies, dust, mist). Built once and used by everything below | M |
| 3D.2 | **Chat stage, 2.5D**: the ghost stands in a small 3D scene (a bamboo grove, a hospital corridor, a garden, a banyan tree) with slow parallax from the phone tilting or the mouse, plus mist. The bubble stays HTML. It ties into the shop's backgrounds | M |
| 3D.3 | **Hop Hop 3D** (*Lompat Kubur*): a three-lane endless runner through a graveyard, with Pocomon hopping toward the camera. Swipe to change lanes and tap to hop. The 2D Hop Hop stays as the fallback | L |
| 3D.4 | **Rumah Hantu** (*Haunted House*): a short first-person walk through rooms. Each room is one ghost's mini puzzle (find 5 hidden items, light the lanterns in order). Joystick on touch, WASD on desktop | L |
| 3D.5 | **Lentera Terbang** (*Lantern Flight*): steer a floating lantern up through a night sky. Collect wishes, avoid branches. One-touch, calm, Sundemon's world | M |
| 3D.6 | **Kamar Hantu** (*Ghost Room*): a small 3D room for each player, decorated with items from the shop (furniture, lights, posters). Visitors can open a shared room link. It is the main reason to spend Candles, and it is where paid cosmetics show (see Monetization) | L |

The 3D work is easy to scope wrong, so these rules apply:
- **Budget:** under 50k triangles a scene, at most 2 lights casting shadows, textures of at most 1024 px. All models are low-poly glTF files made with code or Blender (CC0 packs such as Kenney or Quaternius, with each licence noted in `assets/vendor/`).
- **Checks:** Lighthouse and a frame-rate check on a mid-range Android before release.

## Phase 3: Make the ghosts feel alive
| # | Work | Size |
|---|---|---|
| 3.1 | **Whispers that react**: a whisper sometimes mentions the week's event, the season, Indonesian holidays, or the top comment from yesterday | S |
| 3.2 | **Ghost-to-ghost replies**: sometimes another ghost comments on a whisper (one extra Gemini call, capped) | S |
| 3.3 | **Chat memory**: a short summary per ghost saved in progress (signed in), so she remembers names and topics across devices | M |
| 3.4 | **Moods by time of day**: Jakarta night = spookier lines and a darker stage; day = sleepy | S |
| 3.5 | **Push notifications (opt-in)**: "Kuntimon whispered" and "your streak ends in 2 hours", via Web Push from the API Worker cron | L |
| 3.6 | **Fifth ghost** (e.g. Genderuwo or Tuyul): one character, art, persona, game and whispers; this tests that adding a ghost is just data | L |

## Phase 4: Growth and polish
| # | Work | Size |
|---|---|---|
| 4.1 | Share cards: a game result image (score, ghost and a link) made with a canvas in the page; per-ghost share pages like the whisper ones | M |
| 4.2 | SEO pages per game with how-to text and an FAQ; per-ghost "about" sections (all go in the sitemap) | S |
| 4.3 | Accessibility pass: focus order, screen-reader labels in games, contrast, the reduced-motion setting on Me | M |
| 4.4 | Performance: lazy-load game scripts and art, AVIF art, and a Lighthouse score of 90+ on mobile in CI | M |
| 4.5 | Moderation tools: `tools/moderate.py` to list, hide and ban comments by device hash, plus a report button on comments | M |
| 4.6 | Data export on Me (JSON download of progress) next to Delete account | S |

## Monetization
The goal is to cover Gemini and hosting first, then earn, without breaking trust:
- No pay-to-win.
- No loot boxes or random paid rewards.
- The price is always shown in rupiah.
- No dark patterns aimed at kids.

The steps are listed from least to most effort.

| # | Stream | How | Size | Notes |
|---|---|---|---|---|
| M.1 | **Tips** | A "Support the ghosts" link on Me and the result screen, to Trakteer or Saweria (Indonesian, QRIS/GoPay/OVO) and Ko-fi for abroad. Supporters get a badge, set by hand or through the platform's webhook | S | The quickest way to see whether people will pay |
| M.2 | **Rewarded ads, opt-in** | Google's **H5 Games Ads** (Ad Placement API). Watch an ad for double Candles on a run, one free shop item a day, or 5 extra Gemini chats. No banners in chat | M | Needs an AdSense account, an ads.txt file, a consent banner for EU/UK visitors, and a privacy page update. No ads for players who say they are under 13 |
| M.3 | **Supporter pass** (*Sahabat Gaib*) | Monthly, roughly Rp 15–25k: no ads, a higher Gemini chat limit, chat memory (3.3), early whispers, a monthly exclusive cosmetic, and a supporter frame | L | Needs a payment provider. **Midtrans** or **Xendit** (QRIS, e-wallets, VA) for Indonesia, and **Stripe** for cards abroad. Checkout runs on the API Worker, with a webhook that sets `users.plan` in D1. Sign-in is required |
| M.4 | **Premium cosmetics** | Direct purchases (no loot boxes): outfit sets per ghost, 3D Ghost Room themes (3D.6) and stage scenes (3D.2), at Rp 5–30k each. They can also be earned slowly with Candles where it fits | M | The same checkout as M.3; items are stored in `progress` |
| M.5 | **Sticker packs** | WhatsApp and Telegram sticker packs of the four ghosts (a free pack plus a paid pack), and LINE Creators Market | S | It spreads the brand as well as earning |
| M.6 | **Merch** | Print-on-demand (no stock) through a local partner: stickers, shirts, acrylic stands. Linked from Me and the ghost pages | M | Only once there are regular players |
| M.7 | **Brand collaborations** | A sponsored whisper series or event week (e.g. a snack brand at Halloween or Ramadan night), always labelled "sponsored" | – | Wait for a real audience; the Axiom dashboard (0.4) gives the numbers to pitch with |

What each step needs before it ships:
- **Legal:** terms of service, the privacy page updated for payments and ads, Indonesia's PDP law, and refunds. Get a quick legal check before M.2 and M.3; this is not legal advice.
- **Accounts:** paid things require sign-in, so purchases follow the player across devices. Guests can still play everything free.
- **Code:** a `plan` column and a `purchases` table in D1, and a webhook-verified purchase flow. Nothing paid is ever unlocked by the browser alone.
- **Cost control:** the Gemini caps per plan live in the Worker. Free players keep a fair daily chat limit and the local-rules fallback after it.

Rough order: M.1 and M.5 now (no code beyond links), then M.2 once games have daily players, then M.3 and M.4 together once the shop (1.1) and Ghost Room (3D.6) exist.

## Suggested order
1. **Phase 0, all of it.** It is small, and it stops the stale-cache and regression pain. Add the tip link (M.1) at the same time.
2. **1.1 shop, 1.2 achievements, then the Tebak Hantu and Gosip Pohon games.** These are quick wins, and they make the Candles mean something.
3. **3D.1 kit and 3D.2 chat stage.** This shows the 3D look early, with low risk.
4. **1.3 bond rewards, then Uji Nyali, Tali Lepas, Obat Malam and Lentera Terbang (3D.5).**
5. **1.4 leaderboards, then the Daily Challenge. Rewarded ads (M.2) come next.**
6. **Ghost Room (3D.6) together with the supporter pass and premium cosmetics (M.3, M.4).**
7. **Phase 3, Hop Hop 3D, Rumah Hantu, Congklak, Bunga Kenangan and the fifth ghost.**
8. **Phase 4, alongside the rest.**

## Costs to watch (free plans)
- **Workers:** 100k requests a day. Leaderboards and error reports add requests, so batch them and rate limit them.
- **D1:** 100k writes a day. One write per run plus progress sync is fine, but don't write per frame or per tap.
- **Gemini:** riddles, ghost-to-ghost replies and chat memory summaries each add calls, so every one gets a daily cap and an Axiom count.
- **Push notifications:** sending is free, but there must be at most one push per day per person.

## Open questions
1. Shop items: buy only with Candles earned in-game, or unlock some only through bond levels?
2. Leaderboards: global, or Indonesia only? Show nicknames, or hide them until a player opts in?
3. Which fifth ghost, if any?
4. Push notifications: worth the setup, or keep it to the in-app badges?
5. Should Gemini games need sign-in, to keep the cost tied to accounts?
6. 3D: start with the chat stage (3D.2) or with a 3D game first?
7. Payments: Midtrans or Xendit for Indonesia, and is there a registered business for the merchant account?
8. Ads: okay with opt-in rewarded ads, or keep the app ad-free and rely on the supporter pass?
