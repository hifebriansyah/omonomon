// Teka-Teki Gaib (Ghost Riddles): three riddles a day, each from a different ghost; the player types an answer. A answer that
// matches the written ones is accepted at once; anything else goes to Gemini (through the API Worker, capped per browser and per
// day) which accepts synonyms, typos and English or Indonesian wording. One try per riddle; each right answer scores 30.

const SCORE_EACH = 30;
const PER_DAY = 3;

// answers: normalised words that count (both languages). The ghost's line after a right/wrong answer is in `ok` / `no`.
export const RIDDLES = [
  { ghost: "1", en: "I am tied at the top and tied at the bottom, and I still cannot walk. Who am I?", id: "Aku diikat di atas dan diikat di bawah, tapi tetap nggak bisa jalan. Siapa aku?", answers: ["pocong", "pocomon", "a pocong", "hantu pocong"] },
  { ghost: "1", en: "The more of me you take, the more you leave behind. What am I?", id: "Makin banyak kamu ambil aku, makin banyak yang kamu tinggalkan. Apa aku?", answers: ["footsteps", "steps", "langkah", "jejak", "langkah kaki"] },
  { ghost: "1", en: "What has to be broken before you can use it?", id: "Apa yang harus dipecahkan dulu sebelum bisa dipakai?", answers: ["egg", "an egg", "telur"] },
  { ghost: "2", en: "I have hands but I cannot clap. What am I?", id: "Aku punya tangan tapi nggak bisa tepuk tangan. Apa aku?", answers: ["clock", "a clock", "jam", "jam dinding"] },
  { ghost: "2", en: "I am full of holes and still hold water. What am I?", id: "Aku penuh lubang tapi tetap bisa nahan air. Apa aku?", answers: ["sponge", "a sponge", "spons", "busa"] },
  { ghost: "2", en: "What goes up when the rain comes down?", id: "Apa yang naik waktu hujan turun?", answers: ["umbrella", "an umbrella", "payung"] },
  { ghost: "3", en: "What falls but never breaks, and what breaks but never falls?", id: "Apa yang jatuh tapi nggak pernah pecah, dan apa yang pecah tapi nggak pernah jatuh?", answers: ["night and day", "day and night", "malam dan siang", "malam dan pagi", "siang dan malam"] },
  { ghost: "3", en: "I follow you in the sun and vanish in the dark. What am I?", id: "Aku mengikutimu saat terang dan hilang saat gelap. Apa aku?", answers: ["shadow", "your shadow", "bayangan", "bayang"] },
  { ghost: "3", en: "I speak without a mouth and answer without ears. What am I?", id: "Aku bicara tanpa mulut dan menjawab tanpa telinga. Apa aku?", answers: ["echo", "an echo", "gema", "echo gema"] },
  { ghost: "4", en: "If you tell me, I am no longer mine, yet everyone wants me. What am I?", id: "Kalau kamu ceritakan, aku bukan milikku lagi, tapi semua orang mau. Apa aku?", answers: ["secret", "a secret", "rahasia"] },
  { ghost: "4", en: "I have keys but no locks, and space but no room. What am I?", id: "Aku punya tuts tapi nggak punya gembok, punya spasi tapi nggak punya ruangan. Apa aku?", answers: ["keyboard", "a keyboard", "papan ketik", "keyboard komputer"] },
  { ghost: "4", en: "What has a head and a tail but no body?", id: "Apa yang punya kepala dan ekor tapi nggak punya badan?", answers: ["coin", "a coin", "koin", "uang logam", "uang koin"] },
];

const LINES = {
  "1": { ok: { en: "Hm. Correct. Do not get used to it.", id: "Hm. Benar. Jangan kebiasaan." }, no: { en: "No. Think harder, it hurts less than being wrong.", id: "Salah. Mikir lagi, lebih nggak sakit daripada salah." } },
  "2": { ok: { en: "Right! One less thing on my list.", id: "Benar! Satu urusan beres." }, no: { en: "Not quite. I would explain, but I have rounds.", id: "Belum tepat. Aku jelasin, tapi aku harus keliling." } },
  "3": { ok: { en: "Yes... that is it. How lovely.", id: "Iya... itu dia. Indah ya." }, no: { en: "Not this time. That is alright.", id: "Bukan kali ini. Nggak apa-apa." } },
  "4": { ok: { en: "You got it! How did you know?!", id: "Kamu bener! Kok bisa tau?!" }, no: { en: "Ooh, close, or not. I will not say.", id: "Ooh, hampir, atau enggak. Nggak kukasih tau." } },
};

const TEXT = {
  en: { head: "Ghost Riddles", answer: "Your answer", send: "Answer", thinking: "...", of: (n, t) => `Riddle ${n} of ${t}`, limit: "That is all the riddles for today. Come back tomorrow.", error: "The ghosts could not hear you. Try again in a moment.", done: (s) => `Today's riddles are done: ${s} points`, again: "Today's riddles are already answered. Come back tomorrow.", next: "Next", finish: "Finish" },
  id: { head: "Teka-Teki Gaib", answer: "Jawabanmu", send: "Jawab", thinking: "...", of: (n, t) => `Teka-teki ${n} dari ${t}`, limit: "Teka-teki hari ini sudah habis. Balik lagi besok.", error: "Para hantu nggak dengar. Coba lagi sebentar.", done: (s) => `Teka-teki hari ini selesai: ${s} poin`, again: "Teka-teki hari ini sudah dijawab. Balik lagi besok.", next: "Lanjut", finish: "Selesai" },
};

export const normalize = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
export const matches = (riddle, guess) => { const g = normalize(guess); return Boolean(g) && riddle.answers.some((a) => normalize(a) === g); };

// The day's three riddles: one from each of three different ghosts, picked by the date (the same for everyone).
export function dailyRiddles(date) {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const ghosts = ["1", "2", "3", "4"];
  const skip = ghosts[day % 4]; // each day one ghost sits out
  return ghosts.filter((g) => g !== skip).map((g, i) => {
    const mine = RIDDLES.filter((r) => r.ghost === g);
    return mine[(day + i) % mine.length];
  });
}

const dateString = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DONE_KEY = "ghostriddle:done";
const doneToday = (date) => { try { const v = JSON.parse(localStorage.getItem(DONE_KEY)); return v?.date === date ? v : null; } catch { return null; } };
const markDone = (date, score) => { try { localStorage.setItem(DONE_KEY, JSON.stringify({ date, score })); } catch {} };

export function start(root, ctx) {
  const t = TEXT[ctx.lang] || TEXT.en;
  const date = dateString();
  const riddles = dailyRiddles(date);
  let index = 0;
  let score = 0;
  let busy = false;
  let destroyed = false;

  root.style.cssText = "display:grid;gap:10px;align-content:start;padding:14px;";
  const head = document.createElement("p");
  head.style.cssText = "margin:0;font-weight:700;opacity:.8;";
  const card = document.createElement("div");
  card.style.cssText = "display:flex;gap:10px;align-items:flex-start;";
  const face = document.createElement("img");
  face.alt = "";
  face.style.cssText = "width:56px;height:56px;object-fit:contain;border-radius:50%;background:#eef1f8;flex:none;";
  const bubble = document.createElement("p");
  bubble.style.cssText = "margin:0;padding:10px 14px;border-radius:16px;background:#fff;color:#14151a;font-family:var(--comic,inherit);line-height:1.35;";
  card.append(face, bubble);
  const form = document.createElement("form");
  form.autocomplete = "off";
  form.style.cssText = "display:flex;gap:8px;";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 60;
  input.setAttribute("aria-label", t.answer);
  input.placeholder = t.answer;
  input.style.cssText = "flex:1;min-width:0;padding:10px 12px;border-radius:12px;border:2px solid #14151a;font:inherit;";
  const send = document.createElement("button");
  send.type = "submit";
  send.textContent = t.send;
  send.style.cssText = "padding:10px 16px;border-radius:12px;border:2px solid #14151a;background:#ffb454;font:inherit;font-weight:700;cursor:pointer;";
  form.append(input, send);
  const say = document.createElement("p");
  say.setAttribute("role", "status");
  say.style.cssText = "margin:0;min-height:1.4em;";
  root.append(head, card, form, say);

  const ghostOf = (id) => ctx.chars.find((c) => c.id === id) || ctx.char;
  function show() {
    const r = riddles[index];
    const g = ghostOf(r.ghost);
    head.textContent = `${t.head} · ${t.of(index + 1, riddles.length)} · ${g.name}`;
    face.src = g.head;
    bubble.textContent = r[ctx.lang] || r.en;
    input.value = "";
    input.disabled = send.disabled = false;
    say.textContent = "";
    input.focus();
  }

  function finish() {
    markDone(date, score);
    form.hidden = true;
    say.textContent = t.done(score);
    setTimeout(() => { if (!destroyed) ctx.onOver(score, { char: riddles[riddles.length - 1].ghost }); }, 900);
  }

  async function judge(r, guess) {
    if (matches(r, guess)) return { correct: true, reply: "" };
    const api = window.POCO_CONFIG?.API_URL;
    if (!api) return { correct: false, reply: "" };
    const res = await fetch(api.replace(/\/+$/, "") + "/riddle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character: r.ghost, riddle: r.en, answers: r.answers, guess, device: (await import("../shell/identity.js")).deviceId() }),
    });
    if (res.status === 429) throw Object.assign(new Error("limit"), { limit: true });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const guess = input.value.trim();
    if (!guess || busy) return;
    busy = true;
    input.disabled = send.disabled = true;
    say.textContent = t.thinking;
    const r = riddles[index];
    try {
      const v = await judge(r, guess);
      if (destroyed) return;
      const lines = LINES[r.ghost];
      say.textContent = v.reply || (v.correct ? lines.ok : lines.no)[ctx.lang] || (v.correct ? lines.ok : lines.no).en;
      if (v.correct) score += SCORE_EACH;
      index += 1;
      setTimeout(() => { if (destroyed) return; index < riddles.length ? show() : finish(); }, 1600);
    } catch (err) {
      say.textContent = err.limit ? t.limit : t.error;
      if (err.limit) { setTimeout(() => { if (!destroyed) finish(); }, 1200); } else input.disabled = send.disabled = false;
    } finally {
      busy = false;
    }
  });

  const finished = doneToday(date);
  if (finished) { form.hidden = true; head.textContent = t.head; bubble.textContent = t.again; face.src = ctx.char.head; }
  else show();
  return {
    restart() { if (!doneToday(dateString())) { index = 0; score = 0; form.hidden = false; show(); } else { form.hidden = true; bubble.textContent = t.again; } },
    destroy() { destroyed = true; root.replaceChildren(); root.removeAttribute("style"); },
  };
}
