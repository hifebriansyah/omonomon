import type { Route } from "./+types/me";
import { MePage } from "~/features/shell/MePage";
import { site } from "~/lib/content";
import { named, pageHead } from "~/lib/head";
import { langOfPath, localize } from "~/lib/lang";
import { tr } from "~/i18n";

export const meta: Route.MetaFunction = ({ location }) => {
  const lang = langOfPath(location.pathname);
  return pageHead({ lang, path: localize("/me/", lang), title: named(lang, "meTitle"), description: tr(lang, "meDescription", { site: site.name }), indexed: false });
};

export default function Me() {
  return <MePage />;
}
