// Any address the app does not know, reached by moving around inside the app. A fresh visit to an unknown address gets the
// static 404.html written by scripts/postbuild.ts (GitHub Pages serves it with a real 404 status).
import { I18nextProvider, useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Route } from "./+types/not-found";
import { i18nFor } from "~/i18n";
import { type Lang, site } from "~/lib/content";
import { langOfPath, localize } from "~/lib/lang";

export const meta: Route.MetaFunction = () => [{ title: `Page not found | ${site.name}` }, { name: "robots", content: "noindex" }];

function NotFoundBody({ home }: { home: string }) {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center text-[1.1rem]">
      <div>
        <h1 className="text-2xl font-bold">{t("nobodyHome")}</h1>
        <p>
          {t("notFoundBody")}{" "}
          <Link to={home} className="text-link">
            {t("notFoundBack", { site: site.name })}
          </Link>{" "}
          {t("notFoundPick")}
        </p>
      </div>
    </main>
  );
}

/** The 404 view in the page language (also used by routes whose :slug matches nothing). */
export function NotFoundView({ lang }: { lang: Lang }) {
  return (
    <I18nextProvider i18n={i18nFor(lang)}>
      <NotFoundBody home={localize("/", lang)} />
    </I18nextProvider>
  );
}

export default function NotFound({ params }: Route.ComponentProps) {
  return <NotFoundView lang={langOfPath(`/${params["*"] || ""}`)} />;
}
