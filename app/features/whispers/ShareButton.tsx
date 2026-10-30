// The share button under a whisper (url: that whisper's page): the phone's share sheet where there is one, otherwise the link is
// copied (the word "Copied" shows beside the icon for a moment). text is optional: with none, only the link is shared (the link
// preview already carries the words).
import { Share } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "~/components/Icon";
import type { Lang } from "~/lib/content";

/**
 * The address a shared whisper links to. It must stay /whispers/<ghost-slug>/?n=<id>, at the site root and without /id/:
 * worker/edge.js sits on /whispers* and rewrites the link preview of that address. &lang=en asks it for the English words
 * (its default is Indonesian).
 */
export function whisperShareUrl(n: number, slug: string | undefined, lang: Lang, origin = typeof location === "undefined" ? "" : location.origin) {
  return `${origin}${import.meta.env.BASE_URL}whispers/${slug ? `${slug}/` : ""}?n=${n}${lang === "en" ? "&lang=en" : ""}`;
}

export function ShareButton({ url, text = "" }: { url: string; text?: string }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share(text ? { text, url } : { url });
        return;
      }
      await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
      setNote(t("copiedWord"));
      setTimeout(() => setNote(""), 1800);
    } catch {} // the visitor closed the share sheet, or copying is not allowed: nothing to do
  }
  return (
    <button type="button" onClick={share} title={t("shareWord")} aria-label={t("shareWord")} className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent px-0 py-1 text-[0.8rem] text-muted hover:text-text">
      <Icon as={Share} className="size-[1.3em]" />
      <span className="text-muted">{note}</span>
    </button>
  );
}
