// The Whispers page (/whispers/, /whispers/<slug>/): the ghosts' latest public updates, newest first. They are written by Gemini on
// a timer (worker/api.js) and are the same for everyone; the API sends both languages and the page shows its own (English when a
// whisper has no Indonesian words). Opening this page marks them as read (the dot on the tab). ?n=<id> opens one whisper on its own
// with its comments. Everything here comes from the network, so it is drawn after hydration; the pre-rendered page is the empty frame.
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLocation, useSearchParams } from "react-router";
import { Page } from "~/components/Page";
import { useHydrated } from "~/components/ClientOnly";
import { characterById, site } from "~/lib/content";
import { useScrollMemory } from "~/features/shell/scroll-memory";
import { PAGE_SIZE, feedPath, useWhispersApi } from "./api";
import { markSeen } from "./badge";
import { WhisperAd } from "./WhisperAd";
import { WhisperCard } from "./WhisperCard";
import type { Whisper, WhisperPage } from "./types";

const known = (w: Whisper) => Boolean(characterById(w.ghost)); // a whisper by a ghost this build does not know is left out

type Tail = { text: "" | "loadingWord" | "feedEnd" | "whisperError"; retry: boolean };

function FeedBody({ wanted, adPreview, adTest }: { wanted: number; adPreview: boolean; adTest: boolean }) {
  const { t } = useTranslation();
  const api = useWhispersApi();
  const restore = useScrollMemory();
  const single = Number.isInteger(wanted) && wanted > 0;
  // ?n= is not in the pre-rendered page: draw the feed's frame until hydration, so both first renders match
  const showSingle = useHydrated() && single;
  const [note, setNote] = useState<"" | "whisperError" | "whisperNone" | "whisperGone">("");
  const [items, setItems] = useState<Whisper[]>([]);
  const [one, setOne] = useState<Whisper | null>(null);
  const [adBefore, setAdBefore] = useState<ReadonlySet<number>>(new Set()); // whispers that have an ad right before them
  const [tail, setTail] = useState<Tail>({ text: "", retry: false });
  const [waiting, setWaiting] = useState(0); // newer whispers found, not on the page yet (the pill)
  const tailEl = useRef<HTMLLIElement>(null);
  const loadMoreRef = useRef<(() => Promise<boolean>) | null>(null);
  const showWaitingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!api.enabled) return;
    let alive = true;
    const cleanups: (() => void)[] = [];
    const ads = site.ads;
    let shown = 0;
    // An ad after every few whispers (never at the end); only the feed has them, not a whisper's own page. Newer whispers put on
    // top later get none, so the ads already on the page stay where they are.
    const toItems = (batch: Whisper[]) => {
      const out = batch.filter(known);
      const marks: number[] = [];
      for (const w of out) {
        if (ads?.every && ads.client && ads.slot && shown > 0 && shown % ads.every === 0) marks.push(w.n);
        shown++;
      }
      if (marks.length) setAdBefore((s) => new Set([...s, ...marks]));
      return out;
    };

    (async () => {
      let first: WhisperPage;
      try {
        first = await api.getJson<WhisperPage>(feedPath());
      } catch {
        if (alive) setNote("whisperError");
        return;
      }
      if (!alive) return;

      if (single) {
        // that whisper alone, comments open. Older ones are no longer in the feed, so ask for it by id.
        let w: Whisper | null | undefined = null;
        try {
          const res = await api.request(`/whispers/${wanted}`);
          w = res.status === 200 ? (res.data.whisper as Whisper) : first.whispers.find((x) => x.n === wanted);
        } catch {
          w = first.whispers.find((x) => x.n === wanted);
        }
        if (!alive) return;
        flushSync(() => {
          if (w && known(w)) setOne(w);
          else setNote("whisperGone");
        });
        await restore(null); // back from a profile: put this page's scroll back too
        return;
      }

      const { whispers } = first;
      let oldest = whispers.length ? whispers[whispers.length - 1].n : 0;
      let more = Boolean(first.more);
      let loading: Promise<boolean> | null = null;
      let observer: IntersectionObserver | null = null;
      // Load the next page and add it to the list. Resolves to whether there is still more.
      const loadMore = () =>
        (loading ||= (async () => {
          try {
            setTail({ text: "loadingWord", retry: false });
            const page = await api.getJson<WhisperPage>(feedPath({ before: oldest }));
            if (!alive) return false;
            if (page.whispers.length) oldest = page.whispers[page.whispers.length - 1].n;
            more = Boolean(page.more) && page.whispers.length > 0;
            flushSync(() => {
              const fresh = toItems(page.whispers);
              setItems((list) => [...list, ...fresh.filter((w) => !list.some((x) => x.n === w.n))]);
              setTail({ text: more ? "" : "feedEnd", retry: false });
            });
          } catch {
            if (alive) setTail({ text: "whisperError", retry: true });
            return false;
          } finally {
            loading = null;
          }
          if (!more) observer?.disconnect();
          return more;
        })());
      loadMoreRef.current = loadMore;

      flushSync(() => {
        setItems(toItems(whispers));
        setTail({ text: more ? "" : whispers.length ? "feedEnd" : "", retry: false });
        setNote(whispers.length ? "" : "whisperNone");
      });
      if (whispers.length) markSeen(whispers[0].t);

      // ---- new whispers ----
      // An installed app window has no reload button, so the feed looks for newer whispers by itself (every minute, and when the
      // window comes back to the front) and shows a pill "N new whispers"; a tap on it puts them at the top. Tapping the Whispers
      // tab again does the same, without reloading.
      let top = whispers.length ? whispers[0].n : 0;
      let newer: Whisper[] = []; // newest first
      let lastCheck = Date.now();
      const showWaiting = () => {
        const fresh = newer.filter(known);
        const gap = newer.length >= PAGE_SIZE; // so many new ones that the page would miss some of them in between: start over
        newer = [];
        setWaiting(0);
        if (gap) {
          window.location.reload();
          return;
        }
        if (fresh.length) {
          setItems((list) => [...fresh.filter((w) => !list.some((x) => x.n === w.n)), ...list]);
          top = Math.max(top, ...fresh.map((w) => w.n));
          markSeen(fresh[0].t);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      showWaitingRef.current = showWaiting;
      const checkNew = async (fresh = false) => {
        if (document.hidden && !fresh) return;
        lastCheck = Date.now();
        try {
          const page = await api.getJson<WhisperPage>(feedPath({ fresh }));
          newer = page.whispers.filter((w) => w.n > top);
        } catch {
          return; // offline or an error: try again at the next check
        }
        if (alive) setWaiting(newer.length);
      };
      const timer = setInterval(() => checkNew(), 60_000);
      const onVisible = () => {
        if (!document.hidden && Date.now() - lastCheck > 20_000) checkNew();
      };
      const onFocus = () => {
        if (Date.now() - lastCheck > 20_000) checkNew();
      };
      // Already here: the Whispers tab looks for new whispers and goes to the top instead of opening the page again.
      // (Captured before React Router's own click handler, which leaves a click alone once its default is prevented.)
      const onTab = async (e: MouseEvent) => {
        if (!(e.target instanceof Element) || !e.target.closest('nav a[data-tab="whispers"]')) return;
        e.preventDefault();
        await checkNew(true);
        if (newer.length) showWaiting();
        else window.scrollTo({ top: 0, behavior: "smooth" });
      };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", onFocus);
      document.addEventListener("click", onTab, true);
      cleanups.push(() => {
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("click", onTab, true);
        observer?.disconnect();
      });

      // coming back from a whisper or a profile: keep loading pages until the place the visitor left is on the page, then go there
      await restore(more ? loadMore : null);
      if (!alive || !more || !tailEl.current) return;
      observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && more && !loading) loadMore();
      }, { rootMargin: "800px 0px" });
      observer.observe(tailEl.current);
    })();

    return () => {
      alive = false;
      for (const fn of cleanups) fn();
    };
    // once per address: the page is keyed by it
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shownNote = api.enabled ? note : "whisperError";
  return (
    <>
      <ul className="m-0 list-none p-0">
        {waiting > 0 && (
          // the pill: takes no room, stays at the top while the feed scrolls
          <li className="sticky top-2.5 z-[6] m-0 flex h-0 list-none items-start justify-center overflow-visible p-0">
            <button type="button" onClick={() => showWaitingRef.current?.()} className="mt-1 cursor-pointer rounded-full border-0 bg-[var(--accent)] px-4 py-1.5 font-[inherit] text-[0.85rem] text-[#14161c] shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
              {`↑ ${t("newWhispers", { count: waiting })}`}
            </button>
          </li>
        )}
        {showSingle
          ? one && <WhisperCard w={one} ghost={characterById(one.ghost)!} single />
          : items.map((w) => [
              adBefore.has(w.n) && <WhisperAd key={`ad-${w.n}`} ads={site.ads} preview={adPreview} test={adTest} />,
              <WhisperCard key={w.n} w={w} ghost={characterById(w.ghost)!} />,
            ])}
        {!showSingle && (
          // sits at the end of the list: when it comes near the screen, the next page loads
          <li ref={tailEl} className="min-h-px list-none pt-3.5 pb-[22px] text-center text-[0.85rem] text-muted empty:p-0">
            {tail.text && <span>{t(tail.text)}</span>}
            {tail.retry && (
              <button type="button" onClick={() => loadMoreRef.current?.()} className="ml-2 cursor-pointer rounded-full border border-muted bg-transparent px-3 py-[3px] font-[inherit] text-[0.82rem] text-inherit">
                {t("retryWord")}
              </button>
            )}
          </li>
        )}
      </ul>
      {shownNote && <p className="my-6 text-center text-muted">{t(shownNote)}</p>}
    </>
  );
}

/**
 * The whispers page. `adPreview` shows stand-in cards where the ads go (Storybook; on the site, ?adpreview does the same).
 * Storybook hands in its data through WhispersApiContext (see api.ts).
 */
export function WhispersFeed({ adPreview = false }: { adPreview?: boolean }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [params] = useSearchParams();
  return (
    <Page tab="whispers">
      {/* No visible title bar or intro line (the tabs already say where you are); the heading stays for screen readers. */}
      <section className="pt-3.5">
        <h1 className="sr-only">{t("tabWhispers")}</h1>
        <FeedBody key={`${location.pathname}${location.search}`} wanted={Number(params.get("n"))} adPreview={adPreview || params.has("adpreview")} adTest={params.has("adtest")} />
      </section>
    </Page>
  );
}
