// "A new version is ready" with a Reload button, shown when a new service worker took over a page that already had one.
// A first install shows nothing. The view is separate so Storybook can show it without a real worker.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/Button";
import { registerServiceWorker } from "./register";

export function UpdatePromptView({ onReload, onClose }: { onReload: () => void; onClose?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[84px] z-40 mx-auto flex w-[min(440px,calc(100%-24px))] items-center gap-3 rounded-[14px] border border-edge bg-panel px-3.5 py-2.5 text-[0.9rem] text-text shadow-comic-lg"
    >
      <span className="min-w-0 flex-1">{t("updateReady")}</span>
      <Button variant="outline" onClick={onReload}>
        {t("updateNow")}
      </Button>
      {onClose && (
        <Button variant="ghost" aria-label={t("dismiss")} onClick={onClose} className="px-2 py-1 leading-none">
          ×
        </Button>
      )}
    </div>
  );
}

export function UpdatePrompt() {
  const [ready, setReady] = useState(false);
  useEffect(() => registerServiceWorker(() => setReady(true)), []);
  if (!ready) return null;
  return <UpdatePromptView onReload={() => location.reload()} onClose={() => setReady(false)} />;
}
