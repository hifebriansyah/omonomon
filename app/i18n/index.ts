// One i18next instance per language, made up front and synchronously, so the pre-rendered HTML and the first browser render use
// the same words (no hydration mismatch). The address decides the language: see lib/lang.ts.
import i18next, { type i18n as I18n } from "i18next";
import { initReactI18next } from "react-i18next";
import type { Lang } from "~/lib/content";
import en from "./en";
import id from "./id";

function make(lng: Lang): I18n {
  const inst = i18next.createInstance();
  inst.use(initReactI18next).init({
    lng,
    fallbackLng: "en",
    resources: { en: { translation: en }, id: { translation: id } },
    initAsync: false,
    interpolation: { escapeValue: false }, // React escapes
    returnNull: false,
  });
  return inst;
}

const instances: Partial<Record<Lang, I18n>> = {};
export const i18nFor = (lang: Lang): I18n => (instances[lang] ??= make(lang));

/** Text outside React (meta(), the chat engine's messages): t("en", "key", {...}). */
export const tr = (lang: Lang, key: string, options?: Record<string, unknown>): string =>
  (i18nFor(lang).t as unknown as (k: string, o?: Record<string, unknown>) => string)(key, options);
