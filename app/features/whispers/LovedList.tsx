// The loved whispers page (/loved/ and /id/loved/, was assets/scripts/shell/loved.js): the whispers this visitor tapped the heart on,
// newest love first. Kept in this browser (loved-store.ts), so they are still here after the feed has deleted them.
import { type CSSProperties, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppBar } from "~/components/AppBar";
import { useHydrated } from "~/components/ClientOnly";
import { Page } from "~/components/Page";
import { asset } from "~/lib/asset";
import { type Character, characterById } from "~/lib/content";
import { localize, useLang } from "~/lib/lang";
import type { LovedWhisper } from "~/lib/storage";
import { chatTime } from "~/lib/time";
import { useWhispersApi } from "./api";
import { deviceId } from "./identity";
import { LinkCard, hasCard } from "./LinkCard";
import { lovedList, removeLove } from "./loved-store";
import { ShareButton, whisperShareUrl } from "./ShareButton";
import { LoveButton } from "./WhisperCard";
import { WhisperNote } from "./WhisperNote";
import type { WhisperLink } from "./types";
import "./whispers.css";

const FALLBACK_GHOST: Character = {
  id: "1",
  name: "",
  slug: "",
  accent: "#a47fd0",
  image: "build/img/favicon.ico",
  head: "build/img/favicon.ico",
  stage: "build/img/favicon.ico",
  status: "",
  statusId: "",
  seo: { tagline: "", description: "", id: { tagline: "", description: "" } },
  busy: { en: [], id: [] },
  bondGreetings: { en: [], id: [] },
};

export function LovedList({ seed }: { seed?: LovedWhisper[] }) {
  const { t } = useTranslation();
  const lang = useLang();
  const hydrated = useHydrated();
  const api = useWhispersApi();
  const [items, setItems] = useState<LovedWhisper[]>(seed || []);

  useEffect(() => {
    if (!seed) setItems(lovedList());
  }, [seed]);

  const onUnlove = (n: number) => {
    removeLove(n);
    setItems((prev) => prev.filter((w) => w.n !== n));
    if (api.enabled) {
      api.request(`/whispers/${n}/love`, { method: "DELETE", body: { device: deviceId() } }).catch(() => {});
    }
  };

  return (
    <Page tab="me">
      <AppBar title={t("lovedTitle")} back={localize("/me/", lang)} backLabel={t("backMe")} />
      <section className="pt-3.5">
        <ul className="m-0 list-none p-0">
          {hydrated &&
            items.map((w) => {
              const c = characterById(w.ghost) || FALLBACK_GHOST;
              const words = (lang === "id" && w.text.id) || w.text.en;
              return (
                <li key={w.n} style={{ "--c": c.accent } as CSSProperties} className="border-b border-line px-1 py-3.5">
                  <div className="flex items-center gap-3">
                    <img src={asset(c.image)} alt="" className="size-[46px] flex-none rounded-full border-2 border-[var(--c)] bg-paper object-contain" />
                    <div className="flex min-w-0 flex-col">
                      <strong>{c.name}</strong>
                      <time dateTime={new Date(w.t).toISOString()} className="text-xs text-muted">
                        {chatTime(w.t, lang)}
                      </time>
                    </div>
                  </div>
                  {hasCard(w.link as WhisperLink | null | undefined) ? (
                    <>
                      <p className="mt-2.5 mb-1.5 font-comic leading-[1.45] text-[#e8ebf2] [overflow-wrap:anywhere]">{words}</p>
                      <LinkCard link={w.link as WhisperLink | null | undefined} />
                    </>
                  ) : (
                    <WhisperNote n={w.n} text={words} ghost={c} />
                  )}
                  <div className="flex items-center gap-4">
                    <LoveButton pressed label={t("unloveWord")} onClick={() => onUnlove(w.n)} />
                    <ShareButton url={whisperShareUrl(w.n, c.slug, lang)} />
                  </div>
                </li>
              );
            })}
        </ul>
        {hydrated && items.length === 0 && <p className="my-6 text-center text-muted">{t("lovedNone")}</p>}
      </section>
    </Page>
  );
}
