// Words on the app pages (list, games, me), in the visitor's language (English or Indonesian, like the chat).
// Elements with data-t="key" in the HTML are filled from here.

const TEXT = {
  en: {
    tabChats: "Chats", tabGames: "Games", tabMe: "Me", backChats: "Back to chats", backGames: "Back to games",
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
    questsTitle: "Today's quests", streakDays: (n) => (n === 1 ? "1 day streak" : `${n} day streak`), streakNone: "No streak yet",
    questDone: (label, candles) => `Quest done: ${label} (+${candles} candles)`, allQuestsDone: (bonus) => `All quests done! +${bonus} candles`,
    bondLevelUp: (name, level, title) => `Bond with ${name}: level ${level}, ${title}`, storyUnlocked: "New story unlocked on the Me page",
    meStories: "Stories", meStoryLocked: (level) => `Unlocks at bond level ${level}`, meStreak: "Best streak", meDays: "days",
    titles: ["Stranger", "Acquaintance", "Neighbour", "Friend", "Good friend", "Close friend", "Confidant", "Trusted", "Inseparable", "Soulmate"],
  },
  id: {
    tabChats: "Obrolan", tabGames: "Game", tabMe: "Saya", backChats: "Kembali ke obrolan", backGames: "Kembali ke game",
    you: "Kamu:", moreOptions: "Opsi lainnya", clearChat: "Hapus obrolan", clearConfirm: (name) => `Hapus obrolanmu dengan ${name}?`, candles: "Lilin", bond: "Level ikatan", best: "Terbaik",
    score: "Skor", again: "Main lagi", over: "Game selesai", record: "Rekor baru!",
    reward: (c, xp) => `+${c} lilin, +${xp} ikatan`,
    capped: "Batas lilin harian tercapai, tapi ikatan tetap naik.",
    levelUp: (l) => `Ikatan level ${l}!`, tapToStart: "Ketuk atau tekan Spasi untuk mulai", chatWith: (name) => `Ngobrol dengan ${name}`,
    meGuest: "Tamu", meNote: "Progresmu tersimpan di browser ini.", meSignIn: "Masuk dengan Google (segera hadir)",
    meCandles: "Lilin", mePlayed: "Game dimainkan", meBonds: "Ikatan", mePrivacy: "Privasi",
    meSignOut: "Keluar", meDelete: "Hapus akun", meSavedAccount: "Progresmu tersimpan di akunmu.",
    meSignedInAs: (email) => (email ? `Masuk sebagai ${email}` : "Sudah masuk"),
    meDeleteConfirm: "Hapus akunmu dan progres yang tersimpan di server kami? Ini tidak bisa dibatalkan. Progres di browser ini tetap ada.",
    meSignInError: "Gagal masuk. Silakan coba lagi.",
    questsTitle: "Misi hari ini", streakDays: (n) => `${n} hari beruntun`, streakNone: "Belum ada rentetan",
    questDone: (label, candles) => `Misi selesai: ${label} (+${candles} lilin)`, allQuestsDone: (bonus) => `Semua misi selesai! +${bonus} lilin`,
    bondLevelUp: (name, level, title) => `Ikatan dengan ${name}: level ${level}, ${title}`, storyUnlocked: "Cerita baru terbuka di halaman Saya",
    meStories: "Cerita", meStoryLocked: (level) => `Terbuka di ikatan level ${level}`, meStreak: "Rentetan terbaik", meDays: "hari",
    titles: ["Orang asing", "Kenalan", "Tetangga", "Teman", "Teman baik", "Teman dekat", "Tempat curhat", "Dipercaya", "Tak terpisahkan", "Belahan jiwa"],
  },
};

export const lang = (navigator.language || "").toLowerCase().startsWith("id") ? "id" : "en";
export const T = TEXT[lang];
export const pickLine = (lines) => lines[Math.floor(Math.random() * lines.length)];
