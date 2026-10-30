// Runs after `react-router build` (npm run build). Finishes build/client/ so it can be uploaded as it is:
//   build/img              the pictures from `python3 tools/build_all.py`
//   *.json                 characters.json, site.json, stories.json, games.json (merged with games.d/): the edge Worker reads
//                          /characters.json, and old saved pages fetched them
//   manifest.webmanifest   start_url and scope follow BASE_PATH
//   sitemap.xml, robots.txt, 404.html
//   storybook/             a copy of build/storybook/ when `npm run build-storybook` ran first (not in the sitemap or the precache)
//   sw.js                  the service worker (app/features/pwa/sw.template.js) with Workbox's precache list
//   three-LICENSE.txt      three.js licence notice (it comes from npm now, bundled into the 3D chunks)
// Fails the build when a public page is missing from the sitemap, or when the Python outputs are missing.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { getManifest } from "workbox-build";
import { basePath } from "./base-path.ts";
import { buildSitemapAndRobots } from "./sitemap.ts";
import { loadGames } from "./site-paths.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "build", "client");
const BASE = basePath();
const site = JSON.parse(readFileSync(join(ROOT, "site.json"), "utf8"));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const write = (rel: string, text: string) => writeFileSync(join(OUT, rel), text, "utf8");

if (!existsSync(OUT)) throw new Error("postbuild: build/client is missing; run `react-router build` first");

// When BASE_PATH !== "/", React Router nests pre-rendered HTML under build/client/<BASE_PATH>/ while keeping assets/ at build/client/assets/.
// Flatten build/client/<BASE_PATH>/* back into build/client/ so the folder can be served directly at BASE_PATH.
if (BASE !== "/") {
  const nested = join(OUT, BASE);
  if (existsSync(nested)) {
    cpSync(nested, OUT, { recursive: true });
    const topSeg = BASE.split("/").filter(Boolean)[0];
    if (topSeg) rmSync(join(OUT, topSeg), { recursive: true, force: true });
  }
}

// ---- Python outputs (build/img) ----
const imgSrc = join(ROOT, "build", "img");
if (!existsSync(imgSrc)) throw new Error('postbuild: build/img/ is missing. Run "python3 tools/build_all.py" first.');
cpSync(imgSrc, join(OUT, "build", "img"), { recursive: true });

// ---- content JSON ----
for (const name of ["characters.json", "site.json", "stories.json"]) cpSync(join(ROOT, name), join(OUT, name));
const games = JSON.parse(readFileSync(join(ROOT, "games.json"), "utf8"));
games.games = loadGames();
write("games.json", JSON.stringify(games, null, 2));

// ---- web app manifest ----
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.webmanifest"), "utf8"));
write("manifest.webmanifest", JSON.stringify({ ...manifest, id: BASE, start_url: BASE, scope: BASE, icons: manifest.icons.map((i: { src: string }) => ({ ...i, src: `${BASE}${i.src}` })) }, null, 2));

// ---- sitemap.xml and robots.txt ----
const { paths, listed, sitemapXml, robotsTxt } = buildSitemapAndRobots(site.url);
write("sitemap.xml", sitemapXml);
write("robots.txt", robotsTxt);

// Every pre-rendered page that is not noindex must be in the sitemap (the old make_site.py check).
const missing: string[] = [];
for (const p of paths) {
  const file = join(OUT, p.path, "index.html");
  if (!existsSync(file)) throw new Error(`postbuild: ${p.path} was not pre-rendered`);
  const html = readFileSync(file, "utf8");
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  if (!noindex && !listed.some((l) => l.path === p.path)) missing.push(p.path);
  if (noindex && p.indexed) missing.push(`${p.path} (listed but noindex)`);
}
if (missing.length) throw new Error(`postbuild: sitemap and pages disagree: ${missing.join(", ")}`);

// ---- 404.html (GitHub Pages serves it with a real 404 status for any unknown address) ----
write(
  "404.html",
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found | ${esc(site.name)}</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="${BASE}build/img/favicon.ico" sizes="48x48">
  <meta name="theme-color" content="${site.themeColor}">
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: ${site.themeColor}; color: #f1f3f8; font: 1.1rem/1.5 system-ui, sans-serif; text-align: center; padding: 24px; }
    a { color: #c9b3ee; }
  </style>
</head>
<body>
  <main>
    <h1>Nobody lives here</h1>
    <p>This page does not exist. <a href="${BASE}">Go back to ${esc(site.name)}</a> and pick a ghost to chat with.</p>
    <p lang="id">Halaman ini tidak ada. <a href="${BASE}id/">Kembali ke ${esc(site.name)}</a> dan pilih hantu untuk diajak ngobrol.</p>
  </main>
</body>
</html>
`,
);

// ---- three.js licence (MIT) ----
const threeLicence = join(ROOT, "node_modules", "three", "LICENSE");
if (existsSync(threeLicence)) cpSync(threeLicence, join(OUT, "three-LICENSE.txt"));

// ---- Storybook at /storybook/ ----
rmSync(join(OUT, "storybook"), { recursive: true, force: true });
if (existsSync(join(ROOT, "build", "storybook"))) cpSync(join(ROOT, "build", "storybook"), join(OUT, "storybook"), { recursive: true });

// ---- service worker ----
const { manifestEntries, warnings } = await getManifest({
  globDirectory: OUT,
  globPatterns: ["**/*.{js,css,html,json,webmanifest}", "build/img/{favicon.ico,icon-192.png,icon-512.png,apple-touch-icon.png}"],
  globIgnores: ["storybook/**", "sw.js", "404.html", "__spa-fallback.html", "build/grids/**"],
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
});
for (const w of warnings) console.warn(`postbuild: ${w}`);
// pages are cached by their folder address ("pocomon/"), which is what a visitor navigates to
const precache = (manifestEntries || []).map((e) => (e.url === "index.html" ? "./" : e.url.replace(/(^|\/)index\.html$/, "$1")));
const version = createHash("sha256")
  .update(JSON.stringify(manifestEntries))
  .digest("hex")
  .slice(0, 10);
const env = readFileSync(join(ROOT, ".env.production"), "utf8");
const api = /^VITE_API_URL=(.*)$/m.exec(env)?.[1]?.trim() || "";
const sw = readFileSync(join(ROOT, "app", "features", "pwa", "sw.template.js"), "utf8")
  .replace("__VERSION__", version)
  .replace("__PRECACHE__", JSON.stringify(precache))
  .replace("__API_URL__", api);
write("sw.js", sw);

console.log(`postbuild: ${paths.length} pages (${listed.length} in the sitemap), sw.js with ${precache.length} files (v ${version}), base ${BASE}`);
