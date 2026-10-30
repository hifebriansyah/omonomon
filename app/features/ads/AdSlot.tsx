// One Google AdSense in-feed ad (was assets/scripts/shell/ads.js). Settings come from site.json "ads"; the look is set in the
// AdSense unit. Google's script is loaded once, only in the browser and only when the first unit is shown (never during
// pre-render). The unit stays hidden until Google has filled it, so an empty or blocked ad (or a site still under review)
// leaves no gap.
// `?adpreview` on the address (and `placeholder`, for Storybook) shows a grey stand-in that is not an ad and loads nothing;
// `?adtest` asks Google for test ads (no impressions or clicks count).
import { type ElementType, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useHydrated } from "~/components/ClientOnly";
import type { Site } from "~/lib/content";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

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

export function AdSlot({ ads, placeholder = false, as: Tag = "div", className = "" }: { ads?: Site["ads"] | null; placeholder?: boolean; as?: ElementType; className?: string }) {
  const hydrated = useHydrated();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (!ads?.client || !ads?.slot) return null;
  if (placeholder) return <Placeholder as={Tag} className={className} />;
  if (!hydrated) return null; // the address's query is only known in the browser
  if (params.has("adpreview")) return <Placeholder as={Tag} className={className} />;
  return <Unit ads={ads} test={params.has("adtest")} as={Tag} className={className} />;
}

function Unit({ ads, test, as: Tag, className }: { ads: Site["ads"]; test: boolean; as: ElementType; className: string }) {
  const ref = useRef<HTMLModElement>(null);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const ins = ref.current;
    if (!ins) return;
    loadScript(ads.client);
    const watch = new MutationObserver(() => setFilled(ins.dataset.adStatus === "filled"));
    watch.observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });
    // Google measures the unit when it is pushed, so push once it is in the page
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {} // blocked or not ready: the unit just stays hidden
    return () => watch.disconnect();
  }, [ads.client]);
  return (
    <Tag hidden={!filled} className={`px-1 py-2.5 ${className}`}>
      <ins
        ref={ref}
        className="adsbygoogle block min-w-[250px]"
        data-ad-format="fluid"
        data-ad-layout-key={ads.layoutKey}
        data-ad-client={ads.client}
        data-ad-slot={ads.slot}
        data-adtest={test ? "on" : undefined}
      />
    </Tag>
  );
}

// A stand-in that looks roughly like the AdSense unit, to check spacing and colours (Google fills nothing on localhost).
function Placeholder({ as: Tag, className }: { as: ElementType; className: string }) {
  return (
    <Tag className={`px-1 py-2.5 ${className}`}>
      <div className="overflow-hidden rounded-card bg-panel">
        <div className="grid aspect-square place-items-center bg-line text-[0.8rem] text-muted">ad preview (not a real ad)</div>
        <div className="grid gap-0.5 p-3 text-sm">
          <strong>Ad headline goes here</strong>
          <small className="text-muted">Short description of the advertiser, two lines at most</small>
          <small className="text-muted">Ad · example.com</small>
        </div>
      </div>
    </Tag>
  );
}
