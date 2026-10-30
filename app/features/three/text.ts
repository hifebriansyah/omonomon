// Words of the 3D scenes that are not in app/i18n (kept here, as the old three/room.js kept them).
import type { Lang } from "~/lib/content";

const TEXT = {
  en: { roomHint: "Drag to look around" },
  id: { roomHint: "Geser untuk melihat sekeliling" },
};

export const text3d = (lang: Lang) => TEXT[lang] || TEXT.en;
