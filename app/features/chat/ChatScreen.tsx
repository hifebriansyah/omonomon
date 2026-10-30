// /:slug/ (a ghost on stage) and /:slug/history/ (her chat history). Port of assets/scripts/stage.js, chat.js and viewport.js.
import { ArrowLeft, History, X } from "lucide-react";
import { type CSSProperties, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";
import { Avatar } from "~/components/Avatar";
import { useHydrated } from "~/components/ClientOnly";
import { Icon } from "~/components/Icon";
import { levelOf, useProgress } from "~/features/games/progress";
import { canUse3D } from "~/features/three/kit";
import { is3dEnabled } from "~/features/three/prefs3d";
import { ThreeBoundary } from "~/features/three/ThreeBoundary";
import { asset } from "~/lib/asset";
import { config } from "~/lib/config";
import type { Character } from "~/lib/content";
import { characterSeo } from "~/lib/head";
import { localize, useLang } from "~/lib/lang";
import type { ChatMessage } from "~/lib/storage";
import { dayKey, dayLabel, timeFormat } from "~/lib/time";
import { pick } from "~/lib/util";
import { asChat, selectCharacter, sendMessage, startChat, useChat } from "./chat-store";
import "./chat.css";
import { Composer } from "./Composer";
import { saveMode } from "./history-store";

const LazyBackdrop = lazy(() => import("~/features/three/ChatBackdrop"));

const MOOD_LEVEL = 4;
const moodPick: Record<string, string> = {};
const FONT_STEPS = [1.15, 1.05, 0.96, 0.88, 0.8, 0.74]; // rem
const LONG_REPLY_CHARS = 90;
const LONG_REPLY_STEP = 2; // 0.96rem

export function ChatScreen({
  character,
  seed,
  initialHistoryOpen,
}: {
  character: Character;
  /** Stories: initial messages instead of reading localStorage. */
  seed?: ChatMessage[];
  /** Stories: start with the history overlay open. */
  initialHistoryOpen?: boolean;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const hydrated = useHydrated();
  const location = useLocation();
  const navigate = useNavigate();
  const progress = useProgress();
  const chatChar = asChat(character);

  const routeHistory = /\/history\/?$/.test(location.pathname);
  const historyOpen = initialHistoryOpen ?? routeHistory;

  const { logs, pending, trouble, startError } = useChat();
  const log = useMemo(() => logs[character.id] || [], [logs, character.id]);
  const isPending = (pending[character.id] || 0) > 0;

  const stageRef = useRef<HTMLElement>(null);
  const bubbleTextRef = useRef<HTMLParagraphElement>(null);
  const historyRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevBotCountRef = useRef<number>(0);

  const [typedText, setTypedText] = useState<string>("");
  const [heroAnim, setHeroAnim] = useState<"" | "swap" | "talk">("");
  const [srText, setSrText] = useState<string>("");
  const [mood, setMood] = useState<string | null>(null);

  const lastBot = [...log].reverse().find((m) => m.who === "bot");
  const lastUser = [...log].reverse().find((m) => m.who === "user");
  const fullBubbleText = startError || lastBot?.text || "";

  // Fit the bubble font size so long text shrinks before scrolling.
  const fitBubble = (text: string) => {
    const el = bubbleTextRef.current;
    const stageEl = stageRef.current;
    if (!el || !stageEl) return;
    document.documentElement.style.setProperty("--bubble-max", `${Math.round(stageEl.clientHeight * 0.23)}px`);
    if (!text) return;
    const current = el.textContent;
    el.textContent = text;
    const first = text.length >= LONG_REPLY_CHARS ? LONG_REPLY_STEP : 0;
    for (const size of FONT_STEPS.slice(first)) {
      el.style.fontSize = `${size}rem`;
      if (el.scrollHeight <= el.clientHeight + 1) break;
    }
    el.textContent = current;
  };

  // Start the chat engine and put this character on stage.
  useEffect(() => {
    let alive = true;
    prevBotCountRef.current = 0;
    setHeroAnim("swap");
    const moods = chatChar.moods?.[lang] || chatChar.moods?.en;
    if (moods?.length && levelOf(progress.bond[character.id] || 0) >= MOOD_LEVEL) {
      moodPick[character.id] ||= pick(moods);
      setMood(moodPick[character.id]);
    } else {
      setMood(null);
    }

    (async () => {
      if (seed) {
        selectCharacter(chatChar, seed);
        return;
      }
      const ok = await startChat(lang);
      if (!alive || !ok) return;
      selectCharacter(chatChar);
    })();

    if (matchMedia("(hover: hover) and (pointer: fine)").matches && !navigator.maxTouchPoints) {
      inputRef.current?.focus();
    }
    return () => {
      alive = false;
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id, lang]);

  // Remember whether the visitor left the chat in history view or on stage.
  useEffect(() => {
    if (!hydrated || seed) return;
    saveMode(character.id, historyOpen);
  }, [character.id, historyOpen, hydrated, seed]);

  // Keep --app-h and --bubble-max in sync with the visible viewport when the mobile keyboard opens.
  useEffect(() => {
    const vv = window.visualViewport;
    let height = 0;
    let queued = false;
    const fit = () => {
      queued = false;
      if (vv && vv.scale > 1.01) return;
      const h = Math.round(vv ? vv.height : window.innerHeight);
      if (window.scrollY || (vv && vv.offsetTop)) window.scrollTo(0, 0);
      if (h === height) return;
      const shrank = h < height;
      height = h;
      document.documentElement.style.setProperty("--app-h", `${h}px`);
      if (stageRef.current) {
        document.documentElement.style.setProperty("--bubble-max", `${Math.round(stageRef.current.clientHeight * 0.23)}px`);
      }
      if (shrank && document.activeElement === inputRef.current && historyRef.current) {
        historyRef.current.scrollTop = historyRef.current.scrollHeight;
      }
    };
    const queue = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(fit);
      }
    };
    if (vv) {
      vv.addEventListener("resize", queue);
      vv.addEventListener("scroll", queue);
    } else {
      window.addEventListener("resize", queue);
    }
    fit();
    return () => {
      if (vv) {
        vv.removeEventListener("resize", queue);
        vv.removeEventListener("scroll", queue);
      } else {
        window.removeEventListener("resize", queue);
      }
    };
  }, []);

  // Type out the bot's reply (or show immediately when restoring a saved chat or when reduced motion is on).
  useEffect(() => {
    if (typeTimerRef.current) {
      clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }
    if (!fullBubbleText) {
      setTypedText("");
      return;
    }
    setSrText(fullBubbleText);
    const botCount = log.filter((m) => m.who === "bot").length;
    const isFreshGreeting = log.length === 1 && Boolean(log[0]?.g) && prevBotCountRef.current === 0;
    const isNewReply = prevBotCountRef.current > 0 && botCount > prevBotCountRef.current;
    prevBotCountRef.current = botCount;

    if (isNewReply) {
      setHeroAnim("");
      requestAnimationFrame(() => setHeroAnim("talk"));
    }

    const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || (!isFreshGreeting && !isNewReply)) {
      setTypedText(fullBubbleText);
      return;
    }

    setTypedText("");
    let i = 0;
    typeTimerRef.current = setInterval(() => {
      i = Math.min(fullBubbleText.length, i + 2);
      setTypedText(fullBubbleText.slice(0, i));
      if (i >= fullBubbleText.length && typeTimerRef.current) {
        clearInterval(typeTimerRef.current);
        typeTimerRef.current = null;
      }
    }, 22);
  }, [fullBubbleText, log]);

  useLayoutEffect(() => {
    if (hydrated && !isPending && fullBubbleText) fitBubble(fullBubbleText);
  }, [hydrated, isPending, fullBubbleText]);

  // Keep history scrolled to the newest message when opened or when a message arrives.
  useEffect(() => {
    if (historyOpen && historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [historyOpen, log.length]);

  const skipTyping = () => {
    if (typeTimerRef.current) {
      clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
      setTypedText(fullBubbleText);
    }
  };

  const statusText = trouble || mood || (lang === "id" && character.statusId) || character.status;
  const seo = characterSeo(character, lang);
  const stagePath = localize(`/${character.slug}/`, lang);
  const historyPath = `${stagePath}history/`;
  const profilePath = `${stagePath}profile/`;
  const homePath = localize("/", lang);

  const show3d = hydrated && canUse3D() && is3dEnabled() && !progress.equipped.stage;

  const historyItems = useMemo(() => {
    const chatStart = log.find((m) => m.t != null)?.t ?? null;
    let lastBotIdx = -1;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].who === "bot") {
        lastBotIdx = i;
        break;
      }
    }
    let lastDay: string | null = null;
    return log.map((m, i) => {
      const stamp = hydrated ? (m.t ?? (m.g ? chatStart : null)) : null;
      let dayHeader: string | null = null;
      if (stamp != null && dayKey(stamp) !== lastDay) {
        lastDay = dayKey(stamp);
        dayHeader = dayLabel(stamp, lang);
      }
      return { m, i, dayHeader, isBot: m.who === "bot", showHead: i === lastBotIdx };
    });
  }, [log, hydrated, lang]);

  return (
    <main
      style={{ "--accent": character.accent } as CSSProperties}
      className="chat-page mx-auto flex h-[var(--app-h,100dvh)] w-full max-w-page flex-col gap-2.5 p-3"
    >
      <header className="flex items-center gap-1.5">
        <Link
          to={homePath}
          aria-label={t("backChats")}
          title={t("backChats")}
          className="grid h-10 w-9 flex-none place-items-center rounded-xl text-text no-underline hover:bg-white/8"
        >
          <Icon as={ArrowLeft} strokeWidth={2.4} className="size-[1.6em]" />
        </Link>
        <Link to={profilePath} className="flex min-w-0 flex-1 items-center gap-1.5 text-inherit no-underline">
          <Avatar character={character} frame className="size-11" />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-[1.05rem] leading-[1.2]">{character.name}</h1>
            <p className="m-0 truncate text-[0.78rem] text-muted">{statusText}</p>
          </div>
        </Link>
        <button
          type="button"
          aria-expanded={historyOpen}
          aria-controls="history"
          aria-label={t(historyOpen ? "historyClose" : "historyShow")}
          title={t(historyOpen ? "historyClose" : "historyShow")}
          onClick={() => navigate(historyOpen ? stagePath : historyPath)}
          className="grid size-11 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-ink hover:brightness-110"
        >
          <span className="grid size-11 place-items-center rounded-full bg-[var(--accent)] text-[1.1rem] text-ink">
            <Icon as={historyOpen ? X : History} strokeWidth={2.4} className="size-[1.2em]" />
          </span>
        </button>
      </header>

      <section
        ref={stageRef}
        data-stage-look
        className={`chat-stage relative flex min-h-0 flex-1 flex-col items-center justify-end overflow-hidden rounded-[20px] border-4 border-ink p-3.5 ${show3d ? "has-3d" : ""}`}
      >
        {show3d && (
          <div className="chat-3d pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
            <ThreeBoundary fallback={null}>
              <Suspense fallback={null}>
                <LazyBackdrop character={character} stageRef={stageRef} />
              </Suspense>
            </ThreeBoundary>
          </div>
        )}

        <p className="sr-only">{seo.description}</p>
        <div className="sr-only" aria-live="polite">
          {srText}
        </div>

        <div
          aria-hidden="true"
          onClick={skipTyping}
          className={`chat-bubble relative mb-[26px] max-w-[94%] flex-none border-[3px] border-ink bg-[var(--bubble-bg,#fff)] px-[18px] py-3.5 text-center font-comic text-[1.15rem] leading-[1.35] text-[var(--bubble-ink,#14151a)] shadow-[5px_5px_0_#14151a] ${isPending ? "cursor-default" : "cursor-pointer"}`}
        >
          <p ref={bubbleTextRef} className="chat-bubble-text m-0 overflow-y-auto [overflow-wrap:anywhere] [scrollbar-width:thin]">
            {isPending ? (
              <span className="chat-dots inline-flex">
                <i className="mx-1 inline-block size-[11px] rounded-full bg-ink" />
                <i className="mx-1 inline-block size-[11px] rounded-full bg-ink" />
                <i className="mx-1 inline-block size-[11px] rounded-full bg-ink" />
              </span>
            ) : (
              typedText
            )}
          </p>
        </div>

        <img
          src={asset(character.stage)}
          alt={character.name}
          className={`chat-hero w-auto max-w-full flex-none object-contain select-none ${hydrated ? `live ${heroAnim}` : ""}`}
        />

        <div className="flex h-[var(--you-slot,50px)] w-full flex-none items-start justify-end pt-1.5">
          {lastUser && (
            <div
              title={lastUser.text}
              className="chat-bubble you relative mr-1 max-w-[88%] min-w-24 flex-none cursor-default border-[3px] border-ink bg-[var(--accent)] px-3.5 py-2 text-center font-comic text-[0.92rem] leading-[1.35] text-ink shadow-[3px_3px_0_#14151a]"
            >
              <p className="m-0 truncate">{lastUser.text}</p>
            </div>
          )}
        </div>

        <aside id="history" ref={historyRef} hidden={!historyOpen} className="chat-history absolute inset-0 z-5 overflow-y-auto p-3 text-text">
          <div className="flex flex-col gap-2.5">
            {historyItems.map(({ m, i, dayHeader, isBot, showHead }) => (
              <div key={i} className="contents">
                {dayHeader && (
                  <div className="mt-1 self-center rounded-lg bg-white/78 px-3 py-[3px] text-[0.72rem] text-ink/72 shadow-[0_1px_1px_rgba(20,21,26,0.15)]">
                    {dayHeader}
                  </div>
                )}
                <div className={`flex max-w-[90%] items-end gap-2 ${isBot ? "self-start" : "self-end"}`}>
                  {isBot && (
                    <img
                      src={asset(character.head)}
                      alt=""
                      className={`size-7 flex-none object-contain ${showHead ? "" : "invisible"}`}
                    />
                  )}
                  <div
                    className={`flow-root rounded-[14px] px-[13px] py-[9px] text-[0.92rem] leading-[1.4] [overflow-wrap:anywhere] ${
                      isBot ? "rounded-bl-[4px] bg-[#2f343f]" : "rounded-br-[4px] bg-[#4a5568]"
                    }`}
                  >
                    <span>{m.text}</span>
                    {hydrated && m.t != null && (
                      <time dateTime={new Date(m.t).toISOString()} className="float-right mt-[7px] -mb-[3px] ml-3 text-[0.66rem] leading-none opacity-60 select-none">
                        {timeFormat(lang).format(m.t)}
                      </time>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <Composer
        inputRef={inputRef}
        placeholder={t("sayTo", { name: character.name })}
        sendLabel={t("sendWord")}
        max={config.INPUT_MAX_CHARS}
        onSend={(text) => sendMessage(chatChar, text)}
      />
    </main>
  );
}
