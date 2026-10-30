// The player's account: Google sign-in, a session with the API Worker, and copying progress to and from it.
// Everything is optional: without API_URL or GOOGLE_CLIENT_ID (lib/config.ts), or without signing in, the game saves in
// this browser only. The session token lives in localStorage (it is a random value; the API stores only its hash).
// Nothing here touches the browser at import time, so pre-rendering can import it.

import { config } from "~/lib/config";
import { KEYS, getJson, remove, setJson, type Progress, type Session } from "~/lib/storage";
import type { Lang } from "~/lib/content";
import { load, merge, replace } from "~/features/games/progress";
import { nickname } from "~/features/whispers/identity";
import { readyRegistration } from "~/features/pwa/register";

export type SessionUser = NonNullable<Session["user"]>;

export interface RunResult {
  accepted: boolean;
  refused?: boolean;
  rank?: number;
  score?: number;
  [k: string]: unknown;
}

export interface BoardEntry {
  [k: string]: unknown;
}

export interface Board {
  entries: BoardEntry[];
  me: BoardEntry | null;
  [k: string]: unknown;
}

// Google Identity Services and Cloudflare Turnstile, only the bits used here.
interface GoogleId {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
    turnstile?: { render(container: HTMLElement, options: Record<string, unknown>): unknown };
  }
}

export const accountsEnabled = () => Boolean(config.API_URL && config.GOOGLE_CLIENT_ID);

// ---- the session ----
// Components follow it with useAccount() (useAccount.ts), so a sign-in, sign-out or a 401 redraws them.
const listeners = new Set<() => void>();
export function onSessionChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

function readSession(): Session | null {
  return getJson<Session>(KEYS.session);
}
function writeSession(s: Session | null) {
  if (s) setJson(KEYS.session, s);
  else remove(KEYS.session);
  for (const fn of listeners) fn();
}

export const currentUser = (): SessionUser | null => readSession()?.user || null;
export const signedIn = () => Boolean(readSession()?.token);

type ApiError = Error & { status?: number };

async function api<T = Record<string, unknown>>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const session = readSession();
  const res = await fetch(config.API_URL + path, {
    method,
    headers: { "Content-Type": "application/json", ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401 && session) writeSession(null); // the session ended: back to guest mode
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status }) as ApiError;
  return data;
}

// Merge the account's progress into this browser and the browser's into the account.
async function sync(remote: Progress | null | undefined) {
  const merged = merge(load(), remote || {});
  replace(merged);
  const { progress } = await api<{ progress: Progress }>("/progress", { method: "PUT", body: { progress: merged } });
  replace(merge(load(), progress || {}));
}

// Called with the credential Google gives the page after sign-in.
export async function signInWithGoogle(credential: string, turnstile: string): Promise<SessionUser> {
  const { token, user, progress } = await api<{ token: string; user: SessionUser; progress: Progress }>("/auth/google", { method: "POST", body: { credential, turnstile } });
  writeSession({ token, user });
  await sync(progress);
  return user;
}

// On every page load while signed in: refresh progress from the account (a no-op for guests or when offline).
export async function refresh(): Promise<SessionUser | null> {
  if (!accountsEnabled() || !signedIn()) return null;
  try {
    const { user, progress } = await api<{ user: SessionUser; progress: Progress }>("/me");
    writeSession({ ...(readSession() as Session), user });
    await sync(progress);
    return user;
  } catch {
    return currentUser();
  }
}

export async function signOut(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {}
  writeSession(null);
}

// Deletes the account and everything stored for it on the server. Progress in this browser stays.
export async function deleteAccount(): Promise<void> {
  await api("/me", { method: "DELETE" });
  writeSession(null);
}

// A run starts: ask the API for a token. The Worker times the run between this call and the score, so the browser cannot
// claim a length. Resolves to the token, or null for guests and when it did not work.
export async function startRun(game: string): Promise<string | null> {
  if (!accountsEnabled() || !signedIn()) return null;
  try {
    return (await api<{ token: string }>("/runs/start", { method: "POST", body: { game } })).token;
  } catch {
    return null;
  }
}

// Put a finished run (its token from startRun) on this week's board.
// Resolves to {accepted, rank, score}, or null for guests and when it did not work.
export async function submitScore(game: string, score: number, token: string | null): Promise<RunResult | null> {
  if (!token) return null;
  try {
    return await api<RunResult>("/scores", { method: "POST", body: { game, score, token, nickname: nickname() } });
  } catch (err) {
    return (err as ApiError).status === 422 ? { accepted: false, refused: true } : null;
  }
}

// This week's board for one game: {entries, me} (me is null for guests), or null when it could not be loaded.
export async function fetchBoard(game: string): Promise<Board | null> {
  if (!config.API_URL) return null;
  try {
    return await api<Board>(`/leaderboard/${encodeURIComponent(game)}`);
  } catch {
    return null;
  }
}

// After every game run, copy the new progress to the account (waits a moment so quick runs go out together).
// useAccountSync() hands this to progress.ts onChange once the page is running in the browser.
let timer: ReturnType<typeof setTimeout> | undefined;
export function saveToAccount(p: Progress) {
  if (!accountsEnabled() || !signedIn()) return;
  clearTimeout(timer);
  timer = setTimeout(() => api("/progress", { method: "PUT", body: { progress: p } }).catch(() => {}), 1500);
}

// Loads a script once, by its address.
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.append(s);
  });
}

// Google's sign-in button script, loaded only when the Me page needs it.
let googleScript: Promise<void> | null = null;
export function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  googleScript ??= loadScript("https://accounts.google.com/gsi/client").catch((err) => {
    googleScript = null; // let the next visit to Me try again
    throw new Error("could not load Google sign-in", { cause: err });
  });
  return googleScript;
}

// Cloudflare Turnstile: a bot check that only shows something when it is unsure. Resolves to a token, or "" when it is
// switched off (no site key) or could not load; the API then decides (it only insists on a token for a new account).
export function getTurnstileToken(container: HTMLElement): Promise<string> {
  const key = config.TURNSTILE_SITE_KEY;
  if (!key) return Promise.resolve("");
  return new Promise((resolve) => {
    const run = () => {
      try {
        window.turnstile!.render(container, { sitekey: key, appearance: "interaction-only", callback: resolve, "error-callback": () => resolve("") });
      } catch {
        resolve("");
      }
    };
    if (window.turnstile) return run();
    loadScript("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit").then(run, () => resolve(""));
  });
}

// ---- Web Push (opt-in) ----
export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(config.VAPID_PUBLIC_KEY && config.API_URL);

const keyBytes = (b64url: string) => Uint8Array.from(atob(b64url.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await readyRegistration();
    return Boolean(reg && (await reg.pushManager.getSubscription()));
  } catch {
    return false;
  }
}

// Ask permission, subscribe this browser and tell the API (signed in: it also links the browser to the account for streak
// reminders). Resolves to "on", "denied" or "error".
export async function enablePush(lang: Lang): Promise<"on" | "denied" | "error"> {
  try {
    if ((await Notification.requestPermission()) !== "granted") return "denied";
    const reg = await readyRegistration(); // the site's own worker (pwa/register.ts); none yet (plain http, dev): it cannot work
    if (!reg) return "error";
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.VAPID_PUBLIC_KEY) }));
    await api("/push/subscribe", { method: "POST", body: { endpoint: sub.endpoint, lang } });
    return "on";
  } catch {
    return "error";
  }
}

export async function disablePush(): Promise<void> {
  try {
    const sub = await (await readyRegistration())?.pushManager.getSubscription();
    if (!sub) return;
    await api("/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  } catch {}
}
