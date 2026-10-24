// Addresses. Every page is a real address with its own pre-built HTML (see tools/make_site.py):
//   /                   home (shows whoever you talked to last)
//   /<slug>/            a character on stage
//   /<slug>/history/    her chat history
// This file keeps the address bar and the <head> in step when you move around without reloading.
// The head text mirrors tools/make_site.py: change one, change the other.

import { state, byId } from "./state.js";
import { aboutEl } from "./dom.js";

// Pages are served with <base href> pointing at the site root ("../" one folder down). A relative
// base can be re-resolved after pushState, so pin it to an absolute address first.
const baseEl = document.querySelector("base");
if (baseEl) baseEl.href = baseEl.href;
const ROOT = new URL(document.baseURI).pathname; // "/" or "/some-folder/"

let handler = () => {};

export const hrefFor = (c, history = false) => `${c.slug}/${history ? "history/" : ""}`;

// The route for an address: { id, history } for a character page, { home: true } for anything else.
export function parsePath(pathname = location.pathname) {
  const rest = pathname.startsWith(ROOT) ? pathname.slice(ROOT.length) : "";
  const [slug, sub] = rest.split("/").filter(Boolean);
  const c = state.characters.find((x) => x.slug === slug);
  return c ? { id: c.id, history: sub === "history" } : { home: true };
}

// ---- <head> ----

function meta(attr, name, content) {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.append(el);
  }
  el.content = content;
}

// What a route says about itself: title, description, canonical address, share image, robots.
export function headFor(route) {
  const { site } = state;
  const c = route.home ? null : byId(route.id);
  if (!c) {
    return {
      title: site.title,
      description: site.description,
      url: `${site.url}/`,
      image: `${site.url}/builds/img/share/home.jpg`,
      robots: "index, follow",
    };
  }
  const stageUrl = `${site.url}/${hrefFor(c)}`;
  const image = `${site.url}/builds/img/share/${c.id}.jpg`;
  if (route.history) {
    return {
      title: `Chat history with ${c.name} | ${site.name}`,
      description: `Your saved chat with ${c.name}.`,
      url: `${stageUrl}history/`,
      image,
      robots: "noindex, follow",
    };
  }
  return {
    title: `${c.name}, ${c.seo.tagline} | ${site.name}`,
    description: c.seo.description.replaceAll("{name}", c.name),
    url: stageUrl,
    image,
    robots: "index, follow",
  };
}

export function updateHead(route) {
  const h = headFor(route);
  document.title = h.title;
  meta("name", "description", h.description);
  meta("name", "robots", h.robots);
  meta("property", "og:title", h.title);
  meta("property", "og:description", h.description);
  meta("property", "og:url", h.url);
  meta("property", "og:image", h.image);
  meta("name", "twitter:title", h.title);
  meta("name", "twitter:description", h.description);
  meta("name", "twitter:image", h.image);
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.append(link);
  }
  link.href = h.url;
  if (aboutEl) aboutEl.textContent = h.description;
}

// ---- Moving around ----

// Go to a route. `silent` only fixes the address and head (the screen is already right);
// `replace` swaps the current history entry instead of adding one.
export function navigate(route, { replace = false, silent = false } = {}) {
  const url = new URL(route.home ? "" : hrefFor(byId(route.id), route.history), document.baseURI);
  if (url.href !== location.href) history[replace ? "replaceState" : "pushState"](null, "", url);
  if (!silent) handler(route);
  updateHead(route);
}

// Call `onRoute` for every Back/Forward, and once now for the address we loaded on.
export function startRouter(onRoute, resolve) {
  handler = (r) => onRoute(resolve(r));
  window.addEventListener("popstate", () => {
    const r = parsePath();
    handler(r);
    updateHead(r);
  });
  const r = parsePath();
  handler(r);
  updateHead(r);
}
