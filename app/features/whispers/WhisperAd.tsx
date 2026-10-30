// One Google AdSense in-feed ad, dressed like a whisper card (the look is set in the AdSense unit; this only gives it room).
// Settings come from site.json "ads". The ad's own script is loaded once, only when the first unit is made, and only in the
// browser. The unit stays hidden until Google has filled it, so an empty or blocked ad (or a site still under review) leaves no gap.
// ?adpreview (or `preview`, as in Storybook) shows a stand-in card instead: it never loads Google's script and is not an ad.
import { useEffect, useRef, useState } from "react";
import type { Site } from "~/lib/content";

let scriptLoaded = false;
function loadScript(client: string) {
  if (scriptLoaded) return;
  scriptLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  document.head.append(s);
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function WhisperAd({ ads, preview = false, test = false }: { ads: Site["ads"]; preview?: boolean; test?: boolean }) {
  const ins = useRef<HTMLModElement>(null);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const unit = ins.current;
    if (preview || !unit) return;
    loadScript(ads.client);
    const watch = new MutationObserver(() => setFilled(unit.dataset.adStatus === "filled"));
    watch.observe(unit, { attributes: true, attributeFilter: ["data-ad-status"] });
    // Google measures the unit when it is pushed, so push once it is in the page
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {} // blocked or not ready: the unit just stays hidden
    return () => watch.disconnect();
  }, [ads.client, preview]);

  if (preview) {
    return (
      <li className="border-b border-line px-1 py-2.5">
        <div className="mt-1.5 mb-2 flex flex-col overflow-hidden rounded-xl border border-[#2f333d] bg-row">
          <div className="grid aspect-square place-items-center bg-line text-[0.8rem] text-muted">ad preview (not a real ad)</div>
          <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
            <strong className="text-[0.9rem]">Ad headline goes here</strong>
            <small className="text-xs text-muted">Short description of the advertiser, two lines at most</small>
            <small className="text-xs text-muted">Ad · example.com</small>
          </div>
        </div>
      </li>
    );
  }
  return (
    <li hidden={!filled} className="border-b border-line px-1 py-2.5">
      <ins
        ref={ins}
        className="adsbygoogle block min-w-[250px]"
        data-ad-format="fluid"
        data-ad-layout-key={ads.layoutKey}
        data-ad-client={ads.client}
        data-ad-slot={ads.slot}
        data-adtest={test ? "on" : undefined} // Google's test ads: no impressions or clicks count
      />
    </li>
  );
}
