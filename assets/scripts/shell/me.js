// The Me page: the account (Google sign-in), candles, games played and the bond level with each ghost.

import { load, levelProgress } from "../games/progress.js";
import { T, lang } from "../games/text.js";
import { accountsEnabled, signedIn, currentUser, signInWithGoogle, signOut, deleteAccount, loadGoogleScript } from "../games/account.js";

const $ = (id) => document.getElementById(id);

let stories = null; // stories.json, loaded once: { "<ghost id>": [{level, title, text}] }
let names = {};

function showStats() {
  const p = load();
  $("meCandles").textContent = p.candles;
  $("mePlayed").textContent = p.plays;
  $("meStreak").textContent = `${T.meStreak}: ${p.bestStreak || 0} ${T.meDays}`;
  for (const row of document.querySelectorAll(".bonds li[data-char]")) {
    const { level, pct } = levelProgress(p.bond[row.dataset.char] || 0);
    row.querySelector("[data-level]").textContent = level;
    row.querySelector("[data-title]").textContent = `\u00b7 ${T.titles[level - 1]}`;
    row.querySelector(".bar").style.setProperty("--pct", `${pct}%`);
  }
  showStories(p);
}

// The ghosts' stories: each opens at a bond level; the rest show what unlocks them.
function showStories(p) {
  const box = $("storyList");
  if (!stories) return;
  const blocks = [];
  for (const [id, list] of Object.entries(stories)) {
    const level = levelProgress(p.bond[id] || 0).level;
    const group = document.createElement("div");
    group.className = "story-group";
    const h = document.createElement("h3");
    h.textContent = names[id] || "";
    group.append(h);
    for (const s of list) {
      if (level >= s.level) {
        const d = document.createElement("details");
        const sum = document.createElement("summary");
        sum.textContent = s.title[lang] || s.title.en;
        const body = document.createElement("p");
        body.textContent = s.text[lang] || s.text.en;
        d.append(sum, body);
        group.append(d);
      } else {
        const locked = document.createElement("p");
        locked.className = "locked";
        locked.textContent = T.meStoryLocked(s.level);
        group.append(locked);
      }
    }
    blocks.push(group);
  }
  box.replaceChildren(...blocks);
}

async function loadStories() {
  try {
    const [s, c] = await Promise.all([fetch("stories.json"), fetch("characters.json")]);
    stories = await s.json();
    names = Object.fromEntries((await c.json()).characters.map((x) => [x.id, x.name]));
    showStories(load());
  } catch {} // stories are a bonus: without them the page still works
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
    google.accounts.id.initialize({
      client_id: cfg.GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        try {
          await signInWithGoogle(credential);
          showStats();
          showAccount();
        } catch {
          showError(T.meSignInError);
        }
      },
    });
    $("gsi").replaceChildren();
    google.accounts.id.renderButton($("gsi"), { theme: "filled_black", size: "large", shape: "pill", text: "signin_with" });
    $("gsi").hidden = false;
  } catch {
    showError(T.meSignInError);
  }
}

export function startMe() {
  showStats();
  loadStories();
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
