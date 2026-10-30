// Serves the Python build outputs and the content JSON in development, at the same addresses the built site uses:
// /build/img/..., /characters.json, /site.json, /stories.json and /games.json (merged with games.d/).
// The production copy is done by scripts/postbuild.ts.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import type { Plugin } from "vite";
import { loadGames } from "./site-paths.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const ROOT_JSON = new Set(["characters.json", "site.json", "stories.json"]);
const TYPES: Record<string, string> = { ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".gz": "application/gzip" };

export function omonContent(): Plugin {
  return {
    name: "omon-content",
    configureServer(server) {
      const base = server.config.base;
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || "").split("?")[0]);
        if (!url.startsWith(base)) return next();
        const rel = normalize(url.slice(base.length));
        if (rel === "games.json") {
          const games = JSON.parse(readFileSync(join(ROOT, "games.json"), "utf8"));
          games.games = loadGames();
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify(games));
        }
        const servable = ROOT_JSON.has(rel) || rel.startsWith("build/img/");
        const file = join(ROOT, rel);
        if (!servable || rel.includes("..") || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", TYPES[extname(file)] || "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}
