// The /games/ page: today's quests and streak, this week's event, the "continue" shortcut and filters, the weekly boards,
// and a card per game with the bond level and best score. Everything that depends on the date or on saved progress is
// filled in after hydration, so the pre-rendered page is the same for everybody.
import { Flame } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useHydrated } from "~/components/ClientOnly";
import { Icon } from "~/components/Icon";
import { Page } from "~/components/Page";
import { asset } from "~/lib/asset";
import { type Character, characters, type Game, games as allGames, hub, type Lang } from "~/lib/content";
import { localize, useLang } from "~/lib/lang";
import { hostOf, WEEKLY_REWARD, WEEKLY_TARGET } from "./event";
import { lastGame } from "./last-game";
import { LeaderboardSection } from "./LeaderboardSection";
import { levelProgress, type Progress, useProgress, useProgressReady } from "./progress";
import { questLabel, questProgress, todaysQuests, yesterday } from "./quests";

const FRESH_DAYS = 14; // a game added in the last two weeks gets the NEW tag
const panel = "mb-3.5 rounded-card bg-panel px-3.5 py-3";
const pill = "cursor-pointer rounded-full border border-muted bg-transparent px-2.5 py-1 font-[inherit] text-[0.82rem] text-inherit aria-pressed:border-candle aria-pressed:bg-candle aria-pressed:text-[#1a1a1a]";

const byId = (id: string) => characters.find((c) => c.id === id);
const describe = (g: Game, lang: Lang) => ((lang === "id" && g.id?.description) || g.description).replaceAll("{name}", byId(g.character)?.name || "");

export function Hub({ games = allGames }: { games?: Game[] }) {
  const lang = useLang();
  const { t } = useTranslation();
  const hydrated = useHydrated();
  const ready = useProgressReady();
  const p = useProgress();
  const [filter, setFilter] = useState("all");
  const [last, setLast] = useState("");
  const [now, setNow] = useState(0); // the clock is read after hydration only (NEW tags)
  useEffect(() => {
    setLast(lastGame());
    setNow(Date.now());
  }, []);

  const filters: [string, string][] = [["all", t("filterAll")], ["quick", t("filterQuick")], ...characters.map((c): [string, string] => [`char:${c.id}`, c.name])];
  const shown = (g: Game) => filter === "all" || (filter === "quick" && g.ready && !!g.quick) || filter === `char:${g.character}`;
  const lastCard = games.find((g) => g.slug === last);
  const heading = lang === "id" ? hub.id.heading : hub.heading;

  return (
    <Page tab="games">
      <section className="pt-3.5">
        <h1 className="sr-only">{heading}</h1>
        <Quests p={p} show={hydrated && ready} />
        {hydrated && ready && <EventBanner p={p} />}
        <div className="mb-3 grid gap-2">
          {lastCard && (
            <Link to={localize(`/games/${lastCard.slug}/`, lang)} className="inline-block justify-self-start rounded-full bg-candle px-3.5 py-1.5 font-bold text-[#1a1a1a] no-underline">
              {t("continueGame", { name: lastCard.title })}
            </Link>
          )}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("filterGames")}>
            {filters.map(([key, label]) => (
              <button key={key} type="button" className={pill} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <LeaderboardSection games={games.filter((g) => g.ready)} />
        <ul className="m-0 grid list-none gap-3 p-0">
          {games.map((g) => (
            <Card key={g.slug} game={g} lang={lang} hidden={!shown(g)} p={ready ? p : null} fresh={!!(now && g.ready && g.added && Date.parse(g.added) > now - FRESH_DAYS * 86400_000)} />
          ))}
        </ul>
      </section>
    </Page>
  );
}

function Quests({ p, show }: { p: Progress; show: boolean }) {
  const lang = useLang();
  const { t } = useTranslation();
  const quests = show ? todaysQuests(characters) : [];
  // the streak still counts when its last day was today or yesterday
  const n = show && p.streak.last && (p.streak.last === p.daily.date || p.streak.last === yesterday()) ? p.streak.count : 0;
  return (
    <section className={panel} aria-labelledby="questsTitle">
      <div className="mb-1.5 flex items-center justify-between gap-2.5">
        <h2 id="questsTitle" className="m-0 text-[0.85rem] tracking-[0.06em] text-muted uppercase">
          {t("questsTitle")}
        </h2>
        <p className="m-0 flex items-center gap-1.5 text-[0.85rem] text-candle">
          <Icon as={Flame} className="size-[1.1em]" />
          <span>{show ? (n ? t("streakDays", { count: n }) : t("streakNone")) : ""}</span>
        </p>
      </div>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {quests.map((q) => {
          const have = Math.min(questProgress(q, p.daily), q.target);
          const done = p.daily.done.includes(q.id);
          return (
            <li key={q.id} className="flex items-center gap-2.5 text-[0.92rem]">
              <span className={`min-w-0 flex-1 ${done ? "text-muted line-through" : ""}`}>{questLabel(q, lang, characters)}</span>
              <span className={`text-[0.8rem] ${done ? "text-good" : "text-muted"}`}>{done ? "✓" : `${have}/${q.target}`}</span>
              <span className="min-w-[2em] text-right text-[0.8rem] text-candle">+{q.reward}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EventBanner({ p }: { p: Progress }) {
  const { t } = useTranslation();
  const host: Character | undefined = byId(hostOf());
  if (!host) return null;
  return (
    <section
      style={{ "--accent": host.accent } as CSSProperties}
      className="mb-3.5 flex items-center gap-3 rounded-card border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_22%,var(--color-panel))] px-3.5 py-2.5"
    >
      <img src={asset(host.head)} alt="" className="size-11 flex-none rounded-full bg-paper object-contain" />
      <div className="min-w-0 flex-1">
        <strong className="block text-[0.95rem]">{t("eventTitle", { name: host.name })}</strong>
        <p className="m-0 mt-0.5 text-[0.82rem] text-muted">{t("eventBody", { n: WEEKLY_TARGET, reward: WEEKLY_REWARD })}</p>
      </div>
      <span className="text-[0.85rem] whitespace-nowrap text-candle tabular-nums">
        {p.weekly.done ? t("eventDone") : t("eventProgress", { have: Math.min(p.weekly.plays, WEEKLY_TARGET), n: WEEKLY_TARGET })}
      </span>
    </section>
  );
}

function Card({ game: g, lang, hidden, p, fresh }: { game: Game; lang: Lang; hidden: boolean; p: Progress | null; fresh: boolean }) {
  const { t } = useTranslation();
  const c = byId(g.character);
  const inner = (
    <>
      {c && <img src={asset(c.image)} alt="" className="size-16 flex-none rounded-full bg-paper object-contain" />}
      <span className="grid gap-0.5">
        <h2 className="m-0 font-comic text-[1.15rem]">
          {g.title}
          {fresh && (
            <>
              {" "}
              <span className="rounded-full bg-good px-1.5 py-px align-middle font-sans text-[0.65rem] text-[#10331a]">{t("newTag")}</span>
            </>
          )}
        </h2>
        <span className="text-[0.85rem] text-muted">{(lang === "id" && g.id?.tagline) || g.tagline}</span>
        <span className="text-[0.9rem] text-soft">{describe(g, lang)}</span>
      </span>
    </>
  );
  const body = "flex items-center gap-3 p-3 text-inherit no-underline";
  const meta = "flex justify-between gap-2.5 pr-3 pb-2.5 pl-[88px] text-[0.8rem] text-muted";
  const lp = p && c ? levelProgress(p.bond[c.id] || 0) : null;
  const best = p?.best[g.slug];
  return (
    <li
      hidden={hidden}
      style={c ? ({ "--accent": c.accent } as CSSProperties) : undefined}
      className={`overflow-hidden rounded-card border-2 border-ink bg-panel shadow-[3px_3px_0_rgba(0,0,0,0.5)] ${g.ready ? "" : "opacity-60"}`}
    >
      {g.ready ? (
        <>
          <Link to={localize(`/games/${g.slug}/`, lang)} className={`${body} hover:bg-[#2c303a]`}>
            {inner}
          </Link>
          <div className={meta}>
            <span className="relative pb-1.5">
              {lp && (
                <>
                  {t("bond")} {lp.level}
                  <span
                    aria-hidden="true"
                    className="absolute right-0 bottom-0 left-0 h-[3px] rounded-[2px]"
                    style={{ background: `linear-gradient(90deg, var(--accent) ${lp.pct}%, var(--color-edge) ${lp.pct}%)` }}
                  />
                </>
              )}
            </span>
            <span>{best ? `${t("best")} ${best}` : ""}</span>
          </div>
        </>
      ) : (
        <>
          <div className={body}>{inner}</div>
          <div className={meta}>
            <span className="italic">{t("comingSoon")}</span>
          </div>
        </>
      )}
    </li>
  );
}
