import type { Route } from "./+types/games";
import { Hub } from "~/features/games/Hub";
import { hub } from "~/lib/content";
import { pageHead, websiteLd } from "~/lib/head";
import { langOfPath, localize } from "~/lib/lang";

export const meta: Route.MetaFunction = ({ location }) => {
  const lang = langOfPath(location.pathname);
  const h = lang === "id" ? hub.id : hub;
  return pageHead({ lang, path: localize("/games/", lang), title: h.title, description: h.description, indexed: true, ld: websiteLd(lang) });
};

export default function Games() {
  return <Hub />;
}
