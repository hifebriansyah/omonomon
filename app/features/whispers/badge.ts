// The dot on the Whispers tab: shown when the newest whisper is newer than the last one this browser has seen.
// It looks at most once every 2 minutes (and the API's answer is cached for 2 minutes as well). Never on the whispers page,
// and only after hydration, so the pre-rendered tab bar and the first browser render match.
import { useEffect } from "react";
import { create } from "zustand";
import type { Tab } from "~/components/TabBar";
import { useHydrated } from "~/components/ClientOnly";
import { config } from "~/lib/config";
import { KEYS, SESSION_KEYS, getText, setText } from "~/lib/storage";

const CHECK_EVERY = 120_000;

const useDot = create<{ dot: boolean }>(() => ({ dot: false }));

const latestSeen = () => Number(getText(KEYS.whisperSeen)) || 0;

/** The newest whisper on screen was posted at `t`: remember it, and take the dot away. */
export function markSeen(t: number) {
  setText(KEYS.whisperSeen, String(Math.max(latestSeen(), t)));
  setText(SESSION_KEYS.whisperCheckedNew, "0", "session");
  useDot.setState({ dot: false });
}

async function checkBadge() {
  const base = config.API_URL;
  if (!base) return;
  try {
    const last = Number(getText(SESSION_KEYS.whisperChecked, "session")) || 0;
    if (Date.now() - last < CHECK_EVERY) {
      useDot.setState({ dot: getText(SESSION_KEYS.whisperCheckedNew, "session") === "1" });
      return;
    }
    setText(SESSION_KEYS.whisperChecked, String(Date.now()), "session");
    const res = await fetch(`${base}/whispers`);
    if (!res.ok) return;
    const newest: number = (await res.json()).whispers?.[0]?.t || 0;
    const fresh = newest > latestSeen();
    setText(SESSION_KEYS.whisperCheckedNew, fresh ? "1" : "0", "session");
    useDot.setState({ dot: fresh });
  } catch {} // the dot is a nicety
}

/** Whether the Whispers tab shows its dot on a page with this tab bar (none: the page has no tab bar). */
export function useWhisperDot(tab?: Tab): boolean {
  const hydrated = useHydrated();
  const dot = useDot((s) => s.dot);
  useEffect(() => {
    if (!tab || tab === "whispers") return;
    checkBadge();
  }, [tab]);
  return hydrated && Boolean(tab) && tab !== "whispers" && dot;
}
