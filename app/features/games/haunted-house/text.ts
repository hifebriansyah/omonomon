import type { Lang } from "~/lib/content";
import type { FurnitureName, LanternColor } from "./logic";

export const TEXT: Record<
  Lang,
  {
    leave: string;
    time: string;
    doorOpen: string;
    walk: string;
    far: string;
    rooms: [string, string, string, string];
    colors: Record<LanternColor, string>;
    names: Record<FurnitureName, string>;
    hint: [string, string, string, string];
    intro: [string, string, string, string];
    done: [string, string, string, string];
    wrong: string;
    empty: string;
    ctl: string;
    ctlTouch: string;
  }
> = {
  en: {
    leave: "Leave",
    time: "Time",
    doorOpen: "The door is open. Go through it.",
    walk: "Walk close to the glow.",
    far: "Too far. Walk closer.",
    rooms: ["Pocomon's room", "Ngesomon's room", "Sundemon's room", "Kuntimon's room"],
    colors: { red: "red", blue: "blue", gold: "gold", green: "green" },
    names: { wardrobe: "wardrobe", shelf: "bookshelf", trunk: "trunk", mirror: "mirror", table: "table" },
    hint: ["Hidden glows found", "Lanterns lit", "Petals followed", "Secrets heard"],
    intro: [
      "Five things are hidden in here. Find them. Don't make it weird.",
      "Quick, the lanterns. Light them in this order: {o}. I have rounds.",
      "Follow the petals. No hurry... the door will wait.",
      "Psst. Three things in here are whispering: the wardrobe, the bookshelf, the trunk. Go listen!",
    ],
    done: [
      "Five. Fine. Go through the door.",
      "Good. Warm in here now. Next door, go.",
      "You followed all the way. Thank you.",
      "Ooh, secrets! You didn't hear them from me.",
    ],
    wrong: "Wrong order. They all went out. Start over, I'll wait. Briefly.",
    empty: "Nothing. Just dust. Try another!",
    ctl: "Move: WASD / arrows. Look: drag. Act: Space or tap.",
    ctlTouch: "Left thumb moves, drag the right side to look, tap to act.",
  },
  id: {
    leave: "Pergi",
    time: "Waktu",
    doorOpen: "Pintunya terbuka. Lewat sana.",
    walk: "Dekati cahayanya.",
    far: "Kejauhan. Dekati dulu.",
    rooms: ["Kamar Pocomon", "Kamar Ngesomon", "Kamar Sundemon", "Kamar Kuntimon"],
    colors: { red: "merah", blue: "biru", gold: "emas", green: "hijau" },
    names: { wardrobe: "lemari", shelf: "rak buku", trunk: "peti", mirror: "cermin", table: "meja" },
    hint: ["Cahaya tersembunyi ketemu", "Lentera menyala", "Kelopak diikuti", "Rahasia terdengar"],
    intro: [
      "Ada lima benda tersembunyi di sini. Cari. Jangan dibikin aneh.",
      "Cepat, lenteranya. Nyalakan urutan ini: {o}. Aku masih harus keliling.",
      "Ikuti kelopaknya. Nggak usah buru-buru... pintunya bakal menunggu.",
      "Psst. Ada tiga benda di sini yang berbisik: lemari, rak buku, peti. Dengerin sana!",
    ],
    done: [
      "Lima. Oke. Lewat pintu sana.",
      "Bagus. Hangat sekarang. Pintu berikutnya, sana.",
      "Kamu ikuti sampai akhir. Terima kasih.",
      "Wah, rahasia! Kamu nggak dengar dari aku ya.",
    ],
    wrong: "Urutannya salah, padam semua. Ulang ya, aku tunggu. Sebentar.",
    empty: "Kosong. Cuma debu. Coba yang lain!",
    ctl: "Jalan: WASD / panah. Lihat: geser. Aksi: Spasi atau ketuk.",
    ctlTouch: "Jempol kiri untuk jalan, geser sisi kanan untuk melihat, ketuk untuk beraksi.",
  },
};

export const LCOL: Record<LanternColor, number> = {
  red: 0xff5a5a,
  blue: 0x5aa0ff,
  gold: 0xffd24a,
  green: 0x5aff9a,
};
