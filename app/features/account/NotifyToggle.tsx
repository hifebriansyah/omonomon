// Opt-in notifications (Web Push) on Me: a ghost's whisper and a streak reminder, at most one a day.
// NotifyToggleView only draws (Storybook shows its states); NotifyToggle asks the browser and the API.
// Pre-render and the first browser render show an unticked, disabled box with no note; the real state follows.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHydrated } from "~/components/ClientOnly";
import { useLang } from "~/lib/lang";
import { disablePush, enablePush, pushEnabled, pushSupported } from "./account";

export type NotifyNote = "" | "notifyOn" | "notifyDenied" | "notifyUnsupported" | "notifyError";

export function NotifyToggleView({ checked, disabled = false, note = "", onToggle }: { checked: boolean; disabled?: boolean; note?: NotifyNote; onToggle?: (on: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <p className="my-2">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onToggle?.(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          <span>{t("meNotifyLabel")}</span>
        </label>
      </p>
      <p className="mt-0 mb-1 text-[0.8rem] text-muted" aria-live="polite">
        {note ? t(note) : ""}
      </p>
    </>
  );
}

export function NotifyToggle() {
  const lang = useLang();
  const hydrated = useHydrated();
  const [state, setState] = useState<{ ready: boolean; checked: boolean; note: NotifyNote }>({ ready: false, checked: false, note: "" });
  const [busy, setBusy] = useState(false);
  const supported = hydrated && pushSupported();

  useEffect(() => {
    if (!supported) return;
    let live = true;
    pushEnabled().then((on) => {
      if (!live) return;
      setState({ ready: true, checked: on && Notification.permission === "granted", note: Notification.permission === "denied" ? "notifyDenied" : "" });
    });
    return () => {
      live = false;
    };
  }, [supported]);

  if (!hydrated) return <NotifyToggleView checked={false} disabled />;
  if (!supported) return <NotifyToggleView checked={false} disabled note="notifyUnsupported" />;

  const onToggle = async (on: boolean) => {
    setBusy(true);
    setState((s) => ({ ...s, checked: on }));
    if (!on) {
      await disablePush();
      setState({ ready: true, checked: false, note: "" });
    } else {
      const r = await enablePush(lang);
      setState({ ready: true, checked: r === "on", note: r === "on" ? "notifyOn" : r === "denied" ? "notifyDenied" : "notifyError" });
    }
    setBusy(false);
  };

  return <NotifyToggleView checked={state.checked} disabled={!state.ready || busy} note={state.note} onToggle={onToggle} />;
}
