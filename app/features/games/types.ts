// The contract between the game page (GamePage.tsx) and every game view. It replaces the old module contract
// (assets/scripts/games/README.md: start(root, ctx) -> { restart, destroy }).
//
// Each game lives in features/games/<slug>/:
//   logic.ts        the rules: pure state and functions, no DOM, no React, no timers you can't control (tests/legacy/<slug>.test.mjs is its spec)
//   Game.tsx        the view: `export default function Game(props: GameProps)`; it owns its own timers and listeners and cleans them up
//   Game.stories.tsx  start, playing, game over (and new best where it matters), with fake props
// GamePage mounts <Game key={run} .../>: a new `run` number starts a new run (the old restart()); unmounting is the old destroy().
import type { Character, Game, Lang } from "~/lib/content";

export interface GameProps {
  /** Call once when a run ends. For a shared game pass { char } to give the bond XP to one ghost (default: the game's own). */
  onOver: (score: number, opts?: { char?: string }) => void;
  lang: Lang;
  /** The game's character (name, accent, stage, head, image ...). */
  char: Character;
  /** All four characters. */
  chars: Character[];
  /** The player's best score in this game before this run. */
  best: number;
  reduceMotion: boolean;
  game: Game;
  /** True for every run after the first (Play again). The old restart() skipped some games' start button and focused the canvas. Optional: ignore it if your game had no difference. */
  restarted?: boolean;
}

/** A game view module, loaded with React.lazy (so no game is in the home page's JavaScript). */
export type GameModule = { default: React.ComponentType<GameProps> };
