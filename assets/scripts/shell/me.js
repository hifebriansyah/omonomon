// The Me page: the account (Google sign-in), candles, games played and the bond level with each ghost.

import { load, levelProgress, balance } from "../games/progress.js";
import { ITEMS, buy, equip, applyCosmetics } from "../games/cosmetics.js";
import { use3d, set3d } from "../games/prefs3d.js";
import { canUse3D } from "../three/kit.js";
import { BADGES } from "../games/achievements.js";
import { T, lang, setLang } from "../games/text.js";
import { nickname, setNickname, randomNickname } from "./identity.js";
import { lovedList } from "./loved-store.js";
import { accountsEnabled, signedIn, currentUser, signInWithGoogle, signOut, deleteAccount, loadGoogleScript, getTurnstileToken, pushSupported, pushEnabled, enablePush, disablePush } from "../games/account.js";

const $ = (id) => document.getElementById(id);

let names = {};

function showStats() {
  const p = load();
  $("meCandles").textContent = balance(p);
  $("mePlayed").textContent = p.plays;
  $("meStreak").textContent = `${T.meStreak}: ${p.bestStreak || 0} ${T.meDays}`;
  for (const row of document.querySelectorAll(".bonds li[data-char]")) {
    const { level, pct } = levelProgress(p.bond[row.dataset.char] || 0);
    row.querySelector("[data-level]").textContent = level;
    row.querySelector("[data-title]").textContent = `\u00b7 ${T.titles[level - 1]}`;
    row.querySelector(".bar").style.setProperty("--pct", `${pct}%`);
  }
  showBadges(p);
  showShop(p);
}

// The shop: stage looks and bubble colours, bought with Candles. Each row is Buy (price), Wear, or Worn.
let shopMsg = "";
function showShop(p) {
  $("shopBalance").textContent = T.shopBalance(balance(p));
  $("shopMsg").textContent = shopMsg;
  const groups = [["stage", T.shopStage], ["bubble", T.shopBubble], ["frame", T.shopFrame], ["room", T.shopRoom]].map(([kind, title]) => {
    const box = document.createElement("div");
    box.className = "shop-group";
    const h = document.createElement("h3");
    h.textContent = title;
    const list = document.createElement("ul");
    const row = (id, label, state, act) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = label;
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = state;
      if (!act) b.disabled = true;
      else b.addEventListener("click", act);
      li.append(name, b);
      return li;
    };
    const worn = p.equipped[kind] || "none";
    if (kind !== "room") list.append(row("none", T.shopDefault, worn === "none" ? T.shopWorn : T.shopWear, worn === "none" ? null : () => { equip(kind, "none"); refreshShop(); }));
    for (const item of ITEMS.filter((i) => i.kind === kind && (!i.reward || p.owned.includes(i.id)))) {
      const owned = p.owned.includes(item.id);
      const label = T.shopItems[item.id] || (item.id.startsWith("frame-ribbon-") ? T.shopRibbon(names[item.id.slice(-1)] || "") : item.id);
      if (owned && kind === "room") list.append(row(item.id, label, T.shopOwned, null));
      else if (owned) list.append(row(item.id, label, worn === item.id ? T.shopWorn : T.shopWear, worn === item.id ? null : () => { equip(kind, item.id); refreshShop(); }));
      else {
        const poor = balance(p) < item.price;
        const li = row(item.id, label, T.shopBuy(item.price), () => { shopMsg = buy(item.id) === "ok" ? T.shopBought : T.shopPoor; refreshShop(); });
        if (poor) li.querySelector("button").classList.add("poor");
        list.append(li);
      }
    }
    box.append(h, list);
    return box;
  });
  $("shopList").replaceChildren(...groups);
}

function refreshShop() {
  applyCosmetics("");
  showStats();
  shopMsg = "";
}

// All badges: the earned ones lit, the rest dim with what earns them.
function showBadges(p) {
  const have = new Set(p.badges || []);
  $("badgeList").replaceChildren(...BADGES.map((b) => {
    const [name, how] = T.badges[b.id] || [b.id, ""];
    const li = document.createElement("li");
    li.className = have.has(b.id) ? "badge got" : "badge";
    const n = document.createElement("strong");
    n.textContent = name;
    const h = document.createElement("small");
    h.textContent = how;
    li.append(n, h);
    return li;
  }));
}

// Ghost names (for the ribbon frames in the shop). Her stories moved to her profile page (shell/profile.js).
async function loadNames() {
  try {
    const c = await (await fetch("characters.json")).json();
    names = Object.fromEntries(c.characters.map((x) => [x.id, x.name]));
    showShop(load());
  } catch {}
}

function showError(message) {
  $("acctErr").textContent = message || "";
  $("acctErr").hidden = !message;
}

// The Google profile photo, or the ghost icon when there is none (or it cannot be loaded).
const ghostIcon = $("profPhoto")?.innerHTML;
function showPhoto(url) {
  const box = $("profPhoto");
  if (!url) { box.innerHTML = ghostIcon; return; }
  const img = new Image();
  img.alt = "";
  img.referrerPolicy = "no-referrer"; // Google's photo host can refuse requests that carry a referrer
  img.onerror = () => { box.innerHTML = ghostIcon; };
  img.src = url;
  box.replaceChildren(img);
}

// Show the profile for the current state: guest with the Google button, or signed in with sign-out and delete.
async function showAccount() {
  showError("");
  const on = accountsEnabled() && signedIn();
  $("acct").hidden = !on;
  $("signinOff").hidden = accountsEnabled(); // the "coming soon" note only while accounts are switched off
  showPhoto(on ? currentUser()?.picture : null);
  if (on) {
    const user = currentUser();
    $("profName").textContent = user?.name || T.meSignedInAs(user?.email);
    $("profNote").textContent = [user?.name ? user.email : "", T.meSavedAccount].filter(Boolean).join(" \u00b7 ");
    $("gsi").hidden = true;
    return;
  }
  $("profName").textContent = T.meGuest;
  $("profNote").textContent = T.meNote;
  if (!accountsEnabled()) return;
  try {
    await loadGoogleScript();
    const cfg = window.POCO_CONFIG;
    const check = getTurnstileToken($("turnstile")); // starts the bot check now; it is awaited when the visitor signs in
    google.accounts.id.initialize({
      client_id: cfg.GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        try {
          await signInWithGoogle(credential, await check);
          showStats();
          showAccount();
        } catch {
          showError(T.meSignInError);
        }
      },
    });
    $("gsi").replaceChildren();
    google.accounts.id.renderButton($("gsi"), { theme: "filled_black", size: "large", shape: "pill", text: "signin_with", locale: lang }); // its text in the page's language
    $("gsi").hidden = false;
  } catch {
    showError(T.meSignInError);
  }
}

// The nickname shown next to the visitor's comments on whispers.
function startNickname() {
  const input = $("meNick");
  const note = $("nickNote");
  input.value = nickname();
  const say = (text, bad = false) => { note.textContent = text; note.classList.toggle("bad", bad); };
  $("nickForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const saved = setNickname(input.value);
    if (!saved) return say(T.meNickBad, true);
    input.value = saved;
    say(T.meNickSaved);
  });
  $("nickRandom").addEventListener("click", () => {
    input.value = setNickname(randomNickname());
    say(T.meNickSaved);
  });
  input.addEventListener("input", () => say(T.meNickNote));
}

// English or Indonesian, remembered in this browser. The page is written in one language when it loads, so a change reloads it.
function startLanguage() {
  for (const button of document.querySelectorAll("#langSwitch button")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
    button.addEventListener("click", () => {
      if (button.dataset.lang === lang) return;
      setLang(button.dataset.lang);
      location.reload();
    });
  }
}

// Opt-in notifications (Web Push): a ghost's whisper and a streak reminder, at most one a day.
async function startNotify() {
  const box = $("meNotify");
  const note = $("notifyNote");
  if (!pushSupported()) { box.disabled = true; note.textContent = T.notifyUnsupported; return; }
  box.checked = (await pushEnabled()) && Notification.permission === "granted";
  if (Notification.permission === "denied") note.textContent = T.notifyDenied;
  box.addEventListener("change", async () => {
    if (!box.checked) { await disablePush(); note.textContent = ""; return; }
    const r = await enablePush(lang);
    box.checked = r === "on";
    note.textContent = r === "on" ? T.notifyOn : r === "denied" ? T.notifyDenied : T.notifyError;
  });
}

export function startMe() {
  startLanguage();
  startNotify();
  const box = $("me3d");
  box.checked = use3d();
  box.disabled = !canUse3D(); // no WebGL, save-data or low memory: the 2D look stays
  box.addEventListener("change", () => set3d(box.checked));
  const loved = lovedList().length;
  $("meLovedCount").textContent = loved ? `\u00b7 ${loved}` : "";
  startNickname();
  showStats();
  loadNames();
  showAccount();
  $("signOutBtn").addEventListener("click", async () => {
    await signOut();
    showAccount();
  });
  $("deleteBtn").addEventListener("click", async () => {
    if (!confirm(T.meDeleteConfirm)) return;
    try {
      await deleteAccount();
    } catch {
      showError(T.meSignInError);
      return;
    }
    showAccount();
  });
}

// After the account's progress arrived (see main.js): draw the numbers again.
export { showStats as refreshMe };
