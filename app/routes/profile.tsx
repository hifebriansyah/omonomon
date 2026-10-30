import { useLocation } from "react-router";
import { NotFoundView } from "./not-found";
import type { Route } from "./+types/profile";
import { Profile } from "~/features/shell/Profile";
import { characterBySlug, shareImage } from "~/lib/content";
import { characterSeo, characterTitle, pageHead, websiteLd } from "~/lib/head";
import { langOfPath, localize } from "~/lib/lang";

export const meta: Route.MetaFunction = ({ location, params }) => {
  const lang = langOfPath(location.pathname);
  const c = characterBySlug(params.slug);
  if (!c) return [{ title: "404" }];
  return pageHead({ lang, path: localize(`/${c.slug}/profile/`, lang), title: characterTitle(c, lang), description: characterSeo(c, lang).description, image: shareImage(c.id), indexed: true, ld: websiteLd(lang) });
};

export default function ProfileRoute({ params }: Route.ComponentProps) {
  const location = useLocation();
  if (!characterBySlug(params.slug)) return <NotFoundView lang={langOfPath(location.pathname)} />;
  return <Profile key={params.slug} character={characterBySlug(params.slug)!} />;
}
