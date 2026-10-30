import type { Route } from "./+types/loved";
import { LovedList } from "~/features/whispers/LovedList";
import { named, pageHead } from "~/lib/head";
import { langOfPath, localize } from "~/lib/lang";
import { tr } from "~/i18n";

export const meta: Route.MetaFunction = ({ location }) => {
  const lang = langOfPath(location.pathname);
  return pageHead({ lang, path: localize("/loved/", lang), title: named(lang, "lovedTitle"), description: tr(lang, "lovedDescription"), indexed: false });
};

export default function Loved() {
  return <LovedList />;
}
