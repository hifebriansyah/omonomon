// The Me page (/me/ and /id/me/, was assets/scripts/shell/me.js): account (Google sign-in), stats, language switch, 3D scenes
// toggle, notifications, nickname, bond levels, Candle shop, badges, and links to Ghost Room, Loved whispers, and Privacy.
import { Flame } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";
import { useHydrated } from "~/components/ClientOnly";
import { Icon } from "~/components/Icon";
import { Page } from "~/components/Page";
import { AccountPanel } from "~/features/account/AccountPanel";
import { NotifyToggle } from "~/features/account/NotifyToggle";
import { BADGES } from "~/features/games/achievements";
import { applyCosmetics, buy, equip, ITEMS, type ItemKind } from "~/features/games/cosmetics";
import { balance, levelProgress, reloadProgress, useProgress } from "~/features/games/progress";
import { canUse3D } from "~/features/three/kit";
import { is3dEnabled, set3d } from "~/features/three/prefs3d";
import { nickname, randomNickname, setNickname } from "~/features/whispers/identity";
import { lovedList } from "~/features/whispers/loved-store";
import { asset } from "~/lib/asset";
import { characters, type Lang } from "~/lib/content";
import { localize, useLang } from "~/lib/lang";
import { KEYS, setText } from "~/lib/storage";

const SECTION_HEADING = "mt-[18px] mb-2 text-[0.85rem] tracking-[0.06em] text-muted uppercase";

export function MePage() {
  const { t } = useTranslation();
  const lang = useLang();
  const hydrated = useHydrated();
  const location = useLocation();
  const navigate = useNavigate();
  const progress = useProgress();

  const [threeOn, setThreeOn] = useState(false);
  const [nick, setNick] = useState("");
  const [nickNote, setNickNote] = useState<{ key: "meNickNote" | "meNickBad" | "meNickSaved"; bad: boolean }>({
    key: "meNickNote",
    bad: false,
  });
  const [shopMsg, setShopMsg] = useState<"" | "shopBought" | "shopPoor">("");
  const [lovedCount, setLovedCount] = useState(0);

  useEffect(() => {
    setThreeOn(is3dEnabled());
    setNick(nickname());
    setLovedCount(lovedList().length);
  }, []);

  const switchLang = (next: Lang) => {
    if (next === lang) return;
    setText(KEYS.lang, next);
    navigate(localize(location.pathname, next));
  };

  const titles = t("titles", { returnObjects: true }) as readonly string[];
  const shopItemsText = t("shopItems", { returnObjects: true }) as Record<string, string>;
  const badgesText = t("badges", { returnObjects: true }) as Record<string, readonly string[]>;
  const namesById = Object.fromEntries(characters.map((c) => [c.id, c.name]));
  const earnedBadges = new Set(hydrated ? progress.badges || [] : []);
  const bal = hydrated ? balance(progress) : 0;

  const shopGroups: [ItemKind, string][] = [
    ["stage", t("shopStage")],
    ["bubble", t("shopBubble")],
    ["frame", t("shopFrame")],
    ["room", t("shopRoom")],
  ];

  const refreshAfterShop = (msg: "" | "shopBought" | "shopPoor" = "") => {
    applyCosmetics("");
    reloadProgress();
    setShopMsg(msg);
  };

  return (
    <Page tab="me">
      <section className="pt-2">
        <AccountPanel />

        <div className="mb-[18px] grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-panel px-3 py-2.5">
            <b className="block text-[1.4rem]">{bal}</b>
            <span className="text-[0.8rem] text-muted">{t("meCandles")}</span>
          </div>
          <div className="rounded-xl bg-panel px-3 py-2.5">
            <b className="block text-[1.4rem]">{hydrated ? progress.plays : 0}</b>
            <span className="text-[0.8rem] text-muted">{t("mePlayed")}</span>
          </div>
        </div>

        <p className="mt-0 mb-1.5 flex items-center gap-1.5 text-[0.85rem] text-candle">
          <Icon as={Flame} className="size-[1.1em]" />
          <span>{hydrated ? `${t("meStreak")}: ${progress.bestStreak || 0} ${t("meDays")}` : ""}</span>
        </p>

        <h2 className={SECTION_HEADING}>{t("meLanguage")}</h2>
        <div role="group" aria-label={t("meLanguage")} className="mb-1 flex gap-2">
          {(
            [
              ["en", t("languageEnglish")],
              ["id", t("languageIndonesian")],
            ] as const
          ).map(([code, label]) => {
            const active = lang === code;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                onClick={() => switchLang(code)}
                className={`cursor-pointer rounded-[10px] border px-3.5 py-2 font-[inherit] text-[0.85rem] text-text ${
                  active ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_22%,transparent)]" : "border-[#4a4f5c] bg-transparent hover:bg-white/8"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <h2 className={SECTION_HEADING}>{t("me3d")}</h2>
        <p className="my-2">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={hydrated && threeOn}
              disabled={!hydrated || !canUse3D()}
              onChange={(e) => {
                setThreeOn(e.target.checked);
                set3d(e.target.checked);
              }}
              className="size-4 accent-[var(--accent)]"
            />
            <span>{t("me3dLabel")}</span>
          </label>
        </p>

        <h2 className={SECTION_HEADING}>{t("meNotify")}</h2>
        <NotifyToggle />

        <h2 className={SECTION_HEADING} id="nickLabel">
          {t("meNickname")}
        </h2>
        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            const saved = setNickname(nick);
            if (!saved) {
              setNickNote({ key: "meNickBad", bad: true });
              return;
            }
            setNick(saved);
            setNickNote({ key: "meNickSaved", bad: false });
          }}
          className="mb-1 flex gap-2"
        >
          <input
            type="text"
            maxLength={24}
            aria-labelledby="nickLabel"
            value={nick}
            onChange={(e) => {
              setNick(e.target.value);
              setNickNote({ key: "meNickNote", bad: false });
            }}
            className="min-w-0 flex-1 rounded-[10px] border border-edge bg-panel px-3 py-2 font-[inherit] text-text"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-[10px] border border-[#4a4f5c] bg-transparent px-3 py-2 font-[inherit] text-[0.85rem] text-text hover:bg-white/8"
          >
            {t("meSave")}
          </button>
          <button
            type="button"
            onClick={() => {
              const saved = setNickname(randomNickname()) || "";
              setNick(saved);
              setNickNote({ key: "meNickSaved", bad: false });
            }}
            className="cursor-pointer rounded-[10px] border border-[#4a4f5c] bg-transparent px-3 py-2 font-[inherit] text-[0.85rem] text-text hover:bg-white/8"
          >
            {t("meRandom")}
          </button>
        </form>
        <p className={`mt-0 mb-1 text-[0.8rem] ${nickNote.bad ? "text-[#ff8a80]" : "text-muted"}`}>{t(nickNote.key)}</p>

        <h2 className={SECTION_HEADING}>{t("meBonds")}</h2>
        <ul className="m-0 grid list-none gap-2 p-0">
          {characters.map((c) => {
            const { level, pct } = levelProgress(hydrated ? progress.bond[c.id] || 0 : 0);
            return (
              <li key={c.id} style={{ "--c": c.accent } as CSSProperties} className="flex items-center gap-2.5">
                <Link to={localize(`/${c.slug}/profile/`, lang)} className="flex min-w-0 flex-1 items-center gap-2.5 text-inherit no-underline">
                  <img src={asset(c.image)} alt="" className="size-9 flex-none rounded-full bg-paper object-contain" />
                  <span className="min-w-0 flex-1">
                    {c.name}{" "}
                    <small className="text-muted">
                      · <span>{level}</span> <span>{hydrated ? `· ${titles[level - 1] || ""}` : ""}</span>
                    </small>
                    <span
                      style={{
                        background: `linear-gradient(90deg, var(--c, var(--accent)) ${hydrated ? pct : 0}%, #3a3e4a ${hydrated ? pct : 0}%)`,
                      }}
                      className="mt-1 block h-1 rounded-xs"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <h2 className={SECTION_HEADING}>{t("shopTitle")}</h2>
        <section>
          <p className="mt-0 mb-1 text-[0.9rem] text-candle" aria-live="polite">
            {hydrated ? t("shopBalance", { n: bal }) : ""}
          </p>
          <p className="mt-0 mb-1.5 min-h-[1.2em] text-[0.85rem] text-good" role="status">
            {shopMsg ? t(shopMsg) : ""}
          </p>
          <div>
            {shopGroups.map(([kind, title]) => {
              const worn = (hydrated && kind !== "room" ? progress.equipped[kind] : "") || "none";
              const groupItems = ITEMS.filter((i) => i.kind === kind && (!i.reward || (hydrated && progress.owned.includes(i.id))));
              return (
                <div key={kind}>
                  <h3 className="mt-2.5 mb-1 text-[0.8rem] tracking-[0.06em] text-muted uppercase">{title}</h3>
                  <ul className="m-0 grid list-none gap-1 p-0">
                    {kind !== "room" && (
                      <li className="flex items-center justify-between gap-2.5 text-[0.92rem]">
                        <span>{t("shopDefault")}</span>
                        <button
                          type="button"
                          disabled={worn === "none"}
                          onClick={() => {
                            equip(kind, "none");
                            refreshAfterShop();
                          }}
                          className="cursor-pointer rounded-full border border-muted bg-transparent px-3 py-[3px] font-[inherit] text-[0.82rem] text-inherit disabled:cursor-default disabled:opacity-55"
                        >
                          {worn === "none" ? t("shopWorn") : t("shopWear")}
                        </button>
                      </li>
                    )}
                    {groupItems.map((item) => {
                      const owned = hydrated && progress.owned.includes(item.id);
                      const label =
                        shopItemsText[item.id] ||
                        (item.id.startsWith("frame-ribbon-") ? t("shopRibbon", { n: namesById[item.id.slice(-1)] || "" }) : item.id);
                      const isWorn = worn === item.id;
                      const poor = bal < item.price;
                      return (
                        <li key={item.id} className="flex items-center justify-between gap-2.5 text-[0.92rem]">
                          <span>{label}</span>
                          {owned && kind === "room" ? (
                            <button
                              type="button"
                              disabled
                              className="cursor-default rounded-full border border-muted bg-transparent px-3 py-[3px] font-[inherit] text-[0.82rem] text-inherit opacity-55"
                            >
                              {t("shopOwned")}
                            </button>
                          ) : owned && kind !== "room" ? (
                            <button
                              type="button"
                              disabled={isWorn}
                              onClick={() => {
                                equip(kind, item.id);
                                refreshAfterShop();
                              }}
                              className="cursor-pointer rounded-full border border-muted bg-transparent px-3 py-[3px] font-[inherit] text-[0.82rem] text-inherit disabled:cursor-default disabled:opacity-55"
                            >
                              {isWorn ? t("shopWorn") : t("shopWear")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const res = buy(item.id);
                                refreshAfterShop(res === "ok" ? "shopBought" : "shopPoor");
                              }}
                              className={`cursor-pointer rounded-full border border-muted bg-transparent px-3 py-[3px] font-[inherit] text-[0.82rem] text-inherit ${
                                poor ? "opacity-55" : ""
                              }`}
                            >
                              {t("shopBuy", { n: item.price })}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-1 mb-1 text-[0.8rem] text-muted">{t("shopGhostStage")}</p>
        </section>

        <h2 className={SECTION_HEADING}>{t("meBadges")}</h2>
        <ul className="m-0 mb-3.5 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 p-0">
          {BADGES.map((b) => {
            const [name, how] = badgesText[b.id] || [b.id, ""];
            const got = earnedBadges.has(b.id);
            return (
              <li
                key={b.id}
                className={`grid gap-0.5 rounded-xl bg-panel px-2.5 py-2 ${got ? "opacity-100 shadow-[inset_0_0_0_1px_#ffb454]" : "opacity-45"}`}
              >
                <strong>{name}</strong>
                <small className="text-[0.78rem] text-muted">{how}</small>
              </li>
            );
          })}
        </ul>

        <ul className="m-0 list-none p-0">
          <li>
            <Link to={localize("/room/", lang)} className="block border-b border-line px-1 py-3 text-text no-underline hover:bg-row">
              {t("meRoom")}
            </Link>
          </li>
          <li>
            <Link to={localize("/loved/", lang)} className="block border-b border-line px-1 py-3 text-text no-underline hover:bg-row">
              <span>{t("meLoved")}</span>{" "}
              {hydrated && lovedCount > 0 && <span className="text-muted">{`· ${lovedCount}`}</span>}
            </Link>
          </li>
          <li>
            <Link to={localize("/privacy/", lang)} className="block border-b border-line px-1 py-3 text-text no-underline hover:bg-row">
              {t("mePrivacy")}
            </Link>
          </li>
        </ul>
      </section>
    </Page>
  );
}
