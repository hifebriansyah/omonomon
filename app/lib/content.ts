// The content JSON in the repo root, imported at build time. The files stay where they are because the Python tools
// (make_images, make_scenes, make_shard, sync_limits) and the edge Worker (/characters.json) read them there.
import charactersJson from "../../characters.json";
import gamesJson from "../../games.json";
import siteJson from "../../site.json";
import storiesJson from "../../stories.json";

export type Lang = "en" | "id";
export type Localized<T = string> = { en: T; id: T };

export interface Character {
  id: string; // a number as text; it never changes (saved chats, progress and the Worker use it)
  name: string;
  slug: string; // public address, never changes
  image: string;
  stage: string;
  head: string;
  banner?: string;
  accent: string;
  status: string;
  statusId: string;
  greeting?: Localized;
  fallback?: Localized<string[]>;
  seo: { tagline: string; description: string; id: { tagline: string; description: string } };
  busy: Localized<string[]>;
  bondGreetings: Localized<string[]>;
  moods?: unknown;
}

export type GameType = "runner" | "catch" | "memory" | "rounds" | "module";
export interface Game {
  slug: string;
  character: string;
  ready: boolean;
  type: GameType;
  module?: string;
  title: string;
  tagline: string;
  description: string;
  how: Localized;
  tiers?: [number, number];
  recordMin?: number;
  scorePerCandle?: number;
  quick?: boolean;
  added?: string;
  startText?: Localized;
  overTitle?: Localized;
  limits?: { perSec: number; slack: number; max: number };
  reactions: Record<"low" | "mid" | "high" | "record", Localized<string[]>>;
  id?: { tagline?: string; description?: string };
}

export interface Hub {
  title: string;
  heading: string;
  description: string;
  intro: string;
  id: { title: string; heading: string; description: string; intro: string };
}

export interface Site {
  url: string;
  name: string;
  title: string;
  description: string;
  titleId: string;
  descriptionId: string;
  themeColor: string;
  contactEmail?: string;
  ads: { client: string; slot: string; layoutKey: string; every: number };
}

export interface Story {
  level: number;
  title: Localized;
  text: Localized;
}

// games.json plus every games.d/<slug>.json, in file name order (as tools/make_site.py merged them).
const extra = import.meta.glob<Game>("../../games.d/*.json", { eager: true, import: "default" });

export const site = siteJson as Site;
export const characters = charactersJson.characters as Character[];
export const defaultCharacterId: string = charactersJson.default;
export const trouble = charactersJson.trouble as Localized;
export const hub = gamesJson.hub as Hub;
export const games: Game[] = [
  ...(gamesJson.games as Game[]),
  ...Object.keys(extra)
    .sort()
    .map((k) => extra[k]),
];
export const stories = storiesJson as Record<string, Story[]>;

export const characterById = (id: string | undefined) => characters.find((c) => c.id === id);
export const characterBySlug = (slug: string | undefined) => characters.find((c) => c.slug === slug);
export const gameBySlug = (slug: string | undefined) => games.find((g) => g.slug === slug);

/** The link-preview picture (1:1 scene from tools/make_scenes.py). Pages that are not one ghost's use ghost 1. */
export const shareImage = (charId = "1") => `${site.url}/build/img/scenes/1_1/${charId}.jpg`;
export const SHARE_SIZE = 1080;
