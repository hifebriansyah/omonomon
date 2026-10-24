// Words on the app pages (list, games, me), in the visitor's language (English or Indonesian, like the chat).
// Elements with data-t="key" in the HTML are filled from here.

const TEXT = {
  en: {
    tabChats: "Chats", tabWhispers: "Whispers", tabGames: "Games", tabMe: "Me",
    sayTo: (name) => `Say something to ${name}...`, historyShow: "Show chat history", historyClose: "Close chat history", sendWord: "Send", historyTitle: (name) => `Chat history with ${name}`, historyAbout: (name) => `Your saved chat with ${name}.`,
    loveWord: "Love", shareWord: "Share", allWhispers: "All whispers", whisperGone: "This whisper has faded away.", copiedWord: "Copied", unloveWord: "Remove love", meLoved: "Loved whispers", lovedTitle: "Loved whispers", lovedNone: "No loved whispers yet. Tap the heart on a whisper to keep it here.", backMe: "Back",
    commentWord: "Comment", commentPlaceholder: (name) => `Say something to ${name}...`, commentSend: "Send", commentAs: "Commenting as", commentChange: "change",
    commentThinking: (name) => `${name} is answering...`, commentNone: "No comments yet. Be the first.", commentLoadError: "Could not load the comments.",
    commentRefused: "This comment can't be shown here. Please keep it kind.",
    commentCare: "That sounds heavy. Comments here are public, so it can't be posted. Please talk to someone you trust, or find a helpline at findahelpline.com.",
    commentLimit: "That's enough comments for now. Try again later.", commentLater: "Comments are resting right now. Please try again in a bit.",
    commentError: "Could not send the comment.", commentDelete: "Delete my comment", commentDeleted: "deleted", commentGhost: "ghost",
    meLanguage: "Language", meNickname: "Nickname", meSave: "Save", meRandom: "Random", meNickNote: "Shown next to your comments on whispers.", meNickBad: "2 to 24 letters, numbers, spaces, - or _.", meNickSaved: "Saved.",
    whispersIntro: "Little updates the ghosts post when the mood strikes.", whisperNone: "No whispers yet. Check back soon.", whisperError: "Could not load the whispers right now.", backChats: "Back to chats", backGames: "Back to games",
    you: "You:", moreOptions: "More options", clearChat: "Clear chat", clearConfirm: (name) => `Clear your chat with ${name}?`, candles: "Candles", bond: "Bond level", best: "Best",
    score: "Score", again: "Play again", over: "Game over", record: "New best!",
    reward: (c, xp) => `+${c} ${c === 1 ? "candle" : "candles"}, +${xp} bond`,
    capped: "Daily candle limit reached, but the bond still grows.",
    levelUp: (l) => `Bond level ${l}!`, tapToStart: "Tap or press Space to start", chatWith: (name) => `Chat with ${name}`,
    meGuest: "Guest", meNote: "Your progress is saved in this browser.", meSignIn: "Sign in with Google (coming soon)",
    meCandles: "Candles", mePlayed: "Games played", meBonds: "Bonds", mePrivacy: "Privacy",
    meSignOut: "Sign out", meDelete: "Delete account", meSavedAccount: "Your progress is saved to your account.",
    meSignedInAs: (email) => (email ? `Signed in as ${email}` : "Signed in"),
    meDeleteConfirm: "Delete your account and the progress saved on our server? This cannot be undone. Progress in this browser stays.",
    meSignInError: "Sign-in did not work. Please try again.",
    memWatch: "Watch...", memYourTurn: "Your turn", memWellDone: "Well remembered", memSigh: "...a sigh. Again.", memBegin: "Begin",
    memSighs: (n) => (n === 1 ? "1 sigh left" : `${n} sighs left`), memPetal: (i) => `Petal ${i}`,
    rdBegin: "Start the shift", rdCalling: "Rooms are calling...", rdThanks: "Thank you!", rdMissed: "A call was missed",
    rdLives: (n) => (n === 1 ? "1 missed call left" : `${n} missed calls left`), rdRoom: (i) => `Room ${i}`,
    questsTitle: "Today's quests", streakDays: (n) => (n === 1 ? "1 day streak" : `${n} day streak`), streakNone: "No streak yet",
    questDone: (label, candles) => `Quest done: ${label} (+${candles} candles)`, allQuestsDone: (bonus) => `All quests done! +${bonus} candles`,
    bondLevelUp: (name, level, title) => `Bond with ${name}: level ${level}, ${title}`, storyUnlocked: "New story unlocked on the Me page",
    meStories: "Stories", meStoryLocked: (level) => `Unlocks at bond level ${level}`, meStreak: "Best streak", meDays: "days",
    titles: ["Stranger", "Acquaintance", "Neighbour", "Friend", "Good friend", "Close friend", "Confidant", "Trusted", "Inseparable", "Soulmate"],
  },
  id: {
    tabChats: "Chat", tabWhispers: "Bisikan", tabGames: "Game", tabMe: "Aku",
    sayTo: (name) => `Bilang sesuatu ke ${name}...`, historyShow: "Tampilkan riwayat chat", historyClose: "Tutup riwayat chat", sendWord: "Kirim", historyTitle: (name) => `Riwayat chat dengan ${name}`, historyAbout: (name) => `Chat tersimpanmu dengan ${name}.`,
    homeIntro: "Ngobrol sama empat hantu Indonesia yang ramah: pocong, suster ngesot, sundel bolong, dan kuntilanak. Boleh pakai bahasa Indonesia atau Inggris.",
    loveWord: "Suka", shareWord: "Bagikan", allWhispers: "Semua bisikan", whisperGone: "Bisikan ini sudah menghilang.", copiedWord: "Tersalin", unloveWord: "Batal suka", meLoved: "Bisikan yang kusuka", lovedTitle: "Bisikan yang kusuka", lovedNone: "Belum ada bisikan yang kamu suka. Tap hati pada bisikan untuk menyimpannya di sini.", backMe: "Kembali",
    commentWord: "Komentar", commentPlaceholder: (name) => `Bilang sesuatu ke ${name}...`, commentSend: "Kirim", commentAs: "Berkomentar sebagai", commentChange: "ubah",
    commentThinking: (name) => `${name} sedang menjawab...`, commentNone: "Belum ada komentar. Jadi yang pertama.", commentLoadError: "Komentar belum bisa dimuat.",
    commentRefused: "Komentar ini tidak bisa ditampilkan di sini. Yuk, tetap ramah.",
    commentCare: "Kedengarannya berat. Komentar di sini terbuka untuk umum, jadi tidak bisa diposting. Ceritalah ke orang yang kamu percaya, atau cari bantuan di findahelpline.com.",
    commentLimit: "Cukup dulu komentarnya. Coba lagi nanti.", commentLater: "Komentar sedang istirahat. Coba lagi sebentar lagi ya.",
    commentError: "Komentar gagal dikirim.", commentDelete: "Hapus komentarku", commentDeleted: "dihapus", commentGhost: "hantu",
    meLanguage: "Bahasa", meNickname: "Nama panggilan", meSave: "Simpan", meRandom: "Acak", meNickNote: "Ditampilkan di samping komentarmu di bisikan.", meNickBad: "2 sampai 24 huruf, angka, spasi, - atau _.", meNickSaved: "Tersimpan.",
    whispersIntro: "Kabar kecil dari para hantu, kapan pun mereka lagi ingin.", whisperNone: "Belum ada bisikan. Cek lagi nanti ya.", whisperError: "Bisikan belum bisa dimuat sekarang.", backChats: "Kembali ke chat", backGames: "Kembali ke game",
    you: "Kamu:", moreOptions: "Opsi lainnya", clearChat: "Hapus chat", clearConfirm: (name) => `Hapus chat kamu dengan ${name}?`, candles: "Lilin", bond: "Level ikatan", best: "Rekor",
    score: "Skor", again: "Main lagi", over: "Game selesai", record: "Rekor baru!",
    reward: (c, xp) => `+${c} lilin, +${xp} ikatan`,
    capped: "Batas lilin harian tercapai, tapi ikatan tetap naik.",
    levelUp: (l) => `Ikatan level ${l}!`, tapToStart: "Tap atau tekan Spasi untuk mulai", chatWith: (name) => `Ngobrol dengan ${name}`,
    meGuest: "Tamu", meNote: "Progresmu tersimpan di browser ini.", meSignIn: "Masuk dengan Google (segera hadir)",
    meCandles: "Lilin", mePlayed: "Game dimainkan", meBonds: "Ikatan", mePrivacy: "Privasi",
    meSignOut: "Keluar", meDelete: "Hapus akun", meSavedAccount: "Progresmu tersimpan di akunmu.",
    meSignedInAs: (email) => (email ? `Masuk sebagai ${email}` : "Sudah masuk"),
    meDeleteConfirm: "Hapus akunmu dan progres yang tersimpan di server kami? Ini tidak bisa dibatalkan. Progres di browser ini tetap ada.",
    meSignInError: "Gagal masuk. Silakan coba lagi.",
    memWatch: "Perhatikan...", memYourTurn: "Giliranmu", memWellDone: "Ingatanmu bagus", memSigh: "...desah. Sekali lagi.", memBegin: "Mulai",
    memSighs: (n) => `${n} desah tersisa`, memPetal: (i) => `Kelopak ${i}`,
    rdBegin: "Mulai shift", rdCalling: "Kamar-kamar memanggil...", rdThanks: "Terima kasih!", rdMissed: "Ada panggilan terlewat",
    rdLives: (n) => `${n} panggilan terlewat tersisa`, rdRoom: (i) => `Kamar ${i}`,
    questsTitle: "Misi hari ini", streakDays: (n) => `${n} hari beruntun`, streakNone: "Belum ada rentetan",
    questDone: (label, candles) => `Misi selesai: ${label} (+${candles} lilin)`, allQuestsDone: (bonus) => `Semua misi selesai! +${bonus} lilin`,
    bondLevelUp: (name, level, title) => `Ikatan dengan ${name}: level ${level}, ${title}`, storyUnlocked: "Cerita baru terbuka di halaman Aku",
    meStories: "Cerita", meStoryLocked: (level) => `Terbuka di ikatan level ${level}`, meStreak: "Rentetan rekor", meDays: "hari",
    titles: ["Orang asing", "Kenalan", "Tetangga", "Teman", "Teman baik", "Teman dekat", "Tempat curhat", "Dipercaya", "Tak terpisahkan", "Belahan jiwa"],
  },
};

// The language the visitor chose on the Me page (kept in this browser). Until they choose, it is Indonesian, whatever the browser's language.
const LANG_KEY = "ghostlang";
function chosenLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "id" || v === "en" ? v : null;
  } catch {
    return null;
  }
}
export const lang = chosenLang() || "id";
export function setLang(l) {
  try { localStorage.setItem(LANG_KEY, l === "id" ? "id" : "en"); } catch {}
}
export const T = TEXT[lang];
export const pickLine = (lines) => lines[Math.floor(Math.random() * lines.length)];
