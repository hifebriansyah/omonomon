// Registers the offline worker (sw.js, made by tools/make_site.py) so the app and its games open without a network.
// Skipped where workers are not available (plain http, older browsers).

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {}); // the app works the same without it
  });
}
