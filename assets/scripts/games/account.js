// The player's account: Google sign-in, a session with the API Worker, and copying progress to and from it.
// Everything is optional: without API_URL (config.js) or without signing in, the game saves in this browser only.
// The session token lives in localStorage (it is a random value; the API stores only its hash).

import { load, merge, replace, onChange } from "./progress.js";
import { nickname } from "../shell/identity.js";

const SESSION_KEY = "ghostgame:session";
const cfg = () => window.POCO_CONFIG || {};

export const accountsEnabled = () => Boolean(cfg().API_URL && cfg().GOOGLE_CLIENT_ID);

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function writeSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export const currentUser = () => readSession()?.user || null;
export const signedIn = () => Boolean(readSession()?.token);

async function api(path, { method = "GET", body } = {}) {
  const session = readSession();
  const res = await fetch(cfg().API_URL.replace(/\/+$/, "") + path, {
    method,
    headers: { "Content-Type": "application/json", ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && session) writeSession(null); // the session ended: back to guest mode
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

// Merge the account's progress into this browser and the browser's into the account.
async function sync(remote) {
  const merged = merge(load(), remote);
  replace(merged);
  const { progress } = await api("/progress", { method: "PUT", body: { progress: merged } });
  replace(merge(load(), progress));
}

// Called with the credential Google gives the page after sign-in.
export async function signInWithGoogle(credential, turnstile) {
  const { token, user, progress } = await api("/auth/google", { method: "POST", body: { credential, turnstile } });
  writeSession({ token, user });
  await sync(progress);
  return user;
}

// On every page load while signed in: refresh progress from the account (a no-op for guests or when offline).
export async function refresh() {
  if (!accountsEnabled() || !signedIn()) return null;
  try {
    const { user, progress } = await api("/me");
    writeSession({ ...readSession(), user });
    await sync(progress);
    return user;
  } catch {
    return currentUser();
  }
}

export async function signOut() {
  try { await api("/auth/logout", { method: "POST" }); } catch {}
  writeSession(null);
}

// Deletes the account and everything stored for it on the server. Progress in this browser stays.
export async function deleteAccount() {
  await api("/me", { method: "DELETE" });
  writeSession(null);
}

// A run starts: ask the API for a token. The Worker times the run between this call and the score, so the browser cannot
// claim a length. Resolves to the token, or null for guests and when it did not work.
export async function startRun(game) {
  if (!accountsEnabled() || !signedIn()) return null;
  try {
    return (await api("/runs/start", { method: "POST", body: { game } })).token;
  } catch {
    return null;
  }
}

// Put a finished run (its token from startRun) on this week's board.
// Resolves to {accepted, rank, score}, or null for guests and when it did not work.
export async function submitScore(game, score, token) {
  if (!token) return null;
  try {
    return await api("/scores", { method: "POST", body: { game, score, token, nickname: nickname() } });
  } catch (err) {
    return err.status === 422 ? { accepted: false, refused: true } : null;
  }
}

// This week's board for one game: {entries, me} (me is null for guests), or null when it could not be loaded.
export async function fetchBoard(game) {
  if (!cfg().API_URL) return null;
  try {
    return await api(`/leaderboard/${encodeURIComponent(game)}`);
  } catch {
    return null;
  }
}

// After every game run, copy the new progress to the account (waits a moment so quick runs go out together).
let timer = 0;
onChange((p) => {
  if (!accountsEnabled() || !signedIn()) return;
  clearTimeout(timer);
  timer = setTimeout(() => api("/progress", { method: "PUT", body: { progress: p } }).catch(() => {}), 1500);
});

// Google's sign-in button script, loaded only when the Me page needs it.
export function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("could not load Google sign-in"));
    document.head.append(s);
  });
}

// Cloudflare Turnstile: a bot check that only shows something when it is unsure. Resolves to a token, or "" when it is
// switched off (no site key) or could not load; the API then decides (it only insists on a token for a new account).
export function getTurnstileToken(container) {
  const key = cfg().TURNSTILE_SITE_KEY;
  if (!key) return Promise.resolve("");
  return new Promise((resolve) => {
    const run = () => {
      try {
        window.turnstile.render(container, { sitekey: key, appearance: "interaction-only", callback: resolve, "error-callback": () => resolve("") });
      } catch { resolve(""); }
    };
    if (window.turnstile) return run();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = run;
    s.onerror = () => resolve("");
    document.head.append(s);
  });
}

// ---- Web Push (opt-in) ----
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(cfg().VAPID_PUBLIC_KEY && cfg().API_URL);

const keyBytes = (b64url) => Uint8Array.from(atob(b64url.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export async function pushEnabled() {
  if (!pushSupported()) return false;
  try { return Boolean(await (await navigator.serviceWorker.ready).pushManager.getSubscription()); } catch { return false; }
}

// Ask permission, subscribe this browser and tell the API (signed in: it also links the browser to the account for streak
// reminders). Resolves to "on", "denied" or "error".
export async function enablePush(lang) {
  try {
    if (await Notification.requestPermission() !== "granted") return "denied";
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg().VAPID_PUBLIC_KEY) });
    await api("/push/subscribe", { method: "POST", body: { endpoint: sub.endpoint, lang } });
    return "on";
  } catch {
    return "error";
  }
}

export async function disablePush() {
  try {
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (!sub) return;
    await api("/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  } catch {}
}
