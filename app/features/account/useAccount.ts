// The signed-in user for components: redraws on sign-in, sign-out and when the API ends the session (401).
// Pre-render and the first browser render see a guest, so the HTML matches; the real state follows right after.
import { useMemo, useSyncExternalStore } from "react";
import { KEYS, getText, type Session } from "~/lib/storage";
import { accountsEnabled, onSessionChange, type SessionUser } from "./account";

export interface AccountState {
  enabled: boolean;
  signedIn: boolean;
  user: SessionUser | null;
}

const snapshot = () => getText(KEYS.session) || ""; // the stored text: the same string while nothing changed

export function useAccount(): AccountState {
  const raw = useSyncExternalStore(onSessionChange, snapshot, () => "");
  return useMemo(() => {
    let session: Session | null = null;
    try {
      session = raw ? (JSON.parse(raw) as Session) : null;
    } catch {}
    const enabled = accountsEnabled();
    const signedIn = enabled && Boolean(session?.token);
    return { enabled, signedIn, user: signedIn ? session?.user || null : null };
  }, [raw]);
}
