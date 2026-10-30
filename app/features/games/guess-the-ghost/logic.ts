// Tebak Hantu (Guess the Ghost): a ghost line is shown; pick which of the four ghosts said it.
// A daily set of 10 lines (seeded from the local date, so everyone gets the same set), no repeats inside a set.
// Score: correct = 10 + streak bonus (2 per consecutive correct before this one, max 10). Max run = 170.

export const QUESTIONS = 10;
export const BASE = 10;
export const STREAK_STEP = 2;
export const STREAK_MAX = 10;
export const IDS = ["1", "2", "3", "4"];

// The line bank: LINES[ghostId] = [{ en, id }, ...]
export interface Line {
  en: string;
  id: string;
}
export interface Question extends Line {
  ghost: string;
  key: string;
}

export const LINES: Record<string, Line[]> = {
  "1": [ // Pocomon: gloomy, blunt, dry
    { en: "Hope is a thing people hang on the wall. I hang mine on a hook.", id: "Harapan itu barang pajangan. Punyaku kugantung di paku." },
    { en: "I do not hop because I am happy. I hop because I have no legs.", id: "Aku lompat bukan karena senang. Aku lompat karena nggak punya kaki." },
    { en: "Your plan is bad. I will say it kindly: your plan is bad.", id: "Rencanamu jelek. Kubilang pelan-pelan: rencanamu jelek." },
    { en: "Cheer up? The dead have tried. It did not stick.", id: "Disuruh ceria? Orang mati udah coba. Nggak nempel." },
    { en: "Tombstones are honest. They only say what happened.", id: "Nisan itu jujur. Dia cuma bilang apa yang sudah terjadi." },
    { en: "You asked for the truth. Here it is. Do not flinch.", id: "Kamu minta jujur. Nih. Jangan kaget." },
    { en: "I counted the stars. Not many. Do not look up.", id: "Aku hitung bintangnya. Dikit. Jangan mendongak." },
    { en: "Nothing is wrong. It is just always a little gray.", id: "Nggak ada yang salah. Cuma selalu agak abu-abu aja." },
    { en: "Do not thank me. It only makes the silence louder.", id: "Jangan bilang makasih. Sepinya jadi makin keras." },
    { en: "Rain again. Good. The sky and I agree on something.", id: "Hujan lagi. Bagus. Langit dan aku sepakat soal sesuatu." },
    { en: "Fine, I like your company. Say it twice and I deny it.", id: "Ya udah, aku suka ada kamu. Kalau kamu ulang, kusangkal." },
    { en: "I was wrapped up for a reason. Mostly to keep quiet.", id: "Aku dibungkus ada alasannya. Kebanyakan biar diam." },
    { en: "Tomorrow will arrive anyway. I would not wait up.", id: "Besok bakal datang sendiri. Nggak usah ditunggu." },
    { en: "Sad is fine. Sad is just honest weather.", id: "Sedih itu nggak apa-apa. Itu cuma cuaca yang jujur." },
    { en: "Compliments make me itch under the cloth.", id: "Dipuji bikin aku gatal di balik kain." },
  ],
  "2": [ // Ngesomon: busy night nurse, brisk and caring
    { en: "Drink some water. No, a real glass. I'm watching.", id: "Minum air dulu. Bukan seteguk, satu gelas. Kakak liatin." },
    { en: "Two minutes between rooms. Talk fast, I'll keep up.", id: "Dua menit antar kamar. Ngomong cepet, kakak ikutin." },
    { en: "Bed three needs me. Hold that thought, I'm coming back.", id: "Kamar tiga manggil. Tahan dulu ceritanya, kakak balik." },
    { en: "Skipped dinner again? Sit. Eat. Then we'll talk.", id: "Lewat makan malam lagi? Duduk. Makan. Baru ngobrol." },
    { en: "Night shift rule one: the quiet ones need checking most.", id: "Aturan jaga malam nomor satu: yang paling diem yang paling perlu dicek." },
    { en: "Mind the wet floor, and mind your sleep schedule too.", id: "Awas lantai basah, jadwal tidurmu juga awas." },
    { en: "I wrote it on the chart, so it counts as official.", id: "Udah kakak tulis di catatan, jadi resmi." },
    { en: "Your tea is cold. Mine too. We'll survive.", id: "Tehmu dingin. Punya kakak juga. Kita bertahan kok." },
    { en: "Stretch your shoulders. Yes, now. Doctor's orders, sort of.", id: "Regangin bahunya. Iya, sekarang. Perintah dokter, kira-kira." },
    { en: "Slow breath in. Slow breath out. See, you're fine.", id: "Tarik napas pelan. Hembus pelan. Tuh, kamu baik-baik aja." },
    { en: "Rounds at midnight, rounds at three. Sleep is a rumor.", id: "Keliling jam dua belas, keliling jam tiga. Tidur itu cuma gosip." },
    { en: "Call button's blinking again. Be right back, don't go.", id: "Lampu panggilan nyala lagi. Sebentar ya, jangan ke mana-mana." },
    { en: "Take your vitamins. I'll know if you didn't.", id: "Minum vitaminmu. Kakak tau kalau nggak." },
    { en: "Short break, long list. Tell me the good news first.", id: "Istirahat singkat, daftar panjang. Kabar baiknya dulu dong." },
    { en: "Everyone is stable. That is the best sentence I know.", id: "Semua stabil. Itu kalimat terbaik yang kakak tau." },
  ],
  "3": [ // Sundemon: gentle, wistful, trailing off
    { en: "The petals fall so slowly... as if they are not ready to go.", id: "Kelopaknya jatuh pelan banget... seolah belum siap pergi." },
    { en: "I used to know a song for this evening. It is gone now.", id: "Dulu aku tau lagu buat sore begini. Sekarang hilang." },
    { en: "Nothing stays... but it was lovely while it did.", id: "Nggak ada yang bertahan... tapi indah selagi ada." },
    { en: "The window is cold, yet I keep waiting beside it.", id: "Jendelanya dingin, tapi aku tetap nunggu di sampingnya." },
    { en: "Someone once laughed in this room. I still hear it, faintly.", id: "Dulu ada yang tertawa di kamar ini. Aku masih denger, samar." },
    { en: "Even the wind forgets where it was going.", id: "Angin pun lupa mau ke mana." },
    { en: "I kept a single petal. It has stopped smelling like spring.", id: "Kusimpan satu kelopak. Wanginya sudah bukan musim semi lagi." },
    { en: "Stay a little longer... the dusk is gentler with company.", id: "Tinggal agak lama... senja lebih lembut kalau ada yang nemenin." },
    { en: "Sometimes I wonder who is remembering me, right now.", id: "Kadang aku bertanya-tanya siapa yang lagi ingat aku sekarang." },
    { en: "The moon looks tired tonight. I understand her.", id: "Bulannya kelihatan capek malam ini. Aku ngerti dia." },
    { en: "Goodbyes are only hellos that grew quiet.", id: "Perpisahan itu cuma salam yang jadi hening." },
    { en: "I hum, and the old garden hums back, a little.", id: "Aku bersenandung, dan taman tua itu menyahut, sedikit." },
    { en: "It rained once, long ago, and everything smelled of you... of someone.", id: "Pernah hujan, lama sekali, dan semuanya wangi kamu... wangi seseorang." },
    { en: "Do not hurry. The stars have all the time there is.", id: "Jangan buru-buru. Bintang punya semua waktu yang ada." },
    { en: "Tonight feels like a letter I never finished.", id: "Malam ini terasa kayak surat yang nggak pernah selesai." },
  ],
  "4": [ // Kuntimon: curious, gossipy, excited
    { en: "WAIT, did you hear that? Something rustled! Go check, I'll hold your sleeve!", id: "EH, denger nggak? Ada yang gemerisik! Cek sana, aku pegangin lengan bajumu!" },
    { en: "The branch behind me knows a secret, and I almost have it!", id: "Dahan di belakangku tau rahasia, dan aku hampir dapet!" },
    { en: "Psst, come closer. No, closer. Okay, you will not believe this.", id: "Psst, sini deketan. Nggak, lebih deket. Oke, kamu nggak bakal percaya ini." },
    { en: "Tell me everything and leave out nothing, especially the embarrassing part!", id: "Ceritain semuanya, jangan ada yang kelewat, apalagi bagian yang malu-maluin!" },
    { en: "Who was that at the gate? Who? WHO? I need names!", id: "Siapa tadi di gerbang? Siapa? SIAPA? Aku butuh nama!" },
    { en: "I poked it with a stick and it poked back. Fascinating!", id: "Kucolek pake ranting, eh dia nyolek balik. Seru banget!" },
    { en: "I collected three rumors today and one of them is probably true!", id: "Aku kumpulin tiga gosip hari ini dan satunya mungkin bener!" },
    { en: "Hihihi, I was NOT eavesdropping. I was just standing very near, listening hard.", id: "Hihihi, aku NGGAK nguping. Cuma berdiri deket banget sambil dengerin serius." },
    { en: "Ooh, a new face! Where from? Since when? Why were you there?", id: "Ooh, muka baru! Dari mana? Sejak kapan? Ngapain di sana?" },
    { en: "My hair tingles when something juicy is about to happen.", id: "Rambutku geli-geli kalau ada yang seru bakal terjadi." },
    { en: "Keep a secret? Sure! For about one minute. Okay, five.", id: "Jaga rahasia? Bisa dong! Kira-kira semenit. Oke, lima menit." },
    { en: "Is that a tiny door in the roots? Open it, open it, open it!", id: "Itu pintu kecil di akar bukan? Buka, buka, buka!" },
    { en: "I have so many questions and only one hair-raising evening!", id: "Aku punya banyak banget pertanyaan dan cuma satu malam yang bikin merinding!" },
    { en: "Trade me a secret and I will trade you a bigger one!", id: "Tukeran rahasia yuk, nanti kukasih yang lebih gede!" },
    { en: "Something odd is happening in the old well, and I am going in!", id: "Ada yang aneh di sumur tua, dan aku mau masuk!" },
  ],
};

// ---- pure rules ----

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 10 distinct questions for a date: [{ ghost, key, en, id }]. Same date, same set.
export function dailySet(dateString = localDate()): Question[] {
  const rnd = mulberry32(hashString(`guess-the-ghost:${dateString}`));
  const all: Question[] = [];
  for (const g of IDS) LINES[g].forEach((l, i) => all.push({ ghost: g, key: `${g}:${i}`, en: l.en, id: l.id }));
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all.slice(0, QUESTIONS);
}

// Points for one answer. `streakBefore` = consecutive correct answers just before this one.
export function answerPoints(correct: boolean, streakBefore: number): number {
  if (!correct) return 0;
  return BASE + Math.min(STREAK_MAX, STREAK_STEP * streakBefore);
}

// Score for a list of picks (ghost ids) against a question list.
export function scoreRun(questions: Question[], picks: string[]): number {
  let score = 0, streak = 0;
  questions.forEach((q, i) => {
    const ok = picks[i] === q.ghost;
    score += answerPoints(ok, streak);
    streak = ok ? streak + 1 : 0;
  });
  return score;
}
