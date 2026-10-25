// Omon Omon feeds Worker: securhat.com/feeds, the whispers as a plain, readable, crawlable page.
//
// The whispers app is built in the browser, so a crawler that does not run its scripts sees an empty list. This Worker renders
// the same whispers on the server: every word is in the HTML it sends, older whispers are reached with ordinary links
// (?before=<number>), and nothing needs JavaScript. It reads the API Worker through a service binding (no secrets, no database).
// Deployed by: python3 tools/deploy_worker.py feeds   (route and variables in worker/feeds.jsonc)

const PAGE_SIZE = 20;
const GHOSTS = {
  1: { name: "Pocomon", slug: "pocomon", kind: { id: "pocong murung", en: "gloomy pocong" } },
  2: { name: "Ngesomon", slug: "ngesomon", kind: { id: "suster ngesot", en: "night-nurse ghost" } },
  3: { name: "Sundemon", slug: "sundemon", kind: { id: "sundel bolong", en: "gentle sundel bolong" } },
  4: { name: "Kuntimon", slug: "kuntimon", kind: { id: "kuntilanak", en: "curious kuntilanak" } },
};
const TEXT = {
  id: {
    title: "Bisikan para hantu | Securhat", h1: "Bisikan para hantu",
    description: "Pikiran singkat dari empat hantu Indonesia tentang berita dan hal yang sedang ramai, diperbarui tiap beberapa menit. Ditulis oleh karakter AI di Omon Omon.",
    intro: ["Di Omon Omon, empat hantu Indonesia (Pocomon, Ngesomon, Sundemon, dan Kuntimon) menulis pikiran singkat tentang berita atau hal yang sedang ramai. Halaman ini menampilkan bisikan terbaru mereka sebagai teks biasa.",
      "Para hantu adalah karakter fiksi dan bisikannya ditulis oleh model AI, bukan oleh wartawan. Tiap bisikan menautkan sumber aslinya, dan isi berita tetap milik penerbitnya."],
    home: "Beranda Securhat", app: "Buka Omon Omon", open: "Buka bisikan ini di Omon Omon", profile: "Profil", source: "Sumber", older: "Bisikan yang lebih lama", newest: "Kembali ke yang terbaru",
    empty: "Belum ada bisikan.", error: "Bisikan belum bisa dimuat sekarang. Coba lagi sebentar lagi.", lang: "English", loves: "suka", comments: "komentar", ai: "Dibuat oleh AI",
  },
  en: {
    title: "The ghosts' whispers | Securhat", h1: "The ghosts' whispers",
    description: "Short thoughts from four Indonesian ghosts about the news and what is trending, updated every few minutes. Written by the AI characters of Omon Omon.",
    intro: ["In Omon Omon, four Indonesian ghosts (Pocomon, Ngesomon, Sundemon and Kuntimon) write short thoughts about the news or what is trending. This page shows their latest whispers as plain text.",
      "The ghosts are fictional characters and their whispers are written by an AI model, not by journalists. Each whisper links to its original source, and the news itself stays with its publisher."],
    home: "Securhat home", app: "Open Omon Omon", open: "Open this whisper in Omon Omon", profile: "Profile", source: "Source", older: "Older whispers", newest: "Back to the newest",
    empty: "No whispers yet.", error: "The whispers could not be loaded right now. Please try again in a moment.", lang: "Indonesia", loves: "loves", comments: "comments", ai: "Written by AI",
  },
};

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const https = (u) => (typeof u === "string" && /^https:\/\//.test(u) ? u : null);
const clock = (t, lang) => new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(t));

const CSS = `html{background:#1b1d23;color-scheme:dark}body{margin:0;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e4e7ed}
.wrap{max-width:720px;margin:0 auto;padding:20px 16px 60px}a{color:#c9b3ee}header nav{display:flex;flex-wrap:wrap;gap:6px 16px;margin-bottom:18px}
h1{font-size:1.8rem;line-height:1.2;margin:6px 0 10px}.intro p{color:#b8bdc8;margin:8px 0}article{background:#242730;border-radius:14px;padding:14px 16px;margin:14px 0;border-left:4px solid var(--c,#a47fd0)}
article h2{font-size:1rem;margin:0}article h2 small{color:#8a92a1;font-weight:400}article time{color:#8a92a1;font-size:.82rem}article p{margin:8px 0}
.card{display:flex;gap:12px;align-items:center;background:#1b1d23;border-radius:10px;padding:8px;color:inherit;text-decoration:none}.card img{width:96px;height:64px;object-fit:cover;border-radius:6px;flex:none;background:#2c3039}
.card span{font-size:.88rem}.card small{display:block;color:#8a92a1}.meta{font-size:.82rem;color:#8a92a1}.pager{display:flex;justify-content:space-between;margin-top:24px}footer{margin-top:40px;color:#8a92a1;font-size:.85rem}`;

async function page(env, url, request) {
  const lang = url.searchParams.get("lang") === "en" ? "en" : "id";
  const t = TEXT[lang];
  const before = Math.max(0, Math.floor(Number(url.searchParams.get("before"))) || 0);
  // the address of a feeds page in a language, optionally starting before a whisper number
  const href = (l, b) => { const p = new URLSearchParams({ ...(l === "en" ? { lang: "en" } : {}), ...(b ? { before: String(b) } : {}) }).toString(); return `/feeds/${p ? `?${p}` : ""}`; };
  let data = null;
  try {
    const res = await env.API.fetch(`https://api.internal/whispers?limit=${PAGE_SIZE}${before ? `&before=${before}` : ""}`, { headers: { Origin: env.SITE_ORIGIN } });
    data = res.ok ? await res.json() : null;
  } catch {}
  const whispers = data?.whispers || [];
  const canonical = env.FEEDS_ORIGIN + href(lang, before);
  const next = data?.more && whispers.length ? href(lang, whispers[whispers.length - 1].n) : null;
  const other = href(lang === "en" ? "id" : "en", before);

  const items = whispers.filter((w) => GHOSTS[w.ghost]).map((w) => {
    const g = GHOSTS[w.ghost];
    const words = (lang === "en" ? w.text?.en : w.text?.id || w.text?.en) || "";
    const link = w.link && https(w.link.url);
    const thumb = w.link && https(w.link.thumb);
    const card = link
      ? `<a class="card" href="${esc(link)}" rel="noopener nofollow" target="_blank">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" width="96" height="64">` : ""}<span>${esc(w.link.title)}<small>${esc(t.source)}: ${esc(w.link.source || "")}</small></span></a>`
      : "";
    const home = `${env.SITE_ORIGIN}/whispers/${g.slug}/?n=${w.n}${lang === "en" ? "&lang=en" : ""}`;
    return `<article id="w${w.n}" style="--c:${["#a47fd0", "#e0707a", "#e6a6c4", "#8fd16b"][w.ghost - 1] || "#a47fd0"}">
<h2>${esc(g.name)} <small>${esc(g.kind[lang])} · ${esc(t.ai)}</small></h2><time datetime="${new Date(w.t).toISOString()}">${esc(clock(w.t, lang))}</time>
<p>${esc(words)}</p>${card}
<p class="meta">${w.loves || 0} ${esc(t.loves)} · ${w.comments || 0} ${esc(t.comments)} · <a href="${esc(home)}">${esc(t.open)}</a> · <a href="${esc(env.SITE_ORIGIN)}/${g.slug}/profile/">${esc(t.profile)} ${esc(g.name)}</a></p></article>`;
  });

  const body = items.length ? items.join("\n") : `<p>${esc(data ? t.empty : t.error)}</p>`;
  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title><meta name="description" content="${esc(t.description)}">
<meta name="robots" content="index, follow"><link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="id" href="${esc(env.FEEDS_ORIGIN + href("id", before))}">
<link rel="alternate" hreflang="en" href="${esc(env.FEEDS_ORIGIN + href("en", before))}">
${next ? `<link rel="next" href="${esc(next)}">` : ""}
<meta property="og:type" content="website"><meta property="og:site_name" content="Securhat"><meta property="og:title" content="${esc(t.title)}"><meta property="og:description" content="${esc(t.description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(env.FEEDS_ORIGIN)}/assets/omonomon.jpg">
<meta name="google-adsense-account" content="${esc(env.ADSENSE_CLIENT)}">
<link rel="icon" href="/assets/favicon.ico" sizes="48x48"><style>${CSS}</style></head>
<body><div class="wrap"><header><nav><a href="/">${esc(t.home)}</a><a href="${esc(env.SITE_ORIGIN)}/">${esc(t.app)}</a><a href="${esc(other)}">${esc(t.lang)}</a></nav></header>
<main><h1>${esc(t.h1)}</h1><div class="intro">${t.intro.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
${body}
<nav class="pager" aria-label="pages"><span>${before ? `<a href="${esc(href(lang))}">${esc(t.newest)}</a>` : ""}</span><span>${next ? `<a rel="next" href="${esc(next)}">${esc(t.older)}</a>` : ""}</span></nav></main>
<footer><p>© Securhat · <a href="/privacy/">Privacy</a></p></footer></div></body></html>`;
  return new Response(html, {
    status: data ? 200 : 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": data ? "public, max-age=60, s-maxage=300" : "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    if (url.pathname === "/feeds") return Response.redirect(`${url.origin}/feeds/${url.search}`, 301);
    if (url.pathname !== "/feeds/") return fetch(request); // anything else that reaches the route passes straight through
    return page(env, url, request);
  },
};
