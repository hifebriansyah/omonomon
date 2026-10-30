// The <head> of every page: title, description, robots, canonical link, hreflang links, Open Graph, Twitter and JSON-LD.
// Written once here and used by each route's meta() (this replaces tools/make_site.py's head_for() and router.js's headFor()).
// The tag names and order matter: worker/edge.js rewrites og:image, og:image:width/height, twitter:card and the rest by selector.
import type { MetaDescriptor } from "react-router";
import { tr } from "~/i18n";
import { type Character, type Lang, SHARE_SIZE, shareImage, site } from "./content";
import { localize } from "./lang";

export interface Head {
  lang: Lang;
  path: string; // router path in this language, e.g. "/id/pocomon/"
  title: string;
  description: string;
  image?: string;
  indexed: boolean;
  ld?: object | null;
}

const abs = (path: string) => `${site.url}${path}`;

export function pageHead(h: Head): MetaDescriptor[] {
  const url = abs(h.path);
  const image = h.image || shareImage();
  const en = abs(localize(h.path, "en"));
  const id = abs(localize(h.path, "id"));
  const tags: MetaDescriptor[] = [
    { title: h.title },
    { name: "description", content: h.description },
    { name: "robots", content: h.indexed ? "index, follow" : "noindex, follow" },
    { tagName: "link", rel: "canonical", href: url },
    { tagName: "link", rel: "alternate", hrefLang: "en", href: en },
    { tagName: "link", rel: "alternate", hrefLang: "id", href: id },
    { tagName: "link", rel: "alternate", hrefLang: "x-default", href: en },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: site.name },
    { property: "og:locale", content: h.lang === "id" ? "id_ID" : "en_US" },
    { property: "og:title", content: h.title },
    { property: "og:description", content: h.description },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:image:width", content: String(SHARE_SIZE) },
    { property: "og:image:height", content: String(SHARE_SIZE) },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: h.title },
    { name: "twitter:description", content: h.description },
    { name: "twitter:image", content: image },
  ];
  if (h.ld) tags.push({ "script:ld+json": h.ld });
  return tags;
}

// ---- Shared pieces of the old make_site.py ----

export const siteTitle = (lang: Lang) => (lang === "id" ? site.titleId : site.title);
export const siteDescription = (lang: Lang) => (lang === "id" ? site.descriptionId : site.description);
export const named = (lang: Lang, key: string, options?: Record<string, unknown>) => `${tr(lang, key, options)} | ${site.name}`;

export function characterSeo(c: Character, lang: Lang) {
  const seo = lang === "id" ? c.seo.id : c.seo;
  return { tagline: seo.tagline, description: seo.description.replaceAll("{name}", c.name) };
}

export const characterTitle = (c: Character, lang: Lang) => `${c.name}, ${characterSeo(c, lang).tagline} | ${site.name}`;

const website = (lang: Lang) => ({
  "@type": "WebSite",
  "@id": `${site.url}/#website`,
  name: site.name,
  url: `${site.url}/`,
  description: siteDescription(lang),
  inLanguage: ["en", "id"],
});

/** JSON-LD of the home page and the hub: just the website. */
export const websiteLd = (lang: Lang) => ({ "@context": "https://schema.org", "@graph": [website(lang)] });

/** JSON-LD of a ghost's chat page: website, the page and its breadcrumb. */
export function characterLd(c: Character, lang: Lang, path: string) {
  const pageUrl = abs(path);
  const home = abs(localize("/", lang));
  return {
    "@context": "https://schema.org",
    "@graph": [
      website(lang),
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#page`,
        url: pageUrl,
        name: characterTitle(c, lang),
        description: characterSeo(c, lang).description,
        inLanguage: lang,
        isPartOf: { "@id": `${site.url}/#website` },
        primaryImageOfPage: { "@type": "ImageObject", url: shareImage(c.id) },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: site.name, item: home },
          { "@type": "ListItem", position: 2, name: c.name, item: pageUrl },
        ],
      },
    ],
  };
}
