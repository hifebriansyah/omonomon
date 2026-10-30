import type { Route } from "./+types/privacy";
import { PrivacyPage } from "~/features/shell/PrivacyPage";
import { site } from "~/lib/content";
import { named, pageHead } from "~/lib/head";
import { langOfPath, localize } from "~/lib/lang";
import { tr } from "~/i18n";

export const meta: Route.MetaFunction = ({ location }) => {
  const lang = langOfPath(location.pathname);
  return pageHead({ lang, path: localize("/privacy/", lang), title: named(lang, "privacyTitle"), description: tr(lang, "privacyDescription", { site: site.name }), indexed: true });
};

export default function Privacy() {
  return <PrivacyPage />;
}
