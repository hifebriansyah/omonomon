// The Me page: the account (Google sign-in), candles, games played and the bond level with each ghost.

import { load, levelProgress } from "../games/progress.js";
import { T } from "../games/text.js";
import { accountsEnabled, signedIn, currentUser, signInWithGoogle, signOut, deleteAccount, loadGoogleScript } from "../games/account.js";

const $ = (id) => document.getElementById(id);

function showStats() {
  const p = load();
  $("meCandles").textContent = p.candles;
  $("mePlayed").textContent = p.plays;
  for (const row of document.querySelectorAll(".bonds li[data-char]")) {
    const { level, pct } = levelProgress(p.bond[row.dataset.char] || 0);
    row.querySelector("[data-level]").textContent = level;
    row.querySelector(".bar").style.setProperty("--pct", `${pct}%`);
  }
}

function showError(message) {
  $("acctErr").textContent = message || "";
  $("acctErr").hidden = !message;
}

// Show the profile for the current state: guest with the Google button, or signed in with sign-out and delete.
async function showAccount() {
  showError("");
  const on = accountsEnabled() && signedIn();
  $("acct").hidden = !on;
  $("signinOff").hidden = accountsEnabled(); // the "coming soon" note only while accounts are switched off
  if (on) {
    $("profName").textContent = T.meSignedInAs(currentUser()?.email);
    $("profNote").textContent = T.meSavedAccount;
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
