// /:slug/ (a ghost on stage) and /:slug/history/ (her chat history, not indexed). Same screen; the address says which view.
import { useLocation } from "react-router";
import { NotFoundView } from "./not-found";
import type { Route } from "./+types/chat";
import { ChatScreen } from "~/features/chat/ChatScreen";
import { characterBySlug, shareImage } from "~/lib/content";
import { characterLd, characterSeo, characterTitle, named, pageHead } from "~/lib/head";
import { langOfPath, localize } from "~/lib/lang";
import { tr } from "~/i18n";

const isHistory = (pathname: string) => /\/history\/?$/.test(pathname);

export const meta: Route.MetaFunction = ({ location, params }) => {
  const lang = langOfPath(location.pathname);
  const c = characterBySlug(params.slug);
  if (!c) return [{ title: "404" }];
  const stage = localize(`/${c.slug}/`, lang);
  if (isHistory(location.pathname)) {
    return pageHead({ lang, path: `${stage}history/`, title: named(lang, "historyTitle", { name: c.name }), description: tr(lang, "historyAbout", { name: c.name }), image: shareImage(c.id), indexed: false });
  }
  return pageHead({ lang, path: stage, title: characterTitle(c, lang), description: characterSeo(c, lang).description, image: shareImage(c.id), indexed: true, ld: characterLd(c, lang, stage) });
};

export default function Chat({ params }: Route.ComponentProps) {
  const location = useLocation();
  if (!characterBySlug(params.slug)) return <NotFoundView lang={langOfPath(location.pathname)} />;
  const c = characterBySlug(params.slug)!;
  return <ChatScreen key={c.id} character={c} />;
}
