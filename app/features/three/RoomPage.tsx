// The /room/ page (was assets/scripts/shell/room-page.js): your Ghost Room (the furniture you bought), or a friend's room when
// the link carries one in its #hash (#r=furn-lamp,furn-rug). Uses R3F GhostRoom when WebGL2 is available, or Room2D otherwise.
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { AppBar } from "~/components/AppBar";
import { useHydrated } from "~/components/ClientOnly";
import { Page } from "~/components/Page";
import { ITEMS } from "~/features/games/cosmetics";
import { useProgress } from "~/features/games/progress";
import { characters } from "~/lib/content";
import { localize, useLang } from "~/lib/lang";
import { canUse3D } from "./kit";
import { Room2D } from "./Room2D";
import { ThreeBoundary } from "./ThreeBoundary";

const LazyGhostRoom = lazy(() => import("./GhostRoom"));
const FURNITURE = new Set(ITEMS.filter((i) => i.kind === "room").map((i) => i.id));

function parseSharedHash(hash: string): string[] | null {
  const m = /[#&]r=([\w,-]*)/.exec(hash);
  return m ? m[1].split(",").filter((id) => FURNITURE.has(id)) : null;
}

export function RoomPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const hydrated = useHydrated();
  const location = useLocation();
  const progress = useProgress();
  const [hash, setHash] = useState("");
  const [copiedNote, setCopiedNote] = useState("");

  useEffect(() => {
    setHash(window.location.hash);
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [location.hash]);

  const shared = hydrated ? parseSharedHash(hash || location.hash) : null;
  const items = hydrated ? shared || progress.owned.filter((id) => FURNITURE.has(id)) : [];
  const stage = hydrated ? progress.equipped.stage : "";
  const canShare = hydrated && !shared && items.length > 0;
  const note = copiedNote || (!hydrated ? "" : shared ? t("roomShared") : items.length ? "" : t("roomEmpty"));

  const onShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#r=${items.join(",")}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("roomTitle"), url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiedNote(t("roomCopied"));
      }
    } catch {}
  };

  const fallback2d = <Room2D items={items} accent="#a47fd0" stage={stage} chars={characters} />;

  return (
    <Page tab="me">
      <AppBar title={t("roomTitle")} back={localize("/me/", lang)} backLabel={t("backMe")}>
        {canShare && (
          <button
            type="button"
            onClick={onShare}
            className="cursor-pointer rounded-full border border-muted bg-transparent px-3 py-1 font-[inherit] text-[0.82rem] text-inherit hover:bg-white/8"
          >
            {t("roomShare")}
          </button>
        )}
      </AppBar>
      <section className="grid gap-2">
        <div className="relative h-[min(62vh,520px)] w-full overflow-hidden rounded-card border-[3px] border-ink bg-[#15142b] shadow-[4px_4px_0_rgba(0,0,0,0.55)]">
          {hydrated && canUse3D() ? (
            <ThreeBoundary fallback={fallback2d}>
              <Suspense fallback={fallback2d}>
                <LazyGhostRoom items={items} accent="#a47fd0" stage={stage} chars={characters} lang={lang} />
              </Suspense>
            </ThreeBoundary>
          ) : (
            fallback2d
          )}
        </div>
        <p role="status" className="m-0 min-h-[1.2em] text-[0.88rem] text-muted">
          {note}
        </p>
      </section>
    </Page>
  );
}
