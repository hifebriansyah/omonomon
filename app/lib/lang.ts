// The address decides the page language: no prefix is English, /id/... is Indonesian. Slugs are the same in both.
import { useLocation } from "react-router";
import type { Lang } from "./content";

export const LANGS: Lang[] = ["en", "id"];

/** The language of a router path (React Router paths never include BASE_PATH). */
export const langOfPath = (pathname: string): Lang => (pathname === "/id" || pathname.startsWith("/id/") ? "id" : "en");

/** The path without its language prefix: "/id/pocomon/" -> "/pocomon/". */
export const stripLang = (pathname: string): string => (langOfPath(pathname) === "id" ? pathname.slice(3) || "/" : pathname);

/** The same page in `lang`: localize("/pocomon/", "id") -> "/id/pocomon/". */
export const localize = (path: string, lang: Lang): string => {
  const bare = stripLang(path);
  return lang === "id" ? `/id${bare}` : bare;
};

export function useLang(): Lang {
  return langOfPath(useLocation().pathname);
}

/** localPath("pocomon/") in the current page language, for <Link to>. */
export function useLocalPath() {
  const lang = useLang();
  return (path: string) => localize(path.startsWith("/") ? path : `/${path}`, lang);
}
