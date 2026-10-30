// The frame of an app page: the centred column (520px at most) and, on pages that have it, the bottom tab bar.
import type { CSSProperties, ReactNode } from "react";
import { useLang } from "~/lib/lang";
import { useWhisperDot } from "~/features/whispers/badge";
import { type Tab, TabBar } from "./TabBar";

export function Page({ tab, accent, children, className = "" }: { tab?: Tab; accent?: string; children: ReactNode; className?: string }) {
  const lang = useLang();
  const dot = useWhisperDot(tab);
  const style = accent ? ({ "--accent": accent } as CSSProperties) : undefined;
  return (
    <>
      <main style={style} className={`mx-auto min-h-dvh max-w-page px-3 ${tab ? "pb-[calc(84px+env(safe-area-inset-bottom))]" : "pb-8"} ${className}`}>
        {children}
      </main>
      {tab && <TabBar active={tab} lang={lang} dot={dot} />}
    </>
  );
}
