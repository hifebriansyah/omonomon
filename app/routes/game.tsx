import { useLocation } from "react-router";
import { NotFoundView } from "./not-found";
import type { Route } from "./+types/game";
import { GamePage } from "~/features/games/GamePage";
import { characterById, gameBySlug, shareImage, site } from "~/lib/content";
import { pageHead } from "~/lib/head";
import { langOfPath, localize } from "~/lib/lang";
import { tr } from "~/i18n";

export const meta: Route.MetaFunction = ({ location, params }) => {
  const lang = langOfPath(location.pathname);
  const g = gameBySlug(params.game);
  const c = characterById(g?.character);
  if (!g || !c) return [{ title: "404" }];
  const description = ((lang === "id" && g.id?.description) || g.description).replaceAll("{name}", c.name);
  const path = localize(`/games/${g.slug}/`, lang);
  const ld = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: g.title,
    description,
    url: `${site.url}${path}`,
    applicationCategory: "Game",
    genre: "Arcade",
    playMode: "SinglePlayer",
    inLanguage: ["en", "id"],
    image: shareImage(c.id),
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  return pageHead({ lang, path, title: `${tr(lang, "gameTitle", { game: g.title, name: c.name })} | ${site.name}`, description, image: shareImage(c.id), indexed: true, ld });
};

export default function Game({ params }: Route.ComponentProps) {
  const location = useLocation();
  if (!gameBySlug(params.game)?.ready) return <NotFoundView lang={langOfPath(location.pathname)} />;
  return <GamePage key={params.game} game={gameBySlug(params.game)!} />;
}
