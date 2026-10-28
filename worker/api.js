// Omon Omon API Worker (Cloudflare Worker + D1): Google sign-in, sessions and the saved game progress today, more later.
// A separate Worker from the Gemini Worker (omonomon-gemini), so a games bug or flood can never touch the Gemini budget.
//
//   POST   /auth/google   {credential, turnstile?}   verify Google's ID token, create the account on first sign-in,
//                                        answer {token, user, progress}
//   POST   /riddle      {character, riddle, answers[], guess, device}   Gemini judges a riddle answer: {correct, reply}; 3 a day per browser
//   POST   /push/subscribe {endpoint, lang}  /  DELETE /push/subscribe {endpoint}   opt-in Web Push (signed in: also streak reminders)
//   GET    /push/latest?e=<sha256 of the endpoint>   the text of the notification just sent to that browser
//   POST   /errors      {message, source, line, page}   a script error from a page, written to the request log (no sign-in)
//   GET    /me                           {user, progress}
//   PUT    /progress      {progress}     merge the browser's progress into the account (the larger value wins)
//   POST   /auth/logout                  end this session
//   DELETE /me                           delete the account and everything stored for it
//   POST   /runs/start   {game}         a run token (signed with INTERNAL_TOKEN, valid for one score); the run's length is
//                                        measured by the Worker's clock between this call and the score
//   POST   /scores       {token, score, nickname}  a finished run: kept as this week's best when plausible; answers {accepted, rank}
//   GET    /leaderboard/<game>           this week's top 20 {entries: [{rank, nickname, score}], me: {rank, score}|null, week}
//   GET    /whispers                     the ghosts' latest public updates, newest first (no sign-in); ?limit=&before=<n> pages through them: {whispers, more}
//   POST   /internal/redraw/<n>          redraw an article whisper's picture now (secret INTERNAL_TOKEN)
//   GET    /img/<n>.jpg                  the redrawn picture of a whisper's article (made by tools/remake_image.py; reached through
//                                         the edge Worker as /whispers/img/<n>.jpg, since an <img> sends no Origin)
//   GET    /note/<n>.jpg (-en.jpg)       the sticky-note picture of a plain thought, for link previews (drawn by the Vercel function vercel/api/render.py
//                                         right after the whisper is posted and kept in R2; reached through the edge Worker as /whispers/note/<n>.jpg)
//   GET    /whispers/<n>                 one whisper by its number (older ones are no longer in the list above)
//   POST   /internal/whisper             (secret INTERNAL_TOKEN) write one now; {ghost} optional
//   DELETE /internal/whisper/<n>         (secret INTERNAL_TOKEN) remove one
//   GET    /whispers/<n>/comments        the comments under a whisper, oldest first (visitors' and the ghost's replies)
//   POST   /whispers/<n>/comments        {text, nickname, device}: screened by Gemini, answered by the ghost; no sign-in
//   PUT    /whispers/<n>/love            {device}: love a whisper (once per browser); answers {loves}
//   DELETE /whispers/<n>/love            {device}: take the love back; answers {loves}
//   DELETE /comments/<n>                 {device}: a visitor deletes their own comment (kept in the database with deleted = 1, shown as "deleted")
//   GET    /internal/comments            (secret INTERNAL_TOKEN) the newest comments, for moderation
//   DELETE /internal/comment/<n>         (secret INTERNAL_TOKEN) remove one
// A timer (cron) writes a whisper once per slot (WHISPER_EVERY_MS) by asking the Gemini Worker: in a round every ghost posts once, in a shuffled order.
//
// The session token is a random 256-bit value sent as "Authorization: Bearer ...". Only its SHA-256 hash is stored.
// (Bearer instead of a cookie so sign-in also works from http://localhost while developing.)
//
// Worker settings (see worker/api.jsonc): D1 binding DB, rate limit binding LIMITER, and the plain variables
//   GOOGLE_CLIENT_ID   the OAuth client ID (public)
//   ALLOWED_ORIGINS    comma-separated site origins that may call this API
//   IMAGE_DAILY_MAX    most anime article pictures made on Workers AI in 24 hours (default 85: its free allowance); IMAGE_GEMINI_DAILY_MAX
//                      most made by the Gemini fallback when that allowance is used up (default 10; each is a paid Gemini call)
//   GEMINI_URL         address of the Gemini Worker's /whisper route; GEMINI_COMMENT_URL its /comment route;
//                      SITE_ORIGIN the Origin header sent with them
//   (rate limit bindings LIMITER for everything and COMMENT_LIMITER for posting comments)
//   INTERNAL_TOKEN     secret shared with the Gemini Worker
//   VAPID_PRIVATE_JWK  (optional) the Web Push private key (JWK JSON); VAPID_SUBJECT the contact (mailto:...) sent to push services
//   TURNSTILE_SECRET   (optional) Cloudflare Turnstile secret: with it, creating an account needs a passed bot check

const SESSION_DAYS = 30;
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const MAX_BODY_BYTES = 8 * 1024;
// What a run can plausibly score: at most `perSec` points a second (plus `slack`) and never above `max`. Scores come from the
// browser, so this only stops silly ones; the boards are cosmetic.
// BEGIN SCORE_LIMITS (written by tools/sync_limits.py from the "limits" of every game in games.json and games.d/)
const SCORE_LIMITS = {
  "hop-hop": { perSec: 45, slack: 20, max: 20000 },
  "night-rounds": { perSec: 35, slack: 30, max: 20000 },
  "quiet-wish": { perSec: 8, slack: 30, max: 3000 },
  "hair-catch": { perSec: 55, slack: 30, max: 30000 },
  "congklak": { perSec: 4, slack: 20, max: 140 },
  "daily": { perSec: 55, slack: 30, max: 30000 },
  "dare-night": { perSec: 8, slack: 30, max: 200 },
  "ghost-riddles": { perSec: 3, slack: 20, max: 90 },
  "guess-the-ghost": { perSec: 12, slack: 30, max: 170 },
  "haunted-house": { perSec: 4, slack: 30, max: 150 },
  "hop-hop-3d": { perSec: 45, slack: 20, max: 20000 },
  "lantern-flight": { perSec: 8, slack: 60, max: 700 },
  "memory-garden": { perSec: 300, slack: 600, max: 12000 },
  "night-meds": { perSec: 12, slack: 40, max: 4000 },
  "rope-untangle": { perSec: 25, slack: 120, max: 2000 },
  "tree-gossip": { perSec: 20, slack: 60, max: 5000 },
};
// END SCORE_LIMITS
const MIN_RUN_SECS = 3;
const MAX_RUN_SECS = 3600; // a run token older than this is no longer valid
const BOARD_SIZE = 20;
const RIDDLES_PER_DEVICE_DAY = 3;
const RIDDLES_PER_DAY = 300;
const MAX_VALUE = 1_000_000; // no stored number may be larger than this

// ---- request log (Axiom) ----
// One line per request to Axiom when the secret AXIOM_TOKEN is set (an ingest-only token). It holds: time, worker, status,
// error word, method, the address asked for, browser type, country, duration and the IP address. Never a Google credential,
// session token, email address or progress. Set the text variable LOG_IP to "off" to leave the IP address out.
//   AXIOM_DATASET  text  optional, default "omonomon"
//   AXIOM_URL      text  optional, the dataset's edge address (default https://us-east-1.aws.edge.axiom.co)
// What was asked for, shortened: host + path + query (at most 200 characters), and the browser type (at most 120).
// Scanners show up clearly here; nothing secret is ever in them (this API never puts tokens in the address).
const requestUrl = (request) => {
  const u = new URL(request.url);
  return (u.host + u.pathname + u.search).slice(0, 200);
};
const userAgent = (request) => (request.headers.get("User-Agent") || "").slice(0, 120) || undefined;

function logRequest(env, ctx, event) {
  if (!env.AXIOM_TOKEN) return;
  const url = `${env.AXIOM_URL || "https://us-east-1.aws.edge.axiom.co"}/v1/ingest/${encodeURIComponent(env.AXIOM_DATASET || "omonomon")}`;
  ctx?.waitUntil?.(
    fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.AXIOM_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([event]),
    }).catch(() => {}) // logging must never break a reply
  );
}

// ---- small helpers ----

const enc = new TextEncoder();
const b64urlToBytes = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
const bytesToB64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256Hex = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");

// ---- Google ID token ----

let jwksCache = { keys: null, at: 0 };

async function googleKeys(forceFresh = false) {
  if (!forceFresh && jwksCache.keys && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("could not load Google's keys");
  jwksCache = { keys: (await res.json()).keys, at: Date.now() };
  return jwksCache.keys;
}

// Check the token's signature against Google's public keys and its claims. Returns the payload or throws.
export async function verifyGoogleIdToken(idToken, clientId, now = Date.now()) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  if (header.alg !== "RS256") throw new Error("unexpected algorithm");

  let jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(true)).find((k) => k.kid === header.kid); // keys rotate
  if (!jwk) throw new Error("unknown signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error("bad signature");

  const p = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  if (!GOOGLE_ISSUERS.includes(p.iss)) throw new Error("wrong issuer");
  if (!clientId || p.aud !== clientId) throw new Error("token is for another app");
  if (!(p.exp * 1000 > now)) throw new Error("token expired");
  if (!p.sub) throw new Error("no subject");
  if (p.email && p.email_verified === false) throw new Error("email not verified");
  return p;
}

// ---- profile ----

// Only keep a photo link that really points at Google's image host.
export function cleanPicture(url) {
  if (typeof url !== "string" || url.length > 400) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)googleusercontent\.com$/.test(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}
export const cleanName = (name) => (typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : null);

// ---- whispers ----

const GHOSTS = ["1", "2", "3", "4"];
// One whisper per slot, so every ghost posts once an hour (a "round" of 4 slots). The timer ticks every 15 minutes (it also redraws pictures);
// only the first tick of a slot makes a whisper. For a slower pace use a longer slot, e.g. 2 * 60 * 60_000 (a whisper every 2 hours).
const WHISPER_EVERY_MS = 15 * 60_000;
// How long whispers (with their comments and loves) are kept. null keeps them for good; a number of milliseconds deletes older ones
// each time a new whisper is written. At about 100 whispers a day this grows the database by roughly 50 MB a year (D1 allows 500 MB).
const WHISPER_KEEP_MS = null;
const KINDS = [
  "a passing thought", "a small complaint about life as a ghost", "something you noticed tonight",
  "a question for the people who follow you", "a bit of gossip from the graveyard", "a tiny wish",
];

// "Saturday night" in Jakarta, so a whisper can fit the moment.
export function whenText(now) {
  const d = new Date(now + 7 * 3600_000);
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
  const h = d.getUTCHours();
  const part = h < 5 ? "the middle of the night" : h < 11 ? "morning" : h < 15 ? "midday" : h < 18 ? "afternoon" : h < 21 ? "evening" : "night";
  return `${day} ${part}`;
}

export function sameSecret(a, b) { // compares without stopping at the first difference
  if (typeof a !== "string" || typeof b !== "string" || !a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// The order the ghosts post in during one round: a shuffle seeded by the round number, so it looks random but needs no
// saved state and a repeated timer run picks the same ghost. If the round would open with the ghost who closed the round
// before, its first two swap (the last place never moves, so the check against the previous round stays valid).
function shuffled(round) {
  let s = (round * 2654435761) >>> 0;
  const rand = () => { // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = [...GHOSTS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
export function roundOrder(round) {
  const order = shuffled(round);
  if (order[0] === shuffled(round - 1).at(-1)) [order[0], order[1]] = [order[1], order[0]];
  return order;
}

// ---- what a whisper points to ----
// Every whisper is about something from Indonesia that the ghost "found": a news article, a topic people are searching for,
// or a popular video, shown as a card with a picture. Light subjects only: anything about crime, disasters, death, politics
// or religion is dropped here, and the Gemini Worker can still turn down one it finds heavy. Only links to Indonesian
// sites are used, and only pictures served over https.

const FEEDS = [ // [site, RSS address]: sections with light subjects
  ["Antara", "https://www.antaranews.com/rss/tekno.xml"],
  ["Antara", "https://www.antaranews.com/rss/hiburan.xml"],
  ["Antara", "https://www.antaranews.com/rss/humaniora.xml"],
  ["CNN Indonesia", "https://www.cnnindonesia.com/teknologi/rss"],
  ["CNN Indonesia", "https://www.cnnindonesia.com/gaya-hidup/rss"],
  ["CNN Indonesia", "https://www.cnnindonesia.com/hiburan/rss"],
];
// A topic from Google Trends counts only through a news item from one of these sites (or any .id address).
const INDONESIAN_SITE = /(^|\.)(id|co\.id|detik\.com|kompas\.com|cnnindonesia\.com|antaranews\.com|tribunnews\.com|liputan6\.com|kumparan\.com|suara\.com|tempo\.co|okezone\.com|idntimes\.com|cnbcindonesia\.com|merdeka\.com|jawapos\.com|sindonews\.com|bisnis\.com|viva\.co\.id|pikiran-rakyat\.com|suaramerdeka\.com|beritajatim\.com)$/;
const ENGLISH_EDITION = /^(en|english)\./;
// No sports: not the sports feeds, and no topic, article or video that is about a match, a league, a team or an athlete.
const SPORT = new RegExp([
  "olahraga", "sepak ?bola", "\\bbola\\b", "\\bliga\\b", "piala", "timnas", "\\bpssi\\b", "\\bgol\\b", "pertandingan", "\\blaga\\b", "klasemen", "kualifikasi",
  "motogp", "\\bf1\\b", "formula ?1", "balapan", "badminton", "bulu tangkis", "\\bbasket", "\\bnba\\b", "\\bvoli\\b", "tenis", "tinju", "\\bufc\\b", "\\bmma\\b",
  "atlet", "olimpiade", "sea games", "asian games", "juara dunia", "striker", "kiper", "wasit", "persib", "persija", "arema", "renang", "\\bgolf\\b",
  "football", "soccer", "premier league", "champions league", "world cup", "\\bfifa\\b", "grand prix", "tennis", "boxing", "olympic", "\\bnfl\\b", "\\bwwe\\b", "cricket", "marathon",
].join("|"), "i");
const HEAVY = new RegExp([
  "korupsi", "tersangka", "ditangkap", "penangkapan", "pembunuh", "dibunuh", "bunuh", "tewas", "meninggal", "wafat", "jenazah",
  "kecelakaan", "korban", "bencana", "gempa", "tsunami", "longsor", "kebakaran", "teroris", "\\bbom\\b", "narkoba", "sabu",
  "pemerkosa", "pencabulan", "pelecehan", "asusila", "cabul", "\\bjudi\\b", "judol", "pinjol", "kekerasan", "penganiayaan",
  "mutilasi", "perang", "tawuran", "unjuk rasa", "\\bdemo\\b", "politik", "pilkada", "pilpres", "pemilu", "capres", "cawapres",
  "presiden", "wapres", "menteri", "\\bdpr", "partai", "prabowo", "jokowi", "gibran", "agama", "penistaan", "\\bsara\\b",
  "banjir", "erupsi", "letusan", "puting beliung", "evakuasi", "terdampak", "pengungsi", "dinyatakan hilang", "pencarian korban", "darurat",
  "polisi", "polri", "pidana", "vonis", "sidang", "pengadilan", "hakim", "jaksa", "\\bkpk\\b", "dipenjara", "penjara", "pelaku",
  "lelang", "bangkrut", "utang", "cerai", "selingkuh", "skandal", "gugat", "klarifikasi", "kontroversi", "hoaks", "\\bhoax\\b",
  "porno", "bokep", "depresi", "murder", "killed", "\\bdead\\b", "\\bdeath\\b", "crash", "disaster", "terror", "\\brape\\b", "\\bporn",
].join("|"), "i");

const unxml = (s) => String(s ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const plain = (s) => unxml(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const tagText = (xml, name) => (new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml) || [])[1];
const attr = (xml, tag, name) => (new RegExp(`<${tag}\\b[^>]*?\\b${name}="([^"]+)"`).exec(xml) || [])[1];

// Only https addresses are kept (a plain-http picture would be blocked on the page anyway), at a sane length.
export function httpsUrl(url) {
  try {
    const u = new URL(unxml(url).trim());
    if (u.protocol === "http:") u.protocol = "https:";
    return u.protocol === "https:" && u.href.length <= 500 ? u.href : null;
  } catch {
    return null;
  }
}

// The articles of one RSS feed: [{url, title, summary, thumb, source, kind}]
export function parseFeed(xml, source) {
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const item = m[1];
    const description = tagText(item, "description") || "";
    return {
      kind: "article", source,
      url: httpsUrl(tagText(item, "link") || tagText(item, "guid") || ""),
      title: plain(tagText(item, "title")),
      summary: plain(description).slice(0, 300),
      thumb: httpsUrl(attr(item, "enclosure", "url") || attr(item, "media:content", "url") || (/<img[^>]+src="([^"]+)"/.exec(unxml(description)) || [])[1] || ""),
    };
  });
}

// Google Trends' list of what people in Indonesia are searching for now, each with news about it: [{...}] for the topics that
// have a news item from an Indonesian site.
export function parseTrends(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1];
    const topic = plain(tagText(item, "title"));
    const traffic = plain(tagText(item, "ht:approx_traffic"));
    for (const n of item.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)) {
      const url = httpsUrl(tagText(n[1], "ht:news_item_url") || "");
      const host = url ? new URL(url).hostname.replace(/^www\./, "") : "";
      // Not an English edition (en.antaranews.com passes INDONESIAN_SITE as a subdomain of antaranews.com): the page and its card would be English.
      if (!url || ENGLISH_EDITION.test(host) || !INDONESIAN_SITE.test(host)) continue;
      out.push({
        kind: "trend", url, source: plain(tagText(n[1], "ht:news_item_source")) || "Google Trends",
        title: plain(tagText(n[1], "ht:news_item_title")),
        summary: `Trending in Indonesia right now: "${topic}"${traffic ? ` (${traffic} searches)` : ""}.`,
        thumb: httpsUrl(tagText(n[1], "ht:news_item_picture") || tagText(item, "ht:picture") || ""),
      });
      break; // one article per topic
    }
  }
  return out;
}

const fetchFeed = (url, accept = "application/rss+xml, application/xml, text/xml, */*") =>
  fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; OmonomonBot/1.0)", Accept: accept }, signal: AbortSignal.timeout(8000), cf: { cacheTtl: 300, cacheEverything: true } })
    .then((r) => { if (!r.ok) throw new Error(`${url} ${r.status}`); return r; });

const SOURCES = {
  async article(env, slot) { // three feeds per time slot, rotating through the list
    const picks = [0, 1, 2].map((i) => FEEDS[(slot + i * 3) % FEEDS.length]);
    const lists = await Promise.all(picks.map(([site, url]) => fetchFeed(url).then((r) => r.text()).then((x) => parseFeed(x, site)).catch(() => [])));
    return lists.flat();
  },
  async trend() {
    return parseTrends(await (await fetchFeed("https://trends.google.com/trending/rss?geo=ID")).text());
  },
  async video(env) { // YouTube's most popular videos in Indonesia, from channels that say they are in Indonesia (needs the secret YOUTUBE_API_KEY)
    if (!env.YOUTUBE_API_KEY) return [];
    const key = encodeURIComponent(env.YOUTUBE_API_KEY);
    const vids = (await (await fetchFeed(`https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=ID&maxResults=30&key=${key}`, "application/json")).json()).items || [];
    const channels = [...new Set(vids.map((v) => v.snippet?.channelId).filter(Boolean))].slice(0, 50);
    const info = channels.length ? (await (await fetchFeed(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channels.join(",")}&maxResults=50&key=${key}`, "application/json")).json()).items || [] : [];
    const indonesian = new Set(info.filter((c) => c.snippet?.country === "ID").map((c) => c.id));
    return vids.filter((v) => indonesian.has(v.snippet?.channelId)).map((v) => ({
      kind: "video", source: v.snippet.channelTitle || "YouTube", url: httpsUrl(`https://www.youtube.com/watch?v=${v.id}`),
      title: plain(v.snippet.title), summary: plain(v.snippet.description || "").slice(0, 300),
      thumb: httpsUrl(v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || ""),
    }));
  },
};

// ---- the picture: the article's own og:image first, the feed's picture as the fallback ----
// A site's feed often has a small or cropped picture; the page itself names the one it wants shown when shared (og:image).
const BROWSER = "Mozilla/5.0 (compatible; OmonomonBot/1.0)";
const IMAGE_META = /^(og:image|og:image:secure_url|twitter:image|twitter:image:src)$/i;

// The picture a page asks to be shown with (og:image, then its secure_url, then twitter:image), as an https address, or null.
export function ogImage(html, pageUrl) {
  let best = null;
  let bestRank = 99;
  for (const m of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const key = (/\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(m[0]) || [])[1];
    const content = (/\bcontent\s*=\s*["']([^"']+)["']/i.exec(m[0]) || [])[1];
    if (!key || !content || !IMAGE_META.test(key)) continue;
    const rank = /^og:image$/i.test(key) ? 0 : /^og:image:secure_url$/i.test(key) ? 1 : 2;
    let url = null;
    try { url = httpsUrl(new URL(unxml(content), pageUrl).href); } catch { /* not an address */ }
    if (url && rank < bestRank) { best = url; bestRank = rank; }
  }
  return best;
}

// Just the top of a page: its <head> holds the meta tags, so there is no need to download the rest.
async function readHead(res, limit = 200_000) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (text.length < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(text)) break;
  }
  reader.cancel().catch(() => {});
  return text;
}

// Is this address a real picture? It must answer, say it is an image, and not be a tiny placeholder.
export async function imageWorks(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": BROWSER, Range: "bytes=0-2047", Accept: "image/*" }, signal: AbortSignal.timeout(6000) });
    res.body?.cancel().catch(() => {});
    if (res.status !== 200 && res.status !== 206) return false;
    if (!/^image\//i.test(res.headers.get("content-type") || "")) return false;
    const total = Number((/\/(\d+)$/.exec(res.headers.get("content-range") || "") || [])[1] || res.headers.get("content-length") || 0);
    return total === 0 || total >= 4000; // size unknown: accepted; a few hundred bytes is a placeholder
  } catch {
    return false;
  }
}

// The picture to show for a candidate: the page's og:image when it works, otherwise the one from the feed.
export async function betterThumb(c) {
  try {
    const res = await fetch(c.url, { headers: { "User-Agent": BROWSER, Accept: "text/html" }, signal: AbortSignal.timeout(6000) });
    if (res.ok && /html/i.test(res.headers.get("content-type") || "")) {
      const og = ogImage(await readHead(res), res.url || c.url);
      if (og && og !== c.thumb && (await imageWorks(og))) return og;
    } else {
      res.body?.cancel().catch(() => {});
    }
  } catch { /* the page did not answer: the feed's picture it is */ }
  return c.thumb;
}
const SOURCE_ORDER = ["article", "trend", "video"];

// Fit to show: a title and a picture, nothing heavy, not used before.
export const fitsWhisper = (c, seen) =>
  Boolean(c.url && c.thumb && c.title.length >= 8 && c.title.length <= 200 && !HEAVY.test(`${c.title} ${c.summary}`) && !SPORT.test(`${c.title} ${c.summary} ${c.source || ""}`) && !seen.has(c.url));

// Up to four things to talk about, the kind of this time slot first (articles, trends and videos take turns), then the others.
async function findLinks(env, now, seen) {
  const slot = Math.floor(now / WHISPER_EVERY_MS);
  const found = [];
  for (let i = 0; i < SOURCE_ORDER.length && found.length < 4; i++) {
    const kind = SOURCE_ORDER[(slot + i) % SOURCE_ORDER.length];
    const list = (await SOURCES[kind](env, slot).catch(() => [])).filter((c) => fitsWhisper(c, seen));
    for (let j = list.length - 1; j > 0; j--) { // shuffled, so the newest is not always the one chosen
      const k = Math.floor(Math.random() * (j + 1));
      [list[j], list[k]] = [list[k], list[j]];
    }
    found.push(...list.slice(0, i === 0 ? 3 : 2));
  }
  return found.slice(0, 4);
}

// The picture people see for a whisper's article:
//   - a whisper made after anime pictures started (n above ORIGINAL_OK_UNTIL) shows ONLY its anime redraw (anime_image is its key in R2), never the
//     source's own picture: it is redrawn before the whisper is posted, and when that fails the article's card shows no picture until the
//     timer has made one (backfillAnime);
//   - a whisper posted before that (n up to ORIGINAL_OK_UNTIL) keeps showing the source's picture unless it has been redrawn.
// The redraw is given through Cloudflare's image resizing (/cdn-cgi/image/...), which shrinks the stored picture to a size link previews
// accept (WhatsApp ignores pictures over about 300 KB); `onerror=redirect` serves the stored file if the resizer refuses (free plan: 5,000 a month).
// The source's own picture always stays in the database (thumb_url).
// Raise IMAGE_VERSION when the stored pictures or these options change: the new address skips every cache that holds the old file.
const ORIGINAL_OK_UNTIL = 128;
const IMAGE_VERSION = 10;
// A square (900x900) crop of the stored picture, centred on its main subjects (gravity=auto); the stored file keeps its own shape. The share address in
// worker/edge.js reads "height=900" from this to know the picture is square.
const IMAGE_OPTIONS = "width=900,height=900,fit=cover,gravity=auto,quality=75,format=jpeg,onerror=redirect";
// The address also carries the time in the picture's key (anime/<time>-<id>.jpg), which is new for every redraw: browsers keep these pictures for a
// week, so a redone picture needs a new address or they keep showing the old one.
const pictureStamp = (key) => { const m = /(\d{10,})/.exec(key || ""); return m ? `&k=${m[1]}` : ""; };
const animeUrl = (site, n, key) => `${site}/cdn-cgi/image/${IMAGE_OPTIONS}/whispers/img/${n}.jpg?v=${IMAGE_VERSION}${pictureStamp(key)}`;
const shapeWhisper = (r, site) => ({
  n: r.n, ghost: r.ghost, t: r.created_at, comments: r.comments, loves: r.loves, text: { en: r.text_en, id: r.text_id },
  link: r.link_url ? {
    url: r.link_url, title: r.link_title, source: r.link_source,
    thumb: r.anime_image ? animeUrl(site, r.n, r.anime_image) : r.n <= ORIGINAL_OK_UNTIL ? r.thumb_url : null,
  } : null,
});

// Things worth a whisper right now, beyond the news: this week's event (for its host), an Indonesian holiday, the season, a
// kind comment a visitor left lately. Returns a short topic for the Gemini Worker, or null.
const HOLIDAYS = { "01-01": "New Year's Day", "04-21": "Kartini Day", "05-02": "National Education Day", "06-01": "Pancasila Day", "08-17": "Indonesian Independence Day", "10-28": "Youth Pledge Day", "10-31": "Halloween night", "11-10": "Heroes' Day", "12-25": "Christmas Day", "12-31": "New Year's Eve" };
const SEASON_EVERY_MS = 6 * 3600_000;   // how often any ghost may post about the weather or the season
async function postedSeasonRecently(env, now) {
  const row = await env.DB.prepare(
    "SELECT n FROM whispers WHERE created_at > ?1 AND link_url IS NULL AND (text_en LIKE '%rain%' OR text_en LIKE '%damp%' OR text_en LIKE '%soaked%' OR text_en LIKE '%drizzle%' OR text_en LIKE '%dust%' OR text_en LIKE '%heat%' OR text_en LIKE '%hujan%' OR text_id LIKE '%hujan%') LIMIT 1"
  ).bind(now - SEASON_EVERY_MS).first().catch(() => null);
  return Boolean(row);
}

const GAME_WEEK_EVERY_MS = 24 * 3600_000;   // how often the host may announce her game week
async function announcedGameWeek(env, id, now) {
  const row = await env.DB.prepare(
    "SELECT n FROM whispers WHERE ghost = ?1 AND created_at > ?2 AND (text_en LIKE '%bond XP%' OR text_en LIKE '%game week%' OR text_en LIKE '%mini game%') LIMIT 1"
  ).bind(id, now - GAME_WEEK_EVERY_MS).first().catch(() => null);
  return Boolean(row);
}

export async function whisperContext(env, now, id, slot) {
  const jakarta = new Date(now + 7 * 3600_000);
  const day = jakarta.toISOString().slice(5, 10);
  // The host announces the game week at most once a day. (It used to be every other time she posted: eight times in a day.)
  if (hostOfWeek(now) === id && slot % 2 === 0 && !(await announcedGameWeek(env, id, now))) return { kind: "this week you host the game week of this little app: tell readers, in your own way, that your mini game gives double bond XP all week (do not give a link)" };
  // On a holiday only about one slot in two hours is about it (the rest of the day the whispers stay about what was found online): when every slot
  // was, the feed filled with 40 whispers about Youth Pledge Day in one morning.
  const holidayEvery = Math.max(1, Math.round((2 * 3600_000) / WHISPER_EVERY_MS));
  if (HOLIDAYS[day] && slot % holidayEvery === 0) return { kind: `today is ${HOLIDAYS[day]} in Indonesia: say something about it in your own voice` };
  if (slot % 3 !== 0) return null; // the rest of the time whispers stay about what was found online
  // The latest visitor comment of the last day that no whisper has answered yet (and that says enough to answer: 8 characters or more).
  const comment = await env.DB.prepare(
    "SELECT n, body FROM comments WHERE kind = 'user' AND deleted = 0 AND answered_by IS NULL AND length(trim(body)) >= 8 AND created_at > ?1 ORDER BY created_at DESC LIMIT 1"
  ).bind(now - 86400_000).first().catch(() => null);
  if (comment?.body && slot % 6 === 0) {
    const said = String(comment.body).replace(/\s+/g, " ").trim().slice(0, 80);
    return { commentN: comment.n, kind: `a visitor wrote under one of the whispers lately: "${said}". Begin your whisper by quoting what they wrote exactly, in quotation marks and in the language they wrote it (do not translate the quote, in either version), so that readers know what you are answering. Then answer kindly in your own voice. Do not name the visitor.` };
  }
  // A weather or season whisper at most once every few hours, from any ghost. (When the season was the fallback every time, the feed filled with
  // rain: eight rain whispers in a day.) Without one, the whisper stays about what was found online.
  if (await postedSeasonRecently(env, now)) return null;
  const month = jakarta.getUTCMonth() + 1;
  return { kind: month >= 10 || month <= 3 ? "it is the rainy season in Indonesia: say something about the rain, the damp or the sound of it" : "it is the dry season in Indonesia: say something about the heat, the dust or the clear night sky" };
}

// Every new whisper gets company from the other ghosts: one to three of them love it (at random), one of them comments with an
// open-ended question, and the whisper's own ghost answers that comment with a closed reply. A ghost's love is a row in `loves`
// with the device "ghost:<id>", so it counts like any heart; two extra Gemini calls per whisper.
export async function reactToWhisper(env, whisper, now, rng = Math.random) {
  const others = GHOSTS.filter((g) => g !== whisper.ghost).sort(() => rng() - 0.5);
  const lovers = others.slice(0, 1 + Math.floor(rng() * 3));
  await env.DB.batch(lovers.map((g, i) => env.DB.prepare("INSERT OR IGNORE INTO loves (whisper_n, device_hash, created_at) VALUES (?1, ?2, ?3)").bind(whisper.n, `ghost:${g}`, now + i)));
  const commenter = others[Math.floor(rng() * others.length)];
  const ask = async (extra) => {
    const res = await fetch(env.GEMINI_URL.replace(/\/whisper\/?$/, "/ghost-comment"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: env.SITE_ORIGIN, "X-Internal-Token": env.INTERNAL_TOKEN },
      body: JSON.stringify(extra),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.en || !data?.id) throw new Error(`the Gemini Worker answered ${res.status}`);
    return data;
  };
  const insert = (ghost, replyTo, c, at) => env.DB.prepare(
    "INSERT INTO comments (whisper_n, kind, ghost, reply_to, body, body_id, created_at) VALUES (?1, 'ghost', ?2, ?3, ?4, ?5, ?6) RETURNING n"
  ).bind(whisper.n, ghost, replyTo, c.en.slice(0, 200), c.id.slice(0, 200), at).first();
  const comment = await ask({ mode: "comment", character: commenter, other: whisper.ghost, whisper: whisper.en });
  const saved = await insert(commenter, null, comment, now + 1);
  const answer = await ask({ mode: "reply", character: whisper.ghost, other: commenter, whisper: whisper.en, comment: comment.en });
  await insert(whisper.ghost, saved.n, answer, now + 2);
}

// ---- the anime picture of an article ----
// Every whisper that points to an article gets its picture redrawn as anime by Cloudflare Workers AI (FLUX.2 klein, env.AI), kept in the
// R2 bucket as the whisper's anime_image. Nothing else is ever shown (see shapeWhisper). It happens automatically, in two places:
//   - animeFor: while a new whisper is made, before it is saved, so it is posted with its picture. The model refuses some pictures
//     ("output flagged"); then the next article candidate is tried, and with none left the whisper is a plain thought. There is no other
//     fallback: the source's own picture is never shown for a new whisper.
//   - backfillAnime: on every timer tick, for new whispers that still have none (a safety net). Tried at most 3 times (anime_tries).
// One redraw is about 110 neurons (about $0.001); Workers AI gives 10,000 neurons a day free, which is about 90 pictures, hence the daily
// limit IMAGE_DAILY_MAX (85). Keys are anime/<time>-<ghost or number>.jpg: the time in them is what the limit counts.
const IMAGE_DAILY_MAX_DEFAULT = 85;
const ANIME_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const ANIME_PROMPT = "Redraw the entire input image as a beautiful 2D Japanese anime frame inspired by the visual style of *Frieren: Beyond Journey's End*.\n\nPRESERVE THE ORIGINAL:\nKeep the same scene, camera angle, background, scenery, subject identity, facial features, hairstyle, clothing, pose, and body proportions. Change only the visual rendering style, and recompose for the square frame as described below.\n\nRECOMPOSE FROM 16:9 TO 1:1:\nThe input photo is a wide 16:9 landscape frame, and the output must be a square 1:1 frame. Do not stretch, squash, or distort anything to make it fit: every person, face, hand, and object keeps its natural proportions. Instead, reframe the scene properly for a square: keep all main subjects and key objects fully visible, in the same arrangement relative to each other, and extend the background naturally on the top or bottom (or trim only empty edge space) so the result looks like a deliberately composed square shot of the same scene from the same camera angle. Place the main subject well within the square, with balanced, comfortable margins.\n\nANIME RENDERING:\nClean, delicate Japanese anime linework; soft painterly shading; natural gradients; vibrant, harmonious colors; detailed hair; expressive yet faithful facial features; cinematic lighting; and a beautifully painted fantasy atmosphere inspired by *Frieren: Beyond Journey's End*.\n\nCOLOR AND CONTRAST:\nUse vibrant colors, deep true blacks, rich shadows, and excellent contrast resembling a high-quality OLED display. Preserve detail in dark areas without crushing shadow details or making the image unnaturally oversaturated.\n\nSTRICT CONSTRAINTS:\nKeep all main subjects and key objects, with the same relative arrangement. No stretching, squashing, or distortion; no camera angle changes, no new subjects, and no missing subjects. If the photo has no person, animal, or character in it, the result has none either: never add a person, a face, or hands that are not in the photo. No text, letters, logos, or watermarks. Remove any news-agency or publisher logo, watermark, photographer credit, caption bar, border, or frame that is part of the source photo; show only the scene itself, edge to edge. Square 1:1 aspect ratio.\n\nThe final result must look like a professionally illustrated anime frame, and the original image faithfully preserved.";
// FLUX.2 klein is a small model: it follows a short prompt better than the long one above (which stays for Gemini). It is asked for a
// picture of the source's own shape (see outputSize), so it keeps the framing. Keep in step with PROMPT in tools/remake_image.py.
const KLEIN_PROMPT = "Redraw this photo as a 2D Japanese anime frame in the style of Frieren: Beyond Journey's End: clean, delicate " +
  "linework, soft painterly shading, vibrant harmonious colors, deep blacks, rich contrast, cinematic lighting. Keep the same scene, " +
  "subjects, layout, camera angle, framing and aspect ratio; change only the drawing style. Add no people or objects that are not in " +
  "the photo. Remove all text, logos, watermarks, captions and borders.";
const SOURCE_IMAGE_MAX_BYTES = 6 * 1024 * 1024;

async function animeLeft(env, now) {
  const limit = Number(env.IMAGE_DAILY_MAX ?? IMAGE_DAILY_MAX_DEFAULT);
  const made = (await env.DB.prepare("SELECT COUNT(*) AS n FROM whispers WHERE anime_image LIKE 'anime/%-%' AND CAST(substr(anime_image, 7, 13) AS INTEGER) >= ?1").bind(now - 24 * 3600 * 1000).first())?.n || 0;
  return limit - made;
}

function toBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// The width and height of a JPEG, PNG or WebP from its first bytes (no decoding), or null when it cannot be told.
export function imageSize(b) {
  const u32 = (o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { w: u32(16), h: u32(20) };   // PNG
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {   // JPEG: the first "start of frame" marker holds the size
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) { o++; continue; }
      const m = b[o + 1];
      if (m === 0xff) { o++; continue; }
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[o + 5] << 8) | b[o + 6], w: (b[o + 7] << 8) | b[o + 8] };
      o += 2 + ((b[o + 2] << 8) | b[o + 3]);
    }
    return null;
  }
  if (b.length > 30 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {   // WebP
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (kind === "VP8 ") return { w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff };
    if (kind === "VP8L") return { w: 1 + (((b[22] & 0x3f) << 8) | b[21]), h: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)) };
    if (kind === "VP8X") return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  }
  return null;
}

// The size to ask FLUX for: the source's own shape, long side 1024, both sides a multiple of 16. A square source (or one whose size is unknown)
// gives 1024x1024. Forcing a square on a 16:9 picture stretches the scene, so a source that is not square keeps its shape (the page shows it as it is).
export function outputSize(size) {
  if (!size || !size.w || !size.h) return { width: 1024, height: 1024 };
  const long = Math.max(size.w, size.h);
  const fit = (n) => Math.min(1024, Math.max(256, Math.round(((n * 1024) / long) / 16) * 16));
  return { width: fit(size.w), height: fit(size.h) };
}

// The source picture as it is (a square crop would cut away part of a wide photo, often one of its subjects; FLUX gets the photo's own shape instead,
// see outputSize). Answers {bytes, mime} or {error}.
async function fetchSource(thumb) {
  const res = await fetch(thumb, { headers: { "User-Agent": "Mozilla/5.0 (compatible; OmonOmonBot/1.0)" }, signal: AbortSignal.timeout(25000), redirect: "follow" }).catch((e) => ({ ok: false, status: 0, headers: new Headers(), failed: String(e.message || e) }));
  const mime = (res.headers.get("Content-Type") || "").split(";")[0].trim();
  if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(mime)) return { error: `${res.status || res.failed} ${mime}` };
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > SOURCE_IMAGE_MAX_BYTES) return { error: "too big" };
  return { bytes, mime };
}

// The Gemini fallback: used ONLY when Workers AI answers that the free daily allowance of neurons is used up (never for a refused or broken
// picture). It asks the Gemini Worker's /image-test route (Nano Banana 2.1 at its cheapest setting, about $0.04 a picture) to redraw the same
// picture with the same prompt, and is limited to IMAGE_GEMINI_DAILY_MAX a day (10) so that it can never run up a bill. Its keys are
// anime/g-<time>-<ghost or number>.jpg, which keeps them out of the Workers AI count (animeLeft). Returns the key, or null.
const IMAGE_GEMINI_DAILY_MAX_DEFAULT = 10;
async function geminiFallback(env, source, key) {
  const limit = Number(env.IMAGE_GEMINI_DAILY_MAX ?? IMAGE_GEMINI_DAILY_MAX_DEFAULT);
  const made = (await env.DB.prepare("SELECT COUNT(*) AS n FROM whispers WHERE anime_image LIKE 'anime/g-%' AND CAST(substr(anime_image, 9, 13) AS INTEGER) >= ?1").bind(Date.now() - 24 * 3600 * 1000).first())?.n || 0;
  if (made >= limit) return null;
  const res = await fetch(env.GEMINI_URL.replace(/\/whisper\/?$/, "/image-test"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: env.SITE_ORIGIN, "X-Internal-Token": env.INTERNAL_TOKEN },
    body: JSON.stringify({ data: toBase64(source.bytes), mime: source.mime, prompt: ANIME_PROMPT }),
    signal: AbortSignal.timeout(50000),
  });
  const image = (await res.json().catch(() => null))?.image;
  if (!res.ok || !image?.data) return null;
  const gkey = key.replace("anime/", "anime/g-");
  await env.IMAGES.put(gkey, Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0)), { httpMetadata: { contentType: image.mime || "image/jpeg" } });
  return gkey;
}

// One call to FLUX.2 klein (it takes a multipart form). Answers {out, neurons} or, when Cloudflare refuses, {error, exhausted, neurons}.
// returnRawResponse gives the HTTP answer, whose cf-ai-neurons header says what the call used (the plain result does not).
async function runKlein(env, bytes, mime, { width, height } = { width: 1024, height: 1024 }) {
  const form = new FormData();
  form.append("prompt", KLEIN_PROMPT);
  form.append("width", String(width));
  form.append("height", String(height));
  form.append("input_image_0", new Blob([bytes], { type: mime }), "source");
  const packed = new Response(form);   // serialises the form and makes its Content-Type with the boundary
  const res = await env.AI.run(ANIME_MODEL, { multipart: { body: packed.body, contentType: packed.headers.get("content-type") } }, { returnRawResponse: true });
  if (!(res instanceof Response)) return { out: res, neurons: null };
  const reported = res.headers.get("cf-ai-neurons");
  const neurons = reported === null || reported === "" || Number.isNaN(Number(reported)) ? null : Number(reported);
  const text = await res.text().catch(() => "");
  let answer = null;
  try { answer = JSON.parse(text); } catch { /* not JSON: the raw text is used below */ }
  const why = answer?.errors?.[0]?.message || answer?.error?.message || (typeof answer?.error === "string" ? answer.error : "") || text.slice(0, 160);
  if (!res.ok) return { error: why ? `HTTP ${res.status} ${why}` : `HTTP ${res.status}`, exhausted: res.status === 429 || answer?.errors?.[0]?.code === 4006, neurons };
  return { out: answer?.result ?? answer, neurons };
}

// Redraw the picture at `thumb` and store it under `key`; returns key, or null when anything goes wrong (refused, unreachable, too big).
// Every try is written to Axiom as url "cron:anime" with the outcome.
async function redrawTo(env, thumb, key, trace = {}) {
  const started = Date.now();
  let outcome = "error";
  let detail;
  let neurons = null;   // what Cloudflare reported for this call; null when it did not say (never a guess)
  let exhausted = false; // Workers AI said the free daily allowance is used up
  let via = "workers-ai";
  let source = null;     // the source picture, cropped to a square (see fetchSource)
  let sizes = null;      // "source size -> size asked of FLUX", for the log
  try {
    source = await fetchSource(thumb);
    if (source.error) { outcome = "source"; detail = source.error; return null; }
    const srcSize = imageSize(source.bytes);
    const outSize = outputSize(srcSize);
    sizes = `${srcSize ? `${srcSize.w}x${srcSize.h}` : "?"} -> ${outSize.width}x${outSize.height}`;
    const run = await runKlein(env, source.bytes, source.mime, outSize);
    neurons = run.neurons;
    if (run.error) { exhausted = Boolean(run.exhausted); throw new Error(run.error); }
    const out = run.out;
    if (!out?.image) { outcome = "empty"; return null; }
    await env.IMAGES.put(key, Uint8Array.from(atob(out.image), (c) => c.charCodeAt(0)), { httpMetadata: { contentType: "image/jpeg" } });
    outcome = "ok";
    return key;
  } catch (err) {
    detail = String(err.message || err).slice(0, 320);
    outcome = /flagged|3030/.test(detail) ? "refused" : "error";
    if (exhausted && !trace.noGemini) {   // the allowance is used up: Gemini, within its own small daily limit (unless the caller said no)
      outcome = "exhausted";
      const gkey = await geminiFallback(env, source, key).catch((e) => { detail = `${detail} | gemini: ${String(e.message || e).slice(0, 60)}`; return null; });
      if (gkey) { outcome = "ok"; via = "gemini"; return gkey; }
    }
    return null;
  } finally {
    Object.assign(trace, { via, outcome, neurons, detail, ms: Date.now() - started });   // for the caller (the on-demand route answers with it)
    logRequest(env, { waitUntil: (p) => p }, { _time: new Date().toISOString(), worker: "api", url: "cron:anime", model: via === "gemini" ? "gemini-nano-banana-2.1" : ANIME_MODEL, via, redraw: outcome, neurons, error: detail, ms: Date.now() - started, sizes, message: `image: ${thumb}`.slice(0, 200) });
  }
}

async function animeFor(env, link, now, ghost) {
  if (!env.IMAGES || !link?.thumb || (await animeLeft(env, now)) <= 0) return null;
  return redrawTo(env, link.thumb, `anime/${now}-${ghost}.jpg`);
}

// Up to `max` of the whispers made since anime pictures started that have none yet (their redraw failed or hit the daily limit), newest first,
// one Gemini call each (within the daily limit). Older whispers are not touched: they keep their original picture (tools/remake_image.py can still do them).
export async function backfillAnime(env, now = Date.now(), max = 2) {
  if (!env.IMAGES) return;
  for (let i = 0; i < max && (await animeLeft(env, now)) > 0; i++) {
    const row = await env.DB.prepare("SELECT n, thumb_url FROM whispers WHERE link_url IS NOT NULL AND thumb_url IS NOT NULL AND anime_image IS NULL AND anime_tries < 3 AND n > ?1 ORDER BY n DESC LIMIT 1").bind(ORIGINAL_OK_UNTIL).first();
    if (!row) return;
    await env.DB.prepare("UPDATE whispers SET anime_tries = anime_tries + 1 WHERE n = ?1").bind(row.n).run();
    const key = await redrawTo(env, row.thumb_url, `anime/${now}-${row.n}.jpg`).catch(() => null);
    if (key) await env.DB.prepare("UPDATE whispers SET anime_image = ?1 WHERE n = ?2 AND anime_image IS NULL").bind(key, row.n).run();
  }
}

// Ask the Gemini Worker for a whisper from `ghost` (default: whose turn it is in this round) and keep it.
// Returns the saved post, or null when this ghost already posted in this time slot.
export async function makeWhisper(env, now = Date.now(), ghost) {
  const slot = Math.floor(now / WHISPER_EVERY_MS);
  const round = Math.floor(slot / GHOSTS.length);
  const id = ghost || roundOrder(round)[slot % GHOSTS.length];
  if (!GHOSTS.includes(id)) throw new Error("unknown ghost");
  if (!ghost) {
    const done = await env.DB.prepare("SELECT n FROM whispers WHERE ghost = ?1 AND created_at >= ?2").bind(id, slot * WHISPER_EVERY_MS).first();
    if (done) return null; // the timer fired twice
  }
  const kind = KINDS[(round + Number(id)) % KINDS.length];
  const recent = ((await env.DB.prepare("SELECT text_en FROM whispers WHERE ghost = ?1 ORDER BY created_at DESC LIMIT 8").bind(id).all()).results || []).map((r) => r.text_en);
  const ask = async (extra) => {
    const res = await fetch(env.GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: env.SITE_ORIGIN, "X-Internal-Token": env.INTERNAL_TOKEN },
      body: JSON.stringify({ character: id, kind, when: whenText(now), avoid: recent, ...extra }),
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  };
  // Every whisper is about something found online. A candidate the ghost turns down (heavy subject) or that fails is skipped;
  // with nothing usable, the whisper is a plain thought, as before.
  const seen = new Set(((await env.DB.prepare("SELECT link_url FROM whispers WHERE link_url IS NOT NULL ORDER BY created_at DESC LIMIT 300").all()).results || []).map((r) => r.link_url));
  let link = null;
  let data = null;
  let animeKey = null;
  const topic = await whisperContext(env, now, id, slot).catch(() => null);
  let answeredComment = null;   // the visitor comment this whisper answers, marked once the whisper is saved
  if (topic) { // a whisper about the moment instead of a link
    const got = await ask({ kind: topic.kind }).catch(() => null);
    if (got?.res.ok && got.data?.whisper?.en) { data = got.data; answeredComment = topic.commentN ?? null; }
  }
  for (const c of data ? [] : await findLinks(env, now, seen).catch(() => [])) {
    const got = await ask({ link: { kind: c.kind, title: c.title, summary: c.summary, source: c.source } }).catch(() => null);
    if (got?.res.ok && got.data?.whisper?.en) {
      const thumb = await betterThumb(c);
      animeKey = await animeFor(env, { thumb }, now, id).catch(() => null);   // a picture that cannot be redrawn: try the next article
      if (!animeKey) continue;
      link = { ...c, thumb }; data = got.data; break;
    }
  }
  if (!data) {
    const got = await ask({});
    if (!got.res.ok || !got.data?.whisper?.en) throw new Error(`the Gemini Worker answered ${got.res.status}${got.data?.error ? ` (${got.data.error})` : ""}`);
    data = got.data;
  }
  const { en, id: idText } = data.whisper;
  const saved = await env.DB.prepare("INSERT INTO whispers (ghost, text_en, text_id, created_at, link_url, link_title, link_source, thumb_url, anime_image) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) RETURNING n")
    .bind(id, String(en).slice(0, 220), idText ? String(idText).slice(0, 220) : null, now,
      link?.url ?? null, link ? link.title.slice(0, 200) : null, link ? link.source.slice(0, 60) : null, link?.thumb ?? null, animeKey).first();
  if (answeredComment) await env.DB.prepare("UPDATE comments SET answered_by = ?1 WHERE n = ?2").bind(saved.n, answeredComment).run().catch(() => {}); // answered once
  if (!link) await drawNote(env, saved.n, id, en, idText).catch((err) => console.log(`note picture #${saved.n}: ${err.message}`));   // a plain thought: its sticky-note picture for link previews
  await reactToWhisper(env, { n: saved.n, ghost: id, en }, now).catch(() => {}); // the other ghosts react; a failure only means no reaction
  if (WHISPER_KEEP_MS) {
    await env.DB.prepare("DELETE FROM comments WHERE whisper_n IN (SELECT n FROM whispers WHERE created_at < ?1)").bind(now - WHISPER_KEEP_MS).run();
    await env.DB.prepare("DELETE FROM loves WHERE whisper_n IN (SELECT n FROM whispers WHERE created_at < ?1)").bind(now - WHISPER_KEEP_MS).run();
    await env.DB.prepare("DELETE FROM whispers WHERE created_at < ?1").bind(now - WHISPER_KEEP_MS).run();
  }
  return { n: saved.n, ghost: id, t: now, text: { en, id: idText || null }, link: link ? { url: link.url, title: link.title, source: link.source, thumb: animeKey ? animeUrl(env.SITE_ORIGIN, saved.n, animeKey) : null } : null };
}

// A plain thought gets a sticky-note picture for link previews (the same note as on the whisper page). A small Python function on Vercel draws it
// (vercel/api/render.py: POST {slug, text, n} with the shared secret, answers a JPEG); the picture is kept in R2 as note/<n>.jpg (the Indonesian words,
// or the English ones when there are no others) and note/<n>-en.jpg (the English words). Needs NOTE_RENDER_URL (a variable) and NOTE_RENDER_TOKEN
// (a secret); without them nothing happens, and a failure only means the link preview keeps the ghost's scene picture.
const NOTE_SLUGS = { "1": "pocomon", "2": "ngesomon", "3": "sundemon", "4": "kuntimon" };   // characters.json ids
async function drawNote(env, n, ghost, en, idText) {
  const slug = NOTE_SLUGS[String(ghost)];
  if (!env.NOTE_RENDER_URL || !env.NOTE_RENDER_TOKEN || !env.IMAGES || !slug) return;
  const one = async (suffix, text) => {
    const res = await fetch(env.NOTE_RENDER_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Token": env.NOTE_RENDER_TOKEN }, body: JSON.stringify({ slug, text: String(text).slice(0, 220), n }), signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`the note renderer answered ${res.status}`);
    await env.IMAGES.put(`note/${n}${suffix}.jpg`, await res.arrayBuffer(), { httpMetadata: { contentType: "image/jpeg" } });
  };
  const [main, english] = await Promise.allSettled([one("", idText || en), idText && en ? one("-en", en) : Promise.resolve()]);
  if (main.status === "rejected") throw main.reason;
  if (english.status === "rejected") console.log(`note picture #${n} (English): ${english.reason?.message}`);
}

// A safety net on the timer: the newest plain thoughts that still have no picture (the call above failed or was too slow) are drawn now.
export async function backfillNotes(env, max = 2) {
  if (!env.NOTE_RENDER_URL || !env.IMAGES) return;
  const rows = (await env.DB.prepare("SELECT n, ghost, text_en, text_id FROM whispers WHERE link_url IS NULL ORDER BY n DESC LIMIT 6").all()).results || [];
  let done = 0;
  for (const r of rows) {
    if (done >= max) break;
    if (await env.IMAGES.head(`note/${r.n}.jpg`)) continue;
    await drawNote(env, r.n, r.ghost, r.text_en, r.text_id).catch((err) => console.log(`note picture #${r.n}: ${err.message}`));
    done++;
  }
}

// ---- comments ----

const COMMENT_MAX = 200;        // characters
const DEVICE_DAILY_CAP = 10;    // comments one browser may post in 24 hours
const GLOBAL_DAILY_CAP = 300;   // comments in 24 hours in total: a circuit breaker for the Gemini cost
const NICKNAME = /^[\p{L}\p{N} _-]{2,24}$/u;
const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/;
const NOT_PUBLIC = /https?:|www\.|@|#\w/i; // no links, handles or hashtags
const TALKS_OF_SELF_HARM = /suicid|bunuh diri|mengakhiri hidup|self[- ]?harm|ingin mati|pengen mati|mau mati|want to die|kill myself|end my life/i;

const shapeComment = (r) => ({ n: r.n, kind: r.kind, author: r.author, ghost: r.ghost, replyTo: r.reply_to, body: r.deleted ? "" : r.body, bodyId: r.deleted ? null : r.body_id || null, deleted: Boolean(r.deleted), t: r.created_at });

// Ask the Gemini Worker to screen a comment and write the ghost's reply. Returns {ok, care, reply} or throws.
async function judgeComment(env, ghost, whisper, nickname, comment) {
  const res = await fetch(env.GEMINI_COMMENT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: env.SITE_ORIGIN, "X-Internal-Token": env.INTERNAL_TOKEN },
    body: JSON.stringify({ character: ghost, whisper, nickname, comment }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || typeof data?.ok !== "boolean") throw new Error(`the Gemini Worker answered ${res.status}`);
  return data;
}

// Cloudflare Turnstile: did this visitor pass the bot check? Fails closed (a Turnstile outage blocks only new accounts).
async function turnstileOk(env, token, ip) {
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    return (await res.json()).success === true;
  } catch {
    return false;
  }
}

// A run token is "nonce.startMs.signature": the signature covers the user, game, nonce and start time, so a token cannot be
// made up, moved to another player or game, or have its start time changed.
async function signRun(env, userId, game, nonce, start) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(env.INTERNAL_TOKEN)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${userId}|${game}|${nonce}|${start}`));
  return bytesToB64url(new Uint8Array(sig));
}

// The Monday (UTC) of the week `ms` falls in, as YYYY-MM-DD: leaderboards start again every week.
export function weekStart(ms) {
  const d = new Date(ms);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// The ghost who hosts the weekly event (same rule as assets/scripts/games/event.js: it follows the week number).
export const hostOfWeek = (ms) => GHOSTS[Math.floor(Date.parse(weekStart(ms) + "T00:00:00Z") / 86400_000 / 7) % GHOSTS.length];

// ---- progress ----

// Accept only the shape the game writes, with sane numbers. Anything else is dropped.
export function cleanProgress(input) {
  const num = (v) => (Number.isFinite(v) && v > 0 ? Math.min(Math.floor(v), MAX_VALUE) : 0);
  const table = (obj, keyPattern) => {
    const out = {};
    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj).slice(0, 20)) if (keyPattern.test(k)) out[k] = num(v);
    }
    return out;
  };
  const look = (v) => (typeof v === "string" && /^[a-z0-9-]{0,32}$/.test(v) ? v : "");
  const p = input && typeof input === "object" ? input : {};
  const s = p.streak && typeof p.streak === "object" ? p.streak : {};
  const streak = { count: Math.min(num(s.count), 3650), last: /^\d{4}-\d{2}-\d{2}$/.test(s.last) ? s.last : "" };
  if (!streak.last) streak.count = 0;
  return {
    candles: num(p.candles), spent: num(p.spent), plays: num(p.plays), bond: table(p.bond, /^[0-9]{1,3}$/), best: table(p.best, /^[a-z0-9-]{1,32}$/),
    streak, bestStreak: Math.max(Math.min(num(p.bestStreak), 3650), streak.count),
    badges: Array.isArray(p.badges) ? [...new Set(p.badges.filter((b) => typeof b === "string" && /^[a-z0-9-]{1,32}$/.test(b)))].slice(0, 60) : [],
    memory: (() => { // what each ghost remembers about the player: a short note per ghost (see games/chat-memory.js)
      const out = {};
      if (p.memory && typeof p.memory === "object") for (const [k, v] of Object.entries(p.memory).slice(0, 8)) if (/^[1-9][0-9]{0,2}$/.test(k) && typeof v === "string") out[k] = v.replace(/\s+/g, " ").trim().slice(0, 400);
      return out;
    })(),
    social: { comments: num(p.social?.comments), loves: num(p.social?.loves) },
    owned: Array.isArray(p.owned) ? [...new Set(p.owned.filter((b) => typeof b === "string" && /^[a-z0-9-]{1,32}$/.test(b)))].slice(0, 60) : [],
    equipped: { stage: look(p.equipped?.stage), bubble: look(p.equipped?.bubble), frame: look(p.equipped?.frame) },
  };
}

// Merge two progress objects: for every number the larger one wins (so syncing never loses progress).
export function mergeProgress(a, b) {
  const maxTable = (x, y) => {
    const out = { ...x };
    for (const [k, v] of Object.entries(y)) out[k] = Math.max(out[k] || 0, v);
    return out;
  };
  // the streak with the later day wins (the larger count on the same day); the best streak is the larger of the two
  const streak = a.streak.last > b.streak.last || (a.streak.last === b.streak.last && a.streak.count >= b.streak.count) ? a.streak : b.streak;
  return {
    candles: Math.max(a.candles, b.candles), plays: Math.max(a.plays, b.plays), bond: maxTable(a.bond, b.bond), best: maxTable(a.best, b.best),
    streak, bestStreak: Math.max(a.bestStreak, b.bestStreak, streak.count),
    badges: [...new Set([...a.badges, ...b.badges])].slice(0, 60),
    memory: { ...a.memory, ...b.memory }, // what the device just sent wins
    social: { comments: Math.max(a.social.comments, b.social.comments), loves: Math.max(a.social.loves, b.social.loves) },
    spent: Math.max(a.spent, b.spent), owned: [...new Set([...a.owned, ...b.owned])].slice(0, 60),
    equipped: { stage: b.equipped.stage || a.equipped.stage, bubble: b.equipped.bubble || a.equipped.bubble, frame: b.equipped.frame || a.equipped.frame }, // what the device just sent wins
  };
}

// ---- Web Push ----
// No payload is sent (that would need message encryption): the push only wakes the page's worker (sw.js), which asks
// GET /push/latest?e=<hash of its endpoint> for the text. The request is signed with VAPID (ES256).
const PUSH_GAP_MS = 20 * 3600_000;  // one push a day per subscriber, at most
const PUSH_BATCH = 8;                // a timer run may only make a few outside requests (the free plan allows 50 in all)

export async function vapidHeader(env, endpoint) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const part = (o) => bytesToB64url(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || "mailto:admin@example.com" })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)));
  const pub = bytesToB64url(Uint8Array.from([4, ...b64urlToBytes(jwk.x), ...b64urlToBytes(jwk.y)])); // the uncompressed public point
  return `vapid t=${unsigned}.${bytesToB64url(sig)}, k=${pub}`;
}

// Send one text to one subscriber: park it in `pending`, then wake the browser. Gone subscribers (404/410) are removed.
async function pushTo(env, sub, message, now, streakDate) {
  await env.DB.prepare("UPDATE push_subs SET pending = ?1, last_sent = ?2, last_streak = COALESCE(?3, last_streak) WHERE endpoint_hash = ?4")
    .bind(JSON.stringify(message), now, streakDate ?? null, sub.endpoint_hash).run();
  try {
    const res = await fetch(sub.endpoint, { method: "POST", headers: { Authorization: await vapidHeader(env, sub.endpoint), TTL: "3600", Urgency: "low", "Content-Length": "0" } });
    if (res.status === 404 || res.status === 410) await env.DB.prepare("DELETE FROM push_subs WHERE endpoint_hash = ?1").bind(sub.endpoint_hash).run();
  } catch {}
}

const GHOST_NAMES = { 1: "Pocomon", 2: "Ngesomon", 3: "Sundemon", 4: "Kuntimon" };
export async function pushWhisper(env, whisper, now) {
  if (!env.VAPID_PRIVATE_JWK) return;
  const subs = (await env.DB.prepare("SELECT endpoint_hash, endpoint, lang FROM push_subs WHERE last_sent < ?1 ORDER BY last_sent ASC LIMIT ?2").bind(now - PUSH_GAP_MS, PUSH_BATCH).all()).results || [];
  for (const s of subs) {
    const text = s.lang === "en" ? whisper.en : whisper.id || whisper.en;
    await pushTo(env, s, { title: `${GHOST_NAMES[whisper.ghost] || "A ghost"} ${s.lang === "en" ? "whispered" : "berbisik"}`, body: String(text).slice(0, 140), url: "whispers/" }, now);
  }
}

// About 20:00 in Jakarta: a player whose streak would end at midnight gets a reminder (once a day, signed-in subscribers only).
export async function pushStreaks(env, now) {
  if (!env.VAPID_PRIVATE_JWK) return;
  const j = new Date(now + 7 * 3600_000);
  if (j.getUTCHours() !== 20) return;
  const today = j.toISOString().slice(0, 10);
  const yesterday = new Date(j.getTime() - 86400_000).toISOString().slice(0, 10);
  const subs = (await env.DB.prepare(
    "SELECT s.endpoint_hash, s.endpoint, s.lang, p.data FROM push_subs s JOIN progress p ON p.user_id = s.user_id WHERE s.last_streak != ?1 AND s.last_sent < ?2 LIMIT 40"
  ).bind(today, now - 6 * 3600_000).all()).results || [];
  let sent = 0;
  for (const s of subs) {
    if (sent >= PUSH_BATCH) break;
    let streak;
    try { streak = JSON.parse(s.data).streak; } catch { continue; }
    if (!streak || streak.count < 2 || streak.last !== yesterday) continue; // already kept today, or not a streak worth a reminder
    sent++;
    const en = s.lang === "en";
    await pushTo(env, s, { title: en ? "Your streak ends tonight" : "Rentetanmu berakhir malam ini", body: en ? `Finish one quest to keep your ${streak.count} day streak.` : `Selesaikan satu misi untuk menjaga rentetan ${streak.count} harimu.`, url: "games/" }, now, today);
  }
}

// ---- the handler ----

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const originOk = allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin : "null",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin",
    };
    const started = Date.now();
    const reply = (obj, status = 200, headers = {}) => {
      logRequest(env, ctx, {
        _time: new Date().toISOString(),
        worker: "api",
        status,
        error: obj.error,
        method: request.method,
        url: requestUrl(request),
        ua: userAgent(request),
        country: request.headers.get("CF-IPCountry") || undefined,
        ms: Date.now() - started,
        ...(env.LOG_IP === "off" ? {} : { ip: request.headers.get("CF-Connecting-IP") || undefined }),
      });
      return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers, ...cors } });
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    // GET /img/<whisper number>.jpg: the redrawn picture of a whisper's article (see tools/remake_image.py). Public, like any picture,
    // so it comes before the origin check (an <img> sends no Origin); the key is looked up in the database, never taken from the address.
    const img = /^\/img\/(\d{1,10})\.jpg$/.exec(new URL(request.url).pathname);
    if (img && request.method === "GET" && env.IMAGES) {
      const cached = await caches.default.match(request);   // kept at the edge, so most views never reach the database or R2
      if (cached) return cached;
      const row = await env.DB.prepare("SELECT anime_image FROM whispers WHERE n = ?1").bind(Number(img[1])).first();
      const obj = row?.anime_image ? await env.IMAGES.get(row.anime_image) : null;
      if (!obj) return new Response("not found", { status: 404 });
      const res = new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType || "image/jpeg", "Cache-Control": "public, max-age=604800", "Access-Control-Allow-Origin": "*" } });
      ctx.waitUntil(caches.default.put(request, res.clone()));
      return res;
    }

    // GET /note/<whisper number>.jpg and /note/<n>-en.jpg: the sticky-note picture of a plain thought (see tools/make_note_image.py). Public like /img.
    // The R2 key is built from the digits of the address only.
    const note = /^\/note\/(\d{1,10})(-en)?\.jpg$/.exec(new URL(request.url).pathname);
    if (note && (request.method === "GET" || request.method === "HEAD") && env.IMAGES) {
      const obj = await env.IMAGES.get(`note/${note[1]}${note[2] || ""}.jpg`);
      if (!obj) return new Response("not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });   // a minute: it is drawn shortly after the post
      return new Response(request.method === "HEAD" ? null : obj.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" } });
    }

    if (!originOk) return reply({ error: "forbidden" }, 403);

    if (env.LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await env.LIMITER.limit({ key: ip })).success) return reply({ error: "too many requests" }, 429);
    }

    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    const now = Date.now();

    const readJson = async () => {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) throw Object.assign(new Error("body too large"), { status: 413 });
      try { return JSON.parse(text || "{}"); } catch { throw Object.assign(new Error("bad json"), { status: 400 }); }
    };

    // The signed-in user for this request, or null.
    const sessionUser = async () => {
      const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(request.headers.get("Authorization") || "");
      if (!m) return null;
      const hash = await sha256Hex(m[1]);
      const row = await env.DB.prepare(
        "SELECT u.id AS id, u.email AS email, u.name AS name, u.picture AS picture, u.nickname AS nickname FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1 AND s.expires_at > ?2"
      ).bind(hash, now).first();
      return row ? { id: row.id, email: row.email, name: row.name, picture: row.picture, nickname: row.nickname, hash } : null;
    };

    const loadProgress = async (userId) => {
      const row = await env.DB.prepare("SELECT data FROM progress WHERE user_id = ?1").bind(userId).first();
      try { return cleanProgress(row ? JSON.parse(row.data) : {}); } catch { return cleanProgress({}); }
    };
    const saveProgress = (userId, p) =>
      env.DB.prepare(
        "INSERT INTO progress (user_id, data, updated_at) VALUES (?1, ?2, ?3) " +
        "ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at"
      ).bind(userId, JSON.stringify(p), now).run();

    try {
      if (path === "/auth/google" && request.method === "POST") {
        const { credential, turnstile } = await readJson();
        let claims;
        try {
          claims = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID, now);
        } catch (err) {
          return reply({ error: "sign-in failed", detail: String(err.message).slice(0, 80) }, 401);
        }

        const name = cleanName(claims.name);
        const picture = cleanPicture(claims.picture);
        let user = await env.DB.prepare("SELECT id, email FROM users WHERE google_sub = ?1").bind(claims.sub).first();
        if (!user) {
          if (env.TURNSTILE_SECRET && !(await turnstileOk(env, turnstile, request.headers.get("CF-Connecting-IP")))) return reply({ error: "bot check failed" }, 403);
          const id = crypto.randomUUID();
          await env.DB.prepare("INSERT INTO users (id, google_sub, email, name, picture, created_at, last_login) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)")
            .bind(id, claims.sub, claims.email || null, name, picture, now).run();
          user = { id, email: claims.email || null };
        } else {
          await env.DB.prepare("UPDATE users SET last_login = ?2, email = COALESCE(?3, email), name = ?4, picture = ?5 WHERE id = ?1")
            .bind(user.id, now, claims.email || null, name, picture).run();
        }

        const token = bytesToB64url(crypto.getRandomValues(new Uint8Array(32)));
        await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)")
          .bind(await sha256Hex(token), user.id, now, now + SESSION_DAYS * 86400_000).run();
        ctx?.waitUntil?.(env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(now).run()); // tidy old sessions
        return reply({ token, user: { id: user.id, email: user.email, name, picture }, progress: await loadProgress(user.id) });
      }

      if (path === "/whispers" && request.method === "GET") {
        // The newest whispers first, a page at a time: ?limit=<1..50, default 40> and ?before=<whisper number> for the next page.
        const q = new URL(request.url).searchParams;
        const limit = Math.min(50, Math.max(1, Math.floor(Number(q.get("limit"))) || 40));
        const before = Math.max(0, Math.floor(Number(q.get("before"))) || 0);
        const rows = (await env.DB.prepare(
          "SELECT w.n, w.ghost, w.text_en, w.text_id, w.created_at, w.link_url, w.link_title, w.link_source, w.thumb_url, w.anime_image, " +
          "(SELECT COUNT(*) FROM comments c WHERE c.whisper_n = w.n AND c.deleted = 0) AS comments, " +
          "(SELECT COUNT(*) FROM loves l WHERE l.whisper_n = w.n) AS loves " +
          "FROM whispers w WHERE (?1 = 0 OR w.n < ?1) ORDER BY w.n DESC LIMIT ?2"
        ).bind(before, limit + 1).all()).results || [];   // one more than asked for, to know whether another page exists
        return reply(
          { whispers: rows.slice(0, limit).map((r) => shapeWhisper(r, env.SITE_ORIGIN)), more: rows.length > limit },
          200, { "Cache-Control": "public, max-age=120" }
        );
      }

      const oneWhisper = /^\/whispers\/(\d{1,10})$/.exec(path);
      if (oneWhisper && request.method === "GET") {
        const r = await env.DB.prepare(
          "SELECT w.n, w.ghost, w.text_en, w.text_id, w.created_at, w.link_url, w.link_title, w.link_source, w.thumb_url, w.anime_image, " +
          "(SELECT COUNT(*) FROM comments c WHERE c.whisper_n = w.n AND c.deleted = 0) AS comments, " +
          "(SELECT COUNT(*) FROM loves l WHERE l.whisper_n = w.n) AS loves " +
          "FROM whispers w WHERE w.n = ?1"
        ).bind(Number(oneWhisper[1])).first();
        if (!r) return reply({ error: "not found" }, 404);
        return reply(
          { whisper: shapeWhisper(r, env.SITE_ORIGIN) },
          200, { "Cache-Control": "public, max-age=60" }
        );
      }

      const onWhisper = /^\/whispers\/(\d{1,10})\/comments$/.exec(path);
      if (onWhisper && request.method === "GET") {
        const rows = (await env.DB.prepare(
          "SELECT n, kind, author, ghost, reply_to, body, body_id, deleted, created_at FROM comments WHERE whisper_n = ?1 ORDER BY created_at ASC, n ASC LIMIT 200"
        ).bind(Number(onWhisper[1])).all()).results || [];
        return reply({ comments: rows.map(shapeComment) }, 200, { "Cache-Control": "no-store" });
      }

      if (onWhisper && request.method === "POST") {
        if (env.COMMENT_LIMITER) {
          const ip = request.headers.get("CF-Connecting-IP") || "unknown";
          if (!(await env.COMMENT_LIMITER.limit({ key: ip })).success) return reply({ error: "too many requests" }, 429);
        }
        const b = await readJson();
        const text = typeof b.text === "string" ? b.text.replace(/\s+/g, " ").trim() : "";
        const nickname = typeof b.nickname === "string" ? b.nickname.replace(/\s+/g, " ").trim() : "";
        if (typeof b.device !== "string" || !DEVICE_ID.test(b.device)) return reply({ error: "bad request" }, 400);
        if (!text || [...text].length > COMMENT_MAX) return reply({ error: "bad comment" }, 400);
        if (!NICKNAME.test(nickname)) return reply({ error: "bad nickname" }, 400);
        if (TALKS_OF_SELF_HARM.test(text)) return reply({ error: "not allowed", care: true }, 422);
        if (NOT_PUBLIC.test(text) || NOT_PUBLIC.test(nickname)) return reply({ error: "not allowed", care: false }, 422);

        const whisper = await env.DB.prepare("SELECT n, ghost, text_en FROM whispers WHERE n = ?1").bind(Number(onWhisper[1])).first();
        if (!whisper) return reply({ error: "not found" }, 404);
        const device = await sha256Hex(b.device);
        const since = now - 86400_000;
        const mine = await env.DB.prepare("SELECT COUNT(*) AS c FROM comments WHERE kind = 'user' AND device_hash = ?1 AND created_at > ?2").bind(device, since).first();
        if (mine.c >= DEVICE_DAILY_CAP) return reply({ error: "daily limit" }, 429);
        const all = await env.DB.prepare("SELECT COUNT(*) AS c FROM comments WHERE kind = 'user' AND created_at > ?1").bind(since).first();
        if (all.c >= GLOBAL_DAILY_CAP) return reply({ error: "resting" }, 503);

        let verdict;
        try {
          verdict = await judgeComment(env, whisper.ghost, whisper.text_en, nickname, text);
        } catch {
          return reply({ error: "try again later" }, 503); // nothing unscreened is ever posted
        }
        if (!verdict.ok) return reply({ error: "not allowed", care: verdict.care === true }, 422);

        const saved = await env.DB.prepare(
          "INSERT INTO comments (whisper_n, kind, author, body, device_hash, created_at) VALUES (?1, 'user', ?2, ?3, ?4, ?5) RETURNING n"
        ).bind(whisper.n, nickname, text, device, now).first();
        const answer = await env.DB.prepare(
          "INSERT INTO comments (whisper_n, kind, ghost, reply_to, body, created_at) VALUES (?1, 'ghost', ?2, ?3, ?4, ?5) RETURNING n"
        ).bind(whisper.n, whisper.ghost, saved.n, String(verdict.reply).slice(0, 200), now + 1).first();
        return reply({
          comment: shapeComment({ n: saved.n, kind: "user", author: nickname, reply_to: null, body: text, created_at: now }),
          reply: shapeComment({ n: answer.n, kind: "ghost", ghost: whisper.ghost, reply_to: saved.n, body: String(verdict.reply).slice(0, 200), created_at: now + 1 }),
        });
      }

      if (onWhisper === null) {
        const onLove = /^\/whispers\/(\d{1,10})\/love$/.exec(path);
        if (onLove && (request.method === "PUT" || request.method === "DELETE")) {
          const b = await readJson();
          if (typeof b.device !== "string" || !DEVICE_ID.test(b.device)) return reply({ error: "bad request" }, 400);
          const n = Number(onLove[1]);
          if (!(await env.DB.prepare("SELECT n FROM whispers WHERE n = ?1").bind(n).first())) return reply({ error: "not found" }, 404);
          const device = await sha256Hex(b.device);
          if (request.method === "PUT") {
            await env.DB.prepare("INSERT OR IGNORE INTO loves (whisper_n, device_hash, created_at) VALUES (?1, ?2, ?3)").bind(n, device, now).run();
          } else {
            await env.DB.prepare("DELETE FROM loves WHERE whisper_n = ?1 AND device_hash = ?2").bind(n, device).run();
          }
          const total = await env.DB.prepare("SELECT COUNT(*) AS c FROM loves WHERE whisper_n = ?1").bind(n).first();
          return reply({ loves: total.c });
        }
      }

      const ownComment = /^\/comments\/(\d{1,10})$/.exec(path);
      if (ownComment && request.method === "DELETE") {
        const b = await readJson();
        if (typeof b.device !== "string" || !DEVICE_ID.test(b.device)) return reply({ error: "bad request" }, 400);
        const mine = await env.DB.prepare("SELECT n FROM comments WHERE n = ?1 AND kind = 'user' AND device_hash = ?2").bind(Number(ownComment[1]), await sha256Hex(b.device)).first();
        if (!mine) return reply({ error: "forbidden" }, 403);
        await env.DB.prepare("UPDATE comments SET deleted = 1 WHERE n = ?1").bind(mine.n).run(); // the row stays; the page shows "deleted"
        return reply({ ok: true });
      }

      if (path === "/internal/comments" && request.method === "GET") {
        if (!sameSecret(request.headers.get("X-Internal-Token"), env.INTERNAL_TOKEN)) return reply({ error: "forbidden" }, 403);
        const rows = (await env.DB.prepare(
          "SELECT n, whisper_n, kind, author, ghost, reply_to, body, deleted, created_at FROM comments ORDER BY created_at DESC, n DESC LIMIT 60"
        ).all()).results || [];
        return reply({ comments: rows.map((r) => ({ ...shapeComment(r), whisper: r.whisper_n })) });
      }

      const removeComment = /^\/internal\/comment\/(\d{1,10})$/.exec(path);
      if (removeComment && request.method === "DELETE") {
        if (!sameSecret(request.headers.get("X-Internal-Token"), env.INTERNAL_TOKEN)) return reply({ error: "forbidden" }, 403);
        await env.DB.batch([
          env.DB.prepare("DELETE FROM comments WHERE reply_to = ?1").bind(Number(removeComment[1])),
          env.DB.prepare("DELETE FROM comments WHERE n = ?1").bind(Number(removeComment[1])),
        ]);
        return reply({ ok: true });
      }

      // POST /internal/redraw/<whisper number>: redraw that article whisper's picture now (the same steps as the timer: the free allowance, then
      // Gemini within its daily limit). Answers {ok, key, via, outcome, neurons, ms}. A picture it already
      // had is replaced.
      const redraw = /^\/internal\/redraw\/(\d{1,10})$/.exec(path);
      if (redraw && request.method === "POST") {
        if (!sameSecret(request.headers.get("X-Internal-Token"), env.INTERNAL_TOKEN)) return reply({ error: "forbidden" }, 403);
        const row = await env.DB.prepare("SELECT n, thumb_url, anime_image FROM whispers WHERE n = ?1 AND link_url IS NOT NULL AND thumb_url IS NOT NULL").bind(Number(redraw[1])).first();
        if (!row) return reply({ error: "no article whisper with a picture has that number" }, 404);
        const trace = { noGemini: new URL(request.url).searchParams.get("gemini") === "0" };   // ?gemini=0: the free allowance only, no paid fallback
        const key = await redrawTo(env, row.thumb_url, `anime/${Date.now()}-${row.n}.jpg`, trace);
        if (key) {
          await env.DB.prepare("UPDATE whispers SET anime_image = ?1 WHERE n = ?2").bind(key, row.n).run();
          if (row.anime_image && row.anime_image !== key) await env.IMAGES.delete(row.anime_image).catch(() => {});
        }
        return reply({ ok: Boolean(key), key, ...trace, error: key ? undefined : trace.detail || trace.outcome }, key ? 200 : 502);
      }

      if (path === "/internal/whisper" && request.method === "POST") {
        if (!sameSecret(request.headers.get("X-Internal-Token"), env.INTERNAL_TOKEN)) return reply({ error: "forbidden" }, 403);
        const { ghost } = await readJson();
        try {
          return reply({ whisper: await makeWhisper(env, now, ghost ? String(ghost) : undefined) });
        } catch (err) {
          return reply({ error: String(err.message).slice(0, 120) }, 502);
        }
      }

      const removal = /^\/internal\/whisper\/(\d{1,10})$/.exec(path);
      if (removal && request.method === "DELETE") {
        if (!sameSecret(request.headers.get("X-Internal-Token"), env.INTERNAL_TOKEN)) return reply({ error: "forbidden" }, 403);
        const had = await env.DB.prepare("SELECT anime_image FROM whispers WHERE n = ?1").bind(Number(removal[1])).first();
        if (env.IMAGES && had?.anime_image) await env.IMAGES.delete(had.anime_image).catch(() => {});
        await env.DB.prepare("DELETE FROM whispers WHERE n = ?1").bind(Number(removal[1])).run();
        return reply({ ok: true });
      }

      if (path === "/riddle" && request.method === "POST") {
        const b = await readJson();
        const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
        if (typeof b.device !== "string" || !DEVICE_ID.test(b.device) || !GHOSTS.includes(String(b.character))) return reply({ error: "bad request" }, 400);
        const answers = (Array.isArray(b.answers) ? b.answers : []).slice(0, 8).map((a) => clip(a, 40)).filter(Boolean);
        const riddle = clip(b.riddle, 240);
        const guess = clip(b.guess, 60);
        if (!riddle || !guess || !answers.length) return reply({ error: "bad request" }, 400);
        if (NOT_PUBLIC.test(guess)) return reply({ correct: false, reply: "" });
        const device = await sha256Hex(b.device);
        const since = now - 86400_000;
        const mine = await env.DB.prepare("SELECT COUNT(*) AS c FROM riddle_log WHERE device_hash = ?1 AND created_at > ?2").bind(device, since).first();
        if (mine.c >= RIDDLES_PER_DEVICE_DAY) return reply({ error: "daily limit" }, 429);
        const all = await env.DB.prepare("SELECT COUNT(*) AS c FROM riddle_log WHERE created_at > ?1").bind(since).first();
        if (all.c >= RIDDLES_PER_DAY) return reply({ error: "resting" }, 503);
        let verdict;
        try {
          const res = await fetch(env.GEMINI_URL.replace(/\/whisper\/?$/, "/riddle"), {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: env.SITE_ORIGIN, "X-Internal-Token": env.INTERNAL_TOKEN },
            body: JSON.stringify({ character: String(b.character), riddle, answers, guess }),
          });
          verdict = await res.json().catch(() => null);
          if (!res.ok || typeof verdict?.correct !== "boolean") throw new Error("no verdict");
        } catch {
          return reply({ error: "try again later" }, 503); // a failed judging is not counted against the player
        }
        await env.DB.prepare("INSERT INTO riddle_log (device_hash, created_at) VALUES (?1, ?2)").bind(device, now).run();
        ctx?.waitUntil?.(env.DB.prepare("DELETE FROM riddle_log WHERE created_at < ?1").bind(now - 2 * 86400_000).run());
        return reply({ correct: verdict.correct, reply: clip(verdict.reply, 120) });
      }

      if (path === "/push/subscribe" && request.method === "POST") {
        const b = await readJson();
        if (typeof b.endpoint !== "string" || !/^https:\/\/[^\s]{10,600}$/.test(b.endpoint)) return reply({ error: "bad request" }, 400);
        const user = await sessionUser();
        const hash = await sha256Hex(b.endpoint);
        await env.DB.prepare(
          "INSERT INTO push_subs (endpoint_hash, endpoint, user_id, lang, created_at) VALUES (?1, ?2, ?3, ?4, ?5) " +
          "ON CONFLICT(endpoint_hash) DO UPDATE SET user_id = COALESCE(excluded.user_id, user_id), lang = excluded.lang"
        ).bind(hash, b.endpoint, user?.id ?? null, b.lang === "en" ? "en" : "id", now).run();
        return reply({ ok: true });
      }

      if (path === "/push/subscribe" && request.method === "DELETE") {
        const b = await readJson();
        if (typeof b.endpoint === "string") await env.DB.prepare("DELETE FROM push_subs WHERE endpoint_hash = ?1").bind(await sha256Hex(b.endpoint)).run();
        return reply({ ok: true });
      }

      if (path === "/push/latest" && request.method === "GET") {
        const e = new URL(request.url).searchParams.get("e") || "";
        const row = /^[0-9a-f]{64}$/.test(e) ? await env.DB.prepare("SELECT pending FROM push_subs WHERE endpoint_hash = ?1").bind(e).first() : null;
        let message = null;
        try { message = row?.pending ? JSON.parse(row.pending) : null; } catch {}
        return reply({ message });
      }

      if (path === "/errors" && request.method === "POST") {
        const b = await readJson(); // sent as text/plain by the page; readJson parses it either way
        const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").slice(0, n);
        if (!clip(b.message, 300)) return reply({ error: "bad request" }, 400);
        logRequest(env, ctx, {
          _time: new Date().toISOString(), worker: "api", url: "client-error", method: "POST", status: 200,
          error: clip(b.message, 300), message: `${clip(b.source, 200)}:${Number(b.line) || 0} on ${clip(b.page, 100)}`, ua: userAgent(request),
        });
        return reply({ ok: true });
      }

      if (path === "/runs/start" && request.method === "POST") {
        const user = await sessionUser();
        if (!user) return reply({ error: "not signed in" }, 401);
        const b = await readJson();
        if (!SCORE_LIMITS[b.game]) return reply({ error: "bad request" }, 400);
        const nonce = bytesToB64url(crypto.getRandomValues(new Uint8Array(12)));
        return reply({ token: `${nonce}.${now}.${await signRun(env, user.id, b.game, nonce, now)}` });
      }

      if (path === "/scores" && request.method === "POST") {
        const user = await sessionUser();
        if (!user) return reply({ error: "not signed in" }, 401);
        const b = await readJson();
        const limit = SCORE_LIMITS[b.game];
        const nickname = typeof b.nickname === "string" ? b.nickname.replace(/\s+/g, " ").trim() : "";
        const parts = typeof b.token === "string" ? b.token.split(".") : [];
        if (!limit || parts.length !== 3 || !/^[A-Za-z0-9_-]{16}$/.test(parts[0]) || !/^\d{10,15}$/.test(parts[1]) || !Number.isFinite(b.score) || !NICKNAME.test(nickname)) return reply({ error: "bad request" }, 400);
        const [nonce, startText, sig] = parts;
        const start = Number(startText);
        if (!sameSecret(sig, await signRun(env, user.id, b.game, nonce, start))) return reply({ error: "bad token" }, 400);
        const secs = (now - start) / 1000;
        const score = Math.floor(b.score);
        if (secs < MIN_RUN_SECS || secs > MAX_RUN_SECS || score < 1 || score > limit.max || score > secs * limit.perSec + limit.slack) return reply({ accepted: false, reason: "implausible" });
        const fresh = await env.DB.prepare("INSERT OR IGNORE INTO runs (nonce, user_id, created_at) VALUES (?1, ?2, ?3)").bind(nonce, user.id, now).run();
        if (!fresh.meta?.changes) return reply({ accepted: false, reason: "used" }); // this run already counted
        if (nickname !== user.nickname) { // a new public name is screened once, before it is ever shown
          if (NOT_PUBLIC.test(nickname)) return reply({ error: "not allowed" }, 422);
          let verdict;
          try { verdict = await judgeComment(env, "1", "", "Anonymous", nickname); } catch { return reply({ error: "try again later" }, 503); }
          if (!verdict.ok) return reply({ error: "not allowed" }, 422);
          await env.DB.prepare("UPDATE users SET nickname = ?1 WHERE id = ?2").bind(nickname, user.id).run();
        }
        const week = weekStart(now);
        await env.DB.prepare(
          "INSERT INTO scores (user_id, game, week, score, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) " +
          "ON CONFLICT(user_id, game, week) DO UPDATE SET score = MAX(score, excluded.score), updated_at = excluded.updated_at"
        ).bind(user.id, b.game, week, score, now).run();
        const mine = await env.DB.prepare("SELECT score FROM scores WHERE user_id = ?1 AND game = ?2 AND week = ?3").bind(user.id, b.game, week).first();
        const ahead = await env.DB.prepare("SELECT COUNT(*) AS c FROM scores WHERE game = ?1 AND week = ?2 AND score > ?3").bind(b.game, week, mine.score).first();
        return reply({ accepted: true, score: mine.score, rank: ahead.c + 1 });
      }

      const onBoard = /^\/leaderboard\/([a-z0-9-]{1,32})$/.exec(path);
      if (onBoard && request.method === "GET") {
        const game = onBoard[1];
        if (!SCORE_LIMITS[game]) return reply({ error: "not found" }, 404);
        const week = weekStart(now);
        const rows = (await env.DB.prepare(
          "SELECT s.score AS score, u.nickname AS nickname FROM scores s JOIN users u ON u.id = s.user_id " +
          "WHERE s.game = ?1 AND s.week = ?2 AND u.nickname IS NOT NULL ORDER BY s.score DESC, s.updated_at ASC LIMIT ?3"
        ).bind(game, week, BOARD_SIZE).all()).results || [];
        let me = null;
        const user = await sessionUser();
        if (user) {
          const mine = await env.DB.prepare("SELECT score FROM scores WHERE user_id = ?1 AND game = ?2 AND week = ?3").bind(user.id, game, week).first();
          if (mine) {
            const ahead = await env.DB.prepare("SELECT COUNT(*) AS c FROM scores WHERE game = ?1 AND week = ?2 AND score > ?3").bind(game, week, mine.score).first();
            me = { rank: ahead.c + 1, score: mine.score };
          }
        }
        return reply({ week, entries: rows.map((r, i) => ({ rank: i + 1, nickname: r.nickname, score: r.score })), me }, 200, { "Cache-Control": "no-store" });
      }

      if (path === "/me" && request.method === "GET") {
        const user = await sessionUser();
        if (!user) return reply({ error: "not signed in" }, 401);
        return reply({ user: { id: user.id, email: user.email, name: user.name, picture: user.picture }, progress: await loadProgress(user.id) });
      }

      if (path === "/progress" && request.method === "PUT") {
        const user = await sessionUser();
        if (!user) return reply({ error: "not signed in" }, 401);
        const body = await readJson();
        const merged = mergeProgress(await loadProgress(user.id), cleanProgress(body.progress));
        await saveProgress(user.id, merged);
        return reply({ progress: merged });
      }

      if (path === "/auth/logout" && request.method === "POST") {
        const user = await sessionUser();
        if (user) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(user.hash).run();
        return reply({ ok: true });
      }

      if (path === "/me" && request.method === "DELETE") {
        const user = await sessionUser();
        if (!user) return reply({ error: "not signed in" }, 401);
        await env.DB.batch([
          env.DB.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(user.id),
          env.DB.prepare("DELETE FROM progress WHERE user_id = ?1").bind(user.id),
          env.DB.prepare("DELETE FROM scores WHERE user_id = ?1").bind(user.id),
          env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(user.id),
        ]);
        return reply({ ok: true });
      }

      return reply({ error: "not found" }, 404);
    } catch (err) {
      if (err.status) return reply({ error: err.message }, err.status);
      return reply({ error: "server error" }, 500);
    }
  },

  // The timer (cron): ticks every 15 minutes; one new whisper per slot (WHISPER_EVERY_MS), each ghost once a round, in a shuffled order.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(env.DB.prepare("DELETE FROM runs WHERE created_at < ?1").bind(event.scheduledTime - 2 * MAX_RUN_SECS * 1000).run().catch(() => {}));
    ctx.waitUntil(pushStreaks(env, event.scheduledTime).catch(() => {}));
    ctx.waitUntil(
      makeWhisper(env, event.scheduledTime).then((w) => (w ? pushWhisper(env, { ghost: w.ghost, en: w.text.en, id: w.text.id }, event.scheduledTime).catch(() => {}) : null)).catch((err) =>
        logRequest(env, ctx, { _time: new Date().toISOString(), worker: "api", url: "cron:whisper", status: 500, error: String(err.message).slice(0, 120) })
      ).then(() => backfillAnime(env, event.scheduledTime).catch((err) =>   // then the older whispers that still have no anime picture
        logRequest(env, ctx, { _time: new Date().toISOString(), worker: "api", url: "cron:anime", status: 500, error: String(err.message).slice(0, 120) })
      )).then(() => backfillNotes(env).catch((err) =>   // and the newest plain thoughts that still have no sticky-note picture
        logRequest(env, ctx, { _time: new Date().toISOString(), worker: "api", url: "cron:note", status: 500, error: String(err.message).slice(0, 120) })
      ))
    );
  },
};
