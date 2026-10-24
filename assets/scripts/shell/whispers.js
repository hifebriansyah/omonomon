// The Whispers page: the ghosts' latest public updates, newest first. They are written by Gemini on a timer
// (worker/api.js) and are the same for everyone. Opening this page marks them as read (the dot on the tab).
// Under each whisper visitors can comment, without signing in; the ghost answers in her own voice.

import { chatTime } from "../time.js";
import { T, lang } from "../games/text.js";
import { markSeen } from "./whisper-badge.js";
import { nickname, deviceId, myComments, rememberComment, forgetComment } from "./identity.js";
import { el, bubbleIcon, heartIcon, sendIcon, shareButton, linkCard } from "./ui.js";
import { isLoved, toggleLove } from "./loved-store.js";

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

export async function startWhispers() {
  const list = document.getElementById("whisperList");
  const note = document.getElementById("whisperNote");
  const say = (text) => { note.textContent = text; note.hidden = !text; };
  const base = (window.POCO_CONFIG?.API_URL || "").replace(/\/+$/, "");
  if (!base) { say(T.whisperError); return; }

  async function api(path, options) {
    const res = await fetch(`${base}${path}`, options && { ...options, headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body), signal: options.signal });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // ---- one whisper's comments ----
  function commentItem(c, ghostChar, countEl, list, mine) {
    const li = el("li", "comment");
    li.dataset.n = c.n;
    if (c.replyTo) li.dataset.replyTo = c.replyTo;
    // one flat list: every comment looks the same, with a picture on the left (the ghost's own, or the visitor's initial)
    if (c.kind === "ghost") {
      li.style.setProperty("--c", ghostChar.accent);
      const img = el("img", "c-avatar");
      img.src = ghostChar.image;
      img.alt = "";
      li.append(img);
    } else {
      li.append(el("span", "c-avatar c-initial", [...c.author][0]?.toUpperCase() || "?"));
    }
    const body = el("div", "c-body");
    const head = el("div", "c-head");
    head.append(el("strong", "c-author", c.kind === "ghost" ? ghostChar.name : c.author));
    if (c.kind === "ghost") head.append(el("span", "c-badge", T.commentGhost));
    const time = el("time", "", chatTime(c.t));
    time.dateTime = new Date(c.t).toISOString();
    head.append(time);
    body.append(head, el("p", c.deleted ? "c-text c-deleted" : "c-text", c.deleted ? T.commentDeleted : c.body));
    li.append(body);
    if (c.kind === "user" && !c.deleted && mine.has(c.n)) {
      const del = el("button", "c-del", "×");
      del.type = "button";
      del.title = T.commentDelete;
      del.setAttribute("aria-label", T.commentDelete);
      del.addEventListener("click", async () => {
        del.disabled = true;
        const { status } = await api(`/comments/${c.n}`, { method: "DELETE", body: { device: deviceId() } });
        if (status !== 200) { del.disabled = false; return; }
        forgetComment(c.n);
        // the comment stays in the list, now saying "deleted" (the server keeps the row and no longer sends the text)
        body.querySelector(".c-text").textContent = T.commentDeleted;
        body.querySelector(".c-text").classList.add("c-deleted");
        del.remove();
        countEl.textContent = String(Math.max(0, Number(countEl.textContent) - 1));
      });
      li.append(del);
    }
    return li;
  }

  function commentPanel(w, ghostChar, countEl) {
    const panel = el("div", "comments");
    const items = el("ul", "c-list");
    const status = el("p", "c-status");
    status.setAttribute("aria-live", "polite");
    const form = el("form", "c-form");
    form.autocomplete = "off";
    const input = el("input");
    input.type = "text";
    input.maxLength = 200;
    input.placeholder = T.commentPlaceholder(ghostChar.name);
    input.setAttribute("aria-label", T.commentPlaceholder(ghostChar.name));
    const send = el("button", "c-send");
    send.type = "submit";
    send.title = T.commentSend;                         // icon only: the name is for screen readers and the tooltip
    send.setAttribute("aria-label", T.commentSend);
    send.append(sendIcon());
    form.append(input, send);
    for (const type of ["pointerdown", "mousedown"]) send.addEventListener(type, (e) => e.preventDefault()); // sending keeps the keyboard open
    const who = el("p", "c-as");
    const nick = el("strong", "", nickname());
    const change = el("a", "", T.commentChange);
    change.href = "me/";
    who.append(`${T.commentAs} `, nick, " · ", change);
    panel.append(items, status, form, who);

    const mine = myComments();
    let loaded = false;
    async function load() {
      status.textContent = "";
      const { status: code, data } = await api(`/whispers/${w.n}/comments`);
      if (code !== 200) { status.textContent = T.commentLoadError; return; }
      loaded = true;
      items.replaceChildren(...(data.comments.length ? data.comments.map((c) => commentItem(c, ghostChar, countEl, items, mine)) : [el("li", "c-none", T.commentNone)]));
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      // The visitor's comment goes on the page at once; the ghost's answer follows when it arrives. If the comment is
      // refused or cannot be sent, it is taken off again and the text goes back into the box.
      send.disabled = true;
      input.value = "";
      nick.textContent = nickname();
      items.querySelector(".c-none")?.remove();
      const pending = commentItem({ n: -1, kind: "user", author: nickname(), t: Date.now(), body: text }, ghostChar, countEl, items, mine);
      pending.classList.add("pending");
      items.append(pending);
      countEl.textContent = String(Number(countEl.textContent) + 1);
      status.textContent = T.commentThinking(ghostChar.name);
      const takeBack = (message) => {
        pending.remove();
        if (!items.children.length) items.append(el("li", "c-none", T.commentNone));
        countEl.textContent = String(Math.max(0, Number(countEl.textContent) - 1));
        input.value = text;
        status.textContent = message;
      };
      try {
        const { status: code, data } = await api(`/whispers/${w.n}/comments`, { method: "POST", body: { text, nickname: nickname(), device: deviceId() } });
        if (code === 200) {
          rememberComment(data.comment.n);
          mine.add(data.comment.n);
          pending.replaceWith(commentItem(data.comment, ghostChar, countEl, items, mine));
          items.append(commentItem(data.reply, ghostChar, countEl, items, mine));
          countEl.textContent = String(Number(countEl.textContent) + 1);   // the ghost's reply counts too
          status.textContent = "";
        } else if (code === 422) {
          takeBack(data.care ? T.commentCare : T.commentRefused);
        } else if (code === 429) {
          takeBack(T.commentLimit);
        } else if (code === 503) {
          takeBack(T.commentLater);
        } else {
          takeBack(T.commentError);
        }
      } catch {
        takeBack(T.commentError);
      } finally {
        send.disabled = false;
      }
    });

    return { panel, show: () => (loaded ? Promise.resolve() : load()), focus: () => input.focus() };
  }

  // ---- the feed ----
  try {
    const [{ whispers }, { characters }] = await Promise.all([getJson(`${base}/whispers`), getJson("characters.json")]);
    const byId = Object.fromEntries(characters.map((c) => [c.id, c]));
    // One whisper as a list item. On its own page (single) the comments are open from the start.
    const whisperItem = (w, c, single) => {
      const li = el("li", "whisper");
      li.style.setProperty("--c", c.accent);
      const img = el("img", "avatar");
      img.src = c.image;
      img.alt = "";
      const head = el("div", "w-head");
      const who = el("div", "w-who");
      const time = el("time", "", chatTime(w.t));
      time.dateTime = new Date(w.t).toISOString();
      const when = single ? time : el("a", "w-link");   // in the feed the time opens that whisper's own page
      if (!single) { when.href = `whispers/?n=${w.n}`; when.append(time); }
      who.append(el("strong", "", c.name), when);
      head.append(img, who);
      const text = el("p", "w-text", w.text[lang] || w.text.en);

      const count = el("span", "w-count", String(w.comments || 0));
      const button = el("button", "w-comment");
      button.type = "button";
      button.setAttribute("aria-expanded", "false");
      button.title = T.commentWord;                      // no visible label: the icon and the count say it; the name is for screen readers
      button.setAttribute("aria-label", T.commentWord);
      button.append(bubbleIcon(), count);

      // the heart: loves the whisper (a copy is kept in this browser; the Me page lists them)
      const love = el("button", "w-love");
      love.type = "button";
      love.title = T.loveWord;
      love.setAttribute("aria-label", T.loveWord);
      love.setAttribute("aria-pressed", String(isLoved(w.n)));
      // Taps on the heart show at once, but only the LAST state is sent, after a short pause; a request still on its way
      // is cancelled when you tap again. (Quick taps used to send one request each and ran into the rate limit.)
      const loves = el("span", "w-count", String(w.loves || 0));
      const others = Math.max(0, (w.loves || 0) - (isLoved(w.n) ? 1 : 0)); // loves from other people
      let sentState = isLoved(w.n); // what the server is known to have for this browser (null: not sure, a request was cancelled)
      let wanted = sentState;
      let timer = 0;
      let inFlight = null;
      let othersNow = others;
      const showCount = () => { loves.textContent = String(othersNow + (wanted ? 1 : 0)); };
      love.append(heartIcon(), loves);
      showCount();
      async function sync() {
        if (wanted === sentState) return;
        const sending = wanted;
        inFlight = new AbortController();
        try {
          const { status, data } = await api(`/whispers/${w.n}/love`, { method: sending ? "PUT" : "DELETE", body: { device: deviceId() }, signal: inFlight.signal });
          if (status !== 200) throw new Error(String(status));
          sentState = sending;
          othersNow = Math.max(0, data.loves - (sending ? 1 : 0));
          showCount();
        } catch (err) {
          if (err.name === "AbortError") { sentState = null; return; } // cancelled by a newer tap, which sends the final state
          wanted = sentState ?? !sending;                               // the server could not be reached: go back
          if (isLoved(w.n) !== wanted) toggleLove(w);
          love.setAttribute("aria-pressed", String(wanted));
          showCount();
        } finally {
          inFlight = null;
        }
      }
      love.addEventListener("click", () => {
        wanted = toggleLove(w);                    // the local list changes at once
        love.setAttribute("aria-pressed", String(wanted));
        showCount();
        clearTimeout(timer);
        inFlight?.abort();                         // an older request no longer matters
        timer = setTimeout(sync, 500);
      });
      const actions = el("div", "w-actions");
      actions.append(love, button, shareButton(`${c.name}: ${w.text[lang] || w.text.en}`, `${location.origin}/whispers/${c.slug}/?n=${w.n}`));
      const thread = commentPanel(w, c, count);
      thread.panel.hidden = !single;
      button.setAttribute("aria-expanded", String(single));
      if (single) thread.show();
      button.addEventListener("click", async () => {
        const open = thread.panel.hidden;
        thread.panel.hidden = !open;
        button.setAttribute("aria-expanded", String(open));
        if (open) { await thread.show(); thread.focus(); }
      });

      li.append(head, text, ...[linkCard(w.link)].filter(Boolean), actions, thread.panel);
      return li;
    };

    const wanted = Number(new URLSearchParams(location.search).get("n"));
    if (Number.isInteger(wanted) && wanted > 0) {
      // /whispers/?n=<id>: that whisper alone, comments open. Older ones are no longer in the feed, so ask for it by id.
      let w = null;
      try {
        const one = await api(`/whispers/${wanted}`);
        w = one.status === 200 ? one.data.whisper : whispers.find((x) => x.n === wanted);
      } catch {
        w = whispers.find((x) => x.n === wanted);
      }
      if (w && byId[w.ghost]) list.replaceChildren(whisperItem(w, byId[w.ghost], true));
      else say(T.whisperGone);
      const all = el("a", "w-all", T.allWhispers);
      all.href = "whispers/";
      list.after(all);
    } else {
      list.replaceChildren(...whispers.filter((w) => byId[w.ghost]).map((w) => whisperItem(w, byId[w.ghost], false)));
      say(whispers.length ? "" : T.whisperNone);
      if (whispers.length) markSeen(whispers[0].t);
    }
  } catch {
    say(T.whisperError);
  }
}
