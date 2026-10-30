// The profile card at the top of Me: guest with the Google button, or signed in with sign-out and delete.
// AccountPanelView only draws (Storybook uses it with made-up states); AccountPanel wires it to Google, Turnstile and the API.
// Pre-render and the first browser render show the guest card with empty button boxes; Google's script loads after hydration.
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Ghost } from "lucide-react";
import { Button } from "~/components/Button";
import { Icon } from "~/components/Icon";
import { useHydrated } from "~/components/ClientOnly";
import { config } from "~/lib/config";
import { useLang } from "~/lib/lang";
import { deleteAccount, getTurnstileToken, loadGoogleScript, signInWithGoogle, signOut, type SessionUser } from "./account";
import { useAccount } from "./useAccount";

export type AccountMode = "off" | "guest" | "signedIn";

// The Google profile photo, or the ghost icon when there is none (or it cannot be loaded).
function Photo({ url }: { url?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="grid size-14 flex-none place-items-center overflow-hidden rounded-full bg-edge text-soft">
      {url && !broken ? (
        // Google's photo host can refuse requests that carry a referrer
        <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="size-full object-cover" />
      ) : (
        <Icon as={Ghost} className="size-[1.9em]" />
      )}
    </span>
  );
}

export function AccountPanelView({
  mode,
  user = null,
  error = "",
  busy = false,
  signIn = null,
  onSignOut,
  onDelete,
}: {
  mode: AccountMode;
  user?: SessionUser | null;
  error?: string;
  busy?: boolean;
  /** Guest mode: where Google's button and the Turnstile check go. */
  signIn?: ReactNode;
  onSignOut?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const on = mode === "signedIn";
  const name = on ? user?.name || (user?.email ? t("meSignedInAs", { email: user.email }) : t("meSignedIn")) : t("meGuest");
  const note = on ? [user?.name ? user.email : "", t("meSavedAccount")].filter(Boolean).join(" · ") : t("meNote");
  return (
    <div className="mt-1.5 mb-3.5 flex items-center gap-3.5 rounded-card bg-panel p-3.5">
      <Photo key={on ? user?.picture || "" : ""} url={on ? user?.picture : undefined} />
      <div className="min-w-0">
        <strong className="text-[1.1rem]">{name}</strong>
        <p className="mt-0.5 mb-0 text-[0.85rem] text-muted">{note}</p>
        {mode === "off" && (
          // the "coming soon" note only while accounts are switched off
          <button type="button" disabled className="mt-2 rounded-[10px] border border-dashed border-[#4a4f5c] bg-transparent px-2.5 py-1.5 font-[inherit] text-[0.85rem] text-muted">
            {t("meSignIn")}
          </button>
        )}
        {mode === "guest" && signIn}
        {error && (
          <p role="alert" className="mt-2 mb-0 text-[0.85rem] text-[#ff8a80]">
            {error}
          </p>
        )}
        {on && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={onSignOut}>
              {t("meSignOut")}
            </Button>
            <Button variant="danger" disabled={busy} onClick={onDelete}>
              {t("meDelete")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AccountPanel() {
  const { t } = useTranslation();
  const lang = useLang();
  const hydrated = useHydrated();
  const { enabled, signedIn, user } = useAccount();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const gsiRef = useRef<HTMLDivElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const guest = hydrated && enabled && !signedIn;

  // Guest: load Google's script and draw its button; the bot check starts now and is awaited when the visitor signs in.
  useEffect(() => {
    if (!guest) return;
    let live = true;
    (async () => {
      try {
        await loadGoogleScript();
        const gsi = gsiRef.current;
        const id = window.google?.accounts?.id;
        if (!live || !gsi || !turnstileRef.current) return;
        if (!id) throw new Error("Google sign-in is missing");
        const check = getTurnstileToken(turnstileRef.current);
        id.initialize({
          client_id: config.GOOGLE_CLIENT_ID,
          callback: async ({ credential }) => {
            setError("");
            try {
              await signInWithGoogle(credential, await check); // the session change redraws this card as signed in
            } catch {
              setError(t("meSignInError"));
            }
          },
        });
        gsi.replaceChildren();
        id.renderButton(gsi, { theme: "filled_black", size: "large", shape: "pill", text: "signin_with", locale: lang }); // its text in the page's language
      } catch {
        if (live) setError(t("meSignInError"));
      }
    })();
    return () => {
      live = false;
    };
  }, [guest, lang, t]);

  const onSignOut = async () => {
    setBusy(true);
    setError("");
    await signOut();
    setBusy(false);
  };

  const onDelete = async () => {
    if (!confirm(t("meDeleteConfirm"))) return;
    setBusy(true);
    setError("");
    try {
      await deleteAccount();
    } catch {
      setError(t("meSignInError"));
    }
    setBusy(false);
  };

  const mode: AccountMode = !enabled ? "off" : signedIn ? "signedIn" : "guest";
  return (
    <AccountPanelView
      mode={mode}
      user={user}
      error={error}
      busy={busy}
      onSignOut={onSignOut}
      onDelete={onDelete}
      signIn={
        <>
          {/* Google's button is a light iframe; on a dark page the browser would paint a white box behind it unless the
              iframe's colour scheme matches its own. React never draws inside these two boxes: Google and Turnstile do. */}
          <div ref={gsiRef} className="mt-2.5 [color-scheme:light] empty:hidden [&_iframe]:[color-scheme:light]" />
          <div ref={turnstileRef} />
        </>
      }
    />
  );
}
