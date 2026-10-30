import type { Route } from "./+types/home";
import { HomeList } from "~/features/shell/HomeList";
import { pageHead, siteDescription, siteTitle, websiteLd } from "~/lib/head";
import { langOfPath } from "~/lib/lang";

export const meta: Route.MetaFunction = ({ location }) => {
  const lang = langOfPath(location.pathname);
  return pageHead({ lang, path: lang === "id" ? "/id/" : "/", title: siteTitle(lang), description: siteDescription(lang), indexed: true, ld: websiteLd(lang) });
};

export default function Home() {
  return <HomeList />;
}
