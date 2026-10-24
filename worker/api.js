// Omon Omon API Worker (Cloudflare Worker + D1): Google sign-in, sessions and the saved game progress today, more later.
// A separate Worker from the Gemini Worker (omonomon-gemini), so a games bug or flood can never touch the Gemini budget.
//
//   POST   /auth/google   {credential}   verify Google's ID token, create the account on first sign-in,
//                                        answer {token, user, progress}
//   GET    /me                           {user, progress}
//   PUT    /progress      {progress}     merge the browser's progress into the account (the larger value wins)
//   POST   /auth/logout                  end this session
//   DELETE /me                           delete the account and everything stored for it
//   GET    /whispers                     the ghosts' latest public updates, newest first (no sign-in)
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
// A timer (cron) writes a whisper every 15 minutes by asking the Gemini Worker: each hour every ghost posts once, in a shuffled order.
//
// The session token is a random 256-bit value sent as "Authorization: Bearer ...". Only its SHA-256 hash is stored.
// (Bearer instead of a cookie so sign-in also works from http://localhost while developing.)
//
// Worker settings (see worker/api.jsonc): D1 binding DB, rate limit binding LIMITER, and the plain variables
//   GOOGLE_CLIENT_ID   the OAuth client ID (public)
//   ALLOWED_ORIGINS    comma-separated site origins that may call this API
//   GEMINI_URL         address of the Gemini Worker's /whisper route; GEMINI_COMMENT_URL its /comment route;
//                      SITE_ORIGIN the Origin header sent with them
//   (rate limit bindings LIMITER for everything and COMMENT_LIMITER for posting comments)
//   INTERNAL_TOKEN     secret shared with the Gemini Worker

const SESSION_DAYS = 30;
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const MAX_BODY_BYTES = 8 * 1024;
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
const WHISPER_EVERY_MS = 15 * 60_000;  // one whisper per slot, so every ghost posts once an hour (a "round" of 4 slots)
const WHISPER_KEEP_MS = 14 * 86400_000;
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
  const recent = ((await env.DB.prepare("SELECT text_en FROM whispers WHERE ghost = ?1 ORDER BY created_at DESC LIMIT 3").bind(id).all()).results || []).map((r) => r.text_en);
  const res = await fetch(env.GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: env.SITE_ORIGIN, "X-Internal-Token": env.INTERNAL_TOKEN },
    body: JSON.stringify({ character: id, kind, when: whenText(now), avoid: recent }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.whisper?.en) throw new Error(`the Gemini Worker answered ${res.status}${data?.error ? ` (${data.error})` : ""}`);
  const { en, id: idText } = data.whisper;
  const saved = await env.DB.prepare("INSERT INTO whispers (ghost, text_en, text_id, created_at) VALUES (?1, ?2, ?3, ?4) RETURNING n")
    .bind(id, String(en).slice(0, 220), idText ? String(idText).slice(0, 220) : null, now).first();
  await env.DB.prepare("DELETE FROM comments WHERE whisper_n IN (SELECT n FROM whispers WHERE created_at < ?1)").bind(now - WHISPER_KEEP_MS).run();
  await env.DB.prepare("DELETE FROM loves WHERE whisper_n IN (SELECT n FROM whispers WHERE created_at < ?1)").bind(now - WHISPER_KEEP_MS).run();
  await env.DB.prepare("DELETE FROM whispers WHERE created_at < ?1").bind(now - WHISPER_KEEP_MS).run();
  return { n: saved.n, ghost: id, t: now, text: { en, id: idText || null } };
}

// ---- comments ----

const COMMENT_MAX = 200;        // characters
const DEVICE_DAILY_CAP = 10;    // comments one browser may post in 24 hours
const GLOBAL_DAILY_CAP = 300;   // comments in 24 hours in total: a circuit breaker for the Gemini cost
const NICKNAME = /^[\p{L}\p{N} _-]{2,24}$/u;
const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/;
const NOT_PUBLIC = /https?:|www\.|@|#\w/i; // no links, handles or hashtags
const TALKS_OF_SELF_HARM = /suicid|bunuh diri|mengakhiri hidup|self[- ]?harm|ingin mati|pengen mati|mau mati|want to die|kill myself|end my life/i;

const shapeComment = (r) => ({ n: r.n, kind: r.kind, author: r.author, ghost: r.ghost, replyTo: r.reply_to, body: r.deleted ? "" : r.body, deleted: Boolean(r.deleted), t: r.created_at });

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
  const p = input && typeof input === "object" ? input : {};
  const s = p.streak && typeof p.streak === "object" ? p.streak : {};
  const streak = { count: Math.min(num(s.count), 3650), last: /^\d{4}-\d{2}-\d{2}$/.test(s.last) ? s.last : "" };
  if (!streak.last) streak.count = 0;
  return {
    candles: num(p.candles), plays: num(p.plays), bond: table(p.bond, /^[0-9]{1,3}$/), best: table(p.best, /^[a-z0-9-]{1,32}$/),
    streak, bestStreak: Math.max(Math.min(num(p.bestStreak), 3650), streak.count),
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
  };
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
        "SELECT u.id AS id, u.email AS email, u.name AS name, u.picture AS picture FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1 AND s.expires_at > ?2"
      ).bind(hash, now).first();
      return row ? { id: row.id, email: row.email, name: row.name, picture: row.picture, hash } : null;
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
        const { credential } = await readJson();
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
        const rows = (await env.DB.prepare(
          "SELECT w.n, w.ghost, w.text_en, w.text_id, w.created_at, " +
          "(SELECT COUNT(*) FROM comments c WHERE c.whisper_n = w.n AND c.deleted = 0) AS comments, " +
          "(SELECT COUNT(*) FROM loves l WHERE l.whisper_n = w.n) AS loves " +
          "FROM whispers w ORDER BY w.created_at DESC LIMIT 40"
        ).all()).results || [];
        return reply(
          { whispers: rows.map((r) => ({ n: r.n, ghost: r.ghost, t: r.created_at, comments: r.comments, loves: r.loves, text: { en: r.text_en, id: r.text_id } })) },
          200, { "Cache-Control": "public, max-age=120" }
        );
      }

      const oneWhisper = /^\/whispers\/(\d{1,10})$/.exec(path);
      if (oneWhisper && request.method === "GET") {
        const r = await env.DB.prepare(
          "SELECT w.n, w.ghost, w.text_en, w.text_id, w.created_at, " +
          "(SELECT COUNT(*) FROM comments c WHERE c.whisper_n = w.n AND c.deleted = 0) AS comments, " +
          "(SELECT COUNT(*) FROM loves l WHERE l.whisper_n = w.n) AS loves " +
          "FROM whispers w WHERE w.n = ?1"
        ).bind(Number(oneWhisper[1])).first();
        if (!r) return reply({ error: "not found" }, 404);
        return reply(
          { whisper: { n: r.n, ghost: r.ghost, t: r.created_at, comments: r.comments, loves: r.loves, text: { en: r.text_en, id: r.text_id } } },
          200, { "Cache-Control": "public, max-age=60" }
        );
      }

      const onWhisper = /^\/whispers\/(\d{1,10})\/comments$/.exec(path);
      if (onWhisper && request.method === "GET") {
        const rows = (await env.DB.prepare(
          "SELECT n, kind, author, ghost, reply_to, body, deleted, created_at FROM comments WHERE whisper_n = ?1 ORDER BY created_at ASC, n ASC LIMIT 200"
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
        await env.DB.prepare("DELETE FROM whispers WHERE n = ?1").bind(Number(removal[1])).run();
        return reply({ ok: true });
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

  // The timer (cron): one new whisper every 15 minutes; each ghost once an hour, in a shuffled order.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      makeWhisper(env, event.scheduledTime).catch((err) =>
        logRequest(env, ctx, { _time: new Date().toISOString(), worker: "api", url: "cron:whisper", status: 500, error: String(err.message).slice(0, 120) })
      )
    );
  },
};
