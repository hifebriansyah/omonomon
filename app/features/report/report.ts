// Tells the API Worker (which writes to the request log) when the page throws, so a bug on someone's phone shows up in Axiom.
// Sends only the message, the file and line, the page address and the browser type: nothing the visitor typed. At most 5 per
// visit, and the same error once. Sent as text/plain so the browser needs no CORS preflight. (Port of assets/scripts/report.js.)
import { useEffect } from "react";
import { config } from "~/lib/config";

const MAX_REPORTS = 5;
const sent = new Set<string>();

export function report(message: unknown, source: unknown, line: unknown) {
  const text = String(message || "").slice(0, 300);
  const key = `${text}|${source}|${line}`;
  if (!config.API_URL || !text || sent.size >= MAX_REPORTS || sent.has(key)) return;
  sent.add(key);
  try {
    fetch(`${config.API_URL}/errors`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ message: text, source: String(source || "").slice(0, 200), line: Number(line) || 0, page: location.pathname.slice(0, 100) }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

export function useErrorReports() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => report(e.message, e.filename, e.lineno);
    const onRejection = (e: PromiseRejectionEvent) => report(e.reason?.message || e.reason, "promise", 0);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}
