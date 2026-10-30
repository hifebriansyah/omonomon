// Uji Nyali (Dare Night): a choose-your-path night walk with a ghost companion. Story data and rules are pure; Game.tsx is the view.

export interface Both {
  en: string;
  id: string;
}
export type Stat = "c" | "k" | "u";
export type Stats = Record<Stat, number>;
export interface Option {
  t: Both;
  fx: string; // "c2" courage, "k2" kindness, "u2" curiosity, "" none
  res: Both;
  min: number;
}
export interface StoryNode {
  id: string;
  route: string;
  i: number;
  t: Both;
  b4?: Both;
  opts: (Option & { to: string })[];
}
export type EndingId = "bold" | "kind" | "curious" | "hurry" | "lantern";
export interface RunState {
  ghost: string;
  level: number;
  route: string;
  node: string;
  stats: Stats;
  last: Both | null;
  done: boolean;
  ending: EndingId | null;
  score: number;
  steps: number;
}

const B = (en: string, id: string): Both => ({ en, id });
// option: text, stat effect ("c2" courage, "k2" kindness, "u2" curiosity, "" none), reaction line, optional bond level needed
const O = (en: string, id: string, fx: string, ren: string, rid: string, min = 0): Option => ({ t: B(en, id), fx, res: B(ren, rid), min });

export const STATS: Stat[] = ["c", "k", "u"];
export const GHOSTS = ["1", "2", "3", "4"];
export const COMPANION: Record<string, { say: Both[]; end: Both }> = {
  "1": {
    say: [B("Fine. Walk. I'll float behind you and sigh.", "Ya udah. Jalan. Aku melayang di belakang sambil menghela napas."), B("Everything here is old. Like me. Don't stare.", "Semua di sini tua. Kayak aku. Jangan dipelototin."), B("Pick one. I've seen both. Both are fine.", "Pilih satu. Aku sudah lihat dua-duanya. Dua-duanya aman."), B("Hm. Not terrible so far.", "Hm. Sejauh ini nggak buruk-buruk amat."), B("Don't look at me. I'm not nervous. I'm dead.", "Jangan lihat aku. Aku nggak gugup. Aku udah mati."), B("Almost done. You're braver than you look.", "Hampir selesai. Kamu lebih berani dari tampangmu.")],
    end: B("I'd never say this twice: that was a good walk.", "Ini cuma kukatakan sekali: jalan-jalan yang bagus."),
  },
  "2": {
    say: [B("Stay close, mind your step, and breathe slowly.", "Jangan jauh-jauh, hati-hati langkahmu, dan napas pelan-pelan."), B("Careful on the uneven ground. I'll check ahead.", "Awas tanahnya nggak rata. Aku cek ke depan dulu."), B("Take your time. Nobody is timing us tonight.", "Pelan aja. Malam ini nggak ada yang ngitung waktu."), B("Good. Steady hands, steady heart.", "Bagus. Tangan mantap, hati tenang."), B("Easy. Whatever it is, we face it together.", "Tenang. Apa pun itu, kita hadapi bareng."), B("You did well. Warm drink after this, I insist.", "Kamu hebat. Habis ini minum yang hangat, aku maksa.")],
    end: B("Rounds complete. You're safe, and I'm proud.", "Keliling selesai. Kamu aman, dan aku bangga."),
  },
  "3": {
    say: [B("The night is so soft here... come, together.", "Malamnya lembut sekali di sini... ayo, bareng-bareng."), B("I think someone loved this place once.", "Kurasa dulu ada yang sayang sama tempat ini."), B("Either way, it leads somewhere gentle.", "Ke mana pun, ujungnya tempat yang lembut."), B("I remember a light like that, long ago.", "Aku ingat cahaya seperti itu, dulu sekali."), B("Listen... even the quiet has a heartbeat.", "Dengar... bahkan sunyi pun punya detak."), B("The sky is waking up. Isn't it lovely?", "Langit mulai bangun. Indah ya?")],
    end: B("Thank you for walking with me. It was warm.", "Terima kasih sudah jalan bareng aku. Hangat rasanya."),
  },
  "4": {
    say: [B("Ooh, a night walk! Did you hear that? Tell me everything.", "Ooh, jalan malam! Kamu dengar itu? Ceritain semuanya."), B("I heard a story about this spot. Later, later!", "Aku pernah dengar gosip soal tempat ini. Nanti, nanti!"), B("Ooh, which one? Which one? I'm guessing!", "Ooh, yang mana? Yang mana? Aku tebak-tebak nih!"), B("I'll remember this. I remember everything good.", "Bakal kuingat ini. Aku ingat semua yang seru."), B("Whoa, did that just happen? I'm telling everybody!", "Wah, barusan itu beneran? Aku bakal cerita ke semua orang!"), B("Already the end? Let's do another one soon!", "Udah mau selesai? Ayo jalan lagi lain kali!")],
    end: B("Best night walk ever. I'm telling all the ghosts.", "Jalan malam terbaik. Aku bakal cerita ke semua hantu."),
  },
};

export const ROUTES: Record<string, Both> = {
  grave: B("The Old Cemetery", "Makam Tua"),
  ward: B("The Night Ward", "Bangsal Malam"),
  banyan: B("The Banyan Grove", "Hutan Beringin"),
};
export const NODES: Record<string, StoryNode> = {};
const route = (r: string, steps: [Both, Option[], Both?][]) => steps.forEach((s, n) => {
  const last = n === steps.length - 1;
  NODES[r + (n + 1)] = { id: r + (n + 1), route: r, i: n, t: s[0], b4: s[2], opts: s[1].map((o) => ({ ...o, to: last ? "end" : r + (n + 2) })) };
});

route("grave", [
  [B("The cemetery gate hangs open. The path beyond is silver with moonlight, and something small rustles inside.", "Gerbang makam terbuka sedikit. Jalan di baliknya keperakan oleh cahaya bulan, dan ada yang bergemerisik pelan di dalam."), [
    O("Walk in first", "Masuk duluan", "c2", "Your steps are loud, but nothing minds.", "Langkahmu keras, tapi nggak ada yang keberatan."),
    O("Peek at the rustle", "Intip suara itu", "u2", "Only a leaf, dancing in a draft.", "Cuma selembar daun yang menari ditiup angin."),
    O("Let {g} lead", "Biar {g} yang jalan duluan", "", "The gate creaks a hello as you pass.", "Gerbangnya berderit menyapa saat kamu lewat."),
    O("Hold the gate open for {g}", "Tahan gerbangnya buat {g}", "k2", "{g} looks surprised, then pleased.", "{g} kaget, lalu senang.", 4)],
   B("{g} walks a little closer than usual.", "{g} jalan sedikit lebih dekat dari biasanya.")],
  [B("Old headstones lean together like sleepy friends. One has a faded flower tied to it.", "Batu nisan tua saling bersandar seperti teman yang mengantuk. Salah satunya diikat bunga yang sudah pudar."), [
    O("Straighten the flower", "Rapikan bunganya", "k2", "The flower seems to stand a bit prouder.", "Bunganya kelihatan sedikit lebih tegak."),
    O("Read the worn name", "Baca nama yang aus", "u2", "You can only make out a nickname: 'Sleepy'.", "Cuma terbaca satu panggilan: 'Si Ngantuk'."),
    O("Keep your eyes ahead", "Terus lihat ke depan", "", "You walk a little faster. That's okay.", "Kamu jalan agak cepat. Nggak apa-apa.")]],
  [B("The path forks. Left smells like jasmine. Right is dark and quiet.", "Jalannya bercabang. Kiri harum melati. Kanan gelap dan sunyi."), [
    O("Take the dark path", "Ambil jalan gelap", "c2", "It is only quiet. Quiet is not scary, just shy.", "Ternyata cuma sunyi. Sunyi nggak serem, cuma pemalu."),
    O("Follow the jasmine", "Ikuti bau melati", "u2", "A little shrub is blooming out of season.", "Ada semak kecil berbunga di luar musimnya."),
    O("Take whichever is brighter", "Ambil yang lebih terang", "", "The moon nudges you left.", "Bulan mendorongmu pelan ke kiri.")],
   B("{g} says the dark path used to be a shortcut for lovers of night.", "{g} bilang jalan gelap itu dulu jalan pintas para pencinta malam.")],
  [B("A tiny lantern sits on a grave, nearly out of oil.", "Sebuah lentera mungil di atas makam, minyaknya hampir habis."), [
    O("Cup your hands around its flame", "Lindungi apinya dengan kedua tanganmu", "k2", "The flame steadies and glows warm.", "Apinya tenang dan bersinar hangat."),
    O("Carry it ahead as a guide", "Bawa ke depan sebagai penerang", "c2", "It lights the path just far enough.", "Cukup menerangi jalan sejauh yang dibutuhkan."),
    O("Leave it, it isn't yours", "Biarkan, ini bukan punyamu", "", "You nod at it politely.", "Kamu mengangguk sopan padanya.")]],
  [B("A cold breeze whispers from behind the tall tree. It almost sounds like a name.", "Angin dingin berbisik dari balik pohon tinggi. Hampir terdengar seperti sebuah nama."), [
    O("Call out: who's there?", "Panggil: siapa di sana?", "c2", "A sleepy owl pops out and looks offended.", "Seekor burung hantu ngantuk muncul dan tampak tersinggung."),
    O("Whisper back, curious", "Balas berbisik, penasaran", "u2", "The wind giggles and messes up your hair.", "Anginnya cekikikan dan mengacak rambutmu."),
    O("Hum a calm tune", "Senandung pelan", "k1", "The breeze hushes to listen.", "Anginnya diam ikut mendengarkan.")]],
  [B("At the far end the sky turns pale. The last grave has a bench beside it.", "Di ujung sana langit mulai pucat. Makam terakhir punya bangku di sampingnya."), [
    O("Sit and rest a moment", "Duduk istirahat sebentar", "k2", "The bench is warm, as if someone just left.", "Bangkunya hangat, seperti baru ditinggalkan seseorang."),
    O("Say goodnight to the dark", "Ucapkan selamat malam pada gelap", "c2", "The dark seems to bow back.", "Gelapnya seperti membungkuk membalas."),
    O("Go straight home", "Langsung pulang", "", "You're home before the first rooster.", "Kamu sampai rumah sebelum ayam jantan pertama berkokok.")]],
]);

route("ward", [
  [B("The old hospital corridor hums softly. A single lamp flickers at the far end.", "Lorong rumah sakit tua berdengung pelan. Satu lampu berkedip di ujung sana."), [
    O("March toward the lamp", "Jalan lurus ke arah lampu", "c2", "The lamp steadies, as if impressed.", "Lampunya jadi tenang, seperti terkesan."),
    O("Check the door labels", "Baca label di pintu-pintu", "u2", "'Linen', 'Quiet Room', 'Tea (Staff Only)'.", "'Linen', 'Ruang Tenang', 'Teh (Khusus Petugas)'."),
    O("Tiptoe along the wall", "Berjingkat di pinggir tembok", "", "Your shadow tiptoes too.", "Bayanganmu ikut berjingkat."),
    O("Ask {g} to show you the way", "Minta {g} tunjukkan jalan", "k2", "{g} floats ahead, glowing a little.", "{g} melayang ke depan, bersinar tipis.", 4)],
   B("{g} knows every squeaky tile by heart.", "{g} hafal setiap ubin yang berderit.")],
  [B("A wheelchair rolls an inch by itself, then stops, embarrassed.", "Sebuah kursi roda bergulir seinci sendiri, lalu berhenti, malu."), [
    O("Roll it back gently", "Dorong pelan ke tempatnya", "k2", "It squeaks a tiny thank you.", "Kursinya berdecit kecil tanda terima kasih."),
    O("Ask it what it wanted", "Tanya ia maunya apa", "u2", "It points its wheel at the window.", "Rodanya menunjuk ke arah jendela."),
    O("Walk around it politely", "Lewati dengan sopan", "", "You nod. It nods back, somehow.", "Kamu mengangguk. Entah gimana ia balas mengangguk.")]],
  [B("A nurse call button lights up in an empty room. Beep, beep, beep.", "Tombol panggil perawat menyala di ruangan kosong. Tut, tut, tut."), [
    O("Step in and press it back", "Masuk dan tekan balik", "c2", "The beeping settles into a happy chirp.", "Bunyinya jadi kicauan senang."),
    O("Look out the window it faces", "Lihat jendela di depannya", "u2", "A cat stares up at you from the courtyard.", "Seekor kucing menatapmu dari halaman."),
    O("Say 'all is well' and move on", "Bilang 'semua baik-baik saja' dan lanjut", "k1", "The light blinks off, content.", "Lampunya padam, puas.")]],
  [B("The stairwell is dark, and a soft lullaby drifts up from below.", "Tangga darurat gelap, dan nina bobo lembut mengalun dari bawah."), [
    O("Go down toward the song", "Turun mengikuti lagunya", "c2", "A radio hums alone, tuned to nowhere.", "Sebuah radio berdendang sendiri, stasiunnya entah di mana."),
    O("Hum along from the landing", "Ikut bersenandung dari pijakan", "k2", "The lullaby changes key to match you.", "Nada nina bobonya menyesuaikan suaramu."),
    O("Take the elevator instead", "Pakai lift saja", "", "The elevator plays gentle music too.", "Liftnya juga memutar musik lembut.")]],
  [B("A pharmacy window glows. Rows of tiny brown bottles clink together.", "Jendela apotek bersinar. Deretan botol cokelat kecil berdenting."), [
    O("Read the funny labels", "Baca label-label lucunya", "u2", "'Take with warm milk and a good story.'", "'Diminum dengan susu hangat dan cerita bagus.'"),
    O("Tidy the bottles", "Rapikan botol-botolnya", "k2", "They line up like proud little soldiers.", "Botolnya berbaris seperti prajurit kecil yang bangga."),
    O("Walk past quickly", "Lewat cepat-cepat", "", "The clinking follows you like a tail.", "Dentingnya mengikutimu seperti ekor.")]],
  [B("At the end of the ward, dawn light touches the window. A quiet room waits, door ajar.", "Di ujung bangsal, cahaya fajar menyentuh jendela. Ruang tenang menunggu, pintunya sedikit terbuka."), [
    O("Open the door wide", "Buka pintunya lebar-lebar", "c2", "Just a made bed, a pillow, and a plant.", "Cuma ranjang rapi, bantal, dan satu tanaman."),
    O("Water the little plant", "Siram tanaman kecilnya", "k2", "A new leaf unfurls like a thank you.", "Selembar daun baru membuka seperti ucapan terima kasih."),
    O("Head back out", "Balik keluar", "", "Fresh air is waiting at the entrance.", "Udara segar menunggu di pintu depan.")]],
]);

route("banyan", [
  [B("A huge banyan stands at the edge of the village. Its roots hang like curtains, swaying though there is no wind.", "Pohon beringin raksasa berdiri di tepi desa. Akar gantungnya bergoyang seperti tirai, padahal nggak ada angin."), [
    O("Push the roots aside", "Singkirkan akar-akarnya", "c2", "They part with a rustle like a sigh.", "Akarnya terbuka dengan bunyi seperti helaan napas."),
    O("Touch a root, listen", "Sentuh satu akar, dengarkan", "u2", "It hums, deep and slow, like a cello.", "Akarnya berdengung dalam dan pelan, seperti selo."),
    O("Wait by the trunk", "Tunggu di batang pohon", "", "A firefly lands on your sleeve.", "Seekor kunang-kunang hinggap di lenganmu."),
    O("Thank the tree for its shade", "Terima kasih pada pohonnya", "k2", "Leaves rustle: you're welcome.", "Daun-daun bergemerisik: sama-sama.", 4)],
   B("{g} says this tree has been here longer than the village.", "{g} bilang pohon ini lebih tua dari desanya.")],
  [B("Little offerings sit among the roots: rice, a cup of tea, a tiny paper boat.", "Sesajen kecil di antara akar: nasi, secangkir teh, dan perahu kertas mungil."), [
    O("Add a leaf as your gift", "Tambahkan daun sebagai hadiahmu", "k2", "The tea steams a bit in thanks.", "Tehnya mengepul sedikit tanda terima kasih."),
    O("Unfold the paper boat", "Buka lipatan perahu kertas", "u2", "Inside, a child wrote: 'Look after the tree'.", "Di dalamnya anak kecil menulis: 'Jagain pohonnya ya'."),
    O("Step carefully around", "Lewati dengan hati-hati", "", "Not a grain of rice disturbed.", "Sebutir nasi pun nggak tersenggol.")]],
  [B("Deeper in, the grove is dim. A pair of round yellow eyes blinks from a branch.", "Lebih dalam, hutannya remang. Sepasang mata bulat kuning berkedip dari dahan."), [
    O("Stare back, unblinking", "Balas tatap tanpa berkedip", "c2", "The owl blinks first. You win.", "Burung hantunya berkedip duluan. Kamu menang."),
    O("Wave hello", "Lambaikan tangan", "k2", "The owl tilts its head, charmed.", "Burung hantunya memiringkan kepala, terpikat."),
    O("Shuffle to the other side", "Geser ke sisi lain", "", "The owl swivels to keep watching, politely.", "Burung hantunya memutar kepala, menonton dengan sopan.")]],
  [B("A swing hangs from a thick branch, moving slowly back and forth on its own.", "Sebuah ayunan tergantung di dahan tebal, bergerak pelan sendiri."), [
    O("Sit and swing a little", "Duduk dan berayun sedikit", "c2", "The ropes hold you gently, like a hand.", "Talinya menahanmu lembut, seperti tangan."),
    O("Look for who it belongs to", "Cari tahu ayunan milik siapa", "u2", "Carved on the seat: 'Ani, 7 years old'.", "Terukir di dudukan: 'Ani, 7 tahun'."),
    O("Give it a small push", "Dorong sedikit", "k1", "It swings happily to nobody.", "Ayunannya bergoyang riang untuk entah siapa.")]],
  [B("Fireflies gather and spell a wobbly arrow in the air.", "Kunang-kunang berkumpul dan membentuk panah goyang di udara."), [
    O("Follow the arrow", "Ikuti panahnya", "u2", "It leads to a clearing full of fireflies.", "Panahnya membawa ke tanah lapang penuh kunang-kunang."),
    O("Cup one in your hands", "Tangkup satu di tanganmu, lalu lepas", "k2", "It glows and zips off, thankful.", "Ia bersinar dan terbang pergi, berterima kasih."),
    O("Ignore it, it's silly", "Abaikan, konyol", "", "The arrow sulks and scatters.", "Panahnya merajuk dan bubar.")]],
  [B("Beyond the roots, the village rooftops catch the first gold of morning.", "Di balik akar-akar, atap desa mulai berkilau emas pagi."), [
    O("Climb the root and look", "Panjat akarnya dan lihat", "c2", "From up here the whole village is waking.", "Dari atas sini seluruh desa mulai bangun."),
    O("Leave a thank-you note", "Tinggalkan catatan terima kasih", "k2", "You tuck it under a root, safe and dry.", "Kamu selipkan di bawah akar, aman dan kering."),
    O("Walk back home", "Jalan pulang", "", "Your bed has never looked so friendly.", "Kasurmu belum pernah kelihatan seramah ini.")]],
]);

export const ENDINGS: Record<EndingId, { t: Both; x: Both }> = {
  bold: { t: B("Brave Walker", "Si Berani"), x: B("You walked straight through the night and didn't flinch. The dark learned your name and now tips its hat when you pass.", "Kamu jalan menembus malam tanpa gentar. Gelap hafal namamu sekarang dan mengangguk hormat tiap kamu lewat.") },
  kind: { t: B("Gentle Heart", "Hati Lembut"), x: B("Every little thing you met left a bit warmer for it. The night walked you home, carrying a lantern.", "Setiap hal kecil yang kamu temui jadi sedikit lebih hangat. Malam mengantarmu pulang sambil membawa lentera.") },
  curious: { t: B("Night Detective", "Detektif Malam"), x: B("You asked, you peeked, you read the tiny labels. The night shared three secrets with you, and you kept them all.", "Kamu bertanya, mengintip, membaca label kecil. Malam berbagi tiga rahasia denganmu, dan kamu menyimpan semuanya.") },
  hurry: { t: B("Quick Escape", "Kabur Cepat"), x: B("You took the safe road and got home with your heart pounding and your slippers on. Next time, the night will wait for you.", "Kamu ambil jalan aman dan sampai rumah dengan jantung berdebar dan sandal masih terpakai. Lain kali, malam akan menunggumu.") },
  lantern: { t: B("Lantern of Friends", "Lentera Sahabat"), x: B("At the end, {g} lit a small lantern just for you. 'This is how I'll find you next time,' they said. The night has never felt so safe.", "Di ujung jalan, {g} menyalakan lentera kecil untuk kamu. 'Biar gampang kutemukan kamu lain kali,' katanya. Malam belum pernah terasa seaman ini.") },
};
export const ENDING_IDS = Object.keys(ENDINGS) as EndingId[];

export const ROUTE_IDS = Object.keys(ROUTES);
export const pickRoute = (seed: number) => ROUTE_IDS[Math.abs(Math.floor(seed)) % ROUTE_IDS.length];
export const optionsOf = (node: StoryNode, level: number) => node.opts.map((o, index) => ({ ...o, index })).filter((o) => level >= o.min);
export const total = (s: Stats) => s.c + s.k + s.u;
export function endingOf(stats: Stats, level: number): EndingId {
  if (level >= 7 && total(stats) >= 8) return "lantern";
  if (total(stats) <= 4) return "hurry";
  const top = Math.max(stats.c, stats.k, stats.u);
  return stats.c === top ? "bold" : stats.k === top ? "kind" : "curious";
}
export function scoreOf(stats: Stats, level: number, ending: EndingId): number {
  return 40 + Math.min(total(stats), 16) * 4 + Math.min(level, 10) * 4 + (ending === "lantern" ? 16 : 0);
}
export function newRun({ ghost, level = 1, route = "grave" }: { ghost: string; level?: number; route?: string }): RunState {
  return { ghost, level, route, node: route + "1", stats: { c: 0, k: 0, u: 0 }, last: null, done: false, ending: null, score: 0, steps: 0 };
}
export function step(state: RunState, choiceIndex: number): RunState {
  if (state.done) return state;
  const opt = optionsOf(NODES[state.node], state.level).find((o) => o.index === choiceIndex);
  if (!opt) return state;
  const stats = { ...state.stats };
  if (opt.fx) stats[opt.fx[0] as Stat] += Number(opt.fx.slice(1));
  const next: RunState = { ...state, stats, last: opt.res, node: opt.to, steps: state.steps + 1 };
  if (opt.to === "end") {
    next.done = true;
    next.ending = endingOf(stats, state.level);
    next.score = scoreOf(stats, state.level, next.ending);
  }
  return next;
}
