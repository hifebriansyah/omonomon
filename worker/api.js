// Omon Omon API Worker (Cloudflare Worker + D1): Google sign-in, sessions and the saved game progress today, more later.
// A separate Worker from the Gemini Worker (omonomon-gemini), so a games bug or flood can never touch the Gemini budget.
//
//   POST   /auth/google   {credential}   verify Google's ID token, create the account on first sign-in,
//                                        answer {token, user, progress}
//   GET    /me                           {user, progress}
//   PUT    /progress      {progress}     merge the browser's progress into the account (the larger value wins)
//   POST   /auth/logout                  end this session
//   DELETE /me                           delete the account and everything stored for it
//
// The session token is a random 256-bit value sent as "Authorization: Bearer ...". Only its SHA-256 hash is stored.
// (Bearer instead of a cookie so sign-in also works from http://localhost while developing.)
//
// Worker settings (see worker/api.jsonc): D1 binding DB, rate limit binding LIMITER, and the plain variables
//   GOOGLE_CLIENT_ID   the OAuth client ID (public)
//   ALLOWED_ORIGINS    comma-separated site origins that may call this API

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
  return { candles: num(p.candles), plays: num(p.plays), bond: table(p.bond, /^[0-9]{1,3}$/), best: table(p.best, /^[a-z0-9-]{1,32}$/) };
}

// Merge two progress objects: for every number the larger one wins (so syncing never loses progress).
export function mergeProgress(a, b) {
  const maxTable = (x, y) => {
    const out = { ...x };
    for (const [k, v] of Object.entries(y)) out[k] = Math.max(out[k] || 0, v);
    return out;
  };
  return { candles: Math.max(a.candles, b.candles), plays: Math.max(a.plays, b.plays), bond: maxTable(a.bond, b.bond), best: maxTable(a.best, b.best) };
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
    const reply = (obj, status = 200) => {
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
      return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors } });
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
        "SELECT u.id AS id, u.email AS email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1 AND s.expires_at > ?2"
      ).bind(hash, now).first();
      return row ? { id: row.id, email: row.email, hash } : null;
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

        let user = await env.DB.prepare("SELECT id, email FROM users WHERE google_sub = ?1").bind(claims.sub).first();
        if (!user) {
          const id = crypto.randomUUID();
          await env.DB.prepare("INSERT INTO users (id, google_sub, email, created_at, last_login) VALUES (?1, ?2, ?3, ?4, ?4)")
            .bind(id, claims.sub, claims.email || null, now).run();
          user = { id, email: claims.email || null };
        } else {
          await env.DB.prepare("UPDATE users SET last_login = ?2, email = COALESCE(?3, email) WHERE id = ?1")
            .bind(user.id, now, claims.email || null).run();
        }

        const token = bytesToB64url(crypto.getRandomValues(new Uint8Array(32)));
        await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)")
          .bind(await sha256Hex(token), user.id, now, now + SESSION_DAYS * 86400_000).run();
        ctx?.waitUntil?.(env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(now).run()); // tidy old sessions
        return reply({ token, user: { id: user.id, email: user.email }, progress: await loadProgress(user.id) });
      }

      if (path === "/me" && request.method === "GET") {
        const user = await sessionUser();
        if (!user) return reply({ error: "not signed in" }, 401);
        return reply({ user: { id: user.id, email: user.email }, progress: await loadProgress(user.id) });
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
};
