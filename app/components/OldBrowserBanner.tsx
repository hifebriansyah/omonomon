// "Your browser is too old": a plain HTML banner for browsers below the floor (what Tailwind CSS 4 needs: Safari 16.4, Chrome 111,
// Firefox 128). The check runs before the app, as an inline script in old JavaScript (ES5, no arrow functions), and the app still
// tries to start under it. The language comes from <html lang>, which the pre-render sets from the address.
// A <script nomodule> in root.tsx calls the same function for browsers without ES modules.

export const OLD_BROWSER_TEXT = {
  en: "Your browser is too old for Omon Omon. Please update it, or open the site in a recent Chrome, Safari or Firefox.",
  id: "Browser kamu terlalu lama untuk Omon Omon. Perbarui dulu, atau buka di Chrome, Safari atau Firefox terbaru.",
};
const CLOSE = { en: "Dismiss", id: "Tutup" };

// Inline styles only: Tailwind does not work in these browsers.
const BAR_STYLE = "position:fixed;top:0;left:0;right:0;z-index:99;display:flex;gap:12px;align-items:center;padding:12px 16px;background:#ffb454;color:#14151a;font:15px/1.4 system-ui,sans-serif;border-bottom:3px solid #14151a";
const BUTTON_STYLE = "flex:none;font:inherit;font-weight:bold;background:#14151a;color:#fff;border:0;border-radius:8px;padding:6px 12px;cursor:pointer";

export const OLD_BROWSER_SCRIPT = `(function(){
var T=${JSON.stringify(OLD_BROWSER_TEXT)},C=${JSON.stringify(CLOSE)};
function show(){if(document.getElementById("omon-old"))return;var l=document.documentElement.lang==="id"?"id":"en";
var d=document.createElement("div");d.id="omon-old";d.setAttribute("role","alert");d.style.cssText=${JSON.stringify(BAR_STYLE)};
var p=document.createElement("span");p.style.flex="1";p.appendChild(document.createTextNode(T[l]));
var b=document.createElement("button");b.type="button";b.style.cssText=${JSON.stringify(BUTTON_STYLE)};b.appendChild(document.createTextNode(C[l]));
b.onclick=function(){d.parentNode.removeChild(d)};d.appendChild(p);d.appendChild(b);document.body.insertBefore(d,document.body.firstChild)}
window.__omonOld=function(force){if(document.body)show();else document.addEventListener("DOMContentLoaded",show)};
if(!window.CSS||!CSS.supports||!CSS.supports("color","color-mix(in srgb, red, blue)"))window.__omonOld(true);
})();`;

/** The same banner as React markup, for Storybook. */
export function OldBrowserBanner({ lang = "en" }: { lang?: "en" | "id" }) {
  return (
    <div role="alert" style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", background: "#ffb454", color: "#14151a", font: "15px/1.4 system-ui,sans-serif", borderBottom: "3px solid #14151a" }}>
      <span style={{ flex: 1 }}>{OLD_BROWSER_TEXT[lang]}</span>
      <button type="button" style={{ font: "inherit", fontWeight: "bold", background: "#14151a", color: "#fff", border: 0, borderRadius: 8, padding: "6px 12px" }}>
        {CLOSE[lang]}
      </button>
    </div>
  );
}
