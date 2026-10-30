// Every game view, by games.json "type" ("runner", "catch", "memory", "rounds") or, for "type": "module", by its "module" name.
// Loaded lazily: the home page never downloads a game, and only the 3D games download three.js.
import { type ComponentType, lazy, type LazyExoticComponent } from "react";
import type { Game } from "~/lib/content";
import type { GameModule, GameProps } from "./types";

const VIEWS: Record<string, () => Promise<GameModule>> = {
  // the four classic types (one game each in games.json)
  runner: () => import("./runner/Game"),
  catch: () => import("./catch/Game"),
  memory: () => import("./memory/Game"),
  rounds: () => import("./rounds/Game"),
  // "type": "module" games (games.d/*.json)
  "rope-untangle": () => import("./rope-untangle/Game"),
  "night-meds": () => import("./night-meds/Game"),
  "memory-garden": () => import("./memory-garden/Game"),
  "tree-gossip": () => import("./tree-gossip/Game"),
  "guess-the-ghost": () => import("./guess-the-ghost/Game"),
  "dare-night": () => import("./dare-night/Game"),
  congklak: () => import("./congklak/Game"),
  "ghost-riddles": () => import("./ghost-riddles/Game"),
  daily: () => import("./daily/Game"),
  "hop-hop-3d": () => import("./hop-hop-3d/Game"),
  "lantern-flight": () => import("./lantern-flight/Game"),
  "haunted-house": () => import("./haunted-house/Game"),
};

const cache = new Map<string, LazyExoticComponent<ComponentType<GameProps>>>();

export function gameView(game: Game): LazyExoticComponent<ComponentType<GameProps>> | null {
  const key = game.type === "module" ? game.module || game.slug : game.type;
  const load = VIEWS[key];
  if (!load) return null;
  let view = cache.get(key);
  if (!view) cache.set(key, (view = lazy(load)));
  return view;
}
