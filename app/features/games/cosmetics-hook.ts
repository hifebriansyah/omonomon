// Puts the worn looks on <html> (data-stage, data-bubble, data-frame, data-ghost-stage, data-tod) after hydration, on every
// page change and whenever the progress changes (a purchase, a bond level). Used once, by routes/_app.tsx.
// The ghost on stage comes from the address: on her chat (/<slug>/ or /<slug>/history/) her own stage look can show.
import { useEffect } from "react";
import { useLocation } from "react-router";
import { characterBySlug } from "~/lib/content";
import { stripLang } from "~/lib/lang";
import { applyCosmetics } from "./cosmetics";
import { useProgress } from "./progress";

export function stageCharOf(pathname: string): string {
  const m = /^\/([^/]+)\/(?:history\/)?$/.exec(stripLang(pathname));
  return (m && characterBySlug(m[1])?.id) || "";
}

export function useCosmetics() {
  const { pathname } = useLocation();
  const progress = useProgress();
  const charId = stageCharOf(pathname);
  useEffect(() => applyCosmetics(charId), [charId, progress]);
}
