// The first visit to an English page: a browser set to Indonesian (or with a saved choice of "id") is sent to the /id/ copy.
// Once per visit (so Back still works), never for search engine bots, and never when the visitor picked English on Me.
import { isbot } from "isbot";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { KEYS, SESSION_KEYS, getText, setText } from "./storage";
import { langOfPath, localize } from "./lang";

export function useFirstVisitLanguage() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (getText(SESSION_KEYS.langChecked, "session")) return;
    setText(SESSION_KEYS.langChecked, "1", "session");
    if (langOfPath(location.pathname) !== "en" || isbot(navigator.userAgent)) return;
    const saved = getText(KEYS.lang);
    const browserId = (navigator.languages || [navigator.language]).some((l) => /^(id|in)\b/i.test(l));
    if (saved === "id" || (saved !== "en" && browserId)) {
      navigate(localize(location.pathname, "id") + location.search + location.hash, { replace: true });
    }
    // only on the first page of the visit
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
