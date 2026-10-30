// Every address the site pre-renders, in both languages. Read by react-router.config.ts (prerender), scripts/postbuild.ts
// (sitemap.xml, robots.txt, .htaccess) and checked against the route table. Only reads the content JSON in the repo root.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const readJson = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

export type Lang = "en" | "id";
export interface SitePath {
  path: string; // "/pocomon/" or "/id/pocomon/" (without BASE_PATH)
  lang: Lang;
  indexed: boolean; // in the sitemap, robots "index"
  alternate: string; // the same page in the other language
}

export function loadGames(): { slug: string; ready: boolean; character: string }[] {
  const games = readJson("games.json").games;
  const dir = join(ROOT, "games.d");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) games.push(readJson(`games.d/${f}`));
  return games;
}

export function publicPaths(): SitePath[] {
  const characters: { slug: string }[] = readJson("characters.json").characters;
  const games = loadGames().filter((g) => g.ready);
  const pages: [string, boolean][] = [
    ["/", true],
    ...characters.flatMap((c): [string, boolean][] => [
      [`/${c.slug}/`, true],
      [`/${c.slug}/history/`, false],
      [`/${c.slug}/profile/`, true],
      [`/whispers/${c.slug}/`, false],
    ]),
    ["/whispers/", false],
    ["/loved/", false],
    ["/games/", true],
    ...games.map((g): [string, boolean] => [`/games/${g.slug}/`, true]),
    ["/room/", false],
    ["/me/", false],
    ["/privacy/", true],
  ];
  return pages.flatMap(([path, indexed]) => [
    { path, lang: "en" as const, indexed, alternate: `/id${path}` },
    { path: `/id${path}`, lang: "id" as const, indexed, alternate: path },
  ]);
}
