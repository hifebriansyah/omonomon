# Game modules

A game with `"type": "module"` in its `games.d/<slug>.json` builds its own markup. `assets/scripts/shell/main.js` loads
`games/<module>.js` (listed in its `MODULES` map) and calls it.

```js
export function start(root, ctx) {
  // root: an empty <div class="module-root"> inside the framed play area (the result screen is laid over it by the page)
  // ctx:  { onOver(score, { char? }), lang: "en" | "id", T, char, chars, best, reduceMotion, game }
  //   onOver  call once when a run ends. The page shows the result screen, pays Candles and bond XP, and puts the score on the board.
  //           For a shared game pass { char: "<ghost id>" } to give the bond XP to one ghost (default: the game's own character).
  //   T       the shared text table (games/text.js); your own words go in a TEXT = { en: {...}, id: {...} } inside your module
  //   char    the game's character object from characters.json (name, accent, stage, head, image ...)
  //   chars   all four characters
  //   best    the player's best score in this game
  return { restart(best) { /* start a new run */ }, destroy() { /* remove listeners and timers */ } };
}
```

Rules for a module:
- The file must not touch the DOM or `window` when it is imported (only inside `start`). Put the rules in exported pure
  functions (`createEngine`, `scoreOf`, ...) so `tests/<slug>.test.mjs` can run them with `node --test tests/`.
- Style yourself: inject one `<style id="css-<slug>">` into `document.head` from `start`. Use the page's CSS variables
  (`--accent`, `--comic`), no external fonts or images other than `ctx.char.stage` / `ctx.char.head` / `ctx.char.image`.
- Touch and keyboard both work, buttons are real `<button>`s with labels, and `ctx.reduceMotion` turns off movement.
- EN and ID text for everything the player reads; Indonesian is casual (aku and kamu, never saya or Anda).
- No pet names and no "I'm just a bot" lines in anything a ghost says. No network calls unless the brief says so.
- Under about 400 lines. Plain ES modules: no npm, no build step.
