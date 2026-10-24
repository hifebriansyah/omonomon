// Tells the API Worker (which writes to the request log) when the page throws, so a bug on someone's phone shows up in Axiom.
// Sends only the message, the file and line, the page address and the browser type: nothing the visitor typed. At most 5 per
// page visit, and the same error is sent once. Sent as text/plain so the browser needs no CORS preflight.

const MAX_REPORTS = 5;
const sent = new Set();

function report(message, source, line) {
  const api = window.POCO_CONFIG?.API_URL;
  const text = String(message || "").slice(0, 300);
  const key = `${text}|${source}|${line}`;
  if (!api || !text || sent.size >= MAX_REPORTS || sent.has(key)) return;
  sent.add(key);
  try {
    fetch(api.replace(/\/+$/, "") + "/errors", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ message: text, source: String(source || "").slice(0, 200), line: Number(line) || 0, page: location.pathname.slice(0, 100) }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

window.addEventListener("error", (e) => report(e.message, e.filename, e.lineno));
window.addEventListener("unhandledrejection", (e) => report(e.reason?.message || e.reason, "promise", 0));
