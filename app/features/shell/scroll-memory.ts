// Back should land exactly where the visitor left. The whispers pages fill their list from the network after they appear, so
// React Router's own scroll restore comes too early (the page is still short). The position is saved when the visitor leaves and
// put back once the list is on screen. Kept per address in sessionStorage, so it only lasts for this tab.
import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";
import { SESSION_KEYS, getText, setText } from "~/lib/storage";

/**
 * Remember this page's scroll position while it is shown, and get `restore(loadMore?)` to call right after the first page of
 * the list has been drawn. `loadMore` (optional) adds the next page (already in the DOM when it resolves) and resolves to whether
 * there is another one after it: it is called until the page is tall enough to reach the saved position. Only a Back/Forward
 * visit restores a position; a fresh visit starts at the top.
 */
export function useScrollMemory() {
  const location = useLocation();
  const navType = useNavigationType();
  const key = SESSION_KEYS.scroll(`${location.pathname}${location.search}`);
  const ready = useRef(false); // the list is on screen and the old position has been put back: only then is scrollY worth saving
  const lastY = useRef(0);
  // The first page of a visit ("default" key) is a real page load: the browser says how it got here. Later pages are router moves.
  const routerBack = location.key === "default" ? null : navType === "POP";

  useEffect(() => {
    ready.current = false;
    lastY.current = window.scrollY;
    const save = () => {
      if (ready.current) setText(key, String(Math.round(lastY.current)), "session");
    };
    const onScroll = () => {
      lastY.current = window.scrollY;
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      save(); // leaving for another page of the app (the position from the last scroll, before the new page moves it)
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [key]);

  return useCallback(
    async (loadMore?: (() => Promise<boolean>) | null) => {
      const y = Number(getText(key, "session")) || 0;
      const back = routerBack ?? (performance.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined)?.type === "back_forward";
      if (!y || !back) {
        ready.current = true;
        return;
      }
      for (let i = 0; loadMore && i < 40 && document.documentElement.scrollHeight < y + window.innerHeight; i++) {
        if (!(await loadMore())) break;
      }
      window.scrollTo(0, y); // right away (the content is already in the page), and once more on the next frame in case layout settled late
      lastY.current = y;
      ready.current = true;
      requestAnimationFrame(() => window.scrollTo(0, y));
    },
    [key, routerBack],
  );
}
