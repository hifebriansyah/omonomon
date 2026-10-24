// One Google AdSense in-feed ad, dressed like a whisper card (the look is set in the AdSense unit; app.css only gives it room).
// Settings come from site.json "ads". The ad's own script is loaded once, only when the first unit is made. The unit stays
// hidden until Google has filled it, so an empty or blocked ad (or a site still under review) leaves no gap in the feed.

import { el } from "./ui.js";

let scriptLoaded = false;

function loadScript(client) {
  if (scriptLoaded) return;
  scriptLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  document.head.append(s);
}

// ads: the "ads" object of site.json (or undefined: no ads). Returns a list item, or null.
export function adItem(ads) {
  if (!ads?.client || !ads?.slot) return null;
  if (new URLSearchParams(location.search).has("adpreview")) return previewCard();
  loadScript(ads.client);
  const li = el("li", "whisper w-ad");
  li.hidden = true;
  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.style.display = "block";
  ins.dataset.adFormat = "fluid";
  ins.dataset.adLayoutKey = ads.layoutKey;
  ins.dataset.adClient = ads.client;
  ins.dataset.adSlot = ads.slot;
  if (new URLSearchParams(location.search).has("adtest")) ins.dataset.adtest = "on";  // Google's test ads: no impressions or clicks count
  li.append(ins);
  new MutationObserver(() => { li.hidden = ins.dataset.adStatus !== "filled"; }).observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });
  // Google measures the unit when it is pushed, so push once it is in the page
  queueMicrotask(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked or not ready: the unit just stays hidden */ }
  });
  return li;
}

// /whispers/?adpreview: a stand-in card that looks roughly like the AdSense unit, to check spacing and colours on localhost
// (Google fills nothing there). It never loads Google's script and is not an ad.
function previewCard() {
  const li = el("li", "whisper w-ad w-ad-preview");
  const box = el("div", "w-card");
  const img = el("div", "", "");
  img.style.cssText = "aspect-ratio:1/1;background:#2a2d36;display:grid;place-items:center;color:#8a92a1;font-size:0.8rem";
  img.textContent = "ad preview (not a real ad)";
  const text = el("div", "w-card-text");
  text.append(el("strong", "", "Ad headline goes here"), el("small", "", "Short description of the advertiser, two lines at most"), el("small", "", "Ad · example.com"));
  box.append(img, text);
  li.append(box);
  return li;
}
