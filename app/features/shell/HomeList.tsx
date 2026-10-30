// The chat list (/ and /id/, was assets/scripts/shell/home.js): like WhatsApp, each ghost shows the latest message of your saved
// chat and its time, the newest chat first. A ghost you have not talked to yet shows her greeting and stays below the chats, in the
// usual order. The ... button on each row clears that chat.
import { MoreVertical, Trash2 } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AppBar } from "~/components/AppBar";
import { Avatar } from "~/components/Avatar";
import { useHydrated } from "~/components/ClientOnly";
import { Icon } from "~/components/Icon";
import { Page } from "~/components/Page";
import { asChat } from "~/features/chat/chat-store";
import { firstSeen, loadLog, loadMode, removeLog, saveMode } from "~/features/chat/history-store";
import { type Character, characters, site } from "~/lib/content";
import { localize, useLang } from "~/lib/lang";
import { chatTime } from "~/lib/time";

interface RowView {
  character: Character;
  hasChat: boolean;
  lastTime: number;
  shownTime: number | null;
  preview: string;
  historyMode: boolean;
}

export function HomeList() {
  const { t } = useTranslation();
  const lang = useLang();
  const hydrated = useHydrated();
  const [tick, setTick] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setTick((n) => n + 1);
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuId]);

  const rows: RowView[] = characters.map((c) => {
    if (!hydrated) {
      return { character: c, hasChat: false, lastTime: -1, shownTime: null, preview: "", historyMode: false };
    }
    const log = loadLog(c.id) || [];
    const last = log[log.length - 1];
    const chatChar = asChat(c);
    const greeting = chatChar.greeting?.[lang] || chatChar.greeting?.en || "";
    const preview = last ? (last.who === "user" ? `${t("you")} ${last.text}` : last.text) : greeting;
    const shown = last ? (last.t ?? null) : firstSeen(c.id);
    return {
      character: c,
      hasChat: Boolean(last),
      lastTime: last ? (last.t ?? 0) : -1,
      shownTime: shown != null && Number.isFinite(shown) ? shown : null,
      preview,
      historyMode: loadMode(c.id) === "history",
    };
  });

  if (hydrated) {
    const order = new Map(characters.map((c, i) => [c.id, i]));
    rows.sort((a, b) => (b.hasChat ? b.lastTime : -1) - (a.hasChat ? a.lastTime : -1) || (order.get(a.character.id) ?? 0) - (order.get(b.character.id) ?? 0));
  }

  void tick;

  return (
    <Page tab="chats">
      <AppBar title={site.name} />
      <ul className="m-0 list-none p-0">
        {rows.map(({ character: c, hasChat, shownTime, preview, historyMode }) => {
          const to = localize(historyMode ? `/${c.slug}/history/` : `/${c.slug}/`, lang);
          const status = (lang === "id" && c.statusId) || c.status;
          const menuOpen = openMenuId === c.id;
          return (
            <li
              key={c.id}
              style={{ "--c": c.accent } as CSSProperties}
              className="relative flex items-center border-b border-line focus-within:bg-row hover:bg-row"
            >
              <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 px-1 py-2.5 text-inherit no-underline">
                <Avatar character={c} />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <strong className="text-[1.02rem]">{c.name}</strong>
                      <span className="text-[0.85rem] text-muted">{` ·  ${status}`}</span>
                    </span>
                    <time
                      dateTime={shownTime != null ? new Date(shownTime).toISOString() : undefined}
                      className="text-xs whitespace-nowrap text-muted"
                    >
                      {shownTime != null ? chatTime(shownTime, lang) : ""}
                    </time>
                  </span>
                  <span className="min-h-[1.35em] truncate text-[0.9rem] text-preview">{preview}</span>
                </span>
              </Link>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={t("moreOptions")}
                title={t("moreOptions")}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(menuOpen ? null : c.id);
                }}
                className={`ml-0.5 grid size-9 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent ${
                  menuOpen ? "bg-white/8 text-text" : "text-muted hover:bg-white/8 hover:text-text"
                }`}
              >
                <Icon as={MoreVertical} className="size-[1.5em]" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-[calc(50%+20px)] right-1.5 z-20 min-w-40 rounded-xl border border-menu-line bg-menu p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!hasChat}
                    onClick={() => {
                      setOpenMenuId(null);
                      if (!confirm(t("clearConfirm", { name: c.name }))) return;
                      removeLog(c.id);
                      saveMode(c.id, false);
                      setTick((n) => n + 1);
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-[9px] text-left font-[inherit] text-text enabled:hover:bg-white/8 disabled:cursor-default disabled:text-muted"
                  >
                    <Icon as={Trash2} className="size-[1.1em]" />
                    {t("clearChat")}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-[18px] mb-0 text-center text-xs">
        <Link to={localize("/privacy/", lang)} className="text-muted no-underline hover:underline">
          {t("mePrivacy")}
        </Link>
      </p>
    </Page>
  );
}
