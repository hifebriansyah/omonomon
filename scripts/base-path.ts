// BASE_PATH: the folder the site is served from ("/" at the domain root, "/for-fun/omon-omon/" in a sub-folder).
// It sets Vite's `base` and React Router's `basename`. Canonical links, the sitemap and share images keep using site.json > url.
export function basePath(): string {
  const raw = process.env.BASE_PATH || "/";
  const withLead = raw.startsWith("/") ? raw : `/${raw}`;
  return withLead.endsWith("/") ? withLead : `${withLead}/`;
}
