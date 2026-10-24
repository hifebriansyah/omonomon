// The weekly boards on the games hub: one tab per game, the top 20 and (when signed in) the player's own place.

import { fetchBoard, accountsEnabled, signedIn } from "./account.js";
import { T } from "./text.js";

const $ = (id) => document.getElementById(id);

function say(text) {
  const p = document.createElement("p");
  p.className = "lb-note";
  p.textContent = text;
  $("lbList").replaceChildren(p);
}

async function show(game) {
  for (const b of document.querySelectorAll("#lbTabs button")) b.setAttribute("aria-pressed", String(b.dataset.game === game));
  $("lbMe").textContent = "";
  say("…");
  const board = await fetchBoard(game);
  if (!board) return say(T.lbError);
  if (!board.entries.length) say(T.lbEmpty);
  else {
    $("lbList").replaceChildren(...board.entries.map((e) => {
      const li = document.createElement("li");
      const rank = document.createElement("span");
      rank.className = "lb-rank";
      rank.textContent = `#${e.rank}`;
      const name = document.createElement("span");
      name.className = "lb-name";
      name.textContent = e.nickname; // always text: a nickname is never HTML
      const score = document.createElement("span");
      score.className = "lb-score";
      score.textContent = e.score;
      li.append(rank, name, score);
      return li;
    }));
  }
  $("lbMe").textContent = board.me ? T.lbYou(board.me.rank, board.me.score) : accountsEnabled() && !signedIn() ? T.lbSignIn : "";
}

export function startLeaderboard() {
  const box = $("leaderboard");
  if (!box || !accountsEnabled()) return; // without the API there is no board
  box.hidden = false;
  if (box.dataset.ready) return; // the hub starts again after the account sync: set up the tabs once
  box.dataset.ready = "1";
  const tabs = [...document.querySelectorAll("#lbTabs button")];
  for (const b of tabs) b.addEventListener("click", () => show(b.dataset.game));
  if (tabs[0]) show(tabs[0].dataset.game);
}
