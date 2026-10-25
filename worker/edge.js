// Omon Omon edge Worker: gives each whisper link its own preview.
//
// The site is static, so /whispers/?n=7 is the same HTML for every whisper and link previews (WhatsApp, Telegram, X ...)
// never run its scripts: they would always show the default picture. This Worker sits in front of omonomon.securhat.com/whispers*,
// looks the whisper up in the API and rewrites the preview tags of that one page, so the card shows the whisper's own ghost
// (builds/img/scenes/1_1/<ghost>.jpg) and her words, or the picture of the article the whisper reacts to when it has one. Everything else, and any whisper that is gone, passes through untouched.
// Deployed by: python3 tools/deploy_worker.py edge   (route and variables in worker/edge.jsonc)

const getOwn = (url) => fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
// The API Worker is called through a service binding (env.API), not over the internet: its public address only answers
// requests that carry the site's Origin header (tools/setup_waf.py); the API Worker also wants it, so it is sent here.
const getApi = (env, path) => env.API.fetch(`https://api.internal${path}`, { headers: { Origin: env.SITE_ORIGIN } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

async function findWhisper(env, n) {
  const one = await getApi(env, `/whispers/${n}`);
  if (one?.whisper) return one.whisper;
  const feed = await getApi(env, "/whispers");   // the API may not have the by-number route yet
  return feed?.whispers?.find((w) => String(w.n) === n) || null;
}

// The answer carries X-Omon-Edge: what this Worker did (rewritten, or why not), for debugging with curl -I.
const tagged = (res, note) => { const out = new Response(res.body, res); out.headers.set("X-Omon-Edge", note); return out; };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Asked on the Worker's own address (edgemon...): only an alias, so send the visitor on to the same path on the site,
    // where the route gives the page its preview.
    if (url.hostname !== new URL(env.SITE_ORIGIN).hostname) return Response.redirect(`${env.SITE_ORIGIN}${url.pathname}${url.search}`, 301);
    // /whispers/img/<n>.jpg: the redrawn picture of a whisper's article (tools/remake_image.py). It is served here, on the site's own address,
    // because <img> tags send no Origin and the API Worker's public address refuses requests without one.
    const picture = /^\/whispers\/img\/(\d{1,10})\.jpg$/.exec(url.pathname);
    if (picture && (request.method === "GET" || request.method === "HEAD")) {
      // link-preview bots (WhatsApp, Slack, LinkedIn ...) often ask with HEAD first; they get the same headers without the body
      const res = await env.API.fetch(`https://api.internal/img/${picture[1]}.jpg${url.search}`);
      return tagged(request.method === "HEAD" ? new Response(null, { status: res.status, headers: res.headers }) : res, "picture");
    }
    const n = url.searchParams.get("n") || "";
    if (request.method !== "GET" || !/^\d{1,10}$/.test(n)) return tagged(await fetch(request), "skip");

    const [page, whisper, chars] = await Promise.all([fetch(request), findWhisper(env, n), getOwn(`${url.origin}/characters.json`)]);
    const ghost = chars?.characters?.find((c) => c.id === whisper?.ghost);
    if (!page.ok || !whisper || !ghost) return tagged(page, `pass: page=${page.status} whisper=${Boolean(whisper)} ghost=${Boolean(ghost)}`);

    // The words are in the language of the person who shared (?lang=en; the app's default is Indonesian), with the ghost's name in front.
    const id = url.searchParams.get("lang") !== "en" && whisper.text?.id;
    const site = env.SITE_NAME || "Omon Omon";
    const text = `${ghost.name}: ${(id || whisper.text?.en || "")}`.slice(0, 220);
    // A whisper about an article is titled with the article's own headline (the ghost's name and words stay in the description);
    // one without an article keeps "<ghost> on <site>".
    const headline = typeof whisper.link?.title === "string" ? whisper.link.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    const title = headline || (id ? `${ghost.name} di ${site}` : `${ghost.name} on ${site}`);
    // A whisper that points to an article, trend or video uses that picture; the ghost's own picture is the fallback.
    const thumb = typeof whisper.link?.thumb === "string" && /^https:\/\//.test(whisper.link.thumb) ? whisper.link.thumb : null;
    const image = thumb || `${url.origin}/builds/img/scenes/1_1/${ghost.id}.jpg`;
    const set = (value) => ({ element: (e) => e.setAttribute("content", value) });
    // the static page declares a square picture of known size; an article's picture is usually wide, so drop those hints
    const square = thumb ? { element: (e) => e.remove() } : {};
    return new HTMLRewriter()
      .on('meta[property="og:image:width"]', square)
      .on('meta[property="og:image:height"]', square)
      .on('meta[name="twitter:card"]', thumb ? set("summary_large_image") : {})
      .on("title", { element: (e) => e.setInnerContent(title) })
      .on('meta[name="description"]', set(text))
      .on('meta[property="og:title"]', set(title))
      .on('meta[property="og:description"]', set(text))
      .on('meta[property="og:image"]', set(image))
      .on('meta[property="og:url"]', set(url.href))
      .on('meta[name="twitter:title"]', set(title))
      .on('meta[name="twitter:description"]', set(text))
      .on('meta[name="twitter:image"]', set(image))
      .transform(tagged(page, "rewritten"));
  },
};
