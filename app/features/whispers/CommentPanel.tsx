// One whisper's comments: a flat list (the ghost's own picture, or the visitor's initial), the box to write one, and who you are
// commenting as. Visitors comment without signing in; the ghost answers in her own voice (Gemini, on the API Worker).
// Browser only (it reads the nickname, the device id and this browser's own comments): it is drawn once a whisper is on screen.
import { SendHorizontal } from "lucide-react";
import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { type Character, characterById } from "~/lib/content";
import { asset } from "~/lib/asset";
import { useLang, localize } from "~/lib/lang";
import { chatTime } from "~/lib/time";
import { recordSocial } from "~/features/games/progress";
import { useWhispersApi } from "./api";
import { deviceId, forgetComment, myComments, nickname, rememberComment } from "./identity";
import { useBadgeToast } from "./badge-toast";
import type { WhisperComment } from "./types";

const PENDING = -1; // the number of a comment still on its way

function CommentItem({ c, whisperGhost, mine, onDelete }: { c: WhisperComment; whisperGhost: Character; mine: boolean; onDelete?: () => Promise<void> }) {
  const { t } = useTranslation();
  const lang = useLang();
  const [deleting, setDeleting] = useState(false);
  const ghost = (c.kind === "ghost" && characterById(c.ghost ?? undefined)) || whisperGhost; // another ghost's comment shows her own picture and name
  return (
    <li className={`relative flex gap-2 pr-[22px] ${c.n === PENDING ? "opacity-60" : ""}`} style={{ "--c": ghost.accent } as CSSProperties}>
      {c.kind === "ghost" ? (
        <img src={asset(ghost.image)} alt="" className="size-[26px] flex-none rounded-full border-2 border-[var(--c)] bg-paper object-contain" />
      ) : (
        <span className="grid size-[26px] flex-none place-items-center rounded-full border-2 border-transparent bg-edge text-xs font-bold text-text">{[...(c.author || "")][0]?.toUpperCase() || "?"}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 text-[0.8rem]">
          <strong>{c.kind === "ghost" ? ghost.name : c.author}</strong>
          {c.kind === "ghost" && <span className="rounded-lg bg-[var(--c)] px-1.5 text-[0.65rem] text-ink">{t("commentGhost")}</span>}
          <time dateTime={new Date(c.t).toISOString()} className="ml-auto text-[0.7rem] text-muted">
            {chatTime(c.t, lang)}
          </time>
        </div>
        <p className={`mt-0.5 mb-0 text-[0.9rem] leading-[1.4] [overflow-wrap:anywhere] ${c.deleted ? "text-muted italic" : ""}`}>
          {c.deleted ? t("commentDeleted") : (lang === "id" && c.bodyId) || c.body}
        </p>
      </div>
      {c.kind === "user" && !c.deleted && mine && onDelete && (
        <button
          type="button"
          title={t("commentDelete")}
          aria-label={t("commentDelete")}
          disabled={deleting}
          onClick={async () => {
            setDeleting(true);
            await onDelete().finally(() => setDeleting(false));
          }}
          className="absolute top-0 right-0 size-[22px] cursor-pointer rounded-full border-0 bg-transparent text-base leading-none text-muted hover:bg-white/10 hover:text-text"
        >
          ×
        </button>
      )}
    </li>
  );
}

/**
 * The comments of whisper `n` by `ghost`. `onCount(delta)` keeps the count on the comment button in step. With `focusKey` above 0,
 * the box gets the focus once the comments are loaded (a new value focuses it again).
 */
export function CommentPanel({ n, ghost, onCount, focusKey = 0 }: { n: number; ghost: Character; onCount: (delta: number) => void; focusKey?: number }) {
  const { t } = useTranslation();
  const lang = useLang();
  const api = useWhispersApi();
  const badgeToast = useBadgeToast();
  const [comments, setComments] = useState<WhisperComment[] | null>(null); // null: not loaded yet
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [nick, setNick] = useState(nickname);
  const [mine, setMine] = useState(myComments);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    api
      .request(`/whispers/${n}/comments`)
      .then(({ status: code, data }) => {
        if (!live) return;
        if (code !== 200) return setStatus(t("commentLoadError"));
        setStatus("");
        setComments(data.comments as WhisperComment[]);
      })
      .catch(() => live && setStatus(t("commentLoadError")));
    return () => {
      live = false;
    };
  }, [api, n, t]);

  const loaded = comments !== null;
  useEffect(() => {
    if (loaded && focusKey > 0) input.current?.focus();
  }, [loaded, focusKey]);

  async function remove(c: WhisperComment) {
    const { status: code } = await api.request(`/comments/${c.n}`, { method: "DELETE", body: { device: deviceId() } }).catch(() => ({ status: 0 }));
    if (code !== 200) return;
    forgetComment(c.n);
    // the comment stays in the list, now saying "deleted" (the server keeps the row and no longer sends the text)
    setComments((list) => list && list.map((x) => (x.n === c.n ? { ...x, deleted: true } : x)));
    onCount(-1);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const said = text.trim();
    if (!said) return;
    // The visitor's comment goes on the page at once; the ghost's answer follows when it arrives. If the comment is refused or
    // cannot be sent, it is taken off again and the text goes back into the box.
    const author = nickname();
    setSending(true);
    setText("");
    setNick(author);
    const pending: WhisperComment = { n: PENDING, kind: "user", author, t: Date.now(), body: said };
    setComments((list) => [...(list || []), pending]);
    onCount(1);
    setStatus(t("commentThinking", { name: ghost.name }));
    const takeBack = (message: string) => {
      setComments((list) => (list || []).filter((x) => x !== pending));
      onCount(-1);
      setText(said);
      setStatus(message);
    };
    try {
      const { status: code, data } = await api.request(`/whispers/${n}/comments`, { method: "POST", body: { text: said, nickname: author, device: deviceId() } });
      if (code === 200) {
        rememberComment(data.comment.n);
        badgeToast(recordSocial("comments"));
        setMine((s) => new Set(s).add(data.comment.n));
        setComments((list) => [...(list || []).map((x) => (x === pending ? (data.comment as WhisperComment) : x)), data.reply as WhisperComment]);
        onCount(1); // the ghost's reply counts too
        setStatus("");
      } else if (code === 422) {
        takeBack(data.care ? t("commentCare") : t("commentRefused"));
      } else if (code === 429) {
        takeBack(t("commentLimit"));
      } else if (code === 503) {
        takeBack(t("commentLater"));
      } else {
        takeBack(t("commentError"));
      }
    } catch {
      takeBack(t("commentError"));
    } finally {
      setSending(false);
    }
  }

  const placeholder = t("commentPlaceholder", { name: ghost.name });
  return (
    <div className="mt-2 border-t border-dashed border-edge pt-2" style={{ "--c": ghost.accent } as CSSProperties}>
      <ul className="mt-0 mb-2 grid list-none gap-2 p-0">
        {comments && comments.length === 0 && <li className="text-[0.85rem] text-muted italic">{t("commentNone")}</li>}
        {comments?.map((c) => (
          <CommentItem key={c.n} c={c} whisperGhost={ghost} mine={mine.has(c.n)} onDelete={() => remove(c)} />
        ))}
      </ul>
      <p className="mt-0 mb-1.5 min-h-[1.1em] text-[0.8rem] text-muted" aria-live="polite">
        {status}
      </p>
      <form className="flex gap-1.5" autoComplete="off" onSubmit={submit}>
        <input
          ref={input}
          type="text"
          maxLength={200}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 rounded-[18px] border border-edge bg-ink px-3 py-[7px] font-[inherit] text-[0.9rem] text-text focus:outline-2 focus:outline-offset-1 focus:outline-[var(--c)]"
        />
        <button
          type="submit"
          disabled={sending}
          title={t("commentSend")} // icon only: the name is for screen readers and the tooltip
          aria-label={t("commentSend")}
          onPointerDown={(e) => e.preventDefault()} // sending keeps the keyboard open
          onMouseDown={(e) => e.preventDefault()}
          className="grid size-9 flex-none cursor-pointer place-items-center rounded-full border-0 bg-[var(--c)] p-0 text-ink disabled:cursor-default disabled:opacity-60"
        >
          <SendHorizontal aria-hidden="true" strokeWidth={2.2} className="ml-0.5 size-[1.15rem]" />
        </button>
      </form>
      <p className="mt-1.5 mb-0 text-xs text-muted">
        {t("commentAs")} <strong>{nick}</strong> · <Link to={localize("/me/", lang)} className="text-muted">{t("commentChange")}</Link>
      </p>
    </div>
  );
}
