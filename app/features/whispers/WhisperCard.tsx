// One whisper in the feed (or opened on its own, `single`): her picture and name (to her profile), the time, the words (a sticky
// note, or the text above the card of what she found), and the heart, comments and share buttons. On its own page the comments
// are open from the start. Browser only (loves and comments read this browser's storage): drawn once the feed has loaded.
import { ArrowLeft, Heart, MessageCircle } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";
import { Icon } from "~/components/Icon";
import type { Character } from "~/lib/content";
import { asset } from "~/lib/asset";
import { localize, useLang } from "~/lib/lang";
import { chatTime } from "~/lib/time";
import { CommentPanel } from "./CommentPanel";
import { LinkCard, hasCard } from "./LinkCard";
import { ShareButton, whisperShareUrl } from "./ShareButton";
import { WhisperNote } from "./WhisperNote";
import type { Whisper } from "./types";
import { useLove } from "./useLove";
import "./whispers.css";

export const actionClass = "inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent px-0 py-1 font-[inherit] text-[0.8rem]";

// The back arrow of a whisper opened on its own, in the row with the avatar. Like AppBar's: back in history when the visitor came
// from another page of this site, otherwise to `to`.
function BackArrow({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  const cameFromHere = useLocation().key !== "default";
  return (
    <Link
      to={to}
      title={label}
      aria-label={label}
      onClick={(e) => {
        if (!cameFromHere) return;
        e.preventDefault();
        navigate(-1);
      }}
      className="-mr-1 -ml-1.5 grid h-10 w-9 flex-none place-items-center rounded-xl text-text no-underline hover:bg-white/8"
    >
      <Icon as={ArrowLeft} className="size-[1.6em]" />
    </Link>
  );
}

export function LoveButton({ pressed, count, label, onClick }: { pressed: boolean; count?: number; label: string; onClick: () => void }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={onClick} className={`w-love ${actionClass} ${pressed ? "text-bad" : "text-muted hover:text-bad"}`}>
      <Icon as={Heart} className="size-[1.3em]" />
      {count !== undefined && <span className="text-muted">{count}</span>}
    </button>
  );
}

export function WhisperCard({ w, ghost, single = false }: { w: Whisper; ghost: Character; single?: boolean }) {
  const { t } = useTranslation();
  const lang = useLang();
  const love = useLove(w);
  const [comments, setComments] = useState(w.comments || 0);
  const [open, setOpen] = useState(single);
  const [opened, setOpened] = useState(single); // the panel is made on the first open and kept (so its comments stay loaded)
  const [focusKey, setFocusKey] = useState(0);
  const profile = localize(`/${ghost.slug}/profile/`, lang);
  const own = localize(`/whispers/?n=${w.n}`, lang); // the whisper's own page
  const words = (lang === "id" && w.text.id) || w.text.en;
  const time = (
    <time dateTime={new Date(w.t).toISOString()} className="block text-xs text-muted">
      {chatTime(w.t, lang)}
    </time>
  );

  return (
    <li className="border-b border-line px-1 py-3.5" style={{ "--c": ghost.accent } as CSSProperties}>
      <div className="flex items-center gap-3">
        {single && (
          // opened on its own: a back button right before the avatar, to the list of all whispers (back in history when the
          // visitor came from the feed or a profile, so that page comes back with its scroll)
          <BackArrow to={localize("/whispers/", lang)} label={t("allWhispers")} />
        )}
        {/* her picture and name open her profile page (the whisper's own page opens from its text) */}
        <Link to={profile} aria-label={ghost.name} className="block flex-none leading-none">
          <img src={asset(ghost.image)} alt="" className="size-[46px] rounded-full border-2 border-[var(--c)] bg-paper object-contain" />
        </Link>
        <div className="flex min-w-0 flex-col">
          <Link to={profile} className="flex min-w-0 flex-col text-inherit no-underline">
            <strong className="block">{ghost.name}</strong>
            {time}
          </Link>
        </div>
      </div>
      {hasCard(w.link) ? (
        <>
          <p className="mt-2.5 mb-1.5 font-comic leading-[1.45] text-[#e8ebf2] [overflow-wrap:anywhere]">
            {single ? (
              words
            ) : (
              <Link to={own} className="text-inherit no-underline">
                {words}
              </Link>
            )}
          </p>
          <LinkCard link={w.link} />
        </>
      ) : (
        // a plain thought: a sticky note (in the feed it opens that whisper's own page)
        <WhisperNote n={w.n} text={words} to={single ? undefined : own} ghost={ghost} />
      )}
      <div className="flex items-center gap-4">
        <LoveButton pressed={love.loved} count={love.count} label={t("loveWord")} onClick={love.toggle} />
        <button
          type="button"
          aria-expanded={open}
          title={t("commentWord")} // no visible label: the icon and the count say it; the name is for screen readers
          aria-label={t("commentWord")}
          onClick={() => {
            setOpen(!open);
            if (!open) {
              setOpened(true);
              setFocusKey((k) => k + 1);
            }
          }}
          className={`${actionClass} text-muted hover:text-text`}
        >
          <Icon as={MessageCircle} className="size-[1.3em]" />
          <span>{comments}</span>
        </button>
        <ShareButton url={whisperShareUrl(w.n, ghost.slug, lang)} />
      </div>
      {opened && (
        <div hidden={!open}>
          <CommentPanel n={w.n} ghost={ghost} focusKey={focusKey} onCount={(d) => setComments((c) => Math.max(0, c + d))} />
        </div>
      )}
    </li>
  );
}
