// Builds sitemap.xml and robots.txt from the route list in site-paths.ts (replaces the sitemap half of tools/make_site.py).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { publicPaths } from "./site-paths.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildSitemapAndRobots(siteUrl?: string) {
  const site = JSON.parse(readFileSync(join(ROOT, "site.json"), "utf8"));
  const baseUrl = (siteUrl || site.url).replace(/\/+$/, "");
  const paths = publicPaths();
  const listed = paths.filter((p) => p.indexed);
  const url = (path: string) => `${baseUrl}${path}`;
  const alternates = (p: (typeof paths)[number]) => {
    const en = p.lang === "en" ? p.path : p.alternate;
    const id = p.lang === "id" ? p.path : p.alternate;
    return [
      `<xhtml:link rel="alternate" hreflang="en" href="${esc(url(en))}"/>`,
      `<xhtml:link rel="alternate" hreflang="id" href="${esc(url(id))}"/>`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(url(en))}"/>`,
    ].join("");
  };
  const sitemapXml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    listed.map((p) => `  <url><loc>${esc(url(p.path))}</loc>${alternates(p)}</url>\n`).join("") +
    "</urlset>\n";
  const robotsTxt = `User-agent: *\nAllow: /\nDisallow: /storybook/\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
  return { paths, listed, sitemapXml, robotsTxt };
}
