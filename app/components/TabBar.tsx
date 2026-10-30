// The bottom navigation of the app pages: Chats, Whispers, Games, Me. The Whispers tab gets a dot when there is something new.
import { Gamepad2, MessageCircle, Wind, UserRound, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { localize } from "~/lib/lang";
import type { Lang } from "~/lib/content";
import { Icon } from "./Icon";

export type Tab = "chats" | "whispers" | "games" | "me";

const TABS: { key: Tab; path: string; label: "tabChats" | "tabWhispers" | "tabGames" | "tabMe"; icon: LucideIcon }[] = [
  { key: "chats", path: "/", label: "tabChats", icon: MessageCircle },
  { key: "whispers", path: "/whispers/", label: "tabWhispers", icon: Wind },
  { key: "games", path: "/games/", label: "tabGames", icon: Gamepad2 },
  { key: "me", path: "/me/", label: "tabMe", icon: UserRound },
];

export function TabBar({ active, lang, dot = false }: { active?: Tab; lang: Lang; dot?: boolean }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("mainNav")} className="fixed inset-x-0 bottom-0 z-10 border-t border-[#2f333d] bg-row pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-page">
        {TABS.map((tab) => {
          const current = tab.key === active;
          return (
            <Link
              key={tab.key}
              to={localize(tab.path, lang)}
              aria-current={current ? "page" : undefined}
              data-tab={tab.key}
              className={`relative grid flex-1 justify-items-center gap-0.5 px-1 pt-2 pb-[9px] text-[0.72rem] no-underline [-webkit-tap-highlight-color:transparent] hover:text-text ${current ? "text-text" : "text-muted"}`}
            >
              <Icon as={tab.icon} style={current ? { stroke: "var(--accent)" } : undefined} />
              {tab.key === "whispers" && dot && <span className="absolute top-1.5 left-[calc(50%+8px)] size-2 rounded-full bg-bad" aria-hidden="true" />}
              <span>{t(tab.label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

