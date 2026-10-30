// The heart under a whisper: loves it (a copy is kept in this browser; the Me page lists them) and keeps the public count.
// Taps show at once, but only the LAST state is sent, after a short pause; a request still on its way is cancelled when you tap
// again. (Quick taps used to send one request each and ran into the rate limit.) Browser only.
import { useRef, useState } from "react";
import { recordSocial } from "~/features/games/progress";
import { useWhispersApi } from "./api";
import { useBadgeToast } from "./badge-toast";
import { deviceId } from "./identity";
import { isLoved, toggleLove } from "./loved-store";
import type { Whisper } from "./types";

export function useLove(w: Whisper) {
  const api = useWhispersApi();
  const badgeToast = useBadgeToast();
  const [wanted, setWanted] = useState(() => isLoved(w.n));
  const [others, setOthers] = useState(() => Math.max(0, (w.loves || 0) - (isLoved(w.n) ? 1 : 0))); // loves from other people
  const s = useRef({ wanted, sent: wanted as boolean | null, timer: 0 as ReturnType<typeof setTimeout> | 0, inFlight: null as AbortController | null });

  async function sync() {
    const r = s.current;
    if (r.wanted === r.sent) return;
    const sending = r.wanted;
    const ctrl = (r.inFlight = new AbortController());
    try {
      const { status, data } = await api.request(`/whispers/${w.n}/love`, { method: sending ? "PUT" : "DELETE", body: { device: deviceId() }, signal: ctrl.signal });
      if (status !== 200) throw new Error(String(status));
      if (sending && r.sent !== true) badgeToast(recordSocial("loves"));
      r.sent = sending;
      setOthers(Math.max(0, data.loves - (sending ? 1 : 0)));
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        r.sent = null; // cancelled by a newer tap, which sends the final state
        return;
      }
      r.wanted = r.sent ?? !sending; // the server could not be reached: go back
      if (isLoved(w.n) !== r.wanted) toggleLove(w);
      setWanted(r.wanted);
    } finally {
      if (r.inFlight === ctrl) r.inFlight = null;
    }
  }

  function toggle() {
    const r = s.current;
    r.wanted = toggleLove(w); // the local list changes at once
    setWanted(r.wanted);
    clearTimeout(r.timer);
    r.inFlight?.abort(); // an older request no longer matters
    r.timer = setTimeout(sync, 500);
  }

  return { loved: wanted, count: others + (wanted ? 1 : 0), toggle };
}
