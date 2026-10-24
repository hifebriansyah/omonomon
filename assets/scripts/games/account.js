// The player's account: Google sign-in, a session with the API Worker, and copying progress to and from it.
// Everything is optional: without API_URL (config.js) or without signing in, the game saves in this browser only.
// The session token lives in localStorage (it is a random value; the API stores only its hash).

import { load, merge, replace, onChange } from "./progress.js";

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
export async function signInWithGoogle(credential) {
  const { token, user, progress } = await api("/auth/google", { method: "POST", body: { credential } });
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
