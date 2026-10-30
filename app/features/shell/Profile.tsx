// A ghost's profile page (/:slug/profile/, was assets/scripts/shell/profile.js): who she is, how close you are, her stories
// (unlocked by bond level), her three latest whispers and her games.
import { type CSSProperties, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AppBar } from "~/components/AppBar";
import { useHydrated } from "~/components/ClientOnly";
import { Page } from "~/components/Page";
import { loadMode } from "~/features/chat/history-store";
import { levelProgress, useProgress } from "~/features/games/progress";
import { useWhispersApi } from "~/features/whispers/api";
import type { Whisper, WhisperPage } from "~/features/whispers/types";
import { asset } from "~/lib/asset";
import { type Character, games, stories } from "~/lib/content";
import { characterSeo } from "~/lib/head";
import { localize, useLang } from "~/lib/lang";
import { chatTime } from "~/lib/time";

export function Profile({ character }: { character: Character }) {
  const { t } = useTranslation();
  const lang = useLang();
  const hydrated = useHydrated();
  const progress = useProgress();
  const api = useWhispersApi();

  const seo = characterSeo(character, lang);
  const { level, pct } = levelProgress(hydrated ? progress.bond[character.id] || 0 : 0);
  const titles = t("titles", { returnObjects: true }) as readonly string[];
  const charStories = stories[character.id] || [];
  const charGames = games.filter((g) => g.ready && g.character === character.id);
  const chatHref = localize(hydrated && loadMode(character.id) === "history" ? `/${character.slug}/history/` : `/${character.slug}/`, lang);

  const [whispers, setWhispers] = useState<Whisper[] | null>(null);
  const [whisperErr, setWhisperErr] = useState(false);

  useEffect(() => {
    if (!api.enabled) {
      setWhispers([]);
      return;
    }
    let alive = true;
    api
      .getJson<WhisperPage>("/whispers")
      .then(({ whispers: list }) => {
        if (alive) setWhispers((list || []).filter((w) => w.ghost === character.id).slice(0, 3));
      })
      .catch(() => {
        if (alive) setWhisperErr(true);
      });
    return () => {
      alive = false;
    };
  }, [api, character.id]);

  return (
    <Page tab="chats" accent={character.accent}>
      <AppBar title={character.name} back={localize("/", lang)} backLabel={t("backChats")} />
      <section style={{ "--accent": character.accent } as CSSProperties} className="grid gap-2.5">
        {character.banner ? (
          <img
            src={asset(character.banner)}
            alt=""
            className="block aspect-[3/1] w-full rounded-card border-[3px] border-ink object-cover shadow-[4px_4px_0_rgba(0,0,0,0.55)]"
          />
        ) : (
          <div
            role="img"
            aria-label={t("bannerSoon")}
            style={{
              background:
                "repeating-linear-gradient(135deg, color-mix(in srgb, var(--accent) 45%, #1b1d23) 0 18px, color-mix(in srgb, var(--accent) 30%, #1b1d23) 18px 36px)",
            }}
            className="grid aspect-[3/1] w-full place-items-center rounded-card border-[3px] border-ink font-comic text-[1.4rem] tracking-[0.04em] text-white shadow-[4px_4px_0_rgba(0,0,0,0.55)] [text-shadow:0_2px_0_rgba(0,0,0,0.45)]"
          >
            <span>{character.name}</span>
          </div>
        )}

        <div className="relative -mt-[34px] flex items-center gap-3 px-2.5">
          <img
            src={asset(character.head)}
            alt=""
            className="size-[76px] flex-none rounded-full border-[3px] border-[var(--accent)] bg-paper object-contain [box-shadow:var(--frame,none)]"
          />
          <div>
            <h2 className="mt-6 mb-0 text-[1.3rem] font-bold tracking-normal text-text normal-case">{character.name}</h2>
            <p className="mt-0.5 mb-0 text-[0.9rem] text-muted">{seo.tagline}</p>
          </div>
        </div>

        <p className="m-0 leading-normal">{seo.description}</p>

        <div className="grid gap-1">
          <span className="text-[0.85rem] text-muted">
            {hydrated ? `${t("bond")} ${level} · ${titles[level - 1] || ""}` : "\u00a0"}
          </span>
          <span className="block h-2 overflow-hidden rounded-full bg-[#2c3039]">
            <span className="block h-full bg-[var(--accent)]" style={{ width: `${hydrated ? pct : 0}%` }} />
          </span>
        </div>

        <Link
          to={chatHref}
          className="justify-self-start rounded-full bg-[var(--accent)] px-[18px] py-2 font-bold text-ink no-underline"
        >
          {t("chatWith", { name: character.name })}
        </Link>

        <h2 className="mt-3 mb-0 text-[0.85rem] tracking-[0.06em] text-muted uppercase">{t("profileStories")}</h2>
        <div className="grid gap-1.5">
          {charStories.map((s, i) =>
            hydrated && level >= s.level ? (
              <details key={i} className="rounded-[10px] bg-panel px-3 py-2">
                <summary className="cursor-pointer font-comic">{s.title[lang] || s.title.en}</summary>
                <p className="mt-2 mb-0.5 text-[0.92rem] text-soft">{s.text[lang] || s.text.en}</p>
              </details>
            ) : (
              <p key={i} className="m-0 mb-1.5 text-[0.82rem] text-muted italic">
                {t("meStoryLocked", { level: s.level })}
              </p>
            ),
          )}
        </div>

        <h2 className="mt-3 mb-0 text-[0.85rem] tracking-[0.06em] text-muted uppercase">{t("profileWhispers")}</h2>
        <ul className="m-0 grid list-none gap-2 p-0">
          {whisperErr ? (
            <li className="text-[0.9rem] text-muted">{t("whisperError")}</li>
          ) : whispers && whispers.length === 0 ? (
            <li className="text-[0.9rem] text-muted">{t("whisperNone")}</li>
          ) : (
            whispers?.map((w) => (
              <li key={w.n}>
                <Link
                  to={localize(`/whispers/?n=${w.n}`, lang)}
                  className="grid gap-1 rounded-xl border-l-[3px] border-[var(--accent)] bg-panel px-3 py-2.5 text-inherit no-underline"
                >
                  <span>{(lang === "id" && w.text.id) || w.text.en}</span>
                  <time dateTime={new Date(w.t).toISOString()} className="text-xs text-muted">
                    {chatTime(w.t, lang)}
                  </time>
                </Link>
              </li>
            ))
          )}
        </ul>
        <Link to={localize("/whispers/", lang)} className="text-sm text-link no-underline hover:underline">
          {t("allWhispers")}
        </Link>

        <h2 className="mt-3 mb-0 text-[0.85rem] tracking-[0.06em] text-muted uppercase">{t("profileGames")}</h2>
        <ul className="m-0 grid list-none gap-2 p-0">
          {charGames.map((g) => (
            <li key={g.slug}>
              <Link to={localize(`/games/${g.slug}/`, lang)} className="block rounded-xl bg-panel px-3 py-2 text-inherit no-underline hover:bg-[#2c303a]">
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
