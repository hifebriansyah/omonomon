// The card under a whisper for what the ghost found: its picture, title and where it is from. It opens the original in a new tab.
// Only https addresses are used, whatever the server sent.
import { useState } from "react";
import type { WhisperLink } from "./types";

const https = (u: unknown): u is string => typeof u === "string" && /^https:\/\//.test(u);
// An Instagram reel (instagram.com/reel/<id>, /reels/<id> or its /embed/ page): its card opens the reel itself (the plain address,
// without tracking parameters; on a phone with the Instagram app it opens the app) and shows a play button on its cover.
const reelId = (url: string) => /^https:\/\/www\.instagram\.com\/reels?\/([\w-]{5,20})\/?(?:embed\/?)?(?:[?#]|$)/.exec(url)?.[1] || null;

/** Whether a whisper's link gets a card (otherwise the whisper is a plain thought, drawn as a sticky note). */
export const hasCard = (link: WhisperLink | null | undefined): link is WhisperLink => Boolean(link && https(link.url));

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function LinkCard({ link }: { link: WhisperLink | null | undefined }) {
  const [broken, setBroken] = useState(false); // a picture that is gone leaves just the title
  if (!hasCard(link)) return null;
  const reel = reelId(link.url);
  const img =
    https(link.thumb) && !broken ? (
      // some sites refuse pictures that come with another site's address
      <img src={link.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="block aspect-[auto_1/1] max-h-[560px] w-full bg-line object-cover" />
    ) : null;
  return (
    <a
      href={reel ? `https://www.instagram.com/reel/${reel}/` : link.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-1.5 mb-2 flex flex-col overflow-hidden rounded-xl border border-[#2f333d] bg-row text-inherit no-underline hover:border-[var(--c,var(--accent))]"
    >
      {reel ? (
        // a reel without a cover still gets its play button, on a plain panel
        <span className={`relative block ${img ? "" : "aspect-[4/3] bg-line"}`}>
          {img}
          <span className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
            <span className="grid size-14 place-items-center rounded-full bg-[var(--c,var(--accent))] pl-1 text-[1.3rem] text-[#14161c] shadow-[0_2px_10px_rgba(0,0,0,0.45)]">{"▶"}</span>
          </span>
        </span>
      ) : (
        img
      )}
      <span className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
        <strong className="line-clamp-2 text-[0.9rem] leading-[1.3] [overflow-wrap:anywhere]">{String(link.title || link.url)}</strong>
        <small className="text-xs text-muted">{String(link.source || hostOf(link.url))}</small>
      </span>
    </a>
  );
}
